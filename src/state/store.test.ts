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
    st.addEntityFromModel('lib-rps42', { x: 1000, y: 2000 })
    const s = useStore.getState().scenario
    expect(s.entities).toHaveLength(1)
    expect(s.entities[0].kind).toBe('sensor')
    expect(s.entities[0].pos).toEqual({ x: 1000, y: 2000 })
  })

  it('undo and redo restore scenario states', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-mavic3', { x: 0, y: 0 })
    st.addEntityFromModel('lib-faadc2', { x: 500, y: 0 })
    expect(useStore.getState().scenario.entities).toHaveLength(2)
    useStore.getState().undo()
    expect(useStore.getState().scenario.entities).toHaveLength(1)
    useStore.getState().redo()
    expect(useStore.getState().scenario.entities).toHaveLength(2)
  })

  it('deleting an entity cascades to connections, paths, and card links', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    st.addEntityFromModel('lib-faadc2', { x: 100, y: 0 })
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
    st.addEntityFromModel('lib-mugin5', { x: -3000, y: 4000 })
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

  it('saves a selection as a system preset and places it with links intact', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    st.addEntityFromModel('lib-faadc2', { x: 1000, y: 0 })
    st.addEntityFromModel('lib-coyote', { x: 2000, y: 0 })
    let s = useStore.getState().scenario
    const [radar, c2, eff] = s.entities
    st.beginConnect(radar.id)
    st.completeConnect(c2.id)
    useStore.getState().beginConnect(c2.id)
    useStore.getState().completeConnect(eff.id)
    useStore.getState().select({ entityIds: [radar.id, c2.id, eff.id] })
    const presetCount = s.systemPresets.length
    useStore.getState().saveSelectionAsSystem('Test IADS')
    s = useStore.getState().scenario
    expect(s.systemPresets).toHaveLength(presetCount + 1)
    const preset = s.systemPresets.at(-1)!
    expect(preset.name).toBe('Test IADS')
    expect(preset.components).toHaveLength(3)
    expect(preset.links).toHaveLength(2)

    useStore.getState().addSystemFromPreset(preset.id, { x: 10000, y: 10000 })
    s = useStore.getState().scenario
    expect(s.entities).toHaveLength(6)
    const placed = s.entities.slice(3)
    expect(placed.every((e) => e.systemId === placed[0].systemId)).toBe(true)
    // The c2 sat on the selection centroid, so it lands on the drop point.
    expect(placed[1].pos).toEqual({ x: 10000, y: 10000 })
    expect(s.connections).toHaveLength(4)

    useStore.getState().selectSystem(placed[0].systemId!)
    expect(useStore.getState().selection.entityIds).toHaveLength(3)
  })

  it('places the built-in FS-LIDS preset with kill-chain links', () => {
    useStore.getState().addSystemFromPreset('sys-fslids', { x: 0, y: 0 })
    const s = useStore.getState().scenario
    expect(s.entities).toHaveLength(10)
    expect(s.connections).toHaveLength(9)
    const c2 = s.entities.find((e) => e.kind === 'c2')!
    // Six sensors feed FAAD C2; C2 tasks the three effectors.
    expect(s.connections.filter((c) => c.toId === c2.id)).toHaveLength(6)
    expect(s.connections.filter((c) => c.fromId === c2.id)).toHaveLength(3)
    const north = s.entities.find((e) => e.name.includes('RPS-42') && e.headingDeg === 0)
    expect(north).toBeDefined()
  })

  it('duplicates an entity without carrying its system membership', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    const id = useStore.getState().scenario.entities[0].id
    useStore.getState().updateEntity(id, { systemId: 'sys-x' })
    useStore.getState().duplicateEntity(id)
    const s = useStore.getState().scenario
    expect(s.entities).toHaveLength(2)
    expect(s.entities[1].name).toContain('(copy)')
    expect(s.entities[1].systemId).toBeNull()
  })

  it('scenario duration follows the longest flight', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-shahed136', { x: 0, y: 0 })
    const uasId = useStore.getState().scenario.entities[0].id
    st.beginPath(uasId)
    useStore.getState().addDraftPoint({ x: 10000, y: 0 })
    useStore.getState().finishPath()
    // 10 km at 50 m/s cruise = 200 s.
    expect(scenarioDurationS(useStore.getState().scenario)).toBe(200)
  })
})
