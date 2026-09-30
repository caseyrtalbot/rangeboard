import type { SensorHoldGate } from '../../analysis/sensorEnv'
import type { RingKey } from '../../state/rings'
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
/** Track covariance ellipse on a coasting track: even dash. */
export const TRACK_ELLIPSE_DASH = [4, 4]
/** Ink for an estimated or truth track. */
export const TRACK_ESTIMATE_INK = KIND_INK.asset
/** Ink for a false track: the same muted grey the inert rings take. */
export const TRACK_FALSE_INK = DISABLED_RING_COLOR
/** Track position marker arm, screen px, held constant under the camera. */
export const TRACK_MARKER_PX = 3

/** An at-rest ring edge: BoardInk.ringIdle, no fill. Dash and width are screen px. */
export interface RestStroke {
  dash: number[]
  width: number
  opacity: number
  lineCap?: 'round'
}

/** At-rest MIR ring: long dash, the heaviest idle edge. */
export const MIR_REST: RestStroke = { dash: [8, 5], width: 1.4, opacity: 0.9 }
/** At-rest MRIR ring: short dash, lighter than MIR. */
export const MRIR_REST: RestStroke = { dash: [3, 4], width: 1.1, opacity: 0.75 }
/** At-rest min range ring: round dots. */
export const MIN_REST: RestStroke = { dash: [1, 4], width: 1.2, opacity: 0.75, lineCap: 'round' }
/** At-rest sensor rings: one even dash for every sensor ring key. */
export const SENSOR_REST: RestStroke = { dash: [6, 4], width: 1.1, opacity: 0.8 }

/**
 * How a system's rings draw. 'disabled' keeps the grey treatment whatever the
 * activity; 'active' is the solid, filled style; 'rest' the dashed idle outline.
 */
export type RingState = 'rest' | 'active' | 'disabled'

export function ringState(active: boolean, disabled: boolean): RingState {
  if (disabled) return 'disabled'
  return active ? 'active' : 'rest'
}

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
  effectorDoctrinal: { dash: null, width: 1, fillAlpha: 0.05, ink: 'danger' },
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
  /** MIR: max range, ground projected for the selected threat, else the placard, meters. */
  maxM: number
  /** MRIR, ground projected likewise, meters. */
  mrirM: number
  /** Min range, ground projected likewise, meters (0 when the spec has none). */
  minM: number
}

interface EffectorRingStyle {
  /** MIR ring radius, meters. */
  maxM: number
  /** MRIR ring radius, meters, or null when not > 0 or coincident with the MIR ring. */
  mrirM: number | null
  /** Min range ring radius, meters, or null when not > 0. */
  minM: number | null
  /** !on: draw every ring in DISABLED_RING_COLOR. */
  grey: boolean
}

function coincides(a: number, b: number | null): boolean {
  return b != null && Math.abs(a - b) <= PLACARD_TOLERANCE_M
}

export function effectorRingStyle(input: EffectorRingInput): EffectorRingStyle {
  const { on, maxM, mrirM, minM } = input
  // An MRIR equal to MIR draws once, as MIR.
  const mrir = mrirM > 0 && !coincides(mrirM, maxM) ? mrirM : null
  return { maxM, mrirM: mrir, minM: positiveOrNull(minM), grey: !on }
}
