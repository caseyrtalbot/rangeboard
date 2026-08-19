# 00 Roles, Authority, Records & Configuration Control + 01 Engagement Qualification, Discovery & Mission Definition

## Sources fetched

- "00 — Roles, Authority, Records & Configuration Control" — https://app.notion.com/p/628564afc2b24d35b1a6831ca2632d96
- "01 — Engagement Qualification, Discovery & Mission Definition" — https://app.notion.com/p/edd1fae9d7264cd3a44904a507e3c766

No sub-pages are linked inside either page. Parent pages (manual root, VALKRYN root) are out of scope per the page map.

## 1. Input variables & fields

### 1.1 Campaign role assignments (page 00)

For every role, the user must name a **primary** and a **backup** person. Roles (fixed list):

1. Customer decision owner
2. Evidence-acceptance authority
3. Campaign lead / deployment strategist
4. Test conductor
5. Range safety authority
6. Range, airspace, and spectrum authorities
7. System owner and vendor lead
8. Red or threat lead
9. Data lead
10. Analysis lead
11. Security and data custodian
12. Logistics and site lead

Role responsibility text (needed for in-app role descriptions/tooltips):

- **Customer decision owner:** states the decision, alternatives, deadline, and acceptable residual uncertainty; commits customer systems, people, data, review time, and funding; accepts or rejects the final decision implication.
- **Evidence-acceptance authority:** approves the method, measures, thresholds, repetition, witnessing, review, and delivery requirements; states what would make the evidence unusable; records method acceptance and final evidence acceptance.
- **Campaign lead / deployment strategist:** controls scope, evidence logic, design intent, records, run priority, validity, findings, and customer alignment; maintains the decision log and escalates unresolved conflicts.
- **Test conductor:** controls the run sequence and test-net calls; executes the current signed card; maintains the time-ordered run log; stops, pauses, or holds under the card and range rules.
- **Range safety authority:** owns the safety envelope, hazards, emergency procedures, and residual-risk decision assigned by the range; has unilateral safety-stop authority; defines restart conditions after a safety stop.
- **Range, airspace, and spectrum authorities:** approve access and operating limits; monitor compliance; stop activity outside the approved limits.
- **System owner and vendor lead:** release the exact configuration; provide limits, known defects, support, and configuration truth; correct technical faults; do NOT control test design or run-validity decisions.
- **Red or threat lead:** executes the approved threat profile; controls only the variables assigned to red; preserves blinding; records every actual profile.
- **Data lead:** operates the evidence chain; verifies source health, synchronization, completeness, backup, access, and lineage; produces the data-quality status for run adjudication.
- **Analysis lead:** controls approved calculations and analytical versions; reports uncertainty, exclusions, sensitivity, and alternative explanations; reproduces findings from retained evidence.
- **Security and data custodian:** controls classification, CUI, proprietary data, export limits, access, transfer, retention, and deletion.
- **Logistics and site lead:** controls delivery, access, power, networking, spares, consumables, maintenance, storage, transport, lodging, and recovery support.

Deployment strategist authority scope (drives permission model / role card):

Owns: decision and question traceability; evidence-planning quality; test design intent and run priority; test-card content and version control; configuration, threat, condition, method, and data traceability; run-validity adjudication (with data lead and test conductor); controlled adaptation between runs; finding quality, limits, and recommendation logic; customer review and evidence-acceptance coordination; campaign closeout and reuse harvest.

May: hold a run when evidence controls are not ready; declare that a run cannot support a stated measure or finding; require a repeat when an approved validity rule fails; reject an unapproved configuration or method change; re-rank the run list under the approved adaptation policy; escalate schedule, cost, safety, legal, security, or acceptance conflicts.

May NOT: override a safety, range, airspace, spectrum, security, or legal stop; approve an engineering configuration that the system owner has not released; accept residual safety risk for an authority that has not delegated it; certify, field, acquire, or deploy a system for the customer; change contract scope or data rights without the authorized owner; present a hypothesis as a confirmed cause.

