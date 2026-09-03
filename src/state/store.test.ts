import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bumpCardVersion,
  DEFAULT_LAYERS,
  ringVisible,
  savedLayers,
  savedRunSeq,
  useStore,
  scenarioDurationS,
} from './store'
import type { LayerVisibility } from './store'
import { emptyScenario } from '../model/seed'
import type { Scenario } from '../model/types'
import { flushViewWrites, savedRingOverrides, savedView } from '../io/viewState'
import { RINGS_KEY, RUNSEQ_KEY, VIEW_KEY } from '../io/storageKeys'
import { useTeStore } from '../te/state/teStore'

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
    expect(s.entities).toHaveLength(8)
    expect(s.connections).toHaveLength(8)
    const c2 = s.entities.find((e) => e.kind === 'c2')!
    // Three sensors feed FAAD C2; C2 tasks the three effectors; the fire-control
    // radar also uplinks both Coyote launchers directly.
    expect(s.connections.filter((c) => c.toId === c2.id)).toHaveLength(3)
    expect(s.connections.filter((c) => c.fromId === c2.id)).toHaveLength(3)
    const radar = s.entities.find((e) => e.name.includes('KuRFS'))
    expect(radar).toBeDefined()
  })

  it('places a preset with an orientation and rotates a placed system', () => {
    // Facing east at placement: the first component slews to 90 deg and its
    // offset {0,-30} rotates to {30,0}.
    useStore.getState().addSystemFromPreset('sys-fslids', { x: 0, y: 0 }, 90)
    let s = useStore.getState().scenario
    const north = s.entities[0]
    expect(north.headingDeg).toBe(90)
    expect(north.pos.x).toBeCloseTo(30)
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

describe('run-scoped playback lifecycle', () => {
  beforeEach(reset)

  it('separates observed playback from scrubbed preview time', () => {
    const st = useStore.getState()
    st.startRun()
    st.advanceRun(12.5)
    st.pauseRun()
    useStore.getState().scrubTo(50)

    let p = useStore.getState().playback
    expect(p.phase).toBe('review')
    expect(p.simTimeS).toBe(50)
    expect(p.observedThroughS).toBe(12.5)
    expect(p.completedAtMs).toBeNull()

    // Resume clamps back to the observed horizon; the preview gap is never
    // silently accepted as observed run data.
    useStore.getState().startRun()
    p = useStore.getState().playback
    expect(p.phase).toBe('running')
    expect(p.simTimeS).toBe(12.5)
  })

  it('does not complete from a scrub to the end', () => {
    useStore.getState().scrubTo(60)
    const p = useStore.getState().playback
    expect(p.phase).toBe('review')
    expect(p.observedThroughS).toBe(0)
    expect(p.completedAtMs).toBeNull()
  })

  it('seals a completed run only after playback advances through the duration', () => {
    const st = useStore.getState()
    st.startRun()
    st.advanceRun(60)
    st.completeRun(60)
    const p = useStore.getState().playback
    expect(p.phase).toBe('complete')
    expect(p.playing).toBe(false)
    expect(p.observedThroughS).toBe(60)
    expect(p.startedAtMs).not.toBeNull()
    expect(p.completedAtMs).not.toBeNull()
    expect(p.basisSignature).not.toBeNull()
  })

  it('gives a clean reset a new id and clears every run-scoped field', () => {
    const st = useStore.getState()
    const before = st.playback
    st.startRun()
    st.advanceRun(18)
    useStore.getState().resetRun('manual')
    const after = useStore.getState().playback
    expect(after.runId).not.toBe(before.runId)
    expect(after.runSeq).toBe(before.runSeq + 1)
    expect(after.phase).toBe('ready')
    expect(after.simTimeS).toBe(0)
    expect(after.observedThroughS).toBe(0)
    expect(after.startedAtMs).toBeNull()
    expect(after.completedAtMs).toBeNull()
    expect(after.basisSignature).toBeNull()
  })

  it('invalidates an active run when an analysis input changes', () => {
    const st = useStore.getState()
    st.startRun()
    st.advanceRun(8)
    const before = useStore.getState().playback
    useStore.getState().updateEnvironment({ windSpeedMps: 17 })
    const after = useStore.getState().playback
    expect(after.runId).not.toBe(before.runId)
    expect(after.phase).toBe('ready')
    expect(after.resetReason).toBe('configuration-changed')
    expect(after.observedThroughS).toBe(0)
    // Only a manual reset issues a new sequence number.
    expect(after.runSeq).toBe(before.runSeq)
  })

  it('does not invalidate a completed run when saving a presentation frame', () => {
    const st = useStore.getState()
    st.startRun()
    st.advanceRun(60)
    st.completeRun(60)
    const before = useStore.getState().playback
    useStore.getState().saveFrame('post-run evidence')
    const after = useStore.getState().playback
    expect(after.runId).toBe(before.runId)
    expect(after.completedAtMs).toBe(before.completedAtMs)
  })
})

describe('connect suggestions', () => {
  beforeEach(reset)

  /** RPS-42 radar 200 m from FAAD C2: a documented pair over cable (1500 m radius). */
  function placePair() {
    const st = useStore.getState()
    st.addEntityFromModel('lib-faadc2', { x: 0, y: 0 })
    st.addEntityFromModel('lib-rps42', { x: 200, y: 0 })
    const [c2, radar] = useStore.getState().scenario.entities
    return { c2, radar }
  }

  /** RfOne 200 m from Lattice: probable (shared cot-tak), never auto-connected. */
  function placeProbablePair() {
    const st = useStore.getState()
    st.addEntityFromModel('lib-lattice', { x: 0, y: 0 })
    st.addEntityFromModel('lib-rfone', { x: 200, y: 0 })
    const [c2, rf] = useStore.getState().scenario.entities
    return { c2, rf }
  }

  it('a documented pair in range auto-connects; the popup confirms it', () => {
    const { c2, radar } = placePair()
    useStore.getState().openConnectSuggestion(radar.id, { x: 10, y: 20 })
    const st = useStore.getState()
    const conn = st.scenario.connections.find((c) => c.fromId === radar.id && c.toId === c2.id)
    expect(conn).toBeDefined()
    expect(conn!.confidence).toBe('documented')
    expect(conn!.medium).toBe('cable')
    expect(conn!.label).toBe('track data')
    const sug = st.ui.connectSuggestion
    expect(sug).not.toBeNull()
    expect(sug!.entityId).toBe(radar.id)
    expect(sug!.screen).toEqual({ x: 10, y: 20 })
    expect(sug!.autoConnected.map((a) => a.toId)).toContain(c2.id)
    expect(sug!.candidates.map((a) => a.toId)).not.toContain(c2.id)
    // One undo removes the auto-created links.
    useStore.getState().undo()
    expect(useStore.getState().scenario.connections).toHaveLength(0)
  })

  it('a probable pair is offered, never auto-connected', () => {
    const { c2, rf } = placeProbablePair()
    useStore.getState().openConnectSuggestion(rf.id, { x: 0, y: 0 })
    const st = useStore.getState()
    expect(st.scenario.connections).toHaveLength(0)
    const cand = st.ui.connectSuggestion?.candidates.find((c) => c.toId === c2.id)
    expect(cand).toBeDefined()
    expect(cand!.verdict.confidence).toBe('probable')
  })

  it('reopening after auto-connect offers nothing again', () => {
    const { radar } = placePair()
    useStore.getState().openConnectSuggestion(radar.id, { x: 0, y: 0 })
    expect(useStore.getState().scenario.connections).toHaveLength(1)
    useStore.getState().dismissConnectSuggestion()
    useStore.getState().openConnectSuggestion(radar.id, { x: 0, y: 0 })
    expect(useStore.getState().scenario.connections).toHaveLength(1)
    expect(useStore.getState().ui.connectSuggestion).toBeNull()
  })

  it('always:true opens the informational popup with zero candidates', () => {
    const st = useStore.getState()
    // Two radars never pair, but KuRFS has a researched profile to show.
    st.addEntityFromModel('lib-kurfs', { x: 0, y: 0 })
    st.addEntityFromModel('lib-echoshield', { x: 100, y: 0 })
    const kurfs = useStore.getState().scenario.entities[0]
    useStore.getState().openConnectSuggestion(kurfs.id, { x: 0, y: 0 }, { always: true })
    const sug = useStore.getState().ui.connectSuggestion
    expect(sug).not.toBeNull()
    expect(sug!.candidates).toHaveLength(0)
  })

  it('always:true stays null for unprofiled custom models', () => {
    const st = useStore.getState()
    const modelId = st.addModel('sensor')
    st.addEntityFromModel(modelId, { x: 0, y: 0 })
    const ent = useStore.getState().scenario.entities[0]
    useStore.getState().openConnectSuggestion(ent.id, { x: 0, y: 0 }, { always: true })
    expect(useStore.getState().ui.connectSuggestion).toBeNull()
  })

  it('openConnectSuggestion sets null when nothing is in medium range', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-faadc2', { x: 0, y: 0 })
    // Beyond the 1500 m cable suggest radius.
    st.addEntityFromModel('lib-rps42', { x: 2000, y: 0 })
    const radar = useStore.getState().scenario.entities[1]
    useStore.getState().openConnectSuggestion(radar.id, { x: 0, y: 0 })
    expect(useStore.getState().ui.connectSuggestion).toBeNull()
    expect(useStore.getState().scenario.connections).toHaveLength(0)
  })

  it('applyConnectSuggestion creates a typed connection in one undo step', () => {
    const { c2, rf } = placeProbablePair()
    useStore.getState().openConnectSuggestion(rf.id, { x: 0, y: 0 })
    useStore.getState().applyConnectSuggestion([0])
    const s = useStore.getState().scenario
    expect(s.connections).toHaveLength(1)
    const conn = s.connections[0]
    expect(conn.fromId).toBe(rf.id)
    expect(conn.toId).toBe(c2.id)
    expect(conn.label).toBe('track data')
    expect(conn.confidence).toBe('probable')
    expect(conn.latencyS).toBe(0.5)
    expect(conn.note).toBeTruthy()
    expect(useStore.getState().ui.connectSuggestion).toBeNull()
    useStore.getState().undo()
    expect(useStore.getState().scenario.connections).toHaveLength(0)
  })

  it('applyConnectSuggestion skips pairs connected after the offer opened', () => {
    const { c2, rf } = placeProbablePair()
    useStore.getState().openConnectSuggestion(rf.id, { x: 0, y: 0 })
    useStore.getState().beginConnect(rf.id)
    useStore.getState().completeConnect(c2.id)
    useStore.getState().applyConnectSuggestion([0])
    expect(useStore.getState().scenario.connections).toHaveLength(1)
    expect(useStore.getState().ui.connectSuggestion).toBeNull()
  })

  it('addEntityFromModel with a screen point opens the suggestion and auto-connects', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-faadc2', { x: 0, y: 0 })
    useStore.getState().addEntityFromModel('lib-rps42', { x: 200, y: 0 }, { x: 40, y: 60 })
    const sug = useStore.getState().ui.connectSuggestion
    const radar = useStore.getState().scenario.entities[1]
    expect(sug).not.toBeNull()
    expect(sug!.entityId).toBe(radar.id)
    expect(sug!.screen).toEqual({ x: 40, y: 60 })
    expect(sug!.autoConnected).toHaveLength(1)
    expect(useStore.getState().scenario.connections).toHaveLength(1)
  })

  it('undo and deleteSelection clear an open suggestion', () => {
    const { radar } = placePair()
    useStore.getState().openConnectSuggestion(radar.id, { x: 0, y: 0 })
    expect(useStore.getState().ui.connectSuggestion).not.toBeNull()
    useStore.getState().undo()
    expect(useStore.getState().ui.connectSuggestion).toBeNull()
    useStore.getState().redo()
    useStore.getState().openConnectSuggestion(radar.id, { x: 0, y: 0 })
    useStore.getState().select({ entityIds: [radar.id] })
    useStore.getState().deleteSelection()
    expect(useStore.getState().ui.connectSuggestion).toBeNull()
  })

  it('completeConnect types a researched hand-drawn link', () => {
    const { c2, radar } = placePair()
    useStore.getState().beginConnect(radar.id)
    useStore.getState().completeConnect(c2.id)
    const conn = useStore.getState().scenario.connections[0]
    expect(conn.label).toBe('track data')
    expect(conn.medium).toBe('cable')
    expect(conn.confidence).toBe('documented')
    expect(conn.latencyS).toBe(0.5)
  })

  it('completeConnect keeps a denied pair untyped with the kind-default label', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    st.addEntityFromModel('lib-coyote', { x: 200, y: 0 })
    const [radar, eff] = useStore.getState().scenario.entities
    useStore.getState().beginConnect(radar.id)
    useStore.getState().completeConnect(eff.id)
    const conn = useStore.getState().scenario.connections[0]
    expect(conn.label).toBe('direct cue')
    expect(conn.confidence).toBeUndefined()
    expect(conn.medium).toBeUndefined()
  })
})

