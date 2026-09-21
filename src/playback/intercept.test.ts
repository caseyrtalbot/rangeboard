import { describe, expect, it } from 'vitest'
import layeredFixture from './__fixtures__/layered-acoustic-merops.json'
import { parseAutosave } from '../io/persist'
import type { EffectorSpec, Entity, FlightPath } from '../model/types'
import { DEFAULT_FIRE_DOCTRINE } from '../model/types'
import type { EffectorState, ThreatState } from './sweepState'
import type { Covariance4, TrackEstimate, TrackSource } from './trackTypes'
import { positionSigmaM, PROCESS_NOISE_Q, ZERO_COVARIANCE } from './kalman'
import {
  interceptAt,
  interceptFor,
  interceptorDistanceM,
  interceptorFlightTimeS,
  intervalIndexAt,
  launchPolicyReleases,
  predictedStateAt,
  predictionSigmaAtS,
} from './intercept'
import { kineticPk } from './pk'
import { kineticEffectProbability } from './pk/kinetic'

const INTERCEPTOR = {
  effectorType: 'interceptor',
  minRangeM: 0,
  maxRangeM: 10000,
  engageTimeS: 5,
  flyoutSpeedMps: 100,
} as EffectorSpec

/** Launcher at the origin, one stationary ship 7 km east at launcher height. */
function states(spec: EffectorSpec): { ts: ThreatState; es: EffectorState } {
  const ts = { altM: 4 } as ThreatState
  const es = { entity: { pos: { x: 0, y: 0 } }, spec, mountM: 4, engageTimeS: 5 } as EffectorState
  return { ts, es }
}
const stationary = () => [{ x: 7000, y: 0 }]

/** A track estimate at (x, y) with velocity (vx, vy) stamped at tS. */
function estimate(
  state: TrackEstimate['state'],
  covariance: Covariance4 = ZERO_COVARIANCE,
  source: TrackSource = 'estimate',
): TrackEstimate {
  return {
    id: 'trk',
    uasId: 'u1',
    sensorIds: ['s1'],
    state,
    covariance,
    quality: 1,
    hits: 1,
    misses: 0,
    coasting: false,
    source,
  }
}

/** Diagonal covariance: `pos` m^2 on x and y, `vel` (m/s)^2 on vx and vy. */
function diagCov(pos: number, vel: number): Covariance4 {
  const c = new Array<number>(16).fill(0)
  c[0] = pos
  c[5] = pos
  c[10] = vel
  c[15] = vel
  return c
}

