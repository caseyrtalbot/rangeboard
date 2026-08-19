# Test Cards & Controlled Test Execution (sections 04 + 15)

## Sources fetched

- "04 — Test Cards & Controlled Test Execution" — https://app.notion.com/p/b0f923891bf8417a8871362e85c87ba2
- "15 — Test Card Application" — https://app.notion.com/p/3c16f36564f7806292c2f273c9119d7d

Cross-references found inside page 15 but NOT fetched (assigned to other agents per the brief's page map):

- Measure registry reference: https://app.notion.com/p/9e41125f6302483eb08877541a5430a5 (measure dictionary / evidence planning scope)
- Observation/calculation/interpretation separation reference: https://app.notion.com/p/7e11e631947543688ee95453acea5913 (analysis scope)
- Page 15 also links back to page 04 (already fetched above).

No `<page url>` sub-page tags existed inside either assigned page; recursion complete.

---

## 1. Input variables & fields

### 1.1 Test object record (page 15, "Define")

Types of test object the user may select:

1. A component.
2. A sensor.
3. An algorithm or model.
4. A software release.
5. A subsystem.
6. An integrated system.
7. An operator procedure.
8. A human-machine team.
9. An end-to-end mission thread.

Test object record fields:

- Name and description.
- Manufacturer and model.
- Hardware version.
- Software and firmware versions.
- Configuration.
- Interfaces.
- Operator procedure.
- Training state.
- Intended function.
- Known limits.
- Prior results.
- Comparison baseline.

### 1.2 Customer question (page 15)

Question pattern enum (one per question):

- **Capability:** Can the system do the required task?
- **Performance:** How well does it perform?
- **Comparison:** Which system or configuration performs better?
- **Sensitivity:** Which variables change performance?
- **Boundary:** Where does performance begin to fail?
- **Reliability:** How consistently does it perform?
- **Diagnosis:** Why did a failure occur?
- **Regression:** Did a change damage a supported capability?
- **Mission effect:** Does component performance support the required mission outcome?

Rule: the application should identify vague terms such as "usable," "early enough," and "reliably," and ask the user to quantify them.

### 1.3 Measure builder fields (page 15, "Quantify")

For each measure, collect:

- Measure name.
- Measure type.
- Definition.
- Unit.
- Formula.
- Experimental unit.
- Start event.
- Stop event.
- Required source fields.
- Ground-truth source.
- Expected value or range.
- Minimum acceptable value.
- Objective value.
- Measurement error.
- Missing-data rule.
- Invalid-data rule.
- Aggregation method.
- Required repetitions.
- Confidence or uncertainty requirement.

Measure type enum:

- Continuous values.
- Binary outcomes.
- Counts.
- Rates.
- Categories.
- Time-to-event values.
- Distances.
- Position errors.
- Probabilities.
- Human ratings.
- Composite mission outcomes.

Users must also be able to create and save custom measures. The full measure registry structure lives in the measure-dictionary section (other agent's scope).

### 1.4 Hypothesis record (page 15)

Guided sentence format:

> Under **[configuration and conditions]**, **[test object]** will produce **[observable result]**, measured by **[measure]**, relative to **[threshold, baseline, or alternative]**.

Also collect:

- Null hypothesis.
- Alternative hypothesis.
- Predicted value or range.
- Expected direction of change.
- Expected variability.
- Competing explanations.
- Result that would support the hypothesis.
- Result that would contradict it.
- Result that would remain inconclusive.
- Assumptions.
- Confidence required.

Prediction type enum:

- Single predicted value.
- Predicted range.
- Minimum or maximum bound.
- Expected distribution.
- Rank order.
- Directional prediction.
- Pass or miss prediction.
- No-difference prediction.
- Failure-boundary prediction.

Rule: the user states the prediction before the test; the application compares prediction with actual result after the run.

### 1.5 Factor builder (page 15, "Test design workspace")

Factor classification enum (each factor gets exactly one):

- Changed on purpose.
- Held constant.
- Recorded but not controlled.
- Unknown or unobserved.

Example factors:

- System configuration.
- Threat type.
- Threat speed.
- Altitude.
- Route.
- Range.
- Weather.
- Illumination.
- Electromagnetic conditions.
- Network state.
- Operator.
- Workload.
- Battery state.
- Trial order.
- Time of day.

### 1.6 Execution role assignments (page 04, Part B)

For each run, name:

- Test conductor.
- Safety authority.
- Range-control contact.
- System operator.
- System technical lead.
- Red or threat lead.
- Data monitor.
- Ground-truth operator.
- Run logger.
- Deployment strategist.
- Customer or evidence-authority witness.

Authority rules:

- Only the test conductor controls the run sequence.
- Any authorized person may call the approved safety stop.
- The data monitor may call a data hold or stop under the card.
- The deployment strategist controls evidence release and the next-run decision.

### 1.7 Actual-state capture fields (page 15, "Execute")

The application must distinguish planned values from actual values. Capture:

- Actual configuration.
- Actual threat behavior.
- Actual weather.
- Actual route and geometry.
- Actual operators.
- Actual procedure.
- Actual start and stop times.
- Actual data-source status.
- Deviations.
- Direct observations.

### 1.8 Run status field (page 04, Part J)

Enum, exactly one per run, with definitions:

- **Valid** — The actual configuration, threat, conditions, procedure, instrumentation, data, and ground truth satisfy all validity rules for the stated measures.
- **Conditionally valid** — A known difference limits specific measures, comparisons, or conditions, but other stated uses remain defensible. List allowed and prohibited uses.
- **Invalid** — A failure prevents the run from supporting its intended measure or hypothesis. Preserve the run and reason. It may still support diagnosis, process learning, or safety analysis.

Rule: no status means the run is not available for analysis.

### 1.9 Go/no-go decision field (page 04, Part C)

Enum: go, conditional go, hold, or no-go — recorded with time and approvers.

### 1.10 Hypothesis evaluation outcome field (page 15, "Assess")

Enum:

- Supported.
- Directionally supported.
- Contradicted.
- Inconclusive.
- Not tested.

Displayed alongside: supporting runs, contradicting runs, effect size, variability, confidence or uncertainty, conditions where the result applies, important confounders, alternative explanations, additional evidence needed.

### 1.11 Finding record (page 15, "Act")

For each finding, produce:

- Plain-language finding.
- Quantified result.
- Evidence strength.
- Tested configuration.
- Tested conditions.
- Performance boundary.
- Supporting and contradicting runs.
- Comparison with the prediction.
- Comparison with the threshold.
- Customer effect.
- Recommended action.
- Restrictions.
- Remaining uncertainty.
- Recommended next test.

Practical action catalog (selectable action types):

- Use the tested configuration.
- Use it only under stated conditions.
- Change a threshold or setting.
- Correct a specific defect.
- Change the operator procedure.
- Add training.
- Integrate another component.
- Test an unmeasured boundary.
- Repeat a condition with more trials.
- Run a diagnostic experiment.
- Conduct focused regression.
- Reject the tested approach.

---

## 2. Calculations & formulas

### 2.1 Test matrix run-count formula (page 15)

```
Configuration
× Threat
× Condition
× Method
× Repetition
= Planned runs
```

Inputs: user-selected configurations, threats, conditions, and repetitions. Output: the generated matrix of planned runs. Computed in the Design phase, before card generation.

The matrix generator must also show: total runs, estimated duration, coverage by question, coverage by condition, required assets, missing controls, planned repetitions, minimum valid evidence, and drop order if time is lost.

### 2.2 Quick-look calculations (page 15, after each run)

Compute available measures such as:

- Detection range.
- Response latency.
- Track duration.
- Track continuity.
- Classification result.
- Intercept result.
- Data completeness.
- Difference from the prediction.
- Difference from the threshold.
- Difference from the comparison baseline.

Computed immediately after each run, from run data. [AMBIGUOUS: no closed-form math given in these pages for the individual measures; formulas are held in the measure registry / quantitative sections owned by other agents. Each measure record carries its own `Formula` field, section 1.3.]

Day-start requirement (page 04, Part C): during instrumentation checkout the team must "Compute at least one P1 measure" from a representative sample event before go/no-go.

### 2.3 Calculation engine requirements (page 15, "Assess")

The calculation engine must:

- Check units.
- Check required fields.
- Align time.
- Apply start and stop events.
- Apply missing-data rules.
- Compute run-level measures.
- Aggregate across valid runs.
- Calculate variability.
- Calculate uncertainty.
- Compare results with thresholds.
- Compare alternatives.
- Compare predictions with results.
- Preserve intermediate calculations.

No other explicit formulas found in these two pages.

---

## 3. Checklists

### 3.1 Day-start procedure (page 04, Part C)

Complete before the first live run. Record each item and responsible person. Run by the team, per the responsible role recorded on each item.

**Site and authority**

1. Confirm the current range window.
2. Confirm airspace and spectrum status.
3. Confirm weather and forecast against limits.
4. Confirm site boundaries, access, security, and nonparticipant controls.
5. Confirm emergency, medical, fire, recovery, and incident contacts.
6. Confirm active permits, approvals, and waivers.
7. Confirm the named stop and restart authorities are present or reachable.

**People**

1. Muster all required roles.
2. Confirm qualifications and duty limits.
3. Review fatigue, heat, cold, hydration, and shift risks.
4. Brief the day objective, run list, minimum viable campaign, expected decision points, and drop order.
5. Brief communications channels and loss-of-communications action.
6. Rehearse start, pause, stop, and emergency calls.

**Systems and configuration**

1. Inspect each system and support item.
2. Load the released configuration.
3. Verify hardware, software, firmware, mission data, settings, network, interfaces, and operator procedure.
4. Export or capture the configuration record.
5. Confirm known defects, maintenance state, battery or fuel state, spares, and recovery tools.
6. Confirm red configuration and profile assets.

**Instrumentation and data**

1. Inspect and calibrate required instruments.
2. Verify ground-truth sources against a known reference.
3. Synchronize all recorders to the common time source.
4. Record offsets and drift status.
5. Verify storage space, permissions, naming, and backup targets.
6. Start a representative sample event.
7. Capture it through every required source.
8. Ingest the data.
9. Compute at least one P1 measure.
10. Verify data-quality alerts and fallback paths.
11. Record the evidence-chain acceptance result.

**Go/no-go**

1. Review open defects and waivers.
2. State each affected measure and conclusion.
3. Obtain the daily safety decision.
4. Obtain the daily range, airspace, spectrum, security, and system decisions.
5. Obtain the deployment strategist's evidence-readiness decision.
6. Record go, conditional go, hold, or no-go with time and approvers.

### 3.2 Pre-run release check (page 04, Part D)

Run by the test conductor as a challenge-and-response check, immediately before each run. Confirm:

- Correct card and version.
- Unique run identifier.
- Run purpose and matrix cell.
- Required repetition and reason for this run now.
- Correct blue and red configurations.
- Correct operators and procedures.
- Actual weather, environment, spectrum, airspace, and range state.
- Required authorities active.
- Threat profile loaded and understood.
- Blinding state preserved.
- Safety area clear.
- Emergency and stop communications working.
- Instruments calibrated.
- Ground truth active.
- Common time within tolerance.
- Recorders and storage ready.
- Data monitor receiving required sources.
- Preconditions complete.
- No unrecorded change since the last run.

Conditional rule: if any answer is unknown, hold the run.

### 3.3 Run initiation sequence (page 04, Part E)

Use the site-approved words. The sequence must include:

1. The test conductor states card ID, version, run ID, purpose, and expected duration.
2. Each role reports ready or not ready.
3. The run logger records the ready state and time.
4. The data monitor confirms recording and source health.
5. The ground-truth operator confirms truth recording.
6. The safety authority confirms the operating area and safety state.
7. The test conductor authorizes red and blue to enter the initial state.
8. The test conductor makes the approved start call.
9. The run logger records the authoritative start time.
10. The procedure begins exactly as written.

Rule: do not start recorders at the same instant as the active event. Use the pre-event margin defined by the card.

### 3.4 In-run duty lists (page 04, Part F)

**Test conductor:**

- Keeps the approved sequence.
- Makes required phase-transition calls.
- Prevents coaching, helpful tuning, or unapproved resets.
- Controls pauses and restarts.
- Maintains communications discipline.

**Run logger time-tags:**

- Start and stop.
- Threat launch and recovery.
- Phase transitions.
- Operator calls and actions.
- System alerts.
- Track, classification, decision, assignment, effect, and assessment events when called.
- Weather or spectrum changes.
- Data warnings.
- Pauses, deviations, anomalies, aborts, and restarts.

**Data monitor watches:**

- Required source presence.
- Update rate and packet loss.
- Ground-truth health.
- Clock offset or drift.
- Storage and network health.
- Identifier mapping.
- Data-quality stop limits.

**Deployment strategist:**

- Guards the variable plan.
- Confirms that the run still serves the stated purpose.
- Records evidence-relevant observations.
- Does not direct technical troubleshooting during the active run.

### 3.5 Safety or regulatory stop (page 04, Part G)

1. Any authorized participant uses the approved stop word.
2. All roles enter the defined safe state.
3. The test conductor acknowledges the stop.
4. The safety authority controls the response.
5. Preserve data and system state when safe.
6. Do not restart until the named authority clears the cause and the card restart criteria pass.

### 3.6 Data-quality or equipment stop (page 04, Part G)

1. The data monitor or technical lead reports the condition.
2. The test conductor pauses or stops under the card.
3. Preserve all data and state.
4. Record the time, source, symptoms, and last known good point.
5. Determine which measures are affected.
6. Decide whether the run can continue for another valid purpose.
7. Obtain degraded-operation approval when required.

### 3.7 Procedure deviation (page 04, Part G)

If the procedure differs from the card:

1. Do not edit the card.
2. Complete or stop according to the existing rules.
3. Record the exact difference and time.
4. Identify variables and measures affected.
5. Adjudicate after the run.

### 3.8 Anomaly response (page 04, Part H)

Use this order:

1. Make the activity safe.
2. Preserve raw data, logs, configuration, physical state, and operator recollection.
3. Record the observation before discussing causes.
4. Separate system fault, test artifact, environmental effect, operator effect, and unknown cause.
5. Quarantine suspect data.
6. Decide whether immediate troubleshooting would destroy evidence.
7. Apply the approved repeat or diagnostic policy.
8. Create an anomaly record.
9. Link all later diagnosis and corrective work.

Rule: do not let a vendor explanation close the anomaly without evidence.

### 3.9 Run completion (page 04, Part I)

1. The test conductor makes the approved stop or completion call.
2. Red and blue enter the defined safe or recovery state.
3. Continue recording for the post-event margin.
4. Stop recorders in the written order.
5. Confirm threat and system recovery.
6. Record actual configuration, threat, operators, conditions, and procedure.
7. Save and lock the run log.
8. Collect perishable observations in ten minutes or less.
9. Do not form campaign conclusions in the immediate debrief.

### 3.10 Immediate factual debrief (page 04, Part I; page 15, "Assess")

Page 04 version — state only:

- What was planned.
- What occurred in time order.
- What differed.
- What sources recorded.
- What warnings or failures occurred.
- What each operator directly observed.

Rules: label opinion as opinion; save causal interpretation for analysis.

Page 15 version — collect:

- What was planned.
- What occurred.
- What differed.
- What the operators observed.
- What the instruments recorded.
- Which sources failed.
- Which result was unexpected.
- Whether a repeat is needed.

Rule: keep observations separate from explanations.

### 3.11 Post-run data validation (page 04, Part J)

Before a dependent next run, check:

- All required files present.
- File names and identifiers correct.
- Files readable and not corrupt.
- Ground truth complete enough for required measures.
- Time offsets within measure tolerances.
- Configuration record attached.
- Threat and condition records complete.
- Required event markers present.
- Data-quality thresholds met.
- Deviations recorded.
- Backup complete.

Then assign one run status (see section 1.8).

### 3.12 End-of-day procedure (page 04, Part L)

1. Reconcile every planned and actual run.
2. Confirm a status and reason for every run.
3. Complete end-of-day calibration and clock checks.
4. Copy data to two approved locations.
5. Verify copy integrity and access.
6. Secure classified, CUI, proprietary, or controlled data.
7. Update configuration, maintenance, consumables, battery, and spares status.
8. Hold the run-validity board.
9. Update evidence gained, gaps, risks, and anomalies.
10. Re-rank the next-day run list.
11. Issue all approved card or plan changes.
12. Brief the next day's first-run conditions.
13. Secure the site and equipment.

### 3.13 Design checks (page 15, "Test design workspace")

The application should warn when:

- A question has no measure.
- A measure has no usable source.
- A measure has no independent truth source.
- A hypothesis cannot be contradicted.
- A threshold has no defined basis.
- A comparison changes several important factors at once.
- Repeated samples are incorrectly treated as independent runs.
- No baseline or control condition exists.
- The planned repetitions cannot support the intended conclusion.
- Trial order can create learning, fatigue, or heating bias.
- The card does not collect the data required for the measure.
- The proposed test cannot answer the customer's question.

---

## 4. Templates, forms & cards

### 4.1 The test card — canonical 20-field structure (page 04, Part A)

Every card must contain these fields in this order:

1. Card identifier, title, version, status, owner, and approvers.
2. Customer decision, question, claim, and hypothesis identifiers.
3. One-sentence run purpose.
4. Test-matrix cell and planned repetition number.
5. System boundary and configuration baseline.
6. Threat profile and red-control bounds.
7. Environmental and operating condition.
8. Operators, roles, procedures, and training state.
9. Independent variables, held controls, and recorded covariates.
10. Measures and thresholds.
11. Source data, independent ground truth, calibration, and time tolerances.
12. Preconditions and required authorities.
13. Numbered execution procedure.
14. Expected nominal result and known expected artifacts.
15. Safety, regulatory, equipment, data-quality, and security stop conditions.
16. Restart and degraded-operation rules.
17. Run-validity and repeat rules.
18. Required files, logs, observations, and quick-look products.
19. Blinding and information-control rules.
20. Deviation area and links to change records.

Field 2 links the card to canonical record identifiers (DEC, Q, CLM, HYP families).

### 4.2 Card-writing rules (page 04)

- Write one action per numbered step.
- Name the role that performs each action.
- Use observable completion criteria.
- Include recorder start and stop steps.
- Include the exact start, stop, pause, and abort words approved for the site.
- Mark steps that can silently invalidate the run.
- State what red may vary and what red must hold.
- State what operators may know before the run.
- State how long to record before and after the active event.
- State the required reset before a repeat.
- Reference canonical records instead of copying uncontrolled values.

### 4.3 Card lifecycle: review and issue (page 04)

1. Draft from the approved design.
2. Review with the test conductor.
3. Review technical steps with engineering and the system owner.
4. Review threat steps with the red lead.
5. Review data steps with the data and analysis leads.
6. Review hazards and stop rules with the safety authority.
7. Review range, airspace, spectrum, security, and legal controls.
8. Run the cold-reader test with a qualified person who did not draft it.
9. Execute a dry run with all people, systems, truth sources, and recorders.
10. Correct the card.
11. Obtain required approvals.
12. Issue the execution version.
13. Freeze it until the run ends.

Gate rule: a card that fails the cold-reader or dry-run test is not ready.

### 4.4 Card immutability and run-identity rules (page 04, header callout)

- One issued card controls one run type.
- One run receives one immutable run identifier.
- What differs from the card becomes a deviation.
- The team never edits the card to match what occurred.

### 4.5 Generated test-card content (page 15, "Test-card generator")

A card pulls from the design; the user should not enter the same information again. Each generated card should contain:

- Test object and configuration.
- Question.
- Hypothesis.
- Prediction.
- Measures.
- Independent variable.
- Held controls.
- Recorded conditions.
- Required repetition.
- Preconditions.
- Numbered procedure.
- Required data.
- Event markers.
- Expected result.
- Known artifacts.
- Stop conditions.
- Validity rules.
- Required outputs.

Page 15 states the manual's 20-field card structure (section 4.1) is the base structure for this generator.

### 4.6 Method selector templates (page 15)

Each method is triggered by a question form and prescribes design elements:

**Threshold verification** — "Does performance meet a defined requirement?"
- Requirement threshold. Borderline rule. Repetition. Measurement uncertainty. Pass, miss, and inconclusive logic.

**Characterization** — "How does performance change across conditions?"
- Parameter sweep. Range of each factor. Center and boundary conditions. Response curve. Performance envelope.

**Comparison** — "Which system or configuration performs better?"
- Common conditions. Paired or blocked trials. Randomized order. Defined comparison measure. Minimum meaningful difference.

**Controlled experiment** — "Does this variable cause a change in the result?"
- Independent variable. Dependent measure. Held controls. Covariates. Randomization. Competing explanations.

**Boundary or stress test** — "Where does performance begin to fail?"
- Increasing challenge level. Stop boundary. Recovery procedure. Boundary confirmation runs. Failure-mode capture.

**Diagnostic test** — "What caused the observed failure?"
- Candidate causes. Evidence expected for each cause. One discriminating change at a time. Confirmation test.

**Reliability test** — "How consistently does the system perform?"
- Repeated independent trials. Failure definition. Exposure time or opportunity count. Reliability or failure-rate measure. Recovery and maintenance effects.

**Regression test** — "Did a system change affect an established result?"
- Changed item. Possible failure mechanism. Prior evidence baseline. Affected measures. Minimum repeat conditions. Comparison with prior results.

### 4.7 Day-of screens (page 15, "Execute")

**Day dashboard shows:**

- Day objective.
- Questions being addressed.
- Test coverage completed.
- Current environmental conditions.
- Current system configuration.
- Available assets.
- Planned and completed runs.
- Valid, questionable, and failed runs.
- Remaining priority runs.
- Estimated time remaining.

**Current-run screen shows only:**

- Card and run identifiers.
- Purpose.
- Hypothesis and prediction.
- Current configuration.
- Current threat and condition.
- Procedure.
- Role assignments.
- Required recorders.
- Data-source health.
- Large event controls.

**Event controls (each creates a timestamp):**

- Start recording.
- Start run.
- Mark event.
- Mark phase transition.
- Record operator action.
- Record system response.
- Add observation.
- Mark deviation.
- Mark anomaly.
- Pause.
- Stop.
- Complete run.

### 4.8 Data intake form (page 15, "Assess")

Allow users to:

- Upload CSV or Excel data.
- Connect source files to run identifiers.
- Map columns to measure inputs.
- Enter manual observations.
- Import event logs.
- Link video and telemetry.
- Mark missing or corrupt data.
- Select the analysis version.

---

## 5. Outputs & deliverables

### 5.1 Before-test compile outputs (page 15, "Prepare")

Generated from the approved design, before execution:

- Test objective summary.
- Test-object profile.
- Hypothesis and prediction sheet.
- Measure dictionary.
- Variable and factor list.
- Test matrix.
- Prioritized run list.
- Test cards.
- Required data-field schema.
- Instrumentation plan.
- Expected-results sheet.
- Day schedule.
- Spreadsheet workbook.
- Printable field package.

### 5.2 Run evidence package (page 04, Part K)

Stored together per run, produced at run completion/validation:

- Issued card and version.
- Run log.
- Configuration export.
- Threat and condition records.
- Authority and readiness references.
- Raw source data.
- Ground-truth data.
- Calibration and synchronization records.
- Operator and observer notes.
- Deviations and anomalies.
- Data-quality result.
- Run-status decision and approvers.
- Quick-look product.
- Checksums or custody records when required.

### 5.3 Post-run recommendation output (page 15)

After quick-look calculations the application recommends one of (user makes the final choice):

- Accept the run for later review.
- Repeat the run.
- Continue to the next condition.
- Hold for missing data.
- Add a diagnostic run.
- Stop because sufficient coverage exists.

### 5.4 Finding and action deliverables (page 15, "Act")

Result chain each finding must complete:

```
Measured result
→ Performance meaning
→ Mission or customer effect
→ Practical action
→ Restriction or condition
→ Next evidence need
```

Finding record fields: see section 1.11. Final exports named in the first-version loop: a workbook and test report.

---

## 6. Workflow & sequencing logic

### 6.1 End-to-end chain (page 15)

```
Customer need
→ Test object
→ Test question
→ Parameters and measures
→ Hypothesis and prediction
→ Test method
→ Test design
→ Test cards
→ Test execution
→ Calculations
→ Hypothesis evaluation
→ Finding
→ Practical action
```

### 6.2 Application areas and workspaces (page 15)

Six primary areas: **Define, Design, Prepare, Execute, Assess, Act.** Safety, authority, security, and readiness live in a supporting **Constraints** panel that can block a test but must not dominate the workflow.

Three named workspaces:

- **Test Builder** (before execution): customer question, test object, measures, hypotheses, predictions, method selection, factor design, test matrix, card generation.
- **Run Desk** (during execution): day dashboard, current card, timestamped events, actual conditions, observations, quick-look measures, coverage status, next-run decision.
- **Evidence Lab** (after execution): data import, measure calculations, prediction comparison, hypothesis evaluation, statistical summaries, findings, recommended actions, reports and exports.

### 6.3 Execution-day rhythm (page 04)

Ordering: Day-start procedure (Part C, before first live run) → per run: Pre-run release (Part D) → Run initiation (Part E) → Control during run (Part F) → Stop/pause/abort/restart as needed (Part G) → Anomaly response as needed (Part H) → Run completion + immediate factual debrief (Part I) → Data validation and run status (Part J) → Run evidence package (Part K) → End-of-day procedure (Part L).

### 6.4 Gates and dependency rules (both pages)

- Card issue gate: a card that fails the cold-reader test or dry run is not ready (Part A).
- Issued cards are frozen until the run ends (Part A step 13).
- Pre-run hold rule: if any pre-run answer is unknown, hold the run (Part D).
- Recorder margin rule: never start recorders at the same instant as the active event; use the card's pre-event margin; continue recording for the post-event margin after the run (Parts E, I).
- Dependent-run gate: complete the Part J data-validation checks before a dependent next run.
- Restart gate: after a safety stop, no restart until the named authority clears the cause and the card restart criteria pass (Part G).
- Perishable-observation window: collect perishable observations in ten minutes or less after run completion (Part I).
- No campaign conclusions in the immediate debrief (Part I).
- Execution gate (Part J/L): "A run enters campaign analysis only when the record establishes what occurred, which controls held, which data are valid, which measures may use the run, and which conclusions are prohibited."
- Adaptation between days: hold the run-validity board, re-rank the next-day run list, and issue approved card or plan changes only at end of day (Part L).
- Deviation doctrine: never edit the card to match what occurred; record and adjudicate deviations after the run (header callout, Part G).
- Prediction-before-test rule: users must state expectations before the test; a test must not become a search for an interesting result after execution (page 15).

### 6.5 Focused first version — the complete loop (page 15)

1. Name the test object.
2. Enter the customer question.
3. Select or define the measures.
4. Create a hypothesis and prediction.
5. Select a test method.
6. Define variables and conditions.
7. Generate a test matrix.
8. Generate test cards.
9. Record runs on a tablet.
10. Import or enter results.
11. Calculate the measures.
12. Evaluate the hypothesis.
13. Produce a quantified finding.
14. Export a workbook and test report.

Administrative, safety, authority, and security controls support this loop without replacing it.

---

## 7. Worked examples & real data

### 7.1 Example testable question (page 15)

> Can configuration A detect and maintain a usable track on a Group 1 UAS early enough to support the required engagement timeline?

The vague terms flagged in this example: "usable," "early enough," "reliably."

### 7.2 Example C-UAS measure library (page 15)

- Probability of detection by range band.
- First-detection range.
- First-stable-track range.
- Track continuity.
- Track position error.
- Classification accuracy.
- False tracks per hour.
- Sensor-to-command latency.
- Track-to-decision latency.
- Decision-to-effect latency.
- Probability of intercept.
- Probability of defeat.
- End-to-end mission success.
- Operator intervention rate.
- Operator workload.
- Availability.
- Recovery time.

### 7.3 Real numbers

Only one explicit number in these pages: perishable observations must be collected in **ten minutes or less** after run completion (page 04, Part I). No JIATF-401 numeric data appears in these two pages; that lives in the case-study pages (agent 12 scope).

---

## 8. Product implications

1. **Card entity with the fixed 20-field schema, in order.** The card form and print layout must implement section 4.1 exactly, with field 2 as typed links to DEC/Q/CLM/HYP records and field 4 as a link to a test-matrix cell plus repetition number.
2. **Card lifecycle state machine.** States at minimum: Draft → per-discipline reviews → cold-reader pass → dry-run pass → Approved → Issued (frozen) → run complete. Editing an issued card must be blocked; changes route through end-of-day card-change issuance (CHG records). A failed cold-reader or dry run blocks issue.
3. **Immutable run identity.** Creating a run mints one immutable RUN identifier bound to one issued card version. Runs are never edited to match the card or vice versa; differences become deviation records (DEV).
4. **Card generation from design, no re-entry.** Cards must be compiled from upstream records (test object, question, hypothesis, measures, factors, matrix cell) by reference, per section 4.5 and card-writing rule "Reference canonical records instead of copying uncontrolled values."
5. **Structured card procedure steps.** Each procedure step needs: action text (one action), performing role, observable completion criterion, and flags for "can silently invalidate run" and recorder start/stop steps. Cards also carry site-approved start/stop/pause/abort words, pre/post-event recording margins, and required reset before repeat.
6. **Run Desk tablet UI.** Day dashboard and current-run screen exactly per section 4.7, with 12 large timestamping event controls, planned-versus-actual capture, and quick-look measures after each run with the 6-option next-run recommendation (user decides).
7. **Checklist engine.** Day-start (5 sub-checklists), pre-run challenge-and-response (19 items, hold on unknown), run initiation (10 ordered steps), stop/deviation/anomaly flows, run completion, data validation (11 checks), and end-of-day (13 steps) — each item tracks completer, time, and result.
8. **Run status adjudication.** Every run must receive Valid / Conditionally valid / Invalid with reasons; conditionally-valid runs list allowed and prohibited uses; unstatused runs are excluded from analysis. A run-validity board step exists at end of day.
9. **Role model.** Eleven named per-run roles with authority rules (conductor controls sequence; anyone calls safety stop; data monitor calls data hold; strategist controls evidence release and next-run decision) enforced in UI affordances.
10. **Design lint.** Implement the 12 design checks (section 3.13) as blocking or warning validations before card generation.
11. **Measure, hypothesis, factor, and method records** with the exact field lists and enums in sections 1.2–1.5 and the 8-method selector; matrix generator computes Configuration × Threat × Condition × Method × Repetition with drop order.
12. **Evidence packaging and export.** Per-run evidence package (14 components), before-test compile outputs (14 products including printable field package and spreadsheet workbook), and final finding/action records feeding a workbook and test report export.
