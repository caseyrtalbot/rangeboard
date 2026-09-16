import { describe, expect, it } from 'vitest'
import type { Provenance, SpecModel } from './types'
import {
  adoptSeedFields,
  adoptSeedProvenance,
  importModels,
  initialLibrary,
  reconcileLibrary,
  reconcileLibraryReport,
  reconcileSeeded,
  resetBuiltin,
} from './libraryLifecycle'

/** A sensor model with two spec fields and one source row on updateRateS. */
function seedModel(): SpecModel {
  return {
    id: 'lib-x',
    name: 'X radar',
    kind: 'sensor',
    description: '',
    color: '#888888',
    builtin: true,
    sensor: {
      sensorType: 'radar',
      role: 'surveillance',
      detectRangeM: 4000,
      classifyRangeM: null,
      sectorDeg: 360,
      elevationDeg: null,
      maxAltitudeFt: null,
      resolutionM: null,
      updateRateS: 1,
    },
    provenance: [
      {
        field: 'updateRateS',
        value: '1 s',
        source: 'a maker page',
        url: 'https://example.test/x',
        date: '2026-09-04',
        basis: 'reference',
      },
      {
        field: 'detectRangeM',
        value: '4000 m',
        source: 'a maker page',
        url: 'https://example.test/x',
        date: '2026-09-04',
        basis: 'datasheet',
      },
    ],
  }
}

/** A second seed, so a reconcile has one entry to append. */
function otherSeed(): SpecModel {
  return { ...seedModel(), id: 'lib-y', name: 'Y radar', provenance: undefined }
}

describe('reconcile', () => {
  it('keeps the saved copy of a seed id and appends a seed the save never held', () => {
    const saved: SpecModel = { ...seedModel(), name: 'Renamed by the user' }
    const out = reconcileLibrary([saved], [seedModel(), otherSeed()])
    expect(out.map((m) => m.id)).toEqual(['lib-x', 'lib-y'])
    expect(out[0].name).toBe('Renamed by the user')
  })

  it('leaves a deleted seed id out and keeps a custom model', () => {
    const mine: SpecModel = { ...otherSeed(), id: 'lib-custom-1', builtin: false }
    const out = reconcileLibrary([mine], [seedModel(), otherSeed()], ['lib-x'])
    expect(out.map((m) => m.id)).toEqual(['lib-custom-1', 'lib-y'])
  })

  it('takes the whole seed set when the save carries no list', () => {
    const out = reconcileSeeded(undefined, [seedModel(), otherSeed()])
    expect(out.map((m) => m.id)).toEqual(['lib-x', 'lib-y'])
  })

  it('adopts a seed row the saved builtin predates', () => {
    const saved: SpecModel = { ...seedModel(), provenance: undefined }
    const out = reconcileLibrary([saved], [seedModel()])
    expect(out[0].provenance?.map((r) => r.field)).toEqual(['updateRateS', 'detectRangeM'])
  })
})

describe('adoptSeedFields', () => {
  it('gives a saved builtin a seed spec key it does not hold and keeps every key it holds', () => {
    const seed = seedModel()
    seed.sensor = { ...seed.sensor!, rangeAccuracyM: 25, azimuthAccuracyDeg: 1 }
    const saved: SpecModel = { ...seedModel() }
    saved.sensor = { ...saved.sensor!, detectRangeM: 1234, azimuthAccuracyDeg: null }
    const out = adoptSeedFields(saved, seed)
    expect(out.sensor?.rangeAccuracyM).toBe(25)
    expect(out.sensor?.azimuthAccuracyDeg).toBeNull()
    expect(out.sensor?.detectRangeM).toBe(1234)
    expect(out).not.toBe(saved)
    expect(saved.sensor?.rangeAccuracyM).toBeUndefined()
  })

  it('adopts only the listed keys: an older seed key the save lacks stays absent', () => {
    const seed = seedModel()
    seed.sensor = { ...seed.sensor!, urbanRangeM: 900, rangeAccuracyM: 25 }
    const saved = seedModel()
    delete (saved.sensor as unknown as Record<string, unknown>).urbanRangeM
    const out = adoptSeedFields(saved, seed)
    expect(out.sensor?.rangeAccuracyM).toBe(25)
    expect('urbanRangeM' in out.sensor!).toBe(false)
  })

  it('adopts a spec block the save lacks, returns the same object with nothing to adopt, and skips a custom model', () => {
    const seed: SpecModel = {
      ...seedModel(),
      c2: { decisionLatencyS: 10, decisionLatencySigmaDb: 3, operatorTrackCapacity: 6 },
    }
    const saved = seedModel()
    const out = adoptSeedFields(saved, seed)
    expect(out.c2).toEqual(seed.c2)
    expect(out.c2).not.toBe(seed.c2)
    const same = seedModel()
    expect(adoptSeedFields(same, seedModel())).toBe(same)
    const custom: SpecModel = { ...seedModel(), builtin: false }
    expect(adoptSeedFields(custom, seed)).toBe(custom)
  })

  it('reaches the save through reconcileLibrary', () => {
    const seed = seedModel()
    seed.sensor = { ...seed.sensor!, falseAlarmRatePerScan: 1 }
    const out = reconcileLibrary([seedModel()], [seed])
    expect(out[0].sensor?.falseAlarmRatePerScan).toBe(1)
  })
})

