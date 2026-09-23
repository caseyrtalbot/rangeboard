import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Rect, Stage } from 'react-konva'
import { registerStage } from './frameCapture'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Vec2 } from '../model/types'
import { useStore } from '../state/store'
import { selectDurationS } from '../state/selectors'
import { displayTimeNow } from './frameClock'
import { memberPositions } from '../playback/tracks'
import { trialResultOf } from '../analysis/trialResult'
import { useTrialResult } from '../state/useTrialResult'
import { selectTrialHorizon } from '../state/trialSelectors'
import { GridLayer } from './layers/GridLayer'
import { TileLayer } from './layers/TileLayer'
import { UnderlayLayer } from './layers/UnderlayLayer'
import { LiveScene, renderedTrialGeometry } from './LiveScene'
import { StaticScene } from './StaticScene'
import { HudLayer } from './layers/HudLayer'
import { TrackFileReadout } from './TrackFileReadout'
import { ContextMenu } from './ContextMenu'
import { ConnectSuggestPopup } from './ConnectSuggestPopup'
import { IDLE_INTERACTION, routeInteraction } from './interactionRouter'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import { useBoardInk } from './useBoardInk'
import { withAlpha } from '../ui/ink'
import type { Action } from './interactionRouter'

const MIN_SCALE = 0.0005
const MAX_SCALE = 20
/** Max pointer travel (px) between two clicks that still counts as a double-click. */
const DBL_CLICK_PX = 6
/** Konva's dblclick pairing window, ms (Konva.dblClickWindow default). */
const DBL_CLICK_MS = 400
/** Pointer travel (screen px) before a modifier-drag counts as a box select. */
const MARQUEE_MIN_PX = 4
/** Fixed dash array: an inline literal is re-set on every render. */
const MARQUEE_DASH = [4, 4]

interface Marquee {
  a: Vec2
  b: Vec2
  /** Shift-drag adds to the selection; Cmd/Ctrl-drag replaces it. */
  additive: boolean
}

