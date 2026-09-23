import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MORRIS_FIXTURE, SOBOL_FIXTURE } from '../charts/__fixtures__/sobolFixture'
import { emptyScenario } from '../model/seed'
import type { Scenario } from '../model/types'
import { runSettings } from '../model/types'
import { ControlledWorker } from '../playback/controlledWorker'
import { DEFAULT_BUDGET } from '../playback/mcRun'
import { sobolEvaluationCount } from '../playback/sobol'
import probe from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { sobolBudgetWarning } from './analysisRequests'
import { useStore } from './store'

function scenario(): Scenario {
  return {
    ...(structuredClone(probe) as unknown as Scenario),
    runMode: 'monte-carlo',
    replicates: 1,
    sensitivityDepth: 'quick',
  }
}

describe('the Morris then Sobol sensitivity stages', () => {
  beforeEach(() => {
    ControlledWorker.install()
    useStore.getState().replaceScenario(scenario())
  })

  afterEach(() => {
    useStore.getState().replaceScenario(emptyScenario())
    vi.unstubAllGlobals()
  })

  function launchFull(response?: 'kills') {
    useStore.getState().patchScenario({ sensitivityDepth: 'full' })
    useStore.getState().runSensitivity(response)
    const morris = ControlledWorker.latest()
    const runId = useStore.getState().playback.runId
    return { morris, runId }
  }

  it('drives Morris then Sobol on the kept fields and ends with the Sobol result', () => {
    const { morris, runId } = launchFull('kills')
    expect(morris.request).toMatchObject({ type: 'morris', runId, response: 'kills' })
    expect(useStore.getState().mc.sensitivity).toMatchObject({
      status: 'running',
      runId,
      progress: 0,
      total: 0,
    })
    morris.send({ type: 'morris-progress', runId, done: 7, total: 70 })
    expect(useStore.getState().mc.sensitivity).toMatchObject({ progress: 7, total: 70 })
    morris.send({ type: 'morris-done', runId, result: MORRIS_FIXTURE })
    expect(morris.terminated).toBe(true)
    const sobol = ControlledWorker.latest()
    expect(sobol).not.toBe(morris)
    expect(sobol.request).toMatchObject({
      type: 'sobol',
      runId,
      response: 'leakers',
      kept: MORRIS_FIXTURE.kept.map((i) => MORRIS_FIXTURE.fields[i].field),
    })
    const mid = useStore.getState().mc
    expect(mid.morris).toBe(MORRIS_FIXTURE)
    expect(mid.sensitivity).toMatchObject({
      status: 'running',
      runId,
      progress: 0,
      total: sobolEvaluationCount(
        runSettings(useStore.getState().scenario).sobolBase,
        MORRIS_FIXTURE.kept.length,
      ),
      summary: null,
    })
    sobol.send({ type: 'sobol-progress', runId, done: 3, total: 1536 })
    expect(useStore.getState().mc.sensitivity).toMatchObject({ progress: 3, total: 1536 })
    sobol.send({ type: 'sobol-done', runId, result: SOBOL_FIXTURE })
    const { mc } = useStore.getState()
    expect(mc.sobol).toBe(SOBOL_FIXTURE)
    expect(mc.sensitivity).toMatchObject({
      status: 'done',
      progress: 1536,
      total: 1536,
      summary: null,
      error: null,
    })
    expect(sobol.terminated).toBe(true)
    // A replicate run keeps both results; the next sensitivity launch clears them.
    useStore.getState().runMonteCarlo()
    expect(useStore.getState().mc.morris).toBe(MORRIS_FIXTURE)
    expect(useStore.getState().mc.sobol).toBe(SOBOL_FIXTURE)
    useStore.getState().runSensitivity()
    expect(useStore.getState().mc.morris).toBeNull()
    expect(useStore.getState().mc.sobol).toBeNull()
  })

  it('publishes the canonical Sobol count before the worker reports a row', () => {
    useStore.getState().patchScenario({ sobolBase: 32 })
    const { morris, runId } = launchFull()
    morris.send({ type: 'morris-done', runId, result: MORRIS_FIXTURE })
    expect(useStore.getState().mc.sensitivity).toMatchObject({
      status: 'running',
      progress: 0,
      total: sobolEvaluationCount(32, MORRIS_FIXTURE.kept.length),
    })
  })

  it('warns when the measured rate would use at least half the worker time budget', () => {
    const budget = DEFAULT_BUDGET.timeMs
    // The measured board: 29 entities, 2560 rows, 499 s of the 600 s budget.
    expect(sobolBudgetWarning(29, 2560, budget)).toBe(true)
    // 18 entities at that row count is still over half; 17 is just under.
    expect(sobolBudgetWarning(18, 2560, budget)).toBe(true)
    expect(sobolBudgetWarning(17, 2560, budget)).toBe(false)
    // 29 entities at 1536 rows is 299.4 s.
    expect(sobolBudgetWarning(29, 1536, budget)).toBe(false)
    // The firing board is 6 entities.
    expect(sobolBudgetWarning(6, 1536, budget)).toBe(false)
    expect(sobolBudgetWarning(0, 2560, budget)).toBe(false)
  })

  it('ends without Sobol when screening keeps nothing', () => {
    const { morris, runId } = launchFull()
    const count = ControlledWorker.instances.length
    morris.send({ type: 'morris-done', runId, result: { ...MORRIS_FIXTURE, kept: [] } })
    expect(ControlledWorker.instances).toHaveLength(count)
    const { mc } = useStore.getState()
    expect(mc.morris?.kept).toEqual([])
    expect(mc.sobol).toBeNull()
    expect(mc.sensitivity).toMatchObject({ status: 'done', error: null, summary: null })
  })

  it('marks Morris and Sobol errors and ignores another run', () => {
    const { morris, runId } = launchFull()
    morris.send({ type: 'morris-done', runId: 'other', result: MORRIS_FIXTURE })
    expect(useStore.getState().mc.morris).toBeNull()
    morris.send({ type: 'morris-error', runId, message: 'stopped early' })
    expect(useStore.getState().mc.sensitivity).toMatchObject({
      status: 'error',
      error: 'stopped early',
    })
    const next = launchFull()
    next.morris.send({ type: 'morris-done', runId: next.runId, result: MORRIS_FIXTURE })
    const budget = 'Sobol stopped at the worker time budget after 5 of 24 rows'
    ControlledWorker.latest().send({ type: 'sobol-error', runId: next.runId, message: budget })
    expect(useStore.getState().mc.sensitivity).toMatchObject({ status: 'error', error: budget })
    expect(useStore.getState().mc.morris).toBe(MORRIS_FIXTURE)
  })

  it('ends a cancelled Sobol run on the Morris result', () => {
    const { morris, runId } = launchFull()
    morris.send({ type: 'morris-done', runId, result: MORRIS_FIXTURE })
    const sobol = ControlledWorker.latest()
    sobol.send({ type: 'sobol-progress', runId, done: 42, total: 2560 })
    sobol.send({ type: 'sobol-done', runId, result: null })
    const { mc } = useStore.getState()
    expect(mc.sensitivity).toMatchObject({
      status: 'done',
      runId,
      progress: 0,
      total: 0,
      summary: null,
      error: null,
    })
    expect(mc.morris).toBe(MORRIS_FIXTURE)
    expect(mc.sobol).toBeNull()
  })

  it('ends a cancelled Morris screening without starting Sobol', () => {
    const { morris, runId } = launchFull()
    morris.send({ type: 'morris-progress', runId, done: 7, total: 70 })
    useStore.getState().cancelSensitivityRun()
    const count = ControlledWorker.instances.length
    morris.send({ type: 'morris-done', runId, result: MORRIS_FIXTURE, stopped: 'cancelled' })
    expect(ControlledWorker.instances).toHaveLength(count)
    const { mc } = useStore.getState()
    expect(mc.sensitivity).toMatchObject({
      status: 'done',
      runId,
      progress: 0,
      total: 0,
      summary: null,
      error: null,
    })
    expect(mc.morris).toBe(MORRIS_FIXTURE)
    expect(mc.sobol).toBeNull()
  })

  it('keeps quick depth on the one-at-a-time path', () => {
    useStore.getState().runSensitivity()
    expect(ControlledWorker.latest().request).toMatchObject({ type: 'sensitivity' })
  })
})
