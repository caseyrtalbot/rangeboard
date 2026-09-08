import type { Scenario } from '../model/types'
import { newId } from '../model/types'
import type { McSummary, SensitivitySummary } from '../playback/mcRun'
import { cancelMcRun, cancelSensitivity } from '../playback/mcClient'
import { analysisBasisSignature } from './analysisBasis'
import type { TrialManifest, TrialResult } from '../playback/trialTypes'
import { cancelTrial } from '../playback/trialClient'

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

/** Internal R4 infrastructure. No UI selects this result until R5 integration. */
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

/** Use the same material-input definition as playback and ensemble analysis. */
export function trialForScenarioChange(trial: TrialState, next: Scenario): TrialState {
  if (trial.manifest == null || trial.manifest.basisSignature === analysisBasisSignature(next)) {
    return trial
  }
  cancelTrial()
  return IDLE_TRIAL
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

/**
 * A configuration change invalidates the run in progress: the telemetry it
 * produced no longer describes the board. The run keeps its sequence number;
 * only a manual reset issues a new one.
 */
export function playbackForScenarioChange(playback: PlaybackState, next: Scenario): PlaybackState {
  if (
    playback.basisSignature == null ||
    playback.basisSignature === analysisBasisSignature(next)
  ) {
    return playback
  }
  return freshPlayback(playback.runSeq, playback.speedMult, 'configuration-changed')
}

/**
 * The replicates describe the board they ran on. A configuration change makes
 * them stale: the worker is stopped and the summary is kept for reference, but
 * it is no longer the current answer. Bands read `status === 'done'` only. The
 * sensitivity run carries its own signature, so each side goes stale on its own.
 */
export function mcForScenarioChange(mc: McState, next: Scenario): McState {
  const live = (status: McStatus): boolean => status === 'running' || status === 'done'
  if (!live(mc.status) && !live(mc.sensitivity.status)) return mc
  const signature = analysisBasisSignature(next)
  const mcStale = live(mc.status) && mc.basisSignature !== signature
  const sensStale = live(mc.sensitivity.status) && mc.sensitivity.basisSignature !== signature
  if (!mcStale && !sensStale) return mc
  if (mcStale) cancelMcRun()
  if (sensStale) cancelSensitivity()
  return {
    ...mc,
    status: mcStale ? 'stale' : mc.status,
    sensitivity: sensStale ? { ...mc.sensitivity, status: 'stale' } : mc.sensitivity,
  }
}
