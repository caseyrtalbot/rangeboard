import { useRef } from 'react'
import { Circle, Group, Line } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useStore } from '../../state/store'
import { bearingDeg } from '../../geometry/geo'
import { useBoardInk } from '../useBoardInk'

const RING_PX = 48
const HANDLE_PX = 68
/** Fixed dash and point arrays: an inline literal is re-set on every render. */
const RING_DASH = [3, 4]
const ARM_DASH = [2, 3]
const ARM_POINTS = [0, -RING_PX, 0, -HANDLE_PX]

/**
 * Rotation control shown when a whole system (2+ entities sharing one
 * systemId) is selected. Dragging the handle slews every component's
 * position and facing about the system centroid.
 */
export function SystemHandleLayer() {
  const scenario = useStore((s) => s.scenario)
  const selectedIds = useStore((s) => s.selection.entityIds)
  const tool = useStore((s) => s.ui.tool)
  const scale = useStore((s) => s.camera.scale)
  const rotateSystem = useStore((s) => s.rotateSystem)
  const groupRef = useRef<Konva.Group>(null)
  const ink = useBoardInk()
  const lastBearing = useRef<number | null>(null)
  /** Slew accumulated over the gesture, committed once on release. */
  const totalDelta = useRef(0)

  if (tool !== 'select' || selectedIds.length < 2) return null
  const selected = scenario.entities.filter((e) => selectedIds.includes(e.id))
  const systemId = selected[0]?.systemId
  if (!systemId || !selected.every((e) => e.systemId === systemId)) return null

  const members = scenario.entities.filter((e) => e.systemId === systemId)
  const cx = members.reduce((sum, e) => sum + e.pos.x, 0) / members.length
  const cy = members.reduce((sum, e) => sum + e.pos.y, 0) / members.length
  const k = scale

  function pointerBearing(e: KonvaEventObject<DragEvent>): number | null {
    const pointer = e.target.getStage()?.getPointerPosition()
    if (!pointer) return null
    // Read, not subscribed: this layer redraws on a pan through the stage transform.
    const camera = useStore.getState().camera
    const world = {
      x: (pointer.x - camera.x) / camera.scale,
      y: (pointer.y - camera.y) / camera.scale,
    }
    return bearingDeg({ x: cx, y: cy }, world)
  }

  return (
    <Group ref={groupRef} x={cx} y={cy} scaleX={1 / k} scaleY={1 / k}>
      <Circle
        radius={RING_PX}
        stroke="#a9b4bd"
        strokeWidth={1}
        dash={RING_DASH}
        listening={false}
      />
      <Line
        points={ARM_POINTS}
        stroke="#a9b4bd"
        strokeWidth={1}
        dash={ARM_DASH}
        listening={false}
      />
      <Circle
        y={-HANDLE_PX}
        radius={7}
        fill="#a9b4bd"
        stroke={ink.knobRim}
        strokeWidth={1.5}
        draggable
        onDragStart={(e) => {
          lastBearing.current = pointerBearing(e)
          totalDelta.current = 0
        }}
        onDragMove={(e) => {
          const b = pointerBearing(e)
          if (b == null || lastBearing.current == null) return
          let delta = b - lastBearing.current
          if (delta > 180) delta -= 360
          if (delta < -180) delta += 360
          lastBearing.current = b
          totalDelta.current += delta
          // Preview on this group alone: a rotateSystem per pointer move would rerun
          // the picture and push an undo entry per frame.
          groupRef.current?.rotation(totalDelta.current)
          e.target.position({ x: 0, y: -HANDLE_PX })
        }}
        onDragEnd={(e) => {
          const delta = totalDelta.current
          lastBearing.current = null
          totalDelta.current = 0
          groupRef.current?.rotation(0)
          e.target.position({ x: 0, y: -HANDLE_PX })
          // One mutation, so the gesture is one undo entry.
          if (delta !== 0) rotateSystem(systemId!, delta)
        }}
      />
    </Group>
  )
}
