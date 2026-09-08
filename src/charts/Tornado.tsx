import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { FORECAST_IN_ANALYZE } from '../analysis/horizon'
import { readTokens, resolveColor } from './tokens'

export interface TornadoRow {
  id: string
  label: string
  /** Headline statistic with the field at its p10 and at its p90. */
  low: number
  high: number
  /** Rendered in the gutter after the label (a PfTag). */
  tag?: ReactNode
}

interface TornadoProps {
  /** Latest visible outcome time; undefined or Infinity shows the full run. */
  horizonS?: number
  rows: TornadoRow[]
  /** The headline statistic with every field nominal; drawn as a vertical rule. */
  nominal: number
  unit: string | null
  /** Explicit px; absent = fill the container width. */
  width?: number
  /** Default 16. */
  rowHeight?: number
}

/**
 * The gutter holds a field name such as `detectRangeM`: 12 characters of 10 px mono at
 * about 6 px each from a 2 px inset, then the tag (a PF chip needs about 24 px, an SRC
 * chip about 32 px). A longer label is cut to the budget with an ellipsis rather than
 * clipped by the SVG edge.
 */
const GUTTER_W = 110
const LABEL_CHARS = 12
const TAG_X = 76
const TAG_H = 12
/** Reserve at each end of the scale for the numeric end value in 10 px mono. */
const VALUE_W = 34
const RIGHT_PAD = 6
const BAR_H = 8
const BAR_MIN_W = 1.5
/** Room above the first row for the nominal caption. */
const TOP = 14
const FALLBACK_W = 312

/** A gutter label cut to LABEL_CHARS, ellipsis included. */
function gutterLabel(label: string): string {
  return label.length > LABEL_CHARS ? `${label.slice(0, LABEL_CHARS - 1)}…` : label
}

/** An end value in 10 px mono: three significant places, no exponent, no unit. */
function formatEnd(v: number): string {
  if (!Number.isFinite(v)) return 'n/a'
  const a = Math.abs(v)
  if (a >= 100) return v.toFixed(0)
  if (a >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

/** The shared linear domain: the nominal and every row end, padded when degenerate. */
function domainOf(rows: TornadoRow[], nominal: number): [number, number] {
  let lo = Number.isFinite(nominal) ? nominal : 0
  let hi = lo
  for (const r of rows) {
    for (const v of [r.low, r.high]) {
      if (!Number.isFinite(v)) continue
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  if (hi - lo < 1e-9) return [lo - 0.5, hi + 0.5]
  return [lo, hi]
}

/**
 * The sensitivity tornado: one bar per row from `low` to `high` on a shared linear scale
 * that includes the nominal, in the order the caller gives (the caller sorts by swing).
 * Plain SVG for the same reason the Ladder is: Recharts has no row-span primitive and
 * gives a non-Recharts child no width, so the chart owns its shell and measures its host.
 *
 * The bar is one rect per row. Its fill is a hard-stop gradient that splits at the
 * nominal, so the part of the swing below the nominal reads `--chart-2` and the part above
 * reads `--chart-1`. A bar wholly on one side of the nominal takes one color.
 */
export function Tornado({ rows, nominal, unit, width, rowHeight = 16, horizonS = Infinity }: TornadoProps) {
  const tokens = useMemo(() => readTokens(), [])
  // React ids carry punctuation that a url(#...) reference must not; keep word characters.
  const uid = useId().replace(/[^\w-]/g, '')
  const hostRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(0)

  // Same pattern as the Ladder: the container width is read, never polled.
  useEffect(() => {
    if (width != null) return
    const el = hostRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setMeasured(el.clientWidth))
    ro.observe(el)
    setMeasured(el.clientWidth)
    return () => ro.disconnect()
  }, [width])

  const w = width ?? (measured > 0 ? measured : FALLBACK_W)
  const h = TOP + rows.length * rowHeight + 2
  const x0 = GUTTER_W + VALUE_W
  const plotW = Math.max(1, w - x0 - VALUE_W - RIGHT_PAD)
  const [dLo, dHi] = domainOf(rows, nominal)
  const x = (v: number) => x0 + (plotW * (v - dLo)) / (dHi - dLo)
  const font = { fontFamily: tokens.fontMono, fontSize: 11, fill: tokens.ink }
  const lowColor = resolveColor('chart-2', tokens)
  const highColor = resolveColor('chart-1', tokens)
  const xNominal = x(nominal)

  if (Number.isFinite(horizonS) || horizonS === -Infinity) {
    return (
      <div ref={hostRef} className="chart chart-tornado" style={width != null ? { width } : undefined}>
        <svg className="chart-tornado-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <text x={2} y={11} style={font}>{FORECAST_IN_ANALYZE}</text>
        </svg>
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      className="chart chart-tornado"
      style={width != null ? { width } : undefined}
    >
      <svg className="chart-tornado-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          {rows.map((r, i) => {
            const lo = Math.min(r.low, r.high)
            const hi = Math.max(r.low, r.high)
            const span = hi - lo
            const stop = span < 1e-9 ? 0 : Math.min(1, Math.max(0, (nominal - lo) / span))
            return (
              <linearGradient key={r.id} id={`${uid}-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset={stop} stopColor={lowColor} />
                <stop offset={stop} stopColor={highColor} />
              </linearGradient>
            )
          })}
        </defs>
        <text x={xNominal} y={9} textAnchor="middle" style={font} data-role="nominal-label">
          {unit ? `${formatEnd(nominal)} ${unit}` : formatEnd(nominal)}
        </text>
        {rows.map((r, i) => {
          const yTop = TOP + i * rowHeight
          const mid = yTop + rowHeight / 2
          const lo = Math.min(r.low, r.high)
          const hi = Math.max(r.low, r.high)
          const bx = x(lo)
          const bw = Math.max(BAR_MIN_W, x(hi) - bx)
          return (
            <g key={r.id}>
              <text
                x={2}
                y={mid}
                dominantBaseline="middle"
                style={{ ...font, fill: tokens.color('text') }}
              >
                {gutterLabel(r.label)}
              </text>
              {r.tag ? (
                <foreignObject
                  x={TAG_X}
                  y={mid - TAG_H / 2}
                  width={GUTTER_W - TAG_X - 4}
                  height={TAG_H}
                >
                  {r.tag}
                </foreignObject>
              ) : null}
              <rect
                x={bx}
                y={mid - BAR_H / 2}
                width={bw}
                height={BAR_H}
                rx={1}
                fill={`url(#${uid}-${i})`}
                data-role="bar"
              />
              <text x={bx - 4} y={mid} textAnchor="end" dominantBaseline="middle" style={font}>
                {formatEnd(r.low)}
              </text>
              <text
                x={bx + bw + 4}
                y={mid}
                textAnchor="start"
                dominantBaseline="middle"
                style={font}
              >
                {formatEnd(r.high)}
              </text>
            </g>
          )
        })}
        <line
          x1={xNominal}
          y1={TOP - 3}
          x2={xNominal}
          y2={TOP + rows.length * rowHeight}
          stroke={tokens.color('text-dim')}
          data-role="nominal"
        />
      </svg>
    </div>
  )
}
