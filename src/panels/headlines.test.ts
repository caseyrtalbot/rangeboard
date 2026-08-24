import { describe, expect, it } from 'vitest'
import {
  aarHeadline,
  effectorExpenditureLine,
  environmentHeadline,
  magazinesHeadline,
  scoreHeadline,
  threatCompactStats,
  threatShotLine,
} from './headlines'
import type { EnvironmentSpec } from '../model/types'

const calm: EnvironmentSpec = {
  windSpeedMps: 0,
  windFromDeg: 0,
  temperatureC: 15,
  fieldElevationFt: 0,
  precipitation: 'clear',
  light: 'day',
  emBackground: 'rural',
  apply: true,
}

describe('environmentHeadline', () => {
  it('reads Standard day when nothing derates', () => {
    expect(environmentHeadline(calm)).toBe('Standard day')
  })

  it('treats absent optional covariates as clear/day/rural', () => {
    const legacy: EnvironmentSpec = {
      windSpeedMps: 0,
      windFromDeg: 0,
      temperatureC: 15,
      fieldElevationFt: 0,
      apply: true,
    }
    expect(environmentHeadline(legacy)).toBe('Standard day')
  })

  it('joins active covariates in a fixed order', () => {
    expect(
      environmentHeadline({
        ...calm,
        precipitation: 'rain',
        light: 'night',
        emBackground: 'urban',
        windSpeedMps: 12,
      }),
    ).toBe('Rain · Night · Urban EM · 12 m/s')
  })

  it('shows fog and wind alone', () => {
    expect(environmentHeadline({ ...calm, precipitation: 'fog' })).toBe('Fog')
    expect(environmentHeadline({ ...calm, windSpeedMps: 5 })).toBe('5 m/s')
  })

  it('shows wind in knots for aviation units', () => {
    expect(environmentHeadline({ ...calm, windSpeedMps: 5 }, 'aviation')).toBe('10 kt')
  })

  it('ignores the apply flag: the checkbox shows that state', () => {
    expect(environmentHeadline({ ...calm, apply: false })).toBe('Standard day')
  })
})

describe('magazinesHeadline', () => {
  const eff = (shots: number, left: number | null, size: number | null) => ({
    effectorId: 'e',
    name: 'E',
    effectorType: null,
    shotsFired: shots,
    expectedRoundsRemaining: left,
    magazineSize: size,
  })

  it('sums finite magazines', () => {
    expect(
      magazinesHeadline({
        shotsFired: 12,
        effectors: [eff(8, 2, 10), eff(4, 1, 10)],
      }),
    ).toBe('12 shots · 3 of 20 remaining')
  })

  it('reads unlimited when no effector tracks rounds', () => {
    expect(magazinesHeadline({ shotsFired: 4, effectors: [eff(4, null, null)] })).toBe(
      '4 shots · unlimited',
    )
  })

  it('sums only the finite magazines in a mixed battery', () => {
    expect(
      magazinesHeadline({
        shotsFired: 9,
        effectors: [eff(6, 14, 20), eff(3, null, null)],
      }),
    ).toBe('9 shots · 14 of 20 remaining')
  })

  it('drops the "of N" part when a magazine size is unknown', () => {
    expect(magazinesHeadline({ shotsFired: 2, effectors: [eff(2, 3, null)] })).toBe(
      '2 shots · 3 remaining',
    )
  })

  it('uses the singular for one shot', () => {
    expect(magazinesHeadline({ shotsFired: 1, effectors: [] })).toBe('1 shot · unlimited')
  })

  it('labels modeled expenditure as projected rather than fired', () => {
    expect(
      magazinesHeadline(
        { shotsFired: 4, effectors: [eff(4, 6, 10)] },
        'projected',
      ),
    ).toBe('4 projected shots · 6 of 10 after run')
  })
})

