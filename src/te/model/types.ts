/**
 * T&E Operations domain model.
 * Source of truth: docs/te-compilation/MASTER-DATAMODEL.md (record catalog,
 * ID grammar, workflow states) with the v1 scope cuts in docs/te-plan.md.
 * Doctrine invariants: records are versioned and append-only; runs are
 * versionless and never renumbered; issued cards are frozen; differences
 * between plan and execution become Deviation records, never card edits.
 */

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export type TeRecordStatus =
  | 'draft'
  | 'in-review'
  | 'approved'
  | 'issued'
  | 'superseded'
  | 'withdrawn'

export type CampaignPhase =
  | 'candidate'
  | 'qualified'
  | 'defined'
  | 'designed'
  | 'integrated'
  | 'ready'
  | 'executing'
  | 'analyzing'
  | 'decision-ready'
  | 'closed'

export type EngagementType =
  | 'demonstration'
  | 'experiment'
  | 'characterization'
  | 'comparison'
  | 'evaluation'

export type ValkrynTasking =
  | 'recommend'
  | 'characterize'
  | 'validate'
  | 'compare'
  | 'support-an-authority'

export type QuestionPriority = 'P1' | 'P2' | 'P3'

export type QuestionPattern =
  | 'capability'
  | 'performance'
  | 'comparison'
  | 'sensitivity'
  | 'boundary'
  | 'reliability'
  | 'diagnosis'
  | 'regression'
  | 'mission-effect'

export type QuestionDisposition = 'answered' | 'partially-answered' | 'not-answered'

export type EvidenceLevel =
  | 'component-behavior'
  | 'interface-behavior'
  | 'mission-conditions'
  | 'end-to-end-mission-effect'

export type RegisterKind = 'claim' | 'known-fact' | 'unknown' | 'assumption'

export type ClaimDisposition =
  | 'supported'
  | 'contradicted'
  | 'directionally-supported'
  | 'inconclusive'
  | 'untested'
  | 'outside-scope'

export type PredictionType =
  | 'single-value'
  | 'range'
  | 'min-max-bound'
  | 'distribution'
  | 'rank-order'
  | 'directional'
  | 'pass-miss'
  | 'no-difference'
  | 'failure-boundary'

export type HypothesisOutcome =
  | 'supported'
  | 'directionally-supported'
  | 'contradicted'
  | 'inconclusive'
  | 'not-tested'

export type MeasureType =
  | 'continuous'
  | 'binary'
  | 'count'
  | 'rate'
  | 'category'
  | 'time-to-event'
  | 'distance'
  | 'position-error'
  | 'probability'
  | 'human-rating'
  | 'composite-mission-outcome'

/** Drives which calc-engine path computes the measure. */
export type MeasureFamily =
  | 'binomial'
  | 'latency'
  | 'continuous'
  | 'rate'
  | 'count'
  | 'margin'

export type ThresholdSource =
  | 'law-regulation-safety'
  | 'contract-validated-requirement'
  | 'mission-arithmetic'
  | 'accepted-baseline'
  | 'customer-decision-rule'
  | 'analyst-judgment-labeled'

export const THRESHOLD_SOURCES: ThresholdSource[] = [
  'law-regulation-safety',
  'contract-validated-requirement',
  'mission-arithmetic',
  'accepted-baseline',
  'customer-decision-rule',
  'analyst-judgment-labeled',
]

export type FactorClass =
  | 'independent-variable'
  | 'held-control'
  | 'recorded-covariate'
  | 'unobserved-nuisance'
  | 'bounded-red-choice'
  | 'prohibited-variable'
  | 'response'

export type RepresentationClass =
  | 'actual-threat'
  | 'validated-surrogate'
  | 'generic-representation'
  | 'model-simulation'
  | 'hybrid'

export type FidelityLevel = 'faithful' | 'approximated' | 'omitted' | 'unknown'

export type ThreatMissionKind =
  | 'reconnaissance'
  | 'persistent-observation'
  | 'route-site-recon'
  | 'one-way-attack'
  | 'fpv-attack'
  | 'munition-delivery'
  | 'decoy-stimulation'
  | 'electronic-attack-relay'
  | 'saturation'
  | 'combined-recon-attack'
  | 'post-strike-assessment'

