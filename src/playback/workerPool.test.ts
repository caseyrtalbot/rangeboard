import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import type { Scenario, UncertaintyMode } from '../model/types'
import type { ExecutionBudget, McPartial, McSummary, McWorkerMessage } from './mcRun'
import { finishSummary, replicateRangeLoop, runReplicates, summaryNumbers } from './mcRun'
import { contiguousPrefix, mergePartials } from './mergeSummaries'
import type { PoolProgress } from './mcTypes'
import type {
  FinishSummaryMessage,
  FinishSummaryRequest,
  McRangeRequest,
  PoolMessage,
} from './workerPool'
import { chunkSize, createWorkerPool, poolSize } from './workerPool'
import { CANCEL_GRACE_MS } from './workerSlot'

/**
 * The pool driven with an in-process stand-in for `mc.worker.ts` (the
 * ControlledWorker of `workerSlot.test.ts` with the range route added): it
 * queues the chunk the coordinator posts and runs `replicateRangeLoop` when
 * the test releases it, so a cancel can land while a chunk is in flight. The
 * laydown is the JIATF-401 fixture `sensitivity.parity.test.ts` loads.
 */
class RangeWorker {
  static instances: RangeWorker[] = []
  /** Every range a worker ran, as [start, start + replicates done]. */
  static ran: Array<[number, number]> = []

  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  onmessageerror: (() => void) | null = null
  terminated = false
  /** The chunk the coordinator posted and the worker has not run yet. */
  pending: McRangeRequest | null = null
  cancelled = false
  postMessage = vi.fn((request: unknown) => {
    const m = request as { type: string }
    if (m.type === 'cancel') this.cancelled = true
    else if (m.type === 'finish-summary') {
      const req = request as FinishSummaryRequest
      try {
        const prefix = contiguousPrefix(mergePartials(req.parts))
        if (prefix.indices.length === 0) {
          this.send({
            type: 'summary-error',
            runId: req.runId,
            message: 'The run stopped before any replicate finished',
          })
        } else {
          this.send({
            type: 'summary-done',
            runId: req.runId,
            summary: finishSummary(
              req.scenario,
              prefix,
              { rule: req.rule, at: prefix.indices.length },
              req.elapsedMs,
            ),
          })
        }
      } catch (error) {
        this.send({
          type: 'summary-error',
          runId: req.runId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    } else this.pending = request as McRangeRequest
  })
  terminate = vi.fn(() => {
    this.terminated = true
  })

  constructor() {
    RangeWorker.instances.push(this)
  }

  /** Deliver one message as the worker would; a terminated worker is silent. */
  send(data: unknown): void {
    if (!this.terminated) this.onmessage?.({ data })
  }

  /**
   * Run the chunk it holds to its end, or to its next checkpoint when a cancel
   * arrived, and post the partial. False when it holds nothing.
   */
  step(): boolean {
    const req = this.pending
    if (req == null) return false
    this.pending = null
    const stop = this.cancelled ? ('cancelled' as const) : undefined
    this.cancelled = false
    const loop = replicateRangeLoop(req.scenario, req.start, req.end, (done, total) =>
      this.send({ type: 'range-progress', runId: req.runId, done, total }),
    )
    let next = loop.next()
    while (!next.done) next = loop.next(stop)
    RangeWorker.ran.push([req.start, req.start + next.value.indices.length])
    // The real transport clones; structuredClone keeps the NaN times, JSON does not.
    this.send({ type: 'range-done', runId: req.runId, partial: structuredClone(next.value) })
    return true
  }

  /** Run every queued chunk, round by round, until the pool asks for no more. */
  static drain(): void {
    for (let round = 0; round < 500; round += 1) {
      let ran = false
      for (const w of [...RangeWorker.instances]) if (!w.terminated && w.step()) ran = true
      if (!ran) return
    }
    throw new Error('the pool never settled')
  }

  /** The workers holding a chunk, in construction order. */
  static busy(): RangeWorker[] {
    return RangeWorker.instances.filter((w) => w.pending != null)
  }

  static install(): void {
    RangeWorker.instances = []
    RangeWorker.ran = []
    vi.stubGlobal('Worker', RangeWorker)
  }
}

const spawn = () => new RangeWorker() as unknown as Worker

/** The fixture with the run fields the case needs. */
function base(fields: Partial<Scenario>): Scenario {
  return { ...parseAutosave(JSON.stringify(fixture)), ...fields }
}

/** The summary less the wall time, which the pool measures on its own clock. */
function timeless(summary: McSummary): Omit<McSummary, 'elapsedMs'> {
  const { elapsedMs: _elapsedMs, ...rest } = summary
  return rest
}

/** One pool run with its two message streams collected. */
function run(scenario: Scenario, size: number, runId = 'pool-run', budget?: ExecutionBudget) {
  const messages: McWorkerMessage[] = []
  const polls: PoolProgress[] = []
  const pool = createWorkerPool({ spawn, size, budget })
  const started = pool.start(
    scenario,
    runId,
    (m) => messages.push(m),
    (p) => polls.push(p),
  )
  const summary = (): McSummary => {
    const last = messages.at(-1)
    if (last?.type !== 'done') throw new Error(`expected done, got ${last?.type}`)
    return last.summary
  }
  return { pool, messages, polls, started, summary, runId }
}

describe('worker pool', () => {
  beforeEach(() => RangeWorker.install())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('sizes the pool from the cores and the chunk from the stop rule', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 12 })
    expect(poolSize()).toBe(8)
    vi.stubGlobal('navigator', { hardwareConcurrency: 4 })
    expect(poolSize()).toBe(3)
    vi.stubGlobal('navigator', { hardwareConcurrency: 1 })
    expect(poolSize()).toBe(1)
    vi.stubGlobal('navigator', {})
    expect(poolSize()).toBe(1)
    const fixed = { replicates: 40, targetHalfWidth: null, stopFloor: 30, stopCap: 2000 }
    expect(chunkSize(fixed as never, 3)).toBe(14)
    expect(chunkSize(fixed as never, 7)).toBe(6)
    expect(chunkSize(fixed as never, 1)).toBe(40)
    expect(chunkSize({ ...fixed, replicates: 1000 } as never, 8)).toBe(50)
    const target = { ...fixed, targetHalfWidth: 0.5 }
    expect(chunkSize(target as never, 8)).toBe(4)
    expect(chunkSize(target as never, 1)).toBe(25)
  })

  it.each([
    ['aleatory', 3],
    ['aleatory', 1],
    ['aleatory', 7],
    ['total', 3],
    ['total', 1],
    ['total', 7],
  ] as Array<[UncertaintyMode, number]>)(
    'the pooled summary equals the single-worker summary (%s, %i workers)',
    (uncertainty, size) => {
      const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty })
      const whole = runReplicates(scenario)
      expect(whole.stopped).toEqual({ rule: 'replicates', at: 40 })
      const pooled = run(scenario, size)
      expect(pooled.started).toBe(true)
      RangeWorker.drain()
      expect(timeless(pooled.summary())).toEqual(timeless(whole))
      expect(pooled.summary().stopped).toEqual({ rule: 'replicates', at: 40 })
      // The chunk does not divide 40 at three or seven workers, so a worker
      // takes an uneven last chunk and the merge still gives the whole run.
      const chunk = chunkSize({ ...scenario, stopFloor: 30, stopCap: 2000 } as never, size)
      expect(40 % chunk === 0).toBe(size === 1)
      expect(RangeWorker.ran.map(([, end]) => end).sort((a, b) => b - a)[0]).toBe(40)
      // Progress ends at the configured count and every replicate is accounted for.
      const progress = pooled.messages.filter((m) => m.type === 'progress')
      expect(progress.at(-1)).toEqual({
        type: 'progress',
        runId: pooled.runId,
        done: 40,
        total: 40,
      })
      expect(pooled.polls).toHaveLength(progress.length)
      const last = pooled.polls.at(-1)!
      expect(last.workers).toBe(size)
      expect(last.done).toBe(40)
      expect(last.total).toBe(40)
      expect(last.stopRule).toBe('replicates')
      expect(last.perWorkerDone.reduce((sum, n) => sum + n, 0)).toBe(40)
      expect(last.elapsedMs).toBeGreaterThanOrEqual(0)
      // The summary worker is the extra instance, and it is released with the range workers.
      expect(RangeWorker.instances).toHaveLength(size + 1)
      expect(RangeWorker.instances.every((w) => w.terminated)).toBe(true)
    },
    15_000,
  )

  it('stops on the half-width rule and finishes on the contiguous prefix only', () => {
    const scenario = base({
      replicates: 60,
      targetHalfWidth: 0.2,
      stopFloor: 10,
      stopCap: 60,
      uncertainty: 'aleatory',
    })
    // The single-worker loop stops early on the same laydown, at its own cadence.
    expect(runReplicates(scenario).stopped).toEqual({ rule: 'halfWidth', at: 10 })
    const pooled = run(scenario, 3)
    // Chunks of four: the rule is checked at every merge from the floor up.
    expect(RangeWorker.busy().map((w) => w.pending!.end)).toEqual([4, 8, 12])
    RangeWorker.drain()
    const summary = pooled.summary()
    expect(summary.stopped.rule).toBe('halfWidth')
    const at = summary.stopped.at
    expect(at).toBeGreaterThanOrEqual(10)
    expect(at).toBeLessThan(60)
    expect(summary.replicates).toBe(at)
    // The cancelled chunks in flight ran past the gap, and the prefix drops them.
    const reported = RangeWorker.ran.reduce((sum, [start, end]) => sum + (end - start), 0)
    expect(reported).toBeGreaterThan(at)
    const covered = new Set<number>()
    for (const [start, end] of RangeWorker.ran) for (let i = start; i < end; i += 1) covered.add(i)
    for (let i = 0; i < at; i += 1) expect(covered.has(i)).toBe(true)
    expect(covered.has(at)).toBe(false)
    expect(pooled.polls.at(-1)!.total).toBeNull()
    expect(pooled.polls.at(-1)!.stopRule).toBe('halfWidth')
  })

  it('stops at the cap when the target never holds', () => {
    const scenario = base({
      replicates: 60,
      targetHalfWidth: 0.001,
      stopFloor: 10,
      stopCap: 25,
      uncertainty: 'total',
    })
    const pooled = run(scenario, 3)
    RangeWorker.drain()
    const summary = pooled.summary()
    expect(summary.stopped).toEqual({ rule: 'replicates', at: 25 })
    expect(summary.replicates).toBe(25)
    expect(pooled.messages.filter((m) => m.type === 'progress').at(-1)).toEqual({
      type: 'progress',
      runId: pooled.runId,
      done: 25,
      total: 25,
    })
  })

  it('a mid-run cancel finishes the prefix with the cancelled rule', () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const pooled = run(scenario, 3)
    // Chunks of 14, 14 and 12; the first worker finishes and the run is out of work.
    expect(RangeWorker.instances[0].step()).toBe(true)
    expect(pooled.pool.cancel(pooled.runId)).toBe(true)
    expect(pooled.pool.cancel(pooled.runId)).toBe(false)
    RangeWorker.drain()
    const summary = pooled.summary()
    expect(summary.stopped.rule).toBe('cancelled')
    // The two cancelled chunks each end one replicate in, past the gap at 14.
    expect(summary.stopped).toEqual({ rule: 'cancelled', at: 15 })
    expect(summary.replicates).toBe(15)
    expect(RangeWorker.ran).toEqual([
      [0, 14],
      [14, 15],
      [28, 29],
    ])
  })

  it('terminates a silent worker after the grace period and finishes on what landed', () => {
    vi.useFakeTimers()
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const pooled = run(scenario, 3)
    RangeWorker.instances[0].step()
    pooled.pool.cancel()
    vi.advanceTimersByTime(CANCEL_GRACE_MS - 1)
    expect(pooled.messages.at(-1)?.type).toBe('progress')
    vi.advanceTimersByTime(2)
    const summary = pooled.summary()
    expect(summary.stopped).toEqual({ rule: 'cancelled', at: 14 })
    expect(summary.replicates).toBe(14)
    expect(RangeWorker.instances.every((w) => w.terminated)).toBe(true)
    // A callback from a released worker is dropped.
    const before = pooled.messages.length
    RangeWorker.instances[1].onmessage?.({ data: { type: 'range-done', runId: pooled.runId } })
    expect(pooled.messages).toHaveLength(before)
  })

  it('a silent worker after the grace period with nothing landed is an error', () => {
    vi.useFakeTimers()
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const pooled = run(scenario, 3)
    pooled.pool.cancel()
    vi.advanceTimersByTime(CANCEL_GRACE_MS + 1)
    expect(pooled.messages).toEqual([
      {
        type: 'error',
        runId: pooled.runId,
        message: 'The run stopped before any replicate finished',
      },
    ])
    expect(RangeWorker.instances.every((w) => w.terminated)).toBe(true)
  })

  it('refuses a run whose summary is over the budget before any worker is built', () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const need = summaryNumbers(scenario)
    const pooled = run(scenario, 3, 'pool-run', { retainedNumbers: need - 1, timeMs: Infinity })
    expect(pooled.started).toBe(true)
    expect(pooled.messages).toHaveLength(1)
    expect(pooled.messages[0].type).toBe('error')
    if (pooled.messages[0].type === 'error') {
      expect(pooled.messages[0].message).toMatch(/over the budget/)
    }
    expect(RangeWorker.instances).toHaveLength(0)
    expect(pooled.pool.cancel()).toBe(false)
  })

  it('ends with the budget rule once the merged rows reach the retained budget', () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const need = summaryNumbers(scenario)
    // One chunk of 14 retains more than the summary; the next merge trips the rule.
    const pooled = run(scenario, 3, 'pool-run', { retainedNumbers: need + 1, timeMs: Infinity })
    expect(RangeWorker.instances[0].step()).toBe(true)
    expect(pooled.pool.cancel()).toBe(false)
    RangeWorker.drain()
    const summary = pooled.summary()
    expect(summary.stopped).toEqual({ rule: 'budget', at: 15 })
    expect(RangeWorker.ran).toEqual([
      [0, 14],
      [14, 15],
      [28, 29],
    ])
  })

  it('ends with the budget rule once the wall time reaches the budget', () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const pooled = run(scenario, 3, 'pool-run', { retainedNumbers: Infinity, timeMs: 0 })
    RangeWorker.drain()
    expect(pooled.summary().stopped).toEqual({ rule: 'budget', at: 15 })
  })

  it('a worker error ends the run and terminates the rest', () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const pooled = run(scenario, 3)
    RangeWorker.instances[1].onerror!({ message: 'Worker failed to load' })
    expect(pooled.messages).toEqual([
      { type: 'error', runId: pooled.runId, message: 'Worker failed to load' },
    ])
    expect(RangeWorker.instances.every((w) => w.terminated)).toBe(true)
    expect(pooled.pool.cancel()).toBe(false)
  })

  it('a replacement and a dispose drop the callbacks of the run they end', () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const first = run(scenario, 2, 'first')
    const stale = RangeWorker.instances[0]
    const second = first.pool.start(
      scenario,
      'second',
      () => {},
      () => {},
    )
    expect(second).toBe(true)
    expect(stale.terminated).toBe(true)
    stale.onmessage?.({ data: { type: 'range-done', runId: 'first' } })
    expect(first.messages).toHaveLength(0)
    first.pool.dispose()
    first.pool.dispose()
    expect(RangeWorker.instances.every((w) => w.terminated)).toBe(true)
    expect(first.pool.cancel()).toBe(false)
  })

  it('returns false without a Worker and starts nothing', () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    vi.stubGlobal('Worker', undefined)
    const messages: McWorkerMessage[] = []
    const pool = createWorkerPool({ spawn })
    expect(
      pool.start(
        scenario,
        'none',
        (m) => messages.push(m),
        () => {},
      ),
    ).toBe(false)
    expect(RangeWorker.instances).toHaveLength(0)
    expect(messages).toHaveLength(0)
  })

  it('a spawn that throws is one terminal error and leaves nothing live', () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const messages: McWorkerMessage[] = []
    let built = 0
    const pool = createWorkerPool({
      size: 3,
      spawn: () => {
        built += 1
        if (built === 2) throw new Error('Worker blocked')
        return spawn()
      },
    })
    expect(
      pool.start(
        scenario,
        'blocked',
        (m) => messages.push(m),
        () => {},
      ),
    ).toBe(true)
    expect(messages).toEqual([{ type: 'error', runId: 'blocked', message: 'Worker blocked' }])
    expect(RangeWorker.instances).toHaveLength(1)
    expect(RangeWorker.instances[0].terminated).toBe(true)
    expect(pool.cancel()).toBe(false)
  })
})

