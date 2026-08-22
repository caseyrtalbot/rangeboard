import { describe, expect, it } from 'vitest'
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

describe('mcdaScore', () => {
  it('weights the parts to a 0-100 total', () => {
    const parts = { warning: 1, coverage: 0, confirm: 0, engage: 0 }
    expect(mcdaScore(parts, { warning: 5, coverage: 0, confirm: 0, engage: 0 })).toBe(100)
    expect(mcdaScore(parts, { warning: 1, coverage: 1, confirm: 1, engage: 1 })).toBe(25)
    expect(mcdaScore(parts, { warning: 0, coverage: 0, confirm: 0, engage: 0 })).toBe(0)
  })
})
