import type { Scenario } from '../model/types'
import type { TrialManifest, TrialResult } from '../playback/trialTypes'
import { createTrialManifest, sameManifest } from '../playback/trialTypes'
import { analysisBasisSignature } from './analysisBasis'
import type { PlaybackState, TrialState } from './runState'
import { trialResultOf } from '../analysis/trialResult'

export type TrialSelection =
  | { status: 'idle' | 'cancelled'; runId: string }
  | { status: 'preparing'; runId: string; manifest: TrialManifest }
  | { status: 'error'; runId: string; message: string }
  | { status: 'ready'; runId: string; scenario: Scenario; result: TrialResult }

type State = { scenario: Scenario; playback: PlaybackState; trial: TrialState }
const signatures = new WeakMap<Scenario, string>()
const selections = new WeakMap<
  TrialState,
  { scenario: Scenario; runId: string; selection: TrialSelection }
>()

export function selectTrialSelection(state: State): TrialSelection {
  const { scenario, playback, trial } = state
  const hit = selections.get(trial)
  if (hit?.scenario === scenario && hit.runId === playback.runId) return hit.selection
  const idle: TrialSelection = { status: 'idle', runId: playback.runId }
  const choose = (): TrialSelection => {
    const manifest = trial.manifest
    if (!manifest || manifest.runId !== playback.runId || !trial.scenario) return idle
    let signature = signatures.get(scenario)
    if (signature == null) {
      signature = analysisBasisSignature(scenario)
      signatures.set(scenario, signature)
    }
    if (manifest.basisSignature !== signature) return idle
    const expected = createTrialManifest(scenario, playback.runId, signature)
    // Record-only keys never decide whether a trial still belongs to this run.
    if (
      !sameManifest(expected, manifest, [
        'buildRevision',
        'overrides',
        'physicsSwitches',
        'fidelityFloor',
        'dataPackageVersion',
        'producer',
      ]) ||
      !(manifest.buildRevision === null || typeof manifest.buildRevision === 'string')
    )
      return idle
    if (trial.status === 'cancelled') return { status: 'cancelled', runId: manifest.runId }
    if (trial.error != null) return { status: 'error', runId: manifest.runId, message: trial.error }
    if (trial.status === 'preparing')
      return { status: 'preparing', runId: manifest.runId, manifest }
    if (trial.status !== 'ready' || !trial.result) return idle
    try {
      trialResultOf(trial.scenario, manifest, trial.result)
    } catch {
      return idle
    }
    return {
      status: 'ready',
      runId: manifest.runId,
      scenario: trial.scenario,
      result: trial.result,
    }
  }
  const selection = choose()
  selections.set(trial, { scenario, runId: playback.runId, selection })
  return selection
}

/** Raw cursor in every trial phase. Explicit forecasts keep selectExecutionHorizon. */
export function selectTrialHorizon(state: State, runCursor: number): number {
  const selection = selectTrialSelection(state)
  if (selection.status !== 'ready' || state.playback.startedAtMs == null) return 0
  const view = trialResultOf(selection.scenario, state.trial.manifest!, selection.result)
  return Math.max(
    0,
    Math.min(
      Number.isNaN(runCursor) ? 0 : runCursor,
      state.playback.observedThroughS,
      view.observedThroughS,
    ),
  )
}
