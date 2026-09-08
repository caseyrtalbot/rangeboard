import { FORECAST_IN_ANALYZE, reached } from '../../../analysis/horizon'
import { useMemo, type ReactNode } from 'react'
import { bdaSFor, commitPkFor, launchPolicyLabel } from '../../../analysis/doctrineFactors'
import { modelsForEntity } from '../../../analysis/fidelity'
import { effectorSeries, releaseLadderRows, salvoMarks } from '../../../analysis/series'
import { boardDesignator } from '../../../canvas/labelLayout'
import { Ladder } from '../../../charts/Ladder'
import { TimeSeries } from '../../../charts/TimeSeries'
import { OTHER_TOKEN } from '../../../charts/tokens'
import { formatTime } from '../../../geometry/geo'
import type { Entity } from '../../../model/types'
import { effectiveDoctrine } from '../../../model/types'
import { modelFor } from '../../../model/scenario'
import { entityInk } from '../../../ui/ink'
import { STATE_LABEL, stateTone } from '../SystemStatus'
import { DetailHeader } from './DetailHeader'
import { DetailSection } from './DetailSection'
import type { DetailRow, LegendEntry } from './detailRows'
import {
  bareSpans,
  DASH,
  DetailTable,
  Legend,
  PfTag,
  Rows,
  useComponentAt,
  useDetailRun,
} from './detailRows'

