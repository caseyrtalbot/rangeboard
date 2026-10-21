import { memo, useMemo } from 'react'
import { Arc, Circle, Group, Line, Ring as KonvaRing, Text } from 'react-konva'
import type { Entity, Vec2 } from '../../model/types'
import { useStore } from '../../state/store'
import { destination, wedgePoints } from '../../geometry/geo'
import type { BoardInk } from '../../ui/ink'
import { LABEL_FONT_PX, LABEL_HALO_PX } from '../labelLayout'
import type { AssetRings, EffectorRings, JammerRings, SensorRings } from '../ringModel'
import { useBoardInk } from '../useBoardInk'
import { useRingModel } from '../useRingModel'
import type { RestStroke } from './footprintStyle'
import {
  MIN_REST,
  MIR_REST,
  MRIR_REST,
  PD_HIGH_DASH,
  resolveRingInk,
  RING_LABEL_TEXT,
  RING_STYLE,
  ringState,
  SENSOR_REST,
} from './footprintStyle'

interface Props {
  /** Systems active at the trial horizon: sensors measured or held (coast alone
   *  does not light a ring) and effectors that engage. See trialActiveIds. */
  runActiveIds: Set<string>
}

const PLACARD_FILL = RING_STYLE.sensorPlacard.fillAlpha ?? 0
const ENVELOPE_FILL = RING_STYLE.sensorEnvelope.fillAlpha ?? 0
const CONTOUR_FILL = RING_STYLE.sensorPdContours.fillAlpha ?? 0
const MAX_RANGE_FILL = RING_STYLE.effectorMaxRange.fillAlpha ?? 0
const MRIR_FILL = RING_STYLE.effectorDoctrinal.fillAlpha ?? 0

/** Fill damping on the airspace basemap, and the lift while a sensor holds a
 *  detection. Multipliers on the style alpha, not alphas of their own. */
const DIM_FILL = 0.4
/** Opacity of an at-rest ring group on the airspace basemap. */
const DIM_REST = 0.45
const ACTIVE_FILL = 2
/** Stroke width of the ring that marks a live detection, screen px. */
const ACTIVE_STROKE_PX = 2
/** The placard ring reads as a reference when the Pd contours draw over it. */
const BEHIND_OPACITY = 0.5
/** Label anchor bearings: sensor rings north-east, effector rings north-west. */
const SENSOR_LABEL_BRG = 45
const EFFECTOR_LABEL_BRG = 315
/** Jammer footprint wedge: a flat tint and edge in the EW ink, like a flashlight beam. */
const FOOTPRINT_FILL = 0.09
const FOOTPRINT_EDGE = 0.7
/** Label text box and its gap from the ring, screen px. */
const LABEL_BOX_PX = 150
const LABEL_GAP_PX = 4

/** Ring fill alpha: the style value, damped on the airspace basemap and
 *  lifted while the sensor holds a detection. */
function fillFor(base: number, dim: boolean, active: boolean): number {
  if (dim) return base * DIM_FILL
  return active ? base * ACTIVE_FILL : base
}

interface RingProps {
  entity: Entity
  sectorDeg: number
  radiusM: number
  fill?: string
  fillOpacity?: number
  stroke?: string
  strokeWidth?: number
  dash?: number[] | null
  strokeOpacity?: number
  lineCap?: 'round'
  /** Stroke only the arc of a sector, without the spokes. The fill keeps the wedge. */
  arc?: boolean
}

