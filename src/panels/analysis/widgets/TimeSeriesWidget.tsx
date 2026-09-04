import { useMemo } from 'react'
import { TimeSeries } from '../../../charts/TimeSeries'
import { CHART_SLOT_TOKENS, OTHER_TOKEN } from '../../../charts/tokens'
import type { ChartMark, Series } from '../../../charts/types'
import { kpiSeries, sampleCount, sensorSeries, threatSeries } from '../../../analysis/series'
import { threatPictureAt } from '../../../analysis/threatAggregation'
import type { Scenario } from '../../../model/types'
import { entityActive } from '../../../model/types'
import type { AttritionReport } from '../../../playback/attrition'
import { DT } from '../../../playback/sim'
import type { ThreatAssessment } from '../../../playback/sim'
import type { TimeSeriesPreset } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { useEngagement, useRunCursor } from './controls'
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

const finite = (v: number | undefined): v is number => v != null && Number.isFinite(v)

/**
 * The sensors preset, derived from the per-sensor series.
 *
 * Tracks held: at step i, the count of tracks whose `held.<uasId>` flag is 1
 * for at least one enabled sensor. Mean Pd: at step i, over those held
 * tracks, take per track the largest finite `pd.<uasId>` among the sensors
 * holding it, then the mean over tracks; NaN when no held track has a
 * finite Pd at that step.
 */
function sensorsCharts(scenario: Scenario, trackCount: number): Chart[] {
  const n = sampleCount(scenario)
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e))
  const held = new Map<string, number[][]>()
  const pd = new Map<string, number[][]>()
  for (const sensor of sensors) {
    for (const s of sensorSeries(scenario, sensor.id)) {
      const dot = s.id.indexOf('.')
      const kind = s.id.slice(0, dot)
      const uasId = s.id.slice(dot + 1)
      const target = kind === 'held' ? held : kind === 'pd' ? pd : null
      if (!target || !uasId) continue
      const list = target.get(uasId) ?? []
      list.push(s.values)
      target.set(uasId, list)
    }
  }
  const tracks = new Array<number>(n).fill(0)
  const meanPd = new Array<number>(n).fill(Number.NaN)
  for (let i = 0; i < n; i += 1) {
    let count = 0
    let pdSum = 0
    let pdCount = 0
    for (const [uasId, flags] of held) {
      if (!flags.some((f) => f[i] === 1)) continue
      count += 1
      let best = Number.NaN
      for (const values of pd.get(uasId) ?? []) {
        const v = values[i]
        if (finite(v) && (!finite(best) || v > best)) best = v
      }
      if (finite(best)) {
        pdSum += best
        pdCount += 1
      }
    }
    tracks[i] = count
    if (pdCount > 0) meanPd[i] = pdSum / pdCount
  }
  return [
    {
      series: [
        { id: 'tracksHeld', label: 'Tracks held', unit: 'tracks', values: tracks, color: 'chart-1', kind: 'step' },
      ],
      yDomain: [0, Math.max(1, trackCount)],
    },
    {
      series: [
        { id: 'meanPd', label: 'Mean Pd of held tracks', unit: 'Pd', values: meanPd, color: 'chart-4', kind: 'line' },
      ],
      yDomain: [0, 1],
    },
  ]
}

/** Expected kills plus salvos in flight: at step i, events with tS <= t < tEffectS. */
function effectorsCharts(scenario: Scenario, report: AttritionReport): Chart[] {
  const n = sampleCount(scenario)
  const inFlight = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i += 1) {
    const t = i * DT
    inFlight[i] = report.events.filter((ev) => ev.tS <= t && t < ev.tEffectS).length
  }
  const kills = kpiSeries(scenario).find((s) => s.id === 'kpi.expectedKills')
  const series: Series[] = kills ? [kills] : []
  series.push({
    id: 'salvosInFlight',
    label: 'Salvos in flight',
    unit: null,
    values: inFlight,
    color: 'chart-2',
    kind: 'step',
  })
  return [{ series }]
}

/** One step series per threat group: the element-wise sum of its members' residual ships. */
function threatCharts(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
  raidSize: number,
): Chart[] {
  const n = sampleCount(scenario)
  const groups = threatPictureAt(scenario, assessments, report, Number.POSITIVE_INFINITY, new Map())
  const series: Series[] = groups.map((group, index) => {
    const values = new Array<number>(n).fill(Number.NaN)
    for (const member of group.members) {
      const residual = threatSeries(scenario, member.uasId).find((s) => s.id === 'residual')
      if (!residual) continue
      for (let i = 0; i < n; i += 1) {
        const v = residual.values[i]
        if (!finite(v)) continue
        values[i] = finite(values[i]) ? values[i] + v : v
      }
    }
    return {
      id: `group.${group.id}`,
      label: group.label,
      unit: 'ships',
      values,
      color: CHART_SLOT_TOKENS[index] ?? OTHER_TOKEN,
      kind: 'step',
    }
  })
  return [{ series, yDomain: [0, raidSize] }]
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
    switch (preset) {
      case 'sensors':
        return sensorsCharts(scenario, threats)
      case 'effectors':
        return effectorsCharts(scenario, report)
      case 'threat':
        return threatCharts(scenario, assessments, report, raidSize)
      default:
        return idsCharts(scenario, idsKey.split(',').filter(Boolean), assessments, raidSize)
    }
  }, [scenario, runId, preset, idsKey, threats, raidSize, assessments, report])

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
      meta={`${DT} s`}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
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
