# Field Guide + Questions to Master (agent 13)

Scope: the Valkryn Deployment Strategist Field Guide (condensed working reference: card standards, quick-reference tables, field procedures) and the "Questions to Master" lifecycle system (the complete question sets a strategist must be able to answer), including its ten lifecycle sub-pages and the DoD T&E Mastery Corpus sub-tree. Corpus governance and bibliography prose is de-emphasized per the brief; its operational hooks (numbers, procedures, data standards, timelines) are captured.

## Sources fetched

Assigned pages:
- Field Guide: https://app.notion.com/p/Field-Guide-3c06f36564f780f8b838f01b8f2fad8b
- Questions to Master: https://app.notion.com/p/Questions-to-Master-3be6f36564f7803eb931e541d33557d8

Sub-pages of Questions to Master (lifecycle question sets):
- 01 — Engagement Qualification & Stakeholder Authority: https://app.notion.com/p/6678ddd3f2934ad0a0d598b9f9686af9
- 02 — Mission, System & Hypotheses: https://app.notion.com/p/4529ba8c0a104da79815583052d77232
- 03 — Measures, Threat & Experimental Design: https://app.notion.com/p/a9faf8d4f6244d8e942dfc5157a71e9b
- 04 — Instrumentation, Data & Technical Integration: https://app.notion.com/p/b7b85c0d51904b6c807cecb4ad08b981
- 05 — Range, Safety, Security & Campaign Planning: https://app.notion.com/p/217f9408f46845b7a91e24e47ec120c9
- 06 — Readiness & Test Execution: https://app.notion.com/p/0cb3a139b37c46a497379c63d70542c2
- 07 — Adaptive Replanning & Campaign Analysis: https://app.notion.com/p/27b5d4ebf12f4ce4a11b12a36fd033e6
- 08 — Decision Evidence & Customer Action: https://app.notion.com/p/f2b97653eb894fdfa265dccd289ba632
- 09 — Closeout, Productization & Regression: https://app.notion.com/p/c083fbdc8eb9422bbc91b04db27b12d5
- 10 — Follow-On Program, Success Metrics & Control Questions: https://app.notion.com/p/3a27aba42d794fcba5b7dcc913d79765

DoD T&E Mastery Corpus (sub-page of Questions to Master) and its sub-pages:
- DoD T&E Mastery Corpus: Policy, Guidance, and Literature by Lifecycle Phase: https://app.notion.com/p/3be6f36564f78136a248d2e67ac1c3b1
- 01 · Foundations — Statute, Policy, and the T&E Ecosystem: https://app.notion.com/p/3be6f36564f78152b031d76214eecdd8
- 02 · FRAME — Decision and Mission Framing: https://app.notion.com/p/3be6f36564f781a3b484dea9748c7ee2
- 03 · DESIGN I — Measures, Threat, and Experimental Design: https://app.notion.com/p/3be6f36564f781bca64acbc1459db94c
- 04 · DESIGN II — Instrumentation, Data, Range, Safety, and Authorities: https://app.notion.com/p/3be6f36564f7813aa4f7dc5aa51cb91c
- 05 · EXECUTE AND LEARN — Readiness, Execution Control, and Adaptive Analysis: https://app.notion.com/p/3be6f36564f7810aaeb9eae00937d920
- 06 · DECIDE — Evaluation, Reporting, and Evidence Acceptance: https://app.notion.com/p/3be6f36564f78147bad9d3ee4fd9187f
- 07 · INSTITUTIONALIZE — Closeout, Regression, and Continuous Evaluation: https://app.notion.com/p/3be6f36564f781baa742c6a4fbf80600
- 08 · Frontier — AI, Autonomy, and Counter-UAS T&E: https://app.notion.com/p/3be6f36564f781e998f0d9ab03ee2e68
- 09 · Master Reference Library — All Documents in One List: https://app.notion.com/p/3be6f36564f781a3aa30d8a781080e75
- 10 · Gap Map — Where Doctrine Is Silent and Why It Matters: https://app.notion.com/p/3be6f36564f7816180cdd4774d8af88d

Not fetched: pages in the brief's page map owned by other agents; the "Strategic Opportunities" VALKRYN page referenced by the Gap Map (outside the assigned tree).

## 1. Input variables & fields

### 1.1 Identifier and naming scheme (Field Guide, "Naming and traceability")

| Record | Format example |
|---|---|
| Campaign | `CAMP-CUAS-2026-04` |
| Question | `OQ-CUAS-017` |
| Test Card | `TC-CUAS-TRK-004-v1.2` |
| Configuration | `CFG-BLUE-20260818-03` |
| Threat profile | `THR-G2-FW-LOW-02-v2` |
| Run | `RUN-0047` |
| Deviation | `DEV-###` (associated with run, affected measure, and resulting validity decision) |

Register series from Customer Discovery outputs: Operational Question Set `OQ-001...`, Claims Register `CLM-001...`, Unknowns Register `UNK-001...`, Assumption Register `ASM-001...`.

Rules: Never overwrite a run. Never reuse a run number. Test-card versions change when the planned method changes. A deviation during a run stays attached to the original card and run. If the deviation becomes the new intended method, issue a new card version before the next execution.

### 1.2 Persistent control registers (Questions to Master root)

Maintain these records across the lifecycle:
- Decision and authority charter
- Stakeholder and RACI register
- Claim–hypothesis–measure traceability matrix
- Configuration baseline and change log
- Threat and conditions matrix
- Measure and threshold registry
- Measure-to-data lineage map
- Risk, authority, and approval matrix
- Test cards and adjudication log
- Adaptation and change record
- Finding and applicability register
- Evidence acceptance record
- Regression dependency map
- Productization backlog
- Campaign success scorecard

### 1.3 Required inputs per Field Guide phase

- Phase 1 Role and Working Relationships: customer mission need; system description; current configuration; claimed performance; known deficiencies; intended threat; operating environment; available test assets; previous evidence; customer timeline; data access; range constraints.
- Phase 2 Customer Discovery: customer request; mission CONOPS; intended system use; vendor claims; current architecture; operating environment; previous failures; known threat information.
- Phase 3 Evidence Planning: operational questions; claims; configuration; threat definition; prior evidence; data interfaces; customer risk tolerance.
- Phase 4 Test Design: evidence plan; factor list; configuration baseline; threat profiles; range/environment constraints; statistical objectives.
- Phase 6 Test Execution: approved card; configuration; instrumentation plan; threat profile; range plan; data-quality criteria.
- Phase 7 Debrief and Evaluation: run data; validity status; configuration; deviation logs; measure results; operator observations.
- Phase 8 Adaptive Testing: validated evidence; current uncertainty; available range time; unresolved questions; resource constraints.
- Phase 9 Product Learning and Reuse: campaign artifacts; test cards; failures; adapters; data schemas; threat profiles; measure definitions; analyst workflow; user friction.

### 1.4 Configuration baseline contents (QtM 02)

Record a unique baseline identifier covering:
- Hardware, software, firmware, algorithms, models, and mission-data files
- Sensors, networks, C2 elements, interceptors, and effectors
- Interface versions, serial numbers, security settings, thresholds, calibrations, and feature flags
- Operator roles, tactics, procedures, and training state
- Known defects, waivers, and vendor-specific modifications

Change-control fields: baseline freeze time and change-approval owner; time tag on every change linked to affected runs; reconstructability of exact configuration; which changes invalidate prior runs or require repetition; how configuration effects will be separated from environmental or operator effects.

Configuration check record at execution (Field Guide 6): hardware; software; firmware; model; mission data; network configuration; sensor settings; operator settings; relevant payloads.

### 1.5 Claim–hypothesis register fields (QtM 02)

For every decision-relevant claim:
- Claim and source: contractual, operational, government, vendor, or promotional
- Conditions under which the claim should hold
- Decision relevance and priority
- Known evidence, assumptions, disputes, and unknowns
- Testability within this campaign
- Primary, null, and competing hypotheses
- Evidence that would support, refute, or leave each hypothesis inconclusive
- Applicable level: component, interface, operator, or mission-thread
- Disposition owner

Rank unresolved unknowns by: decision impact; cost and urgency of resolution; ability of live testing, simulation, intelligence, analysis, or another source to resolve them; acceptable residual uncertainty.

Discovery categorization rule (Field Guide 2): convert each customer statement into one of four categories: Claim, Known fact, Unknown, Assumption. Then ask "What evidence would resolve this unknown?"

### 1.6 Measure registry fields (QtM 03)

For every measure:
- Decision and hypothesis linkage
- Mission outcome or system behavior represented
- Exact definition, unit, numerator, and denominator
- Start and stop events
- Experimental unit and aggregation level
- Missing, invalid, censored, and ambiguous observation rules
- Calculation method and analytical version
- Required source data and independent ground truth
- Measurement error and uncertainty treatment
- Minimum, desired, and failure thresholds
- Definition and threshold approval authority

Candidate C-UAS measures (QtM 03): detection probability and range; track-initiation range and track continuity; track and classification accuracy; false-alarm rate; early-warning buffer; sensor-to-C2, handoff, and engagement-decision latency; interceptor assignment time; probability of intercept and defeat; end-to-end mission success; operator workload; availability, recovery time, and mission resilience.

Measure levels (Field Guide 3):
- Component: detection probability; track error; track continuity; false/nuisance alarm rate; latency; reliability.
- Interface: message success; translation error; handoff latency; correlation quality; data age; network availability.
- Mission: warning time; engagement timeline; probability mission thread completes; number of simultaneous threats handled; defended-asset protection outcome; operator workload.

Measure classes (QtM 03): primary, secondary, leading, lagging, descriptive; plus diagnostic measures sufficient to explain failures and distinguish competing causes.

### 1.7 Threat model and coverage matrix fields (QtM 03)

For each relevant threat class or variant:
- Speed, altitude, route, maneuver, emissions, communications, navigation, autonomy, payload, and swarm behavior
- Characteristics that drive blue-system performance
- Representation: actual threat, validated surrogate, or generic representation
- Fidelity by characteristic: faithful, approximated, or omitted
- Validation authority and evidence
- Profile class: mandatory, high-probability, or high-consequence
- Required combinations of range, azimuth, elevation, speed, and maneuver
- Excluded profiles and reason
- Generalization allowed and prohibited

Red control fields (QtM 03): activity mode (reproducing operational profile, probing a boundary, or optimizing against a defined objective); variables red may control and safety/realism envelope; what remains blinded from blue; prevention of unrealistic behavior; reconstructability of every red profile and adaptive decision.