describe('reconcileLibraryReport', () => {
  it('names the models and the keys a save that predates the Phase 2 fields adopted', () => {
    const seed = seedModel()
    seed.sensor = { ...seed.sensor!, rangeAccuracyM: 25, falseAlarmRatePerScan: 1 }
    seed.c2 = { decisionLatencyS: 10, decisionLatencySigmaDb: 3, operatorTrackCapacity: 6 }
    const other = { ...otherSeed(), sensor: { ...otherSeed().sensor!, rangeAccuracyM: 40 } }
    const report = reconcileLibraryReport([seedModel(), otherSeed()], [seed, other])

    expect(report.library.map((m) => m.id)).toEqual(['lib-x', 'lib-y'])
    expect(report.library[0].sensor?.rangeAccuracyM).toBe(25)
    expect(report.adopted).toEqual([
      { modelId: 'lib-x', block: 'sensor', keys: ['rangeAccuracyM', 'falseAlarmRatePerScan'] },
      // A block the save has none of reports every key of the seed block.
      {
        modelId: 'lib-x',
        block: 'c2',
        keys: ['decisionLatencyS', 'decisionLatencySigmaDb', 'operatorTrackCapacity'],
      },
      { modelId: 'lib-y', block: 'sensor', keys: ['rangeAccuracyM'] },
    ])
    // The library is the one reconcileLibrary gives for the same arguments.
    expect(report.library).toEqual(reconcileLibrary([seedModel(), otherSeed()], [seed, other]))
  })

  it('reports nothing for a save that already holds the keys, and for a custom model', () => {
    const seed = seedModel()
    seed.sensor = { ...seed.sensor!, rangeAccuracyM: 25 }
    const held: SpecModel = { ...seed, sensor: { ...seed.sensor, rangeAccuracyM: null } }
    expect(reconcileLibraryReport([held], [seed]).adopted).toEqual([])

    const custom: SpecModel = { ...seedModel(), id: 'lib-custom-1', builtin: false }
    expect(reconcileLibraryReport([custom], [seed], ['lib-x']).adopted).toEqual([])
  })
})

describe('adoptSeedProvenance', () => {
  it('gives an unedited field the seed row', () => {
    const seed = seedModel()
    const saved: SpecModel = { ...seed, provenance: undefined }
    const out = adoptSeedProvenance(saved, seed)
    expect(out.provenance?.map((r) => r.field)).toEqual(['updateRateS', 'detectRangeM'])
  })

  it('gives an edited field no row', () => {
    const seed = seedModel()
    const saved: SpecModel = {
      ...seed,
      sensor: { ...seed.sensor!, updateRateS: 4 },
      provenance: undefined,
    }
    const out = adoptSeedProvenance(saved, seed)
    expect(out.provenance?.map((r) => r.field)).toEqual(['detectRangeM'])
  })

  it('keeps a saved row over the seed row for the same field', () => {
    const seed = seedModel()
    const mine: Provenance = {
      field: 'updateRateS',
      value: '1 s',
      source: 'my note',
      url: null,
      date: '2026-01-01',
      basis: 'pf',
    }
    const out = adoptSeedProvenance({ ...seed, provenance: [mine] }, seed)
    expect(out.provenance?.find((r) => r.field === 'updateRateS')).toEqual(mine)
    expect(out.provenance).toHaveLength(2)
  })

  it('returns a custom model unchanged', () => {
    const seed = seedModel()
    const saved: SpecModel = { ...seed, builtin: false, provenance: undefined }
    expect(adoptSeedProvenance(saved, seed)).toBe(saved)
  })

  it('returns the same object when every seed row is already there', () => {
    const seed = seedModel()
    const saved: SpecModel = { ...seed }
    expect(adoptSeedProvenance(saved, seed)).toBe(saved)
  })
})

describe('importModels', () => {
  it('keeps the existing model on an id collision and appends the rest', () => {
    const mine: SpecModel = { ...seedModel(), name: 'Mine', builtin: false }
    const out = importModels([mine], [seedModel(), otherSeed()])
    expect(out.map((m) => m.id)).toEqual(['lib-x', 'lib-y'])
    expect(out[0]).toBe(mine)
  })
})

describe('resetBuiltin', () => {
  const seeds = [seedModel()]

  it('puts an edited builtin back to a copy of the seed', () => {
    const edited: SpecModel = { ...seedModel(), name: 'Edited', provenance: [] }
    const out = resetBuiltin([edited], 'lib-x', seeds)
    expect(out[0]).toEqual(seedModel())
    expect(out[0]).not.toBe(seeds[0])
    expect(out[0].sensor).not.toBe(seeds[0].sensor)
  })

  it('returns the same array for an unedited builtin, a custom model and an unknown id', () => {
    const same = [seedModel()]
    expect(resetBuiltin(same, 'lib-x', seeds)).toBe(same)
    const mine = [{ ...seedModel(), name: 'Mine', builtin: false }]
    expect(resetBuiltin(mine, 'lib-x', seeds)).toBe(mine)
    expect(resetBuiltin(same, 'lib-missing', seeds)).toBe(same)
  })

  it('reads the seed library by default', () => {
    const library = initialLibrary().map((m) =>
      m.id === 'lib-giraffe1x' ? { ...m, name: 'Edited' } : m,
    )
    const out = resetBuiltin(library, 'lib-giraffe1x')
    expect(out.find((m) => m.id === 'lib-giraffe1x')?.name).toBe('Giraffe 1X 3D radar (Saab)')
  })
})
