import type { Scenario } from '../model/types'
import { markPresentationVariant } from '../model/scenario'
import { cancelMcRun, cancelSensitivity } from '../playback/mcClient'
import { cancelTrial } from '../playback/trialClient'
import type { RingOverrides } from './rings'
import { pruneRingOverrides } from './rings'
import type { McState, PlaybackState, TrialState } from './runState'
import { freshPlayback, IDLE_MC, IDLE_TRIAL } from './runState'
import { analysisBasisSignature } from './analysisBasis'

/** Undo history holds at most this many snapshots. */
export const HISTORY_LIMIT = 100

/** What the user has picked on the board and in the side panels. */
export interface Selection {
  entityIds: string[]
  boundaryId: string | null
  connectionId: string | null
  libraryId: string | null
  cardId: string | null
}

export const EMPTY_SELECTION: Selection = {
  entityIds: [],
  boundaryId: null,
  connectionId: null,
  libraryId: null,
  cardId: null,
}

/** Every slice one current Scenario governs. The store owns the rest of `ui`. */
export interface ScenarioSlices {
  scenario: Scenario
  past: Scenario[]
  future: Scenario[]
  selection: Selection
  ringOverrides: RingOverrides
  playback: PlaybackState
  mc: McState
  trial: TrialState
}

/**
 * How the next Scenario becomes current. `edit` pushes history; `undo` and
 * `redo` walk it; `replace` discards it and starts a clean run.
 */
export type ScenarioInstall =
  | { op: 'edit'; next: Scenario }
  | { op: 'replace'; next: Scenario }
  | { op: 'undo' }
  | { op: 'redo' }

export type InstallOp = ScenarioInstall['op']

/**
 * Make one Scenario current and answer for every slice it governs. Returns
 * the input object when there is nothing to do (an edit that returned the
 * same object, an empty history side), so a caller can skip its `set`.
 *
 * Per operation:
 * - history: edit pushes `past` (cap HISTORY_LIMIT) and clears `future`;
 *   undo and redo move one snapshot across; replace clears both.
 * - observed lens: undo and redo carry the current `observedPresetId` stamp
 *   over the restored snapshot; a stamp that already matches replaces nothing.
 * - selection: edit keeps it (the action owns it); undo and redo prune ids
 *   the snapshot no longer holds; replace clears it.
 * - ring overrides: every operation prunes ids the scenario no longer holds.
 * - playback, mc, trial: edit, undo and redo compare the analysis basis and
 *   invalidate only what no longer describes the board; replace cancels every
 *   worker and starts a clean run marked `scenario-loaded`.
 */
export function installScenario(st: ScenarioSlices, install: ScenarioInstall): ScenarioSlices {
  switch (install.op) {
    case 'edit': {
      if (install.next === st.scenario) return st
      return respond(st, install.next, {
        past: pushSnapshot(st.past, st.scenario),
        future: [],
        selection: st.selection,
      })
    }
    case 'undo': {
      if (st.past.length === 0) return st
      const restored = withObservedLens(st.past[st.past.length - 1], st.scenario)
      return respond(st, restored, {
        past: st.past.slice(0, -1),
        future: [st.scenario, ...st.future],
        selection: pruneSelection(st.selection, restored),
      })
    }
    case 'redo': {
      if (st.future.length === 0) return st
      const restored = withObservedLens(st.future[0], st.scenario)
      return respond(st, restored, {
        past: pushSnapshot(st.past, st.scenario),
        future: st.future.slice(1),
        selection: pruneSelection(st.selection, restored),
      })
    }
    case 'replace': {
      cancelMcRun()
      cancelSensitivity()
      cancelTrial()
      return {
        scenario: install.next,
        past: [],
        future: [],
        selection: EMPTY_SELECTION,
        ringOverrides: pruneRingOverrides(st.ringOverrides, install.next),
        playback: freshPlayback(st.playback.runSeq, st.playback.speedMult, 'scenario-loaded'),
        mc: IDLE_MC,
        trial: IDLE_TRIAL,
      }
    }
  }
}

/** The shared response of edit, undo and redo once history and selection are decided. */
function respond(
  st: ScenarioSlices,
  next: Scenario,
  decided: Pick<ScenarioSlices, 'past' | 'future' | 'selection'>,
): ScenarioSlices {
  return {
    scenario: next,
    ...decided,
    ringOverrides: pruneRingOverrides(st.ringOverrides, next),
    playback: playbackForScenarioChange(st.playback, next),
    mc: mcForScenarioChange(st.mc, next),
    trial: trialForScenarioChange(st.trial, next),
  }
}

function pushSnapshot(past: Scenario[], snapshot: Scenario): Scenario[] {
  return [...past.slice(-HISTORY_LIMIT + 1), snapshot]
}

/**
 * Undo and redo restore configuration, not run evidence: the lens stamp
 * belongs to the run in progress, so the restored snapshot carries the
 * current stamp forward. A stamp that already matches replaces nothing; a
 * new stamp is a presentation variant of the restored object.
 */
export function withObservedLens(restored: Scenario, current: Scenario): Scenario {
  const stamp = current.observedPresetId ?? null
  if ((restored.observedPresetId ?? null) === stamp) return restored
  const stamped = { ...restored, observedPresetId: stamp }
  markPresentationVariant(stamped, restored)
  return stamped
}

/** Drop selected ids the scenario no longer holds. */
export function pruneSelection(sel: Selection, s: Scenario): Selection {
  const entityIds = sel.entityIds.filter((id) => s.entities.some((e) => e.id === id))
  const keep = <T extends { id: string }>(id: string | null, list: T[]) =>
    id != null && list.some((x) => x.id === id) ? id : null
  return {
    entityIds,
    boundaryId: keep(sel.boundaryId, s.boundaries),
    connectionId: keep(sel.connectionId, s.connections),
    libraryId: keep(sel.libraryId, s.library),
    cardId: keep(sel.cardId, s.testCards),
  }
}

/**
 * A configuration change invalidates the run in progress: the telemetry it
 * produced no longer describes the board. The run keeps its sequence number;
 * only a manual reset issues a new one.
 */
function playbackForScenarioChange(playback: PlaybackState, next: Scenario): PlaybackState {
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
function mcForScenarioChange(mc: McState, next: Scenario): McState {
  const live = (status: McState['status']): boolean => status === 'running' || status === 'done'
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

/** Use the same material-input definition as playback and ensemble analysis. */
function trialForScenarioChange(trial: TrialState, next: Scenario): TrialState {
  if (trial.manifest == null || trial.manifest.basisSignature === analysisBasisSignature(next)) {
    return trial
  }
  cancelTrial()
  return IDLE_TRIAL
}
