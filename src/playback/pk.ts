import type { EffectorSpec, UasGroup, UasSpec } from '../model/types'

/** Type-baseline single-shot Pk for specs saved before the pk field existed. */
export const DEFAULT_PK: Record<EffectorSpec['effectorType'], number> = {
  interceptor: 0.8,
  gun: 0.75,
  net: 0.7,
  de: 0.8,
  hpm: 0.7,
  jammer: 0.6,
}

/** Type-baseline seconds between salvos when the spec does not set one. */
export const DEFAULT_SALVO_COOLDOWN_S: Record<EffectorSpec['effectorType'], number> = {
  interceptor: 30,
  gun: 10,
  net: 60,
  de: 15,
  hpm: 5,
  jammer: 5,
}

/** Smaller airframes are harder to hit (source: Group 1 = 0.7 ... Group 4+ = 1.0). */
export const SIZE_PENALTY: Record<UasGroup, number> = { 1: 0.7, 2: 0.8, 3: 0.9, 4: 1, 5: 1 }

/** Pk multiplier for an evading target (source: x0.7). FPV airframes are
 *  hand-flown and jink; every other airframe flies waypoints. */
export const EVASION_PENALTY = 0.7

/** Pk fraction lost at max range (PF, source formula: 30%). The falloff is
 *  linear from 1 at the launcher to 1 - FALLOFF_AT_MAX at max range. */
export const FALLOFF_AT_MAX = 0.3

/** Distance falloff: 30% Pk reduction at max range (source formula). Zero
 *  beyond max range: no envelope means no kill probability at all.
 *  `distM` is the slant range from the launcher to the intercept point. */
export function distanceFalloff(distM: number, maxRangeM: number): number {
  if (maxRangeM <= 0 || distM > maxRangeM) return 0
  return 1 - FALLOFF_AT_MAX * (distM / maxRangeM)
}

/** Inverse of distanceFalloff on [0, maxRangeM]: the slant range where the
 *  falloff equals `factor`, clamped to the envelope. */
export function falloffRangeM(factor: number, maxRangeM: number): number {
  if (maxRangeM <= 0) return 0
  const r = (maxRangeM * (1 - factor)) / FALLOFF_AT_MAX
  return Math.min(maxRangeM, Math.max(0, r))
}

/**
 * The one kinetic per-shot Pk: basePk * distanceFalloff(slantM, maxRangeM) *
 * SIZE_PENALTY[group] * (EVASION_PENALTY for an fpv airframe), clamped to
 * [0, 1]. Pure; the footprint style imports it for the commit ring.
 */
export function kineticPk(
  basePk: number,
  maxRangeM: number,
  uas: UasSpec | undefined,
  slantM: number,
): number {
  const falloff = distanceFalloff(slantM, maxRangeM)
  const size = uas ? SIZE_PENALTY[uas.group] : 1
  const evasion = uas?.airframe === 'fpv' ? EVASION_PENALTY : 1
  return Math.min(1, Math.max(0, basePk * falloff * size * evasion))
}

/**
 * Miss-distance 1 sigma, meters: the root sum square of the track prediction
 * error at the intercept time (`ShotAccepted.predictionSigmaM`) and the
 * effector's own guidance noise. Null on the truth path (no prediction
 * error), so the caller keeps the Phase 2 Pk unchanged. A pure hook for
 * Phase 3 lane 3.5, which maps the miss distance to a Pk; kineticPk does not
 * read it in this phase.
 */
export function missDistanceSigmaM(
  predictionSigmaM: number | null,
  guidanceNoiseM: number,
): number | null {
  if (predictionSigmaM == null) return null
  return Math.hypot(predictionSigmaM, guidanceNoiseM)
}

/**
 * Kill-shot Pk penalty against a ship inbound under a 'continue' jam: the
 * denied GNSS/RF link silences emissions and degrades the track, so the
 * firing solution suffers. Planning factor on the source's 30% falloff scale.
 */
export const CONTINUE_TRACK_DEGRADE = 0.3

/**
 * Expected-survival cutoff (shoot-look doctrine). A ship whose effective
 * survival — alive discounted by kill salvos already in flight at it — falls
 * below this is expected dead: no kill or jam salvo targets it again, and a
 * threat with every ship below the cutoff draws no further fire. The same
 * threshold caps 'continue' jamming: once a ship's un-jammed probability
 * (discounted by jam salvos in flight) falls below it, the track is
 * saturated and jam salvos stop.
 */
export const SHIP_DEAD_BELOW = 0.05

/** Effector types whose success destroys the airframe (vs a jammer soft kill). */
export function isHardKill(effectorType: EffectorSpec['effectorType']): boolean {
  return effectorType !== 'jammer'
}

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
