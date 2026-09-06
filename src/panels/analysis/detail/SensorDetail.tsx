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
import {
  FT_TO_M,
  radarCalibration,
  radarPdAt,
  refRcsM2For,
  sensorGeometryGate,
  sensorHoldGate,
  targetScaled,
} from '../../../analysis/sensorEnv'
import {
  scanLoadSeries,
  sensorSeries,
  TRACK_LADDER_STYLE,
  trackLadderRows,
} from '../../../analysis/series'
import { boardDesignator } from '../../../canvas/labelLayout'
import { Ladder } from '../../../charts/Ladder'
import { TimeSeries } from '../../../charts/TimeSeries'
import type { Series } from '../../../charts/types'
import { formatTime } from '../../../geometry/geo'
import { elevationDeg, slantRangeM } from '../../../geometry/slant'
import type { Entity } from '../../../model/types'
import { defaultSensorRole, effectiveDoctrine, mountHeightOf } from '../../../model/types'
import { DT } from '../../../playback/clock'
import { entityPosAt, threatAltitudeFt } from '../../../playback/tracks'
import { modelFor } from '../../../model/scenario'
import { entityInk } from '../../../ui/ink'
import { pfaText } from '../../inspector/kit'
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

const LADDER_KINDS = ['search', 'init', 'track', 'coast', 'drop'] as const