/**
 * The range route of the real worker module, driven as `mc.worker.sweep.test.ts`
 * drives its worker: `self` is a stub that records what the worker posts.
 */
describe('mc.worker run-range route', () => {
  let context: {
    onmessage: ((event: { data: unknown }) => Promise<void>) | null
    postMessage: ReturnType<typeof vi.fn>
  }
  const posted = (): Array<PoolMessage | FinishSummaryMessage> =>
    context.postMessage.mock.calls.map((c) => c[0] as PoolMessage | FinishSummaryMessage)

  /** The partial of the last message, which must be the range's `range-done`. */
  const finished = (): McPartial => {
    const last = posted().at(-1)!
    if (last.type !== 'range-done') throw new Error(last.type)
    expect(last.runId).toBe('w')
    return last.partial
  }

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

  it('drives the range loop and posts the partial the pool merges', async () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    await context.onmessage!({
      data: { type: 'run-range', runId: 'w', scenario, start: 4, end: 16 },
    })
    const expected = (() => {
      const loop = replicateRangeLoop(scenario, 4, 16)
      let next = loop.next()
      while (!next.done) next = loop.next()
      return next.value
    })()
    expect({ ...finished(), elapsedMs: 0 }).toEqual({ ...expected, elapsedMs: 0 })
    // Progress counts within the range, ascending, and ends at its last replicate.
    const progress = posted().slice(0, -1)
    expect(progress.map((m) => m.type === 'range-progress' && m.total)).toEqual(
      progress.map(() => 12),
    )
    const lastProgress = progress.at(-1)!
    expect(lastProgress.type === 'range-progress' && lastProgress.done).toBe(12)
  })

  it('a cancel ends the range at its next checkpoint with the partial so far', async () => {
    // Every clock read is 100 ms later, so the driver yields after every replicate.
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => (now += 100))
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const running = context.onmessage!({
      data: { type: 'run-range', runId: 'w', scenario, start: 0, end: 20 },
    })
    // The driver is parked at its first yield; the cancel is read when it resumes.
    await context.onmessage!({ data: { type: 'cancel', runId: 'w' } })
    await running
    expect(finished().indices).toEqual([0])
  })

  it('finishes a transferred partial on the worker', async () => {
    const scenario = base({ replicates: 8, targetHalfWidth: null, uncertainty: 'aleatory' })
    const loop = replicateRangeLoop(scenario, 0, 8)
    let next = loop.next()
    while (!next.done) next = loop.next()
    const whole = runReplicates(scenario)
    await context.onmessage!({
      data: {
        type: 'finish-summary',
        runId: 'w',
        scenario,
        parts: [next.value],
        rule: 'replicates',
        elapsedMs: 12,
      },
    })
    const last = posted().at(-1)!
    expect(last.type).toBe('summary-done')
    if (last.type !== 'summary-done') return
    expect(last.runId).toBe('w')
    expect(timeless(last.summary)).toEqual(timeless(whole))
    expect(last.summary.elapsedMs).toBe(12)
  })

  it('a cancel for another run is ignored', async () => {
    const scenario = base({ replicates: 40, targetHalfWidth: null, uncertainty: 'aleatory' })
    const running = context.onmessage!({
      data: { type: 'run-range', runId: 'w', scenario, start: 0, end: 3 },
    })
    await context.onmessage!({ data: { type: 'cancel', runId: 'other' } })
    await running
    expect(finished().indices).toEqual([0, 1, 2])
  })
})