/** A full circle or a sector wedge, whichever the sector angle asks for. */
function Ring({
  entity,
  sectorDeg,
  radiusM,
  fill,
  fillOpacity,
  stroke,
  strokeWidth,
  dash,
  strokeOpacity,
  lineCap,
  arc,
}: RingProps) {
  const { x, y } = entity.pos
  const headingDeg = entity.headingDeg
  // One wedge per ring, shared by the fill and the stroke node: Konva compares
  // point arrays by identity.
  const wedge = useMemo(
    () =>
      sectorDeg >= 360 || !(radiusM > 0)
        ? null
        : wedgePoints({ x, y }, headingDeg, sectorDeg, radiusM),
    [x, y, headingDeg, sectorDeg, radiusM],
  )
  // The wedge less its center point is the bare arc.
  const arcPoints = useMemo(() => (wedge && arc ? wedge.slice(2) : null), [wedge, arc])
  if (!(radiusM > 0)) return null
  const full = sectorDeg >= 360
  const fillNode =
    fill != null ? (
      full ? (
        <Circle
          x={entity.pos.x}
          y={entity.pos.y}
          radius={radiusM}
          fill={fill}
          opacity={fillOpacity}
        />
      ) : (
        <Line points={wedge!} closed fill={fill} opacity={fillOpacity} />
      )
    ) : null
  const strokeNode =
    stroke != null ? (
      full ? (
        <Circle
          x={entity.pos.x}
          y={entity.pos.y}
          radius={radiusM}
          stroke={stroke}
          strokeWidth={strokeWidth ?? 1}
          dash={dash ?? undefined}
          lineCap={lineCap}
          strokeScaleEnabled={false}
          opacity={strokeOpacity}
        />
      ) : (
        <Line
          points={arcPoints ?? wedge!}
          closed={arcPoints == null}
          stroke={stroke}
          strokeWidth={strokeWidth ?? 1}
          dash={dash ?? undefined}
          lineCap={lineCap}
          strokeScaleEnabled={false}
          opacity={strokeOpacity}
        />
      )
    ) : null
  return (
    <>
      {fillNode}
      {strokeNode}
    </>
  )
}

interface RestRingProps {
  entity: Entity
  sectorDeg: number
  radiusM: number
  style: RestStroke
  ink: string
  arc?: boolean
}

/** An at-rest ring: a dashed edge in the idle ink, no fill. */
function RestRing({ entity, sectorDeg, radiusM, style, ink, arc }: RestRingProps) {
  return (
    <Ring
      entity={entity}
      sectorDeg={sectorDeg}
      radiusM={radiusM}
      stroke={ink}
      strokeWidth={style.width}
      dash={style.dash}
      strokeOpacity={style.opacity}
      lineCap={style.lineCap}
      arc={arc}
    />
  )
}

interface RingLabelProps {
  pos: Vec2
  radiusM: number
  /** Bearing of the anchor point on the ring, degrees. */
  bearing: number
  text: string
  ink: BoardInk
}

/**
 * Ring caption in the label ink over a board-tone glyph halo, at a fixed bearing on
 * the ring. The group counter-scales the stage transform, so the inner units are
 * screen px. The label is the only footprint node that reads the zoom.
 */
function RingLabel({ pos, radiusM, bearing, text, ink }: RingLabelProps) {
  const scale = useStore((s) => s.camera.scale)
  if (!(radiusM > 0) || !(scale > 0)) return null
  const p = destination(pos, bearing, radiusM)
  const right = bearing > 180
  return (
    <Group x={p.x} y={p.y} scaleX={1 / scale} scaleY={1 / scale} listening={false}>
      <Text
        fontFamily="JetBrains Mono"
        x={right ? -LABEL_BOX_PX - LABEL_GAP_PX : LABEL_GAP_PX}
        y={-LABEL_FONT_PX - LABEL_GAP_PX}
        width={LABEL_BOX_PX}
        align={right ? 'right' : 'left'}
        text={text}
        fontSize={LABEL_FONT_PX}
        fill={ink.label}
        stroke={ink.board}
        strokeWidth={LABEL_HALO_PX}
        lineJoin="round"
        fillAfterStrokeEnabled
        listening={false}
      />
    </Group>
  )
}

interface NodeProps<R> {
  r: R
  dim: boolean
  /** Selected, or active in the run: the solid, filled style. */
  active: boolean
  /** The theme's board ink: `ringIdle` for a resting edge, the resolved ring token when active. */
  ink: BoardInk
}

