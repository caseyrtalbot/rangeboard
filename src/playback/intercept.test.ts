import { describe, expect, it } from 'vitest'
import type { EffectorSpec } from '../model/types'
import { DEFAULT_FIRE_DOCTRINE } from '../model/types'
import type { EffectorState, ThreatState } from './sweepState'
import { interceptAt, intervalIndexAt, launchPolicyReleases } from './intercept'

const INTERCEPTOR = {
  effectorType: 'interceptor', minRangeM: 0, maxRangeM: 10000, engageTimeS: 5, flyoutSpeedMps: 100,
} as EffectorSpec

/** Launcher at the origin, one stationary ship 7 km east at launcher height. */
function states(spec: EffectorSpec): { ts: ThreatState; es: EffectorState } {
  const ts = { altM: 4 } as ThreatState
  const es = { entity: { pos: { x: 0, y: 0 } }, spec, mountM: 4, engageTimeS: 5 } as EffectorState
  return { ts, es }
}
const stationary = () => [{ x: 7000, y: 0 }]

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
    const windows: Array<[number, number]> = [[0, 10], [20, 30]]
    expect(intervalIndexAt(windows, 5)).toBe(0)
    expect(intervalIndexAt(windows, 10 + 1e-10)).toBe(0)
    expect(intervalIndexAt(windows, 15)).toBe(-1)
    expect(intervalIndexAt(windows, 25)).toBe(1)
  })
})