C-UAS threat matrix construction (Corpus 03): rows are threat presentations traced to the VOLT with features: UAS group and airframe class; guidance and radio-frequency profile; speed and altitude; raid size; resistance to countermeasures. Columns are conditions: electromagnetic environment including contested spectrum; clutter; day and night; rules-of-engagement constraints. Each cell is one design point. Document and accredit each surrogate's fidelity; record each remaining fidelity gap as a test limitation. Guidance modes to include: remote control, waypoint, electro-optical terminal, RF-silent, fiber. Raid size: one aircraft to a swarm. Flight profile: loiter or one-way attack. Include UAS Groups 1 through 3.

### 1.8 Experimental design matrix fields (QtM 03)

- Trial and independent-observation unit
- Variable classes: independent, dependent, controlled, measured-uncontrolled, uncontrollable
- Operationally relevant factor ranges and interactions
- Baseline, positive control, negative control, comparison system, or comparison configuration
- Essential factor combinations and matrix coverage
- Randomization or blocking by day, operator, weather, configuration, or other nuisance variable
- Controls for learning, fatigue, equipment degradation, and order effects
- Expected variability and minimum operationally meaningful effect
- Required repetition, confidence, and statistical power where calculable
- Defensible conclusions when samples are constrained
- Treatment of rare but catastrophic failures

Field Guide variable classes (4.B): Independent factors (deliberately changed); Controls (held constant); Covariates (cannot be controlled but must be measured); Responses (measured outcomes); Confounders (factors capable of invalidating attribution).

### 1.9 Evidence-source plan fields (QtM 04)

For each measure and diagnostic need:
- Authoritative source and backup source
- Independence from the system under test
- Required position, timing, identity, state, effect, environmental, operator, and system-health data
- Accuracy, uncertainty, update rate, latency, and coverage
- Calibration standard and status
- Common time reference and synchronization tolerance
- Failure impact: invalidates run, requires repetition, or reduces analytical richness
- Validation owner

### 1.10 Measure-to-data map fields (QtM 04)

For every registered measure:
- Source system and field
- Status: raw, processed, inferred, or manually annotated
- Units, coordinate frame, schema, and semantics
- Production rate and expected latency
- Trial, track, configuration, event, and object identifiers
- Live versus post-processed requirement
- Transformation and calculation path
- Missingness and validity rules inherited from the measure registry

### 1.11 Interface control and fallback matrix fields (QtM 04)

For each mission-thread or evidence interface:
- Source, destination, owner, and criticality
- Protocol, API, interface-control document, authentication, and schema
- Available and missing fields
- Semantic, unit, coordinate-frame, identity, and timing reconciliation
- Status: existing, new, vendor-supported, proprietary, or experimental
- Adapter and integration work required
- Live-feed fallback, local buffering, or manual export path
- Failure impact on measures, runs, and campaign objectives

### 1.12 Authority and control matrix fields (QtM 05)

For safety, range operations, airspace, spectrum, security, and residual risk:
- Governing authority
- Required approval or authorization
- Approval owner and due date
- Operating limits and monitoring method
- Unilateral stop authority
- Restart authority
- Change-approval authority
- Evidence of approval

### 1.13 Pre-run test card fields (QtM 06)

Purpose block: decision question, hypothesis, and measure addressed; test-matrix cell and required repetition; why this run is the highest-value next event; result that could change the customer decision or campaign plan.

Controlled state block: blue configuration baseline; red profile and control mode; operators and procedures; environmental, range, spectrum, and airspace conditions; instrumentation, ground truth, and required feeds; changes since the previous run and approval reference.

Authorization and validity block: run initiator and sequence controller; safety, data-quality, equipment, and procedural abort criteria; stop and restart authorities; data loss or deviation requiring repetition; blinding and information-control requirements.

### 1.14 Run adjudication record fields (QtM 06)

Complete immediately after every run:
- Planned versus actual sequence
- Actual configuration, threat profile, operators, and conditions
- Ground-truth and instrumentation validity
- Data completeness and quality
- Procedural, safety, configuration, or method deviations
- Operator observations and initial technical interpretation
- Determination: valid, conditionally valid, or invalid, with rationale
- Measures and hypotheses that may use the run
- Repeat recommendation and urgency
- Adjudication authority

Field Guide post-run validity states (6, Live run/After): valid; valid with limitation; invalid; pending adjudication.

### 1.15 Adaptation change record fields

QtM 07 version: evidence gap or anomaly prompting the change; alternatives considered; selected event and rationale; variables changed and held constant; applicable approved change class; approval authority and time; schedule, cost, safety, and acceptance implications; effect on comparability and validity; expected decision value.

Field Guide 8 version: Change ID; triggering evidence; original plan; revised plan; reason; question affected; configuration/threat impact; comparability impact; test-card version; timestamp. Rule: "Never rewrite history. The old test card remains preserved."

### 1.16 Finding record fields (QtM 07)

For every primary or consequential finding:
- Claim, hypothesis, and decision linkage
- Observed result and supporting runs
- Exact configuration, threat, environment, operator, procedure, and method
- Primary, secondary, and diagnostic measures
- Threshold comparison
- Variability, confidence, measurement error, and sample limitations
- Confounders and alternative explanations
- Component versus end-to-end mission effect
- Finding strength: conclusive, directional, or insufficient
- Conditions under which the finding applies
- Conditions to which it must not be generalized
- Decision implication
- Retest or follow-up requirement

Applicability and evidence-life fields (QtM 07): covered hardware, software, firmware, mission data, configuration, interfaces, threat profiles, environments, operators, procedures, methods; untested or weakly represented conditions; threat-fidelity and range-representation limitations; sensitivity to analytical assumptions; permitted and prohibited generalization; assumptions that must remain true; conditions likely to make the evidence stale.

Root-cause classes (QtM 07 causal loop): confirmed, supported, plausible, or unknown.

### 1.17 Claims disposition enum (QtM 08)

Close every registered claim as one of: Supported; Contradicted; Directionally supported; Inconclusive; Untested; Outside scope. For each disposition distinguish: product behavior as represented; performance under mission-relevant conditions; performance within the complete architecture and mission thread.

Decision options enum (QtM 08): procure, select an alternative, reconfigure, fix, restrict employment, retest, defer, or reject. QtM 03 variant: procure, field, reconfigure, fix, retest, reject, or defer.

### 1.18 Action plan fields (QtM 08)

For every resulting action: authorized decision owner; action owner and supporting organizations; funding owner; completion date; required fix, configuration change, procedural change, restriction, or follow-on test; evidence required to close remaining risk; communication required for operators, vendors, evaluators, and leaders.

### 1.19 Controlled evidence baseline fields (QtM 09)

- Hardware, software, firmware, algorithms, models, mission data, and configuration
- Interfaces and supporting systems
- Threat classes and profiles
- Environments and ranges
- Operators, training state, tactics, and procedures
- Measures, thresholds, methods, and analytical versions
- Assumptions, limitations, validity period, and acceptance status

Change classes to assess for impact (QtM 09): software, firmware, model, or mission-data update; hardware or sensor replacement; new or changed C2 interface, interceptor, or effector; changed detection, classification, tracking, prioritization, or engagement logic; changed operator procedure or training state; new location, environment, or range; new threat profile or adversary tactic; new mission requirement or acceptance threshold.

Change-impact outcomes enum (QtM 09): leaves findings valid; narrows applicability; invalidates specific findings; requires analysis, simulation, bench test, limited live regression, or full reevaluation.

### 1.20 Program control fields (QtM 10)

For every follow-on or recurring program: next decision and deadline; controlled evidence baseline; change log and impact classification; required refresh scope; budget and contract owner; evidence authority; acceptance status; success-scorecard trend.

### 1.21 Reusable asset metadata (Field Guide 9)

Every reusable asset should carry:
```
Asset ID
Version
Originating campaign
Mission context
Applicable configurations
Threat scope
Required inputs
Method
Assumptions
Validity limits
Known failure modes
Dependencies
Owner
Last validated date/configuration
```

### 1.22 Mission-thread transition record fields (QtM 02)

At every transition of the C-UAS chain, record: information passed, source, destination, and interface; required latency, quality, and semantic consistency; human or automated decision authority; dependencies and failure modes; mission consequence of delay, degradation, or failure.

### 1.23 Planning lead-time values (Corpus 04, operational hooks for schedule fields)

- FAA Part 107 waiver: 1 to 3 months.
- 49 U.S.C. §44807 exemption plus Blanket COA (UAS over 55 lb): 4 to 9 months.
- Public-aircraft COA: 60 to 90 days.
- FCC Part 5 special temporary authority: 2 to 8 weeks; conventional experimental license: 1 to 3 months; 5-year program license available for repeated testing.
- Intentional GPS interference approval: at least 60 to 90 days; applies only to a specified geographic area; DoD-controlled.
- Open-air RF or GPS-denial testing at a commercial range requires a federal sponsor or a physical enclosure (cables, chamber, screened enclosure).
- Universal Documentation System Program Introduction: send 6 to 12 months before the campaign; reserve MRTFB range at least two quarters ahead (quarterly schedule boards).
- ATEC Safety Release inputs: 60 to 90 days before Soldiers use the system.
- First UAS flight clearance at a government range: 2 to 6 months.
- OT plans to DOT&E at least 60 days before test (oversight programs); operational test agency report of record 45 days before the decision (Major Capability Acquisition); UCA disposition analysis within 1 year after sustainment entry.

## 2. Calculations & formulas

### 2.1 Measure formulas (Field Guide 5, notional C-UAS test card)

1. Usable Warning Time:
```
time usable track enters C2 − time threat reaches defended-asset boundary
```
2. Detection Probability: `Valid detections / valid detection opportunities under the defined condition.`
3. Track Position Error: blue track position versus independent ground truth.
4. Track Continuity: fraction of required mission interval containing a valid track.
5. C2 Handoff Latency: time from qualifying sensor track to usable C2 track.
6. Nuisance/False Track Rate: false tracks per defined observation period.

Ground-truth accuracy rule: "Ground-truth measurement error must be small enough relative to the smallest decision-relevant effect to support the comparison."

### 2.2 Adaptive-test priority score (Field Guide 8)

Rank candidate tests using:
```
Decision importance
× uncertainty reduction
× likelihood of obtaining valid evidence
÷ time / cost / operational burden
```
"A qualitative High / Medium / Low scoring system is usually sufficient."

### 2.3 Threshold origin rule (Field Guide 3)

A threshold must originate from one of exactly six sources:
1. mission need;
2. requirement;
3. safety constraint;
4. established baseline;
5. customer-approved risk criterion; or
6. explicitly documented characterization objective.

If no threshold exists, characterize performance and uncertainty. Do not create a pass/fail conclusion if the customer has not established a legitimate decision criterion. Customer operational pass/fail threshold is an execution blocker until customer-approved.

### 2.4 Repetition and statistical sizing rules