/** The sensor pane: Pd and slant per track, the track ladder, load, and the gates by threat. */
export function SensorDetail({ entity }: { entity: Entity }) {
  const run = useDetailRun()
  const { scenario, runId, setSimTime, assessments, t, durationS } = run
  const model = modelFor(scenario, entity)
  const spec = model?.sensor
  const doctrine = effectiveDoctrine(scenario)
  const component = useComponentAt(run, entity.id)
  const color = entityInk(entity, model)

  const series = useMemo(() => {
    void runId
    return sensorSeries(scenario, entity.id)
  }, [scenario, runId, entity.id])
  const ladderRows = useMemo(() => {
    void runId
    // The gutter is 84 px (Ladder GUTTER_W): the board designator, as the canvas labels draw it.
    return trackLadderRows(scenario, entity.id).map((row) => ({
      ...row,
      label: boardDesignator(row.label),
    }))
  }, [scenario, runId, entity.id])
  const bareLadderRows = useMemo(() => ladderRows.map(bareSpans), [ladderRows])
  const load = useMemo(() => {
    void runId
    return scanLoadSeries(scenario, entity.id)
  }, [scenario, runId, entity.id])
  const pd = useMemo(() => series.filter((s) => s.id.startsWith('pd.')), [series])
  const slant = useMemo<Series[]>(
    () =>
      series
        .filter((s) => s.id.startsWith('slant.'))
        .map((s) => ({ ...s, unit: 'km', values: s.values.map((v) => v / 1000) })),
    [series],
  )

  const threats = useMemo(() => assessments.filter((a) => a.status !== 'no-path'), [assessments])
  const gateRows = useMemo<ReactNode[][]>(() => {
    if (!spec) return []
    const hM = mountHeightOf(spec)
    return threats.flatMap((a) => {
      const uas = scenario.entities.find((e) => e.id === a.uasId)
      if (!uas) return []
      const uasSpec = modelFor(scenario, uas)?.uas
      const pos = entityPosAt(scenario, uas, t)
      const groundM = Math.hypot(pos.x - entity.pos.x, pos.y - entity.pos.y)
      const altM = threatAltitudeFt(scenario, uas) * FT_TO_M
      const geometry = sensorGeometryGate(spec, hM, altM, groundM)
      const el = elevationDeg(groundM, altM - hM).toFixed(1)
      const pdNow = radarPdAt(spec, scenario.environment, uasSpec, slantRangeM(groundM, altM - hM))
      return [
        [
          uas.name,
          sensorHoldGate(spec, uasSpec),
          `${geometry} · ${el}°`,
          pdNow == null ? DASH : pdNow.toFixed(2),
        ],
      ]
    })
  }, [scenario, spec, threats, t, entity.pos])

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
        <p className="muted small">Planning envelope · deterministic readouts and charts.</p>
        <DetailHeader
          entity={entity}
          color={color}
          pill={pill}
          modelLine={modelLine}
          tags={modelsForEntity(scenario, entity.id)}
        />
        <p className="muted small">No model linked.</p>
      </div>
    )
  }

  const cal = radarCalibration(spec)
  const scanRate = scanPeriodS(spec, false)
  // No stated period: a target with an RCS still makes the radar Pd-modeled, so
  // it scans on the role period. The panel names no threat, so it says so.
  const rolePeriod = scanRate == null ? scanPeriodS(spec, targetScaled(spec)) : null
  const scan = scanRate != null || rolePeriod != null
  const initM = trackInitMFor(spec)
  const initN = trackInitNFor(spec)
  // Legend words are lower case; the builder's labels are title case.
  const legend: LegendEntry[] = LADDER_KINDS.map((kind) => {
    const word = TRACK_LADDER_STYLE[kind].label.toLowerCase()
    return {
      label: kind === 'init' && scan ? `${word} ${initM} of ${initN}` : word,
      color: TRACK_LADDER_STYLE[kind].color,
    }
  })
  const ladderMeta = scan
    ? `M ${initM} · N ${initN} · drop ${trackDropMissesFor(spec)}`
    : `hold ${trackInitSFor(spec, doctrine)} s`

  const loadNow = load.values[Math.min(load.values.length - 1, Math.round(t / DT))] ?? 0
  const el = spec.elevationDeg
  const instrumented = spec.instrumentedRangeM
  const loadRows: DetailRow[] = [
    { label: 'Tracks per scan', value: `${loadNow}` },
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
    { label: 'Hold clock (union)', value: component ? formatTime(component.holdSeconds) : DASH },
    {
      label: 'Track seconds (sum)',
      value: component ? `${Math.round(component.trackSeconds)}` : DASH,
      unit: component ? ' s' : undefined,
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

  return (
    <div className="detail" data-detail="sensor">
      <p className="muted small">Planning envelope · deterministic readouts and charts.</p>
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
        meta={pd.length > 0 ? `Swerling ${cal.swerling0} · Pfa ${pfaText(cal.pfa)}` : null}
      >
        {pd.length > 0 ? (
          <TimeSeries series={pd} tS={t} onScrub={setSimTime} yDomain={[0, 1]} yLabel="Pd" />
        ) : (
          <p className="muted small">No Pd model for this sensor.</p>
        )}
      </DetailSection>
      <DetailSection
        id="slant"
        title="Slant range per track"
        meta={`mount ${mountHeightOf(spec)} m`}
      >
        {slant.length > 0 ? (
          <TimeSeries series={slant} tS={t} onScrub={setSimTime} yLabel="km" />
        ) : (
          <p className="muted small">No track observed.</p>
        )}
      </DetailSection>
      <DetailSection id="ladder" title="Track ladder" meta={ladderMeta}>
        {ladderRows.length > 0 ? (
          <>
            <Ladder rows={bareLadderRows} durationS={durationS} tS={t} onScrub={setSimTime} />
            <Legend entries={legend} />
          </>
        ) : (
          <p className="muted small">No track observed.</p>
        )}
      </DetailSection>
      <DetailSection id="load" title="Load and hold">
        <Rows rows={loadRows} />
      </DetailSection>
      <DetailSection id="gates" title="Gates by threat" meta="slant · elevation · horizon">
        {gateRows.length > 0 ? (
          <DetailTable head={['Threat', 'Hold', 'Geometry', 'Pd now']} rows={gateRows} />
        ) : (
          <p className="muted small">No threats with flight paths.</p>
        )}
      </DetailSection>
    </div>
  )
}