export type OpforMode = 'scripted' | 'bounded-adaptive' | 'free-play'

export type ThreatProfileClass = 'mandatory' | 'high-probability' | 'high-consequence'

/** Adjudicated run validity. `pending` runs are not available to analysis. */
export type TeRunValidity = 'pending' | 'valid' | 'conditionally-valid' | 'invalid'

/** Accounting state; `excluded` is an accounting decision, not an adjudication. */
export type AccountingState =
  | 'planned'
  | 'attempted'
  | 'valid'
  | 'conditional'
  | 'invalid'
  | 'excluded'

export type GoNoGo = 'go' | 'conditional-go' | 'hold' | 'no-go'

export type GoNoGoScope = 'daily' | 'readiness-review' | 'pre-run-release'

export type DeviationEffect = 'none' | 'bounded' | 'material' | 'unknown'

export type DeviationDisposition = 'repeat' | 'analyze-with-limits' | 'exclude'

export type AnomalyClass =
  | 'system-behavior'
  | 'test-infrastructure'
  | 'threat-deviation'
  | 'operator-action'
  | 'data-artifact'
  | 'unknown'

export type RootCauseStatus =
  | 'confirmed'
  | 'supported'
  | 'plausible'
  | 'contradicted'
  | 'unknown'

export type FindingStrength = 'conclusive' | 'directional' | 'insufficient' | 'not-tested'

/** Findings ladder. Levels never merge in one statement. */
export type LadderLevel =
  | 'observation'
  | 'calculation'
  | 'interpretation'
  | 'recommendation'
  | 'decision'

export type ResultLabel = 'pass' | 'miss' | 'borderline' | 'descriptive' | 'unavailable'

/** Per-run, per-measure opportunity status. */
export type ObservationStatus =
  | 'observed'
  | 'missing'
  | 'invalid'
  | 'censored'
  | 'unknown-outcome'
  | 'no-test'

export type PreliminaryUse = 'usable' | 'limited' | 'repeat' | 'valid-failure'

export type AuthorityStatus = 'pending' | 'active' | 'expired' | 'denied'

export type ChecklistItemType = 'check' | 'value' | 'go-no-go' | 'signature'

export type ChecklistItemState = 'unchecked' | 'checked' | 'na'

export type ChecklistPhase =
  | 'before-deployment'
  | 'readiness'
  | 'day-start'
  | 'pre-run'
  | 'in-run'
  | 'post-run'
  | 'day-end'
  | 'analysis'
  | 'closeout'

/** Daily evidence review ends in exactly one of these. */
export type NextAction =
  | 'execute-next-card'
  | 'repeat-for-validity'
  | 'isolate-one-variable'
  | 'repair-evidence-chain'
  | 'revise-threat-or-condition'
  | 'introduce-diagnostic-card'
  | 'stop-low-value-line'
  | 'end-for-sufficiency'
  | 'end-for-futility'

export type IntervalMethod = 'wilson' | 'exact' | 'bayes'

export type ActionStatus = 'open' | 'closed' | 'transferred'

export type DebriefKind = 'immediate' | 'daily' | 'aar'

/** The 22 decision types of the authority matrix, seeded as data. */
export const DECISION_TYPES = [
  'scope',
  'method',
  'thresholds',
  'configuration',
  'safety',
  'range',
  'airspace',
  'spectrum',
  'security',
  'daily go/no-go',
  'run start',
  'run pause',
  'run stop',
  'run restart',
  'degraded operation',
  'run validity',
  'card change',
  'run-list change',
  'evidence sufficiency',
  'findings',
  'acceptance',
  'customer action',
] as const

export const CAMPAIGN_ROLES = [
  'customer-decision-owner',
  'evidence-acceptance-authority',
  'deployment-strategist',
  'test-conductor',
  'range-safety-authority',
  'range-airspace-spectrum-authority',
  'system-owner-vendor-lead',
  'red-threat-lead',
  'data-lead',
  'analysis-lead',
  'security-data-custodian',
  'logistics-site-lead',
] as const

