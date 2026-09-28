import { FULL_RUN, reached, type ExecutionHorizon } from '../../analysis/horizon'
import { trackQualityAt, expectedDeadTimes } from '../../analysis/threatAggregation'
import type { DisplayUnits } from '../../geometry/geo'
import { formatAxis, formatDistance, formatSpeed, formatTime } from '../../geometry/geo'
import { modelFor, pathSpeed } from '../../model/scenario'
import type { Entity, Scenario } from '../../model/types'
import type { ThreatAssessment } from '../../playback/sim'
import type { Sweep } from '../../playback/sweepAt'
import { threatAltitudeFt } from '../../playback/tracks'
import { PHASE_STYLE } from '../../playback/trackState'
import type { TrackPhase, TrackTimeline } from '../../playback/trackState'
import type { TrialResultView } from '../../analysis/trialResult'
import { trialMemberStatesAt } from '../../playback/trialTrackState'
import type { TrialMemberState } from '../../playback/trialTrackState'
import { trialSweepAt } from '../../playback/trialSweepAt'
import type { TrialSweep, TrialSensorState } from '../../playback/trialSweepAt'
import { engagementReleaseS } from '../../playback/engagementTiming'

const DASH = '—'
const NA = 'not available'
const NO_ASSET = 'no defended asset placed'

export type TrialOutcomeWord =
  'defeated (hard)' | 'defeated (mission)' | 'leaked' | 'active' | 'no path'

export interface TrialOutcomeRow {
  id: string
  track: string
  detect: number | null
  identify: number | null
  engage: number | null
  effect: number | null
  salvos: number
  result: string
  states: TrialOutcomeWord[]
}

/** Track-file milestones from the retained trial, with no forecast substitutions. */
export function trialOutcomeRows(view: TrialResultView): TrialOutcomeRow[] {
  const t = Math.min(view.durationS, view.observedThroughS)
  const first = (values: Array<number | null | undefined>) => {
    const reached = values.filter((value): value is number => value != null && value <= t)
    return reached.length ? Math.min(...reached) : null
  }
  return view.assessments.flatMap((assessment) => {
    const entity = view.scenario.entities.find((candidate) => candidate.id === assessment.uasId)
    if (!entity || !view.scenario.paths.some((path) => path.entityId === entity.id)) return []
    const events = view.attrition.events.filter(
      (event) => event.uasId === entity.id && event.tS <= t,
    )
    const members = trialMemberStatesAt(view, entity.id, t)
    // A formation leaks if any member leaks; partial defeat never labels it defeated.
    const states: TrialOutcomeWord[] =
      assessment.status === 'no-path'
        ? ['no path']
        : members.some((member) => member.leakageCredit)
          ? ['leaked']
          : members.some((member) => member.outcome === 'active') || members.length === 0
            ? ['active']
            : [
                ...(members.some((member) => member.outcome === 'hard-kill')
                  ? ['defeated (hard)' as const]
                  : []),
                ...(members.some((member) => member.outcome === 'mission-kill')
                  ? ['defeated (mission)' as const]
                  : []),
              ]
    return [
      {
        id: entity.id,
        track: entity.name,
        detect: first([assessment.firstDetectS]),
        identify: first([assessment.classificationAtS.hostileAtS]),
        engage: first(events.map((event) => event.tS)),
        effect: first(
          events.filter((event) => event.killDelta === 1).map((event) => event.tEffectS),
        ),
        salvos: events.length,
        result: states.join(' · '),
        states,
      },
    ]
  })
}

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
  state: TrialTelemetryState | undefined
  phase: TrackPhase
  pillLabel: string
  ghostLine: string | null
  position: { x: number; y: number }
  anchorPosition: { x: number; y: number }
  altitudeText: string
  cursorText: string
  sourceHorizon: string
}

export interface TrialTelemetryState {
  phase: TrackPhase
  holdingSensorIds: string[]
  coasting: boolean
  sensors: TrialSensorState[]
  classification: 'unknown' | 'suspected' | 'hostile'
  targetedNow: boolean
  firstSalvoAtS: number | null
  kineticSalvos: number
  deSalvos: number
  jamSalvos: number
  incomingSalvos: number
  effectsLanded: number
  activeCount: number
  hardKillCount: number
  missionKillCount: number
  shipCount: number
  jammedNow: boolean
  members: TrialMemberState[]
}

const telemetryCache = new WeakMap<TrialSweep, Map<string, TrialTelemetryState>>()
const eligibilityCache = new WeakMap<TrialResultView, Map<string, number>>()

/** Expected-dead times of a retained trial, cached per view. */
function deadTimesOf(view: TrialResultView): Map<string, number> {
  let cutoffs = eligibilityCache.get(view)
  if (!cutoffs) {
    cutoffs = expectedDeadTimes(view.attrition)
    eligibilityCache.set(view, cutoffs)
  }
  return cutoffs
}

