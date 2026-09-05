import { useMemo } from 'react'
import { TimeSeries } from '../../../charts/TimeSeries'
import type { ChartMark, Series } from '../../../charts/types'
import {
  groupResidualSeries,
  heldTracksSeries,
  kpiSeries,
  meanHeldPdSeries,
  salvosInFlightSeries,
  withBands,
} from '../../../analysis/series'
import type { Scenario } from '../../../model/types'
import { DT } from '../../../playback/sim'
import type { ThreatAssessment } from '../../../playback/sim'
import type { TimeSeriesPreset } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { useEngagement, useRunCursor } from './controls'
import { currentSummary } from './mc'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

const PRESETS: readonly TimeSeriesPreset[] = ['sensors', 'effectors', 'threat']

/** One chart in the body: its series and its axis rules. */
interface Chart {
  series: Series[]
  yDomain?: [number, number]
  marks?: ChartMark[]
}

function presetOf(params: Record<string, unknown>): TimeSeriesPreset | null {
  const preset = params.preset
  return PRESETS.includes(preset as TimeSeriesPreset) ? (preset as TimeSeriesPreset) : null
}

function seriesIdsOf(params: Record<string, unknown>): string[] {
  const raw = params.seriesIds
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
}

/** The sensors preset: tracks held and the mean Pd of held tracks (`series.ts`). */
function sensorsCharts(scenario: Scenario, trackCount: number): Chart[] {
  return [
    { series: [heldTracksSeries(scenario)], yDomain: [0, Math.max(1, trackCount)] },
    { series: [meanHeldPdSeries(scenario)], yDomain: [0, 1] },
  ]
}

/** The effectors preset: expected kills plus salvos in flight. */
function effectorsCharts(scenario: Scenario): Chart[] {
  const kills = kpiSeries(scenario).find((s) => s.id === 'kpi.expectedKills')
  const series: Series[] = kills ? [kills] : []
  series.push(salvosInFlightSeries(scenario))
  return [{ series }]
}

/** The threat preset: one step series per threat group. */
function threatCharts(scenario: Scenario, raidSize: number): Chart[] {
  return [{ series: groupResidualSeries(scenario), yDomain: [0, raidSize] }]
}

function idsCharts(
  scenario: Scenario,
  ids: string[],
  assessments: ThreatAssessment[],
  raidSize: number,
): Chart[] {
  const all = kpiSeries(scenario)
  const series = ids
    .map((id) => all.find((s) => s.id === id))
    .filter((s): s is Series => s != null)
  let arrival: number | null = null
  for (const a of assessments) {
    if (a.arrivalS != null && (arrival == null || a.arrivalS < arrival)) arrival = a.arrivalS
  }
  const marks: ChartMark[] = arrival == null ? [] : [{ tS: arrival, label: 'ARR', color: 'text-dim' }]
  return [{ series, yDomain: [0, raidSize], marks }]
}

/** A time-series chart on the DT grid: a KPI id list or one of the three named presets. */
export function TimeSeriesWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const setSimTime = useStore((s) => s.setSimTime)
  const mc = useStore((s) => s.mc)
  const summary = currentSummary(mc, runId)
  const { assessments, report } = useEngagement(scenario, runId)
  const { t } = useRunCursor(scenario)
  const preset = presetOf(params)
  const ids = seriesIdsOf(params)
  const idsKey = ids.join(',')
  const threats = assessments.filter((a) => a.status !== 'no-path').length
  const raidSize = Math.max(1, report.totals.raidSize)

  const charts = useMemo<Chart[]>(() => {
    // engagementPicture is a WeakMap cache cleared on reset: runId keys the memo.
    void runId
    if (threats === 0) return []
    const built = (() => {
      switch (preset) {
        case 'sensors':
          return sensorsCharts(scenario, threats)
        case 'effectors':
          return effectorsCharts(scenario)
        case 'threat':
          return threatCharts(scenario, raidSize)
        default:
          return idsCharts(scenario, idsKey.split(',').filter(Boolean), assessments, raidSize)
      }
    })()
    return built.map((chart) => ({ ...chart, series: withBands(chart.series, summary) }))
  }, [scenario, runId, preset, idsKey, threats, raidSize, assessments, summary])

  const title =
    preset === 'sensors'
      ? 'Tracks held · mean Pd'
      : preset === 'effectors'
        ? 'Expected kills · salvos in flight'
        : preset === 'threat'
          ? 'Survives by group'
          : charts[0]?.series.length
            ? charts[0].series.map((s) => s.label).join(' · ')
            : 'Time series'

  return (
    <WidgetFrame
      id={id}
      type="time-series"
      title={title}
      meta={`${DT} s · basis per series`}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {summary && <p className="muted small">MC bands: 80% and 95% replicate quantiles; tiles report confidence intervals on means.</p>}
      {threats === 0 ? (
        <p className="muted small">No threats with flight paths.</p>
      ) : (
        charts.map((chart, i) => (
          <TimeSeries
            key={i}
            series={chart.series}
            tS={t}
            onScrub={setSimTime}
            yDomain={chart.yDomain}
            marks={chart.marks}
          />
        ))
      )}
    </WidgetFrame>
  )
}
