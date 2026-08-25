import { Fragment } from 'react'
import type { DisplayUnits } from '../geometry/geo'
import { formatDistance, formatSpeed, formatTime, NM_M } from '../geometry/geo'
import { modelFor, pathSpeed, useStore } from '../state/store'
import { trackQualityAt } from '../analysis/threatAggregation'
import type { DetectionHit, LiveTrack, ThreatAssessment } from '../playback/sim'
import { PHASE_STYLE } from '../playback/trackState'
import type { TrackPhase, TrackFileState } from '../playback/trackState'

interface Props {
  /** Track lifecycle at the current sim time, keyed by UAS id. */
  trackStates: Map<string, TrackFileState>
  /** Render-time sensor sweep, keyed by UAS id. Feeds the no-timeline fallback. */
  detections: Map<string, DetectionHit[]>
  /** Whole-run threat sweep, shared with the analysis panel. */
  assessments: ThreatAssessment[]
  tracks: Map<string, LiveTrack>
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

/** One position axis. Aviation keeps two decimals of a nautical mile. */
function axisText(m: number, units: DisplayUnits): string {
  if (units === 'aviation') return `${(m / NM_M).toFixed(2)} nm`
  return `${m < 0 ? '-' : ''}${formatDistance(Math.abs(m), units)}`
}

/**
 * Telemetry for one selected trackfile. It docks at a fixed board corner with
 * a leader line to the track, so it never covers the inbound axis. Every
 * figure is derived from the planning sweep: nothing here is measured.
 */
export function TrackFileReadout({ trackStates, detections, assessments, tracks, size }: Props) {
  const scenario = useStore((s) => s.scenario)
  const camera = useStore((s) => s.camera)
  const units = useStore((s) => s.ui.units)
  const show = useStore((s) => s.ui.layers.trackTelemetry)
  const selectedIds = useStore((s) => s.selection.entityIds)
  const simTimeS = useStore((s) => s.playback.simTimeS)

  if (!show || selectedIds.length !== 1) return null
  const entity = scenario.entities.find((e) => e.id === selectedIds[0])
  if (!entity || entity.kind !== 'uas') return null

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

  const rows: Array<[string, string]> = [
    [
      'PLATFORM',
      uas ? `${model!.name} · Group ${uas.group} · ${uas.airframe}` : 'no model linked',
    ],
    ['NAV', uas ? (NAV_LABEL[uas.navMode] ?? uas.navMode) : 'unknown'],
    ['POSITION', `E ${axisText(pos.x, units)}, N ${axisText(-pos.y, units)}`],
    [
      'ALTITUDE',
      uas
        ? `${uas.altBandFt[0].toLocaleString()} - ${uas.altBandFt[1].toLocaleString()} ft AGL`
        : 'unknown',
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
    ['EW', state ? (jam >= 0.005 ? `jam degrade ${jam.toFixed(2)}` : 'no jam effect') : NA],
    [
      'SALVOS',
      state
        ? `${state.kineticSalvos} kinetic · ${state.jamSalvos} jam · ${state.incomingSalvos} inbound`
        : NA,
    ],
    [
      'EFFECTS',
      state ? `${state.effectsLanded} landed · E[k] ${state.expectedKills.toFixed(2)}` : NA,
    ],
    ['RESIDUAL', state ? `${state.residual.toFixed(2)} of ${state.shipCount} ships` : NA],
    [
      'ARRIVAL',
      state ? (state.arrivalS != null ? `T+${formatTime(state.arrivalS)}` : 'not reached') : NA,
    ],
  ]

  const ghostLine =
    state?.eliminated && state.eliminatedAtS != null
      ? `Ghost track. Eliminated T+${formatTime(state.eliminatedAtS)} by ${
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
            {pill.label}
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
        <div className="ro-foot">PLANNING MODEL · 0.5 S CADENCE · NOT INSTRUMENTED</div>
      </div>
    </div>
  )
}
