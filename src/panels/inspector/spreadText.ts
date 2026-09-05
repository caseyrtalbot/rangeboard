import type { Spread } from '../../model/types'

/** A triangular bound as a signed percent of the nominal. */
function boundText(fraction: number): string {
  const pct = Math.round(fraction * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}

/** One spread as text: `±6 dB`, `-20% to +30%`, `17 of 20 (pseudo)`, `2 of 2 trials`. */
export function spreadText(spread: Spread): string {
  if (spread.kind === 'lognormal') return `±${spread.sigmaDb} dB`
  if (spread.kind === 'triangular') {
    return `${boundText(spread.lo)} to ${boundText(spread.hi)}`
  }
  const counts = `${spread.successes} of ${spread.trials}`
  return spread.pseudo ? `${counts} (pseudo)` : `${counts} trials`
}
