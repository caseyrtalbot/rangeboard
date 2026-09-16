import type { AarSummary, EnvironmentSpec } from '../model/types'
import type { ExpenditureChannel } from '../playback/pk'
import type { AttritionTotals } from '../playback/attritionReport'
import { formatSpeed } from '../geometry/geo'
import type { DisplayUnits } from '../geometry/geo'

/**
 * THE EXPENDITURE VOCABULARY. Every surface that prints what a salvo cost
 * uses these three words, so a directed-energy burst can never read as a
 * round fired. The split is by effector class, not by kill channel:
 * interceptor, gun, and net spend kinetic rounds; DE and HPM spend
 * directed-energy bursts and are still hard kills; a jammer spends an EW
 * salvo and is the only soft-kill channel.
 *
 * CHANNEL_SHORT is the compact register for stat lines and count strips.
 * CHANNEL_LABEL is the prose register for table labels and hover titles. Both
 * name the same three channels, so the two never disagree.
 */
export const CHANNEL_SHORT: Record<ExpenditureChannel, string> = {
  kinetic: 'kin',
  'directed-energy': 'DE',
  ew: 'EW',
}

export const CHANNEL_LABEL: Record<ExpenditureChannel, string> = {
  kinetic: 'kinetic',
  'directed-energy': 'directed energy',
  ew: 'EW',
}

/** The three counts any expenditure surface reads, whatever carries them. */
interface ExpenditureCounts {
  /** Kinetic salvos (interceptor, gun, net). */
  shotsFired: number
  /** Directed-energy bursts (DE, HPM). Absent on older pins. */
  deSalvos?: number
  /** EW salvos (jammer). Absent on older pins. */
  jamSalvos?: number
}

/**
 * Non-zero expenditure parts in channel order: "2 kin", "4 DE", "3 EW". A
 * channel that spent nothing is left out, so a kinetic-only run does not
 * carry two zeros across a 320 px panel.
 */
export function expenditureParts(e: ExpenditureCounts): string[] {
  return [
    e.shotsFired > 0 ? `${e.shotsFired} ${CHANNEL_SHORT.kinetic}` : null,
    (e.deSalvos ?? 0) > 0 ? `${e.deSalvos} ${CHANNEL_SHORT['directed-energy']}` : null,
    (e.jamSalvos ?? 0) > 0 ? `${e.jamSalvos} ${CHANNEL_SHORT.ew}` : null,
  ].filter((part): part is string => part != null)
}

/** Every channel, zeros included: the fixed-field register for a KPI tile. */
export function expenditureBreakdown(e: ExpenditureCounts): string {
  return [
    `${e.shotsFired} ${CHANNEL_SHORT.kinetic}`,
    `${e.deSalvos ?? 0} ${CHANNEL_SHORT['directed-energy']}`,
    `${e.jamSalvos ?? 0} ${CHANNEL_SHORT.ew}`,
  ].join(' · ')
}

/** Total salvos across the three expenditure channels. */
export function totalSalvos(e: ExpenditureCounts): number {
  return e.shotsFired + (e.deSalvos ?? 0) + (e.jamSalvos ?? 0)
}

export function expectedCount(value: number): string {
  return value.toFixed(value < 10 ? 2 : 1)
}

/**
 * Residual KPI text from the DISPLAY leaker figure.
 *
 * reportedLeakers is null when the laydown places no defended asset: nothing
 * can leak past an asset that is not there, so the residual has no
 * denominator with a meaning. That case reads as a dash and says why, because
 * a confident 0.0% reads as a perfect defence. The partition term
 * expectedLeakers is 0 for the same run, which is why no surface prints it.
 */
export function residualHeadline(totals: Pick<AttritionTotals, 'reportedLeakers' | 'raidSize'>): {
  value: string
  sub: string
  bad: boolean
} {
  const leakers = totals.reportedLeakers
  if (leakers == null) {
    return { value: '—', sub: 'no defended asset placed', bad: false }
  }
  const pct = totals.raidSize > 0 ? (leakers / totals.raidSize) * 100 : 0
  return {
    value: `${pct.toFixed(1)}%`,
    sub: `${leakers.toFixed(2)} of ${totals.raidSize} ships`,
    bad: pct > 5,
  }
}

/** Collapsed-section residual headline. Same measurability rule as the tile. */
export function residualSectionHeadline(totals: Pick<AttritionTotals, 'reportedLeakers'>): string {
  return totals.reportedLeakers == null
    ? 'residual not measurable'
    : `${totals.reportedLeakers.toFixed(2)} expected residual`
}

/**
 * Collapsed-header summary of the active covariates: "Rain · Night · Urban EM
 * · 12 m/s", or "Standard day" when nothing derates. Only the covariates that
 * change sensor or threat performance appear; temperature and elevation stay
 * inside the section body.
 */
export function environmentHeadline(env: EnvironmentSpec, units: DisplayUnits = 'metric'): string {
  const parts: string[] = []
  const precip = env.precipitation ?? 'clear'
  if (precip === 'rain') parts.push('Rain')
  if (precip === 'fog') parts.push('Fog')
  if ((env.light ?? 'day') === 'night') parts.push('Night')
  if ((env.emBackground ?? 'rural') === 'urban') parts.push('Urban EM')
  if (env.windSpeedMps > 0) parts.push(formatSpeed(env.windSpeedMps, units))
  return parts.length > 0 ? parts.join(' · ') : 'Standard day'
}

/**
 * AAR headline uses expected counts. AarSummary.expectedLeakers
 * carries UNDEFEATED ships (the leaker bucket plus the never-arrived bucket),
 * so the word is never "leakers": that would claim an arrival.
 */
export function aarHeadline(aar: Pick<AarSummary, 'expectedKills' | 'expectedLeakers'>): string {
  return `${expectedCount(aar.expectedKills)} expected kills · ${expectedCount(aar.expectedLeakers)} expected survivors`
}
