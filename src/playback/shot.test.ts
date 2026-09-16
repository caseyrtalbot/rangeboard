import { describe, expect, it } from 'vitest'
import type { EffectorSpec, UasSpec } from '../model/types'
import { defaultEnvironment } from '../model/seed'
import type { EffectorState, ThreatState } from './sweepState'
import type { TrackEstimate } from './trackTypes'
import { ZERO_COVARIANCE } from './kalman'
import { kineticPk } from './pk'
import { beamEffect } from './pk/beam'
import type { ShotContext } from './shot'
import { evaluateShot } from './shot'

const INTERCEPTOR = {
  effectorType: 'interceptor',
  minRangeM: 0,
  maxRangeM: 10000,
  engageTimeS: 5,
  flyoutSpeedMps: 100,
} as EffectorSpec
/** The Iron Beam calibration optics (directedEnergy.ts) with a 12 km envelope. */
const OPTICAL = {
  effectorType: 'de',
  minRangeM: 0,
  maxRangeM: 12000,
  engageTimeS: 5,
  sectorDeg: 360,
  outputPowerKw: 100,
  beamQualityM2: 2,
  apertureM: 0.3,
  jitterUrad: 10,
} as EffectorSpec
const QUAD = { navMode: 'gps', group: 1, airframe: 'quad' } as UasSpec

/**
 * Launcher at the origin heading north, one stationary ship 7 km east at
 * launcher height: release at t + 5, 100 s of flight at 0.7 of 100 m/s, so
 * a shot assigned at t = 10 lands at 115 s (see intercept.test.ts).
 */
function states(
  spec: EffectorSpec,
  windows: Array<[number, number]>,
  uasSpec?: UasSpec,
): { ts: ThreatState; es: EffectorState } {
  const ts = {
    a: { uasId: 'uas' },
    altM: 4,
    uasSpec,
    windows: new Map([['eff', windows]]),
  } as ThreatState
  const es = {
    entity: { id: 'eff', pos: { x: 0, y: 0 }, headingDeg: 0 },
    spec,
    mountM: 4,
    pk: 0.8,
    engageTimeS: 5,
    cooldownS: 10,
  } as EffectorState
  return { ts, es }
}
const stationary = () => [{ x: 7000, y: 0 }]
const ctx = (effectContainment: ShotContext['effectContainment'] = 'any'): ShotContext => ({
  t: 10,
  effectContainment,
  membersAt: stationary,
})

