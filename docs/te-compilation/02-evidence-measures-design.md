# 02 — Evidence Planning, Measures & Test Design

## Sources fetched

- "02 — Evidence Planning, Measures & Test Design" — https://app.notion.com/p/9e41125f6302483eb08877541a5430a5
  (Parent: "Valkryn Deployment Strategist Manual — End-to-End Test & Evaluation Operations". No sub-pages were linked inside this page; the fetch set is complete.)

Page purpose (verbatim): "Convert decision-critical questions into approved hypotheses, measures, data, thresholds, conditions, test events, repetition, and change rules."

## 1. Input variables & fields

### 1.1 Question record (Step 1 — ranked question set)

Each question must include these fields:

| Field | Notes |
| --- | --- |
| Stable identifier | Record identifier (Q per brief ID scheme) |
| Exact wording | Free text, verbatim question |
| Customer decision linkage | Link to a Decision record (DEC) |
| Decision owner | Person/role |
| Priority | Enum: P1, P2, P3 (definitions below) |
| Required answer date | Date |
| Current evidence state | Free text/status |
| Consequence if unanswered | Free text |
| Evidence authority | Person/role |

Priority enum (verbatim definitions):

- **P1:** The decision cannot be supported without an answer.
- **P2:** The answer changes risk, configuration, or conditions of use.
- **P3:** The answer improves understanding but does not control the current decision.

Rule: "Do not let P3 work consume P1 range time."

### 1.2 Hypothesis record (Step 2)

Hypothesis statement template (verbatim):

> Under **[configuration, threat, and condition]**, the system produces **[observable behavior or mission effect]**, measured by **[measure]**, relative to **[threshold or comparison]**.

Additional fields to record on each hypothesis:

- Null hypothesis.
- Competing explanations.
- Evidence that supports the primary hypothesis.
- Evidence that refutes it.
- Result that remains inconclusive.
- Applicable component, interface, or mission-thread level.
- Assumptions.
- Final disposition owner.

Rules:

- "Use directional language only when the design can support it."
- "Do not write a causal hypothesis when the campaign can only show association."

### 1.3 Measure registry record (Step 3) — 20 fields, ordered

Measure categories: mission, performance, suitability, safety, and diagnostic measures ("as needed").

For each measure, record (exact ordered list):

1. Measure identifier and name.
2. Decision question and hypothesis.
3. Exact definition.
4. Unit.
5. Numerator and denominator.
6. Start and stop events.
7. Experimental unit.
8. Aggregation level.
9. Source fields.
10. Independent ground truth.
11. Sampling or update rate.
12. Coordinate frame and time reference.
13. Calculation formula or method.
14. Analytical software and version.
15. Valid, missing, censored, and ambiguous-data rules.
16. Measurement error and uncertainty method.
17. Threshold and objective.
18. Threshold source and rationale.
19. Required repetition or confidence.
20. Approver.

Reproducibility rule (verbatim): "Two qualified analysts must be able to apply the definition to the same valid data and obtain the same result."

Counter-UAS measure examples (verbatim list — seed content for a measure library):

- Probability of detection by range band.
- First-detection range.
- First-stable-track range.
- Track continuity in the decision zone.
- Classification accuracy by threat class.
- False tracks per operating hour.
- Sensor-to-C2 latency.
- Track-to-decision latency.
- Decision-to-effect latency.
- Probability of intercept or defeat.
- End-to-end mission success.
- Time to effect assessment.
- Operator workload and intervention rate.
- Availability, recovery time, and mission resilience.
- Spectrum, collateral, or safety effects.

### 1.4 Threshold record (Step 4)

For every threshold, record:

- Minimum acceptable value.
- Objective value.
- Failure boundary.
- Borderline-result rule.
- Allowed trade-offs.
- Required confidence or uncertainty width.
- Decision action associated with meet, miss, mixed, and inconclusive results.

Result-state enum implied: meet | miss | mixed | inconclusive — each must have a mapped decision action.

### 1.5 Evidence-source record (Step 5)

For each measure, specify:

- Primary source.
- Backup source.
- Independence from the system under test.
- Accuracy and uncertainty.
- Coverage and update rate.
- Calibration requirement.
- Time-synchronization tolerance.
- Data owner and access path.
- Failure effect.
- Validation method.

Rule: "If one source can silently fail, define an independent health indicator."

### 1.6 Threat record (Step 6) — one per operationally distinct profile (THR)

Record:

