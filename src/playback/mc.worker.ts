/// <reference lib="webworker" />
/**
 * Monte Carlo worker: one run per worker instance. Each run kind streams its
 * own `*-progress` message and posts its own `*-done`; a throw posts the error
 * message. Loops run under `DEFAULT_BUDGET` and stop at a checkpoint with
 * `stopped.rule` 'budget'. The driver yields every YIELD_MS, so a `cancel`
 * request ends the run at the next checkpoint with 'cancelled'.
 */
import type {
  Checkpoint,
  Loop,
  McMorrisMessage,
  McRequest,
  McSensitivityMessage,
  McSobolMessage,
  McSweepMessage,
  McWorkerMessage,
  StopRule,
} from './mcRun'
import {
  assertSummaryFits,
  DEFAULT_BUDGET,
  overBudget,
  replicateLoop,
  replicateRangeLoop,
  sensitivityLoop,
  sweepLoop,
} from './mcRun'
import { morrisLoop } from './morris'
import { sobolLoop } from './sobol'
import type { PoolMessage, PoolRequest } from './workerPool'

/** Longest stretch of replicates run before the driver lets a message in. */
const YIELD_MS = 50
/** Progress posts at every `every`th unit, at the last, and after this much silence. */
const PROGRESS_MS = 250

let runId: string | null = null
let cancelled = false

type Posted =
  | McWorkerMessage
  | McSensitivityMessage
  | McSweepMessage
  | McMorrisMessage
  | McSobolMessage
  | PoolMessage
const post = (m: Posted): void => self.postMessage(m)
const yieldToEvents = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** Post progress at a checkpoint when its count is new and due. */
function due(cp: Checkpoint, every: number, lastDone: number, sinceMs: number): boolean {
  return (
    cp.done !== lastDone &&
    (cp.done % every === 0 || cp.done === cp.total || sinceMs >= PROGRESS_MS)
  )
}

/**
 * Drive a loop under the budget until its summary or a stop, posting progress
 * every `every` units (ten replicates, as `runReplicates` reports; one field).
 */
async function drive<T>(
  loop: Loop<T>,
  every: number,
  onProgress: (cp: Checkpoint) => void,
): Promise<T> {
  const t0 = performance.now()
  let lastYield = t0
  let lastPost = t0
  let lastDone = 0
  let stop: StopRule | undefined
  for (;;) {
    const next = loop.next(stop)
    if (next.done) return next.value
    const cp = next.value
    let now = performance.now()
    if (due(cp, every, lastDone, now - lastPost)) {
      onProgress(cp)
      lastDone = cp.done
      lastPost = now
    }
    if (now - lastYield >= YIELD_MS) {
      await yieldToEvents()
      now = performance.now()
      lastYield = now
    }
    stop = cancelled ? 'cancelled' : overBudget(cp, DEFAULT_BUDGET, now - t0)
  }
}

self.onmessage = async (e: MessageEvent<McRequest | PoolRequest>) => {
  if (e.data.type === 'cancel') {
    if (e.data.runId === runId) cancelled = true
    return
  }
  const { scenario } = e.data
  runId = e.data.runId
  cancelled = false
  const id = runId
  const t0 = performance.now()
  if (e.data.type === 'run-range') {
    // One chunk of a pooled run: no half-width rule and no summary here, the
    // coordinator merges the partials and finishes (see `workerPool.ts`).
    const { start, end } = e.data
    try {
      const partial = await drive(replicateRangeLoop(scenario, start, end), 10, (cp) =>
        post({ type: 'range-progress', runId: id, done: cp.done, total: cp.total }),
      )
      post({ type: 'range-done', runId: id, partial })
    } catch (err) {
      post({
        type: 'range-error',
        runId: id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  if (e.data.type === 'sweep') {
    const { factors, replicatesPerCell, responses } = e.data
    try {
      // The per-cell summary guard runs inside the loop with the worker budget.
      const loop = sweepLoop(
        { scenario, factors, replicatesPerCell, responses },
        undefined,
        DEFAULT_BUDGET,
      )
      const summary = await drive(loop, 1, (cp) =>
        post({ type: 'sweep-progress', runId: id, done: cp.done, total: cp.total }),
      )
      post({
        type: 'sweep-done',
        runId: id,
        summary: { ...summary, elapsedMs: Math.round(performance.now() - t0) },
      })
    } catch (err) {
      post({
        type: 'sweep-error',
        runId: id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  if (e.data.type === 'morris') {
    const response = e.data.response ?? 'leakers'
    try {
      // The loop reports every row, the last one included; the driver only
      // yields and reads the cancel at each checkpoint.
      const loop = morrisLoop(scenario, response, (done, total) =>
        post({ type: 'morris-progress', runId: id, done, total }),
      )
      const result = await drive(loop, 1, () => {})
      post({ type: 'morris-done', runId: id, result })
    } catch (err) {
      post({
        type: 'morris-error',
        runId: id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  if (e.data.type === 'sobol') {
    const { kept } = e.data
    const response = e.data.response ?? 'leakers'
    try {
      const loop = sobolLoop(scenario, kept, response, (done, total) =>
        post({ type: 'sobol-progress', runId: id, done, total }),
      )
      const result = await drive(loop, 1, () => {})
      post({ type: 'sobol-done', runId: id, result })
    } catch (err) {
      post({
        type: 'sobol-error',
        runId: id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  if (e.data.type === 'sensitivity') {
    try {
      const summary = await drive(sensitivityLoop(scenario), 1, (cp) =>
        post({ type: 'sens-progress', runId: id, done: cp.done, total: cp.total }),
      )
      post({
        type: 'sens-done',
        runId: id,
        summary: { ...summary, elapsedMs: Math.round(performance.now() - t0) },
      })
    } catch (err) {
      post({
        type: 'sens-error',
        runId: id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  try {
    assertSummaryFits(scenario, DEFAULT_BUDGET)
    const summary = await drive(replicateLoop(scenario), 10, (cp) =>
      post({ type: 'progress', runId: id, done: cp.done, total: cp.total }),
    )
    post({
      type: 'done',
      runId: id,
      summary: { ...summary, elapsedMs: Math.round(performance.now() - t0) },
    })
  } catch (err) {
    post({ type: 'error', runId: id, message: err instanceof Error ? err.message : String(err) })
  }
}
