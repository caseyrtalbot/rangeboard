import { beforeEach, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { emptyScenario } from '../model/seed'
import { modelFor } from '../model/scenario'
import { sensorHoldsPoint } from './detection'

beforeEach(() => useStore.getState().replaceScenario(emptyScenario()))

it('sensorHoldsPoint holds a quad close to a 360 deg radar and not far beyond its ring', () => {
  const st = useStore.getState()
  st.addEntityFromModel('lib-kurfs', { x: 0, y: 0 })
  const scenario = useStore.getState().scenario
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor')
  const quad = scenario.library.find((m) => m.id === 'lib-mavic3')
  expect(quad?.uas).toBeDefined()
  expect(modelFor(scenario, sensors[0])?.sensor?.detectRangeM).toBe(15000)
  expect(sensorHoldsPoint(scenario, sensors, quad, { x: 1000, y: 0 })).toBe(true)
  expect(sensorHoldsPoint(scenario, sensors, quad, { x: 100000, y: 0 })).toBe(false)
  expect(sensorHoldsPoint(scenario, [], quad, { x: 1000, y: 0 })).toBe(false)
})