export type CampaignRole = (typeof CAMPAIGN_ROLES)[number]

export const RUN_ROLES = [
  'test-conductor',
  'safety-authority',
  'range-control-contact',
  'system-operator',
  'system-technical-lead',
  'red-threat-lead',
  'data-monitor',
  'ground-truth-operator',
  'run-logger',
  'deployment-strategist',
  'customer-witness',
] as const

export type RunRole = (typeof RUN_ROLES)[number]

// ---------------------------------------------------------------------------
// Campaign administration
// ---------------------------------------------------------------------------

export interface CustomerCommitment {
  item: string
  owner: string
  dueDate: string
  consequenceOfFailure: string
}

/** Campaign charter, the administrative backbone (MASTER-DATAMODEL 1.1). */
export interface CampaignCharter {
  sponsor: string
  requestingOrganization: string
  /** The customer's exact request, in their own words. */
  exactRequest: string
  dateReceived: string
  requestedDecisionDate: string
  customerDecisionOwner: string
  evidenceAcceptanceAuthority: string
  deploymentStrategist: string
  engagementType: EngagementType
  valkrynTasking: ValkrynTasking
  missionAndProtectedOutcome: string
  includedScope: string
  /** Every exclusion states its effect on conclusions. */
  excludedScope: string
  majorAssumptions: string
  majorRisks: string
  minimumViableCampaign: string
  successCriteria: string
  plannedSitesAndDates: string
  deliverablesDate: string
  dataSecurityReleaseClass: string
  contractAndFundingOwner: string
  knownLimits: string
  sourceDocumentsAndPriorEvidence: string
  commitments: CustomerCommitment[]
  /** Evidence-acceptance path. Design must not complete before it is recorded. */
  acceptance: {
    relyingOrganization: string
    methodApprovalAuthority: string
    requiredWitnesses: string
    evidenceStandard: string
    rejectionConditions: string
  }
}

/** The bounded customer decision; anchor of all traceability. */
export interface DecisionCharter {
  decisionDate: string
  authorizedDecisionOwner: string
  boundedChoice: string
  /** Includes delay and no action. */
  alternatives: string
  blockingUncertainty: string
  acceptanceConditions: string
  postTestAction: string
  actionAuthority: string
  consequenceOfNoAction: string
  resultThatChangesChoice: string
  resultThatDoesNot: string
  latestAcceptedEvidenceDate: string
  canAcceptUnfavorableEvidence: boolean
  minimumMeaningfulDifference: string
  acceptableThreshold: string
  requiredEvidenceStrength: string
  /** Decision action for each outcome class. */
  actionOnMeet: string
  actionOnMiss: string
  actionOnMixed: string
  actionOnInconclusive: string
}

export interface RoleAssignment {
  id: string
  role: CampaignRole
  primary: string
  backup: string
}

export interface AuthorityApproval {
  id: string
  authorityType: string
  owner: string
  dueDate: string
  operatingLimits: string
  evidence: string
  status: AuthorityStatus
  /** Typical lead time, seeded from reference constants. */
  leadTimeNote: string
}

/** One row of the decision-rights matrix. Exactly one accountable authority. */
export interface DecisionRightRow {
  id: string
  decisionType: string
  accountableAuthority: string
  performer: string
  requiredReviewers: string
  responseTimeLimit: string
  escalationPath: string
}

/** Claim, known fact, unknown, or assumption in the discovery registers. */
export interface RegisterEntry {
  id: string
  kind: RegisterKind
  statement: string
  sourceAndDate: string
  relevance: string
  /** Ordinal rank for unknowns; lower resolves first. */
  rank: number | null
  disposition: ClaimDisposition | null
  dispositionNote: string
  notes: string
}

export interface ScheduleItem {
  id: string
  /** Working days before the first live run; negative counts after start. */
  tMinusDays: number
  name: string
  owner: string
  done: boolean
  notes: string
}

export interface FeasibilityItem {
  id: string
  item: string
  score: 'feasible' | 'feasible-with-mitigation' | 'unresolved' | 'infeasible'
  owner: string
  fallback: string
  effectOnConclusions: string
}

