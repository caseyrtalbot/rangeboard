import { useEffect, useMemo, useRef, useState } from 'react'
import type { UncertainField } from '../analysis/parameterBasis'
import type { BootstrapInterval, SobolResult } from '../playback/mcTypes'
import { readTokens, resolveColor } from './tokens'

interface SobolChartProps {
  result: SobolResult
  /** Row label for one field; the chart never reads the store. */
  labelOf: (field: UncertainField) => string
  /** Explicit px; absent = fill the container width. */
  width?: number
  /** Default 24: two 7 px bars and the gap between them. */
  rowHeight?: number
}

/**
 * The gutter holds a model name and a field key:
 * 24 characters of 11 px mono at about 6 px each from a 2 px inset. A longer label is cut
 * in the middle, not at the end, because the field key is the identity and the model name
 * is context; the hidden ranking block below the svg carries every label whole.
 */
const GUTTER_W = 150
const LABEL_CHARS = 24
const TAIL_CHARS = 14
/** Reserve at the right of the scale for the index value in 11 px mono. */
const VALUE_W = 34
const RIGHT_PAD = 6
const BAR_H = 7
const BAR_GAP = 3
const BAR_MIN_W = 1.5
/** Half-height of a whisker cap. */
const CAP_H = 3
/** Room above the first row for the scale ticks. */
const TOP = 14
const FALLBACK_W = 312
/** The scale is a share of variance, so it is fixed. */
const TICKS = [0, 0.5, 1]

/** A gutter label cut to LABEL_CHARS around a middle ellipsis, tail favoured. */
function gutterLabel(label: string): string {
  if (label.length <= LABEL_CHARS) return label
  const head = LABEL_CHARS - TAIL_CHARS - 1
  return `${label.slice(0, head)}…${label.slice(label.length - TAIL_CHARS)}`
}

/** An index in 11 px mono: two places, no unit, because every value is a share. */
function formatIndex(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : 'n/a'
}

/** A share clamped to the scale. A Saltelli estimate can fall outside it. */
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

/** Whether either bound of this interval left the scale. */
const outOfScale = (i: BootstrapInterval) => i.lo < 0 || i.hi > 1 || i.value < 0 || i.value > 1

/**
 * The method line: what was run and on what. `bootstrap` and `confidence` ride on every
 * interval, so the first ranked field states them for the chart.
 */
function sobolCopy(result: SobolResult, clamped: number): string {
  const first = result.fields[result.ranking[0]]?.total
  const b = first ? first.bootstrap : 0
  const c = first ? Math.round(first.confidence * 100) : 0
  const method = `Sobol first-order and total indices · Saltelli, base ${result.base}, ${result.fields.length} fields, ${result.evaluations} runs · bootstrap ${b} resamples, ${c} percent`
  if (clamped === 0) return method
  return `${method} · ${clamped} bound${clamped === 1 ? '' : 's'} clamped to [0, 1]`
}

/** The ranking as one sentence per row, for the hidden block and the aria label. */
function rankingSentence(
  rank: number,
  label: string,
  row: { firstOrder: BootstrapInterval; total: BootstrapInterval },
): string {
  const say = (i: BootstrapInterval) =>
    `${formatIndex(i.value)} (${formatIndex(i.lo)} to ${formatIndex(i.hi)})`
  return `${rank}. ${label}: total ${say(row.total)}, first-order ${say(row.firstOrder)}.`
}

/** ChartFrame's visually hidden block; the same inline rule, so no new class. */
const HIDDEN = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
} as const

/**
 * Sobol indices as ranked horizontal bars: one row per field in `result.ranking` order,
 * the total index on top in `chart-1` and the first-order index under it in `chart-2`,
 * each with its bootstrap interval drawn as a whisker on its own centreline.
 *
 * Two bars, not one nested pair: each index carries its own interval, and a whisker has to
 * sit on the centreline of the bar it belongs to. Nested, both whiskers share one 8 px
 * band and the first-order upper bound can run past the end of the total bar, which reads
 * as a drawing error rather than as a bootstrap spread.
 *
 * Plain SVG: Recharts has no row-span primitive and gives a
 * non-Recharts child no width, so the chart owns its shell and measures its host.
 */
