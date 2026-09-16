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
 * The replicate run. A replicate run is long, so a second start always
 * terminates the first: the store keeps at most one Monte Carlo run alive.
 */
const run = createWorkerSlot()

/**
 * The sensitivity run, on its own slot. A sensitivity run is many replicate
 * loops, so it runs beside a replicate run: neither start cancels the other.
 * A sweep, a Morris screening and a Sobol run share this slot: any start on
 * it replaces what runs there.
 */
const sens = createWorkerSlot()

/**
 * The pooled replicate run, on its own coordinator. It speaks the same
 * `McWorkerMessage` protocol as `startMcRun` and adds `PoolProgress`, so a
 * caller reads either the single worker or the pool with one handler. The
 * store's Run button starts here; `startMcRun` stays for the single-worker
 * transport tests.
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
 * Start a replicate run in the worker; a worker already running is terminated.
 * Returns false when the environment has no Worker (node and vitest), so the
 * caller can report the run as unavailable instead of hanging.
 */
export function startMcRun(
  scenario: Scenario,
  runId: string,
  onMessage: (m: McWorkerMessage) => void,
): boolean {
  return run.start(
    protocol<McWorkerMessage>(
      { type: 'run', runId, scenario },
      ['progress', 'done', 'error'],
      (message) => ({ type: 'error', runId, message }),
      onMessage,
    ),
  )
}

/** Terminate the replicate worker if one is running. */
export function cancelMcRun(): void {
  run.dispose()
}

/**
 * Ask the replicate worker to stop at its next checkpoint; its `done` message
 * then carries the summary so far with `stopped.rule` 'cancelled'. A worker
 * silent past the grace period is terminated and the run reports an error.
 */
export function requestMcCancel(runId: string): boolean {
  return run.cancel({ type: 'cancel', runId })
}

/**
 * Start a pooled replicate run: `min(hardwareConcurrency - 1, 8)` workers over
 * contiguous replicate ranges, merged by index. A pooled run already running
 * is terminated. `onMessage` reads the same protocol as `startMcRun`;
 * `onPool` adds the per-worker counts and the stop rule. Returns false when
 * the environment has no Worker, as `startMcRun` does.
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
 * with `stopped.rule` 'cancelled'. A pool silent past the grace period is
 * terminated and the run reports an error (see `requestMcCancel`).
 */
export function requestPooledCancel(runId: string): boolean {
  return pool.cancel(runId)
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

/** Ask the sensitivity worker to stop at its next checkpoint (see `requestMcCancel`). */
export function requestSensitivityCancel(runId: string): boolean {
  return sens.cancel({ type: 'cancel', runId })
}

/**
 * Start a sweep on the sensitivity slot; a sensitivity run or sweep already
 * running there is terminated. Returns false when the environment has no
 * Worker, as `startMcRun` does.
 */
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

/**
 * Start a Morris screening on the sensitivity slot; a run already there is
 * terminated. Returns false when the environment has no Worker, as
 * `startMcRun` does.
 */
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

/**
 * Start a Sobol run on the sensitivity slot; a run already there is
 * terminated. Returns false when the environment has no Worker, as
 * `startMcRun` does.
 */
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

/** Ask the sweep worker to stop at its next cell (see `requestMcCancel`). */
export function requestSweepCancel(runId: string): boolean {
  return sens.cancel({ type: 'cancel', runId })
}
