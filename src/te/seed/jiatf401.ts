/**
 * The JIATF-401 canonical seed campaign (docs/te-compilation/MASTER-SEEDDATA.md).
 * Labeling: facts marked (real) come from the JIATF-401 page or interview
 * transcript. Everything else is the notional case study: all configurations,
 * thresholds, quantities, schedules, calculations, and results are
 * illustrative. They are not actual JIATF-401 or Valkryn test results.
 * The campaign ships with illustrative: true so the app renders a banner.
 */

import type {
  FactorClass,
  MeasureObservation,
  RunEvent,
  RunRole,
  ProcedureStep,
  TeCampaign,
  TeRun,
} from '../model/types'
import type { TypeCode } from '../model/ids'
import { nextId } from '../model/ids'
import {
  emptyAnomaly,
  emptyCampaign,
  emptyCard,
  emptyCondition,
  emptyConfig,
  emptyDeviation,
  emptyFactor,
  emptyFinding,
  emptyHypothesis,
  emptyMatrixCell,
  emptyQuestion,
  emptyRun,
  emptyThreat,
} from '../model/empty'
import { newId } from '../../model/types'
import { MEASURE_DICTIONARY, measureFromDict } from './measureDictionary'

function dictEntry(key: string) {
  const entry = MEASURE_DICTIONARY.find((d) => d.dictKey === key)
  if (!entry) throw new Error(`measure dictionary key not found: ${key}`)
  return entry
}

function cardStep(
  action: string,
  role: RunRole,
  opts: { invalidates?: boolean; recorder?: boolean } = {},
): ProcedureStep {
  return {
    id: newId('step'),
    action,
    role,
    observableCompletion: '',
    canSilentlyInvalidate: opts.invalidates ?? false,
    isRecorderStartStop: opts.recorder ?? false,
  }
}

function ev(mark: string, at: string, note = ''): RunEvent {
  return { id: newId('ev'), mark, at, note }
}