// The node test env has no Web Storage, so the storage keys need a stand-in.
function stubStorage(entries: Record<string, string> = {}): Map<string, string> {
  const store = new Map<string, string>(Object.entries(entries))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  return store
}

function stubLayerStorage(seed: string | null): Map<string, string> {
  return stubStorage(seed == null ? {} : { 'rangeboard.layers.v1': seed })
}

describe('layer visibility', () => {

  const FULL: LayerVisibility = {
    grid: true,
    boundaries: true,
    sensorPlacard: true,
    sensorEnvelope: true,
    sensorPdContours: true,
    classifyRings: true,
    effectorMaxRange: true,
    effectorMinRange: true,
    effectorDoctrinal: true,
    defendedAreas: true,
    threatWez: false,
    flightPaths: true,
    connections: true,
    rangeRings: true,
    engagements: true,
    labels: true,
    trackTelemetry: true,
  }
  const PLANNING: LayerVisibility = {
    ...FULL,
    sensorPdContours: false,
    classifyRings: false,
    effectorDoctrinal: false,
    engagements: false,
  }
  const ENGAGEMENT: LayerVisibility = {
    ...FULL,
    sensorEnvelope: false,
    sensorPdContours: false,
    classifyRings: false,
    effectorMinRange: false,
    connections: false,
    rangeRings: false,
  }
  const CLEAN: LayerVisibility = {
    ...FULL,
    boundaries: false,
    sensorPlacard: false,
    sensorEnvelope: false,
    sensorPdContours: false,
    classifyRings: false,
    effectorMaxRange: false,
    effectorMinRange: false,
    effectorDoctrinal: false,
    defendedAreas: false,
    flightPaths: false,
    connections: false,
    rangeRings: false,
    engagements: false,
  }

  beforeEach(() => {
    reset()
    useStore.getState().applyLayerPreset('full')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to DEFAULT_LAYERS: the placard and the effector max range, no other ring', () => {
    expect(savedLayers()).toEqual(DEFAULT_LAYERS)
    expect(DEFAULT_LAYERS).toEqual({
      ...FULL,
      sensorEnvelope: false,
      sensorPdContours: false,
      classifyRings: false,
      effectorMinRange: false,
      effectorDoctrinal: false,
    })
  })

  it('setLayer writes one key and leaves the rest alone', () => {
    useStore.getState().setLayer('sensorPlacard', false)
    expect(useStore.getState().ui.layers.sensorPlacard).toBe(false)
    useStore.getState().setLayer('threatWez', true)
    expect(useStore.getState().ui.layers).toEqual({
      ...FULL,
      sensorPlacard: false,
      threatWez: true,
    })
  })

  it('setLayer is idempotent for the value it already holds', () => {
    useStore.getState().setLayer('grid', true)
    expect(useStore.getState().ui.layers).toEqual(FULL)
  })

  it('toggleLayer flips a key each call', () => {
    useStore.getState().toggleLayer('threatWez')
    expect(useStore.getState().ui.layers.threatWez).toBe(true)
    useStore.getState().toggleLayer('threatWez')
    expect(useStore.getState().ui.layers.threatWez).toBe(false)
    useStore.getState().toggleLayer('connections')
    expect(useStore.getState().ui.layers.connections).toBe(false)
    expect(useStore.getState().ui.layers).toEqual({ ...FULL, connections: false })
  })

  it('applyLayerPreset full matches the specified set', () => {
    useStore.getState().applyLayerPreset('clean')
    useStore.getState().applyLayerPreset('full')
    expect(useStore.getState().ui.layers).toEqual(FULL)
  })

  it('applyLayerPreset planning matches the specified set', () => {
    useStore.getState().applyLayerPreset('planning')
    expect(useStore.getState().ui.layers).toEqual(PLANNING)
  })

  it('applyLayerPreset engagement matches the specified set', () => {
    useStore.getState().applyLayerPreset('engagement')
    expect(useStore.getState().ui.layers).toEqual(ENGAGEMENT)
  })

  it('applyLayerPreset clean matches the specified set', () => {
    useStore.getState().applyLayerPreset('clean')
    expect(useStore.getState().ui.layers).toEqual(CLEAN)
  })

  it('a preset discards earlier single-layer edits', () => {
    useStore.getState().setLayer('threatWez', true)
    useStore.getState().applyLayerPreset('engagement')
    expect(useStore.getState().ui.layers).toEqual(ENGAGEMENT)
  })

  it('layer changes push no undo history and never enter the scenario', () => {
    useStore.getState().addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    const past = useStore.getState().past.length
    const future = useStore.getState().future.length
    const scenario = useStore.getState().scenario
    useStore.getState().setLayer('grid', false)
    useStore.getState().toggleLayer('labels')
    useStore.getState().applyLayerPreset('clean')
    expect(useStore.getState().past.length).toBe(past)
    expect(useStore.getState().future.length).toBe(future)
    expect(useStore.getState().scenario).toBe(scenario)
    expect(JSON.stringify(scenario)).not.toContain('trackTelemetry')
  })

  it('undo after a layer change restores the scenario, not the layers', () => {
    useStore.getState().addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    useStore.getState().applyLayerPreset('clean')
    useStore.getState().undo()
    expect(useStore.getState().scenario.entities).toHaveLength(0)
    expect(useStore.getState().ui.layers).toEqual(CLEAN)
  })

  it('savedLayers falls back to DEFAULT_LAYERS with no store', () => {
    expect(savedLayers()).toEqual(DEFAULT_LAYERS)
  })

  it('savedLayers spreads a partial saved object over the defaults', () => {
    stubLayerStorage(JSON.stringify({ grid: false, threatWez: true }))
    expect(savedLayers()).toEqual({ ...DEFAULT_LAYERS, grid: false, threatWez: true })
  })

  it('a layer action round-trips through localStorage', () => {
    const store = stubLayerStorage(null)
    useStore.getState().applyLayerPreset('engagement')
    useStore.getState().toggleLayer('threatWez')
    expect(JSON.parse(store.get('rangeboard.layers.v1')!)).toEqual({
      ...ENGAGEMENT,
      threatWez: true,
    })
    expect(savedLayers()).toEqual({ ...ENGAGEMENT, threatWez: true })
  })

  it('savedLayers falls back to the defaults on unreadable saved data', () => {
    stubLayerStorage('not json')
    expect(savedLayers()).toEqual(DEFAULT_LAYERS)
  })

  it('savedLayers migrates the two pre-ring keys and keeps exactly 17 keys', () => {
    stubLayerStorage(JSON.stringify({ sensorFootprints: false, effectorEnvelopes: false }))
    const layers = savedLayers()
    expect(layers).toEqual({ ...DEFAULT_LAYERS, sensorPlacard: false, effectorMaxRange: false })
    expect(Object.keys(layers).sort()).toEqual(
      [
        'boundaries',
        'classifyRings',
        'connections',
        'defendedAreas',
        'effectorDoctrinal',
        'effectorMaxRange',
        'effectorMinRange',
        'engagements',
        'flightPaths',
        'grid',
        'labels',
        'rangeRings',
        'sensorEnvelope',
        'sensorPdContours',
        'sensorPlacard',
        'threatWez',
        'trackTelemetry',
      ].sort(),
    )
  })

  it('a saved record that already names the new key keeps it over the old one', () => {
    stubLayerStorage(JSON.stringify({ sensorFootprints: false, sensorPlacard: true }))
    const layers = savedLayers()
    expect(layers.sensorPlacard).toBe(true)
    expect('sensorFootprints' in layers).toBe(false)
  })
})

