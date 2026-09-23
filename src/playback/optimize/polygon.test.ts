import { describe, expect, it } from 'vitest'
import {
  MIN_AREA_FRACTION,
  boundingBoxOf,
  boundsRefusal,
  pointInPolygon,
  polygonAreaM2,
} from './polygon'

// A unit-ish L shape: the 0..10 square minus its upper-right quadrant.
const L = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 5 },
  { x: 5, y: 5 },
  { x: 5, y: 10 },
  { x: 0, y: 10 },
]

describe('boundingBoxOf', () => {
  it('reads the box and its diagonal, and rejects a degenerate polygon', () => {
    // 10 by 10: the diagonal is 10 sqrt 2.
    expect(boundingBoxOf(L)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
      diagonalM: Math.hypot(10, 10),
    })
    expect(() => boundingBoxOf(L.slice(0, 2))).toThrow(/at least 3 points/)
    expect(() =>
      boundingBoxOf([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toThrow(/enclose no area/)
    expect(() =>
      boundingBoxOf([
        { x: 0, y: 0 },
        { x: NaN, y: 0 },
        { x: 10, y: 5 },
      ]),
    ).toThrow(/non-finite/)
  })
})

describe('boundsRefusal', () => {
  it('admits a polygon', () => {
    expect(boundsRefusal(L)).toBeNull()
    expect(polygonAreaM2(L)).toBe(75)
  })

  it('refuses three axis-aligned collinear points', () => {
    // Three points on y = -3000 at range scale: a zero-height box.
    const flat = [
      { x: -7000, y: -3000 },
      { x: -3000, y: -3000 },
      { x: 1000, y: -3000 },
    ]
    expect(polygonAreaM2(flat)).toBe(0)
    expect(boundsRefusal(flat)).toBe(
      'The range boundary points lie on one line and enclose no area. A placement run needs a polygon.',
    )
    expect(() => boundingBoxOf(flat)).toThrow(/enclose no area/)
  })

  it('refuses three diagonal collinear points, with or without rounding noise', () => {
    // On y = x + 1000: the box has area but the polygon has none.
    const exact = [
      { x: -7000, y: -6000 },
      { x: -3000, y: -2000 },
      { x: 1000, y: 2000 },
    ]
    expect(boundsRefusal(exact)).toMatch(/enclose no area/)
    // The same line with a 1e-7 m nudge: the shoelace sum is under a square meter.
    const noisy = [exact[0], { x: -3000, y: -2000 + 1e-7 }, exact[2]]
    expect(polygonAreaM2(noisy)).toBeLessThan(1)
    expect(boundsRefusal(noisy)).toMatch(/enclose no area/)
    expect(() => boundingBoxOf(noisy)).toThrow(/enclose no area/)
  })

  it('refuses a sliver the sampler could not fill and admits a thin but usable strip', () => {
    // A 10 km diagonal with a 1 m offset third point: acceptance 1e-4 in its box.
    const sliver = [
      { x: 0, y: 0 },
      { x: 5000, y: 5001 },
      { x: 10000, y: 10000 },
    ]
    expect(polygonAreaM2(sliver)).toBeGreaterThan(1)
    expect(boundsRefusal(sliver)).toMatch(/too thin to sample/)
    // Half the box, the largest a triangle can fill, and a strip just over the floor.
    const strip = [
      { x: 0, y: 0 },
      { x: 10000, y: 0 },
      { x: 10000, y: 2 * MIN_AREA_FRACTION * 10000 + 1 },
    ]
    expect(boundsRefusal(strip)).toBeNull()
    expect(
      boundsRefusal([
        { x: 0, y: 0 },
        { x: 10000, y: 0 },
        { x: 0, y: 10000 },
      ]),
    ).toBeNull()
  })
})

describe('pointInPolygon', () => {
  it('admits interior and edge points and rejects the cut quadrant and the outside', () => {
    expect(pointInPolygon({ x: 2, y: 2 }, L)).toBe(true)
    expect(pointInPolygon({ x: 8, y: 2 }, L)).toBe(true)
    expect(pointInPolygon({ x: 2, y: 8 }, L)).toBe(true)
    // The removed quadrant lies inside the box but outside the polygon.
    expect(pointInPolygon({ x: 8, y: 8 }, L)).toBe(false)
    expect(pointInPolygon({ x: -1, y: 5 }, L)).toBe(false)
    expect(pointInPolygon({ x: 5, y: 11 }, L)).toBe(false)
    // On an edge and on a vertex count as inside.
    expect(pointInPolygon({ x: 10, y: 2.5 }, L)).toBe(true)
    expect(pointInPolygon({ x: 5, y: 5 }, L)).toBe(true)
    expect(pointInPolygon({ x: 0, y: 0 }, L)).toBe(true)
  })
})
