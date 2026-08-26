import { Circle, Group, Line } from 'react-konva'
import type { Entity } from '../../model/types'
import { entityActive } from '../../model/types'
import { useStore, modelFor } from '../../state/store'
import { wedgePoints } from '../../geometry/geo'
import { effectiveClassifyRangeM, effectiveDetectRangeM } from '../../analysis/sensorEnv'
import { effectiveJamRangeM } from '../../analysis/ewPhysics'
import type { DetectionHit } from '../../playback/sim'

interface Props {
  detections: Map<string, DetectionHit[]>
}

const DISABLED_COLOR = '#565b58'

/** '#rrggbb' to 'rgba(...)' for Konva gradient color stops. */
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Sensor coverage and effector envelopes. Never intercepts pointer events. */
export function FootprintLayer({ detections }: Props) {
  const scenario = useStore((s) => s.scenario)
  const basemap = useStore((s) => s.ui.basemap)
  // Three independent toggles share this layer: the detect wedge, the dashed
  // classify ring, and the effector envelope.
  const showSensors = useStore((s) => s.ui.layers.sensorFootprints)
  const showClassify = useStore((s) => s.ui.layers.classifyRings)
  const showEffectors = useStore((s) => s.ui.layers.effectorEnvelopes)
  const dim = basemap === 'airspace'
  const activeSensorIds = new Set([...detections.values()].flat().map((h) => h.sensorId))

  function sensorFootprint(e: Entity) {
    const spec = modelFor(scenario, e)?.sensor
    if (!spec) return null
    if (!showSensors && !showClassify) return null
    const off = !entityActive(e)
    const color = off ? DISABLED_COLOR : (e.color ?? modelFor(scenario, e)?.color ?? '#7da7c4')
    const active = !off && activeSensorIds.has(e.id)
    const fillOpacity = off ? 0.03 : dim ? 0.04 : active ? 0.2 : 0.1
    const strokeOpacity = off ? 0.25 : dim ? 0.3 : 0.7
    const full = spec.sectorDeg >= 360
    // Rings show the environment-derated small-target (Group 1) range.
    const detectRangeM = effectiveDetectRangeM(spec, scenario.environment)
    const classifyRangeM = effectiveClassifyRangeM(spec, scenario.environment)
    return (
      <Group key={e.id} listening={false}>
        {showSensors &&
          (full ? (
            <Circle
              x={e.pos.x}
              y={e.pos.y}
              radius={detectRangeM}
              fill={color}
              opacity={fillOpacity}
            />
          ) : (
            <Line
              points={wedgePoints(e.pos, e.headingDeg, spec.sectorDeg, detectRangeM)}
              closed
              fill={color}
              opacity={fillOpacity}
            />
          ))}
        {showSensors &&
          (full ? (
            <Circle
              x={e.pos.x}
              y={e.pos.y}
              radius={detectRangeM}
              stroke={color}
              strokeWidth={active ? 2 : 1}
              strokeScaleEnabled={false}
              opacity={strokeOpacity}
            />
          ) : (
            <Line
              points={wedgePoints(e.pos, e.headingDeg, spec.sectorDeg, detectRangeM)}
              closed
              stroke={color}
              strokeWidth={active ? 2 : 1}
              strokeScaleEnabled={false}
              opacity={strokeOpacity}
            />
          ))}
        {showClassify && !off && classifyRangeM != null && classifyRangeM > 0 && (
          <Circle
            x={e.pos.x}
            y={e.pos.y}
            radius={classifyRangeM}
            stroke={color}
            strokeWidth={1}
            dash={[4, 6]}
            strokeScaleEnabled={false}
            opacity={dim ? 0.25 : 0.5}
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
    // cone length is the power-scaled effective range, so a derated
    // transmitter draws a shorter beam than its placard.
    if (spec.effectorType === 'jammer') {
      const rangeM = effectiveJamRangeM(spec)
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

  return (
    <>
      {scenario.entities.map((e) => {
        if (e.kind === 'sensor') return sensorFootprint(e)
        if (e.kind === 'effector') return effectorFootprint(e)
        return null
      })}
    </>
  )
}
