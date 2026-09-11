import type { EnvironmentSpec, SensorSpec, UasSpec } from '../model/types'
import { rcsM2For, swerlingFor } from '../model/rcsFactors'
import { rangeForPd } from './radarPd'
import { envFactorImpl, probabilityOr, sensorEnvFactor } from './sensorEnv/common'
import { capInstrumented, radarCalibration, radarPdModeled, rcsRangeFactor } from './sensorEnv/radar'
import { capVisibility, eoIrNeedsCue, eoRangeFactor } from './sensorEnv/eoir'
import { acousticRangeFactor } from './sensorEnv/acoustic'
import { rfCanHear, rfDetectable, urbanOverride } from './sensorEnv/rf'

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
 * This file is the barrel: the per-technology laws live in
 * sensorEnv/radar.ts, eoir.ts, acoustic.ts and rf.ts, the shared terms in
 * sensorEnv/common.ts. Every name below stays importable from here; the
 * per-type dispatch (effective ranges, the hold gate) is defined here because
 * it reads every technology.
 */
export {
  FT_TO_M,
  SENSOR_ENV_MODEL,
  effectorGeometryGate,
  sensorEnvFactor,
  sensorGeometryGate,
  sensorGeometryGateAt,
  targetScaled,
} from './sensorEnv/common'
export type { GeometryGate } from './sensorEnv/common'
export {
  instrumentedM,
  radarCalibration,
  radarPdAt,
  radarPdCurve,
  radarPdModeled,
  rcsRangeFactor,
  refRcsM2For,
} from './sensorEnv/radar'
export {
  NIGHT_VISIBLE_FACTOR,
  VISIBILITY_BY_PRECIP,
  eoIrNeedsCue,
  eoRangeFactor,
  refSpanMFor,
  visibilityMFor,
} from './sensorEnv/eoir'
export { ALPHA_DB_PER_KM, acousticSolveM, refAcousticDbFor } from './sensorEnv/acoustic'
export { jammable, rfCanHear, rfDetectable, rfSensorBands } from './sensorEnv/rf'

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