const SensorNode = memo(function SensorNode({
  r,
  dim,
  active,
  hot,
  ink,
}: NodeProps<SensorRings> & {
  /** The sensor holds a track at the run time cursor. */
  hot: boolean
}) {
  const e = r.entity
  const idleInk = ink.ringIdle
  const color = resolveRingInk(r.ink, ink)
  if (ringState(active, r.grey) === 'rest') {
    // Every sensor ring rests in one idle dash. The band has no edge, so it rests unseen.
    return (
      <Group listening={false} opacity={dim ? DIM_REST : 1}>
        {[r.placardM, r.contourLowM, r.contourHighM, r.classifyM].map((radiusM, i) =>
          radiusM != null ? (
            <RestRing
              key={i}
              entity={e}
              sectorDeg={r.sectorDeg}
              radiusM={radiusM}
              style={SENSOR_REST}
              ink={idleInk}
            />
          ) : null,
        )}
      </Group>
    )
  }
  const strokeOpacity = r.grey ? 0.35 : dim ? 0.3 : 0.7
  // The highlight rides the lower Pd contour when it draws, else the placard ring.
  const hotContour = hot && r.contourLowM != null
  const bandOpacity = fillFor(ENVELOPE_FILL, dim, hot)
  return (
    <Group listening={false}>
      {r.band != null &&
        (r.sectorDeg >= 360 ? (
          <KonvaRing
            x={e.pos.x}
            y={e.pos.y}
            innerRadius={r.band.innerM}
            outerRadius={r.band.outerM}
            fill={color}
            opacity={bandOpacity}
          />
        ) : (
          <Arc
            x={e.pos.x}
            y={e.pos.y}
            innerRadius={r.band.innerM}
            outerRadius={r.band.outerM}
            angle={r.sectorDeg}
            rotation={e.headingDeg - 90 - r.sectorDeg / 2}
            fill={color}
            opacity={bandOpacity}
          />
        ))}
      {r.placardM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.placardM}
          fill={r.placardFill ? color : undefined}
          fillOpacity={fillFor(PLACARD_FILL, dim, hot)}
          stroke={color}
          strokeWidth={hot && !hotContour ? ACTIVE_STROKE_PX : RING_STYLE.sensorPlacard.width}
          dash={r.placardDash}
          strokeOpacity={r.behind ? strokeOpacity * BEHIND_OPACITY : strokeOpacity}
        />
      )}
      {r.contourLowM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.contourLowM}
          fill={r.contourFill ? color : undefined}
          fillOpacity={fillFor(CONTOUR_FILL, dim, hot)}
          stroke={color}
          strokeWidth={hotContour ? ACTIVE_STROKE_PX : RING_STYLE.sensorPdContours.width}
          dash={RING_STYLE.sensorPdContours.dash}
          strokeOpacity={strokeOpacity}
        />
      )}
      {r.contourHighM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.contourHighM}
          stroke={color}
          strokeWidth={RING_STYLE.sensorPdContours.width}
          dash={PD_HIGH_DASH}
          strokeOpacity={strokeOpacity}
        />
      )}
      {r.classifyM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.classifyM}
          stroke={color}
          strokeWidth={RING_STYLE.classifyRings.width}
          dash={RING_STYLE.classifyRings.dash}
          strokeOpacity={dim ? 0.25 : 0.5}
        />
      )}
      {r.lowLabel != null && r.contourLowM != null && (
        <RingLabel
          pos={e.pos}
          radiusM={r.contourLowM}
          bearing={SENSOR_LABEL_BRG}
          text={r.lowLabel}
          ink={ink}
        />
      )}
      {r.highLabel != null && r.contourHighM != null && (
        <RingLabel
          pos={e.pos}
          radiusM={r.contourHighM}
          bearing={SENSOR_LABEL_BRG}
          text={r.highLabel}
          ink={ink}
        />
      )}
    </Group>
  )
})

