import { describe, expect, it } from 'vitest'
import { effectiveJamRangeM } from '../analysis/ewPhysics'
import { effectiveDetectRangeM, FT_TO_M } from '../analysis/sensorEnv'
import { destination, formatNm } from '../geometry/geo'
import { groundRangeM } from '../geometry/slant'
import { emptyScenario } from '../model/seed'
import type { EffectorSpec, Entity, Provenance, Scenario } from '../model/types'
import { mountHeightOf } from '../model/types'
import { DEFAULT_LAYERS } from '../state/layers'
import type { RingView } from './ringModel'
import { prepareRingModel, ringHitFor } from './ringModel'

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
    expect(rings[1]).toMatchObject({
      kind: 'effector',
      maxM: 10000,
      mrirM: 10000 * (2 / 3),
      minM: null,
      mrirBasis: 'default',
    })
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
    const noMax = {
      ...view,
      layers: { ...DEFAULT_LAYERS, effectorMaxRange: false, effectorDoctrinal: false },
    }
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

/** Every effector ring on, the threat at 400 ft AGL, a jammer far west of the radar. */
const allEffector: RingView = {
  ...view,
  layers: { ...DEFAULT_LAYERS, effectorMinRange: true, effectorDoctrinal: true },
}
const coyotePos = { x: 20000, y: 0 }
const jamPos = { x: -50000, y: 0 }

function mirFixture(edit: Partial<EffectorSpec> = {}, provenance: Provenance[] = []): Scenario {
  const s = fixture()
  s.entities = [
    ...s.entities.map((e) => (e.id === 'threat' ? { ...e, altitudeFt: 400 } : e)),
    { ...entity('jam', 'effector', 'lib-cuaews', 0), pos: jamPos },
  ]
  s.library = s.library.map((m) =>
    m.id === 'lib-coyote'
      ? {
          ...m,
          effector: { ...m.effector!, ...edit },
          provenance: [...(m.provenance ?? []), ...provenance],
        }
      : m,
  )
  return s
}

function specOf(s: Scenario, id: string): EffectorSpec {
  return s.library.find((m) => m.id === id)!.effector!
}

