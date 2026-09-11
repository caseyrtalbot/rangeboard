import type { Vec2 } from '../model/types'
import { dist, pointInWedge } from '../geometry/geo'
import { slantRangeM } from '../geometry/slant'
import { assessJam, effectiveJamRangeM } from '../analysis/ewPhysics'
import { effectorGeometryGate } from '../analysis/sensorEnv'
import { kineticPk } from './pk'
import type { EffectorState, ThreatState } from './sweepState'
import type { InterceptSource } from './intercept'
import { DT } from './clock'
import { EPS, interceptAt, interceptFor, membersAtTime } from './intercept'
import type { TrackEstimate } from './trackTypes'

/**
 * Shot eligibility for one (effector, threat, ship) at one assignment time.
 * Owns the checks both firing passes in resolveEngagements share: the
 * in-range interval containing t, the predicted intercept (interceptAt), the
 * unreachable rule, effect-time containment, the launcher envelope at the
 * effect point and the jam link. Ranking, saturation, readiness, magazine and
 * BDA stay with the caller.
 */

/** Why a shot was declined, in the order the checks run. */
export type ShotRejection =
  /** The effector has no in-range window against this threat. */
  | 'no-window'
  /** No in-range interval of this effector contains t. */
  | 'outside-interval'
  /** The interceptor cannot reach the credited point (interceptAt.infeasible). */
  | 'unreachable'
  /** The effect time falls outside the in-range window (see `effectContainment`). */
  | 'effect-outside-window'
  /** Ceiling, slant range or sector excludes the effect point. */
  | 'outside-envelope'
  /** Jam physics reach a factor of 0 at the effect point. */
  | 'no-jam-link'

export type ShotIntercept = ReturnType<typeof interceptAt>

export interface ShotAccepted {
  rejected?: undefined
  intercept: ShotIntercept
  /** The in-range interval containing t (the flight cap source). */
  interval: [number, number]
  /**
   * Per-shot Pk at the effect point: kineticPk for a kinetic or beam shot,
   * base Pk times the jam factor (clamped to [0, 1]) for a jammer.
   */
  pk: number
  /**
   * Predicted position 1 sigma at the intercept time, meters, when the
   * intercept was solved from a track estimate; null on the truth path.
   * Phase 3 turns it into a miss distance (pk.missDistanceSigmaM).
   */
  predictionSigmaM: number | null
  /** Which path solved the intercept point (interceptFor). */
  interceptSource: InterceptSource
}

export interface ShotRejected {
  rejected: ShotRejection
}

export interface ShotContext {
  /** Assignment time, seconds. */
  t: number
  /**
   * Which in-range intervals may contain the effect time. 'any': every
   * interval of this effector (the volley pass). 'same': only the interval
   * containing t (the doctrine assignment pass, whose deadline is that
   * interval's end).
   */
  effectContainment: 'any' | 'same'
  /** The sweep's base step, seconds (clock.ts); the intercept slack is one step. Defaults to DT. */
  stepS?: number
  /** Per-tick geometry cache; defaults to a fresh sample. */
  membersAt?: (ts: ThreatState, tS: number) => Vec2[]
  /**
   * The track estimate the shooter holds on this ship at t. Absent, null or
   * a truth-source estimate keeps the truth-path intercept (interceptAt); a
   * Kalman estimate solves the intercept against its predicted path.
   */
  estimate?: TrackEstimate | null
}

/**
 * Per-ship envelope test on slant range from the launcher at the effect
 * point. A jammer's reach is its effective range against this target (as
 * the sim window and the drawn cone use); its cone test takes no ceiling.
 */
function inEnvelope(es: EffectorState, ts: ThreatState, p: Vec2): boolean {
  const isJammer = es.spec.effectorType === 'jammer'
  if (!isJammer && effectorGeometryGate(es.spec, ts.altM) !== 'ok') return false
  const slant = slantRangeM(dist(es.entity.pos, p), ts.altM - es.mountM)
  return (
    slant >= es.spec.minRangeM &&
    slant <= (isJammer ? effectiveJamRangeM(es.spec, ts.uasSpec) : es.spec.maxRangeM) &&
    pointInWedge(es.entity.pos, es.entity.headingDeg, es.spec.sectorDeg ?? 360, p)
  )
}

/** Evaluate one candidate shot; see the module header. */
export function evaluateShot(
  ctx: ShotContext,
  es: EffectorState,
  ts: ThreatState,
  shipIdx: number,
): ShotAccepted | ShotRejected {
  const { t } = ctx
  const intervals = ts.windows.get(es.entity.id)
  if (!intervals) return { rejected: 'no-window' }
  const interval = intervals.find(([s0, s1]) => t >= s0 - EPS && t <= s1 + EPS)
  if (!interval) return { rejected: 'outside-interval' }

  const { predictionSigmaM, interceptSource, ...intercept } = interceptFor(
    ts,
    es,
    t,
    shipIdx,
    ctx.membersAt ?? membersAtTime,
    interval[1],
    ctx.estimate ?? null,
    ctx.stepS ?? DT,
  )
  if (intercept.infeasible) return { rejected: 'unreachable' }

  const tEffect = intercept.tEffectS
  const holds =
    ctx.effectContainment === 'same'
      ? tEffect >= interval[0] - EPS && tEffect <= interval[1] + EPS
      : intervals.some(([s0, s1]) => tEffect >= s0 - EPS && tEffect <= s1 + EPS)
  if (!holds) return { rejected: 'effect-outside-window' }

  if (!inEnvelope(es, ts, intercept.pos)) return { rejected: 'outside-envelope' }

  if (es.spec.effectorType === 'jammer') {
    // Jam Pk is link physics, not aiming: no kinetic penalties apply.
    const factor = assessJam(
      es.spec,
      es.entity.pos,
      es.entity.headingDeg,
      ts.uasSpec,
      intercept.pos,
      ts.altM - es.mountM,
    ).factor
    if (factor <= 0) return { rejected: 'no-jam-link' }
    return {
      intercept,
      interval,
      pk: Math.min(1, Math.max(0, es.pk * factor)),
      predictionSigmaM,
      interceptSource,
    }
  }
  return {
    intercept,
    interval,
    pk: kineticPk(es.pk, es.spec.maxRangeM, ts.uasSpec, intercept.slantM),
    predictionSigmaM,
    interceptSource,
  }
}
