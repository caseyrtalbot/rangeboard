import { useMemo } from 'react'
import { Arc, Circle, Group, Line, Ring as KonvaRing, Text } from 'react-konva'
import type { Entity, Scenario, SensorSpec, Vec2 } from '../../model/types'
import {
  DEFAULT_REQUIREMENT_THRESHOLDS,
  effectiveDoctrine,
  entityActive,
  mountHeightOf,
} from '../../model/types'
import type { UiState } from '../../state/store'
import { modelFor, ringVisible, useStore } from '../../state/store'
import { destination, formatDistance, wedgePoints } from '../../geometry/geo'
import { groundRangeM } from '../../geometry/slant'
import {
  effectiveClassifyRangeM,
  effectiveDetectRangeM,
  FT_TO_M,
  pdContoursM,
  radarPdModeled,
  sensorHoldGate,
} from '../../analysis/sensorEnv'
import { commitPkFor } from '../../analysis/doctrineFactors'
import { effectiveJamRangeM } from '../../analysis/ewPhysics'
import { DEFAULT_PK } from '../../playback/attrition'
import { defendedRadiusOf, threatAltitudeFt } from '../../playback/sim'
import type { DetectionHit } from '../../playback/sim'
import { LABEL_FONT_PX } from '../labelLayout'
import type { EnvelopeBand } from './footprintStyle'
import {
  COMMIT_DASH,
  commitRangeM,
  DISABLED_RING_COLOR,
  EFFECTOR_RING_COLOR,
  effectorRingStyle,
  envelopeBandM,
  PD_CONTOUR_HIGH,
  PD_HIGH_DASH,
  releaseRangeM,
  RING_STYLE,
  sensorRingStyle,
} from './footprintStyle'

interface Props {
  detections: Map<string, DetectionHit[]>
}

const ASSET_COLOR = '#8fae7a'
const SENSOR_COLOR = '#7da7c4'
/** Jammer fallback ink. A jammer keeps the entity color; every other
 *  effector draws in EFFECTOR_RING_COLOR. */
const JAMMER_COLOR = '#c9975a'

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

/** '#rrggbb' to 'rgba(...)' for Konva gradient color stops. */
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Ring fill alpha: the style value, damped on the airspace basemap and
 *  lifted while the sensor holds a detection. */
function fillFor(base: number, dim: boolean, active: boolean): number {
  if (dim) return base * DIM_FILL
  return active ? base * ACTIVE_FILL : base
}

