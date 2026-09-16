import { describe, expect, it } from 'vitest'
import { effectiveDetectRangeM } from '../analysis/sensorEnv'
import { destination } from '../geometry/geo'
import { emptyScenario } from '../model/seed'
import type { Entity, Scenario } from '../model/types'
import { DEFAULT_LAYERS } from '../state/layers'
import type { RingView } from './ringModel'
import { prepareRingModel } from './ringModel'

function entity(id: string, kind: Entity['kind'], specId: string | null, x: number): Entity {
  return { id, name: id, kind, specId, pos: { x, y: 0 }, headingDeg: 0, color: null, notes: '' }
}

/** One 90 deg radar facing north, one interceptor, one asset and one placed threat. */
function fixture(): Scenario {
  const s = emptyScenario()
  const uas = s.library.find((m) => m.kind === 'uas')!
  s.entities = [
    entity('radar', 'sensor', 'lib-rps42', 0),
    entity('coyote', 'effector', 'lib-coyote', 20000),
    entity('site', 'asset', null, 50000),
    { ...entity('threat', 'uas', uas.id, 0), pos: { x: 0, y: -3000 } },
  ]
  return s
}

const view: RingView = { units: 'metric', layers: DEFAULT_LAYERS, ringOverrides: {} }
const radarPos = { x: 0, y: 0 }

describe('prepareRingModel', () => {
  it('prepares the default rings from the scenario alone', () => {
    const s = fixture()
    const { rings } = prepareRingModel(s, view, null)
    const spec = s.library.find((m) => m.id === 'lib-rps42')!.sensor!
    expect(rings.map((r) => [r.kind, r.entity.id])).toEqual([
      ['sensor', 'radar'],
      ['effector', 'coyote'],
      ['asset', 'site'],
    ])
    expect(rings[0]).toMatchObject({
      kind: 'sensor',
      sectorDeg: 90,
      placardM: effectiveDetectRangeM(spec, s.environment),
      contourLowM: null,
      band: null,
      classifyM: null,
    })
    expect(rings[1]).toMatchObject({ kind: 'effector', maxM: 10000, minM: null, releaseM: null })
    expect(rings[2]).toMatchObject({ kind: 'asset', radiusM: 500 })
  })

  it('hits the same edges it draws, gated by the sensor sector', () => {
    const s = fixture()
    const model = prepareRingModel(s, view, null)
    const placardM = (model.rings[0] as { placardM: number }).placardM
    expect(model.hitAt(destination(radarPos, 0, placardM + 3), 6)).toMatchObject({
      key: 'sensorPlacard',
      radiusM: placardM,
      distanceM: 3,
      name: 'Placard ring',
    })
    expect(model.hitAt(destination(radarPos, 90, placardM), 6)).toBeNull()
    expect(model.hitAt({ x: 30000, y: 0 }, 6)).toMatchObject({
      key: 'effectorMaxRange',
      radiusM: 10000,
    })
    expect(model.hitAt({ x: 50500, y: 0 }, 6)).toMatchObject({ key: 'defendedArea', radiusM: 500 })
    expect(model.hitAt({ x: 40000, y: 0 }, 6)).toBeNull()
  })

  it('drops a ring the layer or the entity override turns off', () => {
    const s = fixture()
    const noPlacard = { ...view, layers: { ...DEFAULT_LAYERS, sensorPlacard: false } }
    expect(prepareRingModel(s, noPlacard, null).rings.map((r) => r.kind)).toEqual([
      'effector',
      'asset',
    ])
    const noMax = { ...view, layers: { ...DEFAULT_LAYERS, effectorMaxRange: false } }
    expect(prepareRingModel(s, noMax, null).rings.map((r) => r.kind)).toEqual(['sensor', 'asset'])
    const override = { ...view, ringOverrides: { radar: { sensorPlacard: false } } }
    const model = prepareRingModel(s, override, null)
    expect(model.rings.map((r) => r.kind)).toEqual(['effector', 'asset'])
    expect(model.hitAt({ x: 30000, y: 0 }, 6)?.key).toBe('effectorMaxRange')
  })

  it('scales the sensor rings to the selected threat', () => {
    const s = fixture()
    const contours = { ...view, layers: { ...DEFAULT_LAYERS, sensorPdContours: true } }
    const plain = prepareRingModel(s, contours, null).rings[0]
    const scaled = prepareRingModel(s, contours, 'threat').rings[0]
    expect(plain).toMatchObject({ contourLowM: null, lowLabel: null })
    expect(scaled).toMatchObject({ held: true, behind: true })
    const low = scaled as { contourLowM: number; lowLabel: string }
    expect(low.contourLowM).toBeGreaterThan(0)
    expect(low.lowLabel).toMatch(/^Pd /)
    expect(
      prepareRingModel(s, contours, 'threat').hitAt(destination(radarPos, 0, low.contourLowM), 1)
        ?.key,
    ).toBe('pdLow')
  })

  it('caches on the scenario and lends identities across a swap', () => {
    const s = fixture()
    const first = prepareRingModel(s, view, null)
    expect(prepareRingModel(s, view, null).rings).toBe(first.rings)
    const renamed = { ...s, name: 'renamed' }
    expect(prepareRingModel(renamed, view, null, first.rings).rings).toBe(first.rings)
    const moved: Scenario = {
      ...s,
      entities: s.entities.map((e) => (e.id === 'coyote' ? { ...e, pos: { x: 21000, y: 0 } } : e)),
    }
    const next = prepareRingModel(moved, view, null, first.rings).rings
    expect(next).not.toBe(first.rings)
    expect(next[0]).toBe(first.rings[0])
    expect(next[1]).not.toBe(first.rings[1])
    expect(next[2]).toBe(first.rings[2])
    expect(
      prepareRingModel({ ...s, entities: [] }, view, null).hitAt({ x: 0, y: 0 }, 1e9),
    ).toBeNull()
  })
})
