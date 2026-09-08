import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'
import { resolvePlayback } from './playbackCommands'
import type { PlaybackContext } from './playbackCommands'
import { emptyScenario } from '../model/seed'
import { scenarioDurationS } from '../model/scenario'
import { createTrialManifest } from '../playback/trialTypes'
import { runTrial } from '../playback/trial'
import { freshPlayback, IDLE_TRIAL } from './runState'
import { analysisBasisSignature } from './analysisBasis'

function prepareReadyTrial() {
  const st = useStore.getState()
  if (st.trial.status === 'ready') return
  const scenario = structuredClone(st.scenario)
  const manifest = createTrialManifest(scenario, st.playback.runId, analysisBasisSignature(scenario))
  useStore.setState({ trial: { ...IDLE_TRIAL, status: 'ready', scenario, manifest, result: runTrial(scenario, manifest) } })
}

const command = (c: Parameters<ReturnType<typeof useStore.getState>['playbackCommand']>[0]) =>
  useStore.getState().playbackCommand(c)
const playback = () => useStore.getState().playback

describe('playback commands through the one store interface', () => {
  beforeEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    prepareReadyTrial()
  })

  it('play stamps the first start once and publishes observation', () => {
    command({ type: 'play' })
    const started = playback()
    expect(started).toMatchObject({ playing: true, phase: 'running', simTimeS: 0 })
    expect(started.startedAtMs).not.toBeNull()
    expect(started.basisSignature).toBe(useStore.getState().trial.manifest!.basisSignature)
    command({ type: 'publish', t: 4 })
    command({ type: 'publish', t: 9.5 })
    expect(playback()).toMatchObject({ simTimeS: 9.5, observedThroughS: 9.5, startedAtMs: started.startedAtMs })
  })

  it('publish past the duration completes once; later publications change nothing', () => {
    const durationS = scenarioDurationS(useStore.getState().scenario)
    command({ type: 'play' })
    command({ type: 'publish', t: durationS + 3 })
    const sealed = playback()
    expect(sealed).toMatchObject({ playing: false, phase: 'complete', simTimeS: durationS, observedThroughS: durationS })
    expect(sealed.completedAtMs).not.toBeNull()
    command({ type: 'publish', t: durationS + 6 })
    command({ type: 'publish', t: 2 })
    expect(playback()).toBe(sealed)
  })

  it('publish while stopped is not observation', () => {
    command({ type: 'publish', t: 7 })
    expect(playback()).toMatchObject({ playing: false, observedThroughS: 0, startedAtMs: null })
  })

  it('scrub and frame preview time without advancing observation', () => {
    command({ type: 'play' })
    command({ type: 'publish', t: 5 })
    command({ type: 'scrub', t: 40 })
    expect(playback()).toMatchObject({ playing: false, phase: 'review', simTimeS: 40, observedThroughS: 5 })
    useStore.getState().saveFrame('later')
    command({ type: 'scrub', t: 1 })
    const frame = useStore.getState().scenario.frames[0]
    command({ type: 'frame', frame: { ...frame, camera: { x: 12, y: -3, scale: 2 }, basemap: 'sat' } })
    expect(playback()).toMatchObject({ playing: false, phase: 'review', simTimeS: 40, observedThroughS: 5 })
    expect(useStore.getState().camera).toEqual({ x: 12, y: -3, scale: 2 })
    expect(useStore.getState().ui.basemap).toBe('sat')
    command({ type: 'play' })
    expect(playback()).toMatchObject({ phase: 'running', simTimeS: 5 })
  })

  it('pause cancels a pending automatic start and leaves an unstarted run ready', () => {
    useStore.setState({ trial: { ...IDLE_TRIAL, status: 'preparing', startWhenReady: true } })
    command({ type: 'pause' })
    expect(useStore.getState().trial).toMatchObject({ status: 'preparing', startWhenReady: false })
    expect(playback()).toMatchObject({ playing: false, phase: 'ready', startedAtMs: null })
  })

  it('toggle pauses a playing run and resumes it at the observed horizon', () => {
    command({ type: 'toggle' })
    command({ type: 'publish', t: 6 })
    command({ type: 'toggle' })
    expect(playback()).toMatchObject({ playing: false, phase: 'paused', simTimeS: 6 })
    command({ type: 'scrub', t: 30 })
    command({ type: 'toggle' })
    expect(playback()).toMatchObject({ playing: true, phase: 'running', simTimeS: 6, observedThroughS: 6 })
  })

  it('replay keeps identity, completion and observation; new run replaces them', () => {
    const durationS = scenarioDurationS(useStore.getState().scenario)
    command({ type: 'play' })
    command({ type: 'publish', t: durationS })
    const sealed = playback()
    const trial = useStore.getState().trial
    command({ type: 'play' })
    expect(playback()).toMatchObject({
      playing: true, phase: 'running', simTimeS: 0, runId: sealed.runId,
      observedThroughS: durationS, completedAtMs: sealed.completedAtMs,
    })
    expect(useStore.getState().trial).toMatchObject({ status: 'ready', manifest: trial.manifest, result: trial.result })
    command({ type: 'newRun', reason: 'manual' })
    expect(playback()).toMatchObject({ phase: 'ready', simTimeS: 0, observedThroughS: 0, startedAtMs: null, completedAtMs: null })
    expect(playback().runId).not.toBe(sealed.runId)
    expect(playback().runSeq).toBe(sealed.runSeq + 1)
    expect(useStore.getState().trial).toBe(IDLE_TRIAL)
  })

  it('an observation record without a retained trial is reset before play prepares', () => {
    useStore.setState(({ playback: p }) => ({ trial: IDLE_TRIAL, playback: { ...p, startedAtMs: 1, observedThroughS: 30, simTimeS: 30 } }))
    const before = playback().runId
    command({ type: 'play' })
    expect(playback().runId).not.toBe(before)
    expect(playback()).toMatchObject({ playing: false, observedThroughS: 0, simTimeS: 0 })
    // Preparation was requested for the new identity (no Worker here, so it errors).
    expect(useStore.getState().trial.manifest?.runId).toBe(playback().runId)
  })
})

