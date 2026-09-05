import { useMemo } from 'react'
import { modelsForEntity } from '../../../analysis/fidelity'
import { FT_TO_M } from '../../../analysis/sensorEnv'
import { phaseLadderRow, threatSeries, trackMarks, withBands } from '../../../analysis/series'
import { Ladder } from '../../../charts/Ladder'
import { TimeSeries } from '../../../charts/TimeSeries'
import type { ChartMark, Series } from '../../../charts/types'
import { bearingDeg, formatDistance, formatSpeed, formatTime } from '../../../geometry/geo'
import { slantRangeM } from '../../../geometry/slant'
import { rcsM2For, swerlingFor } from '../../../model/rcsFactors'
import type { Entity } from '../../../model/types'
import { mountHeightOf } from '../../../model/types'
import { entityPosAt, threatAltitudeFt } from '../../../playback/tracks'
import { PHASE_STYLE } from '../../../playback/trackState'
import type { TrackPhase } from '../../../playback/trackState'
import { buildTrackTimeline, trackStatesAt } from '../../../playback/trackState'
import { useStore } from '../../../state/store'
import { modelFor, pathSpeed } from '../../../model/scenario'
import { SURVIVAL_LABELS } from '../widgets/labels'
import { currentSummary } from '../widgets/mc'
import { DetailHeader } from './DetailHeader'
import { DetailSection } from './DetailSection'
import type { DetailRow, LegendEntry } from './detailRows'
import {
  bareSpans,
  DASH,
  Legend,
  PfTag,
  Rows,
  useDetailRun,
} from './detailRows'

/** No timeline covers this threat, so the figure has no value to state. */
const NA = 'not available'
const NO_ASSET = 'no defended asset placed'

