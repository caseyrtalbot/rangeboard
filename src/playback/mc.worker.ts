/// <reference lib="webworker" />
/**
 * Monte Carlo worker: one run per worker instance. Receives a plain
 * `McRequest` (the scenario as JSON) and dispatches on its type. A replicate
 * run streams `progress` and posts `done`; a sensitivity run streams
 * `sens-progress` and posts `sens-done`. Both fill the wall time, or post the
 * thrown message. The loops run under `DEFAULT_BUDGET`: a summary that
 * cannot fit is refused, and the retained numbers or the wall time end the
 * run at a checkpoint with `stopped.rule` 'budget'. Between replicates the
 * driver yields to the event loop every YIELD_MS, so a `cancel` request for
 * the run is read and ends it at the next checkpoint with 'cancelled'.
 */
import type {
  Checkpoint,
  Loop,
  McRequest,
  McSensitivityMessage,
  McWorkerMessage,
  StopRule,
} from './mcRun'
import {
  assertSummaryFits,
  DEFAULT_BUDGET,
  overBudget,
  replicateLoop,
  sensitivityLoop,
} from './mcRun'

/** Longest stretch of replicates run before the driver lets a message in. */
const YIELD_MS = 50
/** Progress posts at every `every`th unit, at the last, and after this much silence. */
const PROGRESS_MS = 250

let runId: string | null = null
let cancelled = false

const post = (m: McWorkerMessage | McSensitivityMessage): void => self.postMessage(m)
const yieldToEvents = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** Post progress at a checkpoint when its count is new and due. */
function due(cp: Checkpoint, every: number, lastDone: number, sinceMs: number): boolean {
  return cp.done !== lastDone &&
    (cp.done % every === 0 || cp.done === cp.total || sinceMs >= PROGRESS_MS)
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

self.onmessage = async (e: MessageEvent<McRequest>) => {
  if (e.data.type === 'cancel') {
    if (e.data.runId === runId) cancelled = true
    return
  }
  const { scenario } = e.data
  runId = e.data.runId
  cancelled = false
  const id = runId
  const t0 = performance.now()
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
