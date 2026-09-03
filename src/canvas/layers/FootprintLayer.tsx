import { Circle, Group, Line } from 'react-konva'
import type { Entity } from '../../model/types'
import { entityActive, mountHeightOf } from '../../model/types'
import { useStore, modelFor } from '../../state/store'
import { wedgePoints } from '../../geometry/geo'
import { groundRangeM } from '../../geometry/slant'
import {
  effectiveClassifyRangeM,
  effectiveDetectRangeM,
  FT_TO_M,
  sensorHoldGate,
} from '../../analysis/sensorEnv'
import { effectiveJamRangeM } from '../../analysis/ewPhysics'
import { defendedRadiusOf, threatAltitudeFt } from '../../playback/sim'
import type { DetectionHit } from '../../playback/sim'
import { CLASSIFY_DASH, PLACARD_DASH, sensorRingStyle } from './footprintStyle'

interface Props {
  detections: Map<string, DetectionHit[]>
}

const DISABLED_COLOR = '#565b58'
const ASSET_COLOR = '#8fae7a'

/** '#rrggbb' to 'rgba(...)' for Konva gradient color stops. */
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
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

/** Sensor coverage, effector envelopes and asset defended areas. Never intercepts pointer events. */
export function FootprintLayer({ detections }: Props) {
  const scenario = useStore((s) => s.scenario)
  const basemap = useStore((s) => s.ui.basemap)
  // Four independent toggles share this layer: the detect wedge, the dashed
  // classify ring, the effector envelope, and the asset defended area.
  const showSensors = useStore((s) => s.ui.layers.sensorFootprints)
  const showClassify = useStore((s) => s.ui.layers.classifyRings)
  const showEffectors = useStore((s) => s.ui.layers.effectorEnvelopes)
  const showDefended = useStore((s) => s.ui.layers.defendedAreas)
  const dim = basemap === 'airspace'
  const activeSensorIds = new Set([...detections.values()].flat().map((h) => h.sensorId))
  // Sensor rings answer "who holds THIS threat, and from how far". With a
  // threat selected, every ring is the engine's effective range against that
  // threat (sensorEnv target laws) and the hold gate picks the style
  // (footprintStyle.ts): a dotted ring keeps the placard range for
  // comparison when the two differ. With nothing selected the rings show the
  // placard range against the reference condition.
  const selectedIds = useStore((s) => s.selection.entityIds)
  const selectedUas = scenario.entities.find((e) => e.kind === 'uas' && selectedIds.includes(e.id))
  const target = selectedUas ? modelFor(scenario, selectedUas)?.uas : undefined
  // The engine range is a slant range to the threat altitude, so the ring on
  // a plan-view board is its ground projection. One value per selection, not
  // one per entity: the mount height is the only per-sensor term.
  const targetAltM = selectedUas ? threatAltitudeFt(scenario, selectedUas) * FT_TO_M : null

  function sensorFootprint(e: Entity) {
    const spec = modelFor(scenario, e)?.sensor
    if (!spec) return null
    if (!showSensors && !showClassify) return null
    const on = entityActive(e)
    const scaledM = effectiveDetectRangeM(spec, scenario.environment, target)
    const dAltM = targetAltM == null ? null : targetAltM - mountHeightOf(spec)
    const style = sensorRingStyle({
      gate: sensorHoldGate(spec, target),
      on,
      placardM: effectiveDetectRangeM(spec, scenario.environment),
      scaledM: dAltM == null ? scaledM : groundRangeM(scaledM, dAltM),
      classifyM: effectiveClassifyRangeM(spec, scenario.environment, target),
    })
    const color = style.grey ? DISABLED_COLOR : (e.color ?? modelFor(scenario, e)?.color ?? '#7da7c4')
    const active = on && activeSensorIds.has(e.id)
    const fillOpacity = dim ? 0.04 : active ? 0.2 : 0.1
    const strokeOpacity = style.grey ? 0.35 : dim ? 0.3 : 0.7
    return (
      <Group key={e.id} listening={false}>
        {showSensors && style.placardM != null && (
          <Ring
            entity={e}
            sectorDeg={spec.sectorDeg}
            radiusM={style.placardM}
            stroke={color}
            strokeWidth={1}
            dash={PLACARD_DASH}
            strokeOpacity={strokeOpacity * 0.5}
          />
        )}
        {showSensors && (
          <Ring
            entity={e}
            sectorDeg={spec.sectorDeg}
            radiusM={style.detectM}
            fill={style.fill ? color : undefined}
            fillOpacity={fillOpacity}
            stroke={color}
            strokeWidth={active && style.kind === 'held' ? 2 : 1}
            dash={style.dash}
            strokeOpacity={strokeOpacity}
          />
        )}
        {showClassify && style.classifyM != null && (
          <Ring
            entity={e}
            sectorDeg={spec.sectorDeg}
            radiusM={style.classifyM}
            stroke={color}
            strokeWidth={1}
            dash={CLASSIFY_DASH}
            strokeOpacity={dim ? 0.25 : 0.5}
          />
        )}
      </Group>
    )
  }

  function effectorFootprint(e: Entity) {
    const spec = modelFor(scenario, e)?.effector
    if (!spec) return null
    if (!showEffectors) return null
    const off = !entityActive(e)
    const color = off ? DISABLED_COLOR : (e.color ?? modelFor(scenario, e)?.color ?? '#c9975a')
    const sector = spec.sectorDeg ?? 360
    const full = sector >= 360

    // A jammer footprint is a flashlight beam, not a weapon arc: a solid-edged
    // cone whose fill fades with range the way the jam power density does. The
    // cone length is the effective range against the selected threat (power
    // out and the target's jamResistDb, the figure assessJam and the sim
    // window use), so a derated transmitter or a hardened link draws a
    // shorter beam than the placard.
    if (spec.effectorType === 'jammer') {
      const rangeM = effectiveJamRangeM(spec, target)
      const gradient = {
        fillRadialGradientStartPoint: { x: e.pos.x, y: e.pos.y },
        fillRadialGradientEndPoint: { x: e.pos.x, y: e.pos.y },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndRadius: rangeM,
        fillRadialGradientColorStops: [0, rgba(color, 0.38), 0.55, rgba(color, 0.14), 1, rgba(color, 0.02)],
      }
      return (
        <Group key={e.id} listening={false} opacity={off ? 0.2 : dim ? 0.35 : 0.85}>
          {full ? (
            <>
              <Circle x={e.pos.x} y={e.pos.y} radius={rangeM} {...gradient} />
              <Circle
                x={e.pos.x}
                y={e.pos.y}
                radius={rangeM}
                stroke={color}
                strokeWidth={1}
                strokeScaleEnabled={false}
                opacity={0.8}
              />
            </>
          ) : (
            <>
              <Line points={wedgePoints(e.pos, e.headingDeg, sector, rangeM)} closed {...gradient} />
              <Line
                points={wedgePoints(e.pos, e.headingDeg, sector, rangeM)}
                closed
                stroke={color}
                strokeWidth={1}
                strokeScaleEnabled={false}
                opacity={0.8}
              />
            </>
          )}
          {spec.minRangeM > 0 && (
            <Circle
              x={e.pos.x}
              y={e.pos.y}
              radius={spec.minRangeM}
              stroke={color}
              strokeWidth={1}
              dash={[2, 6]}
              strokeScaleEnabled={false}
              opacity={0.6}
            />
          )}
        </Group>
      )
    }

    return (
      <Group key={e.id} listening={false} opacity={off ? 0.2 : dim ? 0.35 : 0.8}>
        {full ? (
          <Circle
            x={e.pos.x}
            y={e.pos.y}
            radius={spec.maxRangeM}
            stroke={color}
            strokeWidth={1.5}
            dash={[8, 6]}
            strokeScaleEnabled={false}
          />
        ) : (
          <>
            <Line
              points={wedgePoints(e.pos, e.headingDeg, sector, spec.maxRangeM)}
              closed
              fill={color}
              opacity={0.07}
            />
            <Line
              points={wedgePoints(e.pos, e.headingDeg, sector, spec.maxRangeM)}
              closed
              stroke={color}
              strokeWidth={1.5}
              dash={[8, 6]}
              strokeScaleEnabled={false}
            />
          </>
        )}
        {spec.minRangeM > 0 && (
          <Circle
            x={e.pos.x}
            y={e.pos.y}
            radius={spec.minRangeM}
            stroke={color}
            strokeWidth={1}
            dash={[2, 6]}
            strokeScaleEnabled={false}
            opacity={0.6}
          />
        )}
      </Group>
    )
  }

  // The defended area is the boundary the engine scores arrival against
  // (defendedRadiusOf: Entity.defendedRadiusM, else the 500 m default), so
  // the ring on the board is the same distance the leaker count uses.
  function assetFootprint(e: Entity) {
    if (!showDefended) return null
    const color = e.color ?? modelFor(scenario, e)?.color ?? ASSET_COLOR
    const radiusM = defendedRadiusOf(e)
    return (
      <Group key={e.id} listening={false}>
        <Circle x={e.pos.x} y={e.pos.y} radius={radiusM} fill={color} opacity={dim ? 0.02 : 0.05} />
        <Circle
          x={e.pos.x}
          y={e.pos.y}
          radius={radiusM}
          stroke={color}
          strokeWidth={1}
          strokeScaleEnabled={false}
          opacity={dim ? 0.35 : 0.7}
        />
      </Group>
    )
  }

  return (
    <>
      {scenario.entities.map((e) => {
        if (e.kind === 'sensor') return sensorFootprint(e)
        if (e.kind === 'effector') return effectorFootprint(e)
        if (e.kind === 'asset') return assetFootprint(e)
        return null
      })}
    </>
  )
}
