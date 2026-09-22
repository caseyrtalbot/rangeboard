import type { Override } from '../model/libraryField'
import type { Scenario } from '../model/types'
import { newId, runSettings } from '../model/types'
import type {
  McMorrisMessage,
  McMorrisRequest,
  McSensitivityMessage,
  McSobolMessage,
  McSobolRequest,
  McSweepMessage,
  McSweepRequest,
  McWorkerMessage,
  SensitivityResponse,
} from '../playback/mcRun'
import type { MorrisResult, PoolProgress } from '../playback/mcTypes'
import type {
  OptimizeBounds,
  OptimizeBudget,
  OptimizeObjective,
  OptimizeRequest,
  OptimizeWorkerMessage,
} from '../playback/optimizeTypes'
import {
  DEFAULT_OPTIMIZE_EVALUATIONS,
  DEFAULT_OPTIMIZE_REPLICATES,
} from '../playback/optimizeTypes'
import { cancelOptimize, startOptimize } from '../playback/optimize/client'
import {
  cancelPooledRun,
  cancelSensitivity,
  cancelSweep,
  requestPooledCancel,
  requestSensitivityCancel,
  requestSweepCancel,
  startMorris,
  startPooledRun,
  startSensitivity,
  startSobol,
  startSweep,
} from '../playback/mcClient'
import { loopEnd } from '../playback/sampling'
import { cancelTrial, startTrial } from '../playback/trialClient'
import type { TrialWorkerMessage } from '../playback/trialMessages'
import { createTrialManifest, sameManifest } from '../playback/trialTypes'
import { boundRetainedTrial } from '../playback/retainTrial'
import { activeOverrides, applyOverrides, useOverrides } from './overrides'
import type { AnalysisRunState, McState, PlaybackState, TrialState } from './runState'
import { IDLE_SENSITIVITY, IDLE_SWEEP } from './runState'
import { analysisBasisSignature } from './analysisBasis'
import { selectTrialSelection } from './trialSelectors'

/**
 * The worker-backed analyses the store can request. A request is identified by
 * run id, analysis basis, and for a trial its request token and manifest. The
 * pending state is published before the worker starts, so a synchronous startup
 * error lands as a terminal error on that state.
 */
export type AnalysisKind = 'mc' | 'sensitivity' | 'sweep' | 'trial' | 'optimize'

/**
 * The kinds `requestAnalysis` launches. A placement run needs its spec, so it has
 * its own entry point (`requestOptimize`), as the Sobol stage has `requestSobol`.
 */
export type RequestKind = Exclude<AnalysisKind, 'optimize'>

/** What a sweep request needs beyond the current scenario and run; the defaults fill the rest. */
export interface SweepSpec {
  factors: McSweepRequest['factors']
  replicatesPerCell?: number
  responses?: SensitivityResponse[]
}

/** Sweep defaults: 40 replicates per cell on the leaker response. */
export const SWEEP_DEFAULTS: Required<Omit<SweepSpec, 'factors'>> = {
  replicatesPerCell: 40,
  responses: ['leakers'],
}

/**
 * What a placement run needs beyond the current scenario and run. `bounds`
 * defaults to the scenario's first range boundary, the budget to
 * `OPTIMIZE_DEFAULTS`, and the seed to the scenario's run seed, so every
 * evaluation of one request shares the draw keys the replicate run would use.
 */
export interface OptimizeSpec {
  objective: OptimizeObjective
  /** Entity ids the optimizer may move; every other entity stays put. */
  movableIds: string[]
  bounds?: OptimizeBounds
  evaluations?: number
  replicates?: number
  seed?: number
}

/** Placement defaults: 60 evaluations of 40 replicates. */
export const OPTIMIZE_DEFAULTS = {
  evaluations: DEFAULT_OPTIMIZE_EVALUATIONS,
  replicates: DEFAULT_OPTIMIZE_REPLICATES,
} as const

/** The scenario's first range boundary as optimize bounds; null when it has none. */
export function rangeBounds(scenario: Scenario): OptimizeBounds | null {
  const range = scenario.boundaries.find((b) => b.type === 'range')
  if (!range) return null
  return { boundaryId: range.id, points: range.points.map((p) => ({ x: p.x, y: p.y })) }
}

/** The slices a request reads and writes. */
export interface AnalysisSlices {
  scenario: Scenario
  playback: PlaybackState
  mc: McState
  trial: TrialState
}

