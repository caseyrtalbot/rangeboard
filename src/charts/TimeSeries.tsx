import { Suspense, lazy } from 'react'
import type { ChartMark, Series } from './types'

export {
  formatYTick,
  lastFiniteIndex,
  seriesDurationS,
  seriesRange,
  seriesRows,
  snapScrubS,
} from './seriesData'

export interface TimeSeriesProps {
  /** Latest visible outcome time; undefined or Infinity shows the full run. */
  horizonS?: number
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

/** Default plot height, px. The fallback holds the same box while the chart loads. */
const DEFAULT_HEIGHT = 120

/**
 * Nothing on the first paint path draws a chart, so the Recharts plot body loads
 * lazily. The fallback reserves the plot box so the panel does not reflow.
 */
const TimeSeriesChart = lazy(() =>
  import('./TimeSeriesChart').then((m) => ({ default: m.TimeSeries })),
)

/**
 * A time-series chart on the DT grid: mono axes, faint grid, bands under the lines, an
 * endpoint dot per series, vertical marks, and the playhead at `tS`. The playhead moves
 * only because `tS` changes; scrubbing reports through `onScrub`.
 */
export function TimeSeries(props: TimeSeriesProps) {
  const height = props.height ?? DEFAULT_HEIGHT
  return (
    <Suspense
      fallback={
        <div className="chart" style={props.width != null ? { width: props.width } : undefined}>
          <div className="chart-plot" style={{ height }} />
        </div>
      }
    >
      <TimeSeriesChart {...props} />
    </Suspense>
  )
}
