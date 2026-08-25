import { Circle, Group, Line, Rect, RegularPolygon, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Entity } from '../../model/types'
import { entityActive } from '../../model/types'
import { useStore, modelFor } from '../../state/store'
import { bearingDeg } from '../../geometry/geo'
import { memberPositions } from '../../playback/sim'
import type { DetectionHit, LiveTrack } from '../../playback/sim'
import { blinkOn, PHASE_STYLE } from '../../playback/trackState'
import type { EffectorLiveState, TrackFileState, TrackPhase } from '../../playback/trackState'
import { LABEL_ANCHOR_TOP, LABEL_LINE_H, labelLineCount } from '../labelLayout'

interface Props {
  tracks: Map<string, LiveTrack>
  detections: Map<string, DetectionHit[]>
  /** Entities whose labels render as spoke callouts in CalloutLayer instead. */
  spokeIds: Set<string>
  /** Track lifecycle at the current sim time, keyed by UAS id. Built in CanvasStage. */
  trackStates: Map<string, TrackFileState>
  /** Effector glyph treatment at the current sim time, keyed by effector id. */
  effectorStates: Map<string, EffectorLiveState>
  /** Drives every pulse. A paused run freezes it. */
  simTimeS: number
}

const FALLBACK: Record<Entity['kind'], string> = {
  sensor: '#7da7c4',
  effector: '#c9975a',
  c2: '#d6d9d2',
  uas: '#c46a5a',
  asset: '#8fae7a',
  marker: '#b7bdb2',
}

/** Subtle darker edge that reads over any fill color. */
const EDGE = 'rgba(0, 0, 0, 0.35)'

const GHOST = PHASE_STYLE.ghost.color
const EW = '#7da7c4'

/** Track ring radius. The glyph is r11, so the ring clears it. */
const RING_R = 14
/** Selection ring radius. It must stay outside the target brackets. */
const SELECT_R = 28
const BRACKET_HALF = 19
const BRACKET_ARM = 6
/** Gap under the wrapped name before the GHOST tag, px. */
const TAG_GAP = 6

/** Four corner brackets of a target reticle, each an L of two segments. */
const BRACKETS: number[][] = [-1, 1].flatMap((sx) =>
  [-1, 1].map((sy) => {
    const cx = sx * BRACKET_HALF
    const cy = sy * BRACKET_HALF
    return [cx - sx * BRACKET_ARM, cy, cx, cy, cx, cy - sy * BRACKET_ARM]
  }),
)

interface GlyphProps {
  entity: Entity
  color: string
  /** Eliminated track: hollow dashed frame that keeps flying its course. */
  ghost?: boolean
  /** Effector only: false draws the 2525 frame as an outline. */
  filled?: boolean
}

/**
 * MIL-STD-2525-inspired affiliation frames, matching panels/Glyph.tsx:
 * rectangle = sensor/effector, circle = c2/asset, diamond = uas, square = marker.
 * Heading ticks draw under the frame so only the protruding tip shows.
 */
