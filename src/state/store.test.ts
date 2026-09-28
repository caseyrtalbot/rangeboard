import { createTrialManifest } from '../playback/trialTypes'
import { runTrial } from '../playback/trial'
import { IDLE_TRIAL } from './runState'
import { selectEffectiveLayers } from './selectors'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RUN_TIMELINE_DEFAULT_H, RUN_TIMELINE_MIN_H, useStore } from './store'
import { scenarioDurationS } from '../model/scenario'
import { analysisBasisSignature } from './analysisBasis'
import { bumpCardVersion } from './labels'
import { DEFAULT_LAYERS, EXECUTE_DEFAULT_LAYERS, LAYER_PRESETS, ringVisible } from './layers'
import type { LayerVisibility } from './layers'
import { IDLE_MC, IDLE_SENSITIVITY } from './runState'
import { emptyScenario } from '../model/seed'
import { engineKeyOf } from '../model/scenario'
import type { Scenario } from '../model/types'
import type { McSummary, SensitivitySummary } from '../playback/mcRun'
import {
  flushViewWrites,
  savedLayers,
  savedRingOverrides,
  savedRunSeq,
  savedView,
} from '../io/viewState'
import {
  ENGSTRIP_OPEN_KEY,
  RINGS_KEY,
  RUN_TIMELINE_HEIGHT_KEY,
  RUNSEQ_KEY,
  VIEW_KEY,
} from '../io/storageKeys'
import { ControlledWorker } from '../playback/controlledWorker'

/** Supply a real retained result for clock tests; async worker ownership lives in store.trial.test. */
function prepareReadyTrial() {
  const st = useStore.getState()
  if (st.trial.status === 'ready') return
  const scenario = structuredClone(st.scenario)
  const manifest = createTrialManifest(
    scenario,
    st.playback.runId,
    analysisBasisSignature(scenario),
  )
  useStore.setState({
    trial: {
      ...IDLE_TRIAL,
      status: 'ready',
      scenario,
      manifest,
      result: runTrial(scenario, manifest),
    },
  })
}

