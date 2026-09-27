/**
 * Run timeline layout: the visible lines of the strip in order, with their y
 * and height, and the time-to-pixel helpers the plot shares. Pure: no React.
 * The gutter and the plot both read one line list, so they stay aligned.
 */

import type {
  RunTimelineGroup,
  RunTimelineModel,
  RunTimelineRow,
  RunTimelineSpan,
} from '../../analysis/runTimeline'
import type { RunTimelineUi } from '../../state/store'
import { foldThreats } from './fold'

/** Gutter width, px (the mockup's `--gutter`). */
export const GUTTER_W = 172
/** Row, group header, summary and fold row height, px. */
export const ROW_H = 18
/** Sensor sub-lane height, px. */
export const SUB_H = 14

export type Line =
  | { t: 'group'; key: string; group: RunTimelineGroup; open: boolean; shown: number }
  | { t: 'summary'; key: string; group: RunTimelineGroup; rows: RunTimelineRow[] }
  | { t: 'row'; key: string; row: RunTimelineRow; open: boolean; inFold: boolean }
  | { t: 'sub'; key: string; row: RunTimelineRow }
  | { t: 'fold'; key: string; label: string; rows: RunTimelineRow[]; open: boolean }

export type Placed = Line & { y: number; h: number }

export interface StripLayout {
  lines: Placed[]
  heightPx: number
  /** Model rows the session hides; `Show all (n hidden)` reads it. */
  hiddenCount: number
}

type LineState = Pick<RunTimelineUi, 'openGroups' | 'openSensors' | 'openFolds' | 'hiddenRows'>

/**
 * Groups in model order. A collapsed group is its header and one summary row;
 * an expanded group lists its visible rows, the threat group through the fold.
 */
export function stripLayout(model: RunTimelineModel, state: LineState): StripLayout {
  const hidden = new Set(state.hiddenRows)
  const lines: Placed[] = []
  let y = 0
  let hiddenCount = 0
  const push = (line: Line, h: number) => {
    lines.push({ ...line, y, h })
    y += h
  }
  const pushRow = (row: RunTimelineRow, inFold: boolean) => {
    const open = row.subLanes != null && state.openSensors.includes(row.key)
    push({ t: 'row', key: row.key, row, open, inFold }, ROW_H)
    if (open) for (const sub of row.subLanes!) push({ t: 'sub', key: sub.key, row: sub }, SUB_H)
  }
  for (const group of model.groups) {
    const visible = group.rows.filter((row) => !hidden.has(row.key))
    hiddenCount += group.rows.length - visible.length
    const open = state.openGroups.includes(group.key)
    push({ t: 'group', key: `group:${group.key}`, group, open, shown: visible.length }, ROW_H)
    if (!open) {
      push({ t: 'summary', key: `summary:${group.key}`, group, rows: visible }, ROW_H)
      continue
    }
    if (group.key !== 'threat') {
      for (const row of visible) pushRow(row, false)
      continue
    }
    // The fold reads the model's rows, so hiding a member never unfolds the group.
    for (const entry of foldThreats(group.rows)) {
      if (entry.t === 'row') {
        if (!hidden.has(entry.row.key)) pushRow(entry.row, false)
        continue
      }
      const members = entry.rows.filter((row) => !hidden.has(row.key))
      if (members.length === 0) continue
      const foldOpen = state.openFolds.includes(entry.key)
      push({ t: 'fold', key: entry.key, label: entry.label, rows: members, open: foldOpen }, ROW_H)
      if (foldOpen) for (const row of members) pushRow(row, true)
    }
  }
  return { lines, heightPx: y, hiddenCount }
}

/**
 * A span at absolute run-time pixels: x is `startS * pxPerS`. The plot's pan
 * wrapper shifts every row by `panPx`, so the viewport x is `x + panPx`, which
 * equals `xOf(viewport, widthPx)(startS)`.
 */
export function spanBox(span: RunTimelineSpan, pxPerS: number): { x: number; w: number } {
  const x = span.startS * pxPerS
  return { x, w: (span.endS - span.startS) * pxPerS }
}

/** The pan wrapper's horizontal shift for a viewport start, px. */
export function panPx(t0S: number, pxPerS: number): number {
  return -t0S * pxPerS
}

/** A span's duration as printed on it. */
export function durationText(s: number): string {
  return s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`
}
