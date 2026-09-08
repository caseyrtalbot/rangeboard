import { reached } from '../../../analysis/horizon'
import { useMemo } from 'react'
import { modelsForEntity } from '../../../analysis/fidelity'
import { FT_TO_M } from '../../../analysis/sensorEnv'
import { phaseLadderRow, threatSeries, trackMarks, withBands } from '../../../analysis/series'
import { Ladder } from '../../../charts/Ladder'
import { TimeSeries } from '../../../charts/TimeSeries'
import type { ChartMark, Series } from '../../../charts/types'
import { bearingDeg } from '../../../geometry/geo'
import { slantRangeM } from '../../../geometry/slant'
import { rcsM2For, swerlingFor } from '../../../model/rcsFactors'
import type { Entity } from '../../../model/types'
import { mountHeightOf } from '../../../model/types'
import { entityPosAt, threatAltitudeFt } from '../../../playback/tracks'
import { PHASE_STYLE } from '../../../playback/trackState'
import type { TrackPhase } from '../../../playback/trackState'
import { trackTimelineOf } from '../../../playback/trackState'
import { sweepAt } from '../../../playback/sweepAt'
import { useStore } from '../../../state/store'
import { modelFor } from '../../../model/scenario'
import { entityInk } from '../../../ui/ink'
import { threatReadoutAt } from '../threatReadout'
import { SURVIVAL_LABELS } from '../widgets/labels'
import { bandNote, currentSummary } from '../widgets/mc'
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