export type AnalysisPatch = Partial<Pick<AnalysisSlices, 'playback' | 'mc' | 'trial'>>

/** Every message the sensitivity slot posts: one-at-a-time, Morris, then Sobol. */
export type SensitivityMessage = McSensitivityMessage | McMorrisMessage | McSobolMessage

/** Where each kind's worker messages go; the store points these at its sinks. */
export interface AnalysisSinks {
  mc: (m: McWorkerMessage) => void
  /** The per-worker counts of the pooled replicate run, beside its `mc` messages. */
  pool: (p: PoolProgress) => void
  sensitivity: (m: SensitivityMessage) => void
  sweep: (m: McSweepMessage) => void
  trial: (m: TrialWorkerMessage) => void
  optimize: (m: OptimizeWorkerMessage) => void
}

/** What one request publishes before its worker starts, and how it starts. */
interface Launch<M> {
  pending: AnalysisPatch
  /** Start the adapter; false when the environment has no Worker. */
  start: (deliver: (m: M) => void) => boolean
  /** The terminal message when no Worker exists. */
  unavailable: M
}

const UNAVAILABLE = 'Web Worker unavailable'

/**
 * The overrides a launch applies. The board scenario, its basis signature and
 * history keep the library values; only the scenario sent to the worker carries
 * the override values.
 */
function launchOverrides(scenario: Scenario): Override[] {
  return activeOverrides(useOverrides.getState().overrides, scenario)
}

/**
 * Request one analysis for the current scenario and run. Publishes the pending
 * state, then starts the worker; a missing Worker and every synchronous startup
 * failure end the request through its sink. Deterministic mode requests no
 * replicates, sensitivity or sweep. A sensitivity request reads the scenario's
 * depth: 'quick' is the one-at-a-time run, 'full' is Morris on `response`, and
 * the Sobol stage follows through `requestSobol`.
 */
export function requestAnalysis(
  kind: RequestKind,
  st: AnalysisSlices,
  publish: (patch: AnalysisPatch) => void,
  sinks: AnalysisSinks,
  sweep?: SweepSpec,
  response: SensitivityResponse = 'leakers',
): void {
  switch (kind) {
    case 'mc':
      return launch(mcLaunch(st, sinks.pool), publish, sinks.mc)
    case 'sensitivity':
      return launch(sensitivityLaunch(st, response), publish, sinks.sensitivity)
    case 'sweep':
      return launch(sweep ? sweepLaunch(st, sweep) : null, publish, sinks.sweep)
    case 'trial':
      return launch(trialLaunch(st), publish, sinks.trial)
  }
}

/**
 * End one kind's request now: the adapter terminates its worker and queued
 * callbacks from it are dropped. Use it where the request no longer describes the
 * current board, or where the caller already published the ended state.
 */
export function cancelAnalysis(kind: AnalysisKind): void {
  switch (kind) {
    case 'mc':
      return cancelPooledRun()
    case 'sensitivity':
      return cancelSensitivity()
    case 'sweep':
      return cancelSweep()
    case 'trial':
      return cancelTrial()
    case 'optimize':
      cancelOptimize()
      return
  }
}

/**
 * Ask a run to stop at its next checkpoint, so its `done` message still carries
 * the work already finished. A worker silent past the grace period is terminated.
 * A trial has no graceful stop; cancel it through `cancelAnalysis`.
 */
export function requestCancel(
  kind: 'mc' | 'sensitivity' | 'sweep' | 'optimize',
  runId: string,
): boolean {
  if (kind === 'mc') return requestPooledCancel(runId)
  if (kind === 'optimize') return cancelOptimize(runId)
  return kind === 'sweep' ? requestSweepCancel(runId) : requestSensitivityCancel(runId)
}

function launch<M>(
  spec: Launch<M> | null,
  publish: (patch: AnalysisPatch) => void,
  deliver: (m: M) => void,
): void {
  if (spec == null) return
  publish(spec.pending)
  if (!spec.start(deliver)) deliver(spec.unavailable)
}