### 1.2 Authority-matrix row fields (page 00)

For every decision type, record:

| Field | Notes |
|---|---|
| Decision name | text |
| Accountable authority | person/role; exactly one per decision (hard rule) |
| Person who performs the work | person/role |
| Required reviewers | list of persons/roles |
| People who must receive notice | list |
| Trigger and required response time | text + duration |
| Evidence required for approval | text |
| Escalation path | text/role chain |
| Backup authority | person/role |

Minimum decision-type list the matrix must cover (17 enum values):

1. Scope approval
2. Method and threshold approval
3. Configuration release and freeze
4. Range, airspace, spectrum, safety, security, and legal approval
5. Daily go/no-go
6. Run initiation, pause, abort, and restart
7. Data-quality stop
8. Equipment stop
9. Degraded-operation acceptance
10. Run-validity adjudication
11. Test-card revision
12. Run-list revision
13. Cost or schedule change
14. Evidence-sufficiency and futility stop
15. Finding approval
16. Evidence acceptance
17. Customer action

Constraint: no decision may have two accountable authorities; resolve overlap before execution.

### 1.3 Controlled-record header fields (page 00)

Every controlled record must show:

| Field | Type |
|---|---|
| Identifier | per identifier pattern (section 4.2) |
| Title | text |
| Version | v\<major\>.\<minor\> |
| Status | enum: Draft, In review, Approved, Issued, Superseded, Withdrawn, Closed |
| Owner | person |
| Approver | person |
| Effective date and time | datetime |
| Superseded version | version reference |
| Change summary | text |
| Related identifiers | links to campaign, configuration (CFG), card (TC), run (RUN), and finding (FIND) identifiers |

Record-state enum definitions:

- **Draft:** work may change without formal approval.
- **In review:** named reviewers are checking the record.
- **Approved:** the accountable authority accepts the record.
- **Issued:** the approved version is released for use.
- **Superseded:** a newer issued version replaces it.
- **Withdrawn:** the owner removed it from use.
- **Closed:** all required actions are complete.

### 1.4 Configuration item fields (page 00)

For each configuration item, record: hardware model, serial number, firmware, software, model, mission data, feature flags, thresholds, calibration, interfaces, network settings, security settings, operator procedure, and training state. Also record: known defects, waivers, temporary fixes, and vendor modifications. Assign a baseline identifier (CFG). Optional attachments: machine-readable settings export; photograph/record of physical settings when export is not possible.

### 1.5 Deviation record fields (page 00)

- Time of occurrence.
- Observed difference (approved plan vs. what occurred).
- Affected control, measure, or validity rule.
- Effect classification — enum: none, bounded, material, unknown.
- Assigned run status.
- Disposition — enum: repeat, analyze with limits, exclude.

### 1.6 Change record fields (page 00)

- Evidence gap, constraint, defect, or risk that requires the change.
- Options list, including "no change".
- Variables changed and variables held constant.
- Effect assessment across: safety, schedule, cost, data, comparability, acceptance, and conclusion effects.
- Required approvals obtained.
- New record versions issued.
- Traceability and run-list updates.
- Brief-before-use confirmation for affected people.

Record-type separation rule: a **deviation** (plan vs. occurred difference), an **anomaly** (unexpected observation requiring triage or diagnosis), and a **change** (approved revision to future work) are three distinct record types (DEV, ANOM, CHG). Do not use one record for all three.

### 1.7 Request registration fields (page 01, Step 1)

Record within the first working session:

- Requesting organization and sponsor.
- Exact request and date received.
- Requested decision date.
- Proposed systems, sites, events, and deliverables.
- Known contract, budget, security, data, range, and schedule limits.
- Source documents and prior evidence.
- Immediate actions that could create commitment or cost.
- Campaign candidate identifier (assigned).

Rules at intake: do not promise an evaluation outcome or range date.