describe('ring overrides', () => {
  beforeEach(() => {
    reset()
    useStore.getState().applyLayerPreset('full')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('an override wins over the layer flag in both directions', () => {
    useStore.getState().setLayer('sensorPlacard', true)
    useStore.getState().setLayer('sensorEnvelope', false)
    useStore.getState().setRingOverride('ent-1', 'sensorPlacard', false)
    useStore.getState().setRingOverride('ent-1', 'sensorEnvelope', true)
    const { ui } = useStore.getState()
    expect(ringVisible(ui, 'ent-1', 'sensorPlacard')).toBe(false)
    expect(ringVisible(ui, 'ent-1', 'sensorEnvelope')).toBe(true)
    expect(ringVisible(ui, 'ent-1', 'effectorMaxRange')).toBe(true)
    expect(ringVisible(ui, 'ent-2', 'sensorPlacard')).toBe(true)
  })

  it('clearing to null drops the key, and the record with its last key', () => {
    const st = useStore.getState()
    st.setRingOverride('ent-1', 'sensorPlacard', false)
    st.setRingOverride('ent-1', 'classifyRings', true)
    st.setRingOverride('ent-1', 'sensorPlacard', null)
    expect(useStore.getState().ui.ringOverrides).toEqual({ 'ent-1': { classifyRings: true } })
    useStore.getState().setRingOverride('ent-1', 'classifyRings', null)
    expect(useStore.getState().ui.ringOverrides).toEqual({})
  })

  it('an override change pushes no undo history and never enters the scenario', () => {
    useStore.getState().addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    const past = useStore.getState().past.length
    const scenario = useStore.getState().scenario
    useStore.getState().setRingOverride('ent-1', 'sensorPdContours', true)
    expect(useStore.getState().past.length).toBe(past)
    expect(useStore.getState().future.length).toBe(0)
    expect(useStore.getState().scenario).toBe(scenario)
    expect(JSON.stringify(scenario)).not.toContain('sensorPdContours')
  })

  it('deleting an entity prunes its overrides and leaves the others', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    st.addEntityFromModel('lib-coyote', { x: 500, y: 0 })
    const [radar, eff] = useStore.getState().scenario.entities
    useStore.getState().setRingOverride(radar.id, 'sensorPlacard', false)
    useStore.getState().setRingOverride(eff.id, 'effectorMinRange', true)
    useStore.getState().select({ entityIds: [radar.id] })
    useStore.getState().deleteSelection()
    expect(useStore.getState().ui.ringOverrides).toEqual({ [eff.id]: { effectorMinRange: true } })
  })

  it('loading a scenario prunes overrides for entities it does not hold', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    const [radar] = useStore.getState().scenario.entities
    useStore.getState().setRingOverride(radar.id, 'sensorPlacard', false)
    useStore.getState().replaceScenario(emptyScenario())
    expect(useStore.getState().ui.ringOverrides).toEqual({})
  })

  it('an override round-trips through the rings storage key', () => {
    const store = stubStorage()
    useStore.getState().setRingOverride('ent-1', 'sensorPlacard', false)
    expect(JSON.parse(store.get(RINGS_KEY)!)).toEqual({ 'ent-1': { sensorPlacard: false } })
    expect(savedRingOverrides()).toEqual({ 'ent-1': { sensorPlacard: false } })
  })

  it('savedRingOverrides drops unreadable, non-boolean and unknown entries', () => {
    stubStorage({ [RINGS_KEY]: 'not json' })
    expect(savedRingOverrides()).toEqual({})
    vi.unstubAllGlobals()
    stubStorage({
      [RINGS_KEY]: JSON.stringify({
        'ent-1': { sensorPlacard: true, sensorEnvelope: 'yes', bogus: true },
        'ent-2': {},
        'ent-3': 5,
      }),
    })
    expect(savedRingOverrides()).toEqual({ 'ent-1': { sensorPlacard: true } })
  })
})

