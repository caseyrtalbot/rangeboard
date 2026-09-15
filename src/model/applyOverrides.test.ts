import { describe, expect, it } from 'vitest'
import { emptyScenario } from './seed'
import type { Override } from './libraryField'
import { activeOverrides, applyOverrides } from './applyOverrides'

const EFFECTOR = 'lib-coyote'
const SENSOR = 'lib-giraffe1x'

const override = (modelId: string, field: string, value: unknown): Override =>
  ({ modelId, field, value, reason: 'test', date: '2026-09-15T00:00:00.000Z' })

describe('applyOverrides', () => {
  it('writes the value over the library field on a copy and leaves the input untouched', () => {
    const scenario = emptyScenario()
    const before = scenario.library.find((m) => m.id === EFFECTOR)!
    const pk = before.effector!.pk
    const applied = applyOverrides(scenario, [override(EFFECTOR, 'pk', 0.02)])
    const after = applied.library.find((m) => m.id === EFFECTOR)!

    expect(after.effector!.pk).toBe(0.02)
    expect(before.effector!.pk).toBe(pk)
    expect(scenario.library.find((m) => m.id === EFFECTOR)).toBe(before)
    expect(after).not.toBe(before)
    expect(applied.entities).toBe(scenario.entities)
    // The other models are the same objects.
    expect(applied.library.find((m) => m.id === SENSOR)).toBe(scenario.library.find((m) => m.id === SENSOR))
  })

  it('drops the provenance row of the overridden field, as an edit does', () => {
    const scenario = emptyScenario()
    const before = scenario.library.find((m) => m.id === SENSOR)!
    expect(before.provenance?.some((r) => r.field === 'detectRangeM')).toBe(true)
    const after = applyOverrides(scenario, [override(SENSOR, 'detectRangeM', 3200)]).library
      .find((m) => m.id === SENSOR)!
    expect(after.sensor!.detectRangeM).toBe(3200)
    expect(after.provenance?.some((r) => r.field === 'detectRangeM')).toBe(false)
    expect(after.provenance!.length).toBe(before.provenance!.length - 1)
  })

  it('returns the same scenario with no override on a library model', () => {
    const scenario = emptyScenario()
    expect(applyOverrides(scenario, [])).toBe(scenario)
    expect(applyOverrides(scenario, [override('lib-not-here', 'pk', 0.5)])).toBe(scenario)
  })

  it('applies the manifest list activeOverrides records', () => {
    const scenario = emptyScenario()
    const recorded = activeOverrides(
      [override(SENSOR, 'updateRateS', 2), override('lib-not-here', 'pk', 0.5), override(EFFECTOR, 'pk', 0.02)],
      scenario,
    )
    expect(recorded).toHaveLength(2)
    const applied = applyOverrides(scenario, recorded)
    expect(applied.library.find((m) => m.id === SENSOR)!.sensor!.updateRateS).toBe(2)
    expect(applied.library.find((m) => m.id === EFFECTOR)!.effector!.pk).toBe(0.02)
  })
})
