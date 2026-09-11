import type { EffectorSpec } from '../../model/types'

/**
 * Beam effectors: what a directed-energy or HPM salvo spends. Today no
 * separate DE or HPM kill model exists; both share the kinetic Pk in
 * kinetic.ts with their type-baseline tables. Lane 3.6 adds here, with
 * directedEnergy.ts and hpm.ts: DE irradiance from `outputPowerKw`,
 * `beamQualityM2`, `jitterUrad` and `apertureM`; dwell to effect per airframe
 * class scaled from `dwellToEffectS`; slew and settle; HPM field strength
 * from `fieldStrengthVm` at `fieldStrengthRangeM` against a susceptibility
 * threshold per airframe class, `beamwidthDeg` and `rechargeS`. A dwell
 * requests its fine sweep step on the engagement clock (clock.ts
 * `SweepClock.requestFineStep`) at the salvo commit in attrition.ts.
 */

/** What a salvo costs the battery, as opposed to how it kills. */
export type ExpenditureChannel = 'kinetic' | 'directed-energy' | 'ew'

const EXPENDITURE_CHANNEL: Record<EffectorSpec['effectorType'], ExpenditureChannel> = {
  interceptor: 'kinetic',
  gun: 'kinetic',
  net: 'kinetic',
  de: 'directed-energy',
  hpm: 'directed-energy',
  jammer: 'ew',
}

/**
 * Expenditure channel of an effector type: what the salvo spent, distinct from
 * isHardKill (what it destroys). A DE or HPM burst is a hard kill that fires no
 * round, so it must not join the kinetic count.
 */
export function expenditureChannel(
  effectorType: EffectorSpec['effectorType'],
): ExpenditureChannel {
  return EXPENDITURE_CHANNEL[effectorType]
}