- Field Guide 4.F: set repetition from the required confidence/precision and expected variability. "Do not use 'three runs' merely because three runs are customary."
- Corpus 03 (STAT/DOE workflow): calculate power for the complete design, not separately for each design point. Define the operationally important effect size. Define the confidence target; typical targets are 80–95 percent. Estimate expected noise. Show the trade between power and the number of runs (DOT&E expects run-count justification). Worked example: four replicates were sufficient at 95 percent confidence (DOT&E DOE example for a software-intensive system).
- Sequential experimentation: plan the complete sequence before the test starts; limit the first design to 25–40 percent of the test budget. Stages: screen, augment, validate. Bayesian updating supports early stopping; an interim result can become final when posterior uncertainty is sufficiently small.
- Design-class selection: factorial or fractional-factorial to characterize the operating envelope; response-surface design for optimization; space-filling design plus Gaussian process for M&S exploration.
- Analysis: regression, analysis of variance, or generalized linear model across the factor space. Calculate confidence intervals for mission-level responses in each condition. Do not report only one overall average. Interval choice: confidence intervals for claims about means; tolerance intervals for population coverage; prediction intervals for the next observation.
- The four standard DOE questions (2010 Gilmore memo): 1. What are the test goals? 2. How many trials are necessary? 3. What conditions are necessary? 4. How will the test measure success? Test the operating envelope; do not demonstrate the specification only one time.

### 2.5 Validity chain (Corpus 03)

Government acceptance depends on: construct validity (measures represent mission capability); internal validity (randomization and blocking control confounding); external validity (operational realism, production-representative articles, typical operators; statutory for IOT&E); statistical-conclusion validity (sufficient power and confidence).

### 2.6 Productization metrics (QtM 09)

Track for this campaign and the next comparable campaign: setup and integration time; custom-code volume; adapter, schema, calculation, and test-card reuse; personnel and founder hours; time to first valid run; time to preliminary and final evidence; repeat-run rate caused by preventable failures; campaign cost and repeat contribution margin.

### 2.7 Success scorecard metrics (QtM 10)

Decision impact, track: decisions supported; decision latency; evidence-acceptance rate; time from final valid run to decision-ready evidence; action-conversion rate; follow-on conversion.

Evidence quality, track: safety and regulatory deviations; data completeness; valid-run rate; repeat-run rate by cause; traceability and reproduction success; finding disposition (conclusive, directional, or insufficient); acceptance reservations or evidence gaps.

Operating leverage, track: time from arrival to first valid run; campaign duration; setup and integration hours; custom-code volume; adapter, schema, calculation, and test-card reuse; founder involvement; personnel days per valid evidence unit; time to preliminary and final evidence; contribution margin on repeat campaigns.

Success metric of Product Learning (Field Guide 9): "The second comparable campaign achieves equal or better evidentiary quality with less bespoke planning, integration, analysis, and founder judgment."

### 2.8 Measure hierarchy scoring (Corpus 03)

Mission → critical operational issues (COIs) → measures of effectiveness (MOEs, mission outcomes) → measures of suitability (MOSs: reliability, availability, maintainability, supportability, training, usability) → measures of performance (MOPs, system performance) → data requirements. Evaluators score each measure and combine scores per COI into a satisfactory or unsatisfactory resolution. Use inferential statistical designs only for critical measures; use descriptive analysis for the others. A system can meet all KPP thresholds and still be operationally ineffective; design measures to support both assessment chains.

## 3. Checklists

### 3.1 Field Guide operating gates (verbatim item lists)

Pre-Campaign Gate:
- [ ] Customer decision defined.
- [ ] Operational questions identified.
- [ ] System boundary defined.
- [ ] Configuration known.
- [ ] Claims and unknowns captured.
- [ ] Threat context defined.
- [ ] Existing evidence reviewed.
- [ ] Measures defined.
- [ ] Ground-truth approach defined.
- [ ] Data availability verified.
- [ ] Test levels selected.
- [ ] Range constraints understood.
- [ ] Stop/retest criteria defined.
- [ ] Customer understands intended outputs.

Pre-Run Gate:
- [ ] Correct Test Card/version.
- [ ] Correct run ID.
- [ ] Correct configuration.
- [ ] Correct threat profile.
- [ ] Independent variable identified.
- [ ] Controls verified.
- [ ] Ground truth healthy.
- [ ] Mandatory feeds healthy.
- [ ] Time synchronization verified.
- [ ] Calibration valid.
- [ ] Range/safety ready.
- [ ] Abort criteria understood.
- [ ] Expected evidence stated.

Post-Run Gate:
- [ ] Intended configuration executed.
- [ ] Threat remained within profile.
- [ ] Required data captured.
- [ ] Ground truth valid.
- [ ] Deviations recorded.
- [ ] Run validity assigned.
- [ ] Observations separated from interpretation.
- [ ] Evidence gap updated.
- [ ] Retest requirement identified.
- [ ] Next test priority assessed.

Daily Closeout Gate:
- [ ] Each operational question updated.
- [ ] Invalid runs excluded appropriately.
- [ ] Unexpected results adjudicated.
- [ ] Missing data documented.
- [ ] Uncertainty recorded.
- [ ] Remaining evidence gaps ranked.
- [ ] Next-day cards versioned.
- [ ] Configuration changes recorded.
- [ ] Customer aligned on what is known and unknown.

### 3.2 The Deployment Strategist's Standard (Field Guide, nine questions)

At any point during a campaign, the Deployment Strategist should be able to answer:
1. What customer decision are we supporting?
2. What operational question are we answering now?
3. What exact configuration is under test?
4. What threat and conditions are represented?
5. What hypothesis does this run examine?
6. What evidence will answer it?
7. Is the evidence valid?
8. What can and cannot be concluded?
9. What should we test next, and what should TestOS retain?

If any answer is unclear, the campaign has lost test traceability. Discipline: "Do not optimize for running tests. Optimize for eliminating consequential uncertainty with controlled, reusable evidence."

### 3.3 Ten continuous control questions (Questions to Master root)

At every stage, the campaign lead should be able to answer:
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

How to use the system (QtM root): 1. Begin with the decision and authority, not the available test event. 2. Carry each decision-critical uncertainty through a traceable chain: claim → hypothesis → measure → data → finding → action. 3. Maintain controlled baselines for configuration, threat, conditions, method, and evidence. 4. Treat readiness and run checks as verification gates, not substitute planning. 5. Bound every conclusion by the exact conditions under which it was established. 6. Convert campaign learning into regression logic and reusable capability.

Operating principle: define each control once, approve it at the owning phase, verify it at execution gates, and update it through a traceable change record. Later phases reference canonical records rather than rediscover the same facts.

### 3.4 Field Guide high-value question sets per phase

Phase 1 (Role):
- What decision must this testing enable?
- What will the customer do differently if the answer is A versus B?
- Which decision cannot currently be made because evidence is missing?
- Which system configuration is actually under consideration?
- What evidence already exists?
- Which evidence is trusted?
- Which evidence is stale?
- What must be learned live?
- What can be learned from existing data or M&S?
- Who must believe the result for it to be useful?

Phase 2 (Discovery, RFI process), by category:
- Mission and decision: What mission function must succeed? What are you protecting, detecting, tracking, deciding, or defeating? (Blue/Red Force Disposition; Protected Entity.) What decision will these results support? When must that decision be made? What constitutes mission failure? (Simple, Measurable, Approachable; tied to mission objectives.)
- System: What exact hardware, software, firmware, model, mission-data, payload, and network configuration will be tested? Which components are optional? Which interfaces are mission-critical? Which component is expected to be the limiting node?
- Claims: What does the vendor claim? Under what conditions was that claim established? Is the claim component-level or end-to-end? What claim matters operationally?
- Threat: Which threat matters most? What is the most likely threat? What is the most stressing credible threat? Which threat characteristics actually drive system performance?
- Conditions: Where will the capability operate? What clutter, terrain, weather, RF environment, network state, operator loading, or degraded mode matters? Which conditions have never been tested?
- Known problems: Where has the system already failed? Which failures are repeatable? Which failures are anecdotal? What recent software or configuration changes could invalidate old evidence?
- Assumptions and edge cases: What must be true for the concept to work? Which handoff can fail without any individual component technically failing? What happens at minimum range, maximum range, sector boundaries, network loss, track crossing, target saturation, or operator overload? What condition would make the current architecture irrelevant?
- Conflicting priorities: Are we optimizing maximum capability, reliability, cost, operator burden, interoperability, setup time, or deployment speed? Which trade is acceptable? Which trade is not?

Phase 3 (Evidence planning):
- What observation would support the claim? What observation would contradict it?
- What is the dependent measure? What factor is being changed? What must remain controlled?
- What independent ground truth exists? What uncertainty is tolerable? What comparison provides the answer?
- Does the customer need characterization, ranking, pass/fail, root cause, or boundary discovery?
- What performance level is operationally meaningful?

Phase 4 (Test design):
- Which factor is actually expected to cause the outcome? Which factors can be controlled? Which factors must be measured as covariates?
- What is the baseline? How will configuration A be compared with configuration B?
- How many valid opportunities are required? Which boundary conditions matter?
- What failure should trigger a deeper diagnostic test?

Phase 6 (Execution, before every run):
- What exactly are we testing? Which factor is changing? What must stay constant?
- Is the configuration known? Is ground truth valid? Are mandatory feeds healthy?
- What would invalidate the run? What would cause an abort? What result would change the next test?

Phase 7 (Debrief):
- Was the run valid? What did we directly observe? What does analysis establish? What remains uncertain?
- Can the result be reproduced? Did a test artifact affect the outcome? What condition was not represented?
- What conclusion would be unsafe to make? What question should be tested next?

Phase 8 (Adaptive):
- Which uncertainty now dominates the decision? Which test has the highest probability of resolving it?
- Did today's evidence make a planned test unnecessary? Did today's result expose a more important boundary?
- Does changing the plan compromise comparability? Are we exploiting an interesting anomaly or pursuing a decision-relevant question?

Phase 9 (Reuse):
- What did we create that another campaign will need? What required expert judgment? Can that judgment be encoded?
- What manual action should software automate? Which failure mode should become a regression test?
- Which measure definition should become canonical? Which threat profile is reusable? Under what conditions is it valid?
- What configuration change should automatically trigger retesting? Where did TestOS fail to capture the information needed later?

### 3.5 QtM 01: Engagement Qualification & Stakeholder Authority (complete question set)

Decision charter:
- What exact decision must be made, by when, and by which authorized organization?
- Which alternatives are under consideration, including delay or no action?
- What are the operational, contractual, budgetary, regulatory, or political consequences of acting, delaying, or choosing incorrectly?
- What uncertainty currently prevents or weakens the decision?
- Can evidence from this campaign materially reduce that uncertainty and change the decision?
- What bounded decision would remain supportable if results are unfavorable, mixed, or inconclusive?

