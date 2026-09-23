import { Fragment, useMemo } from 'react'
import { useStore } from '../state/store'
import { modelFor } from '../model/scenario'
import { entityInk } from '../ui/ink'
import { selectEffectiveLayers } from '../state/selectors'
import type { Entity, Scenario } from '../model/types'
import type { TrialResultView } from '../analysis/trialResult'
import { renderedTrialGeometry } from './LiveScene'
import { PHASE_STYLE } from '../playback/trackState'
import { threatReadoutAt } from '../panels/analysis/threatReadout'
import { trialSweepAt } from '../playback/trialSweepAt'

interface Props {
  trial: TrialResultView | null
  horizonS: number | null
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
 * Compact telemetry for one selected trackfile, docked at a fixed board corner with a
 * leader line to the track. A DOM overlay and a snapped consumer: it reads the
 * published sim time, so it repaints at the publication cadence.
 */
function ReadoutCard({
  entity,
  scenario,
  trial,
  horizonS,
  size,
  onOpenDetail,
}: { entity: Entity; scenario: Scenario } & Props) {
  const camera = useStore((s) => s.camera)
  const units = useStore((s) => s.ui.units)
  const simTimeS = useStore((s) => s.playback.simTimeS)
  const tObs = horizonS == null ? -Infinity : Math.min(horizonS, simTimeS)
  const horizon = useMemo(() => ({ scoped: true, horizonS: tObs }), [tObs])
  const select = useStore((s) => s.select)
  const setRightTab = useStore((s) => s.setRightTab)

  const model = modelFor(scenario, entity)
  const color = entityInk(entity, model)
  const readout = useMemo(() => {
    const anchor = renderedTrialGeometry(
      scenario,
      trial,
      horizonS == null ? null : tObs,
      simTimeS,
    ).tracks.get(entity.id)
    return threatReadoutAt({
      scenario,
      entity,
      trial,
      horizonS,
      tS: tObs,
      horizon,
      units,
      anchor: anchor ? { position: anchor.pos } : undefined,
      trialSweep: trial && tObs !== -Infinity ? trialSweepAt(trial, tObs) : undefined,
    })
  }, [scenario, entity, trial, horizonS, simTimeS, tObs, horizon, units])
  const compactRows = [
    { label: 'Cursor', value: readout.cursorText },
    {
      label: 'Speed / heading',
      value: readout.rows.find((row) => row.id === 'speedHeading')!.value,
    },
    { label: 'Altitude', value: readout.altitudeText },
  ]
  const pill = PHASE_STYLE[readout.phase]
  const sx = readout.anchorPosition.x * camera.scale + camera.x
  const sy = readout.anchorPosition.y * camera.scale + camera.y

  return (
    <div className="ro-host">
      <svg className="ro-leader" width={size.w} height={size.h} aria-hidden="true">
        <line x1={sx} y1={sy} x2={size.w - DOCK - CARD_W} y2={CARD_ANCHOR_Y} />
      </svg>
      <div className="readout compact surface-float">
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
        {readout.state && (
          <div className="ro-v">{readout.rows.find((row) => row.id === 'residual')?.value}</div>
        )}
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
 * Selection gate for the track card. Nothing time-dependent mounts until one UAS is
 * selected and the telemetry layer is on.
 */
export function TrackFileReadout({ trial, horizonS, size, onOpenDetail }: Props) {
  const scenario = useStore((s) => s.scenario)
  const show = useStore((s) => selectEffectiveLayers(s).trackTelemetry)
  const selectedIds = useStore((s) => s.selection.entityIds)

  if (!show || selectedIds.length !== 1) return null
  const entity = scenario.entities.find((e) => e.id === selectedIds[0])
  if (!entity || entity.kind !== 'uas') return null

  return (
    <ReadoutCard
      entity={entity}
      scenario={scenario}
      trial={trial}
      horizonS={horizonS}
      size={size}
      onOpenDetail={onOpenDetail}
    />
  )
}