/** Build the complete illustrative JIATF-401 demo campaign. */
export function buildJiatf401(): TeCampaign {
  const c = emptyCampaign('JIATF-401 Early-Warning Architecture Evaluation', 'J401')
  c.illustrative = true
  c.createdAt = '2026-03-20T09:00:00.000Z'
  c.phase = 'decision-ready'
  c.qualificationPassedAt = '2026-03-24T12:00:00.000Z'
  c.designApprovedAt = '2026-04-10T12:00:00.000Z'

  /** Allocate the next grammar id against the campaign sequence map. */
  const id = (code: TypeCode): string => {
    const a = nextId(c.seq, c.code, code)
    c.seq = a.seq
    return a.id
  }

  // Charter (real org facts marked (real); case-study fields (illustrative))
  c.charter = {
    ...c.charter,
    sponsor:
      'Joint Interagency Task Force 401 (JIATF-401): Army-led, reports to the Deputy Secretary of Defense (real)',
    requestingOrganization:
      'JIATF-401, established 2025-08-28, replaced the Joint Counter-small Unmanned Aircraft Systems Office (JCO) (real)',
    exactRequest:
      'Compare the current C-UAS architecture with an architecture that includes an early-warning radar. Determine whether the added sensor produces enough operational warning to justify integration and follow-on testing against the selected threat. (illustrative verbatim customer request)',
    dateReceived: '2026-03-20 (illustrative)',
    requestedDecisionDate: '15 working days after field execution (illustrative)',
    customerDecisionOwner:
      'Brig. Gen. Ross, JIATF-401 commander (real; first name not established)',
    evidenceAcceptanceAuthority:
      'JIATF-401; approval authority up to $50 million per initiative; a 36-month review can end or change the organization (real)',
    deploymentStrategist: 'Hugh, deployment strategist (real)',
    engagementType: 'comparison',
    valkrynTasking: 'compare',
    missionAndProtectedOutcome:
      'Real mission problem: a large evaluation backlog of C-UAS systems across kill-chain node classes: early-warning radars, tracking radars, command and control, interceptors, effectors (real). Case-study mission: protect a fixed point with a 1,000 m protected boundary against a one-way Group 2 fixed-wing approach (illustrative).',
    includedScope:
      'EW-1 radar and settings; TRK-1 radar and settings; FA-1 adapter and schema; C2-1 software and correlation settings; operator console and procedure; engagement-node timing representation; network path between included systems; independent threat truth (illustrative).',
    excludedScope:
      'Broad suitability and sustainment; performance against other threat classes; contested-spectrum performance; multi-threat saturation; live operational authorization; universal interceptor effectiveness. Every exclusion limits conclusions to the tested scope (illustrative).',
    majorAssumptions:
      'The ENG-1 approved time-to-effect representation stands in for the engagement chain during screening; range-approved inert or virtual engagement allowed in final confirmation (illustrative).',
    majorRisks:
      'Weather change between A and B; operator learning; threat-article battery or performance drift; radar heating; stale tracks after configuration changes; clock drift; unplanned route variation (illustrative nuisance risks, each with an assigned mitigation).',
    minimumViableCampaign:
      'Stage 1 screening: 12 valid matched A/B pairs across the 12-cell factor space (illustrative).',
    successCriteria:
      'Customer decision rules 1 through 7 (see the decision charter acceptance conditions) (illustrative).',
    plannedSitesAndDates:
      'Deep Element Test Site, Amman, Jordan (real site; formal name, ownership, authorities not established). Six-day field rhythm on notional dates 2026-05-04 to 2026-05-09 (illustrative).',
    deliverablesDate:
      'End-of-campaign evaluation output at field completion, in contrast to a PDF 60 to 90 days later (real TestOS capability); decision package before the decision date (illustrative).',
    dataSecurityReleaseClass: 'Treat test data as CUI at a minimum.',
    contractAndFundingOwner: 'JIATF-401 (real)',
    knownLimits:
      'Not established for the real event: number of each system; configurations; network design; clock sync; classification; cyber controls; whether all systems ran every run; whether any system was simulated; whether interceptors made physical contact; whether effectors were live, inert, virtual, or absent (real gap list).',
    sourceDocumentsAndPriorEvidence:
      'Standard Guidelines for T&E of C-UAS Technologies, adopted 2026-03-11: common core data, terms, schemas; not a military standard; no measures, surrogate fidelity, or evaluation criteria defined (real). JIATF-401 C4 public Common Criteria for C-UAS Characterization (real).',
    acceptance: {
      relyingOrganization: 'JIATF-401 (real)',
      methodApprovalAuthority: 'JIATF-401 evidence acceptance authority (illustrative)',
      requiredWitnesses:
        'Remote live observation by government personnel in the national capital region (real TestOS capability)',
      evidenceStandard:
        'Customer decision rules 1 through 7; validity assigned by measure, not only by run (illustrative)',
      rejectionConditions:
        'Evidence that fails the data-validity rules or cannot be traced to frozen configuration, threat, and condition records (illustrative)',
    },
  }

  // Decision charter (the two customer decisions and decision rules)
  c.decision = {
    ...c.decision,
    decisionDate: '15 working days after field execution (illustrative)',
    authorizedDecisionOwner:
      'JIATF-401 customer decision owner (real organization; case-study role illustrative)',
    boundedChoice:
      'Select architecture for a controlled pilot deployment and follow-on engagement evaluation: Configuration A (baseline) or Configuration B (early-warning layer added) (illustrative). The two real customer decisions behind the case: 1. Which systems performed as vendors claimed (which to buy). 2. Which combination formed the best C-UAS kill chain for a specific threat, place, and set of operating conditions ("HARDEN THE KILL CHAIN"). A component can work and still fail to add sufficient value to the complete kill chain (real).',
    alternatives:
      'Advance Configuration B; keep Configuration A; restricted recommendation limited by geometry; delay for more evidence; no action.',
    blockingUncertainty:
      'Whether the added early-warning layer produces at least 25 seconds more usable warning time without an unacceptable handoff, track-quality, or false-track penalty.',
    acceptanceConditions:
      'Configuration B advances to the next phase if ALL: 1. Estimated paired warning-time increase is at least 25 seconds. 2. The uncertainty interval does not indicate a material negative effect. 3. Median warning time is at least 90 seconds in the core condition. 4. Track continuity loss is not greater than 0.03. 5. Position RMSE remains at or below 50 m. 6. Added 90th-percentile handoff latency is at or below 1.0 second. 7. No unresolved failure prevents the engagement chain from using the early track.',
    postTestAction:
      'Proceed with Configuration B for the next controlled phase under the stated restrictions.',
    actionAuthority: 'JIATF-401',
    consequenceOfNoAction:
      'The baseline architecture is late at median: mission margin -14 seconds against the represented engagement chain.',
    resultThatChangesChoice:
      'Paired warning-time increase below 25 seconds, a material negative effect, or an unresolved failure preventing the engagement chain from using the early track.',
    resultThatDoesNot:
      'A threshold miss in one geometry alone: the partial-miss rule gives a restricted recommendation instead of complete rejection.',
    latestAcceptedEvidenceDate: '15 working days after field execution (illustrative)',
    canAcceptUnfavorableEvidence: true,
    minimumMeaningfulDifference: 'At least 25 seconds paired warning-time increase.',
    acceptableThreshold:
      'Median warning time at least 90 seconds in the core condition; continuity loss at most 0.03; position RMSE at most 50 m; added 90th-percentile handoff latency at most 1.0 second; false-track rate within the 1.5 per valid surveillance hour screening limit.',
    requiredEvidenceStrength:
      'The uncertainty interval must not indicate a material negative effect; at least 12 valid matched pairs in stage 1.',
    actionOnMeet: 'Configuration B advances to the next phase.',
    actionOnMiss: 'Do not advance; identify the failing rule and the required corrective work.',
    actionOnMixed:
      'Partial-miss rule: a threshold miss in one geometry can result in a restricted recommendation instead of complete rejection.',
    actionOnInconclusive:
      'Add approved augmentation runs by preapproved rule or defer the decision.',
  }

  // Roles (real people where attested)
  c.roles = [
    {
      id: id('ROLE'),
      role: 'customer-decision-owner',
      primary: 'Brig. Gen. Ross, JIATF-401 commander (real; first name not established)',
      backup: '',
    },
    {
      id: id('ROLE'),
      role: 'deployment-strategist',
      primary: 'Hugh (real)',
      backup: '',
    },
    {
      id: id('ROLE'),
      role: 'data-lead',
      primary:
        'Andrew, forward-deployed engineer: connected systems under test, structured system data, red-air telemetry, TestOS (real)',
      backup: '',
    },
  ]

  // Questions Q-01..Q-05 (as the source words them)
  const q1 = emptyQuestion(id('Q'))
  q1.wording =
    'Does Configuration B provide at least 25 seconds more usable warning time than Configuration A under matched threat and condition cells?'
  q1.priority = 'P1'
  q1.pattern = 'comparison'
  q1.requiredAnswerDate = '15 working days after field execution (illustrative)'
  q1.evidenceAuthority = 'JIATF-401'
  q1.consequenceIfUnanswered = 'The architecture selection for the controlled pilot cannot be made.'
  q1.frozen = true
  q1.disposition = 'answered'
  q1.evidenceLevel = 'mission-conditions'
  q1.dispositionNote =
    'Median paired improvement 46 s; 95 percent bootstrap interval 35 to 57 s; exceeds the 25 s minimum meaningful effect (illustrative).'

  const q2 = emptyQuestion(id('Q'))
  q2.wording =
    'Does the added layer produce a decision-ready C2 track without an unacceptable handoff penalty?'
  q2.priority = 'P1'
  q2.pattern = 'performance'
  q2.requiredAnswerDate = '15 working days after field execution (illustrative)'
  q2.evidenceAuthority = 'JIATF-401'
  q2.consequenceIfUnanswered = 'A working sensor could still fail to add kill-chain value.'
  q2.frozen = true
  q2.disposition = 'partially-answered'
  q2.evidenceLevel = 'interface-behavior'
  q2.dispositionNote =
    'Handoff 25 of 28 combined; added 90th-percentile latency 0.6 s within the 1.0 s allowance; anomalies cluster at the sector boundary (illustrative).'

  const q3 = emptyQuestion(id('Q'))
  q3.wording = 'Does the added layer preserve track quality?'
  q3.priority = 'P2'
  q3.pattern = 'performance'
  q3.requiredAnswerDate = '15 working days after field execution (illustrative)'
  q3.evidenceAuthority = 'JIATF-401'
  q3.consequenceIfUnanswered = 'A warning gain could hide a track-quality trade.'
  q3.frozen = true
  q3.disposition = 'answered'
  q3.evidenceLevel = 'interface-behavior'
  q3.dispositionNote =
    'Continuity difference -0.02, inside the allowed 0.03 loss; median RMSE 34 m against the 50 m limit (illustrative).'

  const q4 = emptyQuestion(id('Q'))
  q4.wording = 'Which geometry creates the smallest warning benefit or the highest failure rate?'
  q4.priority = 'P3'
  q4.pattern = 'sensitivity'
  q4.requiredAnswerDate = '15 working days after field execution (illustrative)'
  q4.evidenceAuthority = 'JIATF-401'
  q4.consequenceIfUnanswered = 'The recommendation cannot be bounded by geometry.'
  q4.frozen = true
  q4.disposition = 'answered'
  q4.evidenceLevel = 'mission-conditions'
  q4.dispositionNote =
    'Exploratory question; no H-04 exists in the source. Prediction: the sector-boundary approach will produce the smallest benefit and the highest handoff uncertainty. Result: sector-boundary cell median paired improvement 28 s; 2 of 6 Config B opportunities below the 90 s threshold; 2 of 3 handoff anomalies. Main residual performance risk (illustrative).'

  const q5 = emptyQuestion(id('Q'))
  q5.wording = 'Does Configuration B create enough time for the represented engagement chain?'
  q5.priority = 'P1'
  q5.pattern = 'mission-effect'
  q5.requiredAnswerDate = '15 working days after field execution (illustrative)'
  q5.evidenceAuthority = 'JIATF-401'
  q5.consequenceIfUnanswered = 'More warning alone does not establish an engagement opportunity.'
  q5.frozen = true
  q5.disposition = 'partially-answered'
  q5.evidenceLevel = 'end-to-end-mission-effect'
  q5.dispositionNote =
    'Median mission margin +33 s for Configuration B versus -14 s baseline; supported for the tested core condition, not all geometries (illustrative).'

  c.questions = [q1, q2, q3, q4, q5]

  // Hypotheses H-01, H-02, H-03, H-05 (no H-04 exists in the source; the
  // fourth HYP sequence number is burned so H-05 keeps its number)
  const h1 = emptyHypothesis(id('HYP'), q1.id)
  h1.underConditions = 'Under the tested threat and conditions'
  h1.producesBehavior =
    'Configuration B increases paired usable warning time by at least 25 seconds relative to Configuration A'
  h1.measuredBy = 'M-02 paired warning-time improvement, computed from M-01 usable warning time'
  h1.relativeTo = 'Minimum meaningful paired improvement: 25 seconds'
  h1.nullHypothesis = 'Paired increase < 25 s or too uncertain to support the customer decision.'
  h1.predictedValue =
    'Config A median usable warning time 70-90 s; Config B median 110-140 s; predicted paired increase 35-55 s.'
  h1.predictionType = 'range'
  h1.outcome = 'supported'
  h1.outcomeNote =
    'Supported for the tested factor space: 46 s median paired improvement; interval 35-57 s; minimum effect 25 s (illustrative).'

  const h2 = emptyHypothesis(id('HYP'), q2.id)
  h2.underConditions = 'In the tested core cells'
  h2.producesBehavior =
    'Configuration B maintains at least 90 percent usable handoff success and adds no more than 1.0 second to the 90th-percentile source-to-C2 latency'
  h2.measuredBy = 'M-07 handoff success; M-08 source-to-C2 latency'
  h2.relativeTo = 'Configuration A baseline latency; 90 percent handoff success floor'
  h2.nullHypothesis =
    'Handoff success below 90 percent or added 90th-percentile latency above 1.0 second.'
  h2.predictedValue = 'Handoff success 90-98 percent; added 90th-percentile latency 0.3-0.8 s.'
  h2.predictionType = 'range'
  h2.outcome = 'directionally-supported'
  h2.outcomeNote =
    'Directionally supported with a geometry limitation: 0.6 s added latency; 25 of 28 handoffs; anomalies cluster at the sector boundary (illustrative).'

  const h3 = emptyHypothesis(id('HYP'), q3.id)
  h3.underConditions = 'Under the tested threat and conditions'
  h3.producesBehavior =
    'Configuration B does not reduce median track continuity by more than 0.03 and does not increase opportunity-level position RMSE above 50 m'
  h3.measuredBy = 'M-05 track continuity; M-06 opportunity-level track error'
  h3.relativeTo = 'Configuration A continuity; 50 m RMSE customer limit'
  h3.nullHypothesis = 'Continuity loss above 0.03 or RMSE above 50 m.'
  h3.predictedValue = 'Continuity loss at most 0.03; RMSE at or below 50 m.'
  h3.predictionType = 'min-max-bound'
  h3.outcome = 'supported'
  h3.outcomeNote =
    'Supported under tested conditions: -0.02 versus -0.03 allowed; 34 m versus the 50 m limit (illustrative).'

  // Burn the fourth HYP sequence number: no H-04 exists in the source and
  // sequences are monotonic and never reused.
  id('HYP')

  const h5 = emptyHypothesis(id('HYP'), q5.id)
  h5.underConditions = 'Under the tested core condition'
  h5.producesBehavior =
    'Configuration B produces a positive mission margin in at least 80 percent of valid end-to-end confirmation opportunities'
  h5.measuredBy = 'M-10 mission margin, computed from M-01 and the required action-chain time'
  h5.relativeTo = 'Required chain time 80 s plus 10 s uncertainty and operating reserve'
  h5.nullHypothesis =
    'Positive margin in fewer than 80 percent of valid confirmation opportunities.'
  h5.predictedValue = 'Positive margin in at least 80 percent of valid confirmation opportunities.'
  h5.predictionType = 'pass-miss'
  h5.outcome = 'supported'
  h5.outcomeNote =
    'Supported for the tested core condition, not all geometries: +33 s median margin; sector-boundary margin smaller and less stable (illustrative).'

  c.hypotheses = [h1, h2, h3, h5]

  // Measures M-01..M-10 instantiated from the dictionary, then
  // overridden with campaign-frozen values and customer thresholds
  const m01 = measureFromDict(dictEntry('CUAS-MSN-UWT-010'), id('M'), q1.id)
  m01.name = 'Usable warning time (primary)'
  m01.hypothesisIds = [h1.id, h5.id]
  m01.exactDefinition =
    'Truth boundary-crossing time minus decision-ready C2 track time. Decision-ready requires ALL of: correct truth-object association; required position and velocity fields present; track age within 1.0 second; position-quality state within the customer criterion; C2 track persistence for at least three consecutive updates.'
  m01.experimentalUnit = 'One independently reset threat presentation'
  m01.threshold = 90
  m01.thresholdSource = 'mission-arithmetic'
  m01.thresholdApproved = true
  m01.frozen = true

  const m02 = measureFromDict(dictEntry('M-02'), id('M'), q1.id)
  m02.hypothesisIds = [h1.id]
  m02.threshold = 25
  m02.thresholdSource = 'customer-decision-rule'
  m02.thresholdApproved = true
  m02.frozen = true

  const m03 = measureFromDict(dictEntry('CUAS-SEN-PD-001'), id('M'), q1.id)
  m03.exactDefinition =
    'Valid opportunities with a valid detection over total valid detection opportunities; report by range band, altitude, azimuth, speed, configuration.'
  m03.frozen = true

  const m04 = measureFromDict(dictEntry('CUAS-TRK-FST-003'), id('M'), q1.id)
  m04.exactDefinition =
    'Truth-derived distance from threat to protected boundary when all stable-track rules first pass.'
  m04.unit = 'm'
  m04.frozen = true

  const m05 = measureFromDict(dictEntry('CUAS-TRK-CONT-004'), id('M'), q3.id)
  m05.hypothesisIds = [h3.id]
  m05.exactDefinition =
    'Eligible time with a valid associated track over total valid eligible tracking time.'
  m05.thresholdSource = 'customer-decision-rule'
  m05.thresholdApproved = true
  m05.frozen = true

  const m06 = measureFromDict(dictEntry('CUAS-TRK-ERR-005'), id('M'), q3.id)
  m06.hypothesisIds = [h3.id]
  m06.exactDefinition =
    'RMSE of blue-minus-truth position; matched updates within one run give ONE opportunity-level summary, never independent tests.'
  m06.threshold = 50
  m06.thresholdSource = 'customer-decision-rule'
  m06.thresholdApproved = true
  m06.frozen = true

  const m07 = measureFromDict(dictEntry('CUAS-C2-HS-008'), id('M'), q2.id)
  m07.hypothesisIds = [h2.id]
  m07.exactDefinition =
    'Qualifying source tracks that become usable C2 tracks over valid qualifying source-track opportunities.'
  m07.threshold = 0.9
  m07.thresholdSource = 'customer-decision-rule'
  m07.thresholdApproved = true
  m07.frozen = true

  const m08 = measureFromDict(dictEntry('CUAS-C2-LAT-009'), id('M'), q2.id)
  m08.hypothesisIds = [h2.id]
  m08.exactDefinition =
    'Decision-ready C2 event time minus qualifying source-track event time; a failed handoff is censored or failed, never assigned the timeout as a latency.'
  m08.threshold = 1.0
  m08.thresholdSource = 'customer-decision-rule'
  m08.thresholdApproved = true
  m08.frozen = true

  const m09 = measureFromDict(dictEntry('CUAS-SUR-FTR-007'), id('M'), q3.id)
  m09.exactDefinition = 'Adjudicated false or nuisance tracks per valid surveillance hour.'
  m09.threshold = 1.5
  m09.thresholdSource = 'customer-decision-rule'
  m09.thresholdApproved = true
  m09.frozen = true

  const m10 = measureFromDict(dictEntry('M-10'), id('M'), q5.id)
  m10.hypothesisIds = [h5.id]
  m10.exactDefinition =
    'Usable warning time minus required action-chain time minus uncertainty reserve. Action-chain inputs (s): operator decision 8; assignment 4; engagement preparation 8; time to represented effect 55; effect assessment 5; uncertainty and operating reserve 10. Required chain time 80 s; required warning threshold 90 s.'
  m10.threshold = 0
  m10.thresholdSource = 'mission-arithmetic'
  m10.thresholdApproved = true
  m10.frozen = true

  c.measures = [m01, m02, m03, m04, m05, m06, m07, m08, m09, m10]

  // Shared independent truth source
  for (const m of c.measures) {
    m.truth = {
      primarySource:
        'Independent GNSS/INS truth telemetry on the threat: 10 Hz or better, position uncertainty 1.5 m or better in the scored region (illustrative).',
      backupSource: 'Range radar truth track; post-processed truth solution.',
      independenceFromSut:
        'Truth pod is carried by the threat and hidden from blue operators and systems; no dependency on any system under test.',
      timeToleranceS: 0.1,
    }
  }

  // Threat profile
  const threat = emptyThreat(id('THR'))
  threat.version = 'v1.2'
  threat.name = 'THR-G2-FW-01 Generic Group 2 fixed-wing surrogate'
  threat.missions = ['one-way-attack']
  threat.uasGroup = 2
  threat.airframe = 'fixed-wing'
  threat.speedBandMps = [20, 30]
  threat.altBandFt = [197, 394]
  threat.navMode = 'Preplanned waypoint navigation'
  threat.emissionsSummary =
    'Independent truth telemetry hidden from blue operators and systems; payload inert representative mass.'
  threat.count = 1
  threat.adaptationRules = []
  threat.representationClass = 'generic-representation'
  threat.opforMode = 'scripted'
  threat.redFixedVariables =
    'No adaptation during paired comparison runs. Entry state: stable speed and altitude before the scored volume. One approved approach line per paired block.'
  threat.redControlledVariables = 'None during paired comparison runs.'
  threat.prohibitedActions = 'Adaptation during paired comparison runs.'
  threat.blinding = 'Truth telemetry hidden from blue operators and systems.'
  threat.permittedGeneralization = 'Radar and timeline characterization only.'
  threat.prohibitedGeneralization =
    'The surrogate supports radar and timeline characterization only. Fidelity must be assessed feature by feature. It does not establish performance versus an actual Shahed-type system, other guidance, other signature, or an adaptive threat.'
  threat.notes =
    'Source identifier THR-G2-FW-01-v1.2 (illustrative). Speed levels 20 and 30 m/s; altitude levels 60 and 120 m AGL (stored above as 197 and 394 ft). Approach geometry enum: centerline; sensor-sector boundary; off-axis. End state enum: boundary crossing; recovery turn; approved test stop. Protected-boundary vignette: fixed protected point; protected boundary radius 1,000 m; threat begins scored approach outside the largest expected detection region; engagement node uses an approved time-to-effect representation during screening.'
  c.threats = [threat]

  // Condition
  const cond = emptyCondition(id('COND'))
  cond.name = 'COND-DAY-CLEAR-NET-NOM-v1 (day, clear weather, nominal network)'
  cond.weatherAndIllumination = 'Day, clear weather.'
  cond.networkState = 'Nominal network.'
  cond.emEnvironment = 'Permissive; RF background recorded as a covariate.'
  cond.backgroundActivity = 'None represented.'
  cond.operatorWorkload = 'Nominal; workload rating recorded as a covariate.'
  cond.permittedGeneralization = 'Tested core condition only.'
  cond.prohibitedGeneralization =
    'Night, adverse weather, contested spectrum, degraded network, and elevated workload are untested.'
  c.conditions = [cond]

  // Frozen configuration baseline
  const cfg = emptyConfig(id('CFG'))
  cfg.version = 'v1.0'
  cfg.name = 'J401 paired architecture baseline (Configurations A and B)'
  cfg.boundaryInside =
    'Configuration A (Baseline): TRK-1 -> C2-1 -> ENG-1. Configuration B (Treatment): EW-1 -> FA-1 -> TRK-1 -> C2-1 -> ENG-1. Node roles: EW-1 early-warning radar; FA-1 fusion adapter; TRK-1 tracking radar; C2-1 command and control; ENG-1 engagement node (approved time-to-effect representation during screening). Pairing rule: only the added early-warning layer and its required interface change between paired configurations.'
  cfg.boundaryExcluded =
    'Broad suitability and sustainment; other threat classes; contested spectrum; multi-threat saturation; live operational authorization; universal interceptor effectiveness.'
  cfg.hardwareAndSerials =
    'Real systems inventory (real; specs sparse and unverified): SYS-PICOGRID Picogrid C2 (alias Legion, command-and-control); SYS-RPS42 RADA RPS-42 tracking radar (90 elev/azi sector scan / 5km nano / 25km med); SYS-VANQUISH CHAOS Industries Vanquish early-warning radar (Dist EW Radar); SYS-MEROPS Merops interceptor system (one-way attack mission; GCS / Launcher / Radar/Sensor; envelope 5-20km / 16kft; sensor to effector linkage; autonomous/semi control; RF / radar guidance / thermal / multi-sensor); SYS-MUGIN3 Mugin-3 (MUGEN-3) red-air fixed-wing; SYS-BUMBLEBEE Bumblebee Quad Copters; SYS-HORNET Hornet Midrange Strike Drones. Capability tags: Computer Vision, RF Sensing, Jam-Resistant Comms, Autonomous Targeting.'
  cfg.settingsAndModes =
    'Within a comparison block do NOT change: tracking radar, C2 build, engagement process, operator crew, protected boundary, threat profile.'
  cfg.sensorConfiguration = 'EW-1 radar and settings; TRK-1 radar and settings.'
  cfg.c2AndNetworkConfiguration =
    'C2-1 software and correlation settings; FA-1 adapter and schema; network path between included systems.'
  cfg.effectorConfiguration = 'ENG-1 approved time-to-effect representation.'
  cfg.operatorsAndTraining = 'Operator console and frozen procedure; crew held within blocks.'
  cfg.procedureVersion = 'Frozen operator workflow v1.0 (illustrative).'
  cfg.functionalCheckResult =
    'Configuration A and B bench checks passed in the T-20 to T-14 window (illustrative).'
  cfg.releasedBy = 'Hugh (deployment strategist)'
  cfg.freezeTime = '2026-04-24T12:00:00.000Z'
  cfg.frozen = true
  c.configs = [cfg]

  // Factors: variable classification
  const addFactor = (
    name: string,
    classification: FactorClass,
    plannedLevels: string,
    riskStatement = '',
  ) => {
    const f = emptyFactor(id('FAC'))
    f.name = name
    f.classification = classification
    f.plannedLevels = plannedLevels
    f.riskStatement = riskStatement
    c.factors.push(f)
    return f
  }

  const facArch = addFactor('Architecture', 'independent-variable', 'A; B')
  addFactor(
    'Approach azimuth (screened factor)',
    'independent-variable',
    'centerline; sensor-sector boundary; off-axis',
  )
  addFactor('Altitude (screened factor)', 'independent-variable', '60; 120 m AGL')
  addFactor('Speed (screened factor)', 'independent-variable', '20; 30 m/s')

  const heldControls = [
    'Threat article within block',
    'Flight profile within pair',
    'Tracking-radar settings',
    'C2 build and settings',
    'Operator crew and procedure',
    'Sensor emplacement',
    'Protected boundary',
    'Engagement timeline assumptions',
  ]
  for (const name of heldControls) addFactor(name, 'held-control', 'Held within the comparison block')

  const covariates = [
    'Actual speed and altitude',
    'Wind',
    'Temperature',
    'Precipitation',
    'Visibility',
    'Actual approach angle',
    'RF background',
    'Network latency',
    'Operator workload rating',
    'Time of day',
  ]
  for (const name of covariates) addFactor(name, 'recorded-covariate', 'Recorded every run')

  const nuisance: Array<[string, string]> = [
    ['Weather change between A and B', 'Mitigation: blocking; pair A and B within the same day and weather block.'],
    ['Operator learning', 'Mitigation: randomization; reverse pair order across blocks and balance which configuration runs first.'],
    ['Threat-article battery or performance drift', 'Mitigation: capture rule; record battery and performance state each run.'],
    ['Radar heating', 'Mitigation: capture rule; record radar state and run spacing.'],
    ['Stale tracks after configuration changes', 'Mitigation: reset; clear queues and stale tracks before each run and full configuration check after every A/B switch.'],
    ['Clock drift', 'Mitigation: capture rule; common-time health check before each run.'],
    ['Unplanned route variation', 'Mitigation: capture rule; independent truth telemetry verifies the route against the cell tolerance.'],
  ]
  for (const [name, mit] of nuisance) addFactor(name, 'unobserved-nuisance', '', mit)

  // Test matrix: 3 azimuths x 2 altitudes x 2 speeds = 12 cells
  const azTokens = ['AZ-CL', 'AZ-BND', 'AZ-OFF']
  const altTokens = ['ALT-60', 'ALT-120']
  const spdTokens = ['SPD-20', 'SPD-30']
  const attested = new Set(['AZ-BND', 'ALT-60', 'SPD-30'])
  let issuedCellId = ''
  for (const az of azTokens) {
    for (const alt of altTokens) {
      for (const spd of spdTokens) {
        const cell = emptyMatrixCell(id('MTX'))
        cell.questionId = q1.id
        cell.hypothesisId = h1.id
        cell.configId = cfg.id
        cell.threatId = threat.id
        cell.conditionId = cond.id
        cell.method = 'Paired comparison: one matched A/B pair'
        cell.measureIds = [m01.id, m02.id, m03.id, m04.id, m05.id, m06.id, m07.id, m08.id, m09.id]
        cell.plannedReps = 2
        cell.minValidEvidence = 2
        cell.orderOrBlock =
          'Stage 1 screening; A/B order randomized within each block and balanced for which configuration runs first.'
        cell.priority = 1
        const token = `${az} / ${alt} / ${spd}`
        const inferred = [az, alt, spd].filter((t) => !attested.has(t))
        cell.notes =
          inferred.length === 0
            ? `Cell ${token}. Attested cell-ID grammar.`
            : `Cell ${token}. Inferred tokens from the attested grammar AZ-BND / ALT-60 / SPD-30: ${inferred.join(', ')}.`
        c.matrix.push(cell)
        if (az === 'AZ-BND' && alt === 'ALT-60' && spd === 'SPD-30') issuedCellId = cell.id
      }
    }
  }

  // Issued card TC-J401-EW-COMP-01 v1.0
  const card = emptyCard(id('TC'), 'TC-J401-EW-COMP-01')
  card.version = 'v1.0'
  card.status = 'issued'
  card.title = 'Early-warning layer paired comparison, sector-boundary cell'
  card.owner = 'Hugh (deployment strategist)'
  card.approvers = 'Hugh (deployment strategist); JIATF-401 customer decision owner'
  card.effectiveAt = '2026-05-01T12:00:00.000Z'
  card.questionIds = [q1.id]
  card.hypothesisIds = [h1.id]
  card.measureIds = [m01.id, m02.id, m04.id, m05.id, m06.id, m07.id, m08.id, m09.id]
  card.matrixCellId = issuedCellId
  card.configId = cfg.id
  card.threatId = threat.id
  card.conditionId = cond.id
  card.purpose =
    'Does Configuration B add at least 25 seconds of usable warning time in the sector-boundary geometry?'
  card.whyHighestValueNext =
    'The sector-boundary approach is predicted to produce the smallest benefit and the highest handoff uncertainty (Q-04).'
  card.resultThatCouldChangeDecision =
    'A paired difference below 25 seconds or an unresolved handoff failure in this geometry would block Configuration B or restrict the recommendation.'
  card.prediction =
    'Configuration A will provide 60-80 seconds. Configuration B will provide 95-125 seconds.'
  card.changedFactor = 'Early-warning layer absent or present.'
  card.repetitionNumber = 1
  card.minValidSample = 2
  card.priorityReason = 'Stage 1 screening cell with the smallest predicted margin.'
  card.orderAndBlocking =
    'Configuration A or B from randomized order. Pair A and B within the same day and weather block; reverse pair order across blocks; require a full configuration check after every A/B switch.'
  card.systemStateNote =
    'Matrix cell AZ-BND / ALT-60 / SPD-30. Tracking radar, C2, operator procedure, threat profile, and engagement timing are unchanged within the pair. Configuration manifest matches the selected A or B state.'
  card.operators = 'Card users: conductor, operator, red team, data monitor, customer observer.'
  card.trainingState = 'Frozen workflow; crew trained during the T-7 to T-2 rehearsal window.'
  card.redInitialState =
    'Threat THR-G2-FW-01-v1.2 establishes the approved pre-entry state: stable speed and altitude before the scored volume.'
  card.redControlled = 'None during paired comparison runs.'
  card.redFixed = 'Route, altitude 60 m AGL, and speed 30 m/s per the cell; no adaptation.'
  card.blinding = 'Truth telemetry hidden from blue operators and systems.'
  card.invalidatingRedDeviations =
    'Threat route, altitude, or speed outside the cell tolerance.'
  card.resetBeforeRepeat = 'Stale tracks and queues are cleared before each run.'
  card.conditionNote = 'COND-DAY-CLEAR-NET-NOM-v1: day, clear weather, nominal network.'
  card.independentFactorIds = [facArch.id]
  card.heldFactorIds = c.factors.filter((f) => f.classification === 'held-control').map((f) => f.id)
  card.covariateFactorIds = c.factors
    .filter((f) => f.classification === 'recorded-covariate')
    .map((f) => f.id)
  card.measuresNote =
    'Primary result: paired usable-warning-time difference. Secondary results: handoff success; C2 latency; continuity; position RMSE; false-track rate.'
  card.dataSources =
    'EW-1 plots, tracks, detection state, quality, status, configuration snapshot; TRK-1 plots and tracks, track quality, position and velocity, initiation, drop, reacquisition, configuration snapshot; FA-1 and network message send and receive events, schema and adapter version, queue state, packet loss and delay, object IDs; C2-1 object creation and update events, correlation decisions, decision-ready state, operator display events, operator actions; environment record; run record.'
  card.groundTruth =
    'Independent GNSS/INS truth telemetry: update rate at least 10 Hz; position uncertainty target 1.5 m or better in the scored region; threat-object ID; actual route, altitude, speed, heading, boundary crossing; telemetry state and gaps. Hidden from blue operators and systems.'
  card.commonTimeAndTolerance =
    'Clock offset within the measure limit. Timing budget: start timestamp 0.02 s; stop timestamp 0.02 s; synchronization 0.01 s; event definition 0.03 s; derived u_latency 0.042 s; along-track error at 30 m/s is 1.26 m.'
  card.monitoringAndFallback =
    'Truth, sensor, adapter, C2, environment, and run-log health are monitored; hold when any required source is unavailable.'
  card.eventMarks = [
    'Threat enters eligibility region.',
    'First valid detection.',
    'First stable track.',
    'Qualifying source track.',
    'Usable C2 track.',
    'Operator decision.',
    'Assignment.',
    'Represented effect-ready event.',
    'Protected-boundary crossing.',
    'Run complete.',
  ]
  card.preconditions = [
    'Tracking radar, C2, operator procedure, threat profile, and engagement timing are unchanged within the pair.',
    'Stale tracks and queues are cleared.',
    'Configuration manifest matches the selected A or B state.',
    'Truth, sensor, adapter, C2, environment, and run log are healthy.',
    'Clock offset is within the measure limit.',
  ]
  card.procedure = [
    cardStep('Test conductor states card, run ID, matrix cell, and selected configuration.', 'test-conductor'),
    cardStep('Data monitor confirms required sources and common-time health.', 'data-monitor', { invalidates: true }),
    cardStep('Operator confirms the selected configuration without changing approved settings.', 'system-operator', { invalidates: true }),
    cardStep('Red operator confirms threat profile, route, altitude, and speed.', 'red-threat-lead'),
    cardStep('Test conductor confirms queues and prior object state are clear.', 'test-conductor', { invalidates: true }),
    cardStep('Start truth, blue-system, environment, and run-log recording.', 'data-monitor', { recorder: true }),
    cardStep('Threat establishes the approved pre-entry state.', 'red-threat-lead'),
    cardStep('Test conductor authorizes entry into the scored approach.', 'test-conductor'),
    cardStep('Threat executes the route without adaptation.', 'red-threat-lead', { invalidates: true }),
    cardStep('Operators follow the frozen workflow without coaching or tuning.', 'system-operator', { invalidates: true }),
    cardStep('Continue recording through boundary crossing and the post-event margin.', 'data-monitor'),
    cardStep('Recover the threat and save all source records.', 'data-monitor', { recorder: true }),
    cardStep('Record actual configuration, route, speed, altitude, weather, and operator state.', 'run-logger'),
    cardStep('Complete the factual debrief.', 'test-conductor'),
    cardStep('Run the automated data and validity check before the paired run.', 'data-monitor'),
  ]
  card.expectedResult =
    'Configuration A around 60-80 seconds of usable warning; Configuration B around 95-125 seconds; a positive paired difference interpreted with handoff, continuity, RMSE, and false-track results.'
  card.safetyStops =
    'General safety and range stops remain in the active field plan; the card does not repeat them in full.'
  card.dataEquipmentStops =
    'Hold on loss of truth or common-time health, or when a required source becomes unavailable.'
  card.safeState = 'Threat to recovery turn or approved test stop; recorders keep running.'
  card.restartAuthority = 'Test conductor.'
  card.holdConditions =
    'Hold before the run if ANY is true: configuration state is unknown; truth or common time is not healthy; queues or tracks from the prior run remain; threat route, altitude, or speed cannot meet the cell tolerance; a required source is unavailable.'
  card.requiredValidityConditions =
    'A run supports usable warning time only if ALL hold: truth covers the complete opportunity; threat speed, altitude, and route remain inside tolerance; configuration IDs are known; decision-ready and boundary events are reconstructable; object association is unambiguous; common time passes; no critical data gap overlaps either event.'
  card.invalidatingFailures = 'Repeat: a required validity condition fails.'
  card.conditionalUses =
    'Preliminary use rule: Usable, all primary events and states pass. Limited, the run supports named sensing measures but not warning or latency. Repeat, a required validity condition fails. Valid failure, the test is valid and the system does not meet the event rule. A run may remain valid for detection probability and invalid for latency.'
  card.requiredFiles =
    'Truth, EW-1, TRK-1, FA-1 and network, C2-1, environment, and run-record files per the instrumentation data-field manifest; event-mark timestamps feeding M-01, M-04, and M-08.'
  card.storagePath = 'testos://J401-EW-01/runs/'
  card.allowedConclusion =
    'Paired usable-warning-time difference and secondary results for the tested configurations, Group 2 fixed-wing surrogate, sector-boundary geometry, and day-clear nominal-network condition.'
  card.prohibitedConclusion =
    'No performance claim against an actual Shahed-type system, other guidance, other signature, or an adaptive threat; no claim outside the tested factor space.'
  card.coldReaderBy = 'Andrew (forward-deployed engineer)'
  card.coldReaderAt = '2026-04-28T15:00:00.000Z'
  card.dryRunBy = 'Hugh (deployment strategist)'
  card.dryRunAt = '2026-04-29T10:00:00.000Z'
  c.cards = [card]

  // T-30 preparation schedule
  const scheduleWindows: Array<[number, string, string[]]> = [
    [
      30,
      'T-30 to T-21',
      [
        'Conduct customer discovery',
        'Freeze the primary decision and questions',
        'Identify the exact system builds',
        'Select threat profiles',
        'Load prior evidence',
        'Build the first measure set',
        'Identify required source fields',
      ],
    ],
    [
      20,
      'T-20 to T-14',
      [
        'Connect source feeds',
        'Verify identifiers and clocks',
        'Register sensors and truth sources',
        'Validate threat flight profiles',
        'Run Configuration A and B bench checks',
        'Test queue and state reset',
      ],
    ],
    [
      13,
      'T-13 to T-8',
      [
        'Freeze factor space',
        'Run sample-size review',
        'Generate the matrix',
        'Generate cards',
        'Compute every primary measure from rehearsal data',
        'Correct data and interface defects',
      ],
    ],
    [
      7,
      'T-7 to T-2',
      [
        'Conduct full field rehearsal',
        'Validate positive and negative controls',
        'Dry run the A/B change process',
        'Verify the tablet workflow',
        'Freeze the issued matrix and first-day cards',
      ],
    ],
  ]
  for (const [tMinus, windowName, items] of scheduleWindows) {
    for (const name of items) {
      c.schedule.push({
        id: id('SCH'),
        tMinusDays: tMinus,
        name,
        owner: tMinus >= 21 ? 'Hugh' : 'Andrew',
        done: true,
        notes: `Window ${windowName} (illustrative working-day countdown).`,
      })
    }
  }

  // Registers: key claims and unknowns
  c.registers = [
    {
      id: id('UNK'),
      kind: 'unknown',
      statement: 'How is Pd (probability of detection) properly defined?',
      sourceAndDate: 'Recorded open question from the real engagement (real).',
      relevance:
        'The dictionary entry CUAS-SEN-PD-001 resolves it for the app; the real JIATF event never defined it.',
      rank: 1,
      disposition: null,
      dispositionNote: '',
      notes: '',
    },
    {
      id: id('UNK'),
      kind: 'unknown',
      statement:
        'Not established for the real event: number of each system; configurations; network design; clock sync; classification; cyber controls; whether all systems ran every run; whether any system was simulated; whether interceptors made physical contact; whether effectors were live, inert, virtual, or absent.',
      sourceAndDate: 'Explicit gap list from the real engagement (real).',
      relevance: 'Bounds every claim about the real event.',
      rank: 2,
      disposition: null,
      dispositionNote: '',
      notes: '',
    },
    {
      id: id('CLM'),
      kind: 'claim',
      statement:
        'The added early-warning sensor produces enough operational warning to justify integration and follow-on testing against the selected threat.',
      sourceAndDate: 'Customer working claim under test (illustrative).',
      relevance: 'The claim behind Q-01 and H-01.',
      rank: null,
      disposition: 'supported',
      dispositionNote:
        'Supported for the tested factor space with a sector-boundary restriction (illustrative results).',
      notes: '',
    },
    {
      id: id('ASM'),
      kind: 'assumption',
      statement:
        'The ENG-1 approved time-to-effect representation stands in for the engagement chain during screening.',
      sourceAndDate: 'Case-study system boundary (illustrative).',
      relevance:
        'Mission margin conclusions support only the tested timeline, not another effector or C2 procedure.',
      rank: null,
      disposition: null,
      dispositionNote: '',
      notes: '',
    },
    {
      id: id('REG'),
      kind: 'known-fact',
      statement:
        'The customer knew objectives and desired decisions, not required data, measures, or analytical method. Valkryn asked for the test card; the answer was "We don\'t have one." Valkryn built the test card from the decision backward.',
      sourceAndDate: 'Defining discovery from the real engagement (real).',
      relevance: 'Motivates the decision-backward planning flow the app implements.',
      rank: null,
      disposition: null,
      dispositionNote: '',
      notes: '',
    },
  ]

  // Illustrative runs against the issued card (sector-boundary
  // cell: 6 matched pairs, median paired improvement 28 s, 2 of 6 Config B
  // opportunities below 90 s, plus one invalid run and one conditionally
  // valid run). Every number is notional fixture data.
  interface RunSpec {
    start: string
    config: 'A' | 'B'
    pair: string
    validity: 'valid' | 'invalid' | 'conditionally-valid'
    warning: number
    cont: number
    rmse: number
    lat: number
    ftr: number
    improvement?: number
    note?: string
    anomaly?: boolean
    deviation?: boolean
  }

  const specs: RunSpec[] = [
    { start: '2026-05-05T08:10:00Z', config: 'A', pair: 'P1', validity: 'valid', warning: 66, cont: 0.96, rmse: 27, lat: 1.6, ftr: 0.4 },
    { start: '2026-05-05T09:00:00Z', config: 'B', pair: 'P1', validity: 'valid', warning: 97, cont: 0.95, rmse: 33, lat: 2.2, ftr: 1.1, improvement: 31 },
    { start: '2026-05-05T09:50:00Z', config: 'B', pair: 'P2', validity: 'valid', warning: 99, cont: 0.94, rmse: 35, lat: 2.4, ftr: 1.3 },
    { start: '2026-05-05T10:40:00Z', config: 'A', pair: 'P2', validity: 'valid', warning: 71, cont: 0.97, rmse: 26, lat: 1.5, ftr: 0.0, improvement: 28 },
    { start: '2026-05-06T08:10:00Z', config: 'A', pair: 'P3', validity: 'invalid', warning: 64, cont: 0.95, rmse: 29, lat: 1.8, ftr: 0.4, deviation: true, note: 'Threat drifted off the approved approach line; azimuth outside the sector-boundary cell tolerance.' },
    { start: '2026-05-06T09:00:00Z', config: 'A', pair: 'P3', validity: 'valid', warning: 62, cont: 0.95, rmse: 30, lat: 1.9, ftr: 0.4, note: 'Repeat of the invalid attempt.' },
    { start: '2026-05-06T09:50:00Z', config: 'B', pair: 'P3', validity: 'valid', warning: 84, cont: 0.93, rmse: 36, lat: 3.4, ftr: 1.2, improvement: 22, anomaly: true, note: 'Delayed FA-1 adapter message; latency elevated; handoff succeeded late.' },
    { start: '2026-05-06T10:40:00Z', config: 'B', pair: 'P4', validity: 'valid', warning: 108, cont: 0.95, rmse: 32, lat: 2.1, ftr: 0.9 },
    { start: '2026-05-06T11:30:00Z', config: 'A', pair: 'P4', validity: 'valid', warning: 74, cont: 0.96, rmse: 25, lat: 1.4, ftr: 0.5, improvement: 34 },
    { start: '2026-05-07T08:10:00Z', config: 'A', pair: 'P5', validity: 'conditionally-valid', warning: 69, cont: 0.96, rmse: 29, lat: 1.7, ftr: 0.3, note: 'Truth telemetry gap overlapped the decision-ready event; sensing measures only.' },
    { start: '2026-05-07T09:00:00Z', config: 'A', pair: 'P5', validity: 'valid', warning: 69, cont: 0.96, rmse: 28, lat: 1.7, ftr: 0.3, note: 'Repeat of the conditionally valid attempt.' },
    { start: '2026-05-07T09:50:00Z', config: 'B', pair: 'P5', validity: 'valid', warning: 88, cont: 0.94, rmse: 34, lat: 2.6, ftr: 1.4, improvement: 19 },
    { start: '2026-05-07T10:40:00Z', config: 'B', pair: 'P6', validity: 'valid', warning: 104, cont: 0.95, rmse: 33, lat: 2.3, ftr: 1.0 },
    { start: '2026-05-07T11:30:00Z', config: 'A', pair: 'P6', validity: 'valid', warning: 76, cont: 0.97, rmse: 27, lat: 1.5, ftr: 0.4, improvement: 28 },
  ]

  const at = (start: string, offsetS: number) =>
    new Date(Date.parse(start) + offsetS * 1000).toISOString()

  const setObs = (run: TeRun, measureId: string, patch: Partial<MeasureObservation>) => {
    const o = run.observations.find((x) => x.measureId === measureId)
    if (o) Object.assign(o, patch)
  }

  for (const spec of specs) {
    const run = emptyRun(id('RUN'), card)
    run.startAt = spec.start.replace('Z', '.000Z')
    run.endAt = at(spec.start, 270)
    run.roles = [
      { role: 'test-conductor', person: 'Hugh (real person; run assignment illustrative)' },
      { role: 'data-monitor', person: 'Andrew (real person; run assignment illustrative)' },
      { role: 'system-operator', person: 'Blue operator crew (illustrative)' },
      { role: 'red-threat-lead', person: 'Red air operator (illustrative)' },
      { role: 'customer-witness', person: 'Government remote observers, national capital region' },
    ]
    run.actualsNote = `Configuration ${spec.config}; pair ${spec.pair}; cell AZ-BND / ALT-60 / SPD-30.${spec.note ? ' ' + spec.note : ''}`

    // Event timeline: boundary crossing at start + 240 s; decision-ready
    // (usable C2 track) at boundary minus warning; latency separates the
    // qualifying source track from the usable C2 track.
    const usable = 240 - spec.warning
    run.events = [
      ev('Threat enters eligibility region.', at(spec.start, 60)),
      ev('First valid detection.', at(spec.start, usable - spec.lat - 18)),
      ev('First stable track.', at(spec.start, usable - spec.lat - 5)),
      ev('Qualifying source track.', at(spec.start, usable - spec.lat)),
      ev(
        'Usable C2 track.',
        at(spec.start, usable),
        spec.validity === 'conditionally-valid'
          ? 'Truth gap overlapped the decision-ready event; event time not reconstructable against truth.'
          : '',
      ),
      ev('Operator decision.', at(spec.start, usable + 8)),
      ev('Assignment.', at(spec.start, usable + 12)),
      ev('Represented effect-ready event.', at(spec.start, usable + 20)),
      ev('Protected-boundary crossing.', at(spec.start, 240)),
      ev('Run complete.', at(spec.start, 270)),
    ]

    // First-stable-track distance to boundary at 30 m/s, consistent with the
    // event timeline: (warning + latency + 5 s) x 30 m/s.
    const fstRange = Math.round((spec.warning + spec.lat + 5) * 30)

    if (spec.validity === 'valid') {
      setObs(run, m01.id, { status: 'observed', value: spec.warning })
      if (spec.improvement !== undefined) {
        setObs(run, m02.id, {
          status: 'observed',
          value: spec.improvement,
          note: `Pair ${spec.pair}: Configuration B minus Configuration A.`,
        })
      } else {
        setObs(run, m02.id, {
          status: 'no-test',
          note: 'Pair-level measure; reported once per matched pair.',
        })
      }
      setObs(run, m04.id, { status: 'observed', value: fstRange })
      setObs(run, m05.id, { status: 'observed', value: spec.cont })
      setObs(run, m06.id, { status: 'observed', value: spec.rmse })
      setObs(run, m07.id, {
        status: 'observed',
        success: true,
        note: spec.anomaly ? 'Handoff succeeded late; delayed adapter message.' : '',
      })
      setObs(run, m08.id, { status: 'observed', value: spec.lat })
      setObs(run, m09.id, { status: 'observed', value: spec.ftr })
      run.validity = 'valid'
      run.preliminaryUse = 'usable'
      run.adjudications = [
        {
          version: 1,
          at: at(spec.start, 900),
          by: 'Hugh (test conductor)',
          validity: 'valid',
          reason: 'All required validity conditions passed.',
        },
      ]
      run.initialDataQuality = 'All required sources present and healthy.'
      run.debrief = {
        plannedVsOccurred: 'Run executed as planned on the issued card.',
        differences: spec.anomaly ? 'FA-1 adapter message delayed at handoff.' : 'None.',
        sourcesRecorded: 'Truth, EW-1, TRK-1, FA-1, C2-1, environment, run log.',
        warningsOrFailures: spec.anomaly ? 'Adapter queue warning during handoff.' : 'None.',
        unexpectedResult: spec.anomaly ? 'Elevated source-to-C2 latency.' : 'None.',
        repeatNeeded: 'No.',
      }
    } else if (spec.validity === 'invalid') {
      for (const m of card.measureIds) setObs(run, m, { status: 'invalid' })
      run.validity = 'invalid'
      run.preliminaryUse = 'repeat'
      run.prohibitedUses = 'Invalid for all primary measures.'
      run.limits = 'Threat route outside the cell tolerance.'
      run.adjudications = [
        {
          version: 1,
          at: at(spec.start, 900),
          by: 'Hugh (test conductor)',
          validity: 'invalid',
          reason:
            'Threat route outside the sector-boundary cell tolerance; run invalid for all primary measures; repeated as the next run.',
        },
      ]
      run.initialDataQuality = 'Sources healthy; threat profile out of tolerance.'
      run.debrief = {
        plannedVsOccurred: 'Threat drifted off the approved approach line during the scored approach.',
        differences: 'Actual azimuth outside the sector-boundary tolerance.',
        sourcesRecorded: 'Truth, EW-1, TRK-1, FA-1, C2-1, environment, run log.',
        warningsOrFailures: 'Route-tolerance alarm from the truth monitor.',
        unexpectedResult: 'None beyond the route drift.',
        repeatNeeded: 'Yes; repeat scheduled immediately.',
      }
    } else {
      setObs(run, m01.id, {
        status: 'invalid',
        note: 'Critical truth gap overlapped the decision-ready event.',
      })
      setObs(run, m02.id, { status: 'no-test', note: 'Pair-level measure; pair repeated.' })
      setObs(run, m04.id, { status: 'observed', value: fstRange })
      setObs(run, m05.id, { status: 'observed', value: spec.cont })
      setObs(run, m06.id, { status: 'observed', value: spec.rmse })
      setObs(run, m07.id, { status: 'invalid', note: 'Decision-ready event not reconstructable.' })
      setObs(run, m08.id, { status: 'invalid', note: 'Decision-ready event not reconstructable.' })
      setObs(run, m09.id, { status: 'observed', value: spec.ftr })
      run.validity = 'conditionally-valid'
      run.allowedMeasureIds = [m04.id, m05.id, m06.id, m09.id]
      run.prohibitedUses = 'Not usable for warning time, paired improvement, handoff, or latency.'
      run.limits = 'Sensing measures only; truth gap overlapped the decision-ready event.'
      run.preliminaryUse = 'limited'
      run.adjudications = [
        {
          version: 1,
          at: at(spec.start, 900),
          by: 'Hugh (test conductor)',
          validity: 'conditionally-valid',
          reason:
            'Truth telemetry gap overlapped the decision-ready event; valid for named sensing measures only; pair repeated.',
        },
      ]
      run.initialDataQuality = 'Truth telemetry gap of 2.4 s during the handoff window.'
      run.debrief = {
        plannedVsOccurred: 'Run executed as planned; truth telemetry dropped briefly.',
        differences: 'Truth gap overlapped the decision-ready event.',
        sourcesRecorded: 'EW-1, TRK-1, FA-1, C2-1, environment, run log; truth with gap.',
        warningsOrFailures: 'Truth telemetry gap alarm.',
        unexpectedResult: 'None.',
        repeatNeeded: 'Yes for warning and latency; sensing evidence retained.',
      }
    }

    if (spec.deviation) {
      const dev = emptyDeviation(id('DEV'), run.id, card.id)
      dev.at = at(spec.start, 200)
      dev.plannedState =
        'Threat route, altitude, and speed inside the AZ-BND / ALT-60 / SPD-30 cell tolerance.'
      dev.actualState =
        'Threat drifted off the approved approach line; actual azimuth outside the sector-boundary tolerance.'
      dev.directObservation =
        'Truth telemetry showed the approach azimuth drifting past the cell tolerance during the scored approach.'
      dev.affected = 'All primary measures for this run.'
      dev.immediateAction = 'Completed the run for data continuity; scheduled an immediate repeat.'
      dev.dataPreserved = true
      dev.effect = 'material'
      dev.validityEffect = 'Run invalid for all primary measures.'
      dev.disposition = 'repeat'
      dev.approver = 'Hugh (test conductor)'
      dev.easierOrHarder = 'neutral-unknown'
      dev.generalizationLimit = 'None; the repeat run replaces this attempt.'
      c.deviations.push(dev)
      run.deviationIds = [dev.id]
    }

    if (spec.anomaly) {
      const anom = emptyAnomaly(id('ANOM'), run.id)
      anom.at = at(spec.start, 240 - spec.warning)
      anom.observation =
        'Delayed FA-1 adapter message under the sector-boundary condition: the outbound object message arrived at C2-1 late and source-to-C2 latency was elevated on the affected run.'
      anom.source = 'FA-1 and network transmission logs; C2-1 event log.'
      anom.classification = 'system-behavior'
      anom.missionEffect =
        'Late decision-ready track reduces usable warning time in the sector-boundary geometry.'
      anom.candidateCauses =
        'Stale-object handling in FA-1/C2-1 correlation; queue backlog after the configuration switch.'
      anom.distinguishingEvidence =
        'Queue state and message timestamps in the FA-1 log; correlation decisions in the C2-1 log.'
      anom.preservationAction = 'Full message payload and metadata preserved with the run record.'
      anom.diagnosticAction = 'Add correlation diagnostics to the Workbench data view.'
      anom.rootCauseStatus = 'supported'
      anom.correctiveAction = 'Correct stale-object handling in FA-1/C2-1.'
      anom.verificationTest =
        'Repeat the sector-boundary condition after the correction; confirm that added filtering does not reduce early warning; re-run the eight-opportunity Configuration B confirmation set.'
      anom.owner = 'Andrew'
      anom.open = true
      c.anomalies.push(anom)
      run.anomalyIds = [anom.id]
    }

    c.runs.push(run)
  }

  // Finding and action
  const finding = emptyFinding(id('FIND'))
  finding.statement =
    'Under the tested fixed-site configuration, Group 2 fixed-wing surrogate, operator procedure, clear-day conditions, and nominal network state, adding the EW-1 early-warning layer increased median paired decision-ready warning time by 46 seconds. Configuration B produced a +33-second median mission margin compared with -14 seconds for the baseline. Track continuity and position error remained inside the customer limits. The added layer increased nuisance-track burden and exposed a sector-boundary correlation weakness. The evidence supports continued integration and focused regression. It does not establish performance against other threat classes, adaptive profiles, contested spectrum, saturation, or another engagement chain.'
  finding.quantifiedResult =
    'Median paired improvement 46 s; 95 percent bootstrap interval 35 to 57 s. Mission margin: B +33 s median, A -14 s median. Continuity 0.96 versus 0.94 (difference -0.02, allowed 0.03). Median RMSE 28 m versus 34 m (limit 50 m). Handoff: matched 18 of 20, confirmatory 7 of 8, combined 25 of 28. Added 90th-percentile latency 0.6 s (allowed 1.0 s). False-track rate 0.4 versus 1.2 per hour (limit 1.5). Sector-boundary cell: median paired improvement 28 s; 2 of 6 Config B opportunities below the 90 s threshold; 2 of 3 handoff anomalies. Illustrative fixture values.'
  finding.questionId = q1.id
  finding.hypothesisId = h1.id
  finding.supportingRunIds = c.runs.filter((r) => r.validity === 'valid').map((r) => r.id)
  finding.configId = cfg.id
  finding.threatIds = [threat.id]
  finding.conditionIds = [cond.id]
  finding.measureIds = [m01.id, m02.id, m05.id, m06.id, m07.id, m08.id, m09.id, m10.id]
  finding.thresholdComparison =
    'All seven customer decision rules met at the campaign level; the 90 s threshold missed in 2 of 6 sector-boundary Configuration B opportunities (partial-miss rule applies).'
  finding.sampleAndIndependence =
    '20 matched valid A/B pairs campaign-wide plus 8 Configuration B confirmation opportunities; one experimental unit per independently reset threat presentation.'
  finding.uncertaintyNote =
    '95 percent bootstrap interval on the paired median: 35 to 57 s. The 90 percent threshold-achievement Wilson interval is too wide for a universal claim; it supports the screening and next-phase decision.'
  finding.missingAndExcludedData =
    '4 runs invalid for all primary measures; 2 conditionally valid for sensing only. Keep primary, best-case, and worst-case treatments of anomalous runs visible: excluding the 3 Config B handoff anomalies makes the estimate artificially favorable.'
  finding.confoundersAndAlternatives =
    'Nuisance risks mitigated by blocking, reset, randomization, and capture rules; sector-boundary geometry effect distinguished from an interface effect by focused augmentation.'
  finding.strength = 'conclusive'
  finding.ladderLevel = 'interpretation'
  finding.appliesTo =
    'The tested fixed-site configuration, Group 2 fixed-wing surrogate, operator procedure, clear-day conditions, nominal network state, and tested approach geometries.'
  finding.doesNotApplyTo =
    'Other threat classes, adaptive profiles, contested spectrum, saturation, another engagement chain, untested geometries.'
  finding.assumptions =
    'ENG-1 approved time-to-effect representation; required chain time 80 s plus 10 s reserve.'
  finding.decisionImplication =
    'Configuration B advances to the next controlled phase with restrictions.'
  finding.customerEffect =
    'Select Configuration B for the controlled pilot; treat the sector boundary as a known limitation.'
  finding.recommendedAction =
    'Proceed with Configuration B for the next controlled phase; use the tested sensor placement and software baseline; do not claim coverage outside tested approach geometries; treat the sector-boundary region as a known limitation; keep the current operator procedure until the nuisance-track workflow is tested; do not generalize to another threat signature or guidance method.'
  finding.comparisonWithPrediction =
    'Predicted paired increase 35-55 s; observed 46 s median with interval 35-57 s. Config A predicted 70-90 s, observed median 76 s; Config B predicted 110-140 s, observed median 123 s.'
  finding.approvers = 'Hugh (deployment strategist)'
  c.findings = [finding]

  const action = {
    id: id('ACT'),
    findingId: finding.id,
    decisionOwner: 'JIATF-401 customer decision owner',
    executionOwner: 'Valkryn (Andrew, forward-deployed engineer)',
    dueDate: '2026-06-01 (illustrative)',
    requiredWork:
      '1. Correct stale-object handling in FA-1/C2-1. 2. Add correlation diagnostics to the Workbench data view. 3. Repeat the sector-boundary condition after the correction. 4. Confirm that added filtering does not reduce early warning. 5. Re-run the eight-opportunity Configuration B confirmation set.',
    evidenceForClosure:
      'Regression package: twelve focused sector-boundary opportunities; six nominal-network and six degraded-network opportunities; paired pre-fix/post-fix comparison if both builds remain available; primary outputs: handoff success, latency, warning time, continuity, nuisance-track rate.',
    riskIfLate:
      'The sector-boundary correlation weakness remains the main residual performance risk for the pilot deployment.',
    status: 'open' as const,
    communicationRequired:
      'Report regression results to the customer before the next-phase decision.',
  }
  c.actions = [action]

  return c
}

