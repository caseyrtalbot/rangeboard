import { describe, expect, it } from 'vitest'
import { SEED_LIBRARY } from '../model/seed'
import type { SensorSpec, UasSpec } from '../model/types'
import { linkBudgetRangeM, receivedPowerDbm } from './rfLink'

/**
 * VALIDATION AGAINST PUBLIC DATASHEETS.
 *
 * The free-space link budget is checked at vendor RF-detection ranges using
 * the unmodified seed sensitivity and a target UAS with manufacturer EIRP.
 * Expected ranges below are datasheet values; expected powers and modeled
 * threshold ranges are hand-derived in the comments above the assertions.
 *
 * Sources (URL and read date from the seed provenance rows):
 * - Dedrone RF-360 datasheet V2.0: 2 km for most drones in normal conditions,
 *   up to 5 km in ideal conditions.
 *   https://l.dedrone.com/hubfs/Downloads%20-%20PDFs/DS_RF360-360T_en_web.pdf,
 *   read 2026-09-04.
 * - Rohde & Schwarz ARDRONIS Locate Compact solution page: detection range
 *   more than 5 km, target class unstated.
 *   https://www.rohde-schwarz.com/us/solutions/critical-infrastructure/
 *   countering-drones/ardronis-locate-compact-solution_256824.html,
 *   read 2026-09-04.
 * - DJI Mavic 3 Classic specifications: O3+ EIRP below 26 dBm at both 2.4
 *   and 5.8 GHz; the seed records 0.4 W.
 *   https://www.dji.com/mavic-3-classic/specs, read 2026-09-10.
 * - ITU-R P.525-5, equation 4: free-space basic transmission loss.
 *   https://www.itu.int/rec/R-REC-P.525-5-202411-I/en, read 2026-09-10.
 */

function seedSensor(id: string): SensorSpec {
  const spec = SEED_LIBRARY.find((model) => model.id === id)?.sensor
  if (!spec) throw new Error(`seed ${id} missing sensor`)
  return spec
}

function seedUas(id: string): UasSpec {
  const spec = SEED_LIBRARY.find((model) => model.id === id)?.uas
  if (!spec) throw new Error(`seed ${id} missing UAS`)
  return spec
}

describe('passive RF datasheet range checks (read 2026-09-10)', () => {
  const mavic3 = seedUas('lib-mavic3')
  const rf360 = seedSensor('lib-rf360')
  const ardronis = seedSensor('lib-ardronis')

  it('lands the Mavic 3 5.8 GHz threshold inside the RF-360 published range band', () => {
    expect(mavic3.radiatedPowerW).toBe(0.4)
    expect(rf360.receiverSensitivityDbm).toBe(-90)
    // 0.4 W = 26.0206 dBm. Solving P.525 at 5.7875 GHz for -90 dBm
    // gives 2607.053 m, inside the RF-360 sheet's 2 to 5 km condition band.
    const rangeM = linkBudgetRangeM(
      mavic3.radiatedPowerW!,
      'ism-5800',
      rf360.receiverSensitivityDbm!,
    )
    expect(rangeM).toBeCloseTo(2607.0528, 3)
    expect(rangeM).toBeGreaterThanOrEqual(2000)
    expect(rangeM).toBeLessThanOrEqual(5000)
    expect(receivedPowerDbm(mavic3.radiatedPowerW!, rangeM, 'ism-5800')).toBeCloseTo(-90, 10)
  })

  it('exceeds the ARDRONIS 5 km claim on the same target 2.4 GHz link', () => {
    expect(ardronis.receiverSensitivityDbm).toBe(-90)
    // At 2.44175 GHz, 0.4 W and -90 dBm solve to 6179.305 m. At the
    // sheet's 5000 m lower bound, received power is -88.161 dBm, 1.839 dB
    // over sensitivity, so the result satisfies the stated "more than 5 km".
    const rangeM = linkBudgetRangeM(
      mavic3.radiatedPowerW!,
      'ism-2400',
      ardronis.receiverSensitivityDbm!,
    )
    expect(rangeM).toBeCloseTo(6179.3051, 3)
    expect(rangeM).toBeGreaterThan(5000)
    expect(receivedPowerDbm(mavic3.radiatedPowerW!, 5000, 'ism-2400')).toBeCloseTo(-88.161, 3)
  })
})