describe('replaceScenario', () => {
  beforeEach(reset)

  it('clears every draft and interaction field, the tool, the selection, and history', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    st.addEntityFromModel('lib-mavic3', { x: 500, y: 0 })
    const [sensor, uas] = useStore.getState().scenario.entities
    useStore.getState().select({ entityIds: [sensor.id] })
    useStore.getState().setTool('path')
    useStore.getState().beginPath(uas.id)
    useStore.getState().addDraftPoint({ x: 1, y: 1 })
    useStore.setState((s) => ({
      ui: {
        ...s.ui,
        connectFromId: sensor.id,
        calibrateA: { x: 0, y: 0 },
        calibrateB: { x: 1, y: 1 },
        moveUnderlay: true,
        contextMenu: { screen: { x: 1, y: 1 }, world: { x: 1, y: 1 }, entityId: null },
        locationDialogOpen: true,
        raidDraft: { tacticId: 't', platformSpecId: null, targetEntityId: null, shipCount: 1 },
        connectSuggestion: {
          entityId: sensor.id,
          screen: { x: 0, y: 0 },
          candidates: [],
          autoConnected: [],
        },
      },
    }))
    useStore.getState().replaceScenario(emptyScenario())
    const { ui, selection, past, future, playback } = useStore.getState()
    expect(ui.tool).toBe('select')
    expect(ui.draftPoints).toEqual([])
    expect(ui.pathEntityId).toBeNull()
    expect(ui.connectFromId).toBeNull()
    expect(ui.calibrateA).toBeNull()
    expect(ui.calibrateB).toBeNull()
    expect(ui.moveUnderlay).toBe(false)
    expect(ui.contextMenu).toBeNull()
    expect(ui.locationDialogOpen).toBe(false)
    expect(ui.raidDraft).toBeNull()
    expect(ui.connectSuggestion).toBeNull()
    expect(selection.entityIds).toEqual([])
    expect(past).toEqual([])
    expect(future).toEqual([])
    expect(playback.phase).toBe('ready')
    expect(playback.resetReason).toBe('scenario-loaded')
  })

  it('keeps the run sequence: a load is not a manual reset', () => {
    const before = useStore.getState().playback.runSeq
    useStore.getState().replaceScenario(emptyScenario())
    expect(useStore.getState().playback.runSeq).toBe(before)
  })
})

