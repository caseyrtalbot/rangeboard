import type { Scenario } from '../model/types'
import type {
  McRequest,
  McSensitivityMessage,
  McSensitivityRequest,
  McWorkerMessage,
} from './mcRun'

/** Wall time a cancelled worker gets to post its summary before it is terminated. */
export const CANCEL_GRACE_MS = 2000

/** One worker and the callback it reports to; a cancel in flight holds its grace timer. */
interface Slot<M> {
  worker: Worker
  runId: string
  onMessage: (m: M) => void
  grace: ReturnType<typeof setTimeout> | null
}

/** A slot holder: the current slot, or null while nothing runs. */
interface Holder<M> {
  current: Slot<M> | null
}

/**
 * The replicate run. A replicate run is long, so a second start always
 * terminates the first: the store keeps at most one Monte Carlo run alive.
 */
const run: Holder<McWorkerMessage> = { current: null }

/**
 * The sensitivity run, on its own slot. A sensitivity run is many replicate
 * loops, so it runs beside a replicate run: neither start cancels the other.
 */
const sens: Holder<McSensitivityMessage> = { current: null }

/** Spawn a worker for `request` into `holder`; `errorOf` shapes a worker error for it. */
function spawn<M extends { type: string }>(
  holder: Holder<M>,
  request: Exclude<McRequest, { type: 'cancel' }>,
  onMessage: (m: M) => void,
  errorOf: (message: string) => M,
): void {
  const worker = new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' })
  const slot: Slot<M> = { worker, runId: request.runId, onMessage, grace: null }
  holder.current = slot
  // Termination cannot retract a callback already queued for an older request.
  worker.onmessage = (e: MessageEvent<M>) => {
    if (holder.current !== slot) return
    if (e.data.type === 'done' || e.data.type === 'sens-done') clearGrace(slot)
    onMessage(e.data)
  }
  worker.onerror = (e: ErrorEvent) => {
    if (holder.current === slot) onMessage(errorOf(e.message))
  }
  worker.postMessage(request)
}

function clearGrace<M>(slot: Slot<M>): void {
  if (slot.grace != null) clearTimeout(slot.grace)
  slot.grace = null
}

/** Terminate the holder's worker if one is running. */
function terminate<M>(holder: Holder<M>): void {
  const slot = holder.current
  if (slot == null) return
  clearGrace(slot)
  slot.worker.terminate()
  holder.current = null
}

/**
 * Ask the holder's worker to stop at its next checkpoint; its `done` message
 * then carries the summary so far with `stopped.rule` 'cancelled'. A worker
 * that has not answered after CANCEL_GRACE_MS is terminated and the run
 * reports an error. Returns false with nothing running or a cancel in flight.
 */
function requestCancel<M>(holder: Holder<M>, errorOf: (message: string) => M): boolean {
  const slot = holder.current
  if (slot == null || slot.grace != null) return false
  slot.worker.postMessage({ type: 'cancel', runId: slot.runId })
  slot.grace = setTimeout(() => {
    if (holder.current !== slot) return
    terminate(holder)
    slot.onMessage(errorOf('Cancel timed out; the worker was stopped'))
  }, CANCEL_GRACE_MS)
  return true
}

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
  spawn(run, { type: 'run', runId, scenario }, onMessage, (message) => ({
    type: 'error' as const,
    runId,
    message,
  }))
  return true
}

/** Terminate the replicate worker if one is running. */
export function cancelMcRun(): void {
  terminate(run)
}

/** Ask the replicate worker to stop at its next checkpoint (see `requestCancel`). */
export function requestMcCancel(): boolean {
  const runId = run.current?.runId ?? ''
  return requestCancel(run, (message) => ({ type: 'error' as const, runId, message }))
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
  const request: McSensitivityRequest = { type: 'sensitivity', runId, scenario }
  spawn(sens, request, onMessage, (message) => ({ type: 'sens-error' as const, runId, message }))
  return true
}

/** Terminate the sensitivity worker if one is running. */
export function cancelSensitivity(): void {
  terminate(sens)
}

/** Ask the sensitivity worker to stop at its next checkpoint (see `requestCancel`). */
export function requestSensitivityCancel(): boolean {
  const runId = sens.current?.runId ?? ''
  return requestCancel(sens, (message) => ({ type: 'sens-error' as const, runId, message }))
}
