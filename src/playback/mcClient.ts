import type { Scenario } from '../model/types'
import type {
  McMorrisMessage,
  McMorrisRequest,
  McRequest,
  McSensitivityMessage,
  McSensitivityRequest,
  McSobolMessage,
  McSobolRequest,
  McSweepMessage,
  McSweepRequest,
  McWorkerMessage,
} from './mcRun'
import type { PoolProgress } from './mcTypes'
import { createWorkerPool } from './workerPool'
import type { SlotProtocol } from './workerSlot'
import { createWorkerSlot } from './workerSlot'

/**
 * The sensitivity run, on its own slot, so it runs beside a replicate run. A
 * sweep, a Morris screening and a Sobol run share this slot; any start on it
 * replaces what runs there.
 */
const sens = createWorkerSlot()

/**
 * The pooled replicate run, the only replicate transport. It posts the
 * `McWorkerMessage` protocol and adds `PoolProgress`.
 */
const pool = createWorkerPool()

type McMessage =
  McWorkerMessage | McSensitivityMessage | McSweepMessage | McMorrisMessage | McSobolMessage

/** The Monte Carlo protocol: messages are tagged by run id; `done` and `error` end the run. */
function protocol<M extends McMessage>(
  request: Exclude<McRequest, { type: 'cancel' }>,
  types: readonly M['type'][],
  errorOf: (message: string) => M,
  onMessage: (m: M) => void,
): SlotProtocol<M> {
  return {
    spawn: () => new Worker(new URL('./mc.worker.ts', import.meta.url), { type: 'module' }),
    request,
    decode: (data) => {
      if (data === null || typeof data !== 'object') return null
      const m = data as { type?: unknown; runId?: unknown }
      if (m.runId !== request.runId || !types.includes(m.type as M['type'])) return null
      return data as M
    },
    errorOf,
    terminal: (m) => !m.type.endsWith('progress'),
    onMessage,
  }
}

/**
 * Start a pooled replicate run: `min(hardwareConcurrency - 1, 8)` workers over
 * contiguous replicate ranges, merged by index. A pooled run already running is
 * terminated. `onPool` adds the per-worker counts and the stop rule.
 */
export function startPooledRun(
  scenario: Scenario,
  runId: string,
  onMessage: (m: McWorkerMessage) => void,
  onPool: (p: PoolProgress) => void,
): boolean {
  return pool.start(scenario, runId, onMessage, onPool)
}

/** Terminate every worker of the pooled run if one is running. */
export function cancelPooledRun(): void {
  pool.dispose()
}

/**
 * Ask the pooled run to stop at the next checkpoint of each worker; its `done`
 * message then carries the summary over the replicates 0..m-1 that finished,
 * with `stopped.rule` 'cancelled'. Returns false once that stop is in flight
 * and after the run is released for the summary worker.
 */
export function requestPooledCancel(runId: string): boolean {
  return pool.cancel(runId)
}

/** Start a sensitivity run in its own worker; a sensitivity worker already running is terminated. */
export function startSensitivity(
  scenario: Scenario,
  runId: string,
  onMessage: (m: McSensitivityMessage) => void,
): boolean {
  const request: McSensitivityRequest = { type: 'sensitivity', runId, scenario }
  return sens.start(
    protocol<McSensitivityMessage>(
      request,
      ['sens-progress', 'sens-done', 'sens-error'],
      (message) => ({ type: 'sens-error', runId, message }),
      onMessage,
    ),
  )
}

/** Terminate the sensitivity worker if one is running. */
export function cancelSensitivity(): void {
  sens.dispose()
}

/**
 * Ask the sensitivity worker to stop at its next checkpoint, under the slot's
 * cancel grace (`workerSlot.ts`).
 */
export function requestSensitivityCancel(runId: string): boolean {
  return sens.cancel({ type: 'cancel', runId })
}

/** Start a sweep on the sensitivity slot; a run already there is terminated. */
export function startSweep(
  request: McSweepRequest,
  onMessage: (m: McSweepMessage) => void,
): boolean {
  return sens.start(
    protocol<McSweepMessage>(
      request,
      ['sweep-progress', 'sweep-done', 'sweep-error'],
      (message) => ({ type: 'sweep-error', runId: request.runId, message }),
      onMessage,
    ),
  )
}

/** Start a Morris screening on the sensitivity slot; a run already there is terminated. */
export function startMorris(
  request: McMorrisRequest,
  onMessage: (m: McMorrisMessage) => void,
): boolean {
  return sens.start(
    protocol<McMorrisMessage>(
      request,
      ['morris-progress', 'morris-done', 'morris-error'],
      (message) => ({ type: 'morris-error', runId: request.runId, message }),
      onMessage,
    ),
  )
}

/** Start a Sobol run on the sensitivity slot; a run already there is terminated. */
export function startSobol(
  request: McSobolRequest,
  onMessage: (m: McSobolMessage) => void,
): boolean {
  return sens.start(
    protocol<McSobolMessage>(
      request,
      ['sobol-progress', 'sobol-done', 'sobol-error'],
      (message) => ({ type: 'sobol-error', runId: request.runId, message }),
      onMessage,
    ),
  )
}

/** Terminate the sweep worker if one is running (the sensitivity slot). */
export function cancelSweep(): void {
  sens.dispose()
}

/** Ask the sweep worker to stop at its next cell (see `requestSensitivityCancel`). */
export function requestSweepCancel(runId: string): boolean {
  return sens.cancel({ type: 'cancel', runId })
}
