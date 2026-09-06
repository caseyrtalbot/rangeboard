import { Circle, Group, Line, Text } from 'react-konva'
import { useStore } from '../../state/store'
import { modelFor, pathSpeed } from '../../model/scenario'
import { pathExhaustionPoint, rangeBasis, rangeCurvePoints } from '../../analysis/range'
import { formatDistance } from '../../geometry/geo'
import { DANGER_INK, entityInk } from '../../ui/ink'

/**
 * Wind-adjusted range rings for drones with showRange on, plus an endurance
 * exhaustion marker on the flight path. Never intercepts pointer events.
 */
/** Fixed dash and point arrays: an inline literal is re-set on every render. */
const RANGE_DASH = [10, 5]
const EXHAUST_X_DOWN = [-6, -6, 6, 6]
const EXHAUST_X_UP = [-6, 6, 6, -6]

export function RangeLayer() {
  const scenario = useStore((s) => s.scenario)
  // Only the scale is read; the stage transform carries the pan.
  const scale = useStore((s) => s.camera.scale)
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
        const color = entityInk(e, modelFor(scenario, e))
        const path = scenario.paths.find((p) => p.entityId === e.id)
        const launch = path?.points[0] ?? e.pos
        const basis = rangeBasis(uas)
        const curve = rangeCurvePoints(uas, env, launch)
        const exhaust = path
          ? pathExhaustionPoint(path.points, pathSpeed(scenario, path), uas, env)
          : null
        const k = scale
        return (
          <Group key={e.id} listening={false}>
            <Line points={curve} closed fill={color} opacity={0.05} />
            <Line
              points={curve}
              closed
              stroke={color}
              strokeWidth={1.5}
              dash={RANGE_DASH}
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
                <Circle radius={9} stroke={DANGER_INK} strokeWidth={2} />
                <Line points={EXHAUST_X_DOWN} stroke={DANGER_INK} strokeWidth={2} />
                <Line points={EXHAUST_X_UP} stroke={DANGER_INK} strokeWidth={2} />
                <Text
                  fontFamily="JetBrains Mono"
                  x={12}
                  y={-5}
                  text={`endurance limit · ${formatDistance(exhaust.distM, units)}`}
                  fontSize={10}
                  fill={DANGER_INK}
                />
              </Group>
            )}
          </Group>
        )
      })}
    </>
  )
}
