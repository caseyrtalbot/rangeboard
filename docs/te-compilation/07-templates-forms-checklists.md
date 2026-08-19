# 07 — Field Templates, Forms & Checklists

## Sources fetched

- "07 — Field Templates, Forms & Checklists" — https://app.notion.com/p/b41400f6b11943b8be7d9ffaad44c74c
  (Parent: "Valkryn Deployment Strategist Manual — End-to-End Test & Evaluation Operations". The page contains no sub-page links. It is self-contained.)

## Page-level usage rules (apply to every template below)

- Purpose statement on the page: "Provide copy-ready records for campaign control. Replace bracketed prompts. Mark any unused field 'not applicable' and state why."
- Callout rule: "The approved plan and current test card always control execution. A checklist confirms the control. It does not replace it."
- The page color-codes its templates by phase: blue = planning/records, orange = execution, green = closeout/evidence. Order of appearance on the page is preserved below.

## 1. Input variables & fields

Every input field on this page belongs to a named template, form, card, or record. The complete field lists, verbatim and in source order, are reproduced in Section 4 (templates, forms, cards) and Section 3 (checklists). Field inventory index:

| # | Record / form | Phase color | Field or item count |
|---|---|---|---|
| 1 | Campaign charter | blue | 29 fields |
| 2 | Authority and decision-rights record | blue | 12 fields, repeated across 22 decision types |
| 3 | Decision–question–evidence traceability record | blue | 17 fields |
| 4 | Measure definition record | blue | 31 fields |
| 5 | Configuration baseline record | blue | 28 fields |
| 6 | Threat and condition record | blue | 29 fields |
| 7 | Test card | orange | 17 numbered sections |
| 8 | Test readiness review checklist | orange | 24 items |
| 9 | Day-start checklist | orange | 22 items |
| 10 | Pre-run release checklist | orange | 17 items |
| 11 | Run record and immediate debrief | orange | 29 fields |
| 12 | Deviation record | orange | 13 fields |
| 13 | Anomaly record | orange | 14 fields |
| 14 | Change record | orange | 14 fields |
| 15 | Daily evidence review | blue | 14 ordered items |
| 16 | Finding record | green | 26 fields |
| 17 | Decision evidence package checklist | green | 18 items |
| 18 | Closeout and regression checklist | green | 18 items |
| 19 | Pocket rules | — | 11 gating rules |

Data types are not stated in the source; all fields are free-text prompts unless an enum is given. Explicit enums found on this page:

- Run record "Final status": `valid | conditionally valid | invalid | pending`
- Daily evidence review run accounting states: `attempted | valid | conditional | invalid | pending`
- Daily evidence review data states: `complete | missing | conflicting | quarantined`
- Finding record "Strength": `conclusive | directional | insufficient | not tested`
- Test readiness review outcome: `go | conditional go | hold | no-go`
- Threat representation type (Threat and condition record): `actual threat | surrogate | generic representation`
- Daily go/no-go (Day-start checklist): `go | no-go` [AMBIGUOUS: source says only "Daily go/no-go recorded"; conditional-go option not stated for the daily gate]

Record ID fields present (naming scheme implied by the parent manual): Campaign ID, Decision ID, Question ID, Claim or unknown ID, Hypothesis ID, Measure ID, Configuration ID, Threat ID, Condition ID, Card ID, Run ID, Deviation ID, Anomaly ID, Change ID, Finding ID.

## 2. Calculations & formulas

None found.

(The Measure definition record captures calculation metadata as fields — Exact definition, Unit, Numerator, Denominator, Calculation method, Code or analytical version, Measurement uncertainty — but this page defines no formula itself.)

## 3. Checklists

All items verbatim, in source order. Who runs each checklist is not named on this page except where an item names a role. [AMBIGUOUS: roles per checklist are defined elsewhere in the manual, likely pages 00 and 04.]

### 3.1 Test readiness review checklist (phase: readiness gate, before execution)

