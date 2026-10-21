import { selectEffectiveLayers } from '../../state/selectors'
import { memo, useEffect, useMemo, useRef } from 'react'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Entity, Scenario, SpecModel, UasSpec } from '../../model/types'
import { entityActive } from '../../model/types'
import { screenToWorld } from '../../state/camera'
import { useStore } from '../../state/store'
import type { Store } from '../../state/store'
import { modelFor, pathSpeed } from '../../model/scenario'
import { bearingDeg } from '../../geometry/geo'
import { memberPositions, threatAltitudeFt } from '../../playback/tracks'
import type { LiveTrack } from '../../playback/tracks'
import type { TrialSweep } from '../../playback/trialSweepAt'
import type { TrialMemberState } from '../../playback/trialTrackState'
import type { TrialTelemetryState } from '../../panels/analysis/threatReadout'
import type { EffectorLiveState, TrackPhase } from '../../playback/trackState'
import { sensorHoldGate } from '../../analysis/sensorEnv'
import { boardInk, EW_INK } from '../../ui/ink'
import type { BoardInk } from '../../ui/ink'
import { useBoardInk } from '../useBoardInk'
import type { AirIdentity } from '../../panels/Glyph'
import {
  AIR_DIAMOND_R,
  AIR_FRAME,
  AIR_FRAME_TOP,
  airFrameFor,
  BORESIGHT_TICK_LEN,
  CONDITION_BAR,
  GND_CIRCLE_R,
  GND_FRAME_TOP,
  groundFrameFor,
} from '../../panels/Glyph'
import { AirFrame, Brackets, DataBlock, EngagementBar, GroundFrame, KillStrike } from './symbols'
import { anchoredBlockPos, boardDesignator, HANDLE_KNOB_R, HANDLE_REACH } from '../labelLayout'
import { IDLE_INTERACTION, routeInteraction } from '../interactionRouter'
import { hoverCursor, releaseHover } from '../hoverCursor'

interface Props {
  tracks: Map<string, LiveTrack>
  /** The sweep, track lifecycle and effector state snapped at the published sim time. */
  sweep: TrialSweep | null
  states: Map<string, TrialTelemetryState>
  members: Map<string, TrialMemberState[]>
  /** Entities whose labels render as spoke callouts in CalloutLayer instead. */
  spokeIds: Set<string>
}

const MONO = 'JetBrains Mono'

/** A defeated track keeps its place on the board at this intensity. */
const GHOST_OPACITY = 0.7
/** Truth no sensor has held yet: the primer's No track row. */
const NO_TRACK_OPACITY = 0.7
/** Every sensor extrapolates: half intensity, the frame stays solid. */
const COASTING_OPACITY = 0.5
/** A placed system that is switched off: dashed frame at reduced intensity. */
const OFF_OPACITY = 0.55

/** Selection ring radius. It stays outside the target brackets (17). */
const SELECT_R = 28
/** The range button of a selected track sits this far under the frame, px. */
const RANGE_BUTTON_Y = 20
/** Member frames draw at this fraction of the lead frame: an r7 diamond. */
const MEMBER_SCALE = 7 / AIR_DIAMOND_R

/**
 * Velocity leader of an air track: as long as the distance the track flies in
 * LEADER_S seconds, held between the two bounds, screen px. 2525D steps the leader by
 * speed band, and every small UAS sits in its lowest band; the time rule keeps the
 * leader readable across the board's speeds. The frame knockout covers its root.
 */
const LEADER_S = 10
const LEADER_MIN_PX = 10
const LEADER_MAX_PX = 48
const KT_PER_MPS = 1.943844
/** Konva compares array props by identity, so every fixed dash and point list is a constant. */
const MEMBER_HEADING_TICK = [0, 0, 0, -11]
/** Boresight tick of a sensor: from the frame edge outward, screen px. */
const BORESIGHT_TICK = [0, -GND_CIRCLE_R, 0, -GND_CIRCLE_R - BORESIGHT_TICK_LEN]
const CARD_LINK_DASH = [2, 3]
const HEADING_LEADER_DASH = [2, 3]