/** Only retained facts reached at this horizon; never runs a forecast sweep. */
export function trialTelemetryAt(
  view: TrialResultView,
  uasId: string,
  horizonS: number,
  supplied?: TrialSweep,
): TrialTelemetryState {
  const t = Math.min(Math.max(0, horizonS), view.observedThroughS)
  const sweep = supplied?.timeS === t ? supplied : trialSweepAt(view, t)
  const cached = telemetryCache.get(sweep)?.get(uasId)
  if (cached) return cached
  const cutoffs = deadTimesOf(view)
  const members = trialMemberStatesAt(view, uasId, t)
  const assessment = view.assessments.find((a) => a.uasId === uasId)
  const sensors = sweep.sensors.filter((s) => s.threatId === uasId && s.stateAtTime !== 'not-held')
  const holdingSensorIds = sensors.map((s) => s.sensorId)
  const coasting = sensors.length > 0 && sensors.every((s) => s.stateAtTime === 'coasting')
  const cls = assessment?.classificationAtS
  const hasReached = (time: number | null | undefined) => time != null && time <= t
  // A dead threat's classification rung reads no later than the kill.
  const tLive = Math.min(t, cutoffs.get(uasId) ?? t)
  const classifiedBy = (time: number | null | undefined) => time != null && time <= tLive
  const classification = classifiedBy(cls?.hostileAtS)
    ? 'hostile'
    : classifiedBy(cls?.suspectedAtS)
      ? 'suspected'
      : 'unknown'
  const events = view.attrition.events.filter((e) => e.uasId === uasId && e.tS <= t)
  const activeCount = members.filter((m) => m.outcome === 'active').length
  const hardKillCount = members.filter((m) => m.outcome === 'hard-kill').length
  const missionKillCount = members.filter((m) => m.outcome === 'mission-kill').length
  const targetedNow =
    t < (cutoffs.get(uasId) ?? Infinity) &&
    activeCount > 0 &&
    assessment?.windowS != null &&
    t >= assessment.windowS[0] &&
    t <= assessment.windowS[1]
  const phase: TrackPhase =
    members.length > 0 && hardKillCount === members.length
      ? 'ghost'
      : events.length > 0
        ? 'engaged'
        : targetedNow
          ? 'targeted'
          : sensors.length > 0
            ? classification === 'hostile'
              ? 'identified'
              : 'tracked'
            : hasReached(assessment?.firstDetectS)
              ? 'searching'
              : 'undetected'
  const state: TrialTelemetryState = {
    phase,
    holdingSensorIds,
    coasting,
    sensors,
    classification,
    targetedNow,
    firstSalvoAtS: events.length ? Math.min(...events.map((e) => e.tS)) : null,
    kineticSalvos: events.filter((e) => e.channelClass === 'kinetic').length,
    deSalvos: events.filter((e) => e.channelClass === 'directed-energy').length,
    jamSalvos: events.filter((e) => e.channelClass === 'ew').length,
    incomingSalvos: events.filter((e) => {
      const release = engagementReleaseS(e, view.scenario)
      return e.channelClass === 'kinetic' && release != null && release <= t && t < e.tEffectS
    }).length,
    effectsLanded: events.filter((e) => e.tEffectS <= t).length,
    activeCount,
    hardKillCount,
    missionKillCount,
    shipCount: members.length,
    jammedNow: members.some((m) => m.jamState?.jammed),
    members,
  }
  const byId = telemetryCache.get(sweep) ?? new Map<string, TrialTelemetryState>()
  byId.set(uasId, state)
  telemetryCache.set(sweep, byId)
  return state
}

interface ThreatReadoutInput {
  scenario: Scenario
  entity: Entity
  trial?: TrialResultView | null
  /** Null means no reached outcome, including a prepared trial before Play. */
  horizonS?: number | null
  anchor?: { position: { x: number; y: number } }
  tS: number
  units: DisplayUnits
  horizon?: ExecutionHorizon
  trialSweep?: TrialSweep
  /** Transitional caller inputs; deliberately unused until those callers migrate. */
  timeline?: TrackTimeline
  assessments?: ThreatAssessment[]
  sweep?: Pick<Sweep, 'hits' | 'states'>
}

