import { memo, type ReactNode } from 'react'
import type { RunTimelineMark, RunTimelineRow, RunTimelineSpan } from '../../analysis/runTimeline'
import { assignLabelMinPx, durationText, LABEL_MIN_PX, RAMP, spanBox } from './layout'

/**
 * Kind inks: the strip's tokens (the .runtl rules in index.css). In the dark
 * theme they are the board's `KIND_INK`, so a row reads like its glyph; the
 * daylight theme darkens them to clear 3:1 on the paper panel.
 */
const SENSOR_INK = 'var(--runtl-sensor)'
const C2_INK = 'var(--runtl-c2)'
const EFFECTOR_INK = 'var(--runtl-effector)'

/** Hold chunk opacity: track quality 0..1 maps to 0.3..1, as the mockup shades it. */
function holdOpacity(level: RunTimelineSpan['level']): number | undefined {
  if (typeof level !== 'number') return undefined
  return 0.3 + 0.7 * Math.min(1, Math.max(0, level))
}

function spanEl(
  span: RunTimelineSpan,
  key: string,
  row: RunTimelineRow,
  y: number,
  h: number,
  pxPerS: number,
  summary: boolean,
  hatch: string,
): ReactNode {
  const { x, w } = spanBox(span, pxPerS)
  const cls = `runtl-s runtl-s-${span.kind}`
  const mid = y + h / 2
  const box = (by: number, bh: number, props: Record<string, string | number | undefined>) => (
    <rect
      key={key}
      className={cls}
      x={x}
      y={by}
      width={Math.max(1, w)}
      height={bh}
      shapeRendering="crispEdges"
      {...props}
    />
  )
  switch (span.kind) {
    case 'hold':
      return box(y + 3, h - 6, { fill: SENSOR_INK, opacity: holdOpacity(span.level) })
    case 'coast':
      return box(y + 2.5, h - 5, {
        fill: 'none',
        stroke: SENSOR_INK,
        strokeDasharray: '3 2',
      })
    case 'classify': {
      const fill = typeof span.level === 'string' ? RAMP[span.level] : RAMP.unknown
      // A track row carries a thin ramp; the threat row a full one.
      return row.kind === 'track' ? box(mid - 2.5, 5, { fill }) : box(y + 4, h - 8, { fill })
    }
    case 'window':
      return box(y + h - 4, 2.5, { fill: 'var(--accent)' })
    case 'prep':
      return box(y + 4, h - 8, { fill: hatch, stroke: 'var(--warn)', strokeWidth: 0.5 })
    case 'flight':
    case 'burst':
    case 'dwell': {
      const fill =
        span.kind === 'flight'
          ? 'var(--accent)'
          : span.kind === 'dwell'
            ? 'var(--runtl-ew)'
            : 'var(--runtl-de)'
      const bar = box(y + 4, h - 8, { fill })
      if (summary || w < LABEL_MIN_PX) return bar
      return (
        <g key={key}>
          {bar}
          <text className="runtl-dur" x={x + 4} y={mid + 4}>
            {durationText(span.endS - span.startS)}
          </text>
        </g>
      )
    }
    case 'undetected':
    case 'ghost':
      return (
        <line
          key={key}
          className={cls}
          x1={x}
          x2={x + w}
          y1={mid}
          y2={mid}
          stroke={span.kind === 'ghost' ? 'var(--runtl-ghost)' : 'var(--runtl-quiet)'}
          strokeWidth={2}
          strokeDasharray={span.kind === 'ghost' ? '3 3' : undefined}
        />
      )
  }
}

const diamond = (cx: number, cy: number) =>
  `M${cx} ${cy - 4}L${cx + 4} ${cy}L${cx} ${cy + 4}L${cx - 4} ${cy}Z`

