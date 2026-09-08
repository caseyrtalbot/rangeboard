import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scenario } from '../model/types'
import { emptyScenario } from '../model/seed'
import type { McSweepRequest } from '../playback/mcRun'
import { runSweep } from '../playback/mcRun'
import { ControlledWorker } from '../playback/controlledWorker'
import probe from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { SWEEP_DEFAULTS } from './analysisRequests'
import { analysisBasisSignature } from './analysisBasis'
import { useStore } from './store'

function scenario(): Scenario {
  return { ...structuredClone(probe) as unknown as Scenario, runMode: 'monte-carlo' }
}
const factors: McSweepRequest['factors'] = [
  { id: 'threatAltitudeFt', values: [300, 3000] },
  { id: 'raidSize', values: [1, 2] },
]

describe('factor sweep from the store', () => {
  beforeEach(() => {
    ControlledWorker.install()
    useStore.getState().replaceScenario(scenario())
  })
  afterEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    vi.unstubAllGlobals()
  })

  it('runSweep publishes the pending cells, posts the request with defaults and completes', () => {
    useStore.getState().runSweep({ factors })
    const worker = ControlledWorker.latest()
    const { playback, scenario: current } = useStore.getState()
    expect(useStore.getState().mc.sweep).toMatchObject({
      status: 'running', runId: playback.runId, progress: 0, total: 4, summary: null,
      basisSignature: analysisBasisSignature(current), error: null,
    })
    const request = worker.request as McSweepRequest
    expect(request).toMatchObject({ type: 'sweep', runId: playback.runId, factors, ...SWEEP_DEFAULTS })
    expect(request.replicatesPerCell).toBe(40)
    worker.send({ type: 'sweep-progress', runId: playback.runId, done: 2, total: 4 })
    expect(useStore.getState().mc.sweep.progress).toBe(2)
    const summary = runSweep({ scenario: request.scenario, factors, replicatesPerCell: 2, responses: ['leakers'] })
    worker.send({ type: 'sweep-done', runId: playback.runId, summary })
    const { sweep } = useStore.getState().mc
    expect(sweep).toMatchObject({ status: 'done', progress: 4, total: 4, error: null })
    expect(sweep.summary).toBe(summary)
    expect(worker.terminated).toBe(true)
    // A stale-run message changes nothing once the sweep is done.
    worker.send({ type: 'sweep-error', runId: playback.runId, message: 'late' })
    expect(useStore.getState().mc.sweep).toBe(sweep)
  })

  it('a sweep and a sensitivity run share one slot and replace each other', () => {
    useStore.getState().runSensitivity()
    const sens = ControlledWorker.latest()
    useStore.getState().runSweep({ factors, replicatesPerCell: 8, responses: ['kills'] })
    expect(sens.terminated).toBe(true)
    expect(useStore.getState().mc.sensitivity.status).toBe('idle')
    expect(useStore.getState().mc.sweep.status).toBe('running')
    expect((ControlledWorker.latest().request as McSweepRequest).replicatesPerCell).toBe(8)
    useStore.getState().runSensitivity()
    expect(useStore.getState().mc.sweep.status).toBe('idle')
    expect(useStore.getState().mc.sensitivity.status).toBe('running')
  })

  it('cancelSweep asks the worker to stop; a reset or a deterministic mode ends or skips it', () => {
    useStore.getState().runSweep({ factors })
    const worker = ControlledWorker.latest()
    const runId = useStore.getState().playback.runId
    useStore.getState().cancelSweep()
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'cancel', runId })
    useStore.getState().resetRun('manual')
    expect(worker.terminated).toBe(true)
    useStore.getState().patchScenario({ runMode: 'deterministic' })
    const count = ControlledWorker.instances.length
    useStore.getState().runSweep({ factors })
    expect(ControlledWorker.instances).toHaveLength(count)
  })
})
