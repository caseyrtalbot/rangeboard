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

/** The box of `points`; throws with fewer than three points or a zero-area box. */
export function boundingBoxOf(points: Vec2[]): BoundingBox {
  if (points.length < 3) throw new Error(`Optimize bounds need at least 3 points, not ${points.length}`)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('Optimize bounds hold a non-finite point')
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const diagonalM = Math.hypot(maxX - minX, maxY - minY)
  if (!(maxX > minX) || !(maxY > minY)) throw new Error('Optimize bounds enclose no area')
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
    if ((a.y > p.y) !== (b.y > p.y)) {
      const xAtY = a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y)
      if (p.x < xAtY) inside = !inside
    }
  }
  return inside
}
