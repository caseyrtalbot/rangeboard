import type { Boundary, CapOrbit, Vec2 } from './types'
import { bearingDeg, destination, dist } from '../geometry/geo'

/** ISR CAP: a circular loiter whose flight path points are generated, so the engine reads a plain path. */

/** Vertices per orbit: a 10 degree step keeps the chord length within 0.2 % of the arc. */
export const CAP_POINTS_PER_LAP = 36
/** Smallest radius a click sets; a shorter drag (or a double click) takes the default. */
export const CAP_MIN_RADIUS_M = 50
export const CAP_DEFAULT_RADIUS_M = 1000
export const CAP_DEFAULT_LAPS = 3
/** How far an egress leg continues past the phase line, meters. */
export const CAP_EGRESS_BEYOND_M = 5000

/** Below this distance two points count as one, meters. */
const SAME_POINT_M = 1

/**
 * Where the ingress leg meets the orbit: the circle point nearest `start`. A start on the
 * center has no nearest point, so it takes the north point (heading 0).
 */
export function capIngressPoint(start: Vec2, cap: CapOrbit): Vec2 {
  const heading = dist(start, cap.center) < SAME_POINT_M ? 0 : bearingDeg(cap.center, start)
  return destination(cap.center, heading, cap.radiusM)
}

/** The point of a polyline nearest to `p`. */
function nearestOnPolyline(p: Vec2, line: Vec2[]): Vec2 {
  let best = line[0]
  let bestD = Infinity
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]
    const b = line[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t =
      len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    const q = { x: a.x + t * dx, y: a.y + t * dy }
    const d = dist(p, q)
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return best
}

/**
 * The egress leg from the orbit exit: the nearest point of the line (the crossing), then
 * CAP_EGRESS_BEYOND_M further on the same heading. Empty when the line has one point or
 * the exit sits on it.
 */
export function capEgressPoints(exit: Vec2, line: Vec2[]): Vec2[] {
  if (line.length < 2) return []
  const crossing = nearestOnPolyline(exit, line)
  if (dist(exit, crossing) < SAME_POINT_M) return []
  return [crossing, destination(crossing, bearingDeg(exit, crossing), CAP_EGRESS_BEYOND_M)]
}

/** The phase line a cap's exit names, or null when it names none or the line is gone. */
export function egressLineOf(boundaries: Boundary[], cap: CapOrbit): Vec2[] | null {
  if (!cap.exit) return null
  const line = boundaries.find((b) => b.id === cap.exit?.boundaryId && b.type === 'phase-line')
  return line ? line.points : null
}

/**
 * The path for one CAP: `start`, the ingress point (omitted when `start` is on it), then
 * `laps` whole orbits clockwise on screen (rising heading), ending on the ingress point,
 * then the egress leg across `egressLine` when the cap exits over one.
 */
export function capPathPoints(start: Vec2, cap: CapOrbit, egressLine?: Vec2[] | null): Vec2[] {
  const ingress = capIngressPoint(start, cap)
  const heading0 = bearingDeg(cap.center, ingress)
  const points: Vec2[] = [start]
  if (dist(start, ingress) >= SAME_POINT_M) points.push(ingress)
  const n = cap.laps * CAP_POINTS_PER_LAP
  for (let i = 1; i <= n; i++) {
    // The step within one lap, so each lap closes exactly on the ingress heading.
    const step = i % CAP_POINTS_PER_LAP
    points.push(
      step === 0
        ? { ...ingress }
        : destination(cap.center, heading0 + (360 * step) / CAP_POINTS_PER_LAP, cap.radiusM),
    )
  }
  if (egressLine) points.push(...capEgressPoints(points[points.length - 1], egressLine))
  return points
}

/** Radius from the center click to the edge click; a short one takes the default. */
export function capRadiusFrom(center: Vec2, edge: Vec2): number {
  const r = dist(center, edge)
  return r < CAP_MIN_RADIUS_M ? CAP_DEFAULT_RADIUS_M : r
}
