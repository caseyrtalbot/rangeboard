import { selectEffectiveLayers } from '../../state/selectors'
import { memo, useMemo } from 'react'
import { Arrow, Circle, Group, Line, Text } from 'react-konva'
import type { CapOrbit, Entity, FlightPath, Vec2 } from '../../model/types'
import type { UiState } from '../../state/store'
import { useStore } from '../../state/store'
import { modelFor, pathDurationS } from '../../model/scenario'
import { dist, formatDistance, pathLength } from '../../geometry/geo'
import { entityInk } from '../../ui/ink'
import { useBoardInk } from '../useBoardInk'
import { captionClear } from '../labelLayout'
import { capIngressPoint } from '../../model/cap'

interface Props {
  mouseWorld: Vec2 | null
}

/** Fixed dash arrays: an inline literal is re-set on every render. */
const PATH_DASH = [8, 5]
const DRAFT_DASH = [6, 4]

/**
 * One committed flight path. The flattened point list is memoized on the path's own
 * points, so a playback frame or a zoom leaves the array identity alone.
 */
const FlightPathShape = memo(function FlightPathShape({
  path,
  color,
  lengthM,
  etaS,
  units,
  entities,
}: {
  path: FlightPath
  color: string
  lengthM: number
  etaS: number
  units: UiState['units']
  entities: Entity[]
}) {
  const k = useStore((s) => s.camera.scale)
  const flat = useMemo(() => path.points.flatMap((pt) => [pt.x, pt.y]), [path.points])
  if (path.points.length < 2) return null
  const a = path.points[path.points.length - 2]
  const b = path.points[path.points.length - 1]
  const leg = dist(a, b) * k || 1
  const text = `${formatDistance(lengthM, units)} · ${Math.round(etaS)} s`
  // The caption takes the first slot back along the last leg, 48 px apart, that clears
  // every glyph and anchored label; with none clear it does not draw.
  const slot = [0, 48, 96, 144]
    .map((px) => ({
      x: (b.x + ((a.x - b.x) * px) / leg) * k + 8,
      y: (b.y + ((a.y - b.y) * px) / leg) * k - 5.5,
    }))
    .find((p) => captionClear(p.x, p.y, text, entities, k))
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
      {slot && (
        <Group x={slot.x / k} y={slot.y / k} scaleX={1 / k} scaleY={1 / k}>
          <Text fontFamily="JetBrains Mono" text={text} fontSize={11} fill={color} />
        </Group>
      )}
    </Group>
  )
})

/**
 * One committed ISR CAP: the dashed ingress leg, the dashed orbit circle, a center mark
 * and one caption off the circle's east point. The orbit vertices draw as the circle,
 * not as waypoint dots.
 */
const CapPathShape = memo(function CapPathShape({
  path,
  cap,
  color,
  etaS,
  units,
}: {
  path: FlightPath
  cap: CapOrbit
  color: string
  etaS: number
  units: UiState['units']
}) {
  const k = useStore((s) => s.camera.scale)
  const start = path.points[0]
  const ingress = useMemo(() => (start ? capIngressPoint(start, cap) : null), [start, cap])
  const leg = useMemo(
    () => (start && ingress ? [start.x, start.y, ingress.x, ingress.y] : null),
    [start, ingress],
  )
  const text = `R ${formatDistance(cap.radiusM, units)} · ${cap.laps} laps · ${Math.round(etaS)} s`
  return (
    <Group listening={false}>
      {leg && (
        <Line
          points={leg}
          stroke={color}
          strokeWidth={1.5}
          dash={PATH_DASH}
          strokeScaleEnabled={false}
        />
      )}
      <Circle
        x={cap.center.x}
        y={cap.center.y}
        radius={cap.radiusM}
        stroke={color}
        strokeWidth={1.5}
        dash={PATH_DASH}
        strokeScaleEnabled={false}
      />
      <CenterMark p={cap.center} k={k} color={color} />
      {/* Counter-scaled, as the path caption, just outside the east point. */}
      <Group
        x={cap.center.x + cap.radiusM + 8 / k}
        y={cap.center.y - 5.5 / k}
        scaleX={1 / k}
        scaleY={1 / k}
      >
        <Text fontFamily="JetBrains Mono" text={text} fontSize={11} fill={color} />
      </Group>
    </Group>
  )
})

/** The rubber band of a CAP draft: the center mark and a circle out to the cursor. */
function CapDraftShape({
  center,
  mouseWorld,
  k,
  units,
}: {
  center: Vec2
  mouseWorld: Vec2 | null
  k: number
  units: UiState['units']
}) {
  const ink = useBoardInk()
  const r = mouseWorld ? dist(center, mouseWorld) : 0
  return (
    <Group listening={false}>
      <CenterMark p={center} k={k} color={ink.selection} />
      {mouseWorld && r > 0 && (
        <>
          <Circle
            x={center.x}
            y={center.y}
            radius={r}
            stroke={ink.selection}
            strokeWidth={1.5}
            dash={DRAFT_DASH}
            strokeScaleEnabled={false}
            opacity={0.8}
          />
          <Group x={mouseWorld.x} y={mouseWorld.y} scaleX={1 / k} scaleY={1 / k}>
            <Text
              fontFamily="JetBrains Mono"
              x={10}
              y={-16}
              text={`R ${formatDistance(r, units)}`}
              fontSize={12}
              fill={ink.selection}
            />
          </Group>
        </>
      )}
    </Group>
  )
}