/** The threat pane: the track file at t, the phase ladder, Pd by sensor and survival. */
export function ThreatDetail({ entity }: { entity: Entity }) {
  const run = useDetailRun()
  const { scenario, runId, setSimTime, units, assessments, report, t, durationS, horizon, tObs, untouched } = run
  const mc = useStore((s) => s.mc)
  const summary = currentSummary(mc, runId)
  const model = modelFor(scenario, entity)
  const uasSpec = model?.uas
  const color = entityInk(entity, model)

  // Both caches key on the scenario object, so the canvas and this pane share
  // one timeline and one sweep per instant.
  const timeline = trackTimelineOf(scenario, assessments, report)
  const readout = useMemo(
    () =>
      threatReadoutAt({
        scenario,
        entity,
        timeline,
        assessments,
        tS: tObs,
        horizon,
        units,
        sweep: untouched ? undefined : sweepAt(scenario, timeline, tObs),
      }),
    [scenario, entity, timeline, assessments, tObs, units, horizon, untouched],
  )
  const state = readout.state

  const series = useMemo(() => {
    void runId
    return threatSeries(scenario, entity.id)
  }, [scenario, runId, entity.id])
  const phaseRow = useMemo(() => {
    void runId
    return phaseLadderRow(scenario, entity.id)
  }, [scenario, runId, entity.id])
  const barePhaseRows = useMemo(() => [bareSpans(phaseRow)], [phaseRow])
  const pd = useMemo(() => {
    const observations = assessments.find((a) => a.uasId === entity.id)?.sensorObservations ?? []
    return series.filter((series) => series.id.startsWith('pd.') && (!horizon.scoped ||
      observations.some((observation) => observation.sensorId === series.id.slice(3) && observation.firstDetectS <= tObs)))
  }, [series, assessments, entity.id, horizon.scoped, tObs])
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
    return horizon.scoped ? marks.filter((mark) => reached(mark.tS, horizon)) : marks
  }, [scenario, runId, report, entity.id, horizon])

  // The phase legend lists only the phases the row shows, by the label the builder wrote.
  const phaseLegend: LegendEntry[] = (Object.keys(PHASE_STYLE) as TrackPhase[])
    .filter((phase) => {
      const style = PHASE_STYLE[phase]
      return style.color != null && phaseRow.spans.some((span) => span.label === style.label && (!horizon.scoped || span.startS <= tObs))
    })
    .map((phase) => ({
      label: PHASE_STYLE[phase].label.toLowerCase(),
      color: PHASE_STYLE[phase].color ?? color,
    }))

  const fileRows = useMemo<DetailRow[]>(() => {
    const holdIds = state?.holdingSensorIds ?? []
    const sensor = scenario.entities.find((e) => e.id === holdIds[0])
    let slantText = DASH
    let bearingText = DASH
    if (sensor) {
      const pos = entityPosAt(scenario, entity, tObs)
      const groundM = Math.hypot(pos.x - sensor.pos.x, pos.y - sensor.pos.y)
      const altM = threatAltitudeFt(scenario, entity) * FT_TO_M
      const hM = mountHeightOf(modelFor(scenario, sensor)?.sensor ?? {})
      slantText = (slantRangeM(groundM, altM - hM) / 1000).toFixed(1)
      bearingText = `${Math.round(bearingDeg(sensor.pos, pos))}`
    }
    const rows: DetailRow[] = readout.rows.map((row) => ({
      label: row.label,
      value: row.value,
      tag:
        row.id === 'altitude' && entity.altitudeFt == null
          ? <PfTag model={model} field="altitudeFt" absent />
          : null,
    }))
    rows.push(
      { label: 'Slant range', value: slantText, unit: sensor ? ' km' : undefined },
      { label: 'Bearing', value: bearingText, unit: sensor ? ' °' : undefined },
      { label: horizon.scoped ? 'Engage status' : 'Engage status (full run)', value: readout.engageText },
      { label: horizon.scoped ? 'Warning' : 'Warning (full path)', value: readout.warningText },
      { label: horizon.scoped ? 'First detect' : 'First detect (full path)', value: readout.firstDetectText },
    )
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
  }, [scenario, entity, model, uasSpec, state, tObs, readout, horizon.scoped])

  const phase: TrackPhase = readout.phase
  const style = PHASE_STYLE[phase]
  const pillColor = style.color ?? color
  const pill = {
    word: readout.pillLabel,
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
      <DetailSection
        id="file"
        title="Track file"
        meta={horizon.scoped ? `${readout.cursorText} observed` : `${readout.cursorText} cursor · full-path/full-run fields marked`}
      >
        {readout.ghostLine ? <p className="detail-ghost">{readout.ghostLine}</p> : null}
        <Rows rows={fileRows} />
      </DetailSection>
      {horizon.scoped ? (
        <DetailSection id="planned-path" title="Planned path">
          <Rows rows={readout.planningRows} />
        </DetailSection>
      ) : null}
      <DetailSection id="phase" title="Phase" meta="planning envelope">
        <Ladder rows={barePhaseRows} durationS={durationS} tS={t} horizonS={horizon.scoped ? horizon.horizonS : undefined} onScrub={setSimTime} />
        {phaseLegend.length > 0 ? <Legend entries={phaseLegend} /> : null}
      </DetailSection>
      <DetailSection
        id="pd"
        title="Pd by sensor"
        meta={pd.length > 0 ? `${pd.length} sensor${pd.length === 1 ? '' : 's'} · planning envelope` : null}
      >
        {pd.length > 0 ? (
          <TimeSeries series={pd} tS={t} horizonS={horizon.scoped ? horizon.horizonS : undefined} onScrub={setSimTime} yDomain={[0, 1]} yLabel="Pd" />
        ) : (
          <p className="muted small">No radar Pd model observed this track.</p>
        )}
      </DetailSection>
      <DetailSection
        id="survival"
        title="Survival"
        meta={survival && summary ? `MC mean · ${bandNote(summary.replicates)}` : summary ? 'MC estimate unavailable' : 'planning envelope'}
      >
        <p className="muted small">Event markers use the planning envelope.</p>
        {survival ? (
          <TimeSeries
            series={[survival]}
            tS={t} horizonS={horizon.scoped ? horizon.horizonS : undefined}
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
