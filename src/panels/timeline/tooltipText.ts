/**
 * Run timeline tooltip text (SPEC 1.4, 1.5): what the model holds for one item,
 * in words and exact times. Pure: no React, no DOM. It shows only the fields
 * the item carries and never fills a missing value.
 */

import type { RunTimelineMark, RunTimelineModel, RunTimelineSpan } from '../../analysis/runTimeline'
import { formatTime } from '../../geometry/geo'
import type { RunTimelineHit } from './hit'
import { durationText } from './layout'

export interface TooltipText {
  /** The item kind in words; bold. */
  title: string
  /** The row label. */
  subject: string
  /** Words from the model: a mark's text, a span's label. */
  notes: string[]
  /** Machine data, mono: the times, a duration, quality, pk, rounds left. */
  data: string[]
  /** `Shown through T+m:ss`, the last line. */
  horizon: string
}

const MARK_TITLE: Record<RunTimelineMark['kind'], string> = {
  detect: 'Detect',
  init: 'Track init',
  firm: 'Firm track',
  drop: 'Track dropped',
  assign: 'Assignment',
  release: 'Release',
  shot: 'Shot',
  'hard-kill': 'Hard kill',
  'mission-kill': 'Mission kill',
  miss: 'Miss',
  'jam-decision': 'Jam decision',
  arrival: 'Arrival',
  cpa: 'CPA',
}

const SPAN_TITLE: Record<Exclude<RunTimelineSpan['kind'], 'classify'>, string> = {
  hold: 'Hold',
  coast: 'Coast',
  window: 'Window',
  prep: 'Preparation',
  flight: 'Flight',
  burst: 'Burst',
  dwell: 'Dwell',
  undetected: 'Undetected',
  ghost: 'Ghost',
}

const CLASS_TITLE = { unknown: 'Unknown', suspected: 'Suspected', hostile: 'Hostile' } as const

/** A run time as `T+m:ss`. */
function runTimeText(tS: number): string {
  return `T+${formatTime(tS)}`
}

/** The horizon line, as the strip header words it (SPEC 1.4). */
export function horizonText(horizonS: number): string {
  return Number.isFinite(horizonS)
    ? `Shown through ${runTimeText(horizonS)}`
    : 'No outcomes observed yet'
}

function spanTitle(span: RunTimelineSpan): string {
  if (span.kind !== 'classify') return SPAN_TITLE[span.kind]
  // A classify span without a band draws as unknown (LaneMarks, Overview).
  return typeof span.level === 'string' ? CLASS_TITLE[span.level] : CLASS_TITLE.unknown
}

/** The tooltip text for one hit item at the model horizon. */
export function tooltipText(hit: RunTimelineHit, horizonS: number): TooltipText {
  const subject = hit.row.label
  const notes: string[] = []
  const data: string[] = []
  let title: string
  if (hit.t === 'mark') {
    const { mark } = hit
    title = MARK_TITLE[mark.kind]
    if (mark.text && mark.text !== subject) notes.push(mark.text)
    data.push(runTimeText(mark.tS))
    if (mark.after) data.push(mark.after)
  } else {
    const { span } = hit
    title = spanTitle(span)
    if (span.label && span.label !== subject) notes.push(span.label)
    data.push(`${runTimeText(span.startS)} to ${runTimeText(span.endS)}`)
    data.push(durationText(span.endS - span.startS))
    if (typeof span.level === 'number') data.push(`quality ${span.level.toFixed(2)}`)
  }
  return { title, subject, notes, data, horizon: horizonText(horizonS) }
}

/** A hovered item and the model it came from. */
export interface HeldHit {
  hit: RunTimelineHit
  model: RunTimelineModel
}

/**
 * The hit the tooltip shows: the held hit while its model is current, else
 * null. A new model object holds new row, mark and span objects, so a hit from
 * the old one is stale and shows nothing.
 */
export function liveHit(held: HeldHit | null, model: RunTimelineModel): RunTimelineHit | null {
  return held && held.model === model ? held.hit : null
}
