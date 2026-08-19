import { Arrow, Text } from 'react-konva'
import { useStore } from '../../state/store'
import { dist } from '../../geometry/geo'

/** Kill-chain links between entities (sensor -> C2 -> effector). */
export function ConnectionLayer() {
  const scenario = useStore((s) => s.scenario)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selection.connectionId)
  const camera = useStore((s) => s.camera)
  const k = camera.scale

  return (
    <>
      {scenario.connections.map((c) => {
        const from = scenario.entities.find((e) => e.id === c.fromId)
        const to = scenario.entities.find((e) => e.id === c.toId)
        if (!from || !to) return null
        const d = dist(from.pos, to.pos)
        if (d < 1) return null
        // Trim both ends so arrows do not sit on top of the icons.
        const trim = Math.min(16 / k, d / 3)
        const ux = (to.pos.x - from.pos.x) / d
        const uy = (to.pos.y - from.pos.y) / d
        const selected = selectedId === c.id
        return (
          <Arrow
            key={c.id}
            points={[
              from.pos.x + ux * trim,
              from.pos.y + uy * trim,
              to.pos.x - ux * trim,
              to.pos.y - uy * trim,
            ]}
            stroke={selected ? '#ffffff' : '#8a9199'}
            fill={selected ? '#ffffff' : '#8a9199'}
            strokeWidth={1.5}
            dash={[3, 4]}
            strokeScaleEnabled={false}
            pointerLength={9 / k}
            pointerWidth={7 / k}
            hitStrokeWidth={12 / k}
            onClick={(e) => {
              e.cancelBubble = true
              select({ connectionId: c.id })
            }}
          />
        )
      })}
      {scenario.connections.map((c) => {
        if (!c.label) return null
        const from = scenario.entities.find((e) => e.id === c.fromId)
        const to = scenario.entities.find((e) => e.id === c.toId)
        if (!from || !to) return null
        return (
          <Text fontFamily="IBM Plex Mono"
            key={`${c.id}-label`}
            x={(from.pos.x + to.pos.x) / 2}
            y={(from.pos.y + to.pos.y) / 2 - 14 / k}
            text={c.label}
            fontSize={10 / k}
            fill="#8a9199"
            listening={false}
          />
        )
      })}
    </>
  )
}
