import { describe, expect, it } from 'vitest'
import {
  aarHeadline,
  effectorExpenditureLine,
  environmentHeadline,
  expenditureBreakdown,
  expenditureParts,
  magazinesHeadline,
  residualHeadline,
  residualSectionHeadline,
  threatCompactStats,
  threatShotLine,
  totalSalvos,
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

describe('expenditure vocabulary', () => {
  it('names the three channels the same way everywhere', () => {
    expect(expenditureParts({ shotsFired: 2, deSalvos: 4, jamSalvos: 3 })).toEqual([
      '2 kin',
      '4 DE',
      '3 EW',
    ])
  })

  it('leaves out a channel that spent nothing', () => {
    expect(expenditureParts({ shotsFired: 2, deSalvos: 0, jamSalvos: 0 })).toEqual(['2 kin'])
    expect(expenditureParts({ shotsFired: 0, deSalvos: 4 })).toEqual(['4 DE'])
    expect(expenditureParts({ shotsFired: 0 })).toEqual([])
  })

  it('keeps every channel in the fixed-field breakdown, zeros included', () => {
    // The user's real run: 2 interceptor rounds plus 4 HPM bursts read as
    // "6 kinetic · 0 EW" before the three-way split existed.
    expect(expenditureBreakdown({ shotsFired: 2, deSalvos: 4, jamSalvos: 0 })).toBe(
      '2 kin · 4 DE · 0 EW',
    )
  })

  it('totals across the three channels, treating absent counts as zero', () => {
    expect(totalSalvos({ shotsFired: 2, deSalvos: 4, jamSalvos: 3 })).toBe(9)
    expect(totalSalvos({ shotsFired: 2 })).toBe(2)
  })
})

describe('residualHeadline', () => {
  it('reads the display leaker figure as a percent of the raid', () => {
    expect(residualHeadline({ reportedLeakers: 0.4, raidSize: 4 })).toEqual({
      value: '10.0%',
      sub: '0.40 of 4 ships',
      bad: true,
    })
  })

  it('stays quiet below the 5% line', () => {
    expect(residualHeadline({ reportedLeakers: 0.1, raidSize: 4 }).bad).toBe(false)
  })

  it('dashes and says why when no asset makes residual measurable', () => {
    // reportedLeakers is null, not 0: with no defended asset there is nothing
    // to leak past, so a printed 0.0% would claim a perfect defence.
    expect(residualHeadline({ reportedLeakers: null, raidSize: 4 })).toEqual({
      value: '—',
      sub: 'no defended asset placed',
      bad: false,
    })
  })

  it('dashes the section headline on the same rule', () => {
    expect(residualSectionHeadline({ reportedLeakers: 0.4 })).toBe('0.40 expected residual')
    expect(residualSectionHeadline({ reportedLeakers: null })).toBe('residual not measurable')
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
    ).toBe('12 kin · 3 of 20 remaining')
  })

  it('splits directed energy out of the kinetic count', () => {
    // Old expectation was "6 shots": it rolled HPM bursts into rounds fired.
    expect(
      magazinesHeadline({
        shotsFired: 2,
        deSalvos: 4,
        effectors: [eff(2, 8, 10), eff(0, null, null)],
      }),
    ).toBe('2 kin · 4 DE · 8 of 10 remaining')
  })

  it('reads unlimited when no effector tracks rounds', () => {
    expect(magazinesHeadline({ shotsFired: 4, effectors: [eff(4, null, null)] })).toBe(
      '4 kin · unlimited',
    )
  })

  it('sums only the finite magazines in a mixed battery', () => {
    expect(
      magazinesHeadline({
        shotsFired: 9,
        effectors: [eff(6, 14, 20), eff(3, null, null)],
      }),
    ).toBe('9 kin · 14 of 20 remaining')
  })

  it('drops the "of N" part when a magazine size is unknown', () => {
    expect(magazinesHeadline({ shotsFired: 2, effectors: [eff(2, 3, null)] })).toBe(
      '2 kin · 3 remaining',
    )
  })

  it('says no salvos rather than printing a zero count', () => {
    expect(magazinesHeadline({ shotsFired: 0, effectors: [] })).toBe('no salvos · unlimited')
  })

  it('labels modeled expenditure as projected rather than fired', () => {
    expect(
      magazinesHeadline(
        { shotsFired: 4, deSalvos: 2, effectors: [eff(4, 6, 10)] },
        'projected',
      ),
    ).toBe('projected 4 kin · 2 DE · 6 of 10 after run')
  })
})

