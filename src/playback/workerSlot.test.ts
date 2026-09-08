import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ControlledWorker } from './controlledWorker'
import type { SlotProtocol } from './workerSlot'
import { CANCEL_GRACE_MS, CANCEL_TIMEOUT_MESSAGE, createWorkerSlot } from './workerSlot'

type Msg = { type: 'tick' | 'done' | 'error'; id: string; text?: string }

/** A minimal protocol: messages carry an id; `done` and `error` end the run. */
function protocol(id: string, onMessage = vi.fn<(m: Msg) => void>()) {
  const spec: SlotProtocol<Msg> = {
    spawn: () => new Worker('slot.worker.js'),
    request: { id },
    decode: (data) => {
      const m = data as Partial<Msg> | null
      return m != null && m.id === id && typeof m.type === 'string' ? (m as Msg) : null
    },
    errorOf: (text) => ({ type: 'error', id, text }),
    terminal: (m) => m.type !== 'tick',
    onMessage,
  }
  return { spec, onMessage }
}

describe('worker slot', () => {
  beforeEach(() => ControlledWorker.install())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('posts the request, forwards owned messages and releases on a terminal one', () => {
    const slot = createWorkerSlot()
    const { spec, onMessage } = protocol('a')
    expect(slot.start(spec)).toBe(true)
    const worker = ControlledWorker.latest()
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ id: 'a' })
    worker.send({ type: 'tick', id: 'a' })
    worker.send({ type: 'tick', id: 'other' })
    expect(worker.terminated).toBe(false)
    const queued = worker.onmessage!
    worker.send({ type: 'done', id: 'a' })
    expect(worker.terminated).toBe(true)
    expect(worker.onmessage).toBeNull()
    queued({ data: { type: 'done', id: 'a' } })
    expect(onMessage.mock.calls.map(([m]) => m.type)).toEqual(['tick', 'done'])
  })

  it('a replacement terminates the prior worker and drops its queued callbacks', () => {
    const slot = createWorkerSlot()
    const old = protocol('a')
    slot.start(old.spec)
    const oldWorker = ControlledWorker.latest()
    const queued = oldWorker.onmessage!
    const error = oldWorker.onerror!
    const fresh = protocol('a')
    slot.start(fresh.spec)
    expect(oldWorker.terminated).toBe(true)
    queued({ data: { type: 'done', id: 'a' } })
    error({ message: 'late' })
    expect(old.onMessage).not.toHaveBeenCalled()
    expect(fresh.onMessage).not.toHaveBeenCalled()
    ControlledWorker.latest().send({ type: 'done', id: 'a' })
    expect(fresh.onMessage).toHaveBeenCalledOnce()
  })

  it('dispose terminates now and a callback after it is dropped', () => {
    const slot = createWorkerSlot()
    const { spec, onMessage } = protocol('a')
    slot.start(spec)
    const worker = ControlledWorker.latest()
    const queued = worker.onmessage!
    slot.dispose()
    slot.dispose()
    expect(worker.terminate).toHaveBeenCalledOnce()
    queued({ data: { type: 'done', id: 'a' } })
    worker.fail('late')
    expect(onMessage).not.toHaveBeenCalled()
    expect(slot.cancel({ type: 'cancel' })).toBe(false)
  })

  it('cancel posts once, accepts the answer within the grace period, else terminates with an error', () => {
    vi.useFakeTimers()
    const slot = createWorkerSlot()
    const answered = protocol('a')
    slot.start(answered.spec)
    const first = ControlledWorker.latest()
    expect(slot.cancel({ type: 'cancel', id: 'a' })).toBe(true)
    expect(slot.cancel({ type: 'cancel', id: 'a' })).toBe(false)
    expect(first.postMessage).toHaveBeenLastCalledWith({ type: 'cancel', id: 'a' })
    first.send({ type: 'done', id: 'a' })
    vi.advanceTimersByTime(CANCEL_GRACE_MS + 1)
    expect(answered.onMessage).toHaveBeenCalledExactlyOnceWith({ type: 'done', id: 'a' })
    const silent = protocol('b')
    slot.start(silent.spec)
    const second = ControlledWorker.latest()
    slot.cancel({ type: 'cancel', id: 'b' })
    vi.advanceTimersByTime(CANCEL_GRACE_MS + 1)
    expect(second.terminated).toBe(true)
    expect(silent.onMessage).toHaveBeenCalledExactlyOnceWith({ type: 'error', id: 'b', text: CANCEL_TIMEOUT_MESSAGE })
  })

  it.each(['construction', 'post'])('a synchronous %s failure is one terminal error and leaves nothing live', (kind) => {
    ControlledWorker.constructionError = kind === 'construction' ? 'Worker blocked' : null
    ControlledWorker.postError = kind === 'post' ? 'Cannot clone request' : null
    const slot = createWorkerSlot()
    const { spec, onMessage } = protocol('a')
    expect(slot.start(spec)).toBe(true)
    expect(onMessage).toHaveBeenCalledExactlyOnceWith({ type: 'error', id: 'a',
      text: kind === 'construction' ? 'Worker blocked' : 'Cannot clone request' })
    if (kind === 'post') expect(ControlledWorker.latest().terminated).toBe(true)
    expect(slot.cancel({ type: 'cancel' })).toBe(false)
    ControlledWorker.constructionError = null
    ControlledWorker.postError = null
    slot.start(spec)
    ControlledWorker.latest().send({ type: 'done', id: 'a' })
    expect(onMessage).toHaveBeenCalledTimes(2)
  })

  it('returns false without a Worker and starts nothing', () => {
    const slot = createWorkerSlot()
    const first = protocol('a')
    slot.start(first.spec)
    const worker = ControlledWorker.latest()
    vi.stubGlobal('Worker', undefined)
    const { spec, onMessage } = protocol('b')
    expect(slot.start(spec)).toBe(false)
    expect(worker.terminated).toBe(true)
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('two slots started together stay independent', () => {
    const one = createWorkerSlot()
    const two = createWorkerSlot()
    const a = protocol('a')
    const b = protocol('b')
    one.start(a.spec)
    two.start(b.spec)
    const [first, second] = ControlledWorker.instances
    one.start(protocol('a').spec)
    expect(first.terminated).toBe(true)
    expect(second.terminated).toBe(false)
    second.send({ type: 'done', id: 'b' })
    expect(b.onMessage).toHaveBeenCalledOnce()
    expect(ControlledWorker.latest().terminated).toBe(false)
  })
})
