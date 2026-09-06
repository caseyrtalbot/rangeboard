import type { EffectorSpec, FireDoctrine, Vec2 } from '../model/types'
import { bearingDeg, dist, posAtTime } from '../geometry/geo'
import { slantRangeM } from '../geometry/slant'
import { memberPositions } from './tracks'
import { expenditureChannel } from './pk'
import type { EffectorState, ThreatState } from './sweepState'
import { DT } from './clock'

/** Time tolerance for interval and release comparisons, seconds. */
export const EPS = 1e-9

/** Index of the interval containing t, or -1 (none, or intervals unknown). */
export function intervalIndexAt(
  intervals: Array<[number, number]> | undefined,
  t: number,
): number {
  if (!intervals) return -1
  for (let i = 0; i < intervals.length; i++) {
    const [s0, s1] = intervals[i]
    if (t >= s0 - EPS && t <= s1 + EPS) return i
  }
  return -1
}

/**
 * Average flyout speed as a fraction of the stated speed (PF). Every stated
 * flyoutSpeedMps is a maximum or a muzzle velocity, not the mean speed to the
 * target, so the flight time is charged at this fraction of it.
 */
export const FLYOUT_SPEED_FACTOR = 0.7

/**
 * Average flyout speed in m/s (the stated speed times FLYOUT_SPEED_FACTOR);
 * 0 when the effector states no speed. A jammer, DE or HPM effect arrives
 * with the beam: no flyout even if a speed is stored.
 */
export function averageFlyoutMps(spec: EffectorSpec): number {
  const v = spec.flyoutSpeedMps
  if (v == null || !(v > 0) || expenditureChannel(spec.effectorType) !== 'kinetic') return 0
  return v * FLYOUT_SPEED_FACTOR
}

/** Seconds of flight to a slant range at the average flyout speed; 0 when there is no flyout. */
export function timeOfFlightS(spec: EffectorSpec, slantM: number): number {
  const v = averageFlyoutMps(spec)
  return v > 0 ? slantM / v : 0
}

/** Formation member positions of a threat at one sim time. */
export function membersAtTime(ts: ThreatState, tS: number): Vec2[] {
  const s = posAtTime(ts.path!.points, ts.speedMps, ts.delayS, tS)
  return memberPositions(ts.entity, s.pos, s.headingDeg)
}

/**
 * Smallest tau at or after tau0 (and at or before tau1) with
 * |C + B tau|^2 + dAlt^2 = (v tau)^2: the interceptor, flying the slant at
 * constant v from tau 0, meets a target moving at constant velocity B from
 * position C at tau 0. Null when no such tau exists in the range.
 */
function meetTau(
  C: Vec2,
  B: Vec2,
  dAltM: number,
  v: number,
  tau0: number,
  tau1: number,
): number | null {
  const a = B.x * B.x + B.y * B.y - v * v
  const b = 2 * (C.x * B.x + C.y * B.y)
  const c = C.x * C.x + C.y * C.y + dAltM * dAltM
  const roots: number[] = []
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) roots.push(-c / b)
  } else {
    const disc = b * b - 4 * a * c
    if (disc < 0) return null
    const sq = Math.sqrt(disc)
    roots.push((-b - sq) / (2 * a), (-b + sq) / (2 * a))
  }
  let best: number | null = null
  for (const r of roots) {
    if (r < tau0 - EPS || r > tau1 + EPS) continue
    if (best == null || r < best) best = r
  }
  return best == null ? null : Math.max(best, tau0)
}

/**
 * Exact constant-speed flight time from `releaseS` to the ship: the
 * target flies its path at ts.speedMps after ts.delayS, holding the first
 * point before the delay and the last point after the path ends, and on each
 * straight segment its formation member moves at constant velocity, so the
 * meeting time is the smallest root of a quadratic per phase, taken in time
 * order. Null only when no phase yields a meeting (a path that never ends).
 */