// ---------------------------------------------------------------------------
// Design records
// ---------------------------------------------------------------------------

export interface TeQuestion {
  id: string
  wording: string
  priority: QuestionPriority
  pattern: QuestionPattern
  requiredAnswerDate: string
  currentEvidenceState: string
  consequenceIfUnanswered: string
  evidenceAuthority: string
  /** Freezing locks the ranked set; later edits route through a ChangeRecord. */
  frozen: boolean
  disposition: QuestionDisposition | null
  evidenceLevel: EvidenceLevel | null
  dispositionNote: string
}

export interface TeHypothesis {
  id: string
  questionId: string
  claimId: string | null
  /** Template: under [conditions], the system produces [behavior], measured by [measure], relative to [threshold]. */
  underConditions: string
  producesBehavior: string
  measuredBy: string
  relativeTo: string
  nullHypothesis: string
  competingExplanations: string
  supportingResult: string
  refutingResult: string
  inconclusiveResult: string
  /** Recorded before the test. The app compares prediction with result after. */
  predictedValue: string
  predictionType: PredictionType
  expectedVariability: string
  assumptions: string
  outcome: HypothesisOutcome | null
  outcomeNote: string
}

export interface TruthSourceSpec {
  primarySource: string
  backupSource: string
  /** Truth must not depend on the system under test. */
  independenceFromSut: string
  timeToleranceS: number | null
  accuracyNote: string
}

/** A campaign measure instance, frozen before execution. */
export interface TeMeasure {
  id: string
  /** Dictionary key, e.g. CUAS-SEN-PD-001. Empty for campaign-local measures. */
  dictKey: string
  name: string
  questionId: string
  hypothesisIds: string[]
  family: MeasureFamily
  measureType: MeasureType
  exactDefinition: string
  unit: string
  numeratorRule: string
  denominatorRule: string
  startEvent: string
  stopEvent: string
  experimentalUnit: string
  truth: TruthSourceSpec
  missingDataRule: string
  invalidDataRule: string
  censoringRule: string
  threshold: number | null
  objective: number | null
  failureBoundary: number | null
  thresholdSource: ThresholdSource | null
  /** Without customer approval the UI suppresses pass/fail and characterizes. */
  thresholdApproved: boolean
  /** True when a larger value is better (e.g. warning time). */
  higherIsBetter: boolean
  requiredRepetitions: number | null
  borderlineRule: string
  intervalMethod: IntervalMethod
  /** Beta prior for the bayes method. */
  priorAlpha: number
  priorBeta: number
  frozen: boolean
}

export interface FidelityRow {
  feature: string
  intendedState: string
  representedState: string
  level: FidelityLevel
  likelyEffect: string
}

export interface AdaptationRule {
  trigger: string
  allowedResponse: string
}

export interface TeThreatProfile {
  id: string
  version: string
  name: string
  /** Optional link into the canvas model library. */
  specModelId: string | null
  missions: ThreatMissionKind[]
  uasGroup: 1 | 2 | 3 | 4 | 5
  airframe: string
  speedBandMps: [number, number]
  altBandFt: [number, number]
  navMode: string
  emissionsSummary: string
  count: number
  raidNote: string
  adaptationRules: AdaptationRule[]
  operatorStateNote: string
  representationClass: RepresentationClass
  fidelity: FidelityRow[]
  profileClass: ThreatProfileClass
  opforMode: OpforMode
  redControlledVariables: string
  redFixedVariables: string
  prohibitedActions: string
  blinding: string
  validationSource: string
  permittedGeneralization: string
  prohibitedGeneralization: string
  notes: string
}

export interface TeCondition {
  id: string
  name: string
  terrainAndClutter: string
  weatherAndIllumination: string
  emEnvironment: string
  networkState: string
  backgroundActivity: string
  operatorWorkload: string
  supportingSystems: string
  degradedModes: string
  permittedGeneralization: string
  prohibitedGeneralization: string
}

