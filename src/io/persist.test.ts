import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { EngagePolicy, Scenario } from '../model/types'
import { fillScenario } from './persist'

/** A save written before the roe field existed. */
function legacySave(engageOn?: EngagePolicy): Scenario {
  const s = emptyScenario()
  delete s.roe
  if (engageOn) s.engageOn = engageOn
  return s
}

describe('engageOn -> roe load migration', () => {
  it("maps engageOn 'detected' to weapons free", () => {
    expect(fillScenario(legacySave('detected')).roe).toBe('free')
  })

  it("maps engageOn 'confirmed' to weapons tight", () => {
    expect(fillScenario(legacySave('confirmed')).roe).toBe('tight')
  })

  it('defaults to tight when neither field exists', () => {
    expect(fillScenario(legacySave()).roe).toBe('tight')
  })

  it('an explicit roe wins over a legacy engageOn', () => {
    const s: Scenario = { ...legacySave('detected'), roe: 'hold' }
    expect(fillScenario(s).roe).toBe('hold')
  })

  it('keeps saved fields while filling defaults', () => {
    const s = legacySave('confirmed')
    s.name = 'Old save'
    const out = fillScenario(s)
    expect(out.name).toBe('Old save')
    expect(out.schemaVersion).toBe(1)
  })
})
