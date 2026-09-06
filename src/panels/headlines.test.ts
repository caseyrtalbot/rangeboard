import { describe, expect, it } from 'vitest'
import {
  aarHeadline,
  environmentHeadline,
  expenditureBreakdown,
  expenditureParts,
  residualHeadline,
  residualSectionHeadline,
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
    // 2 interceptor rounds plus 4 HPM bursts must never read as "6 kinetic".
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

describe('aarHeadline', () => {
  it('formats defeats and undefeated ships to one decimal', () => {
    // AarSummary.expectedLeakers carries UNDEFEATED ships, including ships
    // that never crossed a boundary, so the word is never "leakers".
    expect(aarHeadline({ expectedKills: 3.24, expectedLeakers: 0.76 })).toBe(
      '3.2 defeated · 0.8 undefeated',
    )
    expect(aarHeadline({ expectedKills: 0, expectedLeakers: 0 })).toBe(
      '0.0 defeated · 0.0 undefeated',
    )
  })
})

