import type { AarSummary, EnvironmentSpec } from '../model/types'
import { formatSpeed } from '../geometry/geo'
import type { DisplayUnits } from '../geometry/geo'

function expectedCount(value: number): string {
  return value.toFixed(value < 10 ? 2 : 1)
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
export function aarHeadline(
  aar: Pick<AarSummary, 'expectedKills' | 'expectedLeakers'>,
): string {
  return `${expectedCount(aar.expectedKills)} expected kills · ${expectedCount(aar.expectedLeakers)} expected survivors`
}

