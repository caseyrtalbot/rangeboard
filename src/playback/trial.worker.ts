/// <reference lib="webworker" />
import { runTrial } from './trial'
import type { TrialRequest, TrialWorkerMessage } from './trialMessages'

/** One preparation per worker. Cancellation terminates this worker immediately. */
let started = false

self.onmessage = (event: MessageEvent<TrialRequest>) => {
  const request = event.data
  if (started || request?.type !== 'prepare-trial') return
  started = true
  const { requestToken, runId, basisSignature, scenario, manifest } = request
  const identity = { requestToken, runId, basisSignature }
  let message: TrialWorkerMessage
  try {
    if (manifest.runId !== runId || manifest.basisSignature !== basisSignature) {
      throw new Error('Trial request does not match its manifest')
    }
    message = { type: 'trial-done', ...identity, result: runTrial(scenario, manifest) }
  } catch (error) {
    message = {
      type: 'trial-error', ...identity,
      message: error instanceof Error ? error.message : String(error),
    }
  }
  self.postMessage(message)
}
