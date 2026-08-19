# 05 — Data Validation, Analysis & Adaptive Replanning

Purpose (source, verbatim): "Convert adjudicated runs into reproducible measures and bounded findings, then select the highest-value next event without breaking traceability or comparability."

## Sources fetched

- "05 — Data Validation, Analysis & Adaptive Replanning" — https://app.notion.com/p/7e11e631947543688ee95453acea5913
  (No sub-pages are linked inside this page. Parent manual page and sibling sections belong to other agents and were not fetched.)

## 1. Input variables & fields

### Run evidence intake (Part A) — identifiers to confirm per run
Each run that enters the analytical pipeline must carry these confirmed identifiers:
- Card identifier (TC)
- Run identifier (RUN)
- Configuration identifier (CFG)
- Threat identifier (THR)
- Condition identifier (COND)
- Operator identifier
- Method identifier
- Included measures (M) and prohibited uses
- Recorded validity status (required before pipeline entry; enum below)

Data-quality registration fields per run: missing data, corrected data, duplicate data, conflicting data.

Analysis provenance fields per run/manifest: analytical code version, configuration, environment.

### Run validity status (enum)
`valid | conditional | invalid | pending` (from Part H reconcile step: "Which runs are valid, conditional, invalid, or pending?")

Run count categories (Part E): `planned | attempted | valid | conditional | invalid`.

### Run-validity board adjudication record (Part B) — fields
Review inputs (each is an assessable field per run):
- Planned versus actual state
- Configuration identity
- Threat and condition fidelity
- Procedure compliance
- Ground-truth and source health
- Data completeness and time quality
- Deviations and anomalies (DEV, ANOM)
- Independence and comparison integrity

Recorded outputs:
- Final status
- Measures allowed
- Comparisons allowed
- Limits
- Repeat decision
- Dissent
- Approver and time

Versioning field: adjudication version. A changed status creates a new adjudication version; the prior decision and the reason for change are preserved.

### Correction record (Part C) — fields
- Source value (preserved)
- Corrected value
- Rule and reason
- Person and time
- Effect on results assessment

### Run-level measure result record (Part D) — fields
- Measure definition reference (approved definition)
- Start event and stop event (approved)
- Truth and alignment method (approved)
- Missing, censoring, and ambiguity rules applied
- Computed value
- Measurement uncertainty (computed or stated)
- Threshold comparison and objective comparison
- Intermediate values retained for review
- Links to source records
- Result label (enum): `pass | miss | borderline | descriptive | unavailable` — assign only when the approved logic defines that label

### Causal diagnosis record (Part F) — fields
- Observation definition: time, configuration, condition, source
- Candidate causes across nine categories (enum of cause domains): `component | interface | configuration | operator | environment | threat | instrumentation | data | method`
- Evidence expected under each cause
- Evidence that can distinguish causes
- Root-cause classification (enum): `confirmed | supported | plausible | contradicted | unknown`
- Corrective action and verification test

### Finding record (FIND) (Part G) — fields (complete list)
- Finding identifier and concise statement
- Decision, question, claim, and hypothesis linkage (DEC, Q, CLM, HYP)
- Supporting and contradicting runs (RUN)
- Exact configuration (CFG)
- Threat, environment, operators, procedures, and method (THR, COND)
- Measures and threshold comparisons (M)
- Variability, confidence, and measurement uncertainty
- Sample and independence limits
- Missing or excluded data
- Confounders and alternative explanations
- Component, interface, and mission-thread effect
- Strength (enum): `conclusive | directional | insufficient | not tested`
- Conditions where the finding applies
- Conditions where it does not apply
- Assumptions that must remain true
- Decision implication
- Corrective action or follow-on need (ACT)
- Review and approval state

### Adaptation record (Part I) — fields (complete list)
- Triggering evidence or constraint
- Gap to resolve
- Options considered
- Selected action and rationale
- Variables changed and held
- Prior and new card or plan versions
- Comparability effect
- Safety, data, schedule, cost, and acceptance effect
- Required approval
- Expected decision value
- Result after execution

### Analysis input manifest (Part A)
Versioned manifest listing the runs and evidence admitted to analysis, plus analytical code, configuration, and environment. Frozen at campaign completion (Part K).

## 2. Calculations & formulas

