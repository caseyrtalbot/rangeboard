import { describe, expect, it } from 'vitest'
import { overridesAutosaveAdapter, parseOverrideSet } from './persistOverrides'
import { OVERRIDES_KEY, OVERRIDES_RECOVERY_PREFIX } from './storageKeys'

const entry = {
  modelId: 'lib-giraffe1x',
  field: 'detectRangeM',
  value: 3000,
  reason: 'site survey',
  date: '2026-09-10T00:00:00.000Z',
}
const raw = (overrides: unknown[]) => JSON.stringify({ overrides })

describe('parseOverrideSet', () => {
  it('keeps every override and every JSON value shape', () => {
    const tuple = { ...entry, field: 'elevationDeg', value: [0, 45] }
    const cleared = { ...entry, field: 'classifyRangeM', value: null }
    expect(parseOverrideSet(raw([entry, tuple, cleared]))).toEqual({
      overrides: [entry, tuple, cleared],
    })
  })

  it.each([
    ['a record that is not an object', '[]', 'overrideSet: expected an object'],
    ['a missing list', '{}', 'overrideSet.overrides: expected an array'],
    [
      'a blank model id',
      raw([{ ...entry, modelId: ' ' }]),
      'overrideSet.overrides[0].modelId: expected a nonempty string',
    ],
    [
      'a missing field key',
      raw([{ ...entry, field: undefined }]),
      'overrideSet.overrides[0].field: expected a nonempty string',
    ],
    [
      'a blank reason',
      raw([{ ...entry, reason: '' }]),
      'overrideSet.overrides[0].reason: expected a nonempty string',
    ],
    [
      'an unreadable date',
      raw([{ ...entry, date: 'last tuesday' }]),
      'overrideSet.overrides[0].date: expected an ISO date',
    ],
    [
      'an absent value',
      raw([{ modelId: 'm', field: 'f', reason: 'r', date: entry.date }]),
      'overrideSet.overrides[0].value: expected a value',
    ],
  ])('rejects %s with its path', (_what, text, message) => {
    expect(() => parseOverrideSet(text)).toThrow(message)
  })
})

describe('the overrides autosave adapter', () => {
  it('keeps its own key, recovery prefix and label, and never writes before a restore', () => {
    expect(overridesAutosaveAdapter.key).toBe(OVERRIDES_KEY)
    expect(overridesAutosaveAdapter.recoveryPrefix).toBe(OVERRIDES_RECOVERY_PREFIX)
    expect(overridesAutosaveAdapter.label).toBe('overrides')
    expect(overridesAutosaveAdapter.deferred).toBe(true)
  })
})
