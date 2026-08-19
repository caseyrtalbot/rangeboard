import { Circle, Group, Line } from 'react-konva'
import type { Entity } from '../../model/types'
import { useStore, modelFor } from '../../state/store'
import { wedgePoints } from '../../geometry/geo'
import type { DetectionHit } from '../../playback/sim'

interface Props {
  detections: Map<string, DetectionHit[]>
}

/** Sensor coverage and effector envelopes. Never intercepts pointer events. */
export function FootprintLayer({ detections }: Props) {
  const scenario = useStore((s) => s.scenario)
  const basemap = useStore((s) => s.ui.basemap)
  const dim = basemap === 'airspace'
  const activeSensorIds = new Set([...detections.values()].flat().map((h) => h.sensorId))

  function sensorFootprint(e: Entity) {
    const spec = modelFor(scenario, e)?.sensor
    if (!spec) return null
    const color = e.color ?? modelFor(scenario, e)?.color ?? '#4fa3ff'
    const active = activeSensorIds.has(e.id)
    const fillOpacity = dim ? 0.04 : active ? 0.2 : 0.1
    const full = spec.sectorDeg >= 360
    return (
      <Group key={e.id} listening={false}>
        {full ? (
          <Circle
            x={e.pos.x}
            y={e.pos.y}
            radius={spec.detectRangeM}
            fill={color}
            opacity={fillOpacity}
          />
        ) : (
          <Line
            points={wedgePoints(e.pos, e.headingDeg, spec.sectorDeg, spec.detectRangeM)}
            closed
            fill={color}
            opacity={fillOpacity}
          />
        )}
        {full ? (
          <Circle
            x={e.pos.x}
            y={e.pos.y}
            radius={spec.detectRangeM}
            stroke={color}
            strokeWidth={active ? 2 : 1}
            strokeScaleEnabled={false}
            opacity={dim ? 0.3 : 0.7}
          />
        ) : (
          <Line
            points={wedgePoints(e.pos, e.headingDeg, spec.sectorDeg, spec.detectRangeM)}
            closed
            stroke={color}
            strokeWidth={active ? 2 : 1}
            strokeScaleEnabled={false}
            opacity={dim ? 0.3 : 0.7}
          />
        )}
        {spec.classifyRangeM != null && spec.classifyRangeM > 0 && (
          <Circle
            x={e.pos.x}
            y={e.pos.y}
            radius={spec.classifyRangeM}
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
    const color = e.color ?? modelFor(scenario, e)?.color ?? '#ff7a5c'
    return (
      <Group key={e.id} listening={false} opacity={dim ? 0.35 : 0.8}>
        <Circle
          x={e.pos.x}
          y={e.pos.y}
          radius={spec.maxRangeM}
          stroke={color}
          strokeWidth={1.5}
          dash={[8, 6]}
          strokeScaleEnabled={false}
        />
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
