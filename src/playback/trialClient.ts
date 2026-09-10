import type { TrialRequest, TrialRequestIdentity, TrialWorkerMessage } from './trialMessages'
import type { SlotProtocol } from './workerSlot'
import { createWorkerSlot } from './workerSlot'

/** Independent of the Monte Carlo and sensitivity slots. */
const slot = createWorkerSlot()

/**
 * Transport-level twin of `sameManifest` (trialTypes.ts): the client must not import
 * the engine at runtime, so it carries its own value comparison for the array keys.
 */
function sameManifestRecord(expected: Record<string, unknown>, received: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, value]) => Array.isArray(value)
    ? JSON.stringify(value) === JSON.stringify(received[key])
    : received[key] === value)
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Terminate immediately; queued callbacks are rejected by exact slot ownership. */
export function cancelTrial(): void {
  slot.dispose()
}

/**
 * The trial protocol: every message must carry the request's token, run id and
 * basis; a `trial-done` result must repeat the manifest and hold every ledger
 * part. Both terminal messages release the worker: a preparation answers once.
 */
function protocol(
  request: TrialRequest,
  onMessage: (message: TrialWorkerMessage) => void,
): SlotProtocol<TrialWorkerMessage> {
  // Capture primitive identity before handing the request to another execution context.
  const identity: TrialRequestIdentity = {
    requestToken: request.requestToken,
    runId: request.runId,
    basisSignature: request.basisSignature,
  }
  const manifest = { ...request.manifest }
  const errorOf = (message: string): TrialWorkerMessage => ({ type: 'trial-error', ...identity, message })
  return {
    spawn: () => new Worker(new URL('./trial.worker.ts', import.meta.url), { type: 'module' }),
    request,
    decode: (data) => {
      if (!record(data) || data.requestToken !== identity.requestToken ||
        data.runId !== identity.runId || data.basisSignature !== identity.basisSignature) return null
      if (data.type === 'trial-error') {
        return errorOf(typeof data.message === 'string' ? data.message : 'Invalid trial error response')
      }
      if (data.type !== 'trial-done') return null
      const result = data.result
      if (!record(result) || !record(result.manifest) ||
        !sameManifestRecord(manifest, result.manifest) ||
        !Array.isArray(result.assessments) || !record(result.report) ||
        !Array.isArray(result.report.events) || !Array.isArray(result.report.threats) ||
        !Array.isArray(result.report.effectors) || !record(result.report.totals) ||
        !Array.isArray(result.observations) || !Array.isArray(result.jamDecisions)) {
        return errorOf('Invalid trial result response')
      }
      return data as unknown as TrialWorkerMessage
    },
    errorOf,
    terminal: () => true,
    onMessage,
  }
}

/**
 * Returns false only when Workers are unavailable. Startup failures report one
 * synchronous error, so callers must install their pending state before starting.
 */
export function startTrial(
  request: TrialRequest,
  onMessage: (message: TrialWorkerMessage) => void,
): boolean {
  return slot.start(protocol(request, onMessage))
}
