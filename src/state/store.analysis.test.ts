import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PfTag } from '../panels/inspector/kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scenario, SpecModel } from '../model/types'
import { PF_SPREAD } from '../analysis/parameterBasis'
import { defendedRadiusOf } from '../playback/sim'
import { threatAltitudeFt } from '../playback/tracks'
import { defaultLinkLatencyS } from '../analysis/doctrineFactors'
import { emptyScenario } from '../model/seed'
import { useStore } from './store'
import { analysisBasisSignature } from './analysisBasis'
import { currentSensitivity, currentSummary } from '../panels/analysis/widgets/mc'
import { runReplicates, runSensitivity } from '../playback/mcRun'
import { runTrial } from '../playback/trial'
import type { TrialManifest } from '../playback/trialTypes'
import { CANCEL_GRACE_MS } from '../playback/workerSlot'
import { ControlledWorker } from '../playback/controlledWorker'
import probe from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'

function scenario(): Scenario {
  return { ...structuredClone(probe) as unknown as Scenario, runMode: 'monte-carlo', replicates: 1 }
}
const mcSummary = runReplicates(scenario())
const sensSummary = { ...runSensitivity({ ...emptyScenario(), replicates: 1 }), rows: [] }

function launch() {
  useStore.getState().runMonteCarlo()
  useStore.getState().runSensitivity()
  const [mc, sens] = ControlledWorker.instances.slice(-2)
  const runId = useStore.getState().playback.runId
  return { mc, sens, runId }
}
function finish() {
  const work = launch()
  work.mc.send({ type: 'done', runId: work.runId, summary: mcSummary })
  work.sens.send({ type: 'sens-done', runId: work.runId, summary: sensSummary })
  return work
}
function expectCurrent(current: boolean) {
  const { mc, playback } = useStore.getState()
  expect(currentSummary(mc, playback.runId) !== null).toBe(current)
  expect(currentSensitivity(mc, playback.runId) !== null).toBe(current)
}
function editModel(patch: (m: SpecModel) => Partial<SpecModel>) {
  const m = useStore.getState().scenario.library.find((m) => m.id === 'lib-coyote')!
  useStore.getState().updateModel(m.id, patch(m))
}
const edits: [string, () => void][] = [
  ['altitude', () => {
    const e = useStore.getState().scenario.entities.find((e) => e.kind === 'uas')!
    useStore.getState().updateEntity(e.id, { altitudeFt: 50000 })
  }],
  ['defended radius', () => {
    const e = useStore.getState().scenario.entities.find((e) => e.kind === 'asset')!
    useStore.getState().updateEntity(e.id, { defendedRadiusM: 1200 })
  }],
  ['doctrine', () => {
    const s = useStore.getState().scenario
    useStore.getState().patchScenario({ doctrine: { ...s.doctrine!, declareHostileS: 80 } })
  }],
  ['requirements', () => {
    const s = useStore.getState().scenario
    useStore.getState().patchScenario({ requirements: { ...s.requirements, pdDetect: 0.99 } })
  }],
  ['effective spread', () => editModel((m) => ({ provenance: [
    { field: 'pk', value: '0.5', source: 'test', date: '2026-09-04', basis: 'pf', spread: null },
    ...(m.provenance ?? []).filter((r) => r.field !== 'pk'),
  ] }))],
  ['connection draw identity', () => {
    const s = useStore.getState().scenario
    useStore.getState().patchScenario({ connections: s.connections.map((c, i) =>
      i === 0 ? { ...c, id: 'changed-draw-id' } : c) })
  }],
]