No closed-form formulas appear on this page. It defines computation procedures, required statistics, and labeling logic. Exact math for measures lives in other sections (10, 11, 14 per the page map).

### Run-level measure computation procedure (Part D, verbatim sequence)
For each allowed measure:
1. Apply the approved definition.
2. Use the approved start and stop events.
3. Apply the approved truth and alignment method.
4. Apply missing, censoring, and ambiguity rules.
5. Compute the value.
6. Compute or state measurement uncertainty.
7. Compare with threshold and objective.
8. Store intermediate values needed for review.
9. Link the result to source records.
10. Mark pass, miss, borderline, descriptive, or unavailable only when the approved logic defines that label.

Outlier rule: "Review outliers. Do not remove an outlier only because it is inconvenient. Use the preapproved rule or report the result with and without it."

### Aggregate statistics to report (Part E, as applicable)
- Individual valid results
- Count of planned, attempted, valid, conditional, and invalid runs
- Central tendency
- Spread and worst valid case
- Confidence or credible interval
- Measurement uncertainty
- Condition and configuration breakdown
- Sensitivity to exclusions and assumptions
- Missingness pattern

Precondition: "Define the correct experimental unit before aggregation."

### Aggregation prohibitions (Part E, verbatim — these are validation rules)
Do not combine:
- Different configuration baselines without a stated model.
- Different threat profiles as if they are the same condition.
- Independent runs and repeated samples as equal units.
- Valid and invalid evidence.
- Pre-change and post-change conditions without an explicit comparison.

### Analytical QC cross-check (Part C)
- Test code against a known case.
- Compare independent calculations for P1 measures (dual-computation requirement for priority-1 measures).

### Next-event value assessment criteria (Part I) — scoring dimensions per candidate event
- Decision effect if answered
- Current uncertainty
- Ability to distinguish competing causes
- Expected information gain
- Acceptance value
- Comparability with existing evidence
- Range time
- Safety and technical risk
- Asset scarcity
- Schedule effect

Selection rule: "Select the event with the best decision value that remains safe, authorized, and methodologically defensible." [AMBIGUOUS: no numeric weighting or scoring formula given; treat as a multi-criteria comparison, not a computed score]

## 3. Checklists

### Evidence intake checklist (Part A) — per run; run by data/analysis staff
1. Verify the run evidence package.
2. Confirm card, run, configuration, threat, condition, operator, and method identifiers.
3. Confirm included measures and prohibited uses.
4. Register missing, corrected, duplicate, or conflicting data.
5. Preserve the raw package.
6. Create a versioned analysis input manifest.
7. Record the analytical code, configuration, and environment.

Gate rule: Only runs with a recorded validity status may enter the analytical pipeline.
Rule: Do not let quick-look files become the authoritative analytical source.

### Run-validity board review checklist (Part B) — held end of each day and when new data changes a prior decision
- Planned versus actual state.
- Configuration identity.
- Threat and condition fidelity.
- Procedure compliance.
- Ground-truth and source health.
- Data completeness and time quality.
- Deviations and anomalies.
- Independence and comparison integrity.

Participants (attendance list):
- Deployment strategist.
- Test conductor.
- Data lead.
- Analysis lead.
- System or range specialist as needed.
- Safety authority when safety evidence is involved.

### Analytical quality-control checklist (Part C) — before metric production
- Verify schemas and units.
- Verify coordinate transformations.
- Verify time alignment.
- Verify object and track correlation.
- Verify inclusion and exclusion rules.
- Verify missingness labels.
- Test code against a known case.
- Review a sample manually.
- Compare independent calculations for P1 measures.
- Record software, package, and parameter versions.

### Correction checklist (Part C) — for every correction
- Preserve the source value.
- Record the corrected value.
- State the rule and reason.
- Identify the person and time.
- Assess effect on results.

### Causal diagnosis checklist (Part F) — for every consequential failure or anomaly
1. Define the observation with time, configuration, condition, and source.
2. List candidate causes across component, interface, configuration, operator, environment, threat, instrumentation, data, and method.
3. Identify evidence expected under each cause.
4. Identify evidence that can distinguish causes.
5. Check existing records before adding a live run.
6. Reproduce the effect when safe and valuable.
7. Change one discriminating factor when possible.
8. Record the result.
9. Classify root cause as confirmed, supported, plausible, contradicted, or unknown.
10. State corrective action and verification test.

