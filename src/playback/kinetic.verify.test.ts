import { describe, expect, it } from 'vitest'
import type { EffectorSpec, UasSpec } from '../model/types'
import { createSweepClock } from './clock'
import { lastProjectileEffectS, projectileBurstDurationS, projectileSpacingS } from './ballistics'
import { kineticEffectProbability } from './pk/kinetic'

/**
 * VALIDATION SOURCES (read 2026-09-10)
 *
 * - Eglin AFB, "New laser-guided rocket capability tested": the APKWS M151
 *   warhead has a 10 m burst radius.
 *   https://www.eglin.af.mil/News/Article/962547/new-laser-guided-rocket-capability-tested/
 * - NIST Dataplot Rayleigh PDF: radial error from two equal independent
 *   normal axes is Rayleigh; integrating the density gives
 *   F(r) = 1 - exp(-r^2 / (2 sigma^2)).
 *   https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/raypdf.htm
 * - Rheinmetall Oerlikon Skyranger 30 brochure: nominal rate 1,200 rounds/min
 *   and muzzle velocity 1,050 m/s.
 *   https://www.rheinmetall.com/Rheinmetall%20Group/brochure-download/Air-Defence/B327e0823-Oerlikon-Skyranger.pdf
 * - NASA Glenn ballistic-flight equations: with drag ignored, horizontal
 *   velocity is constant and distance is velocity times time.
 *   https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ballistic-flight-equations/
 */

const APKWS = {
  effectorType: 'interceptor',
  minRangeM: 0,
  maxRangeM: 10000,
  engageTimeS: 0,
  // The physical miss model requires a cruise speed; the table itself is the Rayleigh CDF.
  flyoutSpeedMps: 739,
  lethalRadiusM: 10,
  guidanceNoiseM: 1,
} as EffectorSpec

const GROUP_4 = {
  group: 4,
  airframe: 'fixed-wing',
  cruiseSpeedMps: 40,
  maxSpeedMps: 60,
  enduranceMin: 60,
  altBandFt: [0, 5000],
  navMode: 'gps',
  emissionsNote: '',
} as UasSpec

describe('interceptor-miss datasheet validation', () => {
  it.each([
    // sigma 1 m: 1 - exp(-10^2 / (2 * 1^2)) = 1 - exp(-50).
    [1, 1 - Math.exp(-50)],
    // sigma 5 m: 1 - exp(-10^2 / (2 * 5^2)) = 1 - exp(-2).
    [5, 0.8646647167633873],
    // sigma 10 m: 1 - exp(-10^2 / (2 * 10^2)) = 1 - exp(-0.5).
    [10, 0.3934693402873666],
  ])('reproduces the 10 m effective-radius table at sigma %s m', (sigmaM, expected) => {
    const predictionSigmaM = Math.sqrt(Math.max(0, sigmaM * sigmaM - 1))
    expect(
      kineticEffectProbability(APKWS, {
        basePk: 1,
        uas: GROUP_4,
        slantM: 1000,
        predictionSigmaM,
        fallback: false,
      }),
    ).toBeCloseTo(expected, 12)
  })
})

describe('gun-burst datasheet and timeline validation', () => {
  const gun = {
    effectorType: 'gun',
    minRangeM: 0,
    maxRangeM: 3000,
    engageTimeS: 0,
    dispersionMils: 1,
    fireControlErrorMils: 1,
    burstRounds: 20,
    rateOfFireRpm: 1200,
    muzzleVelocityMps: 1050,
  } as EffectorSpec

  it('matches a hand-derived 20-projectile burst and last-projectile effect time', () => {
    // 1200 projectiles/min / 60 = 20/s, so spacing is 0.05 s and 20 cyclic
    // slots occupy 1.0 s. At 1050 m, drag-free TOF is 1050 / 1050 = 1.0 s.
    // Commit 10 + burst 1 + TOF 1 = last-projectile effect at 12 s.
    expect(projectileSpacingS(1200)).toBe(0.05)
    expect(projectileBurstDurationS(gun)).toBe(1)
    expect(lastProjectileEffectS(10, 1050, gun)).toBe(12)
  })

  it('samples the one-second burst at the requested 0.1 s engine step', () => {
    const clock = createSweepClock(0.5, 10)
    clock.requestFineStep('gun-1', 10, 10 + projectileBurstDurationS(gun)!, 0.1)
    const rounded = clock.samples(11).map((t) => Math.round(t * 10) / 10)
    expect(rounded).toEqual([10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 11])
  })
})
