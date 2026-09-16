import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Scenario } from '../model/types'
import probe from '../../docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json'
import { runTrial } from './trial'
import type { TrialRequest } from './trialMessages'
import { createTrialManifest } from './trialTypes'

let context: {
  onmessage: ((event: { data: TrialRequest }) => void) | null
  postMessage: ReturnType<typeof vi.fn>
}

function request(): TrialRequest {
  const scenario = structuredClone(probe) as unknown as Scenario
  const runId = 'worker-fixed-run'
  const basisSignature = 'worker-fixed-basis'
  return {
    type: 'prepare-trial',
    requestToken: 'worker-attempt',
    scenario,
    runId,
    basisSignature,
    manifest: createTrialManifest(scenario, runId, basisSignature),
  }
}

beforeEach(async () => {
  vi.resetModules()
  context = { onmessage: null, postMessage: vi.fn() }
  vi.stubGlobal('self', context)
  await import('./trial.worker')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('posts the exact fixed-seed direct trial ledger under the request identity only once', () => {
  const req = request()
  context.onmessage!({ data: req })
  expect(context.postMessage).toHaveBeenCalledExactlyOnceWith({
    type: 'trial-done',
    requestToken: req.requestToken,
    runId: req.runId,
    basisSignature: req.basisSignature,
    result: runTrial(req.scenario, req.manifest),
  })
  context.onmessage!({ data: { ...req, requestToken: 'repeat' } })
  expect(context.postMessage).toHaveBeenCalledOnce()
})

it.each(['runId', 'basisSignature'] as const)(
  'rejects request/manifest %s mismatch with its original envelope',
  (field) => {
    const req = request()
    req.manifest = { ...req.manifest, [field]: 'wrong' }
    context.onmessage!({ data: req })
    expect(context.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'trial-error',
      requestToken: req.requestToken,
      runId: req.runId,
      basisSignature: req.basisSignature,
      message: 'Trial request does not match its manifest',
    })
  },
)

it('reports runner failures as a terminal error and cannot rerun after failure', () => {
  const req = request()
  req.manifest = { ...req.manifest, engineRevision: 'unsupported' }
  context.onmessage!({ data: req })
  expect(context.postMessage).toHaveBeenCalledExactlyOnceWith({
    type: 'trial-error',
    requestToken: req.requestToken,
    runId: req.runId,
    basisSignature: req.basisSignature,
    message: 'Incompatible trial engine or draw-policy revision',
  })
  context.onmessage!({ data: request() })
  expect(context.postMessage).toHaveBeenCalledOnce()
})
