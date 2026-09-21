import type { SensorHoldGate } from '../../analysis/sensorEnv'
import type { FireDoctrine, UasSpec } from '../../model/types'
import type { RingKey } from '../../state/rings'
import { falloffRangeM, kineticPk } from '../../playback/pk'
import { DANGER_INK, KIND_INK } from '../../ui/ink'

/**
 * Dash, width, fill and ink for every ring the board draws, plus the radii the
 * sensor and effector rings take. Radii are meters; dashes and widths are screen
 * px. Sensor rings take the entity color, effector rings the danger color, and a
 * disabled or inert entity takes DISABLED_RING_COLOR.
 */

type SensorRingKind = 'held' | 'cued' | 'inert' | 'off'

/** Danger ink for the effector rings. */
export const EFFECTOR_RING_COLOR = DANGER_INK
/** Ink for a disabled or inert entity's rings. */
export const DISABLED_RING_COLOR = '#565b58'

/** Placard ring behind the Pd contours: dotted. */
export const PLACARD_DASH = [2, 5]
/** Classify ring: long dash, distinct from the cued detect dash and the Pd 0.9 dash. */
const CLASSIFY_DASH = [10, 4]
/** Placard ring dash per non-held kind. */
export const DETECT_DASH: Record<Exclude<SensorRingKind, 'held'>, number[]> = {
  cued: [7, 4],
  inert: [3, 4],
  off: [2, 5],
}
/** Upper Pd contour dash. */
export const PD_HIGH_DASH = [4, 6]
/** Effector minimum range ring: dotted. */
export const EFFECTOR_MIN_DASH = [2, 5]
/** Release range ring: dashed. */
export const RELEASE_DASH = [7, 4]
/** Commit-Pk range ring: dash-dot. */
export const COMMIT_DASH = [6, 3, 1, 3]
/** Track covariance ellipse on a coasting track: even dash. */
export const TRACK_ELLIPSE_DASH = [4, 4]
/** Ink for an estimated or truth track. */
export const TRACK_ESTIMATE_INK = KIND_INK.asset
/** Ink for a false track: the same muted grey the inert rings take. */
export const TRACK_FALSE_INK = DISABLED_RING_COLOR
/** Track position marker arm, screen px, held constant under the camera. */
export const TRACK_MARKER_PX = 3

/** Two rings closer than this draw as one ring. */
const PLACARD_TOLERANCE_M = 1
/** Pd of the upper contour, a display constant. The lower contour reads requirements.pdDetect. */
export const PD_CONTOUR_HIGH = 0.9

interface RingStyle {
  /** Stroke dash in screen px, or null for solid. For a key that draws two
   *  rings, the primary ring. */
  dash: number[] | null
  /** Stroke width, screen px. */
  width: number
  /** Fill alpha, or null when the ring never fills. */
  fillAlpha: number | null
  /** Ink: the entity color or the effector danger color. */
  ink: 'entity' | 'danger'
}

/** Dash, width, fill and ink per ring key. Secondary rings read the named dashes above. */
export const RING_STYLE: Record<RingKey, RingStyle> = {
  sensorPlacard: { dash: null, width: 1, fillAlpha: 0.1, ink: 'entity' },
  sensorEnvelope: { dash: null, width: 0, fillAlpha: 0.08, ink: 'entity' },
  sensorPdContours: { dash: null, width: 1, fillAlpha: 0.06, ink: 'entity' },
  classifyRings: { dash: CLASSIFY_DASH, width: 1, fillAlpha: null, ink: 'entity' },
  effectorMaxRange: { dash: null, width: 1.5, fillAlpha: 0.03, ink: 'danger' },
  effectorMinRange: { dash: EFFECTOR_MIN_DASH, width: 1, fillAlpha: null, ink: 'danger' },
  effectorDoctrinal: { dash: RELEASE_DASH, width: 1, fillAlpha: null, ink: 'danger' },
}

/** Inspector word for each gate that is not 'ok'. */
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

interface SensorRingInput {
  gate: SensorHoldGate
  /** entityActive(entity). */
  on: boolean
  /** effectiveDetectRangeM with no target: the placard range under the environment, meters. */
  placardM: number
  /** Ground-projected range at requirements.pdDetect against the selected
   *  threat, or null with no threat. */
  pdLowM: number | null
  /** Ground-projected range at PD_CONTOUR_HIGH, or null with no threat or no Pd model. */
  pdHighM: number | null
  /** Ground-projected classify range against the selected threat, or null
   *  when the sensor cannot classify. */
  classifyM: number | null
  /** The sensorPdContours key is on for this entity. */
  contoursOn: boolean
  /** The sensorEnvelope key is on for this entity. */
  envelopeOn: boolean
}

interface SensorRingStyle {
  kind: SensorRingKind
  /** Placard ring radius, meters. */
  placardM: number
  /** Placard ring dash in screen px, or null for solid. */
  placardDash: number[] | null
  /** Placard ring carries the RING_STYLE.sensorPlacard fill. */
  placardFill: boolean
  /** Solid Pd contour radius at requirements.pdDetect, meters, or null when it does not draw. */
  contourLowM: number | null
  /** PD_HIGH_DASH contour radius at PD_CONTOUR_HIGH, meters, or null when it does not draw. */
  contourHighM: number | null
  /** The low contour carries the RING_STYLE.sensorPdContours fill. */
  contourFill: boolean
  /** Classify ring radius, meters, or null when suppressed. */
  classifyM: number | null
  /** Draw in DISABLED_RING_COLOR rather than the entity color. */
  grey: boolean
}

