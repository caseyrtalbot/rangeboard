import { selectEffectiveLayers } from '../../state/selectors'
import { memo, useMemo, useRef } from 'react'
import { Circle, Group, Line, Path, Rect, RegularPolygon, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Entity, SpecModel } from '../../model/types'
import { entityActive } from '../../model/types'
import { useStore } from '../../state/store'
import { modelFor } from '../../model/scenario'
import { bearingDeg } from '../../geometry/geo'
import { memberPositions } from '../../playback/tracks'
import type { LiveTrack } from '../../playback/tracks'
import type { TrialSweep } from '../../playback/trialSweepAt'
import type { TrialMemberState } from '../../playback/trialTrackState'
import type { TrialTelemetryState } from '../../panels/analysis/threatReadout'
import { EW_JAM_COLOR, PHASE_STYLE } from '../../playback/trackState'
import { DANGER_INK, entityInk, EW_INK } from '../../ui/ink'
import { useBoardInk } from '../useBoardInk'
import type { EffectorLiveState, TrackPhase } from '../../playback/trackState'
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
import { IDLE_INTERACTION, routeInteraction } from '../interactionRouter'

interface Props {
  tracks: Map<string, LiveTrack>
  /** The sweep, track lifecycle and effector state snapped at the published sim time. */
  sweep: TrialSweep | null
  states: Map<string, TrialTelemetryState>
  members: Map<string, TrialMemberState[]>
  /** Entities whose labels render as spoke callouts in CalloutLayer instead. */
  spokeIds: Set<string>
  /** The lit half of the pulse, computed once per frame from the display time. */
  blink: boolean
}

/** Subtle darker edge that reads over any fill color. Shared with the palette. */
const EDGE = FRAME_EDGE

const GHOST = PHASE_STYLE.ghost.color
const JAM_CYAN = EW_JAM_COLOR
/** Out of rounds. Matches the 'bad' treatment the system panel gives EMPTY. */
const DEPLETED = DANGER_INK
/** Destroyed-overlay ink. Not a phase color, so it never reads as a kill-chain rung. */
const DESTROYED = '#cfd4cc'

const GHOST_OPACITY = 0.7

/**
 * Box units to px for FRIEND_FRAME_D: a 19.4 x 13.2 px symbol whose half
 * diagonal is 11.7 px, so RING_R (14), the hit disc (13) and BRACKET_HALF (19)
 * all still clear it.
 */
const FRIEND_SCALE = 2.2

/** Track ring radius. The glyph is r11, so the ring clears it. */
const RING_R = 14
/** Selection ring radius. It must stay outside the target brackets; LABEL_ANCHOR_TOP clears it. */
const SELECT_R = 28
const BRACKET_HALF = 19
const BRACKET_ARM = 6
/** Jammed-diamond radius: clears the r14 ring, stays inside SELECT_R. */
const JAM_DIAMOND_R = 21
/** Gap under the wrapped name before the DEFEATED tag, px. */
const TAG_GAP = 6

/** Konva compares array props by identity, so every fixed dash and point list is a constant. */
/** Heading tick: straight up from the glyph centre, screen px. */
const HEADING_TICK = [0, 0, 0, -16]
const MEMBER_HEADING_TICK = [0, 0, 0, -11]
/** Inactive-entity slash, the opposite diagonal to the destroyed strike. */
const OFF_SLASH = [-11, 11, 11, -11]
/** Destroyed strike at the main glyph and at a formation member. */
const STRIKE_MAIN = [-10, -10, 10, 10]
const STRIKE_MEMBER = [-6.5, -6.5, 6.5, 6.5]
const GHOST_DIAMOND_DASH = [3.5, 3]
const MEMBER_GHOST_DASH = [3, 2.5]
const CARD_LINK_DASH = [2, 3]
const HEADING_LEADER_DASH = [2, 3]

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
  /** Live heading; the entity's own while it is at rest. */
  headingDeg: number
  color: string
  /** Defeated track: hollow dashed frame under a bold destroyed strike. */
  ghost?: boolean
  /** Effector only: false draws the friend frame as an outline. */
  filled?: boolean
  /** The sensor heading tick, so a heading drag can preview on the node itself. */
  tickRef?: React.Ref<Konva.Line>
}

/**
 * MIL-STD-2525 destroyed overlay: one bold strike across the frame. It runs the
 * opposite diagonal to the inactive-entity slash.
 */
