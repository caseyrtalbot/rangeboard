import type { CapOrbit, Vec2 } from './types'
import { bearingDeg, destination, dist } from '../geometry/geo'

/** ISR CAP: a circular loiter whose flight path points are generated, so the engine reads a plain path. */

/** Vertices per orbit: a 10 degree step keeps the chord length within 0.2 % of the arc. */
export const CAP_POINTS_PER_LAP = 36
/** Smallest radius a click sets; a shorter drag (or a double click) takes the default. */
export const CAP_MIN_RADIUS_M = 50
export const CAP_DEFAULT_RADIUS_M = 1000
export const CAP_DEFAULT_LAPS = 3

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

/**
 * The path for one CAP: `start`, the ingress point (omitted when `start` is on it), then
 * `laps` whole orbits clockwise on screen (rising heading), ending on the ingress point.
 */
export function capPathPoints(start: Vec2, cap: CapOrbit): Vec2[] {
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
  return points
}

/** Radius from the center click to the edge click; a short one takes the default. */
export function capRadiusFrom(center: Vec2, edge: Vec2): number {
  const r = dist(center, edge)
  return r < CAP_MIN_RADIUS_M ? CAP_DEFAULT_RADIUS_M : r
}
