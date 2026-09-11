import { beforeEach, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { emptyScenario } from '../model/seed'
import { posAtTime } from '../geometry/geo'
import { entityPosAt, liveTracks, sampleFlightPath } from './tracks'

beforeEach(() => useStore.getState().replaceScenario(emptyScenario()))

it('entityPosAt follows the path and falls back to the placed position without one', () => {
  const st = useStore.getState()
  st.addEntityFromModel('lib-mavic3', { x: -6000, y: 0 })
  const uas = useStore.getState().scenario.entities.at(-1)!
  expect(entityPosAt(useStore.getState().scenario, uas, 100)).toEqual(uas.pos)
  st.beginPath(uas.id)
  useStore.getState().addDraftPoint({ x: 6000, y: 0 })
  useStore.getState().finishPath()
  const scenario = useStore.getState().scenario
  expect(entityPosAt(scenario, uas, 0)).toEqual({ x: -6000, y: 0 })
  expect(entityPosAt(scenario, uas, 1e6)).toEqual({ x: 6000, y: 0 })
  const track = liveTracks(scenario, 1e6).get(uas.id)!
  expect(track.done).toBe(true)
  expect(track.flying).toBe(false)
})

it('selects the limited flight model and the noFlightLimits fallback', () => {
  const st = useStore.getState()
  st.addEntityFromModel('lib-mavic3', { x: 0, y: 0 })
  const uas = useStore.getState().scenario.entities.at(-1)!
  st.beginPath(uas.id)
  useStore.getState().addDraftPoint({ x: 1000, y: 0 })
  useStore.getState().finishPath()
  const scenario = useStore.getState().scenario
  const path = scenario.paths[0]

  // Mavic 3 a=6.9 m/s2: at t=1, d=0.5*a*t2=3.45 m from rest.
  expect(sampleFlightPath(scenario, path, 1).pos.x).toBeCloseTo(3.45, 12)
  scenario.physics = ['noFlightLimits']
  expect(sampleFlightPath(scenario, path, 1)).toEqual(posAtTime(path.points, 12, 0, 1))
})
