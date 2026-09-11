/**
 * The engine barrel: everything a headless Node runner needs to go from a
 * scenario JSON to a `RunRecord`, with no UI, no store and no DOM. The
 * `no-restricted-imports` override in `.oxlintrc.json` keeps this tree and
 * the playback, analysis and geometry trees free of react, konva, `window`
 * and `document`. Lane 1.1 builds the Node bundle from here.
 */

// Run settings: the contract every runner reads, with the fresh-scenario defaults.
export type {
  C2Spec,
  McSettings,
  RunMode,
  SamplingMode,
  Scenario,
  SensitivityDepth,
  SpecModel,
  UncertaintyMode,
} from '../model/types'
export {
  DEFAULT_CONFIDENCE,
  DEFAULT_REPLICATES,
  DEFAULT_REQUIREMENT_THRESHOLDS,
  DEFAULT_SAMPLING,
  DEFAULT_SEED,
  DEFAULT_SENSITIVITY_DEPTH,
  DEFAULT_SOBOL_BASE,
  DEFAULT_STOP_CAP,
  DEFAULT_STOP_FLOOR,
  DEFAULT_TARGET_HALF_WIDTH,
  physicsSwitches,
  runSettings,
} from '../model/types'

// The replicate loop, its companions, their summaries and the worker protocol.
export type {
  BandSeries,
  Checkpoint,
  ExecutionBudget,
  IntervalMethod,
  Loop,
  McRequest,
  McSensitivityMessage,
  McSensitivityRequest,
  McSummary,
  McSweepMessage,
  McMorrisMessage,
  McMorrisRequest,
  McPartial,
  McSobolMessage,
  McSobolRequest,
  McSweepRequest,
  McWorkerMessage,
  SensitivityResponse,
  SensitivityResponseStat,
  SensitivitySummary,
  Stat,
  StopRule,
  SweepCell,
  SweepSummary,
} from '../playback/mcRun'
export {
  assertSummaryFits,
  DEFAULT_BUDGET,
  emptyPartial,
  endOfRunResponses,
  finishSummary,
  halfWidthReached,
  overBudget,
  replicateLoop,
  replicateRangeLoop,
  runReplicates,
  runSensitivity,
  runSweep,
  SENSITIVITY_RESPONSES,
  sensitivityLoop,
  STAT_CONF,
  summaryNumbers,
  sweepCellScenario,
  sweepLoop,
  SWEEP_REPLICATES_DEFAULT,
} from '../playback/mcRun'
export type { SweepFactor } from '../playback/sweepFactors'
export { contiguousPrefix, mergePartials } from '../playback/mergeSummaries'
export { lhsPermutation, loopEnd, paramDraws } from '../playback/sampling'
export type { MorrisDesign, MorrisEffects } from '../playback/morris'
export {
  fieldGroup,
  keptFields,
  MORRIS_KEPT,
  MORRIS_LEVELS,
  MORRIS_TRAJECTORIES,
  morrisDesign,
  morrisEffects,
  morrisIndices,
  morrisLoop,
  morrisRanking,
  QUANTILE_MARGIN,
  rowScenario,
  studyBase,
} from '../playback/morris'
export type { SobolIndices } from '../playback/sobol'
export {
  SOBOL_BOOTSTRAP,
  sobolDesign,
  sobolFromResponses,
  sobolIndices,
  sobolLoop,
} from '../playback/sobol'

// Phase 1 result and progress types.
export type {
  BootstrapInterval,
  MorrisFieldResult,
  MorrisResult,
  PoolProgress,
  SobolFieldResult,
  SobolResult,
} from '../playback/mcTypes'

// The run record and its manifest.
export type { RunManifest, RunManifestOptions, RunRecord } from '../model/runRecord'
export { createRunManifest } from '../model/runRecord'

// The sampled trial: types, manifest helpers and the trial itself.
export type {
  TrialJamDecision,
  TrialManifest,
  TrialManifestExtras,
  TrialResult,
} from '../playback/trialTypes'
export {
  createTrialManifest,
  sameManifest,
  TRIAL_BUILD_REVISION,
  TRIAL_DRAW_POLICY_VERSION,
  TRIAL_ENGINE_REVISION,
} from '../playback/trialTypes'
export type { TrialRequest, TrialRequestIdentity, TrialWorkerMessage } from '../playback/trialMessages'
export { runTrial } from '../playback/trial'

// Phase 2 track contract: estimates, fused tracks, the classification matrix and the measurement.
export type {
  ClassificationBand,
  ClassificationMatrix,
  Covariance4,
  FusedTrack,
  TrackEstimate,
  TrackEstimateSink,
  TrackMeasurement,
  TrackSource,
  TrackState,
} from '../playback/trackTypes'
export {
  INIT_SPEED_SIGMA_MPS,
  initFromMeasurement,
  positionSigmaM,
  predict,
  PROCESS_NOISE_Q,
  quality,
  QUALITY_SCALE_M,
  update,
  ZERO_COVARIANCE,
} from '../playback/kalman'
export type { TrackHold, TrackManager } from '../playback/tracker'
export { createTrackManager, polarMeasurement, trackId, truthPathFor } from '../playback/tracker'
export type { FalseTrackLoad } from '../playback/falseTracks'
export {
  FALSE_TRACK_CELLS,
  FALSE_TRACK_SPEED_MPS,
  falseTrackRatePerScan,
  poissonInverse,
  prepareFalseTracks,
  scenarioHorizonS,
} from '../playback/falseTracks'
export type { OperatorQueue } from '../playback/operator'
export { createOperatorQueue, decisionLatencyS, firstC2Of, overloadFactor } from '../playback/operator'
export type { KillChainRoute } from '../playback/killChain'

// Library, priors and the parameter basis the loop samples from.
export type { FidelityTier, LibraryField, Override, PhysicsSwitch } from '../model/libraryField'
export { DATA_PACKAGE_VERSION } from '../model/libraryField'
export { SEED_LIBRARY } from '../model/seedLibrary'
export { initialLibrary, initialSystemPresets } from '../model/libraryLifecycle'
export type { ClassPrior, ClassPriorTable, FieldPrior } from '../analysis/classPriors'
export { CLASS_PRIORS, classOfModel, classPriorFor } from '../analysis/classPriors'
export type { PfSpreadRow, SpreadBasis, UncertainField } from '../analysis/parameterBasis'
export { PF_SPREAD, spreadBasisFor, spreadFor, uncertainFields } from '../analysis/parameterBasis'
export type { ParamSampler } from '../analysis/uncertainty'
export { sampleScenario, sampleSpread } from '../analysis/uncertainty'

// The analysis basis signature a manifest and a run record carry.
export { analysisBasisSignature } from '../state/analysisBasis'

// The headless load boundary (lane 1.1): the Board's fill without the store.
export { loadScenario, parseScenarioJson } from './loadScenario'
