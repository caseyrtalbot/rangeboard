import type { Scenario } from '../model/types'
import type { TrialManifest, TrialResult } from './trialTypes'

/** Identity of one preparation attempt, including retries within the same run. */
export interface TrialRequestIdentity {
  requestToken: string
  runId: string
  basisSignature: string
}

export interface TrialRequest extends TrialRequestIdentity {
  type: 'prepare-trial'
  scenario: Scenario
  manifest: TrialManifest
}

export type TrialWorkerMessage = TrialRequestIdentity &
  ({ type: 'trial-done'; result: TrialResult } | { type: 'trial-error'; message: string })