/** A mark glyph at its absolute x, with the inks of the old strip and the mockup. */
function markGlyph(mark: RunTimelineMark, row: RunTimelineRow, cx: number, y: number, h: number) {
  const cy = y + h / 2
  const cls = `runtl-m runtl-m-${mark.kind}`
  switch (mark.kind) {
    case 'detect':
      return <circle className={cls} cx={cx} cy={cy} r={2.5} fill={SENSOR_INK} />
    case 'init':
      // The C2 row ticks each fused-track init; the track row rings it.
      return row.kind === 'c2' ? (
        <line className={cls} x1={cx} x2={cx} y1={cy - 4} y2={cy + 4} stroke={C2_INK} />
      ) : (
        <circle
          className={cls}
          cx={cx}
          cy={cy}
          r={3}
          fill="var(--bg-panel)"
          stroke={C2_INK}
          strokeWidth={1.5}
        />
      )
    case 'firm':
      return <circle className={cls} cx={cx} cy={cy} r={2.5} fill={C2_INK} />
    case 'drop':
      return (
        <path
          className={cls}
          d={`M${cx - 3} ${cy - 3}L${cx + 3} ${cy + 3}M${cx - 3} ${cy + 3}L${cx + 3} ${cy - 3}`}
          stroke="var(--runtl-ghost)"
          strokeWidth={1.5}
        />
      )
    case 'assign':
      return (
        <path
          className={cls}
          d={diamond(cx, cy)}
          fill="var(--bg-panel)"
          stroke={EFFECTOR_INK}
          strokeWidth={1.5}
        />
      )
    case 'release':
      return (
        <path
          className={cls}
          d={`M${cx - 3.5} ${cy + 3.5}L${cx} ${cy - 3.5}L${cx + 3.5} ${cy + 3.5}Z`}
          fill="var(--text)"
        />
      )
    case 'shot':
      return <line className={cls} x1={cx} x2={cx} y1={y + 3} y2={y + h - 3} stroke="var(--text)" />
    case 'hard-kill':
    case 'arrival':
      return <path className={cls} d={diamond(cx, cy)} fill="var(--danger)" />
    case 'mission-kill':
      return <path className={cls} d={diamond(cx, cy)} fill="var(--runtl-ew)" />
    case 'miss':
    case 'jam-decision':
    case 'cpa': {
      const stroke =
        mark.kind === 'miss'
          ? 'var(--runtl-ghost)'
          : mark.kind === 'cpa'
            ? 'var(--runtl-cpa)'
            : 'var(--runtl-ew)'
      return (
        <path
          className={cls}
          d={diamond(cx, cy)}
          fill="var(--bg-panel)"
          stroke={stroke}
          strokeWidth={1.5}
        />
      )
    }
  }
}

/**
 * A mark with its printed text: C2 assignments name the effector when `gapPx`,
 * the room to the next mark in the row, holds the label (`assignLabelMinPx`);
 * effector rows print `after` when the gap is at least LABEL_MIN_PX.
 */
function markEl(
  mark: RunTimelineMark,
  key: string,
  row: RunTimelineRow,
  y: number,
  h: number,
  pxPerS: number,
  summary: boolean,
  gapPx: number,
): ReactNode {
  const cx = mark.tS * pxPerS
  const cy = y + h / 2
  const glyph = markGlyph(mark, row, cx, y, h)
  if (summary) return <g key={key}>{glyph}</g>
  let label: ReactNode = null
  if (
    row.kind === 'c2' &&
    mark.kind === 'assign' &&
    mark.text &&
    gapPx >= assignLabelMinPx(mark.text)
  ) {
    label = (
      <text className="runtl-label dim" x={cx + 6} y={cy + 4}>
        {mark.text}
      </text>
    )
  } else if (row.kind === 'effector' && mark.after && gapPx >= LABEL_MIN_PX) {
    // Rounds left sit in a chip after the release; pk follows the effect.
    label =
      mark.kind === 'release' ? (
        <>
          <rect
            className="runtl-chip"
            x={cx + 6}
            y={cy - 6.5}
            width={Math.round(7 + mark.after.length * 6.6)}
            height={13}
          />
          <text className="runtl-label" x={cx + 9.5} y={cy + 4}>
            {mark.after}
          </text>
        </>
      ) : (
        <text className="runtl-label" x={cx + 7} y={cy + 4}>
          {mark.after}
        </text>
      )
  }
  return (
    <g key={key}>
      {glyph}
      {label}
    </g>
  )
}

/**
 * One row's spans, then its marks over them, at absolute run-time pixels. The
 * row object comes from the model as is: a fully reached row keeps its
 * identity, so this memo skips it on the next horizon. A summary draws at the
 * summary row's y with no printed text.
 */
export const LaneItems = memo(function LaneItems({
  row,
  y,
  h,
  pxPerS,
  hatch,
  summary = false,
}: {
  row: RunTimelineRow
  y: number
  h: number
  pxPerS: number
  /** `url(#…)` of the plot's preparation hatch pattern. */
  hatch: string
  summary?: boolean
}) {
  return (
    <g className="runtl-lane">
      {row.spans.map((span, i) => spanEl(span, `s${i}`, row, y, h, pxPerS, summary, hatch))}
      {row.marks.map((mark, i) => {
        // Marks are sorted by time (laneOf); the last one has the row to itself.
        const next = row.marks[i + 1]
        const gapPx = next == null ? Infinity : (next.tS - mark.tS) * pxPerS
        return markEl(mark, `m${i}`, row, y, h, pxPerS, summary, gapPx)
      })}
    </g>
  )
})
