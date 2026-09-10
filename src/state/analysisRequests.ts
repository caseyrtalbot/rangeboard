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
// The replicate count the loop ends at; sampling.ts brings only the prng into the store.
import { loopEnd } from '../playback/sampling'
import { cancelTrial, startTrial } from '../playback/trialClient'
import type { TrialWorkerMessage } from '../playback/trialMessages'
import { createTrialManifest, sameManifest } from '../playback/trialTypes'
import { activeOverrides, useOverrides } from './overrides'
import type { AnalysisRunState, McState, PlaybackState, TrialState } from './runState'
import { IDLE_SENSITIVITY, IDLE_SWEEP } from './runState'
import { analysisBasisSignature } from './analysisBasis'
import { selectTrialSelection } from './trialSelectors'

/**
 * The four worker-backed analyses the store can request. This module owns
 * what a request is: its identity (run id, analysis basis, and for a trial the
 * request token and manifest), the startup order (pending state is published
 * before the worker starts, so a synchronous startup error lands as a terminal
 * error on that state), which messages a request still accepts, and how a
 * request ends early. Callers request, accept and cancel through this module;
 * the envelope, the slot and the adapters are decided here and below.
 */
export type AnalysisKind = 'mc' | 'sensitivity' | 'sweep' | 'trial'

/** What a sweep request needs beyond the current scenario and run; the defaults fill the rest. */
export interface SweepSpec {
  factors: McSweepRequest['factors']
  replicatesPerCell?: number
  responses?: SensitivityResponse[]
}

/** The request defaults of the plan: 40 replicates per cell on the leaker response. */
export const SWEEP_DEFAULTS: Required<Omit<SweepSpec, 'factors'>> = {
  replicatesPerCell: 40,
  responses: ['leakers'],
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
 * Request one analysis for the current scenario and run. Publishes the pending
 * state, then starts the worker; the environment without a Worker and every
 * synchronous startup failure end the request through its sink. Nothing is
 * requested for replicates, sensitivity or a sweep under deterministic mode,
 * nor for a sweep without its spec. A sensitivity request reads the scenario's
 * depth: 'quick' is the one-at-a-time run, 'full' is Morris on `response`
 * (leakers by default), and the Sobol stage follows through `requestSobol`.
 */
export function requestAnalysis(
  kind: AnalysisKind,
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
 * End one kind's request now: the adapter terminates its worker, and queued
 * callbacks from it are dropped by slot ownership. Use this where the request
 * no longer describes the current board (load, reset, a stale basis) or where
 * the caller has already published the ended state itself.
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
  }
}

/**
 * Ask a running replicate, sensitivity or sweep run to stop at its next
 * checkpoint, so its `done` message still carries the work already finished.
 * A worker silent past the grace period is terminated. A trial has no
 * graceful stop; cancel it through `cancelAnalysis`.
 */
