import { Circle, Group, Line, Path, Rect, RegularPolygon, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Entity } from '../../model/types'
import { entityActive } from '../../model/types'
import { useStore } from '../../state/store'
import { modelFor } from '../../model/scenario'
import { bearingDeg } from '../../geometry/geo'
import { memberPositions } from '../../playback/tracks'
import type { LiveTrack } from '../../playback/tracks'
import type { DetectionHit } from '../../playback/detection'
import { blinkOn, EW_JAM_COLOR, PHASE_STYLE } from '../../playback/trackState'
import { DANGER_INK, entityInk, EW_INK } from '../../ui/ink'
import type { EffectorLiveState, TrackFileState, TrackPhase } from '../../playback/trackState'
import {
  FRAME_EDGE,
  FRAME_FOR,
  FRAME_INK,
  FRIEND_FRAME_CX,
  FRIEND_FRAME_CY,
  FRIEND_FRAME_D,
  FUNCTION_LETTER,
} from '../../panels/Glyph'
import { boardDesignator, LABEL_ANCHOR_TOP, LABEL_LINE_H, labelLineCount } from '../labelLayout'

interface Props {
  tracks: Map<string, LiveTrack>
  /** Sensor sweep, snapped at the published sim time, keyed by UAS id. */
  detections: Map<string, DetectionHit[]>
  /** Entities whose labels render as spoke callouts in CalloutLayer instead. */
  spokeIds: Set<string>
  /** Track lifecycle, snapped at the published sim time, keyed by UAS id. */
  trackStates: Map<string, TrackFileState>
  /** Effector glyph treatment, snapped at the published sim time, keyed by effector id. */
  effectorStates: Map<string, EffectorLiveState>
  /**
   * The canvas frame clock's display time. Drives every pulse and the effector
   * blink; a paused run freezes it.
   */
  displayTimeS: number
}

/** Subtle darker edge that reads over any fill color. Shared with the palette. */
const EDGE = FRAME_EDGE

const GHOST = PHASE_STYLE.ghost.color
const JAM_CYAN = EW_JAM_COLOR
/** Out of rounds. Matches the 'bad' treatment the system panel gives EMPTY. */
const DEPLETED = DANGER_INK
/**
 * Destroyed-overlay ink. Bright enough to carry over the dimmed ghost group,
 * and not a phase color, so it never reads as another kill-chain rung.
 */
const DESTROYED = '#cfd4cc'

/**
 * A defeated track is quieter than a live one but never faint: the destroyed
 * strike, not the opacity, is what says the track is dead.
 */
const GHOST_OPACITY = 0.7

/**
 * Box units to px for FRIEND_FRAME_D: a 19.4 x 13.2 px symbol whose half
 * diagonal is 11.7 px, so RING_R (14), the hit disc (13) and BRACKET_HALF (19)
 * all still clear it.
 */
const FRIEND_SCALE = 2.2

/** Track ring radius. The glyph is r11, so the ring clears it. */
const RING_R = 14
/** Selection ring radius. It must stay outside the target brackets. */
const SELECT_R = 28
const BRACKET_HALF = 19
const BRACKET_ARM = 6
/** Jammed-diamond radius: clears the r14 ring, stays inside SELECT_R. */
const JAM_DIAMOND_R = 21
/** Gap under the wrapped name before the DEFEATED tag, px. */
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
  /** Defeated track: hollow dashed frame under a bold destroyed strike. */
  ghost?: boolean
  /** Effector only: false draws the friend frame as an outline. */
  filled?: boolean
}

/**
 * MIL-STD-2525 destroyed overlay: one bold strike across the frame, drawn
 * long enough to break out of it on both ends. It runs the opposite diagonal
 * to the inactive-entity slash, so a defeated track and a switched-off system
 * never read the same.
 */
function DestroyedStrike({ reach, width }: { reach: number; width: number }) {
  return (
    <Line
      points={[-reach, -reach, reach, reach]}
      stroke={DESTROYED}
      strokeWidth={width}
      strokeScaleEnabled={false}
      lineCap="round"
      listening={false}
    />
  )
}