- [ ] Decision charter is approved.
- [ ] Evidence-acceptance conditions are approved.
- [ ] Mission, system boundary, and configuration are controlled.
- [ ] P1 questions, hypotheses, measures, and thresholds are approved.
- [ ] Threats, conditions, fidelity gaps, and generalization limits are approved.
- [ ] Test matrix, repetition, order, and comparison logic are approved.
- [ ] Stop, repeat, adaptation, sufficiency, and futility rules are approved.
- [ ] Range, airspace, spectrum, safety, security, legal, and system approvals are active.
- [ ] All required roles have a primary and backup.
- [ ] Systems passed functional checkout.
- [ ] Interfaces passed integration tests.
- [ ] Configuration exports are available.
- [ ] Ground truth passed verification.
- [ ] Instruments are calibrated.
- [ ] Common time meets tolerance.
- [ ] The complete data path passed a sample capture.
- [ ] Every P1 measure was computed from rehearsal data.
- [ ] Data-quality monitoring and fallback paths were tested.
- [ ] Storage, access, backup, transfer, and recovery were tested.
- [ ] Operators, red team, conductor, and safety staff rehearsed.
- [ ] Cards passed cold-reader review and dry run.
- [ ] Logistics, spares, consumables, maintenance, and reserve plan are ready.
- [ ] Every deficiency has an owner and approved disposition.
- [ ] Go, conditional go, hold, or no-go is recorded.

### 3.2 Day-start checklist (phase: each test day, before first run)

- [ ] Range window confirmed.
- [ ] Airspace status confirmed.
- [ ] Spectrum status confirmed.
- [ ] Weather and forecast within limits.
- [ ] Site access and nonparticipant controls active.
- [ ] Emergency support ready.
- [ ] Authorities and waivers active.
- [ ] Required people present and fit for duty.
- [ ] Day objective and minimum viable campaign briefed.
- [ ] Communications and stop calls checked.
- [ ] Blue and red systems inspected.
- [ ] Released configurations loaded and captured.
- [ ] Maintenance, battery, fuel, spares, and recovery state ready.
- [ ] Instruments calibrated.
- [ ] Ground truth verified.
- [ ] Clocks synchronized and offsets recorded.
- [ ] Storage and backup ready.
- [ ] Sample capture completed.
- [ ] P1 sample measure computed.
- [ ] Data alerts and fallback tested.
- [ ] Open defects and limits briefed.
- [ ] Daily go/no-go recorded.

### 3.3 Pre-run release checklist (phase: immediately before each run; final item names the releasing role)

- [ ] Correct card and version.
- [ ] Unique run ID.
- [ ] Purpose and matrix cell stated.
- [ ] Correct blue configuration.
- [ ] Correct threat profile.
- [ ] Correct condition and operating limits.
- [ ] Correct operators and procedure.
- [ ] Required authorities active.
- [ ] Safety area clear.
- [ ] Stop and emergency channels work.
- [ ] Ground truth records.
- [ ] Instruments and time meet tolerance.
- [ ] Recorders and storage ready.
- [ ] Data monitor sees required sources.
- [ ] Blinding preserved.
- [ ] No unrecorded change.
- [ ] Test conductor releases the run.

### 3.4 Daily evidence review (phase: end of each test day; ordered agenda, run in this sequence)

1. Run accounting: attempted, valid, conditional, invalid, and pending.
2. Data state: complete, missing, conflicting, or quarantined.
3. P1 measure state.
4. Hypotheses that gained or lost support.
5. New anomalies, limits, and failure boundaries.
6. Matrix coverage and minimum valid samples.
7. Questions answered, partial, and open.
8. Decision uncertainty reduced and remaining.
9. Planned runs now redundant.
10. Candidate next events and decision value.
11. Selected next event and rationale.
12. Card, run-list, configuration, or schedule changes.
13. Required approvals and briefing.
14. Minimum viable plan for the next day.