/** The threat pane: the track file at t, the phase ladder, Pd by sensor and survival. */
export function ThreatDetail({ entity }: { entity: Entity }) {
  const run = useDetailRun()
  const { scenario, runId, setSimTime, units, assessments, report, t, durationS } = run
  const mc = useStore((s) => s.mc)
  const summary = currentSummary(mc, runId)
  const model = modelFor(scenario, entity)
  const uasSpec = model?.uas
  const color = entity.color ?? model?.color ?? '#c46a5a'
  const assessment = assessments.find((a) => a.uasId === entity.id)

  const timeline = useMemo(() => {
    void runId
    return buildTrackTimeline(scenario, assessments, report)
  }, [scenario, runId, assessments, report])
  const state = useMemo(() => trackStatesAt(timeline, t).get(entity.id), [timeline, t, entity.id])

  const series = useMemo(() => {
    void runId
    return threatSeries(scenario, entity.id)
  }, [scenario, runId, entity.id])
  const phaseRow = useMemo(() => {
    void runId
    return phaseLadderRow(scenario, entity.id)
  }, [scenario, runId, entity.id])
  const barePhaseRows = useMemo(() => [bareSpans(phaseRow)], [phaseRow])
  const pd = useMemo(() => series.filter((s) => s.id.startsWith('pd.')), [series])
  const residual = series.find((s) => s.id === 'residual')
  const shipCount = report.threats.find((x) => x.uasId === entity.id)?.shipCount ?? 1
  const survival = useMemo<Series | null>(
    () =>
      residual
        ? withBands([{ ...residual, label: SURVIVAL_LABELS.survives }], summary, entity.id)[0]
        : null,
    [residual, summary, entity.id],
  )
  const survivalMarks = useMemo<ChartMark[]>(() => {
    void runId
    const marks: ChartMark[] = []
    const effect = report.events
      .filter((ev) => ev.uasId === entity.id && ev.killDelta > 0)
      .sort((x, y) => x.tEffectS - y.tEffectS)[0]
    if (effect) marks.push({ tS: effect.tEffectS, label: 'FX', color: 'danger' })
    for (const mark of trackMarks(scenario, entity.id)) {
      if (mark.label === 'ARR' || mark.label === 'CPA') marks.push(mark)
    }
    return marks
  }, [scenario, runId, report, entity.id])

  // The phase legend lists only the phases the row shows, by the label the builder wrote.
  const phaseLegend: LegendEntry[] = (Object.keys(PHASE_STYLE) as TrackPhase[])
    .filter((phase) => {
      const style = PHASE_STYLE[phase]
      return style.color != null && phaseRow.spans.some((span) => span.label === style.label)
    })
    .map((phase) => ({
      label: PHASE_STYLE[phase].label.toLowerCase(),
      color: PHASE_STYLE[phase].color ?? color,
    }))

  const fileRows = useMemo<DetailRow[]>(() => {
    const path = scenario.paths.find((p) => p.entityId === entity.id)
    const holdIds = state?.holdingSensorIds ?? []
    const holdNames = holdIds
      .map((id) => scenario.entities.find((e) => e.id === id)?.name)
      .filter((n): n is string => n != null)
    const sensor = scenario.entities.find((e) => e.id === holdIds[0])
    let slantText = DASH
    let bearingText = DASH
    if (sensor) {
      const pos = entityPosAt(scenario, entity, t)
      const groundM = Math.hypot(pos.x - sensor.pos.x, pos.y - sensor.pos.y)
      const altM = threatAltitudeFt(scenario, entity) * FT_TO_M
      const hM = mountHeightOf(modelFor(scenario, sensor)?.sensor ?? {})
      slantText = (slantRangeM(groundM, altM - hM) / 1000).toFixed(1)
      bearingText = `${Math.round(bearingDeg(sensor.pos, pos))}`
    }
    const hasAsset = scenario.entities.some((e) => e.kind === 'asset')
    const arrivalText = !state
      ? NA
      : state.arrivalS != null
        ? `T+${formatTime(state.arrivalS)}`
        : hasAsset
          ? 'never crossed the defended boundary'
          : NO_ASSET
    const cpaAsset = assessment?.cpaAssetId
      ? scenario.entities.find((e) => e.id === assessment.cpaAssetId)
      : undefined
    const cpaText =
      assessment?.cpaS != null && assessment.cpaDistanceM != null
        ? `T+${formatTime(assessment.cpaS)} · ${formatDistance(assessment.cpaDistanceM, units)}${
            cpaAsset ? ` from ${cpaAsset.name}` : ''
          }`
        : hasAsset
          ? NA
          : NO_ASSET
    const firstSensor = assessment?.firstDetectSensorId
      ? scenario.entities.find((e) => e.id === assessment.firstDetectSensorId)
      : undefined
    const rows: DetailRow[] = [
      {
        label: 'Altitude',
        value: threatAltitudeFt(scenario, entity).toLocaleString(),
        unit: ' ft AGL',
        tag: entity.altitudeFt == null ? <PfTag model={model} field="altitudeFt" absent /> : null,
      },
      { label: 'Speed', value: path ? formatSpeed(pathSpeed(scenario, path), units) : DASH },
      { label: 'Slant range', value: slantText, unit: sensor ? ' km' : undefined },
      { label: 'Bearing', value: bearingText, unit: sensor ? ' °' : undefined },
      { label: 'Held by', value: holdNames.length > 0 ? holdNames.join(' · ') : 'none' },
      { label: 'Classification', value: state ? state.classification : DASH },
      { label: 'Arrival', value: arrivalText },
      { label: 'CPA', value: cpaText },
      {
        label: 'Warning',
        value: assessment?.warningS != null ? formatTime(assessment.warningS) : DASH,
      },
      {
        label: 'First detect',
        value:
          assessment?.firstDetectS != null
            ? `${firstSensor?.name ?? DASH} · T+${formatTime(assessment.firstDetectS)}`
            : DASH,
      },
    ]
    if (uasSpec) {
      rows.push(
        {
          label: 'RCS',
          value: `${rcsM2For(uasSpec)}`,
          unit: ' m²',
          tag: <PfTag model={model} field="rcsM2" />,
        },
        {
          label: 'Swerling',
          value: `${swerlingFor(uasSpec)}`,
          tag: <PfTag model={model} field="swerling" />,
        },
      )
    } else {
      rows.push(
        { label: 'RCS', value: 'no model linked' },
        { label: 'Swerling', value: 'no model linked' },
      )
    }
    return rows
  }, [scenario, entity, model, uasSpec, state, assessment, t, units])

  const phase: TrackPhase = state?.phase ?? 'undetected'
  const style = PHASE_STYLE[phase]
  const coast = state?.coasting && (phase === 'tracked' || phase === 'identified')
  const pillColor = style.color ?? color
  const pill = {
    word: coast ? 'COAST' : style.label,
    style: { color: pillColor, borderColor: pillColor },
  }
  const modelLine = model && uasSpec ? `${model.name} · ${uasSpec.airframe}` : 'no model linked'

  return (
    <div className="detail" data-detail="threat">
      <DetailHeader
        entity={entity}
        color={color}
        pill={pill}
        modelLine={modelLine}
        tags={modelsForEntity(scenario, entity.id)}
      />
      <DetailSection id="file" title="Track file" meta="planning envelope">
        <Rows rows={fileRows} />
      </DetailSection>
      <DetailSection id="phase" title="Phase" meta="planning envelope">
        <Ladder rows={barePhaseRows} durationS={durationS} tS={t} onScrub={setSimTime} />
        {phaseLegend.length > 0 ? <Legend entries={phaseLegend} /> : null}
      </DetailSection>
      <DetailSection
        id="pd"
        title="Pd by sensor"
        meta={pd.length > 0 ? `${pd.length} sensor${pd.length === 1 ? '' : 's'} · planning envelope` : null}
      >
        {pd.length > 0 ? (
          <TimeSeries series={pd} tS={t} onScrub={setSimTime} yDomain={[0, 1]} yLabel="Pd" />
        ) : (
          <p className="muted small">No radar Pd model observed this track.</p>
        )}
      </DetailSection>
      <DetailSection
        id="survival"
        title="Survival"
        meta={survival?.band80 ? 'MC mean · 80/95% replicate quantiles' : summary ? 'MC estimate unavailable' : 'planning envelope'}
      >
        <p className="muted small">Event markers use the planning envelope.</p>
        {survival ? (
          <TimeSeries
            series={[survival]}
            tS={t}
            onScrub={setSimTime}
            yDomain={[0, shipCount]}
            yLabel="ships"
            marks={survivalMarks}
          />
        ) : (
          <p className="muted small">No threats with flight paths.</p>
        )}
      </DetailSection>
    </div>
  )
}