/** Commit Pk in a label: up to two decimals, no trailing zero. */
function formatPk(pk: number): string {
  return String(Math.round(pk * 100) / 100)
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
function Ring({ entity, sectorDeg, radiusM, fill, fillOpacity, stroke, strokeWidth, dash, strokeOpacity }: RingProps) {
  if (!(radiusM > 0)) return null
  const full = sectorDeg >= 360
  const fillNode =
    fill != null ? (
      full ? (
        <Circle x={entity.pos.x} y={entity.pos.y} radius={radiusM} fill={fill} opacity={fillOpacity} />
      ) : (
        <Line points={wedgePoints(entity.pos, entity.headingDeg, sectorDeg, radiusM)} closed fill={fill} opacity={fillOpacity} />
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
          points={wedgePoints(entity.pos, entity.headingDeg, sectorDeg, radiusM)}
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
  /** camera.scale, pixels per meter. */
  scale: number
}

/**
 * Ring caption in the entity label font, at a fixed bearing on the ring. The
 * group counter-scales the stage transform, so the inner units are screen px.
 * A north-west anchor reads right so the text runs away from the ring.
 */
function RingLabel({ pos, radiusM, bearing, text, color, scale }: RingLabelProps) {
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

interface SensorRings {
  kind: 'sensor'
  entity: Entity
  sectorDeg: number
  color: string
  /** The sensor holds this threat: only a held sensor takes the active highlight. */
  held: boolean
  grey: boolean
  /** Detect band over the placed threats, or null when the key is off. */
  band: EnvelopeBand | null
  placardM: number | null
  placardDash: number[] | null
  placardFill: boolean
  /** A Pd contour draws over the placard ring, so the placard steps back. */
  behind: boolean
  contourLowM: number | null
  contourHighM: number | null
  contourFill: boolean
  lowLabel: string | null
  highLabel: string | null
  classifyM: number | null
}

interface EffectorRings {
  kind: 'effector'
  entity: Entity
  sectorDeg: number
  color: string
  off: boolean
  maxM: number | null
  minM: number | null
  releaseM: number | null
  commitM: number | null
  releaseLabel: string | null
  commitLabel: string | null
}

interface JammerRings {
  kind: 'jammer'
  entity: Entity
  sectorDeg: number
  color: string
  off: boolean
  rangeM: number | null
  minM: number | null
}

interface AssetRings {
  kind: 'asset'
  entity: Entity
  color: string
  radiusM: number
}

type EntityRings = SensorRings | EffectorRings | JammerRings | AssetRings

/**
 * Every ring the board draws, one record per entity. Pure over the scenario,
 * the ring visibility and the selected threat, so the memo that calls it does
 * no work on a playback frame. Visibility is `ringVisible`: the per-entity
 * override, else ui.layers.
 */
function buildRings(scenario: Scenario, ui: UiState, selectedUasId: string | null): EntityRings[] {
  const env = scenario.environment
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
  const pdLow = thresholds.pdDetect
  const doctrine = effectiveDoctrine(scenario)
  const units = ui.units
  const selectedUas = selectedUasId ? scenario.entities.find((e) => e.id === selectedUasId) : undefined
  const target = selectedUas ? modelFor(scenario, selectedUas)?.uas : undefined
  // The engine range is a slant range to the threat altitude, so a ring on a
  // plan-view board is its ground projection. The mount height is the only
  // per-entity term.
  const targetAltM = selectedUas ? threatAltitudeFt(scenario, selectedUas) * FT_TO_M : null

  // Every threat on the board feeds the envelope band. Each entity carries its
  // own altitude, so two ships of one model can project to two ranges.
  const threats = scenario.entities.flatMap((u) => {
    if (u.kind !== 'uas') return []
    const spec = modelFor(scenario, u)?.uas
    if (!spec) return []
    return [{ spec, altM: threatAltitudeFt(scenario, u) * FT_TO_M }]
  })

  function envelopeFor(spec: SensorSpec): EnvelopeBand | null {
    const rs: number[] = []
    for (const t of threats) {
      const gate = sensorHoldGate(spec, t.spec)
      if (gate !== 'ok' && gate !== 'needs-cue') continue
      const r = effectiveDetectRangeM(spec, env, t.spec, pdLow)
      rs.push(groundRangeM(r, t.altM - mountHeightOf(spec)))
    }
    return envelopeBandM(rs)
  }

  const out: EntityRings[] = []
  for (const e of scenario.entities) {
    const model = modelFor(scenario, e)

    if (e.kind === 'sensor') {
      const spec = model?.sensor
      if (!spec) continue
      const placardOn = ringVisible(ui, e.id, 'sensorPlacard')
      const envelopeOn = ringVisible(ui, e.id, 'sensorEnvelope')
      const contoursOn = ringVisible(ui, e.id, 'sensorPdContours')
      const classifyOn = ringVisible(ui, e.id, 'classifyRings')
      if (!placardOn && !envelopeOn && !contoursOn && !classifyOn) continue
      const dAltM = targetAltM == null ? null : targetAltM - mountHeightOf(spec)
      const project = (m: number) => (dAltM == null ? m : groundRangeM(m, dAltM))
      let pdLowM: number | null = null
      let pdHighM: number | null = null
      if (target) {
        const [low, high] = pdContoursM(spec, env, target, [pdLow, PD_CONTOUR_HIGH])
        pdLowM = project(low)
        // Only a radar under the Pd model has a second contour. Every other
        // sensor keeps its scaled range as the lower contour.
        pdHighM = radarPdModeled(spec, target) ? project(high) : null
      }
      const classifySlantM = effectiveClassifyRangeM(spec, env, target)
      const style = sensorRingStyle({
        gate: sensorHoldGate(spec, target),
        on: entityActive(e),
        // The placard is a reference condition, so it is never target scaled
        // and never projected.
        placardM: effectiveDetectRangeM(spec, env),
        pdLowM,
        pdHighM,
        classifyM: classifySlantM == null ? null : project(classifySlantM),
        contoursOn: contoursOn && target != null,
        envelopeOn,
      })
      const color = style.grey ? DISABLED_RING_COLOR : (e.color ?? model?.color ?? SENSOR_COLOR)
      out.push({
        kind: 'sensor',
        entity: e,
        sectorDeg: spec.sectorDeg,
        color,
        held: style.kind === 'held',
        grey: style.grey,
        band: envelopeOn && !style.grey ? envelopeFor(spec) : null,
        placardM: placardOn ? style.placardM : null,
        placardDash: style.placardDash,
        placardFill: placardOn && style.placardFill,
        behind: style.contourLowM != null || style.contourHighM != null,
        contourLowM: style.contourLowM,
        contourHighM: style.contourHighM,
        contourFill: style.contourFill,
        lowLabel:
          style.contourLowM == null
            ? null
            : `Pd ${pdLow} · ${formatDistance(style.contourLowM, units)}`,
        highLabel:
          style.contourHighM == null
            ? null
            : `Pd ${PD_CONTOUR_HIGH} · ${formatDistance(style.contourHighM, units)}`,
        classifyM: classifyOn ? style.classifyM : null,
      })
      continue
    }

    if (e.kind === 'effector') {
      const spec = model?.effector
      if (!spec) continue
      const maxOn = ringVisible(ui, e.id, 'effectorMaxRange')
      const minOn = ringVisible(ui, e.id, 'effectorMinRange')
      const doctrinalOn = ringVisible(ui, e.id, 'effectorDoctrinal')
      const off = !entityActive(e)
      const sectorDeg = spec.sectorDeg ?? 360

      // A jammer keeps the flashlight cone: illumination, not a weapon arc.
      // No danger ink, no ground projection, no doctrinal ring. The min
      // circle stays under the cone key, as before the ring split.
      if (spec.effectorType === 'jammer') {
        if (!maxOn) continue
        out.push({
          kind: 'jammer',
          entity: e,
          sectorDeg,
          color: off ? DISABLED_RING_COLOR : (e.color ?? model?.color ?? JAMMER_COLOR),
          off,
          rangeM: maxOn ? effectiveJamRangeM(spec, target) : null,
          minM: spec.minRangeM > 0 ? spec.minRangeM : null,
        })
        continue
      }

      if (!maxOn && !minOn && !doctrinalOn) continue
      const dAltM = targetAltM == null ? null : targetAltM - mountHeightOf(spec)
      const project = (m: number) => (dAltM == null ? m : groundRangeM(m, dAltM))
      let releaseM: number | null = null
      let commitM: number | null = null
      let commitPk = 0
      // Legacy release has no launch point, so doctrine off means no
      // doctrinal ring at all.
      if (target && doctrinalOn && doctrine.enabled) {
        const basePk = spec.pk ?? DEFAULT_PK[spec.effectorType]
        commitPk = commitPkFor(spec, doctrine)
        const commitSlantM = commitRangeM({
          basePk,
          uas: target,
          commitPk,
          maxRangeM: spec.maxRangeM,
        })
        const releaseSlantM = releaseRangeM(doctrine, spec.maxRangeM, commitSlantM)
        commitM = commitSlantM == null ? null : project(commitSlantM)
        releaseM = releaseSlantM == null ? null : project(releaseSlantM)
      }
      const style = effectorRingStyle({
        on: entityActive(e),
        maxM: project(spec.maxRangeM),
        minM: project(spec.minRangeM),
        releaseM,
        commitM,
      })
      const color = style.grey ? DISABLED_RING_COLOR : EFFECTOR_RING_COLOR
      out.push({
        kind: 'effector',
        entity: e,
        sectorDeg,
        color,
        off,
        maxM: maxOn ? style.maxM : null,
        minM: minOn ? style.minM : null,
        releaseM: style.releaseM,
        commitM: style.commitM,
        releaseLabel:
          style.releaseM == null ? null : `REL ${formatDistance(style.releaseM, units)}`,
        commitLabel:
          style.commitM == null
            ? null
            : `Pk ${formatPk(commitPk)} · ${formatDistance(style.commitM, units)}`,
      })
      continue
    }

    // The defended area is the boundary the engine scores arrival against
    // (defendedRadiusOf: Entity.defendedRadiusM, else the 500 m default), so
    // the ring on the board is the same distance the leaker count uses.
    if (e.kind === 'asset' && ui.layers.defendedAreas) {
      out.push({
        kind: 'asset',
        entity: e,
        color: e.color ?? model?.color ?? ASSET_COLOR,
        radiusM: defendedRadiusOf(e),
      })
    }
  }
  return out
}

function SensorNode({
  r,
  dim,
  scale,
  active,
}: { r: SensorRings; dim: boolean; scale: number; active: boolean }) {
  const e = r.entity
  const strokeOpacity = r.grey ? 0.35 : dim ? 0.3 : 0.7
  const hot = active && r.held
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
          scale={scale}
        />
      )}
      {r.highLabel != null && r.contourHighM != null && (
        <RingLabel
          pos={e.pos}
          radiusM={r.contourHighM}
          bearing={SENSOR_LABEL_BRG}
          text={r.highLabel}
          color={r.color}
          scale={scale}
        />
      )}
    </Group>
  )
}

function EffectorNode({ r, dim, scale }: { r: EffectorRings; dim: boolean; scale: number }) {
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
          scale={scale}
        />
      )}
      {r.commitLabel != null && r.commitM != null && (
        <RingLabel
          pos={e.pos}
          radiusM={r.commitM}
          bearing={EFFECTOR_LABEL_BRG}
          text={r.commitLabel}
          color={r.color}
          scale={scale}
        />
      )}
    </Group>
  )
}

