import { describe, expect, it } from 'vitest'
import { emptyScenario } from './seed'
import type { Scenario } from './types'
import {
  DEFAULT_CONFIDENCE,
  DEFAULT_SAMPLING,
  DEFAULT_SENSITIVITY_DEPTH,
  DEFAULT_SOBOL_BASE,
  DEFAULT_STOP_CAP,
  DEFAULT_STOP_FLOOR,
  DEFAULT_TARGET_HALF_WIDTH,
  runSettings,
} from './types'

/** A save that predates every run field: the compatibility defaults apply. */
function oldSave(): Scenario {
  const s = emptyScenario()
  delete s.runMode
  delete s.seed
  delete s.replicates
  delete s.targetHalfWidth
  delete s.uncertainty
  delete s.sampling
  return s
}

describe('runSettings', () => {
  it('reads the fresh scenario as a Monte Carlo run under total uncertainty with a half-width stop', () => {
    const run = runSettings(emptyScenario())
    expect(run.runMode).toBe('monte-carlo')
    expect(run.uncertainty).toBe('total')
    expect(run.sampling).toBe('lhs')
    expect(run.targetHalfWidth).toBe(DEFAULT_TARGET_HALF_WIDTH)
    expect(run.stopFloor).toBeLessThan(run.stopCap)
  })

  it('keeps the compatibility defaults on a save without the run fields and fills the new ones', () => {
    const run = runSettings(oldSave())
    expect(run.runMode).toBe('deterministic')
    expect(run.uncertainty).toBe('aleatory')
    expect(run.targetHalfWidth).toBeNull()
    expect(run.sampling).toBe(DEFAULT_SAMPLING)
    expect(run.sensitivityDepth).toBe(DEFAULT_SENSITIVITY_DEPTH)
    expect(run.sobolBase).toBe(DEFAULT_SOBOL_BASE)
    expect(run.stopFloor).toBe(DEFAULT_STOP_FLOOR)
    expect(run.stopCap).toBe(DEFAULT_STOP_CAP)
    expect(run.confidence).toBe(DEFAULT_CONFIDENCE)
  })

  it('reads a valid value of each new field as written', () => {
    const run = runSettings({
      ...emptyScenario(),
      sampling: 'independent',
      sensitivityDepth: 'quick',
      sobolBase: 512,
      stopFloor: 50,
      stopCap: 500,
      confidence: 0.9,
    })
    expect(run.sampling).toBe('independent')
    expect(run.sensitivityDepth).toBe('quick')
    expect(run.sobolBase).toBe(512)
    expect(run.stopFloor).toBe(50)
    expect(run.stopCap).toBe(500)
    expect(run.confidence).toBe(0.9)
  })

  it('falls back to the default on an invalid value, field by field', () => {
    const bad = {
      ...emptyScenario(),
      sampling: 'sobol',
      sensitivityDepth: 'deep',
      sobolBase: 2.5,
      stopFloor: 0,
      stopCap: -1,
      confidence: 1,
    } as unknown as Scenario
    const run = runSettings(bad)
    expect(run.sampling).toBe(DEFAULT_SAMPLING)
    expect(run.sensitivityDepth).toBe(DEFAULT_SENSITIVITY_DEPTH)
    expect(run.sobolBase).toBe(DEFAULT_SOBOL_BASE)
    expect(run.stopFloor).toBe(DEFAULT_STOP_FLOOR)
    expect(run.stopCap).toBe(DEFAULT_STOP_CAP)
    expect(run.confidence).toBe(DEFAULT_CONFIDENCE)
    expect(runSettings({ ...emptyScenario(), confidence: 0 }).confidence).toBe(DEFAULT_CONFIDENCE)
    expect(runSettings({ ...emptyScenario(), confidence: NaN }).confidence).toBe(DEFAULT_CONFIDENCE)
  })

  it('resets both stop bounds when the floor is above the cap', () => {
    const run = runSettings({ ...emptyScenario(), stopFloor: 300, stopCap: 200 })
    expect(run.stopFloor).toBe(DEFAULT_STOP_FLOOR)
    expect(run.stopCap).toBe(DEFAULT_STOP_CAP)
    expect(runSettings({ ...emptyScenario(), stopFloor: 200, stopCap: 200 }).stopFloor).toBe(200)
  })
})
