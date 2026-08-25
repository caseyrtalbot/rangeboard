import type { AarEffectorShots, AarSummary, EnvironmentSpec } from '../model/types'
import type { ImpactSeverity } from '../analysis/impact'
import type { ThreatAssessment } from '../playback/sim'
import type {
  AttritionTotals,
  ExpenditureChannel,
  ThreatAttrition,
} from '../playback/attrition'
import { formatSpeed, formatTime } from '../geometry/geo'
import type { DisplayUnits } from '../geometry/geo'

/** Chip styling per tier: SEVERE red, MODERATE amber, LOW neutral. */
export const TIER_CLS: Record<ImpactSeverity, string> = {
  severe: 'bad',
  moderate: 'warn',
  low: 'neutral',
}

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
export interface ExpenditureCounts {
  /** Kinetic salvos (interceptor, gun, net). */
  shotsFired: number
  /** Directed-energy bursts (DE, HPM). Absent on pins made before the split. */
  deSalvos?: number
  /** EW salvos (jammer). Absent on pins made before the split. */
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

/**
 * Residual KPI text from the DISPLAY leaker figure.
 *
 * reportedLeakers is null when the laydown places no defended asset: nothing
 * can leak past an asset that is not there, so the residual has no
 * denominator with a meaning. That case reads as a dash and says why, because
 * a confident 0.0% reads as a perfect defence. The partition term
 * expectedLeakers is 0 for the same run, which is why no surface prints it.
 */
export function residualHeadline(
  totals: Pick<AttritionTotals, 'reportedLeakers' | 'raidSize'>,
): { value: string; sub: string; bad: boolean } {
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
export function residualSectionHeadline(
  totals: Pick<AttritionTotals, 'reportedLeakers'>,
): string {
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
 * Magazine headline: "12 kin · 3 of 20 remaining". Expenditure uses the
 * three-channel vocabulary, so a directed-energy burst reads as "4 DE" and
 * never as a round fired; a channel that spent nothing is left out, and a run
 * with no salvo at all reads "no salvos". Finite magazines sum across
 * effectors; when every effector is unlimited (jammers, DE, HPM) the tail
 * reads "unlimited". A tracked remainder without a known magazine size drops
 * the "of N" part rather than inventing one.
 */
export function magazinesHeadline(
  aar: Pick<AarSummary, 'shotsFired' | 'deSalvos' | 'jamSalvos' | 'effectors'>,
  mode: 'actual' | 'projected' = 'actual',
): string {
  const parts = expenditureParts(aar)
  const spent = parts.length > 0 ? parts.join(' · ') : 'no salvos'
  const finite = aar.effectors.filter((e) => e.expectedRoundsRemaining != null)
  const left = finite.reduce((s, e) => s + (e.expectedRoundsRemaining ?? 0), 0)
  const sized = finite.every((e) => e.magazineSize != null)
  const size = finite.reduce((s, e) => s + (e.magazineSize ?? 0), 0)
  if (mode === 'projected') {
    const shots = `projected ${spent}`
    if (finite.length === 0) return `${shots} · unlimited capacity`
    return sized ? `${shots} · ${left} of ${size} after run` : `${shots} · ${left} after run`
  }
  if (finite.length === 0) return `${spent} · unlimited`
  return sized ? `${spent} · ${left} of ${size} remaining` : `${spent} · ${left} remaining`
}

/**
 * One effector's expenditure phrase, branching on effector TYPE, not on
 * whether salvos happened: a jammer's expenditure is EW salvos even when idle
 * ("0 EW salvos", never "0 fired"), a DE or HPM emitter spends bursts and
 * fires no round, and every kinetic type reads "N fired". When the type is
 * unknown (legacy pins), fall back to whichever count the row carries.
 */
export function effectorExpenditureLine(
  e: Pick<AarEffectorShots, 'shotsFired' | 'deSalvos' | 'jamSalvos'> & {
    effectorType?: AarEffectorShots['effectorType']
  },
  mode: 'actual' | 'projected' = 'actual',
): string {
  const de = e.deSalvos ?? 0
  const jam = e.jamSalvos ?? 0
  const tense = mode === 'projected' ? 'projected ' : ''
  const ewText = `${jam} ${tense}EW salvo${jam === 1 ? '' : 's'}`
  const deText = `${de} ${tense}DE burst${de === 1 ? '' : 's'}`
  const kineticText =
    mode === 'projected'
      ? `${e.shotsFired} projected shot${e.shotsFired === 1 ? '' : 's'}`
      : `${e.shotsFired} fired`
  if (e.effectorType === 'jammer') return ewText
  if (e.effectorType === 'de' || e.effectorType === 'hpm') return deText
  if (e.effectorType != null) return kineticText
  if (jam > 0) return ewText
  if (de > 0) return deText
  return kineticText
}

/**
 * AAR headline: "3.2 defeated · 0.8 undefeated". AarSummary.expectedLeakers
 * carries UNDEFEATED ships (the leaker bucket plus the never-arrived bucket),
 * so calling it "leakers" claimed an arrival the run may never have had.
 */
export function aarHeadline(
  aar: Pick<AarSummary, 'expectedKills' | 'expectedLeakers'>,
): string {
  return `${aar.expectedKills.toFixed(1)} defeated · ${aar.expectedLeakers.toFixed(1)} undefeated`
}

/**
 * Compact threat-row expenditure and outcome string: "2 kin · 4 DE · 1 EW ·
 * kill 90% · leak 10%". Single ships read as probabilities; formations read
 * as expected ship counts. The leak percent is 100 minus the rounded kill
 * percent so the pair always sums to 100. "no shots" when the threat drew no
 * salvo of any channel; a dash when no attrition row exists.
 */
export function threatShotLine(
  att:
    | Pick<
        ThreatAttrition,
        | 'shipCount'
        | 'shotsFired'
        | 'deSalvos'
        | 'jamSalvos'
        | 'expectedKills'
        | 'leakProbability'
      >
    | undefined,
): string {
  if (!att) return '—'
  const shots = expenditureParts(att)
  if (shots.length === 0) return 'no shots'
  const killPct = Math.round(att.expectedKills * 100)
  const outcome =
    att.shipCount > 1
      ? `kill ${att.expectedKills.toFixed(1)} · leak ${(att.shipCount * att.leakProbability).toFixed(1)}`
      : `kill ${killPct}% · leak ${100 - killPct}%`
  return [...shots, outcome].join(' · ')
}

/**
 * Compact threat-row stat strings: warning time (m:ss), engagement window
 * length (whole seconds), leak probability (percent). Honest dashes when a
 * value never computes.
 */
export function threatCompactStats(
  a: Pick<ThreatAssessment, 'warningS' | 'windowS'>,
  att: Pick<ThreatAttrition, 'leakProbability'> | undefined,
): { warning: string; window: string; leak: string } {
  return {
    warning: a.warningS != null ? formatTime(a.warningS) : '—',
    window: a.windowS ? `${Math.round(a.windowS[1] - a.windowS[0])} s` : '—',
    leak: att ? `${Math.round(att.leakProbability * 100)}%` : '—',
  }
}