describe('resolvePlayback is store-free', () => {
  const ctx = (): PlaybackContext => ({
    scenario: emptyScenario(),
    playback: freshPlayback(3),
    trial: IDLE_TRIAL,
    presetId: 'sensors',
    nowMs: 1000,
  })

  it('publish, advance and complete need a valid retained trial', () => {
    const c = { ...ctx(), playback: { ...freshPlayback(3), playing: true } }
    expect(resolvePlayback({ type: 'publish', t: 1 }, c)).toEqual({ kind: 'none' })
    expect(resolvePlayback({ type: 'advance', t: 1 }, c)).toEqual({ kind: 'none' })
    expect(resolvePlayback({ type: 'complete', durationS: 9 }, c)).toEqual({ kind: 'none' })
  })

  it('publish at the duration without a ready trial pauses instead of changing nothing', () => {
    const c = { ...ctx(), playback: { ...freshPlayback(3), playing: true, startedAtMs: 5 } }
    const next = resolvePlayback({ type: 'publish', t: 1e6 }, c)
    // Nothing can be sealed, so the run stops and the frame loop with it.
    expect(next).toMatchObject({ kind: 'apply', patch: { playback: { playing: false, phase: 'paused' } } })
    expect(next.kind === 'apply' && next.patch.playback)
      .toMatchObject({ completedAtMs: null, observedThroughS: 0, simTimeS: 0 })
  })

  it('play without a trial asks for preparation and waits; a pending start does not re-prepare', () => {
    const waiting = resolvePlayback({ type: 'play' }, ctx())
    expect(waiting).toMatchObject({ kind: 'apply', prepare: true, patch: { trial: { startWhenReady: true } } })
    const preparing = resolvePlayback({ type: 'play' }, { ...ctx(), trial: { ...IDLE_TRIAL, status: 'preparing' } })
    expect(preparing).toMatchObject({ kind: 'apply', prepare: false })
  })

  it('play on a started record without a trial resolves to reset', () => {
    const c = { ...ctx(), playback: { ...freshPlayback(3), startedAtMs: 5 } }
    expect(resolvePlayback({ type: 'play' }, c)).toEqual({ kind: 'reset' })
  })

  it('a manual new run writes the next sequence and stamps the lens; other reasons write nothing', () => {
    const manual = resolvePlayback({ type: 'newRun', reason: 'manual' }, ctx())
    expect(manual).toMatchObject({ kind: 'apply', writeRunSeq: 4, patch: { scenario: { observedPresetId: 'sensors' } } })
    const changed = resolvePlayback({ type: 'newRun', reason: 'configuration-changed' }, ctx())
    expect(changed).toMatchObject({ kind: 'apply', patch: { playback: { runSeq: 3, resetReason: 'configuration-changed' } } })
    expect((changed as { writeRunSeq?: number }).writeRunSeq).toBeUndefined()
  })

  it('a matching lens stamp replaces nothing', () => {
    const c = ctx()
    c.scenario.observedPresetId = 'sensors'
    const next = resolvePlayback({ type: 'newRun', reason: 'manual' }, c)
    expect(next.kind === 'apply' && next.patch.scenario).toBeUndefined()
  })
})
