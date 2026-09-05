import { Fragment, useMemo } from 'react'
import type { DisplayUnits } from '../geometry/geo'
import { formatDistance, formatSpeed, formatTime, NM_M } from '../geometry/geo'
import { modelFor, pathSpeed, useStore } from '../state/store'
import { selectSimTimeS } from '../state/selectors'
import { trackQualityAt } from '../analysis/threatAggregation'
import type { Entity, Scenario } from '../model/types'
import { detectionsAt, liveTracks, threatAltitudeFt } from '../playback/sim'
import type { ThreatAssessment } from '../playback/sim'
import { PHASE_STYLE, trackStatesAt } from '../playback/trackState'
import type { TrackPhase, TrackTimeline } from '../playback/trackState'

interface Props {
  /** Prefix-aggregated timeline, built once in CanvasStage. */
  timeline: TrackTimeline
  /** Whole-run threat sweep, shared with the analysis panel. */
  assessments: ThreatAssessment[]
  /** Canvas host size, screen px. The leader line draws in that frame. */
  size: { w: number; h: number }
}

/** Card width and dock inset, screen px. Both are mirrored in index.css. */
const CARD_W = 292
const DOCK = 14
/** The leader line meets the card just under its header. */
const CARD_ANCHOR_Y = DOCK + 22

/** No timeline covers this threat, so the figure has no value to state. */
const NA = 'not available'

const NAV_LABEL: Record<string, string> = {
  gps: 'GPS',
  inertial: 'inertial',
  'rf-manual': 'RF manual',
  optical: 'optical',
  fiber: 'fiber (wire guided)',
  mixed: 'GPS and RF mixed',
}

/**
 * One position axis as a hemisphere letter and a magnitude. A negative easting
 * is a westing, so the letter carries the sign and the number never does. The
 * caller passes the letters for that axis. Aviation keeps two decimals of a
 * nautical mile.
 */
function axisText(m: number, units: DisplayUnits, plus: string, minus: string): string {
  const mag = Math.abs(m)
  const value = units === 'aviation' ? `${(mag / NM_M).toFixed(2)} nm` : formatDistance(mag, units)
  return `${m < 0 ? minus : plus} ${value}`
}

/**
 * Telemetry for one selected trackfile. It docks at a fixed board corner with
 * a leader line to the track, so it never covers the inbound axis. Every
 * figure is derived from the planning sweep: nothing here is measured.
 *
 * A DOM overlay and a snapped consumer: it reads the published sim time, not
 * the canvas frame clock, so it repaints at the publication cadence and not
 * once per animation frame.
 *
 * Every row is a value at sim time t, with one exception: ALT is constant
 * along the path. The engine reads it (threatAltitudeFt) for the slant range
 * and the geometry gates, so the row states the altitude in use and keeps the
 * model band behind it as the envelope it sits in.
 */
