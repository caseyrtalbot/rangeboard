import { describe, expect, it } from 'vitest'
import type { EnvironmentSpec, SensorSpec, UasSpec } from '../../model/types'
import { defaultEnvironment } from '../../model/seed'
import { crossBearingRangeSigmaM, linkBudgetRangeM, URBAN_EXCESS_LOSS_DB } from '../rfLink'
import {
  effectiveRfRangeM,
  legacyRfRangeM,
  rfCanHear,
  rfDirectionFindingAccuracyDeg,
  rfLinkBudgetModeled,
  rfLinkModelApplies,
  rfMeasurementAccuracy,
  rfOverlapBands,
  rfSensorBands,
  rfUrbanMarginDb,
} from './rf'

const RF: SensorSpec = {
  sensorType: 'rf',
  role: 'classification',
  detectRangeM: 4000,
  classifyRangeM: 2000,
  sectorDeg: 360,
  receiverSensitivityDbm: -90,
  azimuthAccuracyDeg: 5,
  geolocationMinNodes: 2,
}

const UAS: UasSpec = {
  group: 1,
  airframe: 'quad',
  cruiseSpeedMps: 12,
  maxSpeedMps: 21,
  enduranceMin: 46,
  altBandFt: [50, 1200],
  navMode: 'mixed',
  emissionsNote: '',
  linkBands: ['gnss', 'ism-2400', 'ism-5800'],
  radiatedPowerW: 0.4,
}

function env(patch: Partial<EnvironmentSpec> = {}): EnvironmentSpec {
  return { ...defaultEnvironment(), ...patch }
}

describe('RF link environment adapter', () => {
  it('keeps the existing emitting-band gate', () => {
    expect(rfSensorBands(RF)).toHaveLength(5)
    expect(rfOverlapBands(RF, UAS)).toEqual(['ism-2400', 'ism-5800'])
    expect(rfCanHear({ ...RF, rfBands: ['ism-5800'] }, UAS)).toBe(true)
    expect(rfCanHear({ ...RF, rfBands: ['gnss'] }, UAS)).toBe(false)
    expect(rfOverlapBands(RF, { ...UAS, navMode: 'fiber' })).toEqual([])
  })

  it('selects the longest overlapping link-budget range', () => {
    const rangeM = effectiveRfRangeM(RF, RF.detectRangeM, env(), UAS)
    expect(rangeM).toBeCloseTo(linkBudgetRangeM(0.4, 'ism-2400', -90), 10)
    expect(effectiveRfRangeM(RF, RF.classifyRangeM!, env(), UAS)).toBeCloseTo(rangeM / 2, 10)
  })

  it('applies the sourced urban margin and then the urban datasheet cap', () => {
    const urban = env({ emBackground: 'urban' })
    expect(rfUrbanMarginDb(urban)).toBe(URBAN_EXCESS_LOSS_DB)
    expect(rfUrbanMarginDb(env({ emBackground: 'urban', apply: false }))).toBe(0)
    expect(effectiveRfRangeM(RF, RF.detectRangeM, urban, UAS)).toBeCloseTo(
      linkBudgetRangeM(0.4, 'ism-2400', -90, URBAN_EXCESS_LOSS_DB),
      10,
    )
    const capped = { ...RF, urbanRangeM: 1000 }
    expect(effectiveRfRangeM(capped, capped.detectRangeM, urban, UAS)).toBe(1000)
    expect(effectiveRfRangeM(capped, capped.classifyRangeM!, urban, UAS)).toBe(500)
  })

  it('returns the old placard path for the switch and either null required field', () => {
    const urban = env({ emBackground: 'urban' })
    const expected = legacyRfRangeM(RF, RF.detectRangeM, urban)
    expect(expected).toBe(2400)
    expect(effectiveRfRangeM(RF, RF.detectRangeM, urban, UAS, true)).toBe(expected)
    expect(effectiveRfRangeM({ ...RF, receiverSensitivityDbm: null }, 4000, urban, UAS)).toBe(expected)
    expect(effectiveRfRangeM(RF, 4000, urban, { ...UAS, radiatedPowerW: null })).toBe(expected)
    expect(rfLinkBudgetModeled(RF, UAS)).toBe(true)
    expect(rfLinkBudgetModeled(RF, UAS, true)).toBe(false)
    expect(rfLinkModelApplies({ ...RF, rfBands: ['uhf-433'] }, UAS)).toBe(false)
  })

  it('keeps the legacy urbanRange override bit-identical', () => {
    const urban = env({ emBackground: 'urban' })
    const sourced = { ...RF, urbanRangeM: 1000 }
    expect(legacyRfRangeM(sourced, 4000, urban)).toBe(1000)
    expect(legacyRfRangeM(sourced, 2000, urban)).toBe(500)
    expect(legacyRfRangeM(sourced, 4000, env({ apply: false, emBackground: 'urban' }))).toBe(4000)
  })
})

describe('RF measurement accuracy', () => {
  it('uses the DF seed as the best accuracy and degrades below its reference SNR', () => {
    expect(rfDirectionFindingAccuracyDeg(RF, 4)).toBe(5)
    expect(rfDirectionFindingAccuracyDeg(RF, 0.25)).toBe(10)
    expect(rfDirectionFindingAccuracyDeg({ ...RF, azimuthAccuracyDeg: null }, 1)).toBeNull()
  })

  it('stays bearing only below the same-model node minimum', () => {
    expect(rfMeasurementAccuracy(RF, 1, 1, 2000, 1000)).toEqual({
      azimuthAccuracyDeg: 5,
      rangeAccuracyM: null,
    })
  })

  it('uses broadside cross-bearing range sigma once enough nodes hear at once', () => {
    const accuracy = rfMeasurementAccuracy(RF, 1, 2, 2000, 1000)
    expect(accuracy.azimuthAccuracyDeg).toBe(5)
    expect(accuracy.rangeAccuracyM).toBeCloseTo(crossBearingRangeSigmaM(2000, 1000, 5)!, 10)
    expect(rfMeasurementAccuracy({ ...RF, geolocationMinNodes: 3 }, 1, 2, 2000, 1000).rangeAccuracyM)
      .toBeNull()
  })
})