export interface TeConfigBaseline {
  id: string
  version: string
  name: string
  boundaryInside: string
  boundaryExcluded: string
  hardwareAndSerials: string
  softwareVersions: string
  firmwareVersions: string
  settingsAndModes: string
  sensorConfiguration: string
  c2AndNetworkConfiguration: string
  effectorConfiguration: string
  operatorsAndTraining: string
  procedureVersion: string
  knownDefectsAndWaivers: string
  functionalCheckResult: string
  releasedBy: string
  freezeTime: string
  frozen: boolean
  /** Frozen JSON snapshot of the canvas scenario at freeze time. */
  scenarioSnapshot: string | null
  driftLog: Array<{ time: string; note: string }>
}

export interface TeFactor {
  id: string
  name: string
  classification: FactorClass
  plannedLevels: string
  toleranceAndVerification: string
  riskStatement: string
}

export interface TeMatrixCell {
  id: string
  questionId: string
  hypothesisId: string | null
  configId: string
  threatId: string
  conditionId: string
  method: string
  measureIds: string[]
  plannedReps: number
  minValidEvidence: number
  orderOrBlock: string
  priority: number
  dropOrder: number
  notes: string
}

// ---------------------------------------------------------------------------
// Test cards
// ---------------------------------------------------------------------------

export interface ProcedureStep {
  id: string
  /** One action per step. */
  action: string
  role: RunRole
  observableCompletion: string
  canSilentlyInvalidate: boolean
  isRecorderStartStop: boolean
}

/**
 * The 19-section unified card (MASTER-FORMS 2.3). Frozen once issued.
 * `id` is unique per version record; `cardCode` is the grammar identifier
 * shared across versions of one card lineage. Revision supersedes the old
 * record and creates a new one with the same cardCode.
 */
export interface TeCard {
  id: string
  cardCode: string
  version: string
  status: TeRecordStatus
  title: string
  owner: string
  approvers: string
  effectiveAt: string | null
  // S2 traceability
  questionIds: string[]
  claimIds: string[]
  hypothesisIds: string[]
  measureIds: string[]
  matrixCellId: string | null
  configId: string | null
  threatId: string | null
  conditionId: string | null
  // S3 purpose and intent
  purpose: string
  whyHighestValueNext: string
  resultThatCouldChangeDecision: string
  prediction: string
  changedFactor: string
  // S4 planned repetition
  repetitionNumber: number
  minValidSample: number
  priorityReason: string
  orderAndBlocking: string
  // S5 system state
  systemStateNote: string
  operators: string
  trainingState: string
  // S6 threat state
  redInitialState: string
  redControlled: string
  redFixed: string
  blinding: string
  invalidatingRedDeviations: string
  resetBeforeRepeat: string
  // S7 condition
  conditionNote: string
  operatingLimits: string
  // S8 variables
  independentFactorIds: string[]
  heldFactorIds: string[]
  covariateFactorIds: string[]
  // S9 measures render from measureIds; card-local note only
  measuresNote: string
  // S10 data and truth
  dataSources: string
  groundTruth: string
  commonTimeAndTolerance: string
  monitoringAndFallback: string
  /** Card-specific tap-button event vocabulary, one mark per line. */
  eventMarks: string[]
  // S11 preconditions
  preconditions: string[]
  // S12 procedure
  procedure: ProcedureStep[]
  // S13 expected result
  expectedResult: string
  knownArtifacts: string
  // S14 stop and restart
  safetyStops: string
  dataEquipmentStops: string
  safeState: string
  restartAuthority: string
  holdConditions: string
  // S15 validity and repeat
  requiredValidityConditions: string
  invalidatingFailures: string
  conditionalUses: string
  // S16 outputs
  requiredFiles: string
  storagePath: string
  // S18 and S19
  allowedConclusion: string
  prohibitedConclusion: string
  // execution-control metadata
  siteCalls: { start: string; stop: string; pause: string; abort: string }
  preEventMarginS: number
  postEventMarginS: number
  // gates
  coldReaderBy: string
  coldReaderAt: string | null
  dryRunBy: string
  dryRunAt: string | null
  // canvas links
  linkedEntityIds: string[]
  frameIds: string[]
}

// ---------------------------------------------------------------------------
// Execution records
// ---------------------------------------------------------------------------

