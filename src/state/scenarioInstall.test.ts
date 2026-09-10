import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entity, Scenario } from '../model/types'
import { emptyScenario } from '../model/seed'
import { engineKeyOf } from '../model/scenario'
import { createTrialManifest } from '../playback/trialTypes'
import { analysisBasisSignature } from './analysisBasis'
import { freshPlayback, IDLE_MC, IDLE_TRIAL } from './runState'
import type { ScenarioSlices } from './scenarioInstall'
import { EMPTY_SELECTION, HISTORY_LIMIT, installScenario } from './scenarioInstall'

vi.mock('../playback/mcClient', () => ({ cancelPooledRun: vi.fn(), cancelSensitivity: vi.fn(), cancelSweep: vi.fn() }))
vi.mock('../playback/trialClient', () => ({ cancelTrial: vi.fn() }))
import { cancelPooledRun, cancelSensitivity, cancelSweep } from '../playback/mcClient'
import { cancelTrial } from '../playback/trialClient'

const sensor = (id: string, x = 0): Entity => ({
  id, name: id, kind: 'sensor', specId: null, pos: { x, y: 0 }, headingDeg: 0, color: null, notes: '',
})

/** Two sensors, one boundary, one connection. */
function board(): Scenario {
  const s = emptyScenario()
  s.entities.push(sensor('ent-a'), sensor('ent-b', 500))
  s.boundaries.push({ id: 'bnd-1', name: 'r', type: 'range', points: [], closed: true, altBandFt: null })
  s.connections.push({ id: 'con-1', fromId: 'ent-a', toId: 'ent-b', label: '' })
  return s
}
/** The same board with `ent-b` and everything that referenced it removed. */
function withoutB(s: Scenario): Scenario {
  return { ...s, entities: s.entities.filter((e) => e.id !== 'ent-b'), connections: [] }
}
/** The same board with only a name change: no material input moves. */
function renamed(s: Scenario): Scenario {
  return { ...s, name: 'renamed' }
}