/**
 * The friend affiliation frame plus its function letter. Both come from
 * panels/Glyph.tsx, so the canvas and the palette draw one shape and one
 * letter per kind. An outline frame carries its letter in the entity color,
 * because the dark board shows through the unfilled frame.
 */
function FriendFrame({ kind, color, filled }: { kind: Entity['kind']; color: string; filled: boolean }) {
  return (
    <>
      <Path
        data={FRIEND_FRAME_D}
        x={-FRIEND_FRAME_CX * FRIEND_SCALE}
        y={-FRIEND_FRAME_CY * FRIEND_SCALE}
        scaleX={FRIEND_SCALE}
        scaleY={FRIEND_SCALE}
        fill={filled ? color : undefined}
        stroke={filled ? EDGE : color}
        strokeWidth={filled ? 1 : 1.5}
        strokeScaleEnabled={false}
      />
      <Text
        fontFamily="JetBrains Mono"
        x={-9}
        y={-4.5}
        width={18}
        text={FUNCTION_LETTER[kind]}
        fontSize={9}
        fill={filled ? FRAME_INK : color}
        align="center"
      />
    </>
  )
}

/**
 * MIL-STD-2525 symbology, matching panels/Glyph.tsx: the FRAME carries
 * affiliation and an inner LETTER carries function.
 *   friend frame  - rounded-top rectangle: sensor S, c2 C2, effector E,
 *                   asset A. One blue-force frame, four readable functions.
 *   hostile frame - diamond: uas.
 *   neutral frame - hollow square with a centre dot: marker.
 * Heading ticks draw under the frame so only the protruding tip shows.
 */
