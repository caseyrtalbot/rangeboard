import { beforeEach, expect, it } from 'vitest'
import { useStore } from '../state/store'
import { emptyScenario } from '../model/seed'
import { entityPosAt, liveTracks } from './tracks'

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
