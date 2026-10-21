import { describe, expect, it } from 'vitest'
import type { Entity } from '../../model/types'
import { destination, formatNm } from '../../geometry/geo'
import type { EntityRings } from '../ringModel'
import { hitRing } from '../ringModel'

const entity: Entity = {
  id: 'sensor',
  name: 'Test sensor',
  kind: 'sensor',
  specId: null,
  pos: { x: 30, y: 40 },
  headingDeg: 350,
  color: null,
  notes: '',
}
const sensor: EntityRings = {
  kind: 'sensor',
  entity,
  sectorDeg: 360,
  ink: '#fff',
  held: false,
  grey: false,
  band: null,
  placardM: 100,
  placardDash: null,
  placardFill: true,
  behind: false,
  contourLowM: null,
  contourHighM: null,
  contourFill: false,
  lowLabel: null,
  highLabel: null,
  classifyM: null,
  altitudeFt: null,
}

describe('hitRing', () => {
  it('hits a full ring and reports the radial edge distance and metadata', () => {
    expect(hitRing([sensor], destination(entity.pos, 90, 104), 6)).toMatchObject({
      entity,
      key: 'sensorPlacard',
      name: 'Placard ring',
      radiusM: 100,
      distanceM: 4,
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
    expect(hitRing([{ ...sensor, classifyM: 108 }], destination(entity.pos, 90, 106), 6)?.key).toBe(
      'classifyRings',
    )
  })

  it('keeps minimum ranges circular for directional effectors and jammers', () => {
    const rings: EntityRings[] = [
      {
        kind: 'effector',
        entity,
        sectorDeg: 30,
        ink: '#fff',
        off: false,
        maxM: 100,
        mrirM: null,
        minM: 20,
        mrirBasis: 'default',
        mrirFraction: 2 / 3,
        altitudeFt: null,
      },
      {
        kind: 'jammer',
        entity,
        sectorDeg: 30,
        ink: '#fff',
        off: false,
        rangeM: 100,
        mrirM: null,
        minM: 30,
        mrirBasis: 'default',
        mrirFraction: 2 / 3,
        altitudeFt: null,
      },
    ]
    expect(hitRing(rings, destination(entity.pos, 180, 20), 1)).toMatchObject({
      key: 'effectorMinRange',
      radiusM: 20,
    })
    expect(hitRing(rings, destination(entity.pos, 180, 30), 1)).toMatchObject({
      key: 'effectorMinRange',
      radiusM: 30,
    })
    expect(hitRing(rings, destination(entity.pos, 180, 100), 1)).toBeNull()
  })

  it('reads the MIR and MRIR names, distance, height and basis of a jammer', () => {
    const rings: EntityRings[] = [
      {
        kind: 'jammer',
        entity,
        sectorDeg: 360,
        ink: '#fff',
        off: false,
        rangeM: 2000,
        mrirM: 1500,
        minM: null,
        mrirBasis: 'edited',
        mrirFraction: 0.75,
        altitudeFt: 400,
      },
    ]
    expect(hitRing(rings, destination(entity.pos, 90, 2000), 1)).toMatchObject({
      key: 'effectorMaxRange',
      name: 'MIR',
      distance: formatNm(2000),
      height: '400 ft AGL',
      basis: null,
    })
    expect(hitRing(rings, destination(entity.pos, 90, 1500), 1)).toMatchObject({
      key: 'effectorDoctrinal',
      name: 'MRIR',
      distance: '0.81 nm',
      basis: '0.75 MIR · Edited',
    })
  })

  it('distinguishes envelope edges and Pd contours', () => {
    const rings = [
      {
        ...sensor,
        placardM: null,
        band: { innerM: 20, outerM: 80 },
        contourLowM: 60,
        contourHighM: 40,
      },
    ]
    for (const [radius, key] of [
      [20, 'envelopeInner'],
      [80, 'envelopeOuter'],
      [60, 'pdLow'],
      [40, 'pdHigh'],
    ] as const) {
      expect(hitRing(rings, destination(entity.pos, 90, radius), 1)?.key).toBe(key)
    }
  })

  it('gives a height line only to rings computed at the threat altitude', () => {
    const rings = [{ ...sensor, band: { innerM: 20, outerM: 80 }, contourLowM: 60 }]
    const heightAt = (radius: number) =>
      hitRing(rings, destination(entity.pos, 90, radius), 1)?.height
    expect(heightAt(100)).toBeNull()
    expect(heightAt(80)).toBeNull()
    expect(heightAt(60)).toBe('No threat')
  })
})
