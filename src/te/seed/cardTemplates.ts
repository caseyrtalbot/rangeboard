/**
 * Worked card templates (MASTER-SEEDDATA section 2): five gold-standard worked
 * cards plus one complete notional card. Bracketed [placeholders] are intended;
 * the app blocks card issue until every one resolves to a controlled record.
 * Source disclaimer carried on all six: "These cards are illustrative designs,
 * not reconstructions of a Valkryn campaign and not Valkryn performance results."
 */

import type { ProcedureStep, RunRole, TeCard } from '../model/types'
import { newId } from '../../model/types'

export interface CardTemplate {
  key: string
  name: string
  summary: string
  patch: Partial<TeCard>
}

function step(
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

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    key: 'TC-CUAS-SEN-CHAR-001',
    name: 'Detection and stable-track characterization by geometry',
    summary:
      'Characterize the sensor\'s valid detection and track boundary under one controlled configuration and approved factor cell. Illustrative design, not a reconstruction of a Valkryn campaign and not Valkryn performance results.',
    patch: {
      cardCode: 'TC-CUAS-SEN-CHAR-001',
      title: 'Detection and stable-track characterization by geometry',
      version: '[version]',
      status: 'draft',
      questionIds: [
        '[question: Under the defined threat and conditions, where does the sensor detect and establish a stable track?]',
      ],
      hypothesisIds: [
        '[hypothesis: Detection and stable-track performance vary with [range, altitude, azimuth/aspect, speed, or selected factors]]',
      ],
      measureIds: [
        'CUAS-SEN-PD-001',
        'CUAS-SEN-FD-002',
        'CUAS-TRK-FST-003',
        'CUAS-TRK-CONT-004',
        'CUAS-TRK-ERR-005',
        'CUAS-SUR-FTR-007',
      ],
      matrixCellId: '[cell ID]',
      linkedEntityIds: ['[decision ID]'],
      purpose:
        'Characterize the sensor\'s valid detection and track boundary under one controlled configuration and approved factor cell.',
      orderAndBlocking:
        'Valid opportunities required [from quantitative design]; Current repetition/block [number and block]; Order [randomized or restricted schedule]; Blocking [day, operator, threat article, weather, or none]; Invalid-run allowance [planning value only]',
      systemStateNote:
        'Sensor/configuration [configuration ID]; Placement/boresight [registration record]; Network/C2 state [included or isolated]',
      operators: 'Operator procedure [procedure ID]',
      trainingState: 'Training state [record]',
      redInitialState:
        'Threat profile [threat-profile ID]; Truth-object ID assigned before run; Geometry [route, altitude, speed, approach azimuth/aspect]; Fidelity limitations [threat record]',
      redControlled: 'Red-controlled variables [exact list]',
      redFixed: 'Held variables [exact list]',
      conditionNote:
        'Condition ID [weather, clutter, illumination, RF/network state]; Eligibility volume/range band [controlled definition]',
      operatingLimits: 'Limits [from condition record]',
      independentFactorIds: ['[selected geometry or configuration factors]'],
      heldFactorIds: [
        'sensor settings',
        'placement',
        'threat profile elements',
        'operator procedure',
        'other design controls',
      ],
      covariateFactorIds: [
        'actual speed/altitude/aspect',
        'weather',
        'RF state',
        'temperature',
        'battery/power state',
        'time of day as applicable',
      ],
      dataSources: 'Sensor plots/tracks/status [source fields]; Registration record [ID]',
      groundTruth:
        'Independent trajectory/identity truth [source ID]; Ground-truth coverage: complete eligibility interval',
      commonTimeAndTolerance: 'Common time/tolerance [time record and measure-specific limit]',
      dataEquipmentStops:
        'Health stop: loss of mandatory truth, unknown configuration, time/registration outside tolerance, or source gap exceeding the measure rule.',
      preconditions: [
        'Correct card/run/configuration/threat/condition IDs active.',
        'Sensor available and approved settings loaded.',
        'Truth and sensor recording active.',
        'Clocks and registration pass.',
        'Route and operating volume ready.',
        'Data-health alerts and fallback tested.',
        'Active campaign constraints and stop conditions confirmed.',
      ],
      procedure: [
        step('Test conductor states card, version, run ID, purpose, and matrix cell.', 'test-conductor'),
        step('Data monitor confirms sensor, truth, environment, and run-log recording.', 'data-monitor', { recorder: true }),
        step('Ground-truth operator confirms truth-object identity and health.', 'ground-truth-operator', { invalidates: true }),
        step('Sensor operator confirms configuration without changing approved settings.', 'system-operator', { invalidates: true }),
        step('Threat begins outside the eligible interval.', 'red-threat-lead'),
        step('Test conductor authorizes entry into the profile.', 'test-conductor'),
        step('Threat executes the approved route and factor levels.', 'red-threat-lead', { invalidates: true }),
        step('Run logger time-tags entry, phase transitions, operator calls, data warnings, and exit.', 'run-logger'),
        step('Threat exits or enters the approved recovery state.', 'red-threat-lead'),
        step('Continue recording for the post-event margin.', 'data-monitor'),
        step('Save actual configuration, threat, condition, truth, and source records.', 'data-monitor', { recorder: true }),
        step('Conduct factual debrief and assign preliminary data-health state.', 'test-conductor'),
      ],
      expectedResult:
        'The system may transition through no report, detection, tentative track, stable track, loss, and reacquisition states. No performance value is assumed.',
      requiredValidityConditions:
        'Valid for a measure only if: truth establishes the full opportunity; configuration and profile remain within bounds; association, time, and registration meet tolerance; required source health passes; no uncontrolled change affects the measure.',
      invalidatingFailures: 'Repeat when a written validity rule fails.',
      conditionalUses: 'Preserve valid failures as results.',
      requiredFiles:
        'Opportunity-level detection outcome; first-detection and first-stable-track observation or censoring record; track continuity and error; false/nuisance-track accounting; data-health and uncertainty record; run status and allowed/prohibited uses.',
      allowedConclusion:
        'Performance under the tested configuration, threat, geometry, and conditions.',
      prohibitedConclusion:
        'Universal detection range, all-aspect coverage, or operational effectiveness outside the tested factor space.',
    },
  },
  {
    key: 'TC-CUAS-C2-HANDOFF-001',
    name: 'Source-track fusion and C2 handoff performance',
    summary:
      'Measure source-to-C2 success, identity correctness, latency, and usable warning time while isolating interface behavior. Illustrative design, not a reconstruction of a Valkryn campaign and not Valkryn performance results.',
    patch: {
      cardCode: 'TC-CUAS-C2-HANDOFF-001',
      title: 'Source-track fusion and C2 handoff performance',
      version: '[version/status]',
      status: 'draft',
      questionIds: [
        '[question: When the source sensor produces a qualifying track, does the receiving C2 create the correct usable track within the mission timeline?]',
      ],
      hypothesisIds: [
        '[hypothesis: [configuration B or interface state] changes handoff success or latency relative to [baseline]]',
      ],
      measureIds: ['CUAS-C2-HS-008', 'CUAS-C2-LAT-009', 'CUAS-MSN-UWT-010'],
      matrixCellId: '[source x C2 x network x threat/condition]',
      purpose:
        'Measure source-to-C2 success, identity correctness, latency, and usable warning time while isolating interface behavior.',
      orderAndBlocking:
        'Qualifying offers required per cell [design]; Configuration order [randomized/blocked]; Network blocks [nominal/degraded as approved]; Pairing [whether the same controlled input supports paired comparisons]',
      systemStateNote:
        'Source configuration [ID]; C2 configuration [ID]; Adapter/schema/version [ID]; Network state [condition ID]; Correlation/fusion settings [ID]; Operator procedure and information state [ID]',
      redInitialState:
        'Use either: a live truth threat producing a qualifying source track; or a verified recorded/synthetic input approved for the interface question. Rule: do not use synthetic input to claim live sensor performance.',
      eventMarks: [
        'Start: source track first meets the approved qualifying-offer criterion.',
        'Send: source/adapter records the outbound object/message.',
        'Receive: C2 records receipt.',
        'Usable stop: receiving C2 track meets the decision-ready criterion.',
      ],
      measuresNote: 'Failure window: [approved maximum observation interval]',
      dataSources:
        'Source-track fields and event logs; adapter/network transmission logs; receiving-system object/event logs; identifier map preserving source, master, and receiver IDs.',
      groundTruth: 'Truth/master-object correlation.',
      commonTimeAndTolerance: 'Common time meeting latency tolerance.',
      procedure: [
        step('Confirm configurations, schema, identifiers, and time.', 'data-monitor', { invalidates: true }),
        step('Start all source, adapter, network, C2, truth, and run-log recorders.', 'data-monitor', { recorder: true }),
        step('Generate the approved qualifying source track.', 'red-threat-lead'),
        step('Preserve normal operational processing; no coaching or manual repair.', 'system-operator', { invalidates: true }),
        step('Record source qualification, send, receive, correlation, and usable-track events.', 'run-logger'),
        step('Continue through success, approved timeout, or stop condition.', 'test-conductor'),
        step('Save message payload/metadata allowed by the campaign record.', 'data-monitor', { recorder: true }),
        step('Reset the interface and object state.', 'system-technical-lead'),
        step('Verify no stale track or queued message carries into the next run.', 'data-monitor', { invalidates: true }),
        step('Adjudicate identity, success, latency, and failure category.', 'test-conductor'),
      ],
      holdConditions:
        'Stop/hold for: clock offset beyond latency tolerance; ambiguous object identity; unapproved schema/configuration change; mandatory log loss; stale state from the prior run; network condition outside the card.',
      requiredValidityConditions: 'A valid failed handoff remains in the denominator.',
      requiredFiles:
        'Successful handoffs / valid qualifying opportunities; source-to-receive and source-to-usable latency with censoring; correct, duplicate, split, merged, stale, or misassociated outcomes; usable warning time; failure-stage classification; allowed/prohibited comparisons.',
      allowedConclusion:
        'Interface/fusion performance for the tested source, C2, adapter, network, object state, and operational criterion.',
      prohibitedConclusion:
        'End-to-end mission effectiveness when sensing, decision, engagement, or effect was not represented.',
    },
  },
  {
    key: 'TC-CUAS-EW-SOFTKILL-001',
    name: 'Mission-relevant EW effect and recovery',
    summary:
      'Characterize a bounded functional or mission effect without equating temporary disruption with physical defeat. Illustrative design, not a reconstruction of a Valkryn campaign and not Valkryn performance results.',
    patch: {
      cardCode: 'TC-CUAS-EW-SOFTKILL-001',
      title: 'Mission-relevant EW effect and recovery',
      version: '[version/status]',
      status: 'draft',
      questionIds: [
        '[question: Under the approved threat, geometry, and represented EW condition, does the threat enter the defined mission-relevant effect state, and for how long?]',
      ],
      hypothesisIds: [
        '[hypothesis: The treatment changes the probability or time of the defined effect relative to the approved baseline/control]',
      ],
      measureIds: ['CUAS-EW-EFF-011', 'CUAS-EW-REC-012', 'CUAS-MSN-E2E-015'],
      matrixCellId: '[threat guidance x geometry x treatment x environment]',
      purpose:
        'Characterize a bounded functional or mission effect without equating temporary disruption with physical defeat.',
      orderAndBlocking:
        'Valid opportunities per treatment/control cell [design]; Treatment order [randomized or blocked]; Washout/reset [approved state and duration]; Threat article/software blocks [design]; Sequential rule [if used]',
      redInitialState:
        'Threat profile/configuration [ID]; Guidance/navigation/communications state [ID]; Mission task [defined route or objective]; Independent truth telemetry/state sources [IDs]; Reset state verified before each opportunity.',
      conditionNote:
        'Treatment state (reference the approved campaign representation): treatment condition ID; commanded/applied state; monitored exposure fields; geometry and timing; control or sham condition; permitted factor variation; applicable operating limits.',
      measuresNote:
        'CUAS-MSN-E2E-015 applies when a complete mission vignette is represented. Effect definition, freeze one or more states: navigation deviation beyond [criterion]; loss of control or guidance for [criterion]; mission-route abandonment; failure to reach a required waypoint/terminal condition; forced recovery or safe-state entry; temporary suppression; recovery to nominal mission state. Rule: do not change the effect definition after viewing results.',
      dataSources:
        'Treatment exposure/event record; threat onboard telemetry when allowed; environmental/RF record; operator actions; effect-state adjudication record.',
      groundTruth: 'Independent threat trajectory and state.',
      commonTimeAndTolerance: 'Common time meeting effect-latency tolerance.',
      procedure: [
        step('Confirm active card, profile, treatment/control condition, and run ID.', 'test-conductor'),
        step('Verify threat reset and nominal function.', 'red-threat-lead', { invalidates: true }),
        step('Start truth, treatment, environment, telemetry, and run-log recording.', 'data-monitor', { recorder: true }),
        step('Begin the approved threat mission.', 'red-threat-lead'),
        step('Establish the qualifying baseline state.', 'red-threat-lead'),
        step('Apply the approved treatment or control according to the card.', 'system-operator', { invalidates: true }),
        step('Time-tag treatment qualification.', 'run-logger'),
        step('Observe until effect, recovery, vignette end, censoring, or stop.', 'data-monitor'),
        step('Return systems to the approved safe/reset state.', 'system-operator'),
        step('Preserve as-commanded and as-observed treatment records.', 'data-monitor', { recorder: true }),
        step('Adjudicate effect, time to effect, recovery, mission outcome, and validity.', 'test-conductor'),
      ],
      safetyStops:
        'Stop under existing campaign controls for any safety, regulatory, system, data, or security trigger.',
      invalidatingFailures:
        'Measure invalid when: qualifying exposure cannot be established; threat state or mission task differs materially; independent effect truth is unavailable; time alignment exceeds tolerance; reset/carryover cannot be excluded.',
      requiredFiles:
        'Effect successes / valid opportunities; time to effect and recovery with censored cases; effect mode and duration; mission outcome; treatment/exposure uncertainty; carryover and repeatability assessment; conditions where generalization is prohibited.',
      allowedConclusion:
        'Bounded functional or mission effect under the represented treatment, threat state, geometry, and conditions.',
      prohibitedConclusion:
        'Universal susceptibility, legal operational employment, physical destruction, or effectiveness against an unrepresented foreign system.',
    },
  },
  {
    key: 'TC-CUAS-DEF-INTERCEPT-001',
    name: 'Interceptor assignment, intercept, and confirmed defeat',
    summary:
      'Separate failures in detection, decision, assignment, launch, guidance, intercept, effect, and mission outcome. Illustrative design, not a reconstruction of a Valkryn campaign and not Valkryn performance results.',
    patch: {
      cardCode: 'TC-CUAS-DEF-INTERCEPT-001',
      title: 'Interceptor assignment, intercept, and confirmed defeat',
      version: '[version/status]',
      status: 'draft',
      questionIds: [
        '[question: Does the tested kill-chain configuration create and execute a valid engagement that defeats the defined threat before the mission boundary?]',
      ],
      hypothesisIds: [
        '[hypothesis: The tested architecture achieves a higher probability of confirmed defeat or greater engagement margin than [baseline/comparison]]',
      ],
      measureIds: [
        'CUAS-C2-LAT-009',
        'CUAS-MSN-UWT-010',
        'CUAS-DEF-PINT-013',
        'CUAS-DEF-PDEF-014',
        'CUAS-MSN-E2E-015',
      ],
      matrixCellId: '[sensor/C2/effector x threat x geometry x condition]',
      purpose:
        'Separate failures in detection, decision, assignment, launch, guidance, intercept, effect, and mission outcome.',
      orderAndBlocking:
        'Valid engagement opportunities [design]; Threat/effector article blocks [design]; Configuration order [design]; Rare severe failures [handling rule]; Reset/maintenance criteria [record]',
      systemStateNote:
        'Blue architecture/configuration [ID]; Interceptor/effector article and state [ID]; Threat profile/article [ID]; Engagement and defended-asset boundaries [geometry record]; Operator procedure [ID]; Inventory and readiness state [record]',
      measuresNote:
        'Event chain: freeze the exact event criterion for each stage: qualifying track -> decision-ready track -> assignment -> authorization if represented -> launch/release -> guidance -> intercept -> effect -> defeat assessment -> boundary or mission outcome.',
      eventMarks: [
        'Qualifying track.',
        'Decision-ready track.',
        'Assignment.',
        'Authorization if represented.',
        'Launch/release.',
        'Guidance.',
        'Intercept.',
        'Effect.',
        'Defeat assessment.',
        'Boundary or mission outcome.',
      ],
      dataSources:
        'Sensor/C2 track and decision logs; assignment and launch/release events; effector health/guidance state; independent intercept/effect evidence; boundary crossing and threat mission outcome.',
      groundTruth: 'Threat and interceptor trajectories; independent intercept/effect evidence.',
      commonTimeAndTolerance:
        'Common time and spatial registration inside approved uncertainty.',
      procedure: [
        step('Confirm complete blue/red configurations and truth coverage.', 'test-conductor', { invalidates: true }),
        step('Start all recorders before threat entry.', 'data-monitor', { recorder: true }),
        step('Execute the approved threat vignette.', 'red-threat-lead'),
        step('Allow the architecture and operators to follow the frozen procedure.', 'system-operator', { invalidates: true }),
        step('Prevent unapproved coaching, tuning, reset, or vendor intervention.', 'test-conductor', { invalidates: true }),
        step('Time-tag every mission-thread transition.', 'run-logger'),
        step('Execute the engagement within active controls.', 'system-operator'),
        step('Continue truth and outcome recording through assessment and post-event margin.', 'data-monitor', { recorder: true }),
        step('Recover systems and preserve physical/electronic evidence.', 'system-technical-lead'),
        step('Conduct factual debrief.', 'test-conductor'),
        step('Adjudicate each mission-thread stage, intercept, effect, defeat, and validity.', 'test-conductor'),
      ],
      requiredValidityConditions:
        'A valid failure remains evidence. Classify the first mission-relevant failure stage: Detection; Track; Classification/identification; C2 handoff; Decision/assignment; Authorization/procedure; Launch/release; Guidance; Intercept; Effect; Assessment; Test infrastructure; Unknown. Unknown effect outcomes follow the approved primary and sensitivity rules.',
      requiredFiles:
        'Engagement timeline and margin; valid opportunity, intercept, and defeat counts; probability intervals; stage-specific failure classification; miss/intercept geometry with uncertainty; defeat confidence/adjudication; mission outcome; configuration, condition, and validity limits.',
      allowedConclusion:
        'End-to-end performance for the tested architecture, threat, operators, procedure, and conditions.',
      prohibitedConclusion:
        'Operational suitability, broader threat coverage, or effectiveness outside the tested articles and vignettes without supporting evidence.',
    },
  },
  {
    key: 'TC-CUAS-SAT-RAID-001',
    name: 'Multi-threat tracking, assignment, engagement, and leaker characterization',
    summary:
      'Identify system, interface, operator, or resource bottlenecks under controlled multi-threat load. Illustrative design, not a reconstruction of a Valkryn campaign and not Valkryn performance results.',
    patch: {
      cardCode: 'TC-CUAS-SAT-RAID-001',
      title: 'Multi-threat tracking, assignment, engagement, and leaker characterization',
      version: '[version/status]',
      status: 'draft',
      questionIds: [
        '[question: Under the defined raid size, arrival process, geometry, and threat mix, where does the architecture lose mission capacity?]',
      ],
      hypothesisIds: [
        '[hypothesis: Mission success, track continuity, or engagement completion changes as concurrent load increases]',
      ],
      measureIds: [
        'CUAS-TRK-CONT-004',
        'CUAS-C2-HS-008',
        'CUAS-C2-LAT-009',
        'CUAS-SAT-LEAK-016',
        'CUAS-HMI-INT-018',
        'CUAS-MSN-E2E-015',
      ],
      matrixCellId: '[raid size x spacing x geometry x threat mix x configuration]',
      purpose:
        'Identify system, interface, operator, or resource bottlenecks under controlled multi-threat load.',
      orderAndBlocking:
        'Raid sizes/levels [approved levels]; Arrival spacing or process [definition]; Threat mix [profiles and proportions]; Geometry [routes/axes/altitudes]; Configuration [ID]; Replications per raid cell [quantitative design]; Blocking [day, operator, article, configuration]; Escalation/sequential rule [preapproved rule]. Rule: do not escalate load merely because the prior run looked favorable unless the approved sequence permits it.',
      measuresNote:
        'Experimental units: primary mission unit is one complete valid raid; nested object unit is one truth threat within the raid. Preserve raid identity in all object-level analysis. Do not treat threats from one raid as independent raids.',
      systemStateNote:
        'Blue configuration and resource inventory [ID]; Operator/crew procedure and staffing [ID]; Threat profiles and coordination behavior [IDs]; Network/environment state [condition ID]; Reset state, queues, tracks, and inventory cleared before run.',
      dataSources:
        'Raid membership and planned/actual arrival times; blue source tracks and master-track associations; C2 queue, correlation, assignment, and engagement records; operator actions and workload/interventions; effector inventory, assignment, launch, and outcome; boundary crossing and mission outcome; system health, processor/network load, and resource state where available.',
      groundTruth: 'Identity-preserving truth for every threat.',
      procedure: [
        step('Confirm raid, threat-object, run, configuration, and condition IDs.', 'test-conductor'),
        step('Verify blue and red reset state.', 'system-technical-lead', { invalidates: true }),
        step('Start truth, blue, environment, operator, resource, and run-log recording.', 'data-monitor', { recorder: true }),
        step('Launch/initiate the approved raid according to the timing plan.', 'red-threat-lead'),
        step('Preserve planned red behavior and coordination bounds.', 'red-threat-lead', { invalidates: true }),
        step('Allow blue operators and systems to execute the frozen procedure.', 'system-operator', { invalidates: true }),
        step('Time-tag object entry, detection, track, classification, handoff, assignment, engagement, defeat, and boundary crossing.', 'run-logger'),
        step('Record queueing, dropped/merged/split tracks, operator interventions, and resource exhaustion.', 'run-logger'),
        step('Continue through raid completion or approved stop.', 'test-conductor'),
        step('Preserve post-event state and logs.', 'data-monitor', { recorder: true }),
        step('Adjudicate each threat and the raid-level mission outcome.', 'test-conductor'),
        step('Reset every queue, track, inventory, and system state before another raid.', 'system-technical-lead', { invalidates: true }),
      ],
      holdConditions:
        'Stop or hold for: loss of identity-preserving truth; threat spacing or raid membership outside tolerance; unapproved load or behavior; unknown blue resource/configuration state; common-time or correlation failure; safety, regulatory, system, or data-health trigger.',
      conditionalUses:
        'A raid may be conditionally valid for early-stage sensing measures but invalid for defeat if an effector or outcome source fails. Record measure-specific use.',
      requiredFiles:
        'Threat-object and raid counts; detection/track/handoff/engagement outcome by object; leaker fraction and raid-failure probability; concurrent-track, assignment, and engagement load; queueing and latency by mission stage; operator intervention rate; resource exhaustion and recovery; first observed capacity boundary; uncertainty, clustering, and validity limits.',
      allowedConclusion:
        'Architecture performance and observed bottlenecks for the tested raid definition, threat mix, geometry, configuration, operator procedure, and conditions.',
      prohibitedConclusion:
        'Universal swarm capacity, performance against autonomous coordination not represented, or a maximum capacity beyond the tested load.',
    },
  },
  {
    key: 'TC-CUAS-SOS-EWBUF-001',
    name: 'Complete notional counter-UAS test card',
    summary:
      'Customer question: Does adding an early-warning sensor to the baseline tracking-radar/C2 architecture create materially more usable warning time against the defined threat without degrading track quality or C2 handoff performance? Source caveat: "This is a recommended example, not a reconstruction of the JIATF-401 campaign. Systems, thresholds, configurations, repetitions, and procedures below must not be attributed to that case."',
    patch: {
      cardCode: 'TC-CUAS-SOS-EWBUF-001',
      title: 'Complete notional counter-UAS test card',
      version: 'v1.0',
      status: 'draft',
      questionIds: ['OQ-CUAS-004'],
      hypothesisIds: [
        '[hypothesis: Configuration B produces an earlier usable track than Configuration A while maintaining acceptable tracking and interface performance]',
      ],
      measureIds: [
        'CUAS-MSN-UWT-010',
        'CUAS-SEN-PD-001',
        'CUAS-TRK-ERR-005',
        'CUAS-TRK-CONT-004',
        'CUAS-C2-LAT-009',
        'CUAS-SUR-FTR-007',
      ],
      configId: '[CFG-A or CFG-B per run]',
      threatId: 'THR-G2-FW-01-v1',
      purpose: 'Characterize the operational value of an additional early-warning layer.',
      changedFactor: 'Architecture A/B',
      systemStateNote:
        'A (Baseline): Tracking sensor -> C2. B (Treatment): Early-warning sensor -> Tracking sensor -> C2. Exact hardware/software versions recorded in CFG-A and CFG-B.',
      redInitialState:
        'Representative Group 2 fixed-wing surrogate executing the customer-approved profile. Threat geometry, altitude, speed, navigation mode, emissions, and route are locked in the threat-profile object.',
      independentFactorIds: ['Architecture A/B'],
      heldFactorIds: ['threat profile', 'route', 'blue emplacement', 'blue operator procedure'],
      covariateFactorIds: ['weather', 'RF environment', 'target aspect', 'actual speed/altitude'],
      measuresNote:
        'Customer operational pass/fail threshold is an execution blocker until customer-approved. For characterization, report: estimated difference A versus B; confidence/credible interval; observed variability; any performance trade; validity limits.',
      dataSources:
        'Early-warning sensor telemetry; tracking sensor telemetry; C2 event logs; network timing logs; environmental/RF record; operator event log.',
      groundTruth: 'Independent threat-position source.',
      commonTimeAndTolerance: 'Clocks synchronized within approved measurement-error budget.',
      preconditions: [
        'Configuration manifests captured.',
        'Mandatory telemetry available.',
        'Independent threat ground truth operational.',
        'Clocks synchronized within approved measurement-error budget.',
        'Sensor calibration complete.',
        'C2 logging enabled.',
        'Range safety approval active.',
        'Weather and RF environment captured.',
      ],
      procedure: [
        step('Verify card, configuration, threat, and run ID.', 'test-conductor'),
        step('Snapshot hardware/software/configuration state.', 'data-monitor', { invalidates: true }),
        step('Verify mandatory feeds and timestamps.', 'data-monitor'),
        step('Conduct instrumentation health check.', 'system-technical-lead'),
        step('Execute dry run without scoring.', 'test-conductor'),
        step('Execute Configuration A run.', 'test-conductor'),
        step('Confirm data validity.', 'data-monitor'),
        step('Repeat according to statistical plan.', 'test-conductor'),
        step('Change only the architecture variable.', 'system-technical-lead', { invalidates: true }),
        step('Verify Configuration B baseline.', 'system-operator'),
        step('Execute Configuration B runs using the same approved threat conditions.', 'test-conductor'),
        step('Reduce mandatory measures.', 'data-monitor'),
        step('Compare A versus B.', 'deployment-strategist'),
        step('Record abnormalities and deviations.', 'run-logger'),
        step('Determine whether evidence is sufficient or another condition is required.', 'deployment-strategist'),
      ],
      expectedResult:
        'Configuration B should provide greater usable warning time; interpret any improvement alongside track quality, false tracks, and handoff latency.',
      safetyStops:
        'Immediate abort on: range-safety direction; aircraft outside authorized profile; unsafe system state; loss of safety-critical control; unauthorized emitter/system state.',
      dataEquipmentStops:
        'Pause or invalidate affected measure on: missing mandatory telemetry; failed ground truth; clock synchronization outside tolerance; unknown configuration change.',
      requiredValidityConditions:
        'Data-quality checks: mandatory data channels present; correct run ID applied to all sources; configuration hash/manifest unchanged; ground truth valid; timestamp alignment within approved tolerance; no unexplained data discontinuity during critical interval; threat profile remained within defined bounds.',
      requiredFiles:
        'Run-validity determination; annotated engagement timeline; per-measure results; configuration comparison; deviations; evidence limitations; remaining evidence gaps; recommended next test. Every deviation receives a DEV-### identifier associated with the run, affected measure, and resulting validity decision.',
    },
  },
]
