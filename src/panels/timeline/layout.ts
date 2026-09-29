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
const ROW_H = 18
/** Sensor sub-lane height, px. */
const SUB_H = 14

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

type LineState = Pick<
  RunTimelineUi,
  'openGroups' | 'openSensors' | 'openSensorsAll' | 'openFolds' | 'hiddenRows'
>

/**
 * Groups in model order. A collapsed group is its header and one summary row;
 * an expanded group lists its visible rows, the threat group through the fold.
 * A sensor row is open when listed, or when Expand all is in force and the row
 * holds a track at this horizon, so a row that gains its first track opens.
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
    const subs = row.subLanes
    const open =
      subs != null &&
      ((state.openSensorsAll && subs.length > 0) || state.openSensors.includes(row.key))
    push({ t: 'row', key: row.key, row, open, inFold }, ROW_H)
    if (open) for (const sub of subs) push({ t: 'sub', key: sub.key, row: sub }, SUB_H)
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
      // The label counts the shown members, so a hidden member leaves the count.
      const label = `${entry.base} ×${members.length}`
      push({ t: 'fold', key: entry.key, label, rows: members, open: foldOpen }, ROW_H)
      if (foldOpen) for (const row of members) pushRow(row, true)
    }
  }
  return { lines, heightPx: y, hiddenCount }
}

/** The sensor rows open on screen: row lines that draw their sub-lanes. */
export function openSensorKeys(lines: readonly Placed[]): string[] {
  const keys: string[] = []
  for (const line of lines) if (line.t === 'row' && line.open) keys.push(line.key)
  return keys
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

/**
 * The playhead's absolute run-time x, px. At the run end the plot's right edge
 * would clip it, so it stops one pixel inside. Unrounded, like the pan and the
 * marks, so it sits on a mark at the same time.
 */
export function playheadX(tS: number, durationS: number, pxPerS: number): number {
  return Math.max(0, Math.min(tS * pxPerS, durationS * pxPerS - 1))
}

/**
 * Engagement spans print their duration once this wide, px (SPEC 1.5). An
 * effector mark prints its rounds-left chip or pk once the gap to the next
 * mark in its row is this wide.
 */
export const LABEL_MIN_PX = 44

/** Advance of one mono character at the 11 px dense size, px (0.6 em, as the chip sizes it). */
const MONO_CHAR_PX = 6.6

/**
 * The gap a C2 assign label needs to the next mark in its row, px: the 6 px
 * offset from its glyph, the label's estimated mono width, and 6 px so it ends
 * clear of the next glyph (its 4 px half width plus 2 px). Never under
 * LABEL_MIN_PX, the effector rule.
 */
export function assignLabelMinPx(text: string): number {
  return Math.max(LABEL_MIN_PX, Math.ceil(12 + text.length * MONO_CHAR_PX))
}

/** A span's duration as printed on it. */
export function durationText(s: number): string {
  return s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`
}

/** Rows drawn past each edge of the scroll view, px: at least this much. */
export const MIN_OVERSCAN_PX = 120

/**
 * The lines to draw for a scroll view: indices `first` to `last` (exclusive)
 * of every line whose y range meets `topPx - overscan` to
 * `topPx + heightPx + overscan`. The overscan is one view height, at least
 * `MIN_OVERSCAN_PX`. Lines are in y order with no gap, so a binary search
 * finds each end; the layout keeps every line and a drawn line keeps its y.
 */
export function lineWindow(
  lines: readonly Placed[],
  topPx: number,
  heightPx: number,
): { first: number; last: number } {
  const over = Math.max(MIN_OVERSCAN_PX, heightPx)
  const lo = topPx - over
  const hi = topPx + heightPx + over
  // The first line that ends below lo.
  let a = 0
  let b = lines.length
  while (a < b) {
    const mid = (a + b) >>> 1
    if (lines[mid].y + lines[mid].h <= lo) a = mid + 1
    else b = mid
  }
  const first = a
  // The first line that starts at or below hi.
  b = lines.length
  while (a < b) {
    const mid = (a + b) >>> 1
    if (lines[mid].y < hi) a = mid + 1
    else b = mid
  }
  return { first, last: a }
}

/** Classification ramp: one hue, stepped light to dark (unknown, suspected, hostile). */
export const RAMP = {
  unknown: 'color-mix(in srgb, var(--danger) 25%, var(--bg-panel))',
  suspected: 'color-mix(in srgb, var(--danger) 55%, var(--bg-panel))',
  hostile: 'var(--danger)',
} as const
