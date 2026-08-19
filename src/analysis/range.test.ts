import { describe, expect, it } from 'vitest'
import type { EnvironmentSpec, UasSpec } from '../model/types'
import {
  effectiveRadiusM,
  enduranceDerate,
  pathExhaustionPoint,
  rangeBasis,
  windComponentMps,
} from './range'

const CALM: EnvironmentSpec = {
  windSpeedMps: 0,
  windFromDeg: 270,
  temperatureC: 15,
  fieldElevationFt: 1000,
  apply: true,
}

function quad(over: Partial<UasSpec> = {}): UasSpec {
  return {
    group: 1,
    airframe: 'quad',
    cruiseSpeedMps: 10,
    maxSpeedMps: 20,
    enduranceMin: 30,
    altBandFt: [0, 1000],
    navMode: 'gps',
    emissionsNote: '',
    ...over,
  }
}

describe('rangeBasis', () => {
  it('prefers combat radius, then spec, then estimates from endurance', () => {
    expect(rangeBasis(quad({ combatRadiusM: 7000, operatingRadiusM: 9000 }))).toMatchObject({
      radiusM: 7000,
      source: 'combat',
    })
    expect(rangeBasis(quad({ operatingRadiusM: 9000 }))).toMatchObject({
      radiusM: 9000,
      source: 'spec',
    })
    // 30 min at 10 m/s = 18 km full, halved for return-to-home.
    expect(rangeBasis(quad())).toMatchObject({ radiusM: 9000, source: 'estimated' })
  })

  it('one-way airframes budget the full endurance outbound', () => {
    const owa = quad({ airframe: 'fpv' })
    expect(rangeBasis(owa)).toMatchObject({ radiusM: 18000, oneWay: true })
  })
})

describe('environment derates', () => {
  it('no derate on a calm standard day', () => {
    expect(enduranceDerate(CALM, true)).toBe(1)
  })

  it('cold and altitude shrink battery endurance, with floors', () => {
    const cold = { ...CALM, temperatureC: -10 }
    expect(enduranceDerate(cold, true)).toBeLessThan(1)
    expect(enduranceDerate({ ...CALM, temperatureC: -100 }, true)).toBeGreaterThanOrEqual(
      0.5 * 0.6 - 1e-9,
    )
    const high = { ...CALM, fieldElevationFt: 8000 }
    expect(enduranceDerate(high, true)).toBeLessThan(1)
  })

  it('does not derate non-battery airframes and honors the apply toggle', () => {
    expect(enduranceDerate({ ...CALM, temperatureC: -20 }, false)).toBe(1)
    expect(enduranceDerate({ ...CALM, temperatureC: -20, apply: false }, true)).toBe(1)
  })
})

describe('wind shaping', () => {
  const wind: EnvironmentSpec = { ...CALM, windSpeedMps: 5, windFromDeg: 270 } // blows to the east

  it('computes tail/head components by bearing', () => {
    expect(windComponentMps(wind, 90)).toBeCloseTo(5) // flying east: tailwind
    expect(windComponentMps(wind, 270)).toBeCloseTo(-5) // flying west: headwind
    expect(windComponentMps(wind, 0)).toBeCloseTo(0, 5) // crosswind
  })

  it('stretches one-way reach downwind and shrinks it upwind', () => {
    const owa = quad({ airframe: 'fpv', combatRadiusM: 6000 })
    const down = effectiveRadiusM(owa, wind, 90)
    const up = effectiveRadiusM(owa, wind, 270)
    const calm = effectiveRadiusM(owa, CALM, 90)
    expect(down).toBeGreaterThan(calm)
    expect(up).toBeLessThan(calm)
    expect(down + up).toBeCloseTo(2 * calm, 0)
  })

  it('shrinks return-to-home reach symmetrically', () => {
    const rth = quad({ combatRadiusM: 6000 })
    const down = effectiveRadiusM(rth, wind, 90)
    const up = effectiveRadiusM(rth, wind, 270)
    expect(down).toBeCloseTo(up)
    expect(down).toBeLessThan(effectiveRadiusM(rth, CALM, 90))
  })
})

describe('pathExhaustionPoint', () => {
  it('marks where the endurance budget runs out', () => {
    // One-way, 6 km budget at 10 m/s: dies 6 km into a 10 km eastbound leg.
    const owa = quad({ airframe: 'fpv', combatRadiusM: 6000 })
    const hit = pathExhaustionPoint([{ x: 0, y: 0 }, { x: 10000, y: 0 }], 10, owa, CALM)
    expect(hit).not.toBeNull()
    expect(hit!.pos.x).toBeCloseTo(6000)
  })

  it('returns null when the whole path is flyable', () => {
    const owa = quad({ airframe: 'fpv', combatRadiusM: 6000 })
    expect(pathExhaustionPoint([{ x: 0, y: 0 }, { x: 3000, y: 0 }], 10, owa, CALM)).toBeNull()
  })

  it('a tailwind extends how far along the path the drone gets', () => {
    const owa = quad({ airframe: 'fpv', combatRadiusM: 6000 })
    const wind = { ...CALM, windSpeedMps: 5, windFromDeg: 270 }
    const hit = pathExhaustionPoint([{ x: 0, y: 0 }, { x: 20000, y: 0 }], 10, owa, wind)
    expect(hit!.pos.x).toBeCloseTo(9000) // 600 s budget at 15 m/s ground speed
  })
})
