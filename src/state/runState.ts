import type { Scenario } from '../model/types'
import { newId } from '../model/types'
import type { McSummary, SensitivitySummary } from '../playback/mcRun'
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

/** Lifecycle of the Monte Carlo replicate run behind the analysis panel. */
type McStatus = 'idle' | 'running' | 'done' | 'stale' | 'error'

/** Lifecycle of the sensitivity run behind the Sensitivity widget. */
interface SensitivityState {
  runId: string | null
  status: McStatus
  /** Uncertain fields done, and the total. */
  progress: number
  total: number
  summary: SensitivitySummary | null
  basisSignature: string | null
  error: string | null
}

/** The sensitivity slice before any run. */
export const IDLE_SENSITIVITY: SensitivityState = {
  runId: null,
  status: 'idle',
  progress: 0,
  total: 0,
  summary: null,
  basisSignature: null,
  error: null,
}

/** The Monte Carlo slice: replicate run and its sensitivity companion. */
export interface McState {
  /** playback.runId the summary belongs to; null while idle. */
  runId: string | null
  status: McStatus
  /** Replicates done, and the total. After a run both equal summary.replicates. */
  progress: number
  total: number
  summary: McSummary | null
  /** analysisBasisSignature of the scenario the summary was computed on. */
  basisSignature: string | null
  error: string | null
  /** The sensitivity run, on its own worker and its own lifecycle. */
  sensitivity: SensitivityState
}

/** The Monte Carlo slice before any run: no summary, no signature, no error. */
export const IDLE_MC: McState = {
  runId: null,
  status: 'idle',
  progress: 0,
  total: 0,
  summary: null,
  basisSignature: null,
  error: null,
  sensitivity: IDLE_SENSITIVITY,
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