/** The effector pane: Pk per track, the magazine, release to effect, doctrine and capacity. */
export function EffectorDetail({ entity }: { entity: Entity }) {
  const run = useDetailRun()
  const { scenario, runId, setSimTime, assessments, report, t, durationS, horizon } = run
  const model = modelFor(scenario, entity)
  const spec = model?.effector
  const doctrine = effectiveDoctrine(scenario)
  const component = useComponentAt(run, entity.id)
  const color = entityInk(entity, model)

  const series = useMemo(() => {
    void runId
    return effectorSeries(scenario, entity.id)
  }, [scenario, runId, entity.id])
  const marks = useMemo(() => {
    void runId
    return salvoMarks(scenario, entity.id).filter((mark) => !horizon.scoped || reached(mark.tS, horizon))
  }, [scenario, runId, entity.id, horizon])
  const releaseRows = useMemo(() => {
    void runId
    // The gutter is 84 px (Ladder GUTTER_W): the board designator, as the canvas labels draw it.
    return releaseLadderRows(scenario, entity.id).filter((row) =>
      !horizon.scoped || row.spans.some((span) => reached(span.startS, horizon)),
    ).map((row) => ({
      ...row,
      label: boardDesignator(row.label),
    }))
  }, [scenario, runId, entity.id, horizon])
  const bareReleaseRows = useMemo(() => releaseRows.map(bareSpans), [releaseRows])
  const pk = useMemo(() => series.filter((s) => s.id.startsWith('pk.') && (!horizon.scoped ||
    report.events.some((event) => event.effectorId === entity.id && event.uasId === s.id.slice(3) && reached(event.tEffectS, horizon)))),
  [series, report, entity.id, horizon])
  const rounds = series.find((s) => s.id === 'rounds')
  const salvos = series.find((s) => s.id === 'salvos')
  const magazineSize = spec?.magazineSize

  const threats = useMemo(() => assessments.filter((a) => a.status !== 'no-path'), [assessments])
  const doctrineRows = useMemo<ReactNode[][]>(() => {
    const missing = horizon.scoped ? <span title={FORECAST_IN_ANALYZE}>{DASH}</span> : DASH
    const commit = spec ? commitPkFor(spec, doctrine).toFixed(2) : DASH
    return threats.map((a) => {
      const gate = a.effectorGates?.find((g) => g.effectorId === entity.id)
      return [
        scenario.entities.find((e) => e.id === a.uasId)?.name ?? a.uasId,
        gate && (!horizon.scoped || reached(gate.gateS, horizon)) ? formatTime(gate.gateS) : missing,
        gate && (!horizon.scoped || reached(gate.readyS, horizon)) ? formatTime(gate.readyS) : missing,
        commit,
      ]
    })
  }, [scenario, spec, doctrine, threats, entity.id, horizon])

  const legend: LegendEntry[] = [...new Map(releaseRows.flatMap((row) =>
    row.spans.filter((span) => !horizon.scoped || reached(span.startS, horizon)).map((span) => {
      const label = span.label === 'preparation' || span.label === 'launch timing unavailable'
        ? span.label : `${row.label} · ${span.label ?? 'effect'}`
      return [label, { label, color: span.color ?? OTHER_TOKEN }] as const
    }),
  )).values()]

  const landed = report.events.filter((event) => event.effectorId === entity.id && reached(event.tEffectS, horizon))
  const attrition = horizon.scoped ? {
    shotsFired: landed.filter((event) => event.channelClass === 'kinetic').length,
    deSalvos: landed.filter((event) => event.channelClass === 'directed-energy').length,
    jamSalvos: landed.filter((event) => event.channelClass === 'ew').length,
    expectedRoundsRemaining: magazineSize == null ? null : Math.max(0, magazineSize - landed.length),
  } : report.effectors.find((e) => e.effectorId === entity.id)
  const capacityRows: DetailRow[] = [
    { label: 'Kinetic shots', value: attrition ? `${attrition.shotsFired}` : DASH },
    { label: 'DE salvos', value: attrition ? `${attrition.deSalvos}` : DASH },
    { label: 'Jam salvos', value: attrition ? `${attrition.jamSalvos}` : DASH },
    magazineSize != null
      ? {
          label: 'Rounds remaining',
          value:
            attrition?.expectedRoundsRemaining != null
              ? `${attrition.expectedRoundsRemaining}`
              : DASH,
          unit: ` of ${magazineSize}`,
        }
      : { label: 'Rounds remaining', value: 'unlimited' },
    spec
      ? {
          label: 'Engage time',
          value: `${spec.engageTimeS}`,
          unit: ' s',
          tag: <PfTag model={model} field="engageTimeS" />,
        }
      : { label: 'Engage time', value: DASH },
    spec?.flyoutSpeedMps != null
      ? {
          label: 'Flyout speed',
          value: `${spec.flyoutSpeedMps}`,
          unit: ' m/s',
          tag: <PfTag model={model} field="flyoutSpeedMps" />,
        }
      : { label: 'Flyout speed', value: 'none recorded' },
    spec
      ? {
          label: 'BDA dwell',
          value: `${bdaSFor(spec, doctrine)}`,
          unit: ' s',
          tag: <PfTag model={model} field="bdaS" />,
        }
      : { label: 'BDA dwell', value: DASH },
  ]

  const pill = component
    ? { word: STATE_LABEL[component.state], tone: stateTone(component.state) }
    : { word: 'OFFLINE', tone: 'critical' as const }
  const modelLine = model && spec ? `${model.name} · ${spec.effectorType}` : 'no model linked'
  const doctrineMeta = doctrine.enabled ? launchPolicyLabel(doctrine.launchPolicy) : 'doctrine off'
  const none = <p className="muted small">No salvo assigned.</p>

  return (
    <div className="detail" data-detail="effector">
      <p className="muted small">Planning envelope · deterministic readouts and charts.</p>
      <DetailHeader
        entity={entity}
        color={color}
        pill={pill}
        modelLine={modelLine}
        tags={modelsForEntity(scenario, entity.id)}
      />
      <DetailSection id="pk" title="Pk per track">
        {pk.length > 0 ? (
          <TimeSeries series={pk} tS={t} horizonS={horizon.scoped ? horizon.horizonS : undefined} onScrub={setSimTime} yDomain={[0, 1]} yLabel="Pk" />
        ) : (
          none
        )}
      </DetailSection>
      <DetailSection id="magazine" title="Magazine" meta={rounds ? null : 'continuous capacity'}>
        {rounds && magazineSize != null ? (
          <TimeSeries
            series={[rounds]}
            tS={t} horizonS={horizon.scoped ? horizon.horizonS : undefined}
            onScrub={setSimTime}
            yDomain={[0, magazineSize]}
            yLabel="rounds"
            marks={marks}
          />
        ) : salvos ? (
          <TimeSeries series={[salvos]} tS={t} horizonS={horizon.scoped ? horizon.horizonS : undefined} onScrub={setSimTime} marks={marks} />
        ) : (
          none
        )}
      </DetailSection>
      <DetailSection id="release" title="Assignment, release and effect">
        {releaseRows.length > 0 ? (
          <>
            <Ladder rows={bareReleaseRows} durationS={durationS} tS={t} horizonS={horizon.scoped ? horizon.horizonS : undefined} onScrub={setSimTime} />
            <Legend entries={legend} />
          </>
        ) : (
          none
        )}
      </DetailSection>
      <DetailSection id="doctrine" title="Doctrine by threat" meta={doctrineMeta}>
        {doctrineRows.length > 0 ? (
          <DetailTable head={['Threat', 'Gate', 'Ready', 'Commit Pk']} rows={doctrineRows} />
        ) : (
          <p className="muted small">No threats with flight paths.</p>
        )}
      </DetailSection>
      <DetailSection id="capacity" title="Capacity" meta={horizon.scoped ? 'effects reached' : 'full run'}>
        <Rows rows={capacityRows} />
      </DetailSection>
    </div>
  )
}