function DestroyedStrike({ points, width }: { points: number[]; width: number }) {
  return (
    <Line
      points={points}
      stroke={DESTROYED}
      strokeWidth={width}
      strokeScaleEnabled={false}
      lineCap="round"
      listening={false}
    />
  )
}

/**
 * The friend affiliation frame plus its function letter, both from panels/Glyph.tsx.
 * An outline frame carries its letter in the entity color, because the dark board
 * shows through the unfilled frame.
 */
function FriendFrame({
  kind,
  color,
  filled,
}: {
  kind: Entity['kind']
  color: string
  filled: boolean
}) {
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
        // A 1 px edge over an opaque fill does not need Konva's buffer-canvas pass.
        perfectDrawEnabled={false}
        listening={false}
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
        listening={false}
      />
    </>
  )
}

/**
 * MIL-STD-2525 symbology, matching panels/Glyph.tsx: the FRAME carries
 * affiliation and an inner LETTER carries function.
 *   friend frame  - rounded-top rectangle: sensor S, c2 C2, effector E, asset A.
 *   hostile frame - diamond: uas.
 *   neutral frame - hollow square with a centre dot: marker.
 * Heading ticks draw under the frame so only the protruding tip shows.
 */
function Glyph({ entity, headingDeg, color, ghost, filled = true, tickRef }: GlyphProps) {
  switch (FRAME_FOR[entity.kind]) {
    case 'friend':
      // An idle or empty weapon is an outline; every other blue-force kind is filled.
      return (
        <>
          {entity.kind === 'sensor' && (
            <Line
              ref={tickRef}
              points={HEADING_TICK}
              stroke={color}
              strokeWidth={2}
              rotation={headingDeg}
              listening={false}
            />
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
            points={HEADING_TICK}
            stroke={ghost ? GHOST : color}
            strokeWidth={ghost ? 1.6 : 2}
            rotation={headingDeg}
            listening={false}
          />
          {ghost ? (
            <>
              <RegularPolygon
                sides={4}
                radius={11}
                stroke={GHOST}
                strokeWidth={1.7}
                dash={GHOST_DIAMOND_DASH}
                listening={false}
              />
              <DestroyedStrike points={STRIKE_MAIN} width={2.6} />
            </>
          ) : (
            <RegularPolygon
              sides={4}
              radius={11}
              fill={color}
              stroke={EDGE}
              strokeWidth={1}
              perfectDrawEnabled={false}
              listening={false}
            />
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
            listening={false}
          />
          <Circle radius={2} fill={color} listening={false} />
        </>
      )
  }
}

/** Handle offset from the glyph centre, screen px. */
const HANDLE_REACH = 34

function handlePoint(headingDeg: number): { x: number; y: number } {
  const r = (headingDeg * Math.PI) / 180
  return { x: Math.sin(r) * HANDLE_REACH, y: -Math.cos(r) * HANDLE_REACH }
}

/** Drag handle that points a directional sensor/effector. Child drag does not move the group. */
function HeadingHandle({
  entity,
  color,
  tickRef,
}: {
  entity: Entity
  color: string
  tickRef: React.RefObject<Konva.Line | null>
}) {
  const leaderRef = useRef<Konva.Line>(null)
  /** Heading under the pointer, held until the gesture commits it. */
  const draft = useRef<number | null>(null)
  const { x: hx, y: hy } = handlePoint(entity.headingDeg)
  const leaderPoints = useMemo(() => [0, 0, hx, hy], [hx, hy])

  function headingFromPointer(e: KonvaEventObject<DragEvent>): number | null {
    const pointer = e.target.getStage()?.getPointerPosition()
    if (!pointer) return null
    // Read, not subscribed: a pan or a zoom must not re-render every entity node.
    const camera = useStore.getState().camera
    const world = {
      x: (pointer.x - camera.x) / camera.scale,
      y: (pointer.y - camera.y) / camera.scale,
    }
    // Only a sensor or an effector carries a handle, and neither flies a path,
    // so the rest position is the glyph position.
    return Math.round(bearingDeg(entity.pos, world))
  }

  return (
    <Group>
      <Line
        ref={leaderRef}
        points={leaderPoints}
        stroke={color}
        strokeWidth={1}
        dash={HEADING_LEADER_DASH}
        listening={false}
      />
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
          if (h == null) return
          const deg = h % 360
          draft.current = deg
          // Preview on the Konva nodes alone: a store write per pointer move would
          // rerun the picture and push an undo entry for every frame of the gesture.
          const p = handlePoint(deg)
          tickRef.current?.rotation(deg)
          leaderRef.current?.points([0, 0, p.x, p.y])
          e.target.position(p)
        }}
        onDragEnd={(e) => {
          const deg = draft.current
          draft.current = null
          e.target.position(handlePoint(deg ?? entity.headingDeg))
          // One mutation, so the gesture is one undo entry.
          if (deg != null && deg !== entity.headingDeg) {
            useStore.getState().updateEntity(entity.id, { headingDeg: deg })
          }
        }}
      />
    </Group>
  )
}

interface NodeProps {
  entity: Entity
  /** Live position, meters. */
  x: number
  y: number
  /** Live heading, degrees. */
  headingDeg: number
  /** Sampled group telemetry; absent before observation. */
  state: TrialTelemetryState | undefined
  trialMembers?: TrialMemberState[]
  memberOutcome?: TrialMemberState['outcome']
  memberJammed?: boolean
  effectorState: EffectorLiveState
  /** The pulse phase, true only while this node pulses. */
  blink: boolean
  /** The label renders as a spoke callout in CalloutLayer instead. */
  spoked: boolean
}

/**
 * The counter-scale wrapper of one entity: the formation members and the main
 * group. Only this wrapper reads the zoom, so a wheel step re-renders these few
 * elements and not the body under them.
 */
const EntityNode = memo(function EntityNode(props: NodeProps) {
  const { entity, x, y, headingDeg, state } = props
  // Only the scale is read at render; the handlers take x and y from the store,
  // so a pan never re-renders a node.
  const k = useStore((s) => s.camera.scale)
  const tool = useStore((s) => s.ui.tool)
  const model = useStore((s) => modelFor(s.scenario, entity))
  const color = useMemo(() => entityInk(entity, model), [entity, model])
  const off = !entityActive(entity)
  const ghost = state?.phase === 'ghost'
  const members = entity.kind === 'uas' ? memberPositions(entity, { x, y }, headingDeg) : null

  const main = (
    <Group
      name={entity.kind === 'uas' ? `member:${entity.id}:0` : entity.id}
      x={x}
      y={y}
      scaleX={1 / k}
      scaleY={1 / k}
      opacity={off ? 0.45 : ghost ? GHOST_OPACITY : 1}
      draggable={tool === 'select'}
      onClick={(e) => handleClick(e, entity)}
      onContextMenu={(e) => handleContextMenu(e, entity)}
      onMouseEnter={hover}
      onMouseLeave={hover}
      onDragStart={(e) => {
        if (e.target === e.currentTarget) useStore.getState().select({ entityIds: [entity.id] })
      }}
      onDragEnd={(e) => {
        // The heading handle's drag events bubble here; only a drag of the
        // group itself moves the entity.
        if (e.target !== e.currentTarget) return
        const store = useStore.getState()
        store.moveEntity(entity.id, { x: e.target.x(), y: e.target.y() })
        // A repositioned blue-force system gets fresh connect offers.
        if (entity.kind !== 'sensor' && entity.kind !== 'effector' && entity.kind !== 'c2') return
        const pointer = e.target.getStage()?.getPointerPosition()
        if (pointer) store.openConnectSuggestion(entity.id, pointer)
      }}
    >
      <EntityBody
        entity={entity}
        headingDeg={headingDeg}
        memberOutcome={props.trialMembers?.[0]?.outcome}
        memberJammed={props.trialMembers?.[0]?.jamState?.jammed ?? false}
        state={state}
        effectorState={props.effectorState}
        blink={props.blink}
        spoked={props.spoked}
        model={model}
        color={color}
        tool={tool}
      />
    </Group>
  )
  // A single ship needs no fragment: one element fewer per node on a zoom.
  if (!members || members.length < 2) return main

  return (
    <>
      {(
        props.trialMembers ??
        members.map((position, memberIdx) => ({
          memberIdx,
          position,
          heading: headingDeg,
          jamState: null,
          outcome: 'active' as const,
        }))
      )
        .slice(1)
        .map((m) => (
          <Group
            key={`${entity.id}:${m.memberIdx}`}
            name={`member:${entity.id}:${m.memberIdx}`}
            x={m.position.x}
            y={m.position.y}
            scaleX={1 / k}
            scaleY={1 / k}
            onClick={(e) => handleClick(e, entity)}
            onContextMenu={(e) => handleContextMenu(e, entity)}
            opacity={off ? 0.3 : 0.85}
          >
            <Line
              points={MEMBER_HEADING_TICK}
              rotation={m.heading}
              stroke={m.outcome === 'hard-kill' ? GHOST : color}
              strokeWidth={1}
              listening={false}
            />
            {m.outcome === 'hard-kill' ? (
              <>
                <RegularPolygon
                  sides={4}
                  radius={7}
                  stroke={GHOST}
                  strokeWidth={1.4}
                  dash={MEMBER_GHOST_DASH}
                />
                <DestroyedStrike points={STRIKE_MEMBER} width={1.8} />
              </>
            ) : (
              <RegularPolygon
                sides={4}
                radius={7}
                fill={m.outcome === 'mission-kill' ? undefined : color}
                stroke={m.outcome === 'mission-kill' ? JAM_CYAN : EDGE}
                strokeWidth={1}
                // The group carries an opacity; skip Konva's buffer-canvas pass.
                perfectDrawEnabled={false}
              />
            )}
            {m.jamState?.jammed && m.outcome !== 'hard-kill' && (
              <Text text="J" x={-13} y={-5} fontSize={11} fill={JAM_CYAN} listening={false} />
            )}
            {m.outcome === 'mission-kill' && (
              <Text text="MK" x={8} y={-5} fontSize={9} fill={JAM_CYAN} />
            )}
          </Group>
        ))}
      {main}
    </>
  )
})

/**
 * The hover cue on the Konva nodes alone, so a plain hover re-renders no layer: the
 * pointer cursor and the hover ring, in the tools where a click acts on the entity.
 */
function hover(e: KonvaEventObject<MouseEvent>) {
  const tool = useStore.getState().ui.tool
  const on = e.type === 'mouseenter' && (tool === 'select' || tool === 'connect')
  e.target.getStage()!.container().style.cursor = on ? 'pointer' : ''
  ;(e.currentTarget as Konva.Group).findOne('.hover')?.visible(on)
}

function handleClick(e: KonvaEventObject<MouseEvent>, entity: Entity) {
  const store = useStore.getState()
  const { tool, connectFromId, pathEntityId, raidDraft } = store.ui
  const action = routeInteraction(
    { kind: 'click-entity', entityKind: entity.kind, shiftKey: e.evt.shiftKey },
    {
      ...IDLE_INTERACTION,
      tool,
      connectFrom: connectFromId != null,
      pathStarted: pathEntityId != null,
      raidDraft: raidDraft != null,
    },
  )
  if (action.type === 'continue') return
  e.cancelBubble = true
  switch (action.type) {
    case 'begin-connect':
      store.beginConnect(entity.id)
      return
    case 'complete-connect':
      store.completeConnect(entity.id)
      return
    case 'begin-path':
      store.beginPath(entity.id)
      return
    case 'select-entity':
      store.select({ entityIds: [entity.id] }, action.additive)
      return
    default:
      return
  }
}

function handleContextMenu(e: KonvaEventObject<MouseEvent>, entity: Entity) {
  e.evt.preventDefault()
  e.cancelBubble = true
  // Ctrl+left-click also fires contextmenu on macOS; menu is right-button only.
  if (e.evt.button !== 2) return
  const pointer = e.target.getStage()?.getPointerPosition()
  if (!pointer) return
  const store = useStore.getState()
  const camera = store.camera
  const world = {
    x: (pointer.x - camera.x) / camera.scale,
    y: (pointer.y - camera.y) / camera.scale,
  }
  store.select({ entityIds: [entity.id] })
  store.openContextMenu(pointer, world, entity.id)
}

/**
 * Everything drawn inside the counter-scaled group, in screen px. Memoized on
 * per-entity primitives, so a zoom re-renders no body.
 */
const EntityBody = memo(function EntityBody({
  entity,
  headingDeg,
  memberOutcome,
  memberJammed,
  state,
  effectorState,
  blink,
  spoked,
  model,
  color,
  tool,
}: Omit<NodeProps, 'x' | 'y'> & { model: SpecModel | undefined; color: string; tool: string }) {
  const connectFrom = useStore((s) => s.ui.connectFromId === entity.id)
  const showLabels = useStore((s) => selectEffectiveLayers(s).labels)
  const selected = useStore((s) => s.selection.entityIds.includes(entity.id))
  const cardLinked = useStore((s) => {
    const cardId = s.selection.cardId
    if (!cardId) return false
    const card = s.scenario.testCards.find((c) => c.id === cardId)
    return card?.linkedEntityIds.includes(entity.id) ?? false
  })

  const tickRef = useRef<Konva.Line>(null)
  const ink = useBoardInk()
  const off = !entityActive(entity)
  const phase: TrackPhase = entity.kind === 'uas' ? (state?.phase ?? 'undetected') : 'undetected'
  const ghost = memberOutcome === 'hard-kill'
  const missionKill = memberOutcome === 'mission-kill'
  // A defeated track carries the destroyed strike, so it draws no ring.
  const ringColor = ghost ? null : PHASE_STYLE[phase].color
  // A retained successful jam decision, independent of channel activity.
  const jammed = !ghost && (memberJammed ?? false)
  // An EW-only engagement swaps the target brackets for the jammed diamond;
  // a track also under kinetic or DE fire keeps its brackets as well.
  const ewOnly = state != null && state.kineticSalvos + state.deSalvos === 0
  const bracketed = (phase === 'targeted' || phase === 'engaged') && !(jammed && ewOnly)
  // Pulse floor is 0.5: a dimmed engaged track must stay legible.
  const pulse = phase === 'engaged' && !blink ? 0.5 : 1
  const depleted = effectorState === 'depleted'
  const effectorFilled =
    effectorState === 'semi-active' ||
    effectorState === 'beam' ||
    (effectorState === 'active' && blink)

  const sectorDeg = useMemo(
    () =>
      entity.kind === 'sensor'
        ? model?.sensor?.sectorDeg
        : entity.kind === 'effector'
          ? (model?.effector?.sectorDeg ?? 360)
          : undefined,
    [entity, model],
  )
  const directional = sectorDeg != null && sectorDeg < 360
  // Konva hit-tests a stroke-only Circle over its whole disc. The selection
  // (r16) and card-link (r19) rings are cues, so the hit disc carries their radii.
  const hitR = cardLinked ? 19 : selected ? 16 : 13
  const labelDrawn = showLabels && !spoked
  // Board labels carry the short designator; Entity.name keeps the full string.
  const boardName = useMemo(() => boardDesignator(entity.name), [entity])
  const nameLines = useMemo(() => labelLineCount(boardName), [boardName])
  const labelLines = labelDrawn ? nameLines : 0

  return (
    <>
      {/* Invisible hit disc: it alone sets the grab area, because every ring below is a cue. */}
      <Circle radius={hitR} fill="#000" opacity={0} />
      {/* Hover ring in the entity ink at 60 %; hover() shows it on the node. */}
      <Circle
        name="hover"
        radius={SELECT_R}
        stroke={color}
        strokeWidth={1}
        opacity={0.6}
        visible={false}
        listening={false}
      />
      {/* Selection: a solid 1.5 px ring in text 1 over a 2 px board-tone halo. */}
      {selected && (
        <>
          <Circle radius={SELECT_R} stroke={ink.board} strokeWidth={5.5} listening={false} />
          <Circle radius={SELECT_R} stroke={ink.selection} strokeWidth={1.5} listening={false} />
        </>
      )}
      {cardLinked && (
        <Circle
          radius={32}
          stroke={EW_INK}
          strokeWidth={1.5}
          dash={CARD_LINK_DASH}
          listening={false}
        />
      )}
      {connectFrom && <Circle radius={16} stroke={ink.tool} strokeWidth={2} listening={false} />}
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
        <Circle
          radius={RING_R}
          stroke={ringColor}
          strokeWidth={1.6}
          opacity={pulse}
          listening={false}
        />
      )}
      <Glyph
        entity={entity}
        headingDeg={headingDeg}
        color={missionKill ? JAM_CYAN : color}
        ghost={ghost}
        filled={effectorFilled}
        tickRef={tickRef}
      />
      {missionKill && (
        <Text text="MISSION KILL" x={18} y={-3} fontSize={9} fill={JAM_CYAN} listening={false} />
      )}
      {off && <Line points={OFF_SLASH} stroke={DANGER_INK} strokeWidth={2} listening={false} />}
      {entity.kind === 'uas' && (entity.formation?.count ?? 1) > 1 && (
        <Text
          fontFamily="JetBrains Mono"
          x={BRACKET_HALF + 2}
          y={state ? -28 : -16}
          width={140}
          text={
            state
              ? `${state.activeCount} active\n${state.hardKillCount} hard kill\n${state.missionKillCount} mission kill`
              : `x${entity.formation!.count}`
          }
          fontSize={11}
          fill={ghost ? GHOST : color}
          listening={false}
        />
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
      {(effectorState === 'preparing' || effectorState === 'timing-unavailable') && (
        <Text
          fontFamily="JetBrains Mono"
          x={13}
          y={-4}
          text={effectorState === 'preparing' ? 'PREP' : 'LAUNCH ?'}
          fontSize={11}
          fill={PHASE_STYLE.targeted.color}
          listening={false}
        />
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
        <Text
          fontFamily="JetBrains Mono"
          x={-60}
          y={LABEL_ANCHOR_TOP}
          width={120}
          text={boardName}
          fontSize={11}
          fill={ink.label}
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
          text="HARD KILL"
          fontSize={9}
          fill={GHOST}
          listening={false}
        />
      )}
      {selected && directional && tool === 'select' && (
        <HeadingHandle entity={entity} color={color} tickRef={tickRef} />
      )}
      {selected && entity.kind === 'uas' && tool === 'select' && (
        <Group
          y={LABEL_ANCHOR_TOP + labelLines * LABEL_LINE_H + TAG_GAP}
          onClick={(e) => {
            e.cancelBubble = true
            useStore.getState().updateEntity(entity.id, { showRange: !entity.showRange })
          }}
        >
          <Rect
            x={-34}
            width={68}
            height={16}
            cornerRadius={8}
            fill={entity.showRange ? ink.tool : ink.control}
            stroke={entity.showRange ? ink.tool : ink.calloutLeader}
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
            fill={entity.showRange ? ink.board : ink.calloutLeader}
            listening={false}
          />
        </Group>
      )}
    </>
  )
})

interface GroupProps {
  entities: Entity[]
  /** Live tracks for the entities that fly a path; null for the group at rest. */
  tracks: Map<string, LiveTrack> | null
  states: Map<string, TrialTelemetryState>
  members: Map<string, TrialMemberState[]>
  effectorStates: Map<string, EffectorLiveState>
  spokeIds: Set<string>
  blink: boolean
}

/**
 * The nodes of one group of entities. Per-frame inputs reach a node as primitives
 * and shared identities, so per-frame React work is proportional to what moved.
 */
const EntityGroup = memo(function EntityGroup(group: GroupProps) {
  const { entities, tracks, states, effectorStates, spokeIds, blink } = group
  return (
    <>
      {entities.map((e) => {
        const track = tracks?.get(e.id)
        const state = states.get(e.id)
        const effectorState = effectorStates.get(e.id) ?? 'idle'
        // The pulse reaches only the nodes that draw it.
        const pulses = state?.phase === 'engaged' || effectorState === 'active'
        return (
          <EntityNode
            key={`${e.id}:0`}
            entity={e}
            x={track?.pos.x ?? e.pos.x}
            y={track?.pos.y ?? e.pos.y}
            headingDeg={track?.headingDeg ?? e.headingDeg}
            trialMembers={group.members.get(e.id)}
            state={state}
            effectorState={effectorState}
            blink={pulses && blink}
            spoked={spokeIds.has(e.id)}
          />
        )
      })}
    </>
  )
})

/**
 * One node per entity, in two groups: the entities at rest and the entities that
 * fly a path and take the per-frame tracks. The flying group draws above the rest.
 */
const EMPTY_EFFECTORS = new Map<string, EffectorLiveState>()

export function EntityLayer({ tracks, members, states, sweep, spokeIds, blink }: Props) {
  const entities = useStore((s) => s.scenario.entities)
  const paths = useStore((s) => s.scenario.paths)
  const groups = useMemo(() => {
    const flying = new Set(paths.map((p) => p.entityId))
    return {
      atRest: entities.filter((e) => !flying.has(e.id)),
      flying: entities.filter((e) => flying.has(e.id)),
    }
  }, [entities, paths])
  return (
    <>
      <EntityGroup
        entities={groups.atRest}
        tracks={tracks}
        members={members}
        states={states}
        effectorStates={sweep?.effectorStates ?? EMPTY_EFFECTORS}
        spokeIds={spokeIds}
        blink={blink}
      />
      <EntityGroup
        entities={groups.flying}
        tracks={tracks}
        members={members}
        states={states}
        effectorStates={sweep?.effectorStates ?? EMPTY_EFFECTORS}
        spokeIds={spokeIds}
        blink={blink}
      />
    </>
  )
}