Rule: "A vendor statement may be evidence about mechanism. It is not proof of root cause."

### Daily evidence review checklist (Part H) — fixed 5-step sequence
1. Reconcile evidence:
   - Which runs are valid, conditional, invalid, or pending?
   - Which P1 measures are available?
   - Which source or method problems remain?
2. Update hypotheses:
   - Which gained or lost support?
   - Which competing explanations remain?
   - What unexpected behavior appeared?
   - Is it repeatable and mission-relevant?
3. Update the coverage map:
   - Which matrix cells meet the minimum valid sample?
   - Which cells remain empty or thin?
   - Which planned events are now redundant?
4. Update decision uncertainty:
   - What can the customer now know?
   - What remains decision-critical?
   - Which uncertainty can no longer be resolved in the current campaign?
5. Select the next action (choose one — see Section 6 for the option list).

### Sufficiency stop checklist (Part J) — stop a line when all apply
- The approved minimum evidence exists.
- Remaining uncertainty is within the accepted limit.
- Additional runs are unlikely to change the decision.
- Required threat, condition, and configuration coverage exists.
- The evidence authority accepts the level of confidence.

### Futility stop checklist (Part J) — stop a line when any applies
- Required systems, truth, conditions, or authorities cannot be restored.
- Remaining events cannot support the intended conclusion.
- The likely information gain does not justify safety, time, or cost.
- A design flaw requires a new campaign.

Rule: Record the decision and the evidence gap left open.

### Completed-campaign synthesis checklist (Part K) — before final findings
1. Freeze the included-run manifest.
2. Freeze analytical code and parameters.
3. Reproduce every P1 result from retained data.
4. Conduct independent review of critical calculations.
5. Assess missingness and exclusion bias.
6. Reconcile conflicting sources.
7. Compare results across configurations, threats, conditions, operators, and procedures.
8. Identify performance boundaries and trade-offs.
9. Assess mission-thread consequences.
10. Define evidence life and staleness triggers.

### Analysis-complete gate (verbatim conditions)
Analysis is complete only when:
- every decision-relevant result is reproducible,
- every finding is traceable to adjudicated evidence,
- uncertainty and alternatives are explicit,
- applicability is bounded, and
- every remaining gap has a stated effect on the customer decision.

## 4. Templates, forms & cards

The page defines record structures rather than visual layouts. Each maps to a form:

1. **Analysis input manifest** (versioned): admitted runs; analytical code, configuration, environment. Sections: run list, provenance.
2. **Run-validity adjudication record** (versioned): review-item assessments (8 items, Part B) + decision fields (final status, measures allowed, comparisons allowed, limits, repeat decision, dissent, approver, time) + prior-version link and reason for change.
3. **Correction record**: source value, corrected value, rule/reason, person, time, effect on results.
4. **Run-level measure result record**: fields in Section 1 above, including result label enum.
5. **Causal diagnosis record**: observation, 9-domain candidate-cause list, discriminating evidence, root-cause classification, corrective action, verification test.
6. **Finding record (FIND)**: 18 fields as listed in Section 1; strength enum; applies/does-not-apply condition bounds.
7. **Adaptation record**: 11 fields as listed in Section 1.
8. **Coverage map**: matrix of cells (condition × configuration × threat implied) with per-cell valid-sample count against a minimum, plus empty/thin/redundant flags. [AMBIGUOUS: exact matrix axes not defined on this page; the test-design section defines the matrix]

## 5. Outputs & deliverables

- **Versioned analysis input manifest** — produced at evidence intake; frozen at campaign end.
- **Adjudication records** (one per run per version) — produced by the daily run-validity board.
- **Run-level measure results** with uncertainty and threshold comparison — produced after QC, per allowed measure.
- **Aggregate results report** — per measure across runs: counts, central tendency, spread, worst valid case, confidence/credible interval, breakdowns, sensitivity, missingness pattern.
- **Causal diagnosis records** — one per consequential failure or anomaly.
- **Finding records (FIND)** — the core evidence deliverable feeding customer decisions; each carries the findings-ladder level and strength rating.
- **Adaptation records** — one per replanning action; includes superseding card/plan version.
- **Daily evidence review output** — updated hypothesis status, coverage map, decision-uncertainty statement, and the selected next action.
- **Completed-campaign synthesis** — reproduced P1 results, independent review, bias assessment, cross-condition comparison, performance boundaries and trade-offs, mission-thread consequences, evidence life and staleness triggers.