- Platform or phenomenon.
- Size, speed, altitude, route, maneuver, emissions, communications, navigation, autonomy, payload, and coordination behavior.
- Features that drive system performance.
- Representation type — enum: actual threat | validated surrogate | generic representation.
- Fidelity by feature — enum per feature: faithful | approximated | omitted | unknown.
- Validation source and authority.
- Variables red may control.
- Blinded information.
- Safety and realism bounds.
- Generalization allowed and prohibited.

### 1.7 Condition record (Step 6) — one per test state (COND)

Include:

- Terrain
- Clutter
- Weather
- Illumination
- Electromagnetic environment
- Network state
- Workload
- Operator state
- Supporting systems
- Background traffic
- Degraded modes

### 1.8 Factor classification (Step 7)

Every factor is classified with one of four types (verbatim definitions):

- **Independent variable:** Changed on purpose to answer the question.
- **Controlled factor:** Held fixed and verified.
- **Recorded covariate:** Not controlled but measured for analysis.
- **Unobserved nuisance:** Not controlled or measured. Remove it or state the risk.

Specific effects that must be recorded as covariates: learning, fatigue, order, equipment heating, battery state, maintenance, and time-of-day effects.

### 1.9 Test-matrix cell (Step 8)

For each matrix cell, state:

- Question and hypothesis.
- Configuration.
- Threat and condition.
- Independent variable.
- Measures.
- Planned repetitions.
- Required order or block.
- Cost and time.
- Safety and authority needs.
- Minimum valid evidence.
- Priority and drop order.

Required matrix coverage rows (matrix must include):

- Baseline condition.
- Positive control when available.
- Negative control.
- Comparison system or prior configuration when relevant.
- Decision-critical threat and environment combinations.
- Expected operating center.
- High-risk boundary conditions.
- Degraded modes.
- Diagnostic isolation events.

### 1.10 Run-list entry (Step 12)

Each run-list entry states:

- Card identifier. (TC per brief ID scheme)
- One-sentence purpose.
- Matrix cell.
- Priority.
- Dependencies.
- Estimated duration.
- Required assets.
- Minimum valid result.
- Drop order.

## 2. Calculations & formulas

No closed-form equations appear in this page. It defines calculation *procedures* and *scoring inputs*:

### 2.1 Mission-arithmetic timeline decomposition (Step 4)

For timeline-driven measures, "work backward from the mission effect." The threshold is derived by summing/decomposing these timeline components (verbatim list of terms):

- Threat speed
- Release range
- Processing time
- Operator decision time
- Authority time
- Effector assignment
- Time of flight or time to effect
- Assessment
- Margin

[AMBIGUOUS: no explicit equation given; the intent is that available reaction time (derived from threat speed and release range) must exceed the sum of the latency components plus margin. The app should implement this as a timeline budget calculator with these named line items.]

Computed at: threshold-setting time (pre-execution, Step 4).

### 2.2 Threshold source precedence (Step 4)

Ordered precedence for where a threshold value comes from (use the first applicable):

1. Law, regulation, or approved safety limit.
2. Contract or validated operational requirement.
3. Mission arithmetic.
4. Accepted comparison baseline.
5. Customer decision rule.
6. Analyst judgment, clearly labeled.

### 2.3 Repetition / sample-size determinants (Step 9)

Repetition is determined from (inputs to the sample-rationale, no formula given):

- Expected variability.
- Minimum meaningful effect.
- Desired confidence or uncertainty width.
- Independence of observations.
- Rare but severe failure risk.
- Cost, time, and safety.
- Acceptance-authority requirement.

Independence and validity rules (verbatim):

- Do not treat repeated samples within one run as independent runs.
- Do not treat several tracks from one common failure state as fully independent.
- Use at least enough repetition to see stability for each P1 condition.
- When samples remain small, predefine directional conclusions and limits.
- Preserve individual results. Do not hide the worst valid case inside an average.

Gate: "The analysis lead documents the sample rationale before design approval."

### 2.4 Run-priority scoring (Step 12)

Score each candidate event by:

- Decision impact.
- Uncertainty reduction.
- Ability to distinguish competing explanations.
- Acceptance value.
- Time and cost.
- Safety and schedule risk.
- Dependency on scarce assets.

Rule: "Use the score to inform judgment. Do not let a formula override mission or safety context."

[AMBIGUOUS: no weighting or scale is specified for the score; the app should let the user score each criterion and rank, without hard-coding a formula.]

## 3. Checklists

### 3.1 Stop / hold / repeat / adapt rules (Step 11) — four conditional lists, verbatim