/** One source for the compact overlay and the full threat telemetry rows. */
export function threatReadoutAt({
  scenario,
  entity,
  trial,
  horizonS,
  anchor,
  tS,
  units,
  trialSweep,
  horizon = FULL_RUN,
}: ThreatReadoutInput): ThreatReadoutView {
  const cap = horizon.scoped ? Math.min(tS, horizon.horizonS) : tS
  const tObs =
    trial && horizonS !== null ? Math.min(cap, horizonS ?? cap, trial.observedThroughS) : -Infinity
  const untouched = tObs === -Infinity
  const observationHorizon = { scoped: true, horizonS: tObs }
  const assessment = trial?.assessments.find((candidate) => candidate.uasId === entity.id)
  const state =
    trial && assessment && !untouched
      ? trialTelemetryAt(trial, entity.id, tObs, trialSweep)
      : undefined
  const model = modelFor(scenario, entity)
  const uas = model?.uas
  const member = state?.members.find((m) => m.memberIdx === 0)
  const position = member?.position ?? entity.pos
  const anchorPosition = anchor?.position ?? position
  const headingDeg = Math.round(member?.heading ?? entity.headingDeg)
  const phase: TrackPhase = state?.phase ?? 'undetected'
  const pillLabel =
    state?.coasting && (phase === 'tracked' || phase === 'identified')
      ? 'COAST'
      : phase === 'ghost'
        ? 'HARD KILL'
        : state && state.shipCount > 0 && state.missionKillCount === state.shipCount
          ? 'MISSION KILL'
          : PHASE_STYLE[phase].label

  const path = scenario.paths.find((candidate) => candidate.entityId === entity.id)
  const speedMps =
    member?.outcome === 'hard-kill'
      ? 0
      : path
        ? pathSpeed(scenario, path)
        : (uas?.cruiseSpeedMps ?? null)
  const holdIds = state?.holdingSensorIds ?? []
  const holdNames = holdIds.map((id) => {
    const name = scenario.entities.find((candidate) => candidate.id === id)?.name ?? id
    const sensor = state?.sensors.find((sensor) => sensor.sensorId === id)
    const mode =
      sensor?.stateAtTime === 'coasting'
        ? 'coast'
        : sensor?.stateAtTime === 'measured'
          ? 'measured'
          : 'held'
    return `${name} (${mode}${sensor?.lastMeasurementTimeS != null ? ` · last T+${formatTime(sensor.lastMeasurementTimeS)}` : ''})`
  })
  const continuity =
    assessment && trial && !untouched
      ? // A dead threat holds no track: quality reads no later than the kill.
        trackQualityAt(assessment, Math.min(tObs, deadTimesOf(trial).get(entity.id) ?? tObs))
          ?.continuity
      : undefined
  const altitudeText = `${threatAltitudeFt(scenario, entity).toLocaleString()} ft AGL`

  const hasAsset =
    trial?.hasActiveAsset ??
    scenario.entities.some((candidate) => candidate.kind === 'asset' && candidate.enabled !== false)
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
  const arrival = assessment
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
      value: state ? (state.jammedNow ? 'JAMMED' : 'no sampled jam effect') : NA,
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
      value: state
        ? `${state.effectsLanded} landed · ${state.hardKillCount} hard kill · ${state.missionKillCount} mission kill`
        : NA,
      horizon: 'cursor',
    },
    {
      id: 'residual',
      label: 'Residual',
      value: state
        ? `${state.activeCount} active · ${state.hardKillCount} hard kill · ${state.missionKillCount} mission kill · ${state.shipCount} members`
        : NA,
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
    state && state.hardKillCount + state.missionKillCount > 0
      ? `${state.hardKillCount} hard-killed members frozen at effect positions · ${state.missionKillCount} mission-killed members follow the planned path.`
      : null

  const planningRows = rows
    .filter((row) => row.horizon === 'full-path')
    .map((row) => ({
      ...row,
      label: row.id === 'arrival' ? 'Planned arrival' : 'Planned CPA',
    }))
  const telemetryRows = rows.filter((row) => row.horizon !== 'full-path')
  telemetryRows.push({
    id: 'arrival',
    label: 'Reached arrival',
    horizon: 'cursor',
    value:
      state && assessment?.arrivalS != null && reached(assessment.arrivalS, observationHorizon)
        ? `T+${formatTime(assessment.arrivalS)} · ${state.members.filter((m) => m.leakageCredit).length} undefeated members`
        : DASH,
  })
  if (untouched) {
    for (const row of telemetryRows) {
      if (row.horizon !== 'cursor') continue
      row.value =
        row.id === 'hold'
          ? '0 sensors'
          : row.id === 'salvos'
            ? '0 kinetic · 0 DE · 0 EW · 0 inbound'
            : row.id === 'effects'
              ? '0 landed · 0 hard kill · 0 mission kill'
              : DASH
    }
  }
  const firstSensor = scenario.entities.find(
    (candidate) => candidate.id === assessment?.firstDetectSensorId,
  )
  const firstDetectText =
    assessment?.firstDetectS != null && reached(assessment.firstDetectS, observationHorizon)
      ? `${firstSensor?.name ?? DASH} · T+${formatTime(assessment.firstDetectS)}`
      : DASH
  const warningText =
    hasAsset &&
    assessment?.warningS != null &&
    reached(assessment.firstDetectS, observationHorizon) &&
    reached(assessment.arrivalS, observationHorizon)
      ? formatTime(assessment.warningS)
      : DASH
  const engageText = untouched
    ? DASH
    : state?.firstSalvoAtS != null
      ? 'engaged'
      : state?.targetedNow
        ? 'targeted'
        : DASH

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
    anchorPosition,
    altitudeText,
    cursorText: untouched ? DASH : `T+${formatTime(tObs)}`,
    sourceHorizon: untouched
      ? 'CONFIGURATION · TRIAL NOT OBSERVED'
      : `SIMULATED TRIAL · THROUGH T+${formatTime(tObs)} · ALT CONSTANT`,
  }
}
