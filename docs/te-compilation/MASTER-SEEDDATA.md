# MASTER-SEEDDATA: RangeBoard T&E Operations module

Synthesis lane: SEED DATA. The real-world content the app ships with.
Compiled from extraction files in this directory. Primary sources: 12-jiatf401.md, 11-instrumentation-worked-cards.md, 08-threat-doctrine.md, 13-field-guide-questions.md, 01-roles-qualification.md, 09-measures-quantdesign.md, 10-quant-guide.md.

Labeling convention used on every JIATF number:

- `[REAL]` = fact from the JIATF-401 page or interview transcript. Real-world, may be sparse or unverified.
- `[ILLUSTRATIVE]` = value from the notional case study. Source states: "All configurations, thresholds, quantities, schedules, calculations, and results are illustrative. They are not actual JIATF-401 or Valkryn test results." Ship as demo/fixture data with an illustrative watermark.
- `[INFERRED]` = synthesis-added structure not attested verbatim in source. Verify before shipping as canon.

Formulas are NOT duplicated here. Full math lives in MASTER-CALCULATIONS.md. This file carries the values, identifiers, structures, and text that become seed TypeScript files.

---

## 1. The JIATF-401 canonical seed campaign

### 1.1 Organization facts `[REAL]` (source: file 12 sec 7.1; file 13 sec 7; file 08 sec 7.3)

```text
organization: {
  id: "JIATF-401",
  name: "Joint Interagency Task Force 401",
  established: "2025-08-28",           // replaced the Joint Counter-small Unmanned Aircraft Systems Office (JCO)
  lead: "Army-led; reports to Deputy Secretary of Defense",
  commander: "Brig. Gen. Ross",        // first name not established
  approvalAuthority: "up to $50 million per initiative",
  review: "36-month review can end or change the organization",
  advocates: [
    "CENTCOM chief technology officer", // name AMBIGUOUS in transcript: "Joy Shanaberger" / "Joyce Shannenberger"; brought Valkryn into JIATF-401
    "Dr. Alex Miller, Army chief technology officer"
  ],
  site: "Deep Element Test Site, Amman, Jordan", // formal name, ownership, authorities not established
  standards: "Adopted Standard Guidelines for T&E of C-UAS Technologies on 2026-03-11 (common core data, terms, schemas; NOT a military standard; no measures, surrogate fidelity, or evaluation criteria defined)",
  demonstrations: "Yuma, twice yearly with RCCTO. Demo 5 (June 2024): nine systems vs more than 40 counter-swarm targets. Demo 6 (April 2025): contested electromagnetic environment, Group 3 defeat, dismounted systems."
}
```

Mission problem `[REAL]`: large evaluation backlog of C-UAS systems. Kill-chain node classes evaluated: early-warning radars, tracking radars, command and control, interceptors, effectors.

Two customer decisions `[REAL]`:

1. Which systems performed as vendors claimed (which to buy).
2. Which combination formed the best C-UAS kill chain for a specific threat, place, and set of operating conditions ("HARDEN THE KILL CHAIN"). A component can work and still fail to add sufficient value to the complete kill chain.

Defining discovery `[REAL]`: Valkryn asked for the test card. Answer: "We don't have one." Customer knew objectives and desired decisions, not required data, measures, or analytical method. Valkryn built the test card from the decision backward.

Engagement facts `[REAL]`:

- Team: Hugh (deployment strategist); Andrew (forward-deployed engineer; connected systems under test, structured system data, red-air telemetry, TestOS).
- Timeline: government expected roughly six months; Valkryn responded "we'll do it the next two weeks"; execution "a couple days out there in Jordan."
- Red air: manually flown quadcopters and small fixed-wing UAS representing Shahed-type threats; Mugin-3/MUGEN-3 named. Red air supplied live telemetry (ground-truth basis). Exact profiles, payloads, speeds, altitudes not established.
- Real measures named: (a) early-warning buffer ("How much additional warning time or distance does an early-warning air-search radar provide?"); (b) track-to-ground-truth correlation ("How closely do radar-generated tracks match the actual position of the red threat?"); (c) probability of detection at range, across range, elevation, azimuth, speed. Recorded open question: "How is Pd (probability of detection) properly defined?"
- TestOS supported: test-card execution; live data capture; red-air tracking; remote live observation by government personnel in the national capital region; end-of-campaign evaluation output (contrast: a PDF 60-90 days later); replayable full live-data record; later analysis with new measures.
- Outcomes claimed: credibility; broader CDAO contract; entry into Operation Jailbreak; positioning as T&E backbone for a CENTCOM-Army effort. No contract documents or specific government decision identified.

Not established for the real event `[REAL, explicit gap list]`: number of each system; configurations; network design; clock sync; classification; cyber controls; whether all systems ran every run; whether any system was simulated; whether interceptors made physical contact; whether effectors were live/inert/virtual/absent.

### 1.2 Campaign record `[ILLUSTRATIVE]` (file 12 sec 1.1)

| Field | Value |
| --- | --- |
| Campaign ID | `J401-EW-01` |
| Title | Early-Warning Layer Operational Value Evaluation |
| Engagement type | Paired comparison with characterization and end-to-end confirmation |
| Primary customer action | Select architecture for a controlled pilot deployment and follow-on engagement evaluation |
| Primary decision date | 15 working days after field execution |
| Primary test object | Integrated sensing-to-C2 chain |
| Secondary test objects | Early-warning sensor; fusion adapter; tracking sensor; C2 handoff; operator workflow |

Customer request (verbatim seed text) `[ILLUSTRATIVE]`:
> "Compare the current C-UAS architecture with an architecture that includes an early-warning radar. Determine whether the added sensor produces enough operational warning to justify integration and follow-on testing against the selected threat."

Workbench clarification questions (app behavior, verbatim; question bank `QB-CLAR-10`, see section 6.2):

1. What decision will the result support?
2. What is the baseline architecture?
3. What exact change defines the treatment architecture?
4. What does "enough warning" mean in seconds?
5. What threat behavior drives the available timeline?
6. What system state qualifies as a decision-ready track?
7. What trade-offs could cancel the benefit?
8. Which conditions must the conclusion cover?
9. What evidence can establish the actual threat state?
10. Does the test need characterization, comparison, threshold verification, or all three?

### 1.3 Systems under test

#### 1.3.1 Real systems inventory `[REAL]` (file 12 sec 1.12; specs sparse; mark unverified in the library)

```text
systems: [
  { id: "SYS-PICOGRID", name: "Picogrid C2", alias: "Legion", role: "command-and-control", specs: null },
  { id: "SYS-RPS42",    name: "RADA RPS-42", role: "tracking-radar",
    specs: "90 elev/azi sector scan / 5km nano / 25km med" },
  { id: "SYS-VANQUISH", name: "CHAOS Industries Vanquish", role: "early-warning-radar",
    specs: "Dist EW Radar" },
  { id: "SYS-MEROPS",   name: "Merops interceptor system", role: "interceptor",
    specs: {
      mission: "One-way Attack",
      elements: "GCS / Launcher / Radar/Sensor",
      envelope: "5-20km / 16kft",
      linkage: "Sensor to Effector",
      control: "Autonomous/Semi",
      guidance: "RF / Radar Guidance / Thermal / Multi-Sensor",
      chain: "Sensor -> MEROPS GCS -> Launch -> Midcourse Guide/Autonomous -> Terminal TA -> Timeout"
    } },
  { id: "SYS-MUGIN3",   name: "Mugin-3 (MUGEN-3)", role: "red-air fixed-wing", specs: null },
  { id: "SYS-BUMBLEBEE", name: "Bumblebee Quad Copters", role: "red-air quadcopter", specs: null },
  { id: "SYS-HORNET",   name: "Hornet Midrange Strike Drones", role: "red-air strike drone", specs: null }
]
capabilityTags: ["Computer Vision", "RF Sensing", "Jam-Resistant Comms", "Autonomous Targeting"]
```

Functional architecture sketch `[REAL, verbatim node order]`:

```text
Early-warning radar -> Acquisition Radar -> Tracking radar -> Fire Control Radar / Command and control -> Interceptor -> Red-air target
```

[AMBIGUOUS: source diagram mixes an acquisition radar and fire-control radar into the chain with irregular formatting; C2 sits beside fire control.]

#### 1.3.2 Case-study configuration nodes `[ILLUSTRATIVE]` (file 12 sec 1.3)

```text
Configuration A (Baseline):  TRK-1 -> C2-1 -> ENG-1
Configuration B (Treatment): EW-1 -> FA-1 -> TRK-1 -> C2-1 -> ENG-1
```

| Node ID | Role |
| --- | --- |
| `EW-1` | Early-warning radar |
| `FA-1` | Fusion adapter |
| `TRK-1` | Tracking radar |
| `C2-1` | Command and control |
| `ENG-1` | Engagement node (approved time-to-effect representation during screening) |

Pairing rule: only the added early-warning layer and its required interface change between paired configurations. Within a comparison block do NOT change: tracking radar, C2 build, engagement process, operator crew, protected boundary, threat profile.

System boundary. Included: EW-1 radar and settings; TRK-1 radar and settings; FA-1 adapter and schema; C2-1 software and correlation settings; operator console and procedure; engagement-node timing representation; network path between included systems; independent threat truth.
Excluded from primary comparison: broad suitability and sustainment; performance against other threat classes; contested-spectrum performance; multi-threat saturation; live operational authorization; universal interceptor effectiveness.

### 1.4 Threat profile `[ILLUSTRATIVE]` (file 12 sec 1.4)

| Field | Value |
| --- | --- |
| Threat ID | `THR-G2-FW-01-v1.2` |
| Representation | Generic Group 2 fixed-wing surrogate |
| Threat mission | One-way approach to the protected boundary |
| Control mode | Preplanned waypoint navigation |
| Adaptation | None during paired comparison runs |
| Payload | Inert representative mass |
| Telemetry | Independent truth telemetry hidden from blue operators and systems |
| Speed levels | 20 and 30 m/s |
| Altitude levels | 60 and 120 m AGL |
| Approach geometry | enum: centerline; sensor-sector boundary; off-axis |
| Entry state | Stable speed and altitude before the scored volume |
| End state | enum: boundary crossing; recovery turn; approved test stop |

Fidelity caveat (carry on every output): the surrogate supports radar and timeline characterization only. Fidelity must be assessed feature by feature. It does not establish performance vs an actual Shahed-type system, other guidance, other signature, or an adaptive threat.

Protected-boundary vignette `[ILLUSTRATIVE]`:

- Fixed protected point. Protected boundary radius: 1,000 m.
- Threat begins scored approach outside the largest expected detection region.
- One approved approach line per paired block.
- Engagement node uses an approved time-to-effect representation during screening.
- Range-approved inert or virtual engagement allowed in final confirmation.

Condition record: `COND-DAY-CLEAR-NET-NOM-v1` (day, clear weather, nominal network) `[ILLUSTRATIVE]`.

### 1.5 Variable classification `[ILLUSTRATIVE]` (file 12 sec 1.6)

| Class | Members |
| --- | --- |
| Independent variable | Architecture A or B |
| Screened factors | Approach azimuth; altitude; speed |
| Held controls | Threat article within block; flight profile within pair; tracking-radar settings; C2 build and settings; operator crew and procedure; sensor emplacement; protected boundary; engagement timeline assumptions |
| Recorded covariates | Actual speed and altitude; wind; temperature; precipitation; visibility; actual approach angle; RF background; network latency; operator workload rating; time of day |
| Nuisance risks | Weather change between A and B; operator learning; threat-article battery or performance drift; radar heating; stale tracks after configuration changes; clock drift; unplanned route variation |

Each nuisance risk receives an assigned mitigation: blocking, reset, randomization, or capture rule.

### 1.6 Operational questions, hypotheses, predictions `[ILLUSTRATIVE]` (file 12 sec 1.7)

```text
questions: [
  { id: "Q-01", primary: true,
    text: "Does Configuration B provide at least 25 seconds more usable warning time than Configuration A under matched threat and condition cells?",
    hypothesis: { id: "H-01",
      text: "Under the tested threat and conditions, Configuration B increases paired usable warning time by at least 25 seconds relative to Configuration A.",
      nullCondition: "Paired increase < 25 s or too uncertain to support the customer decision." },
    prediction: "Config A median usable warning time 70-90 s; Config B median 110-140 s; predicted paired increase 35-55 s." },

  { id: "Q-02",
    text: "Does the added layer produce a decision-ready C2 track without an unacceptable handoff penalty?",
    hypothesis: { id: "H-02",
      text: "Configuration B maintains at least 90% usable handoff success in the tested core cells and adds no more than 1.0 second to the 90th-percentile source-to-C2 latency." },
    prediction: "Handoff success 90-98%; added 90th-percentile latency 0.3-0.8 s." },

  { id: "Q-03",
    text: "Does the added layer preserve track quality?",
    hypothesis: { id: "H-03",
      text: "Configuration B does not reduce median track continuity by more than 0.03 and does not increase opportunity-level position RMSE above 50 m." } },

  { id: "Q-04", exploratory: true,
    text: "Which geometry creates the smallest warning benefit or the highest failure rate?",
    hypothesis: null,   // no H-04 exists in the source
    prediction: "The sector-boundary approach will produce the smallest benefit and the highest handoff uncertainty." },

  { id: "Q-05",
    text: "Does Configuration B create enough time for the represented engagement chain?",
    hypothesis: { id: "H-05",
      text: "Configuration B produces a positive mission margin in at least 80% of valid end-to-end confirmation opportunities under the tested core condition." } }
]
```

### 1.7 Customer decision rules `[ILLUSTRATIVE]` (file 12 sec 1.8)

Configuration B advances to the next phase if ALL:

1. Estimated paired warning-time increase is at least 25 seconds.
2. The uncertainty interval does not indicate a material negative effect.
3. Median warning time is at least 90 seconds in the core condition.
4. Track continuity loss is not greater than 0.03.
5. Position RMSE remains at or below 50 m.
6. Added 90th-percentile handoff latency is at or below 1.0 second.
7. No unresolved failure prevents the engagement chain from using the early track.

Partial-miss rule: a threshold miss in one geometry can result in a restricted recommendation instead of complete rejection.

### 1.8 Action-chain time inputs `[ILLUSTRATIVE]` (file 12 sec 1.9; seconds)

```text
actionChain: {
  operatorDecision: 8,
  assignment: 4,
  engagementPreparation: 8,
  timeToRepresentedEffect: 55,
  effectAssessment: 5,
  uncertaintyAndOperatingReserve: 10
}
// Derived (math in MASTER-CALCULATIONS.md): required chain time = 80 s; required warning threshold = 90 s.
```

### 1.9 Sample-planning inputs `[ILLUSTRATIVE]` (file 12 sec 1.10)

```text
samplePlan: {
  minMeaningfulPairedImprovement_s: 25,
  expectedSdPairedDifferences_s: 30,
  zTwoSided95: 1.96,
  zPower80: 0.84,
  targetValidScoredOpportunities: 48,
  expectedValidRunFraction: 0.80,
  controlRehearsalOpportunities: 4   // non-comparison
}
// Derived (math in MASTER-CALCULATIONS.md): 12 valid pairs stage 1; 60 required scored attempts; 64 max planned opportunities.
```

### 1.10 Measure instances M-01..M-10 `[ILLUSTRATIVE]` (file 12 sec 2.1; full definitions and formulas in MASTER-CALCULATIONS.md)

| ID | Name | One-line definition | Dictionary counterpart `[INFERRED]` |
| --- | --- | --- | --- |
| M-01 | Usable warning time (primary) | Truth boundary-crossing time minus decision-ready C2 track time; unit = one independently reset threat presentation | CUAS-MSN-UWT-010 |
| M-02 | Paired warning-time improvement | Config B warning time minus Config A warning time; pairs share threat profile, factor cell, and block | derived (none) |
| M-03 | Probability of detection | Valid opportunities with a valid detection over total valid detection opportunities; report by range band, altitude, azimuth, speed, configuration | CUAS-SEN-PD-001 |
| M-04 | First-stable-track range | Truth-derived distance from threat to protected boundary when all stable-track rules first pass | CUAS-TRK-FST-003 |
| M-05 | Track continuity | Eligible time with a valid associated track over total valid eligible tracking time | CUAS-TRK-CONT-004 |
| M-06 | Opportunity-level track error | RMSE of blue-minus-truth position; matched updates within one run give ONE opportunity-level summary, never independent tests | CUAS-TRK-ERR-005 |
| M-07 | Handoff success | Qualifying source tracks that become usable C2 tracks over valid qualifying source-track opportunities | CUAS-C2-HS-008 |
| M-08 | Source-to-C2 latency | Decision-ready C2 event time minus qualifying source-track event time; failed handoff is censored or failed, never assigned the timeout as a latency | CUAS-C2-LAT-009 |
| M-09 | False or nuisance track rate | Adjudicated false or nuisance tracks per valid surveillance hour | CUAS-SUR-FTR-007 |
| M-10 | Mission margin | Usable warning time minus required action-chain time minus uncertainty reserve | derived (none) |