function ReadoutCard({
  entity,
  scenario,
  timeline,
  assessments,
  size,
}: { entity: Entity; scenario: Scenario } & Props) {
  const camera = useStore((s) => s.camera)
  const units = useStore((s) => s.ui.units)
  const simTimeS = useStore(selectSimTimeS)
  const select = useStore((s) => s.select)
  const setRightTab = useStore((s) => s.setRightTab)

  // Snapped at the published time. The hidden card mounts none of this, so a
  // board with the layer off holds no time subscription at all.
  const trackStates = useMemo(() => trackStatesAt(timeline, simTimeS), [timeline, simTimeS])
  const detections = useMemo(() => detectionsAt(scenario, simTimeS), [scenario, simTimeS])
  const tracks = useMemo(() => liveTracks(scenario, simTimeS), [scenario, simTimeS])

  const state = trackStates.get(entity.id)
  const assessment = assessments.find((a) => a.uasId === entity.id)
  const model = modelFor(scenario, entity)
  const uas = model?.uas
  const track = tracks.get(entity.id)
  const pos = track?.pos ?? entity.pos
  const headingDeg = Math.round(track?.headingDeg ?? entity.headingDeg)
  const hits = detections.get(entity.id) ?? []
  // A UAS with no flight path never enters the timeline. Fall back to the
  // render-time sweep, exactly as EntityLayer does, so the card and the glyph
  // never state different things about the same track.
  const phase: TrackPhase =
    state?.phase ??
    (hits.some((h) => h.classified) ? 'identified' : hits.length > 0 ? 'tracked' : 'undetected')
  const pill = PHASE_STYLE[phase]
  // Coast is a hold with no measurement, not a phase: the word replaces the
  // TRACKED or IDENTIFIED label, the phase colour stays. An engagement or a
  // defeat outranks it, so those words keep the pill.
  const pillLabel =
    state?.coasting && (phase === 'tracked' || phase === 'identified') ? 'COAST' : pill.label
  // Undetected shows the entity color, resolved the way PathLayer and
  // RangeLayer resolve it, so the pill matches the glyph the canvas draws.
  const color = entity.color ?? model?.color ?? '#c46a5a'

  const path = scenario.paths.find((p) => p.entityId === entity.id)
  const speedMps = path ? pathSpeed(scenario, path) : (uas?.cruiseSpeedMps ?? null)
  const holdIds = state?.holdingSensorIds ?? hits.map((h) => h.sensorId)
  const holdNames = holdIds
    .map((id) => scenario.entities.find((e) => e.id === id)?.name)
    .filter((n): n is string => n != null)
  // Continuity at t, not the whole-run figure: every other row here is at t.
  const continuity = assessment ? trackQualityAt(assessment, simTimeS)?.continuity : undefined
  const jam = state?.jammedFraction ?? 0

  // Closest approach and arrival answer two different questions. CPA is pure
  // geometry and exists whenever an asset is placed, so a fly-by that turns
  // away still has one. Arrival is the crossing of that asset's defended
  // radius, so a fly-by has no arrival at all. Showing only arrival made the
  // two look alike.
  const hasAsset = scenario.entities.some((e) => e.kind === 'asset')
  const cpaAsset = assessment?.cpaAssetId
    ? scenario.entities.find((e) => e.id === assessment.cpaAssetId)
    : undefined
  const noAssetText = 'no defended asset placed'
  const cpaText =
    assessment?.cpaS != null && assessment.cpaDistanceM != null
      ? `T+${formatTime(assessment.cpaS)} · ${formatDistance(assessment.cpaDistanceM, units)}${
          cpaAsset ? ` from ${cpaAsset.name}` : ''
        }`
      : hasAsset
        ? NA
        : noAssetText
  const arrivalText = !state
    ? NA
    : state.arrivalS != null
      ? `T+${formatTime(state.arrivalS)}`
      : hasAsset
        ? 'never crossed the defended boundary'
        : noAssetText

  const rows: Array<[string, string]> = [
    [
      'PLATFORM',
      uas ? `${model!.name} · Group ${uas.group} · ${uas.airframe}` : 'no model linked',
    ],
    ['NAV', uas ? (NAV_LABEL[uas.navMode] ?? uas.navMode) : 'unknown'],
    [
      'POSITION',
      `${axisText(pos.x, units, 'E', 'W')}, ${axisText(-pos.y, units, 'N', 'S')}`,
    ],
    [
      'SPEED / HDG',
      `${speedMps != null ? formatSpeed(speedMps, units) : 'unknown'} · ${String(headingDeg).padStart(3, '0')} deg`,
    ],
    [
      'HOLD',
      holdNames.length > 0
        ? `${holdIds.length} sensors · ${holdNames.join(' · ')}`
        : `${holdIds.length} sensors`,
    ],
    [
      'CLASS',
      state
        ? `${state.classification.toUpperCase()}${
            continuity != null ? ` · continuity ${Math.round(continuity * 100)}%` : ''
          }`
        : NA,
    ],
    [
      'EW',
      state
        ? state.jammedNow
          ? `JAMMED${jam >= 0.005 ? ` · degrade ${jam.toFixed(2)}` : ''}`
          : jam >= 0.005
            ? `jam degrade ${jam.toFixed(2)}`
            : 'no jam effect'
        : NA,
    ],
    [
      'SALVOS',
      state
        ? `${state.kineticSalvos} kinetic · ${state.deSalvos} DE · ${state.jamSalvos} EW · ${state.incomingSalvos} inbound`
        : NA,
    ],
    [
      'EFFECTS',
      state ? `${state.effectsLanded} landed · E[k] ${state.expectedKills.toFixed(2)}` : NA,
    ],
    ['RESIDUAL', state ? `${state.residual.toFixed(2)} of ${state.shipCount} ships` : NA],
    ['CLOSEST', cpaText],
    ['ARRIVAL', arrivalText],
    // Constant along the path, not a value at t. The engine reads it, so the
    // altitude in use leads and the model band follows as the envelope.
    [
      'ALT',
      `${threatAltitudeFt(scenario, entity).toLocaleString()} ft AGL${
        uas
          ? ` · band ${uas.altBandFt[0].toLocaleString()} - ${uas.altBandFt[1].toLocaleString()} ft`
          : ''
      }`,
    ],
  ]

  // One vocabulary for a defeated track: the pill, the board tag and this line
  // all take the word from PHASE_STYLE.
  const ghostLine =
    state?.eliminated && state.eliminatedAtS != null
      ? `${PHASE_STYLE.ghost.label} track at T+${formatTime(state.eliminatedAtS)} by ${
          state.eliminatedBySoft ? 'mission kill' : 'hard kill'
        }. It keeps flying its last course.`
      : null

  const sx = pos.x * camera.scale + camera.x
  const sy = pos.y * camera.scale + camera.y

  return (
    <div className="ro-host">
      <svg className="ro-leader" width={size.w} height={size.h} aria-hidden="true">
        <line
          x1={sx}
          y1={sy}
          x2={size.w - DOCK - CARD_W}
          y2={CARD_ANCHOR_Y}
          stroke="#a9b4bd"
          strokeOpacity={0.45}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>
      <div className="readout">
        <div className="ro-head">
          <span className="ro-name">{entity.name}</span>
          <span
            className="ro-phase"
            style={{ color: pill.color ?? color, borderColor: pill.color ?? color }}
          >
            {pillLabel}
          </span>
        </div>
        {ghostLine && <div className="ro-ghost">{ghostLine}</div>}
        <div className="ro-grid">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <div className="ro-k">{label}</div>
              <div className="ro-v">{value}</div>
            </Fragment>
          ))}
        </div>
        <div className="ro-foot">
          <span>PLANNING MODEL · 0.5 S CADENCE · CONSTANT ALTITUDE · NOT INSTRUMENTED</span>
          <button
            className="mini ro-details"
            title="Details in Analysis"
            onClick={() => {
              select({ entityIds: [entity.id] })
              setRightTab('analysis')
            }}
          >
            Details
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Selection gate for the track card. It subscribes only to the layer toggle,
 * the selection and the scenario, so nothing time-dependent mounts until one
 * UAS is selected and the telemetry layer is on.
 */
export function TrackFileReadout({ timeline, assessments, size }: Props) {
  const scenario = useStore((s) => s.scenario)
  const show = useStore((s) => s.ui.layers.trackTelemetry)
  const selectedIds = useStore((s) => s.selection.entityIds)

  if (!show || selectedIds.length !== 1) return null
  const entity = scenario.entities.find((e) => e.id === selectedIds[0])
  if (!entity || entity.kind !== 'uas') return null

  return (
    <ReadoutCard
      entity={entity}
      scenario={scenario}
      timeline={timeline}
      assessments={assessments}
      size={size}
    />
  )
}