describe('evaluateShot', () => {
  it('accepts a reachable shot inside the window and envelope with the kinetic Pk', () => {
    const { ts, es } = states(INTERCEPTOR, [[0, 200]])
    const shot = evaluateShot(ctx(), es, ts, 0)
    expect(shot.rejected).toBeUndefined()
    if (shot.rejected) return
    expect(shot.intercept.tEffectS).toBeCloseTo(115, 9)
    expect(shot.intercept.capped).toBe(false)
    expect(shot.interval).toEqual([0, 200])
    expect(shot.pk).toBeCloseTo(kineticPk(0.8, 10000, undefined, 7000), 12)
    // Today's path solves the intercept from truth: no prediction error.
    expect(shot.predictionSigmaM).toBeNull()
    expect(shot.interceptSource).toBe('truth')
  })

  it('solves the intercept from a track estimate when the context carries one', () => {
    const { ts, es } = states(INTERCEPTOR, [[0, 200]])
    // Closing at 30 m/s from 7000 m at t = 10: release position 6850, tau =
    // 6850 / 100 = 68.5 s, point 4795 m at 83.5 s (see intercept.test.ts).
    const estimate: TrackEstimate = {
      id: 'trk',
      uasId: 'u1',
      sensorIds: ['s1'],
      covariance: ZERO_COVARIANCE,
      state: { x: 7000, y: 0, vx: -30, vy: 0, tS: 10 },
      quality: 1,
      hits: 1,
      misses: 0,
      coasting: false,
      source: 'estimate',
    }
    const shot = evaluateShot({ ...ctx(), estimate }, es, ts, 0)
    expect(shot.rejected).toBeUndefined()
    if (shot.rejected) return
    expect(shot.interceptSource).toBe('estimate')
    expect(shot.intercept.tEffectS).toBeCloseTo(83.5, 9)
    expect(shot.intercept.pos.x).toBeCloseTo(4795, 9)
    expect(shot.pk).toBeCloseTo(kineticPk(0.8, 10000, undefined, 4795), 12)
    // Zero covariance at t = 10 grows by the process noise alone over the
    // 73.5 s lead: sqrt(q * 73.5^3 / 3) with q = 1.
    expect(shot.predictionSigmaM).toBeCloseTo(Math.sqrt(73.5 ** 3 / 3), 6)
    // A truth-source estimate keeps the truth path.
    const truth = evaluateShot({ ...ctx(), estimate: { ...estimate, source: 'truth' } }, es, ts, 0)
    if (truth.rejected) throw new Error(truth.rejected)
    expect(truth.interceptSource).toBe('truth')
    expect(truth.predictionSigmaM).toBeNull()
    expect(truth.intercept.tEffectS).toBeCloseTo(115, 9)
  })

  it('rejects a threat with no window for this effector', () => {
    const { ts, es } = states(INTERCEPTOR, [[0, 200]])
    ts.windows = new Map()
    expect(evaluateShot(ctx(), es, ts, 0)).toEqual({ rejected: 'no-window' })
  })

  it('rejects an assignment time outside every in-range interval', () => {
    const { ts, es } = states(INTERCEPTOR, [[200, 300]])
    expect(evaluateShot(ctx(), es, ts, 0)).toEqual({ rejected: 'outside-interval' })
  })

  it('rejects an interceptor that cannot reach the capped point (unreachable rule)', () => {
    // Cap at 50 s: 35 s of flight covers 2450 m, the ship sits 7000 m out.
    const { ts, es } = states(INTERCEPTOR, [[0, 50]])
    expect(evaluateShot(ctx(), es, ts, 0)).toEqual({ rejected: 'unreachable' })
  })

  it('applies the effect containment mode of each firing pass', () => {
    // Release at 15 s is past the 12 s cap: no cap, the effect lands at 115 s.
    const gap = states(INTERCEPTOR, [
      [0, 12],
      [300, 400],
    ])
    expect(evaluateShot(ctx('any'), gap.es, gap.ts, 0)).toEqual({
      rejected: 'effect-outside-window',
    })
    // The volley pass takes any interval containing the effect; the doctrine
    // pass needs the interval containing t, whose end is its deadline.
    const later = states(INTERCEPTOR, [
      [0, 12],
      [100, 200],
    ])
    const any = evaluateShot(ctx('any'), later.es, later.ts, 0)
    expect(any.rejected).toBeUndefined()
    if (!any.rejected) expect(any.interval).toEqual([0, 12])
    expect(evaluateShot(ctx('same'), later.es, later.ts, 0)).toEqual({
      rejected: 'effect-outside-window',
    })
  })

  it('rejects an effect point outside the launcher envelope', () => {
    const short = states({ ...INTERCEPTOR, maxRangeM: 6000 }, [[0, 200]])
    expect(evaluateShot(ctx(), short.es, short.ts, 0)).toEqual({ rejected: 'outside-envelope' })
    // A 90 degree sector on a north heading excludes a target due east.
    const wedge = states({ ...INTERCEPTOR, sectorDeg: 90 }, [[0, 200]])
    expect(evaluateShot(ctx(), wedge.es, wedge.ts, 0)).toEqual({ rejected: 'outside-envelope' })
    // A recorded ceiling below the target.
    const low = states({ ...INTERCEPTOR, maxAltitudeFt: 5 }, [[0, 200]])
    expect(evaluateShot(ctx(), low.es, low.ts, 0)).toEqual({ rejected: 'outside-envelope' })
  })

  it('rejects a jammer whose link physics do not close, and scales jam Pk by the factor', () => {
    const jammer = {
      effectorType: 'jammer',
      minRangeM: 0,
      maxRangeM: 10000,
      engageTimeS: 5,
      jamBands: ['ism-2400'],
    } as EffectorSpec
    const gps = { navMode: 'gps', group: 2, airframe: 'quad' } as UasSpec
    const miss = states(jammer, [[0, 200]], gps)
    expect(evaluateShot(ctx(), miss.es, miss.ts, 0)).toEqual({ rejected: 'no-jam-link' })
    const hit = states({ ...jammer, jamBands: ['gnss'] }, [[0, 200]], gps)
    const shot = evaluateShot(ctx(), hit.es, hit.ts, 0)
    expect(shot.rejected).toBeUndefined()
    if (shot.rejected) return
    // No flyout for a beam: the effect lands at release.
    expect(shot.intercept.tEffectS).toBe(15)
    expect(shot.pk).toBeGreaterThan(0)
    expect(shot.pk).toBeLessThan(0.8)
  })

  it('uses the optical dwell as effect timing and preserves the independent fluence draw', () => {
    const { ts, es } = states(OPTICAL, [[0, 30]], QUAD)
    const draws: Array<[string, string, number, number]> = []
    const shot = evaluateShot(
      {
        ...ctx(),
        membersAt: () => [{ x: 10000, y: 0 }],
        legacyBeamPk: false,
        environment: {
          ...defaultEnvironment(),
          apply: true,
          visibilityM: 20000,
          precipitation: 'clear',
        },
        beamFluenceDraw: (effectorId, uasId, shipIdx, tS) => {
          draws.push([effectorId, uasId, shipIdx, tS])
          return 0.5
        },
      },
      es,
      ts,
      0,
    )
    if (shot.rejected) throw new Error(shot.rejected)
    expect(draws).toEqual([['eff', ts.a.uasId, 0, 10]])
    expect(shot.dwellS).toBeCloseTo(2, 9)
    expect(shot.releaseDelayS).toBeCloseTo(1, 9)
    expect(shot.intercept.tEffectS).toBeCloseTo(13, 9)
    expect(shot.pk).toBe(0.8)
  })

  /**
   * CR-01: a target closing at 50 m/s from 10 km, held at 100 m. The dwell
   * falls with range faster than the effect delay grows, so the plain fixed
   * point oscillates between a near-instant effect at 100 m and a 10 km
   * dwell of minutes. The accepted answer must satisfy the model's own
   * equation: the dwell at the credited range is the credited dwell.
   */
  const approach = (_ts: ThreatState, tS: number) => [{ x: Math.max(100, 10000 - 50 * tS), y: 0 }]
  const opticalCtx = (visibilityM: number): ShotContext => ({
    t: 0,
    effectContainment: 'any',
    membersAt: approach,
    legacyBeamPk: false,
    environment: { ...defaultEnvironment(), apply: true, visibilityM },
  })
  /** The dwell the beam model itself gives at the credited range. */
  const dwellAtRange = (ctx: ShotContext, es: EffectorState, slantM: number) =>
    beamEffect(es.pk, es.spec, QUAD, slantM, ctx.environment!, {
      fallback: false,
      legacyCooldownS: es.cooldownS,
    }).dwellS

  it('solves the optical dwell of an approaching target to a self-consistent effect point', () => {
    const { ts, es } = states(OPTICAL, [[0, 200]], QUAD)
    const ctx5km = opticalCtx(5000)
    const shot = evaluateShot(ctx5km, es, ts, 0)
    if (shot.rejected) throw new Error(shot.rejected)
    const d = shot.intercept.tEffectS
    // Delay, dwell and position agree with one another and with the beam
    // model at the credited range, to 1e-4 s.
    expect(shot.intercept.pos.x).toBeCloseTo(10000 - 50 * d, 6)
    expect(Math.abs(shot.releaseDelayS + shot.dwellS - d)).toBeLessThan(1e-4)
    expect(Math.abs(dwellAtRange(ctx5km, es, shot.intercept.slantM) - shot.dwellS)).toBeLessThan(
      1e-4,
    )
    // Tens of seconds of dwell at 7.4 km, never the 100 m near-instant effect.
    expect(shot.dwellS).toBeGreaterThan(40)
    expect(shot.dwellS).toBeLessThan(60)
    expect(shot.pk).toBe(0.8)
  })

  it('solves a low-visibility dwell inside the window and declines one that ends outside it', () => {
    // 1 km visibility: the beam only bites inside about 2.4 km, so the
    // effect lands near 153 s. The 100 s window cannot contain it.
    const { ts, es } = states(OPTICAL, [[0, 200]], QUAD)
    const ctx1km = opticalCtx(1000)
    const shot = evaluateShot(ctx1km, es, ts, 0)
    if (shot.rejected) throw new Error(shot.rejected)
    const d = shot.intercept.tEffectS
    expect(d).toBeGreaterThan(150)
    expect(d).toBeLessThan(160)
    expect(shot.intercept.pos.x).toBeCloseTo(10000 - 50 * d, 6)
    expect(Math.abs(shot.releaseDelayS + shot.dwellS - d)).toBeLessThan(1e-4)
    expect(Math.abs(dwellAtRange(ctx1km, es, shot.intercept.slantM) - shot.dwellS)).toBeLessThan(
      1e-4,
    )
    const short = states(OPTICAL, [[0, 100]], QUAD)
    expect(evaluateShot(ctx1km, short.es, short.ts, 0)).toEqual({ rejected: 'no-dwell-solution' })
  })

  it('uses HPM field and recharge at the final target angle', () => {
    const hpm = {
      effectorType: 'hpm',
      minRangeM: 0,
      maxRangeM: 10000,
      engageTimeS: 5,
      sectorDeg: 360,
      fieldStrengthVm: 200,
      fieldStrengthRangeM: 1000,
      beamwidthDeg: 30,
      rechargeS: 3,
    } as EffectorSpec
    const quad = { navMode: 'gps', group: 1, airframe: 'quad' } as UasSpec
    const { ts, es } = states(hpm, [[0, 30]], quad)
    const base = { ...ctx(), legacyBeamPk: false, environment: defaultEnvironment() }
    const outside = evaluateShot(base, es, ts, 0)
    if (outside.rejected) throw new Error(outside.rejected)
    expect(outside.pk).toBe(0)
    es.entity.headingDeg = 90
    const inside = evaluateShot(base, es, ts, 0)
    if (inside.rejected) throw new Error(inside.rejected)
    expect(inside.pk).toBe(0.8)
    expect(inside.cooldownS).toBe(3)
    expect(inside.intercept.tEffectS).toBe(15)
  })
})
