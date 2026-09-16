import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { limitedPosAtTime } from './flight'

/**
 * VALIDATION AGAINST A PUBLIC DATASHEET.
 *
 * Source: DJI Mavic 3 Classic specifications,
 * https://www.dji.com/mavic-3-classic/specs, read 2026-09-10 (the date and
 * URL carried by data/library/uas/mavic3.json). DJI states a 35 degree
 * maximum tilt angle and an 8 m/s maximum ascent speed for the same
 * airframe. The seed derives maxAccelMps2 from the tilt as g tan(theta),
 * rounded to 6.9 m/s2. FlightPath has no altitude profile, so the sourced
 * climb value remains a recorded, unused limit and no climb is invented.
 */
describe('DJI Mavic 3 Classic flight figure (read 2026-09-10)', () => {
  it('the acceleration used by the point-mass model reproduces the published max tilt', () => {
    const scenario = emptyScenario()
    const spec = scenario.library.find((m) => m.id === 'lib-mavic3')?.uas
    if (!spec) throw new Error('seed lib-mavic3 missing')
    expect(spec.maxAccelMps2).toBe(6.9)
    expect(spec.climbRateMps).toBe(8)

    // Straight east, starting from rest. At t=1 s the model distance is
    // d = 0.5*a*t2 = 3.45 m, so a = 2d/t2 = 6.9 m/s2.
    const sample = limitedPosAtTime(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
      spec.cruiseSpeedMps,
      0,
      1,
      spec,
      { ...scenario.environment, apply: false },
    )
    const modeledAccelMps2 = 2 * sample.pos.x
    expect(modeledAccelMps2).toBeCloseTo(6.9, 12)

    // Invert a = g tan(theta): atan(6.9 / 9.81) = 35.11 deg. The 0.2 deg
    // tolerance covers the seed's one-decimal acceleration rounding.
    const modeledTiltDeg = (Math.atan(modeledAccelMps2 / 9.81) * 180) / Math.PI
    expect(Math.abs(modeledTiltDeg - 35)).toBeLessThan(0.2)
  })
})
