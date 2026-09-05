import type { FrameSnap, RaidWave, Scenario } from '../model/types'
import { scenarioDurationS } from '../model/scenario'
import { DT } from '../playback/sim'
import type { Store } from './store'

/**
 * Store selectors the panels and the canvas subscribe with. Every selector is
 * a pure function of the store state; a panel that subscribes here re-renders
 * only when the value it reads changes, never on a publication that moves a
 * field it does not show (F1, design contract section 7).
 */

/** The published sim time, at the 10 Hz publication cadence. */
export const selectSimTimeS = (s: Store): number => s.playback.simTimeS

/** The sim time quantized to the DT grid: the one time every widget reads. */
export const selectSimTimeStep = (s: Store): number => Math.round(s.playback.simTimeS / DT) * DT

/** The observed horizon quantized to the DT grid. Feeds the preview flag. */
export const selectObservedThroughStep = (s: Store): number =>
  Math.round(s.playback.observedThroughS / DT) * DT

/**
 * The observed horizon floored to whole seconds. `formatTime` shows whole
 * seconds, so text built from this reads exactly as the raw value would and
 * moves once per second, never once per publication.
 */
export const selectObservedThroughWholeS = (s: Store): number =>
  Math.floor(s.playback.observedThroughS)

const durationCache = new WeakMap<Scenario, number>()

/** `scenarioDurationS`, cached by scenario identity. */
export function durationOf(scenario: Scenario): number {
  let d = durationCache.get(scenario)
  if (d == null) {
    d = scenarioDurationS(scenario)
    durationCache.set(scenario, d)
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