describe('undo selection', () => {
  beforeEach(reset)

  it('keeps a selection whose ids still exist after the step and drops the rest', () => {
    const st = useStore.getState()
    st.addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    const keep = useStore.getState().scenario.entities[0].id
    st.addEntityFromModel('lib-mavic3', { x: 500, y: 0 })
    const gone = useStore.getState().scenario.entities[1].id
    useStore.getState().select({ entityIds: [keep, gone] })
    useStore.getState().undo()
    expect(useStore.getState().selection.entityIds).toEqual([keep])
    useStore.getState().redo()
    expect(useStore.getState().selection.entityIds).toEqual([keep])
  })

  it('drops a boundary selection when undo removes the boundary', () => {
    const st = useStore.getState()
    st.setTool('boundary')
    st.addDraftPoint({ x: 0, y: 0 })
    st.addDraftPoint({ x: 100, y: 0 })
    st.addDraftPoint({ x: 100, y: 100 })
    st.finishBoundary(true)
    const id = useStore.getState().scenario.boundaries[0].id
    useStore.getState().select({ boundaryId: id })
    useStore.getState().undo()
    expect(useStore.getState().selection.boundaryId).toBeNull()
  })
})

describe('deleted seed ids', () => {
  beforeEach(reset)

  it('records a deleted builtin model and preset, and not a custom one', () => {
    const st = useStore.getState()
    const seedModel = useStore.getState().scenario.library.find((m) => m.builtin)!
    const seedPreset = useStore.getState().scenario.systemPresets.find((p) => p.builtin)!
    const customId = st.addModel('sensor')
    st.deleteModel(seedModel.id)
    useStore.getState().deleteSystemPreset(seedPreset.id)
    useStore.getState().deleteModel(customId)
    expect(useStore.getState().scenario.deletedSeedIds).toEqual([seedModel.id, seedPreset.id])
  })
})

