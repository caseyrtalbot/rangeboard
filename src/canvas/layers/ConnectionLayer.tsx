import { Arrow, Group, Text } from 'react-konva'
import { useStore } from '../../state/store'
import { dist } from '../../geometry/geo'

/** Kill-chain links between entities (sensor -> C2 -> effector). */
export function ConnectionLayer() {
  const scenario = useStore((s) => s.scenario)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selection.connectionId)
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  const tool = useStore((s) => s.ui.tool)
  const show = useStore((s) => s.ui.layers.connections)
  if (!show) return null

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
        // Medium shows how the link physically closes: wired solid, radio
        // dashed, operator-manual dotted; untyped links keep the legacy dash.
        const wired = c.medium === 'cable' || c.medium === 'fiber' || c.medium === 'serial'
        const dash = wired ? undefined : c.medium === 'operator-manual' ? [1, 4] : [3, 4]
        // Unproven evidence reads dimmer than documented or hand-drawn links.
        const dim = c.confidence === 'probable' || c.confidence === 'inferred'
        const color = selected ? '#ffffff' : dim ? '#6a7178' : '#8a9199'
        return (
          <Arrow
            key={c.id}
            points={[
              from.pos.x + ux * trim,
              from.pos.y + uy * trim,
              to.pos.x - ux * trim,
              to.pos.y - uy * trim,
            ]}
            stroke={color}
            fill={color}
            strokeWidth={1.5}
            dash={dash}
            strokeScaleEnabled={false}
            pointerLength={9 / k}
            pointerWidth={7 / k}
            // With strokeScaleEnabled=false the hit stroke is in screen px;
            // dividing by scale would inflate it to hundreds of px.
            hitStrokeWidth={12}
            // Wide hit bands must not swallow waypoint clicks while drawing.
            listening={tool === 'select'}
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
          // Counter-scaled group, so the label font size never changes and
          // Konva never re-measures the text on a zoom step.
          <Group
            key={`${c.id}-label`}
            x={(from.pos.x + to.pos.x) / 2}
            y={(from.pos.y + to.pos.y) / 2}
            scaleX={1 / k}
            scaleY={1 / k}
            listening={false}
          >
            <Text
              fontFamily="JetBrains Mono"
              y={-14}
              text={c.label}
              fontSize={10}
              fill="#8a9199"
              listening={false}
            />
          </Group>
        )
      })}
    </>
  )
}
