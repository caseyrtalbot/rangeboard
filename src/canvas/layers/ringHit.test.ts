import { describe, expect, it } from 'vitest'
import type { Entity } from '../../model/types'
import { destination } from '../../geometry/geo'
import type { EntityRings } from '../ringModel'
import { hitRing } from '../ringModel'

const entity: Entity = {
  id: 'sensor', name: 'Test sensor', kind: 'sensor', specId: null,
  pos: { x: 30, y: 40 }, headingDeg: 350, color: null, notes: '',
}
const sensor: EntityRings = {
  kind: 'sensor', entity, sectorDeg: 360, color: '#fff', held: false, grey: false,
  band: null, placardM: 100, placardDash: null, placardFill: true, behind: false,
  contourLowM: null, contourHighM: null, contourFill: false,
  lowLabel: null, highLabel: null, classifyM: null,
}

describe('hitRing', () => {
  it('hits a full ring and reports the radial edge distance and metadata', () => {
    expect(hitRing([sensor], destination(entity.pos, 90, 104), 6)).toMatchObject({
      entity, key: 'sensorPlacard', name: 'Placard ring', radiusM: 100, distanceM: 4,
    })
  })

  it('misses outside tolerance and ignores hidden or zero-radius rings', () => {
    expect(hitRing([sensor], destination(entity.pos, 90, 107), 6)).toBeNull()
    expect(hitRing([{ ...sensor, placardM: null }], destination(entity.pos, 90, 100), 6)).toBeNull()
    expect(hitRing([{ ...sensor, placardM: 0 }], entity.pos, 6)).toBeNull()
    expect(hitRing([], entity.pos, 6)).toBeNull()
  })

  it('gates sector bearings across north', () => {
    const rings = [{ ...sensor, sectorDeg: 60 }]
    expect(hitRing(rings, destination(entity.pos, 10, 100), 6)).not.toBeNull()
    expect(hitRing(rings, destination(entity.pos, 90, 100), 6)).toBeNull()
  })

  it('chooses the nearest of two concentric rings', () => {
    expect(hitRing([{ ...sensor, classifyM: 108 }], destination(entity.pos, 90, 106), 6)?.key)
      .toBe('classifyRings')
  })

  it('keeps minimum ranges circular for directional effectors and jammers', () => {
    const rings: EntityRings[] = [
      { kind: 'effector', entity, sectorDeg: 30, color: '#fff', off: false,
        maxM: 100, minM: 20, releaseM: null, commitM: null, releaseLabel: null, commitLabel: null },
      { kind: 'jammer', entity, sectorDeg: 30, color: '#fff', off: false, rangeM: 100, minM: 30 },
    ]
    expect(hitRing(rings, destination(entity.pos, 180, 20), 1)?.key).toBe('effectorMinRange')
    expect(hitRing(rings, destination(entity.pos, 180, 30), 1)?.key).toBe('jammerMin')
    expect(hitRing(rings, destination(entity.pos, 180, 100), 1)).toBeNull()
  })

  it('distinguishes envelope edges and Pd contours', () => {
    const rings = [{ ...sensor, placardM: null, band: { innerM: 20, outerM: 80 }, contourLowM: 60, contourHighM: 40 }]
    for (const [radius, key] of [[20, 'envelopeInner'], [80, 'envelopeOuter'], [60, 'pdLow'], [40, 'pdHigh']] as const) {
      expect(hitRing(rings, destination(entity.pos, 90, radius), 1)?.key).toBe(key)
    }
  })
})