/** The rubber band of a boundary or path draft, from its start to the cursor. */
function DraftShape({
  start,
  draftPoints,
  mouseWorld,
  k,
}: {
  start: Vec2 | undefined
  draftPoints: Vec2[]
  mouseWorld: Vec2 | null
  k: number
}) {
  const ink = useBoardInk()
  const pts = useMemo(() => (start ? [start, ...draftPoints] : draftPoints), [start, draftPoints])
  const flat = useMemo(
    () => (mouseWorld ? [...pts, mouseWorld] : pts).flatMap((p) => [p.x, p.y]),
    [pts, mouseWorld],
  )
  return (
    <Group listening={false}>
      <Line
        points={flat}
        stroke={ink.selection}
        strokeWidth={1.5}
        dash={DRAFT_DASH}
        strokeScaleEnabled={false}
        opacity={0.8}
      />
      {pts.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={3.5 / k} fill={ink.selection} />
      ))}
    </Group>
  )
}

/** Flight paths, in-progress drafts, and calibration markers. */
export function PathLayer({ mouseWorld }: Props) {
  const scenario = useStore((s) => s.scenario)
  // Field subscriptions, not the whole `ui`, so an unrelated ui action re-renders no path.
  const tool = useStore((s) => s.ui.tool)
  const draftPoints = useStore((s) => s.ui.draftPoints)
  const pathEntityId = useStore((s) => s.ui.pathEntityId)
  const calibrateA = useStore((s) => s.ui.calibrateA)
  const calibrateB = useStore((s) => s.ui.calibrateB)
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  const units = useStore((s) => s.ui.units)
  const showPaths = useStore((s) => selectEffectiveLayers(s).flightPaths)
  const ink = useBoardInk()

  // The flightPaths toggle hides committed paths only; the draft and the calibrate
  // markers always draw.
  const paths = (showPaths ? scenario.paths : []).map((p) => {
    const entity = scenario.entities.find((e) => e.id === p.entityId)
    if (!entity) return null
    const color = entityInk(entity, modelFor(scenario, entity))
    if (p.cap)
      return (
        <CapPathShape
          key={p.id}
          path={p}
          cap={p.cap}
          color={color}
          etaS={pathDurationS(scenario, p)}
          units={units}
        />
      )
    const lengthM = pathLength(p.points)
    return (
      <FlightPathShape
        key={p.id}
        path={p}
        color={color}
        lengthM={lengthM}
        etaS={pathDurationS(scenario, p)}
        units={units}
        entities={scenario.entities}
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
  // Before the center click the cursor alone shows the tool.
  if (tool === 'cap' && draftPoints.length > 0)
    draft = <CapDraftShape center={draftPoints[0]} mouseWorld={mouseWorld} k={k} units={units} />

  let calibrate = null
  if (tool === 'calibrate' && (calibrateA || calibrateB)) {
    const a = calibrateA
    const b = calibrateB ?? mouseWorld
    calibrate = (
      <Group listening={false}>
        {a && <CalMark p={a} k={k} label="A" color={ink.tool} />}
        {a && b && (
          <>
            <Line
              points={[a.x, a.y, b.x, b.y]}
              stroke={ink.tool}
              strokeWidth={1.5}
              strokeScaleEnabled={false}
            />
            <Group x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} scaleX={1 / k} scaleY={1 / k}>
              <Text
                fontFamily="JetBrains Mono"
                y={-16}
                text={formatDistance(dist(a, b), units)}
                fontSize={12}
                fill={ink.tool}
              />
            </Group>
          </>
        )}
        {calibrateB && <CalMark p={calibrateB} k={k} label="B" color={ink.tool} />}
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

/** A small cross on an orbit center. */
function CenterMark({ p, k, color }: { p: Vec2; k: number; color: string }) {
  const r = 5 / k
  const across = useMemo(() => [p.x - r, p.y, p.x + r, p.y], [p, r])
  const down = useMemo(() => [p.x, p.y - r, p.x, p.y + r], [p, r])
  return (
    <>
      <Line points={across} stroke={color} strokeWidth={1.5} strokeScaleEnabled={false} />
      <Line points={down} stroke={color} strokeWidth={1.5} strokeScaleEnabled={false} />
    </>
  )
}

function CalMark({ p, k, label, color }: { p: Vec2; k: number; label: string; color: string }) {
  const r = 8 / k
  const across = useMemo(() => [p.x - r, p.y, p.x + r, p.y], [p, r])
  const down = useMemo(() => [p.x, p.y - r, p.x, p.y + r], [p, r])
  return (
    <Group listening={false}>
      <Line points={across} stroke={color} strokeWidth={1.5} strokeScaleEnabled={false} />
      <Line points={down} stroke={color} strokeWidth={1.5} strokeScaleEnabled={false} />
      <Group x={p.x} y={p.y} scaleX={1 / k} scaleY={1 / k}>
        <Text fontFamily="JetBrains Mono" x={8} y={8} text={label} fontSize={12} fill={color} />
      </Group>
    </Group>
  )
}
