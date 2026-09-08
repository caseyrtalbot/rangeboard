import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { SCENARIO_LEGACY_FIELDS, boardLegacyOmissions } from './compat'
import { teLegacyOmissions } from '../te/io/compatTe'
import { fillScenario } from './persist'
import { runtimeShapes } from './runtimeSchema'

const base = JSON.stringify(emptyScenario())
const save = (): Record<string, unknown> => JSON.parse(base) as Record<string, unknown>
const filled = (legacy: Record<string, unknown>): Record<string, unknown> =>
  fillScenario(legacy) as unknown as Record<string, unknown>

// The declaration is the one owner: an omission the validator accepts must have
// a fill, and a field fillScenario supplies must be an accepted omission.
describe('Board schema-1 compatibility ownership', () => {
  it('declares shapes the T&E domain does not, so the merged table hides nothing', () => {
    const shared = Object.keys(boardLegacyOmissions).filter((k) => k in teLegacyOmissions)
    expect(shared).toEqual([])
  })
  it('accepts exactly the omissions the declaration names', () => {
    expect(boardLegacyOmissions.Scenario).toEqual(new Set(Object.keys(SCENARIO_LEGACY_FIELDS)))
    for (const [field, { shape }] of Object.entries(SCENARIO_LEGACY_FIELDS)) {
      if (shape) expect(boardLegacyOmissions[shape], field).toBe('all')
    }
  })

  it('fills every accepted omission', () => {
    const empty = save()
    for (const [field, { fill }] of Object.entries(SCENARIO_LEGACY_FIELDS)) {
      const legacy = save()
      delete legacy[field]
      const out = filled(legacy)[field]
      // Reconciled fields take the current seeds, not the saved list.
      if (fill === 'reconciled') expect((out as unknown[]).length, field).toBe((empty[field] as unknown[]).length)
      else expect(out, field).toEqual(empty[field])
    }
  })

  it('fills every field a legacy container may omit', () => {
    const empty = save()
    for (const [field, { shape }] of Object.entries(SCENARIO_LEGACY_FIELDS)) {
      if (!shape) continue
      for (const key of Object.keys(runtimeShapes[shape].properties ?? {})) {
        const legacy = save()
        const container = { ...(legacy[field] as Record<string, unknown>) }
        delete container[key]
        legacy[field] = container
        const out = filled(legacy)[field] as Record<string, unknown>
        expect(out[key], `${field}.${key}`).toEqual((empty[field] as Record<string, unknown>)[key])
      }
    }
  })
})
