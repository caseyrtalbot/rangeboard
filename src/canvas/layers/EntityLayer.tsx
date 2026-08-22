import { Circle, Group, Line, Rect, RegularPolygon, Star, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Entity } from '../../model/types'
import { entityActive } from '../../model/types'
import { useStore, modelFor } from '../../state/store'
import { bearingDeg } from '../../geometry/geo'
import { memberPositions } from '../../playback/sim'
import type { DetectionHit, LiveTrack } from '../../playback/sim'

interface Props {
  tracks: Map<string, LiveTrack>
  detections: Map<string, DetectionHit[]>
  /** Entities whose labels render as spoke callouts in CalloutLayer instead. */
  spokeIds: Set<string>
}

const FALLBACK: Record<Entity['kind'], string> = {
  sensor: '#7da7c4',
  effector: '#c9975a',
  c2: '#d6d9d2',
  uas: '#c46a5a',
  asset: '#8fae7a',
  marker: '#b7bdb2',
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
          <Text fontFamily="IBM Plex Mono" x={-8} y={-5} width={16} text="C2" fontSize={9} fill={color} align="center" />
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

/** Drag handle that points a directional sensor/effector. Child drag does not move the group. */
function HeadingHandle({ entity, pos, color }: { entity: Entity; pos: { x: number; y: number }; color: string }) {
  const updateEntity = useStore((s) => s.updateEntity)
  const camera = useStore((s) => s.camera)
  const r = (entity.headingDeg * Math.PI) / 180
  const hx = Math.sin(r) * 34
  const hy = -Math.cos(r) * 34

  function headingFromPointer(e: KonvaEventObject<DragEvent>): number | null {
    const pointer = e.target.getStage()?.getPointerPosition()
    if (!pointer) return null
    const world = {
      x: (pointer.x - camera.x) / camera.scale,
      y: (pointer.y - camera.y) / camera.scale,
    }
    return Math.round(bearingDeg(pos, world))
  }

  return (
    <Group>
      <Line points={[0, 0, hx, hy]} stroke={color} strokeWidth={1} dash={[2, 3]} />
      <Circle
        x={hx}
        y={hy}
        radius={6}
        fill={color}
        stroke="#121415"
        strokeWidth={1.5}
        draggable
        onDragMove={(e) => {
          const h = headingFromPointer(e)
          if (h != null) updateEntity(entity.id, { headingDeg: h % 360 })
        }}
        onDragEnd={(e) => {
          e.target.position({ x: hx, y: hy })
        }}
      />
    </Group>
  )
}

function EntityNode({ entity, tracks, detections, spokeIds }: { entity: Entity } & Props) {
  const scenario = useStore((s) => s.scenario)
  const camera = useStore((s) => s.camera)
  const tool = useStore((s) => s.ui.tool)
  const connectFromId = useStore((s) => s.ui.connectFromId)
  const pathEntityId = useStore((s) => s.ui.pathEntityId)
  const selected = useStore((s) => s.selection.entityIds.includes(entity.id))
  const cardLinked = useStore((s) => {
    const cardId = s.selection.cardId
    if (!cardId) return false
    const card = s.scenario.testCards.find((c) => c.id === cardId)
    return card?.linkedEntityIds.includes(entity.id) ?? false
  })
  const select = useStore((s) => s.select)
  const moveEntity = useStore((s) => s.moveEntity)
  const updateEntity = useStore((s) => s.updateEntity)
  const beginConnect = useStore((s) => s.beginConnect)
  const completeConnect = useStore((s) => s.completeConnect)
  const beginPath = useStore((s) => s.beginPath)
  const openContextMenu = useStore((s) => s.openContextMenu)

  const k = camera.scale
  const track = tracks.get(entity.id)
  const pos = track?.pos ?? entity.pos
  const headingDeg = track?.headingDeg ?? entity.headingDeg
  const heading = track ? { ...entity, headingDeg: track.headingDeg } : entity
  const off = !entityActive(entity)
  const color = entity.color ?? modelFor(scenario, entity)?.color ?? FALLBACK[entity.kind]
  const hits = detections.get(entity.id) ?? []
  const detected = hits.length > 0
  const classified = hits.some((h) => h.classified)

  const model = modelFor(scenario, entity)
  const sectorDeg =
    entity.kind === 'sensor'
      ? model?.sensor?.sectorDeg
      : entity.kind === 'effector'
        ? (model?.effector?.sectorDeg ?? 360)
        : undefined
  const directional = sectorDeg != null && sectorDeg < 360
  const members = entity.kind === 'uas' ? memberPositions(entity, pos, headingDeg) : [pos]

  function handleClick(e: KonvaEventObject<MouseEvent>) {
    if (tool === 'connect') {
      e.cancelBubble = true
      if (!connectFromId) beginConnect(entity.id)
      else completeConnect(entity.id)
      return
    }
    if (tool === 'path') {
      // A UAS click starts its path only before drafting. Any other click
      // during a draft must bubble to the stage and become a waypoint.
      if (entity.kind === 'uas' && !pathEntityId) {
        e.cancelBubble = true
        beginPath(entity.id)
      }
      return
    }
    // Boundary and calibrate clicks bubble to the stage as draw points.
    if (tool !== 'select') return
    // An armed raid draft owns the next canvas click: let it bubble to the
    // stage so the ingress axis places even when the click lands on an entity
    // (clicking the target asset is the natural aim gesture).
    if (useStore.getState().ui.raidDraft) return
    e.cancelBubble = true
    select({ entityIds: [entity.id] }, e.evt.shiftKey)
  }

  function handleContextMenu(e: KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault()
    e.cancelBubble = true
    // Ctrl+left-click also fires contextmenu on macOS; menu is right-button only.
    if (e.evt.button !== 2) return
    const pointer = e.target.getStage()?.getPointerPosition()
    if (!pointer) return
    const world = { x: (pointer.x - camera.x) / camera.scale, y: (pointer.y - camera.y) / camera.scale }
    select({ entityIds: [entity.id] })
    openContextMenu(pointer, world, entity.id)
  }

  return (
    <>
      {members.slice(1).map((m, i) => (
        <Group key={i} x={m.x} y={m.y} scaleX={1 / k} scaleY={1 / k} listening={false} opacity={off ? 0.3 : 0.75}>
          <RegularPolygon sides={3} radius={6} fill={color} rotation={headingDeg} scaleY={1.4} />
        </Group>
      ))}
      <Group
        x={pos.x}
        y={pos.y}
        scaleX={1 / k}
        scaleY={1 / k}
        opacity={off ? 0.45 : 1}
        draggable={tool === 'select'}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragStart={() => select({ entityIds: [entity.id] })}
        onDragEnd={(e) => moveEntity(entity.id, { x: e.target.x(), y: e.target.y() })}
      >
        {/* Invisible hit disc: stroke-only glyphs are otherwise hard to click. */}
        <Circle radius={13} fill="#000" opacity={0} />
        {selected && <Circle radius={16} stroke="#ffffff" strokeWidth={1.5} dash={[4, 3]} />}
        {cardLinked && <Circle radius={19} stroke="#7da7c4" strokeWidth={1.5} dash={[2, 3]} />}
        {connectFromId === entity.id && <Circle radius={16} stroke="#d9a441" strokeWidth={2} />}
        {detected && entity.kind === 'uas' && (
          <Circle radius={13} stroke={classified ? '#c4564a' : '#d9a441'} strokeWidth={2} />
        )}
        <Glyph entity={heading} color={color} />
        {off && <Line points={[-11, 11, 11, -11]} stroke="#c4564a" strokeWidth={2} />}
        {entity.kind === 'uas' && (entity.formation?.count ?? 1) > 1 && (
          <Text fontFamily="IBM Plex Mono" x={10} y={-16} text={`x${entity.formation!.count}`} fontSize={10} fill={color} listening={false} />
        )}
        {!spokeIds.has(entity.id) && (
          <Text fontFamily="IBM Plex Mono"
            x={-60}
            y={14}
            width={120}
            text={entity.name}
            fontSize={11}
            fill="#b7bdb2"
            align="center"
            listening={false}
          />
        )}
        {selected && directional && tool === 'select' && (
          <HeadingHandle entity={entity} pos={pos} color={color} />
        )}
        {selected && entity.kind === 'uas' && tool === 'select' && (
          <Group
            y={28}
            onClick={(e) => {
              e.cancelBubble = true
              updateEntity(entity.id, { showRange: !entity.showRange })
            }}
          >
            <Rect
              x={-34}
              width={68}
              height={16}
              cornerRadius={8}
              fill={entity.showRange ? '#d9a441' : '#1d2023'}
              stroke={entity.showRange ? '#d9a441' : '#82887e'}
              strokeWidth={1}
            />
            <Text
              fontFamily="IBM Plex Mono"
              x={-34}
              y={4}
              width={68}
              align="center"
              text={entity.showRange ? 'RANGE ON' : 'RANGE OFF'}
              fontSize={9}
              fill={entity.showRange ? '#121415' : '#82887e'}
              listening={false}
            />
          </Group>
        )}
      </Group>
    </>
  )
}

export function EntityLayer({ tracks, detections, spokeIds }: Props) {
  const entities = useStore((s) => s.scenario.entities)
  return (
    <>
      {entities.map((e) => (
        <EntityNode key={e.id} entity={e} tracks={tracks} detections={detections} spokeIds={spokeIds} />
      ))}
    </>
  )
}
