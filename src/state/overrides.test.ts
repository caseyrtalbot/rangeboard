import { beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { activeOverrides, useOverrides } from './overrides'

const SENSOR = 'lib-giraffe1x'
const EFFECTOR = 'lib-coyote'

function overrides() {
  return useOverrides.getState().overrides
}

describe('the overrides store', () => {
  beforeEach(() => {
    useOverrides.getState().resetAll()
  })

  it('records one override per model and field, with the reason and an ISO date', () => {
    const before = Date.now()
    useOverrides.getState().setOverride(SENSOR, 'detectRangeM', 3000, '  site survey  ')
    const [entry] = overrides()

    expect(entry.modelId).toBe(SENSOR)
    expect(entry.field).toBe('detectRangeM')
    expect(entry.value).toBe(3000)
    expect(entry.reason).toBe('site survey')
    expect(Date.parse(entry.date)).toBeGreaterThanOrEqual(before)
  })

  it('replaces an existing override of the same field in place', () => {
    const store = useOverrides.getState()
    store.setOverride(SENSOR, 'detectRangeM', 3000, 'first')
    store.setOverride(SENSOR, 'updateRateS', 2, 'second')
    store.setOverride(SENSOR, 'detectRangeM', 2500, 'third')

    expect(overrides()).toHaveLength(2)
    expect(overrides()[0]).toMatchObject({ field: 'detectRangeM', value: 2500, reason: 'third' })
    expect(overrides()[1].field).toBe('updateRateS')
  })

  it('keeps a tuple value as it stands', () => {
    useOverrides.getState().setOverride(SENSOR, 'elevationDeg', [0, 45], 'mast limit')
    expect(overrides()[0].value).toEqual([0, 45])
  })

  it('rejects a blank reason and records nothing', () => {
    expect(() => useOverrides.getState().setOverride(SENSOR, 'pk', 0.5, '   ')).toThrow('An override needs a reason')
    expect(overrides()).toEqual([])
  })

  it('resets one field, one model and all, and leaves the array alone when it removes nothing', () => {
    const store = useOverrides.getState()
    store.setOverride(SENSOR, 'detectRangeM', 3000, 'a')
    store.setOverride(SENSOR, 'updateRateS', 2, 'b')
    store.setOverride(EFFECTOR, 'pk', 0.5, 'c')

    const untouched = overrides()
    store.resetField(SENSOR, 'sectorDeg')
    expect(overrides()).toBe(untouched)

    store.resetField(SENSOR, 'updateRateS')
    expect(overrides().map((o) => o.field)).toEqual(['detectRangeM', 'pk'])

    store.resetModel(SENSOR)
    expect(overrides().map((o) => o.modelId)).toEqual([EFFECTOR])

    store.resetAll()
    expect(overrides()).toEqual([])
  })

  it('adopts a restored set whole', () => {
    useOverrides.getState().setOverride(SENSOR, 'detectRangeM', 3000, 'a')
    const saved = { overrides: [{ modelId: EFFECTOR, field: 'pk', value: 0.4, reason: 'range data', date: '2026-09-10T00:00:00.000Z' }] }
    useOverrides.getState().restoreOverrides(saved)
    expect(overrides()).toEqual(saved.overrides)
  })
})

describe('activeOverrides', () => {
  const scenario = emptyScenario()
  const order = scenario.library.map((m) => m.id)

  beforeEach(() => {
    useOverrides.getState().resetAll()
  })

  it('drops an override on a model this library does not carry', () => {
    useOverrides.getState().setOverride('lib-not-here', 'pk', 0.5, 'a')
    expect(activeOverrides(overrides(), scenario)).toEqual([])
  })

  it('lists the rest in library order, then spec field order', () => {
    const store = useOverrides.getState()
    // Recorded out of order in both dimensions.
    store.setOverride(SENSOR, 'updateRateS', 2, 'a')
    store.setOverride(EFFECTOR, 'pk', 0.5, 'b')
    store.setOverride(SENSOR, 'detectRangeM', 3000, 'c')
    store.setOverride(EFFECTOR, 'minRangeM', 400, 'd')

    const first = order.indexOf(SENSOR) < order.indexOf(EFFECTOR) ? SENSOR : EFFECTOR
    const second = first === SENSOR ? EFFECTOR : SENSOR
    const fields = first === SENSOR
      ? ['detectRangeM', 'updateRateS', 'minRangeM', 'pk']
      : ['minRangeM', 'pk', 'detectRangeM', 'updateRateS']

    const active = activeOverrides(overrides(), scenario)
    expect(active.map((o) => o.modelId)).toEqual([first, first, second, second])
    expect(active.map((o) => o.field)).toEqual(fields)
  })
})