/**
 * A jammer footprint is a flashlight beam, not a weapon arc: a solid-edged
 * cone whose fill fades with range the way the jam power density does. The
 * cone length is the effective range against the selected threat (power out
 * and the target's jamResistDb, the figure assessJam and the sim window use),
 * so a derated transmitter or a hardened link draws a shorter beam than the
 * placard.
 */
function JammerNode({ r, dim }: { r: JammerRings; dim: boolean }) {
  const e = r.entity
  const rangeM = r.rangeM ?? 0
  const full = r.sectorDeg >= 360
  const gradient = {
    fillRadialGradientStartPoint: { x: e.pos.x, y: e.pos.y },
    fillRadialGradientEndPoint: { x: e.pos.x, y: e.pos.y },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: rangeM,
    fillRadialGradientColorStops: [0, rgba(r.color, 0.38), 0.55, rgba(r.color, 0.14), 1, rgba(r.color, 0.02)],
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
            <Line points={wedgePoints(e.pos, e.headingDeg, r.sectorDeg, rangeM)} closed {...gradient} />
            <Line
              points={wedgePoints(e.pos, e.headingDeg, r.sectorDeg, rangeM)}
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
}

function AssetNode({ r, dim }: { r: AssetRings; dim: boolean }) {
  const e = r.entity
  return (
    <Group listening={false}>
      <Circle x={e.pos.x} y={e.pos.y} radius={r.radiusM} fill={r.color} opacity={dim ? 0.02 : 0.05} />
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
}

/**
 * Sensor rings, effector rings and asset defended areas. Never intercepts
 * pointer events.
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
export function FootprintLayer({ detections }: Props) {
  const scenario = useStore((s) => s.scenario)
  const ui = useStore((s) => s.ui)
  const scale = useStore((s) => s.camera.scale)
  const selectedUasId = useStore((s) => {
    const hit = s.scenario.entities.find(
      (e) => e.kind === 'uas' && s.selection.entityIds.includes(e.id),
    )
    return hit?.id ?? null
  })
  const dim = ui.basemap === 'airspace'
  const activeSensorIds = new Set([...detections.values()].flat().map((h) => h.sensorId))
  // Ring geometry is scenario work, so it must not run on a playback frame.
  // `detections` changes every frame and is not a key here; `ui` changes only
  // on a user action, so it is a safe key.
  const rings = useMemo(() => buildRings(scenario, ui, selectedUasId), [scenario, ui, selectedUasId])

  return (
    <>
      {rings.map((r) => {
        if (r.kind === 'sensor') {
          return (
            <SensorNode
              key={r.entity.id}
              r={r}
              dim={dim}
              scale={scale}
              active={r.held && activeSensorIds.has(r.entity.id)}
            />
          )
        }
        if (r.kind === 'effector') return <EffectorNode key={r.entity.id} r={r} dim={dim} scale={scale} />
        if (r.kind === 'jammer') return <JammerNode key={r.entity.id} r={r} dim={dim} />
        return <AssetNode key={r.entity.id} r={r} dim={dim} />
      })}
    </>
  )
}
