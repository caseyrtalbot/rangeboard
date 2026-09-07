import { expect, it } from 'vitest'
import { emptyScenario } from './seed'
import type { Entity, FlightPath } from './types'
import { engineKeyOf, markPresentationVariant, modelFor, pathSpeed, scenarioDurationS } from './scenario'

const entity: Entity = {
  id: 'r1-uas', kind: 'uas', specId: 'lib-shahed136', name: 'R1 path probe',
  pos: { x: 0, y: 0 }, headingDeg: 0, color: null, notes: '',
}
const path: FlightPath = {
  id: 'r1-path', entityId: entity.id,
  points: [{ x: 0, y: 0 }, { x: 3000, y: 4000 }],
  speedMps: null, startDelayS: 0,
}

it('resolves model identity and preserves the speed override, cruise and missing-model fallback', () => {
  const s = emptyScenario()
  s.entities = [entity]
  // Pin this helper test independently of sourced seed speed updates.
  const model = s.library.find(m => m.id === entity.specId)!
  model.uas = { ...model.uas!, cruiseSpeedMps: 50 }
  expect(modelFor(s, entity)).toBe(model)
  expect(pathSpeed(s, path)).toBe(50)
  expect(pathSpeed(s, { ...path, speedMps: 25 })).toBe(25)
  expect(pathSpeed(s, { ...path, speedMps: 0 })).toBe(50)
  expect(pathSpeed(s, { ...path, speedMps: -1 })).toBe(50)
  s.library = []
  expect(modelFor(s, entity)).toBeUndefined()
  expect(pathSpeed(s, path)).toBe(15)
  s.entities = []
  expect(pathSpeed(s, path)).toBe(15)
})

it('keeps the 60 s floor and rounds the longest delayed path horizon up to a whole second', () => {
  const s = emptyScenario()
  expect(scenarioDurationS(s)).toBe(60)
  s.paths = [{ ...path, speedMps: 50, startDelayS: 0.25 }]
  s.raid = { waves: [{ entityIds: [entity.id], startDelayS: 20 }] }
  // 3-4-5 km path / 50 m/s + 0.25 s path delay + 20 s wave delay = 120.25 s.
  expect(scenarioDurationS(s)).toBe(121)
  s.paths.push({ ...path, id: 'r1-short', entityId: 'unassigned', speedMps: 100 })
  expect(scenarioDurationS(s)).toBe(121)
  delete s.raid
  expect(scenarioDurationS(s)).toBe(101)
})

it('keys a presentation variant on its base, through a chain, and a plain scenario on itself', () => {
  const base = emptyScenario()
  expect(engineKeyOf(base)).toBe(base)
  const stamped = { ...base, observedPresetId: 'sensors' }
  markPresentationVariant(stamped, base)
  expect(engineKeyOf(stamped)).toBe(base)
  const restamped = { ...stamped, observedPresetId: 'threat' }
  markPresentationVariant(restamped, stamped)
  expect(engineKeyOf(restamped)).toBe(base)
  // An edit is a new object with no mark: its own engine identity.
  expect(engineKeyOf({ ...stamped })).not.toBe(base)
})
