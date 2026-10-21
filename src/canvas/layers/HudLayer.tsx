import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Vec2 } from '../../model/types'
import { useStore } from '../../state/store'
import { formatAxis, formatDistance, gridStepM } from '../../geometry/geo'
import { useRingModel } from '../useRingModel'
import type { RingEdgeKey, RingHit } from '../ringModel'
import { RING_HIT_TOLERANCE_PX, ringHitFor } from '../ringModel'

interface Props {
  /** The Konva stage this overlay reads its cursor from. */
  stageRef: React.RefObject<Konva.Stage | null>
}

/** A press that travels farther than this, screen px, is a drag and pins nothing. */
const CLICK_SLOP_PX = 4

/** A pinned readout: the ring it names and the board point it was clicked at. */
interface RingPin {
  entityId: string
  key: RingEdgeKey
  world: Vec2
}

/** DOM overlay: scale bar, cursor readout, ring readout and active-tool hint. */
export function HudLayer({ stageRef }: Props) {
  const [mouseWorld, setMouseWorld] = useState<Vec2 | null>(null)
  const ringModel = useRingModel()
  const camera = useStore((s) => s.camera)
  const scale = camera.scale
  const [dismissed, setDismissed] = useState(false)
  const [pin, setPin] = useState<RingPin | null>(null)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  // The stage handlers bind once; they read the current model and scale here.
  const latest = useRef({ ringModel, scale })
  useEffect(() => {
    latest.current = { ringModel, scale }
  }, [ringModel, scale])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onMove = () => {
      const world = stage.getRelativePointerPosition()
      setMouseWorld(world)
      setDismissed(false)

      const container = stage.getAttrs().container
      let element: HTMLElement | null = null
      if (container instanceof HTMLElement) {
        element = container
      } else {
        element = document.querySelector('.konvajs-content')
      }
      if (element) {
        const rect = element.getBoundingClientRect()
        setCanvasOffset({ x: rect.left, y: rect.top })
      }
    }
    let pressAt: { x: number; y: number } | null = null
    const onDown = () => {
      pressAt = stage.getPointerPosition()
    }
    // A click on empty board pins the ring under it, or clears the pin with no ring
    // there. A click on an entity keeps the pin, so selecting a threat updates it.
    // A marquee drag and a draw tool click pin nothing.
    const onClick = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      onMove()
      if (event.target !== stage) return
      const up = stage.getPointerPosition()
      const dragged =
        pressAt != null &&
        up != null &&
        Math.hypot(up.x - pressAt.x, up.y - pressAt.y) > CLICK_SLOP_PX
      if (dragged || useStore.getState().ui.tool !== 'select') return
      const world = stage.getRelativePointerPosition()
      const { ringModel: model, scale: s } = latest.current
      const hit = world && s > 0 ? model.hitAt(world, RING_HIT_TOLERANCE_PX / s) : null
      setPin(hit && world ? { entityId: hit.entity.id, key: hit.key, world } : null)
    }
    const onLeave = () => {
      setMouseWorld(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setDismissed(true)
      setPin(null)
    }
    stage.on('mousedown.hud touchstart.hud', onDown)
    stage.on('mousemove.hud', onMove)
    stage.on('click.hud tap.hud', onClick)
    stage.on('mouseleave.hud', onLeave)
    window.addEventListener('keydown', onKey)
    return () => {
      stage.off('.hud')
      window.removeEventListener('keydown', onKey)
    }
  }, [stageRef])

  const toScreen = (world: Vec2) => ({
    x: world.x * scale + camera.x + canvasOffset.x,
    y: world.y * scale + camera.y + canvasOffset.y,
  })

  // A pinned readout re-reads its ring, so a threat or ring change updates the values.
  const pinnedHit = pin ? ringHitFor(ringModel.rings, pin.entityId, pin.key, pin.world) : null
  // The pinned ring is gone: drop the pin, so the ring coming back does not restore it.
  if (pin && !pinnedHit) setPin(null)

  // Recheck stationary pointers when visibility, selection or the camera changes.
  const hoverHit =
    !pin && mouseWorld && !dismissed && scale > 0
      ? ringModel.hitAt(mouseWorld, RING_HIT_TOLERANCE_PX / scale)
      : null
  const readout: { hit: RingHit; at: Vec2; pinned: boolean } | null =
    scale <= 0
      ? null
      : pin && pinnedHit
        ? { hit: pinnedHit, at: toScreen(pin.world), pinned: true }
        : hoverHit && mouseWorld
          ? { hit: hoverHit, at: toScreen(mouseWorld), pinned: false }
          : null

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
    cap:
      draftCount === 0
        ? 'ISR CAP: click the orbit center.'
        : 'ISR CAP: click to set the radius. Double-click the center for 1 km. Esc cancels.',
    connect: 'Connect: click the source entity, then the target entity.',
    calibrate: 'Calibrate: click two points on the image, then enter the true distance.',
  }

  return (
    <div className="hud">
      {readout && (
        // The outer box places and flips; the surface's entry animation owns its own transform.
        <div
          className="ring-readout-anchor"
          style={{
            left: readout.at.x,
            top: readout.at.y,
            transform: `translate(${readout.at.x > window.innerWidth / 2 ? 'calc(-100% - 12px)' : '12px'}, ${readout.at.y > window.innerHeight / 2 ? 'calc(-100% - 12px)' : '12px'})`,
          }}
        >
          <div role="tooltip" data-testid="ring-hint" className="ring-readout surface-float">
            <div className="ring-readout-title">
              <span className="ring-readout-system">{readout.hit.entity.name}</span>
              <span className="ring-readout-chip">{readout.hit.name}</span>
            </div>
            <div className="ring-readout-distance">{readout.hit.distance}</div>
            {readout.hit.height != null && (
              <div className="ring-readout-height">{readout.hit.height}</div>
            )}
            {readout.hit.basis != null && (
              <div className="ring-readout-basis">{readout.hit.basis}</div>
            )}
            {readout.pinned && <div className="ring-readout-basis">Pinned · Esc clears</div>}
          </div>
        </div>
      )}
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
