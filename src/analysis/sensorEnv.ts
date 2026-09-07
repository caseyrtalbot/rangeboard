import type {
  EffectorSpec,
  EnvironmentSpec,
  JamBand,
  Precipitation,
  SensorRole,
  SensorSpec,
  SensorType,
  UasSpec,
} from '../model/types'
import {
  JAM_BANDS,
  PLACARD_PD,
  PLACARD_PFA,
  PLACARD_SWERLING,
  defaultSensorRole,
} from '../model/types'
import { RADAR_REF_RCS_M2, rcsM2For, swerlingFor } from '../model/rcsFactors'
import {
  ACOUSTIC_REF_DB,
  EO_REF_SPAN_M,
  IR_SIGNATURE_FACTOR,
  acousticDbFor,
  irSignatureFor,
  spanMFor,
} from '../model/signatureFactors'
import { targetLinkBands } from './ewPhysics'
import { elevationDeg, radioHorizonM } from '../geometry/slant'
import type { RadarCalibration } from './radarPd'
import { pdAtRange, rangeForPd } from './radarPd'

/**
 * Sensor performance under environmental covariates and target effects.
 *
 * One shape for every technology: the spec range is quoted against a
 * REFERENCE target; the range against another target follows a physical law
 * (radar: fourth root of the RCS ratio; EO/IR: linear in the span ratio,
 * Johnson criteria; acoustic: spherical spreading plus atmospheric
 * absorption against a reference source level; RF: band overlap, no
 * scaling); then environment multiplies the result. A 'planning' range
 * basis carries no stated target, so no target law runs on it.
 *
 * Environment factors follow the COURAGEOUS project findings (Brewczynski
 * et al., Remote Sens. 2024, 16, 3714): rain and fog attenuate radar and
 * EO/IR, visible-light cameras are daylight sensors, urban EM clutter cuts
 * RF detection, and wind masks acoustic signatures. Values are
 * representative planning factors, not test data.
 */
export const SENSOR_ENV_MODEL = {
  rain: { radar: 0.75, 'eo-ir': 0.6, rf: 1, acoustic: 0.7 } as Record<SensorType, number>,
  fog: { radar: 0.85, 'eo-ir': 0.4, rf: 1, acoustic: 1 } as Record<SensorType, number>,
  urbanEm: { radar: 0.9, 'eo-ir': 1, rf: 0.6, acoustic: 0.85 } as Record<SensorType, number>,
  /** Acoustic range loss per m/s of wind, with a floor. */
  acousticWindLossPerMps: 0.03,
  acousticWindFloor: 0.4,
  source: 'COURAGEOUS project (Remote Sens. 2024) + radar range equation',
}

/**
 * Night range multiplier for a visible-only EO sensor. Thermal and dual-band
 * sensors keep their range at night (the thermal channel carries); night is
 * handled per band in eoRangeFactor, not as a type-wide factor.
 */
export const NIGHT_VISIBLE_FACTOR = 0.2

/** Meteorological visibility derived from precipitation when the environment sets none, meters. */
export const VISIBILITY_BY_PRECIP: Record<Precipitation, number> = {
  clear: 20000,
  rain: 6000,
  fog: 600,
}

/** Atmospheric absorption, dB per km, at 1 kHz on a standard day (planning value). */
export const ALPHA_DB_PER_KM = 5

function envFactorImpl(type: SensorType, env: EnvironmentSpec, includeUrban: boolean): number {
  if (!env.apply) return 1
  let f = 1
  const precip = env.precipitation ?? 'clear'
  if (precip === 'rain') f *= SENSOR_ENV_MODEL.rain[type]
  if (precip === 'fog') f *= SENSOR_ENV_MODEL.fog[type]
  if (includeUrban && (env.emBackground ?? 'rural') === 'urban') f *= SENSOR_ENV_MODEL.urbanEm[type]
  if (type === 'acoustic' && env.windSpeedMps > 0) {
    // Wind bearing relative to the source is out of scope: the loss is a
    // scalar noise-floor effect, the same in every direction.
    f *= Math.max(
      SENSOR_ENV_MODEL.acousticWindFloor,
      1 - env.windSpeedMps * SENSOR_ENV_MODEL.acousticWindLossPerMps,
    )
  }
  return f
}

/**
 * Range multiplier for one sensor technology under the current environment,
 * (0, 1]. Type-wide effects only: rain, fog, urban EM, wind. Night is a
 * per-band EO/IR effect (eoRangeFactor) and is not in here.
 */
export function sensorEnvFactor(type: SensorType, env: EnvironmentSpec): number {
  return envFactorImpl(type, env, true)
}

