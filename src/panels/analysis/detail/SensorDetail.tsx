import { useMemo, type ReactNode } from 'react'
import {
  SCAN_S,
  scanPeriodS,
  trackDropMissesFor,
  trackInitMFor,
  trackInitNFor,
  trackInitSFor,
} from '../../../analysis/doctrineFactors'
import { modelsForEntity } from '../../../analysis/fidelity'
import { radarCalibration, refRcsM2For, targetScaled } from '../../../analysis/sensorEnv'
import { boardDesignator } from '../../../canvas/labelLayout'
import { Ladder } from '../../../charts/Ladder'
import { TimeSeries } from '../../../charts/TimeSeries'
import type { Series } from '../../../charts/types'
import { formatTime } from '../../../geometry/geo'
import type { Entity } from '../../../model/types'
import { defaultSensorRole, effectiveDoctrine, mountHeightOf } from '../../../model/types'
import { physicsSwitches } from '../../../model/types'
import { modelFor } from '../../../model/scenario'
import { entityInk } from '../../../ui/ink'
import { pfaText } from '../../inspector/kit'
import { STATE_LABEL, stateTone } from '../SystemStatus'
import { EmptyRow } from '../controls'
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

/** The sensor pane: Pd and slant per track, the track ladder, load, and the gates by threat. */
export function SensorDetail({ entity }: { entity: Entity }) {
  const run = useDetailRun()
  const { scenario, setSimTime, assessments, t, durationS, horizon, untouched } = run
  const model = modelFor(scenario, entity)
  const spec = model?.sensor
  const doctrine = effectiveDoctrine(scenario)
  const component = useComponentAt(run, entity.id)
  const color = entityInk(entity, model)

  const fullSeries = run.series?.sensors[entity.id] ?? []
  const series = fullSeries.filter((s) => s.values.some(Number.isFinite))
  const ladderRows = (run.series?.sensorLadders[entity.id] ?? []).map((row) => ({
    ...row,
    label: boardDesignator(row.label),
  }))
  const bareLadderRows = ladderRows.map(bareSpans)
  const pd = useMemo(() => series.filter((s) => s.id.startsWith('pd.')), [series])
  const slant = useMemo<Series[]>(
    () =>
      series
        .filter((s) => s.id.startsWith('slant.'))
        .map((s) => ({ ...s, unit: 'km', values: s.values.map((v) => v / 1000) })),
    [series],
  )

  const threats = useMemo(() => assessments.filter((a) => a.status !== 'no-path'), [assessments])
  const gateRows: ReactNode[][] = threats.map((a) => {
    const sample = run.sweep?.sensors.find(
      (s) => s.sensorId === entity.id && s.threatId === a.uasId,
    )
    return [
      scenario.entities.find((e) => e.id === a.uasId)?.name ?? a.uasId,
      sample?.stateAtTime ?? DASH,
      sample?.lastMeasurementTimeS != null ? `T+${formatTime(sample.lastMeasurementTimeS)}` : DASH,
      sample?.pd != null ? sample.pd.toFixed(2) : DASH,
    ]
  })

  const pill = component
    ? { word: STATE_LABEL[component.state], tone: stateTone(component.state) }
    : { word: 'OFFLINE', tone: 'critical' as const }
  const modelLine =
    model && spec
      ? `${model.name} · ${defaultSensorRole(spec).replace(/-/g, ' ')}`
      : 'no model linked'

  if (!spec) {
    return (
      <div className="detail" data-detail="sensor">
        <DetailHeader
          entity={entity}
          color={color}
          pill={pill}
          modelLine={modelLine}
          tags={modelsForEntity(scenario, entity.id)}
        />
        <EmptyRow>No model linked.</EmptyRow>
      </div>
    )
  }

  const cal = radarCalibration(spec, physicsSwitches(scenario).includes('singlePulseRadar'))
  const scanRate = scanPeriodS(spec, false)
  // No stated period: a target with an RCS still makes the radar Pd-modeled, so
  // it scans on the role period. The panel names no threat, so it says so.
  const rolePeriod = scanRate == null ? scanPeriodS(spec, targetScaled(spec)) : null
  const scan = scanRate != null || rolePeriod != null
  const initM = trackInitMFor(spec)
  const initN = trackInitNFor(spec)
  const legend: LegendEntry[] = [
    ...new Map(
      ladderRows.flatMap((row) =>
        row.spans.map(
          (span) =>
            [
              span.label,
              { label: span.label ?? 'Held track file', color: span.color ?? 'warn' },
            ] as const,
        ),
      ),
    ).values(),
  ]
  const ladderMeta = scan
    ? `M ${initM} · N ${initN} · drop ${trackDropMissesFor(spec)}`
    : `hold ${trackInitSFor(spec, doctrine)} s`

  const loadNow = component?.tracksNow

  const el = spec.elevationDeg
  const instrumented = spec.instrumentedRangeM
  const loadRows: DetailRow[] = [
    { label: 'Held track files', value: loadNow != null ? `${loadNow}` : DASH },
    scanRate != null
      ? {
          label: 'Scan period',
          value: `${scanRate}`,
          unit: ' s',
          tag: <PfTag model={model} field="updateRateS" absent={spec.updateRateS == null} />,
        }
      : rolePeriod != null
        ? {
            label: 'Scan period',
            value: `by role · ${SCAN_S[defaultSensorRole(spec)]} s`,
          }
        : {
            label: 'Scan period',
            value: 'role table',
            unit: ` · ${trackInitSFor(spec, doctrine)} s hold`,
          },
    {
      label: 'Hold clock (union)',
      value: component && !untouched ? formatTime(component.holdSeconds) : DASH,
    },
    {
      label: 'Track seconds (sum)',
      value: component && !untouched ? `${Math.round(component.trackSeconds)}` : DASH,
      unit: component && !untouched ? ' s' : undefined,
    },
    {
      label: 'Placard',
      value:
        spec.sensorType === 'radar'
          ? `${spec.detectRangeM.toLocaleString()} m @ ${refRcsM2For(spec)} m² · Pd ${cal.pd0}`
          : `${spec.detectRangeM.toLocaleString()} m`,
      tag: <PfTag model={model} field="detectRangeM" />,
    },
    instrumented != null
      ? {
          label: 'Instrumented range',
          value: instrumented.toLocaleString(),
          unit: ' m',
          tag: <PfTag model={model} field="instrumentedRangeM" />,
        }
      : { label: 'Instrumented range', value: 'none recorded' },
    el
      ? {
          label: 'Elevation',
          value: `${el[0]} to ${el[1]}`,
          unit: ' °',
          tag: <PfTag model={model} field="elevationDeg" />,
        }
      : { label: 'Elevation', value: 'not recorded' },
  ]

  const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
  const loadSummary = `${loadNow != null ? loadNow : DASH} held · hold ${
    component && !untouched ? formatTime(component.holdSeconds) : DASH
  }`

  return (
    <div className="detail" data-detail="sensor">
      <DetailHeader
        entity={entity}
        color={color}
        pill={pill}
        modelLine={modelLine}
        tags={modelsForEntity(scenario, entity.id)}
      />
      <DetailSection
        id="pd"
        title="Pd per track"
        collapsible
        meta={pd.length > 0 ? `Swerling ${cal.swerling0} · Pfa ${pfaText(cal.pfa)}` : DASH}
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
          <EmptyRow>No Pd model for this sensor.</EmptyRow>
        )}
      </DetailSection>
      <DetailSection
        id="slant"
        title="Slant range per track"
        collapsible
        defaultOpen={false}
        meta={`mount ${mountHeightOf(spec)} m`}
      >
        {slant.length > 0 ? (
          <TimeSeries
            series={slant}
            tS={t}
            horizonS={horizon.scoped ? horizon.horizonS : undefined}
            onScrub={setSimTime}
            yLabel="km"
          />
        ) : (
          <EmptyRow>No track observed.</EmptyRow>
        )}
      </DetailSection>
      <DetailSection
        id="ladder"
        title="Track ladder"
        collapsible
        defaultOpen={false}
        meta={ladderMeta}
      >
        {ladderRows.length > 0 ? (
          <>
            <Ladder
              rows={bareLadderRows}
              durationS={durationS}
              tS={t}
              horizonS={horizon.scoped ? horizon.horizonS : undefined}
              onScrub={setSimTime}
            />
            <Legend entries={legend} />
          </>
        ) : (
          <EmptyRow>No track observed.</EmptyRow>
        )}
      </DetailSection>
      <DetailSection
        id="load"
        title="Load and hold"
        collapsible
        defaultOpen={false}
        meta={loadSummary}
      >
        <Rows rows={loadRows} />
      </DetailSection>
      <DetailSection
        id="gates"
        title="Sensor state by threat"
        collapsible
        defaultOpen={false}
        meta={`${plural(gateRows.length, 'threat')} · retained sensor measurements`}
      >
        {gateRows.length > 0 ? (
          <DetailTable head={['Threat', 'State', 'Last measured', 'Pd']} rows={gateRows} />
        ) : (
          <EmptyRow>No threats with flight paths.</EmptyRow>
        )}
      </DetailSection>
    </div>
  )
}
