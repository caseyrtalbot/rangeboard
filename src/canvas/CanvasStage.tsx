import { useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Rect, Stage } from 'react-konva'
import { registerStage } from '../te/io/frameCapture'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Vec2 } from '../model/types'
import { useStore } from '../state/store'
import { detectionsAt, liveTracks } from '../playback/sim'
import { engagementPicture } from '../analysis/impact'
import {
  buildTrackTimeline,
  effectorStatesAt,
  shotsInFlightAt,
  trackStatesAt,
} from '../playback/trackState'
import { GridLayer } from './layers/GridLayer'
import { TileLayer } from './layers/TileLayer'
import { UnderlayLayer } from './layers/UnderlayLayer'
import { BoundaryLayer } from './layers/BoundaryLayer'
import { FootprintLayer } from './layers/FootprintLayer'
import { ThreatWezLayer } from './layers/ThreatWezLayer'
import { RangeLayer } from './layers/RangeLayer'
import { PathLayer } from './layers/PathLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'
import { EngagementLayer } from './layers/EngagementLayer'
import { EntityLayer } from './layers/EntityLayer'
import { CalloutLayer } from './layers/CalloutLayer'
import { layoutLabels } from './labelLayout'
import { SystemHandleLayer } from './layers/SystemHandleLayer'
import { HudLayer } from './layers/HudLayer'
import { TrackFileReadout } from './TrackFileReadout'
import { ContextMenu } from './ContextMenu'
import { ConnectSuggestPopup } from './ConnectSuggestPopup'

const MIN_SCALE = 0.0005
const MAX_SCALE = 20
/** Max pointer travel (px) between two clicks that still counts as a double-click. */
const DBL_CLICK_PX = 6
/** Konva's dblclick pairing window, ms (Konva.dblClickWindow default). */
const DBL_CLICK_MS = 400
/** Pointer travel (screen px) before a modifier-drag counts as a box select. */
const MARQUEE_MIN_PX = 4

