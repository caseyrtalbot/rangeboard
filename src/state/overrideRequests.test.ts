import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Boundary, Scenario } from '../model/types'
import { emptyScenario } from '../model/seed'
import type { McMorrisRequest, McSweepRequest } from '../playback/mcRun'
import { runReplicates } from '../playback/mcRun'
import type { OptimizeRequest } from '../playback/optimizeTypes'
import { runTrial } from '../playback/trial'
import type { TrialRequest } from '../playback/trialMessages'
import { MORRIS_FIXTURE } from '../charts/__fixtures__/sobolFixture'
import { ControlledWorker } from '../playback/controlledWorker'
import { runRecordOf } from '../panels/analysis/mc'
import probe from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { analysisBasisSignature } from './analysisBasis'
import { useOverrides } from './overrides'
import { useStore } from './store'

const EFFECTOR = 'lib-coyote'
const RANGE: Boundary = {
  id: 'bnd-range',
  name: 'Range',
  type: 'range',
  closed: true,
  altBandFt: null,
  points: [
    { x: -2000, y: -2000 },
    { x: 2000, y: -2000 },
    { x: 2000, y: 2000 },
    { x: -2000, y: 2000 },
  ],
}

function scenario(): Scenario {
  return {
    ...(structuredClone(probe) as unknown as Scenario),
    runMode: 'monte-carlo',
    sensitivityDepth: 'quick',
    boundaries: [RANGE],
  }
}

/** One finished replicate of the probe, enough for a `done` message. */
const summary = runReplicates({
  ...(structuredClone(probe) as unknown as Scenario),
  runMode: 'monte-carlo',
  replicates: 1,
})

/** The Pk the latest worker request carries for the Coyote. */
function requestedPk(): unknown {
  const { scenario: sent } = ControlledWorker.latest().request as { scenario: Scenario }
  return sent.library.find((m) => m.id === EFFECTOR)!.effector!.pk
}

/**
 * Task 1: an override in `useOverrides` is the value the workers run, on
 * every path but the trial (which reads it from its manifest), while the
 * board scenario keeps the library value.
 */
describe('overrides in the analysis requests', () => {
  beforeEach(() => {
    ControlledWorker.install()
    useStore.getState().replaceScenario(scenario())
    useOverrides.getState().setOverride(EFFECTOR, 'pk', 0.02, 'calibrated')
  })
  afterEach(() => {
    useOverrides.getState().resetAll()
    useStore.getState().replaceScenario(emptyScenario())
    vi.unstubAllGlobals()
  })

  it('the replicate run, the one-at-a-time sensitivity, the sweep and the optimizer run the override', () => {
    useStore.getState().runMonteCarlo()
    expect(ControlledWorker.latest().request).toMatchObject({ type: 'run-range' })
    expect(requestedPk()).toBe(0.02)

    useStore.getState().runSensitivity()
    expect(ControlledWorker.latest().request).toMatchObject({ type: 'sensitivity' })
    expect(requestedPk()).toBe(0.02)

    useStore.getState().runSweep({ factors: [{ id: 'raidSize', values: [1, 2] }] })
    expect((ControlledWorker.latest().request as McSweepRequest).type).toBe('sweep')
    expect(requestedPk()).toBe(0.02)

    useStore.getState().runOptimize({
      objective: { response: 'leakers', direction: 'minimize' },
      movableIds: ['ent-mtnvzhmr-24'],
      evaluations: 2,
    })
    expect((ControlledWorker.latest().request as OptimizeRequest).type).toBe('optimize')
    expect(requestedPk()).toBe(0.02)

    expect(useStore.getState().scenario.library.find((m) => m.id === EFFECTOR)!.effector!.pk).toBe(
      0.85,
    )
  })

  it('the Morris screening and its Sobol stage run the override', () => {
    useStore.getState().patchScenario({ sensitivityDepth: 'full' })
    useStore.getState().runSensitivity()
    const morris = ControlledWorker.latest()
    expect((morris.request as McMorrisRequest).type).toBe('morris')
    expect(requestedPk()).toBe(0.02)

    const runId = useStore.getState().playback.runId
    morris.send({ type: 'morris-done', runId, result: MORRIS_FIXTURE })
    expect(ControlledWorker.latest().request).toMatchObject({ type: 'sobol' })
    expect(requestedPk()).toBe(0.02)
  })

  it('an override edit after the run makes it stale, drops the trial and keeps the list the run applied', () => {
    useStore.getState().runMonteCarlo()
    const runId = useStore.getState().playback.runId
    useStore.getState().mcMessage({ type: 'done', runId, summary })
    useStore.getState().prepareTrial()
    const request = ControlledWorker.latest().request as TrialRequest
    ControlledWorker.latest().send({
      type: 'trial-done',
      requestToken: request.requestToken,
      runId: request.runId,
      basisSignature: request.basisSignature,
      result: runTrial(request.scenario, request.manifest),
    })
    expect(useStore.getState().mc.status).toBe('done')
    expect(useStore.getState().trial.status).toBe('ready')
    const applied = useStore.getState().mc.overrides
    expect(applied).toMatchObject([{ modelId: EFFECTOR, field: 'pk', value: 0.02 }])

    // The same value under a new reason changes no run.
    useOverrides.getState().setOverride(EFFECTOR, 'pk', 0.02, 'restated')
    expect(useStore.getState().mc.status).toBe('done')
    expect(useStore.getState().trial.status).toBe('ready')

    useOverrides.getState().resetAll()
    const st = useStore.getState()
    expect(st.mc.status).toBe('stale')
    expect(st.mc.overrides).toBe(applied)
    expect(st.trial.status).toBe('idle')
    expect(st.playback.runId).not.toBe(runId)
    expect(st.playback.resetReason).toBe('configuration-changed')
  })

  it('the saved record and the pinned baseline carry the overrides the run applied at launch', () => {
    useStore.getState().runMonteCarlo()
    const runId = useStore.getState().playback.runId
    useStore.getState().mcMessage({ type: 'done', runId, summary })
    useStore.getState().pinBaseline()
    const applied = useStore.getState().mc.overrides
    expect(useStore.getState().baseline?.overrides).toEqual(applied)

    useOverrides.getState().resetAll()
    const { scenario: board, mc } = useStore.getState()
    const record = runRecordOf(board, mc, runId, analysisBasisSignature(board), null)
    expect(record.manifest.overrides).toEqual(applied)
    expect(record.manifest.overrides).toMatchObject([
      { modelId: EFFECTOR, field: 'pk', value: 0.02 },
    ])
    expect(record.scenario.library.find((m) => m.id === EFFECTOR)!.effector!.pk).toBe(0.85)
  })
})
