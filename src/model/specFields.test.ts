import { describe, expect, it } from 'vitest'
import { SEED_LIBRARY } from './seedLibrary'
import { dropEditedProvenance, specFields } from './types'
import type { SpecModel } from './types'

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
})
