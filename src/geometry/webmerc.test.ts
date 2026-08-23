import { describe, expect, it } from 'vitest'
import {
  R,
  lonLatToWorld,
  mercX,
  mercY,
  pickZoom,
  tileIndex,
  tileToLonLat,
  tileWorldSizeM,
} from './webmerc'

describe('mercator projection', () => {
  it('maps the origin to zero', () => {
    expect(mercX(0)).toBe(0)
    expect(mercY(0)).toBeCloseTo(0, 6)
  })
})

describe('tile addressing', () => {
  it('round-trips a known point through tileIndex and tileToLonLat', () => {
    const lat = 32.9866
    const lon = -114.3355
    const z = 12
    const { tx, ty } = tileIndex(z, mercX(lon), mercY(lat))
    const corner = tileToLonLat(z, tx, ty)
    const next = tileToLonLat(z, tx + 1, ty + 1)
    expect(lon).toBeGreaterThanOrEqual(corner.lon)
    expect(lon).toBeLessThan(next.lon)
    expect(lat).toBeLessThanOrEqual(corner.lat)
    expect(lat).toBeGreaterThan(next.lat)
  })

  it('clamps indices to the zoom grid', () => {
    expect(tileIndex(2, -Math.PI * R * 2, Math.PI * R * 2)).toEqual({ tx: 0, ty: 0 })
    expect(tileIndex(2, Math.PI * R * 2, -Math.PI * R * 2)).toEqual({ tx: 3, ty: 3 })
  })
})

describe('tileWorldSizeM', () => {
  it('is the full equator circumference at z0 on the equator', () => {
    expect(tileWorldSizeM(0, 0)).toBeCloseTo(2 * Math.PI * R, 3)
  })
})

describe('anchor mapping scale', () => {
  it('gives true ground meters near the anchor', () => {
    const ref = { lat: 33, lon: -114 }
    const { x } = lonLatToWorld(ref, -113.99, 33)
    const expected = 0.01 * 111320 * Math.cos((33 * Math.PI) / 180)
    expect(Math.abs(x - expected) / expected).toBeLessThan(0.005)
  })

  it('points north of the anchor have negative world y', () => {
    const ref = { lat: 33, lon: -114 }
    expect(lonLatToWorld(ref, -114, 33.01).y).toBeLessThan(0)
  })
})

describe('pickZoom', () => {
  it('clamps to the supported zoom range', () => {
    expect(pickZoom(0, 1e9)).toBe(19)
    expect(pickZoom(0, 1e-9)).toBe(2)
  })

  it('rises with pixels per meter', () => {
    expect(pickZoom(33, 1)).toBeGreaterThan(pickZoom(33, 0.01))
  })
})
