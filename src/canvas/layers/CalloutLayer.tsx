import { selectEffectiveLayers } from '../../state/selectors'
import { memo, useMemo } from 'react'
import { Circle, Group, Line, Text } from 'react-konva'
import type { Entity } from '../../model/types'
import { entityActive } from '../../model/types'
import { useStore } from '../../state/store'
import { boardDesignator, LABEL_FONT_PX, LABEL_HALO_PX } from '../labelLayout'
import type { LabelPlacement, SpokePlacement } from '../labelLayout'
import { useBoardInk } from '../useBoardInk'

interface Props {
  placements: Map<string, LabelPlacement>
}

/**
 * One spoke callout. Memoized on the entity and its placement object, which LiveScene
 * keeps identity-stable while the placement does not move.
 */
const Callout = memo(function Callout({ entity, p }: { entity: Entity; p: SpokePlacement }) {
  const drawn = useMemo(() => boardDesignator(entity.name), [entity.name])
  const ink = useBoardInk()
  return (
    <Group opacity={entityActive(entity) ? 1 : 0.45}>
      <Line points={p.points} stroke={ink.calloutLeader} strokeWidth={1} />
      <Circle x={p.points[0]} y={p.points[1]} radius={1.8} fill={ink.calloutLeader} />
      <Text
        fontFamily="JetBrains Mono"
        x={p.tx}
        y={p.ty}
        width={p.width}
        text={drawn}
        fontSize={LABEL_FONT_PX}
        fill={ink.label}
        // The same glyph halo as an anchored name, so a tint or a leader stays legible.
        stroke={ink.board}
        strokeWidth={LABEL_HALO_PX}
        lineJoin="round"
        fillAfterStrokeEnabled
        align={p.align}
        wrap="none"
      />
    </Group>
  )
})

/**
 * Spoke callouts for entity labels that would overlap at the current zoom. The group
 * inverts the stage transform, so every placement coordinate is screen px. The text
 * is the short board designator layoutLabels measured.
 */
export const CalloutLayer = memo(function CalloutLayer({ placements }: Props) {
  const entities = useStore((s) => s.scenario.entities)
  const camera = useStore((s) => s.camera)
  const show = useStore((s) => selectEffectiveLayers(s).labels)
  if (!show) return null
  const k = camera.scale
  return (
    <Group x={-camera.x / k} y={-camera.y / k} scaleX={1 / k} scaleY={1 / k} listening={false}>
      {entities.map((e) => {
        const p = placements.get(e.id)
        if (p?.mode !== 'spoke') return null
        return <Callout key={e.id} entity={e} p={p} />
      })}
    </Group>
  )
})
