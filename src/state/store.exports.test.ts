import { expect, it } from 'vitest'
import * as store from './store'
import { modelFor, pathSpeed, scenarioDurationS } from '../model/scenario'
import { EFFECTOR_RING_KEYS, RING_KEYS, SENSOR_RING_KEYS } from './rings'

it('preserves public helper and ring identities for existing UI consumers', () => {
  expect(store.modelFor).toBe(modelFor)
  expect(store.pathSpeed).toBe(pathSpeed)
  expect(store.scenarioDurationS).toBe(scenarioDurationS)
  expect(store.SENSOR_RING_KEYS).toBe(SENSOR_RING_KEYS)
  expect(store.EFFECTOR_RING_KEYS).toBe(EFFECTOR_RING_KEYS)
  expect(store.RING_KEYS).toBe(RING_KEYS)
})