export interface RunEvent {
  id: string
  /** Mark label: a generic control or a card event mark. */
  mark: string
  /** Wall-clock timestamp, ISO string. */
  at: string
  note: string
}

/** Per-run raw observation for one measure; the calc engine consumes these. */
export interface MeasureObservation {
  measureId: string
  status: ObservationStatus
  /** Binomial families: did the defined event succeed. */
  success: boolean | null
  /** Continuous and latency families: the measured value in measure units. */
  value: number | null
  note: string
}

export interface RunAdjudicationEntry {
  version: number
  at: string
  by: string
  validity: TeRunValidity
  reason: string
}

/** One execution attempt. Immutable identity, versionless, never renumbered. */
export interface TeRun {
  id: string
  cardId: string
  cardVersion: string
  matrixCellId: string | null
  plannedPurpose: string
  startAt: string | null
  endAt: string | null
  roles: Array<{ role: RunRole; person: string }>
  actualConfigId: string | null
  actualThreatId: string | null
  actualConditionId: string | null
  actualsNote: string
  events: RunEvent[]
  observations: MeasureObservation[]
  operatorObservations: string
  dataFilesNote: string
  initialDataQuality: string
  deviationIds: string[]
  anomalyIds: string[]
  validity: TeRunValidity
  /** Required when conditionally valid. */
  allowedMeasureIds: string[]
  prohibitedUses: string
  limits: string
  adjudications: RunAdjudicationEntry[]
  excluded: boolean
  preliminaryUse: PreliminaryUse | null
  debrief: {
    plannedVsOccurred: string
    differences: string
    sourcesRecorded: string
    warningsOrFailures: string
    unexpectedResult: string
    repeatNeeded: string
  }
  frameIds: string[]
}

export interface TeDeviation {
  id: string
  runId: string
  cardId: string
  at: string
  plannedState: string
  actualState: string
  directObservation: string
  affected: string
  immediateAction: string
  dataPreserved: boolean
  effect: DeviationEffect
  validityEffect: string
  disposition: DeviationDisposition
  approver: string
  easierOrHarder: 'easier' | 'harder' | 'neutral-unknown' | null
  generalizationLimit: string
}

export interface TeAnomaly {
  id: string
  runId: string | null
  at: string
  /** Recorded before discussing causes. */
  observation: string
  source: string
  classification: AnomalyClass
  missionEffect: string
  candidateCauses: string
  distinguishingEvidence: string
  preservationAction: string
  diagnosticAction: string
  rootCauseStatus: RootCauseStatus
  correctiveAction: string
  verificationTest: string
  owner: string
  open: boolean
}

/** Approved revision to future work. Old records stay preserved. */
export interface TeChange {
  id: string
  at: string
  trigger: string
  gapToResolve: string
  optionsConsidered: string
  selectedChangeAndReason: string
  variablesChanged: string
  variablesHeld: string
  supersededIds: string[]
  newVersionIds: string[]
  comparabilityEffect: string
  approvals: string
  briefed: boolean
  kind: 'exploratory' | 'confirmatory'
  nextAction: NextAction | null
  resultAfter: string
}

export interface ChecklistTemplateItem {
  text: string
  type: ChecklistItemType
  /** Pre-run rule: an unknown answer holds the run. */
  holdOnUnknown?: boolean
}

/** Seed checklist definition; instances copy the items. */
export interface ChecklistTemplate {
  key: string
  name: string
  phase: ChecklistPhase
  runner: string
  /** Named gate this checklist feeds, when it ends in a decision. */
  gate: string | null
  items: ChecklistTemplateItem[]
}

export interface ChecklistInstanceItem {
  text: string
  type: ChecklistItemType
  state: ChecklistItemState
  value: string
  completer: string
  at: string | null
  naReason: string
}

export interface TeChecklist {
  id: string
  templateKey: string
  name: string
  phase: ChecklistPhase
  runner: string
  startedAt: string
  completedAt: string | null
  items: ChecklistInstanceItem[]
  outcome: GoNoGo | null
  conditionalLimits: string
  runId: string | null
  dayDate: string
}

export interface TeGoNoGo {
  id: string
  scope: GoNoGoScope
  decision: GoNoGo
  at: string
  approvers: string
  affectedConclusions: string
  note: string
}