### 1.8 Decision charter fields (page 01, Step 2)

Fill-in-the-blank statement (template in section 4.3) with fields:

- Decision date (deadline).
- Authorized decision owner.
- Bounded choice.
- Alternatives, including delay or no action.
- Blocking/weakening uncertainty.
- Acceptance conditions for the evidence to matter.

Supporting question answers (each a field):

- What action will occur after the test?
- Who has legal, fiscal, operational, or acquisition authority for that action?
- What happens if no action occurs?
- What result would change the current choice?
- What result would not change it?
- What deadline makes the evidence useful?
- What is the latest date for accepted evidence, not only raw results?
- Can the customer accept unfavorable, mixed, or inconclusive evidence?

Validation rule: reject vague statements such as "see how it performs"; replace with a bounded decision and uncertainty.

### 1.9 Engagement classification fields (page 01, Step 3)

- Engagement type — enum with definitions:
  - **Demonstration:** shows a capability under selected conditions; does not support broad performance claims.
  - **Experiment:** explores cause, sensitivity, or an unknown boundary.
  - **Characterization:** measures behavior across stated conditions without a simple pass/fail result.
  - **Comparison:** uses common conditions and measures to compare alternatives.
  - **Evaluation:** produces evidence against approved mission needs, thresholds, and acceptance conditions.
- Valkryn tasking — enum: recommend, characterize, validate, compare, support an authority. Constraint: do not use "certify" or "authorize" unless Valkryn holds that authority.

### 1.10 Acceptance-path fields (page 01, Step 4)

- Organization that must rely on the evidence.
- Method approval authority.
- Required witnesses and reviewers.
- Required measures and thresholds.
- Required repetitions, confidence, and independence.
- Required range or threat fidelity.
- Required data, format, classification, and delivery method.
- Review periods and correction cycles.
- Conditions that would cause rejection.
- Person who records method acceptance.
- Person who records final evidence acceptance.

Gate rule: do not complete design before the relying organization accepts the proposed evidence standard.

### 1.11 Customer commitment fields (page 01, Step 5)

Commitment items (each with owner, due date, and consequence of failure):

- Sponsor and decision owner participation.
- Contract and funding path.
- Systems and exact configurations.
- Operators and supporting organizations.
- Vendor support.
- Threat systems or accepted surrogates.
- Range, airspace, spectrum, and security coordination.
- Data access and review time.
- Acceptance reviewers before and after execution.

### 1.12 Mission-thread transition fields (page 01, Step 7)

At each transition of the mission thread, record:

- Source and destination.
- Data or physical effect passed.
- Required accuracy, quality, and latency.
- Human or automated decision.
- Authority.
- Failure mode.
- Observable diagnostic data.
- Mission consequence.

Rule: a campaign that tests one component must still state the mission-thread assumptions outside the test boundary.

### 1.13 System-boundary fields (page 01, Step 8)

- Object scope — enum: component, subsystem, platform, integrated architecture, complete mission capability.
- Items inside the evaluated boundary.
- Supporting systems included in the configuration.
- Operators, procedures, and training included.
- External services and dependencies.
- Items excluded.
- Assumptions about excluded items.
- Interfaces that must be controlled or observed.
- Claims that the chosen boundary can and cannot support.
- Boundary diagram, with an identifier on every interface.

### 1.14 Initial configuration baseline fields (page 01, Step 9)

Record the planned: hardware, software, firmware, algorithms, models, mission data, sensors, C2, effectors, interfaces, settings, security state, operators, procedures, and training state.

Per-item status — enum:

- Confirmed and available.
- Expected but not verified.
- Planned change before test.
- Customer-furnished.
- Vendor-controlled.
- Unavailable or unresolved.

Rule: do not call the system test-ready at this stage; this baseline defines what must be verified later.

### 1.15 Claim register fields (page 01, Step 10) — record type CLM