describe('effectorExpenditureLine', () => {
  it('reads EW salvos for a jammer by type, including an idle one', () => {
    expect(
      effectorExpenditureLine({ effectorType: 'jammer', shotsFired: 0, jamSalvos: 0 }),
    ).toBe('0 EW salvos')
    expect(
      effectorExpenditureLine({ effectorType: 'jammer', shotsFired: 0, jamSalvos: 9 }),
    ).toBe('9 EW salvos')
  })

  it('uses the singular for one EW salvo', () => {
    expect(
      effectorExpenditureLine({ effectorType: 'jammer', shotsFired: 0, jamSalvos: 1 }),
    ).toBe('1 EW salvo')
  })

  it('reads DE bursts for a directed-energy emitter, never rounds fired', () => {
    // A DE or HPM burst is a hard kill that fires no round. The old line
    // reported "0 fired" for a battery that had just defeated the raid.
    expect(effectorExpenditureLine({ effectorType: 'de', shotsFired: 0, deSalvos: 3 })).toBe(
      '3 DE bursts',
    )
    expect(effectorExpenditureLine({ effectorType: 'hpm', shotsFired: 0, deSalvos: 1 })).toBe(
      '1 DE burst',
    )
    expect(effectorExpenditureLine({ effectorType: 'hpm', shotsFired: 0, deSalvos: 0 })).toBe(
      '0 DE bursts',
    )
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
      '3 EW salvos',
    )
    expect(effectorExpenditureLine({ effectorType: null, shotsFired: 0, deSalvos: 2 })).toBe(
      '2 DE bursts',
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
    ).toBe('1 projected EW salvo')
    expect(
      effectorExpenditureLine({ effectorType: 'de', shotsFired: 0, deSalvos: 2 }, 'projected'),
    ).toBe('2 projected DE bursts')
  })
})

describe('aarHeadline', () => {
  it('formats defeats and undefeated ships to one decimal', () => {
    // AarSummary.expectedLeakers carries UNDEFEATED ships, which includes
    // ships that never crossed a boundary, so "leakers" claimed an arrival
    // the run may never have had.
    expect(aarHeadline({ expectedKills: 3.24, expectedLeakers: 0.76 })).toBe(
      '3.2 defeated · 0.8 undefeated',
    )
    expect(aarHeadline({ expectedKills: 0, expectedLeakers: 0 })).toBe(
      '0.0 defeated · 0.0 undefeated',
    )
  })
})

describe('threatShotLine', () => {
  const att = (over: Record<string, number>) => ({
    shipCount: 1,
    shotsFired: 0,
    deSalvos: 0,
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

  it('adds the EW salvo count when EW salvos were emitted', () => {
    expect(
      threatShotLine(
        att({ shotsFired: 2, jamSalvos: 1, expectedKills: 0.92, leakProbability: 0.08 }),
      ),
    ).toBe('2 kin · 1 EW · kill 92% · leak 8%')
  })

  it('shows directed-energy bursts apart from the kinetic rounds', () => {
    // The old line printed "6 kin" for 2 interceptor rounds and 4 HPM bursts.
    expect(
      threatShotLine(
        att({ shotsFired: 2, deSalvos: 4, expectedKills: 0.95, leakProbability: 0.05 }),
      ),
    ).toBe('2 kin · 4 DE · kill 95% · leak 5%')
  })

  it('reads expected ship counts for a formation', () => {
    expect(
      threatShotLine(
        att({ shipCount: 6, shotsFired: 9, expectedKills: 5.4, leakProbability: 0.1 }),
      ),
    ).toBe('9 kin · kill 5.4 · leak 0.6')
  })

  it('reads EW-only expenditure without a kinetic part', () => {
    expect(
      threatShotLine(att({ jamSalvos: 3, expectedKills: 0.6, leakProbability: 0.4 })),
    ).toBe('3 EW · kill 60% · leak 40%')
  })

  it('reads DE-only expenditure without a kinetic part', () => {
    expect(
      threatShotLine(att({ deSalvos: 4, expectedKills: 0.8, leakProbability: 0.2 })),
    ).toBe('4 DE · kill 80% · leak 20%')
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