describe('intercept kinematics', () => {
  it('interceptAt charges the flyout at 0.7 of the stated speed and holds a flight at the cap', () => {
    const { ts, es } = states(INTERCEPTOR)
    // 7000 m / (100 m/s * 0.7) = 100 s of flight after the 5 s release.
    const ic = interceptAt(ts, es, 10, 0, stationary)
    expect(ic.slantM).toBeCloseTo(7000, 9)
    expect(ic.tEffectS).toBeCloseTo(115, 9)
    expect(ic.capped).toBe(false)
    const capped = interceptAt(ts, es, 10, 0, stationary, 50)
    expect(capped.tEffectS).toBe(50)
    expect(capped.capped).toBe(true)
    // A release after the cap is not a flight to cap.
    expect(interceptAt(ts, es, 60, 0, stationary, 50).capped).toBe(false)
    // A jammer effect arrives with the beam: no flyout.
    const jam = states({ ...INTERCEPTOR, effectorType: 'jammer' })
    expect(interceptAt(jam.ts, jam.es, 10, 0, stationary).tEffectS).toBe(15)
  })

  it('interceptAt solves the fallback flyout against the sampled limited flight', () => {
    // CR-04: the target starts 1000 m east and flies to the launcher at a
    // requested 20 m/s with 1 m/s2 of acceleration, so it has covered
    // 0.5 t^2 m at t (it is still accelerating at the meeting). The flyout
    // charges 0.7 * 100 = 70 m/s from the origin with no engagement delay.
    // Constant-speed timing solves 70 t = 1000 - 20 t, t = 11.111 s, and then
    // samples the target 938.272 m out: past the flyout, so the old code
    // declined the shot. The accelerated meeting is 0.5 t^2 + 70 t = 1000,
    // t = 13.066 s at 914.637 m, which the flyout reaches.
    const points = [
      { x: 1000, y: 0 },
      { x: 0, y: 0 },
    ]
    const flownM = (tS: number) => {
      const t = Math.max(0, tS)
      // Requested speed 20 m/s at 1 m/s2: 20 s of acceleration, then cruise.
      const d = t <= 20 ? 0.5 * t * t : 200 + 20 * (t - 20)
      return Math.min(1000, d)
    }
    const ts = {
      entity: {} as Entity,
      altM: 4,
      path: { points } as FlightPath,
      sampleFlightAt: (tS: number) => ({ pos: { x: 1000 - flownM(tS), y: 0 }, headingDeg: 270 }),
      speedMps: 20,
      delayS: 0,
    } as ThreatState
    const es = {
      entity: { pos: { x: 0, y: 0 } },
      spec: INTERCEPTOR,
      mountM: 4,
      engageTimeS: 0,
    } as EffectorState
    const ic = interceptAt(ts, es, 0, 0)
    expect(ic.tEffectS).toBeCloseTo(13.066238629, 6)
    expect(ic.slantM).toBeCloseTo(914.636704, 6)
    expect(ic.pos.x).toBeCloseTo(914.636704, 6)
    expect(ic.capped).toBe(false)
    expect(ic.infeasible).toBe(false)
  })

  it('interceptFor with no estimate or a truth-source estimate is interceptAt exactly', () => {
    const { ts, es } = states(INTERCEPTOR)
    const truth = interceptAt(ts, es, 10, 0, stationary, 50)
    const truthEstimate = estimate(
      { x: 7000, y: 0, vx: 0, vy: 0, tS: 10 },
      ZERO_COVARIANCE,
      'truth',
    )
    for (const e of [null, truthEstimate]) {
      const { predictionSigmaM, interceptSource, ...rest } = interceptFor(
        ts,
        es,
        10,
        0,
        stationary,
        50,
        e,
      )
      expect(rest).toEqual(truth)
      expect(predictionSigmaM).toBeNull()
      expect(interceptSource).toBe('truth')
    }
  })

  it('interceptFor with an estimate solves the closed-form intercept on the predicted path', () => {
    const { ts, es } = states(INTERCEPTOR)
    // Estimate at t = 10 with the truth position and velocity: release at 15,
    // C = (7000, 0), B = 0, v = 70 m/s, so tau = 7000 / 70 = 100 s and the
    // point is the truth point (7000, 0) at 115 s.
    const still = interceptFor(
      ts,
      es,
      10,
      0,
      stationary,
      Infinity,
      estimate({ x: 7000, y: 0, vx: 0, vy: 0, tS: 10 }),
    )
    expect(still.interceptSource).toBe('estimate')
    expect(still.tEffectS).toBeCloseTo(115, 9)
    expect(still.pos.x).toBeCloseTo(7000, 9)
    expect(still.pos.y).toBeCloseTo(0, 9)
    expect(still.capped).toBe(false)
    expect(still.infeasible).toBe(false)
    // Velocity delta of -30 m/s along x (closing). At release (15 s) the
    // predicted x is 7000 - 30 * 5 = 6850. The meeting solves
    // 6850 - 30 tau = 70 tau, so tau = 68.5 s and tEffect = 83.5 s. The
    // predicted point is the release position plus delta times the time of
    // flight: 6850 + (-30)(68.5) = 4795, which is 7000 + (-30)(5 + 68.5) =
    // 7000 - 2205 from the zero-velocity point.
    const delta = -30
    const closing = interceptFor(
      ts,
      es,
      10,
      0,
      stationary,
      Infinity,
      estimate({ x: 7000, y: 0, vx: delta, vy: 0, tS: 10 }),
    )
    const tof = closing.tEffectS - 15
    expect(tof).toBeCloseTo(68.5, 9)
    expect(closing.pos.x).toBeCloseTo(6850 + delta * tof, 9)
    expect(closing.pos.x).toBeCloseTo(still.pos.x + delta * (5 + tof), 9)
    expect(closing.pos.x).toBeCloseTo(4795, 9)
    expect(closing.slantM).toBeCloseTo(4795, 9)
    // A flight past the cap is held at the cap and is unreachable (7000 m at 35 s of 70 m/s).
    const capped = interceptFor(
      ts,
      es,
      10,
      0,
      stationary,
      50,
      estimate({ x: 7000, y: 0, vx: 0, vy: 0, tS: 10 }),
    )
    expect(capped.tEffectS).toBe(50)
    expect(capped.capped).toBe(true)
    expect(capped.infeasible).toBe(true)
  })

  it('predictedStateAt grows the position covariance with the lead time', () => {
    // var 100 m^2 on position, 1 (m/s)^2 on velocity, 10 s lead. Per axis
    // var(x) = 100 + 1 * 10^2 + q * 10^3 / 3 with q = PROCESS_NOISE_Q = 1:
    // 100 + 100 + 333.333 = 533.333, so the 1 sigma is sqrt(533.333) = 23.094.
    // The cross term is T * var(v) + q * T^2 / 2 = 10 + 50 = 60.
    const e = estimate({ x: 7000, y: 0, vx: 0, vy: 0, tS: 0 }, diagCov(100, 1))
    const p = predictedStateAt(e, 10)
    const q3 = (PROCESS_NOISE_Q * 10 ** 3) / 3
    expect(p.cov[0]).toBeCloseTo(100 + 1 * 10 ** 2 + q3, 9)
    expect(p.cov[5]).toBeCloseTo(100 + 1 * 10 ** 2 + q3, 9)
    expect(p.cov[2]).toBeCloseTo(10 + (PROCESS_NOISE_Q * 10 ** 2) / 2, 9)
    expect(positionSigmaM(p.cov)).toBeCloseTo(Math.sqrt(100 + 1 * 10 ** 2 + 1000 / 3), 9)
    expect(positionSigmaM(p.cov)).toBeCloseTo(23.094, 3)
    // Zero lead returns the estimate unchanged.
    expect(predictedStateAt(e, 0).cov).toEqual(diagCov(100, 1))
    // At the intercept the same covariance has grown for the 105 s lead
    // (5 s engage + 100 s flight): 100 + 105^2 + 105^3 / 3 = 397000 m^2.
    const { ts, es } = states(INTERCEPTOR)
    const ic = interceptFor(
      ts,
      es,
      10,
      0,
      stationary,
      Infinity,
      estimate({ x: 7000, y: 0, vx: 0, vy: 0, tS: 10 }, diagCov(100, 1)),
    )
    expect(ic.tEffectS).toBeCloseTo(115, 9)
    expect(ic.predictionSigmaM).toBeCloseTo(Math.sqrt(100 + 105 ** 2 + 105 ** 3 / 3), 6)
    expect(ic.predictionSigmaM).toBeCloseTo(Math.sqrt(397000), 6)
  })

  it('launchPolicyReleases volunteers per policy; latest never does', () => {
    const d = DEFAULT_FIRE_DOCTRINE
    expect(launchPolicyReleases({ ...d, launchPolicy: 'max-range' }, 0, 1, 9000, 10000)).toBe(true)
    const rf = { ...d, launchPolicy: 'range-fraction' as const, launchRangeFraction: 0.5 }
    expect(launchPolicyReleases(rf, 0, 1, 5000, 10000)).toBe(true)
    expect(launchPolicyReleases(rf, 0, 1, 5001, 10000)).toBe(false)
    expect(launchPolicyReleases({ ...d, launchPolicy: 'pk-commit' }, 0.35, 0.35, 0, 1)).toBe(true)
    expect(launchPolicyReleases({ ...d, launchPolicy: 'pk-commit' }, 0.3, 0.35, 0, 1)).toBe(false)
    expect(launchPolicyReleases({ ...d, launchPolicy: 'latest' }, 1, 0, 0, 1)).toBe(false)
  })

  it('intervalIndexAt finds the inclusive interval within the time tolerance', () => {
    expect(intervalIndexAt(undefined, 5)).toBe(-1)
    const windows: Array<[number, number]> = [
      [0, 10],
      [20, 30],
    ]
    expect(intervalIndexAt(windows, 5)).toBe(0)
    expect(intervalIndexAt(windows, 10 + 1e-10)).toBe(0)
    expect(intervalIndexAt(windows, 15)).toBe(-1)
    expect(intervalIndexAt(windows, 25)).toBe(1)
  })
})