### 3.5 Decision evidence package checklist (phase: closeout / evidence delivery)

- [ ] Decision, owner, alternatives, deadline, and uncertainty.
- [ ] Bounded recommendation.
- [ ] Mission, system boundary, and configuration.
- [ ] Threats, conditions, operators, procedures, and range representation.
- [ ] Approved measures, thresholds, design, and acceptance conditions.
- [ ] Complete run accounting.
- [ ] Primary and diagnostic findings.
- [ ] Claims disposition.
- [ ] Architecture and mission-thread assessment.
- [ ] Uncertainty, limits, dissent, and open gaps.
- [ ] Options, trade-offs, and residual risk.
- [ ] Actions, owners, funding, and dates.
- [ ] Retest and staleness triggers.
- [ ] Reproduction instructions.
- [ ] Data delivery, classification, distribution, retention, and deletion.
- [ ] Method review completed.
- [ ] Analytical review completed.
- [ ] Evidence acceptance recorded.

### 3.6 Closeout and regression checklist (phase: campaign closeout)

- [ ] Contractual deliverables accepted.
- [ ] Actions transferred to named owners.
- [ ] Raw and processed data archived.
- [ ] Code, schemas, methods, cards, logs, and findings archived.
- [ ] Reproduction test passed.
- [ ] Configuration reconstruction test passed.
- [ ] Permissions, retention, and deletion reviewed.
- [ ] Equipment, property, credentials, sites, and networks restored.
- [ ] Safety, security, maintenance, damage, and property items closed or transferred.
- [ ] After-action review completed.
- [ ] Improvements have owners and due dates.
- [ ] Reusable assets harvested and cold-reader tested.
- [ ] Product requirements acknowledged.
- [ ] Evidence baseline issued.
- [ ] Change-impact rules issued.
- [ ] Minimum regression logic approved.
- [ ] Next decision and follow-on need recorded.
- [ ] Campaign status changed to closed.

## 4. Templates, forms & cards

All fields verbatim, in source order. Every field is a fill-in prompt (label followed by a colon) unless noted. Layout intent: each template renders as a flat labeled-field form; the Test card renders as 17 numbered titled sections; Deviation/Anomaly/Change render as three sub-forms under one record group.

### 4.1 Campaign charter (blue)

- Campaign ID and title:
- Version and status:
- Sponsor:
- Customer decision owner:
- Evidence-acceptance authority:
- Valkryn deployment strategist:
- Decision and deadline:
- Alternatives, including delay or no action:
- Decision-critical uncertainty:
- Engagement type:
- Mission and protected outcome:
- Evaluated system boundary:
- Included systems and configurations:
- Included threats and conditions:
- Primary questions:
- Primary measures and thresholds:
- Required evidence strength:
- Planned sites and dates:
- Contract and funding owner:
- Data, security, and release class:
- Deliverables and accepted-evidence date:
- Included scope:
- Excluded scope and effect on conclusions:
- Major assumptions:
- Major risks:
- Minimum viable campaign:
- Success criteria:
- Required approvals:
- Approvers and dates:

[Note: 29 fields.]

### 4.2 Authority and decision-rights record (blue)

- Decision type:
- Trigger:
- Accountable authority:
- Person who performs the action:
- Required reviewers:
- Required notifications:
- Evidence needed:
- Response-time limit:
- Primary person:
- Backup person:
- Escalation path:
- Expiration or review date:

Repetition rule (verbatim): "Repeat for scope, method, thresholds, configuration, safety, range, airspace, spectrum, security, daily go/no-go, run start, pause, stop, restart, degraded operation, run validity, card change, run-list change, evidence sufficiency, findings, acceptance, and customer action."

That is one record instance per decision type; 22 decision types enumerated: scope, method, thresholds, configuration, safety, range, airspace, spectrum, security, daily go/no-go, run start, pause, stop, restart, degraded operation, run validity, card change, run-list change, evidence sufficiency, findings, acceptance, customer action.

