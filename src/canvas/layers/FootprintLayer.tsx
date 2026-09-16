import { memo, useMemo } from 'react'
import { Arc, Circle, Group, Line, Ring as KonvaRing, Text } from 'react-konva'
import type { Entity, Vec2 } from '../../model/types'
import { useStore } from '../../state/store'
import { destination, wedgePoints } from '../../geometry/geo'
import { withAlpha } from '../../ui/ink'
import { LABEL_FONT_PX } from '../labelLayout'
import type { AssetRings, EffectorRings, JammerRings, SensorRings } from '../ringModel'
import { useRingModel } from '../useRingModel'
import { COMMIT_DASH, PD_HIGH_DASH, RING_STYLE } from './footprintStyle'

interface Props {
  /** Measured or held sensors at the trial horizon; coast alone does not light a ring. */
  activeSensorIds: Set<string>
}

// Fill alphas come from the one style source, never from a literal here.
const PLACARD_FILL = RING_STYLE.sensorPlacard.fillAlpha ?? 0
const ENVELOPE_FILL = RING_STYLE.sensorEnvelope.fillAlpha ?? 0
const CONTOUR_FILL = RING_STYLE.sensorPdContours.fillAlpha ?? 0
const MAX_RANGE_FILL = RING_STYLE.effectorMaxRange.fillAlpha ?? 0

/** Fill damping on the airspace basemap, and the lift while a sensor holds a
 *  detection. Multipliers on the style alpha, not alphas of their own. */
const DIM_FILL = 0.4
const ACTIVE_FILL = 2
/** Stroke width of the ring that marks a live detection, screen px. */
const ACTIVE_STROKE_PX = 2
/** The placard ring reads as a reference when the Pd contours draw over it. */
const BEHIND_OPACITY = 0.5
/** Label anchor bearings: sensor rings north-east, effector rings north-west. */
const SENSOR_LABEL_BRG = 45
const EFFECTOR_LABEL_BRG = 315
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
}: RingProps) {
  const { x, y } = entity.pos
  const headingDeg = entity.headingDeg
  // One wedge per ring, shared by the fill and the stroke node: Konva compares
  // point arrays by identity, so a fresh array per render repaints the layer.
  const wedge = useMemo(
    () =>
      sectorDeg >= 360 || !(radiusM > 0)
        ? null
        : wedgePoints({ x, y }, headingDeg, sectorDeg, radiusM),
    [x, y, headingDeg, sectorDeg, radiusM],
  )
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
          strokeScaleEnabled={false}
          opacity={strokeOpacity}
        />
      ) : (
        <Line
          points={wedge!}
          closed
          stroke={stroke}
          strokeWidth={strokeWidth ?? 1}
          dash={dash ?? undefined}
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

interface RingLabelProps {
  pos: Vec2
  radiusM: number
  /** Bearing of the anchor point on the ring, degrees. */
  bearing: number
  text: string
  color: string
}

/**
 * Ring caption in the entity label font, at a fixed bearing on the ring. The
 * group counter-scales the stage transform, so the inner units are screen px.
 * A north-west anchor reads right so the text runs away from the ring. The
 * label is the only footprint node that reads the zoom, so a wheel step
 * re-renders the labels and none of the rings.
 */
function RingLabel({ pos, radiusM, bearing, text, color }: RingLabelProps) {
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
        fill={color}
        listening={false}
      />
    </Group>
  )
}

