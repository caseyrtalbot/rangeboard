import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './store'
import { useOverrides } from './overrides'
import { emptyScenario } from '../model/seed'
import { selectTrialSelection } from './trialSelectors'
import { runTrial } from '../playback/trial'
import type { TrialRequest, TrialWorkerMessage } from '../playback/trialMessages'
import { toggleAnalysisRun } from '../playback/runSession'
import { parseScenarioData } from '../io/persist'
import { ControlledWorker } from '../playback/controlledWorker'
import firing from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'

/**
 * Phase 0 integration: the trial manifest names the overrides in force at
 * launch, and the record-only manifest keys never decide whether a ready trial
 * still belongs to its run.
 */
describe('trial manifest overrides', () => {
  beforeEach(() => {
    ControlledWorker.install()
    useStore.getState().replaceScenario(parseScenarioData(structuredClone(firing)))
    useOverrides.getState().resetAll()
  })
  afterEach(() => {
    useOverrides.getState().resetAll()
    useStore.getState().replaceScenario(emptyScenario())
    vi.unstubAllGlobals()
  })

  it('lists an active override in the launched manifest and the trial stays selectable', () => {
    useOverrides.getState().setOverride('lib-kurfs', 'detectRangeM', 3200, 'site survey')
    useOverrides.getState().setOverride('lib-not-in-scenario', 'pk', 0.5, 'ignored')
    toggleAnalysisRun()
    const worker = ControlledWorker.latest()
    const request = worker.request as TrialRequest
    expect(request.manifest.overrides).toMatchObject([{ modelId: 'lib-kurfs', field: 'detectRangeM', value: 3200, reason: 'site survey' }])
    expect(useStore.getState().trial.manifest?.overrides).toHaveLength(1)
    const { requestToken, runId, basisSignature, scenario, manifest } = request
    const done: TrialWorkerMessage = { type: 'trial-done', requestToken, runId, basisSignature, result: runTrial(scenario, manifest) }
    worker.send(done)
    expect(useStore.getState().trial.status).toBe('ready')
    const selection = selectTrialSelection(useStore.getState())
    expect(selection.status).toBe('ready')
    if (selection.status === 'ready') expect(selection.result.manifest.overrides).toHaveLength(1)
    // The same value under a new reason rewrites no record and keeps the trial.
    useOverrides.getState().setOverride('lib-kurfs', 'detectRangeM', 3200, 'survey restated')
    expect(useStore.getState().trial.status).toBe('ready')
    expect(useStore.getState().trial.manifest?.overrides[0].reason).toBe('site survey')
    // A reset changes the values in force, so the trial that ran on the override is dropped.
    useOverrides.getState().resetAll()
    expect(useStore.getState().trial.status).toBe('idle')
    expect(selectTrialSelection(useStore.getState()).status).toBe('idle')
  })
})