/** The engagement bar top on an air frame: 7 px above the frame top (the primer's -20 on a diamond). */
const AIR_BAR_LIFT = 7
/** The engagement bar top on a ground frame: 5 px above the frame top (the primer's -17 on a circle). */
const GND_BAR_LIFT = 5

/**
 * Identity an air track draws, from the sampled telemetry. Null is a hard kill. Until
 * a sensor holds the track (no telemetry, undetected, searching) the truth draws as
 * `none`: a grey frame keeps it on the board and red waits for the call.
 */
// oxlint-disable-next-line react/only-export-components
export function airIdentityOf(
  state: TrialTelemetryState | undefined,
  outcome: TrialMemberState['outcome'] | undefined,
): AirIdentity | null {
  if (outcome === 'hard-kill') return null
  if (!state || state.phase === 'undetected' || state.phase === 'searching') return 'none'
  if (state.classification === 'hostile') return 'hostile'
  if (state.classification === 'suspected') return 'suspect'
  return 'unknown'
}

/**
 * The hue of an air track. An explicit entity colour wins over an identity hue, as on
 * every other board object; a no-track frame and a hard kill keep their greys.
 */
function airHue(entity: Entity, identity: AirIdentity | null, ink: BoardInk): string {
  if (identity == null) return ink.ghost
  if (identity === 'none') return ink.noTrack
  return entity.color ?? ink[airFrameFor(identity).inkKey]
}

/** Three digits, as the primer's altitude and speed read. */
function digits3(n: number): string {
  return String(Math.max(0, Math.min(999, Math.round(n)))).padStart(3, '0')
}

/** Line two of an air track block: altitude in hundreds of feet and speed in knots. */
function altSpeedLine(altFt: number, speedMps: number): string {
  return `${digits3(altFt / 100)} ${digits3(speedMps * KT_PER_MPS)}`
}

/**
 * Line one of a data block: the board designator, the raid count when the file holds
 * more than one member, then one status word.
 */
function designatorLine(name: string, count: number, word: string | null): string {
  const parts = [boardDesignator(name)]
  if (count > 1) parts.push(`×${count}`)
  if (word) parts.push(word)
  return parts.join(' ')
}

/**
 * The block lines an entity draws at rest, for the label layout: line one, and on an
 * air track line two as well, so the box measured holds the block a run draws. A run
 * adds a status word to line one; the box is measured without it.
 */
// oxlint-disable-next-line react/only-export-components
export function blockLinesAtRest(scenario: Scenario, entity: Entity): string[] {
  const line1 = designatorLine(entity.name, entity.formation?.count ?? 1, null)
  if (entity.kind !== 'uas') return [line1]
  const path = scenario.paths.find((p) => p.entityId === entity.id)
  const speed = path
    ? pathSpeed(scenario, path)
    : (modelFor(scenario, entity)?.uas?.cruiseSpeedMps ?? 0)
  return [line1, altSpeedLine(threatAltitudeFt(scenario, entity), speed)]
}

/**
 * The 2525D engagement bar on a track. ASN is assigned, ENG engaging, MIF missile in
 * flight; the suffix names the channel: M missile, EA electronic attack. ENG-DE for a
 * directed-energy dwell is a house code; 2525D has no DE suffix.
 */
function trackBarText(state: TrialTelemetryState | undefined): string | null {
  if (!state) return null
  const { kineticSalvos, deSalvos, jamSalvos, incomingSalvos } = state
  if (kineticSalvos > 0) return incomingSalvos > 0 ? 'MIF-M' : 'ENG-M'
  if (deSalvos > 0) return 'ENG-DE'
  if (jamSalvos > 0) return 'ENG-EA'
  return null
}

/**
 * The engagement bar on an effector, the mirror of the target's bar (2525D 5.3.6.14 puts
 * it on both). ASN ? for a shot whose timing the library cannot give is a house code.
 */
function effectorBarText(state: EffectorLiveState, model: SpecModel | undefined): string | null {
  const type = model?.effector?.effectorType
  switch (state) {
    case 'preparing':
      return 'ASN-M'
    case 'timing-unavailable':
      return 'ASN ?'
    case 'semi-active':
    case 'active':
      return type === 'gun' ? 'MIF-GN' : 'MIF-M'
    case 'beam':
      return type === 'jammer' ? 'ENG-EA' : 'ENG-DE'
    default:
      return null
  }
}