describe('complete analysis basis and request ownership', () => {
  beforeEach(() => {
    ControlledWorker.install()
    useStore.getState().replaceScenario(scenario())
  })
  afterEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    vi.unstubAllGlobals()
  })

  it.each(edits)('%s invalidates completed results through edits, undo and redo', (_, edit) => {
    finish()
    expectCurrent(true)
    edit()
    expect(useStore.getState().mc.status).toBe('stale')
    expect(useStore.getState().mc.sensitivity.status).toBe('stale')
    expectCurrent(false)
    finish()
    useStore.getState().undo()
    expectCurrent(false)
    finish()
    useStore.getState().redo()
    expectCurrent(false)
  })

  it.each(['replace', 'reset', 'basis'] as const)('%s rejects canceled callbacks in both slots', (action) => {
    const old = launch()
    if (action === 'replace') useStore.getState().loadScenario(scenario())
    if (action === 'reset') useStore.getState().resetRun('manual')
    if (action === 'basis') edits[0][1]()
    const snapshot = useStore.getState().mc
    old.mc.send({ type: 'progress', runId: old.runId, done: 99, total: 99 })
    old.mc.send({ type: 'done', runId: old.runId, summary: mcSummary })
    old.mc.onerror?.({ message: 'late error' })
    old.sens.send({ type: 'sens-progress', runId: old.runId, done: 99, total: 99 })
    old.sens.send({ type: 'sens-done', runId: old.runId, summary: sensSummary })
    old.sens.onerror?.({ message: 'late error' })
    expect(useStore.getState().mc === snapshot).toBe(true)
    expect(old.mc.terminated).toBe(true)
    expect(old.sens.terminated).toBe(true)
  })

  it('repeated requests in the same playback run reject all replaced callbacks', () => {
    const old = launch()
    const fresh = launch()
    expect(fresh.runId).toBe(old.runId)
    const snapshot = useStore.getState().mc
    old.mc.send({ type: 'progress', runId: old.runId, done: 99, total: 99 })
    old.mc.send({ type: 'done', runId: old.runId, summary: mcSummary })
    old.mc.send({ type: 'error', runId: old.runId, message: 'old' })
    old.mc.onerror?.({ message: 'old native error' })
    old.sens.send({ type: 'sens-progress', runId: old.runId, done: 99, total: 99 })
    old.sens.send({ type: 'sens-done', runId: old.runId, summary: sensSummary })
    old.sens.send({ type: 'sens-error', runId: old.runId, message: 'old' })
    old.sens.onerror?.({ message: 'old native error' })
    expect(useStore.getState().mc === snapshot).toBe(true)
    fresh.mc.send({ type: 'progress', runId: fresh.runId, done: 1, total: 2 })
    fresh.sens.send({ type: 'sens-progress', runId: fresh.runId, done: 1, total: 2 })
    expect(useStore.getState().mc.progress).toBe(1)
    expect(useStore.getState().mc.sensitivity.progress).toBe(1)
    fresh.mc.send({ type: 'done', runId: fresh.runId, summary: mcSummary })
    fresh.sens.send({ type: 'sens-done', runId: fresh.runId, summary: sensSummary })
    expectCurrent(true)
  })

  it('a terminal result cannot be overwritten by later progress, errors or completion', () => {
    const work = finish()
    const snapshot = useStore.getState().mc
    work.mc.send({ type: 'progress', runId: work.runId, done: 99, total: 99 })
    work.mc.onerror?.({ message: 'late' })
    work.mc.send({ type: 'done', runId: work.runId, summary: { ...mcSummary, replicates: 99 } })
    work.sens.send({ type: 'sens-progress', runId: work.runId, done: 99, total: 99 })
    work.sens.onerror?.({ message: 'late' })
    work.sens.send({ type: 'sens-done', runId: work.runId, summary: { ...sensSummary, nominal: 99 } })
    expect(useStore.getState().mc === snapshot).toBe(true)
  })

  it('replacing one slot leaves the other running and able to complete', () => {
    const first = launch()
    useStore.getState().runMonteCarlo()
    expect(first.sens.terminated).toBe(false)
    first.sens.send({ type: 'sens-done', runId: first.runId, summary: sensSummary })
    const mc = ControlledWorker.instances.at(-1)!
    useStore.getState().runSensitivity()
    expect(mc.terminated).toBe(false)
    mc.send({ type: 'done', runId: first.runId, summary: mcSummary })
    expect(useStore.getState().mc.status).toBe('done')
    ControlledWorker.instances.at(-1)!.onerror?.({ message: 'current error' })
    expect(useStore.getState().mc.sensitivity.error).toBe('current error')
  })

  it('a cancel asks the worker to stop and accepts the partial summary; silence terminates it', () => {
    vi.useFakeTimers()
    const work = launch()
    useStore.getState().cancelMonteCarlo()
    useStore.getState().cancelSensitivityRun()
    expect(work.mc.postMessage).toHaveBeenLastCalledWith({ type: 'cancel', runId: work.runId })
    expect(work.sens.postMessage).toHaveBeenLastCalledWith({ type: 'cancel', runId: work.runId })
    // A second cancel while one is in flight posts nothing more.
    useStore.getState().cancelMonteCarlo()
    expect(work.mc.postMessage).toHaveBeenCalledTimes(2)
    const partial = { ...mcSummary, replicates: 7, stopped: { rule: 'cancelled' as const, at: 7 } }
    work.mc.send({ type: 'done', runId: work.runId, summary: partial })
    expect(useStore.getState().mc.status).toBe('done')
    expect(useStore.getState().mc.progress).toBe(7)
    expect(useStore.getState().mc.summary?.stopped.rule).toBe('cancelled')
    vi.advanceTimersByTime(CANCEL_GRACE_MS + 1)
    // The summary released the worker; the grace timer then had nothing to stop.
    expect(work.mc.terminated).toBe(true)
    expect(useStore.getState().mc.status).toBe('done')
    expect(work.sens.terminated).toBe(true)
    expect(useStore.getState().mc.sensitivity.status).toBe('error')
    expect(useStore.getState().mc.sensitivity.error).toBe('Cancel timed out; the worker was stopped')
    // Nothing running: a cancel is a no-op.
    useStore.getState().cancelMonteCarlo()
    expect(work.mc.postMessage).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it.each(['mc', 'sensitivity'] as const)('a synchronous construction error ends the %s request in an error state', (kind) => {
    ControlledWorker.constructionError = 'Worker blocked'
    if (kind === 'mc') useStore.getState().runMonteCarlo()
    else useStore.getState().runSensitivity()
    const { mc, playback, scenario: current } = useStore.getState()
    const run = kind === 'mc' ? mc : mc.sensitivity
    expect(run).toMatchObject({ status: 'error', error: 'Worker blocked', runId: playback.runId,
      basisSignature: analysisBasisSignature(current) })
    expect(ControlledWorker.instances).toHaveLength(0)
    ControlledWorker.constructionError = null
    if (kind === 'mc') useStore.getState().runMonteCarlo()
    else useStore.getState().runSensitivity()
    expect(run === (kind === 'mc' ? useStore.getState().mc : useStore.getState().mc.sensitivity)).toBe(false)
    expect((kind === 'mc' ? useStore.getState().mc : useStore.getState().mc.sensitivity).status).toBe('running')
  })

  it('a replicate run and a trial requested together each own their slot and finish in either order', () => {
    useStore.getState().runMonteCarlo()
    useStore.getState().prepareTrial()
    const [mc, trial] = ControlledWorker.instances
    const runId = useStore.getState().playback.runId
    expect(useStore.getState().mc).toMatchObject({ status: 'running', runId })
    expect(useStore.getState().trial).toMatchObject({ status: 'preparing', manifest: { runId } })
    expect(useStore.getState().playback.playing).toBe(false)
    expect(mc.terminated).toBe(false)
    const request = trial.request as { requestToken: string; basisSignature: string; scenario: Scenario; manifest: TrialManifest }
    trial.send({ type: 'trial-done', requestToken: request.requestToken, runId, basisSignature: request.basisSignature,
      result: runTrial(request.scenario, request.manifest) })
    expect(useStore.getState().trial.status).toBe('ready')
    expect(useStore.getState().mc.status).toBe('running')
    expect(mc.terminated).toBe(false)
    mc.send({ type: 'done', runId, summary: mcSummary })
    expect(useStore.getState().mc.status).toBe('done')
    expect(useStore.getState().trial.status).toBe('ready')
    expect(mc.terminated).toBe(true)
    expect(trial.terminated).toBe(true)
  })

  it('playback resets on input changes but retains its sequence and ignores metadata edits', () => {
    const st = useStore.getState()
    st.runMonteCarlo()
    st.startRun()
    const before = useStore.getState().playback
    useStore.getState().setScenarioName('Evidence title')
    expect(useStore.getState().playback).toBe(before)
    edits[0][1]()
    const after = useStore.getState().playback
    expect(after.runId).not.toBe(before.runId)
    expect(after.runSeq).toBe(before.runSeq)
    expect(after.resetReason).toBe('configuration-changed')
    expect(after.playing).toBe(false)
    expect(useStore.getState().mc.status).toBe('stale')
  })

  it('missing scenario defaults and explicit resolved entity/link defaults share one basis', () => {
    const base = emptyScenario()
    const missing = { ...base, doctrine: undefined, requirements: undefined,
      roe: undefined, raid: undefined, seed: undefined, replicates: undefined,
      runMode: undefined, uncertainty: undefined, targetHalfWidth: undefined,
      environment: { ...base.environment, precipitation: undefined, light: undefined,
        emBackground: undefined, visibilityM: undefined } } as unknown as Scenario
    expect(analysisBasisSignature(missing)).toBe(analysisBasisSignature(base))
    const old = scenario()
    old.entities = old.entities.map((e) => ({ ...e, altitudeFt: undefined,
      defendedRadiusM: undefined, enabled: undefined, formation: undefined }))
    old.connections = old.connections.map((c) => ({ ...c, latencyS: undefined,
      medium: undefined, confidence: undefined }))
    const explicit = { ...old,
      entities: old.entities.map((e) => ({ ...e, enabled: true, formation: null,
        altitudeFt: e.kind === 'uas' ? threatAltitudeFt(old, e) : null,
        defendedRadiusM: e.kind === 'asset' ? defendedRadiusOf(e) : null })),
      connections: old.connections.map((c) => ({ ...c, medium: null, confidence: null,
        latencyS: defaultLinkLatencyS(old.entities.find((e) => e.id === c.fromId)!.kind,
          old.entities.find((e) => e.id === c.toId)!.kind) })),
    }
    expect(analysisBasisSignature(explicit)).toBe(analysisBasisSignature(old))
    useStore.getState().replaceScenario(old)
    finish()
    useStore.getState().patchScenario(explicit)
    expectCurrent(true)
  })

  it('effective spreads resolve absent, PF fallback, explicit and pinned rows', () => {
    editModel(() => ({ provenance: [] }))
    finish()
    const fallback = analysisBasisSignature(useStore.getState().scenario)
    editModel(() => ({ provenance: [{ field: 'pk', value: '', source: 'PF', date: '',
      basis: 'pf', spread: { ...PF_SPREAD.pk.spread } }] }))
    expect(analysisBasisSignature(useStore.getState().scenario)).toBe(fallback)
    expectCurrent(true)
    editModel((m) => ({ provenance: m.provenance!.map((r) => ({ ...r, spread: null })) }))
    expectCurrent(false)
    finish()
    editModel(() => ({ provenance: [] }))
    expectCurrent(false)
  })

  it('every requirement and doctrine field is part of the basis', () => {
    const base = scenario()
    const before = analysisBasisSignature(base)
    for (const group of ['requirements', 'doctrine'] as const) {
      for (const [field, value] of Object.entries(base[group]!)) {
        const changed = typeof value === 'boolean' ? !value
          : typeof value === 'number' ? value + 1 : value == null ? 10 : 'latest'
        const next = { ...base, [group]: { ...base[group], [field]: changed } }
        expect(analysisBasisSignature(next) !== before, `${group}.${field}`).toBe(true)
      }
    }
  })

  it('geometry, activity, routing, schedules, specs and draw order remain inputs', () => {
    const base = scenario()
    const sig = analysisBasisSignature(base)
    const variants: [string, (s: Scenario) => void][] = [
      ['position', (s) => { s.entities[0].pos.x += 100 }],
      ['heading', (s) => { s.entities[0].headingDeg += 45 }],
      ['enabled', (s) => { s.entities[0].enabled = false }],
      ['spec identity', (s) => { s.entities[0].specId = 'lib-kurfs' }],
      ['entity draw identity', (s) => { s.entities[0].id += '-new' }],
      ['entity ordering', (s) => { s.entities.reverse() }],
      ['library ordering', (s) => { s.library.reverse() }],
      ['path points', (s) => { s.paths[0].points[0].x += 100 }],
      ['path speed', (s) => { s.paths[0].speedMps = 50 }],
      ['path delay', (s) => { s.paths[0].startDelayS += 10 }],
      ['raid delay', (s) => { s.raid = { waves: [
        { entityIds: [s.paths[0].entityId], startDelayS: 10 }] } }],
      ['environment', (s) => { s.environment.precipitation = 'rain' }],
      ['roe', (s) => { s.roe = 'hold' }],
      ['route endpoints', (s) => { s.connections[0].toId = s.connections[0].fromId }],
      ['route typing', (s) => { s.connections[0].confidence = null }],
      ['route latency', (s) => { s.connections[0].latencyS = 100 }],
      ['sensor spec', (s) => { s.library.find((m) => m.sensor)!.sensor!.mountHeightM = 20 }],
      ['effector spec', (s) => { s.library.find((m) => m.effector)!.effector!.flyoutSpeedMps = 100 }],
      ['threat spec', (s) => { s.library.find((m) => m.uas)!.uas!.rcsM2 = 10 }],
      ['profile intent', (s) => { s.library.find((m) => m.threatProfile)!
        .threatProfile!.routeIntent = 'attack' }],
      ['profile altitude', (s) => { s.library.find((m) => m.threatProfile)!
        .threatProfile!.altitudeFt += 100 }],
    ]
    for (const [name, edit] of variants) {
      const next = structuredClone(base)
      edit(next)
      expect(analysisBasisSignature(next) !== sig, name).toBe(true)
    }
  })

  it('object property order is irrelevant while completed results remain current', () => {
    finish()
    const s = useStore.getState().scenario
    useStore.getState().patchScenario({ environment:
      Object.fromEntries(Object.entries(s.environment).reverse()) as Scenario['environment'] })
    expectCurrent(true)
  })

  it('error state rejects later completions until an explicit retry', () => {
    const old = launch()
    old.mc.onerror?.({ message: 'current MC error' })
    old.sens.onerror?.({ message: 'current sensitivity error' })
    const snapshot = useStore.getState().mc
    old.mc.send({ type: 'done', runId: old.runId, summary: mcSummary })
    old.sens.send({ type: 'sens-done', runId: old.runId, summary: sensSummary })
    expect(useStore.getState().mc === snapshot).toBe(true)
    finish()
    expectCurrent(true)
  })

  it('presentation, evidence and provenance descriptions preserve numerical results', () => {
    finish()
    const sig = analysisBasisSignature(useStore.getState().scenario)
    useStore.getState().setScenarioName('New title')
    useStore.getState().setCamera({ x: 40, y: 10, scale: 0.1 })
    useStore.getState().select({ entityIds: [] })
    useStore.getState().applyLens('sensors')
    useStore.getState().saveFrame('evidence')
    useStore.getState().addCard()
    editModel((m) => ({ description: 'Updated description', provenance:
      m.provenance?.map((r) => ({ ...r, source: 'Updated source', date: '2026-09-05' })) }))
    expect(analysisBasisSignature(useStore.getState().scenario)).toBe(sig)
    expect(useStore.getState().scenario.library.find((m) => m.id === 'lib-coyote')!
      .provenance?.[0].source).toBe('Updated source')
    const model = useStore.getState().scenario.library.find((m) => m.id === 'lib-coyote')!
    const tag = renderToStaticMarkup(createElement(PfTag, { model, field: model.provenance![0].field }))
    expect(tag).toContain('Updated source')
    expect(tag).toContain('2026-09-05')
    expectCurrent(true)
  })
})