- Claim identifier and exact wording.
- Source and date.
- Claimed conditions.
- Mission and decision relevance.
- Existing supporting evidence.
- Conflicts or assumptions.
- Testability in this campaign.
- Owner for final disposition.

### 1.16 Unknown register fields (page 01, Step 10)

- What is not known.
- Why it matters.
- Current belief and basis.
- Evidence that could resolve it.
- Cost of remaining uncertain.
- Best source — enum: live test, bench test, simulation, analysis, prior evidence, another authority.
- Rank (see section 2.1).

### 1.17 Failure-mode model fields (page 01, Step 11)

Failure category — enum (10 values):

1. Component function.
2. Interface and message handling.
3. Configuration.
4. Operator action and workload.
5. Threat representation.
6. Environment.
7. Instrumentation and ground truth.
8. Data processing.
9. Test method.
10. Authority or schedule.

Per failure mode, record: cause, effect, detectability, mission consequence, recovery, diagnostic evidence, planned control, and campaign treatment — enum: prevent, monitor, induce, accept.

### 1.18 Feasibility screen fields (page 01, Step 12)

Score each item — enum: feasible, feasible with mitigation, unresolved, infeasible. Items (12):

1. Representative systems and operators.
2. Threat or accepted surrogate.
3. Required conditions.
4. Range and schedule.
5. Safety, airspace, spectrum, legal, and security authority.
6. Independent ground truth.
7. Data access, rights, storage, and delivery.
8. Integration and rehearsal time.
9. Required repetitions.
10. Evidence-acceptance path.
11. Valkryn capability and staffing.
12. Customer commitment and contract path.

For every unresolved item, record: owner, due date, fallback, and effect on conclusions.

### 1.19 Communications channels (page 00)

Fixed channel list to maintain (could be a setup checklist or a config record):

- Command channel for approvals and escalation.
- Test net for run control.
- Safety net or independent stop path.
- Technical-support channel.
- Data-status channel.
- Customer update channel.
- Controlled record for decisions and deviations.

## 2. Calculations & formulas

No numeric formulas found in these two pages. Two qualitative ranking/scoring methods exist:

### 2.1 Unknown ranking (page 01, Step 10)

Rank unknowns by four criteria: **decision impact, urgency, evidence cost, and ability to resolve.** No weights or numeric scale are given in the source. [AMBIGUOUS: no scale or weighting defined; app must choose an ordinal scale or manual rank ordering.]

### 2.2 Feasibility scoring (page 01, Step 12)

Ordinal score per item: feasible / feasible with mitigation / unresolved / infeasible. No aggregate score is defined; the gate is qualitative (see section 6.7).

### 2.3 Deviation effect classification (page 00)

Ordinal classification of a deviation's effect: none / bounded / material / unknown. Drives the run disposition decision (repeat, analyze with limits, exclude).

## 3. Checklists

### 3.1 Configuration control procedure (page 00) — run by deployment strategist with system owner

1. Define the configuration item list.
2. Record hardware model, serial number, firmware, software, model, mission data, feature flags, thresholds, calibration, interfaces, network settings, security settings, operator procedure, and training state.
3. Export machine-readable settings where the system supports it.
4. Photograph or record physical settings when an export is not possible.
5. Record known defects, waivers, temporary fixes, and vendor modifications.
6. Assign the baseline identifier.
7. Complete functional checkout.
8. Obtain system-owner release.
9. Freeze the baseline before the first dependent run.
10. Verify the baseline before each run by export, checksum, screen capture, or signed check.
11. Record every observed drift.
12. Link every run to the active baseline.
13. Preserve all superseded baselines.

Conditional rule: a configuration change requires a new baseline when it can affect behavior, data, safety, comparability, or applicability.

### 3.2 Deviation process (page 00) — run at time of deviation, during execution

1. Make the activity safe.
2. Record the time and observed difference.
3. Preserve the system and data state.
4. Identify the affected control, measure, or validity rule.
5. Classify the effect as none, bounded, material, or unknown.
6. Assign the run status.
7. Decide whether to repeat, analyze with limits, or exclude.

