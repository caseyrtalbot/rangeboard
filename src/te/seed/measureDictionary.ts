/**
 * Controlled measure dictionary seed (MASTER-SEEDDATA cross-referenced
 * with MASTER-CALCULATIONS). 20 canonical entries: the 18 CUAS-*
 * registry rows plus the two campaign-local derived measures M-02 and M-10.
 * Full math lives in MASTER-CALCULATIONS.md; cards reference these IDs.
 */

import type { MeasureFamily, MeasureType, TeMeasure } from '../model/types'
import { emptyMeasure } from '../model/empty'

export interface MeasureDictEntry {
  dictKey: string
  name: string
  family: MeasureFamily
  measureType: MeasureType
  unit: string
  definition: string
  numeratorRule: string
  denominatorRule: string
  startEvent: string
  stopEvent: string
  experimentalUnit: string
  higherIsBetter: boolean
  notes: string
}

export const MEASURE_DICTIONARY: MeasureDictEntry[] = [
  {
    dictKey: 'CUAS-SEN-PD-001',
    name: 'Probability of detection',
    family: 'binomial',
    measureType: 'probability',
    unit: 'fraction',
    definition:
      'During valid opportunities under the defined condition, how often the sensor produces a valid detection of the truth object',
    numeratorRule:
      'Valid opportunities with at least one valid detection event: a sensor-originated report during the eligible interval, associated with the correct truth object under the approved spatial, temporal, identity, and persistence gate, meeting the approved confidence, quality, and declaration state, not a duplicate or excluded artifact',
    denominatorRule:
      'Total valid detection opportunities in the same defined cell. Eligible only if the sensor is in approved configuration and declared available, truth covers the full interval, the threat stays inside profile and condition bounds, and instrumentation and time alignment are within tolerance',
    startEvent: 'Truth shows the threat enters the approved surveillance volume, range band, or time window',
    stopEvent: 'Truth exit, vignette end, or approved censoring',
    experimentalUnit: 'One valid detection opportunity',
    higherIsBetter: true,
    notes:
      'No inherent threshold. JIATF open question preserved: "How is Pd (probability of detection) properly defined?" Never claim detection probability outside the tested factor space; never collapse materially different conditions into one average.',
  },
  {
    dictKey: 'CUAS-SEN-FD-002',
    name: 'First-detection range or time',
    family: 'latency',
    measureType: 'time-to-event',
    unit: 's (time form) or m (range form)',
    definition:
      'Where or when the first valid detection occurs (truth-derived range or elapsed time; censoring supported)',
    numeratorRule:
      'First-detection time equals first valid detection time minus eligibility-start time. Range form: truth-derived slant range, ground range, or distance to the defended boundary at the first valid detection event',
    denominatorRule:
      'Censored when no detection occurs before a valid opportunity ends; missing when there is no detection and no complete eligible interval',
    startEvent: 'Eligibility start: truth time the threat enters the approved eligibility region or vignette start',
    stopEvent: 'First valid detection event',
    experimentalUnit: 'One valid detection opportunity',
    higherIsBetter: true,
    notes:
      'Range form: a larger detection range is better. Elapsed-time form: a smaller time is better. Do not substitute a timeout for a censored value.',
  },
  {
    dictKey: 'CUAS-TRK-FST-003',
    name: 'First-stable-track range or time',
    family: 'latency',
    measureType: 'time-to-event',
    unit: 's (time form) or m (range form)',
    definition:
      'Where or when the system first produces a track satisfying the complete stable-track rule',
    numeratorRule:
      'First-stable-track time equals the first time all stable-track rules pass minus eligibility-start time. Range form: truth-derived range at that event',
    denominatorRule:
      'The complete persistence window must remain observable; a late track cannot be counted if required post-event updates are missing. Censored when no stable track occurs before the opportunity ends',
    startEvent: 'Eligibility start',
    stopEvent: 'First time all stable-track rules pass',
    experimentalUnit: 'One valid detection opportunity',
    higherIsBetter: true,
    notes:
      'Stable-track rule parameters defined per measure record: minimum consecutive updates; maximum allowed update gap; required position and velocity quality; required identity confidence; minimum dwell time. JIATF illustrative fixture: Config A median 2.28 km, Config B median 3.69 km to boundary.',
  },
  {
    dictKey: 'CUAS-TRK-CONT-004',
    name: 'Track continuity',
    family: 'continuous',
    measureType: 'continuous',
    unit: 'fraction',
    definition: 'Fraction of the required mission interval with a valid associated track',
    numeratorRule:
      'Eligible time in which the correct associated track satisfies the approved quality state',
    denominatorRule:
      'Total valid eligible tracking time, excluding only preapproved no-test intervals',
    startEvent: 'Eligibility interval start',
    stopEvent: 'Eligibility interval end',
    experimentalUnit: 'One truth object during one card-defined interval',
    higherIsBetter: true,
    notes:
      'Define the maximum update gap before continuity is considered lost. Report with the number and duration of track losses, reacquisition time, and the worst valid opportunity. JIATF seed rule: Configuration B must not reduce median track continuity by more than 0.03.',
  },
  {
    dictKey: 'CUAS-TRK-ERR-005',
    name: 'Track position error',
    family: 'continuous',
    measureType: 'position-error',
    unit: 'm',
    definition:
      'How far the reported track position differs from independent truth (opportunity-level summary, not per-update trials)',
    numeratorRule:
      'RMSE of blue-minus-truth position over matched time-correlated samples in a common coordinate frame after the recorded transformation version',
    denominatorRule:
      'Matched updates within one run give one opportunity-level summary; they never count as independent tests',
    startEvent: 'First matched time-correlated sample inside truth coverage and approved geometry',
    stopEvent: 'Last matched time-correlated sample',
    experimentalUnit: 'One opportunity-level summary per run',
    higherIsBetter: false,
    notes:
      'Metrics allowed: radial, along-track, cross-track, vertical error, percentile, RMS, or threshold exceedance as approved. Ground-truth measurement error must be small relative to the smallest decision-relevant effect. JIATF seed limit: opportunity-level position RMSE at or below 50 m.',
  },
  {
    dictKey: 'CUAS-CLS-ACC-006',
    name: 'Classification accuracy',
    family: 'binomial',
    measureType: 'probability',
    unit: 'fraction',
    definition:
      'How often the system assigns the correct approved class (confusion matrix plus unknown rate required)',
    numeratorRule:
      'Correctly classified valid objects: the final or card-defined classification state equals the truth class',
    denominatorRule:
      'Valid objects requiring classification (one independently identified truth object per defined classification opportunity)',
    startEvent: 'Classification opportunity opens',
    stopEvent: 'Card-defined classification decision time',
    experimentalUnit: 'One independently identified truth object per classification opportunity',
    higherIsBetter: true,
    notes:
      'Freeze the class taxonomy, decision time, and treatment of unknown before execution. Required companion output: confusion matrix; unknown or unclassified rate; false-hostile rate; false-friendly rate; results by threat class. Not referenced by the five worked cards.',
  },
  {
    dictKey: 'CUAS-SUR-FTR-007',
    name: 'False or nuisance track rate',
    family: 'rate',
    measureType: 'rate',
    unit: 'tracks/hr',
    definition:
      'Operationally relevant tracks without a corresponding truth object, per valid surveillance exposure time',
    numeratorRule:
      'Count of tracks satisfying the operational-track criterion with no truth association under the approved reconciliation rule',
    denominatorRule:
      'Valid surveillance hours, optionally stratified by volume and condition. Invalid when truth coverage is inadequate to decide whether an object existed',
    startEvent: 'Valid surveillance interval start',
    stopEvent: 'Valid surveillance interval end',
    experimentalUnit: 'One valid surveillance interval',
    higherIsBetter: false,
    notes:
      'Report separately: false tracks, duplicate tracks, split tracks, uncorrelated real objects, nuisance but real objects. JIATF seed screening limit: 1.5 false tracks per valid surveillance hour.',
  },
  {
    dictKey: 'CUAS-C2-HS-008',
    name: 'Handoff success probability',
    family: 'binomial',
    measureType: 'probability',
    unit: 'fraction',
    definition: 'How often a qualifying source track becomes a usable receiving-system track',
    numeratorRule:
      'Successful usable handoffs: the receiving system creates or updates the correct object into the card-defined usable state within the allowed interval. Success requires correct identity or approved correlation, required fields present, usable quality and freshness, and a traceable receiving-system event time',
    denominatorRule:
      'Valid qualifying handoff opportunities: source tracks that met every prerequisite of the approved offer criterion. Do not count opportunities in which the source never met the offer criterion',
    startEvent: 'Source track first meets the approved qualifying-offer criterion',
    stopEvent: 'Receiving-system usable state or the approved observation window closes',
    experimentalUnit: 'One valid qualifying source-track opportunity',
    higherIsBetter: true,
    notes:
      'Packet receipt alone is not success unless packet receipt is the approved question. Failure categories: no transmission, rejected message, schema failure, identity error, stale data, duplicate or merge error, unusable quality, timeout. JIATF seed threshold: at least 90 percent usable handoff success in tested core cells.',
  },
  {
    dictKey: 'CUAS-C2-LAT-009',
    name: 'Sensor-to-C2 or handoff latency',
    family: 'latency',
    measureType: 'time-to-event',
    unit: 's',
    definition:
      'Duration of the defined information transition (source qualifying event to receiver usable event; censoring supported)',
    numeratorRule:
      'Latency equals the receiving-system usable-track event time minus the source qualifying-track event time',
    denominatorRule:
      'Censored when no successful handoff occurs before the approved window closes. A failed handoff is censored or failed under the approved rule; it is never assigned the timeout as a completed latency',
    startEvent: 'Source track first satisfies the offer criterion',
    stopEvent: 'Receiving system first satisfies the usable-track criterion',
    experimentalUnit: 'One valid qualifying handoff opportunity',
    higherIsBetter: false,
    notes:
      'Freeze before execution: start event; stop event; common time source; maximum event-time uncertainty; observation window; censoring; repeated opportunities and clustering. JIATF seed: added 90th-percentile source-to-C2 latency at or below 1.0 s versus baseline.',
  },
  {
    dictKey: 'CUAS-MSN-UWT-010',
    name: 'Usable warning time',
    family: 'latency',
    measureType: 'time-to-event',
    unit: 's',
    definition:
      'Decision-and-engagement time remaining when the architecture first produces a usable track (decision-ready event to truth boundary crossing)',
    numeratorRule:
      'Usable warning time equals the truth time at the defended-asset boundary minus the decision-ready-track event time. Distance and speed form for prediction and cross-check: remaining path distance to boundary divided by ground speed',
    denominatorRule:
      'One valid threat presentation. No-warning rule: if no decision-ready track occurs, report a no-warning outcome; do not assign zero unless the approved definition requires it',
    startEvent: 'Decision-ready C2 track event (customer-approved decision-ready definition first satisfied)',
    stopEvent: 'Truth time the threat crosses the approved defended-asset or latest-action boundary',
    experimentalUnit: 'One valid threat presentation',
    higherIsBetter: true,
    notes:
      'JIATF seed decision-ready criterion requires all of: correct truth-object association; required position and velocity fields present; track age within 1.0 second; position-quality state within the customer criterion; C2 track persistence for at least three consecutive updates. JIATF seed thresholds: median warning time at least 90 s in the core condition; paired increase at least 25 s. Interpret with track quality, false-track burden, handoff success, and the effector timeline.',
  },
  {
    dictKey: 'CUAS-EW-EFF-011',
    name: 'Probability of mission-relevant EW effect',
    family: 'binomial',
    measureType: 'probability',
    unit: 'fraction',
    definition:
      'How often the approved EW condition produces the defined mission-relevant effect state',
    numeratorRule:
      'Valid EW opportunities in which independent truth shows the card-defined effect state (navigation deviation, control-link loss, mission abort, forced recovery, loss of terminal function, or temporary suppression, as frozen per campaign)',
    denominatorRule:
      'Valid presentations in which the EW system was available, authorized, correctly configured, and applied inside the approved geometry',
    startEvent: 'Qualifying exposure begins',
    stopEvent: 'Effect state, vignette end, censoring, or stop',
    experimentalUnit: 'One independently reset threat presentation',
    higherIsBetter: true,
    notes:
      'The EW system\'s own "effect achieved" flag is never sole truth. Never claim physical defeat when only temporary suppression was shown; loss of a command link is not automatically defeat.',
  },
  {
    dictKey: 'CUAS-EW-REC-012',
    name: 'Time to effect and recovery',
    family: 'latency',
    measureType: 'time-to-event',
    unit: 's',
    definition: 'Time from qualifying exposure to effect entry, and effect entry to effect exit',
    numeratorRule:
      'Time to effect equals effect-entry event time minus qualifying-exposure event time. Recovery time equals effect-exit event time minus effect-entry event time',
    denominatorRule:
      'Censored when the effect is not observed before exposure or vignette ends, or recovery is not observed before observation ends',
    startEvent: 'Qualifying-exposure event (time-aligned emission or exposure record shows valid exposure began)',
    stopEvent: 'Effect-entry event for time to effect; effect-exit event for recovery time',
    experimentalUnit: 'One valid EW opportunity',
    higherIsBetter: false,
    notes:
      'Qualifying exposure and state transitions must be independently reconstructable. Separate temporary suppression from mission defeat. Report the time-to-event distribution, censored fraction, recurrence, and condition breakdown.',
  },
  {
    dictKey: 'CUAS-DEF-PINT-013',
    name: 'Probability of intercept',
    family: 'binomial',
    measureType: 'probability',
    unit: 'fraction',
    definition:
      'How often an approved engagement opportunity produces the defined intercept event',
    numeratorRule:
      'Valid engagement opportunities in which independent evidence confirms the interceptor meets the card-defined intercept criterion',
    denominatorRule:
      'Valid engagement opportunities in which the system created a qualifying engagement and the interceptor was available and correctly released, with approved engagement prerequisites. Never count detection-only opportunities in the intercept denominator',
    startEvent: 'Qualifying engagement opportunity opens',
    stopEvent: 'Intercept event, miss, or opportunity end',
    experimentalUnit: 'One valid engagement opportunity',
    higherIsBetter: true,
    notes:
      'Report separately: no assignment, no launch, launch failure, guidance failure, miss, intercept with unknown effect, confirmed intercept.',
  },
  {
    dictKey: 'CUAS-DEF-PDEF-014',
    name: 'Probability of defeat',
    family: 'binomial',
    measureType: 'probability',
    unit: 'fraction',
    definition:
      'How often a valid defeat opportunity prevents the threat from completing its card-defined mission',
    numeratorRule:
      'Valid opportunities with confirmed defeat: truth establishes the threat can no longer complete the card-defined mission during the remaining vignette',
    denominatorRule:
      'Valid defeat opportunities with the complete kill-chain prerequisites specified by the card',
    startEvent: 'Valid defeat opportunity opens',
    stopEvent: 'Defeat assessment or vignette end',
    experimentalUnit: 'One valid engagement against one truth threat object or one defined raid',
    higherIsBetter: true,
    notes:
      'Defeat outcome taxonomy: physical destruction, functional mission kill, diversion or forced landing, lost guidance or navigation, temporary suppression, unknown outcome. Unknown outcomes never silently become successes or failures; apply the four-case sensitivity analysis. Never call an intercept a defeat without independent mission-outcome truth.',
  },
  {
    dictKey: 'CUAS-MSN-E2E-015',
    name: 'End-to-end mission success',
    family: 'binomial',
    measureType: 'composite-mission-outcome',
    unit: 'fraction',
    definition:
      'Whether the complete mission thread achieves the defined Measure of Success (with 9-stage decomposition)',
    numeratorRule: 'Valid vignettes achieving the mission-level Measure of Success',
    denominatorRule:
      'Total valid mission vignettes. All mission-critical states must be reconstructable; a component success cannot substitute for missing mission-outcome truth',
    startEvent: 'Vignette start',
    stopEvent: 'Vignette end',
    experimentalUnit: 'One complete vignette or raid as defined',
    higherIsBetter: true,
    notes:
      'Required decomposition: detection, track, classification, decision, assignment, engagement, effect, assessment, mission outcome.',
  },
  {
    dictKey: 'CUAS-SAT-LEAK-016',
    name: 'Leaker probability under raid load',
    family: 'binomial',
    measureType: 'probability',
    unit: 'fraction',
    definition:
      'Fraction of truth threats reaching the protected boundary without prior confirmed defeat; plus raid-failure probability',
    numeratorRule:
      'Leaker fraction: truth threats reaching the boundary without prior confirmed defeat. Raid failure probability: raids with at least one leaker',
    denominatorRule:
      'Leaker fraction: valid truth threats in the raid. Raid failure probability: total valid raids. Preserve raid membership',
    startEvent: 'Raid start',
    stopEvent: 'Boundary crossing or raid completion',
    experimentalUnit:
      'Threat object (nested) for leaker fraction; raid (primary) for raid-failure probability',
    higherIsBetter: false,
    notes:
      'Threats within one raid are related; never treat them as independent raids. Report with maximum concurrent tracks, assignments, engagements, operator interventions, queue delay, and resource exhaustion.',
  },
  {
    dictKey: 'CUAS-SUIT-AVAIL-017',
    name: 'Operational availability during the test period',
    family: 'continuous',
    measureType: 'continuous',
    unit: 'fraction',
    definition:
      'Fraction of required mission time the system can perform the defined function',
    numeratorRule: 'Time the system is in the approved mission-capable state',
    denominatorRule:
      'Required operating time, including only the downtime categories specified before execution (system fault, scheduled maintenance, test infrastructure, operator, external constraint, unknown)',
    startEvent: 'Required operating period start',
    stopEvent: 'Required operating period end',
    experimentalUnit: 'One required operating period',
    higherIsBetter: true,
    notes:
      'Freeze before execution: the mission-capable definition and whether scheduled maintenance, test-infrastructure downtime, external range holds, and operator unavailability enter the denominator. Not referenced by the five worked cards.',
  },
  {
    dictKey: 'CUAS-HMI-INT-018',
    name: 'Operator intervention rate',
    family: 'rate',
    measureType: 'rate',
    unit: 'interventions/hr or interventions/vignette',
    definition:
      'Qualifying operator actions beyond the approved nominal workflow, per valid operating hours or vignettes',
    numeratorRule:
      'Qualifying operator interventions: time-tagged actions meeting the approved intervention definition (required decision, correction, override, recovery, false-alarm handling, unplanned troubleshooting)',
    denominatorRule: 'Valid exposure hours or valid mission vignettes',
    startEvent: 'Valid exposure interval start',
    stopEvent: 'Valid exposure interval end',
    experimentalUnit: 'One valid operating hour or one vignette',
    higherIsBetter: false,
    notes:
      'Distinguish planned doctrinal action from intervention caused by system behavior. Truth sources: operator-interface logs, voice and event log, observer record.',
  },
  {
    dictKey: 'M-02',
    name: 'Paired warning-time improvement',
    family: 'continuous',
    measureType: 'continuous',
    unit: 's',
    definition:
      'Config B warning time minus Config A warning time; pairs share threat profile, factor cell, and block',
    numeratorRule:
      'Paired improvement equals warning time for Configuration B minus warning time for Configuration A within one matched pair',
    denominatorRule: '',
    startEvent: '',
    stopEvent: '',
    experimentalUnit: 'One matched A/B pair sharing threat profile, factor cell, and block',
    higherIsBetter: true,
    notes:
      'Campaign-local derived measure; no CUAS dictionary ID. A positive difference favors B only because the preferred direction is declared. Uncertainty: bootstrap interval on the paired median. JIATF seed: minimum meaningful paired improvement 25 s; the interval must not indicate a material negative effect.',
  },
  {
    dictKey: 'M-10',
    name: 'Mission margin',
    family: 'margin',
    measureType: 'continuous',
    unit: 's',
    definition:
      'Usable warning time minus required action-chain time minus uncertainty reserve',
    numeratorRule:
      'Mission margin equals usable warning time minus required action-chain time minus uncertainty reserve',
    denominatorRule: '',
    startEvent: '',
    stopEvent: '',
    experimentalUnit: 'One valid threat presentation',
    higherIsBetter: true,
    notes:
      'Campaign-local derived measure; no CUAS dictionary ID. Positive margin means time remains under the defined assumptions; negative margin means the chain is late. A positive margin supports only the tested timeline, not a faster threat, another route, another effector, or another C2 procedure. JIATF seed: positive margin in at least 80 percent of valid end-to-end confirmation opportunities.',
  },
]

/** Instantiate a campaign measure from a dictionary entry. */
export function measureFromDict(entry: MeasureDictEntry, id: string, questionId: string): TeMeasure {
  const m = emptyMeasure(id, questionId)
  m.dictKey = entry.dictKey
  m.name = entry.name
  m.family = entry.family
  m.measureType = entry.measureType
  m.unit = entry.unit
  m.exactDefinition = entry.definition
  m.numeratorRule = entry.numeratorRule
  m.denominatorRule = entry.denominatorRule
  m.startEvent = entry.startEvent
  m.stopEvent = entry.stopEvent
  m.experimentalUnit = entry.experimentalUnit
  m.higherIsBetter = entry.higherIsBetter
  return m
}