### 4.3 Decision–question–evidence traceability record (blue)

- Decision ID and statement:
- Question ID and exact wording:
- Priority:
- Claim or unknown ID:
- Hypothesis ID:
- Primary measure IDs:
- Diagnostic measure IDs:
- Required data and ground truth:
- Threat and condition IDs:
- Planned card IDs:
- Actual valid run IDs:
- Finding IDs:
- Claim disposition:
- Decision implication:
- Remaining gap:
- Owner:
- Status:

### 4.4 Measure definition record (blue)

- Measure ID and name:
- Decision and hypothesis linkage:
- Purpose:
- Exact definition:
- Unit:
- Numerator:
- Denominator:
- Start event:
- Stop event:
- Experimental unit:
- Aggregation level:
- Primary source and fields:
- Backup source:
- Independent ground truth:
- Update rate:
- Coordinate frame:
- Time source and tolerance:
- Calculation method:
- Code or analytical version:
- Missing-data rule:
- Invalid-data rule:
- Censoring rule:
- Ambiguity rule:
- Measurement uncertainty:
- Threshold:
- Objective:
- Failure boundary:
- Threshold rationale:
- Required repetition or confidence:
- Borderline-result rule:
- Approver and date:

[Note: 31 fields.]

### 4.5 Configuration baseline record (blue)

- Configuration ID and version:
- System boundary:
- Hardware models and serial numbers:
- Software and build versions:
- Firmware versions:
- Algorithms and models:
- Mission-data files and dates:
- Feature flags and settings:
- Sensor configuration:
- C2 and network configuration:
- Interceptor or effector configuration:
- Interface versions:
- Security settings:
- Calibration state:
- Operator roles and names:
- Procedure version:
- Training state:
- Known defects:
- Waivers:
- Temporary fixes:
- Export or capture location:
- Checksum where required:
- Functional-check result:
- System-owner release:
- Freeze time:
- Runs using this baseline:
- Superseded baseline:
- Change summary:

[Note: 28 fields.]

### 4.6 Threat and condition record (blue)

- Threat ID and version:
- Platform or phenomenon:
- Operational behavior represented:
- Size and payload:
- Speed and altitude:
- Route, geometry, and maneuver:
- Emissions and communications:
- Navigation and autonomy:
- Coordination or swarm behavior:
- Actual threat, surrogate, or generic representation:
- Faithful features:
- Approximated features:
- Omitted or unknown features:
- Validation source and authority:
- Red-controlled variables:
- Fixed variables:
- Blinded information:
- Safety and realism bounds:
- Condition ID:
- Terrain and clutter:
- Weather and illumination:
- Electromagnetic environment:
- Network state:
- Background activity:
- Operator workload:
- Supporting systems:
- Degraded modes:
- Permitted generalization:
- Prohibited generalization:

[Note: 29 fields. The record covers both the threat (THR) and the paired condition (COND) in one form; Condition ID starts the condition block at field 19.]

### 4.7 Test card (orange) — 17 numbered sections

1. **Control** — Card ID, title, version, status, owner, approvers, and effective time.
2. **Traceability** — Decision, question, claim, hypothesis, measure, and matrix-cell IDs.
3. **Purpose** — One sentence that states why the run exists.
4. **Planned repetition** — Repetition number, minimum valid sample, and reason for run priority.
5. **System state** — Boundary, configuration ID, systems, interfaces, operators, procedure, and training.
6. **Threat state** — Threat ID, exact profile, red-control variables, and blinding.
7. **Condition** — Condition ID, weather, terrain, RF, network, background, and limits.
8. **Variables** — Independent variables, held controls, and recorded covariates.
9. **Measures** — Measure IDs, thresholds, objectives, and expected evidence.
10. **Data and truth** — Sources, fields, truth, calibration, common time, tolerances, monitoring, and fallback.
11. **Preconditions** — Authorities, area, system, threat, people, safety, data, and communications.
12. **Procedure** — Numbered steps, one action per step, named role, and observable completion.
13. **Expected result** — Nominal behavior and known expected artifacts.
14. **Stop and restart** — Safety, regulatory, equipment, data, and security triggers; safe state; restart authority.
15. **Validity and repeat** — Required conditions, invalidating failures, conditional uses, and reset needs.
16. **Outputs** — Files, run log, observations, quick-look product, status decision, and storage path.
17. **Deviation record** — Time, actual difference, affected control, validity effect, disposition, and linked change.

