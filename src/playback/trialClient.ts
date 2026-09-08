import type { TrialRequest, TrialRequestIdentity, TrialWorkerMessage } from './trialMessages'

interface TrialSlot {
  worker: Worker
}

/** Independent of the Monte Carlo and sensitivity slots. */
let current: TrialSlot | null = null

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Terminate immediately; queued callbacks are rejected by exact slot ownership. */
export function cancelTrial(): void {
  const slot = current
  if (!slot) return
  current = null
  slot.worker.onmessage = null
  slot.worker.onerror = null
  slot.worker.onmessageerror = null
  slot.worker.terminate()
}

/**
 * Returns false only when Workers are unavailable. Startup failures report one
 * synchronous error, so callers must install their pending state before starting.
 */
export function startTrial(
  request: TrialRequest,
  onMessage: (message: TrialWorkerMessage) => void,
): boolean {
  cancelTrial()
  if (typeof Worker === 'undefined') return false
  // Capture primitive identity before handing the request to another execution context.
  const identity: TrialRequestIdentity = {
    requestToken: request.requestToken,
    runId: request.runId,
    basisSignature: request.basisSignature,
  }
  const manifest = { ...request.manifest }
  const errorOf = (message: string): TrialWorkerMessage => ({ type: 'trial-error', ...identity, message })
  let worker: Worker
  try {
    worker = new Worker(new URL('./trial.worker.ts', import.meta.url), { type: 'module' })
  } catch (error) {
    onMessage(errorOf(error instanceof Error ? error.message : String(error)))
    return true
  }
  const slot: TrialSlot = { worker }
  current = slot
  const finish = (message: TrialWorkerMessage): void => {
    if (current !== slot) return
    // Release first: a callback can synchronously start another preparation.
    cancelTrial()
    onMessage(message)
  }
  worker.onmessage = (event: MessageEvent<unknown>) => {
    if (current !== slot) return
    const data = event.data
    if (!record(data) || data.requestToken !== identity.requestToken ||
      data.runId !== identity.runId || data.basisSignature !== identity.basisSignature) return
    if (data.type === 'trial-error') {
      finish(errorOf(typeof data.message === 'string' ? data.message : 'Invalid trial error response'))
    } else if (data.type === 'trial-done') {
      const result = data.result
      if (!record(result) || !record(result.manifest) ||
        Object.entries(manifest).some(([key, value]) => (result.manifest as Record<string, unknown>)[key] !== value) ||
        !Array.isArray(result.assessments) || !record(result.report) ||
        !Array.isArray(result.report.events) || !Array.isArray(result.report.threats) ||
        !Array.isArray(result.report.effectors) || !record(result.report.totals) ||
        !Array.isArray(result.observations) || !Array.isArray(result.jamDecisions)) {
        finish(errorOf('Invalid trial result response'))
        return
      }
      finish(data as unknown as TrialWorkerMessage)
    }
  }
  worker.onerror = (event: ErrorEvent) => finish(errorOf(event.message || 'Trial worker failed'))
  worker.onmessageerror = () => finish(errorOf('Trial worker response could not be decoded'))
  try {
    worker.postMessage(request)
  } catch (error) {
    finish(errorOf(error instanceof Error ? error.message : String(error)))
  }
  return true
}
