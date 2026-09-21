/// <reference lib="webworker" />
/**
 * Placement optimization worker: one run per worker instance. An `optimize`
 * request streams `optimize-progress` after every evaluation and posts
 * `optimize-done`; a throw posts `optimize-error`. The loop runs under
 * `DEFAULT_BUDGET`'s wall time. The driver yields every YIELD_MS, so a `cancel`
 * ends the run at the next checkpoint and `optimize-done` carries the trace so
 * far.
 */
import type { StopRule } from './mcRun'
import { DEFAULT_BUDGET, overBudget } from './mcRun'
import type { OptimizeCancel, OptimizeWorkerRequest } from './optimize/client'
import { optimizeLoop } from './optimize/loop'
import type { OptimizeWorkerMessage } from './optimizeTypes'

/** Longest stretch of replicates run before the driver lets a message in. */
const YIELD_MS = 50

let runId: string | null = null
let cancelled = false

const post = (m: OptimizeWorkerMessage): void => self.postMessage(m)
const yieldToEvents = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

self.onmessage = async (e: MessageEvent<OptimizeWorkerRequest>) => {
  if (e.data.type === 'cancel') {
    if ((e.data as OptimizeCancel).runId === runId) cancelled = true
    return
  }
  const request = e.data
  runId = request.runId
  cancelled = false
  const id = runId
  const t0 = performance.now()
  try {
    // The loop reports every evaluation; the driver only yields and reads the cancel.
    const loop = optimizeLoop(request, (done, total, best) =>
      post({ type: 'optimize-progress', runId: id, done, total, best }),
    )
    let lastYield = t0
    let stop: StopRule | undefined
    for (;;) {
      const next = loop.next(stop)
      if (next.done) {
        post({
          type: 'optimize-done',
          runId: id,
          result: { ...next.value, elapsedMs: Math.round(performance.now() - t0) },
        })
        return
      }
      let now = performance.now()
      if (now - lastYield >= YIELD_MS) {
        await yieldToEvents()
        now = performance.now()
        lastYield = now
      }
      stop = cancelled ? 'cancelled' : overBudget(next.value, DEFAULT_BUDGET, now - t0)
    }
  } catch (err) {
    post({
      type: 'optimize-error',
      runId: id,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
