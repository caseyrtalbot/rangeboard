import { useRef } from 'react'
import { Circle, Group, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useStore } from '../../state/store'
import { bearingDeg } from '../../geometry/geo'

const RING_PX = 48
const HANDLE_PX = 68

/**
 * Rotation control shown when a whole system (2+ entities sharing one
 * systemId) is selected. Dragging the handle slews every component's
 * position and facing about the system centroid.
 */
export function SystemHandleLayer() {
  const scenario = useStore((s) => s.scenario)
  const selectedIds = useStore((s) => s.selection.entityIds)
  const tool = useStore((s) => s.ui.tool)
  const camera = useStore((s) => s.camera)
  const rotateSystem = useStore((s) => s.rotateSystem)
  const lastBearing = useRef<number | null>(null)

  if (tool !== 'select' || selectedIds.length < 2) return null
  const selected = scenario.entities.filter((e) => selectedIds.includes(e.id))
  const systemId = selected[0]?.systemId
  if (!systemId || !selected.every((e) => e.systemId === systemId)) return null

  const members = scenario.entities.filter((e) => e.systemId === systemId)
  const cx = members.reduce((sum, e) => sum + e.pos.x, 0) / members.length
  const cy = members.reduce((sum, e) => sum + e.pos.y, 0) / members.length
  const k = camera.scale

  function pointerBearing(e: KonvaEventObject<DragEvent>): number | null {
    const pointer = e.target.getStage()?.getPointerPosition()
    if (!pointer) return null
    const world = {
      x: (pointer.x - camera.x) / camera.scale,
      y: (pointer.y - camera.y) / camera.scale,
    }
    return bearingDeg({ x: cx, y: cy }, world)
  }

  return (
    <Group x={cx} y={cy} scaleX={1 / k} scaleY={1 / k}>
      <Circle radius={RING_PX} stroke="#a9b4bd" strokeWidth={1} dash={[3, 4]} listening={false} />
      <Line points={[0, -RING_PX, 0, -HANDLE_PX]} stroke="#a9b4bd" strokeWidth={1} dash={[2, 3]} listening={false} />
      <Circle
        y={-HANDLE_PX}
        radius={7}
        fill="#a9b4bd"
        stroke="#121415"
        strokeWidth={1.5}
        draggable
        onDragStart={(e) => {
          lastBearing.current = pointerBearing(e)
        }}
        onDragMove={(e) => {
          const b = pointerBearing(e)
          if (b == null || lastBearing.current == null) return
          let delta = b - lastBearing.current
          if (delta > 180) delta -= 360
          if (delta < -180) delta += 360
          if (delta !== 0) rotateSystem(systemId!, delta)
          lastBearing.current = b
        }}
        onDragEnd={(e) => {
          lastBearing.current = null
          e.target.position({ x: 0, y: -HANDLE_PX })
        }}
      />
    </Group>
  )
}
