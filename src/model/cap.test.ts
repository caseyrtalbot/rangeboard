import { describe, expect, it } from 'vitest'
import { dist, pathLength } from '../geometry/geo'
import type { CapOrbit } from './types'
import {
  CAP_DEFAULT_RADIUS_M,
  CAP_MIN_RADIUS_M,
  CAP_POINTS_PER_LAP,
  capPathPoints,
  capRadiusFrom,
} from './cap'

const cap: CapOrbit = { center: { x: 2000, y: -3000 }, radiusM: 800, laps: 3 }
const start = { x: -1000, y: 1000 }

describe('capPathPoints', () => {
  const points = capPathPoints(start, cap)

  it('starts at the start point and puts every later point on the circle', () => {
    expect(points[0]).toEqual(start)
    for (const p of points.slice(1)) expect(dist(p, cap.center)).toBeCloseTo(cap.radiusM, 6)
  })

  it('flies the ingress leg then laps whole orbits back to the ingress point', () => {
    expect(points).toHaveLength(2 + cap.laps * CAP_POINTS_PER_LAP)
    expect(points[points.length - 1]).toEqual(points[1])
    // The ingress point is the nearest circle point: on the line from the center to start.
    const ingressM = dist(start, cap.center) - cap.radiusM
    expect(dist(start, points[1])).toBeCloseTo(ingressM, 6)
    const expected = ingressM + 2 * Math.PI * cap.radiusM * cap.laps
    expect(Math.abs(pathLength(points) - expected) / expected).toBeLessThan(0.01)
  })

  it('orbits clockwise on screen', () => {
    // +y is south, so a clockwise step has a negative cross product in math axes
    // and a positive one in screen axes.
    const [a, b] = [points[1], points[2]]
    const cross =
      (a.x - cap.center.x) * (b.y - cap.center.y) - (a.y - cap.center.y) * (b.x - cap.center.x)
    expect(cross).toBeGreaterThan(0)
  })

  it('enters at the north point from the center and omits an ingress already reached', () => {
    const fromCenter = capPathPoints(cap.center, cap)
    expect(fromCenter[1].x).toBeCloseTo(cap.center.x, 6)
    expect(fromCenter[1].y).toBeCloseTo(cap.center.y - cap.radiusM, 6)
    const onCircle = { x: cap.center.x + cap.radiusM, y: cap.center.y }
    const fromEdge = capPathPoints(onCircle, { ...cap, laps: 1 })
    expect(fromEdge).toHaveLength(1 + CAP_POINTS_PER_LAP)
    expect(fromEdge[fromEdge.length - 1].x).toBeCloseTo(onCircle.x, 6)
    expect(fromEdge[fromEdge.length - 1].y).toBeCloseTo(onCircle.y, 6)
  })
})

describe('capRadiusFrom', () => {
  it('takes the click distance, or the default below the minimum', () => {
    const c = { x: 10, y: 10 }
    expect(capRadiusFrom(c, { x: 10, y: 1510 })).toBe(1500)
    expect(capRadiusFrom(c, { x: 10 + CAP_MIN_RADIUS_M, y: 10 })).toBe(CAP_MIN_RADIUS_M)
    expect(capRadiusFrom(c, { x: 30, y: 10 })).toBe(CAP_DEFAULT_RADIUS_M)
    expect(capRadiusFrom(c, c)).toBe(CAP_DEFAULT_RADIUS_M)
  })
})