Engagement type and authority boundary:
- Is the work a demonstration, experiment, characterization, comparison, or defensible evaluation?
- Is Valkryn being asked to recommend, characterize, validate, certify, or authorize?
- Which functions can Valkryn perform, and which decisions remain with government, range, safety, acquisition, certification, airworthiness, or other authorized organizations?
- Has the customer already selected an answer and merely requested validation?

Decision clock:
- What event creates the decision deadline?
- By what date must accepted evidence be available to affect the decision?
- How much time is allocated to planning, contracting, integration, rehearsal, execution, analysis, review, acceptance, and contingency?
- What is the latest viable date for each critical-path activity?

Customer commitment:
- Who is the sponsor, economic buyer, operating champion, and contracting authority?
- Who can commit customer personnel, systems, data, vendor support, range access, and review time?
- What budget and contracting vehicle are available?
- Will the customer define success and acceptance conditions before seeing results?
- Will the customer accept unfavorable, mixed, or inconclusive evidence?

Feasibility screen:
- Can representative blue systems, operators, supporting systems, threats or validated surrogates, and operating conditions be made available?
- Can required conditions be created safely, legally, and within the decision window?
- Can independent ground truth and sufficient instrumentation be established?
- Can required data be accessed, retained, protected, analyzed, and delivered?
- Are classification, security, range, spectrum, airspace, integration, and schedule constraints resolvable?
- Is the evidence likely to be accepted by the relying organization?
- Is the scope within Valkryn's current capability and institutional boundary?
- What unresolved condition requires delay, rescoping, partnership, or decline?

Stakeholder and authority register (for each role: named person or organization, authority, required participation, decision rights, escalation path):
- Customer and mission roles: sponsor and economic buyer; mission owner and system owner; operating champion and operators; contract and budget authority; final decision-maker; results consumers; potential blockers.
- Evidence authority: Which organization must rely on or accept the evidence? Who represents it during planning and review? What authority does it hold? Must it preapprove the method, measures, thresholds, repetitions, witnessing, documentation, or data format? What would cause it to reject the evidence? Who formally acknowledges method acceptance and final evidence acceptance?
- Test and operational authority: Who owns range, airspace, spectrum, safety, security, and residual-risk decisions? Who may stop the test, authorize restart, approve plan changes, or accept deficiencies?
- Vendors and partners: What does each party own, provide, approve, or restrict? What proprietary, comparative-results, export, or distribution constraints apply? What incentives could bias configuration, method, or interpretation? Who provides technical support and resolves disputes?
- Valkryn ownership: Who owns campaign leadership, TestOS configuration, technical integration, data engineering, analysis, range operations, red activity, safety coordination, and customer communication? Who may make on-site scope, schedule, cost, and risk decisions?

Evidence acceptance contract (align decision-maker and evidence authority before design begins):
- Decision and deadline
- Decision-critical uncertainty
- Required evidence and acceptable uncertainty
- Method and independence expectations
- Review, witnessing, documentation, and delivery requirements
- Formal acceptance path

Qualification gate statement: "The customer must make **this bounded decision** by **this date**. **This authority** will rely on evidence meeting **these acceptance conditions**. The campaign can materially reduce **this decision-critical uncertainty**, and the required customer commitment and execution conditions are feasible."

### 3.6 QtM 02: Mission, System & Hypotheses (complete question set)

Mission definition:
- Who must perform what mission, to protect which asset, force, population, or activity?
- Against which threat classes and variants?
- In what theater, terrain, weather, electromagnetic, communications, workload, and degraded or denied conditions?
- Under what operational, legal, doctrinal, timing, and resource constraints?
- What constitutes mission success, failure, and acceptable degradation?
- Which assumptions must remain true?

CONOPS and mission thread:
- What is the intended concept of operations?
- Where does the system enter the mission thread, and what occurs immediately before and after its function?
- Which operators, organizations, and supporting systems participate?
- What information does each participant receive, what decision must be made, and how much response time is available?
- Which doctrine, tactics, techniques, and procedures govern employment?

System boundary:
- Is the object of evaluation a component, subsystem, platform, architecture, or end-to-end mission capability?
- What is inside and outside the test boundary?
- Which external services, supporting systems, operators, tactics, and procedures are part of the evaluated configuration?
- Which dependencies will be controlled, observed, or treated as assumptions?

Evaluation readiness boundary:
- Has the system passed functional checkout and vendor acceptance?
- Are known failures, limitations, and waivers documented?
- Are operators trained sufficiently for the intended evaluation?
- Is the campaign evaluating performance, integration maturity, or both?
- What debugging is permitted before a run ceases to represent the frozen baseline?

Failure-mode model:
- What known failure modes exist at component, interface, configuration, operator, environment, threat, instrumentation, and method levels?
- Which unknown failure boundaries must be sought?
- What observations would distinguish competing causes?
- What is the mission consequence, detectability, recoverability, and decision impact of each failure mode?
- Which failure modes require prevention, monitoring, deliberate test, or contingency planning?

Definition gate (proceed to evidence design only when): the mission and mission thread are explicit; the evaluated boundary and configuration baseline are reconstructable; decision-relevant claims and unknowns map to testable hypotheses; critical failure modes and assumptions are visible; required operating conditions are defined for later range-fit and validity assessment.

### 3.7 QtM 03: Measures, Threat & Experimental Design (complete question set)

Claim–measure traceability:
- Does every test activity address a registered hypothesis or decision-critical uncertainty?
- Does every primary measure connect to a customer decision?
- Are diagnostic measures sufficient to explain failures and distinguish competing causes?
- Which measures are primary, secondary, leading, lagging, or descriptive?

Decision and threshold logic:
- Is each threshold a requirement, objective, contract value, operational need, or analyst judgment?
- Is performance evaluated as binary, continuous, or conditional?
- What trade-offs are permitted among measures?
- What uncertainty is acceptable around each threshold?
- How will borderline results be treated?
- What result supports procure, field, reconfigure, fix, retest, reject, or defer?
- What result remains insufficient for any decision?

Acceptance alignment (confirm with the evidence authority; freeze pass/fail and acceptance criteria before execution unless an approved change is recorded):
- Measures and definitions
- Thresholds and uncertainty limits
- Analytical method
- Experimental unit and required repetition
- Comparison and control conditions
- Witnessing and independence requirements
- Output and data-delivery format

Red control and adversarial search:
- Is red activity reproducing an operational profile, probing a boundary, or optimizing against a defined objective?
- Which variables may red control, and within what safety and realism envelope?
- What remains blinded from blue participants?
- How will unrealistic behavior be prevented?
- Can every red profile and adaptive decision be reconstructed?

Approved adaptation policy (define before execution):
- Fixed and adaptable test-card elements
- Conditions triggering repeat, expansion, variable isolation, or termination
- Maximum permitted change without renewed design approval
- Approval authority for each change class
- Documentation required to preserve comparability
- Rule for selecting the next event based on information gain, decision value, cost, time, and risk

Stop rules, separated by authority:
- Safety or regulatory stop: governed by the campaign safety plan
- Data-quality stop: required evidence cannot be recovered
- Equipment stop: configuration or capability is no longer representative
- Evidence-sufficiency stop: decision uncertainty is reduced enough
- Futility stop: additional testing is unlikely to change the conclusion
- Resource stop: remaining value does not justify time, cost, or risk

Design approval gate (do not proceed to implementation until): claims, hypotheses, measures, thresholds, and test events are traceable; threat fidelity and exclusions are explicit; experimental controls and repetition support the intended conclusion; adaptation and stop rules are approved; the evidence authority accepts the design and output expectations.

### 3.8 QtM 04: Instrumentation, Data & Technical Integration (complete question set)

Independent ground truth:
- What source establishes authoritative position, timing, identity, state, and effect?
- How will conflicting or missing ground truth be detected and reconciled?
- Can ground truth be correlated with blue, red, range, operator, and environmental records?
- Can timing provenance and clock drift be reconstructed later?

Data model and event identity:
- Can every campaign, test card, trial, configuration, threat profile, track, event, and result be uniquely identified?
- Are identifiers consistent across systems?
- Can objects and events be reconciled when systems use different identifiers, units, coordinate frames, or semantics?
- Are manual annotations distinguished from measured or inferred data?

Data lineage, integrity, and reproducibility (establish controls for):
- Packet loss, missing records, duplicates, corruption, and conflicts
- Invalid-data flags and exclusion reasons
- Raw-data immutability
- Ingestion time and source-system identity
- Software, schema, adapter, and transformation versions
- Configuration active when each datum was generated
- Annotation and alteration history
- Raw-to-metric and metric-to-finding traceability
- Reproduction of analysis from retained raw data and versioned code
- Independent audit of the complete evidence chain

Calibration and synchronization:
- What pre-test, daily, and post-test calibration checks are required?
- How will instrument drift and clock drift be detected?
- What happens when calibration or synchronization falls outside tolerance?
- Can the campaign continue with degraded instrumentation, and what conclusions become unavailable?

Data rights, protection, storage, and delivery:
- Who owns and may access raw data, comparative results, and proprietary information?
- What may Valkryn retain, reuse, aggregate, or disclose?
- What is government-furnished, export-controlled, classified, CUI, or contractually restricted?
- Where will each data class be stored and processed?
- What disconnected transfer, backup, retention, deletion, and incident-response procedures apply?
- In what schema, media, classification, and delivery format will the customer receive data?

End-to-end rehearsal acceptance (before range execution, demonstrate that):
- Every required source reaches the analysis environment.
- Every trial and configuration is uniquely tagged.
- Time synchronization and ground-truth correlation meet tolerance.
- Required metrics can be computed from representative rehearsal data.
- Data-quality monitoring detects defined failure modes.
- Backup, buffering, disconnected, access-control, and recovery procedures work.
- A reviewer can trace a rehearsal result to raw data, configuration, method, and transformation version.

Technical integration gate: proceed only when the complete evidence chain has passed rehearsal, or every deficiency has a named owner, approved disposition, and explicit effect on achievable conclusions.

### 3.9 QtM 05: Range, Safety, Security & Campaign Planning (complete question set)

Range-fit assessment (compare every mission-required condition with range capability):
- Airspace, ground footprint, terrain, clutter, horizon, and line of sight
- Weather and environmental conditions
- Spectrum and electromagnetic conditions
- Communications and network availability
- Threat, sensor, effector, launch, recovery, and engagement profiles
- Ground truth and instrumentation
- Safety, security, and classification authority
- Decision-window availability

Classify each condition: Representative; Acceptably approximated; Unsupported; Requiring mitigation or another site. Record how each gap limits external validity or campaign scope.