/** The uas spec every ring and gate is computed against: the first selected threat. */
function selectedThreatSpec(s: Store): UasSpec | undefined {
  const hit = s.scenario.entities.find(
    (e) => e.kind === 'uas' && s.selection.entityIds.includes(e.id),
  )
  return hit ? modelFor(s.scenario, hit)?.uas : undefined
}

function handlePoint(headingDeg: number): { x: number; y: number } {
  const r = (headingDeg * Math.PI) / 180
  return { x: Math.sin(r) * HANDLE_REACH, y: -Math.cos(r) * HANDLE_REACH }
}

/**
 * Heading of the handle knob an entity shows, or undefined when it shows none. A
 * directional sensor or effector shows one while selected under the select tool.
 * LiveScene feeds this to the label layout, so the collision box starts where the
 * label draws.
 */
// oxlint-disable-next-line react/only-export-components
export function shownHandleDeg(
  entity: Entity,
  model: SpecModel | undefined,
  selected: boolean,
  tool: string,
): number | undefined {
  if (!selected || tool !== 'select') return undefined
  const sectorDeg =
    entity.kind === 'sensor'
      ? model?.sensor?.sectorDeg
      : entity.kind === 'effector'
        ? (model?.effector?.sectorDeg ?? 360)
        : undefined
  return sectorDeg != null && sectorDeg < 360 ? entity.headingDeg : undefined
}

