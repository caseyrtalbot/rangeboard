import { useMemo } from 'react'
import { modelsForEntity } from '../../../analysis/fidelity'
import { Ladder } from '../../../charts/Ladder'
import { TimeSeries } from '../../../charts/TimeSeries'
import type { ChartMark } from '../../../charts/types'
import { bearingDeg } from '../../../geometry/geo'
import { rcsM2For, swerlingFor } from '../../../model/rcsFactors'
import type { Entity } from '../../../model/types'
import { PHASE_STYLE } from '../../../playback/trackState'
import type { TrackPhase } from '../../../playback/trackState'
import { modelFor } from '../../../model/scenario'
import { entityInk } from '../../../ui/ink'
import { threatReadoutAt } from '../threatReadout'
import { SURVIVAL_LABELS } from '../labels'
import { DetailHeader } from './DetailHeader'
import { DetailSection } from './DetailSection'
import type { DetailRow, LegendEntry } from './detailRows'
import { bareSpans, DASH, Legend, PfTag, Rows, useDetailRun } from './detailRows'

/** The threat pane: the track file at t, the phase ladder, Pd by sensor and survival. */
export function ThreatDetail({ entity }: { entity: Entity }) {
  const run = useDetailRun()
  const {
    scenario,
    setSimTime,
    units,
    view,
    sweep,
    report,
    t,
    durationS,
    horizon,
    tObs,
    untouched,
  } = run
  const model = modelFor(scenario, entity)
  const uasSpec = model?.uas
  const color = entityInk(entity, model)

  const readout = useMemo(
    () =>
      threatReadoutAt({
        scenario,
        entity,
        trial: view,
        horizonS: untouched ? null : tObs,
        tS: tObs,
        horizon,
        units,
        trialSweep: sweep,
      }),
    [scenario, entity, view, tObs, horizon, units, sweep, untouched],
  )
  const state = readout.state

  const series = run.series?.threats[entity.id] ?? []
  const phaseRow = run.series?.phase.find((row) => row.id === entity.id)
  const barePhaseRows = phaseRow ? [bareSpans(phaseRow)] : []
  const pd = series.filter((s) => s.id.startsWith('pd.') && s.values.some(Number.isFinite))
  const residual = series.find((s) => s.id === 'residual')
  const shipCount = Math.max(1, entity.formation?.count ?? 1)
  const survival = residual ? { ...residual, label: SURVIVAL_LABELS.survives } : null
  const survivalMarks: ChartMark[] = (run.series?.marks[entity.id] ?? []).filter(
    (mark) => mark.label === 'ARR' || mark.label === 'CPA',
  )
  const effect = report?.events.find(
    (e) => e.uasId === entity.id && e.killDelta === 1 && e.tEffectS <= tObs,
  )
  if (effect) survivalMarks.push({ tS: effect.tEffectS, label: 'FX', color: 'danger' })

  const phaseLegend: LegendEntry[] = [
    ...new Map(
      (phaseRow?.spans ?? []).map(
        (span) =>
          [
            span.label,
            { label: span.label ?? 'Track-file phase', color: span.color ?? color },
          ] as const,
      ),
    ).values(),
  ]

  const fileRows = useMemo<DetailRow[]>(() => {
    const holdIds = state?.holdingSensorIds ?? []
    const sensor = scenario.entities.find((e) => e.id === holdIds[0])
    let slantText = DASH
    let bearingText = DASH
    if (sensor) {
      const measured = state?.sensors.find((s) => s.sensorId === sensor.id)
      slantText = measured?.slantRangeM != null ? (measured.slantRangeM / 1000).toFixed(1) : DASH
      bearingText = `${Math.round(bearingDeg(sensor.pos, readout.position))}`
    }
    const rows: DetailRow[] = readout.rows.map((row) => ({
      label: row.label,
      value: row.value,
      tag:
        row.id === 'altitude' && entity.altitudeFt == null ? (
          <PfTag model={model} field="altitudeFt" absent />
        ) : null,
    }))
    rows.push(
      { label: 'Slant range', value: slantText, unit: sensor ? ' km' : undefined },
      { label: 'Bearing', value: bearingText, unit: sensor ? ' °' : undefined },
      {
        label: horizon.scoped ? 'Engage status' : 'Engage status (full run)',
        value: readout.engageText,
      },
      { label: horizon.scoped ? 'Warning' : 'Warning (full path)', value: readout.warningText },
      {
        label: horizon.scoped ? 'First detect' : 'First detect (full path)',
        value: readout.firstDetectText,
      },
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
  }, [scenario, entity, model, uasSpec, state, readout, horizon.scoped])

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
      <p className="muted small">{run.stateText}</p>
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
        meta={
          horizon.scoped
            ? `${readout.cursorText} observed`
            : `${readout.cursorText} cursor · full-path/full-run fields marked`
        }
      >
        {readout.ghostLine ? <p className="detail-ghost">{readout.ghostLine}</p> : null}
        <Rows rows={fileRows} />
      </DetailSection>
      {horizon.scoped ? (
        <DetailSection id="planned-path" title="Planned path">
          <Rows rows={readout.planningRows} />
        </DetailSection>
      ) : null}
      <DetailSection id="phase" title="Phase" meta="Simulated trial">
        <Ladder
          rows={barePhaseRows}
          durationS={durationS}
          tS={t}
          horizonS={horizon.scoped ? horizon.horizonS : undefined}
          onScrub={setSimTime}
        />
        {phaseLegend.length > 0 ? <Legend entries={phaseLegend} /> : null}
      </DetailSection>
      <DetailSection
        id="pd"
        title="Pd by sensor"
        meta={
          pd.length > 0
            ? `${pd.length} sensor${pd.length === 1 ? '' : 's'} · sampled measurements`
            : null
        }
      >
        {pd.length > 0 ? (
          <TimeSeries
            series={pd}
            tS={t}
            horizonS={horizon.scoped ? horizon.horizonS : undefined}
            onScrub={setSimTime}
            yDomain={[0, 1]}
            yLabel="Pd"
          />
        ) : (
          <p className="muted small">No radar Pd model observed this track.</p>
        )}
      </DetailSection>
      <DetailSection id="survival" title="Survival" meta="Simulated trial counts">
        {survival ? (
          <TimeSeries
            series={[survival]}
            tS={t}
            horizonS={horizon.scoped ? horizon.horizonS : undefined}
            onScrub={setSimTime}
            yDomain={[0, shipCount]}
            yLabel="members"
            marks={survivalMarks}
          />
        ) : (
          <p className="muted small">No threats with flight paths.</p>
        )}
      </DetailSection>
    </div>
  )
}
