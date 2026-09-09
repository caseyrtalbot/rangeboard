import type { FrameSnap, RaidWave, Scenario } from '../model/types'
import { engineKeyOf, scenarioDurationS } from '../model/scenario'
import { DT } from '../playback/clock'
import type { Store } from './store'
import type { BoardPhase } from './runState'
import type { LayerVisibility } from './layers'
import { EXECUTE_DEFAULT_LAYERS } from './layers'
import type { ExecutionHorizon } from '../analysis/horizon'
import { EMPTY_HORIZON, FULL_RUN } from '../analysis/horizon'

/**
 * Store selectors the panels and the canvas subscribe with. Every selector is
 * a pure function of the store state; a panel that subscribes here re-renders
 * only when the value it reads changes, never on a publication that moves a
 * field it does not show.
 */

/** The published sim time, at the 10 Hz publication cadence. */
export const selectSimTimeS = (s: Store): number => s.playback.simTimeS

/** The sim time quantized to the DT grid: the one time every widget reads. */
export const selectSimTimeStep = (s: Store): number => Math.round(s.playback.simTimeS / DT) * DT

/** The observed horizon quantized to the DT grid. Feeds the preview flag. */
export const selectObservedThroughStep = (s: Store): number =>
  Math.round(s.playback.observedThroughS / DT) * DT

export const selectBoardPhase = (s: Store): BoardPhase => s.ui.boardPhase

export const selectEffectiveLayers = (s: Store): LayerVisibility =>
  s.ui.boardPhase === 'execute' ? (s.ui.executeLayers ?? EXECUTE_DEFAULT_LAYERS) : s.ui.layers

let cachedHorizon: ExecutionHorizon = EMPTY_HORIZON

/**
 * Scrubbing can narrow visibility, but cannot extend the observed horizon.
 * Nothing is observed before the first Play: a scrub before Play moves the
 * phase to 'review', so the start stamp, not the phase, decides emptiness.
 */
export function selectExecutionHorizon(s: Store): ExecutionHorizon {
  if (s.ui.boardPhase !== 'execute') return FULL_RUN
  if (s.playback.startedAtMs == null) return EMPTY_HORIZON
  const horizonS = Math.min(selectSimTimeStep(s), selectObservedThroughStep(s))
  if (cachedHorizon.horizonS !== horizonS) cachedHorizon = Object.freeze({ scoped: true, horizonS })
  return cachedHorizon
}

const durationCache = new WeakMap<Scenario, number>()

/** `scenarioDurationS`, cached by engine identity (`engineKeyOf`). */
export function durationOf(scenario: Scenario): number {
  const key = engineKeyOf(scenario)
  let d = durationCache.get(key)
  if (d == null) {
    d = scenarioDurationS(key)
    durationCache.set(key, d)
  }
  return d
}

/** The run duration of the current scenario. */
export const selectDurationS = (s: Store): number => durationOf(s.scenario)

/**
 * True once playback has sealed the run and the observed horizon covers the
 * whole duration. Replaces the per-publication `observedThroughS` subscription
 * in the Analysis rail. An empty scenario (duration 0) never reads complete.
 */
export const selectRunComplete = (s: Store): boolean => {
  const d = durationOf(s.scenario)
  return s.playback.completedAtMs != null && d > 0 && s.playback.observedThroughS >= d
}

/** The transport flags. Subscribe with `useShallow`: the object is rebuilt per call. */
interface PlaybackFlags {
  playing: boolean
  speedMult: number
  runSeq: number
  completedAtMs: number | null
}

export const selectPlaybackFlags = (s: Store): PlaybackFlags => ({
  playing: s.playback.playing,
  speedMult: s.playback.speedMult,
  runSeq: s.playback.runSeq,
  completedAtMs: s.playback.completedAtMs,
})

export const selectFrames = (s: Store): FrameSnap[] => s.scenario.frames

const EMPTY_WAVES: RaidWave[] = []

/** The raid waves, or one shared empty array so a scenario without a raid is stable. */
export const selectWaves = (s: Store): RaidWave[] => s.scenario.raid?.waves ?? EMPTY_WAVES