function mcLaunch(
  st: AnalysisSlices,
  onPool: (p: PoolProgress) => void,
): Launch<McWorkerMessage> | null {
  const settings = runSettings(st.scenario)
  if (settings.runMode === 'deterministic') return null
  const runId = st.playback.runId
  const overrides = launchOverrides(st.scenario)
  return {
    pending: {
      mc: {
        // The total is where the loop ends: the cap under a half-width target.
        ...pendingRun(st, loopEnd(settings), overrides),
        // A new replicate run starts with no pool progress. Morris and Sobol results
        // describe the same board until its basis changes, so they stay.
        pool: null,
        morris: st.mc.morris,
        sobol: st.mc.sobol,
        // These three have their own workers, so a replicate run leaves them alone.
        sensitivity: st.mc.sensitivity,
        sweep: st.mc.sweep,
        optimize: st.mc.optimize,
        optimizeBest: st.mc.optimizeBest,
      },
    },
    start: (deliver) =>
      startPooledRun(applyOverrides(st.scenario, overrides), runId, deliver, onPool),
    unavailable: { type: 'error', runId, message: UNAVAILABLE },
  }
}

function sensitivityLaunch(
  st: AnalysisSlices,
  response: SensitivityResponse,
): Launch<SensitivityMessage> | null {
  const { runMode, sensitivityDepth } = runSettings(st.scenario)
  if (runMode === 'deterministic') return null
  const runId = st.playback.runId
  // Total starts at 0: the unit count arrives with the first progress message,
  // because importing uncertainFields by value would pull attrition.ts into the store.
  const overrides = launchOverrides(st.scenario)
  const pending: AnalysisPatch = {
    mc: {
      ...st.mc,
      sensitivity: pendingRun(st, 0, overrides),
      sweep: replaced(st.mc.sweep, IDLE_SWEEP),
      morris: null,
      sobol: null,
    },
  }
  const scenario = applyOverrides(st.scenario, overrides)
  if (sensitivityDepth === 'quick') {
    return {
      pending,
      start: (deliver) => startSensitivity(scenario, runId, deliver),
      unavailable: { type: 'sens-error', runId, message: UNAVAILABLE },
    }
  }
  const request: McMorrisRequest = { type: 'morris', runId, scenario, response }
  return {
    pending,
    start: (deliver) => startMorris(request, deliver),
    unavailable: { type: 'morris-error', runId, message: UNAVAILABLE },
  }
}

/**
 * Saltelli rows for a Sobol stage: `base` rows of A, of B, and of one AB matrix
 * per kept field. The same count `sobolDesign` builds.
 */
export function sobolEvaluationCount(base: number, kept: number): number {
  return base * (kept + 2)
}

/**
 * Planning factor from one measured board: 29 entities at 2560 rows took 499 s.
 * Time scales with entities and rows. Warn when that estimate is at least half
 * of `timeMs`, which is most of the worker budget.
 */
const SOBOL_MEASURED_ENTITIES = 29
const SOBOL_MEASURED_ROWS = 2560
const SOBOL_MEASURED_S = 499

export function sobolBudgetWarning(entities: number, rows: number, timeMs: number): boolean {
  if (entities < 1 || rows < 1 || timeMs <= 0) return false
  const seconds =
    SOBOL_MEASURED_S * (entities / SOBOL_MEASURED_ENTITIES) * (rows / SOBOL_MEASURED_ROWS)
  return seconds * 1000 >= timeMs / 2
}

/**
 * The Sobol stage of a full sensitivity run, on the fields Morris kept and the
 * response it read, on the same slot and run identity. A screening that kept
 * nothing ends the run done with no Sobol result. The caller passes the state
 * after the Morris patch was applied.
 */
export function requestSobol(
  st: AnalysisSlices,
  publish: (patch: AnalysisPatch) => void,
  sinks: AnalysisSinks,
  morris: MorrisResult,
): void {
  const sens = st.mc.sensitivity
  const kept = morris.kept.map((i) => morris.fields[i].field)
  if (kept.length === 0) {
    publish({ mc: { ...st.mc, sensitivity: { ...sens, status: 'done', error: null } } })
    return
  }
  const runId = st.playback.runId
  // The stage continues the screening's run, so it applies the overrides that run kept.
  const rows = sobolEvaluationCount(runSettings(st.scenario).sobolBase, kept.length)
  const request: McSobolRequest = {
    type: 'sobol',
    runId,
    scenario: applyOverrides(st.scenario, sens.overrides),
    kept,
    response: morris.response,
  }
  launch<SensitivityMessage>(
    {
      // The run stays live on its identity. The row count is known before the worker reports.
      pending: { mc: { ...st.mc, sensitivity: { ...sens, progress: 0, total: rows } } },
      start: (deliver) => startSobol(request, deliver),
      unavailable: { type: 'sobol-error', runId, message: UNAVAILABLE },
    },
    publish,
    sinks.sensitivity,
  )
}

