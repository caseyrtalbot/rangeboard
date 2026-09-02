import type { SensorHoldGate } from '../../analysis/sensorEnv'

/**
 * One style source for the sensor rings the board draws. Every ring is
 * either the distance the engine uses for the selected threat, or it says
 * why it is not:
 *
 *   held   gate 'ok'        solid ring/wedge with fill at the scaled range;
 *                           a dotted placard ring behind when the scaled
 *                           range differs from the placard by more than 1 m.
 *   cued   gate 'needs-cue' dashed outline, no fill, at the scaled range: the
 *                           sensor holds only when another sensor already
 *                           holds the track. Applies with no threat selected.
 *   inert  rf-silent, rf-band, no-range
 *                           thin dashed grey outline, no fill, at the placard
 *                           range: this sensor cannot hold the selected
 *                           threat. No classify ring.
 *   off    entity disabled  dotted grey outline, no fill, at the placard
 *                           range, never scaled. No classify ring.
 *
 * A planning-basis range (targetScaled false) never scales, so its scaled
 * range equals its placard range and no placard ring appears. The Inspector
 * prints GATE_WORD for the same gates so the board and the panel agree.
 */

export type SensorRingKind = 'held' | 'cued' | 'inert' | 'off'

export interface SensorRingStyle {
  kind: SensorRingKind
  /** Detect ring radius, meters. */
  detectM: number
  /** Dotted placard ring behind the detect ring, meters, or null when it would coincide. */
  placardM: number | null
  /** Classify ring radius, meters, or null when suppressed. */
  classifyM: number | null
  /** Detect ring carries a fill. */
  fill: boolean
  /** Detect ring dash in screen px, or null for solid. */
  dash: number[] | null
  /** Draw in the disabled grey rather than the entity color. */
  grey: boolean
}

export interface SensorRingInput {
  gate: SensorHoldGate
  /** entityActive(entity). */
  on: boolean
  /** effectiveDetectRangeM with no target: the placard range under the environment. */
  placardM: number
  /** effectiveDetectRangeM against the selected threat (equals placardM with no threat). */
  scaledM: number
  /** effectiveClassifyRangeM against the selected threat, or null when the sensor cannot classify. */
  classifyM: number | null
}

/** Placard ring behind a scaled ring: dotted. */
export const PLACARD_DASH = [2, 5]
/** Classify ring: dashed, distinct from the cued detect dash. */
export const CLASSIFY_DASH = [4, 6]
/** Detect ring dash per non-held kind. */
export const DETECT_DASH: Record<Exclude<SensorRingKind, 'held'>, number[]> = {
  cued: [7, 4],
  inert: [3, 4],
  off: [2, 5],
}
/** Scaled and placard ranges closer than this draw as one ring. */
export const PLACARD_TOLERANCE_M = 1

/** Inspector word for each gate that is not 'ok'. Same facts as the ring kinds above. */
export const GATE_WORD: Record<Exclude<SensorHoldGate, 'ok'>, string> = {
  'needs-cue': 'needs cue',
  'rf-silent': 'RF silent',
  'rf-band': 'band',
  'no-range': 'no range',
}

/** Ring kind for a gate on an enabled sensor. */
export function ringKindFor(gate: SensorHoldGate): Exclude<SensorRingKind, 'off'> {
  if (gate === 'ok') return 'held'
  if (gate === 'needs-cue') return 'cued'
  return 'inert'
}

export function sensorRingStyle(input: SensorRingInput): SensorRingStyle {
  const { gate, on, placardM, scaledM, classifyM } = input
  const classify = classifyM != null && classifyM > 0 ? classifyM : null
  if (!on) {
    return { kind: 'off', detectM: placardM, placardM: null, classifyM: null, fill: false, dash: DETECT_DASH.off, grey: true }
  }
  const kind = ringKindFor(gate)
  if (kind === 'inert') {
    return { kind, detectM: placardM, placardM: null, classifyM: null, fill: false, dash: DETECT_DASH.inert, grey: true }
  }
  const placard = Math.abs(scaledM - placardM) > PLACARD_TOLERANCE_M ? placardM : null
  if (kind === 'cued') {
    return { kind, detectM: scaledM, placardM: placard, classifyM: classify, fill: false, dash: DETECT_DASH.cued, grey: false }
  }
  return { kind: 'held', detectM: scaledM, placardM: placard, classifyM: classify, fill: true, dash: null, grey: false }
}
