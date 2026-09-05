import type { Scenario } from '../model/types'
import type { McSensitivityMessage, McWorkerMessage } from './mcRun'

/**
 * The one worker instance. A replicate run is long, so a second start always
 * terminates the first: the store keeps at most one Monte Carlo run alive.
 */
let worker: Worker | null = null

/**
 * The sensitivity worker, on its own slot. A sensitivity run is many replicate
 * loops, so it runs beside a replicate run: neither start cancels the other.
 */
let sensWorker: Worker | null = null

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
  const owned = new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' })
  worker = owned
  // Termination cannot retract a callback already queued for an older request.
  owned.onmessage = (e: MessageEvent<McWorkerMessage>) => {
    if (worker === owned) onMessage(e.data)
  }
  owned.onerror = (e: ErrorEvent) => {
    if (worker === owned) onMessage({ type: 'error', runId, message: e.message })
  }
  owned.postMessage({ type: 'run', runId, scenario })
  return true
}

/** Terminate the worker if one is running. */
export function cancelMcRun(): void {
  if (worker == null) return
  worker.terminate()
  worker = null
}

/**
 * Start a sensitivity run in its own worker; a sensitivity worker already
 * running is terminated. Returns false when the environment has no Worker,
 * as `startMcRun` does.
 */
export function startSensitivity(
  scenario: Scenario,
  runId: string,
  onMessage: (m: McSensitivityMessage) => void,
): boolean {
  cancelSensitivity()
  if (typeof Worker === 'undefined') return false
  const owned = new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' })
  sensWorker = owned
  owned.onmessage = (e: MessageEvent<McSensitivityMessage>) => {
    if (sensWorker === owned) onMessage(e.data)
  }
  owned.onerror = (e: ErrorEvent) => {
    if (sensWorker === owned) onMessage({ type: 'sens-error', runId, message: e.message })
  }
  owned.postMessage({ type: 'sensitivity', runId, scenario })
  return true
}

/** Terminate the sensitivity worker if one is running. */
export function cancelSensitivity(): void {
  if (sensWorker == null) return
  sensWorker.terminate()
  sensWorker = null
}
