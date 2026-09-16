import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CANCEL_GRACE_MS, CANCEL_TIMEOUT_MESSAGE } from '../workerSlot'
import { ControlledWorker } from '../controlledWorker'
import type { OptimizeEvaluation, OptimizeResult, OptimizeWorkerMessage } from '../optimizeTypes'
import { cancelOptimize, startOptimize } from './client'
import { placementRequest } from './__fixtures__/placementFixture'

const stat = {
  mean: 1,
  sd: 0,
  se: 0,
  lo: 0.925,
  hi: 1,
  conf: 0.95,
  interval: 'rule-of-three' as const,
  p10: 1,
  p90: 1,
  p025: 1,
  p975: 1,
  n: 40,
  total: 40,
  defined: { p: 1, lo: 1, hi: 1 },
}
const start: OptimizeEvaluation = {
  index: 0,
  positions: { eff: { x: 0, y: 5000 } },
  objective: stat,
  incumbent: true,
}

function result(runId: string): OptimizeResult {
  const request = placementRequest({ runId })
  return {
    method: 'gp-ei',
    objective: request.objective,
    movableIds: request.movableIds,
    budget: request.budget,
    candidates: [{ positions: start.positions, objective: stat, evaluationIndex: 0 }],
    trace: [start],
    replicatesRun: 40,
    elapsedMs: 3,
  }
}

function begin(runId = 'optimize-fixed-run') {
  const request = placementRequest({ runId })
  const deliver = vi.fn<(m: OptimizeWorkerMessage) => void>()
  expect(startOptimize(request, deliver)).toBe(true)
  return { request, deliver, worker: ControlledWorker.latest() }
}

describe('optimize worker client', () => {
  beforeEach(() => {
    ControlledWorker.install()
  })
  afterEach(() => {
    cancelOptimize()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('posts the request, delivers progress without release, and releases on done', () => {
    const { request, deliver, worker } = begin()
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith(request)
    const progress: OptimizeWorkerMessage = {
      type: 'optimize-progress',
      runId: request.runId,
      done: 1,
      total: 60,
      best: start,
    }
    worker.send(progress)
    expect(deliver).toHaveBeenCalledExactlyOnceWith(progress)
    expect(worker.terminate).not.toHaveBeenCalled()
    const done: OptimizeWorkerMessage = {
      type: 'optimize-done',
      runId: request.runId,
      result: result(request.runId),
    }
    worker.send(done)
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(deliver).toHaveBeenLastCalledWith(done)
    expect(worker.onmessage).toBeNull()
  })

  it('drops messages of another run id or an unknown type', () => {
    const { deliver, worker } = begin()
    worker.send({ type: 'optimize-done', runId: 'other', result: result('other') })
    worker.send({ type: 'done', runId: 'optimize-fixed-run' })
    worker.send('text')
    expect(deliver).not.toHaveBeenCalled()
    expect(worker.terminate).not.toHaveBeenCalled()
  })

  it('shapes a worker failure as an optimize-error and a second start replaces the first', () => {
    const old = begin()
    const fresh = begin()
    expect(old.worker.terminate).toHaveBeenCalledOnce()
    old.worker.fail('late')
    expect(old.deliver).not.toHaveBeenCalled()
    fresh.worker.fail('boom')
    expect(fresh.deliver).toHaveBeenCalledExactlyOnceWith({
      type: 'optimize-error',
      runId: 'optimize-fixed-run',
      message: 'boom',
    })
    expect(fresh.worker.terminate).toHaveBeenCalledOnce()
  })

  it('cancelOptimize with a run id posts the cancel and times out through the slot; without one it terminates', () => {
    vi.useFakeTimers()
    const { request, deliver, worker } = begin()
    expect(cancelOptimize(request.runId)).toBe(true)
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'cancel', runId: request.runId })
    // A second cancel while one is in flight is refused.
    expect(cancelOptimize(request.runId)).toBe(false)
    vi.advanceTimersByTime(CANCEL_GRACE_MS)
    expect(deliver).toHaveBeenCalledExactlyOnceWith({
      type: 'optimize-error',
      runId: request.runId,
      message: CANCEL_TIMEOUT_MESSAGE,
    })
    expect(worker.terminate).toHaveBeenCalledOnce()
    // Nothing live: a cancel by id reports false, a bare cancel is idempotent.
    expect(cancelOptimize(request.runId)).toBe(false)
    expect(cancelOptimize()).toBe(true)
    const next = begin()
    expect(cancelOptimize()).toBe(true)
    expect(next.worker.terminate).toHaveBeenCalledOnce()
    expect(next.deliver).not.toHaveBeenCalled()
  })
})