describe('view state', () => {
  beforeEach(reset)
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips camera, basemap, right tab and workspace through localStorage', () => {
    const store = stubStorage()
    useStore.getState().setCamera({ x: 1, y: 1, scale: 1 })
    useStore.getState().setCamera({ x: 12, y: -8, scale: 0.25 })
    // The camera write is a trailing debounce: nothing lands until the flush.
    expect(store.has(VIEW_KEY)).toBe(false)
    flushViewWrites()
    useStore.getState().setBasemap('sat')
    useStore.getState().setRightTab('analysis')
    useTeStore.getState().setWorkspace('ops')
    expect(JSON.parse(store.get(VIEW_KEY)!)).toEqual({
      camera: { x: 12, y: -8, scale: 0.25 },
      basemap: 'sat',
      rightTab: 'analysis',
      workspace: 'ops',
    })
    expect(savedView()).toEqual({
      camera: { x: 12, y: -8, scale: 0.25 },
      basemap: 'sat',
      rightTab: 'analysis',
      workspace: 'ops',
    })
    useTeStore.getState().setWorkspace('board')
  })

  it('drops an invalid field and keeps the others', () => {
    stubStorage({
      [VIEW_KEY]: JSON.stringify({ camera: { x: 1, y: 2, scale: 0 }, basemap: 'sat', rightTab: 'nope' }),
    })
    expect(savedView()).toEqual({ basemap: 'sat' })
  })

  it('is empty on unreadable data', () => {
    stubStorage({ [VIEW_KEY]: 'not json' })
    expect(savedView()).toEqual({})
  })

  it('the camera debounce writes only the last camera after the delay', () => {
    vi.useFakeTimers()
    const store = stubStorage()
    useStore.getState().setCamera({ x: 1, y: 1, scale: 1 })
    useStore.getState().setCamera({ x: 2, y: 2, scale: 2 })
    vi.advanceTimersByTime(249)
    expect(store.has(VIEW_KEY)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(savedView().camera).toEqual({ x: 2, y: 2, scale: 2 })
    vi.useRealTimers()
  })
})

