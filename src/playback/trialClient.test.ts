import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyScenario } from '../model/seed'
import { cancelSensitivity, startSensitivity } from './mcClient'
import { cancelTrial, startTrial } from './trialClient'
import type { TrialRequest } from './trialMessages'
import { createTrialManifest } from './trialTypes'
import { ControlledWorker } from './controlledWorker'

function request(requestToken = 'attempt-1'): TrialRequest {
  const scenario = emptyScenario()
  const runId = 'same-run'
  const basisSignature = 'same-basis'
  return {
    type: 'prepare-trial',
    requestToken,
    runId,
    basisSignature,
    scenario,
    manifest: createTrialManifest(scenario, runId, basisSignature),
  }
}

function done(req: TrialRequest) {
  return {
    type: 'trial-done',
    requestToken: req.requestToken,
    runId: req.runId,
    basisSignature: req.basisSignature,
    result: {
      manifest: { ...req.manifest },
      assessments: [],
      report: { events: [], threats: [], effectors: [], totals: {} },
      observations: [],
      jamDecisions: [],
    },
  }
}

function start(req = request(), callback = vi.fn()) {
  expect(startTrial(req, callback)).toBe(true)
  return { req, callback, worker: ControlledWorker.latest() }
}

describe('single-trial worker ownership', () => {
  beforeEach(() => {
    ControlledWorker.install()
  })
  afterEach(() => {
    cancelTrial()
    cancelSensitivity()
    vi.unstubAllGlobals()
  })

  it('posts the captured request and releases the worker before delivering its result', () => {
    const { req, callback, worker } = start()
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith(req)
    const queued = worker.onmessage!
    const error = worker.onerror!
    const decodeError = worker.onmessageerror!
    worker.send(done(req))
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledExactlyOnceWith(done(req))
    expect(worker.onmessage).toBeNull()
    queued({ data: done(req) })
    error({ message: 'late failure' })
    decodeError()
    expect(callback).toHaveBeenCalledOnce()
  })

  it('accepts a structured clone of the result, whose manifest arrays share no identity', () => {
    const { req, callback, worker } = start()
    worker.send(structuredClone(done(req)))
    expect(callback).toHaveBeenCalledExactlyOnceWith(done(req))
  })

  it('rejects old queued callbacks even when a replacement has identical run and request identities', () => {
    const old = start()
    const queued = old.worker.onmessage!
    const error = old.worker.onerror!
    const fresh = start(old.req)
    expect(old.worker.terminate).toHaveBeenCalledOnce()
    queued({ data: done(old.req) })
    error({ message: 'old failure' })
    expect(old.callback).not.toHaveBeenCalled()
    expect(fresh.callback).not.toHaveBeenCalled()
    fresh.worker.send(done(fresh.req))
    expect(fresh.callback).toHaveBeenCalledOnce()
  })

  it.each(['requestToken', 'runId', 'basisSignature'] as const)(
    'rejects wrong %s on every terminal message',
    (field) => {
      const { req, callback, worker } = start()
      worker.send({ ...done(req), [field]: 'wrong' })
      worker.send({ ...done(req), type: 'trial-error', message: 'wrong', [field]: 'wrong' })
      expect(callback).not.toHaveBeenCalled()
      expect(worker.terminate).not.toHaveBeenCalled()
      worker.send(done(req))
      expect(callback).toHaveBeenCalledOnce()
    },
  )

  it('ignores unrelated messages and rejects a prior attempt in the same run', () => {
    const { req, callback, worker } = start(request('attempt-2'))
    for (const data of [
      null,
      [],
      'bad',
      {},
      { ...done(req), type: 'done' },
      done(request('attempt-1')),
    ])
      worker.send(data)
    expect(callback).not.toHaveBeenCalled()
    worker.send(done(req))
    expect(callback).toHaveBeenCalledOnce()
  })

  it.each([
    'missing-result',
    'manifest',
    'assessments',
    'report',
    'observations',
    'jamDecisions',
    'error',
  ])('terminates and reports matching malformed %s once', (kind) => {
    const { req, callback, worker } = start()
    const queued = worker.onmessage!
    const message = done(req)
    const malformed =
      kind === 'missing-result'
        ? { ...message, result: null }
        : kind === 'error'
          ? { ...message, type: 'trial-error', message: null }
          : {
              ...message,
              result: {
                ...message.result,
                [kind]:
                  kind === 'manifest' ? { ...req.manifest, seed: req.manifest.seed + 1 } : null,
              },
            }
    worker.send(malformed)
    expect(callback).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'trial-error', requestToken: req.requestToken }),
    )
    expect(worker.terminate).toHaveBeenCalledOnce()
    queued({ data: message })
    expect(callback).toHaveBeenCalledOnce()
  })

  it.each(['reported', 'native', 'decode'])('releases the worker after a %s error', (kind) => {
    const { req, callback, worker } = start()
    const queued = worker.onmessage!
    if (kind === 'reported') worker.send({ ...done(req), type: 'trial-error', message: 'failed' })
    if (kind === 'native') worker.onerror!({ message: 'failed' })
    if (kind === 'decode') worker.onmessageerror!()
    expect(callback).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'trial-error' }),
    )
    expect(worker.terminate).toHaveBeenCalledOnce()
    queued({ data: done(req) })
    expect(callback).toHaveBeenCalledOnce()
  })

  it('cancels immediately without posting or accepting a late message', () => {
    const { req, callback, worker } = start()
    const queued = worker.onmessage!
    cancelTrial()
    cancelTrial()
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    queued({ data: done(req) })
    expect(callback).not.toHaveBeenCalled()
  })

  it('returns unavailable without a callback and cancels the previous worker', () => {
    const old = start()
    vi.stubGlobal('Worker', undefined)
    const callback = vi.fn()
    expect(startTrial(request(), callback)).toBe(false)
    expect(old.worker.terminate).toHaveBeenCalledOnce()
    expect(callback).not.toHaveBeenCalled()
  })

  it.each(['construction', 'post'])(
    'reports %s failures without throwing or retaining a worker',
    (kind) => {
      ControlledWorker.constructionError = kind === 'construction' ? 'Worker blocked' : null
      ControlledWorker.postError = kind === 'post' ? 'Cannot clone request' : null
      const callback = vi.fn()
      expect(startTrial(request(), callback)).toBe(true)
      expect(callback).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ type: 'trial-error' }),
      )
      if (kind === 'post') expect(ControlledWorker.instances[0].terminate).toHaveBeenCalledOnce()
      cancelTrial()
      expect(callback).toHaveBeenCalledOnce()
      ControlledWorker.constructionError = null
      ControlledWorker.postError = null
      const fresh = start()
      fresh.worker.send(done(fresh.req))
      expect(fresh.callback).toHaveBeenCalledOnce()
    },
  )

  it('allows a completion callback to start another trial without terminating the new worker', () => {
    let next: ReturnType<typeof start> | undefined
    const first = start(
      request(),
      vi.fn(() => {
        next = start(request('attempt-2'))
      }),
    )
    first.worker.send(done(first.req))
    expect(next!.worker.terminate).not.toHaveBeenCalled()
    next!.worker.send(done(next!.req))
    expect(next!.callback).toHaveBeenCalledOnce()
  })

  it('keeps the trial and sensitivity slots independent during replacement, completion and cancellation', () => {
    const scenario = emptyScenario()
    const sensCallback = vi.fn()
    startSensitivity(scenario, 'run', sensCallback)
    const [sens] = ControlledWorker.instances
    const first = start()
    const second = start(request('attempt-2'))
    expect(first.worker.terminate).toHaveBeenCalledOnce()
    expect(sens.terminate).not.toHaveBeenCalled()
    cancelSensitivity()
    expect(sens.terminate).toHaveBeenCalledOnce()
    startSensitivity(scenario, 'run', sensCallback)
    expect(second.worker.terminate).not.toHaveBeenCalled()
    const freshSens = ControlledWorker.latest()
    second.worker.send(done(second.req))
    expect(second.callback).toHaveBeenCalledOnce()
    // A completed trial releases its own worker; the sensitivity slot is untouched.
    expect(second.worker.terminate).toHaveBeenCalledOnce()
    expect(freshSens.terminate).not.toHaveBeenCalled()
    const third = start()
    cancelTrial()
    expect(third.worker.terminate).toHaveBeenCalledOnce()
    expect(freshSens.terminate).not.toHaveBeenCalled()
    freshSens.send({ type: 'sens-done', runId: 'run', summary: {} })
    expect(sensCallback).toHaveBeenCalledOnce()
    expect(freshSens.terminate).toHaveBeenCalledOnce()
    expect(third.worker.terminate).toHaveBeenCalledOnce()
  })

  it('does not accumulate live workers across 30 new preparations', () => {
    for (let i = 0; i < 30; i++) {
      const work = start(request(`attempt-${i}`))
      if (i % 2 === 0) work.worker.send(done(work.req))
      else cancelTrial()
    }
    expect(ControlledWorker.instances).toHaveLength(30)
    expect(
      ControlledWorker.instances.every((worker) => worker.terminate.mock.calls.length === 1),
    ).toBe(true)
  })
})