Site and range selection:
- What can Merced support, and what requires a government or partner range?
- Which site best balances representation, authority, availability, cost, integration burden, and risk?
- Can all required systems, threats, operators, and support personnel access the site?
- What range-specific procedures or limitations alter the approved design?

Safety and emergency control:
- What hazards exist, with what probability, severity, and mission consequence?
- What engineering, administrative, procedural, and emergency mitigations apply?
- Who accepts residual risk?
- What flight-termination, lost-link, geofencing, abort, medical, fire, recovery, mishap, and near-miss procedures apply?
- Are safety-critical controls observable and testable before execution?

Airspace and spectrum:
- What airspace authorization, NOTAM, FAA coordination, weather minimum, and manned/unmanned deconfliction are required?
- How will nonparticipating aircraft be detected and protected?
- Which frequencies, power levels, periods, and propagation boundaries apply?
- What FCC, NTIA, military, or range authority is required?
- How will unintended interference be detected, contained, and shut down?

Security, legal, and contractual controls:
- What are the classification, CUI, OPSEC, cybersecurity, photography, recording, clearances, secure-space, and need-to-know requirements?
- Can foreign nationals participate, and under what restrictions?
- What DD-254, accredited-system, export-control, incident-reporting, or public-release requirements apply?
- Who bears risk for damaged equipment?
- What liability, warranty, intellectual-property, data-rights, weapons, hazardous-material, and comparative-result terms apply?

Campaign scope baseline (define included and excluded; every exclusion must state its effect on the conclusions):
- Decisions and hypotheses
- Systems and configurations
- Threats and profiles
- Conditions and ranges
- Measures and thresholds
- Test events and repetitions
- Deliverables and data products

Resource-loaded schedule, plan milestones for: contracting, approvals, and site access; system and threat delivery; integration and data-chain rehearsal; operator and safety rehearsal; execution and reserve days; daily analysis and adaptive planning; final analysis, customer review, and evidence acceptance. Identify: critical path and latest viable dates; required personnel, competencies, shifts, equipment, spares, consumables, vendor support, travel, shipping, customs, lodging, power, networking, maintenance, storage, fuel, and batteries; owner and backup for each workstream; schedule, cost, and capability reserve.

Command, communications, and battle rhythm:
- What command structure, RACI, communication channels, terminology, and event identifiers apply?
- What is the daily brief, run authorization, hotwash, analysis, and next-day planning rhythm?
- Who receives live, preliminary, and final results?
- What requires customer or authority approval?
- How are disagreements, deviations, and decisions escalated and recorded?

Contingency and minimum viable campaign (for loss of weather, range access, airspace, spectrum, threat aircraft, blue systems, data feeds, authorization, staffing, or critical equipment, define): immediate action; recovery owner and decision deadline; alternate site, system, source, or profile; minimum viable campaign; objective-descoping priority; effect on evidence acceptance and conclusions.

Campaign plan gate (do not enter readiness review until): the selected environment supports the bounded conclusions; authorities and controls are identified and on track; scope, resources, schedule, command relationships, and contingencies are executable; remaining gaps have approved mitigations and explicit validity consequences.

### 3.10 QtM 06: Readiness & Test Execution (complete checklist set)

Readiness review record fields per control: baseline or approval reference, status, deficiency, owner, due date, waiver authority, and supporting evidence.

Technical readiness:
- Approved blue and red configurations are installed, identified, and functional.
- Required interfaces, adapters, feeds, buffering, and fallback paths work.
- Ground truth, instrumentation, calibration, and time synchronization meet tolerance.
- Required metrics have been computed from representative rehearsal data.
- Backups, spares, maintenance support, and recovery procedures are operational.
- The end-to-end evidence chain has passed rehearsal.

Operational readiness:
- Operators are trained for the evaluated CONOPS and frozen procedures.
- Red and blue roles, communications, launch, recovery, reset, and event timelines are rehearsed.
- Range, vendor, customer, analysis, and technical-support personnel are on station or on call.
- Decision, approval, stop, restart, and change authorities are available.

Safety, regulatory, and security readiness:
- Required range, airspace, spectrum, safety, security, and legal approvals are active.
- Hazards, operating limits, stop conditions, and emergency procedures are briefed.
- Flight termination, lost-link, geofencing, shutdown, monitoring, medical, fire, and recovery controls are tested.
- Classification, CUI, access, recording, and incident-response controls are active.

Data readiness:
- Campaign, test-card, run, configuration, threat, track, and event identifiers are active.
- Storage, backup, retention, classification, and access controls work.
- Data-quality monitoring and analyst workflows are ready.
- Ground truth, telemetry, operator actions, environmental conditions, and configuration can be correlated.

Go/no-go gate questions:
- Which controls must be green?
- Which deficiencies may be accepted, by which authority, and with what effect on conclusions?
- Which deficiencies require delay, redesign, rescoping, or cancellation?
- Who makes and records the final go/no-go decision?

Run control:
- Confirm identifiers, configuration, profile, conditions, feeds, synchronization, and safety status before initiation.
- Time-tag start, phase transitions, operator actions, deviations, anomalies, pauses, and completion.
- Preserve the approved sequence and blinding unless an authorized change is recorded.
- Monitor safety and evidence-chain health continuously.
- Record who authorized every pause, change, abort, restart, or continuation under degraded conditions.

Execution gate: a run enters campaign analysis only when its adjudication record establishes what occurred, whether the evidence is usable, and which claims, hypotheses, measures, and conditions it can support.

### 3.11 QtM 07: Adaptive Replanning & Campaign Analysis (complete question set)

Daily evidence review, four steps:
1. Adjudicate available evidence: Which runs are valid, conditionally valid, or invalid according to their run records? What data are complete, incomplete, conflicting, or questionable? Which measures and hypotheses can each run support?
2. Update hypotheses and uncertainty: Which hypotheses gained or lost support? What expected behavior failed to occur? What new uncertainty or failure boundary emerged? Is the observed effect repeatable and operationally significant?
3. Identify decision-critical gaps: Which measures, hypotheses, or test-matrix cells remain unsupported? Which missing evidence has the greatest effect on the customer decision? Is another run likely to resolve the uncertainty? What is its expected decision value relative to time, cost, safety, and risk?
4. Select the next event (apply the approved adaptation policy): repeat the run; change one variable; change the configuration; add or repair instrumentation; modify the threat profile; isolate a component or interface; stop a low-value line; expand into a newly identified failure boundary; end testing for sufficiency or futility. Select the event that maximizes information gain and decision value while preserving necessary comparability.

Causal diagnosis loop (for each consequential anomaly or failure):
1. Define the observation precisely.
2. Identify candidate component, interface, configuration, operator, environment, threat, instrumentation, and method causes.
3. Identify evidence that distinguishes competing explanations.
4. Reproduce or isolate the behavior where feasible.
5. Classify root cause as confirmed, supported, plausible, or unknown.
6. Determine correctability and mission consequence.
7. Define the corrective action and verification test.
Rule: do not present a hypothesized root cause as a confirmed finding.

Completed-campaign evidence validity:
- Which runs are included or excluded, and why?
- Could missingness or exclusion bias the result?
- Are unresolved data conflicts material?
- Were data transformations and analytical versions verified?
- Can every result be reproduced from retained evidence?
- Can every result be traced to configuration, threat, conditions, operators, and method?

Performance synthesis:
- Where did performance meet, exceed, degrade below, or fail the agreed threshold?
- Which variables and interactions drove the result?
- What trade-offs exist among configurations, threats, measures, and mission outcomes?
- Did operator behavior or procedures materially affect outcomes?
- Which failure boundaries are operationally important?

Analysis-complete gate: analysis is complete only when every decision-relevant finding is reproducible, traceable, uncertainty-bounded, applicability-bounded, and linked to a decision implication or explicit remaining evidence gap.

### 3.12 QtM 08: Decision Evidence & Customer Action (complete question set)

Independent-reviewer test (the evidence package must allow answering): What was observed? How was it established? Under which exact conditions is it true? With what confidence and limitation? What must not be inferred? What decision implication follows?

Architecture and mission assessment:
- Which configuration performed best, against which threat, and under which conditions?
- What trade-offs exist among configurations, measures, cost, complexity, resilience, and mission outcomes?
- Where are coverage, timing, interface, authority, or engagement gaps?
- Which component or interface creates the greatest mission risk?
- Can one component compensate for another's weakness?
- Does the complete mission chain provide sufficient warning, decision time, engagement opportunity, effect, and residual-threat management?

Evidence review and acceptance (record): method and analysis reviewers; configuration-fact review by vendors without control of conclusions; dissenting interpretations and adjudication; required corrections or additional evidence; method acceptance status; evidence acceptance status, conditions, and reservations; formal acceptance record.

Decision analysis: for each viable option (procure, select an alternative, reconfigure, fix, restrict employment, retest, defer, or reject) state: supporting and contradicting evidence; assumptions; operational and technical trade-offs; residual risk; cost and consequence of action, delay, or inaction; additional evidence required. Then state Valkryn's bounded recommendation: recommended action; evidence strength supporting it; conditions and limitations; alternatives considered; residual uncertainty and risk; trigger for reconsideration or retest.

Institutional boundary (operational hook): Valkryn explains, characterizes, and recommends from evidence; authorized organizations retain certification, airworthiness, acquisition, production, deployment, fielding, safety, and operational-employment decisions; final language must not imply authority Valkryn does not possess.

Decision-ready gate (the authorized decision-maker can answer): What do we know? How do we know it? Under what conditions is it true? What remains uncertain? What action does the evidence support? What change would require retest? Who owns the decision and resulting actions?

### 3.13 QtM 09: Closeout, Productization & Regression (complete checklist set)

Campaign closure checklist:
- Deliverables and acceptance: contractual deliverables complete and delivered; customer received the agreed evidence package, data, limitations, exclusions, and open issues; evidence-review and acceptance status documented; actions, owners, funding needs, and completion dates recorded.
- Data and knowledge: raw data, processed data, code, schemas, configurations, methods, and findings archived under the agreed retention policy; access permissions, classification, CUI, proprietary, export, and comparative-result controls reviewed; prohibited or temporary data deleted as required; the analysis can be reproduced and the tested configuration reconstructed.
- Operations and property: equipment, sites, ranges, networks, and work areas restored; safety incidents, near misses, maintenance discrepancies, damage, and lost items closed or transferred to named owners; vendors and partners receive authorized feedback; sensitive and comparative results remain controlled.

After-action review questions:
- What worked, failed, or surprised the team?
- Which assumptions were wrong?
- Where did the campaign lose time, quality, or decision value?
- What required founder or exceptional intervention?
- Which risks or failure modes were not anticipated?
- What should be standardized, automated, trained, redesigned, or never repeated?
- What must change before the next comparable campaign?

