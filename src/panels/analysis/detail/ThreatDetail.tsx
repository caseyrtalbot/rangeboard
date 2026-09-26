import { useMemo, useState } from 'react'
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
import type { ThreatReadoutField } from '../threatReadout'
import { SURVIVAL_LABELS } from '../labels'
import { DetailHeader, InfoButton } from './DetailHeader'
import { DetailSection } from './DetailSection'
import type { DetailRow, LegendEntry } from './detailRows'
import { bareSpans, DASH, Legend, PfTag, Rows, useDetailRun } from './detailRows'

/**
 * The threat pane: the model basis, then Track, Engagement, Path and Phase at t, Pd by
 * sensor and survival.
 */
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

  const [holdOpen, setHoldOpen] = useState(false)
  const sections = useMemo(() => {
    const byId = new Map(readout.rows.map((row) => [row.id, row]))
    const value = (id: ThreatReadoutField) => byId.get(id)?.value ?? DASH
    const plain = (id: ThreatReadoutField): DetailRow => ({
      label: byId.get(id)?.label ?? id,
      value: value(id),
    })
    const holdIds = state?.holdingSensorIds ?? []
    const sensor = scenario.entities.find((e) => e.id === holdIds[0])
    let slantText = DASH
    let bearingText = DASH
    if (sensor) {
      const measured = state?.sensors.find((s) => s.sensorId === sensor.id)
      slantText = measured?.slantRangeM != null ? (measured.slantRangeM / 1000).toFixed(1) : DASH
      bearingText = `${Math.round(bearingDeg(sensor.pos, readout.position))}`
    }
    // The hold value is the count, then one clause per sensor; a clause's own
    // separator sits inside its parentheses.
    const holdText = value('hold')
    const holders = holdText.split(/ · (?![^()]*\))/).slice(1)
    const altitudeBand = value('altitude').slice(readout.altitudeText.length).replace(/^ · /, '')
    const track: DetailRow[] = [
      plain('position'),
      plain('speedHeading'),
      {
        label: 'Altitude',
        value: readout.altitudeText,
        tag: (
          <>
            <InfoButton
              label="About altitude"
              title={altitudeBand ? `Constant · ${altitudeBand}` : 'Constant'}
            />
            {entity.altitudeFt == null ? <PfTag model={model} field="altitudeFt" absent /> : null}
          </>
        ),
      },
      plain('classification'),
      sensor && holders.length > 0
        ? {
            label: 'Held by',
            value: sensor.name,
            title: holdText,
            tag: (
              <button
                type="button"
                className="mini det-drill-btn"
                aria-expanded={holdOpen}
                aria-controls={holdOpen ? 'det-hold-list' : undefined}
                onClick={() => setHoldOpen(!holdOpen)}
              >
                {`${holdIds.length} sensor${holdIds.length === 1 ? '' : 's'} ›`}
              </button>
            ),
            more: holdOpen ? (
              <ul className="det-drill" id="det-hold-list" aria-label="Held by">
                {holders.map((holder) => (
                  <li key={holder} title={holder}>
                    {holder}
                  </li>
                ))}
              </ul>
            ) : null,
          }
        : { label: 'Held by', value: holdText },
      plain('navigation'),
      {
        label: horizon.scoped ? 'First detect' : 'First detect (full path)',
        value: readout.firstDetectText,
      },
    ]
    if (uasSpec) {
      track.push(
        {
          label: 'RCS',
          value: `${rcsM2For(uasSpec)}`,
          unit: ' m²',
        },
        { label: 'Swerling', value: `${swerlingFor(uasSpec)}` },
      )
    } else {
      track.push(
        { label: 'RCS', value: 'no model linked' },
        { label: 'Swerling', value: 'no model linked' },
      )
    }
    const engagement: DetailRow[] = [
      plain('salvos'),
      plain('effects'),
      plain('residual'),
      plain('ew'),
      {
        label: horizon.scoped ? 'Engage status' : 'Engage status (full run)',
        value: readout.engageText,
      },
      { label: horizon.scoped ? 'Warning' : 'Warning (full path)', value: readout.warningText },
    ]
    const path: DetailRow[] = [
      ...(horizon.scoped ? readout.planningRows : []),
      plain('arrival'),
      { label: 'Slant range', value: slantText, unit: sensor ? ' km' : undefined },
      { label: 'Bearing', value: bearingText, unit: sensor ? ' °' : undefined },
    ]
    return { track, engagement, path, platform: value('platform') }
  }, [scenario, entity, model, uasSpec, state, readout, horizon.scoped, holdOpen])

  const engagementSummary = state
    ? `${state.kineticSalvos} kinetic · ${state.effectsLanded} landed · ${
        state.hardKillCount + state.missionKillCount
      } kills`
    : untouched
      ? '0 kinetic · 0 landed · 0 kills'
      : null
  // The summary names only values the Path body renders: the planning rows sit
  // there under a scoped horizon alone.
  const [cpaText, arrivalText] = ['cpa', 'arrival'].map((id) =>
    horizon.scoped
      ? (readout.planningRows.find((row) => row.id === id)?.value.split(' · ')[0] ?? DASH)
      : DASH,
  )
  const pathSummary =
    cpaText.startsWith('T+') || arrivalText.startsWith('T+')
      ? `CPA ${cpaText} · arrival ${arrivalText}`
      : cpaText
  const phaseSummary =
    phaseLegend.length > 0 ? phaseLegend.map((entry) => entry.label).join(' · ') : DASH
  const tags = modelsForEntity(scenario, entity.id)

  const phase: TrackPhase = readout.phase
  const style = PHASE_STYLE[phase]
  const pillColor = style.color ?? color
  const pill = {
    word: readout.pillLabel,
    style: { color: pillColor, borderColor: pillColor },
  }

  return (
    <div className="detail" data-detail="threat">
      <DetailHeader
        entity={entity}
        color={color}
        pill={pill}
        modelLine={sections.platform}
        tags={tags}
      />
      <DetailSection
        id="track"
        title="Track"
        collapsible
        meta={
          horizon.scoped
            ? `${readout.cursorText} observed`
            : `${readout.cursorText} cursor · full-path/full-run fields marked`
        }
      >
        <Rows rows={sections.track} />
      </DetailSection>
      <DetailSection
        id="engagement"
        title="Engagement"
        collapsible
        defaultOpen={false}
        meta={engagementSummary}
      >
        {readout.ghostLine ? <p className="detail-ghost">{readout.ghostLine}</p> : null}
        <Rows rows={sections.engagement} />
      </DetailSection>
      <DetailSection id="path" title="Path" collapsible defaultOpen={false} meta={pathSummary}>
        <Rows rows={sections.path} />
      </DetailSection>
      <DetailSection id="phase" title="Phase" collapsible defaultOpen={false} meta={phaseSummary}>
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
