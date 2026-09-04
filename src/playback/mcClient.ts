import type { Scenario } from '../model/types'
import type { McWorkerMessage } from './mcRun'

/**
 * The one worker instance. A replicate run is long, so a second start always
 * terminates the first: the store keeps at most one Monte Carlo run alive.
 */
let worker: Worker | null = null

/**
 * Start a replicate run in the worker; a worker already running is terminated.
 * Returns false when the environment has no Worker (node and vitest), so the
 * caller can report the run as unavailable instead of hanging.
 */
export function startMcRun(
  scenario: Scenario,
  runId: string,
  onMessage: (m: McWorkerMessage) => void,
): boolean {
  cancelMcRun()
  if (typeof Worker === 'undefined') return false
  worker = new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<McWorkerMessage>) => onMessage(e.data)
  worker.onerror = (e: ErrorEvent) => onMessage({ type: 'error', runId, message: e.message })
  worker.postMessage({ type: 'run', runId, scenario })
  return true
}

/** Terminate the worker if one is running. */
export function cancelMcRun(): void {
  if (worker == null) return
  worker.terminate()
  worker = null
}
