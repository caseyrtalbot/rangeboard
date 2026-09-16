import { useEffect, useState } from 'react'
import type Konva from 'konva'
import type { Vec2 } from '../../model/types'
import { useStore } from '../../state/store'
import { formatAxis, formatDistance, gridStepM } from '../../geometry/geo'
import { useRingModel } from '../useRingModel'

interface Props {
  /** The Konva stage this overlay reads its cursor from. */
  stageRef: React.RefObject<Konva.Stage | null>
}

/** DOM overlay: scale bar, cursor readout, ring hints and active-tool hint. */
export function HudLayer({ stageRef }: Props) {
  const [mouseWorld, setMouseWorld] = useState<Vec2 | null>(null)
  const ringModel = useRingModel()
  const camera = useStore((s) => s.camera)
  const scale = camera.scale
  const [dismissed, setDismissed] = useState(false)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onMove = () => {
      const world = stage.getRelativePointerPosition()
      setMouseWorld(world)
      setDismissed(false)

      // Get canvas position in browser viewport
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
    const onLeave = () => {
      setMouseWorld(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissed(true)
    }
    stage.on('mousemove.hud click.hud tap.hud', onMove)
    stage.on('mouseleave.hud', onLeave)
    window.addEventListener('keydown', onKey)
    return () => {
      stage.off('.hud')
      window.removeEventListener('keydown', onKey)
    }
  }, [stageRef])

  // Calculate screen position from world coordinates
  const hintScreenPos =
    mouseWorld && scale > 0
      ? {
          x: mouseWorld.x * scale + camera.x + canvasOffset.x,
          y: mouseWorld.y * scale + camera.y + canvasOffset.y,
        }
      : null

  // Recheck stationary pointers when visibility, selection or the camera changes.
  const ringHit =
    mouseWorld && !dismissed && scale > 0 ? ringModel.hitAt(mouseWorld, 6 / scale) : null

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
      {ringHit && hintScreenPos && (
        <div
          role="tooltip"
          data-testid="ring-hint"
          style={{
            position: 'fixed',
            left: hintScreenPos.x,
            top: hintScreenPos.y,
            transform: `translate(${hintScreenPos.x > window.innerWidth / 2 ? 'calc(-100% - 12px)' : '12px'}, ${hintScreenPos.y > window.innerHeight / 2 ? 'calc(-100% - 12px)' : '12px'})`,
            maxWidth: 280,
            padding: 'var(--space-2)',
            pointerEvents: 'none',
            background: 'var(--surface-panel)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-control)',
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            lineHeight: 1.4,
            zIndex: 1000,
          }}
        >
          <div>
            <strong>{ringHit.entity.name}</strong> · {ringHit.name}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            {formatDistance(ringHit.radiusM, units)}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>{ringHit.hint}</div>
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
