import { describe, expect, it } from 'vitest'
import {
  angleDiffDeg,
  bearingDeg,
  closestApproach,
  destination,
  dist,
  formatDistance,
  gridStepM,
  pathLength,
  pointInSector,
  posAlongPath,
  posAtTime,
  wedgePoints,
} from './geo'

const O = { x: 0, y: 0 }

describe('bearing and destination', () => {
  it('computes cardinal bearings (north = 0, clockwise, +y south)', () => {
    expect(bearingDeg(O, { x: 0, y: -100 })).toBeCloseTo(0)
    expect(bearingDeg(O, { x: 100, y: 0 })).toBeCloseTo(90)
    expect(bearingDeg(O, { x: 0, y: 100 })).toBeCloseTo(180)
    expect(bearingDeg(O, { x: -100, y: 0 })).toBeCloseTo(270)
  })

  it('destination inverts bearing', () => {
    const p = destination(O, 37, 1234)
    expect(bearingDeg(O, p)).toBeCloseTo(37)
    expect(dist(O, p)).toBeCloseTo(1234)
  })
})

describe('angleDiffDeg', () => {
  it('wraps across north', () => {
    expect(angleDiffDeg(350, 10)).toBeCloseTo(20)
    expect(angleDiffDeg(10, 350)).toBeCloseTo(20)
    expect(angleDiffDeg(180, 0)).toBeCloseTo(180)
  })
})

describe('pointInSector', () => {
  it('rejects points beyond range', () => {
    expect(pointInSector(O, 0, 90, 1000, { x: 0, y: -1001 })).toBe(false)
    expect(pointInSector(O, 0, 90, 1000, { x: 0, y: -999 })).toBe(true)
  })

  it('respects sector edges', () => {
    // Heading north, 90 deg sector: covers bearings 315..45.
    expect(pointInSector(O, 0, 90, 1000, destination(O, 44, 500))).toBe(true)
    expect(pointInSector(O, 0, 90, 1000, destination(O, 46, 500))).toBe(false)
    expect(pointInSector(O, 0, 90, 1000, destination(O, 316, 500))).toBe(true)
  })

  it('treats 360 as full circle', () => {
    expect(pointInSector(O, 0, 360, 1000, { x: 500, y: 500 })).toBe(true)
  })
})

describe('wedgePoints', () => {
  it('starts at center and spans the sector at the given range', () => {
    const pts = wedgePoints(O, 90, 60, 1000, 4)
    expect(pts[0]).toBe(0)
    expect(pts[1]).toBe(0)
    for (let i = 2; i < pts.length; i += 2) {
      expect(Math.hypot(pts[i], pts[i + 1])).toBeCloseTo(1000)
    }
    const first = { x: pts[2], y: pts[3] }
    const last = { x: pts[pts.length - 2], y: pts[pts.length - 1] }
    expect(bearingDeg(O, first)).toBeCloseTo(60)
    expect(bearingDeg(O, last)).toBeCloseTo(120)
  })
})

describe('paths', () => {
  const square: { x: number; y: number }[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]

  it('measures length', () => {
    expect(pathLength(square)).toBeCloseTo(200)
  })

  it('interpolates along segments', () => {
    const s = posAlongPath(square, 150)
    expect(s.pos.x).toBeCloseTo(100)
    expect(s.pos.y).toBeCloseTo(50)
    expect(s.headingDeg).toBeCloseTo(180)
    expect(s.done).toBe(false)
  })

  it('clamps at the end', () => {
    const s = posAlongPath(square, 500)
    expect(s.pos).toEqual({ x: 100, y: 100 })
    expect(s.done).toBe(true)
  })

  it('honors speed and start delay', () => {
    const s = posAtTime(square, 10, 5, 10)
    expect(s.pos.x).toBeCloseTo(50)
    expect(s.pos.y).toBeCloseTo(0)
  })

  it('finds closest approach to a target', () => {
    const best = closestApproach(square, 10, 0, { x: 100, y: 80 }, 60)
    expect(best.distM).toBeLessThan(1)
    expect(best.tS).toBeCloseTo(18, 0)
  })
})

describe('grid and formatting', () => {
  it('picks 1-2-5 steps', () => {
    expect(gridStepM(0.1)).toBe(1000)
    expect(gridStepM(1)).toBe(100)
    expect(gridStepM(0.05)).toBe(2000)
  })

  it('formats distances', () => {
    expect(formatDistance(950)).toBe('950 m')
    expect(formatDistance(1500)).toBe('1.5 km')
    expect(formatDistance(25000)).toBe('25 km')
  })
})