function reset() {
  useStore.setState((st) => ({ ui: { ...st.ui, boardPhase: 'prepare', executeLayers: null } }))
  // The fresh scenario runs Monte Carlo; the slices under test start from the envelope mode.
  useStore.getState().replaceScenario({
    ...emptyScenario(),
    runMode: 'deterministic',
    uncertainty: 'aleatory',
    targetHalfWidth: null,
  })
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
    // The Phase 3 point-mass model accelerates at 2 m/s2 to the 50 m/s cruise:
    // 25 s over the first 625 m, then 187.5 s at cruise, rounded up.
    expect(scenarioDurationS(useStore.getState().scenario)).toBe(213)
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
    prepareReadyTrial()
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
    prepareReadyTrial()
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
    prepareReadyTrial()
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
    prepareReadyTrial()
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
    prepareReadyTrial()
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

  it('a stamp is a presentation variant, and a matching stamp replaces nothing', () => {
    const before = useStore.getState().scenario
    useStore.getState().resetRun('manual')
    const stamped = useStore.getState().scenario
    expect(stamped).not.toBe(before)
    expect(engineKeyOf(stamped)).toBe(engineKeyOf(before))
    // The first Play under the same lens keeps the object, so no scenario memo misses.
    prepareReadyTrial()
    useStore.getState().startRun()
    expect(useStore.getState().scenario).toBe(stamped)
    useStore.getState().pauseRun()
    useStore.getState().setScenarioName('edited')
    const edited = useStore.getState().scenario
    expect(engineKeyOf(edited)).toBe(edited)
    useStore.getState().undo()
    expect(engineKeyOf(useStore.getState().scenario)).toBe(engineKeyOf(before))
  })

  it('a fresh scenario carries no observed lens', () => {
    expect(emptyScenario().observedPresetId).toBeNull()
  })

  it('does not invalidate a completed run when saving a presentation frame', () => {
    const st = useStore.getState()
    prepareReadyTrial()
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

describe('no-op guards', () => {
  beforeEach(reset)
  afterEach(() => vi.unstubAllGlobals())

  it('keeps state identity when a select or a right-tab set changes nothing', () => {
    useStore.getState().addEntityFromModel('lib-rps42', { x: 0, y: 0 })
    const id = useStore.getState().scenario.entities[0].id
    useStore.getState().select({ entityIds: [id] })
    const selection = useStore.getState().selection
    useStore.getState().select({ entityIds: [id] })
    expect(useStore.getState().selection).toBe(selection)
    useStore.getState().select({ entityIds: [id] }, true)
    expect(useStore.getState().selection).toBe(selection)

    const tabBefore = useStore.getState().ui.rightTab
    useStore.getState().setRightTab('inspect')
    const ui = useStore.getState().ui
    const store = stubStorage()
    useStore.getState().setRightTab('inspect')
    expect(useStore.getState().ui).toBe(ui)
    expect(store.has(VIEW_KEY)).toBe(false)
    useStore.getState().setRightTab('library')
    expect(useStore.getState().ui).not.toBe(ui)
    expect(JSON.parse(store.get(VIEW_KEY)!).rightTab).toBe('library')
    useStore.getState().setRightTab(tabBefore)
  })
})

describe('view state', () => {
  beforeEach(reset)
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips camera, basemap and right tab through localStorage', () => {
    const store = stubStorage()
    useStore.getState().setCamera({ x: 1, y: 1, scale: 1 })
    useStore.getState().setCamera({ x: 12, y: -8, scale: 0.25 })
    // The camera write is a trailing debounce: nothing lands until the flush.
    expect(store.has(VIEW_KEY)).toBe(false)
    flushViewWrites()
    useStore.getState().setBasemap('sat')
    useStore.getState().setRightTab('analysis')
    expect(JSON.parse(store.get(VIEW_KEY)!)).toEqual({
      camera: { x: 12, y: -8, scale: 0.25 },
      basemap: 'sat',
      rightTab: 'analysis',
    })
    expect(savedView()).toEqual({
      camera: { x: 12, y: -8, scale: 0.25 },
      basemap: 'sat',
      rightTab: 'analysis',
    })
  })

  it('drops an invalid field and keeps the others', () => {
    stubStorage({
      [VIEW_KEY]: JSON.stringify({
        camera: { x: 1, y: 2, scale: 0 },
        basemap: 'sat',
        rightTab: 'nope',
      }),
    })
    expect(savedView()).toEqual({ basemap: 'sat' })
  })

  it('round-trips the theme and keeps it out of history', () => {
    const store = stubStorage()
    const past = useStore.getState().past.length
    useStore.getState().setTheme('light')
    expect(useStore.getState().ui.theme).toBe('light')
    expect(useStore.getState().past.length).toBe(past)
    expect(JSON.parse(store.get(VIEW_KEY)!)).toEqual({ theme: 'light' })
    expect(savedView().theme).toBe('light')
    useStore.getState().setTheme('system')
  })

  it('round-trips the field help switch and keeps it out of history', () => {
    const store = stubStorage()
    expect(useStore.getState().ui.showFieldHelp).toBe(false)
    const past = useStore.getState().past
    useStore.getState().setShowFieldHelp(true)
    expect(useStore.getState().ui.showFieldHelp).toBe(true)
    expect(useStore.getState().past).toBe(past)
    expect(JSON.parse(store.get(VIEW_KEY)!)).toEqual({ showFieldHelp: true })
    expect(savedView().showFieldHelp).toBe(true)
    stubStorage({ [VIEW_KEY]: JSON.stringify({ showFieldHelp: 'yes' }) })
    expect(savedView()).toEqual({})
    useStore.getState().setShowFieldHelp(false)
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
    prepareReadyTrial()
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
    prepareReadyTrial()
    useStore.getState().startRun()
    expect(store.get(RUNSEQ_KEY)).toBe(String(seq + 1))
    useStore.getState().pauseRun()
    prepareReadyTrial()
    useStore.getState().startRun()
    expect(store.get(RUNSEQ_KEY)).toBe(String(seq + 1))
  })
})

describe('applyFrame', () => {
  beforeEach(reset)

  it('scrubs to an unobserved frame without starting or extending observation', () => {
    const st = useStore.getState()
    st.scrubTo(30)
    st.saveFrame('mid-run')
    const id = useStore.getState().scenario.frames[0].id
    useStore.getState().scrubTo(0)
    useStore.getState().applyFrame(id)
    const p = useStore.getState().playback
    expect(p.simTimeS).toBe(30)
    expect(p.observedThroughS).toBe(0)
    expect(p.phase).toBe('review')
    expect(p.playing).toBe(false)
    expect(p.startedAtMs).toBeNull()
    expect(p.basisSignature).toBeNull()
    prepareReadyTrial()
    useStore.getState().startRun()
    expect(useStore.getState().playback.simTimeS).toBe(0)
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

describe('monte carlo slice', () => {
  beforeEach(() => {
    ControlledWorker.install()
    reset()
  })
  afterEach(() => vi.unstubAllGlobals())

  const ZERO_STAT = {
    mean: 0,
    sd: 0,
    se: 0,
    lo: 0,
    hi: 0,
    conf: 0.95,
    interval: 't' as const,
    p10: 0,
    p90: 0,
    p025: 0,
    p975: 0,
    n: 1,
    total: 1,
    defined: { p: 1, lo: 0.2, hi: 1 },
  }
  const ZERO_BAND = { mean: [0], lo: [0], hi: [0], p10: [0], p90: [0], p025: [0], p975: [0] }

  function fakeSummary(replicates = 4): McSummary {
    return {
      seed: 1,
      replicates,
      stopped: { rule: 'replicates', at: replicates },
      durationS: 60,
      kills: ZERO_BAND,
      leakers: ZERO_BAND,
      detected: ZERO_BAND,
      tracked: ZERO_BAND,
      engaged: ZERO_BAND,
      firstDetectS: ZERO_STAT,
      firmTrackS: ZERO_STAT,
      minWarningS: ZERO_STAT,
      perThreat: {},
      perEffector: {},
      elapsedMs: 12,
    }
  }

  /** Start a run on the controlled worker, then deliver its completion. */
  function primeDone(replicates = 4): McSummary {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    useStore.getState().runMonteCarlo()
    expect(useStore.getState().mc.status).toBe('running')
    const runId = useStore.getState().mc.runId as string
    const summary = fakeSummary(replicates)
    useStore.getState().mcMessage({ type: 'done', runId, summary })
    return summary
  }

  it('a done message fills the summary and the progress', () => {
    const summary = primeDone(7)
    const mc = useStore.getState().mc
    expect(mc.status).toBe('done')
    expect(mc.summary).toBe(summary)
    expect(mc.progress).toBe(7)
    expect(mc.total).toBe(7)
  })

  it('resetRun returns the slice to idle', () => {
    primeDone()
    useStore.getState().resetRun('manual')
    expect(useStore.getState().mc).toEqual(IDLE_MC)
  })

  it('replaceScenario clears the slice', () => {
    primeDone()
    useStore.getState().replaceScenario(emptyScenario())
    expect(useStore.getState().mc.status).toBe('idle')
    expect(useStore.getState().mc.summary).toBeNull()
  })

  it('starts with no pool, Morris or Sobol state and a run reset clears the three', () => {
    expect([IDLE_MC.pool, IDLE_MC.morris, IDLE_MC.sobol]).toEqual([null, null, null])
    const field = {
      modelId: 'lib-coyote',
      field: 'pk',
      spread: { kind: 'lognormal' as const, sigmaDb: 3 },
    }
    const interval = { value: 0.5, lo: 0.4, hi: 0.6, bootstrap: 200, confidence: 0.95 }
    useStore.getState().setPoolProgress({
      workers: 2,
      done: 3,
      total: 4,
      stopRule: 'replicates',
      elapsedMs: 5,
      perWorkerDone: [2, 1],
      stopping: false,
      discarded: 0,
    })
    useStore.getState().setMorrisResult({
      method: 'morris',
      trajectories: 10,
      fields: [{ field, mu: 1, muStar: 1, sigma: 0 }],
      ranking: [0],
      kept: [0],
      response: 'leakers',
      seed: 4821,
      evaluations: 20,
    })
    useStore.getState().setSobolResult({
      method: 'saltelli',
      base: 256,
      evaluations: 768,
      fields: [{ field, firstOrder: interval, total: interval }],
      ranking: [0],
      response: 'leakers',
      seed: 4821,
    })
    const mc = useStore.getState().mc
    expect(mc.pool?.done).toBe(3)
    expect(mc.morris?.fields[0].muStar).toBe(1)
    expect(mc.sobol?.fields[0].total.hi).toBe(0.6)
    useStore.getState().resetRun('manual')
    expect(useStore.getState().mc).toBe(IDLE_MC)
  })

  it('a basis change marks the summary stale and keeps it', () => {
    const summary = primeDone()
    useStore.getState().patchScenario({ seed: 99 })
    const mc = useStore.getState().mc
    expect(mc.status).toBe('stale')
    expect(mc.summary).toBe(summary)
  })

  it('undo and redo across a basis change mark the summary stale', () => {
    useStore.getState().patchScenario({ seed: 99 })
    const summary = primeDone()
    useStore.getState().undo()
    expect(useStore.getState().mc.status).toBe('stale')
    expect(useStore.getState().mc.summary).toBe(summary)
    useStore.getState().redo()
    expect(useStore.getState().mc.status).toBe('stale')
  })

  it('a done message after a stale mark is ignored', () => {
    const summary = primeDone()
    useStore.getState().patchScenario({ seed: 99 })
    const runId = useStore.getState().mc.runId as string
    useStore.getState().mcMessage({ type: 'done', runId, summary: fakeSummary(9) })
    expect(useStore.getState().mc.status).toBe('stale')
    expect(useStore.getState().mc.summary).toBe(summary)
  })

  it('a change outside the basis leaves the summary current', () => {
    primeDone()
    useStore.getState().setScenarioName('Renamed board')
    expect(useStore.getState().mc.status).toBe('done')
  })

  it('a message from another run id is ignored', () => {
    primeDone()
    useStore.getState().mcMessage({ type: 'error', runId: 'other-run', message: 'boom' })
    expect(useStore.getState().mc.status).toBe('done')
    expect(useStore.getState().mc.error).toBeNull()
  })

  it('runMonteCarlo is a no-op under deterministic mode', () => {
    useStore.getState().runMonteCarlo()
    expect(useStore.getState().mc.status).toBe('idle')
    expect(useStore.getState().mc.runId).toBeNull()
  })

  it('runMonteCarlo reports the missing Worker as an error', () => {
    vi.stubGlobal('Worker', undefined)
    useStore.getState().patchScenario({ runMode: 'monte-carlo', replicates: 20 })
    useStore.getState().runMonteCarlo()
    const st = useStore.getState()
    expect(st.mc.status).toBe('error')
    expect(st.mc.error).toBe('Web Worker unavailable')
    expect(st.mc.runId).toBe(st.playback.runId)
    expect(st.mc.total).toBe(20)
    expect(st.mc.basisSignature).toBe(analysisBasisSignature(st.scenario))
  })

  it('startRun leaves replicates idle in either saved forecast mode', () => {
    prepareReadyTrial()
    useStore.getState().startRun()
    expect(useStore.getState().mc.status).toBe('idle')
    useStore.getState().resetRun('manual')
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    prepareReadyTrial()
    useStore.getState().startRun()
    const st = useStore.getState()
    expect(st.mc.status).toBe('idle')
    expect(st.mc.runId).toBeNull()
    expect(st.playback.playing).toBe(true)
  })

  it('the slice stays out of the scenario and the history', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    const past = useStore.getState().past.length
    useStore.getState().runMonteCarlo()
    const runId = useStore.getState().mc.runId as string
    useStore.getState().mcMessage({ type: 'done', runId, summary: fakeSummary() })
    const st = useStore.getState()
    expect(st.past.length).toBe(past)
    expect(JSON.stringify(st.scenario)).not.toContain('summary')
    expect('mc' in st.scenario).toBe(false)
  })

  it('the basis signature reads the run settings', () => {
    const base: Scenario = { ...emptyScenario(), runMode: 'deterministic', uncertainty: 'aleatory' }
    const sig = analysisBasisSignature(base)
    expect(analysisBasisSignature({ ...base, seed: base.seed! + 1 })).not.toBe(sig)
    expect(analysisBasisSignature({ ...base, replicates: 250 })).not.toBe(sig)
    expect(analysisBasisSignature({ ...base, runMode: 'monte-carlo' })).not.toBe(sig)
    expect(analysisBasisSignature({ ...base, uncertainty: 'total' })).not.toBe(sig)
    expect(analysisBasisSignature({ ...base, name: 'Other' })).toBe(sig)
  })
})

describe('sensitivity slice', () => {
  beforeEach(() => {
    ControlledWorker.install()
    reset()
  })
  afterEach(() => vi.unstubAllGlobals())

  function fakeSensitivity(): SensitivitySummary {
    return {
      stat: 'leakers',
      rows: [
        { modelId: 'lib-coyote', field: 'pk', label: 'Coyote', low: 1, high: 2, swing: 1, se: 0.1 },
        {
          modelId: 'lib-mavic3',
          field: 'rcsM2',
          se: 0,
          label: 'Mavic 3',
          low: 1.4,
          high: 1.6,
          swing: 0.2,
        },
      ],
      nominal: 1.5,
      replicates: 20,
      seed: 4821,
      elapsedMs: 30,
    }
  }

  /** Start a one-at-a-time sensitivity run on the controlled worker, then progress and completion. */
  function primeSensitivity(): SensitivitySummary {
    useStore.getState().patchScenario({ runMode: 'monte-carlo', sensitivityDepth: 'quick' })
    useStore.getState().runSensitivity()
    expect(useStore.getState().mc.sensitivity.status).toBe('running')
    const runId = useStore.getState().mc.sensitivity.runId as string
    const summary = fakeSensitivity()
    useStore.getState().sensitivityMessage({ type: 'sens-progress', runId, done: 1, total: 2 })
    useStore.getState().sensitivityMessage({ type: 'sens-done', runId, summary })
    return summary
  }

  /** A finished replicate run beside the sensitivity run; the summary itself is not read. */
  function markMcDone(): void {
    useStore.getState().runMonteCarlo()
    const runId = useStore.getState().playback.runId
    // The pool merges partials into `done`; the sink is driven directly here.
    useStore.getState().mcMessage({ type: 'done', runId, summary: { replicates: 1 } as McSummary })
    expect(useStore.getState().mc.status).toBe('done')
  }

  it('counts fields on progress and fills the summary on done', () => {
    const summary = primeSensitivity()
    const sens = useStore.getState().mc.sensitivity
    expect(sens.status).toBe('done')
    expect(sens.summary).toBe(summary)
    expect(sens.progress).toBe(2)
    expect(sens.total).toBe(2)
  })

  it('runSensitivity is a no-op under deterministic mode', () => {
    useStore.getState().runSensitivity()
    expect(useStore.getState().mc.sensitivity).toEqual(IDLE_SENSITIVITY)
  })

  it('reports the missing Worker as an error and starts with no field count', () => {
    vi.stubGlobal('Worker', undefined)
    useStore.getState().patchScenario({ runMode: 'monte-carlo' })
    useStore.getState().runSensitivity()
    const st = useStore.getState()
    expect(st.mc.sensitivity.status).toBe('error')
    expect(st.mc.sensitivity.error).toBe('Web Worker unavailable')
    expect(st.mc.sensitivity.runId).toBe(st.playback.runId)
    // The field count comes from the worker's first progress message.
    expect(st.mc.sensitivity.total).toBe(0)
    expect(st.mc.sensitivity.basisSignature).toBe(analysisBasisSignature(st.scenario))
  })

  it('the uncertainty mode changes the basis and marks both runs stale', () => {
    const summary = primeSensitivity()
    markMcDone()
    const before = analysisBasisSignature(useStore.getState().scenario)
    useStore.getState().patchScenario({ uncertainty: 'total' })
    const st = useStore.getState()
    expect(analysisBasisSignature(st.scenario)).not.toBe(before)
    expect(st.mc.status).toBe('stale')
    expect(st.mc.sensitivity.status).toBe('stale')
    expect(st.mc.sensitivity.summary).toBe(summary)
  })

  it('runMonteCarlo keeps a finished sensitivity run', () => {
    const summary = primeSensitivity()
    useStore.getState().runMonteCarlo()
    const sens = useStore.getState().mc.sensitivity
    expect(sens.status).toBe('done')
    expect(sens.summary).toBe(summary)
  })

  it('a done message from another run id is ignored', () => {
    const summary = primeSensitivity()
    useStore
      .getState()
      .sensitivityMessage({ type: 'sens-done', runId: 'other-run', summary: fakeSensitivity() })
    expect(useStore.getState().mc.sensitivity.summary).toBe(summary)
  })

  it('a done message after a stale mark is ignored', () => {
    const summary = primeSensitivity()
    useStore.getState().patchScenario({ seed: 99 })
    const runId = useStore.getState().mc.sensitivity.runId as string
    useStore.getState().sensitivityMessage({ type: 'sens-done', runId, summary: fakeSensitivity() })
    const sens = useStore.getState().mc.sensitivity
    expect(sens.status).toBe('stale')
    expect(sens.summary).toBe(summary)
  })

  it('resetRun and replaceScenario clear the sensitivity run', () => {
    primeSensitivity()
    useStore.getState().resetRun('manual')
    expect(useStore.getState().mc.sensitivity).toEqual(IDLE_SENSITIVITY)
    primeSensitivity()
    useStore.getState().replaceScenario(emptyScenario())
    expect(useStore.getState().mc.sensitivity).toEqual(IDLE_SENSITIVITY)
  })

  it('stays out of the scenario and the history', () => {
    useStore.getState().patchScenario({ runMode: 'monte-carlo', sensitivityDepth: 'quick' })
    const past = useStore.getState().past.length
    useStore.getState().runSensitivity()
    const runId = useStore.getState().mc.sensitivity.runId as string
    useStore.getState().sensitivityMessage({ type: 'sens-done', runId, summary: fakeSensitivity() })
    const st = useStore.getState()
    expect(st.past.length).toBe(past)
    // The depth setting is a scenario field; the run slice is not.
    expect('sensitivity' in st.scenario).toBe(false)
    expect(JSON.stringify(st.scenario)).not.toContain('"sensitivity"')
  })
})

describe('resetModelToSeed', () => {
  beforeEach(reset)

  /** The library copy of a seed model, by id. */
  function model(id: string) {
    return useStore.getState().scenario.library.find((m) => m.id === id)
  }

  it('restores an edited seed model and pushes one history entry', () => {
    const st = useStore.getState()
    st.updateModel('lib-giraffe1x', { name: 'Edited', provenance: [] })
    const past = useStore.getState().past.length
    useStore.getState().resetModelToSeed('lib-giraffe1x')
    expect(useStore.getState().past.length).toBe(past + 1)
    const m = model('lib-giraffe1x')
    expect(m?.name).toBe('Giraffe 1X 3D radar (Saab)')
    expect(m?.provenance?.map((r) => r.field)).toContain('updateRateS')
  })

  it('updateModel drops the row of a spec field it changes and keeps the rest', () => {
    const before = model('lib-coyote')!
    expect(before.provenance?.map((r) => r.field)).toContain('maxRangeM')
    useStore.getState().updateModel('lib-coyote', {
      effector: { ...before.effector!, maxRangeM: 9000 },
    })
    const fields = model('lib-coyote')?.provenance?.map((r) => r.field) ?? []
    expect(fields).not.toContain('maxRangeM')
    expect(fields).toContain('flyoutSpeedMps')
    // A patch outside the spec keeps every row.
    useStore.getState().updateModel('lib-coyote', { name: 'Edited' })
    expect(model('lib-coyote')?.provenance?.map((r) => r.field)).toEqual(fields)
  })

  it('pushes no history entry when the model already equals the seed', () => {
    const past = useStore.getState().past.length
    useStore.getState().resetModelToSeed('lib-giraffe1x')
    expect(useStore.getState().past.length).toBe(past)
  })

  it('undo puts the edit back', () => {
    useStore.getState().updateModel('lib-giraffe1x', { name: 'Edited' })
    useStore.getState().resetModelToSeed('lib-giraffe1x')
    useStore.getState().undo()
    expect(model('lib-giraffe1x')?.name).toBe('Edited')
  })

  it('leaves a custom model alone', () => {
    const id = useStore.getState().addModel('sensor')
    useStore.getState().updateModel(id, { name: 'Mine' })
    const past = useStore.getState().past.length
    useStore.getState().resetModelToSeed(id)
    expect(useStore.getState().past.length).toBe(past)
    expect(model(id)?.name).toBe('Mine')
  })

  it('does not share the seed object with the library', () => {
    useStore.getState().updateModel('lib-giraffe1x', { name: 'Edited' })
    useStore.getState().resetModelToSeed('lib-giraffe1x')
    useStore.getState().updateModel('lib-giraffe1x', { description: 'changed again' })
    reset()
    expect(model('lib-giraffe1x')?.description).not.toBe('changed again')
  })
})

describe('editModel', () => {
  beforeEach(reset)

  /** The library copy of a model, by id. */
  function model(id: string) {
    return useStore.getState().scenario.library.find((m) => m.id === id)
  }

  it('applies the coupled M-of-N pair in one undoable step', () => {
    const before = model('lib-giraffe1x')!.sensor
    const past = useStore.getState().past.length
    // M rises above the N in use, so the reducer carries N up with it.
    useStore.getState().editModel('lib-giraffe1x', 'sensor.trackInitM', 7)
    expect(useStore.getState().past.length).toBe(past + 1)
    expect(model('lib-giraffe1x')?.sensor?.trackInitM).toBe(7)
    expect(model('lib-giraffe1x')?.sensor?.trackInitN).toBe(7)
    useStore.getState().undo()
    expect(model('lib-giraffe1x')?.sensor).toEqual(before)
    expect(useStore.getState().past.length).toBe(past)
  })

  it('drops the source row of the field it edits and keeps the rest', () => {
    const fields = () => model('lib-giraffe1x')?.provenance?.map((r) => r.field) ?? []
    expect(fields()).toContain('detectRangeM')
    useStore.getState().editModel('lib-giraffe1x', 'sensor.detectRangeM', 9000)
    expect(fields()).not.toContain('detectRangeM')
    expect(fields()).toContain('instrumentedRangeM')
  })

  it('writes nothing when the field rule rejects the value or the section is absent', () => {
    const scenario = useStore.getState().scenario
    const past = useStore.getState().past.length
    useStore.getState().editModel('lib-giraffe1x', 'sensor.rfBands', [])
    useStore.getState().editModel('lib-giraffe1x', 'uas.cruiseSpeedMps', 30)
    useStore.getState().editModel('no-such-model', 'sensor.detectRangeM', 1000)
    expect(useStore.getState().scenario).toBe(scenario)
    expect(useStore.getState().past.length).toBe(past)
  })
})

describe('Execute phase view state', () => {
  beforeEach(reset)
  afterEach(() => vi.unstubAllGlobals())

  it('changes only boardPhase without storage, scenario, history or playback writes', () => {
    const storage = stubStorage({ sentinel: 'unchanged' })
    useStore.getState().setScenarioName('phase test')
    const before = useStore.getState()
    const writes = vi.spyOn(localStorage, 'setItem')
    before.setBoardPhase('execute')
    const after = useStore.getState()
    expect(after.ui).toEqual({ ...before.ui, boardPhase: 'execute' })
    expect(after.scenario).toBe(before.scenario)
    expect(after.past).toBe(before.past)
    expect(after.future).toBe(before.future)
    expect(after.playback).toBe(before.playback)
    expect(after.mc).toBe(before.mc)
    expect(after.ui.layers).toBe(before.ui.layers)
    expect(after.ui.executeLayers).toBe(before.ui.executeLayers)
    expect(writes).not.toHaveBeenCalled()
    expect([...storage]).toEqual([['sentinel', 'unchanged']])
  })

  it('defaults to engagement and retains an Execute preset override across phases without persisting', () => {
    const storage = stubLayerStorage(null)
    const st = useStore.getState()
    st.applyLayerPreset('planning')
    const before = useStore.getState()
    const saved = new Map(storage)
    const writes = vi.spyOn(localStorage, 'setItem')
    st.setBoardPhase('execute')
    expect(selectEffectiveLayers(useStore.getState())).toBe(EXECUTE_DEFAULT_LAYERS)
    st.applyLayerPreset('clean')
    const override = useStore.getState().ui.executeLayers
    expect(override).toEqual(LAYER_PRESETS.clean)
    expect(useStore.getState().ui.layers).toBe(before.ui.layers)
    expect(storage).toEqual(saved)
    expect(writes).not.toHaveBeenCalled()
    for (const phase of ['prepare', 'analyze'] as const) {
      st.setBoardPhase(phase)
      expect(selectEffectiveLayers(useStore.getState())).toBe(before.ui.layers)
      expect(useStore.getState().ui.executeLayers).toBe(override)
    }
    st.setBoardPhase('execute')
    expect(selectEffectiveLayers(useStore.getState())).toBe(override)
  })

  it('sets and toggles Execute layers from the effective view only', () => {
    const storage = stubLayerStorage(null)
    const st = useStore.getState()
    st.applyLayerPreset('full')
    const saved = new Map(storage)
    const layers = useStore.getState().ui.layers
    st.setBoardPhase('execute')
    st.setLayer('labels', false)
    expect(selectEffectiveLayers(useStore.getState())).toEqual({
      ...EXECUTE_DEFAULT_LAYERS,
      labels: false,
    })
    st.toggleLayer('connections')
    expect(selectEffectiveLayers(useStore.getState())).toEqual({
      ...EXECUTE_DEFAULT_LAYERS,
      labels: false,
      connections: true,
    })
    expect(useStore.getState().ui.layers).toBe(layers)
    expect(storage).toEqual(saved)
  })

  it('applying a future frame preserves an already-started run and its observation', () => {
    const st = useStore.getState()
    st.scrubTo(30)
    st.saveFrame('future')
    const id = useStore.getState().scenario.frames[0].id
    st.scrubTo(0)
    prepareReadyTrial()
    st.startRun()
    st.advanceRun(5)
    const before = useStore.getState().playback
    st.applyFrame(id)
    expect(useStore.getState().playback).toEqual({
      ...before,
      simTimeS: 30,
      playing: false,
      phase: 'review',
    })
  })
})

describe('run timeline state', () => {
  beforeEach(reset)
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  /** A fresh store module, so the initial state reads the stubbed storage. */
  async function freshStore() {
    vi.resetModules()
    return (await import('./store')).useStore
  }

  it('persists the open flag and the height under their keys', () => {
    const storage = stubStorage()
    const st = useStore.getState()
    st.setRunTimelineOpen(true)
    expect(useStore.getState().ui.runTimeline.open).toBe(true)
    expect(storage.get(ENGSTRIP_OPEN_KEY)).toBe('1')
    st.setRunTimelineOpen(false)
    expect(storage.get(ENGSTRIP_OPEN_KEY)).toBe('0')
    st.setRunTimelineHeight(301.6)
    expect(useStore.getState().ui.runTimeline.heightPx).toBe(302)
    expect(storage.get(RUN_TIMELINE_HEIGHT_KEY)).toBe('302')
    expect([...storage.keys()].sort()).toEqual([ENGSTRIP_OPEN_KEY, RUN_TIMELINE_HEIGHT_KEY].sort())
  })

  it('updates the height without a storage write when persist is false', () => {
    const storage = stubStorage({ [RUN_TIMELINE_HEIGHT_KEY]: '300' })
    const writes = vi.spyOn(localStorage, 'setItem')
    useStore.getState().setRunTimelineHeight(250.4, false)
    expect(useStore.getState().ui.runTimeline.heightPx).toBe(250)
    expect(storage.get(RUN_TIMELINE_HEIGHT_KEY)).toBe('300')
    expect(writes).not.toHaveBeenCalled()
    useStore.getState().setRunTimelineHeight(260)
    expect(storage.get(RUN_TIMELINE_HEIGHT_KEY)).toBe('260')
    writes.mockRestore()
  })

  it('clamps the height to the minimum', () => {
    const storage = stubStorage()
    useStore.getState().setRunTimelineHeight(40)
    expect(useStore.getState().ui.runTimeline.heightPx).toBe(RUN_TIMELINE_MIN_H)
    expect(storage.get(RUN_TIMELINE_HEIGHT_KEY)).toBe(String(RUN_TIMELINE_MIN_H))
  })

  it('restores the open flag and the height at startup', async () => {
    stubStorage({ [ENGSTRIP_OPEN_KEY]: '1', [RUN_TIMELINE_HEIGHT_KEY]: '300' })
    const fresh = await freshStore()
    expect(fresh.getState().ui.runTimeline.open).toBe(true)
    expect(fresh.getState().ui.runTimeline.heightPx).toBe(300)
  })

  it('reads a missing, invalid or short saved height as the default', async () => {
    for (const saved of [null, 'tall', 'Infinity', '80']) {
      stubStorage(
        saved == null ? { [ENGSTRIP_OPEN_KEY]: '0' } : { [RUN_TIMELINE_HEIGHT_KEY]: saved },
      )
      const fresh = await freshStore()
      expect(fresh.getState().ui.runTimeline.open).toBe(false)
      expect(fresh.getState().ui.runTimeline.heightPx).toBe(RUN_TIMELINE_DEFAULT_H)
    }
  })

  it('toggles, hides and shows the session fields without storage writes', () => {
    const storage = stubStorage({ sentinel: 'unchanged' })
    const writes = vi.spyOn(localStorage, 'setItem')
    const st = useStore.getState()
    const tl = () => useStore.getState().ui.runTimeline
    st.toggleRunTimelineGroup('threat')
    expect(tl().openGroups).toEqual(['threat'])
    st.toggleRunTimelineGroup('threat')
    expect(tl().openGroups).toEqual([])
    st.toggleRunTimelineSensor('s1')
    st.toggleRunTimelineFold('f1')
    expect(tl().openSensors).toEqual(['s1'])
    expect(tl().openFolds).toEqual(['f1'])
    st.toggleRunTimelineSensor('s1')
    st.toggleRunTimelineFold('f1')
    expect(tl().openSensors).toEqual([])
    expect(tl().openFolds).toEqual([])
    st.hideRunTimelineRow('r1')
    st.hideRunTimelineRow('r1')
    st.hideRunTimelineRow('r2')
    expect(tl().hiddenRows).toEqual(['r1', 'r2'])
    st.showAllRunTimelineRows()
    expect(tl().hiddenRows).toEqual([])
    st.setRunTimelineFollow(false)
    expect(tl().follow).toBe(false)
    st.setRunTimelineViewport({ t0S: 5, winS: 20 })
    expect(tl().viewport).toEqual({ t0S: 5, winS: 20 })
    st.setRunTimelineFollow(true)
    expect(writes).not.toHaveBeenCalled()
    expect([...storage]).toEqual([['sentinel', 'unchanged']])
  })

  it('sets the viewport alone, or with Follow in the same write', () => {
    const st = useStore.getState()
    const tl = () => useStore.getState().ui.runTimeline
    st.setRunTimelineFollow(true)
    st.setRunTimelineViewport({ t0S: 5, winS: 20 })
    expect(tl().follow).toBe(true)
    let writes = 0
    const unsubscribe = useStore.subscribe(() => writes++)
    st.setRunTimelineViewport({ t0S: 40, winS: 20 }, false)
    unsubscribe()
    expect(writes).toBe(1)
    expect(tl()).toMatchObject({ viewport: { t0S: 40, winS: 20 }, follow: false })
  })

  it('collapses every group, and expands the given groups and sensor rows', () => {
    const st = useStore.getState()
    const tl = () => useStore.getState().ui.runTimeline
    st.toggleRunTimelineGroup('c2')
    st.expandAllRunTimeline(['sensor', 'threat'], ['sensor:s1'])
    expect(tl().openGroups).toEqual(['sensor', 'threat'])
    expect(tl().openSensors).toEqual(['sensor:s1'])
    st.collapseAllRunTimeline()
    expect(tl().openGroups).toEqual([])
    expect(tl().openSensors).toEqual(['sensor:s1'])
    st.toggleRunTimelineSensor('sensor:s1')
  })

  it('keeps sensor rows open through Expand all until Collapse all or a row toggle', () => {
    const st = useStore.getState()
    const tl = () => useStore.getState().ui.runTimeline
    expect(tl().openSensorsAll).toBe(false)
    st.expandAllRunTimeline(['sensor'], ['sensor:s1'])
    expect(tl()).toMatchObject({ openSensors: ['sensor:s1'], openSensorsAll: true })
    st.collapseAllRunTimeline()
    expect(tl()).toMatchObject({
      openGroups: [],
      openSensors: ['sensor:s1'],
      openSensorsAll: false,
    })
    // A row toggle under the flag starts from the rows open on screen, so a row
    // opened by the flag alone (s2) stays open.
    st.expandAllRunTimeline(['sensor'], ['sensor:s1'])
    st.toggleRunTimelineSensor('sensor:s1', ['sensor:s1', 'sensor:s2'])
    expect(tl()).toMatchObject({ openSensors: ['sensor:s2'], openSensorsAll: false })
    // With the flag off the stored list is the start.
    st.toggleRunTimelineSensor('sensor:s3', ['sensor:s9'])
    expect(tl().openSensors).toEqual(['sensor:s2', 'sensor:s3'])
  })

  it('seeks with Follow off and the shown viewport held, and never advances observation', () => {
    const st = useStore.getState()
    prepareReadyTrial()
    st.startRun()
    st.advanceRun(12.5)
    expect(useStore.getState().ui.runTimeline.follow).toBe(true)
    const shown = { t0S: 0, winS: 30 }
    useStore.getState().seekRunTimeline(50, shown)
    const after = useStore.getState()
    expect(after.ui.runTimeline.follow).toBe(false)
    expect(after.ui.runTimeline.viewport).toBe(shown)
    expect(after.playback.playing).toBe(false)
    expect(after.playback.simTimeS).toBe(50)
    expect(after.playback.observedThroughS).toBe(12.5)
    useStore.getState().seekRunTimeline(4, shown)
    expect(useStore.getState().playback.observedThroughS).toBe(12.5)
  })

  it('turns Follow on when playback starts, and leaves it on pause', () => {
    const st = useStore.getState()
    const observed = () => useStore.getState().playback.observedThroughS
    st.setRunTimelineViewport({ t0S: 0, winS: 30 }, false)
    prepareReadyTrial()
    st.startRun()
    expect(useStore.getState().ui.runTimeline.follow).toBe(true)
    useStore.getState().advanceRun(7.5)
    const seen = observed()
    // A pause with Follow on leaves Follow on.
    useStore.getState().pauseRun()
    expect(useStore.getState().ui.runTimeline.follow).toBe(true)
    expect(observed()).toBe(seen)
    useStore.getState().setRunTimelineViewport({ t0S: 0, winS: 30 }, false)
    expect(useStore.getState().ui.runTimeline.follow).toBe(false)
    useStore.getState().playbackCommand({ type: 'toggle' })
    expect(useStore.getState().playback.playing).toBe(true)
    expect(useStore.getState().ui.runTimeline.follow).toBe(true)
    expect(observed()).toBe(seen)
  })

  it('leaves playback untouched through every strip action and a board select', () => {
    prepareReadyTrial()
    useStore.getState().startRun()
    useStore.getState().advanceRun(12.5)
    const before = useStore.getState().playback
    const st = useStore.getState()
    const v = { t0S: 10, winS: 30 }
    st.setRunTimelineViewport(v)
    st.setRunTimelineFollow(true)
    st.setRunTimelineViewport(v, false)
    st.toggleRunTimelineGroup('threat')
    st.toggleRunTimelineSensor('sensor:s1')
    st.toggleRunTimelineFold('fold:f1')
    st.hideRunTimelineRow('threat:t1')
    st.showAllRunTimelineRows()
    st.collapseAllRunTimeline()
    st.expandAllRunTimeline(['sensor', 'threat'], ['sensor:s1'])
    st.select({ entityIds: ['x'] })
    expect(useStore.getState().playback).toBe(before)
    expect(useStore.getState().playback.observedThroughS).toBe(12.5)
  })
})