describe('loadScenario camera fit', () => {
  beforeEach(reset)
  afterEach(() => vi.unstubAllGlobals())

  function placed(): Scenario {
    const s = emptyScenario()
    s.entities.push({
      id: 'ent-a',
      name: 'A',
      kind: 'asset',
      specId: null,
      pos: { x: 40000, y: 40000 },
      headingDeg: 0,
      color: null,
      notes: '',
    })
    return s
  }

  it('fits to the entities when no camera is saved', () => {
    stubStorage()
    const before = useStore.getState().camera
    useStore.getState().loadScenario(placed())
    expect(useStore.getState().camera).not.toEqual(before)
  })

  it('keeps a saved camera by default and fits with { fit: "always" }', () => {
    const saved = { x: 5, y: 5, scale: 0.5 }
    stubStorage({ [VIEW_KEY]: JSON.stringify({ camera: saved }) })
    useStore.getState().setCamera(saved)
    useStore.getState().loadScenario(placed())
    expect(useStore.getState().camera).toEqual(saved)
    useStore.getState().loadScenario(placed(), { fit: 'always' })
    expect(useStore.getState().camera).not.toEqual(saved)
  })

  it('does not move the camera for an empty scenario', () => {
    stubStorage()
    const before = useStore.getState().camera
    useStore.getState().loadScenario(emptyScenario(), { fit: 'always' })
    expect(useStore.getState().camera).toEqual(before)
  })
})