const SensorNode = memo(function SensorNode({
  r,
  dim,
  active,
}: {
  r: SensorRings
  dim: boolean
  active: boolean
}) {
  const e = r.entity
  const strokeOpacity = r.grey ? 0.35 : dim ? 0.3 : 0.7
  const hot = active
  // The highlight rides the ring that answers "from how far do I see it": the
  // lower Pd contour when it draws, else the placard ring.
  const hotContour = hot && r.contourLowM != null
  const bandOpacity = fillFor(ENVELOPE_FILL, dim, active)
  return (
    <Group listening={false}>
      {r.band != null &&
        (r.sectorDeg >= 360 ? (
          <KonvaRing
            x={e.pos.x}
            y={e.pos.y}
            innerRadius={r.band.innerM}
            outerRadius={r.band.outerM}
            fill={r.color}
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
            fill={r.color}
            opacity={bandOpacity}
          />
        ))}
      {r.placardM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.placardM}
          fill={r.placardFill ? r.color : undefined}
          fillOpacity={fillFor(PLACARD_FILL, dim, active)}
          stroke={r.color}
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
          fill={r.contourFill ? r.color : undefined}
          fillOpacity={fillFor(CONTOUR_FILL, dim, active)}
          stroke={r.color}
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
          stroke={r.color}
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
          stroke={r.color}
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
          color={r.color}
        />
      )}
      {r.highLabel != null && r.contourHighM != null && (
        <RingLabel
          pos={e.pos}
          radiusM={r.contourHighM}
          bearing={SENSOR_LABEL_BRG}
          text={r.highLabel}
          color={r.color}
        />
      )}
    </Group>
  )
})

const EffectorNode = memo(function EffectorNode({ r, dim }: { r: EffectorRings; dim: boolean }) {
  const e = r.entity
  return (
    <Group listening={false} opacity={r.off ? 0.2 : dim ? 0.35 : 0.8}>
      {r.maxM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.maxM}
          fill={r.color}
          fillOpacity={MAX_RANGE_FILL}
          stroke={r.color}
          strokeWidth={RING_STYLE.effectorMaxRange.width}
          dash={RING_STYLE.effectorMaxRange.dash}
        />
      )}
      {r.minM != null && (
        <Ring
          entity={e}
          sectorDeg={360}
          radiusM={r.minM}
          stroke={r.color}
          strokeWidth={RING_STYLE.effectorMinRange.width}
          dash={RING_STYLE.effectorMinRange.dash}
          strokeOpacity={0.6}
        />
      )}
      {r.releaseM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.releaseM}
          stroke={r.color}
          strokeWidth={RING_STYLE.effectorDoctrinal.width}
          dash={RING_STYLE.effectorDoctrinal.dash}
        />
      )}
      {r.commitM != null && (
        <Ring
          entity={e}
          sectorDeg={r.sectorDeg}
          radiusM={r.commitM}
          stroke={r.color}
          strokeWidth={RING_STYLE.effectorDoctrinal.width}
          dash={COMMIT_DASH}
        />
      )}
      {r.releaseLabel != null && r.releaseM != null && (
        <RingLabel
          pos={e.pos}
          radiusM={r.releaseM}
          bearing={EFFECTOR_LABEL_BRG}
          text={r.releaseLabel}
          color={r.color}
        />
      )}
      {r.commitLabel != null && r.commitM != null && (
        <RingLabel
          pos={e.pos}
          radiusM={r.commitM}
          bearing={EFFECTOR_LABEL_BRG}
          text={r.commitLabel}
          color={r.color}
        />
      )}
    </Group>
  )
})

/**
 * A jammer footprint is a flashlight beam, not a weapon arc: a solid-edged
 * cone whose fill fades with range the way the jam power density does. The
 * cone length is the effective range against the selected threat (power out
 * and the target's jamResistDb, the figure assessJam and the sim window use),
 * so a derated transmitter or a hardened link draws a shorter beam than the
 * placard.
 */