function Glyph({ entity, color, ghost, filled = true }: GlyphProps) {
  switch (FRAME_FOR[entity.kind]) {
    case 'friend':
      // Guidance treatment: an idle or empty weapon is an outline, a weapon
      // holding the track is filled. Every other blue-force kind stays filled.
      return (
        <>
          {entity.kind === 'sensor' && (
            <Line points={[0, 0, 0, -16]} stroke={color} strokeWidth={2} rotation={entity.headingDeg} />
          )}
          <FriendFrame
            kind={entity.kind}
            color={color}
            filled={entity.kind === 'effector' ? filled : true}
          />
        </>
      )
    case 'hostile':
      return (
        <>
          <Line
            points={[0, 0, 0, -16]}
            stroke={ghost ? GHOST : color}
            strokeWidth={ghost ? 1.6 : 2}
            rotation={entity.headingDeg}
          />
          {ghost ? (
            <>
              <RegularPolygon sides={4} radius={11} stroke={GHOST} strokeWidth={1.7} dash={[3.5, 3]} />
              <DestroyedStrike reach={10} width={2.6} />
            </>
          ) : (
            <RegularPolygon sides={4} radius={11} fill={color} stroke={EDGE} strokeWidth={1} />
          )}
        </>
      )
    case 'neutral':
      return (
        <>
          <Rect
            x={-7}
            y={-7}
            width={14}
            height={14}
            stroke={color}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
          />
          <Circle radius={2} fill={color} />
        </>
      )
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
  displayTimeS,
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
  const color = entityInk(entity, modelFor(scenario, entity))
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
  // A defeated track carries the destroyed strike, so it draws no ring.
  const ringColor = ghost ? null : PHASE_STYLE[phase].color
  // Effective jamming holds on the track now (see TrackFileState.jammedNow).
  const jammed = !ghost && (state?.jammedNow ?? false)
  // An EW-only engagement swaps the target brackets for the jammed diamond;
  // a track also under kinetic or DE fire keeps its brackets as well.
  const ewOnly = state != null && state.kineticSalvos + state.deSalvos === 0
  const bracketed = (phase === 'targeted' || phase === 'engaged') && !(jammed && ewOnly)
  // Pulse floor is 0.5: a dimmed engaged track must stay legible.
  const pulse = phase === 'engaged' && !blinkOn(displayTimeS) ? 0.5 : 1
  const effectorState: EffectorLiveState = effectorStates.get(entity.id) ?? 'idle'
  const depleted = effectorState === 'depleted'
  const effectorFilled =
    effectorState === 'semi-active' ||
    effectorState === 'beam' ||
    (effectorState === 'active' && blinkOn(displayTimeS))

  const model = modelFor(scenario, entity)
  const sectorDeg =
    entity.kind === 'sensor'
      ? model?.sensor?.sectorDeg
      : entity.kind === 'effector'
        ? (model?.effector?.sectorDeg ?? 360)
        : undefined
  const directional = sectorDeg != null && sectorDeg < 360
  const members = entity.kind === 'uas' ? memberPositions(entity, pos, headingDeg) : [pos]
  // Konva hit-tests a stroke-only Circle over its whole disc. The selection
  // (r16) and card-link (r19) rings are cues, so the hit disc carries their radii.
  const hitR = cardLinked ? 19 : selected ? 16 : 13
  const labelDrawn = showLabels && !spokeIds.has(entity.id)
  // Board labels carry the short designator. Entity.name is untouched, so the
  // Inspector and the panels keep the full vendor string.
  const boardName = boardDesignator(entity.name)
  const labelLines = labelDrawn ? labelLineCount(boardName) : 0

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
            <>
              <RegularPolygon sides={4} radius={7} stroke={GHOST} strokeWidth={1.4} dash={[3, 2.5]} />
              <DestroyedStrike reach={6.5} width={1.8} />
            </>
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
        opacity={off ? 0.45 : ghost ? GHOST_OPACITY : 1}
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
          <Circle radius={32} stroke={EW_INK} strokeWidth={1.5} dash={[2, 3]} listening={false} />
        )}
        {connectFromId === entity.id && <Circle radius={16} stroke="#a9b4bd" strokeWidth={2} />}
        {bracketed &&
          BRACKETS.map((points, i) => (
            <Line
              key={i}
              points={points}
              stroke={ringColor ?? DANGER_INK}
              strokeWidth={1.6}
              opacity={pulse}
              listening={false}
            />
          ))}
        {ringColor && (
          <Circle radius={RING_R} stroke={ringColor} strokeWidth={1.6} opacity={pulse} listening={false} />
        )}
        <Glyph entity={heading} color={color} ghost={ghost} filled={effectorFilled} />
        {off && <Line points={[-11, 11, 11, -11]} stroke={DANGER_INK} strokeWidth={2} />}
        {entity.kind === 'uas' && (entity.formation?.count ?? 1) > 1 && (
          <Text fontFamily="JetBrains Mono" x={BRACKET_HALF + 2} y={-16} text={`x${entity.formation!.count}`} fontSize={10} fill={ghost ? GHOST : color} listening={false} />
        )}
        {jammed && (
          <>
            <RegularPolygon
              sides={4}
              radius={JAM_DIAMOND_R}
              stroke={JAM_CYAN}
              strokeWidth={1.6}
              listening={false}
            />
            <Text
              fontFamily="JetBrains Mono"
              x={JAM_DIAMOND_R * 0.62 + 3}
              y={-JAM_DIAMOND_R * 0.62 - 11}
              text="J"
              fontSize={10}
              fill={JAM_CYAN}
              listening={false}
            />
          </>
        )}
        {depleted && (
          <Text
            fontFamily="JetBrains Mono"
            x={13}
            y={-4}
            text="EMPTY"
            fontSize={9}
            fill={DEPLETED}
            listening={false}
          />
        )}
        {labelDrawn && (
          <Text fontFamily="JetBrains Mono"
            x={-60}
            y={LABEL_ANCHOR_TOP}
            width={120}
            text={boardName}
            fontSize={11}
            fill={ghost ? GHOST : '#b7bdb2'}
            align="center"
            listening={false}
          />
        )}
        {ghost && (
          <Text
            fontFamily="JetBrains Mono"
            x={-60}
            y={LABEL_ANCHOR_TOP + labelLines * LABEL_LINE_H + TAG_GAP}
            width={120}
            align="center"
            text={
              state?.eliminatedBySoft
                ? `${PHASE_STYLE.ghost.label} · MISSION KILL`
                : PHASE_STYLE.ghost.label
            }
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
              fontFamily="JetBrains Mono"
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
