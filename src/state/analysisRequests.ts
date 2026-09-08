import type { Scenario } from '../model/types'
import { newId, runSettings } from '../model/types'
import type { McSensitivityMessage, McWorkerMessage } from '../playback/mcRun'
import { startMcRun, startSensitivity } from '../playback/mcClient'
import { startTrial } from '../playback/trialClient'
import type { TrialWorkerMessage } from '../playback/trialMessages'
import { createTrialManifest } from '../playback/trialTypes'
import type { AnalysisRunState, McState, PlaybackState, TrialState } from './runState'
import { analysisBasisSignature } from './analysisBasis'
import { selectTrialSelection } from './trialSelectors'

/**
 * The three worker-backed analyses the store can request. This module owns
 * what a request is: its identity (run id, analysis basis, and for a trial the
 * request token and manifest), the startup order (pending state is published
 * before the worker starts, so a synchronous startup error lands as a terminal
 * error on that state), and which messages a request still accepts. Callers
 * request an analysis; the envelope and the slot are decided here and below.
 */
export type AnalysisKind = 'mc' | 'sensitivity' | 'trial'

/** The slices a request reads and writes. */
export interface AnalysisSlices {
  scenario: Scenario
  playback: PlaybackState
  mc: McState
  trial: TrialState
}

export type AnalysisPatch = Partial<Pick<AnalysisSlices, 'playback' | 'mc' | 'trial'>>

/** Where each kind's worker messages go; the store points these at its sinks. */
export interface AnalysisSinks {
  mc: (m: McWorkerMessage) => void
  sensitivity: (m: McSensitivityMessage) => void
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
 * requested for replicates or sensitivity under deterministic mode.
 */
export function requestAnalysis(
  kind: AnalysisKind,
  st: AnalysisSlices,
  publish: (patch: AnalysisPatch) => void,
  sinks: AnalysisSinks,
): void {
  switch (kind) {
    case 'mc':
      return launch(mcLaunch(st), publish, sinks.mc)
    case 'sensitivity':
      return launch(sensitivityLaunch(st), publish, sinks.sensitivity)
    case 'trial':
      return launch(trialLaunch(st), publish, sinks.trial)
  }
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

function mcLaunch(st: AnalysisSlices): Launch<McWorkerMessage> | null {
  const { runMode, replicates } = runSettings(st.scenario)
  if (runMode === 'deterministic') return null
  const runId = st.playback.runId
  return {
    pending: { mc: {
      ...pendingRun(st, replicates),
      // The sensitivity run has its own worker and its own lifecycle.
      sensitivity: st.mc.sensitivity,
    } },
    start: (deliver) => startMcRun(st.scenario, runId, deliver),
    unavailable: { type: 'error', runId, message: UNAVAILABLE },
  }
}

function sensitivityLaunch(st: AnalysisSlices): Launch<McSensitivityMessage> | null {
  if (runSettings(st.scenario).runMode === 'deterministic') return null
  const runId = st.playback.runId
  return {
    // The field count arrives with the first progress message: a value
    // import of uncertainFields would pull attrition.ts into the store.
    pending: { mc: { ...st.mc, sensitivity: pendingRun(st, 0) } },
    start: (deliver) => startSensitivity(st.scenario, runId, deliver),
    unavailable: { type: 'sens-error', runId, message: UNAVAILABLE },
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
  const manifest = st.trial.manifest ?? createTrialManifest(
    st.scenario, st.playback.runId, basisSignature,
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

/** Accept a replicate-run message; null when it belongs to no live request. */
export function acceptMcMessage(st: AnalysisSlices, m: McWorkerMessage): AnalysisPatch | null {
  const next = acceptRun(st, st.mc, m, (summary) => summary.replicates)
  return next == null ? null : { mc: { ...st.mc, ...next } }
}

/** Accept a sensitivity-run message; null when it belongs to no live request. */
export function acceptSensitivityMessage(
  st: AnalysisSlices,
  m: McSensitivityMessage,
): AnalysisPatch | null {
  const sens = st.mc.sensitivity
  // A run with no progress message (one field, or none) has no total yet.
  const next = acceptRun(st, sens, m, (summary) => sens.total > 0 ? sens.total : summary.rows.length)
  return next == null ? null : { mc: { ...st.mc, sensitivity: { ...sens, ...next } } }
}

type RunMessage<S> =
  | { type: 'progress' | 'sens-progress'; runId: string; done: number; total: number }
  | { type: 'done' | 'sens-done'; runId: string; summary: S }
  | { type: 'error' | 'sens-error'; runId: string; message: string }

/** The shared acceptance of the replicate and sensitivity runs. */
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
      return { progress: m.done, total: m.total }
    case 'done':
    case 'sens-done': {
      const total = totalOf(m.summary)
      return { status: 'done', summary: m.summary, progress: total, total, error: null }
    }
    case 'error':
    case 'sens-error':
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
  if (Object.keys(manifest).some((key) =>
    manifest[key as keyof typeof manifest] !== received[key as keyof typeof received])) {
    return failed('Trial manifest mismatch')
  }
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
