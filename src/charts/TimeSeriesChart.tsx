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
import {
  finite,
  formatYTick,
  lastVisibleIndex,
  seriesDurationS,
  seriesRange,
  seriesRows,
  snapScrubS,
} from './seriesData'
import type { TimeSeriesProps } from './TimeSeries'
import { resolveColor, type ChartTokens } from './tokens'
import type { ChartMark, Series } from './types'

/** Plot margin, px. Top leaves room for the playhead and mark labels. */
const MARGIN = { top: 12, right: 8, bottom: 0, left: 0 }
const Y_AXIS_W = 30
const X_AXIS_H = 16
const LINE_W = 1.6
const DOT_R = 2.4

/**
 * The grid draws no vertical lines. `vertical={false}` only hides them: Recharts still runs
 * its default generator, which measures the label of every data row in the DOM (one forced
 * layout per row, about a thousand on first mount). A generator with no lines skips that.
 */
const NO_VERTICAL_LINES = (): number[] => []

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
  horizonS?: number
  series: Series[]
  tokens: ChartTokens
  label?: string | number
  active?: boolean
}

export function SeriesTip({ series, tokens, label, active, horizonS = Infinity }: TipProps) {
  const t = Number(label)
  if (!active || !Number.isFinite(t) || t > horizonS) return null
  const i = Math.round(t / DT)
  if (i * DT > horizonS) return null
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

/** Shared axis tick style: mono, dim ink, at the 11 px type floor (`--type-dense-size`). */
function tickStyle(tokens: ChartTokens) {
  return { fill: tokens.ink, fontFamily: tokens.fontMono, fontSize: 11 }
}

interface PlotProps {
  /** Latest visible outcome time; undefined or Infinity shows the full run. */
  horizonS?: number
  series: Series[]
  /** Null = no playhead. */
  tS: number | null
  onScrub?: (tS: number) => void
  width?: number
  height: number
  marks?: ChartMark[]
  yDomain?: [number, number]
}

/** The Recharts plot without the frame. */
export function TimeSeriesPlot({
  series,
  tS,
  onScrub,
  width,
  height,
  marks,
  yDomain,
  horizonS = Infinity,
}: PlotProps) {
  const tokens = useChartTokens()
  const rows = useMemo(() => seriesRows(series, horizonS), [series, horizonS])
  const plotSeries = horizonS === -Infinity ? [] : series
  const durationS = seriesDurationS(series)
  const [lo, hi] = useMemo(
    () => seriesRange(series, yDomain, horizonS),
    [series, yDomain, horizonS],
  )
  const plotW = (width ?? 312) - MARGIN.left - MARGIN.right - Y_AXIS_W
  const xTicks = useMemo(() => timeTicks(durationS, plotW), [durationS, plotW])
  const scrub = useScrub(durationS, { left: MARGIN.left + Y_AXIS_W, right: MARGIN.right }, onScrub)
  const accent = tokens.color('accent')
  const ticks = tickStyle(tokens)
  const playheadLabel = tS != null ? `T+${formatTime(tS)}` : ''

  return (
    <ComposedChart
      data={rows}
      width={width}
      height={height}
      margin={MARGIN}
      onMouseDown={scrub.onMouseDown}
      onMouseMove={scrub.onMouseMove}
      className={onScrub ? 'chart-scrub' : undefined}
    >
      <CartesianGrid
        stroke={tokens.grid}
        vertical={false}
        verticalCoordinatesGenerator={NO_VERTICAL_LINES}
      />
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
      />
      {plotSeries.map((s) =>
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
      {plotSeries.map((s) => (
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
      {plotSeries.map((s) => {
        const i = lastVisibleIndex(s.values, horizonS)
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
      {marks
        ?.filter((m) => horizonS !== -Infinity && (horizonS === Infinity || m.tS <= horizonS))
        .map((m) => {
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
        })}
      {tS != null ? (
        <ReferenceLine
          x={tS}
          stroke={accent}
          strokeWidth={1}
          data-role="playhead"
          label={{ value: playheadLabel, position: 'top', ...ticks, fill: accent }}
        />
      ) : null}
      <Tooltip
        cursor={false}
        isAnimationActive={false}
        content={(p: TooltipContentProps) => (
          <SeriesTip
            series={series}
            tokens={tokens}
            label={p.label}
            active={p.active}
            horizonS={horizonS}
          />
        )}
      />
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
  horizonS = Infinity,
}: TimeSeriesProps) {
  const showLegend = legend ?? series.length > 1
  const legendItems = useMemo(
    () =>
      showLegend
        ? series
            .filter((s) => horizonS === Infinity || lastVisibleIndex(s.values, horizonS) >= 0)
            .map((s) => ({ id: s.id, label: s.label, color: s.color }))
        : undefined,
    [series, showLegend, horizonS],
  )
  return (
    <ChartFrame
      width={width}
      height={height}
      yLabel={yLabel}
      legend={legendItems}
      horizonS={horizonS}
    >
      <TimeSeriesPlot
        series={series}
        horizonS={horizonS}
        tS={tS}
        onScrub={onScrub}
        width={width}
        height={height}
        marks={marks}
        yDomain={yDomain}
      />
    </ChartFrame>
  )
}
