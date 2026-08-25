import type { Vec2 } from '../../model/types'
import { useStore } from '../../state/store'
import type { DisplayUnits } from '../../geometry/geo'
import { formatDistance, gridStepM, NM_M } from '../../geometry/geo'

interface Props {
  mouseWorld: Vec2 | null
}

/**
 * One cursor axis with a hemisphere letter and an unsigned magnitude, the way
 * a position is read aloud. Matches TrackFileReadout so the HUD and the track
 * card never state the same point two different ways. Northing is -y: the
 * world frame is +y south.
 */
function axisText(m: number, units: DisplayUnits, plus: string, minus: string): string {
  const mag = Math.abs(m)
  const value = units === 'aviation' ? `${(mag / NM_M).toFixed(2)} nm` : `${(mag / 1000).toFixed(2)} km`
  return `${m < 0 ? minus : plus} ${value}`
}

/** DOM overlay: scale bar, cursor readout, and active-tool hint. */
export function HudLayer({ mouseWorld }: Props) {
  const camera = useStore((s) => s.camera)
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

  const stepM = gridStepM(camera.scale, 120, units)
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
            ? `${axisText(mouseWorld.x, units, 'E', 'W')}, ${axisText(-mouseWorld.y, units, 'N', 'S')}`
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