/**
 * Request one placement optimization for the current scenario and run. It has its
 * own worker slot, so it replaces only an optimization already there. Nothing is
 * requested under deterministic mode, with no movable entity, or with no bounds.
 */
export function requestOptimize(
  st: AnalysisSlices,
  publish: (patch: AnalysisPatch) => void,
  sinks: AnalysisSinks,
  spec: OptimizeSpec,
): void {
  launch(optimizeLaunch(st, spec), publish, sinks.optimize)
}

function optimizeLaunch(
  st: AnalysisSlices,
  spec: OptimizeSpec,
): Launch<OptimizeWorkerMessage> | null {
  const settings = runSettings(st.scenario)
  if (settings.runMode === 'deterministic') return null
  const bounds = spec.bounds ?? rangeBounds(st.scenario)
  if (bounds == null || spec.movableIds.length === 0) return null
  const runId = st.playback.runId
  const overrides = launchOverrides(st.scenario)
  const budget: OptimizeBudget = {
    evaluations: spec.evaluations ?? OPTIMIZE_DEFAULTS.evaluations,
    replicates: spec.replicates ?? OPTIMIZE_DEFAULTS.replicates,
    // Common random numbers: every evaluation of one request runs at this seed.
    seed: spec.seed ?? settings.seed,
  }
  const request: OptimizeRequest = {
    type: 'optimize',
    runId,
    scenario: applyOverrides(st.scenario, overrides),
    objective: spec.objective,
    movableIds: spec.movableIds,
    bounds,
    budget,
  }
  return {
    // A new run starts with no incumbent; the first progress message brings one.
    pending: {
      mc: { ...st.mc, optimize: pendingRun(st, budget.evaluations, overrides), optimizeBest: null },
    },
    start: (deliver) => startOptimize(request, deliver),
    unavailable: { type: 'optimize-error', runId, message: UNAVAILABLE },
  }
}

/** The state of the run the shared slot drops: a running one goes idle, a finished one stays. */
function replaced<S extends AnalysisRunState<unknown>>(run: S, idle: S): S {
  return run.status === 'running' ? idle : run
}

function sweepLaunch(st: AnalysisSlices, spec: SweepSpec): Launch<McSweepMessage> | null {
  if (runSettings(st.scenario).runMode === 'deterministic') return null
  const runId = st.playback.runId
  const overrides = launchOverrides(st.scenario)
  const request: McSweepRequest = {
    type: 'sweep',
    runId,
    scenario: applyOverrides(st.scenario, overrides),
    factors: spec.factors,
    replicatesPerCell: spec.replicatesPerCell ?? SWEEP_DEFAULTS.replicatesPerCell,
    responses: spec.responses ?? SWEEP_DEFAULTS.responses,
  }
  const cells = spec.factors.reduce((n, f) => n * f.values.length, 1)
  return {
    pending: {
      mc: {
        ...st.mc,
        sweep: pendingRun(st, cells, overrides),
        sensitivity: replaced(st.mc.sensitivity, IDLE_SENSITIVITY),
      },
    },
    start: (deliver) => startSweep(request, deliver),
    unavailable: { type: 'sweep-error', runId, message: UNAVAILABLE },
  }
}

/** A run identified by the current playback run, analysis basis and applied overrides, with nothing done yet. */
function pendingRun<S>(
  st: AnalysisSlices,
  total: number,
  overrides: Override[],
): AnalysisRunState<S> {
  return {
    runId: st.playback.runId,
    status: 'running',
    progress: 0,
    total,
    summary: null,
    basisSignature: analysisBasisSignature(st.scenario),
    overrides,
    error: null,
  }
}

/** A retry keeps the captured scenario and manifest under a new request token. */
function trialLaunch(st: AnalysisSlices): Launch<TrialWorkerMessage> {
  const basisSignature = analysisBasisSignature(st.scenario)
  // The record names the overrides in force at launch; a later edit never rewrites it.
  const manifest =
    st.trial.manifest ??
    createTrialManifest(st.scenario, st.playback.runId, basisSignature, {
      overrides: activeOverrides(useOverrides.getState().overrides, st.scenario),
    })
  const scenario = st.trial.scenario ?? structuredClone(st.scenario)
  const requestToken = newId('trialrequest')
  const identity = { requestToken, runId: manifest.runId, basisSignature }
  return {
    pending: {
      playback: { ...st.playback, playing: false, basisSignature },
      trial: {
        status: 'preparing',
        requestToken,
        manifest,
        scenario,
        result: null,
        startWhenReady: st.trial.startWhenReady,
        error: null,
      },
    },
    start: (deliver) =>
      startTrial({ type: 'prepare-trial', ...identity, scenario, manifest }, deliver),
    unavailable: { type: 'trial-error', ...identity, message: UNAVAILABLE },
  }
}