describe('run sequence persistence', () => {
  beforeEach(reset)
  afterEach(() => vi.unstubAllGlobals())

  it('reads the saved sequence and falls back to 1', () => {
    stubStorage({ [RUNSEQ_KEY]: '7' })
    expect(savedRunSeq()).toBe(7)
    stubStorage({ [RUNSEQ_KEY]: 'x' })
    expect(savedRunSeq()).toBe(1)
    stubStorage()
    expect(savedRunSeq()).toBe(1)
  })

  it('a manual reset writes the new sequence; a configuration change writes nothing', () => {
    const store = stubStorage()
    const seq = useStore.getState().playback.runSeq
    useStore.getState().resetRun('manual')
    expect(useStore.getState().playback.runSeq).toBe(seq + 1)
    expect(store.get(RUNSEQ_KEY)).toBe(String(seq + 1))
    useStore.getState().startRun()
    useStore.getState().advanceRun(5)
    useStore.getState().updateEnvironment({ windSpeedMps: 9 })
    expect(useStore.getState().playback.resetReason).toBe('configuration-changed')
    expect(useStore.getState().playback.runSeq).toBe(seq + 1)
    // The started run consumed its number: the next startup gets the one after.
    expect(store.get(RUNSEQ_KEY)).toBe(String(seq + 2))
  })

  it('the first start of a run reserves the next number for the next startup', () => {
    const store = stubStorage()
    const seq = useStore.getState().playback.runSeq
    useStore.getState().startRun()
    expect(store.get(RUNSEQ_KEY)).toBe(String(seq + 1))
    useStore.getState().pauseRun()
    useStore.getState().startRun()
    expect(store.get(RUNSEQ_KEY)).toBe(String(seq + 1))
  })
})

describe('applyFrame', () => {
  beforeEach(reset)

  it('extends the observation horizon so play resumes from the frame', () => {
    const st = useStore.getState()
    st.scrubTo(30)
    st.saveFrame('mid-run')
    const id = useStore.getState().scenario.frames[0].id
    useStore.getState().scrubTo(0)
    useStore.getState().applyFrame(id)
    const p = useStore.getState().playback
    expect(p.simTimeS).toBe(30)
    expect(p.observedThroughS).toBe(30)
    expect(p.phase).toBe('review')
    expect(p.startedAtMs).not.toBeNull()
    useStore.getState().startRun()
    expect(useStore.getState().playback.simTimeS).toBe(30)
    expect(useStore.getState().playback.phase).toBe('running')
  })

  it('keeps a T0 frame on a run that never started in the ready phase', () => {
    useStore.getState().saveFrame('start')
    const id = useStore.getState().scenario.frames[0].id
    useStore.getState().applyFrame(id)
    const p = useStore.getState().playback
    expect(p.phase).toBe('ready')
    expect(p.startedAtMs).toBeNull()
    expect(p.observedThroughS).toBe(0)
  })
})