### 3.3 Change process (page 00) — run before any revision to future work

1. State the evidence gap, constraint, defect, or risk that requires change.
2. List options, including no change.
3. State variables changed and held constant.
4. Assess safety, schedule, cost, data, comparability, acceptance, and conclusion effects.
5. Obtain the required approvals.
6. Issue new record versions.
7. Update traceability and the run list.
8. Brief affected people before use.

### 3.4 Structured discovery order (page 01, Step 6) — run by deployment strategist with decision owner, mission owner, operators, system owner, analysts, and evidence authority present when possible

1. Restate the decision.
2. Define the mission outcome.
3. Walk the mission thread.
4. Identify systems, interfaces, and authorities.
5. Collect claims and prior evidence.
6. Surface failures, edge cases, and unknowns.
7. Define operating conditions and threats.
8. Confirm constraints and acceptance needs.
9. Rank the questions.
10. Read back the result and correct it in the room.

### 3.5 Discovery question list (page 01, Step 6) — verbatim

- Who performs what task, for what protected asset or mission effect?
- Against which threats and behaviors?
- Where and under which weather, terrain, clutter, electromagnetic, communications, workload, and degraded conditions?
- What must occur before and after the system acts?
- What information crosses each interface?
- Who decides at each transition?
- What timing budget exists?
- What has failed before?
- What do operators do differently from the written procedure?
- What vendor claims lack trusted evidence?
- What assumption would make the concept fail if false?
- What rare failure has severe mission consequence?
- Which single unknown prevents a decision today?

### 3.6 Control gate checklist (page 00) — end of phase 00; deployment strategist

Proceed only when:

- Every decision type has one accountable authority.
- Every controlled record has an owner.
- The configuration process can reconstruct each run.
- All participants know the stop, restart, change, and escalation paths.

### 3.7 Qualification gate checklist (page 01) — end of phase 01; deployment strategist

Proceed only when the team can state (fill-in statement, section 4.4):

- The specific decision and its date.
- The organization that will accept evidence, and its conditions.
- The uncertainty the campaign can reduce.
- That the mission, evaluated boundary, customer commitment, authority path, and execution conditions are sufficiently feasible to begin detailed evidence planning.

## 4. Templates, forms & cards

### 4.1 Authority matrix (page 00)

A table: one row per decision type (17 minimum rows, section 1.2), columns = the 9 row fields in section 1.2. Constraint enforced at the form level: exactly one accountable authority per row.

### 4.2 Identifier pattern (page 00)

```
VLK-<campaign>-<record type>-<sequence>-v<major>.<minor>
```

Examples (verbatim):

```
VLK-ALPHA-TC-014-v1.2
VLK-ALPHA-RUN-037
VLK-ALPHA-CFG-003-v2.0
VLK-ALPHA-FIND-008-v1.0
```

Versioning rules:

- A **major** version changes decision logic, variables, measures, thresholds, configurations, procedures, validity, or applicability.
- A **minor** version improves clarity without changing meaning or execution.
- A run identifier never changes.
- An invalid run remains in sequence (no renumbering).
- Note: RUN identifiers carry no version suffix in the examples.
- Raw files include campaign, card, run, source, and creation time in the name or metadata.
- Authoritative files live in the controlled campaign repository; chats and email are not the system of record.

### 4.3 Decision charter statement template (page 01, Step 2) — verbatim

> By **[date]**, **[authorized decision owner]** must decide **[bounded choice]** among **[alternatives, including delay or no action]**. The decision is blocked or weakened by **[uncertainty]**. Evidence will matter only if **[acceptance conditions]** are met.

### 4.4 Qualification gate statement template (page 01) — verbatim

