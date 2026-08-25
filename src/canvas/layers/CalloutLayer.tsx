import { Circle, Group, Line, Text } from 'react-konva'
import { entityActive } from '../../model/types'
import { useStore } from '../../state/store'
import { LABEL_FONT_PX } from '../labelLayout'
import type { LabelPlacement } from '../labelLayout'

interface Props {
  placements: Map<string, LabelPlacement>
}

/**
 * Spoke callouts for entity labels that would overlap at the current zoom.
 * Rendered in screen space: the group inverts the stage transform, so all
 * placement coordinates are pixels.
 */
export function CalloutLayer({ placements }: Props) {
  const entities = useStore((s) => s.scenario.entities)
  const camera = useStore((s) => s.camera)
  const show = useStore((s) => s.ui.layers.labels)
  if (!show) return null
  const k = camera.scale
  return (
    <Group x={-camera.x / k} y={-camera.y / k} scaleX={1 / k} scaleY={1 / k} listening={false}>
      {entities.map((e) => {
        const p = placements.get(e.id)
        if (p?.mode !== 'spoke') return null
        return (
          <Group key={e.id} opacity={entityActive(e) ? 1 : 0.45}>
            <Line points={p.points} stroke="#82887e" strokeWidth={1} />
            <Circle x={p.points[0]} y={p.points[1]} radius={1.8} fill="#82887e" />
            <Text
              fontFamily="IBM Plex Mono"
              x={p.tx}
              y={p.ty}
              width={p.width}
              text={e.name}
              fontSize={LABEL_FONT_PX}
              fill="#b7bdb2"
              align={p.align}
              wrap="none"
            />
          </Group>
        )
      })}
    </Group>
  )
}
