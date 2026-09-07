import { memo, useMemo } from 'react'
import { Arrow, Circle, Group, Line, Text } from 'react-konva'
import type { FlightPath, Vec2 } from '../../model/types'
import type { UiState } from '../../state/store'
import { useStore } from '../../state/store'
import { modelFor, pathSpeed } from '../../model/scenario'
import { dist, formatDistance, pathLength } from '../../geometry/geo'
import { entityInk } from '../../ui/ink'

interface Props {
  mouseWorld: Vec2 | null
}

/** Fixed dash arrays: an inline literal is re-set on every render. */
const PATH_DASH = [8, 5]
const DRAFT_DASH = [6, 4]

/**
 * One committed flight path. The flattened point list is memoized on the
 * path's own points, so a playback frame or a zoom leaves the array identity
 * alone and Konva does not re-set it. Memoized on the path and its caption
 * inputs; the zoom is read here, so an unrelated path edit re-renders only
 * the path that changed.
 */
const FlightPathShape = memo(function FlightPathShape({ path, color, lengthM, etaS, units }: {
  path: FlightPath
  color: string
  lengthM: number
  etaS: number
  units: UiState['units']
}) {
  const k = useStore((s) => s.camera.scale)
  const flat = useMemo(() => path.points.flatMap((pt) => [pt.x, pt.y]), [path.points])
  const last = path.points[path.points.length - 1]
  return (
    <Group listening={false}>
      <Arrow
        points={flat}
        stroke={color}
        strokeWidth={1.5}
        dash={PATH_DASH}
        strokeScaleEnabled={false}
        pointerLength={10 / k}
        pointerWidth={8 / k}
        fill={color}
      />
      {path.points.map((pt, i) => (
        <Circle key={i} x={pt.x} y={pt.y} radius={3 / k} fill={color} />
      ))}
      {/* Counter-scaled group, so the caption font size never changes and Konva
          never re-measures the text on a zoom step. */}
      <Group x={last.x} y={last.y} scaleX={1 / k} scaleY={1 / k}>
        <Text fontFamily="JetBrains Mono"
          x={8}
          text={`${formatDistance(lengthM, units)} · ${Math.round(etaS)} s`}
          fontSize={11}
          fill={color}
        />
      </Group>
    </Group>
  )
})

/** The rubber band of a boundary or path draft, from its start to the cursor. */
function DraftShape({ start, draftPoints, mouseWorld, k }: {
  start: Vec2 | undefined
  draftPoints: Vec2[]
  mouseWorld: Vec2 | null
  k: number
}) {
  const pts = useMemo(() => (start ? [start, ...draftPoints] : draftPoints), [start, draftPoints])
  const flat = useMemo(
    () => (mouseWorld ? [...pts, mouseWorld] : pts).flatMap((p) => [p.x, p.y]),
    [pts, mouseWorld],
  )
  return (
    <Group listening={false}>
      <Line
        points={flat}
        stroke="#ffffff"
        strokeWidth={1.5}
        dash={DRAFT_DASH}
        strokeScaleEnabled={false}
        opacity={0.8}
      />
      {pts.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={3.5 / k} fill="#ffffff" />
      ))}
    </Group>
  )
}

/** Flight paths, in-progress drafts, and calibration markers. */
export function PathLayer({ mouseWorld }: Props) {
  const scenario = useStore((s) => s.scenario)
  // Field subscriptions, not the whole `ui`: an unrelated ui action must not
  // re-render every path.
  const tool = useStore((s) => s.ui.tool)
  const draftPoints = useStore((s) => s.ui.draftPoints)
  const pathEntityId = useStore((s) => s.ui.pathEntityId)
  const calibrateA = useStore((s) => s.ui.calibrateA)
  const calibrateB = useStore((s) => s.ui.calibrateB)
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  const units = useStore((s) => s.ui.units)
  const showPaths = useStore((s) => s.ui.layers.flightPaths)

  // The flightPaths toggle hides committed paths only. The draft below and the
  // calibrate markers always draw, or the drawing tools lose their feedback.
  const paths = (showPaths ? scenario.paths : []).map((p) => {
    const entity = scenario.entities.find((e) => e.id === p.entityId)
    if (!entity) return null
    const lengthM = pathLength(p.points)
    return (
      <FlightPathShape
        key={p.id}
        path={p}
        color={entityInk(entity, modelFor(scenario, entity))}
        lengthM={lengthM}
        etaS={lengthM / pathSpeed(scenario, p)}
        units={units}
      />
    )
  })

  let draft = null
  if ((tool === 'boundary' || tool === 'path') && (draftPoints.length > 0 || pathEntityId)) {
    const start =
      tool === 'path' && pathEntityId
        ? scenario.entities.find((e) => e.id === pathEntityId)?.pos
        : undefined
    draft = <DraftShape start={start} draftPoints={draftPoints} mouseWorld={mouseWorld} k={k} />
  }

  let calibrate = null
  if (tool === 'calibrate' && (calibrateA || calibrateB)) {
    const a = calibrateA
    const b = calibrateB ?? mouseWorld
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
            <Group x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} scaleX={1 / k} scaleY={1 / k}>
              <Text fontFamily="JetBrains Mono"
                y={-16}
                text={formatDistance(dist(a, b), units)}
                fontSize={12}
                fill="#a9b4bd"
              />
            </Group>
          </>
        )}
        {calibrateB && <CalMark p={calibrateB} k={k} label="B" />}
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
  const across = useMemo(() => [p.x - r, p.y, p.x + r, p.y], [p, r])
  const down = useMemo(() => [p.x, p.y - r, p.x, p.y + r], [p, r])
  return (
    <Group listening={false}>
      <Line points={across} stroke="#a9b4bd" strokeWidth={1.5} strokeScaleEnabled={false} />
      <Line points={down} stroke="#a9b4bd" strokeWidth={1.5} strokeScaleEnabled={false} />
      <Group x={p.x} y={p.y} scaleX={1 / k} scaleY={1 / k}>
        <Text fontFamily="JetBrains Mono" x={8} y={8} text={label} fontSize={12} fill="#a9b4bd" />
      </Group>
    </Group>
  )
}
