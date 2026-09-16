import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import type { McRequest, McSweepMessage, McSweepRequest } from './mcRun'
import { runSweep } from './mcRun'

/**
 * The sweep route of the real worker module, driven as trial.worker.test.ts
 * drives its worker: `self` is a stub that records what the worker posts.
 */
let context: {
  onmessage: ((event: { data: McRequest }) => Promise<void>) | null
  postMessage: ReturnType<typeof vi.fn>
}

function request(): McSweepRequest {
  return {
    type: 'sweep',
    runId: 'sweep-fixed-run',
    scenario: parseAutosave(JSON.stringify(fixture)),
    factors: [
      { id: 'threatAltitudeFt', values: [300, 3000] },
      { id: 'threatSpeedMps', values: [20, 40] },
    ],
    replicatesPerCell: 4,
    responses: ['leakers'],
  }
}

const posted = (): McSweepMessage[] =>
  context.postMessage.mock.calls.map((c) => c[0] as McSweepMessage)

beforeEach(async () => {
  vi.resetModules()
  context = { onmessage: null, postMessage: vi.fn() }
  vi.stubGlobal('self', context)
  await import('./mc.worker')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('completes a 2 x 2 sweep of 4 replicates and posts the loop summary with progress per cell', async () => {
  const req = request()
  await context.onmessage!({ data: req })
  const messages = posted()
  expect(messages.map((m) => m.type)).toEqual([
    'sweep-progress',
    'sweep-progress',
    'sweep-progress',
    'sweep-done',
  ])
  expect(messages.slice(0, 3)).toEqual(
    [1, 2, 3].map((done) => ({ type: 'sweep-progress', runId: req.runId, done, total: 4 })),
  )
  const done = messages[3]
  if (done.type !== 'sweep-done') throw new Error(done.type)
  expect(done.runId).toBe(req.runId)
  expect(done.summary.elapsedMs).toBeGreaterThanOrEqual(0)
  const { scenario, ...spec } = req
  expect({ ...done.summary, elapsedMs: 0 }).toEqual(runSweep({ ...spec, scenario }))
})

it('a cancel between cells keeps the cells done and reports the rule', async () => {
  // Every clock read is 100 ms later, so the driver yields to events after every cell.
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 100))
  const req = request()
  const run = context.onmessage!({ data: req })
  // The driver is parked at its first yield; the cancel is read when it resumes.
  await context.onmessage!({ data: { type: 'cancel', runId: req.runId } })
  await run
  const done = posted().at(-1)!
  if (done.type !== 'sweep-done') throw new Error(done.type)
  expect(done.summary.stopped).toEqual({ rule: 'cancelled', at: 1 })
  expect(done.summary.cells).toHaveLength(1)
  expect(done.summary.cells[0]).toEqual(runSweep(request()).cells[0])
  // A cancel for another run is ignored: the next run completes.
  context.postMessage.mockClear()
  vi.restoreAllMocks()
  const next = context.onmessage!({ data: { ...request(), runId: 'other' } })
  await context.onmessage!({ data: { type: 'cancel', runId: req.runId } })
  await next
  const last = posted().at(-1)!
  expect(last.type).toBe('sweep-done')
  if (last.type === 'sweep-done') expect('stopped' in last.summary).toBe(false)
})

it('posts a sweep error for a refused request without a summary', async () => {
  const req = request()
  req.factors = [{ id: 'raidSize', values: [1] }]
  await context.onmessage!({ data: req })
  expect(context.postMessage).toHaveBeenCalledExactlyOnceWith({
    type: 'sweep-error',
    runId: req.runId,
    message: 'raidSize takes 2 to 6 values, not 1',
  })
})