function positiveOrNull(v: number | null): number | null {
  return v != null && v > 0 ? v : null
}

export function sensorRingStyle(input: SensorRingInput): SensorRingStyle {
  const { gate, on, placardM, pdLowM, pdHighM, classifyM, contoursOn, envelopeOn } = input
  const kind: SensorRingKind = on ? ringKindFor(gate) : 'off'
  // Only a sensor that can physically see the target gets threat-scaled rings.
  const sees = kind === 'held' || kind === 'cued'
  const contourLowM = contoursOn && sees ? positiveOrNull(pdLowM) : null
  const contourHighM = contoursOn && sees ? positiveOrNull(pdHighM) : null
  const contours = contourLowM != null || contourHighM != null
  const placardDash = kind === 'held' ? (contours ? PLACARD_DASH : null) : DETECT_DASH[kind]
  // One fill per sensor: the low contour takes it from the placard, the envelope from both.
  const placardFill = kind === 'held' && !contours && !envelopeOn
  const contourFill = kind === 'held' && contourLowM != null && !envelopeOn
  return {
    kind,
    placardM,
    placardDash,
    placardFill,
    contourLowM,
    contourHighM,
    contourFill,
    classifyM: sees ? positiveOrNull(classifyM) : null,
    grey: !sees,
  }
}

export interface EnvelopeBand {
  innerM: number
  outerM: number
}

/**
 * Fill-only band between the smallest and largest effective detect ground
 * range over the UAS entities on the board. Null with no positive range, and
 * null when the band has no width (one threat type on the board).
 */
export function envelopeBandM(groundRangesM: number[]): EnvelopeBand | null {
  const rs = groundRangesM.filter((r) => Number.isFinite(r) && r > 0)
  if (rs.length === 0) return null
  const innerM = Math.min(...rs)
  const outerM = Math.max(...rs)
  if (outerM - innerM <= PLACARD_TOLERANCE_M) return null
  return { innerM, outerM }
}

interface EffectorRingInput {
  /** entityActive(entity). */
  on: boolean
  /** Max range, ground projected for the selected threat, else the placard, meters. */
  maxM: number
  /** Min range, ground projected likewise, meters (0 when the spec has none). */
  minM: number
  /** Release range per doctrine.launchPolicy, ground projected, or null. */
  releaseM: number | null
  /** Commit-Pk range, ground projected, or null. */
  commitM: number | null
}

interface EffectorRingStyle {
  /** Max range ring radius, meters. */
  maxM: number
  /** Min range ring radius, meters, or null when not > 0. */
  minM: number | null
  /** RELEASE_DASH ring radius, or null when off or coincident with the max or commit ring. */
  releaseM: number | null
  /** COMMIT_DASH ring radius, or null when off, not > 0, or coincident with the max ring. */
  commitM: number | null
  /** !on: draw max and min in DISABLED_RING_COLOR, no doctrinal rings. */
  grey: boolean
}

function coincides(a: number, b: number | null): boolean {
  return b != null && Math.abs(a - b) <= PLACARD_TOLERANCE_M
}

export function effectorRingStyle(input: EffectorRingInput): EffectorRingStyle {
  const { on, maxM, minM, releaseM, commitM } = input
  const min = positiveOrNull(minM)
  if (!on) return { maxM, minM: min, releaseM: null, commitM: null, grey: true }
  // A coincident ring draws once: 'pk-commit' puts release on the commit ring,
  // 'max-range' puts it on the max ring.
  const commit = commitM != null && commitM > 0 && !coincides(commitM, maxM) ? commitM : null
  const release =
    releaseM != null && releaseM > 0 && !coincides(releaseM, maxM) && !coincides(releaseM, commitM)
      ? releaseM
      : null
  return { maxM, minM: min, releaseM: release, commitM: commit, grey: false }
}

/**
 * Slant range in meters where the kineticPk shot Pk falls to commitPk, or null
 * when the effector never commits against this target.
 */
export function commitRangeM(input: {
  basePk: number
  uas: UasSpec | undefined
  commitPk: number
  maxRangeM: number
}): number | null {
  const { basePk, uas, commitPk, maxRangeM } = input
  if (maxRangeM <= 0) return null
  const peak = kineticPk(basePk, maxRangeM, uas, 0)
  if (peak <= 0 || peak < commitPk) return null
  return falloffRangeM(commitPk / peak, maxRangeM)
}

/**
 * Slant range where the launch policy volunteers a shot, or null when it
 * never does ('latest'). Same switch as launchPolicyReleases in attrition.
 */
export function releaseRangeM(
  doctrine: FireDoctrine,
  maxRangeM: number,
  commitM: number | null,
): number | null {
  switch (doctrine.launchPolicy) {
    case 'max-range':
      return maxRangeM
    case 'range-fraction':
      return doctrine.launchRangeFraction * maxRangeM
    case 'pk-commit':
      return commitM
    case 'latest':
      return null
    default:
      return maxRangeM
  }
}