Capability productization review questions:
- Reusable method assets: Which decision decompositions, claim structures, hypotheses, measures, thresholds, test cards, threat profiles, acceptance structures, ground-truth methods, analytical methods, and report modules should become standard? Which assets transfer only within this mission class, and which transfer across domains?
- Reusable technical assets: Which adapters, interfaces, schemas, transformations, data-quality checks, dashboards, calculations, and reports should become supported assets? Which temporary integration should be hardened? Which technical debt must be resolved before reuse?
- Standard work and training: Which failure modes, integration risks, range constraints, vendor behaviors, safety patterns, and planning lessons must be encoded? What knowledge exists only in Casey's or a founder's head? What should become TestOS logic, templates, checklists, training, or reference material?
- Product backlog: What should TestOS automate or preserve next? What should RangeOS monitor or control? What should Red Thread be able to vary, replay, or optimize? What must remain human-led? Which product change would most reduce the next campaign's cost, cycle time, staffing, or evidence risk?

Minimum regression scope questions:
- Which dependencies and findings are affected by the change?
- What is the minimum sufficient evidence to restore confidence?
- Which conditions do not require repetition, and why?
- What may be established through analysis or simulation?
- What must remain live?
- How quickly can Valkryn refresh the evidence?
- Which evidence authority determines sufficiency?

Closeout gate: the campaign is closed only when obligations and records are complete, reusable capability has named owners, the evidence baseline is controlled, and future changes can be mapped to a defensible regression scope.

### 3.14 QtM 10: Follow-On Program, Success Metrics & Control Questions (complete question set)

Next decision and evidence gap:
- What is the customer's next consequential decision and deadline?
- Which accepted findings support it?
- What evidence remains missing or stale?
- What failure requires remediation?
- What vendor fix, configuration change, operational change, or new threat requires verification?
- What bounded follow-on evidence would change the next decision?

Evidence-refresh program:
- What recurring software, hardware, configuration, interface, mission-data, procedure, environment, or threat-update cadence exists?
- Can Valkryn maintain the controlled evidence baseline established at closeout?
- Can change classes map to predefined analysis, simulation, limited live regression, or full reevaluation packages?
- Can regression scopes be preplanned and prepriced?
- What customer battle rhythm governs evidence refresh and acceptance?
- Who owns configuration notification, recurring budget, contracting, execution, and acceptance?
- What service level is required from change notice to refreshed evidence?

Account and mission expansion:
- Can the method transfer to another mission, location, program, command, or system architecture?
- Which ontology, claims, measures, adapters, test cards, evidence relationships, and acceptance structures transfer?
- What new integration, authority, threat, or range work is required?
- Will expansion improve product leverage and evaluator trust?
- What customer pull and demonstrated value support the scope?
- Does the opportunity reinforce Valkryn's strategy or create distracting bespoke work?

Success scorecard questions:
- Decision impact: Did the customer make a better or faster decision? Did accepted evidence arrive before the decision deadline? Did it materially reduce decision-critical uncertainty? Did an authorized organization accept, rely on, or act on it? Did it cause an acquisition, configuration, deployment, fielding, remediation, restriction, or rejection action? Did the customer understand the evidence's limitations and remaining risk?
- Evidence quality: Was the campaign safe, legal, and within Valkryn's authority? Were configuration, threat, method, and conditions controlled? Were ground truth and instrumentation credible? Were data complete, traceable, and reproducible? Were conclusions appropriately bounded and independently reviewable? Were important failure boundaries and decision-relevant unknowns resolved?
- Operating leverage: Did the campaign create reusable methods, data assets, technical assets, and product capability? Did it strengthen TestOS, RangeOS, Red Force, or Red Thread? Did it reduce founder dependency and bespoke integration? Will the next comparable campaign require fewer people, days, and custom changes? Did repeat economics and evaluator trust improve?

Follow-on gate: proceed only when the next scope supports a real decision, uses a defensible change-to-evidence logic, has a committed owner and acceptance path, and strengthens rather than erodes Valkryn's operating leverage.

### 3.15 Test-day procedure (Corpus 05, practical method)

1. Pretest briefing: review each test card; practice the knock-it-off and terminate calls.
2. Go/no-go check: weather and range clearance; instrumentation and ground-truth recording; active spectrum authority; test configuration against the frozen baseline. Stop the test if one required item is not ready.
3. Each run: one test director; state the test-card number; end a run only after completion, a knock-it-off call, or a safety abort; record deviations on the card in real time.
4. Post-run check: confirm data capture immediately; make an initial validity decision; open a test incident report for each anomaly before the next run.
5. Close the test day: hot wash; short Data Authentication Group session; classify every run and record the reason; classify all incident reports; update campaign status against the test matrix.

Data-validity rules to publish before testing starts (Corpus 05): define a valid threat presentation; set tolerances for the target profile; require complete ground-truth data; define acceptable configuration changes and interference limits; define detection, track, and defeat results; define no-test conditions; establish a standing decision group (vendor, test conductor, government representative, analyst); classify every run on the same day; do not delete invalid data (flag it and preserve raw data; the authenticated data set is a flagged view of the raw data).

Daily replanning steps (Corpus 05): 1. Add authenticated runs to the status display; link each run to its IDSK or test-matrix cell. 2. Complete the interim analysis; apply sequential-design stop or augment rules; check Bayesian results against the decision question. 3. Identify the largest evidence gaps; select the runs that reduce them most. 4. Build the next test-card set within the approved plan. 5. Record every departure from the plan. Rule of thumb: run order, replication, and factor levels can usually change inside an approved matrix; new conditions or objectives usually require new approval.

## 4. Templates, forms & cards

### 4.1 Standard Test Card (Field Guide 5, verbatim)

```
TEST CARD ID:
VERSION:
CAMPAIGN:
QUESTION ID(S):

CUSTOMER QUESTION:
TEST PURPOSE:
HYPOTHESIS:

SYSTEM CONFIGURATION:
CONFIGURATION BASELINE ID:

THREAT PROFILE:
THREAT PROFILE VERSION:

PRECONDITIONS:

INDEPENDENT VARIABLES:
CONTROLLED VARIABLES:
COVARIATES:

MEASURES:
MEASURE DEFINITIONS:

DATA SOURCES:
GROUND TRUTH:
TIME-SYNCHRONIZATION REQUIREMENT:

PROCEDURE:
1.
2.
3.
...

EXPECTED RESULTS:

PERFORMANCE / DECISION THRESHOLDS:

SAFETY CRITERIA:
ABORT CRITERIA:

DATA-QUALITY CHECKS:

REQUIRED OUTPUTS:

RUN NUMBERS:

DEVIATIONS:

CHANGE RECORD:
- Change ID
- Date/time
- Previous value
- New value
- Evidence/reason
- Responsible owner
```

### 4.2 Complete Notional Counter-UAS Test Card (Field Guide 5, full reproduction)

Source caveat, verbatim: "This is a recommended example, not a reconstruction of the JIATF-401 campaign. Systems, thresholds, configurations, repetitions, and procedures below must not be attributed to that case."

- Test Card ID: `TC-CUAS-SOS-EWBUF-001`. Version: 1.0. Question: `OQ-CUAS-004`.
- Customer question: Does adding an early-warning sensor to the baseline tracking-radar/C2 architecture create materially more usable warning time against the defined threat without degrading track quality or C2 handoff performance?
- Test purpose: characterize the operational value of an additional early-warning layer.
- Hypothesis: Configuration B produces an earlier usable track than Configuration A while maintaining acceptable tracking and interface performance.
- System configuration: A (Baseline): `Tracking sensor → C2`. B (Treatment): `Early-warning sensor → Tracking sensor → C2`. Exact hardware/software versions recorded in `CFG-A` and `CFG-B`.
- Threat profile: `THR-G2-FW-01-v1`. Representative Group 2 fixed-wing surrogate executing the customer-approved profile. Threat geometry, altitude, speed, navigation mode, emissions, and route are locked in the threat-profile object.
- Preconditions: configuration manifests captured; mandatory telemetry available; independent threat ground truth operational; clocks synchronized within approved measurement-error budget; sensor calibration complete; C2 logging enabled; range safety approval active; weather and RF environment captured.
- Variables: Independent: Architecture A/B. Controls: threat profile, route, blue emplacement, blue operator procedure. Covariates: weather, RF environment, target aspect, actual speed/altitude.
- Measures: 1. Usable Warning Time. 2. Detection Probability. 3. Track Position Error. 4. Track Continuity. 5. C2 Handoff Latency. 6. Nuisance/False Track Rate (definitions in section 2.1 of this file).
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

### 4.3 Evidence chain template (Field Guide 3)

For every important question create:
```
Question ID
↓
Hypothesis
↓
Measure
↓
Required data
↓
Ground truth
↓
Test conditions
↓
Comparison method
↓
Decision threshold
↓
Resulting customer action
```
Rule: every run must map to at least one Question ID. No orphan runs.

### 4.4 Daily evidence board (Field Guide 7)

```
Question
Evidence collected
Current finding
Confidence / uncertainty
Remaining gap
Next action
```

Campaign closeout status per operational question: Resolved / Partially resolved / Unresolved, with the reason stated.

### 4.5 Evidence language discipline (Field Guide 7)

Every conclusion receives exactly one category, with source examples:
- Observed fact: "The tracking radar dropped the target for 6.2 seconds during Run 47."
- Analysis: "The loss coincided with sector transition in three of five valid opportunities."
- Inference: "Sector-transition behavior is a plausible contributor to the track loss."
- Recommendation: "Conduct a controlled sector-boundary characterization test."
Do not collapse these into: "The radar has a sector-boundary defect."

Uncertainty documentation fields (Field Guide 7): sample size; run-to-run variability; measurement uncertainty; missing conditions; missing data; invalid runs; confounding factors; degree of operational representativeness.

Finding completeness rule: every finding identifies configuration + condition + evidence + uncertainty + limitation.

### 4.6 Anomaly classification card (Field Guide 6)

Do not immediately call an unexpected result a system failure. Classify:
```
System behavior?
Test infrastructure?
Threat deviation?
Operator action?
Data artifact?
Unknown?
```

### 4.7 Immediate run debrief form (Field Guide 7, within minutes)

1. Was the intended configuration executed?
2. Did the threat execute as planned?
3. Did required data exist?
4. Were there deviations?
5. Is the run valid?
6. Was anything unexpected observed?

### 4.8 Responsibility matrix (Field Guide 1, "May not own" table)

