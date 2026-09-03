import { ChartFrame } from './ChartFrame'
import { TimeSeriesPlot } from './TimeSeries'
import type { Series } from './types'

export interface SparklineProps {
  series: Series
  /** Playhead position, seconds. Absent = no playhead. */
  tS?: number
  width?: number
  height?: number
}

/**
 * A `TimeSeries` with no axes, grid, legend or tooltip: the line, the endpoint dot and the
 * playhead when `tS` is given.
 */
export function Sparkline({ series, tS, width, height = 28 }: SparklineProps) {
  return (
    <ChartFrame width={width} height={height}>
      <TimeSeriesPlot
        series={[series]}
        tS={tS ?? null}
        width={width}
        height={height}
        chrome={false}
      />
    </ChartFrame>
  )
}
