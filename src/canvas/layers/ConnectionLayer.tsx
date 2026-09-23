import { selectEffectiveLayers } from '../../state/selectors'
import { Arrow, Group, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useStore } from '../../state/store'
import { dist } from '../../geometry/geo'
import { BOARD_INK_DARK } from '../../ui/ink'
import { useBoardInk } from '../useBoardInk'
import { captionClear } from '../labelLayout'

/**
 * A hover shows a hidden caption on its Konva node alone, so it re-renders no layer.
 * The node keeps its layout verdict in the `shown` attribute.
 */
function hoverCaption(e: KonvaEventObject<MouseEvent>, id: string) {
  const node = e.target.getLayer()?.findOne('.cap' + id)
  node?.visible(e.type === 'mouseenter' || node.getAttr('shown'))
}

/** Kill-chain links between entities (sensor -> C2 -> effector). */
export function ConnectionLayer() {
  const scenario = useStore((s) => s.scenario)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selection.connectionId)
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  const tool = useStore((s) => s.ui.tool)
  const show = useStore((s) => selectEffectiveLayers(s).connections)
  const ink = useBoardInk()
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
        // Medium: wired solid, radio dashed, operator-manual dotted; untyped keeps
        // the legacy dash.
        const wired = c.medium === 'cable' || c.medium === 'fiber' || c.medium === 'serial'
        const dash = wired ? undefined : c.medium === 'operator-manual' ? [1, 4] : [3, 4]
        // Unproven evidence reads dimmer than documented or hand-drawn links.
        const dim = c.confidence === 'probable' || c.confidence === 'inferred'
        const onHover = (e: KonvaEventObject<MouseEvent>) => hoverCaption(e, c.id)
        // A selected link on the night board keeps its white, a step above text 1.
        const color = selected
          ? ink === BOARD_INK_DARK
            ? '#ffffff'
            : ink.selection
          : dim
            ? '#6a7178'
            : ink.linkCaption
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
            // With strokeScaleEnabled=false the hit stroke is already in screen px.
            hitStrokeWidth={12}
            // Wide hit bands must not swallow waypoint clicks while drawing.
            listening={tool === 'select'}
            onClick={(e) => {
              e.cancelBubble = true
              select({ connectionId: c.id })
            }}
            onMouseEnter={onHover}
            onMouseLeave={onHover}
          />
        )
      })}
      {scenario.connections.map((c) => {
        if (!c.label) return null
        const from = scenario.entities.find((e) => e.id === c.fromId)
        const to = scenario.entities.find((e) => e.id === c.toId)
        if (!from || !to) return null
        const x = (from.pos.x + to.pos.x) / 2
        const y = (from.pos.y + to.pos.y) / 2
        // A link under 80 screen px, or a caption on a glyph or a label, captions on hover.
        const shown =
          dist(from.pos, to.pos) * k >= 80 &&
          captionClear(x * k, y * k - 14, c.label, scenario.entities, k)
        return (
          // Counter-scaled group, so Konva never re-measures the text on a zoom step.
          <Group
            key={`${c.id}-label`}
            name={'cap' + c.id}
            shown={shown}
            visible={shown}
            x={x}
            y={y}
            scaleX={1 / k}
            scaleY={1 / k}
            listening={false}
          >
            <Text
              fontFamily="JetBrains Mono"
              y={-14}
              text={c.label}
              fontSize={11}
              fill={ink.linkCaption}
              listening={false}
            />
          </Group>
        )
      })}
    </>
  )
}