/** Drag handle that points a directional sensor/effector. Child drag does not move the group. */
function HeadingHandle({
  entity,
  color,
  rim,
  tickRef,
  blockRef,
  lines,
}: {
  entity: Entity
  color: string
  /** The knob rim: `BoardInk.knobRim`. */
  rim: string
  tickRef: React.RefObject<Konva.Line | null>
  /** The data block, so it flips sides while the knob sweeps over it. */
  blockRef: React.RefObject<Konva.Group | null>
  /** The block lines drawn, which set the box the knob is tested against. */
  lines: readonly string[]
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
    const world = screenToWorld(camera, pointer)
    // Only a sensor or an effector carries a handle, and neither flies a path,
    // so the rest position is the glyph position.
    return Math.round(bearingDeg(entity.pos, world))
  }

  /** Preview the block position for a heading on the Konva nodes alone. */
  function placeBlock(deg: number) {
    const g = blockRef.current
    if (!g) return
    const pos = anchoredBlockPos(lines, entity.kind, deg)
    g.position({ x: pos.x, y: pos.y })
    for (const line of g.find<Konva.Text>('.block-line')) {
      line.align(pos.align)
      line.width(pos.width)
    }
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
        radius={HANDLE_KNOB_R}
        fill={color}
        stroke={rim}
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
          placeBlock(deg)
          e.target.position(p)
        }}
        onDragEnd={(e) => {
          const deg = draft.current
          draft.current = null
          e.target.position(handlePoint(deg ?? entity.headingDeg))
          placeBlock(deg ?? entity.headingDeg)
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
  effectorState: EffectorLiveState
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
  const ink = useBoardInk()
  const off = !entityActive(entity)
  const air = entity.kind === 'uas'
  // Primitives from the scenario: a store write that leaves them alone re-renders nothing.
  const speedMps = useStore((s) => {
    if (!air) return null
    const path = s.scenario.paths.find((p) => p.entityId === entity.id)
    return path ? pathSpeed(s.scenario, path) : null
  })
  const altFt = useStore((s) => (air ? threatAltitudeFt(s.scenario, entity) : 0))
  const leadOutcome = props.trialMembers?.[0]?.outcome
  const identity = air ? airIdentityOf(state, leadOutcome) : 'hostile'
  // One hue per affiliation on the board: the air identity hue, else the friend or
  // neutral hue. A model colour stays on the palette and the run timeline.
  const color = air ? airHue(entity, identity, ink) : boardInk(entity, ink)
  const ghost = identity == null || state?.phase === 'ghost'
  const members = air ? memberPositions(entity, { x, y }, headingDeg) : null
  // The leader is the distance flown in LEADER_S at this zoom, clamped. No path, no leader.
  const leaderPx =
    speedMps == null || ghost
      ? 0
      : Math.min(LEADER_MAX_PX, Math.max(LEADER_MIN_PX, speedMps * LEADER_S * k))
  // A deleted entity under the pointer gets no mouseleave.
  useEffect(() => () => releaseHover(entity.id), [entity.id])

  const opacity = off
    ? OFF_OPACITY
    : ghost
      ? GHOST_OPACITY
      : identity === 'none'
        ? NO_TRACK_OPACITY
        : state?.coasting
          ? COASTING_OPACITY
          : 1

  const main = (
    <Group
      name={air ? `member:${entity.id}:0` : entity.id}
      x={x}
      y={y}
      scaleX={1 / k}
      scaleY={1 / k}
      opacity={opacity}
      draggable={tool === 'select'}
      onClick={(e) => handleClick(e, entity)}
      onContextMenu={(e) => handleContextMenu(e, entity)}
      onMouseEnter={(e) => hover(e, entity.id)}
      onMouseLeave={(e) => hover(e, entity.id)}
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
        identity={identity}
        memberJammed={props.trialMembers?.[0]?.jamState?.jammed ?? false}
        missionKill={leadOutcome === 'mission-kill'}
        state={state}
        effectorState={props.effectorState}
        spoked={props.spoked}
        model={model}
        color={color}
        tool={tool}
        leaderPx={leaderPx}
        speedMps={speedMps}
        altFt={altFt}
      />
    </Group>
  )
  // A single ship needs no fragment: one element fewer per node on a zoom.
  if (!members || members.length < 2) return main

  // Members share the lead's identity frame; a hard-killed member takes the ghost diamond.
  const memberFrame = identity == null ? AIR_FRAME.hostile : airFrameFor(identity)
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
        .map((m) => {
          const dead = m.outcome === 'hard-kill'
          return (
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
              {!dead && (
                <Line
                  points={MEMBER_HEADING_TICK}
                  rotation={m.heading}
                  stroke={color}
                  strokeWidth={1}
                  listening={false}
                />
              )}
              <AirFrame
                frame={dead ? AIR_FRAME.hostile : memberFrame}
                color={dead ? ink.ghost : color}
                board={ink.board}
                dashed={dead ? false : undefined}
                scale={MEMBER_SCALE}
              />
              {dead && <KillStrike color={ink.destroyed} x scale={MEMBER_SCALE} />}
              {m.outcome === 'mission-kill' && <KillStrike color={color} scale={MEMBER_SCALE} />}
              {m.jamState?.jammed && !dead && (
                <Text
                  text="J"
                  fontFamily={MONO}
                  fontStyle="500"
                  x={-13}
                  y={-5}
                  fontSize={11}
                  fill={ink.ew}
                  listening={false}
                />
              )}
              {m.outcome === 'mission-kill' && (
                <Text text="MK" fontFamily={MONO} x={8} y={-5} fontSize={9} fill={ink.label} />
              )}
            </Group>
          )
        })}
      {main}
    </>
  )
})

/**
 * The hover cue on the Konva nodes alone, so a plain hover re-renders no layer: the
 * pointer cursor and the hover ring, in the tools where a click acts on the entity.
 */
function hover(e: KonvaEventObject<MouseEvent>, id: string) {
  const tool = useStore.getState().ui.tool
  const on = e.type === 'mouseenter' && (tool === 'select' || tool === 'connect')
  hoverCursor(id, e.target.getStage()!.container(), on)
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
  const world = screenToWorld(camera, pointer)
  store.select({ entityIds: [entity.id] })
  store.openContextMenu(pointer, world, entity.id)
}

interface BodyProps {
  entity: Entity
  headingDeg: number
  /** The air identity, or null for a hard kill. 'hostile' on a ground object, unused. */
  identity: AirIdentity | null
  memberJammed: boolean
  missionKill: boolean
  state: TrialTelemetryState | undefined
  effectorState: EffectorLiveState
  spoked: boolean
  model: SpecModel | undefined
  /** The board hue of the object. */
  color: string
  tool: string
  /** Velocity leader length, screen px; 0 draws none. */
  leaderPx: number
  /** Path speed, m/s; null with no path. */
  speedMps: number | null
  /** Threat altitude, ft AGL (0 on a ground object). */
  altFt: number
}

