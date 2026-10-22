import { describe, expect, it } from 'vitest'
import { aspectWord, cardinal8, formatMeasureRange, measureLines, measureReadout } from './measure'

// World frame: +x east, +y south.
const ORIGIN = { x: 0, y: 0 }
const NORTH_1NM = { x: 0, y: -1852 }
const EAST_2KM = { x: 2000, y: 0 }

describe('measureReadout', () => {
  it('gives bearing and range from the first end to the second', () => {
    const r = measureReadout(ORIGIN, EAST_2KM)
    expect(r.bearingDeg).toBeCloseTo(90)
    expect(r.rangeM).toBeCloseTo(2000)
    expect(r.aspect).toBeNull()
    expect(r.altitudeFt).toBeNull()
  })

  it('reads a track flying at the first end as HOT with no travel word', () => {
    const r = measureReadout(ORIGIN, NORTH_1NM, { headingDeg: 180, altitudeFt: 400, moving: true })
    expect(r.aspectDeg).toBeCloseTo(0)
    expect(r.aspect).toBe('HOT')
    expect(r.travel).toBeNull()
  })

  it('names the travel direction on a beam and a drag aspect', () => {
    const beam = measureReadout(ORIGIN, NORTH_1NM, {
      headingDeg: 90,
      altitudeFt: 400,
      moving: true,
    })
    expect(beam.aspect).toBe('BEAM')
    expect(beam.travel).toBe('E')
    const drag = measureReadout(ORIGIN, NORTH_1NM, { headingDeg: 0, altitudeFt: 400, moving: true })
    expect(drag.aspect).toBe('DRAG')
    expect(drag.travel).toBe('N')
  })

  it('gives a parked track its altitude and no aspect', () => {
    const r = measureReadout(ORIGIN, NORTH_1NM, { headingDeg: 90, altitudeFt: 1200, moving: false })
    expect(r.aspect).toBeNull()
    expect(r.altitudeFt).toBe(1200)
  })

  it('reads a zero-length measurement as bearing 0 with no aspect', () => {
    const r = measureReadout(ORIGIN, ORIGIN, { headingDeg: 90, altitudeFt: 0, moving: true })
    expect(r.rangeM).toBe(0)
    expect(r.bearingDeg).toBe(0)
    expect(r.aspect).toBeNull()
  })
})

describe('aspect and direction words', () => {
  it('splits the aspect angle at the brevity gaps', () => {
    expect(aspectWord(30)).toBe('HOT')
    expect(aspectWord(50)).toBe('FLANK')
    expect(aspectWord(95)).toBe('BEAM')
    expect(aspectWord(150)).toBe('DRAG')
  })

  it('rounds a heading to eight points', () => {
    expect(cardinal8(0)).toBe('N')
    expect(cardinal8(359)).toBe('N')
    expect(cardinal8(44)).toBe('NE')
    expect(cardinal8(-90)).toBe('W')
  })
})

describe('measureLines', () => {
  it('prints a three-digit bearing and the range in the display units', () => {
    expect(measureLines(measureReadout(ORIGIN, EAST_2KM), 'metric')).toEqual(['090° 2.00 km'])
    expect(measureLines(measureReadout(ORIGIN, NORTH_1NM), 'aviation')).toEqual(['000° 1.00 nm'])
  })

  it('adds the track altitude and aspect on line two', () => {
    const r = measureReadout(ORIGIN, NORTH_1NM, { headingDeg: 90, altitudeFt: 1200, moving: true })
    expect(measureLines(r, 'aviation')).toEqual(['000° 1.00 nm', '1,200 ft · BEAM E'])
  })

  it('keeps short metric ranges in whole meters', () => {
    expect(formatMeasureRange(412.4, 'metric')).toBe('412 m')
  })
})