/** True when the sensor's detect range is a sourced figure that target laws may scale. */
export function targetScaled(spec: SensorSpec): boolean {
  return (spec.rangeBasis ?? 'sourced') !== 'planning'
}

/** The RCS, m2, at which a radar's detect range is quoted: spec value, else the Group 1 planning factor. */
export function refRcsM2For(spec: SensorSpec): number {
  const r = spec.refRcsM2
  return r != null && Number.isFinite(r) && r > 0 ? r : RADAR_REF_RCS_M2
}

/**
 * Radar range multiplier for one target: (target RCS / reference RCS)^(1/4),
 * the radar range equation with everything but the target held fixed. A
 * bigger airframe is seen farther, a smaller one closer, and the target the
 * range was quoted against scores exactly 1. Non-radar sensors, an unknown
 * target, and a planning-basis range score 1.
 */
export function rcsRangeFactor(spec: SensorSpec, target: UasSpec | undefined): number {
  if (spec.sensorType !== 'radar' || !target || !targetScaled(spec)) return 1
  return Math.pow(rcsM2For(target) / refRcsM2For(spec), 0.25)
}

/** The instrumented range when the spec records one, else null. */
function instrumentedM(spec: SensorSpec): number | null {
  const cap = spec.instrumentedRangeM
  return cap != null && Number.isFinite(cap) && cap > 0 ? cap : null
}

/** Cap at the radar's instrumented range: nothing is reported beyond what the radar processes. */
function capInstrumented(spec: SensorSpec, rangeM: number): number {
  const cap = instrumentedM(spec)
  return cap != null ? Math.min(rangeM, cap) : rangeM
}

/** A probability strictly inside (0, 1), else the fallback. */
function probabilityOr(p: number | null | undefined, fallback: number): number {
  return p != null && Number.isFinite(p) && p > 0 && p < 1 ? p : fallback
}

/**
 * Placard calibration of one radar: r0M = detectRangeM, rcs0M2 =
 * refRcsM2For(spec), pd0 = placardPd ?? PLACARD_PD, pfa = pfa ?? PLACARD_PFA,
 * swerling0 = PLACARD_SWERLING. A recorded Pd or Pfa outside (0, 1) falls
 * back to the planning factor.
 */
export function radarCalibration(spec: SensorSpec): RadarCalibration {
  return {
    r0M: spec.detectRangeM,
    rcs0M2: refRcsM2For(spec),
    pd0: probabilityOr(spec.placardPd, PLACARD_PD),
    pfa: probabilityOr(spec.pfa, PLACARD_PFA),
    swerling0: PLACARD_SWERLING,
  }
}

/**
 * True when the Pd model applies: a radar whose detect range is a sourced
 * figure, against a known target. A planning-basis radar skips the Pd model
 * exactly as it skips RCS scaling.
 */
export function radarPdModeled(spec: SensorSpec, target: UasSpec | undefined): target is UasSpec {
  return spec.sensorType === 'radar' && !!target && targetScaled(spec)
}

/**
 * Single-scan Pd of one radar against one target at one slant range. Null
 * when the sensor is not a radar, has a 'planning' range basis, or has no
 * target. 0 beyond instrumentedRangeM. The environment multiplier enters
 * the SNR as the fourth power (through sensorEnvFactor('radar', env)). The
 * ONE Pd evaluation: the sweep, the board and the inspector all read it.
 */
export function radarPdAt(
  spec: SensorSpec,
  env: EnvironmentSpec,
  target: UasSpec | undefined,
  slantM: number,
): number | null {
  return radarPdCurve(spec, env, target)?.(slantM) ?? null
}

/**
 * radarPdAt with the calibration, the target terms and the environment
 * factor resolved once: the curve the sweep evaluates per admitted member
 * per step. Null when the Pd model does not apply.
 */
export function radarPdCurve(
  spec: SensorSpec,
  env: EnvironmentSpec,
  target: UasSpec | undefined,
): ((slantM: number) => number) | null {
  if (!radarPdModeled(spec, target)) return null
  const cap = instrumentedM(spec)
  const cal = radarCalibration(spec)
  const rcsM2 = rcsM2For(target)
  const envFactor = sensorEnvFactor('radar', env)
  const swerling = swerlingFor(target)
  return (slantM) =>
    cap != null && slantM > cap ? 0 : pdAtRange(cal, rcsM2, slantM, envFactor, swerling)
}

/** The span, m, at which an EO/IR detect range is quoted: spec value, else the Group 1 planning factor. */
export function refSpanMFor(spec: SensorSpec): number {
  const r = spec.refSpanM
  return r != null && Number.isFinite(r) && r > 0 ? r : EO_REF_SPAN_M
}