const EffectorNode = memo(function EffectorNode({ r, dim, active, ink }: NodeProps<EffectorRings>) {
  const e = r.entity
  const idleInk = ink.ringIdle
  const color = resolveRingInk(r.ink, ink)
  if (ringState(active, r.off) === 'rest') {
    return (
      <Group listening={false} opacity={dim ? DIM_REST : 1}>
        {r.maxM != null && (
          <RestRing
            entity={e}
            sectorDeg={r.sectorDeg}
            radiusM={r.maxM}
            style={MIR_REST}
            ink={idleInk}
          />
        )}
        {r.mrirM != null && (
          <RestRing
            entity={e}
            sectorDeg={r.sectorDeg}
            radiusM={r.mrirM}
            style={MRIR_REST}
            ink={idleInk}
            arc
          />
        )}
        {r.minM != null && (
          <RestRing entity={e} sectorDeg={360} radiusM={r.minM} style={MIN_REST} ink={idleInk} />
        )}
      </Group>
    )
  }
  return (
    <Group listening={false} opacity={r.off ? 0.2 : dim ? 0.35 : 0.8}>
      {r.maxM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.maxM}
          fill={color}
          fillOpacity={MAX_RANGE_FILL}
          stroke={color}
          strokeWidth={RING_STYLE.effectorMaxRange.width}
          dash={RING_STYLE.effectorMaxRange.dash}
        />
      )}
      {/* The inner fill makes the zone inside MRIR read darker than the MIR band. */}
      {r.mrirM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.mrirM}
          fill={r.off ? undefined : color}
          fillOpacity={MRIR_FILL}
          stroke={color}
          strokeWidth={RING_STYLE.effectorDoctrinal.width}
          dash={RING_STYLE.effectorDoctrinal.dash}
          arc
        />
      )}
      {r.minM != null && (
        <Ring
          entity={e}
          sectorDeg={360}
          radiusM={r.minM}
          stroke={color}
          strokeWidth={RING_STYLE.effectorMinRange.width}
          dash={RING_STYLE.effectorMinRange.dash}
          strokeOpacity={0.6}
        />
      )}
      {/* 2525D range fan words. Only an active, enabled effector carries them. */}
      {!r.off && r.maxM != null && (
        <RingLabel
          pos={e.pos}
          radiusM={r.maxM}
          bearing={EFFECTOR_LABEL_BRG}
          text={RING_LABEL_TEXT.effectorMaxRange}
          ink={ink}
        />
      )}
      {!r.off && r.minM != null && (
        <RingLabel
          pos={e.pos}
          radiusM={r.minM}
          bearing={EFFECTOR_LABEL_BRG}
          text={RING_LABEL_TEXT.effectorMinRange}
          ink={ink}
        />
      )}
    </Group>
  )
})

/**
 * A jammer footprint: a wedge in the EW ink from the jammer toward its sector, a flat
 * faint tint with a thin edge. Its angle is the beamwidth and its far arc the effective
 * jam range against the selected threat, the same figure assessJam and the sim window
 * use. The MRIR draws as an arc inside the beam. At rest the cone is a dashed outline;
 * a disabled jammer keeps the grey token.
 */
