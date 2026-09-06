import { useEffect, useState } from 'react'
import type Konva from 'konva'
import type { Vec2 } from '../../model/types'
import { useStore } from '../../state/store'
import { formatAxis, formatDistance, gridStepM } from '../../geometry/geo'

interface Props {
  /** The Konva stage this overlay reads its cursor from. */
  stageRef: React.RefObject<Konva.Stage | null>
}

/** DOM overlay: scale bar, cursor readout, and active-tool hint. */
export function HudLayer({ stageRef }: Props) {
  // This overlay owns its cursor: a pointer move then re-renders one small DOM
  // subtree instead of the stage and every Konva layer under it.
  const [mouseWorld, setMouseWorld] = useState<Vec2 | null>(null)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    // getRelativePointerPosition inverts the stage transform, so this is the
    // same world point CanvasStage computes from the camera.
    const onMove = () => setMouseWorld(stage.getRelativePointerPosition())
    stage.on('mousemove.hud', onMove)
    return () => {
      stage.off('mousemove.hud')
    }
  }, [stageRef])
  const scale = useStore((s) => s.camera.scale)
  const units = useStore((s) => s.ui.units)
  const tool = useStore((s) => s.ui.tool)
  const draftCount = useStore((s) => s.ui.draftPoints.length)
  const pathEntityId = useStore((s) => s.ui.pathEntityId)
  const raidDraft = useStore((s) => s.ui.raidDraft)
  const satUnanchored = useStore(
    (s) => s.ui.basemap === 'sat' && !s.scenario.geoRef && !s.scenario.underlay.dataUrl,
  )
  const raidReady = useStore(
    (s) =>
      s.ui.raidDraft != null &&
      s.ui.raidDraft.platformSpecId != null &&
      s.ui.raidDraft.targetEntityId != null,
  )

  const stepM = gridStepM(scale, 120, units)
  const barPx = stepM * scale

  const hints: Record<string, string> = {
    boundary:
      draftCount === 0
        ? 'Boundary: click to place points. Double-click or press Enter to finish. Esc cancels.'
        : `Boundary: ${draftCount} points. Double-click or Enter to close. Esc cancels.`,
    path: pathEntityId
      ? 'Path: click waypoints. Double-click or Enter to finish. Esc cancels.'
      : 'Path: click a UAS to start its flight path.',
    connect: 'Connect: click the source entity, then the target entity.',
    calibrate: 'Calibrate: click two points on the image, then enter the true distance.',
  }

  return (
    <div className="hud">
      {raidDraft ? (
        <div className="hud-hint">
          {raidReady
            ? `Tactic ${raidDraft.tacticId} armed: click the canvas to place the ingress axis. Esc cancels.`
            : `Tactic ${raidDraft.tacticId} armed: choose a platform and target in the Inspect tab. Esc cancels.`}
        </div>
      ) : tool !== 'select' ? (
        <div className="hud-hint">{hints[tool]}</div>
      ) : satUnanchored ? (
        <div className="hud-hint">Sat basemap: choose Location or import an image.</div>
      ) : null}
      <div className="hud-bottom">
        <span className="hud-cursor">
          {mouseWorld
            ? `${formatAxis(mouseWorld.x, units, 'E', 'W')}, ${formatAxis(-mouseWorld.y, units, 'N', 'S')}`
            : ''}
        </span>
        <span className="hud-scale">
          <span className="hud-scale-bar" style={{ width: `${barPx}px` }} />
          {formatDistance(stepM, units)}
        </span>
      </div>
    </div>
  )
}
