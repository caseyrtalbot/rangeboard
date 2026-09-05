import { useCallback, useMemo, type MouseEvent } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatTime } from '../geometry/geo'
import { DT } from '../playback/clock'
import { ChartFrame, useChartTokens } from './ChartFrame'
import { timeTicks } from './timeAxis'
import { resolveColor, type ChartTokens } from './tokens'
import type { ChartMark, Series } from './types'

export interface TimeSeriesProps {
  series: Series[]
  /** Playhead position, seconds, quantized to DT by the caller. */
  tS: number
  /** Called when the user clicks or drags on the plot. The caller sets playback.simTimeS. */
  onScrub?: (tS: number) => void
  height?: number
  /** Explicit px; absent = responsive. */
  width?: number
  /** Vertical marks: arrival, first shot, gate times. */
  marks?: ChartMark[]
  /** Unit on the axis title only. */
  yLabel?: string | null
  yDomain?: [number, number]
  /** Default true when series.length > 1. */
  legend?: boolean
}

/** Plot margin, px. Top leaves room for the playhead and mark labels. */
const MARGIN = { top: 12, right: 8, bottom: 0, left: 0 }
const Y_AXIS_W = 30
const X_AXIS_H = 16
const LINE_W = 1.6
const DOT_R = 2.4

/** One Recharts row: the time plus one key per series and per band. */
type SeriesRow = Record<string, number | [number, number] | null>

/** Duration in seconds of the longest series: (maxLen - 1) * DT. */
export function seriesDurationS(series: Series[]): number {
  let n = 0
  for (const s of series) n = Math.max(n, s.values.length)
  return Math.max(0, n - 1) * DT
}

const finite = (v: number | undefined): v is number => v != null && Number.isFinite(v)

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

/** Horizontal inset of the plot area inside the chart box, px. */
interface PlotInset {
  left: number
  right: number
}

/**
 * Chart-level scrub handlers. The time comes from the pointer x against the plot
 * box, never from the hover state Recharts keeps for the tooltip, which is empty on
 * a first click with no move before it.
 */
function useScrub(durationS: number, inset: PlotInset, onScrub?: (tS: number) => void) {
  const emit = useCallback(
    (e: MouseEvent<Element>) => {
      if (!onScrub) return
      const rect = e.currentTarget.getBoundingClientRect()
      const plotW = rect.width - inset.left - inset.right
      if (plotW <= 0) return
      const t = ((e.clientX - rect.left - inset.left) / plotW) * durationS
      onScrub(snapScrubS(t, durationS))
    },
    [onScrub, durationS, inset.left, inset.right],
  )
  const onMouseDown = useCallback((_state: unknown, e: MouseEvent<Element>) => emit(e), [emit])
  const onMouseMove = useCallback(
    (_state: unknown, e: MouseEvent<Element>) => {
      if (e.buttons & 1) emit(e)
    },
    [emit],
  )
  return { onMouseDown, onMouseMove }
}

interface TipProps {
  series: Series[]
  tokens: ChartTokens
  label?: string | number
  active?: boolean
}

function SeriesTip({ series, tokens, label, active }: TipProps) {
  const t = Number(label)
  if (!active || !Number.isFinite(t)) return null
  const i = Math.round(t / DT)
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">T+{formatTime(t)}</div>
      {series.map((s) => {
        const v = s.values[i]
        return (
          <div key={s.id} className="chart-tooltip-row">
            <i style={{ background: resolveColor(s.color, tokens) }} />
            <span>{s.label}</span>
            <b>
              {finite(v) ? v.toFixed(v >= 10 || Number.isInteger(v) ? 0 : 2) : '-'}
              {s.unit && finite(v) ? ` ${s.unit}` : ''}
            </b>
          </div>
        )
      })}
    </div>
  )
}

/** Shared axis tick style: mono, 10 px, dim ink. */
function tickStyle(tokens: ChartTokens) {
  return { fill: tokens.ink, fontFamily: tokens.fontMono, fontSize: 10 }
}

interface PlotProps {
  series: Series[]
  /** Null = no playhead. */
  tS: number | null
  onScrub?: (tS: number) => void
  width?: number
  height: number
  marks?: ChartMark[]
  yDomain?: [number, number]
  /** False = axes, grid and tooltip off (the sparkline). */
  chrome: boolean
}

