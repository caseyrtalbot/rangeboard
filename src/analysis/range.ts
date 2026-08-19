import type { EnvironmentSpec, UasSpec, Vec2 } from '../model/types'
import { bearingDeg, destination, dist } from '../geometry/geo'

/**
 * UAS range estimation with environmental covariates.
 * Model: an employment radius in calm air (combat-observed when known, else
 * spec, else endurance x speed) converts to an endurance budget, which the
 * environment derates (cold, density altitude). Wind reshapes the reachable
 * area per bearing: one-way systems stretch downwind; return-to-home systems
 * shrink symmetrically because the return leg fights the wind.
 */

/**
 * Planning coefficients from open-source research (2026-08): DJI cold-weather
 * guidance and winter-ops reporting anchor 1.8%/degC endurance loss below
 * 15 C (floor 0.5 for pre-warmed packs); multirotor high-altitude studies give
 * 2.5%/1000 ft above 2000 ft (floor 0.6); hot derate is an estimate, published
 * data is sparse. Wind uses the standard head/tailwind component model; DJI
 * Level 5 wind resistance is ~12 m/s for Group 1 quads.
 */
export const ENV_MODEL = {
  temperature: { refC: 15, pctPerDegBelowRef: 1.8, floorFactor: 0.5, hotRefC: 35, hotDeratePct: 0.5 },
  densityAltitude: { refFt: 2000, pctPer1000FtAboveRef: 2.5, floorFactor: 0.6 },
  wind: { maxOperatableWindMps: 12 },
  source: 'researched 2026-08, representative planning values',
}

export type RangeSource = 'combat' | 'spec' | 'estimated'

export interface RangeBasis {
  /** Calm-air employment radius before environmental derates, meters. */
  radiusM: number
  oneWay: boolean
  source: RangeSource
  /** True when the covariate derate applies (battery-powered airframes). */
  batteryPowered: boolean
}

export function isOneWay(uas: UasSpec): boolean {
  return uas.oneWay ?? (uas.airframe === 'one-way-attack' || uas.airframe === 'fpv')
}

export function rangeBasis(uas: UasSpec): RangeBasis {
  const oneWay = isOneWay(uas)
  const batteryPowered = uas.airframe === 'quad' || uas.airframe === 'fpv' || uas.airframe === 'vtol'
  if (uas.combatRadiusM != null && uas.combatRadiusM > 0) {
    return { radiusM: uas.combatRadiusM, oneWay, source: 'combat', batteryPowered }
  }
  if (uas.operatingRadiusM != null && uas.operatingRadiusM > 0) {
    return { radiusM: uas.operatingRadiusM, oneWay, source: 'spec', batteryPowered }
  }
  const full = uas.enduranceMin * 60 * uas.cruiseSpeedMps
  return { radiusM: oneWay ? full : full / 2, oneWay, source: 'estimated', batteryPowered }
}

/** Endurance multiplier from temperature and field elevation, [floor, 1]. */
export function enduranceDerate(env: EnvironmentSpec, batteryPowered: boolean): number {
  if (!env.apply || !batteryPowered) return 1
  const t = ENV_MODEL.temperature
  let tempFactor = 1
  if (env.temperatureC < t.refC) {
    tempFactor = 1 - ((t.refC - env.temperatureC) * t.pctPerDegBelowRef) / 100
  } else if (env.temperatureC > t.hotRefC) {
    tempFactor = 1 - ((env.temperatureC - t.hotRefC) * t.hotDeratePct) / 100
  }
  tempFactor = Math.max(t.floorFactor, tempFactor)
  const a = ENV_MODEL.densityAltitude
  let altFactor = 1
  if (env.fieldElevationFt > a.refFt) {
    altFactor = 1 - (((env.fieldElevationFt - a.refFt) / 1000) * a.pctPer1000FtAboveRef) / 100
  }
  altFactor = Math.max(a.floorFactor, altFactor)
  return tempFactor * altFactor
}

/** Tailwind component (positive) along a travel bearing, m/s. */
export function windComponentMps(env: EnvironmentSpec, travelBearingDeg: number): number {
  if (!env.apply || env.windSpeedMps === 0) return 0
  const windToDeg = env.windFromDeg + 180
  const rad = ((travelBearingDeg - windToDeg) * Math.PI) / 180
  return env.windSpeedMps * Math.cos(rad)
}

/** Ground speed along a bearing, floored at 10% of airspeed (cannot go negative). */
function groundSpeed(airSpeedMps: number, env: EnvironmentSpec, bearing: number): number {
  return Math.max(0.1 * airSpeedMps, airSpeedMps + windComponentMps(env, bearing))
}

/**
 * Reachable radius along one bearing, meters.
 * One-way: r = T * groundSpeed(bearing).
 * Return-to-home: r = T * (Va^2 - w^2) / (2 Va), symmetric in wind.
 */
export function effectiveRadiusM(uas: UasSpec, env: EnvironmentSpec, bearing: number): number {
  const basis = rangeBasis(uas)
  const va = Math.max(1, uas.cruiseSpeedMps)
  const enduranceS = (basis.oneWay ? basis.radiusM / va : (2 * basis.radiusM) / va)
  const tS = enduranceS * enduranceDerate(env, basis.batteryPowered)
  if (basis.oneWay) return tS * groundSpeed(va, env, bearing)
  const w = Math.min(va * 0.95, Math.abs(windComponentMps(env, bearing)))
  return (tS * (va * va - w * w)) / (2 * va)
}

/** Flat [x0,y0,...] closed polygon of the reachable area around a launch point. */
export function rangeCurvePoints(
  uas: UasSpec,
  env: EnvironmentSpec,
  launch: Vec2,
  steps = 72,
): number[] {
  const pts: number[] = []
  for (let i = 0; i < steps; i++) {
    const b = (360 * i) / steps
    const p = destination(launch, b, effectiveRadiusM(uas, env, b))
    pts.push(p.x, p.y)
  }
  return pts
}

/**
 * Point along a flight path where the endurance budget runs out, or null when
 * the whole path is flyable. Wind speeds/slows each leg by its bearing.
 */
export function pathExhaustionPoint(
  points: Vec2[],
  flownSpeedMps: number,
  uas: UasSpec,
  env: EnvironmentSpec,
): { pos: Vec2; distM: number } | null {
  if (points.length < 2) return null
  const basis = rangeBasis(uas)
  const va = Math.max(1, uas.cruiseSpeedMps)
  const enduranceS =
    (basis.oneWay ? basis.radiusM / va : (2 * basis.radiusM) / va) *
    enduranceDerate(env, basis.batteryPowered)
  let remainingS = enduranceS
  let distM = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const segLen = dist(a, b)
    if (segLen === 0) continue
    const gs = groundSpeed(flownSpeedMps, env, bearingDeg(a, b))
    const segTime = segLen / gs
    if (segTime >= remainingS) {
      const frac = remainingS / segTime
      return {
        pos: { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac },
        distM: distM + segLen * frac,
      }
    }
    remainingS -= segTime
    distM += segLen
  }
  return null
}
