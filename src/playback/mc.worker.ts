/// <reference lib="webworker" />
/**
 * Monte Carlo worker: one run per message. Receives a plain `McRequest` (the
 * scenario as JSON) and dispatches on its type. A replicate run streams
 * `progress` and posts `done`; a sensitivity run streams `sens-progress` and
 * posts `sens-done`. Both fill the wall time, or post the thrown message.
 */
import type { McRequest, McSensitivityMessage, McWorkerMessage } from './mcRun'
import { runReplicates, runSensitivity } from './mcRun'

const post = (m: McWorkerMessage | McSensitivityMessage): void => self.postMessage(m)

self.onmessage = (e: MessageEvent<McRequest>) => {
  const { runId, scenario } = e.data
  const t0 = performance.now()
  if (e.data.type === 'sensitivity') {
    try {
      const summary = runSensitivity(scenario, (done, total) =>
        post({ type: 'sens-progress', runId, done, total }),
      )
      post({
        type: 'sens-done',
        runId,
        summary: { ...summary, elapsedMs: Math.round(performance.now() - t0) },
      })
    } catch (err) {
      post({
        type: 'sens-error',
        runId,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  try {
    const summary = runReplicates(scenario, (done, total) =>
      post({ type: 'progress', runId, done, total }),
    )
    post({
      type: 'done',
      runId,
      summary: { ...summary, elapsedMs: Math.round(performance.now() - t0) },
    })
  } catch (err) {
    post({ type: 'error', runId, message: err instanceof Error ? err.message : String(err) })
  }
}
