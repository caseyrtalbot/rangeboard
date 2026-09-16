import { describe, expect, it } from 'vitest'
import { defaultEnvironment, emptyScenario } from '../../model/seed'
import type { SensorSpec, UasSpec } from '../../model/types'
import { JOHNSON_CYCLES, eoIfovRadFor, eoIrDriRangesM, eoPixelsOnTarget } from './eoir'

/**
 * VALIDATION AGAINST THE STRONGEST SEEDED EO/IR DATASHEET CASE.
 *
 * HGH's Spynel-S 6000 sheet states a 0.15 x 0.15 mrad IFOV, a MWIR
 * 640 x 512 FPA, and optimal human detection/recognition ranges of 6 km /
 * 2 km. It labels those DRI values as Johnson/STANAG ranges but publishes no
 * identification value. The seed carries detectorPixelsH 512 and fovDeg
 * 4.4 as L1 manufacturer claims; pitch and focal length are L2 inferences,
 * so this check deliberately exercises the L1 FOV/pixel optics pair.
 *
 * The lane contract fixes 1, 4 and 8 cycles across the critical dimension.
 * Johnson's original U.S. Army report gives 1.0 +/- 0.25 cycles for detect,
 * 4.0 +/- 0.8 for recognize, and 6.4 +/- 1.5 for identify; 8 is the rounded
 * conservative upper edge of the identification interval. The DHS SAVER
 * night-vision handbook states that one line pair is two adjacent pixels.
 *
 * Sources, read 2026-09-10:
 * - HGH Spynel-S leaflet SPS-Len-al1, pages 1-2:
 *   https://hgh-infrared.com/wp-content/uploads/2025/11/Leaflet_Spynel_S_HGH_EN.pdf
 * - J. Johnson, Analysis of Image Forming Systems, U.S. Army Engineer
 *   Research and Development Laboratories, 1958, AD 220160, pp. 244-273:
 *   https://home.cis.rit.edu/~cnspci/references/johnson1958.pdf
 * - DHS System Assessment and Validation for Emergency Responders,
 *   Night Vision Technologies Handbook, 2013, section 4.2.2:
 *   https://www.dhs.gov/sites/default/files/publications/NV-Tech-HB_1013-508.pdf
 */

function spynel(): SensorSpec {
  const spec = emptyScenario().library.find((m) => m.id === 'lib-spynel')?.sensor
  if (!spec) throw new Error('seed lib-spynel missing')
  return {
    ...spec,
    // Use only the seed's L1 4.4 degree / 512 pixel optics pair.
    pixelPitchUm: null,
    focalLengthMm: null,
  }
}

/** The sheet's human target: height is the stated critical dimension for this check. */
function human(): UasSpec {
  return {
    group: 1,
    airframe: 'fixed-wing',
    cruiseSpeedMps: 1,
    maxSpeedMps: 1,
    enduranceMin: 1,
    altBandFt: [0, 1],
    navMode: 'inertial',
    emissionsNote: '',
    spanM: 1.8,
    irSignature: 'high',
  }
}

describe('Spynel-S 6000 advertised D/R pair (SPS-Len-al1, read 2026-09-10)', () => {
  it('reproduces detection and pins the recognition ratio mismatch', () => {
    const spec = spynel()
    const clear = { ...defaultEnvironment(), apply: false }
    const ifov = eoIfovRadFor(spec)!
    const dri = eoIrDriRangesM(spec, human(), clear)!

    // L1 fields: 4.4 degrees / 512 = 0.14999 mrad, the sheet's rounded
    // 0.15 mrad IFOV. One cycle is two pixels, so a 1.8 m target gives
    // 1.8 / (2 * IFOV) = 6000.36 m, +0.006 percent from the 6000 m sheet.
    expect(ifov * 1000).toBeCloseTo(0.15, 4)
    expect(Math.abs(dri.detectM / 6000 - 1)).toBeLessThan(0.1)
    expect(dri.detectM / 6000).toBeCloseTo(1.00006, 4)

    // KNOWN DEVIATION: fixed 1/4-cycle Johnson thresholds require a 4:1
    // D/R ratio, while the vendor publishes 3:1. The model therefore gives
    // 1500.09 m, -25.0 percent from the advertised 2000 m. Changing that
    // would change the mandated threshold or invent a task-specific span.
    expect(dri.recognizeM / 2000).toBeCloseTo(0.75005, 4)
    expect(Math.abs(dri.recognizeM / 2000 - 1)).toBeGreaterThan(0.1)
  })

  it('derives the unadvertised identification range only from the 8-cycle criterion', () => {
    const spec = spynel()
    const clear = { ...defaultEnvironment(), apply: false }
    const dri = eoIrDriRangesM(spec, human(), clear)!
    const ifov = eoIfovRadFor(spec)!

    // Analytic only: 1.8 / (2 * 8 * IFOV) = 750.05 m. HGH publishes no
    // identification number, so this assertion does not label 750 m a
    // vendor value or compare it to an invented one.
    expect(dri.identifyM).toBeCloseTo(750.05, 1)
    expect(eoPixelsOnTarget(1.8, dri.identifyM, ifov)).toBeCloseTo(2 * JOHNSON_CYCLES.identify, 10)
  })
})