> The customer must make **this decision** by **this date**. **This organization** will accept evidence that meets **these conditions**. The campaign can reduce **this uncertainty**. The mission, evaluated boundary, customer commitment, authority path, and execution conditions are sufficiently feasible to begin detailed evidence planning.

### 4.5 C-UAS mission-thread template (page 01, Step 7) — verbatim sequence

```
Threat presentation
→ Detection
→ Track initiation
→ Track maintenance
→ Classification or identification
→ C2 ingestion and correlation
→ Prioritization
→ Engagement decision and authority
→ Effector assignment
→ Intercept or effect
→ Effect assessment
→ Residual-threat action
```

Each arrow (transition) carries the 8 fields in section 1.12. This is the minimum thread for counter-UAS; a campaign may extend it.

### 4.6 Controlled-record header (page 00)

Standard header block for every controlled record: the 10 fields in section 1.3. This should render on every record form and every printed/exported record.

### 4.7 Register forms

Row-per-item register tables, each with the field sets defined in section 1: claim register (1.15), unknown register (1.16), failure-mode model (1.17), feasibility and constraint register (1.18), customer commitment record (1.11), stakeholder and acceptance register (1.10).

## 5. Outputs & deliverables

### Phase 00 outputs (page 00)

- Authority matrix (all decision types covered, single accountable authority each).
- Role roster with primary and backup per role.
- Controlled-record system: states, headers, identifier scheme in force.
- Configuration baselines (CFG records) with system-owner release and freeze.
- Deviation, anomaly, and change records (DEV, ANOM, CHG) as they occur.
- Decision log (maintained by campaign lead).
- Time-ordered run log (maintained by test conductor).
- Data-quality status per run (produced by data lead, feeds run adjudication).

### Phase 01 outputs (page 01, "Required outputs" — verbatim list)

- Decision charter.
- Engagement classification and authority-boundary statement.
- Stakeholder and acceptance register.
- Customer commitment record.
- Mission definition and mission-thread map.
- System-boundary definition.
- Initial configuration baseline.
- Ranked operational and technical question set.
- Claim and unknown register.
- Failure-mode model.
- Feasibility and constraint register.
- Initial scope, schedule, cost, and risk estimate.

## 6. Workflow & sequencing logic

### 6.1 Phase 01 step sequence (strict order)

Entry condition → Step 1 Register the request → Step 2 Identify the decision → Step 3 Classify the engagement → Step 4 Establish the acceptance path → Step 5 Confirm customer commitment → Step 6 Structured discovery → Step 7 Map the mission thread → Step 8 Define the system boundary → Step 9 Initial configuration baseline → Step 10 Claim and unknown register → Step 11 Failure-mode model → Step 12 Feasibility screen → Qualification gate.

Entry condition: begin with the customer request in the customer's own words. Do NOT begin with an available range event, vendor demonstration, preferred product, or prebuilt test card.

### 6.2 Hard ordering gates

- Register the request within the first working session (Step 1 timing rule).
- Do not promise an evaluation outcome or range date at intake.
- Do not complete design before the relying organization accepts the proposed evidence standard (Step 4 gate).
- Do not call the system test-ready at the initial-baseline stage (Step 9).
- Freeze the configuration baseline before the first dependent run; verify the baseline before each run (page 00, steps 9-10 of configuration control).
- Resolve any dual-accountability overlap in the authority matrix before execution.
- Proceed past phase 00 only when the control gate (section 3.6) passes; past phase 01 only when the qualification gate (section 3.7) passes.

### 6.3 Controlled-record state machine

Draft → In review → Approved → Issued → (Superseded | Withdrawn) ; Closed when all required actions are complete. Major vs. minor version rules per section 4.2.

### 6.4 Deviation / anomaly / change routing

Three separate record flows (sections 3.2, 3.3; anomaly = triage/diagnosis record). A deviation's effect classification drives run status and disposition (repeat / analyze with limits / exclude). A change issues new record versions, updates traceability and the run list, and requires briefing affected people before use.