export function requestCancel(kind: 'mc' | 'sensitivity' | 'sweep', runId: string): boolean {
  if (kind === 'mc') return requestPooledCancel(runId)
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
  return {
    pending: { mc: {
      // The total is where the loop ends: the cap under a half-width target.
      ...pendingRun(st, loopEnd(settings)),
      // A new replicate run starts with no pool progress. The Morris and Sobol
      // results describe the same board until its basis changes, so they stay.
      pool: null,
      morris: st.mc.morris,
      sobol: st.mc.sobol,
      // The sensitivity run and the sweep have their own worker and lifecycle.
      sensitivity: st.mc.sensitivity,
      sweep: st.mc.sweep,
    } },
    start: (deliver) => startPooledRun(st.scenario, runId, deliver, onPool),
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
  // The unit count arrives with the first progress message: a value import of
  // uncertainFields would pull attrition.ts into the store. A sweep on the
  // shared slot is replaced; its pending state goes with it. A new sensitivity
  // run clears the Morris and Sobol results of the last one.
  const pending: AnalysisPatch = { mc: {
    ...st.mc, sensitivity: pendingRun(st, 0), sweep: replaced(st.mc.sweep, IDLE_SWEEP), morris: null, sobol: null,
  } }
  if (sensitivityDepth === 'quick') {
    return {
      pending,
      start: (deliver) => startSensitivity(st.scenario, runId, deliver),
      unavailable: { type: 'sens-error', runId, message: UNAVAILABLE },
    }
  }
  const request: McMorrisRequest = { type: 'morris', runId, scenario: st.scenario, response }
  return {
    pending,
    start: (deliver) => startMorris(request, deliver),
    unavailable: { type: 'morris-error', runId, message: UNAVAILABLE },
  }
}

/**
 * The Sobol stage of a full sensitivity run, after `morris-done` was accepted:
 * the fields Morris kept, on the response it read, on the same slot and run
 * identity. A screening that kept nothing ends the run done with no Sobol
 * result. The caller passes the state after the Morris patch was applied.
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
  const request: McSobolRequest = { type: 'sobol', runId, scenario: st.scenario, kept, response: morris.response }
  launch<SensitivityMessage>({
    // The run stays live on its identity; the evaluation count starts over.
    pending: { mc: { ...st.mc, sensitivity: { ...sens, progress: 0, total: 0 } } },
    start: (deliver) => startSobol(request, deliver),
    unavailable: { type: 'sobol-error', runId, message: UNAVAILABLE },
  }, publish, sinks.sensitivity)
}

/** The state of the run the shared slot drops: a running one goes idle, a finished one stays. */
function replaced<S extends AnalysisRunState<unknown>>(run: S, idle: S): S {
  return run.status === 'running' ? idle : run
}

function sweepLaunch(st: AnalysisSlices, spec: SweepSpec): Launch<McSweepMessage> | null {
  if (runSettings(st.scenario).runMode === 'deterministic') return null
  const runId = st.playback.runId
  const request: McSweepRequest = {
    type: 'sweep',
    runId,
    scenario: st.scenario,
    factors: spec.factors,
    replicatesPerCell: spec.replicatesPerCell ?? SWEEP_DEFAULTS.replicatesPerCell,
    responses: spec.responses ?? SWEEP_DEFAULTS.responses,
  }
  const cells = spec.factors.reduce((n, f) => n * f.values.length, 1)
  return {
    pending: { mc: { ...st.mc, sweep: pendingRun(st, cells), sensitivity: replaced(st.mc.sensitivity, IDLE_SENSITIVITY) } },
    start: (deliver) => startSweep(request, deliver),
    unavailable: { type: 'sweep-error', runId, message: UNAVAILABLE },
  }
}

/** A run identified by the current playback run and analysis basis, with nothing done yet. */
function pendingRun<S>(st: AnalysisSlices, total: number): AnalysisRunState<S> {
  return {
    runId: st.playback.runId,
    status: 'running',
    progress: 0,
    total,
    summary: null,
    basisSignature: analysisBasisSignature(st.scenario),
    error: null,
  }
}

/**
 * A retry within one run keeps the captured scenario and manifest (the same
 * draw) under a new request token; the first request captures both.
 */
function trialLaunch(st: AnalysisSlices): Launch<TrialWorkerMessage> {
  const basisSignature = analysisBasisSignature(st.scenario)
  // The record names the overrides in force at launch; a later edit never rewrites it.
  const manifest = st.trial.manifest ?? createTrialManifest(
    st.scenario, st.playback.runId, basisSignature,
    { overrides: activeOverrides(useOverrides.getState().overrides, st.scenario) },
  )
  const scenario = st.trial.scenario ?? structuredClone(st.scenario)
  const requestToken = newId('trialrequest')
  const identity = { requestToken, runId: manifest.runId, basisSignature }
  return {
    pending: {
      playback: { ...st.playback, playing: false, basisSignature },
      trial: {
        status: 'preparing', requestToken, manifest, scenario, result: null,
        startWhenReady: st.trial.startWhenReady, error: null,
      },
    },
    start: (deliver) => startTrial({ type: 'prepare-trial', ...identity, scenario, manifest }, deliver),
    unavailable: { type: 'trial-error', ...identity, message: UNAVAILABLE },
  }
}

/**
 * A message belongs to a request only while that request is live, on the
 * current playback run, on the board it was requested for. A message from a
 * cancelled or superseded run describes another board; so does a result that
 * was already in flight when the basis changed. Terminal states accept nothing.
 */
function owns(
  st: AnalysisSlices,
  request: { live: boolean; runId: string | null; basisSignature: string | null },
  message: { runId: string; basisSignature?: string },
): boolean {
  return request.live &&
    message.runId === request.runId && message.runId === st.playback.runId &&
    (message.basisSignature ?? request.basisSignature) === request.basisSignature &&
    request.basisSignature === analysisBasisSignature(st.scenario)
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
 * Accept the pool's progress; null unless a replicate run is live. A late
 * message after a reset must not revive the slice. The pool carries no run
 * id of its own: the coordinator already drops a replaced run's callbacks.
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
  const next = acceptRun(st, sens, m, (summary) => sens.total > 0 ? sens.total : summary.rows.length)
  return next == null ? null : { mc: { ...st.mc, sensitivity: { ...sens, ...next } } }
}

/**
 * Accept a Morris message on the sensitivity run's identity. `morris-done`
 * records the result and keeps the run live with its count reset, so the
 * Sobol stage can follow on the same identity (see `requestSobol`).
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
 */
export function acceptSobolMessage(st: AnalysisSlices, m: McSobolMessage): AnalysisPatch | null {
  const sens = st.mc.sensitivity
  if (!owns(st, { live: sens.status === 'running', ...sens }, m)) return null
  switch (m.type) {
    case 'sobol-progress':
      return { mc: { ...st.mc, sensitivity: { ...sens, progress: m.done, total: m.total } } }
    case 'sobol-done':
      return { mc: { ...st.mc, sobol: m.result, sensitivity: { ...sens, status: 'done', progress: sens.total, error: null } } }
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

type RunMessage<S> =
  | { type: 'progress' | 'sens-progress' | 'sweep-progress'; runId: string; done: number; total: number }
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
 * Accept a trial message; null when it belongs to no live request. Beyond the
 * shared identity, a trial answers to its request token, and its result must
 * repeat the retained manifest and pass the shared adapter before it is ready.
 */
export function acceptTrialMessage(st: AnalysisSlices, m: TrialWorkerMessage): AnalysisPatch | null {
  const { trial } = st
  const manifest = trial.manifest
  if (manifest == null || m.requestToken !== trial.requestToken || m.runId !== manifest.runId ||
    !owns(st, { live: trial.status === 'preparing', runId: manifest.runId,
      basisSignature: manifest.basisSignature }, m)) return null
  const failed = (error: string): AnalysisPatch => ({
    trial: { ...trial, status: 'error', error, startWhenReady: false },
  })
  if (m.type === 'trial-error') return failed(m.message)
  // The envelope and retained manifest must identify the very same draw.
  const received = m.result.manifest
  if (!sameManifest(manifest, received)) return failed('Trial manifest mismatch')
  const ready: TrialState = {
    ...trial, status: 'ready', error: null, startWhenReady: false,
    result: { ...m.result, manifest },
  }
  // Validate the shared adapter once before exposing a ready trial or starting its clock.
  if (selectTrialSelection({ ...st, trial: ready }).status !== 'ready') {
    return failed('Invalid trial result')
  }
  return { trial: ready }
}
