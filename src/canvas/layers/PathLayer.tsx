import { Arrow, Circle, Group, Line, Text } from 'react-konva'
import type { Vec2 } from '../../model/types'
import { useStore } from '../../state/store'
import { modelFor, pathSpeed } from '../../model/scenario'
import { dist, formatDistance, pathLength } from '../../geometry/geo'
import type { LiveTrack } from '../../playback/tracks'

interface Props {
  mouseWorld: Vec2 | null
  tracks: Map<string, LiveTrack>
}

/** Flight paths, in-progress drafts, and calibration markers. */
export function PathLayer({ mouseWorld }: Props) {
  const scenario = useStore((s) => s.scenario)
  const ui = useStore((s) => s.ui)
  const camera = useStore((s) => s.camera)
  const units = useStore((s) => s.ui.units)
  const showPaths = useStore((s) => s.ui.layers.flightPaths)
  const k = camera.scale

  // The flightPaths toggle hides committed paths only. The draft below and the
  // calibrate markers always draw, or the drawing tools lose their feedback.
  const paths = (showPaths ? scenario.paths : []).map((p) => {
    const entity = scenario.entities.find((e) => e.id === p.entityId)
    if (!entity) return null
    const color = entity.color ?? modelFor(scenario, entity)?.color ?? '#c46a5a'
    const flat = p.points.flatMap((pt) => [pt.x, pt.y])
    const lengthM = pathLength(p.points)
    const etaS = lengthM / pathSpeed(scenario, p)
    const last = p.points[p.points.length - 1]
    return (
      <Group key={p.id} listening={false}>
        <Arrow
          points={flat}
          stroke={color}
          strokeWidth={1.5}
          dash={[8, 5]}
          strokeScaleEnabled={false}
          pointerLength={10 / k}
          pointerWidth={8 / k}
          fill={color}
        />
        {p.points.map((pt, i) => (
          <Circle key={i} x={pt.x} y={pt.y} radius={3 / k} fill={color} />
        ))}
        <Text fontFamily="JetBrains Mono"
          x={last.x + 8 / k}
          y={last.y}
          text={`${formatDistance(lengthM, units)} · ${Math.round(etaS)} s`}
          fontSize={11 / k}
          fill={color}
        />
      </Group>
    )
  })

  // Rubber-band draft for boundary and path tools.
  let draft = null
  if ((ui.tool === 'boundary' || ui.tool === 'path') && (ui.draftPoints.length > 0 || ui.pathEntityId)) {
    const start =
      ui.tool === 'path' && ui.pathEntityId
        ? scenario.entities.find((e) => e.id === ui.pathEntityId)?.pos
        : undefined
    const pts = start ? [start, ...ui.draftPoints] : ui.draftPoints
    const withCursor = mouseWorld ? [...pts, mouseWorld] : pts
    draft = (
      <Group listening={false}>
        <Line
          points={withCursor.flatMap((p) => [p.x, p.y])}
          stroke="#ffffff"
          strokeWidth={1.5}
          dash={[6, 4]}
          strokeScaleEnabled={false}
          opacity={0.8}
        />
        {pts.map((p, i) => (
          <Circle key={i} x={p.x} y={p.y} radius={3.5 / k} fill="#ffffff" />
        ))}
      </Group>
    )
  }

  // Calibration markers.
  let calibrate = null
  if (ui.tool === 'calibrate' && (ui.calibrateA || ui.calibrateB)) {
    const a = ui.calibrateA
    const b = ui.calibrateB ?? mouseWorld
    calibrate = (
      <Group listening={false}>
        {a && <CalMark p={a} k={k} label="A" />}
        {a && b && (
          <>
            <Line
              points={[a.x, a.y, b.x, b.y]}
              stroke="#a9b4bd"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
            />
            <Text fontFamily="JetBrains Mono"
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2 - 16 / k}
              text={formatDistance(dist(a, b), units)}
              fontSize={12 / k}
              fill="#a9b4bd"
            />
          </>
        )}
        {ui.calibrateB && <CalMark p={ui.calibrateB} k={k} label="B" />}
      </Group>
    )
  }

  return (
    <>
      {paths}
      {draft}
      {calibrate}
    </>
  )
}

function CalMark({ p, k, label }: { p: Vec2; k: number; label: string }) {
  const r = 8 / k
  return (
    <Group listening={false}>
      <Line points={[p.x - r, p.y, p.x + r, p.y]} stroke="#a9b4bd" strokeWidth={1.5} strokeScaleEnabled={false} />
      <Line points={[p.x, p.y - r, p.x, p.y + r]} stroke="#a9b4bd" strokeWidth={1.5} strokeScaleEnabled={false} />
      <Text fontFamily="JetBrains Mono" x={p.x + r} y={p.y + r} text={label} fontSize={12 / k} fill="#a9b4bd" />
    </Group>
  )
}