### 6.5 Battle rhythm (page 00) — meeting cadence

- Weekly campaign control review before deployment.
- Daily planning brief during deployment.
- Formal day-start go/no-go.
- Short pre-run brief for every run.
- Immediate factual post-run debrief.
- End-of-day validity and evidence board.
- Final method, finding, and acceptance reviews.

### 6.6 Stop/hold authority hooks (operational one-liners)

- Range safety authority: unilateral safety stop; defines restart conditions.
- Range/airspace/spectrum authorities: stop activity outside approved limits.
- Deployment strategist: hold a run when evidence controls are not ready; require a repeat when an approved validity rule fails; reject unapproved configuration or method changes.
- Safety/range/airspace/spectrum/security/legal stops cannot be overridden by the deployment strategist.

### 6.7 Feasibility screen disposition

Every "unresolved" item needs owner, due date, fallback, and effect on conclusions before the qualification gate can pass. [AMBIGUOUS: the source does not state whether an "infeasible" score is an automatic gate failure; it implies but does not say so.]

## 7. Worked examples & real data

Identifier examples (verbatim, page 00):

```
VLK-ALPHA-TC-014-v1.2
VLK-ALPHA-RUN-037
VLK-ALPHA-CFG-003-v2.0
VLK-ALPHA-FIND-008-v1.0
```

These imply a campaign named "ALPHA" and record types TC (test card), RUN, CFG (configuration baseline), FIND (finding). No other real numeric data, JIATF-401 data, or worked examples appear in these two pages.

## 8. Product implications

1. **Campaign entity with role roster.** The app needs a Campaign record that holds the 12 fixed roles, each with primary and backup person fields, plus the deployment strategist authority card (owns / may / may-not lists) as reference UI.
2. **Authority matrix builder.** A table editor pre-seeded with the 17 decision types and 9 columns, with validation that blocks two accountable authorities on one decision and blocks phase progression while any decision type is unassigned.
3. **Controlled-record engine.** Every major artifact (test card, config baseline, finding, etc.) needs the shared header (id, version, status, owner, approver, effective datetime, superseded version, change summary, related-id links), the 7-state lifecycle, and major/minor version semantics. Run records are immutable-id, never renumbered, and versionless.
4. **Identifier generator.** Auto-generate `VLK-<campaign>-<type>-<sequence>-v<major>.<minor>` identifiers with per-type sequences; keep invalid runs in sequence.
5. **Configuration baseline module.** CFG records with the full item field set, per-run baseline verification checklist, drift log, run-to-baseline linking, and "new baseline required" prompt when a change can affect behavior, data, safety, comparability, or applicability.
6. **Deviation / anomaly / change as three record types** (DEV, ANOM, CHG) with the guided step flows of sections 3.2-3.3 and the effect-classification → run-disposition logic.
7. **Phase 01 wizard.** A 12-step guided intake (register request → feasibility screen) producing the 12 required outputs, with the decision-charter and qualification-gate fill-in templates rendered as forms, and hard gates that block later steps (e.g., design work) until the acceptance path is recorded.
8. **Registers as first-class tables.** Claim register, unknown register (with 4-criteria ranking), failure-mode model (10 categories, prevent/monitor/induce/accept treatment), feasibility screen (12 items, 4-level score, unresolved-item disposition fields), customer commitment record, stakeholder/acceptance register.
9. **Mission-thread editor.** The 12-node C-UAS kill chain as a default template; each transition edge carries the 8 transition fields; supports component-scope campaigns stating out-of-boundary assumptions. This maps naturally onto RangeBoard's existing kill-chain canvas.
10. **Gate checklists.** Control gate (phase 00) and qualification gate (phase 01) as blocking checklists before evidence planning (phase 02) unlocks.
11. **Battle-rhythm scaffolding.** The 7 meeting types and 7 communication channels as day-of-test rhythm anchors for later phases (go/no-go, pre-run brief, post-run debrief, end-of-day evidence board).