/** True when the thermal channel carries the detection: a thermal sensor, or a dual sensor at night. */
function eoThermalCarries(spec: SensorSpec, env: EnvironmentSpec): boolean {
  const band = spec.eoBand ?? 'dual'
  if (band === 'thermal') return true
  if (band === 'visible') return false
  return env.apply && (env.light ?? 'day') === 'night'
}

/** Meteorological visibility in use, meters: the environment value, else the precipitation default. */
export function visibilityMFor(env: EnvironmentSpec): number {
  const v = env.visibilityM
  if (v != null && Number.isFinite(v) && v > 0) return v
  return VISIBILITY_BY_PRECIP[env.precipitation ?? 'clear']
}

/**
 * EO/IR range multiplier for one target. Size term: target span over the
 * reference span (Johnson criteria: the line pairs across the critical
 * dimension scale linearly with range). Thermal term: the target's contrast
 * class, when the thermal channel carries. Night: a visible-only sensor
 * falls to NIGHT_VISIBLE_FACTOR; thermal and dual sensors keep range. The
 * target terms are physics, not weather, so they apply whether or not the
 * environment toggle is on; night is weather and follows the toggle.
 */
export function eoRangeFactor(
  spec: SensorSpec,
  target: UasSpec | undefined,
  env: EnvironmentSpec,
): number {
  if (spec.sensorType !== 'eo-ir') return 1
  let f = 1
  if (env.apply && (env.light ?? 'day') === 'night' && (spec.eoBand ?? 'dual') === 'visible') {
    f *= NIGHT_VISIBLE_FACTOR
  }
  if (target && targetScaled(spec)) {
    f *= spanMFor(target) / refSpanMFor(spec)
    if (eoThermalCarries(spec, env)) f *= IR_SIGNATURE_FACTOR[irSignatureFor(target)]
  }
  return f
}

/** Koschmieder cap: no EO/IR contrast survives beyond the meteorological visibility. */
function capVisibility(spec: SensorSpec, env: EnvironmentSpec, rangeM: number): number {
  if (spec.sensorType !== 'eo-ir' || !env.apply) return rangeM
  return Math.min(rangeM, visibilityMFor(env))
}

/** The source level, dB at 1 m, an acoustic detect range is quoted against: spec value, else the Group 1 tier. */
export function refAcousticDbFor(spec: SensorSpec): number {
  const r = spec.refAcousticDb
  return r != null && Number.isFinite(r) && r > 0 ? r : ACOUSTIC_REF_DB
}

/**
 * Range at which a source deltaDb louder than the reference reaches the
 * same received level the reference reached at refRangeM. Solves
 *   20 log10(R / Rref) + ALPHA_DB_PER_KM (R - Rref) / 1000 = deltaDb
 * by bisection on the monotone left side. deltaDb 0 returns Rref exactly.
 * At short range the absorption term is small and +20 dB is about 10x; at
 * long range absorption bends the answer below the spreading-only value.
 */