/**
 * A message belongs to a request only while that request is live, on the current
 * playback run, on the board it was requested for. Terminal states accept nothing.
 */
function owns(
  st: AnalysisSlices,
  request: { live: boolean; runId: string | null; basisSignature: string | null },
  message: { runId: string; basisSignature?: string },
): boolean {
  return (
    request.live &&
    message.runId === request.runId &&
    message.runId === st.playback.runId &&
    (message.basisSignature ?? request.basisSignature) === request.basisSignature &&
    request.basisSignature === analysisBasisSignature(st.scenario)
  )
}

/**
 * Accept a replicate-run message; null when it belongs to no live request. An
 * error clears the pool progress; `done` keeps its last value for the line
 * that reads it after the run.
 */
export function acceptMcMessage(st: AnalysisSlices, m: McWorkerMessage): AnalysisPatch | null {
  const next = acceptRun(st, st.mc, m, (summary) => summary.replicates)
  if (next == null) return null
  return { mc: { ...st.mc, ...next, ...(m.type === 'error' ? { pool: null } : {}) } }
}

/**
 * Accept the pool's progress; null unless a replicate run is live. The pool
 * carries no run id: the coordinator drops a replaced run's callbacks already.
 */
export function acceptPoolProgress(st: AnalysisSlices, p: PoolProgress): AnalysisPatch | null {
  return st.mc.status === 'running' ? { mc: { ...st.mc, pool: p } } : null
}

/** Accept a message of the sensitivity slot, whichever stage posted it. */
export function acceptSensitivityMessage(
  st: AnalysisSlices,
  m: SensitivityMessage,
): AnalysisPatch | null {
  switch (m.type) {
    case 'morris-progress':
    case 'morris-done':
    case 'morris-error':
      return acceptMorrisMessage(st, m)
    case 'sobol-progress':
    case 'sobol-done':
    case 'sobol-error':
      return acceptSobolMessage(st, m)
    default:
      return acceptOatMessage(st, m)
  }
}

/** Accept a one-at-a-time sensitivity message; null when it belongs to no live request. */
function acceptOatMessage(st: AnalysisSlices, m: McSensitivityMessage): AnalysisPatch | null {
  const sens = st.mc.sensitivity
  // A run with no progress message (one field, or none) has no total yet.
  const next = acceptRun(st, sens, m, (summary) =>
    sens.total > 0 ? sens.total : summary.rows.length,
  )
  return next == null ? null : { mc: { ...st.mc, sensitivity: { ...sens, ...next } } }
}

/**
 * Accept a Morris message on the sensitivity run's identity. `morris-done` keeps
 * the run live and clears the count; `requestSobol` then publishes the Saltelli
 * row count on that identity.
 */
export function acceptMorrisMessage(st: AnalysisSlices, m: McMorrisMessage): AnalysisPatch | null {
  const sens = st.mc.sensitivity
  if (!owns(st, { live: sens.status === 'running', ...sens }, m)) return null
  switch (m.type) {
    case 'morris-progress':
      return { mc: { ...st.mc, sensitivity: { ...sens, progress: m.done, total: m.total } } }
    case 'morris-done':
      return { mc: { ...st.mc, morris: m.result, sensitivity: { ...sens, progress: 0, total: 0 } } }
    case 'morris-error':
      return { mc: { ...st.mc, sensitivity: { ...sens, status: 'error', error: m.message } } }
  }
}

/**
 * Accept a Sobol message on the sensitivity run's identity. `sobol-done`
 * records the result and ends the run; the one-at-a-time summary stays null.
 * A cancelled stage carries a null result and ends on the Morris result.
 */
export function acceptSobolMessage(st: AnalysisSlices, m: McSobolMessage): AnalysisPatch | null {
  const sens = st.mc.sensitivity
  if (!owns(st, { live: sens.status === 'running', ...sens }, m)) return null
  switch (m.type) {
    case 'sobol-progress':
      return { mc: { ...st.mc, sensitivity: { ...sens, progress: m.done, total: m.total } } }
    case 'sobol-done':
      return {
        mc: {
          ...st.mc,
          sobol: m.result,
          sensitivity: {
            ...sens,
            status: 'done',
            progress: m.result ? sens.total : 0,
            total: m.result ? sens.total : 0,
            error: null,
          },
        },
      }
    case 'sobol-error':
      return { mc: { ...st.mc, sensitivity: { ...sens, status: 'error', error: m.message } } }
  }
}

