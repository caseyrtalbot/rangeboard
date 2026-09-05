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
import { modelFor } from '../../../state/store'
import { STATE_LABEL, stateClass } from '../SystemStatus'
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
  const { scenario, runId, setSimTime, assessments, report, t, durationS } = run
  const model = modelFor(scenario, entity)
  const spec = model?.effector
  const doctrine = effectiveDoctrine(scenario)
  const component = useComponentAt(run, entity.id)
  const color = entity.color ?? model?.color ?? '#c46a5a'

  const series = useMemo(() => {
    void runId
    return effectorSeries(scenario, entity.id)
  }, [scenario, runId, entity.id])
  const marks = useMemo(() => {
    void runId
    return salvoMarks(scenario, entity.id)
  }, [scenario, runId, entity.id])
  const releaseRows = useMemo(() => {
    void runId
    // The gutter is 64 px: the board designator, as the canvas labels draw it.
    return releaseLadderRows(scenario, entity.id).map((row) => ({
      ...row,
      label: boardDesignator(row.label),
    }))
  }, [scenario, runId, entity.id])
  const bareReleaseRows = useMemo(() => releaseRows.map(bareSpans), [releaseRows])
  const pk = useMemo(() => series.filter((s) => s.id.startsWith('pk.')), [series])
  const rounds = series.find((s) => s.id === 'rounds')
  const salvos = series.find((s) => s.id === 'salvos')
  const magazineSize = spec?.magazineSize

  const threats = useMemo(() => assessments.filter((a) => a.status !== 'no-path'), [assessments])
  const doctrineRows = useMemo<ReactNode[][]>(() => {
    const commit = spec ? commitPkFor(spec, doctrine).toFixed(2) : DASH
    return threats.map((a) => {
      const gate = a.effectorGates?.find((g) => g.effectorId === entity.id)
      return [
        scenario.entities.find((e) => e.id === a.uasId)?.name ?? a.uasId,
        gate ? formatTime(gate.gateS) : DASH,
        gate ? formatTime(gate.readyS) : DASH,
        commit,
      ]
    })
  }, [scenario, spec, doctrine, threats, entity.id])

  const legend: LegendEntry[] = releaseRows.map((row) => ({
    label: row.label,
    color: row.spans[0]?.color ?? OTHER_TOKEN,
  }))

  const attrition = report.effectors.find((e) => e.effectorId === entity.id)
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
    ? { word: STATE_LABEL[component.state], className: stateClass(component.state) }
    : { word: 'OFFLINE', className: 'bad' }
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
          <TimeSeries series={pk} tS={t} onScrub={setSimTime} yDomain={[0, 1]} yLabel="Pk" />
        ) : (
          none
        )}
      </DetailSection>
      <DetailSection id="magazine" title="Magazine" meta={rounds ? null : 'continuous capacity'}>
        {rounds && magazineSize != null ? (
          <TimeSeries
            series={[rounds]}
            tS={t}
            onScrub={setSimTime}
            yDomain={[0, magazineSize]}
            yLabel="rounds"
            marks={marks}
          />
        ) : salvos ? (
          <TimeSeries series={[salvos]} tS={t} onScrub={setSimTime} marks={marks} />
        ) : (
          none
        )}
      </DetailSection>
      <DetailSection id="release" title="Release and effect">
        {releaseRows.length > 0 ? (
          <>
            <Ladder rows={bareReleaseRows} durationS={durationS} tS={t} onScrub={setSimTime} />
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
      <DetailSection id="capacity" title="Capacity" meta="full run">
        <Rows rows={capacityRows} />
      </DetailSection>
    </div>
  )
}
