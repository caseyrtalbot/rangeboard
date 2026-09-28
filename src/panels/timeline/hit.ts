/**
 * Run timeline hit test: the item under the pointer, from the layout lines and
 * a run time. Pure: no React, no DOM. Plot converts the pointer to a run time
 * with the pan wrapper's on-screen box, so a glide in progress adds no offset.
 */

import type { RunTimelineMark, RunTimelineRow, RunTimelineSpan } from '../../analysis/runTimeline'
import type { Placed } from './layout'

/** A mark takes the pointer this far either side of its time, px (the mockup's 12 px target). */
export const MARK_HIT_PX = 6

/** One item as the model holds it; a summary or fold line hits a member row. */
export type RunTimelineHit =
  | { t: 'mark'; row: RunTimelineRow; mark: RunTimelineMark }
  | { t: 'span'; row: RunTimelineRow; span: RunTimelineSpan }

/** The line that contains `yPx` from the plot top. Lines are in y order. */
export function lineAt(lines: readonly Placed[], yPx: number): Placed | null {
  let lo = 0
  let hi = lines.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const line = lines[mid]
    if (yPx < line.y) hi = mid - 1
    else if (yPx >= line.y + line.h) lo = mid + 1
    else return line
  }
  return null
}

function rowsOf(line: Placed): readonly RunTimelineRow[] {
  switch (line.t) {
    case 'row':
    case 'sub':
      return [line.row]
    case 'summary':
    case 'fold':
      return line.rows
    case 'group':
      return []
  }
}

/**
 * The nearest mark within MARK_HIT_PX of `tS`, else the span drawn on top at
 * `tS`. A row draws its spans in list order and its marks over them, and a
 * later row draws over an earlier one, so a tie goes to the later item. Null
 * over a group header, past the last line, or where the line draws nothing.
 */
export function hitAt(
  lines: readonly Placed[],
  tS: number,
  yPx: number,
  pxPerS: number,
): RunTimelineHit | null {
  if (!(pxPerS > 0) || !Number.isFinite(tS)) return null
  const line = lineAt(lines, yPx)
  if (!line) return null
  const rows = rowsOf(line)
  const reach = MARK_HIT_PX / pxPerS
  let best: RunTimelineHit | null = null
  let bestD = Infinity
  for (const row of rows) {
    for (const mark of row.marks) {
      const d = Math.abs(mark.tS - tS)
      if (d <= reach && d <= bestD) {
        best = { t: 'mark', row, mark }
        bestD = d
      }
    }
  }
  if (best) return best
  for (let i = rows.length - 1; i >= 0; i--) {
    const { spans } = rows[i]
    for (let j = spans.length - 1; j >= 0; j--) {
      const span = spans[j]
      if (span.startS <= tS && tS <= span.endS) return { t: 'span', row: rows[i], span }
    }
  }
  return null
}
