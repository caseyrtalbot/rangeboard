import { describe, expect, it } from 'vitest'
import type { UasSpec } from './types'
import { defaultEffectRadiusM, defaultWeaponProfile } from './weaponFactors'

function uas(partial: Partial<UasSpec>): UasSpec {
  return {
    group: 1,
    airframe: 'quad',
    cruiseSpeedMps: 10,
    maxSpeedMps: 15,
    enduranceMin: 30,
    altBandFt: [50, 400],
    navMode: 'mixed',
    emissionsNote: '',
    ...partial,
  }
}

describe('defaultEffectRadiusM', () => {
  it('maps warhead-mass classes to planning tiers', () => {
    expect(defaultEffectRadiusM(1)).toBe(15) // under 2 kg
    expect(defaultEffectRadiusM(2)).toBe(30) // 2 kg boundary joins the 2-10 tier
    expect(defaultEffectRadiusM(5)).toBe(30)
    expect(defaultEffectRadiusM(10)).toBe(30) // inclusive upper bound of the 2-10 tier
    expect(defaultEffectRadiusM(24)).toBe(50)
    expect(defaultEffectRadiusM(25)).toBe(50) // inclusive upper bound of the 10-25 tier
    expect(defaultEffectRadiusM(40)).toBe(80) // over 25 kg
    expect(defaultEffectRadiusM(150)).toBe(80)
  })

  it('returns null for unknown or non-positive mass', () => {
    expect(defaultEffectRadiusM(null)).toBeNull()
    expect(defaultEffectRadiusM(undefined)).toBeNull()
    expect(defaultEffectRadiusM(0)).toBeNull()
    expect(defaultEffectRadiusM(-5)).toBeNull()
    expect(defaultEffectRadiusM(Number.NaN)).toBeNull()
  })
})

describe('defaultWeaponProfile', () => {
  it('keeps an explicit profile', () => {
    expect(defaultWeaponProfile(uas({ airframe: 'fpv', weaponProfile: 'none' }))).toBe('none')
  })

  it('one-way airframes are impact', () => {
    expect(defaultWeaponProfile(uas({ airframe: 'one-way-attack' }))).toBe('impact')
    expect(defaultWeaponProfile(uas({ airframe: 'fpv' }))).toBe('impact')
  })

  it('oneWay flag is impact even on a reusable airframe type', () => {
    expect(defaultWeaponProfile(uas({ airframe: 'fixed-wing', oneWay: true }))).toBe('impact')
  })

  it('a release standoff makes it standoff', () => {
    expect(defaultWeaponProfile(uas({ airframe: 'fixed-wing', standoffRangeM: 8000 }))).toBe(
      'standoff',
    )
  })

  it('everything else is none', () => {
    expect(defaultWeaponProfile(uas({ airframe: 'quad' }))).toBe('none')
    expect(defaultWeaponProfile(uas({ airframe: 'fixed-wing', standoffRangeM: null }))).toBe('none')
  })
})
