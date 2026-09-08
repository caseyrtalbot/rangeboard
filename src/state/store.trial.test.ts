import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './store'
import { emptyScenario } from '../model/seed'
import { analysisBasisSignature } from './analysisBasis'
import { IDLE_TRIAL } from './runState'
import { runTrial } from '../playback/trial'
import type { TrialRequest, TrialWorkerMessage } from '../playback/trialMessages'
import { resetAnalysisRun, toggleAnalysisRun } from '../playback/runSession'
import { parseScenarioData } from '../io/persist'
import { ControlledWorker } from '../playback/controlledWorker'
import firing from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'

const scenario = () => parseScenarioData(structuredClone(firing))
const latest = () => ControlledWorker.latest()
const requestOf = (worker: ControlledWorker) => worker.request as TrialRequest
function done(worker = latest()): TrialWorkerMessage {
  const { requestToken, runId, basisSignature, scenario, manifest } = requestOf(worker)
  return { type: 'trial-done', requestToken, runId, basisSignature, result: runTrial(scenario, manifest) }
}
function finish() { latest().send(done()) }
function edit() {
  const st = useStore.getState()
  st.patchScenario({ seed: (st.scenario.seed ?? 0) + 1 })
}

describe('sampled trial preparation and playback lifecycle', () => {
  beforeEach(() => {
    ControlledWorker.install()
    useStore.getState().replaceScenario(scenario())
  })
  afterEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    vi.unstubAllGlobals()
  })

  it('ordinary Play prepares one sampled trial before starting, even on rapid double Play', () => {
    toggleAnalysisRun()
    const token = useStore.getState().trial.requestToken
    toggleAnalysisRun()
    expect(useStore.getState().playback.playing).toBe(false)
    expect(useStore.getState().trial.status).toBe('preparing')
    expect(useStore.getState().trial.requestToken).toBe(token)
    expect(ControlledWorker.instances).toHaveLength(1)
    finish()
    expect(useStore.getState().playback.playing).toBe(true)
    expect(useStore.getState().trial.status).toBe('ready')
  })

  it.each(['startRun', 'setPlaying'] as const)('%s cannot start observation without the sampled result', action => {
    const st = useStore.getState()
    st.advanceRun(10)
    st.completeRun(500)
    expect(useStore.getState().playback).toBe(st.playback)
    if (action === 'startRun') st.startRun()
    else st.setPlaying(true)
    expect(useStore.getState().trial.status).toBe('preparing')
    expect(useStore.getState().playback.startedAtMs).toBeNull()
    finish()
    expect(useStore.getState().playback.playing).toBe(true)
  })

  it.each(['runId', 'basisSignature', 'result'] as const)('clock guards reject a ready preparation with mismatched %s', field => {
    useStore.getState().prepareTrial()
    finish()
    const st = useStore.getState()
    useStore.setState({ trial: field === 'result' ? { ...st.trial, result: null } :
      { ...st.trial, manifest: { ...st.trial.manifest!, [field]: 'wrong' } } })
    const before = useStore.getState().playback
    st.advanceRun(10)
    st.completeRun(500)
    expect(useStore.getState().playback).toBe(before)
  })

  it('preparation captures a detached scenario and frozen manifest without starting the clock', () => {
    const original = useStore.getState().scenario
    useStore.getState().prepareTrial()
    const { trial, playback } = useStore.getState()
    expect(trial.status).toBe('preparing')
    expect(trial.scenario).toEqual(original)
    expect(trial.scenario).not.toBe(original)
    expect(Object.isFrozen(trial.manifest)).toBe(true)
    expect(trial.manifest?.basisSignature).toBe(analysisBasisSignature(original))
    expect(playback.playing).toBe(false)
    expect(playback.startedAtMs).toBeNull()
    useStore.getState().advanceRun(10)
    useStore.getState().completeRun(500)
    expect(useStore.getState().playback).toBe(playback)
    finish()
    expect(useStore.getState().trial.status).toBe('ready')
    expect(useStore.getState().playback).toBe(playback)
    expect(latest().terminated).toBe(true)
  })

  it('repeated sampled starts begin only after the matching worker result and requests once', () => {
    const st = useStore.getState()
    st.startTrialRun()
    st.startTrialRun()
    st.startRun()
    expect(ControlledWorker.instances).toHaveLength(1)
    expect(useStore.getState().playback.startedAtMs).toBeNull()
    finish()
    expect(useStore.getState().playback.playing).toBe(true)
    expect(useStore.getState().playback.startedAtMs).not.toBeNull()
    expect(useStore.getState().trial.result?.manifest).toBe(useStore.getState().trial.manifest)
  })

  it.each(['pause', 'scrub', 'frame'] as const)('%s during preparation cancels automatic start without discarding the trial', (action) => {
    useStore.getState().saveFrame('Preview')
    useStore.getState().startTrialRun()
    if (action === 'pause') useStore.getState().pauseRun()
    if (action === 'scrub') useStore.getState().scrubTo(80)
    if (action === 'frame') useStore.getState().applyFrame(useStore.getState().scenario.frames[0].id)
    finish()
    expect(useStore.getState().trial.status).toBe('ready')
    expect(useStore.getState().playback.playing).toBe(false)
    expect(useStore.getState().playback.startedAtMs).toBeNull()
    expect(useStore.getState().playback.observedThroughS).toBe(0)
    useStore.getState().startTrialRun()
    expect(useStore.getState().playback.simTimeS).toBe(0)
  })

  it('retries within a run replace request token but retain draw identity and reject old sinks', () => {
    useStore.getState().prepareTrial()
    const old = latest()
    const oldMessage = done(old)
    useStore.getState().prepareTrial()
    expect(old.terminated).toBe(true)
    expect(requestOf(latest()).requestToken).not.toBe(requestOf(old).requestToken)
    expect(requestOf(latest()).manifest).toBe(requestOf(old).manifest)
    const current = useStore.getState().trial
    old.send(oldMessage)
    useStore.getState().trialMessage(oldMessage)
    old.onerror?.({ message: 'queued native error' })
    expect(useStore.getState().trial).toBe(current)
    finish()
    const ready = useStore.getState().trial
    useStore.getState().trialMessage(done())
    useStore.getState().prepareTrial()
    expect(useStore.getState().trial).toBe(ready)
    expect(ControlledWorker.instances).toHaveLength(2)
  })

  it.each(['requestToken', 'runId', 'basisSignature'] as const)('rejects a wrong %s at the store sink', (field) => {
    useStore.getState().prepareTrial()
    const current = useStore.getState().trial
    useStore.getState().trialMessage({ ...done(), [field]: 'wrong' })
    expect(useStore.getState().trial).toBe(current)
  })

  it('rejects a result with a mismatched manifest', () => {
    useStore.getState().prepareTrial()
    const message = done()
    if (message.type !== 'trial-done') throw new Error('expected result')
    message.result.manifest = { ...message.result.manifest, seed: 123456 }
    useStore.getState().trialMessage(message)
    expect(useStore.getState().trial.status).toBe('error')
    expect(useStore.getState().trial.result).toBeNull()
    expect(useStore.getState().playback.startedAtMs).toBeNull()
  })

  it.each(['reset', 'load', 'edit'] as const)('%s clears preparation and rejects every late result or error', (action) => {
    useStore.getState().startTrialRun()
    const worker = latest()
    const message = done()
    const runId = useStore.getState().playback.runId
    if (action === 'reset') resetAnalysisRun()
    if (action === 'load') useStore.getState().loadScenario(scenario())
    if (action === 'edit') edit()
    const { trial, playback } = useStore.getState()
    expect(worker.terminated).toBe(true)
    expect(trial).toBe(IDLE_TRIAL)
    expect(playback.runId).not.toBe(runId)
    worker.send(message)
    worker.onerror?.({ message: 'late native failure' })
    useStore.getState().trialMessage(message)
    expect(useStore.getState().trial).toBe(trial)
    expect(useStore.getState().playback).toBe(playback)
  })

  it.each(['preparing', 'ready'] as const)('material edits, undo and redo invalidate %s trials', (status) => {
    const prepare = () => {
      useStore.getState().prepareTrial()
      if (status === 'ready') finish()
    }
    prepare()
    edit()
    expect(useStore.getState().trial).toBe(IDLE_TRIAL)
    prepare()
    useStore.getState().undo()
    expect(useStore.getState().trial).toBe(IDLE_TRIAL)
    prepare()
    useStore.getState().redo()
    expect(useStore.getState().trial).toBe(IDLE_TRIAL)
  })

  it('presentation edits, undo/redo, speed and phase changes preserve pending and ready identity', () => {
    useStore.getState().prepareTrial()
    const pending = useStore.getState().trial
    useStore.getState().patchScenario({ name: 'Presentation only' })
    useStore.getState().undo()
    useStore.getState().redo()
    useStore.getState().setSpeedMult(5)
    useStore.getState().setBoardPhase('analyze')
    expect(useStore.getState().trial).toBe(pending)
    finish()
    const ready = useStore.getState().trial
    useStore.getState().patchScenario({ name: 'Another title' })
    useStore.getState().setBoardPhase('execute')
    useStore.getState().scrubTo(20)
    expect(useStore.getState().trial).toBe(ready)
    expect(ready.scenario?.name).not.toBe('Another title')
  })

  it('cancellation blocks late delivery and retry preserves the manifest', () => {
    useStore.getState().startTrialRun()
    const message = done()
    const manifest = useStore.getState().trial.manifest
    useStore.getState().cancelTrialPreparation()
    expect(latest().terminated).toBe(true)
    useStore.getState().trialMessage(message)
    expect(useStore.getState().trial.status).toBe('cancelled')
    expect(useStore.getState().playback.playing).toBe(false)
    useStore.getState().startRun()
    expect(useStore.getState().trial.manifest).toBe(manifest)
    finish()
    expect(useStore.getState().playback.playing).toBe(true)
  })

  it('worker failure is terminal, never falls back, and can retry the captured draw', () => {
    useStore.getState().startTrialRun()
    const worker = latest()
    const message = done()
    worker.onerror?.({ message: 'failed to prepare' })
    expect(useStore.getState().trial.status).toBe('error')
    useStore.getState().trialMessage(message)
    useStore.getState().advanceRun(80)
    expect(useStore.getState().playback.observedThroughS).toBe(0)
    expect(useStore.getState().playback.startedAtMs).toBeNull()
    useStore.getState().startTrialRun()
    expect(requestOf(latest()).manifest).toBe(requestOf(worker).manifest)
    expect(requestOf(latest()).scenario).toBe(requestOf(worker).scenario)
    expect(requestOf(latest()).requestToken).not.toBe(requestOf(worker).requestToken)
    finish()
    expect(useStore.getState().playback.playing).toBe(true)
  })

  it('retains an adapter validation error with a stopped clock and retries the same draw', () => {
    toggleAnalysisRun()
    const worker = latest()
    const message = done()
    if (message.type !== 'trial-done') throw new Error('expected result')
    message.result.assessments = []
    worker.send(message)
    expect(useStore.getState().trial).toMatchObject({ status: 'error', error: 'Invalid trial result', startWhenReady: false })
    useStore.getState().advanceRun(10)
    useStore.getState().completeRun(500)
    expect(useStore.getState().playback).toMatchObject({ playing: false, startedAtMs: null, completedAtMs: null, observedThroughS: 0 })
    toggleAnalysisRun()
    expect(requestOf(latest()).manifest).toBe(requestOf(worker).manifest)
    finish()
    expect(useStore.getState().playback.playing).toBe(true)
  })

  it('synchronous construction failure and missing Worker leave an actionable error', () => {
    ControlledWorker.constructionError = 'constructor failed'
    useStore.getState().startTrialRun()
    expect(useStore.getState().trial).toMatchObject({ status: 'error', error: 'constructor failed' })
    vi.stubGlobal('Worker', undefined)
    useStore.getState().startTrialRun()
    expect(useStore.getState().trial).toMatchObject({ status: 'error', error: 'Web Worker unavailable' })
    expect(useStore.getState().playback.playing).toBe(false)
  })

  it('Replay retains identity, ledger, completion and achieved observation across pause and speed changes', () => {
    useStore.getState().startTrialRun()
    finish()
    useStore.getState().advanceRun(30)
    useStore.getState().completeRun(500)
    const before = useStore.getState()
    const ledger = JSON.stringify(before.trial.result)
    toggleAnalysisRun()
    let current = useStore.getState()
    expect(current.playback).toMatchObject({
      runId: before.playback.runId, simTimeS: 0, observedThroughS: 500,
      completedAtMs: before.playback.completedAtMs, playing: true,
    })
    current.advanceRun(10)
    current.pauseRun()
    current.setSpeedMult(5)
    current.setBoardPhase('analyze')
    expect(JSON.stringify(useStore.getState().trial.result)).toBe(ledger)
    current.setBoardPhase('execute')
    toggleAnalysisRun()
    expect(useStore.getState().playback.simTimeS).toBe(10)
    useStore.getState().completeRun(500)
    current = useStore.getState()
    expect(current.playback.completedAtMs).toBe(before.playback.completedAtMs)
    expect(current.trial.result).toBe(before.trial.result)
    expect(JSON.stringify(current.trial.result)).toBe(ledger)
    expect(ControlledWorker.instances).toHaveLength(1)
    resetAnalysisRun()
    expect(useStore.getState().trial).toBe(IDLE_TRIAL)
    expect(useStore.getState().playback).toMatchObject({ observedThroughS: 0, completedAtMs: null })
    expect(useStore.getState().playback.runId).not.toBe(before.playback.runId)
    expect(ControlledWorker.instances).toHaveLength(1)
    toggleAnalysisRun()
    expect(useStore.getState().trial.manifest?.runId).not.toBe(before.trial.manifest?.runId)
    expect(useStore.getState().trial.manifest?.replicateIndex).not.toBe(before.trial.manifest?.replicateIndex)
  })

  it('repairs a legacy observation record without a retained trial', () => {
    useStore.setState(({ playback }) => ({ playback: { ...playback, startedAtMs: 1, observedThroughS: 60, simTimeS: 60 } }))
    const id = useStore.getState().playback.runId
    useStore.getState().startTrialRun()
    expect(useStore.getState().playback.runId).not.toBe(id)
    expect(useStore.getState().playback.observedThroughS).toBe(0)
    finish()
    expect(useStore.getState().playback).toMatchObject({ playing: true, simTimeS: 0 })
  })

  it('trial preparation neither changes scenario serialization nor survives reload', () => {
    const before = JSON.stringify(useStore.getState().scenario)
    useStore.getState().prepareTrial()
    finish()
    expect(JSON.stringify(useStore.getState().scenario)).toBe(before)
    const loaded = parseScenarioData(JSON.parse(before))
    useStore.getState().loadScenario(loaded)
    expect(useStore.getState().trial).toBe(IDLE_TRIAL)
    expect(useStore.getState().playback.startedAtMs).toBeNull()
  })
})
