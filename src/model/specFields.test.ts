import { describe, expect, it } from 'vitest'
import { SEED_LIBRARY } from './seedLibrary'
import { dropEditedProvenance, specFields } from './types'
import type { Provenance, SpecModel, SensorSpec } from './types'

describe('specFields', () => {
  it.each(['sensor', 'uas', 'effector', 'c2'] as const)(
    'exposes the %s spec without copying or changing field order',
    (key) => {
      const model = SEED_LIBRARY.find((entry) => entry[key] != null)!
      const fields = specFields(model)
      expect(fields).toBe(model[key])
      expect(Object.keys(fields)).toEqual(Object.keys(model[key]!))
      expect(fields['missing-field']).toBeUndefined()
    },
  )

  it('returns no fields for a model without a spec', () => {
    const model: SpecModel = {
      id: 'asset',
      kind: 'asset',
      name: 'Asset',
      description: '',
      color: '#000000',
      builtin: false,
    }
    expect(specFields(model)).toEqual({})
  })

  it('keeps unchanged provenance and drops only the edited field', () => {
    const before: SpecModel = {
      id: 'c2',
      kind: 'c2',
      name: 'C2',
      description: '',
      color: '#000000',
      builtin: false,
      c2: { decisionLatencyS: 2, operatorTrackCapacity: 10 },
      provenance: ['decisionLatencyS', 'operatorTrackCapacity'].map((field) => ({
        field,
        value: 'recorded',
        source: 'test',
        date: '2026-09-16',
        basis: 'reference',
      })),
    }
    const unchanged = { ...before, c2: { ...before.c2 } }
    expect(dropEditedProvenance(before, unchanged)).toBe(unchanged)
    const edited = { ...before, c2: { ...before.c2, decisionLatencyS: 3 } }
    expect(dropEditedProvenance(before, edited).provenance).toEqual([before.provenance![1]])
    expect(before.provenance).toHaveLength(2)
    expect(before.c2?.decisionLatencyS).toBe(2)
  })

  it('returns after when an object field differs only by key order', () => {
    const classification = {
      sensorType: 'radar' as const,
      bands: [{ maxRangeM: 1000, pCorrect: 0.8, pFalseHostile: 0.1, timeToDeclareS: 1 }],
    }
    const before = sensorModel({ ...radar(), classification }, 'classification')
    const after: SpecModel = {
      ...before,
      sensor: {
        ...before.sensor!,
        classification: { bands: classification.bands, sensorType: classification.sensorType },
      },
    }
    expect(JSON.stringify(before.sensor?.classification)).not.toBe(
      JSON.stringify(after.sensor?.classification),
    )
    expect(dropEditedProvenance(before, after)).toBe(after)
  })

  it('drops provenance when a tuple field changes order', () => {
    const before = sensorModel({ ...radar(), elevationDeg: [0, 45] }, 'elevationDeg')
    const after: SpecModel = {
      ...before,
      sensor: { ...before.sensor!, elevationDeg: [45, 0] },
    }
    expect(dropEditedProvenance(before, after)).not.toBe(after)
    expect(dropEditedProvenance(before, after).provenance).toEqual([])
  })
})

function row(field: string): Provenance {
  return {
    field,
    value: 'recorded',
    source: 'test',
    date: '2026-09-16',
    basis: 'reference',
  }
}

function radar(): SensorSpec {
  return {
    sensorType: 'radar',
    detectRangeM: 1000,
    classifyRangeM: null,
    sectorDeg: 360,
  }
}

function sensorModel(sensor: SensorSpec, field: string): SpecModel {
  return {
    id: 'sensor',
    kind: 'sensor',
    name: 'Sensor',
    description: '',
    color: '#000000',
    builtin: false,
    sensor,
    provenance: [row(field)],
  }
}
