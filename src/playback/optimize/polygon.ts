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
const MIN_AREA_M2 = 1

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
 * a placement run, as a sentence for the user, or null when they can. A
 * boundary whose edges cross (two edges that share no vertex cross at a point
 * inside both) is refused as crossing itself whatever its area: the shoelace
 * sum of a bow-tie subtracts one lobe from the other, so its area floors say
 * nothing. Then a degenerate area (collinear points) is refused as collinear,
 * even when its edges fold back over each other. Then any other contact of two
 * non-adjacent edges (a vertex on an edge, or a collinear overlap) is refused
 * as crossing itself. Last, a sliver under MIN_AREA_FRACTION of its box that
 * the sampler could not fill. A repeated consecutive vertex, the last point
 * repeating the first included, is one vertex and not a contact.
 * `boundingBoxOf` throws it before the first evaluation, so the worker posts
 * it as the run's error. The Placement screen shows it before launch.
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
  const thin = area < MIN_AREA_FRACTION * (maxX - minX) * (maxY - minY)
  const ring = distinctVertices(points)
  if (edgesMeet(ring, false)) return CROSSES_ITSELF
  if (area < MIN_AREA_M2) {
    return 'The range boundary points lie on one line and enclose no area. A placement run needs a polygon.'
  }
  if (edgesMeet(ring, true)) return CROSSES_ITSELF
  if (thin) {
    return 'The range boundary is too thin to sample: its area is under 0.4% of its bounding box.'
  }
  return null
}

/** Twice the signed area of the triangle `abc`: positive when it turns left. */
function cross(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

const CROSSES_ITSELF = 'The range boundary crosses itself. A placement run needs a polygon.'

/**
 * The polygon's vertices with each repeat of the vertex before it dropped
 * (within EDGE_TOLERANCE_M), the closing repeat of the first point included:
 * a zero-length edge would make its two neighbors non-adjacent at one point.
 */
function distinctVertices(points: Vec2[]): Vec2[] {
  const tol2 = EDGE_TOLERANCE_M * EDGE_TOLERANCE_M
  const same = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= tol2
  const ring: Vec2[] = []
  for (const p of points) if (ring.length === 0 || !same(ring[ring.length - 1], p)) ring.push(p)
  while (ring.length > 1 && same(ring[ring.length - 1], ring[0])) ring.pop()
  return ring
}

/**
 * True when two edges of the closed polygon that share no vertex cross at a
 * point inside both or, with `touch`, meet at all: a vertex of one within
 * EDGE_TOLERANCE_M of the other, which a collinear overlap always has.
 */
function edgesMeet(points: Vec2[], touch: boolean): boolean {
  const n = points.length
  const tol2 = EDGE_TOLERANCE_M * EDGE_TOLERANCE_M
  for (let i = 0; i < n; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % n]
    // Edge j skips the two edges next to edge i: j = i + 1, and j = n - 1 when i = 0.
    for (let j = i + 2; j < (i === 0 ? n - 1 : n); j += 1) {
      const c = points[j]
      const d = points[(j + 1) % n]
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true
      if (
        touch &&
        (distToSegment2(a, c, d) <= tol2 ||
          distToSegment2(b, c, d) <= tol2 ||
          distToSegment2(c, a, b) <= tol2 ||
          distToSegment2(d, a, b) <= tol2)
      )
        return true
    }
  }
  return false
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
