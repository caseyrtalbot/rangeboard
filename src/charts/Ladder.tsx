import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { formatTime } from '../geometry/geo'
import { timeTicks } from './timeAxis'
import { readTokens, resolveColor } from './tokens'
import type { LadderRow } from './types'
import { snapScrubS } from './seriesData'

interface LadderProps {
  /** Latest visible outcome time; undefined or Infinity shows the full run. */
  horizonS?: number
  rows: LadderRow[]
  durationS: number
  /** Playhead position, seconds. */
  tS: number
  /** Called when the user clicks or drags on the rows. The caller sets playback.simTimeS. */
  onScrub?: (tS: number) => void
  /** Explicit px; absent = fill the container width. */
  width?: number
  /** Default 14. */
  rowHeight?: number
}

/**
 * The gutter holds a board designator such as `DJI MAVIC 3 1`: 13 characters of
 * 10 px mono at about 6 px each, plus the 6 px inset. A longer label is cut to the
 * budget with an ellipsis rather than clipped by the SVG edge.
 */
const GUTTER_W = 84
const LABEL_CHARS = 13
const RIGHT_PAD = 8
const SPAN_H = 6
const SPAN_MIN_W = 1.5
const TICK_H = 16
const FALLBACK_W = 312

/** A gutter label cut to LABEL_CHARS, ellipsis included. */
function gutterLabel(label: string): string {
  return label.length > LABEL_CHARS ? `${label.slice(0, LABEL_CHARS - 1)}…` : label
}

/**
 * The phase ladder: one row per track, spans as short rounded bars, the playhead, and
 * `m:ss` ticks under the rows. Plain SVG; Recharts has no row-span primitive, and a
 * Recharts `ResponsiveContainer` gives a non-Recharts child no width, so the ladder owns
 * its shell and measures its host like EngagementStrip does. Scrub maps the pointer x
 * through the same linear scale the spans use.
 */
export function Ladder({
  rows,
  durationS,
  tS,
  onScrub,
  width,
  rowHeight = 14,
  horizonS = Infinity,
}: LadderProps) {
  const tokens = useMemo(() => readTokens(), [])
  const hostRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState(0)

  // Same pattern as EngagementStrip: the container width is read, never polled.
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
  const h = rows.length * rowHeight + TICK_H
  const plotW = Math.max(1, w - GUTTER_W - RIGHT_PAD)
  const x = (t: number) => GUTTER_W + (plotW * t) / Math.max(durationS, 1e-9)
  const ticks = useMemo(() => timeTicks(durationS, plotW), [durationS, plotW])
  const accent = tokens.color('accent')
  const font = { fontFamily: tokens.fontMono, fontSize: 11, fill: tokens.ink }

  function scrub(e: PointerEvent<SVGSVGElement>) {
    if (!onScrub) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * w
    onScrub(snapScrubS(((px - GUTTER_W) / plotW) * durationS, durationS))
  }

  return (
    <div ref={hostRef} className="chart chart-ladder" style={width != null ? { width } : undefined}>
      <svg
        className={onScrub ? 'chart-ladder-svg chart-scrub' : 'chart-ladder-svg'}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        onPointerDown={scrub}
        onPointerMove={(e) => {
          if (e.buttons & 1) scrub(e)
        }}
      >
        {rows.map((r, i) => {
          const y = i * rowHeight + 4
          const mid = y + SPAN_H / 2 + 2
          return (
            <g key={r.id}>
              <text
                x={GUTTER_W - 6}
                y={mid}
                textAnchor="end"
                dominantBaseline="middle"
                style={{ ...font, fill: tokens.color('text') }}
              >
                {gutterLabel(r.label)}
              </text>
              <line x1={GUTTER_W} y1={mid} x2={w - RIGHT_PAD} y2={mid} stroke={tokens.grid} />
              {r.spans.map((sp, k) => {
                if (horizonS === -Infinity || sp.startS > horizonS) return null
                const endS = Math.min(sp.endS, horizonS)
                // Caller labels may contain the forecast end time.
                const label =
                  endS < sp.endS && sp.label
                    ? `${formatTime(sp.startS)}–${formatTime(endS)}`
                    : sp.label
                const x0 = x(sp.startS)
                const sw = Math.max(SPAN_MIN_W, x(endS) - x0)
                return (
                  <g key={k}>
                    <rect
                      x={x0}
                      y={y + 2}
                      width={sw}
                      height={SPAN_H}
                      rx={1}
                      fill={resolveColor(sp.color, tokens)}
                    />
                    {label ? (
                      <text x={x0 + sw + 3} y={mid} dominantBaseline="middle" style={font}>
                        {label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </g>
          )
        })}
        <line
          x1={x(tS)}
          y1={2}
          x2={x(tS)}
          y2={rows.length * rowHeight + 6}
          stroke={accent}
          data-role="playhead"
        />
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={h - 2} textAnchor="middle" style={font}>
            {formatTime(t)}
          </text>
        ))}
      </svg>
    </div>
  )
}
