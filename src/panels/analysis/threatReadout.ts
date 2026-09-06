import { trackQualityAt } from '../../analysis/threatAggregation'
import type { DisplayUnits } from '../../geometry/geo'
import { formatAxis, formatDistance, formatSpeed, formatTime } from '../../geometry/geo'
import { modelFor, pathSpeed } from '../../model/scenario'
import type { Entity, Scenario } from '../../model/types'
import { detectionsAt } from '../../playback/detection'
import type { ThreatAssessment } from '../../playback/sim'
import { liveTracks, threatAltitudeFt } from '../../playback/tracks'
import { PHASE_STYLE, trackStatesAt } from '../../playback/trackState'
import type { TrackFileState, TrackPhase, TrackTimeline } from '../../playback/trackState'

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
}

/** One source for the compact overlay and the full threat telemetry rows. */
export function threatReadoutAt({
  scenario,
  entity,
  timeline,
  assessments,
  tS,
  units,
}: ThreatReadoutInput): ThreatReadoutView {
  const state = trackStatesAt(timeline, tS).get(entity.id)
  const assessment = assessments.find((candidate) => candidate.uasId === entity.id)
  const model = modelFor(scenario, entity)
  const uas = model?.uas
  const track = liveTracks(scenario, tS).get(entity.id)
  const position = track?.pos ?? entity.pos
  const headingDeg = Math.round(track?.headingDeg ?? entity.headingDeg)
  const hits = detectionsAt(scenario, tS).get(entity.id) ?? []

  // A threat without a path has no timeline row. Match the canvas glyph's
  // render-time detection fallback so its status does not disagree with it.
  const phase: TrackPhase =
    state?.phase ??
    (hits.some((hit) => hit.classified) ? 'identified' : hits.length > 0 ? 'tracked' : 'undetected')
  const pillLabel =
    state?.coasting && (phase === 'tracked' || phase === 'identified')
      ? 'COAST'
      : PHASE_STYLE[phase].label

  const path = scenario.paths.find((candidate) => candidate.entityId === entity.id)
  const speedMps = path ? pathSpeed(scenario, path) : (uas?.cruiseSpeedMps ?? null)
  const holdIds = state?.holdingSensorIds ?? hits.map((hit) => hit.sensorId)
  const holdNames = holdIds
    .map((id) => scenario.entities.find((candidate) => candidate.id === id)?.name)
    .filter((name): name is string => name != null)
  const continuity = assessment ? trackQualityAt(assessment, tS)?.continuity : undefined
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
  const arrivalText = !state
    ? NA
    : state.arrivalS != null
      ? `T+${formatTime(state.arrivalS)}`
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
    state?.eliminated && state.eliminatedAtS != null
      ? `${PHASE_STYLE.ghost.label} track at T+${formatTime(state.eliminatedAtS)} by ${
          state.eliminatedBySoft ? 'mission kill' : 'hard kill'
        }. It keeps flying its last course.`
      : null

  return {
    rows,
    state,
    phase,
    pillLabel,
    ghostLine,
    position,
    altitudeText,
    cursorText: `T+${formatTime(tS)}`,
    sourceHorizon: 'PLANNING MODEL · CURSOR @ 0.5 S · ALT CONSTANT · NOT INSTRUMENTED',
  }
}