function slices(scenario: Scenario, patch: Partial<ScenarioSlices> = {}): ScenarioSlices {
  const signature = analysisBasisSignature(scenario)
  const playback = { ...freshPlayback(3, 2), basisSignature: signature, startedAtMs: 1 }
  return {
    scenario,
    past: [],
    future: [],
    selection: { entityIds: ['ent-a', 'ent-b'], boundaryId: 'bnd-1', connectionId: 'con-1', libraryId: null, cardId: null },
    ringOverrides: { 'ent-a': { sensorPlacard: false }, 'ent-b': { classifyRings: true } },
    playback,
    mc: {
      ...IDLE_MC, runId: playback.runId, status: 'done', basisSignature: signature,
      sensitivity: { ...IDLE_MC.sensitivity, runId: playback.runId, status: 'done', basisSignature: signature },
      sweep: { ...IDLE_MC.sweep, runId: playback.runId, status: 'done', basisSignature: signature },
    },
    trial: { ...IDLE_TRIAL, status: 'ready', manifest: createTrialManifest(scenario, playback.runId, signature) },
    ...patch,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('installScenario operation matrix', () => {
  const start = board()
  const gone = withoutB(start)

  const cases = [
    ['edit', (st: ScenarioSlices) => installScenario(st, { op: 'edit', next: gone })],
    ['undo', (st: ScenarioSlices) => installScenario({ ...st, past: [gone] }, { op: 'undo' })],
    ['redo', (st: ScenarioSlices) => installScenario({ ...st, future: [gone] }, { op: 'redo' })],
    ['replace', (st: ScenarioSlices) => installScenario(st, { op: 'replace', next: gone })],
  ] as const

  it.each(cases)('%s makes the next scenario current and prunes ring overrides', (_, run) => {
    const out = run(slices(start))
    expect(out.scenario.entities.map((e) => e.id)).toEqual(['ent-a'])
    expect(out.ringOverrides).toEqual({ 'ent-a': { sensorPlacard: false } })
  })

  it.each(cases)('%s invalidates playback, marks replicates stale or idle, and drops the trial', (op, run) => {
    const before = slices(start)
    const out = run(before)
    expect(out.playback.runId).not.toBe(before.playback.runId)
    expect(out.playback.runSeq).toBe(3)
    expect(out.playback.speedMult).toBe(2)
    expect(out.playback.resetReason).toBe(op === 'replace' ? 'scenario-loaded' : 'configuration-changed')
    expect(out.trial).toBe(IDLE_TRIAL)
    expect(cancelTrial).toHaveBeenCalledTimes(1)
    expect(cancelPooledRun).toHaveBeenCalledTimes(1)
    expect(cancelSensitivity).toHaveBeenCalledTimes(1)
    expect(cancelSweep).toHaveBeenCalledTimes(1)
    if (op === 'replace') {
      expect(out.mc).toBe(IDLE_MC)
    } else {
      expect(out.mc.status).toBe('stale')
      expect(out.mc.sensitivity.status).toBe('stale')
      expect(out.mc.sweep.status).toBe('stale')
      expect(out.mc.summary).toBe(before.mc.summary)
    }
  })

  it('history: edit pushes, undo and redo walk, replace clears', () => {
    const a = board()
    const b = renamed(a)
    const c = { ...b, name: 'third' }
    const edited = installScenario(installScenario(slices(a), { op: 'edit', next: b }), { op: 'edit', next: c })
    expect(edited.past).toEqual([a, b])
    expect(edited.future).toEqual([])
    const undone = installScenario(edited, { op: 'undo' })
    expect(undone.scenario).toBe(b)
    expect(undone.past).toEqual([a])
    expect(undone.future).toEqual([c])
    const redone = installScenario(undone, { op: 'redo' })
    expect(redone.scenario).toBe(c)
    expect(redone.past).toEqual([a, b])
    expect(redone.future).toEqual([])
    const branched = installScenario(undone, { op: 'edit', next: renamed(c) })
    expect(branched.future).toEqual([])
    const replaced = installScenario(redone, { op: 'replace', next: a })
    expect(replaced.past).toEqual([])
    expect(replaced.future).toEqual([])
  })

  it('history holds at most HISTORY_LIMIT snapshots', () => {
    let st = slices(board())
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      st = installScenario(st, { op: 'edit', next: { ...st.scenario, name: `n${i}` } })
    }
    expect(st.past).toHaveLength(HISTORY_LIMIT)
    expect(st.past[0].name).toBe('n4')
  })

  it('returns the input when there is nothing to do', () => {
    const st = slices(board())
    expect(installScenario(st, { op: 'edit', next: st.scenario })).toBe(st)
    expect(installScenario(st, { op: 'undo' })).toBe(st)
    expect(installScenario(st, { op: 'redo' })).toBe(st)
    expect(cancelTrial).not.toHaveBeenCalled()
  })

  it('an immaterial change keeps the run, the replicates and the trial', () => {
    const st = slices(board())
    const out = installScenario(st, { op: 'edit', next: renamed(st.scenario) })
    expect(out.playback).toBe(st.playback)
    expect(out.mc).toBe(st.mc)
    expect(out.trial).toBe(st.trial)
    expect(out.ringOverrides).toBe(st.ringOverrides)
    expect(cancelPooledRun).not.toHaveBeenCalled()
    expect(cancelTrial).not.toHaveBeenCalled()
  })

  it('selection: edit keeps it, undo and redo prune it, replace clears it', () => {
    const st = slices(board())
    expect(installScenario(st, { op: 'edit', next: withoutB(st.scenario) }).selection).toBe(st.selection)
    const pruned = { entityIds: ['ent-a'], boundaryId: 'bnd-1', connectionId: null, libraryId: null, cardId: null }
    expect(installScenario({ ...st, past: [withoutB(st.scenario)] }, { op: 'undo' }).selection).toEqual(pruned)
    expect(installScenario({ ...st, future: [withoutB(st.scenario)] }, { op: 'redo' }).selection).toEqual(pruned)
    expect(installScenario(st, { op: 'replace', next: withoutB(st.scenario) }).selection).toBe(EMPTY_SELECTION)
  })

  it.each(['undo', 'redo'] as const)('%s carries the current lens stamp over the restored snapshot', (op) => {
    const snapshot = board()
    const current = { ...renamed(snapshot), observedPresetId: 'sensors' }
    const side = op === 'undo' ? { past: [snapshot] } : { future: [snapshot] }
    const out = installScenario(slices(current, side), { op })
    expect(out.scenario.observedPresetId).toBe('sensors')
    expect(out.scenario.name).toBe(snapshot.name)
    // The stamp is a presentation variant: engine caches keyed on the snapshot still hit.
    expect(engineKeyOf(out.scenario)).toBe(engineKeyOf(snapshot))
    // A stamp that already matches replaces nothing.
    const matching = { ...snapshot, observedPresetId: 'sensors' }
    const same = installScenario(slices(current, op === 'undo' ? { past: [matching] } : { future: [matching] }), { op })
    expect(same.scenario).toBe(matching)
  })

  it('edit and replace stamp nothing', () => {
    const st = slices({ ...board(), observedPresetId: 'sensors' })
    const next = board()
    expect(installScenario(st, { op: 'edit', next }).scenario).toBe(next)
    expect(installScenario(st, { op: 'replace', next }).scenario).toBe(next)
  })
})
