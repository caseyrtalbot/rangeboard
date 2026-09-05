import { Circle, Group, Line, Text } from 'react-konva'
import { useStore } from '../../state/store'
import { modelFor, pathSpeed } from '../../model/scenario'
import { pathExhaustionPoint, rangeBasis, rangeCurvePoints } from '../../analysis/range'
import { formatDistance } from '../../geometry/geo'

/**
 * Wind-adjusted range rings for drones with showRange on, plus an endurance
 * exhaustion marker on the flight path. Never intercepts pointer events.
 */
export function RangeLayer() {
  const scenario = useStore((s) => s.scenario)
  const camera = useStore((s) => s.camera)
  const units = useStore((s) => s.ui.units)
  const show = useStore((s) => s.ui.layers.rangeRings)
  if (!show) return null
  const env = scenario.environment

  return (
    <>
      {scenario.entities.map((e) => {
        if (e.kind !== 'uas' || !e.showRange) return null
        const uas = modelFor(scenario, e)?.uas
        if (!uas) return null
        const color = e.color ?? modelFor(scenario, e)?.color ?? '#c46a5a'
        const path = scenario.paths.find((p) => p.entityId === e.id)
        const launch = path?.points[0] ?? e.pos
        const basis = rangeBasis(uas)
        const curve = rangeCurvePoints(uas, env, launch)
        const exhaust = path
          ? pathExhaustionPoint(path.points, pathSpeed(scenario, path), uas, env)
          : null
        const k = camera.scale
        return (
          <Group key={e.id} listening={false}>
            <Line points={curve} closed fill={color} opacity={0.05} />
            <Line
              points={curve}
              closed
              stroke={color}
              strokeWidth={1.5}
              dash={[10, 5]}
              strokeScaleEnabled={false}
              opacity={0.8}
            />
            <Group x={launch.x} y={launch.y} scaleX={1 / k} scaleY={1 / k}>
              <Text
                fontFamily="JetBrains Mono"
                x={-90}
                y={-26}
                width={180}
                align="center"
                text={`max range · ${basis.source}${env.apply ? '' : ' · calm'}`}
                fontSize={10}
                fill={color}
              />
            </Group>
            {exhaust && (
              <Group x={exhaust.pos.x} y={exhaust.pos.y} scaleX={1 / k} scaleY={1 / k}>
                <Circle radius={9} stroke="#c4564a" strokeWidth={2} />
                <Line points={[-6, -6, 6, 6]} stroke="#c4564a" strokeWidth={2} />
                <Line points={[-6, 6, 6, -6]} stroke="#c4564a" strokeWidth={2} />
                <Text
                  fontFamily="JetBrains Mono"
                  x={12}
                  y={-5}
                  text={`endurance limit · ${formatDistance(exhaust.distM, units)}`}
                  fontSize={10}
                  fill="#c4564a"
                />
              </Group>
            )}
          </Group>
        )
      })}
    </>
  )
}
