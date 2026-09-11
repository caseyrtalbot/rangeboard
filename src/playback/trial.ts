import type { Scenario } from '../model/types'
import { runSettings } from '../model/types'
import { idHash } from '../geometry/prng'
import { resolveEngagements } from './attrition'
import { resolvedThresholds } from './detection'
import { prepareFalseTracks, scenarioHorizonS } from './falseTracks'
import { monteCarloPolicy } from './policy'
import { assessAllThreats } from './sim'
import type { TrackEstimate } from './trackTypes'
import type { TrialManifest, TrialResult } from './trialTypes'
import { TRIAL_DRAW_POLICY_VERSION, TRIAL_ENGINE_REVISION } from './trialTypes'

/** Nominal parameters and the existing aleatory policy; no ensemble sampling or caches.
 * Caller owns the captured scenario and accepts transport results by request/run/basis.
 */
export function runTrial(scenario: Scenario, manifest: TrialManifest): TrialResult {
  if (
    manifest.basis !== 'nominal-aleatory' ||
    manifest.drawPolicyVersion !== TRIAL_DRAW_POLICY_VERSION ||
    manifest.engineRevision !== TRIAL_ENGINE_REVISION
  ) throw new Error('Incompatible trial engine or draw-policy revision')
  const settings = runSettings(scenario)
  if (
    !manifest.runId || !manifest.basisSignature ||
    manifest.seed !== settings.seed ||
    manifest.sweepStepS !== settings.sweepStepS ||
    manifest.replicateIndex !== idHash(manifest.runId) ||
    !(manifest.buildRevision === null || typeof manifest.buildRevision === 'string')
  ) throw new Error('Invalid trial manifest identity or seed')

  const observations: TrialResult['observations'] = []
  const jamDecisions: TrialResult['jamDecisions'] = []
  const tracks: TrackEstimate[] = []
  const policy = monteCarloPolicy(manifest.seed, manifest.replicateIndex, resolvedThresholds(scenario))
  const draw = {
    ...policy,
    jam(probability: number, effectorId: string, uasId: string, tEffectS: number) {
      const outcome = policy.jam(probability, effectorId, uasId, tEffectS)
      jamDecisions.push({ probability, effectorId, uasId, tEffectS, outcome })
      return outcome
    },
  }
  const assessments = assessAllThreats(
    scenario, draw, (observation) => observations.push(observation), (estimate) => tracks.push(estimate),
  )
  // False tracks (kind-9 draws only) join the trial's track history; the
  // operator queue in resolveEngagements reads the same load.
  const falseLoad = prepareFalseTracks(
    scenario, draw, scenarioHorizonS(scenario), (estimate) => tracks.push(estimate),
  )
  const report = resolveEngagements(scenario, assessments, draw, falseLoad)
  return { manifest: Object.freeze({ ...manifest }), assessments, report, observations, jamDecisions, tracks }
}
