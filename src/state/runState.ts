import type { Override } from '../model/libraryField'
import type { Scenario } from '../model/types'
import { newId } from '../model/types'
import type { McSummary, SensitivitySummary, SweepSummary } from '../playback/mcRun'
import type { MorrisResult, PoolProgress, SobolResult } from '../playback/mcTypes'
import type { OptimizeEvaluation, OptimizeResult } from '../playback/optimizeTypes'
import type { TrialManifest, TrialResult } from '../playback/trialTypes'

/** Board navigation only, independent of the playback lifecycle. */
export type BoardPhase = 'prepare' | 'execute' | 'analyze'

/** Where a playback run is in its life. */
export type RunPhase = 'ready' | 'running' | 'paused' | 'complete' | 'review'
/** Why the current run replaced the previous one. */
export type RunResetReason = 'manual' | 'configuration-changed' | 'scenario-loaded' | 'initial'

/** The playback run: clock, identity and observation horizon. Derived, never persisted. */
export interface PlaybackState {
  playing: boolean
  simTimeS: number
  speedMult: number
  /** Unique, non-persisted identity for this clean playback run. */
  runId: string
  /** Human-scale sequence shown as RUN-0001, RUN-0002, ... */
  runSeq: number
  phase: RunPhase
  /** Highest time actually traversed by playback; scrubbing never advances it. */
  observedThroughS: number
  startedAtMs: number | null
  completedAtMs: number | null
  /** Analysis-only configuration snapshot used to detect mid-run changes. */
  basisSignature: string | null
  resetReason: RunResetReason
}

/** Captured sampled trial shared by execution consumers; never persisted. */
export interface TrialState {
  status: 'idle' | 'preparing' | 'ready' | 'cancelled' | 'error'
  requestToken: string | null
  manifest: TrialManifest | null
  /** Detached configuration captured once for this identity; never autosaved. */
  scenario: Scenario | null
  /** Page copy of the trial: ledger, compact scans, and the estimate fields the board reads. */
  result: TrialResult | null
  startWhenReady: boolean
  error: string | null
}

export const IDLE_TRIAL: TrialState = {
  status: 'idle',
  requestToken: null,
  manifest: null,
  scenario: null,
  result: null,
  startWhenReady: false,
  error: null,
}

/** Lifecycle of a worker-backed analysis run (replicates or sensitivity). */
type McStatus = 'idle' | 'running' | 'done' | 'stale' | 'error'

/**
 * One worker-backed analysis run and its result. The replicate and sensitivity
 * runs share this shape so `analysisRequests.ts` accepts their messages by one rule.
 */
export interface AnalysisRunState<S> {
  /** playback.runId the summary belongs to; null while idle. */
  runId: string | null
  status: McStatus
  /** Units done, and the total: replicates for a replicate run, uncertain fields for sensitivity. */
  progress: number
  total: number
  summary: S | null
  /** analysisBasisSignature of the scenario the summary was computed on. */
  basisSignature: string | null
  /**
   * The overrides the run applied at launch. Part of the run's identity beside the
   * basis signature, so an override edit makes the run stale.
   */
  overrides: Override[]
  error: string | null
}

/** The sensitivity run behind the Sensitivity widget. */
export type SensitivityState = AnalysisRunState<SensitivitySummary>

/** The sensitivity slice before any run. */
export const IDLE_SENSITIVITY: SensitivityState = {
  runId: null,
  status: 'idle',
  progress: 0,
  total: 0,
  summary: null,
  basisSignature: null,
  overrides: [],
  error: null,
}

/** The factor sweep behind the Fragility screen; `progress` and `total` count cells. */
export type SweepState = AnalysisRunState<SweepSummary>

/** The sweep slice before any run. */
export const IDLE_SWEEP: SweepState = { ...IDLE_SENSITIVITY, summary: null }

/** The placement optimization behind the Where to put it screen; `progress` and `total` count evaluations. */
export type OptimizeState = AnalysisRunState<OptimizeResult>

/** The optimize slice before any run. */
export const IDLE_OPTIMIZE: OptimizeState = { ...IDLE_SENSITIVITY, summary: null }

/** The Monte Carlo slice: replicate run, its sensitivity companion and the factor sweep. */
export interface McState extends AnalysisRunState<McSummary> {
  /** The sensitivity run, on its own worker and its own lifecycle. */
  sensitivity: SensitivityState
  /** The factor sweep. It shares the sensitivity worker slot, so the two replace each other. */
  sweep: SweepState
  /** Progress of the worker pool behind the replicate run; null off the pool or before it starts. */
  pool: PoolProgress | null
  /** Morris screening of the finished replicate run; null until it runs. */
  morris: MorrisResult | null
  /** Sobol indices over the fields Morris kept; null until it runs. */
  sobol: SobolResult | null
  /** The placement optimization, on its own worker and its own lifecycle. */
  optimize: OptimizeState
  /**
   * The best evaluation the running optimization has reported. `optimize-progress`
   * carries it and the finished `OptimizeResult` does not repeat it.
   */
  optimizeBest: OptimizeEvaluation | null
}

/** The Monte Carlo slice before any run: no summary, no signature, no error. */
export const IDLE_MC: McState = {
  runId: null,
  status: 'idle',
  progress: 0,
  total: 0,
  summary: null,
  basisSignature: null,
  overrides: [],
  error: null,
  sensitivity: IDLE_SENSITIVITY,
  sweep: IDLE_SWEEP,
  pool: null,
  morris: null,
  sobol: null,
  optimize: IDLE_OPTIMIZE,
  optimizeBest: null,
}

/** A clean run: new identity, clock at zero, nothing observed. */
export function freshPlayback(
  runSeq: number,
  speedMult = 1,
  resetReason: RunResetReason = 'initial',
): PlaybackState {
  return {
    playing: false,
    simTimeS: 0,
    speedMult,
    runId: newId('simrun'),
    runSeq,
    phase: 'ready',
    observedThroughS: 0,
    startedAtMs: null,
    completedAtMs: null,
    basisSignature: null,
    resetReason,
  }
}

/**
 * The placement result that answers for the board on screen: a finished run on the
 * current playback run and the current analysis basis. A run in progress, another
 * playback run or another basis reads null.
 */
export function currentOptimize(
  optimize: OptimizeState,
  runId: string,
  basis: string,
): OptimizeResult | null {
  return optimize.status === 'done' && optimize.runId === runId && optimize.basisSignature === basis
    ? optimize.summary
    : null
}
