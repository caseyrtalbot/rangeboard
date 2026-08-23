import { describe, expect, it } from 'vitest'
import {
  aarHeadline,
  environmentHeadline,
  magazinesHeadline,
  scoreHeadline,
  threatCompactStats,
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
