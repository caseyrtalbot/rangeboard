import { Fragment, useMemo } from 'react'
import { useStore } from '../state/store'
import { modelFor } from '../model/scenario'
import { entityInk } from '../ui/ink'
import { selectSimTimeS } from '../state/selectors'
import type { Entity, Scenario } from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import { PHASE_STYLE } from '../playback/trackState'
import type { TrackTimeline } from '../playback/trackState'
import { threatReadoutAt } from '../panels/analysis/threatReadout'
import { sweepAt } from '../playback/sweepAt'

interface Props {
  /** Prefix-aggregated timeline, built once in CanvasStage. */
  timeline: TrackTimeline
  /** Whole-run threat sweep, shared with the analysis panel. */
  assessments: ThreatAssessment[]
  /** Canvas host size, screen px. The leader line draws in that frame. */
  size: { w: number; h: number }
  onOpenDetail?: () => void
}

/** Card width and dock inset, screen px. Both are mirrored in index.css. */
const CARD_W = 252
const DOCK = 14
/** The leader line meets the card just under its header. */
const CARD_ANCHOR_Y = DOCK + 22

/**
 * Compact telemetry for one selected trackfile. It docks at a fixed board
 * corner with a leader line to the track, so it never covers the inbound axis.
 *
 * A DOM overlay and a snapped consumer: it reads the published sim time, not
 * the canvas frame clock, so it repaints at the publication cadence and not
 * once per animation frame.
 *
 * The complete track file is rendered in ThreatDetail from the same resolver.
 */
function ReadoutCard({
  entity,
  scenario,
  timeline,
  assessments,
  size,
  onOpenDetail,
}: { entity: Entity; scenario: Scenario } & Props) {
  const camera = useStore((s) => s.camera)
  const units = useStore((s) => s.ui.units)
  const simTimeS = useStore(selectSimTimeS)
  const select = useStore((s) => s.select)
  const setRightTab = useStore((s) => s.setRightTab)

  const model = modelFor(scenario, entity)
  const color = entityInk(entity, model)
  // The sweep at simTimeS is the one the canvas just drew from (sweepAt), so
  // the card reruns no sensor sweep of its own.
  const readout = useMemo(
    () =>
      threatReadoutAt({
        scenario,
        entity,
        timeline,
        assessments,
        tS: simTimeS,
        units,
        sweep: sweepAt(scenario, timeline, simTimeS),
      }),
    [scenario, entity, timeline, assessments, simTimeS, units],
  )
  const compactRows = [
    { label: 'CURSOR', value: readout.cursorText },
    {
      label: 'SPEED / HDG',
      value: readout.rows.find((row) => row.id === 'speedHeading')!.value,
    },
    { label: 'ALT', value: readout.altitudeText },
  ]
  const pill = PHASE_STYLE[readout.phase]
  const sx = readout.position.x * camera.scale + camera.x
  const sy = readout.position.y * camera.scale + camera.y

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
      <div className="readout compact">
        <div className="ro-head">
          <span className="ro-name">{entity.name}</span>
          <span
            className="ro-phase"
            style={{ color: pill.color ?? color, borderColor: pill.color ?? color }}
          >
            {readout.pillLabel}
          </span>
        </div>
        <div className="ro-grid">
          {compactRows.map(({ label, value }) => (
            <Fragment key={label}>
              <div className="ro-k">{label}</div>
              <div className="ro-v">{value}</div>
            </Fragment>
          ))}
        </div>
        <div className="ro-foot">
          <span>{readout.sourceHorizon}</span>
          <button
            className="mini ro-details"
            title="Details in Analysis"
            onClick={() => {
              if (onOpenDetail) {
                onOpenDetail()
                return
              }
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
export function TrackFileReadout({ timeline, assessments, size, onOpenDetail }: Props) {
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
      onOpenDetail={onOpenDetail}
    />
  )
}