Decision-ready track criterion (M-01; also a reference constant, section 5.4): requires ALL of:

1. Correct truth-object association.
2. Required position and velocity fields present.
3. Track age within 1.0 second.
4. Position-quality state within the customer criterion.
5. C2 track persistence for at least three consecutive updates.

### 1.11 Test matrix `[ILLUSTRATIVE]` (file 12 secs 2.5, 6.3)

Factor space: 3 azimuths x 2 altitudes x 2 speeds = 12 condition cells.

| Factor | Levels | Cell-ID token |
| --- | --- | --- |
| Approach azimuth | centerline; sensor-sector boundary; off-axis | `AZ-CL` `[INFERRED]`, `AZ-BND` (attested), `AZ-OFF` `[INFERRED]` |
| Altitude (m AGL) | 60; 120 | `ALT-60` (attested), `ALT-120` `[INFERRED]` |
| Speed (m/s) | 20; 30 | `SPD-20` `[INFERRED]`, `SPD-30` (attested) |

Attested cell-ID grammar: `AZ-BND / ALT-60 / SPD-30`.

Stage structure:

| Stage | Content | Valid opportunities |
| --- | --- | --- |
| Stage 0 | Method controls: positive control (known favorable detection); negative or background-only surveillance interval; full data-chain rehearsal; configuration-switch and reset rehearsal | 4 (non-comparison) |
| Stage 1 | Screening comparison: 12 cells x one matched A/B pair each; A/B order randomized within each block and balanced for which configuration runs first | 24 |
| Stage 2 | Focused augmentation: 8 cells by preapproved rule (4 highest-uncertainty cells; 2 smallest-margin cells; 2 cells needed to distinguish a geometry effect from an interface effect); one more matched A/B pair each | 16 |
| Stage 3 | End-to-end confirmation: 8 Configuration B opportunities under the selected operational core condition, full represented chain through engagement readiness and effect timing | 8 |

Totals: 24 + 16 + 8 = 48 valid scored opportunities. Required scored attempts at 0.80 valid fraction = 60. Plus 4 control/rehearsal = 64 maximum planned opportunities.

### 1.12 Issued card `TC-J401-EW-COMP-01-v1.0` `[ILLUSTRATIVE]` (file 12 sec 4.2)

**Control ribbon**

- Card: `TC-J401-EW-COMP-01-v1.0`
- Run: generated at release
- Matrix cell: `AZ-BND / ALT-60 / SPD-30`
- Configuration: A or B from randomized order
- Threat: `THR-G2-FW-01-v1.2`
- Condition: `COND-DAY-CLEAR-NET-NOM-v1`

**Intent**

- Question: Does Configuration B add at least 25 seconds of usable warning time in the sector-boundary geometry?
- Prediction: Configuration A will provide 60-80 seconds. Configuration B will provide 95-125 seconds.
- Changed factor: early-warning layer absent or present.
- Primary result: paired usable-warning-time difference.
- Secondary results: handoff success; C2 latency; continuity; position RMSE; false-track rate.

**Required state** (pre-run checklist, run crew):

- Tracking radar, C2, operator procedure, threat profile, and engagement timing are unchanged within the pair.
- Stale tracks and queues are cleared.
- Configuration manifest matches the selected A or B state.
- Truth, sensor, adapter, C2, environment, and run log are healthy.
- Clock offset is within the measure limit.

**Procedure** (15 numbered steps, roles embedded):

1. Test conductor states card, run ID, matrix cell, and selected configuration.
2. Data monitor confirms required sources and common-time health.
3. Operator confirms the selected configuration without changing approved settings.
4. Red operator confirms threat profile, route, altitude, and speed.
5. Test conductor confirms queues and prior object state are clear.
6. Start truth, blue-system, environment, and run-log recording.
7. Threat establishes the approved pre-entry state.
8. Test conductor authorizes entry into the scored approach.
9. Threat executes the route without adaptation.
10. Operators follow the frozen workflow without coaching or tuning.
11. Continue recording through boundary crossing and the post-event margin.
12. Recover the threat and save all source records.
13. Record actual configuration, route, speed, altitude, weather, and operator state.
14. Complete the factual debrief.
15. Run the automated data and validity check before the paired run.

**Event marks** (ordered vocabulary; render as large tap buttons; timestamps feed M-01, M-04, M-08):

1. Threat enters eligibility region.
2. First valid detection.
3. First stable track.
4. Qualifying source track.
5. Usable C2 track.
6. Operator decision.
7. Assignment.
8. Represented effect-ready event.
9. Protected-boundary crossing.
10. Run complete.

**Run-specific hold conditions** (test conductor; hold before the run if ANY is true):

- Configuration state is unknown.
- Truth or common time is not healthy.
- Queues or tracks from the prior run remain.
- Threat route, altitude, or speed cannot meet the cell tolerance.
- A required source is unavailable.

Governance hook: general safety and range stops remain in the active field plan; the card does not repeat them in full.

**Preliminary use rule** (4-state enum, post-run adjudication):

- `Usable`: all primary events and states pass.
- `Limited`: the run supports named sensing measures but not warning or latency.
- `Repeat`: a required validity condition fails.
- `Valid failure`: the test is valid and the system does not meet the event rule.

Card users: conductor, operator, red team, data monitor, customer observer.

Lean-card policy (what stays on the card vs moves to linked records): keep only what can change execution, evidence validity, or immediate interpretation (question, changed factor, exact configurations/threat/condition, prediction, measures and validity rules, event and data capture, numbered procedure, run-specific stops, actuals/deviations/preliminary use). Move to linked records shown by ID: full customer background; complete system manifests; full threat-fidelity analysis; full measure formulas; full statistical plan; full instrumentation dictionary; general safety and emergency plan; general authority and contact lists; full report language.

### 1.13 Campaign execution rules `[ILLUSTRATIVE]` (file 12 secs 3.3, 3.4, 3.5)

Run-ordering rules (schedule generator):

- Pair A and B within the same day and weather block.
- Reverse pair order across blocks.
- Do not change altitude and azimuth at the same moment when the result would be difficult to diagnose.
- Clear queues and stale tracks before each run.
- Require a full configuration check after every A/B switch.
- Hold confirmatory opportunities until screening identifies the final core condition.
- Separate exploratory augmentation from confirmatory evidence.

Preapproved adaptation rules (day-of conditional logic):

- IF required truth, configuration, or timing fails THEN repeat the run.
- IF a handoff failure appears twice in the same geometry THEN add one diagnostic pair.
- IF the observed warning margin is within +/-10 seconds of zero THEN add one boundary cell.
- IF the minimum valid sample exists and more runs are unlikely to change its interpretation THEN stop that cell.
- ALWAYS preserve at least eight Configuration B opportunities for final confirmation.
- NEVER use an exploratory diagnostic run as confirmatory evidence.
- Keep each adaptation inside an approved rule; preserve the original and revised run lists.

Data-validity rules (per run; validity is assigned BY MEASURE, not only by run). A run supports usable warning time only if ALL hold:

- Truth covers the complete opportunity.
- Threat speed, altitude, and route remain inside tolerance.
- Configuration IDs are known.
- Decision-ready and boundary events are reconstructable.
- Object association is unambiguous.
- Common time passes.
- No critical data gap overlaps either event.
A run may remain valid for detection probability and invalid for latency.

### 1.14 Instrumentation data-field manifest `[ILLUSTRATIVE]` (file 12 sec 1.11)

| Source | Required fields |
| --- | --- |
| Threat truth | Independent GNSS/INS position; truth update rate at least 10 Hz; position uncertainty target 1.5 m or better in the scored region; threat-object ID; actual route, altitude, speed, heading, boundary crossing; telemetry state and gaps |
| EW-1 | Plots; tracks; detection state; quality/confidence; sensor status; configuration snapshot |
| TRK-1 | Plots and tracks; track quality; position and velocity; track initiation, drop, reacquisition; configuration snapshot |
| FA-1 and network | Message send and receive events; schema and adapter version; queue state; packet loss and delay; object IDs |
| C2-1 | Object creation and update events; correlation decisions; decision-ready state; operator display events; operator actions |
| Environment | Weather; visibility; wind; RF background; network state |
| Run record | Card and run IDs; configuration IDs; threat and condition IDs; start, phase, stop, boundary events; deviations and observations |

Timing uncertainty budget inputs `[ILLUSTRATIVE]` (file 12 sec 2.6; math in MASTER-CALCULATIONS.md): start timestamp 0.02 s; stop timestamp 0.02 s; synchronization 0.01 s; event definition 0.03 s. Derived: u_latency = 0.042 s; along-track error at 30 m/s = 1.26 m.

### 1.15 T-30 preparation schedule `[ILLUSTRATIVE]` (file 12 sec 6.5; working-day countdown)

| Window | Activities |
| --- | --- |
| T-30 to T-21 | Conduct customer discovery; freeze the primary decision and questions; identify the exact system builds; select threat profiles; load prior evidence; build the first measure set; identify required source fields |
| T-20 to T-14 | Connect source feeds; verify identifiers and clocks; register sensors and truth sources; validate threat flight profiles; run Configuration A and B bench checks; test queue and state reset |
| T-13 to T-8 | Freeze factor space; run sample-size review; generate the matrix; generate cards; compute every primary measure from rehearsal data; correct data and interface defects |
| T-7 to T-2 | Conduct full field rehearsal; validate positive and negative controls; dry run the A/B change process; verify the tablet workflow; freeze the issued matrix and first-day cards |

### 1.16 Six-day field rhythm `[ILLUSTRATIVE]` (file 12 sec 6.6)

| Day | Plan |
| --- | --- |
| 1 | Execute controls; run the first four A/B pairs; validate the warning-time and handoff calculations |
| 2 | Continue screening pairs; cover remaining core geometries; review variation and invalid-run causes |
| 3 | Complete the 12 screening pairs; select focused augmentation cells |
| 4 | Execute focused A/B pairs; isolate sector-boundary and handoff effects |
| 5 | Complete focused augmentation; freeze the confirmatory Configuration B condition |
| 6 | Execute end-to-end confirmation; use reserve time for validity repeats only |

Adaptive daily cycle (case-study controlled sequence) `[ILLUSTRATIVE]`:

```text
Run -> validate -> calculate -> compare with prediction -> update evidence gap -> select the next approved cell
```

Real-world JIATF-401 cycle `[REAL]`:

```text
Run the planned tests -> review the collected evidence -> identify open data gaps
-> determine which gaps matter to the decisions -> create the next day's plan -> collect the missing evidence
```

Contrast stated in source: this replaces "blindly following a static card"; each day's results change the priority of the next day's work.

Canonical phase flow (navigation model): DEFINE -> DESIGN -> QUANTIFY -> CALCULATE -> PREPARE -> ISSUED CARD -> EXECUTE -> ASSESS -> DEBRIEF -> ACT.

Decision-backward planning logic `[REAL]`:

```text
Government decision -> questions that must be answered -> measures that answer those questions
-> data needed to calculate the measures -> test conditions needed to produce the data
-> runs and flight profiles -> findings and remaining gaps
```

### 1.17 Illustrative results set `[ILLUSTRATIVE - fixture data; every number below is notional]` (file 12 secs 2.7, 2.8, 7.2)

Evidence accounting:

```text
resultsAccounting: {
  controlRehearsal: 4,
  scoredAttempts: 58,
  eligible: 54,
  validForAtLeastOnePrimaryMeasure: 48,
  invalidForAllPrimaryMeasures: 4,
  conditionallyValidSensingOnly: 2,
  matchedValidABPairs: 20,
  validConfigBConfirmationOpportunities: 8,
  primaryValidRunRate: "48/58 = 0.828 = 82.8%"
}
```

Primary results:

| Measure | Config A | Config B | Delta / note |
| --- | --- | --- | --- |
| Usable warning time, median (matched pairs) | 76 s | 123 s | Median paired improvement 46 s; 95% bootstrap interval 35 to 57 s; exceeds 25 s minimum meaningful effect |
| Mission margin, median | -14 s (76-80-10) | +33 s (123-80-10) | Baseline late at median |
| 90 s threshold achievement | 3 of 20 = 0.15 | Matched: 18 of 20 = 0.90, Wilson 95% approx 0.70-0.97. Matched + confirmatory: 25 of 28 = 0.893, Wilson 95% approx 0.73-0.96 | Interval too wide for a universal 90% claim; supports the screening and next-phase decision |
| First-stable-track range, median distance to boundary | 2.28 km | 3.69 km | Median increase 1.41 km; at 30 m/s approx 1,410/30 = 47 s (agrees with warning-time increase) |
| Track continuity | 0.96 | 0.94 | Difference -0.02, inside allowed 0.03 loss |
| Position RMSE, median | 28 m | 34 m | Customer limit 50 m; both inside |
| Handoff success | 19/20 | Matched 18/20; confirmatory 7/8; combined 25/28 | Failure categories: two stale-object correlation timeouts; one delayed adapter message under the sector-boundary condition |
| C2 latency, 90th percentile source-to-C2 | 1.9 s | 2.5 s | Added 0.6 s; allowed increase 1.0 s |
| False-track rate (per valid surveillance hour) | 0.4 | 1.2 | Customer screening limit 1.5; inside limit but a clear workload trade-off |

Geometry effect (sector-boundary cell): median paired improvement 28 s; 2 of 6 Config B opportunities below the 90 s threshold; 2 of 3 handoff anomalies. Main residual performance risk.

Worked example values (fixtures; math in MASTER-CALCULATIONS.md):

- Example warning calc: threat 3,600 m from boundary at decision-ready, ground speed 30 m/s: warning = 120 s; margin = 120 - 80 - 10 = 30 s.
- Sensitivity, faster threat: distance 3,690 m, speed 30 -> 35 m/s: warning 105.4 s; margin 15.4 s.
- Sensitivity, longer engagement: represented time to effect +20 s: revised chain 100 s; revised requirement 110 s; Config B median margin 123 - 110 = +13 s; Config A median margin 76 - 110 = -34 s.
- Unknown-outcome handling: keep primary, best-case, and worst-case treatments of anomalous runs visible (excluding the 3 Config B handoff anomalies makes the estimate artificially favorable).

Hypothesis evaluation results:

| Hypothesis | Result |
| --- | --- |
| H-01 | Supported for the tested factor space (46 s; interval 35-57; min effect 25) |
| H-02 | Directionally supported with a geometry limitation (0.6 s added latency; 25/28; anomalies cluster at sector boundary) |
| H-03 | Supported under tested conditions (-0.02 vs -0.03 allowed; 34 m vs 50 m limit) |
| H-05 | Supported for the tested core condition, not all geometries (+33 s median; sector-boundary margin smaller and less stable) |

### 1.18 Bounded finding and ACT outputs `[ILLUSTRATIVE]` (file 12 secs 5.5, 5.6)

Customer finding (verbatim seed text):
> "Under the tested fixed-site configuration, Group 2 fixed-wing surrogate, operator procedure, clear-day conditions, and nominal network state, adding the EW-1 early-warning layer increased median paired decision-ready warning time by 46 seconds. Configuration B produced a +33-second median mission margin compared with -14 seconds for the baseline. Track continuity and position error remained inside the customer limits. The added layer increased nuisance-track burden and exposed a sector-boundary correlation weakness. The evidence supports continued integration and focused regression. It does not establish performance against other threat classes, adaptive profiles, contested spectrum, saturation, or another engagement chain."

Recommended customer action (with restrictions): proceed with Configuration B for the next controlled phase; use the tested sensor placement and software baseline; do not claim coverage outside tested approach geometries; treat the sector-boundary region as a known limitation; keep the current operator procedure until the nuisance-track workflow is tested; do not generalize to another threat signature or guidance method.

Required corrective work (numbered):

1. Correct stale-object handling in FA-1/C2-1.
2. Add correlation diagnostics to the Workbench data view.
3. Repeat the sector-boundary condition after the correction.
4. Confirm that added filtering does not reduce early warning.
5. Re-run the eight-opportunity Configuration B confirmation set.

Next test package (regression package): twelve focused sector-boundary opportunities; six nominal-network and six degraded-network opportunities; paired pre-fix/post-fix comparison if both builds remain available; primary outputs: handoff success, latency, warning time, continuity, nuisance-track rate.

Later expansion (after regression passes): faster threat profile; reduced-emission profile; one bounded-adaptive route response; multi-axis and repeated-wave load; end-to-end range-approved engagement outcome.

### 1.19 Day-of screens and product lists (seed UI field lists) `[ILLUSTRATIVE]` (file 12 secs 4.3-4.5, 5.1-5.3)

Day dashboard fields: today's question and target evidence; planned and completed pairs; current configuration; current threat and condition; valid evidence by matrix cell; open gaps; estimated time remaining; next three priority runs.

Current-run screen (displays ONLY): card and run IDs; purpose and prediction; configuration; threat profile; changed factor; procedure step; required sources and health; large event-mark buttons; deviation and observation entry.

