import { describe, expect, it } from 'vitest'
import type { AttritionReport } from '../playback/attrition'
import type { ThreatAssessment } from '../playback/sim'
import { mcdaParts, mcdaScore, WARNING_FULL_S } from './mcda'

function threat(patch: Partial<ThreatAssessment>): ThreatAssessment {
  return {
    uasId: 't',
    status: 'never-detected',
    firstDetectS: null,
    firstDetectSensorId: null,
    firstConfirmS: null,
    techs: [],
    swarmMerged: false,
    cpaAssetId: null,
    cpaS: null,
    cpaDistanceM: null,
    assetId: null,
    arrivalS: null,
    closestApproachM: null,
    warningS: null,
    windowS: null,
    windowEffectorId: null,
    classificationAtS: { unknownAtS: null, suspectedAtS: null, hostileAtS: null },
    engageGateS: null,
    detectingSensorIds: [],
    effectorWindows: [],
    ...patch,
  }
}

describe('mcdaParts', () => {
  it('returns null with no pathed threats', () => {
    expect(mcdaParts([threat({ status: 'no-path' })])).toBeNull()
  })

  it('scores fractions over pathed threats', () => {
    const parts = mcdaParts([
      threat({ status: 'engageable', firstDetectS: 10, firstConfirmS: 20, warningS: WARNING_FULL_S }),
      threat({ status: 'never-detected' }),
    ])!
    expect(parts.coverage).toBe(0.5)
    expect(parts.confirm).toBe(0.5)
    expect(parts.engage).toBe(0.5)
    expect(parts.warning).toBe(0.5)
  })

  it('clamps warning time to the full-score cap', () => {
    const parts = mcdaParts([threat({ firstDetectS: 0, warningS: WARNING_FULL_S * 4 })])!
    expect(parts.warning).toBe(1)
  })
})

/** Raid of 4 ships: 3 defeated before arrival, 1 killed after arrival. */
function attritionReport(): AttritionReport {
  return {
    threats: [],
    effectors: [],
    totals: {
      raidSize: 4,
      expectedKills: 3,
      expectedHardKills: 3,
      expectedSoftKills: 0,
      expectedLateKills: 1,
      expectedLeakers: 1,
      expectedNoArrival: 0,
      reportedLeakers: 1,
      shotsFired: 6,
      deSalvos: 0,
      jamSalvos: 0,
    },
    events: [],
  }
}

describe('attrition part', () => {
  it('is the pre-arrival defeat rate and excludes late intercepts', () => {
    const parts = mcdaParts(
      [threat({ status: 'engageable', firstDetectS: 10, firstConfirmS: 20 })],
      attritionReport(),
    )!
    // 3 of 4 ships defeated before arrival. The late kill is real destruction
    // but it did not defend the asset, so it is not in the score.
    expect(parts.attrition).toBe(0.75)
  })

  it('is absent when no attrition report is supplied', () => {
    const parts = mcdaParts([threat({ status: 'engageable', firstDetectS: 10 })])!
    expect(parts.attrition).toBeUndefined()
  })
})

describe('mcdaScore', () => {
  it('weights the parts to a 0-100 total', () => {
    const parts = { warning: 1, coverage: 0, confirm: 0, engage: 0 }
    expect(mcdaScore(parts, { warning: 5, coverage: 0, confirm: 0, engage: 0 })).toBe(100)
    expect(mcdaScore(parts, { warning: 1, coverage: 1, confirm: 1, engage: 1 })).toBe(25)
    expect(mcdaScore(parts, { warning: 0, coverage: 0, confirm: 0, engage: 0 })).toBe(0)
  })
})
