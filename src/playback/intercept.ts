import type { EffectorSpec, FireDoctrine, Vec2 } from '../model/types'
import { dist, posAtTime } from '../geometry/geo'
import { slantRangeM } from '../geometry/slant'
import { memberPositions } from './tracks'
import { expenditureChannel } from './pk'
import type { EffectorState, ThreatState } from './sweepState'

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
 * Seconds of flight to a slant range at the average flyout speed (the stated
 * speed times FLYOUT_SPEED_FACTOR); 0 when the effector states no speed.
 */
export function timeOfFlightS(spec: EffectorSpec, slantM: number): number {
  const v = spec.flyoutSpeedMps
  // A jammer, DE or HPM effect arrives with the beam: no flyout even if a speed is stored.
  if (v == null || !(v > 0) || expenditureChannel(spec.effectorType) !== 'kinetic') return 0
  return slantM / (v * FLYOUT_SPEED_FACTOR)
}

/** Formation member positions of a threat at one sim time. */
export function membersAtTime(ts: ThreatState, tS: number): Vec2[] {
  const s = posAtTime(ts.path!.points, ts.speedMps, ts.delayS, tS)
  return memberPositions(ts.entity, s.pos, s.headingDeg)
}

/**
 * Predicted intercept for one ship: the target position at tS + engageTimeS + timeOfFlight,
 * solved by three fixed-point passes (flight time from the slant at the previous pass).
 * The returned position and slant are sampled at the returned tEffectS. With no stated
 * speed the flight time is 0 and the result is the position at tS + engageTimeS.
 * `membersAt` lets the sweep supply its per-tick geometry cache; the default samples the path.
 * `capS` is the end of the in-range interval that contains tS: a target faster than the
 * interceptor recedes and the passes never close, so a flight past the cap is held at
 * the cap, sampled there, and reported `capped` (R-F-7). Only the flight is capped: a
 * release at or before the cap with a flight past it; a release after the cap is not.
 */
export function interceptAt(
  ts: ThreatState,
  es: EffectorState,
  tS: number,
  memberIdx: number,
  membersAt: (ts: ThreatState, tS: number) => Vec2[] = membersAtTime,
  capS = Number.POSITIVE_INFINITY,
): { pos: Vec2; slantM: number; tEffectS: number; capped: boolean } {
  const dAltM = ts.altM - es.mountM
  const sampleAt = (tEffectS: number) => {
    const members = membersAt(ts, tEffectS)
    const pos = members[Math.min(memberIdx, members.length - 1)]
    return { pos, slantM: slantRangeM(dist(es.entity.pos, pos), dAltM) }
  }
  let tofS = 0
  for (let pass = 0; pass < 3; pass++) {
    const next = timeOfFlightS(es.spec, sampleAt(tS + es.engageTimeS + tofS).slantM)
    if (next === tofS) break
    tofS = next
  }
  // The geometry is sampled at the returned time, so the last update is kept.
  // The cap trims the flight only: a release (tS + engageTimeS) already past
  // the window end is not a flight to cap, and without a stated speed there
  // is no flight, so the flyout-free arithmetic is unchanged.
  const releaseS = tS + es.engageTimeS
  const capped = releaseS <= capS && releaseS + tofS > capS
  const tEffectS = capped ? capS : releaseS + tofS
  return { ...sampleAt(tEffectS), tEffectS, capped }
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
