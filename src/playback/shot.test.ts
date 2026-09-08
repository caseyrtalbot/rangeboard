import { describe, expect, it } from 'vitest'
import type { EffectorSpec, UasSpec } from '../model/types'
import type { EffectorState, ThreatState } from './sweepState'
import { kineticPk } from './pk'
import type { ShotContext } from './shot'
import { evaluateShot } from './shot'

const INTERCEPTOR = {
  effectorType: 'interceptor', minRangeM: 0, maxRangeM: 10000, engageTimeS: 5, flyoutSpeedMps: 100,
} as EffectorSpec

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
  const ts = { altM: 4, uasSpec, windows: new Map([['eff', windows]]) } as ThreatState
  const es = {
    entity: { id: 'eff', pos: { x: 0, y: 0 }, headingDeg: 0 },
    spec,
    mountM: 4,
    pk: 0.8,
    engageTimeS: 5,
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
    const gap = states(INTERCEPTOR, [[0, 12], [300, 400]])
    expect(evaluateShot(ctx('any'), gap.es, gap.ts, 0)).toEqual({ rejected: 'effect-outside-window' })
    // The volley pass takes any interval containing the effect; the doctrine
    // pass needs the interval containing t, whose end is its deadline.
    const later = states(INTERCEPTOR, [[0, 12], [100, 200]])
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
      effectorType: 'jammer', minRangeM: 0, maxRangeM: 10000, engageTimeS: 5, jamBands: ['ism-2400'],
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
})