/** The Recharts plot without the frame. `Sparkline` reuses it with `chrome` off. */
export function TimeSeriesPlot({
  series, tS, onScrub, width, height, marks, yDomain, chrome,
}: PlotProps) {
  const tokens = useChartTokens()
  const rows = useMemo(() => seriesRows(series), [series])
  const durationS = seriesDurationS(series)
  const [lo, hi] = useMemo(() => seriesRange(series, yDomain), [series, yDomain])
  const plotW = (width ?? 312) - MARGIN.left - MARGIN.right - (chrome ? Y_AXIS_W : 0)
  const xTicks = useMemo(() => timeTicks(durationS, plotW), [durationS, plotW])
  const scrub = useScrub(
    durationS,
    chrome ? { left: MARGIN.left + Y_AXIS_W, right: MARGIN.right } : { left: 2, right: 2 },
    onScrub,
  )
  const accent = tokens.color('accent')
  const ticks = tickStyle(tokens)
  const margin = chrome ? MARGIN : { top: 2, right: 2, bottom: 2, left: 2 }
  const playheadLabel = tS != null ? `T+${formatTime(tS)}` : ''

  return (
    <ComposedChart
      data={rows}
      width={width}
      height={height}
      margin={margin}
      onMouseDown={scrub.onMouseDown}
      onMouseMove={scrub.onMouseMove}
      className={onScrub ? 'chart-scrub' : undefined}
    >
      {chrome ? <CartesianGrid stroke={tokens.grid} vertical={false} /> : null}
      <XAxis
        dataKey="t"
        type="number"
        domain={[0, durationS]}
        ticks={xTicks}
        tickFormatter={formatTime}
        tick={ticks}
        axisLine={false}
        tickLine={false}
        tickMargin={3}
        height={X_AXIS_H}
        hide={!chrome}
      />
      <YAxis
        domain={[lo, hi]}
        ticks={[lo, (lo + hi) / 2, hi]}
        tickFormatter={(v: number) => formatYTick(v, hi)}
        tick={ticks}
        axisLine={false}
        tickLine={false}
        tickMargin={3}
        width={Y_AXIS_W}
        hide={!chrome}
      />
      {series.map((s) =>
        (['95', '80'] as const).map((k) =>
          (k === '95' ? s.band95 : s.band80) ? (
            <Area
              key={`${s.id}:${k}`}
              dataKey={`${s.id}:${k}`}
              type={s.kind === 'step' ? 'stepAfter' : 'linear'}
              stroke="none"
              fill={resolveColor(s.color, tokens)}
              fillOpacity={k === '95' ? 0.06 : 0.12}
              isAnimationActive={false}
              activeDot={false}
              tooltipType="none"
              connectNulls={false}
            />
          ) : null,
        ),
      )}
      {series.map((s) => (
        <Line
          key={s.id}
          dataKey={s.id}
          name={s.label}
          type={s.kind === 'step' ? 'stepAfter' : 'linear'}
          stroke={resolveColor(s.color, tokens)}
          strokeWidth={LINE_W}
          strokeLinejoin="round"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
      ))}
      {series.map((s) => {
        const i = lastFiniteIndex(s.values)
        if (i < 0) return null
        return (
          <ReferenceDot
            key={`${s.id}:end`}
            x={i * DT}
            y={s.values[i]}
            r={DOT_R}
            fill={resolveColor(s.color, tokens)}
            stroke={tokens.surface}
            strokeWidth={1}
            ifOverflow="visible"
          />
        )
      })}
      {chrome
        ? marks?.map((m) => {
            const color = resolveColor(m.color, tokens)
            return (
              <ReferenceLine
                key={`${m.label}@${m.tS}`}
                x={m.tS}
                stroke={color}
                strokeDasharray="2 3"
                label={{ value: m.label, position: 'top', ...ticks, fill: color }}
              />
            )
          })
        : null}
      {tS != null ? (
        <ReferenceLine
          x={tS}
          stroke={accent}
          strokeWidth={1}
          data-role="playhead"
          label={
            chrome ? { value: playheadLabel, position: 'top', ...ticks, fill: accent } : undefined
          }
        />
      ) : null}
      {chrome ? (
        <Tooltip
          cursor={false}
          isAnimationActive={false}
          content={(p: TooltipContentProps) => (
            <SeriesTip series={series} tokens={tokens} label={p.label} active={p.active} />
          )}
        />
      ) : null}
    </ComposedChart>
  )
}

/**
 * A time-series chart on the DT grid: mono axes, faint grid, bands under the lines, an
 * endpoint dot per series, vertical marks, and the playhead at `tS`. The playhead moves
 * only because `tS` changes; scrubbing reports through `onScrub`.
 */
export function TimeSeries({
  series,
  tS,
  onScrub,
  height = 120,
  width,
  marks,
  yLabel,
  yDomain,
  legend,
}: TimeSeriesProps) {
  const showLegend = legend ?? series.length > 1
  const legendItems = useMemo(
    () =>
      showLegend ? series.map((s) => ({ id: s.id, label: s.label, color: s.color })) : undefined,
    [series, showLegend],
  )
  return (
    <ChartFrame width={width} height={height} yLabel={yLabel} legend={legendItems}>
      <TimeSeriesPlot
        series={series}
        tS={tS}
        onScrub={onScrub}
        width={width}
        height={height}
        marks={marks}
        yDomain={yDomain}
        chrome
      />
    </ChartFrame>
  )
}
