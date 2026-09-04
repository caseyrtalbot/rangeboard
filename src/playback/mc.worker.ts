/// <reference lib="webworker" />
/**
 * Monte Carlo worker: one replicate run per message. Receives a plain
 * `McRunRequest` (the scenario as JSON), streams `progress`, then posts
 * `done` with the wall time filled, or `error` with the thrown message.
 */
import type { McRunRequest, McWorkerMessage } from './mcRun'
import { runReplicates } from './mcRun'

const post = (m: McWorkerMessage): void => self.postMessage(m)

self.onmessage = (e: MessageEvent<McRunRequest>) => {
  const { runId, scenario } = e.data
  const t0 = performance.now()
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