| Function | Primary owner | Deployment Strategist role |
|---|---|---|
| Customer decision | Customer | Supply bounded evidence |
| Software/data integration | FDE | Define what must be integrated and why |
| Adapter/code development | FDE / product engineering | Define requirement and acceptance need |
| Range safety | Range organization | Ensure test design respects constraints |
| Airspace/spectrum execution | Range/customer authority | Incorporate constraints into test design |
| Vendor system configuration | Vendor/customer | Record and control configuration |
| Threat execution | Red team/range | Define required threat conditions |
| Statistical data reduction | Analyst | Ensure analysis answers customer question |
| Formal certification/acceptance | Government authority | Provide supporting evidence |

### 4.9 Decision evidence package contents (QtM 08)

Assemble:
- Decision, alternatives, deadline, and decision-critical uncertainty
- Tested system boundary and configuration baseline
- Mission, threat, environment, operators, procedures, and range representation
- Approved measures, thresholds, experimental design, and acceptance conditions
- Included and excluded runs with deviations
- Finding records and supporting evidence
- Raw-to-result traceability and reproduction instructions
- Uncertainty, limitations, dissent, and unresolved gaps
- Data-delivery, classification, distribution, and retention requirements

### 4.10 Gate statement templates (verbatim)

Qualification gate (QtM 01): see section 3.5. Definition of done (QtM root): "The customer needed to make **this bounded decision**. We aligned **this authority** on the evidence required. We evaluated **this controlled configuration** against **this threat** under **these conditions**, using **this approved method and ground truth**. The evidence supports **these findings** with **these uncertainties and limitations**. The authorized organization can therefore take **this action**. Remaining uncertainty maps to **this follow-on or regression scope**. We captured **these reusable assets** so the next comparable campaign is faster, cheaper, and less bespoke."

Completion criterion, Field Guide 1: the team can state in one paragraph "what is being tested, why, against what, under which configuration, which decision it informs, and what Valkryn does versus what others own."

### 4.11 Product requirement generation template (Field Guide 9)

- Field observation: "Configuration manifests are manually entered before every run."
- Product requirement: "TestOS should automatically ingest and compare configuration state before execution."
- Acceptance test: "TestOS identifies an unauthorized configuration change before the test card enters Ready state."

Loop: field friction → product requirement → engineering change → product verification → improved next campaign.

### 4.12 Reusable TestOS asset taxonomy (Field Guide 9)

- Decision models: operational-question templates; claims/evidence mappings; decision-to-measure mappings.
- Test design: test-card modules; component test patterns; interface tests; system-of-systems scenarios; edge-case libraries.
- Measures: canonical definitions; units; computation rules; uncertainty methods; validity criteria.
- Threat: threat profiles; threat variables; profile validity bounds; threat-representation requirements.
- Data: data contracts; schemas; adapters; ground-truth methods; time-synchronization requirements; run-validity rules.
- Failure knowledge: known failure modes; diagnostic tests; interface weaknesses; regression cases.
- Reporting: findings schema; limitations schema; evaluation templates; campaign comparison structures.

### 4.13 Report templates (Corpus, operational hooks)

- Quick-look report (publish within 24 to 72 hours): use only authenticated runs; mark results preliminary and not final scored results; show test-matrix completion; summarize incidents and schedule effects; link each result to its decision and IDSK cell. No OSD-mandated format exists.
- Report sequence: quick-look report, test report, analysis report, evaluation report.
- Findings report structure: background, method, limits, results, evaluation, recommendations. State limits near the start; pair each limit with a mitigation; separate test adequacy from test outcome; report results by condition with uncertainty; never one overall average. DOT&E Annual Report entry structure: description, mission, adequacy and limits, effectiveness, suitability, survivability, recommendations.
- IDSK (Integrated Decision Support Key): required family of tables linking decisions and dates to evaluation focus areas, then linking each focus area to data sources and test events. Closest DoD analog to a claim–hypothesis–measure traceability matrix. No public template exists.
- Universal Documentation System sequence for government ranges: Program Introduction, Statement of Capability, Program Requirements Document, Program Support Plan, Operations Requirement, Operations Directive.
- Data Management and Analysis Plan: approve before the first flight; must define measures, data elements, formats, quality control, and access rights.
- STAT COE decision-first strategy map, seven elements: 1. mission objectives that support the decision; 2. traceable measures; 3. complete coverage of the test space; 4. sound test designs; 5. controlled test procedures; 6. statistical analysis with standard criteria; 7. reliable decision products.

## 5. Outputs & deliverables

### 5.1 Field Guide required outputs per phase

- Phase 1: decision statement; responsibility matrix; system/configuration boundary; stakeholder map; initial claims-and-unknowns register; campaign objective statement.
- Phase 2: Operational Question Set (`OQ-001...`); Claims Register (`CLM-001...`); Unknowns Register (`UNK-001...`); Assumption Register (`ASM-001...`); initial evidence-gap map.
- Phase 3: evidence matrix; measure dictionary; data requirements matrix; ground-truth plan; decision/acceptance logic; analytical approach.
- Phase 4: test matrix; factor/control definitions; configuration matrix; threat profile set; repetition/statistical strategy; readiness/stop/retest/adaptation criteria.
- Phase 6: run log; configuration snapshot; run-validity status; deviation log; raw-data manifest; initial observation record.
- Phase 7: quick-look; validity/adjudication record; measure results; findings-and-limitations register; evidence-gap register; recommended next test; campaign closeout assessment.
- Phase 8: updated priority queue; change record; new/revised test card; updated evidence-gap matrix.
- Phase 9: reusable-asset package; product requirement set; regression-test additions; failure-mode library updates; new/updated TestOS templates; campaign lessons record.

### 5.2 Questions to Master lifecycle outputs

- FRAME: decision charter, authority map, mission definition, system boundary, configuration baseline, claims, and hypotheses. (02 adds: mission-thread map, claim–hypothesis register, failure-mode model.)
- DESIGN: measures, thresholds, threat model, experiment, evidence chain, range plan, authorities, resources, and contingencies. (03: measure registry, threshold logic, threat and coverage matrix, experimental design, adaptation policy, stop rules. 04: evidence-source plan, measure-to-data map, data model, lineage controls, interface plan, rehearsal acceptance record. 05: range-fit assessment, authority and risk matrix, campaign scope, resource-loaded schedule, command rhythm, contingency plan.)
- EXECUTE & LEARN: readiness decision, run records, validity adjudications, change records, causal diagnoses, and bounded findings. (07: daily evidence review, approved change record, causal diagnosis, finding records, completed-campaign validity assessment.)
- DECIDE: evidence package, claims disposition, architecture assessment, recommendation, acceptance record, and action plan.
- INSTITUTIONALIZE: closure record, reusable assets, product backlog, evidence baseline, regression logic, follow-on program, and success scorecard. (09: closure record, after-action review, productization backlog, evidence baseline, change-impact logic, minimum regression scope. 10: next-decision plan, evidence-refresh program, expansion thesis, three-level success scorecard.)

### 5.3 Data delivery standards (Corpus 04, hooks)

- Deliver telemetry in IRIG 106 Chapter 10 or Chapter 11 files with IRIG-B time stamps; use a GPS-disciplined station clock distributing IRIG-B and Precision Time Protocol; all truth sources on one time base.
- Publish ground truth and tracks as TENA objects for government-integrated events.
- Align post-test pipelines with VAULTIS (data visible, accessible, understandable, linked, trustworthy, interoperable, secure) and CHEETAS-receivable formats.
- Treat test data as CUI at a minimum.
- Closeout submissions: final technical report to DTIC with Standard Form 298 and distribution statement; lessons to the Joint Lessons Learned Information System.

## 6. Workflow & sequencing logic

### 6.1 Master continuity chain (Field Guide mission)

```
Customer need
→ operational question
→ claims and unknowns
→ evidence gaps
→ test design
→ test cards
→ controlled execution
→ data evaluation
→ findings and next steps
→ reusable TestOS capability
```

Traceability thread (Field Guide 1): mission need → test question → test design → evidence → finding → customer action.

### 6.2 Campaign lifecycle (QtM)

FRAME → DESIGN → EXECUTE & LEARN → DECIDE → INSTITUTIONALIZE. Control questions per stage: FRAME: What decision and mission are we supporting? DESIGN: What evidence will resolve the uncertainty, and how will we produce it? EXECUTE & LEARN: Are we generating valid evidence, and what should happen next? DECIDE: What bounded action does the evidence support? INSTITUTIONALIZE: How do we preserve validity and make the next campaign less bespoke?

Gate sequence extracted across pages: Qualification gate (01) → Definition gate (02) → Design approval gate (03) → Technical integration gate (04) → Campaign plan gate (05) → Readiness review and Go/no-go (06) → Execution gate per run (06) → Analysis-complete gate (07) → Decision-ready gate (08) → Closeout gate (09) → Follow-on gate (10).

### 6.3 C-UAS mission thread (QtM 02) and kill chain (Field Guide 4)

```
Threat appears
→ Detection
→ Track initiation
→ Track maintenance and classification
→ C2 ingestion
→ Prioritization
→ Engagement authority
→ Effector assignment
→ Intercept attempt
→ Effect assessment
→ Residual-threat management
```

Field Guide system-of-systems thread: `Threat → detect → track → identify → decide → assign → engage → assess`.

### 6.4 Test level and stress progression (Field Guide 4)

Test levels: Component test (one subsystem, bounded question; examples: radar detection, track accuracy, interceptor seeker acquisition); Interface test (two or more components, handoff behavior; examples: radar → C2, C2 → effector, track ID → engagement authorization); System-of-systems test (complete mission thread).

Stress progression:
```
baseline
→ one-factor characterization
→ interfaces
→ representative mission
→ stressing conditions
→ edge/failure boundary
```
Establish baseline first: run the simplest representative configuration before stressing it.

Edge-case library (Field Guide 4.E): minimum/maximum range; altitude/azimuth boundaries; terrain masking; clutter; track crossing; multiple simultaneous targets; rapid target-state change; low observable or RF-silent behavior; degraded network; delayed C2 messages; sensor dropout; operator saturation; software restart; loss/recovery of subsystem; environmental extremes achievable at the site.

### 6.5 Predefined criteria classes (Field Guide 4.G)

- Readiness: configuration, instrumentation, ground truth, safety, people, data pathways ready.
- Stop: unsafe state, invalid configuration, lost required instrumentation, invalid ground truth, uncontrolled test condition.
- Retest: failure attributable to test infrastructure, ambiguous configuration, corrupted data, or required repeatability check.
- Adapt: valid result exposes a new high-value unknown.

### 6.6 Execution sequence (Field Guide 6)