**Stop immediately** (any item triggers immediate stop):

- Safety or regulatory trigger.
- Loss of required authority.
- System state outside the safe envelope.
- Uncontrolled threat behavior.
- Ground-truth loss when truth is mandatory.
- Configuration drift that can affect the result.
- Data-chain failure that removes required evidence.
- Security or classification violation.

**Hold before the next run** (any item blocks the next run):

- Unresolved data-quality failure.
- Unknown configuration state.
- Procedure deviation affecting a comparison.
- Anomaly with possible safety or evidence impact.
- Missing required approver.
- Weather, spectrum, or range state near a limit.

**Repeat** (any item makes the run invalid and requires a repeat):

- A written validity rule failed.
- A required source is missing or outside tolerance.
- The actual condition did not match the card.
- A procedural deviation affected the independent variable.
- A material anomaly has been corrected and confirmation is required.

**Adapt** (any item permits controlled replanning):

- Evidence already answers a question.
- A new P1 unknown appears.
- A planned run no longer changes the decision.
- A constraint changes.
- Variance is higher or lower than expected.
- A boundary requires controlled exploration.

Conditional governance rule: "For every adaptation class, name the approver and maximum change allowed without a new design review." (Two required fields per adaptation class: approver; maximum change allowed.)

### 3.2 Design gate checklist (final gate)

Proceed only when ALL of:

- Every P1 question has a defensible evidence path.
- Measures are reproducible.
- Thresholds have accepted rationale.
- Threats and conditions support the intended conclusion.
- Repetition supports the promised evidence strength.
- The evidence authority accepts the method.

Runner: [AMBIGUOUS: page names "evidence authority" and "analysis lead" as approvers but does not name who executes the gate review overall.]

## 4. Templates, forms & cards

### 4.1 Hypothesis statement template

See Section 1.2. Fill-in-the-blank sentence with four slots: [configuration, threat, and condition], [observable behavior or mission effect], [measure], [threshold or comparison]. Rendered as a gray-highlighted quote block in source.

### 4.2 Design review package (document template — required contents, ordered)

- Approved decision and question set.
- Traceability register.
- Claims and hypotheses.
- Measure and threshold registry.
- Evidence-source and ground-truth plan.
- Threat and condition records.
- Factor classification.
- Test matrix and sample rationale.
- Prioritized run list.
- Stop, repeat, adaptation, and sufficiency rules.
- Expected conclusions and prohibited conclusions.
- Data, range, safety, security, and resource implications.

### 4.3 Record forms

The question record (1.1), hypothesis record (1.2), measure registry record (1.3, 20 ordered fields), threshold record (1.4), evidence-source record (1.5), threat record (1.6), condition record (1.7), matrix cell (1.9), and run-list entry (1.10) are all form structures; field order as listed in Section 1.

## 5. Outputs & deliverables

| Deliverable | Contents | When produced |
| --- | --- | --- |
| Frozen ranked question set | Question records with P1/P2/P3 priority | Step 1, before design work |
| Hypothesis set | Hypothesis records incl. null, competing explanations, inconclusive criteria | Step 2 |
| Measure registry | 20-field measure records + threshold records | Steps 3–4 |
| Evidence-source and ground-truth plan | Source records per measure | Step 5 |
| Threat and condition records | One THR per distinct profile; one COND per test state | Step 6 |
| Factor classification | Every factor typed (IV / controlled / covariate / nuisance) | Step 7 |
| Test matrix with sample rationale | Matrix cells + documented repetition rationale | Steps 8–9 |
| Campaign sequence | Ordered evidence ladder (Step 10) | Step 10 |
| Stop/repeat/adaptation rule set | Four rule lists + approver and max-change per adaptation class | Step 11 |
| Prioritized run list | Run-list entries with scores, drop order | Step 12 |
| Design review package | All of the above bundled (Section 4.2) | Before the design gate |
| Design gate decision | Pass/fail against the 6-item gate checklist | End of phase 02 |

## 6. Workflow & sequencing logic

### 6.1 Evidence-planning chain (mandatory traceability chain, verbatim)

```text
Decision
→ Question
→ Claim or unknown
→ Hypothesis
→ Measure
→ Required data and ground truth
→ Condition and threat
→ Test event
→ Run
→ Finding
→ Decision implication
```

Rule: "An activity without this chain is out of scope." Every planned activity must trace end-to-end through this chain.

### 6.2 Twelve-step design sequence (page structure = required order)

