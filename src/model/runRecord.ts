/**
 * The run store record (IndexedDB under `RUNS_DB_NAME`). A record
 * carries enough to reproduce and compare a finished run: its manifest, the
 * scenario snapshot and the replicate summaries.
 */

import type { RunMode, Scenario, UncertaintyMode } from './types'
import { physicsSwitches, runSettings } from './types'
import type { FidelityTier, Override, PhysicsSwitch } from './libraryField'
import { DATA_PACKAGE_VERSION } from './libraryField'
import type { McSummary, SensitivitySummary } from '../playback/mcRun'
import {
  TRIAL_BUILD_REVISION,
  TRIAL_DRAW_POLICY_VERSION,
  TRIAL_ENGINE_REVISION,
} from '../playback/trialTypes'

/** Everything that fixed the run's inputs beyond the scenario itself. */
export interface RunManifest {
  runId: string
  basisSignature: string
  seed: number
  replicates: number
  uncertainty: UncertaintyMode
  runMode: RunMode
  drawPolicyVersion: string
  engineRevision: string
  buildRevision: string | null
  sweepStepS: number
  dataPackageVersion: number
  overrides: Override[]
  physicsSwitches: PhysicsSwitch[]
  fidelityFloor: FidelityTier
  producer: 'browser' | 'cli'
}

/**
 * One saved run. Per-threat and per-effector tables live inside `mc`
 * (`McSummary.perThreat`, `McSummary.perEffector`); they are not repeated here.
 */
export interface RunRecord {
  id: string
  /** ISO time of the save. */
  savedAt: string
  label: string
  manifest: RunManifest
  scenario: Scenario
  /** `analysisBasisSignature` of `scenario` at the save. */
  scenarioHash: string
  mc: McSummary
  sensitivity: SensitivitySummary | null
}

export type RunManifestOptions = Partial<
  Pick<
    RunManifest,
    | 'sweepStepS'
    | 'dataPackageVersion'
    | 'overrides'
    | 'physicsSwitches'
    | 'fidelityFloor'
    | 'producer'
  >
>

/** Pure builder: run settings from the scenario, engine tags from trialTypes, defaults for the rest. */
export function createRunManifest(
  scenario: Scenario,
  runId: string,
  basisSignature: string,
  opts: RunManifestOptions = {},
): RunManifest {
  const settings = runSettings(scenario)
  // A physics switch runs a model on its fallback, so the floor drops with it.
  const switches = opts.physicsSwitches ?? physicsSwitches(scenario)
  return {
    runId,
    basisSignature,
    seed: settings.seed,
    replicates: settings.replicates,
    uncertainty: settings.uncertainty,
    runMode: settings.runMode,
    drawPolicyVersion: TRIAL_DRAW_POLICY_VERSION,
    engineRevision: TRIAL_ENGINE_REVISION,
    buildRevision: TRIAL_BUILD_REVISION,
    sweepStepS: opts.sweepStepS ?? settings.sweepStepS,
    dataPackageVersion: opts.dataPackageVersion ?? DATA_PACKAGE_VERSION,
    overrides: opts.overrides ?? [],
    physicsSwitches: switches,
    fidelityFloor: opts.fidelityFloor ?? (switches.length > 0 ? 'fallback' : 'datasheet'),
    producer: opts.producer ?? 'browser',
  }
}
