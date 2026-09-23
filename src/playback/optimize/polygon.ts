/**
 * The bounds polygon of an optimization: a closed polygon in the meters
 * world frame (`OptimizeBounds.points`, the last point joined to the first).
 * Membership is the even-odd ray test; a point on an edge counts as inside
 * so a candidate on the range boundary is admitted.
 */
import type { Vec2 } from '../../model/types'

/** The axis-aligned box of a polygon, and its diagonal in meters. */
export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  diagonalM: number
}

/**
 * Smallest polygon area a placement run accepts, square meters. Collinear
 * points give a shoelace sum of exactly 0 or of rounding noise (about 1e-8 m^2
 * at 10 km coordinates); no range region an entity can stand in is under 1 m^2.
 */
export const MIN_AREA_M2 = 1

/**
 * Smallest polygon area as a fraction of its bounding box. The sampler draws
 * uniformly in the box and keeps a draw inside the polygon, so this fraction is
 * its acceptance rate. At 4e-3 a point fails all of the sampler's 10,000 draws
 * with probability e^-40, so a region that passes never makes the sampler throw.
 */
export const MIN_AREA_FRACTION = 4e-3

/** The polygon's area by the shoelace formula, square meters, sign dropped. */
export function polygonAreaM2(points: Vec2[]): number {
  let twice = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    twice += points[j].x * points[i].y - points[i].x * points[j].y
  }
  return Math.abs(twice) / 2
}

/**
 * Why `points` (three or more; the callers hold the count floor) cannot bound
 * a placement run, as a sentence for the user, or null when they can: a
 * degenerate area (collinear points, or a sliver under MIN_AREA_FRACTION of
 * its box that the sampler could not fill). `boundingBoxOf` throws it before
 * the first evaluation, so the worker posts it as the run's error.
 */
export function boundsRefusal(points: Vec2[]): string | null {
  const n = points.length
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let twice = 0
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const p = points[i]
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
    twice += points[j].x * p.y - p.x * points[j].y
  }
  const area = Math.abs(twice) / 2
  if (area < MIN_AREA_M2) {
    return 'The range boundary points lie on one line and enclose no area. A placement run needs a polygon.'
  }
  if (area < MIN_AREA_FRACTION * (maxX - minX) * (maxY - minY)) {
    return 'The range boundary is too thin to sample: its area is under 0.4% of its bounding box.'
  }
  return null
}

/** The box of `points`; throws with fewer than three points, a non-finite point, or `boundsRefusal`'s reason. */
export function boundingBoxOf(points: Vec2[]): BoundingBox {
  if (points.length < 3)
    throw new Error(`Optimize bounds need at least 3 points, not ${points.length}`)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
      throw new Error('Optimize bounds hold a non-finite point')
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const refusal = boundsRefusal(points)
  if (refusal != null) throw new Error(refusal)
  const diagonalM = Math.hypot(maxX - minX, maxY - minY)
  return { minX, minY, maxX, maxY, diagonalM }
}

/** Squared distance from `p` to the segment `ab`. */
function distToSegment2(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
  const ex = p.x - (a.x + t * dx)
  const ey = p.y - (a.y + t * dy)
  return ex * ex + ey * ey
}

/** Points within this distance of an edge count as inside, meters. */
const EDGE_TOLERANCE_M = 1e-6

/** True when `p` lies inside `points` (closed polygon) or on one of its edges. */
export function pointInPolygon(p: Vec2, points: Vec2[]): boolean {
  const n = points.length
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const a = points[i]
    const b = points[j]
    if (distToSegment2(p, a, b) <= EDGE_TOLERANCE_M * EDGE_TOLERANCE_M) return true
    // Even-odd rule: count the edges a horizontal ray from p to +x crosses.
    if (a.y > p.y !== b.y > p.y) {
      const xAtY = a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y)
      if (p.x < xAtY) inside = !inside
    }
  }
  return inside
}
