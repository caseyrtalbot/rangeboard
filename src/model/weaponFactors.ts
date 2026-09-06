/**
 * Weapon planning factors for T&E laydown work.
 *
 * The threat study (docs/threat) gives no lethal blast radius, fragmentation
 * fan, or aimpoints, so nothing here is lethality data. The tiers are
 * PLANNING FACTORS: coarse effect-circle sizes that draw a WEZ footprint on
 * the canvas for laydown geometry. Not real lethal radii.
 */
import type { UasSpec } from './types'

/**
 * Planning-factor effect radius by warhead-mass class. Representative tiers
 * for T&E laydown, not study-derived lethality data. `maxKg` is the tier's
 * inclusive upper bound, except the first tier which is strictly under 2 kg
 * (so a 2 kg warhead joins the 2-10 kg tier, and 25 kg stays in 10-25 kg).
 */
export const EFFECT_RADIUS_PLANNING_M: Array<{ maxKg: number; radiusM: number }> = [
  { maxKg: 2, radiusM: 15 }, // under 2 kg: grenade-class FPV / drop munitions
  { maxKg: 10, radiusM: 30 }, // 2-10 kg: FPV / loitering-munition class
  { maxKg: 25, radiusM: 50 }, // 10-25 kg: mid-class OWA fills
  { maxKg: Infinity, radiusM: 80 }, // over 25 kg: heavy OWA fills
]

/**
 * Planning-factor effect radius for a warhead mass, meters. Null when the
 * mass is unknown or not positive: an honest blank, never an invented number.
 */
export function defaultEffectRadiusM(warheadKg: number | null | undefined): number | null {
  if (warheadKg == null || !Number.isFinite(warheadKg) || warheadKg <= 0) return null
  for (let i = 0; i < EFFECT_RADIUS_PLANNING_M.length; i++) {
    const tier = EFFECT_RADIUS_PLANNING_M[i]
    if (i === 0 ? warheadKg < tier.maxKg : warheadKg <= tier.maxKg) return tier.radiusM
  }
  // Unreachable: the last tier bound is Infinity.
  return EFFECT_RADIUS_PLANNING_M[EFFECT_RADIUS_PLANNING_M.length - 1].radiusM
}

/**
 * WEZ kind when the spec does not set one. One-way airframes put the effect
 * at the impact point; a platform with a release standoff draws a ring around
 * itself; everything else (ISR, decoy) has no weapon zone.
 */
export function defaultWeaponProfile(uas: UasSpec): 'impact' | 'standoff' | 'none' {
  if (uas.weaponProfile) return uas.weaponProfile
  if (uas.airframe === 'one-way-attack' || uas.airframe === 'fpv' || uas.oneWay) return 'impact'
  if (uas.standoffRangeM != null) return 'standoff'
  return 'none'
}