Layout intent: printed/tablet card, sections in this fixed order; section 12 is a numbered step table with columns implied as step number, action (one per step), role, observable completion.

### 4.8 Run record and immediate debrief (orange)

- Run ID:
- Card ID and version:
- Planned purpose:
- Planned matrix cell and repetition:
- Start and stop times:
- Test conductor:
- Safety authority:
- Operators:
- Red lead:
- Data monitor:
- Witnesses:
- Actual configuration ID:
- Actual threat profile:
- Actual conditions:
- Actual procedure summary:
- Time-ordered event log:
- Source and ground-truth status:
- Clock and calibration status:
- Deviations:
- Anomalies:
- Safety or regulatory events:
- Direct operator observations:
- Data files and storage path:
- Initial data-quality result:
- Final status: valid, conditionally valid, invalid, or pending.
- Allowed measures and comparisons:
- Prohibited uses:
- Repeat recommendation:
- Adjudicators and time:

[Note: 29 fields. Field 25 is an enum, not free text.]

### 4.9 Deviation record (orange)

- Deviation ID:
- Run and card:
- Time:
- Planned state:
- Actual state:
- Direct observation:
- Affected variable, control, measure, or rule:
- Immediate action:
- Data preserved:
- Validity effect:
- Run disposition:
- Repeat need:
- Approver:

### 4.10 Anomaly record (orange)

- Anomaly ID:
- Observation:
- Time and source:
- Configuration, threat, and condition:
- Mission effect:
- Candidate causes:
- Evidence for each cause:
- Evidence that can distinguish causes:
- Preservation action:
- Diagnostic action:
- Root-cause status:
- Corrective action:
- Verification test:
- Owner and status:

### 4.11 Change record (orange)

- Change ID:
- Triggering evidence, defect, or constraint:
- Options considered:
- Selected change and reason:
- Variables changed:
- Variables held:
- Records superseded:
- New versions:
- Comparability effect:
- Safety, data, schedule, cost, and acceptance effect:
- Required approvals:
- Effective time:
- Briefing completed:
- Result after change:

### 4.12 Finding record (green)

- Finding ID and version:
- Finding statement:
- Decision, question, claim, and hypothesis linkage:
- Supporting runs:
- Contradicting runs:
- Configuration:
- Threats and conditions:
- Operators and procedures:
- Method and analytical version:
- Measures and results:
- Threshold comparison:
- Sample and independence:
- Variability and uncertainty:
- Missing and excluded data:
- Confounders and alternative explanations:
- Root-cause state if applicable:
- Mission-thread effect:
- Strength: conclusive, directional, insufficient, or not tested.
- Applies to:
- Does not apply to:
- Assumptions:
- Evidence life and staleness trigger:
- Decision implication:
- Recommended action:
- Follow-on or regression need:
- Reviewers, dissent, and approval:

[Note: 26 fields. Field 18 is an enum.]

## 5. Outputs & deliverables

This page defines record artifacts, not report prose. Deliverables implied by the templates:

- Completed instance of every record in Section 4, one per entity (campaign, decision type, measure, configuration, threat/condition, card, run, deviation, anomaly, change, finding).
- Test card section 16 names per-run outputs: files, run log, observations, quick-look product, status decision, and storage path.
- Decision evidence package: contents enumerated by the 18-item checklist in 3.5 (produced at evidence delivery).
- Daily evidence review output: selected next event and rationale, change list, approvals, and minimum viable plan for the next day (items 11–14 of 3.4), produced at end of each test day.
- Closeout deliverables: archives, reproduction test results, evidence baseline, change-impact rules, minimum regression logic (checklist 3.6), produced at campaign close.

