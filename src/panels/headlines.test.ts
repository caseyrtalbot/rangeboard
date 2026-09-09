import { describe, expect, it } from 'vitest'
import {
  aarHeadline,
  environmentHeadline,
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

describe('aarHeadline', () => {
  it('labels fractional forecast counts as expected', () => {
    // AarSummary.expectedLeakers carries UNDEFEATED ships, including ships
    // that never crossed a boundary, so the word is never "leakers".
    expect(aarHeadline({ expectedKills: 3.24, expectedLeakers: 0.76 })).toBe(
      '3.24 expected kills · 0.76 expected survivors',
    )
    expect(aarHeadline({ expectedKills: 0, expectedLeakers: 0 })).toBe(
      '0.00 expected kills · 0.00 expected survivors',
    )
  })
})