interface Marquee {
  a: Vec2
  b: Vec2
  /** Shift-drag adds to the selection; Cmd/Ctrl-drag replaces it. */
  additive: boolean
}

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)

  // Expose the stage to the T&E frame-capture module while mounted.
  useEffect(() => {
    registerStage(stageRef.current)
    return () => registerStage(null)
  })
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [mouseWorld, setMouseWorld] = useState<Vec2 | null>(null)
  const lastClicks = useRef<Array<{ x: number; y: number; t: number }>>([])
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const marqueeRef = useRef<Marquee | null>(null)
  const suppressClick = useRef(false)
  // Held modifier keys disable stage panning so the same drag can box-select.
  const [modKey, setModKey] = useState(false)
  // Palette drag-over cue. Enter/leave depth counter: child elements fire
  // their own enter/leave pairs, so only depth 0 means the drag truly left.
  const [dropActive, setDropActive] = useState(false)
  const dragDepth = useRef(0)

  const scenario = useStore((s) => s.scenario)
  const camera = useStore((s) => s.camera)
  const setCamera = useStore((s) => s.setCamera)
  const ui = useStore((s) => s.ui)
  const simTimeS = useStore((s) => s.playback.simTimeS)
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

  const tracks = useMemo(() => liveTracks(scenario, simTimeS), [scenario, simTimeS])
  const detections = useMemo(() => detectionsAt(scenario, simTimeS), [scenario, simTimeS])
  // Attrition is time-independent; engagementPicture shares one computation
  // per scenario object with AnalysisPanel (module-level WeakMap in impact.ts).
  const picture = useMemo(() => engagementPicture(scenario), [scenario])
  const { assessments, report, impacts } = picture
  // One prefix-aggregated timeline per sweep. The per-frame queries below are
  // binary searches over it, so no layer ever rebuilds it.
  const timeline = useMemo(
    () => buildTrackTimeline(scenario, assessments, report),
    [scenario, assessments, report],
  )
  const trackStates = useMemo(() => trackStatesAt(timeline, simTimeS), [timeline, simTimeS])
  const shots = useMemo(() => shotsInFlightAt(timeline, simTimeS), [timeline, simTimeS])
  const effectorStates = useMemo(() => effectorStatesAt(timeline, simTimeS), [timeline, simTimeS])
  const prevSpokeIds = useRef<Set<string>>(new Set())
  const labelPlacements = useMemo(
    () =>
      layoutLabels(
        scenario.entities.map((e) => {
          const pos = tracks.get(e.id)?.pos ?? e.pos
          return { id: e.id, name: e.name, sx: pos.x * camera.scale + camera.x, sy: pos.y * camera.scale + camera.y }
        }),
        // eslint-disable-next-line react/refs -- last frame's spoke set feeds hysteresis; one frame stale by design
        { sticky: prevSpokeIds.current, viewport: { w: size.w, h: size.h } },
      ),
    [scenario.entities, tracks, camera, size],
  )
  const spokeIds = useMemo(
    () => new Set([...labelPlacements].filter(([, p]) => p.mode === 'spoke').map(([id]) => id)),
    [labelPlacements],
  )
  useEffect(() => {
    prevSpokeIds.current = spokeIds
  }, [spokeIds])

  function toWorld(pointer: Vec2): Vec2 {
    return { x: (pointer.x - camera.x) / camera.scale, y: (pointer.y - camera.y) / camera.scale }
  }

  function pointerWorld(): Vec2 | null {
    const pointer = stageRef.current?.getPointerPosition()
    return pointer ? toWorld(pointer) : null
  }

  function handleContextMenu(e: KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault()
    // Ctrl+left-click also fires contextmenu on macOS; the menu is
    // right-button only so Ctrl-drag stays a clean box select.
    if (e.evt.button !== 2) return
    // Entity nodes open their own menu and cancel bubbling; any other target
    // (stage, boundary, connection) gets the placement menu.
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
    return !!a && !!b && b.t - a.t < DBL_CLICK_MS && Math.hypot(b.x - a.x, b.y - a.y) <= DBL_CLICK_PX
  }

  function beginMarquee(e: KonvaEventObject<MouseEvent>) {
    // A stale suppress flag (mouseup off-stage) must not eat this gesture's click.
    suppressClick.current = false
    if (ui.tool !== 'select' || e.target !== stageRef.current) return
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
    const ids = scenario.entities
      .filter((en) => {
        const p = tracks.get(en.id)?.pos ?? en.pos
        return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1
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

  function handleClick(e: KonvaEventObject<MouseEvent>) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const onEmpty = e.target === stageRef.current
    const world = pointerWorld()
    if (!world) return
    const pointer = stageRef.current?.getPointerPosition()
    if (pointer) {
      lastClicks.current = [...lastClicks.current.slice(-1), { ...pointer, t: performance.now() }]
    }
    // The armed raid draft owns the next canvas click: it places the ingress
    // axis and commits the raid. This branch must stay ahead of the draw
    // tools or the click would land as a stray vertex.
    if (ui.raidDraft) {
      commitRaid(world)
      return
    }
    if (ui.tool === 'boundary' || ui.tool === 'path') {
      // The 2nd click of an in-place double-click is not a new vertex; the
      // dblclick handler finishes the shape instead.
      if (!isInPlacePair()) addDraftPoint(world)
      return
    }
    if (ui.tool === 'calibrate') {
      setCalibratePoint(world)
      return
    }
    if (onEmpty && ui.tool === 'select') clearSelection()
  }

  function handleDblClick() {
    // Konva pairs any two clicks inside its time window into a dblclick, even
    // far apart. Only a true in-place double-click finishes; rapid waypoint
    // clicks keep drawing.
    if (!isInPlacePair()) return
    if (ui.tool === 'boundary') finishBoundary(true)
    if (ui.tool === 'path') finishPath()
  }

  // A cancelled drag (Esc) may end without a leave; dragend on the source
  // window clears the cue regardless.
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

  const drawing = ui.tool !== 'select'

  return (
    <div
      ref={containerRef}
      className={`canvas-host ${ui.basemap} ${drawing ? 'drawing' : ''} ${dropActive ? 'drop-active' : ''}`}
      data-testid="canvas-host"
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
        const world = toWorld(screen)
        const modelId = e.dataTransfer.getData('text/rangeboard-model')
        const systemId = e.dataTransfer.getData('text/rangeboard-system')
        if (modelId) addEntityFromModel(modelId, world, screen)
        else if (systemId) addSystemFromPreset(systemId, world)
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
        draggable={ui.tool === 'select' && !modKey}
        onWheel={handleWheel}
        onClick={handleClick}
        onDblClick={handleDblClick}
        onContextMenu={handleContextMenu}
        onMouseDown={beginMarquee}
        onMouseUp={finishMarquee}
        onMouseMove={() => {
          const world = pointerWorld()
          setMouseWorld(world)
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
        <Layer listening={false}>
          <TileLayer size={size} />
        </Layer>
        <Layer listening={ui.moveUnderlay}>
          <UnderlayLayer />
        </Layer>
        <Layer listening={false}>
          <GridLayer size={size} />
        </Layer>
        <Layer>
          <BoundaryLayer />
          <FootprintLayer detections={detections} />
          <ThreatWezLayer tracks={tracks} impacts={impacts} />
          <RangeLayer />
          <PathLayer mouseWorld={mouseWorld} tracks={tracks} />
          <ConnectionLayer />
          <EngagementLayer shots={shots} simTimeS={simTimeS} />
          <EntityLayer
            tracks={tracks}
            detections={detections}
            spokeIds={spokeIds}
            trackStates={trackStates}
            effectorStates={effectorStates}
            simTimeS={simTimeS}
          />
          <SystemHandleLayer />
          <CalloutLayer placements={labelPlacements} />
          {marquee && (
            <Rect
              x={Math.min(marquee.a.x, marquee.b.x)}
              y={Math.min(marquee.a.y, marquee.b.y)}
              width={Math.abs(marquee.b.x - marquee.a.x)}
              height={Math.abs(marquee.b.y - marquee.a.y)}
              stroke="#a9b4bd"
              strokeWidth={1}
              dash={[4, 4]}
              strokeScaleEnabled={false}
              fill="rgba(169, 180, 189, 0.08)"
              listening={false}
            />
          )}
        </Layer>
      </Stage>
      {ui.basemap === 'sat' && scenario.geoRef && (
        <div className="tile-attribution">
          Imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics)
        </div>
      )}
      <HudLayer mouseWorld={mouseWorld} />
      <TrackFileReadout
        trackStates={trackStates}
        detections={detections}
        assessments={assessments}
        tracks={tracks}
        size={size}
      />
      <ContextMenu />
      <ConnectSuggestPopup />
    </div>
  )
}
