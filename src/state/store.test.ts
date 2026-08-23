import { beforeEach, describe, expect, it } from 'vitest'
import { bumpCardVersion, useStore, scenarioDurationS } from './store'
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

  it('applyLocation sets geoRef and elevation in one undo step', () => {
    const st = useStore.getState()
    const before = useStore.getState().scenario.environment.fieldElevationFt
    st.applyLocation({ lat: 32.38, lon: -106.48 }, 4000)
    let s = useStore.getState().scenario
    expect(s.geoRef).toEqual({ lat: 32.38, lon: -106.48 })
    expect(s.environment.fieldElevationFt).toBe(4000)
    useStore.getState().undo()
    s = useStore.getState().scenario
    expect(s.geoRef).toBeNull()
    expect(s.environment.fieldElevationFt).toBe(before)
  })

  it('applyLocation without an elevation keeps the current one', () => {
    const st = useStore.getState()
    const before = useStore.getState().scenario.environment.fieldElevationFt
    st.applyLocation({ lat: 32.38, lon: -106.48 }, null)
    const s = useStore.getState().scenario
    expect(s.geoRef).toEqual({ lat: 32.38, lon: -106.48 })
    expect(s.environment.fieldElevationFt).toBe(before)
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

  it('places a preset with an orientation and rotates a placed system', () => {
    // Facing east at placement: the north RPS-42 face slews to 90 deg and its
    // offset {0,-50} rotates to {50,0}.
    useStore.getState().addSystemFromPreset('sys-fslids', { x: 0, y: 0 }, 90)
    let s = useStore.getState().scenario
    const north = s.entities[0]
    expect(north.headingDeg).toBe(90)
    expect(north.pos.x).toBeCloseTo(50)
    expect(north.pos.y).toBeCloseTo(0)

    // Rotating the whole system keeps the centroid fixed.
    const systemId = north.systemId!
    const members = () =>
      useStore.getState().scenario.entities.filter((e) => e.systemId === systemId)
    const centroid = (es: { pos: { x: number; y: number } }[]) => ({
      x: es.reduce((sum, e) => sum + e.pos.x, 0) / es.length,
      y: es.reduce((sum, e) => sum + e.pos.y, 0) / es.length,
    })
    const before = centroid(members())
    useStore.getState().rotateSystem(systemId, 90)
    s = useStore.getState().scenario
    const after = centroid(members())
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(s.entities[0].headingDeg).toBe(180)
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

  it('defaults connection labels from endpoint kinds', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    st.addEntityFromModel('lib-faadc2', { x: 1000, y: 0 })
    st.addEntityFromModel('lib-coyote', { x: 2000, y: 0 })
    const [radar, c2, eff] = useStore.getState().scenario.entities
    st.beginConnect(radar.id)
    st.completeConnect(c2.id)
    useStore.getState().beginConnect(c2.id)
    useStore.getState().completeConnect(eff.id)
    useStore.getState().beginConnect(radar.id)
    useStore.getState().completeConnect(eff.id)
    const labels = useStore.getState().scenario.connections.map((c) => c.label)
    expect(labels).toEqual(['track data', 'engage order', 'direct cue'])
  })

  it('names a new boundary from its type', () => {
    const st = useStore.getState()
    st.setBoundaryType('restricted')
    useStore.getState().addDraftPoint({ x: 0, y: 0 })
    useStore.getState().addDraftPoint({ x: 1000, y: 0 })
    useStore.getState().addDraftPoint({ x: 1000, y: 1000 })
    useStore.getState().finishBoundary(true)
    const b = useStore.getState().scenario.boundaries[0]
    expect(b.name).toBe('Restricted 1')
  })

  it('creates a new card version with the same cardId, a minor bump, and no runs', () => {
    const st = useStore.getState()
    const id = st.addCard()
    useStore.getState().updateCard(id, { purpose: 'Baseline DTI', version: '1.0' })
    useStore.getState().addRun(id)
    const nid = useStore.getState().newCardVersion(id)
    const s = useStore.getState().scenario
    const src = s.testCards.find((c) => c.id === id)!
    const copy = s.testCards.find((c) => c.id === nid)!
    expect(copy.cardId).toBe(src.cardId)
    expect(copy.version).toBe('1.1')
    expect(copy.purpose).toBe('Baseline DTI')
    expect(copy.runs).toHaveLength(0)
    expect(src.runs).toHaveLength(1)
  })

  it('bumps card versions and keeps legacy strings recognizable', () => {
    expect(bumpCardVersion('1.0')).toBe('1.1')
    expect(bumpCardVersion('2.9')).toBe('2.10')
    expect(bumpCardVersion('draft')).toBe('draft.1')
    expect(bumpCardVersion('')).toBe('1.1')
  })

  it('creates a card from the entity selection with generated text', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    st.addEntityFromModel('lib-faadc2', { x: 500, y: 0 })
    st.addEntityFromModel('lib-mavic3', { x: 5000, y: 0 })
    const [radar, c2] = useStore.getState().scenario.entities
    useStore.getState().select({ entityIds: [radar.id, c2.id] })
    const id = useStore.getState().addCardFromSelection()
    const card = useStore.getState().scenario.testCards.find((c) => c.id === id)!
    expect(card.linkedEntityIds).toEqual([radar.id, c2.id])
    expect(card.configuration).toContain('RPS-42')
    expect(card.configuration).toContain('ROE tight')
    expect(card.threatProfile).toContain('THR-G1-Q-01')
  })

  it('composes the default frame name from scenario, time, and basemap', () => {
    const st = useStore.getState()
    st.setSimTime(90)
    useStore.getState().saveFrame('')
    const f = useStore.getState().scenario.frames[0]
    expect(f.name).toBe('Untitled scenario T+1:30 canvas')
  })
})
