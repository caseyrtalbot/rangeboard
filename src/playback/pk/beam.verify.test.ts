import { describe, expect, it } from 'vitest'
import { SEED_LIBRARY } from '../../model/seed'
import type { EnvironmentSpec } from '../../model/types'
import { opticalDwellAt } from '../directedEnergy'
import { hpmThresholdRangeM } from '../hpm'

const QUOTED_CLEAR_AIR: EnvironmentSpec = {
  windSpeedMps: 0,
  windFromDeg: 0,
  temperatureC: 15,
  fieldElevationFt: 0,
  precipitation: 'clear',
  light: 'day',
  emBackground: 'rural',
  visibilityM: 20_000,
  apply: true,
}

describe('beam model verification', () => {
  it('reproduces the Iron Beam two-second anchor at its quoted 10 km condition', () => {
    const spec = SEED_LIBRARY.find((model) => model.id === 'lib-ironbeam')!.effector!
    const target = SEED_LIBRARY.find((model) => model.id === 'lib-mavic3')!.uas!
    const answer = opticalDwellAt(spec, target, 10_000, QUOTED_CLEAR_AIR, null)!

    // Hand computation:
    // r_diff = 1.22 * 1070e-9 * 10000 * 2 / 0.3 = 0.0870266667 m
    // r_jitter = 10000 * 10e-6 = 0.1 m
    // r = hypot(r_diff, r_jitter) = 0.1325656091 m
    // A = pi r^2 = 0.05520922055 m2
    // T = exp(-3.912 * 10000 / 20000) = 0.14142298298
    // I = 100000 * T / A = 256158.26769 W/m2
    // calibrated H = I * 2 s = 512316.53537 J/m2; therefore dwell = 2 s.
    expect(answer.spot.diffractionRadiusM).toBeCloseTo(0.08702666666666665, 12)
    expect(answer.spot.radiusM).toBeCloseTo(0.1325656090813568, 12)
    expect(answer.spot.areaM2).toBeCloseTo(0.055209220554853174, 12)
    expect(answer.transmission).toBeCloseTo(0.14142298297609007, 12)
    expect(answer.irradianceWm2).toBeCloseTo(256158.2676857014, 8)
    expect(answer.fluenceThresholdJm2).toBeCloseTo(512316.5353714028, 7)
    expect(answer.dwellS).toBeCloseTo(2, 12)
    expect(answer.effectDelayS).toBeCloseTo(3, 12)
  })

  it('reproduces the hand-derived RF-field threshold ring', () => {
    const spec = {
      effectorType: 'hpm' as const,
      minRangeM: 0,
      maxRangeM: 4000,
      engageTimeS: 1,
      fieldStrengthVm: 200,
      fieldStrengthRangeM: 100,
      beamwidthDeg: 60,
    }
    const target = SEED_LIBRARY.find((model) => model.id === 'lib-mavic3')!.uas!
    // E(R) = 200 V/m * 100 m / R. A quad threshold of 20 V/m
    // is met at R = 200 * 100 / 20 = 1000 m.
    expect(hpmThresholdRangeM(spec, target)).toBe(1000)
  })
})