describe('effectorExpenditureLine', () => {
  it('reads jam salvos for a jammer by type, including an idle one', () => {
    expect(
      effectorExpenditureLine({ effectorType: 'jammer', shotsFired: 0, jamSalvos: 0 }),
    ).toBe('0 jam salvos')
    expect(
      effectorExpenditureLine({ effectorType: 'jammer', shotsFired: 0, jamSalvos: 9 }),
    ).toBe('9 jam salvos')
  })

  it('uses the singular for one jam salvo', () => {
    expect(
      effectorExpenditureLine({ effectorType: 'jammer', shotsFired: 0, jamSalvos: 1 }),
    ).toBe('1 jam salvo')
  })

  it('reads fired for kinetic types, even at zero', () => {
    expect(
      effectorExpenditureLine({ effectorType: 'interceptor', shotsFired: 4, jamSalvos: 0 }),
    ).toBe('4 fired')
    expect(effectorExpenditureLine({ effectorType: 'gun', shotsFired: 0, jamSalvos: 0 })).toBe(
      '0 fired',
    )
  })

  it('falls back on the counts when the type is unknown (legacy pins)', () => {
    expect(effectorExpenditureLine({ effectorType: null, shotsFired: 5 })).toBe('5 fired')
    expect(effectorExpenditureLine({ effectorType: null, shotsFired: 0, jamSalvos: 3 })).toBe(
      '3 jam salvos',
    )
    expect(effectorExpenditureLine({ shotsFired: 2 })).toBe('2 fired')
  })

  it('uses future tense for modeled effector expenditure', () => {
    expect(
      effectorExpenditureLine(
        { effectorType: 'gun', shotsFired: 4, jamSalvos: 0 },
        'projected',
      ),
    ).toBe('4 projected shots')
    expect(
      effectorExpenditureLine(
        { effectorType: 'jammer', shotsFired: 0, jamSalvos: 1 },
        'projected',
      ),
    ).toBe('1 projected jam salvo')
  })
})

describe('aarHeadline', () => {
  it('formats expected kills and leakers to one decimal', () => {
    expect(aarHeadline({ expectedKills: 3.24, expectedLeakers: 0.76 })).toBe(
      '3.2 kills · 0.8 leakers',
    )
    expect(aarHeadline({ expectedKills: 0, expectedLeakers: 0 })).toBe('0.0 kills · 0.0 leakers')
  })
})

describe('scoreHeadline', () => {
  it('formats a score out of 100', () => {
    expect(scoreHeadline(72)).toBe('72 / 100')
    expect(scoreHeadline(0)).toBe('0 / 100')
  })

  it('dashes when no score computes', () => {
    expect(scoreHeadline(null)).toBe('—')
  })
})

describe('threatShotLine', () => {
  const att = (over: Record<string, number>) => ({
    shipCount: 1,
    shotsFired: 0,
    jamSalvos: 0,
    expectedKills: 0,
    leakProbability: 1,
    ...over,
  })

  it('reads probabilities for a single ship', () => {
    expect(
      threatShotLine(att({ shotsFired: 2, expectedKills: 0.9, leakProbability: 0.1 })),
    ).toBe('2 kin · kill 90% · leak 10%')
  })

  it('adds the jam salvo count when jam salvos were emitted', () => {
    expect(
      threatShotLine(
        att({ shotsFired: 2, jamSalvos: 1, expectedKills: 0.92, leakProbability: 0.08 }),
      ),
    ).toBe('2 kin · 1 jam · kill 92% · leak 8%')
  })

  it('reads expected ship counts for a formation', () => {
    expect(
      threatShotLine(
        att({ shipCount: 6, shotsFired: 9, expectedKills: 5.4, leakProbability: 0.1 }),
      ),
    ).toBe('9 kin · kill 5.4 · leak 0.6')
  })

  it('reads jam-only expenditure without a kinetic part', () => {
    expect(
      threatShotLine(att({ jamSalvos: 3, expectedKills: 0.6, leakProbability: 0.4 })),
    ).toBe('3 jam · kill 60% · leak 40%')
  })

  it('reads no shots when never engaged, and dashes without an attrition row', () => {
    expect(threatShotLine(att({}))).toBe('no shots')
    expect(threatShotLine(undefined)).toBe('—')
  })

  it('derives the leak percent from the rounded kill percent so the pair sums to 100', () => {
    // Both halves round up independently (12.5 -> 13, 87.5 -> 88): naive
    // rounding would print 13% + 88% = 101%.
    expect(
      threatShotLine(att({ shotsFired: 1, expectedKills: 0.125, leakProbability: 0.875 })),
    ).toBe('1 kin · kill 13% · leak 87%')
  })
})

describe('threatCompactStats', () => {
  it('formats warning, window length, and leak percent', () => {
    expect(
      threatCompactStats(
        { warningS: 83, windowS: [30, 74.6] },
        { leakProbability: 0.305 },
      ),
    ).toEqual({ warning: '1:23', window: '45 s', leak: '31%' })
  })

  it('dashes missing values', () => {
    expect(threatCompactStats({ warningS: null, windowS: null }, undefined)).toEqual({
      warning: '—',
      window: '—',
      leak: '—',
    })
  })
})
