import type { Scenario } from '../model/types'
import { runSettings } from '../model/types'
import { idHash } from '../geometry/prng'
import type { AttritionReport } from './attritionReport'
import type { SensorScanObservation } from './detection'
import type { ThreatAssessment } from './sim'

/** Compatibility tags, bumped when engine semantics or existing draw keys change. */
export const TRIAL_ENGINE_REVISION = 'rangeboard-trial-r4-v1'
export const TRIAL_DRAW_POLICY_VERSION = 'counter-fnv1a-fmix32-v1'
/** No build provenance is injected into local builds. Do not substitute a stale commit id. */
export const TRIAL_BUILD_REVISION: string | null = null

export interface TrialManifest {
  readonly runId: string
  readonly basisSignature: string
  readonly seed: number
  readonly replicateIndex: number
  readonly basis: 'nominal-aleatory'
  readonly drawPolicyVersion: string
  readonly engineRevision: string
  readonly buildRevision: string | null
}

export function createTrialManifest(
  scenario: Scenario,
  runId: string,
  basisSignature: string,
): TrialManifest {
  if (!runId || !basisSignature) throw new Error('Trial requires a run id and configuration basis')
  return Object.freeze({
    runId,
    basisSignature,
    seed: runSettings(scenario).seed,
    replicateIndex: idHash(runId),
    basis: 'nominal-aleatory',
    drawPolicyVersion: TRIAL_DRAW_POLICY_VERSION,
    engineRevision: TRIAL_ENGINE_REVISION,
    buildRevision: TRIAL_BUILD_REVISION,
  })
}

/** Actual continue-jam outcomes, absent from killDelta in the engagement ledger.
 * Match ledger entries by effectorId, uasId and tEffectS; those share the jam draw key.
 */
export interface TrialJamDecision {
  effectorId: string
  uasId: string
  tEffectS: number
  probability: number
  outcome: number
}

/** The lifecycle owner retains the captured scenario alongside this current-trial result. */
export interface TrialResult {
  manifest: TrialManifest
  assessments: ThreatAssessment[]
  report: AttritionReport
  /** Actual scan attempts, including misses and empty admission. Between-scan holds and
   * coast intervals remain in assessments; no extra samples or draws are synthesized.
   */
  observations: SensorScanObservation[]
  jamDecisions: TrialJamDecision[]
}
