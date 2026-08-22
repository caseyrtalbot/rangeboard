import type { AarSummary, EnvironmentSpec } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { ThreatAttrition } from '../playback/attrition'
import { formatTime } from '../geometry/geo'

/**
 * Collapsed-header summary of the active covariates: "Rain · Night · Urban EM
 * · 12 m/s", or "Standard day" when nothing derates. Only the covariates that
 * change sensor or threat performance appear; temperature and elevation stay
 * inside the section body.
 */
export function environmentHeadline(env: EnvironmentSpec): string {
  const parts: string[] = []
  const precip = env.precipitation ?? 'clear'
  if (precip === 'rain') parts.push('Rain')
  if (precip === 'fog') parts.push('Fog')
  if ((env.light ?? 'day') === 'night') parts.push('Night')
  if ((env.emBackground ?? 'rural') === 'urban') parts.push('Urban EM')
  if (env.windSpeedMps > 0) parts.push(`${env.windSpeedMps} m/s`)
  return parts.length > 0 ? parts.join(' · ') : 'Standard day'
}

/**
 * Magazine headline: "12 shots · 3 of 20 remaining". Finite magazines sum
 * across effectors; when every effector is unlimited (jammers, DE) the tail
 * reads "unlimited". A tracked remainder without a known magazine size drops
 * the "of N" part rather than inventing one.
 */
export function magazinesHeadline(
  aar: Pick<AarSummary, 'shotsFired' | 'effectors'>,
): string {
  const shots = `${aar.shotsFired} shot${aar.shotsFired === 1 ? '' : 's'}`
  const finite = aar.effectors.filter((e) => e.expectedRoundsRemaining != null)
  if (finite.length === 0) return `${shots} · unlimited`
  const left = finite.reduce((s, e) => s + (e.expectedRoundsRemaining ?? 0), 0)
  const sized = finite.every((e) => e.magazineSize != null)
  const size = finite.reduce((s, e) => s + (e.magazineSize ?? 0), 0)
  return sized
    ? `${shots} · ${left} of ${size} remaining`
    : `${shots} · ${left} remaining`
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