Post-run quick look (auto-report within minutes): threat profile compliance; required files present; configuration match; clock and source health; first-detection time and range; first-stable-track time and range; usable C2 track time; boundary crossing time; usable warning time; mission margin; whether the paired run remains comparable. Rule: quick look supports the next-run decision; it does not replace final analysis.

Workbench products, before execution: customer-question record; test-object and architecture profiles; threat profile; measure definitions; hypotheses and predictions; sample rationale; test matrix; randomized run order; lean cards; data-field manifest; rehearsal checklist; spreadsheet field pack.
Workbench products, day of test: day dashboard; current-run card; source-health view; event-mark controls; actual-condition capture; deviation and anomaly forms; quick-look calculations; evidence-coverage map; next-run recommendation.
Workbench products, after execution: run accounting; measure-level validity record; per-run results; configuration comparison; prediction-versus-result view; hypothesis evaluation; sensitivity calculations; bounded finding; recommended actions; regression package; exports in Excel, CSV, JSON, PDF, and print.

### 1.20 Seed identifier vocabulary (file 12 sec 7.3; file 13 sec 7)

Campaign-local `[ILLUSTRATIVE]`: `J401-EW-01`; `Q-01`..`Q-05`; `H-01`..`H-05` (no H-04); `M-01`..`M-10`; `TC-J401-EW-COMP-01-v1.0`; `THR-G2-FW-01-v1.2`; `COND-DAY-CLEAR-NET-NOM-v1`; matrix cell `AZ-BND / ALT-60 / SPD-30`; system IDs `EW-1`, `TRK-1`, `FA-1`, `C2-1`, `ENG-1`; configurations `A` / `B`.

Field Guide ID grammar examples (seed the ID generator): `CAMP-CUAS-2026-04`; `OQ-CUAS-017`; `TC-CUAS-TRK-004-v1.2`; `CFG-BLUE-20260818-03`; `THR-G2-FW-LOW-02-v2`; `RUN-0047`; `DEV-###`. Register series: `OQ-001...`, `CLM-001...`, `UNK-001...`, `ASM-001...`.

---

## 2. Worked card templates (seed card library)

Six seed cards ship with the app: five gold-standard worked cards (file 11 sec 4) plus one complete notional card (file 13 sec 4.2). Every value in brackets `[...]` is a placeholder that must resolve to a controlled record before issue. Source disclaimer (carry on all six): "These cards are illustrative designs, not reconstructions of a Valkryn campaign and not Valkryn performance results."