/**
 * Everything drawn inside the counter-scaled group, in screen px. Memoized on
 * per-entity primitives, so a zoom re-renders no body.
 *
 * The symbol follows the primer: the frame carries identity (an air frame from the
 * classification, a ground frame from the kind), an icon carries function, and the
 * amplifiers carry state: brackets for a locked track, the 2525D bar for the
 * engagement stage, a slash for a mission kill, an X for a hard kill, a dashed frame
 * for a switched-off system and a condition bar for a gated sensor. Nothing pulses.
 */
const EntityBody = memo(function EntityBody({
  entity,
  headingDeg,
  identity,
  memberJammed,
  missionKill,
  state,
  effectorState,
  spoked,
  model,
  color,
  tool,
  leaderPx,
  speedMps,
  altFt,
}: BodyProps) {
  const connectFrom = useStore((s) => s.ui.connectFromId === entity.id)
  const showLabels = useStore((s) => selectEffectiveLayers(s).labels)
  const selected = useStore((s) => s.selection.entityIds.includes(entity.id))
  const cardLinked = useStore((s) => {
    const cardId = s.selection.cardId
    if (!cardId) return false
    const card = s.scenario.testCards.find((c) => c.id === cardId)
    return card?.linkedEntityIds.includes(entity.id) ?? false
  })
  // The hold gate is a pure read of two specs (sensorEnv.ts), so a sensor body takes it
  // here rather than through useRingModel, whose per-hook memo would rebuild the Pd
  // bisection once per body. The selector returns the library spec object, so a store
  // write that leaves the selected threat alone re-renders nothing.
  const targetSpec = useStore((s) => (entity.kind === 'sensor' ? selectedThreatSpec(s) : undefined))

  const tickRef = useRef<Konva.Line>(null)
  const blockRef = useRef<Konva.Group>(null)
  const ink = useBoardInk()
  const off = !entityActive(entity)
  const air = entity.kind === 'uas'
  const phase: TrackPhase = air ? (state?.phase ?? 'undetected') : 'undetected'
  const ghost = air && identity == null
  const airFrame = air ? (identity == null ? AIR_FRAME.hostile : airFrameFor(identity)) : null
  const groundFrame = air ? null : groundFrameFor(entity.kind, model)
  // A retained successful jam decision, independent of channel activity.
  const jammed = air && !ghost && memberJammed
  // Locked: inside a usable weapon window, or under fire. White brackets; red stays identity.
  const bracketed = air && !ghost && (phase === 'targeted' || phase === 'engaged')
  const trackBar = air && !ghost ? trackBarText(state) : null
  const effectorBar = entity.kind === 'effector' ? effectorBarText(effectorState, model) : null
  const depleted = effectorState === 'depleted'
  // A sensor that can never hold the selected threat: RF silent, out of band or no range.
  const gate =
    entity.kind === 'sensor' && model?.sensor ? sensorHoldGate(model.sensor, targetSpec) : 'ok'
  const degraded = !off && gate !== 'ok' && gate !== 'needs-cue'
  const frameTop = airFrame ? AIR_FRAME_TOP[airFrame.shape] : GND_FRAME_TOP[groundFrame!.shape]

  // Konva hit-tests a stroke-only Circle over its whole disc. The selection
  // (r16) and card-link (r19) rings are cues, so the hit disc carries their radii.
  const hitR = cardLinked ? 19 : selected ? 16 : 13
  const blockDrawn = showLabels && !spoked
  const handleDeg = shownHandleDeg(entity, model, selected, tool)
  const handleShown = handleDeg != null

  // The data block. Line one carries the designator, the raid count and one status
  // word; line two the altitude and speed while a sensor holds the track, or EMPTY on
  // a spent effector. Entity.name keeps the full string.
  const held = air && !ghost && state != null && phase !== 'undetected' && phase !== 'searching'
  const count = air ? (state ? state.activeCount : (entity.formation?.count ?? 1)) : 1
  const word = ghost
    ? 'HK'
    : missionKill
      ? 'MK'
      : phase === 'searching'
        ? 'LOST'
        : state?.coasting
          ? 'CST'
          : null
  const altSpeed = useMemo(
    () => (air && speedMps != null ? altSpeedLine(altFt, speedMps) : null),
    [air, altFt, speedMps],
  )
  const lines = useMemo(() => {
    const out = [designatorLine(entity.name, count, word)]
    if (held && altSpeed) out.push(altSpeed)
    if (depleted) out.push('EMPTY')
    return out
  }, [entity.name, count, word, held, altSpeed, depleted])
  const lineColors = useMemo(
    () => (depleted ? [undefined, ink.selection] : undefined),
    [depleted, ink.selection],
  )
  // The block flips to the other side of a knob that would cover it; the handle stays put.
  const blockPos = useMemo(
    () => anchoredBlockPos(lines, entity.kind, handleDeg),
    [lines, entity.kind, handleDeg],
  )
  const leaderPoints = useMemo(() => [0, 0, 0, -leaderPx], [leaderPx])

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
      {bracketed && <Brackets color={ink.selection} />}
      {/* Ticks draw under the frame, so the knockout hides the root and the tip shows. */}
      {air && leaderPx > 0 && (
        <Line
          points={leaderPoints}
          stroke={color}
          strokeWidth={1.2}
          rotation={headingDeg}
          listening={false}
        />
      )}
      {entity.kind === 'sensor' && (
        <Line
          ref={tickRef}
          points={BORESIGHT_TICK}
          stroke={color}
          strokeWidth={1.6}
          rotation={headingDeg}
          listening={false}
        />
      )}
      {airFrame && (
        <AirFrame
          frame={airFrame}
          color={color}
          board={ink.board}
          // A hard kill keeps a solid frame in the ghost ink; the X carries the state.
          dashed={ghost ? false : undefined}
        />
      )}
      {groundFrame && (
        <GroundFrame frame={groundFrame} color={color} board={ink.board} dashed={off} />
      )}
      {ghost && <KillStrike color={ink.destroyed} x />}
      {missionKill && !ghost && <KillStrike color={color} />}
      {trackBar && (
        <EngagementBar
          text={trackBar}
          color={color}
          board={ink.board}
          top={-frameTop - AIR_BAR_LIFT}
        />
      )}
      {effectorBar && (
        <EngagementBar
          text={effectorBar}
          color={color}
          board={ink.board}
          top={-frameTop - GND_BAR_LIFT}
        />
      )}
      {jammed && (
        <Text
          fontFamily={MONO}
          fontStyle="500"
          x={frameTop + 4}
          y={-8}
          text="J"
          fontSize={10}
          fill={ink.ew}
          listening={false}
        />
      )}
      {degraded && (
        <Rect
          x={-CONDITION_BAR.w / 2}
          y={frameTop + CONDITION_BAR.gap}
          width={CONDITION_BAR.w}
          height={CONDITION_BAR.h}
          fill={ink.warn}
          listening={false}
        />
      )}
      {blockDrawn && (
        <DataBlock
          groupRef={blockRef}
          lines={lines}
          pos={blockPos}
          color={ghost ? ink.ghost : ink.label}
          board={ink.board}
          lineColors={lineColors}
        />
      )}
      {handleShown && (
        <HeadingHandle
          entity={entity}
          color={color}
          rim={ink.knobRim}
          tickRef={tickRef}
          blockRef={blockRef}
          lines={lines}
        />
      )}
      {selected && air && tool === 'select' && (
        <Group
          y={RANGE_BUTTON_Y}
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
            fontFamily={MONO}
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
}

/**
 * The nodes of one group of entities. Per-frame inputs reach a node as primitives
 * and shared identities, so per-frame React work is proportional to what moved.
 */
const EntityGroup = memo(function EntityGroup(group: GroupProps) {
  const { entities, tracks, states, effectorStates, spokeIds } = group
  return (
    <>
      {entities.map((e) => {
        const track = tracks?.get(e.id)
        const state = states.get(e.id)
        const effectorState = effectorStates.get(e.id) ?? 'idle'
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

export function EntityLayer({ tracks, members, states, sweep, spokeIds }: Props) {
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
      />
      <EntityGroup
        entities={groups.flying}
        tracks={tracks}
        members={members}
        states={states}
        effectorStates={sweep?.effectorStates ?? EMPTY_EFFECTORS}
        spokeIds={spokeIds}
      />
    </>
  )
}