1. Freeze the ranked question set.
2. Write testable hypotheses.
3. Build the measure registry.
4. Set thresholds from the mission.
5. Define the evidence sources.
6. Define the threat and conditions.
7. Select variables, controls, and covariates.
8. Build the test matrix.
9. Set repetition and evidence strength.
10. Sequence the campaign.
11. Define stop, repeat, and adaptation rules.
12. Produce the prioritized run list.
Then: design review package → design gate.

### 6.3 Campaign sequencing ladder (Step 10) — "least expensive valid evidence first"

1. Document and configuration review.
2. Bench or software-in-the-loop checks.
3. Component test.
4. Interface and data-path test.
5. Integrated rehearsal.
6. Baseline live event.
7. Decision-critical stress event.
8. Boundary and degraded-condition event.
9. Diagnostic or causal-isolation event.
10. Confirmatory event.

Rule: "Schedule early runs that can falsify the main claim or expose a campaign-stopping defect."

### 6.4 Ordering and design-integrity rules

- Freeze thresholds before execution. "A post-result threshold change is a new decision rule and must not overwrite the original assessment." (Implies threshold versioning, not overwrite.)
- Change one decision-relevant factor between direct comparisons when possible.
- If two factors must change together, define a new condition. Do not call it a repeat.
- Use blocking or randomization when order can bias the result.
- Do not attempt a full factorial design when range time cannot support it. Cover the combinations with the greatest decision impact and uncertainty.
- Sample rationale documented before design approval (analysis lead).
- P3 work must not consume P1 range time.

## 7. Worked examples & real data

None found. (The C-UAS measure examples in Section 1.3 are named measures without numeric values; no JIATF-401 numbers appear on this page.)

## 8. Product implications

1. **Traceability chain as a first-class data model.** Linked records: DEC → Q → claim/unknown → HYP → M → evidence source/ground truth → COND+THR → test event → RUN → FIND → decision implication. The app must block (or flag out-of-scope) any test event or run not traceable to a Decision, and render the chain visually per run.
2. **Question register form** with the 9 fields of 1.1, a P1/P2/P3 enum with the exact definitions as helper text, and a "freeze" action that locks the ranked set.
3. **Hypothesis builder** using the fill-in-the-blank template (four slots) plus the 8 auxiliary fields; warn when a causal phrasing is used without a supporting design.
4. **Measure registry editor** with all 20 ordered fields; ship the 15 C-UAS example measures as a seed library the user can instantiate.
5. **Threshold editor** enforcing the 6-level source precedence, capturing min/objective/failure boundary/borderline rule, mapping each of meet/miss/mixed/inconclusive to a decision action, and version-locking thresholds at execution start (post-result edits create a new versioned rule, never overwrite).
6. **Mission-arithmetic timeline calculator**: named line items (threat speed, release range, processing, operator decision, authority, effector assignment, time of flight/effect, assessment, margin) that back-compute a latency threshold; ties naturally into RangeBoard's existing kill-chain/engagement analysis.
7. **Evidence-source planner** per measure (primary/backup/independence/calibration/time-sync tolerance) with an automatic prompt: if a source can silently fail, require an independent health indicator.
8. **Threat (THR) and condition (COND) record forms**, with per-feature fidelity tagging (faithful/approximated/omitted/unknown) and representation type enum; connect THR records to RangeBoard's existing threat library.
9. **Factor classifier**: every factor tagged as IV / controlled / covariate / nuisance; built-in covariate prompts (learning, fatigue, order, heating, battery, maintenance, time of day); nuisance factors require an explicit risk statement.
10. **Test-matrix builder** with required coverage rows (baseline, positive/negative control, comparison, decision-critical combos, operating center, boundary, degraded, diagnostic), per-cell fields of 1.9, and a warning against full factorials beyond available range time.
11. **Repetition planner**: capture the 7 determinants and the sample rationale (required before design approval); enforce independence rules; always show individual run results alongside aggregates ("do not hide the worst valid case inside an average").
12. **Stop/hold/repeat/adapt rule engine**: the four verbatim lists as configurable day-of-test triggers; each adaptation class stores an approver and a maximum change allowed without a new design review. These feed the day-of-test dynamic checklists.
13. **Prioritized run-list generator**: user-scored 7-criterion ranking (no hard-coded formula), producing run entries with card ID, purpose, matrix cell, dependencies, duration, assets, minimum valid result, and drop order.
14. **Design review package export** assembling the 12 required contents, plus a **design gate** screen with the 6-item pass/fail checklist that gates progression to phase 03/04.
