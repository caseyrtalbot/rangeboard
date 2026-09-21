import { describe, expect, it } from 'vitest'
import type { EffectorSpec, UasSpec } from '../model/types'
import { ZERO_COVARIANCE } from './kalman'
import { predictionSigmaAtS } from './intercept'
import { kineticEffectProbability } from './pk/kinetic'
import type { ShotAccepted, ShotContext } from './shot'
import { evaluateShot } from './shot'
import type { EffectorState, ThreatState } from './sweepState'
import type { TrackEstimate } from './trackTypes'

/**
 * The kinetic miss uses the engine's own predictionSigmaAtS. engageTimeS is
 * the assignment-to-release delay and must not enter that call. The horizon
 * is the flight, max(0, tEffectS - releaseS), measured from the estimate time.
 * kinetic.verify.test.ts feeds hand-supplied sigmas and does not cover this.
 */

const T_S = 20
const ESTIMATE_TS = 5
const FLIGHT_RANGE_M = 1000
const CRUISE_MPS = 100

const QUAD = { navMode: 'gps', group: 1, airframe: 'quad' } as UasSpec

function interceptor(engageTimeS: number): EffectorSpec {
  return {
    effectorType: 'interceptor',
    minRangeM: 0,
    maxRangeM: 10000,
    engageTimeS,
    flyoutSpeedMps: CRUISE_MPS,
    lethalRadiusM: 10,
    guidanceNoiseM: 2,
  } as EffectorSpec
}

function estimate(x = FLIGHT_RANGE_M): TrackEstimate {
  return {
    id: 'trk',
    uasId: 'u1',
    sensorIds: ['s1'],
    covariance: ZERO_COVARIANCE,
    state: { x, y: 0, vx: 0, vy: 0, tS: ESTIMATE_TS },
    quality: 1,
    hits: 1,
    misses: 0,
    coasting: false,
    source: 'estimate',
  }
}

function accepted(engageTimeS: number, rangeM: number): ShotAccepted {
  const spec = interceptor(engageTimeS)
  const ts = {
    a: { uasId: 'uas' },
    altM: 0,
    uasSpec: QUAD,
    windows: new Map<string, Array<[number, number]>>([['eff', [[0, 500]]]]),
  } as ThreatState
  const es = {
    entity: { id: 'eff', pos: { x: 0, y: 0 }, headingDeg: 0 },
    spec,
    mountM: 0,
    pk: 0.85,
    engageTimeS,
    cooldownS: 10,
  } as EffectorState
  const ctx: ShotContext = {
    t: T_S,
    effectContainment: 'any',
    membersAt: () => [{ x: rangeM, y: 0 }],
    estimate: estimate(rangeM),
    legacyKineticPk: false,
  }
  const shot = evaluateShot(ctx, es, ts, 0)
  if (shot.rejected) throw new Error(shot.rejected)
  return shot
}

function pkAt(shot: ShotAccepted, predictionSigmaM: number | null): number {
  return kineticEffectProbability(interceptor(shot.releaseDelayS), {
    basePk: 0.85,
    uas: QUAD,
    slantM: shot.intercept.slantM,
    predictionSigmaM,
    fallback: false,
  })
}

describe('kinetic flight horizon', () => {
  it('keeps a long engageTimeS out of predictionSigmaAtS', () => {
    const est = estimate()
    const delayed = accepted(60, FLIGHT_RANGE_M)
    const prompt = accepted(0, FLIGHT_RANGE_M)
    const delayedFlightS = Math.max(0, delayed.intercept.tEffectS - (T_S + delayed.releaseDelayS))
    const promptFlightS = Math.max(0, prompt.intercept.tEffectS - (T_S + prompt.releaseDelayS))
    // Stationary ship, constant cruise: the flight does not depend on the delay.
    expect(delayedFlightS).toBeCloseTo(FLIGHT_RANGE_M / CRUISE_MPS, 9)
    expect(promptFlightS).toBeCloseTo(delayedFlightS, 9)
    expect(delayed.releaseDelayS).toBeGreaterThan(delayedFlightS)
    expect(delayed.pk).toBeCloseTo(prompt.pk, 12)

    const flightSigma = predictionSigmaAtS(est, est.state.tS + delayedFlightS)
    const delaySigma = predictionSigmaAtS(est, T_S + delayed.releaseDelayS)
    const fromAssignment = predictionSigmaAtS(est, T_S + delayedFlightS)
    expect(flightSigma).not.toBeNull()
    expect(delaySigma).not.toBeCloseTo(flightSigma!, 6)
    expect(fromAssignment).not.toBeCloseTo(flightSigma!, 6)
    expect(delayed.pk).toBeCloseTo(pkAt(delayed, flightSigma), 12)
    expect(delayed.pk).not.toBeCloseTo(pkAt(delayed, delaySigma), 6)
  })

  it('uses a zero horizon when release and effect coincide', () => {
    const est = estimate(0)
    const shot = accepted(60, 0)
    const flightS = Math.max(0, shot.intercept.tEffectS - (T_S + shot.releaseDelayS))
    expect(flightS).toBe(0)
    const atEstimate = predictionSigmaAtS(est, est.state.tS + flightS)
    const acrossDelay = predictionSigmaAtS(est, T_S + shot.releaseDelayS)
    expect(atEstimate).toBe(0)
    expect(acrossDelay).toBeGreaterThan(100)
    expect(shot.pk).toBeCloseTo(pkAt(shot, atEstimate), 12)
    expect(shot.pk).not.toBeCloseTo(pkAt(shot, acrossDelay), 6)
  })
})
