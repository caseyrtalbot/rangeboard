import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import { uncertainFields } from '../analysis/uncertainty'
import type {
  McMorrisMessage,
  McMorrisRequest,
  McRequest,
  McSobolMessage,
  McSobolRequest,
} from './mcRun'
import { sobolLoop } from './sobol'

/**
 * The Morris and Sobol routes of the real worker module, driven as
 * mc.worker.sweep.test.ts drives the sweep: `self` is a stub that records
 * what the worker posts. Morris is cut after two trajectories through the
 * cancel path (the full screening is 140 engine runs); Sobol runs base 8 over
 * two kept fields, 32 rows, and must equal the loop run in-process.
 */
let context: {
  onmessage: ((event: { data: McRequest }) => Promise<void>) | null
  postMessage: ReturnType<typeof vi.fn>
}

const laydown = () => ({ ...parseAutosave(JSON.stringify(fixture)), sobolBase: 8 })

const posted = <M>(): M[] => context.postMessage.mock.calls.map((c) => c[0] as M)

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

it('screens two Morris trajectories with progress per row and posts the cut result', async () => {
  // Every clock read is 100 ms later, so the driver yields after every row and
  // a cancel posted at the 28th row lands before the 29th.
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 100))
  const scenario = laydown()
  const k = uncertainFields(scenario).length
  const req: McMorrisRequest = {
    type: 'morris',
    runId: 'morris-fixed-run',
    scenario,
    response: 'firstDetectS',
  }
  const rows = 2 * (k + 1)
  context.postMessage.mockImplementation((m: McMorrisMessage) => {
    if (m.type === 'morris-progress' && m.done === rows)
      void context.onmessage!({ data: { type: 'cancel', runId: req.runId } })
  })
  await context.onmessage!({ data: req })
  const messages = posted<McMorrisMessage>()
  const progress = messages.filter((m) => m.type === 'morris-progress')
  expect(progress.map((m) => m.type === 'morris-progress' && m.done)).toEqual(
    Array.from({ length: rows }, (_, i) => i + 1),
  )
  expect(progress.every((m) => m.type === 'morris-progress' && m.total === 10 * (k + 1))).toBe(true)
  const done = messages.at(-1)!
  if (done.type !== 'morris-done') throw new Error(done.type)
  expect(done.runId).toBe(req.runId)
  expect(done.result).toMatchObject({
    method: 'morris',
    trajectories: 2,
    evaluations: rows,
    response: 'firstDetectS',
  })
  expect(done.result.fields).toHaveLength(k)
  expect(done.result.kept.length).toBeGreaterThan(0)
}, 60000)

it('runs Sobol at base 8 over two kept fields and posts the loop result with progress per row', async () => {
  const scenario = laydown()
  const fields = uncertainFields(scenario)
  const kept = [
    fields.find((f) => f.modelId === 'lib-coyote' && f.field === 'pk')!,
    fields.find((f) => f.modelId === 'lib-kurfs' && f.field === 'detectRangeM')!,
  ]
  const req: McSobolRequest = {
    type: 'sobol',
    runId: 'sobol-fixed-run',
    scenario,
    kept,
    response: 'firstDetectS',
  }
  await context.onmessage!({ data: req })
  const messages = posted<McSobolMessage>()
  expect(messages.map((m) => m.type)).toEqual([
    ...Array.from({ length: 32 }, () => 'sobol-progress'),
    'sobol-done',
  ])
  expect(messages[0]).toEqual({ type: 'sobol-progress', runId: req.runId, done: 1, total: 32 })
  const done = messages.at(-1)!
  if (done.type !== 'sobol-done') throw new Error(done.type)
  const loop = sobolLoop(laydown(), kept, 'firstDetectS')
  let next = loop.next()
  while (!next.done) next = loop.next()
  expect(done.result).toEqual(next.value)
}, 60000)

it('posts a null Sobol result when the run is cancelled, and a Morris error when nothing completed', async () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 100))
  const scenario = laydown()
  const kept = uncertainFields(scenario).slice(0, 1)
  const sobol: McSobolRequest = { type: 'sobol', runId: 'sobol-cut', scenario, kept }
  const run = context.onmessage!({ data: sobol })
  await context.onmessage!({ data: { type: 'cancel', runId: sobol.runId } })
  await run
  expect(posted<McSobolMessage>().at(-1)).toEqual({
    type: 'sobol-done',
    runId: sobol.runId,
    result: null,
  })
  context.postMessage.mockClear()
  const morris: McMorrisRequest = { type: 'morris', runId: 'morris-cut', scenario }
  const screening = context.onmessage!({ data: morris })
  await context.onmessage!({ data: { type: 'cancel', runId: morris.runId } })
  await screening
  expect(posted<McMorrisMessage>().at(-1)).toMatchObject({
    type: 'morris-error',
    runId: morris.runId,
    message: expect.stringContaining('before its first trajectory'),
  })
}, 60000)
