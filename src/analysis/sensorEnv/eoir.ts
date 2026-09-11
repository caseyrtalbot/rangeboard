import type { EnvironmentSpec, Precipitation, SensorRole, SensorSpec, UasSpec } from '../../model/types'
import { defaultSensorRole } from '../../model/types'
import { EO_REF_SPAN_M, IR_SIGNATURE_FACTOR, irSignatureFor, spanMFor } from '../../model/signatureFactors'
import { targetScaled } from './common'

/**
 * EO/IR target law, night and visibility rules, and the cue rule. The spec
 * range is quoted against a reference span; the range against another
 * target is linear in the span ratio (Johnson criteria), the thermal channel
 * carries a contrast class, and no contrast survives beyond the
 * meteorological visibility (Koschmieder). Lane 3.3 adds the Johnson
 * criteria per band from pixel pitch and focal length and the Beer-Lambert
 * extinction here.
 */

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
export function capVisibility(spec: SensorSpec, env: EnvironmentSpec, rangeM: number): number {
  if (spec.sensorType !== 'eo-ir' || !env.apply) return rangeM
  return Math.min(rangeM, visibilityMFor(env))
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
