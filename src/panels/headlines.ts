import type { AarEffectorShots, AarSummary, EnvironmentSpec } from '../model/types'
import type { ImpactSeverity } from '../analysis/impact'
import type { ThreatAssessment } from '../playback/sim'
import type { ThreatAttrition } from '../playback/attrition'
import { formatSpeed, formatTime } from '../geometry/geo'
import type { DisplayUnits } from '../geometry/geo'

/** Chip styling per tier: SEVERE red, MODERATE amber, LOW neutral. */
export const TIER_CLS: Record<ImpactSeverity, string> = {
  severe: 'bad',
  moderate: 'warn',
  low: 'neutral',
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
 * Magazine headline: "12 shots · 3 of 20 remaining". Shots are kinetic
 * (non-jammer) salvos; jam salvos join as their own part when any were
 * emitted ("12 shots · 9 jam salvos · ..."). Finite magazines sum across
 * effectors; when every effector is unlimited (jammers, DE) the tail reads
 * "unlimited". A tracked remainder without a known magazine size drops the
 * "of N" part rather than inventing one.
 */
export function magazinesHeadline(
  aar: Pick<AarSummary, 'shotsFired' | 'jamSalvos' | 'effectors'>,
  mode: 'actual' | 'projected' = 'actual',
): string {
  const jam = aar.jamSalvos ?? 0
  if (mode === 'projected') {
    const shots =
      `${aar.shotsFired} projected shot${aar.shotsFired === 1 ? '' : 's'}` +
      (jam > 0 ? ` · ${jam} projected jam salvo${jam === 1 ? '' : 's'}` : '')
    const finite = aar.effectors.filter((e) => e.expectedRoundsRemaining != null)
    if (finite.length === 0) return `${shots} · unlimited capacity`
    const left = finite.reduce((s, e) => s + (e.expectedRoundsRemaining ?? 0), 0)
    const sized = finite.every((e) => e.magazineSize != null)
    const size = finite.reduce((s, e) => s + (e.magazineSize ?? 0), 0)
    return sized ? `${shots} · ${left} of ${size} after run` : `${shots} · ${left} after run`
  }
  const shots =
    `${aar.shotsFired} shot${aar.shotsFired === 1 ? '' : 's'}` +
    (jam > 0 ? ` · ${jam} jam salvo${jam === 1 ? '' : 's'}` : '')
  const finite = aar.effectors.filter((e) => e.expectedRoundsRemaining != null)
  if (finite.length === 0) return `${shots} · unlimited`
  const left = finite.reduce((s, e) => s + (e.expectedRoundsRemaining ?? 0), 0)
  const sized = finite.every((e) => e.magazineSize != null)
  const size = finite.reduce((s, e) => s + (e.magazineSize ?? 0), 0)
  return sized
    ? `${shots} · ${left} of ${size} remaining`
    : `${shots} · ${left} remaining`
}

/**
 * One effector's expenditure phrase, branching on effector TYPE, not on
 * whether salvos happened: a jammer's expenditure is jam salvos even when
 * idle ("0 jam salvos", never "0 fired"); every other type reads "N fired".
 * When the type is unknown (legacy pins), fall back to whichever count the
 * row carries: jam salvos when any were emitted, otherwise shots.
 */
export function effectorExpenditureLine(
  e: Pick<AarEffectorShots, 'shotsFired' | 'jamSalvos'> & {
    effectorType?: AarEffectorShots['effectorType']
  },
  mode: 'actual' | 'projected' = 'actual',
): string {
  const jam = e.jamSalvos ?? 0
  const jamText = `${jam} jam salvo${jam === 1 ? '' : 's'}`
  if (mode === 'projected') {
    if (e.effectorType === 'jammer') return `${jam} projected jam salvo${jam === 1 ? '' : 's'}`
    if (e.effectorType != null) {
      return `${e.shotsFired} projected shot${e.shotsFired === 1 ? '' : 's'}`
    }
    return jam > 0
      ? `${jam} projected jam salvo${jam === 1 ? '' : 's'}`
      : `${e.shotsFired} projected shot${e.shotsFired === 1 ? '' : 's'}`
  }
  if (e.effectorType === 'jammer') return jamText
  if (e.effectorType != null) return `${e.shotsFired} fired`
  return jam > 0 ? jamText : `${e.shotsFired} fired`
}

/** AAR headline: "3.2 kills · 0.8 leakers". */
export function aarHeadline(
  aar: Pick<AarSummary, 'expectedKills' | 'expectedLeakers'>,
): string {
  return `${aar.expectedKills.toFixed(1)} kills · ${aar.expectedLeakers.toFixed(1)} leakers`
}

/** Score headline: "72 / 100"; a dash when no score computes. */
export function scoreHeadline(score: number | null): string {
  return score != null ? `${score} / 100` : '—'
}

/**
 * Compact threat-row expenditure and outcome string: "2 kin · 1 jam · kill
 * 90% · leak 10%". Single ships read as probabilities; formations read as
 * expected ship counts. The leak percent is 100 minus the rounded kill
 * percent so the pair always sums to 100. "no shots" when the threat drew no
 * salvo of either channel; a dash when no attrition row exists.
 */
export function threatShotLine(
  att:
    | Pick<
        ThreatAttrition,
        'shipCount' | 'shotsFired' | 'jamSalvos' | 'expectedKills' | 'leakProbability'
      >
    | undefined,
): string {
  if (!att) return '—'
  if (att.shotsFired === 0 && att.jamSalvos === 0) return 'no shots'
  const shots = [
    att.shotsFired > 0 ? `${att.shotsFired} kin` : null,
    att.jamSalvos > 0 ? `${att.jamSalvos} jam` : null,
  ].filter(Boolean)
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
