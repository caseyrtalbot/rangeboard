import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { OptimizeWorkerRequest } from './optimize/client'
import { runOptimize } from './optimize/loop'
import { placementRequest } from './optimize/__fixtures__/placementFixture'
import type { OptimizeWorkerMessage } from './optimizeTypes'

/**
 * The real worker module, driven as mc.worker.sweep.test.ts drives the
 * sweep: `self` is a stub that records what the worker posts.
 */
let context: {
  onmessage: ((event: { data: OptimizeWorkerRequest }) => Promise<void>) | null
  postMessage: ReturnType<typeof vi.fn>
}

const posted = (): OptimizeWorkerMessage[] =>
  context.postMessage.mock.calls.map((c) => c[0] as OptimizeWorkerMessage)

beforeEach(async () => {
  vi.resetModules()
  context = { onmessage: null, postMessage: vi.fn() }
  vi.stubGlobal('self', context)
  await import('./optimize.worker')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('posts progress per evaluation then done with the loop result and a wall time', async () => {
  const req = placementRequest({ budget: { evaluations: 12, replicates: 8, seed: 21 } })
  await context.onmessage!({ data: req })
  const messages = posted()
  const progress = messages.filter((m) => m.type === 'optimize-progress')
  expect(progress.map((m) => m.type === 'optimize-progress' && m.done)).toEqual(
    Array.from({ length: 12 }, (_, i) => i + 1),
  )
  expect(
    progress.every(
      (m) => m.type === 'optimize-progress' && m.total === 12 && m.best?.incumbent === true,
    ),
  ).toBe(true)
  const done = messages.at(-1)!
  if (done.type !== 'optimize-done') throw new Error(done.type)
  expect(done.runId).toBe(req.runId)
  expect(done.result.elapsedMs).toBeGreaterThanOrEqual(0)
  expect({ ...done.result, elapsedMs: 0 }).toEqual(runOptimize(req))
})

it('a cancel after the third evaluation ends the run with the trace so far', async () => {
  // Every clock read is 100 ms later, so the driver yields at every checkpoint
  // and a cancel posted at the third progress lands before the fourth evaluation ends.
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 100))
  const req = placementRequest({ budget: { evaluations: 12, replicates: 8, seed: 21 } })
  context.postMessage.mockImplementation((m: OptimizeWorkerMessage) => {
    if (m.type === 'optimize-progress' && m.done === 3)
      void context.onmessage!({ data: { type: 'cancel', runId: req.runId } })
  })
  await context.onmessage!({ data: req })
  const messages = posted()
  const done = messages.at(-1)!
  if (done.type !== 'optimize-done') throw new Error(done.type)
  expect(done.result.trace).toHaveLength(3)
  expect(done.result.replicatesRun).toBe(24)
  expect(messages.filter((m) => m.type === 'optimize-progress')).toHaveLength(3)
})

it('a cancel for another run id is ignored and a bad request posts an error', async () => {
  const req = placementRequest({ budget: { evaluations: 2, replicates: 2, seed: 1 } })
  context.postMessage.mockImplementation((m: OptimizeWorkerMessage) => {
    if (m.type === 'optimize-progress' && m.done === 1)
      void context.onmessage!({ data: { type: 'cancel', runId: 'other' } })
  })
  await context.onmessage!({ data: req })
  const done = posted().at(-1)!
  if (done.type !== 'optimize-done') throw new Error(done.type)
  expect(done.result.trace).toHaveLength(2)
  context.postMessage.mockReset()
  await context.onmessage!({ data: placementRequest({ runId: 'bad', movableIds: ['nobody'] }) })
  expect(posted()).toEqual([
    {
      type: 'optimize-error',
      runId: 'bad',
      message: 'Optimize movable id nobody is not in the scenario',
    },
  ])
})
