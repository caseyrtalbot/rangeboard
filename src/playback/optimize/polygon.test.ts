import { describe, expect, it } from 'vitest'
import { boundingBoxOf, pointInPolygon } from './polygon'

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
    ).toThrow(/no area/)
    expect(() =>
      boundingBoxOf([
        { x: 0, y: 0 },
        { x: NaN, y: 0 },
        { x: 10, y: 5 },
      ]),
    ).toThrow(/non-finite/)
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