describe('MIR and MRIR rings', () => {
  it('draws MRIR at 2/3 MIR, ground projected at the threat altitude', () => {
    const s = mirFixture()
    const spec = specOf(s, 'lib-coyote')
    const dAltM = 400 * FT_TO_M - mountHeightOf(spec)
    const model = prepareRingModel(s, allEffector, 'threat')
    const mirM = groundRangeM(10000, dAltM)
    const mrirM = groundRangeM(10000 * (2 / 3), dAltM)
    expect(model.rings[1]).toMatchObject({
      kind: 'effector',
      maxM: mirM,
      mrirM,
      minM: groundRangeM(500, dAltM),
      mrirBasis: 'default',
      mrirFraction: 2 / 3,
      altitudeFt: 400,
    })
    expect(model.hitAt(destination(coyotePos, 90, mrirM), 1)).toMatchObject({
      key: 'effectorDoctrinal',
      name: 'MRIR',
      distance: formatNm(mrirM),
      height: '400 ft AGL',
      basis: '2/3 MIR · PF',
    })
    expect(model.hitAt(destination(coyotePos, 90, mirM), 1)).toMatchObject({
      name: 'MIR',
      height: '400 ft AGL',
      basis: null,
    })
    expect(model.hitAt(destination(coyotePos, 90, groundRangeM(500, dAltM)), 1)?.name).toBe(
      'Min range',
    )
  })

  it('reads nm at two decimals and No threat with no threat selected', () => {
    const model = prepareRingModel(mirFixture(), allEffector, null)
    expect(model.hitAt({ x: 30000, y: 0 }, 1)).toMatchObject({
      name: 'MIR',
      radiusM: 10000,
      distance: '5.40 nm',
      height: 'No threat',
    })
  })

  it('names an edited MRIR by its fraction and a sourced MRIR by its row', () => {
    const edited = prepareRingModel(mirFixture({ mrirM: 7500 }), allEffector, null)
    expect(edited.rings[1]).toMatchObject({ mrirM: 7500, mrirBasis: 'edited', mrirFraction: 0.75 })
    expect(edited.hitAt({ x: 27500, y: 0 }, 1)?.basis).toBe('0.75 MIR · Edited')
    const row: Provenance = {
      field: 'mrirM',
      value: '7500',
      source: 'Test datasheet',
      date: '2026-09-29',
      basis: 'datasheet',
    }
    const sourced = prepareRingModel(mirFixture({ mrirM: 7500 }, [row]), allEffector, null)
    expect(sourced.rings[1]).toMatchObject({ mrirBasis: 'sourced' })
    expect(sourced.hitAt({ x: 27500, y: 0 }, 1)?.basis).toBe('Sourced')
  })

  it('draws an MRIR equal to MIR once, as MIR, and as MRIR with MIR hidden', () => {
    const s = mirFixture({ mrirM: 10000 })
    const both = prepareRingModel(s, allEffector, null)
    expect(both.rings[1]).toMatchObject({ maxM: 10000, mrirM: null })
    expect(both.hitAt({ x: 30000, y: 0 }, 1)?.name).toBe('MIR')
    const layers = { ...allEffector.layers, effectorMaxRange: false }
    const alone = prepareRingModel(s, { ...allEffector, layers }, null)
    expect(alone.rings[1]).toMatchObject({ maxM: null, mrirM: 10000 })
    expect(alone.hitAt({ x: 30000, y: 0 }, 1)?.name).toBe('MRIR')
  })

  it('projects the jammer MIR and MRIR from the effective jam range', () => {
    const s = mirFixture()
    const spec = specOf(s, 'lib-cuaews')
    const uas = s.library.find((m) => m.kind === 'uas')!.uas!
    const dAltM = 400 * FT_TO_M - mountHeightOf(spec)
    const jamM = effectiveJamRangeM(spec, uas)
    const model = prepareRingModel(s, allEffector, 'threat')
    const rangeM = groundRangeM(jamM, dAltM)
    const mrirM = groundRangeM(jamM * (2 / 3), dAltM)
    expect(model.rings.find((r) => r.entity.id === 'jam')).toMatchObject({
      kind: 'jammer',
      rangeM,
      mrirM,
      minM: null,
      mrirBasis: 'default',
      altitudeFt: 400,
    })
    expect(model.hitAt(destination(jamPos, 270, rangeM), 1)).toMatchObject({
      key: 'effectorMaxRange',
      name: 'MIR',
    })
    expect(model.hitAt(destination(jamPos, 270, mrirM), 1)).toMatchObject({
      key: 'effectorDoctrinal',
      name: 'MRIR',
      basis: '2/3 MIR · PF',
    })
  })

  it('gives no height line on the placard and the defended area', () => {
    const s = mirFixture()
    const model = prepareRingModel(s, allEffector, 'threat')
    const placardM = (model.rings[0] as { placardM: number }).placardM
    expect(model.hitAt(destination(radarPos, 0, placardM), 1)).toMatchObject({
      name: 'Placard ring',
      height: null,
    })
    expect(model.hitAt({ x: 50500, y: 0 }, 1)).toMatchObject({ key: 'defendedArea', height: null })
  })

  it('re-reads a pinned ring, and finds none once the ring is off', () => {
    const s = mirFixture()
    const at = { x: 30000, y: 0 }
    const plain = prepareRingModel(s, allEffector, null)
    expect(ringHitFor(plain.rings, 'coyote', 'effectorMaxRange', at)).toMatchObject({
      radiusM: 10000,
      distanceM: 0,
      height: 'No threat',
    })
    const threat = prepareRingModel(s, allEffector, 'threat')
    const hit = ringHitFor(threat.rings, 'coyote', 'effectorMaxRange', at)
    expect(hit?.height).toBe('400 ft AGL')
    expect(hit?.radiusM).toBeLessThan(10000)
    const layers = { ...allEffector.layers, effectorMaxRange: false }
    const off = prepareRingModel(s, { ...allEffector, layers }, 'threat')
    expect(ringHitFor(off.rings, 'coyote', 'effectorMaxRange', at)).toBeNull()
  })
})
