import type { Vec2 } from '../../model/types'
import { useStore } from '../../state/store'
import { formatDistance, gridStepM } from '../../geometry/geo'

interface Props {
  mouseWorld: Vec2 | null
}

/** DOM overlay: scale bar, cursor readout, and active-tool hint. */
export function HudLayer({ mouseWorld }: Props) {
  const camera = useStore((s) => s.camera)
  const tool = useStore((s) => s.ui.tool)
  const draftCount = useStore((s) => s.ui.draftPoints.length)
  const pathEntityId = useStore((s) => s.ui.pathEntityId)

  const stepM = gridStepM(camera.scale, 120)
  const barPx = stepM * camera.scale

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
      {tool !== 'select' && <div className="hud-hint">{hints[tool]}</div>}
      <div className="hud-bottom">
        <span className="hud-cursor">
          {mouseWorld
            ? `E ${(mouseWorld.x / 1000).toFixed(2)} km, N ${(-mouseWorld.y / 1000).toFixed(2)} km`
            : ''}
        </span>
        <span className="hud-scale">
          <span className="hud-scale-bar" style={{ width: `${barPx}px` }} />
          {formatDistance(stepM)}
        </span>
      </div>
    </div>
  )
}