// ---------------------------------------------------------------------------
// Analysis and delivery records
// ---------------------------------------------------------------------------

export interface TeFinding {
  id: string
  version: string
  statement: string
  quantifiedResult: string
  questionId: string
  claimId: string | null
  hypothesisId: string | null
  supportingRunIds: string[]
  contradictingRunIds: string[]
  configId: string | null
  threatIds: string[]
  conditionIds: string[]
  measureIds: string[]
  thresholdComparison: string
  sampleAndIndependence: string
  uncertaintyNote: string
  missingAndExcludedData: string
  confoundersAndAlternatives: string
  strength: FindingStrength
  ladderLevel: LadderLevel
  appliesTo: string
  doesNotApplyTo: string
  assumptions: string
  evidenceLifeAndStaleness: string
  decisionImplication: string
  customerEffect: string
  recommendedAction: string
  comparisonWithPrediction: string
  approvers: string
  dissent: string
}

export interface TeAction {
  id: string
  findingId: string | null
  decisionOwner: string
  executionOwner: string
  dueDate: string
  requiredWork: string
  evidenceForClosure: string
  riskIfLate: string
  status: ActionStatus
  communicationRequired: string
}

export interface DebriefAnswer {
  question: string
  answer: string
}

export interface DebriefImprovement {
  id: string
  text: string
  owner: string
  dueDate: string
  destination: 'standard-work' | 'product-backlog'
}

export interface TeDebrief {
  id: string
  kind: DebriefKind
  runId: string | null
  date: string
  answers: DebriefAnswer[]
  improvements: DebriefImprovement[]
}

export interface PackageSection {
  n: number
  title: string
  /** Generated text; user edits set `edited` so regeneration preserves it. */
  content: string
  edited: boolean
}

export interface TeEvidencePackage {
  sections: PackageSection[]
  methodAcceptance: string
  evidenceAcceptance: string
  finalAuthorityAndDate: string
  deliveredAt: string | null
}

/** Canvas capture attached to cards and runs; rendered in print artifacts. */
export interface TeFrame {
  id: string
  name: string
  pngDataUrl: string
  capturedAt: string
  simTimeS: number | null
  note: string
}

// ---------------------------------------------------------------------------
// Campaign container
// ---------------------------------------------------------------------------

export interface TeCampaign {
  id: string
  /** Short campaign code used inside record identifiers, e.g. J401. */
  code: string
  name: string
  phase: CampaignPhase
  createdAt: string
  /** Per-record-type monotonic sequence counters for the ID grammar. */
  seq: Record<string, number>
  charter: CampaignCharter
  decision: DecisionCharter
  qualificationPassedAt: string | null
  designApprovedAt: string | null
  roles: RoleAssignment[]
  authorities: AuthorityApproval[]
  decisionRights: DecisionRightRow[]
  registers: RegisterEntry[]
  schedule: ScheduleItem[]
  feasibility: FeasibilityItem[]
  questions: TeQuestion[]
  hypotheses: TeHypothesis[]
  measures: TeMeasure[]
  threats: TeThreatProfile[]
  conditions: TeCondition[]
  configs: TeConfigBaseline[]
  factors: TeFactor[]
  matrix: TeMatrixCell[]
  cards: TeCard[]
  runs: TeRun[]
  deviations: TeDeviation[]
  anomalies: TeAnomaly[]
  changes: TeChange[]
  checklists: TeChecklist[]
  gonogos: TeGoNoGo[]
  findings: TeFinding[]
  actions: TeAction[]
  debriefs: TeDebrief[]
  evidencePackage: TeEvidencePackage
  frames: TeFrame[]
  /** Illustrative demo campaigns render a persistent banner. */
  illustrative: boolean
  /** Preset that seeded this campaign, or null. Provenance for the package. */
  presetKey?: string | null
  /** Campaign this one was started from, or null. Ancestry for traceability. */
  sourceCampaignId?: string | null
}

export interface TeState {
  schemaVersion: 1
  campaigns: TeCampaign[]
  activeCampaignId: string | null
}
