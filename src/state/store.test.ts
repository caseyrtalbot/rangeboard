import { beforeEach, describe, expect, it } from 'vitest'
import { useStore, scenarioDurationS } from './store'
import { emptyScenario } from '../model/seed'
import type { Scenario } from '../model/types'

function reset() {
  useStore.getState().replaceScenario(emptyScenario())
}

describe('store scenario actions', () => {
  beforeEach(reset)

  it('adds an entity from a library model', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-trk-radar', { x: 1000, y: 2000 })
    const s = useStore.getState().scenario
    expect(s.entities).toHaveLength(1)
    expect(s.entities[0].kind).toBe('sensor')
    expect(s.entities[0].pos).toEqual({ x: 1000, y: 2000 })
  })

  it('undo and redo restore scenario states', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-quad', { x: 0, y: 0 })
    st.addEntityFromModel('lib-c2', { x: 500, y: 0 })
    expect(useStore.getState().scenario.entities).toHaveLength(2)
    useStore.getState().undo()
    expect(useStore.getState().scenario.entities).toHaveLength(1)
    useStore.getState().redo()
    expect(useStore.getState().scenario.entities).toHaveLength(2)
  })

  it('deleting an entity cascades to connections, paths, and card links', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-trk-radar', { x: 0, y: 0 })
    st.addEntityFromModel('lib-c2', { x: 100, y: 0 })
    let s = useStore.getState().scenario
    const [radar, c2] = s.entities
    st.beginConnect(radar.id)
    st.completeConnect(c2.id)
    const cardId = st.addCard()
    st.toggleCardEntity(cardId, radar.id)
    useStore.getState().select({ entityIds: [radar.id] })
    useStore.getState().deleteSelection()
    s = useStore.getState().scenario
    expect(s.entities).toHaveLength(1)
    expect(s.connections).toHaveLength(0)
    expect(s.testCards[0].linkedEntityIds).toHaveLength(0)
  })

  it('custom model creation and duplication produce editable entries', () => {
    const st = useStore.getState()
    const id = st.addModel('uas')
    useStore.getState().updateModel(id, { name: 'Custom threat X' })
    const dupId = useStore.getState().duplicateModel(id)
    const s = useStore.getState().scenario
    const dup = s.library.find((m) => m.id === dupId)
    expect(dup?.name).toBe('Custom threat X (copy)')
    expect(dup?.builtin).toBe(false)
    expect(dup?.uas).toBeDefined()
    expect(dup?.threatProfile).toBeDefined()
  })

  it('scenario serialization round-trips', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-mugin', { x: -3000, y: 4000 })
    const uasId = useStore.getState().scenario.entities[0].id
    st.beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 0, y: 0 })
    useStore.getState().addDraftPoint({ x: 5000, y: 5000 })
    useStore.getState().finishPath()
    useStore.getState().saveFrame('overview')
    const before = useStore.getState().scenario
    const restored = JSON.parse(JSON.stringify(before)) as Scenario
    useStore.getState().replaceScenario(restored)
    expect(useStore.getState().scenario).toEqual(before)
    expect(useStore.getState().scenario.paths).toHaveLength(1)
    expect(useStore.getState().scenario.frames).toHaveLength(1)
  })

  it('scenario duration follows the longest flight', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-owa', { x: 0, y: 0 })
    const uasId = useStore.getState().scenario.entities[0].id
    st.beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 10000, y: 0 })
    useStore.getState().finishPath()
    // 10 km at 50 m/s cruise = 200 s.
    expect(scenarioDurationS(useStore.getState().scenario)).toBe(200)
  })
})
