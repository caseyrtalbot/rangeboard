import { expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { pruneRingOverrides } from './rings'

it('pruneRingOverrides drops dead entity ids and returns the same object when all are live', () => {
  const s = emptyScenario()
  s.entities.push({
    id: 'ent-1', name: 'r', kind: 'sensor', specId: null, pos: { x: 0, y: 0 },
    headingDeg: 0, color: null, notes: '',
  })
  const live = { 'ent-1': { sensorPlacard: false as const } }
  expect(pruneRingOverrides(live, s)).toBe(live)
  const mixed = { ...live, 'ent-gone': { classifyRings: true as const } }
  expect(pruneRingOverrides(mixed, s)).toEqual(live)
})