export function SobolChart({ result, labelOf, width, rowHeight = 24 }: SobolChartProps) {
  const tokens = useMemo(() => readTokens(), [])
  const hostRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(0)

  // The container width is read, never polled.
  useEffect(() => {
    if (width != null) return
    const el = hostRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setMeasured(el.clientWidth))
    ro.observe(el)
    setMeasured(el.clientWidth)
    return () => ro.disconnect()
  }, [width])

  const rows = result.ranking.map((i) => result.fields[i]).filter((r) => r != null)
  const clamped = rows.reduce(
    (n, r) => n + (outOfScale(r.firstOrder) ? 1 : 0) + (outOfScale(r.total) ? 1 : 0),
    0,
  )
  const w = width ?? (measured > 0 ? measured : FALLBACK_W)
  const h = TOP + rows.length * rowHeight + 2
  const x0 = GUTTER_W
  const plotW = Math.max(1, w - x0 - VALUE_W - RIGHT_PAD)
  const x = (v: number) => x0 + plotW * clamp01(v)
  const font = { fontFamily: tokens.fontMono, fontSize: 11, fill: tokens.ink }
  const totalColor = resolveColor('chart-1', tokens)
  const firstColor = resolveColor('chart-2', tokens)
  const copy = sobolCopy(result, clamped)
  const sentences = rows.map((r, i) => rankingSentence(i + 1, labelOf(r.field), r))

  /** One index: the bar from zero, its whisker, and the value after the longer of the two. */
  const drawIndex = (interval: BootstrapInterval, top: number, fill: string, role: string) => {
    const mid = top + BAR_H / 2
    const bw = Math.max(BAR_MIN_W, x(interval.value) - x0)
    const lo = x(interval.lo)
    const hi = x(interval.hi)
    return (
      <>
        <rect x={x0} y={top} width={bw} height={BAR_H} rx={1} fill={fill} data-role={role} />
        <line
          x1={lo}
          y1={mid}
          x2={hi}
          y2={mid}
          stroke={tokens.color('text')}
          data-role={`${role}-ci`}
        />
        <line x1={lo} y1={mid - CAP_H} x2={lo} y2={mid + CAP_H} stroke={tokens.color('text')} />
        <line x1={hi} y1={mid - CAP_H} x2={hi} y2={mid + CAP_H} stroke={tokens.color('text')} />
        <text x={Math.max(x0 + bw, hi) + 4} y={mid} dominantBaseline="middle" style={font}>
          {formatIndex(interval.value)}
        </text>
      </>
    )
  }

  return (
    <div ref={hostRef} className="chart chart-sobol" style={width != null ? { width } : undefined}>
      <div className="chart-ylabel">{copy}</div>
      <svg
        className="chart-sobol-svg"
        role="img"
        aria-label={`${copy}. ${rows.length} fields ranked by the total index; the ranking follows as text.`}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
      >
        {TICKS.map((t) => (
          <g key={t}>
            <text x={x(t)} y={9} textAnchor="middle" style={font}>
              {formatIndex(t)}
            </text>
            <line
              x1={x(t)}
              y1={TOP - 3}
              x2={x(t)}
              y2={TOP + rows.length * rowHeight}
              stroke={tokens.ink}
              data-role="tick"
            />
          </g>
        ))}
        {rows.map((r, i) => {
          const yTop = TOP + i * rowHeight
          const band = 2 * BAR_H + BAR_GAP
          const totalTop = yTop + (rowHeight - band) / 2
          return (
            <g key={`${r.field.modelId}:${r.field.field}`} data-sobol-row={r.field.field}>
              <text
                x={2}
                y={yTop + rowHeight / 2}
                dominantBaseline="middle"
                style={{ ...font, fill: tokens.color('text') }}
              >
                {gutterLabel(labelOf(r.field))}
              </text>
              {drawIndex(r.total, totalTop, totalColor, 'total')}
              {drawIndex(r.firstOrder, totalTop + BAR_H + BAR_GAP, firstColor, 'first-order')}
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        <span>
          <i style={{ background: totalColor }} />
          Total index
        </span>
        <span>
          <i style={{ background: firstColor }} />
          First-order index
        </span>
      </div>
      <div style={HIDDEN}>
        {sentences.map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>
    </div>
  )
}
