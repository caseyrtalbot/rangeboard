import { useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Stage } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Vec2 } from '../model/types'
import { useStore } from '../state/store'
import { detectionsAt, liveTracks } from '../playback/sim'
import { GridLayer } from './layers/GridLayer'
import { UnderlayLayer } from './layers/UnderlayLayer'
import { BoundaryLayer } from './layers/BoundaryLayer'
import { FootprintLayer } from './layers/FootprintLayer'
import { PathLayer } from './layers/PathLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'
import { EntityLayer } from './layers/EntityLayer'
import { HudLayer } from './layers/HudLayer'
import { ContextMenu } from './ContextMenu'

const MIN_SCALE = 0.0005
const MAX_SCALE = 20

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [mouseWorld, setMouseWorld] = useState<Vec2 | null>(null)

  const scenario = useStore((s) => s.scenario)
  const camera = useStore((s) => s.camera)
  const setCamera = useStore((s) => s.setCamera)
  const ui = useStore((s) => s.ui)
  const simTimeS = useStore((s) => s.playback.simTimeS)
  const clearSelection = useStore((s) => s.clearSelection)
  const addEntityFromModel = useStore((s) => s.addEntityFromModel)
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

  const tracks = useMemo(() => liveTracks(scenario, simTimeS), [scenario, simTimeS])
  const detections = useMemo(() => detectionsAt(scenario, simTimeS), [scenario, simTimeS])

  function toWorld(pointer: Vec2): Vec2 {
    return { x: (pointer.x - camera.x) / camera.scale, y: (pointer.y - camera.y) / camera.scale }
  }

  function pointerWorld(): Vec2 | null {
    const pointer = stageRef.current?.getPointerPosition()
    return pointer ? toWorld(pointer) : null
  }

  function handleContextMenu(e: KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault()
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

  function handleClick(e: KonvaEventObject<MouseEvent>) {
    const onEmpty = e.target === stageRef.current
    const world = pointerWorld()
    if (!world) return
    if (ui.tool === 'boundary' || ui.tool === 'path') {
      addDraftPoint(world)
      return
    }
    if (ui.tool === 'calibrate') {
      setCalibratePoint(world)
      return
    }
    if (onEmpty && ui.tool === 'select') clearSelection()
  }

  function handleDblClick() {
    if (ui.tool === 'boundary') finishBoundary(true)
    if (ui.tool === 'path') finishPath()
  }

  const drawing = ui.tool !== 'select'

  return (
    <div
      ref={containerRef}
      className={`canvas-host ${ui.basemap} ${drawing ? 'drawing' : ''}`}
      data-testid="canvas-host"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const world = toWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        const modelId = e.dataTransfer.getData('text/rangeboard-model')
        const systemId = e.dataTransfer.getData('text/rangeboard-system')
        if (modelId) addEntityFromModel(modelId, world)
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
        draggable={ui.tool === 'select'}
        onWheel={handleWheel}
        onClick={handleClick}
        onDblClick={handleDblClick}
        onContextMenu={handleContextMenu}
        onMouseMove={() => setMouseWorld(pointerWorld())}
        onDragStart={(e) => {
          if (e.target === stageRef.current) closeContextMenu()
        }}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setCamera({ ...camera, x: e.target.x(), y: e.target.y() })
          }
        }}
      >
        <Layer listening={ui.moveUnderlay}>
          <UnderlayLayer />
        </Layer>
        <Layer listening={false}>
          <GridLayer size={size} />
        </Layer>
        <Layer>
          <BoundaryLayer />
          <FootprintLayer detections={detections} />
          <PathLayer mouseWorld={mouseWorld} tracks={tracks} />
          <ConnectionLayer />
          <EntityLayer tracks={tracks} detections={detections} />
        </Layer>
      </Stage>
      <HudLayer mouseWorld={mouseWorld} />
      <ContextMenu />
    </div>
  )
}