## 6. Workflow & sequencing logic

- Master rule: the approved plan and current test card control execution; a checklist confirms the control and never replaces it.
- Phase sequence encoded by the page's template order and color code: (blue) charter → authority record → traceability record → measure definitions → configuration baseline → threat/condition records; (orange) test card → test readiness review → day-start → pre-run release → run record and debrief → deviation/anomaly/change records; (blue) daily evidence review each evening; (green) finding record → decision evidence package → closeout and regression.
- Gates in order: Test readiness review outcome (go / conditional go / hold / no-go) gates execution; Day-start daily go/no-go gates each day; Pre-run release checklist gates each run, with the test conductor as releasing authority (final item); run adjudication assigns final status (valid / conditionally valid / invalid / pending) which gates use of the run in analysis ("Allowed measures and comparisons" / "Prohibited uses").
- Adaptation loop: Daily evidence review items 9–14 drive replanning between days (redundant runs dropped, next event selected by decision value, card/run-list/configuration/schedule changes approved and briefed).
- Any change routes through the Change record, which forces statement of variables changed vs. held and comparability effect before approval and effective time.
- Pocket rules (verbatim; each is a hard gate — the absence of the first item blocks the second):
  - No decision owner, no campaign.
  - No accepted method, no evaluation claim.
  - No configuration record, no comparison.
  - No independent truth, no performance verdict.
  - No common time, no latency claim.
  - No issued card, no live run.
  - No data-quality decision, no analysis.
  - No traceability, no finding.
  - No stated limit, no defensible generalization.
  - No owner and due date, no action.
  - No evidence baseline, no controlled regression.

## 7. Worked examples & real data

None found. This page contains no numeric examples and no JIATF-401 data.

## 8. Product implications

1. The app must provide 12 structured record types as forms with these exact fields in this exact order: Campaign charter, Authority record, Traceability record, Measure definition, Configuration baseline, Threat/condition record, Test card, Run record, Deviation, Anomaly, Change, Finding. Field order is layout intent; preserve it in UI and print.
2. Every field needs a "not applicable" state that requires a reason string. Blank is not a valid state on a completed record.
3. The Authority record is a repeating record: the app should auto-instantiate the 22 enumerated decision types and let the user complete each.
4. The Test card must render as a 17-section print/tablet card; section 12 (Procedure) needs a step editor enforcing one action per step, a named role per step, and an observable completion criterion per step.
5. Six checklists must be first-class runnable objects with per-item check state, tied to their gate: TRR (campaign gate), Day-start (daily gate), Pre-run release (run gate), Daily evidence review (daily replanning agenda), Decision evidence package (delivery gate), Closeout and regression (campaign close gate).
6. Enforce the enums: run final status (valid / conditionally valid / invalid / pending), finding strength (conclusive / directional / insufficient / not tested), TRR outcome (go / conditional go / hold / no-go), data state (complete / missing / conflicting / quarantined), threat representation (actual / surrogate / generic).
7. Implement the 11 Pocket rules as validation gates: e.g., block run start without an issued card (rule 6), block finding creation without traceability links (rule 8), block analysis without a data-quality decision (rule 7), block comparisons across runs lacking configuration records (rule 3).
8. Records must cross-link by ID: traceability record joins Decision→Question→Claim→Hypothesis→Measure→Threat/Condition→Card→Run→Finding. The app should enforce and navigate these links.
9. Run adjudication must write "Allowed measures and comparisons" and "Prohibited uses" per run, and the analysis layer must respect them.
10. Changes require a Change record capturing variables changed vs. held and comparability effect before taking effect; superseded records get versioned, not overwritten.
