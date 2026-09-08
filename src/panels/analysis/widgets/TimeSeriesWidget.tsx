import { TimeSeries } from '../../../charts/TimeSeries'
import type { ChartMark, Series } from '../../../charts/types'
import type { TimeSeriesPreset } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { useTrialResult, trialViewOf, trialStateText } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

const PRESETS: readonly TimeSeriesPreset[] = ['sensors', 'effectors', 'threat']

interface Chart {
  series: Series[]
  yDomain?: [number, number]
  marks?: ChartMark[]
}

/** Saved forecast-era ids remain lookup keys in the trial adapter. */
export function TimeSeriesWidget({ id, params, collapsed, customize, index, count, horizon }: WidgetProps) {
  const trial = useTrialResult()
  const view = trialViewOf(trial)
  const setSimTime = useStore(s => s.setSimTime)
  const preset = PRESETS.includes(params.preset as TimeSeriesPreset) ? params.preset as TimeSeriesPreset : null
  const ids = Array.isArray(params.seriesIds) ? params.seriesIds.filter((id): id is string => typeof id === 'string') : []
  const set = trial.series
  const tracks = trial.snapshot?.counts.totalTracks ?? 0
  const raidSize = view ? view.scenario.entities.filter(e => e.kind === 'uas' && e.enabled !== false)
    .reduce((sum, e) => sum + Math.max(1, e.formation?.count ?? 1), 0) : 1
  const pick = (ids: string[]) => set?.kpi.filter(s => ids.includes(s.id)) ?? []
  const charts: Chart[] = !set ? [] : preset === 'sensors'
    ? [{ series: pick(['tracksHeld']), yDomain: [0, Math.max(1, tracks)] }, { series: pick(['meanPd']), yDomain: [0, 1] }]
    : preset === 'effectors' ? [{ series: pick(['kpi.expectedKills', 'salvosInFlight']) }]
      : preset === 'threat' ? [{ series: set.groupResidual, yDomain: [0, Math.max(1, raidSize)] }]
        : [{ series: ids.flatMap(id => pick([id])), yDomain: [0, Math.max(1, raidSize)],
          marks: Object.values(set.marks).flat().filter(mark => mark.label === 'ARR') }]
  const title = preset === 'sensors' ? 'Tracks held · last measured Pd'
    : preset === 'effectors' ? 'Pre-arrival defeats · salvos in flight'
      : preset === 'threat' ? 'Active members by group'
        : charts[0]?.series.map(s => s.label).join(' · ') || 'Time series'
  const stateText = trialStateText(trial.selection, trial.snapshot?.observedThroughS)

  return (
    <WidgetFrame id={id} horizon={horizon} type="time-series" title={title}
      metaWithinHorizon meta={stateText} collapsed={collapsed} customize={customize} index={index} count={count}>
      {!view ? <p className="muted small">{stateText}</p> : tracks === 0 ? (
        <p className="muted small">No threats with flight paths.</p>
      ) : charts.map((chart, i) => (
        <TimeSeries key={i} series={chart.series} tS={trial.horizon} horizonS={trial.horizon}
          onScrub={setSimTime} yDomain={chart.yDomain} marks={chart.marks} />
      ))}
    </WidgetFrame>
  )
}