const JammerNode = memo(function JammerNode({ r, dim, active, ink }: NodeProps<JammerRings>) {
  const e = r.entity
  const idleInk = ink.ringIdle
  // The friendly EW effect owns the footprint, so the EW ink replaces the system ink.
  const color = r.ink === 'grey' ? resolveRingInk(r.ink, ink) : ink.ew
  const rangeM = r.rangeM ?? 0
  const full = r.sectorDeg >= 360
  const { x, y } = e.pos
  const headingDeg = e.headingDeg
  const sectorDeg = r.sectorDeg
  // One cone outline for both the fill and the edge stroke.
  const wedge = useMemo(
    () => (sectorDeg >= 360 ? null : wedgePoints({ x, y }, headingDeg, sectorDeg, rangeM)),
    [x, y, headingDeg, sectorDeg, rangeM],
  )
  if (ringState(active, r.off) === 'rest') {
    return (
      <Group listening={false} opacity={dim ? DIM_REST : 1}>
        {r.rangeM != null && (
          <RestRing
            entity={e}
            sectorDeg={sectorDeg}
            radiusM={rangeM}
            style={MIR_REST}
            ink={idleInk}
          />
        )}
        {r.mrirM != null && (
          <RestRing
            entity={e}
            sectorDeg={sectorDeg}
            radiusM={r.mrirM}
            style={MRIR_REST}
            ink={idleInk}
            arc
          />
        )}
        {r.minM != null && (
          <RestRing entity={e} sectorDeg={360} radiusM={r.minM} style={MIN_REST} ink={idleInk} />
        )}
      </Group>
    )
  }
  return (
    <Group listening={false} opacity={r.off ? 0.2 : dim ? 0.35 : 0.85}>
      {r.rangeM != null &&
        (full ? (
          <>
            <Circle x={e.pos.x} y={e.pos.y} radius={rangeM} fill={color} opacity={FOOTPRINT_FILL} />
            <Circle
              x={e.pos.x}
              y={e.pos.y}
              radius={rangeM}
              stroke={color}
              strokeWidth={1}
              strokeScaleEnabled={false}
              opacity={FOOTPRINT_EDGE}
            />
          </>
        ) : (
          <>
            <Line points={wedge!} closed fill={color} opacity={FOOTPRINT_FILL} />
            <Line
              points={wedge!}
              closed
              stroke={color}
              strokeWidth={1}
              lineJoin="round"
              strokeScaleEnabled={false}
              opacity={FOOTPRINT_EDGE}
            />
          </>
        ))}
      {r.mrirM != null && (
        <Ring
          entity={e}
          sectorDeg={sectorDeg}
          radiusM={r.mrirM}
          stroke={color}
          strokeWidth={RING_STYLE.effectorDoctrinal.width}
          strokeOpacity={0.8}
          arc
        />
      )}
      {r.minM != null && (
        <Circle
          x={e.pos.x}
          y={e.pos.y}
          radius={r.minM}
          stroke={color}
          strokeWidth={RING_STYLE.effectorMinRange.width}
          dash={RING_STYLE.effectorMinRange.dash ?? undefined}
          strokeScaleEnabled={false}
          opacity={0.6}
        />
      )}
    </Group>
  )
})

const AssetNode = memo(function AssetNode({
  r,
  dim,
  ink,
}: {
  r: AssetRings
  dim: boolean
  ink: BoardInk
}) {
  const e = r.entity
  const color = resolveRingInk(r.ink, ink)
  return (
    <Group listening={false}>
      <Circle x={e.pos.x} y={e.pos.y} radius={r.radiusM} fill={color} opacity={dim ? 0.02 : 0.05} />
      <Circle
        x={e.pos.x}
        y={e.pos.y}
        radius={r.radiusM}
        stroke={color}
        strokeWidth={1}
        strokeScaleEnabled={false}
        opacity={dim ? 0.35 : 0.7}
      />
    </Group>
  )
})

/**
 * Sensor rings, effector rings and asset defended areas. Draw-only and never
 * listening: the records come from `src/canvas/ringModel.ts`, which the HUD
 * hit-tests over the same result. A ring against a selected threat is the engine's
 * effective range, ground projected to the plan view.
 */
export const FootprintLayer = memo(function FootprintLayer({ runActiveIds }: Props) {
  const { rings } = useRingModel()
  const dim = useStore((s) => s.ui.basemap === 'airspace')
  const selectedIds = useStore((s) => s.selection.entityIds)
  const ink = useBoardInk()
  // A system's rings are active while it is selected or active in the run; every
  // other ring rests. Each node takes a boolean, so an unchanged node keeps its draw.
  const isActive = (id: string) => runActiveIds.has(id) || selectedIds.includes(id)

  return (
    <>
      {rings.map((r) => {
        const id = r.entity.id
        if (r.kind === 'sensor') {
          return (
            <SensorNode
              key={id}
              r={r}
              dim={dim}
              active={isActive(id)}
              hot={runActiveIds.has(id)}
              ink={ink}
            />
          )
        }
        if (r.kind === 'effector') {
          return <EffectorNode key={id} r={r} dim={dim} active={isActive(id)} ink={ink} />
        }
        if (r.kind === 'jammer') {
          return <JammerNode key={id} r={r} dim={dim} active={isActive(id)} ink={ink} />
        }
        return <AssetNode key={id} r={r} dim={dim} ink={ink} />
      })}
    </>
  )
})