function analyticTofS(
  ts: ThreatState,
  es: EffectorState,
  releaseS: number,
  memberIdx: number,
  dAltM: number,
): number | null {
  const v = averageFlyoutMps(es.spec)
  const pts = ts.path!.points
  const u = ts.speedMps
  const L = es.entity.pos
  const offsetAt = (headingDeg: number): Vec2 => {
    const ms = memberPositions(ts.entity, { x: 0, y: 0 }, headingDeg)
    return ms[Math.min(memberIdx, ms.length - 1)]
  }
  // Relative position of the member when the entity is at `pos` with `heading`.
  const rel = (pos: Vec2, headingDeg: number): Vec2 => {
    const o = offsetAt(headingDeg)
    return { x: pos.x + o.x - L.x, y: pos.y + o.y - L.y }
  }
  const still = (P: Vec2, tau0: number, tau1: number) =>
    meetTau(P, { x: 0, y: 0 }, dAltM, v, tau0, tau1)
  const heading0 = bearingDeg(pts[0], pts[1])
  const INF = Number.POSITIVE_INFINITY
  // Before the delay the target holds the first point.
  if (releaseS < ts.delayS) {
    const tau = still(rel(pts[0], heading0), 0, ts.delayS - releaseS)
    if (tau != null) return tau
  }
  let tStart = ts.delayS
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const seg = dist(a, b)
    if (seg === 0) continue
    const tEnd = tStart + seg / u
    if (tEnd > releaseS) {
      const heading = bearingDeg(a, b)
      const B = { x: ((b.x - a.x) / seg) * u, y: ((b.y - a.y) / seg) * u }
      const A = rel(a, heading) // member position at tStart
      const tau0 = Math.max(0, tStart - releaseS)
      // Position at release-relative tau: A + B (tau - (tStart - releaseS)).
      const shift = tStart - releaseS
      const C = { x: A.x - B.x * shift, y: A.y - B.y * shift }
      const tau = meetTau(C, B, dAltM, v, tau0, tEnd - releaseS)
      if (tau != null) return tau
    }
    tStart = tEnd
  }
  // After the path ends the target holds the last point with the last heading.
  const last = pts[pts.length - 1]
  const headingEnd = bearingDeg(pts[pts.length - 2], last)
  return still(rel(last, headingEnd), Math.max(0, tStart - releaseS), INF)
}

/**
 * Predicted intercept for one ship: the target position at tS + engageTimeS + timeOfFlight,
 * with the flight time the exact constant-speed meeting time along the path
 * (analyticTofS). The returned position and slant are sampled at the returned
 * tEffectS. With no stated speed the flight time is 0 and the result is the position at
 * tS + engageTimeS. `membersAt` lets the sweep supply its per-tick geometry cache; the
 * default samples the path. `capS` is the end of the in-range interval that contains tS: a
 * flight past the cap is held at the cap, sampled there, and reported `capped`.
 * Only the flight is capped: a release at or before the cap with a flight past it; a
 * release after the cap is not. `infeasible` is true when the interceptor cannot
 * be at the credited point when the effect is credited: the slant to the sampled point
 * exceeds the reach `v * (tEffectS - release)` by more than one DT of flight, `v * DT`,
 * which after the exact solution happens only at a cap or when no meeting exists; the
 * caller declines an infeasible shot. Never true without a flyout.
 */
export function interceptAt(
  ts: ThreatState,
  es: EffectorState,
  tS: number,
  memberIdx: number,
  membersAt: (ts: ThreatState, tS: number) => Vec2[] = membersAtTime,
  capS = Number.POSITIVE_INFINITY,
): { pos: Vec2; slantM: number; tEffectS: number; capped: boolean; infeasible: boolean } {
  const dAltM = ts.altM - es.mountM
  const sampleAt = (tEffectS: number) => {
    const members = membersAt(ts, tEffectS)
    const pos = members[Math.min(memberIdx, members.length - 1)]
    return { pos, slantM: slantRangeM(dist(es.entity.pos, pos), dAltM) }
  }
  const releaseS = tS + es.engageTimeS
  const v = averageFlyoutMps(es.spec)
  // Without a stated speed there is no flight, so the flyout-free arithmetic is unchanged.
  // A ship with no path (or no speed) is stationary where the sampler puts it.
  const moving = ts.path != null && ts.path.points.length >= 2 && ts.speedMps > 0
  const tofS =
    v <= 0
      ? 0
      : moving
        ? analyticTofS(ts, es, releaseS, memberIdx, dAltM)
        : sampleAt(releaseS).slantM / v
  if (tofS == null) {
    // No meeting on a path that never ends: credit nothing, decline.
    const tEffectS = Number.isFinite(capS) && releaseS <= capS ? capS : releaseS
    return { ...sampleAt(tEffectS), tEffectS, capped: false, infeasible: true }
  }
  // The geometry is sampled at the returned time. The cap trims the flight
  // only: a release (tS + engageTimeS) already past the window end is not a
  // flight to cap.
  const capped = releaseS <= capS && releaseS + tofS > capS
  const tEffectS = capped ? capS : releaseS + tofS
  const at = sampleAt(tEffectS)
  const infeasible = v > 0 && at.slantM > v * (tEffectS - releaseS) + v * DT
  return { ...at, tEffectS, capped, infeasible }
}

/**
 * Launch-point policy test for one candidate shot, evaluated at the effect
 * point. True when the policy volunteers the shot now; the caller still fires
 * at the deadline when this is false. 'latest' never volunteers.
 */
export function launchPolicyReleases(
  doctrine: FireDoctrine,
  pk: number,
  commitPk: number,
  interceptDistM: number,
  maxRangeM: number,
): boolean {
  switch (doctrine.launchPolicy) {
    case 'max-range':
      return true
    case 'range-fraction':
      return interceptDistM <= doctrine.launchRangeFraction * maxRangeM + EPS
    case 'pk-commit':
      return pk >= commitPk - EPS
    case 'latest':
      return false
    default:
      return true
  }
}