describe('Phase 3 kinetic flight', () => {
  const PROFILED = {
    ...INTERCEPTOR,
    flyoutSpeedMps: 50,
    maxFlyoutSpeedMps: 100,
    boostTimeS: 2,
    lethalRadiusM: 10,
    guidanceNoiseM: 1,
    seekerAcquisitionRangeM: 100,
  } as EffectorSpec

  it('accelerates linearly to peak speed, then cruises at flyoutSpeedMps', () => {
    // a = 100 / 2 = 50 m/s2: distance at burnout is 0.5 * 50 * 2^2 = 100 m.
    // Another 100 m at the 50 m/s cruise takes 2 s, total 4 s.
    expect(interceptorDistanceM(PROFILED, 1)).toBeCloseTo(25, 12)
    expect(interceptorDistanceM(PROFILED, 2)).toBeCloseTo(100, 12)
    expect(interceptorDistanceM(PROFILED, 4)).toBeCloseTo(200, 12)
    expect(interceptorFlightTimeS(PROFILED, 200)).toBeCloseTo(4, 12)
  })

  it('uses the profile on truth and estimate paths only when the caller enables it', () => {
    const { ts, es } = states(PROFILED)
    const point = () => [{ x: 200, y: 0 }]
    // Assignment 0 + engage 5 + profiled flight 4 = effect 9.
    const truth = interceptAt(ts, es, 0, 0, point, Infinity, 0.5, { fallback: false })
    expect(truth.tEffectS).toBeCloseTo(9, 12)
    const tracked = interceptFor(
      ts,
      es,
      0,
      0,
      point,
      Infinity,
      estimate({ x: 200, y: 0, vx: 0, vy: 0, tS: 0 }),
      0.5,
      { fallback: false },
    )
    expect(tracked.tEffectS).toBeCloseTo(9, 12)
    expect(tracked.interceptSource).toBe('estimate')

    // Explicit fallback preserves the old 0.7 * 50 m/s constant-speed path.
    const fallback = interceptAt(ts, es, 0, 0, point, Infinity, 0.5, { fallback: true })
    expect(fallback.tEffectS).toBeCloseTo(5 + 200 / 35, 12)
  })

  it('exposes the track prediction sigma at physical release for kinetic P(effect)', () => {
    const e = estimate({ x: 0, y: 0, vx: 0, vy: 0, tS: 0 }, diagCov(100, 0))
    // CWNA position variance after 3 s: 100 + q * dt^3 / 3, q = 1.
    expect(predictionSigmaAtS(e, 3)).toBeCloseTo(Math.sqrt(109), 12)
    expect(predictionSigmaAtS({ ...e, source: 'truth' }, 3)).toBeNull()
  })

  it('is not both on the physical miss model and at zero flight time', () => {
    const spec = {
      effectorType: 'interceptor',
      minRangeM: 0,
      maxRangeM: 10000,
      engageTimeS: 0,
      lethalRadiusM: 10,
      guidanceNoiseM: 2,
    } as EffectorSpec
    const context = {
      basePk: 0.85,
      uas: undefined,
      slantM: 1000,
      predictionSigmaM: 8,
      fallback: false,
    }
    const legacy = kineticPk(context.basePk, spec.maxRangeM, undefined, context.slantM)
    // No cruise speed: the profile does not fly, and Pk stays on the legacy curve.
    expect(interceptorFlightTimeS(spec, 1000)).toBeNull()
    expect(kineticEffectProbability(spec, context)).toBe(legacy)
    expect(kineticEffectProbability({ ...spec, flyoutSpeedMps: null }, context)).toBe(legacy)

    const flying = { ...spec, flyoutSpeedMps: 154 }
    expect(interceptorFlightTimeS(flying, 1000)).toBeGreaterThan(0)
    expect(kineticEffectProbability(flying, context)).not.toBe(legacy)
  })

  it('loads the layered fixture as a real flight or an explicit legacy Pk', () => {
    const scenario = parseAutosave(JSON.stringify(layeredFixture))
    delete scenario.physics
    expect(scenario.library.find((m) => m.id === 'lib-coyote')?.effector?.flyoutSpeedMps).toBe(154)
    expect(scenario.library.find((m) => m.id === 'lib-merops')?.effector?.flyoutSpeedMps).toBe(78)
    for (const model of scenario.library) {
      const spec = model.effector
      if (spec?.effectorType !== 'interceptor') continue
      const context = {
        basePk: spec.pk ?? 0.8,
        uas: undefined,
        slantM: 1000,
        predictionSigmaM: 8,
        fallback: false,
      }
      const legacy = kineticPk(context.basePk, spec.maxRangeM, undefined, context.slantM)
      const physical = kineticEffectProbability(spec, context) !== legacy
      const zeroFlight = interceptorFlightTimeS(spec, 1000) == null
      expect(physical && zeroFlight).toBe(false)
    }
  })

  it('uses flyoutSpeedMps directly when either profile field is null', () => {
    const spec = { ...PROFILED, boostTimeS: null } as EffectorSpec
    expect(interceptorFlightTimeS(spec, 200)).toBeCloseTo(4, 12)
  })

  it('rejects a capped flight when terminal seeker acquisition falls after its end', () => {
    const spec = {
      ...PROFILED,
      flyoutSpeedMps: 100,
      maxFlyoutSpeedMps: null,
      boostTimeS: null,
    } as EffectorSpec
    const { ts, es } = states(spec)
    const ic = interceptAt(ts, es, 0, 0, () => [{ x: 700, y: 0 }], 10, 2, {
      fallback: false,
    })
    // Release 5, cap 10: 500 m flown. One-step reach tolerance admits the
    // 700 m intercept, but acquisition needs 600 m, so the terminal gate rejects it.
    expect(ic.capped).toBe(true)
    expect(ic.infeasible).toBe(true)
  })

  it('places one gun event at the effect of the last projectile', () => {
    const gun = {
      effectorType: 'gun',
      minRangeM: 0,
      maxRangeM: 3000,
      engageTimeS: 5,
      flyoutSpeedMps: 1000,
      muzzleVelocityMps: 1000,
      dispersionMils: 1,
      fireControlErrorMils: 1,
      burstRounds: 20,
      rateOfFireRpm: 1200,
    } as EffectorSpec
    const { ts, es } = states(gun)
    // Release 5 + burst 1 + drag-free 1000 m / 1000 m/s = effect 7.
    const ic = interceptAt(ts, es, 0, 0, () => [{ x: 1000, y: 0 }], Infinity, 0.5, {
      fallback: false,
    })
    expect(ic.tEffectS).toBeCloseTo(7, 12)
  })
})
