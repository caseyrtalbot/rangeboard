import { describe, expect, it } from 'vitest'
import { mixedTrial } from '../playback/__fixtures__/trialFixture'
import { IDLE_TRIAL, freshPlayback } from './runState'
import { selectTrialHorizon, selectTrialSelection } from './trialSelectors'

function ready() {
  const { scenario, manifest, result } = mixedTrial()
  return { scenario, playback: { ...freshPlayback(1), runId: manifest.runId, startedAtMs: 1, observedThroughS: 4.49 },
    trial: { ...IDLE_TRIAL, status: 'ready' as const, scenario: structuredClone(scenario), manifest, result } }
}

describe('trial selection and raw horizons', () => {
  it('selects matching captured results, caches selection and preserves presentation edits', () => {
    const state = ready()
    const selected = selectTrialSelection(state)
    expect(selected.status).toBe('ready')
    expect(selectTrialSelection({ ...state, playback: { ...state.playback, simTimeS: 3 } })).toBe(selected)
    expect(selectTrialSelection({ ...state, scenario: { ...state.scenario, name: 'Presentation' } }).status).toBe('ready')
    if (selected.status === 'ready') expect(selected.scenario).toBe(state.trial.scenario)
  })

  it('rejects material edits including MC settings, stale runs and mismatched results', () => {
    const state = ready()
    for (const scenario of [{ ...state.scenario, seed: 98765 }, { ...state.scenario, replicates: 333 },
      { ...state.scenario, roe: 'hold' as const }]) expect(selectTrialSelection({ ...state, scenario }).status).toBe('idle')
    expect(selectTrialSelection({ ...state, playback: { ...state.playback, runId: 'other' } }).status).toBe('idle')
    expect(selectTrialSelection({ ...state, trial: { ...state.trial, result: { ...state.trial.result,
      manifest: { ...state.trial.manifest, runId: 'other' } } } }).status).toBe('idle')
    expect(selectTrialSelection({ ...state, trial: { ...state.trial, result: { ...state.trial.result, assessments: [] } } }).status).toBe('idle')
    expect(selectTrialSelection({ ...state, trial: { ...state.trial, scenario: { ...state.scenario, seed: 1 } } }).status).toBe('idle')
  })

  it('exposes preparing, error, cancellation and idle without a forecast fallback', () => {
    const state = ready()
    expect(selectTrialSelection({ ...state, trial: IDLE_TRIAL })).toEqual({ status: 'idle', runId: state.playback.runId })
    expect(selectTrialSelection({ ...state, trial: { ...state.trial, status: 'preparing', result: null } }).status).toBe('preparing')
    expect(selectTrialSelection({ ...state, trial: { ...state.trial, status: 'error', result: null, error: 'Worker failed' } }))
      .toEqual({ status: 'error', runId: state.playback.runId, message: 'Worker failed' })
    expect(selectTrialSelection({ ...state, trial: { ...state.trial, status: 'cancelled', result: null } }).status).toBe('cancelled')
    expect(selectTrialSelection({ ...state, trial: { ...state.trial, status: 'idle', result: null } }).status).toBe('idle')
  })

  it('never rounds or promotes observation through Analyze, Replay or forward preview', () => {
    const state = ready()
    expect(selectTrialHorizon(state, 30)).toBe(4.49)
    expect(selectTrialHorizon(state, 1.99)).toBe(1.99)
    expect(selectTrialHorizon({ ...state, playback: { ...state.playback, startedAtMs: null } }, 30)).toBe(0)
    expect(selectTrialHorizon({ ...state, trial: IDLE_TRIAL }, 30)).toBe(0)
    expect(selectTrialHorizon({ ...state, playback: { ...state.playback, completedAtMs: 999, observedThroughS: 60 } }, 1.99)).toBe(1.99)
    const analyze = { ...state, ui: { boardPhase: 'analyze' } }
    expect(selectTrialHorizon(analyze, 60)).toBe(4.49)
  })
})
