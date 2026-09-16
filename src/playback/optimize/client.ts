/**
 * The optimize worker adapter: one slot, as `startSobol` and
 * `cancelSensitivity` in `mcClient.ts`. The store reaches it only through
 * `src/state/analysisRequests.ts`. Messages are `OptimizeWorkerMessage`,
 * tagged by run id; `optimize-done` and `optimize-error` end the run.
 */
import type { OptimizeRequest, OptimizeWorkerMessage } from '../optimizeTypes'
import type { SlotProtocol } from '../workerSlot'
import { createWorkerSlot } from '../workerSlot'

/** Ask the worker to stop at its next checkpoint; its `optimize-done` then carries the trace so far. */
export interface OptimizeCancel {
  type: 'cancel'
  runId: string
}

/** What the optimize worker receives. */
export type OptimizeWorkerRequest = OptimizeRequest | OptimizeCancel

const TYPES: readonly OptimizeWorkerMessage['type'][] = [
  'optimize-progress',
  'optimize-done',
  'optimize-error',
]

/** The optimization run, on its own slot: a second start replaces the first. */
const slot = createWorkerSlot()

function protocol(
  request: OptimizeRequest,
  onMessage: (m: OptimizeWorkerMessage) => void,
): SlotProtocol<OptimizeWorkerMessage> {
  return {
    spawn: () => new Worker(new URL('../optimize.worker.ts', import.meta.url), { type: 'module' }),
    request,
    decode: (data) => {
      if (data === null || typeof data !== 'object') return null
      const m = data as { type?: unknown; runId?: unknown }
      if (m.runId !== request.runId || !TYPES.includes(m.type as OptimizeWorkerMessage['type']))
        return null
      return data as OptimizeWorkerMessage
    },
    errorOf: (message) => ({ type: 'optimize-error', runId: request.runId, message }),
    terminal: (m) => m.type !== 'optimize-progress',
    onMessage,
  }
}

/**
 * Start an optimization in its worker; a run already there is terminated.
 * Returns false when the environment has no Worker (node and vitest), so
 * the caller can report the run as unavailable instead of hanging.
 */
export function startOptimize(
  request: OptimizeRequest,
  deliver: (m: OptimizeWorkerMessage) => void,
): boolean {
  return slot.start(protocol(request, deliver))
}

/**
 * With a run id, ask the worker to stop at its next checkpoint and give it
 * the slot's grace period (its `optimize-done` then carries the trace so
 * far); returns false with nothing live or a cancel in flight. Without one,
 * terminate the worker now and drop its callbacks.
 */
export function cancelOptimize(runId?: string): boolean {
  if (runId != null) return slot.cancel({ type: 'cancel', runId } satisfies OptimizeCancel)
  slot.dispose()
  return true
}