/** Accept a sweep message; null when it belongs to no live request. */
export function acceptSweepMessage(st: AnalysisSlices, m: McSweepMessage): AnalysisPatch | null {
  const { sweep } = st.mc
  const next = acceptRun(st, sweep, m, (summary) => summary.cells.length)
  return next == null ? null : { mc: { ...st.mc, sweep: { ...sweep, ...next } } }
}

/**
 * Accept a placement message; null when it belongs to no live request. Progress
 * counts evaluations completed and `best` is the incumbent so far. `optimize-done`
 * keeps the requested budget as the total and the trace length as the progress,
 * so a cut run reads as fewer evaluations than it asked for.
 */
export function acceptOptimizeMessage(
  st: AnalysisSlices,
  m: OptimizeWorkerMessage,
): AnalysisPatch | null {
  const run = st.mc.optimize
  if (!owns(st, { live: run.status === 'running', ...run }, m)) return null
  switch (m.type) {
    case 'optimize-progress':
      return {
        mc: {
          ...st.mc,
          optimize: { ...run, progress: m.done, total: m.total },
          optimizeBest: m.best,
        },
      }
    case 'optimize-done':
      return {
        mc: {
          ...st.mc,
          optimize: {
            ...run,
            status: 'done',
            summary: m.result,
            progress: m.result.trace.length,
            total: m.result.budget.evaluations,
            error: null,
          },
        },
      }
    case 'optimize-error':
      return { mc: { ...st.mc, optimize: { ...run, status: 'error', error: m.message } } }
  }
}

type RunMessage<S> =
  | {
      type: 'progress' | 'sens-progress' | 'sweep-progress'
      runId: string
      done: number
      total: number
    }
  | { type: 'done' | 'sens-done' | 'sweep-done'; runId: string; summary: S }
  | { type: 'error' | 'sens-error' | 'sweep-error'; runId: string; message: string }

/** The shared acceptance of the replicate, sensitivity and sweep runs. */
function acceptRun<S>(
  st: AnalysisSlices,
  run: AnalysisRunState<S>,
  m: RunMessage<S>,
  totalOf: (summary: S) => number,
): Partial<AnalysisRunState<S>> | null {
  if (!owns(st, { live: run.status === 'running', ...run }, m)) return null
  switch (m.type) {
    case 'progress':
    case 'sens-progress':
    case 'sweep-progress':
      return { progress: m.done, total: m.total }
    case 'done':
    case 'sens-done':
    case 'sweep-done': {
      const total = totalOf(m.summary)
      return { status: 'done', summary: m.summary, progress: total, total, error: null }
    }
    case 'error':
    case 'sens-error':
    case 'sweep-error':
      return { status: 'error', error: m.message }
  }
}

/**
 * Accept a trial message; null when it belongs to no live request. A trial also
 * answers to its request token, and its result must repeat the retained manifest
 * and pass the shared adapter before it is ready.
 */
export function acceptTrialMessage(
  st: AnalysisSlices,
  m: TrialWorkerMessage,
): AnalysisPatch | null {
  const { trial } = st
  const manifest = trial.manifest
  if (
    manifest == null ||
    m.requestToken !== trial.requestToken ||
    m.runId !== manifest.runId ||
    !owns(
      st,
      {
        live: trial.status === 'preparing',
        runId: manifest.runId,
        basisSignature: manifest.basisSignature,
      },
      m,
    )
  )
    return null
  const failed = (error: string): AnalysisPatch => ({
    trial: { ...trial, status: 'error', error, startWhenReady: false },
  })
  if (m.type === 'trial-error') return failed(m.message)
  // The envelope and retained manifest must identify the very same draw.
  const received = m.result.manifest
  if (!sameManifest(manifest, received)) return failed('Trial manifest mismatch')
  const ready: TrialState = {
    ...trial,
    status: 'ready',
    error: null,
    startWhenReady: false,
    result: boundRetainedTrial({ ...m.result, manifest }),
  }
  // Validate the shared adapter once before exposing a ready trial or starting its clock.
  if (selectTrialSelection({ ...st, trial: ready }).status !== 'ready') {
    return failed('Invalid trial result')
  }
  return { trial: ready }
}