Card section schema (union of the five worked cards; the app's card template; file 11 sec 4.1):

```text
Control (Card ID, Title, Version/status)
-> Traceability (Decision, Question, Hypothesis, Measures, Matrix cell)
-> Purpose
-> Planned repetition / Design
-> System/Controlled state
-> Threat/Input state
-> Condition / Treatment / Events / Effect definition   (card-type specific)
-> Variables / Experimental units                        (card-type specific)
-> Data and truth
-> Preconditions                                         (Card 1 only, explicit)
-> Procedure (numbered steps)
-> Expected nominal result                               (Card 1)
-> Stop and validity / Validity and repeat / Validity and failure classification
-> Required outputs
-> Allowed conclusion
-> Prohibited conclusion
```

Version/status enum: `{draft, approved, issued}`.

### 2.1 Card `TC-CUAS-SEN-CHAR-001` - Detection and stable-track characterization by geometry

1. Control: Card ID `TC-CUAS-SEN-CHAR-001`; Title "Detection and stable-track characterization by geometry"; Version/status `[version] / draft, approved, or issued`.
2. Traceability: Decision `[decision ID]`. Question: Under the defined threat and conditions, where does the sensor detect and establish a stable track? Hypothesis: Detection and stable-track performance vary with `[range, altitude, azimuth/aspect, speed, or selected factors]`. Measures: `CUAS-SEN-PD-001`, `CUAS-SEN-FD-002`, `CUAS-TRK-FST-003`, `CUAS-TRK-CONT-004`, `CUAS-TRK-ERR-005`, `CUAS-SUR-FTR-007`. Matrix cell `[cell ID]`.
3. Purpose: Characterize the sensor's valid detection and track boundary under one controlled configuration and approved factor cell.
4. Planned repetition: Valid opportunities required `[from quantitative design]`; Current repetition/block `[number and block]`; Order `[randomized or restricted schedule]`; Blocking `[day, operator, threat article, weather, or none]`; Invalid-run allowance `[planning value only]`.
5. System state: Sensor/configuration `[configuration ID]`; Placement/boresight `[registration record]`; Network/C2 state `[included or isolated]`; Operator procedure `[procedure ID]`; Training state `[record]`.
6. Threat state: Threat profile `[threat-profile ID]`; Truth-object ID assigned before run; Geometry `[route, altitude, speed, approach azimuth/aspect]`; Red-controlled variables `[exact list]`; Held variables `[exact list]`; Fidelity limitations `[threat record]`.
7. Condition: Condition ID `[weather, clutter, illumination, RF/network state]`; Eligibility volume/range band `[controlled definition]`; Limits `[from condition record]`.
8. Variables: Independent `[selected geometry or configuration factors]`. Held controls: sensor settings, placement, threat profile elements, operator procedure, and other design controls. Covariates: actual speed/altitude/aspect, weather, RF state, temperature, battery/power state, and time of day as applicable.
9. Data and truth: Independent trajectory/identity truth `[source ID]`; Sensor plots/tracks/status `[source fields]`; Registration record `[ID]`; Common time/tolerance `[time record and measure-specific limit]`; Ground-truth coverage: complete eligibility interval. Health stop: loss of mandatory truth, unknown configuration, time/registration outside tolerance, or source gap exceeding the measure rule.
10. Preconditions: correct card/run/configuration/threat/condition IDs active; sensor available and approved settings loaded; truth and sensor recording active; clocks and registration pass; route and operating volume ready; data-health alerts and fallback tested; active campaign constraints and stop conditions confirmed.
11. Procedure:
    1. Test conductor states card, version, run ID, purpose, and matrix cell.
    2. Data monitor confirms sensor, truth, environment, and run-log recording.
    3. Ground-truth operator confirms truth-object identity and health.
    4. Sensor operator confirms configuration without changing approved settings.
    5. Threat begins outside the eligible interval.
    6. Test conductor authorizes entry into the profile.
    7. Threat executes the approved route and factor levels.
    8. Run logger time-tags entry, phase transitions, operator calls, data warnings, and exit.
    9. Threat exits or enters the approved recovery state.
    10. Continue recording for the post-event margin.
    11. Save actual configuration, threat, condition, truth, and source records.
    12. Conduct factual debrief and assign preliminary data-health state.
12. Expected nominal result: The system may transition through no report, detection, tentative track, stable track, loss, and reacquisition states. No performance value is assumed.
13. Validity and repeat. Valid for a measure only if: truth establishes the full opportunity; configuration and profile remain within bounds; association, time, and registration meet tolerance; required source health passes; no uncontrolled change affects the measure. Repeat when a written validity rule fails. Preserve valid failures as results.
14. Required outputs: opportunity-level detection outcome; first-detection and first-stable-track observation or censoring record; track continuity and error; false/nuisance-track accounting; data-health and uncertainty record; run status and allowed/prohibited uses.
15. Allowed conclusion: Performance under the tested configuration, threat, geometry, and conditions.
16. Prohibited conclusion: Universal detection range, all-aspect coverage, or operational effectiveness outside the tested factor space.

### 2.2 Card `TC-CUAS-C2-HANDOFF-001` - Source-track fusion and C2 handoff performance

1. Control: Card ID `TC-CUAS-C2-HANDOFF-001`; Title "Source-track fusion and C2 handoff performance"; Version/status `[version/status]`.
2. Traceability: Question: When the source sensor produces a qualifying track, does the receiving C2 create the correct usable track within the mission timeline? Hypothesis: `[configuration B or interface state]` changes handoff success or latency relative to `[baseline]`. Measures: `CUAS-C2-HS-008`, `CUAS-C2-LAT-009`, `CUAS-MSN-UWT-010`. Matrix cell `[source x C2 x network x threat/condition]`.
3. Purpose: Measure source-to-C2 success, identity correctness, latency, and usable warning time while isolating interface behavior.
4. Planned repetition: Qualifying offers required per cell `[design]`; Configuration order `[randomized/blocked]`; Network blocks `[nominal/degraded as approved]`; Pairing `[whether the same controlled input supports paired comparisons]`.
5. Controlled state: Source configuration `[ID]`; C2 configuration `[ID]`; Adapter/schema/version `[ID]`; Network state `[condition ID]`; Correlation/fusion settings `[ID]`; Operator procedure and information state `[ID]`.
6. Threat/input state. Use either: a live truth threat producing a qualifying source track; or a verified recorded/synthetic input approved for the interface question. Rule: do not use synthetic input to claim live sensor performance.
7. Events: Start: source track first meets the approved qualifying-offer criterion. Send: source/adapter records the outbound object/message. Receive: C2 records receipt. Usable stop: receiving C2 track meets the decision-ready criterion. Failure window: `[approved maximum observation interval]`.
8. Data and truth: source-track fields and event logs; adapter/network transmission logs; receiving-system object/event logs; truth/master-object correlation; common time meeting latency tolerance; identifier map preserving source, master, and receiver IDs.
9. Procedure:
    1. Confirm configurations, schema, identifiers, and time.
    2. Start all source, adapter, network, C2, truth, and run-log recorders.
    3. Generate the approved qualifying source track.
    4. Preserve normal operational processing; no coaching or manual repair.
    5. Record source qualification, send, receive, correlation, and usable-track events.
    6. Continue through success, approved timeout, or stop condition.
    7. Save message payload/metadata allowed by the campaign record.
    8. Reset the interface and object state.
    9. Verify no stale track or queued message carries into the next run.
    10. Adjudicate identity, success, latency, and failure category.
10. Stop and validity. Stop/hold for: clock offset beyond latency tolerance; ambiguous object identity; unapproved schema/configuration change; mandatory log loss; stale state from the prior run; network condition outside the card. Rule: a valid failed handoff remains in the denominator.
11. Required outputs: successful handoffs / valid qualifying opportunities; source-to-receive and source-to-usable latency with censoring; correct, duplicate, split, merged, stale, or misassociated outcomes; usable warning time; failure-stage classification; allowed/prohibited comparisons.
12. Allowed conclusion: Interface/fusion performance for the tested source, C2, adapter, network, object state, and operational criterion.
13. Prohibited conclusion: End-to-end mission effectiveness when sensing, decision, engagement, or effect was not represented.

### 2.3 Card `TC-CUAS-EW-SOFTKILL-001` - Mission-relevant EW effect and recovery

1. Control: Card ID `TC-CUAS-EW-SOFTKILL-001`; Title "Mission-relevant EW effect and recovery"; Version/status `[version/status]`.
2. Traceability: Question: Under the approved threat, geometry, and represented EW condition, does the threat enter the defined mission-relevant effect state, and for how long? Hypothesis: The treatment changes the probability or time of the defined effect relative to the approved baseline/control. Measures: `CUAS-EW-EFF-011`, `CUAS-EW-REC-012`, `CUAS-MSN-E2E-015` when a complete mission vignette is represented. Matrix cell `[threat guidance x geometry x treatment x environment]`.
3. Purpose: Characterize a bounded functional or mission effect without equating temporary disruption with physical defeat.
4. Planned repetition and order: Valid opportunities per treatment/control cell `[design]`; Treatment order `[randomized or blocked]`; Washout/reset `[approved state and duration]`; Threat article/software blocks `[design]`; Sequential rule `[if used]`.
5. Threat state: Threat profile/configuration `[ID]`; Guidance/navigation/communications state `[ID]`; Mission task `[defined route or objective]`; Independent truth telemetry/state sources `[IDs]`; Reset state verified before each opportunity.
6. Treatment state (reference the approved campaign representation): treatment condition ID; commanded/applied state; monitored exposure fields; geometry and timing; control or sham condition; permitted factor variation; applicable operating limits.
7. Effect definition. Freeze one or more states: navigation deviation beyond `[criterion]`; loss of control or guidance for `[criterion]`; mission-route abandonment; failure to reach a required waypoint/terminal condition; forced recovery or safe-state entry; temporary suppression; recovery to nominal mission state. Rule: do not change the effect definition after viewing results.
8. Data and truth: independent threat trajectory and state; treatment exposure/event record; threat onboard telemetry when allowed; environmental/RF record; operator actions; common time meeting effect-latency tolerance; effect-state adjudication record.
9. Procedure:
    1. Confirm active card, profile, treatment/control condition, and run ID.
    2. Verify threat reset and nominal function.
    3. Start truth, treatment, environment, telemetry, and run-log recording.
    4. Begin the approved threat mission.
    5. Establish the qualifying baseline state.
    6. Apply the approved treatment or control according to the card.
    7. Time-tag treatment qualification.
    8. Observe until effect, recovery, vignette end, censoring, or stop.
    9. Return systems to the approved safe/reset state.
    10. Preserve as-commanded and as-observed treatment records.
    11. Adjudicate effect, time to effect, recovery, mission outcome, and validity.
10. Stop and validity. Stop under existing campaign controls for any safety, regulatory, system, data, or security trigger. Measure invalid when: qualifying exposure cannot be established; threat state or mission task differs materially; independent effect truth is unavailable; time alignment exceeds tolerance; reset/carryover cannot be excluded.
11. Required outputs: effect successes / valid opportunities; time to effect and recovery with censored cases; effect mode and duration; mission outcome; treatment/exposure uncertainty; carryover and repeatability assessment; conditions where generalization is prohibited.
12. Allowed conclusion: Bounded functional or mission effect under the represented treatment, threat state, geometry, and conditions.
13. Prohibited conclusion: Universal susceptibility, legal operational employment, physical destruction, or effectiveness against an unrepresented foreign system.

### 2.4 Card `TC-CUAS-DEF-INTERCEPT-001` - Interceptor assignment, intercept, and confirmed defeat

1. Control: Card ID `TC-CUAS-DEF-INTERCEPT-001`; Title "Interceptor assignment, intercept, and confirmed defeat"; Version/status `[version/status]`.
2. Traceability: Question: Does the tested kill-chain configuration create and execute a valid engagement that defeats the defined threat before the mission boundary? Hypothesis: The tested architecture achieves a higher probability of confirmed defeat or greater engagement margin than `[baseline/comparison]`. Measures: `CUAS-C2-LAT-009`, `CUAS-MSN-UWT-010`, `CUAS-DEF-PINT-013`, `CUAS-DEF-PDEF-014`, `CUAS-MSN-E2E-015`. Matrix cell `[sensor/C2/effector x threat x geometry x condition]`.
3. Purpose: Separate failures in detection, decision, assignment, launch, guidance, intercept, effect, and mission outcome.
4. Planned repetition: Valid engagement opportunities `[design]`; Threat/effector article blocks `[design]`; Configuration order `[design]`; Rare severe failures `[handling rule]`; Reset/maintenance criteria `[record]`.
5. System and threat state: Blue architecture/configuration `[ID]`; Interceptor/effector article and state `[ID]`; Threat profile/article `[ID]`; Engagement and defended-asset boundaries `[geometry record]`; Operator procedure `[ID]`; Inventory and readiness state `[record]`.
6. Event chain (freeze the exact event criterion for each stage):

   ```text
   qualifying track -> decision-ready track -> assignment -> authorization if represented
   -> launch/release -> guidance -> intercept -> effect -> defeat assessment -> boundary or mission outcome
   ```

7. Data and truth: threat and interceptor trajectories; sensor/C2 track and decision logs; assignment and launch/release events; effector health/guidance state; independent intercept/effect evidence; boundary crossing and threat mission outcome; common time and spatial registration inside approved uncertainty.
8. Procedure:
    1. Confirm complete blue/red configurations and truth coverage.
    2. Start all recorders before threat entry.
    3. Execute the approved threat vignette.
    4. Allow the architecture and operators to follow the frozen procedure.
    5. Prevent unapproved coaching, tuning, reset, or vendor intervention.
    6. Time-tag every mission-thread transition.
    7. Execute the engagement within active controls.
    8. Continue truth and outcome recording through assessment and post-event margin.
    9. Recover systems and preserve physical/electronic evidence.
    10. Conduct factual debrief.
    11. Adjudicate each mission-thread stage, intercept, effect, defeat, and validity.
9. Validity and failure classification. A valid failure remains evidence. Classify the first mission-relevant failure stage (enum): Detection; Track; Classification/identification; C2 handoff; Decision/assignment; Authorization/procedure; Launch/release; Guidance; Intercept; Effect; Assessment; Test infrastructure; Unknown. Unknown effect outcomes follow the approved primary and sensitivity rules.
10. Required outputs: engagement timeline and margin; valid opportunity, intercept, and defeat counts; probability intervals; stage-specific failure classification; miss/intercept geometry with uncertainty; defeat confidence/adjudication; mission outcome; configuration, condition, and validity limits.
11. Allowed conclusion: End-to-end performance for the tested architecture, threat, operators, procedure, and conditions.
12. Prohibited conclusion: Operational suitability, broader threat coverage, or effectiveness outside the tested articles and vignettes without supporting evidence.

### 2.5 Card `TC-CUAS-SAT-RAID-001` - Multi-threat tracking, assignment, engagement, and leaker characterization

1. Control: Card ID `TC-CUAS-SAT-RAID-001`; Title "Multi-threat tracking, assignment, engagement, and leaker characterization"; Version/status `[version/status]`.
2. Traceability: Question: Under the defined raid size, arrival process, geometry, and threat mix, where does the architecture lose mission capacity? Hypothesis: Mission success, track continuity, or engagement completion changes as concurrent load increases. Measures: `CUAS-TRK-CONT-004`, `CUAS-C2-HS-008`, `CUAS-C2-LAT-009`, `CUAS-SAT-LEAK-016`, `CUAS-HMI-INT-018`, `CUAS-MSN-E2E-015`. Matrix cell `[raid size x spacing x geometry x threat mix x configuration]`.
3. Purpose: Identify system, interface, operator, or resource bottlenecks under controlled multi-threat load.
4. Design: Raid sizes/levels `[approved levels]`; Arrival spacing or process `[definition]`; Threat mix `[profiles and proportions]`; Geometry `[routes/axes/altitudes]`; Configuration `[ID]`; Replications per raid cell `[quantitative design]`; Blocking `[day, operator, article, configuration]`; Escalation/sequential rule `[preapproved rule]`. Rule: do not escalate load merely because the prior run looked favorable unless the approved sequence permits it.
5. Experimental units: Primary mission unit: one complete valid raid. Nested object unit: one truth threat within the raid. Preserve raid identity in all object-level analysis. Do not treat threats from one raid as independent raids.
6. Controlled state: Blue configuration and resource inventory `[ID]`; Operator/crew procedure and staffing `[ID]`; Threat profiles and coordination behavior `[IDs]`; Network/environment state `[condition ID]`; Reset state, queues, tracks, and inventory cleared before run.
7. Data and truth: identity-preserving truth for every threat; raid membership and planned/actual arrival times; blue source tracks and master-track associations; C2 queue, correlation, assignment, and engagement records; operator actions and workload/interventions; effector inventory, assignment, launch, and outcome; boundary crossing and mission outcome; system health, processor/network load, and resource state where available.
8. Procedure:
    1. Confirm raid, threat-object, run, configuration, and condition IDs.
    2. Verify blue and red reset state.
    3. Start truth, blue, environment, operator, resource, and run-log recording.
    4. Launch/initiate the approved raid according to the timing plan.
    5. Preserve planned red behavior and coordination bounds.
    6. Allow blue operators and systems to execute the frozen procedure.
    7. Time-tag object entry, detection, track, classification, handoff, assignment, engagement, defeat, and boundary crossing.
    8. Record queueing, dropped/merged/split tracks, operator interventions, and resource exhaustion.
    9. Continue through raid completion or approved stop.
    10. Preserve post-event state and logs.
    11. Adjudicate each threat and the raid-level mission outcome.
    12. Reset every queue, track, inventory, and system state before another raid.
9. Stop and validity. Stop or hold for: loss of identity-preserving truth; threat spacing or raid membership outside tolerance; unapproved load or behavior; unknown blue resource/configuration state; common-time or correlation failure; safety, regulatory, system, or data-health trigger. Rule: a raid may be conditionally valid for early-stage sensing measures but invalid for defeat if an effector or outcome source fails. Record measure-specific use.
10. Required outputs: threat-object and raid counts; detection/track/handoff/engagement outcome by object; leaker fraction and raid-failure probability; concurrent-track, assignment, and engagement load; queueing and latency by mission stage; operator intervention rate; resource exhaustion and recovery; first observed capacity boundary; uncertainty, clustering, and validity limits.
11. Allowed conclusion: Architecture performance and observed bottlenecks for the tested raid definition, threat mix, geometry, configuration, operator procedure, and conditions.
12. Prohibited conclusion: Universal swarm capacity, performance against autonomous coordination not represented, or a maximum capacity beyond the tested load.

### 2.6 Card `TC-CUAS-SOS-EWBUF-001` v1.0 - Complete notional counter-UAS test card (file 13 sec 4.2)

Source caveat, verbatim (carry on the card): "This is a recommended example, not a reconstruction of the JIATF-401 campaign. Systems, thresholds, configurations, repetitions, and procedures below must not be attributed to that case."

- Test Card ID: `TC-CUAS-SOS-EWBUF-001`. Version: 1.0. Question: `OQ-CUAS-004`.
- Customer question: Does adding an early-warning sensor to the baseline tracking-radar/C2 architecture create materially more usable warning time against the defined threat without degrading track quality or C2 handoff performance?
- Test purpose: characterize the operational value of an additional early-warning layer.
- Hypothesis: Configuration B produces an earlier usable track than Configuration A while maintaining acceptable tracking and interface performance.
- System configuration: A (Baseline): `Tracking sensor -> C2`. B (Treatment): `Early-warning sensor -> Tracking sensor -> C2`. Exact hardware/software versions recorded in `CFG-A` and `CFG-B`.
- Threat profile: `THR-G2-FW-01-v1`. Representative Group 2 fixed-wing surrogate executing the customer-approved profile. Threat geometry, altitude, speed, navigation mode, emissions, and route are locked in the threat-profile object.
- Preconditions: configuration manifests captured; mandatory telemetry available; independent threat ground truth operational; clocks synchronized within approved measurement-error budget; sensor calibration complete; C2 logging enabled; range safety approval active; weather and RF environment captured.
- Variables: Independent: Architecture A/B. Controls: threat profile, route, blue emplacement, blue operator procedure. Covariates: weather, RF environment, target aspect, actual speed/altitude.
- Measures (definitions in MASTER-CALCULATIONS.md): 1. Usable Warning Time. 2. Detection Probability. 3. Track Position Error. 4. Track Continuity. 5. C2 Handoff Latency. 6. Nuisance/False Track Rate.
- Data sources and ground truth: early-warning sensor telemetry; tracking sensor telemetry; C2 event logs; network timing logs; independent threat-position source; environmental/RF record; operator event log.
- Procedure:
  1. Verify card, configuration, threat, and run ID.
  2. Snapshot hardware/software/configuration state.
  3. Verify mandatory feeds and timestamps.
  4. Conduct instrumentation health check.
  5. Execute dry run without scoring.
  6. Execute Configuration A run.
  7. Confirm data validity.
  8. Repeat according to statistical plan.
  9. Change only the architecture variable.
  10. Verify Configuration B baseline.
  11. Execute Configuration B runs using the same approved threat conditions.
  12. Reduce mandatory measures.
  13. Compare A versus B.
  14. Record abnormalities and deviations.
  15. Determine whether evidence is sufficient or another condition is required.
- Expected result: Configuration B should provide greater usable warning time; interpret any improvement alongside track quality, false tracks, and handoff latency.
- Performance thresholds: customer operational pass/fail threshold is an execution blocker until customer-approved. For characterization, report: estimated difference A versus B; confidence/credible interval; observed variability; any performance trade; validity limits.
- Safety and abort criteria. Immediate abort on: range-safety direction; aircraft outside authorized profile; unsafe system state; loss of safety-critical control; unauthorized emitter/system state. Pause or invalidate affected measure on: missing mandatory telemetry; failed ground truth; clock synchronization outside tolerance; unknown configuration change.
- Data-quality checks: mandatory data channels present; correct run ID applied to all sources; configuration hash/manifest unchanged; ground truth valid; timestamp alignment within approved tolerance; no unexplained data discontinuity during critical interval; threat profile remained within defined bounds.
- Required outputs: run-validity determination; annotated engagement timeline; per-measure results; configuration comparison; deviations; evidence limitations; remaining evidence gaps; recommended next test.
- Deviations/change record: every deviation receives a `DEV-###` identifier associated with the run, affected measure, and resulting validity decision.

### 2.7 Card-issue gate (blocks status advance to `issued`; file 11 sec 3.10)

- Every bracketed placeholder resolves to a controlled record.
- Measures use the current dictionary versions.
- Planned repetitions and stopping rules trace to the quantitative design.
- Truth, time, registration, and data-health limits trace to the instrumentation plan.
- Event and denominator definitions are frozen.
- The complete procedure has passed cold-reader review and dry run.
- The team can name which measures remain available after each permitted degraded condition.
- Allowed and prohibited conclusions are explicit.

---

## 3. Threat / OPFOR seed content (file 08)

### 3.1 Threat-profile parameter sets (file 08 sec 1.2; one version-controlled profile per operationally distinct presentation; any performance-affecting change forks a new profile or recorded variant)

Threat mission / intended effect (enum, one or more):

```text
["Reconnaissance or target development", "Persistent observation", "Route or site reconnaissance",
 "One-way attack", "FPV attack", "Munition delivery", "Decoy or defensive-system stimulation",
 "Electronic attack or relay", "Saturation or magazine depletion", "Combined reconnaissance and attack",
 "Post-strike assessment", "Other stated mission behavior"]
```

Rule: do not infer payload effect from airframe type alone.

Physical and kinematic profile fields:

```text
["Airframe class and relevant UAS group", "Dimensions and weight when relevant", "Payload state",
 "Speed bands", "Altitude bands", "Climb, descent, acceleration, and turn behavior",
 "Endurance required for the test", "Route and approach axis", "Launch point or entry point",
 "Standoff, release, or terminal geometry", "Terrain masking and line-of-sight behavior",
 "Hover, loiter, orbit, dive, pop-up, or crossing behavior",
 "Recovery, impact, timeout, or lost-link behavior",
 "Formation spacing and timing for multi-aircraft events"]
```

Rule: use ranges when natural variation is part of the threat; use exact values when repeatability must isolate a blue-system factor.

Control, navigation, and autonomy fields (record separately):

```text
["Manual control", "Waypoint or preplanned navigation", "GNSS dependence",
 "Inertial or alternate navigation", "EO or other terminal guidance",
 "Automated target recognition or tracking", "Lost-link behavior",
 "Behavior after navigation degradation", "Behavior after control-link degradation",
 "Human intervention points", "Degree of autonomy actually exercised during the run"]
```

Rule: do not label an aircraft "autonomous" from a product description; record the behavior executed in the test.

Emissions and observable-signature fields:

```text
["Command-link behavior", "Video-link behavior", "Frequency or band",
 "Channel, waveform, duty cycle, and power when available and relevant", "Frequency agility",
 "Emission timing", "RF-silent portions of flight", "Navigation emissions or dependencies",
 "Radar cross-section representation", "EO/IR appearance", "Acoustic signature", "Visual signature",
 "Transponder, identification, or cooperative-track state",
 "Any signature augmentation used for range safety or truth collection"]
```

Rule: a safety beacon, tracker, transponder, or telemetry radio can change the representation. Record it as an augmentation and assess whether it can affect blue detection or identification.

Coordination and raid behavior fields (multi-aircraft):

```text
["Number of aircraft", "Same-type or mixed-type composition", "Simultaneous or sequential entry",
 "Approach axes", "Spacing in time and distance", "Altitude deconfliction", "Decoy-to-attack ratio",
 "Reconnaissance-to-attack relationship", "Cooperative or independent behavior", "Re-tasking logic",
 "Response to blue emissions or effects", "Repeated-wave timing", "End condition for the raid"]
```

Rule: "Swarm" is not a sufficient profile. State the coordination behavior actually represented.

Threat adaptation fields: define the observable trigger and the allowed response. Seed trigger/response examples:

- Change altitude after detection of a stated blue emission.
- Change route after a stated engagement cue.
- Shift control method after a stated degradation condition.
- Increase spacing after a stated loss.
- Use an alternate approach axis after a stated defensive action.
Rule: never allow an undefined instruction to "act realistically."

Threat-operator state fields:

```text
["Experience with the specific aircraft", "Experience with the script or mission",
 "Familiarity with the range", "Information available before and during the run",
 "Ability to observe blue-system behavior", "Permitted coaching", "Permitted retries or corrections",
 "Workload and number of aircraft controlled", "Fatigue and run-order effects",
 "Communication delay", "Manual intervention count"]
```

Rule: operator identity is not a proficiency description. If red-operator variation can change the result: hold it, block on it, randomize it, or record it as a covariate.

Representation class (enum, file 08 sec 1.3): `actual threat` | `validated surrogate` | `generic representation` | `model/simulation/constructive` | `hybrid`. The label alone does not establish adequacy; complete the fidelity assessment.

### 3.2 Surrogate-fidelity matrix structure (file 08 sec 1.4)

Fidelity state enum:

| State | Meaning | Required treatment |
| --- | --- | --- |
| Faithful | Feature represented within the tolerance required by the measure | Record the verification method and observed tolerance |
| Approximated | Feature represented imperfectly but useful for a bounded purpose | State the difference, expected direction of effect, and allowed conclusion |
| Omitted | Feature absent | State which measures and conclusions cannot use the run |
| Unknown | Available evidence cannot establish the relationship | Treat generalization as unresolved; do not assume equivalence |

Minimum feature list (19 rows, one per feature):

```text
["Mission behavior", "Airframe size and shape", "Payload state", "Speed and altitude",
 "Maneuver and terminal behavior", "Route and geometry", "Radar signature", "RF emissions",
 "EO/IR appearance", "Acoustic signature", "Control method", "Navigation method", "Autonomy",
 "Lost-link behavior", "Resistance to countermeasures", "Coordination and raid behavior",
 "Operator behavior", "Environmental interaction",
 "Blue-system observables created by instrumentation or safety equipment"]
```

Per-feature record fields (10): intended threat state; represented state; fidelity classification; verification source or measurement; tolerance relevant to the measure; likely effect of the difference; measures affected; permitted generalization; prohibited generalization; follow-on evidence needed.

Rules: never calculate one overall fidelity score that hides a critical omission. Adequacy requires all 5 conditions of the fidelity decision rule (see MASTER-CALCULATIONS.md / file 08 sec 2.8). Corollary: a representative flight path does not establish representative RF behavior; representative RF behavior does not establish representative terminal behavior.

### 3.3 OPFOR execution modes (file 08 sec 1.5)

| Mode | Define (required fields) | Best uses | Limitation |
| --- | --- | --- | --- |
| Scripted | Exact initial state; route or maneuver sequence; timing and speed tolerances; trigger points; allowed corrections; abort behavior; reset state; information available to red; invalidating deviations | Baseline characterization; direct configuration comparison; sensor performance across geometry or range; latency comparison; confirmatory repetitions; regression testing | May not expose weaknesses that depend on adversary adaptation |
| Bounded-adaptive | Red objective; observable triggers; menu of permitted responses; bounds for altitude, route, emissions, timing, maneuver; information red may use; information withheld from red; maximum number or sequence of adaptations; required logging of trigger and response; measures designated exploratory or confirmatory | Blue response to route or altitude changes; EW-reactive behavior; alternate approach selection; decision-chain resilience; controlled exploration of defensive boundaries | Adaptive choices are endogenous and can confound a simple treatment comparison. Preserve the complete choice history; avoid claiming classical independent repetitions unless the analysis supports it |
| Free-play | Red objective; starting resources and state; prohibited actions; safety and range bounds; time limit; information available; required event and decision log; instrumentation minimum; conditions that end the event | Failure discovery; human-machine interaction; defensive coordination; novel adversary behavior; end-to-end operational stress | Shows an outcome occurred under one observed interaction; does not estimate probability of success across the operating envelope |

Hybrid campaign sequence: `Scripted baseline -> bounded-adaptive exploration -> diagnostic isolation -> scripted confirmation -> free-play mission thread -> targeted regression`. Do not merge exploratory and confirmatory runs into one undifferentiated result.

Red variable classification (6 classes; classify every threat variable before card issue):

| Class | Meaning | Execution treatment |
| --- | --- | --- |
| Independent variable | Changed deliberately to answer the question | Set the planned levels, order, and comparison |
| Held control | Must remain within tolerance | Verify before and during the run |
| Bounded red choice | Red may select within a stated envelope | Record the choice, trigger, time, and rationale |
| Recorded covariate | Not controlled but measured | Preserve for analysis and interpretation |
| Prohibited variable | Cannot change during the run | A change is a deviation and may invalidate the run |
| Unobserved nuisance | Can affect the result, neither controlled nor measured | Remove it, instrument it, or state the validity risk |

Minimum 14 variables to classify: airframe and payload; software and control configuration; route and approach axis; speed and altitude; launch or entry timing; emission state; navigation and guidance; maneuver; raid size and spacing; counter-countermeasure behavior; operator; red access to blue information; weather and illumination; safety or telemetry augmentation.

Red deviation types (seed enum, 12; file 08 sec 1.10): altitude outside tolerance; route or approach-axis change; late launch; unplanned maneuver; emission state incorrect; navigation mode changed; red operator intervened when intervention was prohibited; aircraft entered lost-link behavior; safety tracker failed or altered the observable state; raid spacing differed from the card; one member of a mixed raid did not participate; red reacted outside the permitted menu. Rule: do not discard an invalid run; label its allowed use.

### 3.4 Threat-coverage matrix seed (file 08 sec 1.8)

Candidate threat rows (12):

```text
["Single manually controlled quadcopter", "Single waypoint-controlled aircraft",
 "RF-silent or reduced-emission segment", "FPV attack profile", "Reconnaissance orbit",
 "One-way attack profile", "Decoy followed by attack", "Mixed reconnaissance and attack",
 "Repeated waves", "Multi-axis raid", "Saturation or capacity stress",
 "Adaptive response to blue action"]
```

Candidate condition columns (10):

```text
["Fixed site or moving force", "Open terrain, complex terrain, or urban clutter",
 "Day, night, and transition light", "Clear, adverse, and changing weather",
 "Permissive, congested, contested, and degraded spectrum",
 "Full, limited, delayed, or disconnected C2", "Friendly UAS and civil-air background",
 "Nominal and degraded sensor states", "Nominal and depleted effector states",
 "Normal and elevated operator workload"]
```

Cell-selection criteria (6; do not attempt every combination): resolves a P1 uncertainty; represents the expected operating center; probes a likely failure boundary; distinguishes competing explanations; tests a degraded state that could change the decision; confirms a previously observed weakness.

VOLT-based matrix construction (file 08 sec 1.18; file 13 sec 1.7): rows are threat presentations traced to the VOLT (Validated Online Lifecycle Threat, DIA-validated under DIAI 5000.002; forecasts adversary capability at IOC and IOC+10 years). Row features: UAS group and airframe class; guidance and RF profile; speed and altitude; raid size; resistance to countermeasures. Columns: electromagnetic environment including contested spectrum; clutter; day and night; rules-of-engagement constraints. Guidance-mode enum: `remote control | waypoint | electro-optical terminal | RF-silent | fiber guidance`. Raid size: one aircraft to a swarm. Flight profile: e.g., loiter or one-way attack. Include UAS Groups 1 through 3. Response layers: Sensing; Command and control; Defeat; Suitability. Government reference scenario set: JIATF-401 and JCO Yuma demonstration series.

### 3.5 Nine seeded vignettes (file 08 sec 4.5; each instantiates the 22-item mission-thread package)

#### V-01 Fixed-site defense

- Decision focus: whether the configured architecture provides sufficient warning, identification, engagement opportunity, defeat, and assessment to protect a defined fixed asset under the tested threat and background conditions.
- Threat presentations: single reconnaissance aircraft; single attack aircraft; reconnaissance followed by attack; decoy followed by attack; mixed low- and higher-altitude approaches; multi-axis raid; repeated waves; reduced-emission or RF-silent segment; threat adaptation after blue emission or engagement.
- Test factors: sensor placement; active and passive sensing mix; early-warning sensor included or excluded; C2 and network path; friendly-air and background-track density; day, night, weather, and clutter; effector type and assignment sequence; passive-defense state; operator workload; one component degraded or unavailable; magazine, duty-cycle, or recovery state.
- Priority measures: first-detection and first-stable-track range; warning margin; track continuity; identification accuracy and time; sensor-to-C2 latency; decision and assignment latency; probability of intercept and mission defeat; raid leakage; effect-assessment time; false-action rate; simultaneous-target capacity; mission continuity.
- Minimum sequence (10 steps): 1. Positive and negative controls. 2. Single-threat scripted baseline. 3. Geometry and condition characterization. 4. Partial-chain isolation. 5. Integrated single-threat run. 6. Mixed-threat or repeated-wave stress. 7. Degraded-component run. 8. Bounded-adaptive run. 9. Scripted confirmation. 10. End-to-end mission-thread event.
- Limits: do not generalize fixed placement, stable power, centralized infrastructure, or persistent connectivity to maneuver operations.

#### V-02 Maneuver formation

- Decision focus: whether the formation retains usable warning and defensive action while moving, halting, displacing, changing geometry, and operating with variable connectivity.
- Threat presentations: route reconnaissance; flank or rear approach; pop-up from terrain masking; FPV or one-way attack during movement; attack during halt or transition; repeated contact after displacement; threat cued by blue emissions; mixed reconnaissance and attack.
- Test factors: movement speed and formation spacing; sensor and effector on-the-move state; setup and teardown time; displacement interval; terrain and masking; network handoff; local versus shared track; loss of one node; communications delay or disconnection; operator task loading; friendly UAS activity; passive-signature state.
- Priority measures: coverage continuity during movement; time without usable detection; time to restore the chain after displacement; track handoff success; alert dissemination time; local decision latency; engagement opportunity lost to movement; setup and re-emplacement time; mission continuity after component loss; workload and intervention.
- Limits: a static emplacement demonstration does not support a maneuver conclusion. Test a mobile platform through transition states, not only while halted.

#### V-03 Convoy and logistics node

- Decision focus: whether the defensive approach protects a moving convoy, temporary halt, transfer point, or logistics node without unacceptable disruption to the supported mission.
- Threat presentations: route reconnaissance; single-axis FPV attack; multi-axis attack; attack during halt or congestion; decoy before attack; repeated attacks intended to exhaust attention or effectors; attack after the convoy disperses; threat using terrain, structures, or background traffic.
- Test factors: convoy length and spacing; sensor placement within the convoy; lead, middle, and trail coverage; speed, halt, and restart; route clutter; friendly emissions; network coverage; local alerting; effector field of fire; civil or friendly-air background; operator workload and competing duties; protected-asset substitution or decoy.
- Priority measures: coverage gaps by convoy position; detection and warning by approach axis; time for alert to reach affected vehicles; track continuity during turns and terrain masking; correct threat association; time to protective action; mission delay; engagement opportunity; threat leakage to the protected element; recovery and convoy restart time.
- Limits: one instrumented vehicle does not establish convoy-wide coverage. Represent the geometry and dissemination path of the supported formation.

#### V-04 Airfield or port defense

- Decision focus: whether the defensive system protects a large, complex site containing friendly aircraft, vehicles, infrastructure, electromagnetic activity, and multiple critical functions.
- Threat presentations: low-altitude perimeter approach; approach mixed with friendly-air activity; reconnaissance of critical nodes; decoy or nuisance traffic; one-way attack against a stated function; multi-axis raid; repeated waves; reduced-emission or autonomous segment; post-strike assessment aircraft.
- Test factors: large-area coverage; buildings, ships, cranes, aircraft, and ground clutter; friendly transponders and identification data; air-operations tempo; spectrum congestion; multiple defended assets; centralized and local alerting; effector sectors and restricted directions; shift turnover; component loss; passive protection of critical functions.
- Priority measures: detection coverage by sector and altitude; false and nuisance tracks; friendly-versus-hostile identification; handoff across coverage sectors; time to protect each critical function; simultaneous-target capacity; raid leakage; false engagement; mission interruption; recovery after attack or component loss.
- Limits: a result for one sector or one protected function does not establish whole-site defense.

#### V-05 Urban defense

- Decision focus: whether the defensive chain can distinguish, track, and respond to a threat in cluttered terrain with occlusion, multipath, constrained engagement geometry, and dense neutral activity.
- Threat presentations: low-altitude street or rooftop approach; short exposure after occlusion; hover or loiter near structures; route changes around buildings; threat mixed with neutral UAS; multi-axis approach; reduced-emission aircraft; attack from short range.
- Test factors: building density and height; sensor placement; occlusion and multipath; EO/IR and acoustic background; neutral UAS; civil communications; constrained effector sectors; alternate sensor cueing; local observer reporting; network delay; day, night, and illumination transition.
- Priority measures: probability of detection by exposure duration; time to reacquire after occlusion; track swaps and false tracks; identification accuracy; warning margin; correct response selection; engagement opportunity; collateral or restricted-sector effects; mission defeat; operator workload.
- Limits: urban results are geometry-specific. Record the structures, sight lines, RF environment, background activity, and engagement constraints needed to reproduce the condition.

#### V-06 Coalition

- Decision focus: whether a combined defensive chain can exchange usable warning and track information, interpret it consistently, and complete the tested mission thread across heterogeneous systems and procedures.
- Threat presentations: use the same threat profiles employed in a national baseline when possible so the effect of coalition integration can be isolated.
- Test factors: data format and interface; track identifiers; coordinate and time reference; classification markings or releasability constraints represented in the event; voice versus digital exchange; translation and terminology; shared versus separate pictures; sensor-to-partner handoff; partner-to-effector handoff; different procedures; network delay, loss, and fallback; friendly-air identification.
- Priority measures: message delivery; data completeness; track association; coordinate and time error; handoff success; duplicate or conflicting tracks; time to common understanding; decision latency; correct assignment; mission-thread completion after network degradation.
- Limits: record the exact systems, interfaces, procedures, data made available, and exercised relationships. Do not infer interoperability outside the tested configuration.

#### V-07 Degraded or disconnected C2

- Decision focus: which portions of the defensive mission thread remain effective after loss, delay, corruption, or partition of the normal information path.
- Degradation states (enum, 12): increased latency; packet loss; intermittent link; loss of central picture; loss of one sensor feed; loss of one effector connection; local-only operation; stale track data; conflicting tracks; clock misalignment; manual voice fallback; complete partition followed by restoration.
- Degradation test factors: time and phase at which degradation begins; duration; nodes affected; information retained locally; fallback procedure; local decision state; operator awareness of degradation; recovery sequence; track and message reconciliation after restoration.
- Priority measures: time to detect the degradation; data age; track continuity; local warning and action time; handoff loss; expired opportunities; correct local response; mission success during partition; time to restore; duplicate, stale, or conflicting actions after restoration.
- Limits: do not introduce an unrecorded network failure and treat it only as realism. The degradation must be measurable and tied to the affected transitions and conclusions.

#### V-08 Contested spectrum

- Decision focus: how the complete mission thread changes when sensing, communications, navigation, or effects operate in a defined congested or contested electromagnetic environment.
- Required condition definition (file 08 sec 1.15): baseline spectrum state; applied emissions or interference; time and location; band, power, waveform, and duty cycle when available and relevant; systems intended to be affected; systems that must remain unaffected; threat control and navigation dependencies; friendly-system dependencies; monitoring source; stop limits; actual measured environment. Rule: "EW on" is not a reproducible test condition. Measure the environment and state what was actually applied.
- Priority measures: detection and track degradation; communications loss or delay; navigation error; threat behavior change; blue-system behavior change; friendly-system effect; soft-kill effect; recovery time; handoff success; end-to-end mission success.
- Limits: measure the environment and state what was actually applied.

#### V-09 Mass, saturation, decoy, and mixed threat

- Decision focus: where the defensive architecture loses track quality, decision capacity, engagement capacity, magazine depth, or mission protection as simultaneous demand increases.
- Threat presentations: increasing raid size; increasing arrival rate; multiple approach axes; mixed airframes; decoys mixed with attack aircraft; reconnaissance preceding attack; repeated waves; threats with different emissions or control modes; bounded adaptation after the first defensive effect.
- Test factors: number of simultaneous objects; track density; arrival spacing; classification mix; operator-to-track ratio; sensor and C2 processing load; effector inventory; reload, reset, thermal, or duty-cycle limits; assignment policy exercised; network load; background traffic.
- Priority measures: probability of detection per threat and per raid; track initiation and continuity under load; track swaps and duplicate tracks; identification accuracy; time to decision; assignment conflicts; simultaneous engagements; raid leakage; defeated threats by type; protected-asset outcome; resource expenditure; operator workload; recovery before the next wave.
- Limits: do not describe constructive or simulated raid members as live aircraft. State which objects were live, virtual, or constructive and which mission-thread transitions each could stimulate.

### 3.6 Evidence-boundary labels (seed enums; file 08 sec 1.12)

Three-kind separation (page 08): `doctrine or approved operational basis` | `observed or emergent practice` (may inform test factors, is not doctrine) | `test-specific assumption` (label it and limit the conclusion).

Six-label enum (page 09; tag every input to a mission-thread design): `Doctrine` | `Observed practice` | `Test assumption` | `Site constraint` | `Measured result` | `Inference` (must state basis and limit).

### 3.7 Observed-practice figures (OSINT compendium; file 08 sec 7.2)

Label on every use: `observed practice`, never doctrine. Source-base caveats to carry: RUSI single analytical lineage (6 of 10 findings); Ukrainian government claims unverified; Shahed cost figures sensitive to unit-cost assumption; findings describe 2024-2025 conditions and are time-sensitive.

Verified findings (3-vote adversarial verification, confidence high):

| # | Figure / finding |
| --- | --- |
| 1 | Ukrainian seven-phase combined-arms framework: survey, isolation, degradation, fixing, suppression, close combat/destroy, consolidation; UAVs in every phase. Emergent practice, not codified doctrine |
| 2 | FPV kill zone: majority of Ukrainian FPV kills within ~3 km either side of the forward line of troops |
| 3 | Fiber-optic FPV outliers: 10-20 km |
| 4 | 60-80% of Ukrainian FPVs fail to reach their targets |
| 5 | Tactical UAVs accounted for 60-70% of damaged/destroyed Russian systems as of early 2025 |
| 6 | March 2026: 96% of 35,351 claimed monthly Russian casualties attributed to tactical drones (unverified Ukrainian General Staff claim) |
| 7 | Operator video-feed control markedly more effective than AI/pixel-lock terminal guidance, except against regular-outline targets (air-defense systems, enemy UAVs, EW antennas) |
| 8 | Manufacturer claim: ~80% AI hit rate vs ~40% manual, applies under jamming |
| 9 | Battlefield transparency: near-total within 3 km of line of contact |
| 10 | Diminishing surveillance density to 15 km |
| 11 | Taskable reconnaissance to ~40 km |
| 12 | Russian Orlan-10/Zala ISR: 1,000-1,300 daily overflights by Aug 2023 |
| 13 | 1,000-1,500 daily orbits by Aug 2024 (possible airframe double-counting) |
| 14 | Ukrainian response: networked radar/EO-cued interceptor UAVs (Brave1 ELF-P, VB140) |
| 15 | FPVs most efficient against slow low reconnaissance drones; radar-guided interceptors handle higher-flying targets |
| 16 | GPS jamming is the dominant counter-UAS measure against GNSS-dependent systems |
| 17 | Adaptations to GPS jamming: fiber-optic tethered drones (~15 Ukrainian firms by early 2025), machine-vision terminal guidance, CRPA antennas |
| 18 | Manually piloted FPVs are defeated by control-link/video jamming instead |
| 19 | Shahed campaign: over 19,000 missiles and drones Sep 2022 - Dec 2024 |
| 20 | Including 14,700+ Shahed/Geran one-way attack drones |
| 21 | Sep-Dec 2024 launches exceeded the preceding 23 months combined |
| 22 | Shahed production ~2,000/month by end-2024 |
| 23 | Shahed unit cost $35k-$80k |
| 24 | CSIS estimate ~$350,000 per target actually struck |
| 25 | Ukraine industrial base: 7 manufacturers (2022) to 500+ (2026) |
| 26 | Annual capacity: ~5,000 to projected 7 million (government projection, not realized output) |
| 27 | NATO C-UAS readiness gap: structured C-UAS capability absent from most NATO land forces (Oct 2024 RUSI assessment) |
| 28 | NATO 2028 readiness aiming mark |
| 29 | Ukraine component mix targeting 1M drones in 2024 (Doctrine-page context line) |

Refuted claims blocklist (failed 3-vote verification; DO NOT CITE; app surfaces this list when a user cites one):

| # | Refuted claim | Vote |
| --- | --- | --- |
| 1 | Ukrainian drones account for >65% of destroyed Russian tanks | 0-3 |
| 2 | Low-cost drones have "democratized air power," replacing traditional air forces | 0-3 |
| 3 | Drone effectiveness depends less on technology than organizational integration, as stated | 0-3 |
| 4 | Wire/fibre-guided FPVs are EW-immune but limited to ~10 km with degraded flight performance | 0-3 |
| 5 | Most brigades field a UAV company/battalion per 40-70 km of front; each battalion generates 4-6 orbits | 1-2 |
| 6 | Shaheds hit <10% of targets vs 90-95% for Iskander-M/Kh-22 | 0-3 |
| 7 | FPV units: 50-60% targeting efficiency vs 0.5-1.5% for artillery | 1-2 |
| 8 | Interceptor drones (~100k produced 2025, ~2,000/day) down ~70% of Russian Gerans | 1-2 |

### 3.8 Doctrine thresholds and term dictionary (file 08 secs 1.17, 2.9, 7.4; seed the library so doctrine terms map to selectable testable conditions)

Numeric doctrine thresholds (default reference values in the app):

| Constant | Value | Source context |
| --- | --- | --- |
| Detect-to-engage design threshold | <= 4 minutes | FAAD C2 construct |
| Planning detection range | approximately 50% of a system's maximum range | Planning rule; radar max-range figures do not equal detect ranges for Group 1-3 sUAS (size, RCS, radar location determine picture fidelity) |
| Fixed-site engagement volume | ~30 km radius / 20,000 ft AGL from bullseye center | Fixed-site doctrine; Base Defense Zone holds the BDOC, which holds Target Engagement Authority on all entering aircraft |

Doctrine terms (seed dictionary entries):

- sUAS = small UAS; OWUAS = one-way UAS.
- Passive defense: actions to decrease likelihood of detection. Active defense: able to detect, ID, decide, act within AO.
- 6 AMD principles (brigade-level C-UAS): 1. Mass (concentration of fire power). 2. Mix (layered defense, kinetic and non-kinetic fires). 3. Mobility (rapid shifting and ops tempo, setup times). 4. Integration (combined integrated air defense efforts, C2, handoff). 5. Flexibility (apply new and legacy gear, rapid TTP iteration). 6. Agility (swift reaction to changing aerial threats, acute or systemic).
- 7 tenets: 1. Mutual support (WEZ redundancy and coverage). 2. Weighted coverage (with respect to concentration of likely attack). 3. Overlapping fires (fires redundancy). 4. Early engagement (prior to threat weapon engagement or solution). 5. Balanced fires (equal volume of fires). 6. Defense in depth (proportional fires in relation to protected-asset distance). 7. Resilience (maintain continued ops regardless of enemy tactics or blue losses).
- FAAD C2 = Forward Air Defense Command and Control. IFN = inter-FAAD network. JDN = joint data network (external C2 feeds into a COP, displayed via FAAD C2). ADAM = Air Defense Airspace Management (brigade C2 ops). ATAK = Android Team Awareness Kit. MPU5 Smart Radio / Wave Relay: voice, data, high-resolution video; described as the most robust comms infrastructure for C-UAS.
- Governing performance chain: Detect -> identify -> decide -> disseminate -> defeat. (T&E decomposition adds Track and Assess: Detect-Track-Identify-Decide-Defeat-Assess.)
- Identification methods: (1) Procedural identification: geolocation, altitude, heading, time, flight patterns, cross-referenced with the COP. (2) Positive identification: direct observation and analysis of target characteristics, vizobs, electronic support systems, non-cooperative target recognition and IFF, or a mixture.
- Track tag: bearing, altitude, range, speed (BARS).
- Decide phase, two critical considerations: 1. Determine necessity to engage. 2. Select appropriate response to neutralize. Defeat-system selection depends on quantity and classification of the sUAS (Groups 1 to 3) and the nature of the defense location (static fixed site vs mobile maneuvering brigade).
- Engagement hierarchy example: Group 2+ engaged prior to VID, other parameters permitting; prefer the weapon with the most standoff range (including DCA/CAP).
- "Left of launch": pre-mission intelligence on operators, craft, or control stations; plans should consider unique RF signatures of comms and C2 links.
- Fire-control radar tactic: a single fire-control radar activates only outside enemy strike range or when cued by passive radar or another intelligence source, to protect survivability of the lethal defeat systems.
- Sensor layering: acoustic sensors most forward, then passive, then active; together they maintain the target solution to facilitate fires within the layered defense.
- Named doctrine-context systems: Raytheon Sentinel radar + Lockheed Martin Q53 multi-mission radar (together 360-degree detection: AMD, UAS, rotary and fixed-wing; calibrated for low/slow IFF procedures; relayed through JDN and IFN into FAAD C2). Raytheon Ku-band radar (integrates into FAAD C2; fire-control radar for land-based Phalanx, SeaWiz, and Coyote interceptor; counter-RAM).
- Fixed-site limitation: centralized server as primary data hub renders maneuver impractical; cloud mentioned as mitigation.

Doctrinal testable failure modes (seed checklist, 7): detection or cue arrives too late for an engagement; identification delayed or incorrect amid manned aircraft, RQ-28s, loitering munitions, and COTS FPV drones; warning does not reach a defender outside FAAD C2; data does not move reliably among adjacent, subordinate, and higher echelons; engagement criteria or local procedures do not convert warning into action; a handoff between defensive layers fails; the chain remains too slow even when active and passive sensors can cue continuously and a base-defense operations center controls the intercept options.

JIATF-401 C4 (Field Guide, file 13 sec 7) `[REAL]`: public Common Criteria for C-UAS Characterization; spans Detect, Track, Identify, Target Quality, Defeat, Automation, C2, survivability, usability, and mission impact; uses most-likely and most-dangerous threat cases; requires threat profile, flight profile, mission objective, and electronic signature defined before meaningful comparison; explicitly does not replace established developmental, operational, or safety testing.

Method-gap facts (file 08 sec 7.3) `[REAL]`: no accredited surrogate catalog exists for UAS Groups 1 through 3; no standard defines surrogate fidelity; no DoD method covers adaptive-threat experimental design; Joint Counter-small UAS University at Fort Sill uses a standard Detect, Identify, Track, and Defeat program.

---

## 4. Measure dictionary seeds (file 09 sec 2; file 11 sec 7)

Ship the 18 controlled dictionary entries as seed registry rows. IDs and one-line definitions only. Full math, event rules, denominators, uncertainty methods, and validity rules live in MASTER-CALCULATIONS.md. Do not copy formulas onto cards; cards reference these IDs.

Measure ID grammar: `CUAS-<DOMAIN>-<ABBR>-<NNN>` (e.g., CUAS-SEN-PD-001).

| ID | Name | One-line definition |
| --- | --- | --- |
| `CUAS-SEN-PD-001` | Probability of detection | During valid opportunities under the defined condition, how often the sensor produces a valid detection of the truth object |
| `CUAS-SEN-FD-002` | First-detection range or time | Where or when the first valid detection occurs (truth-derived range or elapsed time; censoring supported) |
| `CUAS-TRK-FST-003` | First-stable-track range or time | Where or when the system first produces a track satisfying the complete stable-track rule |
| `CUAS-TRK-CONT-004` | Track continuity | Fraction of the required mission interval with a valid associated track |
| `CUAS-TRK-ERR-005` | Track position error | How far the reported track position differs from independent truth (opportunity-level summary, not per-update trials) |
| `CUAS-CLS-ACC-006` | Classification accuracy | How often the system assigns the correct approved class (confusion matrix plus unknown rate required) |
| `CUAS-SUR-FTR-007` | False or nuisance track rate | Operationally relevant tracks without a corresponding truth object, per valid surveillance exposure time |
| `CUAS-C2-HS-008` | Handoff success probability | How often a qualifying source track becomes a usable receiving-system track |
| `CUAS-C2-LAT-009` | Sensor-to-C2 or handoff latency | Duration of the defined information transition (source qualifying event to receiver usable event; censoring supported) |
| `CUAS-MSN-UWT-010` | Usable warning time | Decision-and-engagement time remaining when the architecture first produces a usable track (decision-ready event to truth boundary crossing) |
| `CUAS-EW-EFF-011` | Probability of mission-relevant EW effect | How often the approved EW condition produces the defined mission-relevant effect state |
| `CUAS-EW-REC-012` | Time to effect and recovery | Time from qualifying exposure to effect entry, and effect entry to effect exit |
| `CUAS-DEF-PINT-013` | Probability of intercept | How often an approved engagement opportunity produces the defined intercept event |
| `CUAS-DEF-PDEF-014` | Probability of defeat | How often a valid defeat opportunity prevents the threat from completing its card-defined mission |
| `CUAS-MSN-E2E-015` | End-to-end mission success | Whether the complete mission thread achieves the defined Measure of Success (with 9-stage decomposition) |
| `CUAS-SAT-LEAK-016` | Leaker probability under raid load | Fraction of truth threats reaching the protected boundary without prior confirmed defeat; plus raid-failure probability |
| `CUAS-SUIT-AVAIL-017` | Operational availability during the test period | Fraction of required mission time the system can perform the defined function |
| `CUAS-HMI-INT-018` | Operator intervention rate | Qualifying operator actions beyond the approved nominal workflow, per valid operating hours or vignettes |

Worked-card usage note: `CUAS-CLS-ACC-006` and `CUAS-SUIT-AVAIL-017` are not referenced by the five worked cards; all other 16 are (file 11 sec 7).

Field Guide measure levels (grouping metadata for the registry; file 13 sec 1.6):

- Component: detection probability; track error; track continuity; false/nuisance alarm rate; latency; reliability.
- Interface: message success; translation error; handoff latency; correlation quality; data age; network availability.
- Mission: warning time; engagement timeline; probability mission thread completes; number of simultaneous threats handled; defended-asset protection outcome; operator workload.
Measure classes: primary, secondary, leading, lagging, descriptive; plus diagnostic measures sufficient to explain failures and distinguish competing causes.

---

## 5. Reference constants

### 5.1 Regulatory and scheduling lead-time constants (file 13 secs 1.23, 7; seed the schedule planner so authority items appear on the critical path)

| Constant ID | Item | Lead time / value |
| --- | --- | --- |
| `REG-FAA-107` | FAA Part 107 waiver | 1 to 3 months |
| `REG-44807-COA` | 49 U.S.C. section 44807 exemption plus Blanket COA (UAS over 55 lb) | 4 to 9 months |
| `REG-PUB-COA` | Public-aircraft COA | 60 to 90 days |
| `REG-FCC-STA` | FCC Part 5 special temporary authority | 2 to 8 weeks |
| `REG-FCC-EXP` | FCC conventional experimental license | 1 to 3 months (5-year program license available for repeated testing) |
| `REG-GPS-DENY` | Intentional GPS interference approval | at least 60 to 90 days; specified geographic area only; DoD-controlled |
| `REG-RF-RANGE` | Open-air RF or GPS-denial testing at a commercial range | requires a federal sponsor or a physical enclosure (cables, chamber, screened enclosure) |
| `REG-UDS-PI` | Universal Documentation System Program Introduction | send 6 to 12 months before the campaign |
| `REG-MRTFB-RES` | MRTFB range reservation | at least two quarters ahead (quarterly schedule boards); commercial entities can buy MRTFB time at direct cost under 10 U.S.C. section 4175 |
| `REG-ATEC-SR` | ATEC Safety Release inputs | 60 to 90 days before Soldiers use the system |
| `REG-UAS-CLR` | First UAS flight clearance at a government range | 2 to 6 months |
| `REG-DOTE-PLAN` | OT plans to DOT&E (oversight programs) | at least 60 days before test |
| `REG-OTA-ROR` | Operational test agency report of record | 45 days before the decision (Major Capability Acquisition) |
| `REG-UCA-DISP` | UCA disposition analysis | within 1 year after sustainment entry |
| `REG-QL-WINDOW` | Quick-look report window | 24 to 72 hours; authenticated runs only; preliminary watermark |
| `REG-882E-RISK` | MIL-STD-882E risk acceptance | Component Acquisition Executive accepts High risk; Portfolio Acquisition Executive accepts Serious risk |

### 5.2 DOT&E and statistical planning figures (file 13 secs 2.4, 7)

| Constant ID | Item | Value |
| --- | --- | --- |
| `STAT-Z-95` | Two-sided 95% planning z | 1.96 |
| `STAT-Z-P80` | Approximate 80% power z | 0.84 |
| `STAT-CONF-RANGE` | Typical confidence targets | 80 to 95 percent |
| `STAT-SEQ-BUDGET` | First sequential design budget share | 25 to 40 percent of the test budget (stages: screen, augment, validate) |
| `STAT-DOE-EX` | DOT&E DOE worked example (software-intensive system) | four replicates sufficient at 95 percent confidence |
| `STAT-DOE-4Q` | Four standard DOE questions (2010 Gilmore memo) | 1. What are the test goals? 2. How many trials are necessary? 3. What conditions are necessary? 4. How will the test measure success? |
| `DOTE-2025-STAFF` | DOT&E 2025 reorganization staff | approximately 94 reduced to 45 (30 civilians, 15 military) |
| `DOTE-2025-BUDGET` | DOT&E budget reduction | approximately 79 percent |
| `DOTE-2025-OVERSIGHT` | Programs removed from oversight, July 2025 | 94 of 251 (a 37 percent reduction); approximately 45 staff now oversee approximately 157 programs |
| `DOTE-2025-IDA` | IDA FFRDC support | ended |
| `DOTE-DIRECTOR` | Tenth Director, DOT&E | Dr. Amy Henninger, 23 March 2026 |
| `POLICY-WINDOW` | DoD T&E policy restructure window | December 2024 through March 2026 (DoDI 5000.98; DoDM 5000.96/.99/.100/.101/.102/.103; DoDM 5000.100 cancels TEMP Guidebook 3.1; JCIDS ended August 2025). Sources predating December 2024 can be partially or fully obsolete |

### 5.3 Doctrine thresholds (cross-reference; values in section 3.8)

`DOC-D2E-4MIN` (detect-to-engage <= 4 minutes); `DOC-PLAN-50PCT` (planning detection range ~50% of max range); `DOC-FIXED-VOL` (~30 km / 20,000 ft AGL fixed-site volume).

### 5.4 Decision-ready-track criteria `[ILLUSTRATIVE default; customer-configurable]` (file 12 sec 2.1, M-01)

A C2 track is decision-ready only when ALL hold:

1. Correct truth-object association.
2. Required position and velocity fields present.
3. Track age within 1.0 second.
4. Position-quality state within the customer criterion.
5. C2 track persistence for at least three consecutive updates.

### 5.5 JIATF-401 program constants `[REAL]` (cross-reference section 1.1)

`JIATF-EST` 2025-08-28; `JIATF-APPROVAL` up to $50M per initiative; `JIATF-REVIEW` 36 months; `JIATF-GUIDELINES` adopted 2026-03-11; `JIATF-YUMA` twice yearly; Demo 5 June 2024 (nine systems, 40+ counter-swarm targets); Demo 6 April 2025 (contested EM environment, Group 3 defeat, dismounted systems).

### 5.6 Data delivery standard constants (file 13 sec 5.3; seed export presets)

- Telemetry: IRIG 106 Chapter 10 or Chapter 11 files with IRIG-B time stamps.
- Time base: GPS-disciplined station clock distributing IRIG-B and Precision Time Protocol; all truth sources on one time base.
- Government-integrated events: publish ground truth and tracks as TENA objects.
- Post-test pipelines: align with VAULTIS (visible, accessible, understandable, linked, trustworthy, interoperable, secure) and CHEETAS-receivable formats.
- Classification floor: treat test data as CUI at a minimum.
- Closeout submissions: final technical report to DTIC with Standard Form 298 and distribution statement; lessons to the Joint Lessons Learned Information System (JLLIS).
- Report sequence: quick-look report, test report, analysis report, evaluation report. DOT&E Annual Report entry structure: description, mission, adequacy and limits, effectiveness, suitability, survivability, recommendations.

### 5.7 Ground-truth planning constants `[ILLUSTRATIVE campaign defaults]` (file 12 sec 1.11)

Truth update rate: at least 10 Hz. Truth position uncertainty target: 1.5 m or better in the scored region. Timing budget components (default seed values): start timestamp 0.02 s; stop timestamp 0.02 s; synchronization 0.01 s; event definition 0.03 s. Ground-truth accuracy rule (file 13 sec 2.1): "Ground-truth measurement error must be small enough relative to the smallest decision-relevant effect to support the comparison."

### 5.8 Threshold origin rule (file 13 sec 2.3; enum, exactly six legitimate sources)

`mission need` | `requirement` | `safety constraint` | `established baseline` | `customer-approved risk criterion` | `explicitly documented characterization objective`.
If no threshold exists: characterize performance and uncertainty; do not create a pass/fail conclusion. A customer operational pass/fail threshold is an execution blocker until customer-approved.

---

## 6. Question banks (guided intake and debrief prompts)

Structure: each bank has an ID, a lifecycle anchor (phase or gate), an audience, and its questions verbatim. Sources: file 01 secs 3.4-3.5; file 12 sec 1.2; file 13 secs 3.2-3.14, 4.7.

### 6.1 `QB-DISC-13` - Discovery question list (file 01 sec 3.5; phase: discovery intake; run by deployment strategist with decision owner, mission owner, operators, system owner, analysts, and evidence authority present when possible)

Structured discovery order (the intake flow wraps the questions):

1. Restate the decision. 2. Define the mission outcome. 3. Walk the mission thread. 4. Identify systems, interfaces, and authorities. 5. Collect claims and prior evidence. 6. Surface failures, edge cases, and unknowns. 7. Define operating conditions and threats. 8. Confirm constraints and acceptance needs. 9. Rank the questions. 10. Read back the result and correct it in the room.

The 13 discovery questions (verbatim):

1. Who performs what task, for what protected asset or mission effect?
2. Against which threats and behaviors?
3. Where and under which weather, terrain, clutter, electromagnetic, communications, workload, and degraded conditions?
4. What must occur before and after the system acts?
5. What information crosses each interface?
6. Who decides at each transition?
7. What timing budget exists?
8. What has failed before?
9. What do operators do differently from the written procedure?
10. What vendor claims lack trusted evidence?
11. What assumption would make the concept fail if false?
12. What rare failure has severe mission consequence?
13. Which single unknown prevents a decision today?

Categorization rule for answers: convert each customer statement into one of four categories: `Claim` | `Known fact` | `Unknown` | `Assumption`. Then ask: "What evidence would resolve this unknown?"

### 6.2 `QB-CLAR-10` - Workbench clarification questions (file 12 sec 1.2; phase: request intake; app-generated). Full list in section 1.2 of this file.

### 6.3 `QB-STD-9` - The Deployment Strategist's Standard (file 13 sec 3.2; anytime health check; render as a live traceability dashboard)

1. What customer decision are we supporting?
2. What operational question are we answering now?
3. What exact configuration is under test?
4. What threat and conditions are represented?
5. What hypothesis does this run examine?
6. What evidence will answer it?
7. Is the evidence valid?
8. What can and cannot be concluded?
9. What should we test next, and what should TestOS retain?

If any answer is unclear, the campaign has lost test traceability. Discipline line: "Do not optimize for running tests. Optimize for eliminating consequential uncertainty with controlled, reusable evidence."

### 6.4 `QB-CTRL-10` - Ten continuous control questions (file 13 sec 3.3; every stage; campaign lead)

1. What exact customer decision are we supporting?
2. Who has authority to make it?
3. Who must accept the evidence for it to matter?
4. What uncertainty currently prevents or weakens the decision?
5. What evidence would resolve that uncertainty?
6. Does the next planned activity generate that evidence?
7. Are configuration, threat, conditions, method, and data controlled and traceable?
8. Are we operating safely, legally, and within Valkryn's authority?
9. What did we learn, and what is now the highest-value next test or action?
10. How will this campaign make the next comparable effort faster, cheaper, and less bespoke?

Usage rules (verbatim): 1. Begin with the decision and authority, not the available test event. 2. Carry each decision-critical uncertainty through a traceable chain: claim -> hypothesis -> measure -> data -> finding -> action. 3. Maintain controlled baselines for configuration, threat, conditions, method, and evidence. 4. Treat readiness and run checks as verification gates, not substitute planning. 5. Bound every conclusion by the exact conditions under which it was established. 6. Convert campaign learning into regression logic and reusable capability.

### 6.5 `QB-FG-PHASE` - Field Guide high-value question sets per phase (file 13 sec 3.4)

Phase 1 (Role): What decision must this testing enable? What will the customer do differently if the answer is A versus B? Which decision cannot currently be made because evidence is missing? Which system configuration is actually under consideration? What evidence already exists? Which evidence is trusted? Which evidence is stale? What must be learned live? What can be learned from existing data or M&S? Who must believe the result for it to be useful?

Phase 2 (Discovery, RFI process), by category:

- Mission and decision: What mission function must succeed? What are you protecting, detecting, tracking, deciding, or defeating? (Blue/Red Force Disposition; Protected Entity.) What decision will these results support? When must that decision be made? What constitutes mission failure? (Simple, Measurable, Approachable; tied to mission objectives.)
- System: What exact hardware, software, firmware, model, mission-data, payload, and network configuration will be tested? Which components are optional? Which interfaces are mission-critical? Which component is expected to be the limiting node?
- Claims: What does the vendor claim? Under what conditions was that claim established? Is the claim component-level or end-to-end? What claim matters operationally?
- Threat: Which threat matters most? What is the most likely threat? What is the most stressing credible threat? Which threat characteristics actually drive system performance?
- Conditions: Where will the capability operate? What clutter, terrain, weather, RF environment, network state, operator loading, or degraded mode matters? Which conditions have never been tested?
- Known problems: Where has the system already failed? Which failures are repeatable? Which failures are anecdotal? What recent software or configuration changes could invalidate old evidence?
- Assumptions and edge cases: What must be true for the concept to work? Which handoff can fail without any individual component technically failing? What happens at minimum range, maximum range, sector boundaries, network loss, track crossing, target saturation, or operator overload? What condition would make the current architecture irrelevant?
- Conflicting priorities: Are we optimizing maximum capability, reliability, cost, operator burden, interoperability, setup time, or deployment speed? Which trade is acceptable? Which trade is not?

Phase 3 (Evidence planning): What observation would support the claim? What observation would contradict it? What is the dependent measure? What factor is being changed? What must remain controlled? What independent ground truth exists? What uncertainty is tolerable? What comparison provides the answer? Does the customer need characterization, ranking, pass/fail, root cause, or boundary discovery? What performance level is operationally meaningful?

Phase 4 (Test design): Which factor is actually expected to cause the outcome? Which factors can be controlled? Which factors must be measured as covariates? What is the baseline? How will configuration A be compared with configuration B? How many valid opportunities are required? Which boundary conditions matter? What failure should trigger a deeper diagnostic test?

Phase 6 (Execution, before every run): What exactly are we testing? Which factor is changing? What must stay constant? Is the configuration known? Is ground truth valid? Are mandatory feeds healthy? What would invalidate the run? What would cause an abort? What result would change the next test?

Phase 7 (Debrief): Was the run valid? What did we directly observe? What does analysis establish? What remains uncertain? Can the result be reproduced? Did a test artifact affect the outcome? What condition was not represented? What conclusion would be unsafe to make? What question should be tested next?

Phase 8 (Adaptive): Which uncertainty now dominates the decision? Which test has the highest probability of resolving it? Did today's evidence make a planned test unnecessary? Did today's result expose a more important boundary? Does changing the plan compromise comparability? Are we exploiting an interesting anomaly or pursuing a decision-relevant question?

Phase 9 (Reuse): What did we create that another campaign will need? What required expert judgment? Can that judgment be encoded? What manual action should software automate? Which failure mode should become a regression test? Which measure definition should become canonical? Which threat profile is reusable? Under what conditions is it valid? What configuration change should automatically trigger retesting? Where did TestOS fail to capture the information needed later?

### 6.6 `QB-QTM-01` - Engagement Qualification & Stakeholder Authority (file 13 sec 3.5; gate: Qualification)

Decision charter: What exact decision must be made, by when, and by which authorized organization? Which alternatives are under consideration, including delay or no action? What are the operational, contractual, budgetary, regulatory, or political consequences of acting, delaying, or choosing incorrectly? What uncertainty currently prevents or weakens the decision? Can evidence from this campaign materially reduce that uncertainty and change the decision? What bounded decision would remain supportable if results are unfavorable, mixed, or inconclusive?

Engagement type and authority boundary: Is the work a demonstration, experiment, characterization, comparison, or defensible evaluation? Is Valkryn being asked to recommend, characterize, validate, certify, or authorize? Which functions can Valkryn perform, and which decisions remain with government, range, safety, acquisition, certification, airworthiness, or other authorized organizations? Has the customer already selected an answer and merely requested validation?

Decision clock: What event creates the decision deadline? By what date must accepted evidence be available to affect the decision? How much time is allocated to planning, contracting, integration, rehearsal, execution, analysis, review, acceptance, and contingency? What is the latest viable date for each critical-path activity?

Customer commitment: Who is the sponsor, economic buyer, operating champion, and contracting authority? Who can commit customer personnel, systems, data, vendor support, range access, and review time? What budget and contracting vehicle are available? Will the customer define success and acceptance conditions before seeing results? Will the customer accept unfavorable, mixed, or inconclusive evidence?

Feasibility screen: Can representative blue systems, operators, supporting systems, threats or validated surrogates, and operating conditions be made available? Can required conditions be created safely, legally, and within the decision window? Can independent ground truth and sufficient instrumentation be established? Can required data be accessed, retained, protected, analyzed, and delivered? Are classification, security, range, spectrum, airspace, integration, and schedule constraints resolvable? Is the evidence likely to be accepted by the relying organization? Is the scope within Valkryn's current capability and institutional boundary? What unresolved condition requires delay, rescoping, partnership, or decline?

Stakeholder and authority register (for each role: named person or organization, authority, required participation, decision rights, escalation path):

- Customer and mission roles: sponsor and economic buyer; mission owner and system owner; operating champion and operators; contract and budget authority; final decision-maker; results consumers; potential blockers.
- Evidence authority: Which organization must rely on or accept the evidence? Who represents it during planning and review? What authority does it hold? Must it preapprove the method, measures, thresholds, repetitions, witnessing, documentation, or data format? What would cause it to reject the evidence? Who formally acknowledges method acceptance and final evidence acceptance?
- Test and operational authority: Who owns range, airspace, spectrum, safety, security, and residual-risk decisions? Who may stop the test, authorize restart, approve plan changes, or accept deficiencies?
- Vendors and partners: What does each party own, provide, approve, or restrict? What proprietary, comparative-results, export, or distribution constraints apply? What incentives could bias configuration, method, or interpretation? Who provides technical support and resolves disputes?
- Valkryn ownership: Who owns campaign leadership, TestOS configuration, technical integration, data engineering, analysis, range operations, red activity, safety coordination, and customer communication? Who may make on-site scope, schedule, cost, and risk decisions?

Evidence acceptance contract (align decision-maker and evidence authority before design begins): decision and deadline; decision-critical uncertainty; required evidence and acceptable uncertainty; method and independence expectations; review, witnessing, documentation, and delivery requirements; formal acceptance path.

Qualification gate statement (fill-in template): "The customer must make **this bounded decision** by **this date**. **This authority** will rely on evidence meeting **these acceptance conditions**. The campaign can materially reduce **this decision-critical uncertainty**, and the required customer commitment and execution conditions are feasible."

### 6.7 `QB-QTM-02` - Mission, System & Hypotheses (file 13 sec 3.6; gate: Definition)

Mission definition: Who must perform what mission, to protect which asset, force, population, or activity? Against which threat classes and variants? In what theater, terrain, weather, electromagnetic, communications, workload, and degraded or denied conditions? Under what operational, legal, doctrinal, timing, and resource constraints? What constitutes mission success, failure, and acceptable degradation? Which assumptions must remain true?

CONOPS and mission thread: What is the intended concept of operations? Where does the system enter the mission thread, and what occurs immediately before and after its function? Which operators, organizations, and supporting systems participate? What information does each participant receive, what decision must be made, and how much response time is available? Which doctrine, tactics, techniques, and procedures govern employment?

System boundary: Is the object of evaluation a component, subsystem, platform, architecture, or end-to-end mission capability? What is inside and outside the test boundary? Which external services, supporting systems, operators, tactics, and procedures are part of the evaluated configuration? Which dependencies will be controlled, observed, or treated as assumptions?

Evaluation readiness boundary: Has the system passed functional checkout and vendor acceptance? Are known failures, limitations, and waivers documented? Are operators trained sufficiently for the intended evaluation? Is the campaign evaluating performance, integration maturity, or both? What debugging is permitted before a run ceases to represent the frozen baseline?

Failure-mode model: What known failure modes exist at component, interface, configuration, operator, environment, threat, instrumentation, and method levels? Which unknown failure boundaries must be sought? What observations would distinguish competing causes? What is the mission consequence, detectability, recoverability, and decision impact of each failure mode? Which failure modes require prevention, monitoring, deliberate test, or contingency planning?

Definition gate (proceed to evidence design only when): the mission and mission thread are explicit; the evaluated boundary and configuration baseline are reconstructable; decision-relevant claims and unknowns map to testable hypotheses; critical failure modes and assumptions are visible; required operating conditions are defined for later range-fit and validity assessment.

### 6.8 `QB-QTM-03` - Measures, Threat & Experimental Design (file 13 sec 3.7; gate: Design approval)

Claim-measure traceability: Does every test activity address a registered hypothesis or decision-critical uncertainty? Does every primary measure connect to a customer decision? Are diagnostic measures sufficient to explain failures and distinguish competing causes? Which measures are primary, secondary, leading, lagging, or descriptive?

Decision and threshold logic: Is each threshold a requirement, objective, contract value, operational need, or analyst judgment? Is performance evaluated as binary, continuous, or conditional? What trade-offs are permitted among measures? What uncertainty is acceptable around each threshold? How will borderline results be treated? What result supports procure, field, reconfigure, fix, retest, reject, or defer? What result remains insufficient for any decision?

Acceptance alignment (confirm with the evidence authority; freeze pass/fail and acceptance criteria before execution unless an approved change is recorded): measures and definitions; thresholds and uncertainty limits; analytical method; experimental unit and required repetition; comparison and control conditions; witnessing and independence requirements; output and data-delivery format.

Red control and adversarial search: Is red activity reproducing an operational profile, probing a boundary, or optimizing against a defined objective? Which variables may red control, and within what safety and realism envelope? What remains blinded from blue participants? How will unrealistic behavior be prevented? Can every red profile and adaptive decision be reconstructed?

Approved adaptation policy (define before execution): fixed and adaptable test-card elements; conditions triggering repeat, expansion, variable isolation, or termination; maximum permitted change without renewed design approval; approval authority for each change class; documentation required to preserve comparability; rule for selecting the next event based on information gain, decision value, cost, time, and risk.

Stop rules, separated by authority: safety or regulatory stop (governed by the campaign safety plan); data-quality stop (required evidence cannot be recovered); equipment stop (configuration or capability no longer representative); evidence-sufficiency stop (decision uncertainty reduced enough); futility stop (additional testing unlikely to change the conclusion); resource stop (remaining value does not justify time, cost, or risk).

Design approval gate (do not proceed to implementation until): claims, hypotheses, measures, thresholds, and test events are traceable; threat fidelity and exclusions are explicit; experimental controls and repetition support the intended conclusion; adaptation and stop rules are approved; the evidence authority accepts the design and output expectations.

### 6.9 `QB-QTM-04` - Instrumentation, Data & Technical Integration (file 13 sec 3.8; gate: Technical integration)

Independent ground truth: What source establishes authoritative position, timing, identity, state, and effect? How will conflicting or missing ground truth be detected and reconciled? Can ground truth be correlated with blue, red, range, operator, and environmental records? Can timing provenance and clock drift be reconstructed later?

Data model and event identity: Can every campaign, test card, trial, configuration, threat profile, track, event, and result be uniquely identified? Are identifiers consistent across systems? Can objects and events be reconciled when systems use different identifiers, units, coordinate frames, or semantics? Are manual annotations distinguished from measured or inferred data?

Data lineage, integrity, and reproducibility (establish controls for): packet loss, missing records, duplicates, corruption, and conflicts; invalid-data flags and exclusion reasons; raw-data immutability; ingestion time and source-system identity; software, schema, adapter, and transformation versions; configuration active when each datum was generated; annotation and alteration history; raw-to-metric and metric-to-finding traceability; reproduction of analysis from retained raw data and versioned code; independent audit of the complete evidence chain.

Calibration and synchronization: What pre-test, daily, and post-test calibration checks are required? How will instrument drift and clock drift be detected? What happens when calibration or synchronization falls outside tolerance? Can the campaign continue with degraded instrumentation, and what conclusions become unavailable?

Data rights, protection, storage, and delivery: Who owns and may access raw data, comparative results, and proprietary information? What may Valkryn retain, reuse, aggregate, or disclose? What is government-furnished, export-controlled, classified, CUI, or contractually restricted? Where will each data class be stored and processed? What disconnected transfer, backup, retention, deletion, and incident-response procedures apply? In what schema, media, classification, and delivery format will the customer receive data?

End-to-end rehearsal acceptance (before range execution, demonstrate that): every required source reaches the analysis environment; every trial and configuration is uniquely tagged; time synchronization and ground-truth correlation meet tolerance; required metrics can be computed from representative rehearsal data; data-quality monitoring detects defined failure modes; backup, buffering, disconnected, access-control, and recovery procedures work; a reviewer can trace a rehearsal result to raw data, configuration, method, and transformation version.

Technical integration gate: proceed only when the complete evidence chain has passed rehearsal, or every deficiency has a named owner, approved disposition, and explicit effect on achievable conclusions.

### 6.10 `QB-QTM-05` - Range, Safety, Security & Campaign Planning (file 13 sec 3.9; gate: Campaign plan)

Range-fit assessment (compare every mission-required condition with range capability): airspace, ground footprint, terrain, clutter, horizon, and line of sight; weather and environmental conditions; spectrum and electromagnetic conditions; communications and network availability; threat, sensor, effector, launch, recovery, and engagement profiles; ground truth and instrumentation; safety, security, and classification authority; decision-window availability. Classify each condition: `Representative` | `Acceptably approximated` | `Unsupported` | `Requiring mitigation or another site`. Record how each gap limits external validity or campaign scope.

Site and range selection: What can Merced support, and what requires a government or partner range? Which site best balances representation, authority, availability, cost, integration burden, and risk? Can all required systems, threats, operators, and support personnel access the site? What range-specific procedures or limitations alter the approved design?

Safety and emergency control: What hazards exist, with what probability, severity, and mission consequence? What engineering, administrative, procedural, and emergency mitigations apply? Who accepts residual risk? What flight-termination, lost-link, geofencing, abort, medical, fire, recovery, mishap, and near-miss procedures apply? Are safety-critical controls observable and testable before execution?

Airspace and spectrum: What airspace authorization, NOTAM, FAA coordination, weather minimum, and manned/unmanned deconfliction are required? How will nonparticipating aircraft be detected and protected? Which frequencies, power levels, periods, and propagation boundaries apply? What FCC, NTIA, military, or range authority is required? How will unintended interference be detected, contained, and shut down?

Security, legal, and contractual controls: What are the classification, CUI, OPSEC, cybersecurity, photography, recording, clearances, secure-space, and need-to-know requirements? Can foreign nationals participate, and under what restrictions? What DD-254, accredited-system, export-control, incident-reporting, or public-release requirements apply? Who bears risk for damaged equipment? What liability, warranty, intellectual-property, data-rights, weapons, hazardous-material, and comparative-result terms apply?

Campaign scope baseline (define included and excluded; every exclusion must state its effect on the conclusions): decisions and hypotheses; systems and configurations; threats and profiles; conditions and ranges; measures and thresholds; test events and repetitions; deliverables and data products.

Resource-loaded schedule milestones: contracting, approvals, and site access; system and threat delivery; integration and data-chain rehearsal; operator and safety rehearsal; execution and reserve days; daily analysis and adaptive planning; final analysis, customer review, and evidence acceptance. Identify: critical path and latest viable dates; required personnel, competencies, shifts, equipment, spares, consumables, vendor support, travel, shipping, customs, lodging, power, networking, maintenance, storage, fuel, and batteries; owner and backup for each workstream; schedule, cost, and capability reserve.

Command, communications, and battle rhythm: What command structure, RACI, communication channels, terminology, and event identifiers apply? What is the daily brief, run authorization, hotwash, analysis, and next-day planning rhythm? Who receives live, preliminary, and final results? What requires customer or authority approval? How are disagreements, deviations, and decisions escalated and recorded?

Contingency and minimum viable campaign (for loss of weather, range access, airspace, spectrum, threat aircraft, blue systems, data feeds, authorization, staffing, or critical equipment, define): immediate action; recovery owner and decision deadline; alternate site, system, source, or profile; minimum viable campaign; objective-descoping priority; effect on evidence acceptance and conclusions.

Campaign plan gate (do not enter readiness review until): the selected environment supports the bounded conclusions; authorities and controls are identified and on track; scope, resources, schedule, command relationships, and contingencies are executable; remaining gaps have approved mitigations and explicit validity consequences.

### 6.11 `QB-QTM-06` - Readiness & Test Execution (file 13 sec 3.10; gates: Readiness review, Go/no-go, Execution)

Readiness review record fields per control: baseline or approval reference, status, deficiency, owner, due date, waiver authority, and supporting evidence.

Technical readiness: approved blue and red configurations are installed, identified, and functional; required interfaces, adapters, feeds, buffering, and fallback paths work; ground truth, instrumentation, calibration, and time synchronization meet tolerance; required metrics have been computed from representative rehearsal data; backups, spares, maintenance support, and recovery procedures are operational; the end-to-end evidence chain has passed rehearsal.

Operational readiness: operators are trained for the evaluated CONOPS and frozen procedures; red and blue roles, communications, launch, recovery, reset, and event timelines are rehearsed; range, vendor, customer, analysis, and technical-support personnel are on station or on call; decision, approval, stop, restart, and change authorities are available.

Safety, regulatory, and security readiness: required range, airspace, spectrum, safety, security, and legal approvals are active; hazards, operating limits, stop conditions, and emergency procedures are briefed; flight termination, lost-link, geofencing, shutdown, monitoring, medical, fire, and recovery controls are tested; classification, CUI, access, recording, and incident-response controls are active.

Data readiness: campaign, test-card, run, configuration, threat, track, and event identifiers are active; storage, backup, retention, classification, and access controls work; data-quality monitoring and analyst workflows are ready; ground truth, telemetry, operator actions, environmental conditions, and configuration can be correlated.

Go/no-go gate questions: Which controls must be green? Which deficiencies may be accepted, by which authority, and with what effect on conclusions? Which deficiencies require delay, redesign, rescoping, or cancellation? Who makes and records the final go/no-go decision?

Run control: confirm identifiers, configuration, profile, conditions, feeds, synchronization, and safety status before initiation; time-tag start, phase transitions, operator actions, deviations, anomalies, pauses, and completion; preserve the approved sequence and blinding unless an authorized change is recorded; monitor safety and evidence-chain health continuously; record who authorized every pause, change, abort, restart, or continuation under degraded conditions.

Execution gate: a run enters campaign analysis only when its adjudication record establishes what occurred, whether the evidence is usable, and which claims, hypotheses, measures, and conditions it can support.

### 6.12 `QB-QTM-07` - Adaptive Replanning & Campaign Analysis (file 13 sec 3.11; gate: Analysis complete)

Daily evidence review, four steps:

1. Adjudicate available evidence: Which runs are valid, conditionally valid, or invalid according to their run records? What data are complete, incomplete, conflicting, or questionable? Which measures and hypotheses can each run support?
2. Update hypotheses and uncertainty: Which hypotheses gained or lost support? What expected behavior failed to occur? What new uncertainty or failure boundary emerged? Is the observed effect repeatable and operationally significant?
3. Identify decision-critical gaps: Which measures, hypotheses, or test-matrix cells remain unsupported? Which missing evidence has the greatest effect on the customer decision? Is another run likely to resolve the uncertainty? What is its expected decision value relative to time, cost, safety, and risk?
4. Select the next event (apply the approved adaptation policy): repeat the run; change one variable; change the configuration; add or repair instrumentation; modify the threat profile; isolate a component or interface; stop a low-value line; expand into a newly identified failure boundary; end testing for sufficiency or futility. Select the event that maximizes information gain and decision value while preserving necessary comparability.

Causal diagnosis loop (for each consequential anomaly or failure): 1. Define the observation precisely. 2. Identify candidate component, interface, configuration, operator, environment, threat, instrumentation, and method causes. 3. Identify evidence that distinguishes competing explanations. 4. Reproduce or isolate the behavior where feasible. 5. Classify root cause as confirmed, supported, plausible, or unknown. 6. Determine correctability and mission consequence. 7. Define the corrective action and verification test. Rule: do not present a hypothesized root cause as a confirmed finding.

Completed-campaign evidence validity: Which runs are included or excluded, and why? Could missingness or exclusion bias the result? Are unresolved data conflicts material? Were data transformations and analytical versions verified? Can every result be reproduced from retained evidence? Can every result be traced to configuration, threat, conditions, operators, and method?

Performance synthesis: Where did performance meet, exceed, degrade below, or fail the agreed threshold? Which variables and interactions drove the result? What trade-offs exist among configurations, threats, measures, and mission outcomes? Did operator behavior or procedures materially affect outcomes? Which failure boundaries are operationally important?

Analysis-complete gate: analysis is complete only when every decision-relevant finding is reproducible, traceable, uncertainty-bounded, applicability-bounded, and linked to a decision implication or explicit remaining evidence gap.

### 6.13 `QB-QTM-08` - Decision Evidence & Customer Action (file 13 sec 3.12; gate: Decision ready)

Independent-reviewer test (the evidence package must allow answering): What was observed? How was it established? Under which exact conditions is it true? With what confidence and limitation? What must not be inferred? What decision implication follows?

Architecture and mission assessment: Which configuration performed best, against which threat, and under which conditions? What trade-offs exist among configurations, measures, cost, complexity, resilience, and mission outcomes? Where are coverage, timing, interface, authority, or engagement gaps? Which component or interface creates the greatest mission risk? Can one component compensate for another's weakness? Does the complete mission chain provide sufficient warning, decision time, engagement opportunity, effect, and residual-threat management?

Evidence review and acceptance (record): method and analysis reviewers; configuration-fact review by vendors without control of conclusions; dissenting interpretations and adjudication; required corrections or additional evidence; method acceptance status; evidence acceptance status, conditions, and reservations; formal acceptance record.

Decision analysis: for each viable option (procure, select an alternative, reconfigure, fix, restrict employment, retest, defer, or reject) state: supporting and contradicting evidence; assumptions; operational and technical trade-offs; residual risk; cost and consequence of action, delay, or inaction; additional evidence required. Then state the bounded recommendation: recommended action; evidence strength supporting it; conditions and limitations; alternatives considered; residual uncertainty and risk; trigger for reconsideration or retest.

Institutional boundary (operational hook): Valkryn explains, characterizes, and recommends from evidence; authorized organizations retain certification, airworthiness, acquisition, production, deployment, fielding, safety, and operational-employment decisions; final language must not imply authority Valkryn does not possess.

Decision-ready gate (the authorized decision-maker can answer): What do we know? How do we know it? Under what conditions is it true? What remains uncertain? What action does the evidence support? What change would require retest? Who owns the decision and resulting actions?

Claims disposition enum (close every registered claim): `Supported` | `Contradicted` | `Directionally supported` | `Inconclusive` | `Untested` | `Outside scope`. For each disposition distinguish: product behavior as represented; performance under mission-relevant conditions; performance within the complete architecture and mission thread.

### 6.14 `QB-QTM-09` - Closeout, Productization & Regression (file 13 sec 3.13; gate: Closeout)

Campaign closure checklist:

- Deliverables and acceptance: contractual deliverables complete and delivered; customer received the agreed evidence package, data, limitations, exclusions, and open issues; evidence-review and acceptance status documented; actions, owners, funding needs, and completion dates recorded.
- Data and knowledge: raw data, processed data, code, schemas, configurations, methods, and findings archived under the agreed retention policy; access permissions, classification, CUI, proprietary, export, and comparative-result controls reviewed; prohibited or temporary data deleted as required; the analysis can be reproduced and the tested configuration reconstructed.
- Operations and property: equipment, sites, ranges, networks, and work areas restored; safety incidents, near misses, maintenance discrepancies, damage, and lost items closed or transferred to named owners; vendors and partners receive authorized feedback; sensitive and comparative results remain controlled.

After-action review questions: What worked, failed, or surprised the team? Which assumptions were wrong? Where did the campaign lose time, quality, or decision value? What required founder or exceptional intervention? Which risks or failure modes were not anticipated? What should be standardized, automated, trained, redesigned, or never repeated? What must change before the next comparable campaign?

Capability productization review questions:

- Reusable method assets: Which decision decompositions, claim structures, hypotheses, measures, thresholds, test cards, threat profiles, acceptance structures, ground-truth methods, analytical methods, and report modules should become standard? Which assets transfer only within this mission class, and which transfer across domains?
- Reusable technical assets: Which adapters, interfaces, schemas, transformations, data-quality checks, dashboards, calculations, and reports should become supported assets? Which temporary integration should be hardened? Which technical debt must be resolved before reuse?
- Standard work and training: Which failure modes, integration risks, range constraints, vendor behaviors, safety patterns, and planning lessons must be encoded? What knowledge exists only in Casey's or a founder's head? What should become TestOS logic, templates, checklists, training, or reference material?
- Product backlog: What should TestOS automate or preserve next? What should RangeOS monitor or control? What should Red Thread be able to vary, replay, or optimize? What must remain human-led? Which product change would most reduce the next campaign's cost, cycle time, staffing, or evidence risk?

Minimum regression scope questions: Which dependencies and findings are affected by the change? What is the minimum sufficient evidence to restore confidence? Which conditions do not require repetition, and why? What may be established through analysis or simulation? What must remain live? How quickly can Valkryn refresh the evidence? Which evidence authority determines sufficiency?

Closeout gate: the campaign is closed only when obligations and records are complete, reusable capability has named owners, the evidence baseline is controlled, and future changes can be mapped to a defensible regression scope.

### 6.15 `QB-QTM-10` - Follow-On Program, Success Metrics & Control Questions (file 13 sec 3.14; gate: Follow-on)

Next decision and evidence gap: What is the customer's next consequential decision and deadline? Which accepted findings support it? What evidence remains missing or stale? What failure requires remediation? What vendor fix, configuration change, operational change, or new threat requires verification? What bounded follow-on evidence would change the next decision?

Evidence-refresh program: What recurring software, hardware, configuration, interface, mission-data, procedure, environment, or threat-update cadence exists? Can Valkryn maintain the controlled evidence baseline established at closeout? Can change classes map to predefined analysis, simulation, limited live regression, or full reevaluation packages? Can regression scopes be preplanned and prepriced? What customer battle rhythm governs evidence refresh and acceptance? Who owns configuration notification, recurring budget, contracting, execution, and acceptance? What service level is required from change notice to refreshed evidence?

Account and mission expansion: Can the method transfer to another mission, location, program, command, or system architecture? Which ontology, claims, measures, adapters, test cards, evidence relationships, and acceptance structures transfer? What new integration, authority, threat, or range work is required? Will expansion improve product leverage and evaluator trust? What customer pull and demonstrated value support the scope? Does the opportunity reinforce Valkryn's strategy or create distracting bespoke work?

Success scorecard questions:

- Decision impact: Did the customer make a better or faster decision? Did accepted evidence arrive before the decision deadline? Did it materially reduce decision-critical uncertainty? Did an authorized organization accept, rely on, or act on it? Did it cause an acquisition, configuration, deployment, fielding, remediation, restriction, or rejection action? Did the customer understand the evidence's limitations and remaining risk?
- Evidence quality: Was the campaign safe, legal, and within Valkryn's authority? Were configuration, threat, method, and conditions controlled? Were ground truth and instrumentation credible? Were data complete, traceable, and reproducible? Were conclusions appropriately bounded and independently reviewable? Were important failure boundaries and decision-relevant unknowns resolved?
- Operating leverage: Did the campaign create reusable methods, data assets, technical assets, and product capability? Did it strengthen TestOS, RangeOS, Red Force, or Red Thread? Did it reduce founder dependency and bespoke integration? Will the next comparable campaign require fewer people, days, and custom changes? Did repeat economics and evaluator trust improve?

Follow-on gate: proceed only when the next scope supports a real decision, uses a defensible change-to-evidence logic, has a committed owner and acceptance path, and strengthens rather than erodes operating leverage.

### 6.16 `QB-DEBRIEF-6` - Immediate run debrief (file 13 sec 4.7; within minutes after every run)

1. Was the intended configuration executed?
2. Did the threat execute as planned?
3. Did required data exist?
4. Were there deviations?
5. Is the run valid?
6. Was anything unexpected observed?

Anomaly classification prompt (file 13 sec 4.6; do not immediately call an unexpected result a system failure): `System behavior?` | `Test infrastructure?` | `Threat deviation?` | `Operator action?` | `Data artifact?` | `Unknown?`

Evidence-language discipline for debrief outputs (file 13 sec 4.5; every conclusion gets exactly one category):

- Observed fact (example: "The tracking radar dropped the target for 6.2 seconds during Run 47.")
- Analysis (example: "The loss coincided with sector transition in three of five valid opportunities.")
- Inference (example: "Sector-transition behavior is a plausible contributor to the track loss.")
- Recommendation (example: "Conduct a controlled sector-boundary characterization test.")
Do not collapse these into: "The radar has a sector-boundary defect."
Uncertainty documentation fields: sample size; run-to-run variability; measurement uncertainty; missing conditions; missing data; invalid runs; confounding factors; degree of operational representativeness.
Finding completeness rule: every finding identifies configuration + condition + evidence + uncertainty + limitation.

### 6.17 Gate statement templates (file 13 sec 4.10; fill-in seed text)

Definition of done (campaign closeout narrative template, verbatim): "The customer needed to make **this bounded decision**. We aligned **this authority** on the evidence required. We evaluated **this controlled configuration** against **this threat** under **these conditions**, using **this approved method and ground truth**. The evidence supports **these findings** with **these uncertainties and limitations**. The authorized organization can therefore take **this action**. Remaining uncertainty maps to **this follow-on or regression scope**. We captured **these reusable assets** so the next comparable campaign is faster, cheaper, and less bespoke."

Completion criterion (Field Guide 1): the team can state in one paragraph "what is being tested, why, against what, under which configuration, which decision it informs, and what Valkryn does versus what others own."

---

## Appendix: known gaps and ambiguities in the seed data

1. No H-04 exists; Q-04 is exploratory with a prediction only (file 12).
2. CENTCOM CTO name is ambiguous in the transcript ("Joy Shanaberger" / "Joyce Shannenberger").
3. Real-system specs (section 1.3.1) are sparse and unverified; the library must flag them.
4. Matrix cell-ID tokens `AZ-CL`, `AZ-OFF`, `ALT-120`, `SPD-20` are inferred from the attested grammar `AZ-BND / ALT-60 / SPD-30`; the M-01..M-10 to CUAS-* mapping is inferred, not attested.
5. `CUAS-SEN-PD-001` measure family: source records the open real-world question "How is Pd (probability of detection) properly defined?"; the dictionary entry resolves it for the app, but the real JIATF event never defined it.
6. The functional architecture sketch mixes acquisition and fire-control radar irregularly (source ambiguity preserved).
7. Illustrative results (section 1.17) are internally consistent except as flagged in the sensitivity examples (distance 3,600 m vs 3,690 m across examples is per source, not an error).
8. The "Questions to Master" pages intentionally overlap manual sections owned by other extraction agents; the question banks here are the question-set versions, not the procedure versions.