const JammerNode = memo(function JammerNode({ r, dim }: { r: JammerRings; dim: boolean }) {
  const e = r.entity
  const rangeM = r.rangeM ?? 0
  const full = r.sectorDeg >= 360
  const { x, y } = e.pos
  const headingDeg = e.headingDeg
  const sectorDeg = r.sectorDeg
  // One cone outline for both the gradient fill and the edge stroke.
  const wedge = useMemo(
    () => (sectorDeg >= 360 ? null : wedgePoints({ x, y }, headingDeg, sectorDeg, rangeM)),
    [x, y, headingDeg, sectorDeg, rangeM],
  )
  const gradient = {
    fillRadialGradientStartPoint: { x: e.pos.x, y: e.pos.y },
    fillRadialGradientEndPoint: { x: e.pos.x, y: e.pos.y },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: rangeM,
    fillRadialGradientColorStops: [
      0,
      withAlpha(r.color, 0.38),
      0.55,
      withAlpha(r.color, 0.14),
      1,
      withAlpha(r.color, 0.02),
    ],
  }
  return (
    <Group listening={false} opacity={r.off ? 0.2 : dim ? 0.35 : 0.85}>
      {r.rangeM != null &&
        (full ? (
          <>
            <Circle x={e.pos.x} y={e.pos.y} radius={rangeM} {...gradient} />
            <Circle
              x={e.pos.x}
              y={e.pos.y}
              radius={rangeM}
              stroke={r.color}
              strokeWidth={1}
              strokeScaleEnabled={false}
              opacity={0.8}
            />
          </>
        ) : (
          <>
            <Line points={wedge!} closed {...gradient} />
            <Line
              points={wedge!}
              closed
              stroke={r.color}
              strokeWidth={1}
              strokeScaleEnabled={false}
              opacity={0.8}
            />
          </>
        ))}
      {r.minM != null && (
        <Circle
          x={e.pos.x}
          y={e.pos.y}
          radius={r.minM}
          stroke={r.color}
          strokeWidth={RING_STYLE.effectorMinRange.width}
          dash={RING_STYLE.effectorMinRange.dash ?? undefined}
          strokeScaleEnabled={false}
          opacity={0.6}
        />
      )}
    </Group>
  )
})

const AssetNode = memo(function AssetNode({ r, dim }: { r: AssetRings; dim: boolean }) {
  const e = r.entity
  return (
    <Group listening={false}>
      <Circle
        x={e.pos.x}
        y={e.pos.y}
        radius={r.radiusM}
        fill={r.color}
        opacity={dim ? 0.02 : 0.05}
      />
      <Circle
        x={e.pos.x}
        y={e.pos.y}
        radius={r.radiusM}
        stroke={r.color}
        strokeWidth={1}
        strokeScaleEnabled={false}
        opacity={dim ? 0.35 : 0.7}
      />
    </Group>
  )
})

/**
 * Sensor rings, effector rings and asset defended areas. Never intercepts
 * pointer events. Draw-only: the records come from the ring model
 * (`src/canvas/ringModel.ts`), which the HUD hit-tests over the same result.
 *
 * Seven ring keys, each with a per-entity override (`ringVisible`). Sensor
 * rings answer "who holds THIS threat, and from how far": the placard ring at
 * the reference condition, a fill-only envelope band over the placed threats,
 * the Pd contours for the selected threat, and the classify ring. Effector
 * rings answer "when may I shoot": the max and min range rings, and the
 * doctrinal release and commit-Pk rings for the selected threat. Every dash,
 * width, fill alpha and ink comes from footprintStyle.ts.
 *
 * A ring against a selected threat is the engine's effective range, ground
 * projected to the plan view. The hold gate picks the placard dash, and a
 * label prints the Pd, the release and the commit distance.
 */
export const FootprintLayer = memo(function FootprintLayer({ activeSensorIds }: Props) {
  const { rings } = useRingModel()
  const dim = useStore((s) => s.ui.basemap === 'airspace')

  return (
    <>
      {rings.map((r) => {
        if (r.kind === 'sensor') {
          return (
            <SensorNode
              key={r.entity.id}
              r={r}
              dim={dim}
              active={activeSensorIds.has(r.entity.id)}
            />
          )
        }
        if (r.kind === 'effector') return <EffectorNode key={r.entity.id} r={r} dim={dim} />
        if (r.kind === 'jammer') return <JammerNode key={r.entity.id} r={r} dim={dim} />
        return <AssetNode key={r.entity.id} r={r} dim={dim} />
      })}
    </>
  )
})