export const CanvasStage = memo(function CanvasStage({
  onOpenDetail,
  onPlace,
}: {
  onOpenDetail?: () => void
  onPlace?: (world: Vec2, screen?: Vec2) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)

  // Expose the stage to the frame-capture module while mounted.
  useEffect(() => {
    registerStage(stageRef.current)
    return () => registerStage(null)
  })
  const [size, setSize] = useState({ w: 800, h: 600 })
  // The cursor lives in a ref. State is set only while the draft rubber band or the
  // calibrate line is up, so a plain hover repaints no layer.
  const mouseWorldRef = useRef<Vec2 | null>(null)
  const [mouseWorld, setMouseWorld] = useState<Vec2 | null>(null)
  const lastClicks = useRef<Array<{ x: number; y: number; t: number }>>([])
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const marqueeRef = useRef<Marquee | null>(null)
  const suppressClick = useRef(false)
  // Held modifier keys disable stage panning so the same drag can box-select.
  const [modKey, setModKey] = useState(false)
  // Palette drag-over cue. Child elements fire their own enter/leave pairs, so only
  // depth 0 means the drag truly left.
  const [dropActive, setDropActive] = useState(false)
  const dragDepth = useRef(0)
  // A throw inside the Konva tree lands here; Retry remounts the layers.
  const [sceneError, setSceneError] = useState<string | null>(null)
  const [sceneAttempt, setSceneAttempt] = useState(0)

  const scenario = useStore((s) => s.scenario)
  const camera = useStore((s) => s.camera)
  const setCamera = useStore((s) => s.setCamera)
  // Field subscriptions, not the whole `ui` object, so an unrelated ui field does
  // not re-render the stage.
  const tool = useStore((s) => s.ui.tool)
  const basemap = useStore((s) => s.ui.basemap)
  const moveUnderlay = useStore((s) => s.ui.moveUnderlay)
  const raidDraft = useStore((s) => s.ui.raidDraft)
  const durationS = useStore(selectDurationS)
  const ink = useBoardInk()
  const clearSelection = useStore((s) => s.clearSelection)
  const select = useStore((s) => s.select)
  const addEntityFromModel = useStore((s) => s.addEntityFromModel)
  const commitRaid = useStore((s) => s.commitRaid)
  const addDraftPoint = useStore((s) => s.addDraftPoint)
  const finishBoundary = useStore((s) => s.finishBoundary)
  const finishPath = useStore((s) => s.finishPath)
  const setCalibratePoint = useStore((s) => s.setCalibratePoint)
  const addSystemFromPreset = useStore((s) => s.addSystemFromPreset)
  const openContextMenu = useStore((s) => s.openContextMenu)
  const closeContextMenu = useStore((s) => s.closeContextMenu)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const update = (e: KeyboardEvent) => setModKey(e.metaKey || e.ctrlKey || e.shiftKey)
    const clear = () => setModKey(false)
    window.addEventListener('keydown', update)
    window.addEventListener('keyup', update)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', update)
      window.removeEventListener('keyup', update)
      window.removeEventListener('blur', clear)
    }
  }, [])

  const { selection: trialSelection, horizon } = useTrialResult()
  const started = useStore((s) => s.playback.startedAtMs != null)
  const trial = useMemo(
    () =>
      trialSelection.status === 'ready'
        ? trialResultOf(
            trialSelection.scenario,
            trialSelection.result.manifest,
            trialSelection.result,
          )
        : null,
    [trialSelection],
  )
  const horizonS = trial && started ? horizon : null

  function toWorld(pointer: Vec2): Vec2 {
    return { x: (pointer.x - camera.x) / camera.scale, y: (pointer.y - camera.y) / camera.scale }
  }

  function pointerWorld(): Vec2 | null {
    const pointer = stageRef.current?.getPointerPosition()
    return pointer ? toWorld(pointer) : null
  }

  function handleContextMenu(e: KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault()
    // Ctrl+left-click also fires contextmenu on macOS; the menu is right-button only.
    if (e.evt.button !== 2) return
    // Entity nodes open their own menu and cancel bubbling; any other target gets
    // the placement menu.
    const pointer = stageRef.current?.getPointerPosition()
    const world = pointerWorld()
    if (!pointer || !world) return
    openContextMenu(pointer, world, null)
  }

  function handleWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    closeContextMenu()
    const pointer = stageRef.current?.getPointerPosition()
    if (!pointer) return
    const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor))
    const world = toWorld(pointer)
    setCamera({
      scale,
      x: pointer.x - world.x * scale,
      y: pointer.y - world.y * scale,
    })
  }

  /** True when the last two clicks form a genuine in-place double-click. */
  function isInPlacePair(): boolean {
    const [a, b] = lastClicks.current
    return (
      !!a && !!b && b.t - a.t < DBL_CLICK_MS && Math.hypot(b.x - a.x, b.y - a.y) <= DBL_CLICK_PX
    )
  }

  function beginMarquee(e: KonvaEventObject<MouseEvent>) {
    // A stale suppress flag (mouseup off-stage) must not eat this gesture's click.
    suppressClick.current = false
    if (tool !== 'select' || e.target !== stageRef.current) return
    if (!(e.evt.metaKey || e.evt.ctrlKey || e.evt.shiftKey)) return
    const world = pointerWorld()
    if (!world) return
    const m: Marquee = { a: world, b: world, additive: e.evt.shiftKey }
    marqueeRef.current = m
    setMarquee(m)
  }

  function updateMarquee(world: Vec2 | null) {
    const m = marqueeRef.current
    if (!m || !world) return
    const next = { ...m, b: world }
    marqueeRef.current = next
    setMarquee(next)
  }

  function finishMarquee() {
    const m = marqueeRef.current
    if (!m) return
    marqueeRef.current = null
    setMarquee(null)
    const movedPx = Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) * camera.scale
    if (movedPx < MARQUEE_MIN_PX) return
    const x0 = Math.min(m.a.x, m.b.x)
    const x1 = Math.max(m.a.x, m.b.x)
    const y0 = Math.min(m.a.y, m.b.y)
    const y1 = Math.max(m.a.y, m.b.y)
    // Read the frame clock once so a box tests the rendered member positions.
    const displayTimeS = displayTimeNow()
    const current = useStore.getState()
    const outcomeTimeS =
      trial && current.playback.startedAtMs != null
        ? selectTrialHorizon(current, displayTimeS)
        : null
    const { tracks, members } = renderedTrialGeometry(scenario, trial, outcomeTimeS, displayTimeS)
    const ids = scenario.entities
      .filter((en) => {
        const track = tracks.get(en.id)
        const positions =
          members.get(en.id)?.map((member) => member.position) ??
          (en.kind === 'uas'
            ? memberPositions(en, track?.pos ?? en.pos, track?.headingDeg ?? en.headingDeg)
            : [track?.pos ?? en.pos])
        return positions.some((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1)
      })
      .map((en) => en.id)
    select({ entityIds: ids }, m.additive)
    // Konva fires a click on the same mouseup; it must not clear this selection.
    suppressClick.current = true
  }

  // Releasing the mouse outside the stage still ends the box select.
  useEffect(() => {
    if (!marquee) return
    window.addEventListener('mouseup', finishMarquee)
    return () => window.removeEventListener('mouseup', finishMarquee)
  })

  /** Dispatches a routed stage click, drop or placement action at one point. */
  function dispatch(action: Action, world: Vec2, screen?: Vec2) {
    switch (action.type) {
      case 'place':
        onPlace?.(world, screen)
        return
      case 'commit-raid':
        commitRaid(world)
        return
      case 'add-draft-point':
        addDraftPoint(world)
        return
      case 'set-calibrate-point':
        setCalibratePoint(world)
        return
      case 'clear-selection':
        clearSelection()
        return
      case 'add-entity-from-model':
        addEntityFromModel(action.modelId, world, screen)
        return
      case 'add-system-from-preset':
        addSystemFromPreset(action.systemId, world)
        return
      default:
        return
    }
  }

  function handleClick(e: KonvaEventObject<MouseEvent>) {
    // The marquee's paired click is stale; the flag is one-shot either way.
    const clickSuppressed = suppressClick.current
    suppressClick.current = false
    const onEmpty = e.target === stageRef.current
    const world = pointerWorld()
    if (!world) return
    const pointer = stageRef.current?.getPointerPosition()
    if (pointer && !clickSuppressed) {
      lastClicks.current = [...lastClicks.current.slice(-1), { ...pointer, t: performance.now() }]
    }
    // Precedence lives in the router.
    const action = routeInteraction(
      { kind: 'click-stage', onEmpty, inPlacePair: isInPlacePair() },
      {
        ...IDLE_INTERACTION,
        tool,
        raidDraft: raidDraft != null,
        placementArmed: onPlace != null,
        clickSuppressed,
      },
    )
    dispatch(action, world, pointer ?? undefined)
  }

  function handleDblClick() {
    // Konva pairs any two clicks inside its time window into a dblclick, even far
    // apart, so only a true in-place double-click finishes.
    if (!isInPlacePair()) return
    if (tool === 'boundary') finishBoundary(true)
    if (tool === 'path') finishPath()
  }

  // A cancelled drag (Esc) may end without a leave; dragend clears the cue regardless.
  useEffect(() => {
    if (!dropActive) return
    const end = () => {
      dragDepth.current = 0
      setDropActive(false)
    }
    window.addEventListener('dragend', end)
    return () => window.removeEventListener('dragend', end)
  }, [dropActive])

  function isPaletteDrag(e: React.DragEvent): boolean {
    const types = e.dataTransfer.types
    return types.includes('text/rangeboard-model') || types.includes('text/rangeboard-system')
  }

  const drawing = tool !== 'select'
  // Tools whose draft geometry follows the cursor.
  const cursorDrawn = tool === 'boundary' || tool === 'path' || tool === 'calibrate'
  // Picking one of those tools starts from the cursor's current place.
  useEffect(() => {
    if (cursorDrawn) setMouseWorld(mouseWorldRef.current)
  }, [cursorDrawn])

  return (
    <div
      ref={containerRef}
      className={`canvas-host ${basemap} ${drawing ? 'drawing' : ''} ${dropActive ? 'drop-active' : ''}`}
      data-testid="canvas-host"
      tabIndex={0}
      role="application"
      aria-label="Board canvas"
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => {
        if (!isPaletteDrag(e)) return
        dragDepth.current += 1
        setDropActive(true)
      }}
      onDragLeave={(e) => {
        if (!isPaletteDrag(e)) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDropActive(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDropActive(false)
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        const modelId = e.dataTransfer.getData('text/rangeboard-model')
        const systemId = e.dataTransfer.getData('text/rangeboard-system')
        const action = routeInteraction(
          { kind: 'drop', modelId, systemId },
          {
            ...IDLE_INTERACTION,
            tool,
            raidDraft: raidDraft != null,
            placementArmed: onPlace != null,
          },
        )
        dispatch(action, toWorld(screen), screen)
      }}
    >
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        x={camera.x}
        y={camera.y}
        scaleX={camera.scale}
        scaleY={camera.scale}
        draggable={tool === 'select' && !modKey && !onPlace}
        onWheel={handleWheel}
        onClick={handleClick}
        onDblClick={handleDblClick}
        onContextMenu={handleContextMenu}
        onMouseDown={beginMarquee}
        onMouseUp={finishMarquee}
        onMouseMove={() => {
          const world = pointerWorld()
          mouseWorldRef.current = world
          if (cursorDrawn || marqueeRef.current) setMouseWorld(world)
          updateMarquee(world)
        }}
        onDragStart={(e) => {
          if (e.target === stageRef.current) closeContextMenu()
        }}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setCamera({ ...camera, x: e.target.x(), y: e.target.y() })
          }
        }}
      >
        <SceneErrorBoundary
          key={sceneAttempt}
          onError={(error) => setSceneError(error.message || 'unknown error')}
        >
          <Layer listening={false}>
            <TileLayer size={size} />
          </Layer>
          <Layer listening={moveUnderlay}>
            <UnderlayLayer />
          </Layer>
          <Layer listening={false}>
            <GridLayer size={size} />
          </Layer>
          {/* Two Konva Layers, two canvases: the static rings repaint only when
            the scenario, the camera or a sensor hold changes; the live layer
            repaints per animation frame. Child order across the two keeps
            today's z-order. */}
          <Layer>
            <StaticScene trial={trial} horizonS={horizonS} />
          </Layer>
          <Layer>
            <LiveScene
              scenario={scenario}
              camera={camera}
              size={size}
              mouseWorld={mouseWorld}
              trial={trial}
              horizonS={horizonS}
              durationS={durationS}
            />
            {marquee && (
              <Rect
                x={Math.min(marquee.a.x, marquee.b.x)}
                y={Math.min(marquee.a.y, marquee.b.y)}
                width={Math.abs(marquee.b.x - marquee.a.x)}
                height={Math.abs(marquee.b.y - marquee.a.y)}
                stroke={ink.tool}
                strokeWidth={1}
                dash={MARQUEE_DASH}
                strokeScaleEnabled={false}
                fill={withAlpha(ink.tool, 0.08)}
                listening={false}
              />
            )}
          </Layer>
        </SceneErrorBoundary>
      </Stage>
      {sceneError && (
        <div className="canvas-scene-error" role="alert">
          <span className="state critical">
            <i className="state-square" aria-hidden="true" />
            The board could not be drawn.
          </span>
          <p className="muted small">{sceneError}</p>
          <p className="muted small">Your scenario is still available.</p>
          <button
            type="button"
            onClick={() => {
              setSceneError(null)
              setSceneAttempt((n) => n + 1)
            }}
          >
            Retry
          </button>
        </div>
      )}
      {basemap === 'sat' && scenario.geoRef && (
        <div className="tile-attribution">
          Imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics)
        </div>
      )}
      <HudLayer stageRef={stageRef} />
      <TrackFileReadout onOpenDetail={onOpenDetail} trial={trial} horizonS={horizonS} size={size} />
      <ContextMenu />
      <ConnectSuggestPopup />
      {onPlace && (
        <button
          className="canvas-placement-target"
          aria-label="Place library item on board"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const screen =
              event.detail === 0
                ? { x: rect.width / 2, y: rect.height / 2 }
                : { x: event.clientX - rect.left, y: event.clientY - rect.top }
            const action = routeInteraction(
              { kind: 'click-stage', onEmpty: true, inPlacePair: false },
              { ...IDLE_INTERACTION, tool, raidDraft: raidDraft != null, placementArmed: true },
            )
            dispatch(action, toWorld(screen), screen)
          }}
        />
      )}
    </div>
  )
})