Preparation: 1. Confirm card/version. 2. Confirm customer question. 3. Freeze intended configuration. 4. Verify participant responsibilities. 5. Verify range/safety constraints. 6. Verify data-path readiness. Then configuration check, calibration, time synchronization (misalignment can appear as position error, track latency, C2 latency, or incorrect engagement sequencing), dry run (validate procedure, communications, telemetry, event tagging, ground truth, operator sequence; "Do not quietly convert a dry run into scored evidence"), then live run.

Live run protocol: Before: the Deployment Strategist states card ID, run ID, configuration, threat profile, and objective. During: monitor adherence, data availability, deviations, and whether the run still answers the question; range personnel retain safety authority. After: immediately assign validity (valid; valid with limitation; invalid; pending adjudication).

### 6.7 Adaptive testing cycle (Field Guide 8)

```
Run tests
→ validate data
→ assess evidence
→ identify gaps
→ revise the plan
→ run the next highest-value test
```
Every adaptation must be traceable to a validated observation or evidence gap and still support the campaign's stated decision. Adaptation policy is defined before execution (fixed versus adaptable card elements, triggers, maximum unapproved change, approval authority per change class; QtM 03).

### 6.8 Day-of-test rhythm

Sequence per run and per day: Pre-Run Gate → live run → immediate run debrief (minutes) → Post-Run Gate → run adjudication → daily evidence review (4 steps, QtM 07) → Daily Closeout Gate → next-day cards versioned. Corpus 05 adds: pretest briefing, go/no-go, one test director, post-run data confirmation and incident reports before the next run, hot wash plus Data Authentication Group session, same-day classification of every run.

### 6.9 Versioning, change control, and validity ordering rules

- Never overwrite a run; never reuse a run number.
- Test-card version changes only when the planned method changes; deviations stay attached to the original card and run; a deviation that becomes intended method requires a new card version before the next execution.
- Never rewrite history; the old test card remains preserved.
- Freeze pass/fail and acceptance criteria before execution unless an approved change is recorded (QtM 03).
- Readiness confirms prior work by baseline identifier and approval record; it does not reopen design unless a deficiency or change requires it (QtM 06).
- A run enters campaign analysis only after adjudication (QtM 06).
- Analyze the data as collected, not as planned; record each deviation as a covariate (Corpus 05).
- Two distinct readiness gates exist in DoD practice: the Test Readiness Review (systems-engineering gate) and certification of readiness for dedicated OT (acquisition gate); different purposes and owners (Corpus 05).
- Keep failure responsibility separate from data validity: validity decided by a standing adjudication body soon after the event; failure responsibility decided by a separate scoring conference against pre-approved Failure Definitions and Scoring Criteria; incident classes include system fault, no-test event, crew error, other (Corpus 05, Army DAG model).

### 6.10 Regression and evidence-life logic (QtM 09/10, Corpus 07)

Evidence carries a validity period and can expire; no DoD-wide expiration rule exists, so the campaign defines it. Change-impact logic maps each change class (section 1.19) to: leaves findings valid; narrows applicability; invalidates specific findings; or requires analysis, simulation, bench test, limited live regression, or full reevaluation. Regression scopes can be preplanned and prepriced; the evidence authority determines sufficiency. Recurring programs run on a change-notice-to-refreshed-evidence service level.

## 7. Worked examples & real data

- Identifier examples (Field Guide 5): `CAMP-CUAS-2026-04`; `OQ-CUAS-017`; `TC-CUAS-TRK-004-v1.2`; `CFG-BLUE-20260818-03`; `THR-G2-FW-LOW-02-v2`; `RUN-0047`.
- Evidence-language example (Field Guide 7): tracking radar dropped the target for 6.2 seconds during Run 47; the loss coincided with sector transition in three of five valid opportunities.
- Complete notional C-UAS test card `TC-CUAS-SOS-EWBUF-001` v1.0 against `OQ-CUAS-004` with threat `THR-G2-FW-01-v1` and configurations `CFG-A`/`CFG-B` (full content in section 4.2). Explicitly not attributable to JIATF-401.
- DOE worked example (Corpus 03, DOT&E software-intensive system example): four replicates were sufficient at 95 percent confidence. Typical confidence targets 80–95 percent. First sequential design limited to 25–40 percent of the test budget.
- JIATF-401 facts (Corpus): established 28 August 2025; replaced the JCO; Army-led; reports to the Deputy Secretary of Defense; approves up to $50 million per initiative; 36-month review can end or change the organization. Adopted the government-wide Standard Guidelines for T&E of C-UAS Technologies on 11 March 2026 (common core data, terms, and schemas; not a military standard; no measures, surrogate fidelity, or evaluation criteria defined). Yuma demonstrations twice per year with the Rapid Capabilities and Critical Technologies Office; government defines the threat presentations; presentations include more than 40 UAS raids, swarms, contested electromagnetic conditions, and UAS Groups 1 through 3. Demonstration 5 (June 2024): nine systems against more than 40 counter-swarm targets. Demonstration 6 (April 2025): contested electromagnetic environment, Group 3 defeat, dismounted systems. Results support rapid buy, try, and decide actions; contract types include Capability as a Service and contractor-owned, government-operated services.
- JIATF-401 C4 (Field Guide): public Common Criteria for C-UAS Characterization; spans Detect, Track, Identify, Target Quality, Defeat, Automation, C2, survivability, usability, and mission impact; uses most-likely and most-dangerous threat cases; requires threat profile, flight profile, mission objective, and electronic signature defined before meaningful comparison; explicitly does not replace established developmental, operational, or safety testing.
- DOT&E 2025 reorganization numbers (Corpus 01): staff reduced from approximately 94 to 45 (30 civilians, 15 military); budget reduced approximately 79 percent; 94 of 251 programs removed from oversight in July 2025 (a 37 percent reduction); approximately 45 staff now oversee approximately 157 programs; IDA FFRDC support ended; Dr. Amy Henninger became the tenth Director, DOT&E, on 23 March 2026.
- Regulatory and scheduling numbers: see section 1.23 lead times. Also: OT plans to DOT&E at least 60 days before test; report of record 45 days before decision; quick-look within 24 to 72 hours; UCA disposition analysis within 1 year after sustainment entry; MRTFB schedule boards quarterly; commercial entities can buy MRTFB time at direct cost under 10 U.S.C. §4175; MIL-STD-882E risk acceptance: Component Acquisition Executive accepts High risk, Portfolio Acquisition Executive accepts Serious risk.
- Policy timeline anchor (Corpus root): DoD T&E policy restructured December 2024 through March 2026 (DoDI 5000.98; DoDM 5000.96/.99/.100/.101/.102/.103; DoDM 5000.100 cancels TEMP Guidebook 3.1; JCIDS ended August 2025). Sources predating December 2024 can be partially or fully obsolete.

## 8. Product implications

1. Record system with the exact ID grammar. The app must create and enforce CAMP, OQ, CLM, UNK, ASM, TC (with -vN.N), CFG, THR (with -vN), RUN, DEV, and CHG identifiers, with immutable runs (no overwrite, no reuse) and card versioning that triggers only on planned-method change.
2. Traceability graph as the core data model. Every run must link to at least one OQ ("no orphan runs"); the chain claim → hypothesis → measure → required data → ground truth → conditions → comparison → threshold → customer action must be navigable in both directions, and the app should flag any broken link (the nine-questions standard and ten control questions are effectively a live traceability health check the app can render as a dashboard).
3. Test-card builder and print/tablet layout from the Standard Test Card template (section 4.1), pre-seeded with the notional card TC-CUAS-SOS-EWBUF-001 as a fixture, including abort criteria on the card, per-run deviation capture (DEV-###), and the embedded change-record block.
4. Gate-driven workflow with the four Field Guide checklists (Pre-Campaign, Pre-Run, Post-Run, Daily Closeout) as blocking dynamic checklists, plus the eleven QtM lifecycle gates as phase transitions. Pre-Run must verify card version, run ID, configuration, threat profile, sync, calibration, and abort-criteria acknowledgment before a run can start.
5. Run adjudication and validity engine: enum states (valid / valid with limitation or conditionally valid / invalid / pending adjudication), same-day classification, flag-not-delete invalid data, authenticated data set as a flagged view, and separation of validity from failure responsibility.
6. Measure registry with computable definitions: implement the six notional-card measures (Usable Warning Time, Detection Probability, Track Position Error, Track Continuity, C2 Handoff Latency, Nuisance/False Track Rate) as built-in calculations over telemetry plus ground truth, each carrying the full registry metadata of section 1.6 including numerator/denominator, start/stop events, and missing-data rules.
7. Threshold discipline enforcement: a threshold field must record one of the six legitimate origins; absent a customer-approved threshold the app must suppress pass/fail rendering and produce characterization output (estimate, interval, variability, trades, validity limits) instead.
8. Adaptive replanning module: priority queue scored by the Field Guide formula (importance × uncertainty reduction × likelihood ÷ burden, H/M/L), the eight next-event action types, the change-record form, and the daily evidence board (question / evidence / finding / confidence / gap / next action).
9. Debrief generator implementing the immediate run debrief (six questions), the four-category evidence-language discipline (observed fact / analysis / inference / recommendation) as structured fields, the uncertainty checklist, and campaign closeout status per OQ (resolved / partially / unresolved).
10. Deliverable exports: quick-look (24 to 72 hour, authenticated-runs-only, preliminary watermark, matrix-completion view), decision evidence package (section 4.9 contents), findings report (limits first, adequacy separate from outcome, by-condition results with intervals), claims disposition board (six-state enum), and the three-level success scorecard.
11. Reuse and regression layer: reusable-asset records with the 14-field metadata block, evidence baseline with validity period and expiration tags, change-class-to-regression-scope rules, and the productization metrics counters. This is where each campaign compounds.
12. C-UAS threat-and-conditions matrix builder: rows as threat presentations (UAS group, guidance mode including remote control / waypoint / EO terminal / RF-silent / fiber, speed, altitude, raid size, countermeasure resistance), columns as conditions (EM environment, clutter, day/night, ROE), each cell a design point with fidelity and exclusion tracking; response layers sensing / C2 / defeat / suitability. Emit JIATF-401-schema-compatible data natively (the Gap Map names this as the product wedge).
13. Statistical sizing helper: repetition from confidence/precision and variability (never a default three), power for the whole design, 80–95 percent confidence targets, sequential-design budget guardrail (25–40 percent first stage), and interval-type selection (confidence / tolerance / prediction).
14. Schedule planner seeded with the lead-time constants of section 1.23 so authority and approval items (airspace, spectrum, GPS-denial, safety release, range booking) appear on the critical path with latest viable dates.

[AMBIGUOUS: the "Questions to Master" lifecycle pages (01–10) overlap in subject with manual sections owned by agents 1–6, but they are distinct pages with distinct content (question sets rather than procedures); both were extracted per each agent's own assignment, so the compiler should expect intentional overlap, not duplication error.]
