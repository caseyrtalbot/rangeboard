import { FULL_RUN, reached, type ExecutionHorizon } from '../../analysis/horizon'
import { profileFor } from '../../model/integration'
import { trackQualityAt } from '../../analysis/threatAggregation'
import type { DisplayUnits } from '../../geometry/geo'
import { formatAxis, formatDistance, formatSpeed, formatTime } from '../../geometry/geo'
import { modelFor, pathSpeed } from '../../model/scenario'
import type { Entity, Scenario } from '../../model/types'
import { detectionsAt } from '../../playback/detection'
import type { ThreatAssessment } from '../../playback/sim'
import type { Sweep } from '../../playback/sweepAt'
import { liveTracks, threatAltitudeFt } from '../../playback/tracks'
import { PHASE_STYLE, trackStatesAt } from '../../playback/trackState'
import type { TrackFileState, TrackPhase, TrackTimeline } from '../../playback/trackState'

const DASH = '—'
const NA = 'not available'
const NO_ASSET = 'no defended asset placed'

const NAV_LABEL: Record<string, string> = {
  gps: 'GPS',
  inertial: 'inertial',
  'rf-manual': 'RF manual',
  optical: 'optical',
  fiber: 'fiber (wire guided)',
  mixed: 'GPS and RF mixed',
}

export type ThreatReadoutField =
  | 'platform'
  | 'navigation'
  | 'position'
  | 'speedHeading'
  | 'hold'
  | 'classification'
  | 'ew'
  | 'salvos'
  | 'effects'
  | 'residual'
  | 'cpa'
  | 'arrival'
  | 'altitude'

export interface ThreatReadoutRow {
  id: ThreatReadoutField
  label: string
  value: string
  horizon: 'cursor' | 'full-path' | 'constant'
}

export interface ThreatReadoutView {
  rows: ThreatReadoutRow[]
  planningRows: ThreatReadoutRow[]
  engageText: string
  firstDetectText: string
  warningText: string
  state: TrackFileState | undefined
  phase: TrackPhase
  pillLabel: string
  ghostLine: string | null
  position: { x: number; y: number }
  altitudeText: string
  cursorText: string
  sourceHorizon: string
}

interface ThreatReadoutInput {
  scenario: Scenario
  entity: Entity
  timeline: TrackTimeline
  assessments: ThreatAssessment[]
  tS: number
  units: DisplayUnits
  horizon?: ExecutionHorizon
  /**
   * The sweep at tS when the caller already holds it (`sweepAt`), so the
   * 10 Hz readout does not rerun the sensor sweep the canvas just ran. Absent,
   * the readout sweeps for itself.
   */
  sweep?: Pick<Sweep, 'hits' | 'states'>
}

