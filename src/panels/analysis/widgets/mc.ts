/**
 * The one rule every panel applies before it reads a Monte Carlo summary,
 * and the sub-line formats the tiles share. A summary is current only when
 * the run finished and it belongs to the run id on the playhead; a stale,
 * running or idle slice reads as no summary.
 */
import type { McSummary, Stat } from '../../../playback/mcRun'
import { DT } from '../../../playback/sim'
import type { McState } from '../../../state/store'

/** The summary of a finished run for `runId`, else null. */
export function currentSummary(mc: McState, runId: string): McSummary | null {
  return mc.status === 'done' && mc.runId === runId ? mc.summary : null
}

/** A count: an integer when integral, else one decimal. */
export function formatCount(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

/** Sub line for a count band at one step: `p10 to p90 · 4 to 5`. */
export function countSub(lo: number, hi: number): string {
  return `p10 to p90 · ${formatCount(lo)} to ${formatCount(hi)}`
}

/** Half-width of a Stat interval in its unit: seconds `±12 s`, else `formatCount`. */
function halfWidthText(stat: Stat, unit: 'time' | 'count'): string {
  const h = (stat.hi - stat.lo) / 2
  if (unit === 'count') return `±${formatCount(h)}`
  return `±${h < 10 ? h.toFixed(1) : `${Math.round(h)}`} s`
}

/**
 * Sub line for a Stat mean: `±12 s (95%) · 100` (half-width at the Stat's
 * confidence, then the finite sample count); null with no finite sample.
 */
export function statSub(stat: Stat, unit: 'time' | 'count'): string | null {
  if (stat.n === 0) return null
  return `${halfWidthText(stat, unit)} (${Math.round(stat.conf * 100)}%) · ${stat.n}`
}

/** `detected in n of total` when some replicate had no value; null when every one did. */
export function definedSub(stat: Stat): string | null {
  return stat.n < stat.total ? `detected in ${stat.n} of ${stat.total}` : null
}

/** The Stat sub and the defined sub joined, for a time Stat tile; null with neither. */
export function timeStatSub(stat: Stat): string | null {
  const parts = [statSub(stat, 'time'), definedSub(stat)].filter((x) => x != null)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** The band index of sim time t, clamped to the band length. */
export function bandStep(t: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(t / DT)))
}