export function acousticSolveM(refRangeM: number, deltaDb: number): number {
  if (!(refRangeM > 0)) return 0
  if (deltaDb === 0) return refRangeM
  const f = (r: number) =>
    20 * Math.log10(r / refRangeM) + (ALPHA_DB_PER_KM * (r - refRangeM)) / 1000 - deltaDb
  let lo: number
  let hi: number
  if (deltaDb > 0) {
    lo = refRangeM
    hi = refRangeM * 2
    while (f(hi) < 0) hi *= 2
  } else {
    lo = refRangeM * 1e-9
    hi = refRangeM
  }
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Acoustic target term: the solved range over the quoted range. 1 for a planning basis or no target. */
function acousticRangeFactor(spec: SensorSpec, quotedM: number, target: UasSpec | undefined): number {
  if (!target || !targetScaled(spec) || !(quotedM > 0)) return 1
  return acousticSolveM(quotedM, acousticDbFor(target) - refAcousticDbFor(spec)) / quotedM
}

/**
 * True when the UAS emits an RF control or video link a passive RF sensor can
 * hear. Autonomous, inertial, optical, and fiber-guided threats are RF silent
 * (COURAGEOUS: frequency monitors only detect active transmissions).
 */
export function rfDetectable(uas: UasSpec): boolean {
  return uas.navMode === 'rf-manual' || uas.navMode === 'mixed'
}

/** True when a jammer has something to deny: an RF link or GNSS navigation. */
export function jammable(uas: UasSpec): boolean {
  return uas.navMode === 'gps' || uas.navMode === 'rf-manual' || uas.navMode === 'mixed'
}

/** Bands an RF sensor receives. Absent means every band. */
export function rfSensorBands(spec: SensorSpec): JamBand[] {
  return spec.rfBands && spec.rfBands.length > 0 ? spec.rfBands : JAM_BANDS
}

/**
 * True when the RF sensor can hear this threat: it emits at all, and one of
 * its EMITTING link bands is inside the receiver's coverage. GNSS is a
 * band the threat receives, never one it transmits, so it never counts.
 */
export function rfCanHear(spec: SensorSpec, uas: UasSpec): boolean {
  if (!rfDetectable(uas)) return false
  const rx = new Set(rfSensorBands(spec))
  return targetLinkBands(uas).some((b) => b !== 'gnss' && rx.has(b))
}

/** True when the environment's urban override applies to this RF sensor. */
function urbanOverride(spec: SensorSpec, env: EnvironmentSpec): boolean {
  return (
    spec.sensorType === 'rf' &&
    spec.detectRangeM > 0 &&
    env.apply &&
    (env.emBackground ?? 'rural') === 'urban' &&
    spec.urbanRangeM != null &&
    Number.isFinite(spec.urbanRangeM) &&
    spec.urbanRangeM > 0
  )
}

/** Roles that hold only a cued target (narrow field of view). */
const CUED_EO_ROLES: ReadonlySet<SensorRole> = new Set([
  'classification',
  'fire-control',
  'tracking',
  'target-acquisition',
])

/**
 * True when this EO/IR sensor needs a cue from another sensor before it
 * holds a track (COURAGEOUS: narrow-FOV cameras verify and track cued
 * targets, they do not search). Wide-area search sensors (surveillance,
 * early-warning roles) hold without a cue and can cue others. Non-EO/IR
 * sensors never need a cue.
 */
export function eoIrNeedsCue(spec: SensorSpec): boolean {
  return spec.sensorType === 'eo-ir' && CUED_EO_ROLES.has(defaultSensorRole(spec))
}

export type SensorHoldGate = 'ok' | 'needs-cue' | 'rf-silent' | 'rf-band' | 'no-range'

/**
 * Why a sensor cannot hold this target regardless of geometry, or 'ok'. One
 * gate for the sweep, the board and the inspector: a sensor gated
 * rf-silent / rf-band / no-range never hits; needs-cue hits only when cued.
 */
export function sensorHoldGate(spec: SensorSpec, target: UasSpec | undefined): SensorHoldGate {
  if (!(spec.detectRangeM > 0)) return 'no-range'
  if (spec.sensorType === 'rf' && target) {
    if (!rfDetectable(target)) return 'rf-silent'
    if (!rfCanHear(spec, target)) return 'rf-band'
  }
  if (eoIrNeedsCue(spec)) return 'needs-cue'
  return 'ok'
}

/** Feet to meters. Altitudes are recorded in feet; the engine works in meters. */
export const FT_TO_M = 0.3048

/** A recorded altitude ceiling in meters, or null when the spec states none. */
function ceilingM(maxAltitudeFt: number | null | undefined): number | null {
  return maxAltitudeFt != null && Number.isFinite(maxAltitudeFt) && maxAltitudeFt > 0
    ? maxAltitudeFt * FT_TO_M
    : null
}

export type GeometryGate = 'ok' | 'below-horizon' | 'elevation' | 'ceiling'

/** Elevation gate tolerance at both edges, degrees. PF. */
const EL_EPS_DEG = 0.001

/**
 * Vertical geometry gate for one sensor against one target position.
 * Ceiling applies only when spec.maxAltitudeFt is recorded. Horizon (4/3
 * earth radio line of sight between the phase center and the target)
 * applies to radar, RF and EO/IR, never to acoustic, which needs no line
 * of sight. Elevation applies only when spec.elevationDeg is recorded and
 * tests the angle from the phase center to the target against [min, max]
 * with a 0.001 degree tolerance at both edges (PF) so a target at the mount
 * height passes a 0 degree lower edge.
 * Heights are AGL over a flat plane, both measured from the same ground.
 */
export function sensorGeometryGate(
  spec: SensorSpec,
  sensorHeightM: number,
  targetAltM: number,
  groundM: number,
): GeometryGate {
  return sensorGeometryGateAt(spec, sensorHeightM, targetAltM)(groundM)
}

/**
 * sensorGeometryGate with the ceiling, the radio horizon and the height
 * difference resolved once for one sensor against one target altitude: the
 * gate the sweep tests per member per step.
 */
export function sensorGeometryGateAt(
  spec: SensorSpec,
  sensorHeightM: number,
  targetAltM: number,
): (groundM: number) => GeometryGate {
  const ceiling = ceilingM(spec.maxAltitudeFt)
  if (ceiling != null && targetAltM > ceiling) return () => 'ceiling'
  if (spec.sensorType === 'acoustic') return () => 'ok'
  const horizonM = radioHorizonM(sensorHeightM, targetAltM)
  const el = spec.elevationDeg
  const dAltM = targetAltM - sensorHeightM
  return (groundM) => {
    if (groundM > horizonM) return 'below-horizon'
    if (el) {
      const angle = elevationDeg(groundM, dAltM)
      if (angle < el[0] - EL_EPS_DEG || angle > el[1] + EL_EPS_DEG) return 'elevation'
    }
    return 'ok'
  }
}

/** Effector ceiling gate: 'ceiling' when spec.maxAltitudeFt is recorded and the target is above it. */
export function effectorGeometryGate(spec: EffectorSpec, targetAltM: number): 'ok' | 'ceiling' {
  const ceiling = ceilingM(spec.maxAltitudeFt)
  return ceiling != null && targetAltM > ceiling ? 'ceiling' : 'ok'
}

/**
 * One quoted range (detect or classify) against one target: the target law
 * for the technology, then environment, then the caps. `quotedM` is the
 * placard figure at the reference condition.
 */
function effectiveRangeM(
  spec: SensorSpec,
  quotedM: number,
  env: EnvironmentSpec,
  target: UasSpec | undefined,
): number {
  let r: number
  switch (spec.sensorType) {
    case 'radar':
      r = quotedM * rcsRangeFactor(spec, target) * sensorEnvFactor('radar', env)
      break
    case 'eo-ir':
      r = quotedM * eoRangeFactor(spec, target, env) * sensorEnvFactor('eo-ir', env)
      break
    case 'acoustic':
      r = quotedM * acousticRangeFactor(spec, quotedM, target) * sensorEnvFactor('acoustic', env)
      break
    case 'rf':
      // A vendor-published urban range outranks the generic urban multiplier;
      // the classify figure keeps its ratio to the detect figure.
      r = urbanOverride(spec, env)
        ? quotedM * (spec.urbanRangeM! / spec.detectRangeM) * envFactorImpl('rf', env, false)
        : quotedM * sensorEnvFactor('rf', env)
      break
  }
  return capVisibility(spec, env, capInstrumented(spec, r))
}

/**
 * Detect range against one target after the technology's target law
 * (radar RCS, EO/IR span and thermal class, acoustic source level, RF band
 * coverage handled by the hold gate), environment derates, and the caps
 * (instrumented range, meteorological visibility). Pass no target for the
 * placard range against the reference condition. A sourced-basis radar with
 * a target reads the Pd model: rangeForPd at `pd`, default the placard Pd,
 * so a call with no `pd` returns the fourth-root law. Other technologies
 * and planning-basis radars keep their law and ignore `pd`.
 */
export function effectiveDetectRangeM(
  spec: SensorSpec,
  env: EnvironmentSpec,
  target?: UasSpec,
  pd?: number,
): number {
  if (radarPdModeled(spec, target)) {
    // The placard is one point on the Pd curve; the range at `pd` follows
    // from the calibration. At the placard Pd against a placard-case target
    // this is exactly the fourth-root RCS law.
    const cal = radarCalibration(spec)
    const r = rangeForPd(
      cal,
      rcsM2For(target),
      probabilityOr(pd, cal.pd0),
      sensorEnvFactor('radar', env),
      swerlingFor(target),
    )
    return capInstrumented(spec, r)
  }
  return effectiveRangeM(spec, spec.detectRangeM, env, target)
}

/**
 * Slant ranges of the Pd contours, one per entry of `pds`, capped like
 * effectiveDetectRangeM. Non-radar and planning-basis sensors return the
 * same effective range for every entry.
 */
export function pdContoursM(
  spec: SensorSpec,
  env: EnvironmentSpec,
  target: UasSpec | undefined,
  pds: number[],
): number[] {
  return pds.map((pd) => effectiveDetectRangeM(spec, env, target, pd))
}

/** Classify range under the same effects. Null when the sensor cannot classify. */
export function effectiveClassifyRangeM(
  spec: SensorSpec,
  env: EnvironmentSpec,
  target?: UasSpec,
): number | null {
  if (spec.classifyRangeM == null) return null
  return effectiveRangeM(spec, spec.classifyRangeM, env, target)
}
