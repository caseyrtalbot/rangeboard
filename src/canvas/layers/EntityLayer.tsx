import { Circle, Group, Line, Rect, RegularPolygon, Star, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Entity } from '../../model/types'
import { useStore, modelFor } from '../../state/store'
import type { DetectionHit, LiveTrack } from '../../playback/sim'

interface Props {
  tracks: Map<string, LiveTrack>
  detections: Map<string, DetectionHit[]>
}

const FALLBACK: Record<Entity['kind'], string> = {
  sensor: '#4fa3ff',
  effector: '#ff7a5c',
  c2: '#e0e6f0',
  uas: '#ff5c74',
  asset: '#7dff8a',
  marker: '#c9d2e0',
}

function Glyph({ entity, color }: { entity: Entity; color: string }) {
  switch (entity.kind) {
    case 'sensor':
      return (
        <>
          <Circle radius={9} stroke={color} strokeWidth={2} />
          <Circle radius={2.5} fill={color} />
          <Line points={[0, -9, 0, -15]} stroke={color} strokeWidth={2} rotation={entity.headingDeg} />
        </>
      )
    case 'effector':
      return <RegularPolygon sides={4} radius={10} stroke={color} strokeWidth={2} />
    case 'c2':
      return (
        <>
          <Rect x={-8} y={-8} width={16} height={16} stroke={color} strokeWidth={2} />
          <Text x={-8} y={-5} width={16} text="C2" fontSize={9} fill={color} align="center" />
        </>
      )
    case 'uas':
      return (
        <RegularPolygon
          sides={3}
          radius={9}
          fill={color}
          rotation={entity.headingDeg}
          scaleY={1.4}
        />
      )
    case 'asset':
      return <Star numPoints={5} innerRadius={4.5} outerRadius={10} fill={color} />
    case 'marker':
      return <Circle radius={5} fill={color} />
  }
}

function EntityNode({ entity, tracks, detections }: { entity: Entity } & Props) {
  const scenario = useStore((s) => s.scenario)
  const camera = useStore((s) => s.camera)
  const tool = useStore((s) => s.ui.tool)
  const connectFromId = useStore((s) => s.ui.connectFromId)
  const selected = useStore((s) => s.selection.entityIds.includes(entity.id))
  const cardLinked = useStore((s) => {
    const cardId = s.selection.cardId
    if (!cardId) return false
    const card = s.scenario.testCards.find((c) => c.id === cardId)
    return card?.linkedEntityIds.includes(entity.id) ?? false
  })
  const select = useStore((s) => s.select)
  const moveEntity = useStore((s) => s.moveEntity)
  const beginConnect = useStore((s) => s.beginConnect)
  const completeConnect = useStore((s) => s.completeConnect)
  const beginPath = useStore((s) => s.beginPath)

  const k = camera.scale
  const track = tracks.get(entity.id)
  const pos = track?.pos ?? entity.pos
  const heading = track ? { ...entity, headingDeg: track.headingDeg } : entity
  const color = entity.color ?? modelFor(scenario, entity)?.color ?? FALLBACK[entity.kind]
  const hits = detections.get(entity.id) ?? []
  const detected = hits.length > 0
  const classified = hits.some((h) => h.classified)

  function handleClick(e: KonvaEventObject<MouseEvent>) {
    e.cancelBubble = true
    if (tool === 'connect') {
      if (!connectFromId) beginConnect(entity.id)
      else completeConnect(entity.id)
      return
    }
    if (tool === 'path' && entity.kind === 'uas') {
      beginPath(entity.id)
      return
    }
    select({ entityIds: [entity.id] }, e.evt.shiftKey)
  }

  return (
    <Group
      x={pos.x}
      y={pos.y}
      scaleX={1 / k}
      scaleY={1 / k}
      draggable={tool === 'select'}
      onClick={handleClick}
      onDragStart={() => select({ entityIds: [entity.id] })}
      onDragEnd={(e) => moveEntity(entity.id, { x: e.target.x(), y: e.target.y() })}
    >
      {selected && <Circle radius={16} stroke="#ffffff" strokeWidth={1.5} dash={[4, 3]} />}
      {cardLinked && <Circle radius={19} stroke="#6fd3ff" strokeWidth={1.5} dash={[2, 3]} />}
      {connectFromId === entity.id && <Circle radius={16} stroke="#ffd166" strokeWidth={2} />}
      {detected && entity.kind === 'uas' && (
        <Circle radius={13} stroke={classified ? '#ff4d4d' : '#ffd166'} strokeWidth={2} />
      )}
      <Glyph entity={heading} color={color} />
      <Text
        x={-60}
        y={14}
        width={120}
        text={entity.name}
        fontSize={11}
        fill="#c9d2e0"
        align="center"
        listening={false}
      />
    </Group>
  )
}

export function EntityLayer({ tracks, detections }: Props) {
  const entities = useStore((s) => s.scenario.entities)
  return (
    <>
      {entities.map((e) => (
        <EntityNode key={e.id} entity={e} tracks={tracks} detections={detections} />
      ))}
    </>
  )
}