## 6. Workflow & sequencing logic

### Pipeline order (Parts A → K)
Evidence intake → run-validity adjudication → analytical QC → run-level measures → aggregation → causal diagnosis (as triggered) → finding records → daily evidence review → adaptive replanning → sufficiency/futility decision → completed-campaign synthesis → analysis-complete gate.

### Gates and ordering rules
- No run enters analysis without a recorded validity status (gate before Part A pipeline entry).
- Analytical QC (Part C) precedes metric production (Part D).
- Define the experimental unit before aggregation (Part E precondition).
- Check existing records before adding a live run for diagnosis (Part F step 5).
- Freeze manifest and code before final findings (Part K steps 1-2).
- Analysis-complete gate closes the section (conditions in Section 3).

### Cadence
- Run-validity board: end of each day, and whenever new data changes a prior decision.
- Daily evidence review: the fixed 5-step sequence (Part H).

### Versioning and traceability rules
- A changed validity status creates a new adjudication version; preserve the prior decision and reason.
- Never overwrite the original run list; issue a superseding version.
- Every correction preserves the source value.
- Preserve the raw evidence package.
- Quick-look files must never become the authoritative analytical source.

### Next-action options (Part H step 5 — choose exactly one)
1. Execute the next issued card.
2. Repeat for validity or stability.
3. Isolate one variable.
4. Repair and verify the evidence chain.
5. Revise a threat or condition within the approved policy.
6. Introduce a new diagnostic card.
7. Stop a low-value line.
8. End testing for sufficiency.
9. End testing for futility or resource limit.

### Findings ladder (Part G — five levels; never merge levels)
1. **Observation:** What a valid source recorded.
2. **Calculation:** What the approved method produced.
3. **Interpretation:** What the result means under tested conditions.
4. **Recommendation:** What action the evidence supports.
5. **Decision:** What the authorized customer chooses.

### Operational hooks from governance content (one line each)
- Safety authority attends the run-validity board when safety evidence is involved.
- Adaptation records carry a required-approval field.
- Finding records carry a review-and-approval state field.
- The evidence authority must accept the confidence level before a sufficiency stop.

## 7. Worked examples & real data

None found.

## 8. Product implications

1. **Run adjudication board UI.** A daily board view listing each run with the 8 review items, a status enum (valid/conditional/invalid/pending), measures-allowed and comparisons-allowed pickers, limits, repeat decision, dissent, approver, and timestamp. Status changes must create a new version and keep the old one visible.
2. **Hard analysis gate.** The app must block a run from measure computation and aggregation until it has a recorded validity status, and must exclude invalid runs from aggregates automatically.
3. **Measure computation with provenance.** Per-run per-measure result records that store the value, uncertainty, threshold/objective comparison, the pass/miss/borderline/descriptive/unavailable label, intermediate values, and links back to source RUN/CFG/THR/COND records.
4. **Aggregation guardrails.** When the user aggregates, the app must enforce or warn on the five do-not-combine rules (mixed baselines, mixed threat profiles, non-independent samples, valid+invalid, pre/post-change) and always show run counts by category.
5. **Coverage map.** A live matrix (condition × configuration × threat) with per-cell valid-run counts vs. minimum sample, highlighting empty, thin, and redundant cells; updated after each adjudication.
6. **Daily review wizard.** A guided 5-step flow (reconcile → hypotheses → coverage → uncertainty → next action) ending in exactly one selected next action from the 9-option list; the selection generates an adaptation record when it changes the plan.
7. **Adaptation records with superseding versions.** Replanning must never edit the issued run list in place; it issues a new card/plan version linked to the adaptation record with its 11 fields including required approval.
8. **Finding record builder.** A structured FIND form with all 18 fields, the strength enum, the findings-ladder level, and mandatory links to DEC/Q/CLM/HYP and supporting/contradicting RUN records.
9. **Correction and outlier logging.** Any edited data value requires a correction record; outlier exclusion requires citing a preapproved rule or producing with/without results side by side.
10. **Campaign closeout flow.** Freeze manifest and parameters, reproduce P1 results, run the 10-step synthesis checklist, and evaluate the analysis-complete gate before findings can be exported.
