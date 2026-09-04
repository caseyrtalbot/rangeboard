/**
 * The one rule every panel applies before it reads a Monte Carlo summary,
 * and the sub-line formats the tiles share. A summary is current only when
 * the run finished and it belongs to the run id on the playhead; a stale,
 * running or idle slice reads as no summary.
 */
import { formatTime } from '../../../geometry/geo'
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

/** Sub line for a time Stat: `p10 to p90 · 0:12 to 0:18`; null with no finite sample. */
export function timeSub(stat: Stat): string | null {
  if (stat.n === 0) return null
  return `p10 to p90 · ${formatTime(stat.p10)} to ${formatTime(stat.p90)}`
}

/** The band index of sim time t, clamped to the band length. */
export function bandStep(t: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(t / DT)))
}