function Glyph({ entity, color, ghost, filled = true }: GlyphProps) {
  switch (entity.kind) {
    case 'sensor':
      return (
        <>
          <Line points={[0, 0, 0, -16]} stroke={color} strokeWidth={2} rotation={entity.headingDeg} />
          <Rect x={-10.5} y={-7} width={21} height={14} fill={color} stroke={EDGE} strokeWidth={1} />
        </>
      )
    case 'effector':
      // Guidance treatment: an idle weapon is an outline, a weapon holding the
      // track is filled. The frame stays a rectangle in both states.
      return (
        <Rect
          x={-10.5}
          y={-7}
          width={21}
          height={14}
          fill={filled ? color : undefined}
          stroke={color}
          strokeWidth={1.5}
        />
      )
    case 'c2':
      return (
        <>
          <Circle radius={9} fill={color} stroke={EDGE} strokeWidth={1} />
          <Text fontFamily="IBM Plex Mono" x={-8} y={-4} width={16} text="C2" fontSize={9} fill="#121415" align="center" />
        </>
      )
    case 'uas':
      return (
        <>
          <Line
            points={[0, 0, 0, -16]}
            stroke={ghost ? GHOST : color}
            strokeWidth={ghost ? 1.6 : 2}
            rotation={entity.headingDeg}
          />
          {ghost ? (
            <RegularPolygon sides={4} radius={11} stroke={GHOST} strokeWidth={1.7} dash={[3.5, 3]} />
          ) : (
            <RegularPolygon sides={4} radius={11} fill={color} stroke={EDGE} strokeWidth={1} />
          )}
        </>
      )
    case 'asset':
      return <Circle radius={9} fill={color} stroke={EDGE} strokeWidth={1} />
    case 'marker':
      return <Rect x={-5} y={-5} width={10} height={10} fill={color} stroke={EDGE} strokeWidth={1} />
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

function EntityNode({
  entity,
  tracks,
  detections,
  spokeIds,
  trackStates,
  effectorStates,
  simTimeS,
}: { entity: Entity } & Props) {
  const scenario = useStore((s) => s.scenario)
  const camera = useStore((s) => s.camera)
  const tool = useStore((s) => s.ui.tool)
  const connectFromId = useStore((s) => s.ui.connectFromId)
  const pathEntityId = useStore((s) => s.ui.pathEntityId)
  const showLabels = useStore((s) => s.ui.layers.labels)
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
  const openConnectSuggestion = useStore((s) => s.openConnectSuggestion)

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

  const state = trackStates.get(entity.id)
  // A UAS with no flight path never enters the timeline, so its ring falls
  // back to the render-time detection sweep.
  const phase: TrackPhase =
    entity.kind !== 'uas'
      ? 'undetected'
      : (state?.phase ?? (classified ? 'identified' : detected ? 'tracked' : 'undetected'))
  const ghost = phase === 'ghost'
  // A ghost reads through its hollow dashed glyph, so it draws no ring.
  const ringColor = ghost ? null : PHASE_STYLE[phase].color
  const bracketed = phase === 'targeted' || phase === 'engaged'
  // Pulse floor is 0.5: a dimmed engaged track must stay legible.
  const pulse = phase === 'engaged' && !blinkOn(simTimeS) ? 0.5 : 1
  const jammed = !ghost && state != null && state.jammedFraction >= 0.5
  const effectorState: EffectorLiveState = effectorStates.get(entity.id) ?? 'idle'
  const effectorFilled =
    effectorState === 'semi-active' ||
    effectorState === 'beam' ||
    (effectorState === 'active' && blinkOn(simTimeS))

  const model = modelFor(scenario, entity)
  const sectorDeg =
    entity.kind === 'sensor'
      ? model?.sensor?.sectorDeg
      : entity.kind === 'effector'
        ? (model?.effector?.sectorDeg ?? 360)
        : undefined
  const directional = sectorDeg != null && sectorDeg < 360
  const members = entity.kind === 'uas' ? memberPositions(entity, pos, headingDeg) : [pos]
  // Konva hit-tests a stroke-only Circle over its whole disc, so the old
  // listening selection (r16) and card-link (r19) rings enlarged the grab
  // area. Those rings are cues now, so the hit disc carries the same radii.
  const hitR = cardLinked ? 19 : selected ? 16 : 13
  const labelDrawn = showLabels && !spokeIds.has(entity.id)
  const labelLines = labelDrawn ? labelLineCount(entity.name) : 0

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
          {ghost ? (
            <RegularPolygon sides={4} radius={7} stroke={GHOST} strokeWidth={1.4} dash={[3, 2.5]} />
          ) : (
            <RegularPolygon sides={4} radius={7} fill={color} stroke={EDGE} strokeWidth={1} />
          )}
        </Group>
      ))}
      <Group
        x={pos.x}
        y={pos.y}
        scaleX={1 / k}
        scaleY={1 / k}
        opacity={off || ghost ? 0.45 : 1}
        draggable={tool === 'select'}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragStart={() => select({ entityIds: [entity.id] })}
        onDragEnd={(e) => {
          moveEntity(entity.id, { x: e.target.x(), y: e.target.y() })
          // A repositioned blue-force system gets fresh connect offers.
          if (entity.kind !== 'sensor' && entity.kind !== 'effector' && entity.kind !== 'c2') return
          const pointer = e.target.getStage()?.getPointerPosition()
          if (pointer) openConnectSuggestion(entity.id, pointer)
        }}
      >
        {/* Invisible hit disc: stroke-only glyphs are otherwise hard to click.
            It alone sets the grab area, because every ring below is a cue. */}
        <Circle radius={hitR} fill="#000" opacity={0} />
        {selected && (
          <Circle radius={SELECT_R} stroke="#ffffff" strokeWidth={1.3} dash={[4, 3]} listening={false} />
        )}
        {cardLinked && (
          <Circle radius={32} stroke={EW} strokeWidth={1.5} dash={[2, 3]} listening={false} />
        )}
        {connectFromId === entity.id && <Circle radius={16} stroke="#a9b4bd" strokeWidth={2} />}
        {bracketed &&
          BRACKETS.map((points, i) => (
            <Line
              key={i}
              points={points}
              stroke={ringColor ?? '#c4564a'}
              strokeWidth={1.6}
              opacity={pulse}
              listening={false}
            />
          ))}
        {ringColor && (
          <Circle radius={RING_R} stroke={ringColor} strokeWidth={1.6} opacity={pulse} listening={false} />
        )}
        <Glyph entity={heading} color={color} ghost={ghost} filled={effectorFilled} />
        {off && <Line points={[-11, 11, 11, -11]} stroke="#c4564a" strokeWidth={2} />}
        {entity.kind === 'uas' && (entity.formation?.count ?? 1) > 1 && (
          <Text fontFamily="IBM Plex Mono" x={BRACKET_HALF + 2} y={-16} text={`x${entity.formation!.count}`} fontSize={10} fill={ghost ? GHOST : color} listening={false} />
        )}
        {jammed && (
          <Text
            fontFamily="IBM Plex Mono"
            x={16}
            y={-4}
            text={`JAM ${state!.jammedFraction.toFixed(2)}`}
            fontSize={9}
            fill={EW}
            listening={false}
          />
        )}
        {labelDrawn && (
          <Text fontFamily="IBM Plex Mono"
            x={-60}
            y={LABEL_ANCHOR_TOP}
            width={120}
            text={entity.name}
            fontSize={11}
            fill={ghost ? GHOST : '#b7bdb2'}
            align="center"
            listening={false}
          />
        )}
        {ghost && (
          <Text
            fontFamily="IBM Plex Mono"
            x={-60}
            y={LABEL_ANCHOR_TOP + labelLines * LABEL_LINE_H + TAG_GAP}
            width={120}
            align="center"
            text={state?.eliminatedBySoft ? 'GHOST · MISSION KILL' : 'GHOST'}
            fontSize={9}
            fill={GHOST}
            listening={false}
          />
        )}
        {selected && directional && tool === 'select' && (
          <HeadingHandle entity={entity} pos={pos} color={color} />
        )}
        {selected && entity.kind === 'uas' && tool === 'select' && (
          <Group
            y={34}
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
              fill={entity.showRange ? '#a9b4bd' : '#1d2023'}
              stroke={entity.showRange ? '#a9b4bd' : '#82887e'}
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

export function EntityLayer(props: Props) {
  const entities = useStore((s) => s.scenario.entities)
  return (
    <>
      {entities.map((e) => (
        <EntityNode key={e.id} entity={e} {...props} />
      ))}
    </>
  )
}
