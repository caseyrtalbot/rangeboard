/**
 * Pure series math for the time-series chart. Recharts-free on purpose: the
 * chart body sits behind a lazy boundary, and these helpers stay importable
 * from `TimeSeries.tsx` without pulling recharts into the initial graph.
 */

import { DT } from '../playback/clock'
import type { Series } from './types'

/** One Recharts row: the time plus one key per series and per band. */
export type SeriesRow = Record<string, number | [number, number] | null>

/** Duration in seconds of the longest series: (maxLen - 1) * DT. */
export function seriesDurationS(series: Series[]): number {
  let n = 0
  for (const s of series) n = Math.max(n, s.values.length)
  return Math.max(0, n - 1) * DT
}

export const finite = (v: number | undefined): v is number => v != null && Number.isFinite(v)

/** Build the Recharts rows. NaN maps to null so the line breaks at a gap. */
export function seriesRows(series: Series[]): SeriesRow[] {
  let n = 0
  for (const s of series) n = Math.max(n, s.values.length)
  const rows: SeriesRow[] = []
  for (let i = 0; i < n; i++) {
    const row: SeriesRow = { t: i * DT }
    for (const s of series) {
      const v = s.values[i]
      row[s.id] = finite(v) ? v : null
      for (const [k, band] of [['95', s.band95], ['80', s.band80]] as const) {
        if (!band) continue
        const lo = band[0][i]
        const hi = band[1][i]
        row[`${s.id}:${k}`] = finite(lo) && finite(hi) ? [lo, hi] : null
      }
    }
    rows.push(row)
  }
  return rows
}

/**
 * Y domain: the given one, else 0 (or the data minimum when negative) to the data maximum
 * plus 8 percent headroom, bands included. An empty or flat-at-zero set spans [0, 1].
 */
export function seriesRange(series: Series[], yDomain?: [number, number]): [number, number] {
  if (yDomain) return yDomain
  let lo = 0
  let hi = -Infinity
  const take = (v: number | undefined) => {
    if (!finite(v)) return
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  for (const s of series) {
    s.values.forEach(take)
    s.band95?.[1].forEach(take)
    s.band80?.[1].forEach(take)
    s.band95?.[0].forEach(take)
    s.band80?.[0].forEach(take)
  }
  if (!(hi > lo)) return [lo, lo + 1]
  return [lo, hi > 0 ? hi * 1.08 : hi]
}

/** Index of the last finite sample, or -1. */
export function lastFiniteIndex(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (finite(values[i])) return i
  return -1
}

/** Y tick label: whole numbers once the span reaches 2, else one decimal (the mockup rule). */
export function formatYTick(v: number, hi: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-6 && hi >= 2) return String(Math.round(v))
  return v.toFixed(1)
}

/** Snap a pointer time to the DT grid inside [0, durationS]. */
export function snapScrubS(t: number, durationS: number): number {
  const clamped = Math.min(durationS, Math.max(0, t))
  return Math.round(clamped / DT) * DT
}
