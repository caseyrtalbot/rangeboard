import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, XAxis, YAxis } from 'recharts'
import { formatTime } from '../geometry/geo'
import { DT } from '../playback/clock'
import type { BandSeries } from '../playback/mcRun'
import { ChartFrame } from './ChartFrame'
import { lastVisibleIndex } from './seriesData'
import { timeTicks } from './timeAxis'
import type { Series } from './types'

interface BandChartProps {
  ensemble: BandSeries
  trial: Series
  baseline?: Series
  durationS: number
  population: number
  replicates: number
  width?: number
  height?: number
}

/** Mean intervals use lo/hi, never the replicate-quantile arrays. */
export function BandChart({
  ensemble,
  trial,
  baseline,
  durationS,
  population,
  replicates,
  width,
  height = 160,
}: BandChartProps) {
  const rows = useMemo(
    () =>
      Array.from({ length: Math.floor(durationS / DT) + 1 }, (_, i) => {
        const finite = (value: number) => (Number.isFinite(value) ? value : null)
        const lo = ensemble.lo[i]
        const hi = ensemble.hi[i]
        return {
          t: i * DT,
          mean: replicates > 0 ? finite(ensemble.mean[i]) : null,
          band: replicates >= 2 && Number.isFinite(lo) && Number.isFinite(hi) ? [lo, hi] : null,
          trial: finite(trial.values[i]),
          baseline: baseline ? finite(baseline.values[i]) : null,
        }
      }),
    [ensemble, trial, baseline, durationS, replicates],
  )
  const endpoint = lastVisibleIndex(trial.values, durationS)
  const ticks = {
    fill: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--type-dense-size)',
  }
  const legend = [
    { id: 'mean', label: 'Ensemble mean', color: 'var(--text-secondary)' },
    { id: 'band', label: '95 % band on mean', color: 'var(--rule-strong)' },
    { id: 'trial', label: 'Simulated trial', color: 'var(--chart-1)' },
    ...(baseline ? [{ id: 'baseline', label: baseline.label, color: 'var(--text-tertiary)' }] : []),
  ]
  const description = `Kills before arrival, members of ${population}. Ensemble mean and 95 % band on mean; simulated trial with endpoint marked${baseline ? `; ${baseline.label}, dashed` : ''}. Horizon T+${formatTime(durationS)}.`
  return (
    <div role="img" aria-label={description}>
      <ChartFrame
        width={width}
        height={height}
        yLabel={`Kills before arrival · members / ${population}`}
        legend={legend}
        horizonS={durationS}
      >
        <ComposedChart
          data={rows}
          width={width}
          height={height}
          margin={{ top: 12, right: 8, bottom: 16, left: 0 }}
        >
          <CartesianGrid
            stroke="var(--rule)"
            vertical={false}
            verticalCoordinatesGenerator={() => []}
          />
          <XAxis
            dataKey="t"
            type="number"
            domain={[0, durationS]}
            ticks={timeTicks(durationS, (width ?? 312) - 38)}
            tickFormatter={formatTime}
            tick={ticks}
            axisLine={false}
            tickLine={false}
            height={16}
            label={{ value: 'T+ minutes:seconds', position: 'insideBottom', offset: -14, ...ticks }}
          />
          <YAxis
            domain={[0, Math.max(1, population)]}
            tick={ticks}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Area
            dataKey="band"
            type="stepAfter"
            stroke="none"
            fill="var(--rule-strong)"
            fillOpacity={1}
            isAnimationActive={false}
            activeDot={false}
            connectNulls={false}
          />
          <Line
            dataKey="mean"
            name="Ensemble mean"
            type="stepAfter"
            stroke="var(--text-secondary)"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          {baseline && (
            <Line
              dataKey="baseline"
              name={baseline.label}
              type={baseline.kind === 'step' ? 'stepAfter' : 'linear'}
              stroke="var(--text-tertiary)"
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          )}
          <Line
            dataKey="trial"
            name="Simulated trial"
            type="stepAfter"
            stroke="var(--chart-1)"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          {endpoint >= 0 && (
            <ReferenceDot
              x={endpoint * DT}
              y={trial.values[endpoint]}
              r={2.4}
              fill="var(--chart-1)"
              stroke="var(--surface-panel)"
              ifOverflow="visible"
            />
          )}
        </ComposedChart>
      </ChartFrame>
    </div>
  )
}