/** One source for the compact overlay and the full threat telemetry rows. */
export function threatReadoutAt({
  scenario,
  entity,
  timeline,
  assessments,
  tS,
  units,
  sweep,
  horizon = FULL_RUN,
}: ThreatReadoutInput): ThreatReadoutView {
  const tObs = horizon.scoped ? Math.min(tS, horizon.horizonS) : tS
  const untouched = tObs === -Infinity
  const observationHorizon = horizon.scoped ? { scoped: true, horizonS: tObs } : horizon
  // A supplied sweep is reusable only at the censored observation time.
  const currentSweep = tObs === tS && !untouched ? sweep : undefined
  const state = untouched ? undefined : (currentSweep?.states ?? trackStatesAt(timeline, tObs)).get(entity.id)
  const assessment = assessments.find((candidate) => candidate.uasId === entity.id)
  const model = modelFor(scenario, entity)
  const uas = model?.uas
  const track = untouched ? undefined : liveTracks(scenario, tObs).get(entity.id)
  const position = track?.pos ?? entity.pos
  const headingDeg = Math.round(track?.headingDeg ?? entity.headingDeg)
  const hits = untouched ? [] : (currentSweep?.hits ?? detectionsAt(scenario, tObs)).get(entity.id) ?? []

  // A threat without a path has no timeline row. Match the canvas glyph's
  // render-time detection fallback so its status does not disagree with it.
  const phase: TrackPhase =
    state?.phase ??
    (hits.some((hit) => hit.classified) ? 'identified' : hits.length > 0 ? 'tracked' : 'undetected')
  const pillLabel =
    state?.coasting && (phase === 'tracked' || phase === 'identified')
      ? 'COAST'
      : phase === 'ghost'
        ? 'EXPECTED DEFEAT'
        : PHASE_STYLE[phase].label

  const path = scenario.paths.find((candidate) => candidate.entityId === entity.id)
  const speedMps = path ? pathSpeed(scenario, path) : (uas?.cruiseSpeedMps ?? null)
  const holdIds = state?.holdingSensorIds ?? hits.map((hit) => hit.sensorId)
  const holdNames = holdIds
    .map((id) => scenario.entities.find((candidate) => candidate.id === id)?.name)
    .filter((name): name is string => name != null)
  const continuity = assessment && !untouched ? trackQualityAt(assessment, tObs)?.continuity : undefined
  const jam = state?.jammedFraction ?? 0
  const altitudeText = `${threatAltitudeFt(scenario, entity).toLocaleString()} ft AGL`

  const hasAsset = scenario.entities.some((candidate) => candidate.kind === 'asset')
  const cpaAsset = assessment?.cpaAssetId
    ? scenario.entities.find((candidate) => candidate.id === assessment.cpaAssetId)
    : undefined
  const cpaText =
    assessment?.cpaS != null && assessment.cpaDistanceM != null
      ? `T+${formatTime(assessment.cpaS)} · ${formatDistance(assessment.cpaDistanceM, units)}${
          cpaAsset ? ` from ${cpaAsset.name}` : ''
        }`
      : hasAsset
        ? NA
        : NO_ASSET
  const arrival = horizon.scoped ? assessment : state
  const arrivalText = !arrival
    ? NA
    : arrival.arrivalS != null
      ? `T+${formatTime(arrival.arrivalS)}`
      : hasAsset
        ? 'never crossed the defended boundary'
        : NO_ASSET

  const rows: ThreatReadoutRow[] = [
    {
      id: 'platform',
      label: 'Platform',
      value: uas ? `${model!.name} · Group ${uas.group} · ${uas.airframe}` : 'no model linked',
      horizon: 'constant',
    },
    {
      id: 'navigation',
      label: 'Navigation',
      value: uas ? (NAV_LABEL[uas.navMode] ?? uas.navMode) : 'unknown',
      horizon: 'constant',
    },
    {
      id: 'position',
      label: 'Position',
      value: `${formatAxis(position.x, units, 'E', 'W')}, ${formatAxis(-position.y, units, 'N', 'S')}`,
      horizon: 'cursor',
    },
    {
      id: 'speedHeading',
      label: 'Speed / heading',
      value: `${speedMps != null ? formatSpeed(speedMps, units) : 'unknown'} · ${String(headingDeg).padStart(3, '0')} deg`,
      horizon: 'cursor',
    },
    {
      id: 'hold',
      label: 'Held by',
      value:
        holdNames.length > 0
          ? `${holdIds.length} sensors · ${holdNames.join(' · ')}`
          : `${holdIds.length} sensors`,
      horizon: 'cursor',
    },
    {
      id: 'classification',
      label: 'Classification',
      value: state
        ? `${state.classification.toUpperCase()}${
            continuity != null ? ` · continuity ${Math.round(continuity * 100)}%` : ''
          }`
        : NA,
      horizon: 'cursor',
    },
    {
      id: 'ew',
      label: 'EW',
      value: state
        ? state.jammedNow
          ? `JAMMED${jam >= 0.005 ? ` · degrade ${jam.toFixed(2)}` : ''}`
          : jam >= 0.005
            ? `jam degrade ${jam.toFixed(2)}`
            : 'no jam effect'
        : NA,
      horizon: 'cursor',
    },
    {
      id: 'salvos',
      label: 'Salvos',
      value: state
        ? `${state.kineticSalvos} kinetic · ${state.deSalvos} DE · ${state.jamSalvos} EW · ${state.incomingSalvos} inbound`
        : NA,
      horizon: 'cursor',
    },
    {
      id: 'effects',
      label: 'Effects',
      value: state ? `${state.effectsLanded} landed · E[k] ${state.expectedKills.toFixed(2)}` : NA,
      horizon: 'cursor',
    },
    {
      id: 'residual',
      label: 'Residual',
      value: state ? `${state.residual.toFixed(2)} of ${state.shipCount} ships` : NA,
      horizon: 'cursor',
    },
    { id: 'cpa', label: 'CPA (full path)', value: cpaText, horizon: 'full-path' },
    { id: 'arrival', label: 'Arrival (full path)', value: arrivalText, horizon: 'full-path' },
    {
      id: 'altitude',
      label: 'Altitude (constant)',
      value: `${altitudeText}${
        uas
          ? ` · band ${uas.altBandFt[0].toLocaleString()} - ${uas.altBandFt[1].toLocaleString()} ft`
          : ''
      }`,
      horizon: 'constant',
    },
  ]

  const ghostLine =
    state?.eliminated && state.eliminatedAtS != null && (!horizon.scoped || reached(state.eliminatedAtS, observationHorizon))
      ? `Expected residual below cutoff at T+${formatTime(state.eliminatedAtS)} (${
          state.eliminatedBySoft ? 'mission-kill effects' : 'hard-kill effects'
        }). Motion continues along the planned path.`
      : null

  const planningRows = horizon.scoped
    ? rows.filter((row) => row.horizon === 'full-path').map((row) => ({
        ...row, label: row.id === 'arrival' ? 'Planned arrival' : 'Planned CPA',
      }))
    : []
  const telemetryRows = horizon.scoped ? rows.filter((row) => row.horizon !== 'full-path') : rows
  if (untouched) {
    for (const row of telemetryRows) {
      if (row.horizon !== 'cursor') continue
      row.value = row.id === 'hold' ? '0 sensors'
        : row.id === 'salvos' ? '0 kinetic · 0 DE · 0 EW · 0 inbound'
          : row.id === 'effects' ? '0 landed · E[k] 0.00' : DASH
    }
  }
  const firstSensor = scenario.entities.find((candidate) => candidate.id === assessment?.firstDetectSensorId)
  const firstDetectText = assessment?.firstDetectS != null && (!horizon.scoped || reached(assessment.firstDetectS, observationHorizon))
    ? `${firstSensor?.name ?? DASH} · T+${formatTime(assessment.firstDetectS)}` : DASH
  const warningText = assessment?.warningS != null && (!horizon.scoped || (
    reached(assessment.firstDetectS, observationHorizon) && reached(assessment.arrivalS, observationHorizon)
  )) ? formatTime(assessment.warningS) : DASH
  // Full-run failure reasons depend on future windows; Execute names only current state.
  const engageText = horizon.scoped
    ? untouched ? DASH : state?.firstSalvoAtS != null ? 'engaged' : state?.targetedNow ? 'targeted' : DASH
    : !assessment ? DASH : assessment.status === 'no-fc-uplink'
      ? `no fire-control source on the route · ${scenario.entities
          .filter((candidate) => candidate.kind === 'effector')
          .flatMap((candidate) => {
            const profile = profileFor(candidate.specId)
            if (profile?.guidance !== 'fc-uplink' || !profile.fcSources?.length) return []
            const names = profile.fcSources
              .map((id) => scenario.library.find((model) => model.id === id)?.name ?? id).join(' or ')
            return [`${candidate.name} needs a fire-control track from ${names}`]
          }).join(' · ')}`
      : assessment.status.replaceAll('-', ' ')

  return {
    rows: telemetryRows,
    planningRows,
    engageText,
    firstDetectText,
    warningText,
    state,
    phase,
    pillLabel,
    ghostLine,
    position,
    altitudeText,
    cursorText: untouched ? DASH : `T+${formatTime(tObs)}`,
    sourceHorizon: 'PLANNING MODEL · CURSOR @ 0.5 S · ALT CONSTANT · NOT INSTRUMENTED',
  }
}
