/**
 * The one rule every panel applies before it reads a Monte Carlo summary,
 * and the sub-line formats the tiles share. A summary is current only when
 * the run finished and it belongs to the run id on the playhead; a stale,
 * running or idle slice reads as no summary.
 */
import type { BandSeries, McSummary, SensitivitySummary, Stat } from '../../../playback/mcRun'
import { STAT_CONF } from '../../../playback/mcRun'
import { DT } from '../../../playback/sim'
import type { McState } from '../../../state/store'

/** The summary of a finished run for `runId`, else null. */
export function currentSummary(mc: McState, runId: string): McSummary | null {
  return mc.status === 'done' && mc.runId === runId ? mc.summary : null
}

/** The summary of a finished sensitivity run for `runId`, else null. Same rule. */
export function currentSensitivity(mc: McState, runId: string): SensitivitySummary | null {
  const sens = mc.sensitivity
  return sens.status === 'done' && sens.runId === runId ? sens.summary : null
}

/** A count: an integer when integral, else one decimal. */
export function formatCount(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

/** A finite estimate only; empty bands and undefined time samples stay unavailable. */
export function statMean(stat: Stat): number | null {
  return stat.n > 0 && Number.isFinite(stat.mean) ? stat.mean : null
}

export function bandMean(band: BandSeries, i: number, n: number): number | null {
  return n > 0 && Number.isFinite(band.mean[i]) ? band.mean[i] : null
}

/** Mean CI, never the replicate quantile band. `scale` converts counts to percentages. */
export function countSub(band: BandSeries, i: number, n: number, scale = 1, unit = ''): string {
  if (bandMean(band, i, n) == null) return `MC estimate unavailable · n=${n}`
  if (n < 2) return `MC mean · CI unavailable · n=${n}`
  const h = (band.hi[i] - band.lo[i]) / 2 * scale
  if (!Number.isFinite(h)) return `MC mean · CI unavailable · n=${n}`
  return `MC mean · ±${formatCount(h)}${unit} (${Math.round(STAT_CONF * 100)}% mean CI) · n=${n}`
}

/** Undefined samples are excluded: time estimates are conditional on a finite time. */
export type StatQuantity = 'detected' | 'warning'
const QUANTITY_WORD: Record<StatQuantity, string> = {
  detected: 'detected',
  warning: 'warning time',
}

export function timeStatSub(stat: Stat, quantity: StatQuantity): string {
  const defined = `${QUANTITY_WORD[quantity]} in ${stat.n} of ${stat.total}`
  if (statMean(stat) == null) return `MC estimate unavailable · ${defined}`
  const h = (stat.hi - stat.lo) / 2
  const interval = stat.n < 2 || !Number.isFinite(h)
    ? 'CI unavailable'
    : `±${h < 10 ? h.toFixed(1) : Math.round(h)} s (${Math.round(stat.conf * 100)}% mean CI)`
  return `MC conditional mean · ${interval} · n=${stat.n} · ${defined}`
}

/** The band index of sim time t, clamped to the band length. */
export function bandStep(t: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(t / DT)))
}
