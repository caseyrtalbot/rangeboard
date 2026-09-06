# 14 - Quantitative Guide: Data, Calculations & Experiments (calculations engine source)

Extraction for the RangeBoard T&E Operations module. Agent 10.

## Sources fetched

- "14 - Quantitative Guide: Data, Calculations & Experiments" - https://app.notion.com/p/f0faab1dbc2e4c77bbe54674a5bd5735

Pages linked inside this page but NOT fetched (assigned to other agents per the brief page map):

- Measure dictionary reference (agent 9): https://app.notion.com/p/3c16f36564f78156b05cdb925422f320
- Experiment-pattern alignment reference (agent 9 or 11): https://app.notion.com/p/3c16f36564f781149d93ee0d42dea514
- 14 "Governing manual sections" mention-links: sections 00-13 of the manual, all owned by agents 1-11 (URLs: 628564afc2b24d35b1a6831ca2632d96, edd1fae9d7264cd3a44904a507e3c766, 9e41125f6302483eb08877541a5430a5, c7aed349e4704c8ba782b7e1db8d7267, b0f923891bf8417a8871362e85c87ba2, 7e11e631947543688ee95453acea5913, e50a083593db4a8baf6a6841bfa97aec, b41400f6b11943b8be7d9ffaad44c74c, 3c16f36564f7814c8d38d75a1530770f, 3c16f36564f781ff83b3d1fedf410a94, 3c16f36564f78156b05cdb925422f320, 3c16f36564f781fbbfbedb8388e08695, 3c16f36564f781788d23fb731ed2f14d, 3c16f36564f781149d93ee0d42dea514)

Page-level note (verbatim intent): "All examples on this page are illustrative. They are not Valkryn results."

Role boundary (operational hook, one line): the Deployment Strategist owns question, evidence logic, measure intent, design intent, validity rules, adaptation rules, and finding limits; the analysis lead owns approved calculations, code, models, and analytical versions.

---

## 1. Input variables & fields

### 1.1 Decision math fields (define per customer decision)

The strategist must define:

- The decision.
- The alternatives.
- The uncertainty that blocks the decision.
- The minimum meaningful difference.
- The acceptable performance threshold.
- The required evidence strength.
- The decision action for a meet, miss, mixed, or inconclusive result.

### 1.2 Measure definition fields (every measure record must identify)

- The experimental unit.
- The eligible opportunity.
- The event or outcome.
- The numerator and denominator.
- The start and stop events.
- The unit of measure.
- The independent truth source.
- The data fields.
- The time and coordinate rules.
- The missing, invalid, censored, and ambiguous-data rules.
- The calculation method.
- The uncertainty method.
- The threshold and its source.

### 1.3 Minimum fields for one measure (15 required questions a complete measure record must answer)

1. What question does the measure answer?
2. What is one independent unit?
3. When does the opportunity start and end?
4. What event counts as success?
5. What is the numerator?
6. What is the denominator?
7. Which data fields are required?
8. Which source is independent truth?
9. What clock and coordinate tolerances apply?
10. What calculation is used?
11. What data are missing, invalid, censored, unknown, or ambiguous?
12. What uncertainty is reported?
13. What threshold applies?
14. Which conditions may be combined?
15. Which conditions must remain separate?

### 1.4 Core concept definitions (data dictionary)

- **Experimental unit**: the smallest unit that can receive a condition and produce one reasonably independent result. Examples: one independently reset threat presentation; one complete handoff opportunity; one engagement opportunity; one complete raid; one operating-hour block; one system article over a defined mission period. A row is not always an experimental unit. Thousands of sensor reports from one flight are usually repeated measurements of one threat presentation, not thousands of independent tests.
- **Opportunity**: a valid chance for the event to occur. A detection opportunity begins when truth shows that a threat enters the approved eligible region. It ends when the threat exits, the vignette ends, or a defined censoring event occurs.
- **Event**: the defined occurrence that the measure needs. Examples: a valid detection; a stable track; a usable handoff; a decision; an intercept; a confirmed effect; a boundary crossing. Every event needs an observable rule. A label from the system under test is not independent truth by itself.
- **Outcome**: the result assigned to one experimental unit. Examples: success or failure; a latency; a detection range; a track error; a leaker count; a mission-success state.
- **Independent variable**: a factor changed on purpose. Examples: configuration, threat speed, route, raid size, network state, operator procedure.
- **Held control**: must remain fixed within an approved tolerance. A change can damage a direct comparison.
- **Recorded covariate**: not controlled, but measured because it can affect the result. Examples: weather, actual speed, operator experience, battery state, time of day.
- **Nuisance factor**: can affect the result but is not the main question. Control it, block on it, measure it, or state the risk.
- **Confounder**: changes with the independent variable and can provide another explanation. Example: Configuration B is always tested later in the day during worse weather; a difference can come from the configuration, the weather, or both.
- **Independence**: results are independent when one result does not materially determine another. Common dependence sources: the same threat article; the same operator; the same raid; the same day or weather block; the same battery or maintenance state; the same software fault; repeated updates from one trajectory. Use the highest defensible independent level. Preserve lower-level data for diagnosis.
- **Randomization**: changes run order by chance; protects against systematic order effects. Use when safe and practical. Do not randomize across unsafe or destructive transitions only to improve statistical appearance.
- **Blocking**: groups tests that share a nuisance factor. Examples: day, operator, threat article, site, weather regime, software build. Compare configurations within the same block when practical.
- **Replication**: repeats an independent experimental unit under the same defined condition. Several messages, tracks, or effects inside one run are not replications unless the design supports that claim.
- **Censoring**: part of the time at risk is known, but the event time is not fully observed. Example: a threat leaves the test volume before handoff occurs. Record the observed time and the censoring reason. Do not replace the missing event time with the timeout and call it a completed latency.
- **Threshold**: a decision boundary. Not part of the natural definition of a measure. Freeze thresholds before execution.

### 1.5 Threshold source order (enum, priority-ordered)

1. Law, regulation, or safety limit.
2. Contract or validated operational requirement.
3. Mission arithmetic.
4. Accepted comparison baseline.
5. Customer decision rule.
6. Analyst judgment that is clearly labeled.

### 1.6 Data-state enums (per run/outcome)

- **Missing**: expected data are absent.
- **Invalid**: a written validity rule failed.
- **Conditionally valid**: the run supports named measures or comparisons only.
- **Censored**: part of the time at risk is known, but the event time is incomplete.
- **Unknown outcome**: the opportunity is valid, but the decisive state cannot be classified.
- **No-test**: the intended opportunity did not occur under the approved rule.

### 1.7 Validity levels (enum, 4 levels)

1. Source validity.
2. Event validity.
3. Measure validity.
4. Allowed run use.

### 1.8 Uncertainty types (enum, 4) and interval types (enum, 4)

Uncertainty types (do not merge into one unsupported "high confidence" label):

- **Measurement uncertainty**: error in truth, timing, calibration, registration, or instrumentation.
- **Sampling uncertainty**: exists because the campaign observes a finite number of independent units.
- **Operational variability**: real change across threats, operators, environments, articles, conditions, or system behavior.
- **Model uncertainty**: from correlation, interpolation, simulation, classification, or analytical assumptions.

Interval types:

- **Confidence interval**: range from a repeated-sampling method for an estimated parameter (probability, mean, rate). It does not describe the range of future individual missions.
- **Credible interval**: probability statement under a Bayesian model and its prior.
- **Prediction interval**: range for a future observation.
- **Tolerance interval**: aims to contain a stated fraction of a population with stated confidence.

Practical rule (ask before accepting an interval): "Does this interval answer uncertainty about the average, the probability, a future mission, or the spread of the operating population?"

### 1.9 Sample-size planning inputs (define all)

- Primary measure.
- Experimental unit.
- Threshold or comparison.
- Minimum meaningful effect.
- Desired interval width or decision risk.
- Expected variability.
- Dependence structure.
- Planned condition cells.
- Expected valid-run fraction.
- Maximum feasible sample.
- Sequential looks and stop rules.

### 1.10 Threshold-design inputs (threshold-exceedance question)

- Unacceptable performance `p0`.
- Acceptable performance `p1`.
- False-accept risk.
- False-reject risk.
- Exact pass rule.
- Maximum sample.
- Sequential stopping rule.

Rules: the analysis lead should calculate the exact rule or simulate it before execution. Do not choose the required success count after seeing results.

### 1.11 Two-probability comparison inputs

- Baseline probability.
- Minimum meaningful difference or risk ratio.
- Allocation between configurations.
- One-sided or two-sided question.
- Confidence and power.
- Pairing.
- Blocking.
- Order and carryover effects.

Use an exact calculation or simulation for the final sample.

### 1.12 Continuous-outcome planning inputs (latency, range, error, warning time, recovery time, workload)

- The minimum meaningful difference.
- Expected spread.
- Desired confidence and power.
- Paired or independent design.
- Clustering and repeated measurements.
- Expected missing or censored data.

The analysis lead performs the final power calculation.

### 1.13 Sequential/adaptive predefinition fields (predefine before execution)

- Initial sample.
- Review times.
- Quantities reviewed.
- Sufficiency boundary.
- Futility boundary.
- Maximum sample.
- Allowed factor-space changes.
- Confirmatory sample held back.
- Treatment of repeated looks.

### 1.14 Adaptive next-run scoring criteria (assess per candidate next event)

- Decision effect.
- Current uncertainty.
- Ability to distinguish causes.
- Expected information gain.
- Acceptance value.
- Comparability.
- Range time.
- Safety and technical risk.
- Asset scarcity.
- Schedule effect.

### 1.15 Association gate parameters (truth-to-source match rule)

Rule can use:

- Maximum time difference.
- Maximum position or angle difference.
- Identity or class.
- Kinematic consistency.
- Persistence.

Do not force a match when more than one truth object fits. Mark it ambiguous.

### 1.16 Spatial registration controls (per position source)

- Datum.
- Coordinate frame.
- Origin.
- Axis order.
- Units.
- Altitude reference.
- Sensor reference point.
- Lever arm.
- Boresight.
- Transformation version.

Use a known object or trajectory to estimate residual bias.

### 1.17 Calibration record fields

- As-found value.
- Adjustment.
- As-left value.
- Uncertainty.
- Valid range.
- Expiration.

### 1.18 Data-health thresholds and source states

Each source needs these states: green, warning, stop, degraded, unknown.

Controlled parameters per source:

- Expected update rate.
- Minimum update rate.
- Maximum gap.
- Maximum total loss.
- Maximum critical-phase loss.
- Maximum clock offset.
- Maximum drift.
- Coverage.
- Calibration.
- Storage or buffer margin.

A campaign-wide average cannot replace a measure-specific limit.

### 1.19 Regression record fields

- Formula.
- Factor coding.
- Interactions.
- Reference levels.
- Inclusion and exclusion rules.
- Software and version.
- Model checks.
- Sensitivity to other reasonable models.
- Interpolation region.
- Prohibited extrapolation.

Association is not causation unless the design supports causal attribution.

### 1.20 Evidence-accounting counts (always preserve and report, per measure)

- Planned.
- Attempted.
- Eligible.
- Valid.
- Conditionally valid.
- Invalid.
- Missing.
- Censored.
- Unknown.
- Successful.
- Included in each analysis.

---

## 2. Calculations & formulas

### 2.1 Basic calculation families

**Probability or proportion** (each valid unit has one binary outcome):

```text
p-hat = x / n

x = valid successes
n = valid opportunities
```

Report the count and the percentage. Example: `16 successes / 20 valid opportunities = 0.80 = 80%`. Never report only "80%." The counts show how much evidence exists.

**Rate** (events during exposure):

```text
Rate = number of qualifying events / valid exposure
```

Exposure can be time, distance, missions, raids, or another approved basis. Examples: false tracks per hour, failures per hour, interventions per vignette.

**Elapsed time**:

```text
Elapsed time = stop-event time − start-event time
```

The event definitions and common time matter more than the subtraction.

**Duration fraction** (continuity, availability, mission-capable time):

```text
Fraction = time in the required state / total valid eligible time
```

**Difference**:

```text
Difference = result for treatment B − result for treatment A
```

A positive difference is not automatically good. Define the preferred direction.

**Relative change**:

```text
Relative change = (new − baseline) / baseline
```

Use care when the baseline is near zero. Always report the absolute change with the relative change.

**Sum of mission-stage times**:

```text
Total chain time = stage 1 time + stage 2 time + ... + stage k time
```

Example:

```text
Total detect-to-effect time
= detection time
+ track time
+ handoff time
+ decision time
+ assignment time
+ effect time
```

Use observed event differences when possible. Do not add overlapping stage times twice.

**Remaining mission margin**:

```text
Available time = boundary-crossing time − decision-ready time

Required action time = decision + authority + assignment + effect + assessment

Mission margin = available time − required action time
```

A positive margin means time remains under the defined assumptions. A negative margin means the chain is late.

### 2.2 C-UAS measure calculations (18 numbered measures)

Sensing and track:

**CUAS-SEN-PD-001 (Probability of detection)**

```text
Probability of detection
= valid opportunities with a detection
  ------------------------------------
  total valid detection opportunities
```

Usual experimental unit: one threat presentation. Report by configuration, threat, range band, aspect, altitude, speed, and condition when they can change performance.

**CUAS-SEN-FD-002 (First-detection range or time)**

```text
First-detection time
= first valid detection time − eligibility-start time
```

Range is the truth-derived range at the first valid detection event. A no-detection result can be censored when the opportunity ends before detection. Report individual values, censored values, center, spread, and interval.

**CUAS-TRK-FST-003 (First-stable-track range or time)**

```text
First-stable-track time
= first time all stable-track rules pass − eligibility-start time
```

The persistence window must be complete. Do not count a late tentative track when the required later updates are missing.

**CUAS-TRK-CONT-004 (Track continuity)**

```text
Track continuity
= eligible time with a valid associated track
  -------------------------------------------
  total valid eligible tracking time
```

Also report: number of losses; duration of each loss; reacquisition time; worst valid opportunity.

**CUAS-TRK-ERR-005 (Track position error)**

```text
Error vector at time t
= blue-track position at t − truth position at t
```

Three dimensions:

```text
Radial error
= sqrt(x-error² + y-error² + z-error²)
```

Summary over matched samples:

```text
RMSE = sqrt(sum(error_i²) / m)

m = number of matched samples
```

Do not treat all matched samples from one run as independent trials. Also consider along-track, cross-track, and vertical error.

**CUAS-CLS-ACC-006 (Classification accuracy)**

```text
Classification accuracy
= correctly classified valid objects
  ----------------------------------
  valid classification opportunities
```

Also report: the confusion matrix; unknown or unclassified rate; false-hostile rate; false-friendly rate; results by class. Freeze the class set and the treatment of "unknown" before execution.

**CUAS-SUR-FTR-007 (False or nuisance track rate)**

```text
False-track rate
= adjudicated false or nuisance tracks
  ------------------------------------
  valid surveillance exposure time
```

Separate false tracks, duplicate tracks, split tracks, uncorrelated real objects, and nuisance but real objects.

Fusion, command, and decision time:

**CUAS-C2-HS-008 (Handoff success probability)**

```text
Handoff success probability
= successful usable handoffs
  --------------------------
  valid qualifying handoff opportunities
```

A source track must meet the offer rule before it enters the denominator. Classify failures by stage.

**CUAS-C2-LAT-009 (Sensor-to-C2 or handoff latency)**

```text
Handoff latency
= receiving-system usable-track time
  − source qualifying-track time
```

Report the distribution, successful fraction, censored fraction, and condition breakdown. Do not replace failed handoffs with the timeout value.

**CUAS-MSN-UWT-010 (Usable warning time)**

```text
Usable warning time
= truth time at the defended boundary
  − decision-ready-track time
```

Interpret with track quality, false-track burden, handoff success, and the remaining effector timeline. A no-warning outcome is not automatically zero; use the approved rule.

EW effect and recovery:

**CUAS-EW-EFF-011 (Probability of mission-relevant EW effect)**

```text
EW effect probability
= valid EW opportunities reaching the defined effect state
  --------------------------------------------------------
  total valid EW effect opportunities
```

The effect state must be mission-relevant and independently observed. Example effect states: route deviation, control loss, mission abort, forced recovery, loss of terminal function, temporary suppression. Do not use the EW system's own "effect achieved" flag as the only truth.

**CUAS-EW-REC-012 (Time to effect and recovery)**

```text
Time to effect
= effect-entry time − qualifying-exposure time

Recovery time
= effect-exit time − effect-entry time
```

Record censoring when effect or recovery is not fully observed. Separate temporary suppression from mission defeat.

Intercept, defeat, and mission result:

**CUAS-DEF-PINT-013 (Probability of intercept)**

```text
Probability of intercept
= valid engagement opportunities with confirmed intercept
  -------------------------------------------------------
  total valid intercept opportunities
```

The opportunity must include the approved engagement prerequisites. Report separately: no assignment, no launch, launch failure, guidance failure, miss, intercept with unknown effect, confirmed intercept.

**CUAS-DEF-PDEF-014 (Probability of defeat)**

```text
Probability of defeat
= valid opportunities with confirmed defeat
  -----------------------------------------
  total valid defeat opportunities
```

Defeat means the threat can no longer complete the defined mission during the remaining vignette. Unknown outcomes do not become success or failure without an approved rule.

**CUAS-MSN-E2E-015 (End-to-end mission success)**

```text
End-to-end mission success
= valid vignettes achieving the mission-success state
  ---------------------------------------------------
  total valid mission vignettes
```

The complete chain must be reconstructable. Decompose into detection, track, classification, decision, assignment, engagement, effect, assessment, and mission outcome.

Saturation and suitability:

**CUAS-SAT-LEAK-016 (Leaker fraction and raid failure)**

```text
Leaker fraction
= threats reaching the boundary without prior confirmed defeat
  -----------------------------------------------------------
  valid truth threats in the raid
```

```text
Raid failure probability
= valid raids with at least one leaker
  ------------------------------------
  total valid raids
```

Threats within one raid are related; they are not independent raids. Also report concurrent tracks, assignments, engagements, queue delay, interventions, and resource exhaustion.

**CUAS-SUIT-AVAIL-017 (Operational availability)**

```text
Availability
= mission-capable time
  --------------------
  required operating time
```

Freeze the definition of mission-capable time. Define how scheduled maintenance, range holds, operator absence, and test-infrastructure downtime enter the denominator.

**CUAS-HMI-INT-018 (Operator intervention rate)**

```text
Intervention rate
= qualifying operator interventions
  ---------------------------------
  valid operating hours or valid vignettes
```

Separate normal required actions from correction, override, recovery, false-alarm handling, and unplanned troubleshooting.

### 2.3 Additional operational calculations

**Run-validity rate**:

```text
Valid-run rate = valid runs / attempted runs
```

Also report conditional and invalid counts. A high valid-run rate shows test-process quality, not system performance.

**Data completeness**:

```text
Data completeness
= required records present and usable
  -----------------------------------
  total required records
```

Do not use one campaign-wide value when a missing critical event makes one measure unavailable.

**Update rate**:

```text
Observed update rate = usable records / valid observation time
```

Also measure the maximum consecutive gap. An average rate can hide a critical gap.

**Packet or record loss**:

```text
Loss fraction
= expected records − received usable records
  ------------------------------------------
  expected records
```

Record when the loss occurs. One percent loss at the handoff event can matter more than larger loss outside the active phase.

**Clock offset and drift**:

```text
Clock offset = device time − authoritative time
```

```text
Clock drift rate
= offset at end − offset at start
  -------------------------------
  elapsed check time
```

Keep original time. Correct time only in a versioned derived field.

**Timing error converted to position error**:

```text
Approximate along-track error
= object speed × time offset
```

Illustrative example:

```text
Speed = 30 m/s
Time offset = 0.10 s
Approximate position error = 3 m
```

This error can invalidate a high-speed geometry measure.

**Queue and capacity measures** (saturation tests):

```text
Queue delay = service-start time − queue-entry time

Concurrent load = maximum number of active objects in the defined state

Throughput = completed qualifying actions / valid time
```

Record the first observed load where mission performance crosses the approved boundary. Do not claim a maximum capacity above the highest tested load.

**Resource expenditure**:

```text
Effects per defeat = effects used / confirmed defeats

Cost per defended effect = approved resource cost / confirmed defended effects

Personnel days per valid evidence unit
= total personnel days / valid evidence units
```

Freeze the cost and resource basis before comparison.

### 2.4 Mission-time arithmetic

Timeline measures must work backward from the mission effect.

**Threat time to boundary** (constant-speed approximation):

```text
Time to boundary = remaining path distance / ground speed
```

Use the measured trajectory when speed, path, or altitude changes materially.

**Required chain time**:

```text
Required chain time
= processing
+ operator decision
+ authority
+ assignment
+ launch or effect preparation
+ flight or time to effect
+ assessment
+ required margin
```

**Timing decision rule**:

```text
If available time > required chain time:
    timing condition is met

If available time = required chain time within uncertainty:
    result is borderline

If available time < required chain time:
    timing condition is missed
```

The approved uncertainty band controls the borderline rule.

### 2.5 Uncertainty math

**Combine independent measurement uncertainties**:

```text
Combined uncertainty
= sqrt(u1² + u2² + ... + uk²)
```

Use covariance terms when the errors are related.

**Latency uncertainty**:

```text
u_latency
= sqrt(
    u_start_timestamp²
  + u_stop_timestamp²
  + u_synchronization²
  + u_event_definition²
  )
```

The total must be small enough to distinguish the minimum decision-relevant latency difference.

### 2.6 Binomial intervals

Use a binomial method for detected/not detected, success/failure, intercept/no intercept, defeat/no defeat, or mission success/failure.

**Wilson interval** (the manual's normal default for a binomial proportion). Use software for the calculation. Do not use the simple normal approximation near zero or one. For review:

```text
center
= (p-hat + z²/(2n)) / (1 + z²/n)

half-width
= z / (1 + z²/n)
  × sqrt[p-hat(1 − p-hat)/n + z²/(4n²)]
```

At 95% confidence, use `z = 1.96`.

**Exact interval**: use when the sample is very small, the event is rare, or the accepting method requires it.

**Bayesian beta-binomial update**:

```text
Prior = Beta(a, b)
Observed = x successes in n opportunities
Posterior = Beta(a + x, b + n − x)
```

The prior must be approved and justified. Report sensitivity when the prior can change the decision.

### 2.7 Sample-size math

Sample size must follow the decision need, not the runs that fit the schedule.

**Precision for one probability** (approximate two-sided interval half-width `h`):

```text
n ≈ z² × p × (1 − p) / h²
```

If no defensible planning value exists, use `p = 0.5` (largest approximate sample). This is a planning approximation; increase the plan for invalid runs, clustering, blocking, and condition-specific reporting.

**Inflate for invalid evidence**:

```text
Required attempts
= required valid opportunities / expected valid-run fraction
```

This allowance does not weaken validity rules.

**Continuous mean interval** (only when experimental units and assumptions support it):

```text
mean ± t × standard deviation / sqrt(n)
```

Latency and recovery often have skewed distributions; median, percentiles, bootstrap intervals, or time-to-event methods can be better.

### 2.8 Reliability and availability

**Reliability probability** (one success/failure per valid mission period):

```text
Reliability probability = successful periods / valid periods
```

Use a binomial interval.

**Failure rate**:

```text
Failure rate = relevant failures / total valid time at risk
```

State the failure definition and the assumed failure process.

**Zero-failure bound** (constant-rate exponential model, approximate one-sided 95% upper bound after zero failures):

```text
Upper failure rate ≈ 3 / total time at risk
```

This does not prove zero risk. It is model-dependent.

**Availability**:

```text
Availability = mission-capable time / required operating time
```

State every downtime category and whether it enters the denominator.

### 2.9 Adaptive next-run weighted score

```text
Event value = sum(weight_j × score_j)
```

Scores come from the criteria in section 1.14. This is a planning aid, not a mandated decision rule. Safety, authority, and mission context can override the score.

### 2.10 Campaign performance calculations (Valkryn self-measurement)

Decision impact (track): decisions supported; accepted evidence delivered by the deadline; actions caused by evidence; time from final valid run to decision-ready package. Decision-uncertainty reduction needs an approved scale or decision model; do not invent a percentage without one.

Evidence quality:

```text
Valid-run rate = valid runs / attempted runs

Reproduction success rate
= independently reproduced P1 results / P1 results reviewed

Data completeness
= usable required data products / required data products
```

Also report safety deviations, acceptance reservations, and finding strength.

Operating leverage (track): time to first valid run; setup and integration hours; custom code hours; manual data hours; reused cards, adapters, schemas, measures, and report sections; expert dependency; personnel days per valid evidence unit; cost per valid evidence unit; margin on repeat work. Define each denominator before using it for comparison.

### 2.11 Analysis method selection (decision tree)

Use the simplest method that answers the approved question and respects the data structure.

```text
Binary result?
→ Binomial interval or binary regression

Continuous result?
→ Mean/median/percentile with interval

Count over exposure?
→ Rate model

Time until event with censoring?
→ Time-to-event analysis

Repeated or clustered data?
→ Mixed-effects or hierarchical model

Several controlled factors?
→ Regression, factorial, or response-surface model
```

Method notes:

- Binary outcomes: Wilson or exact interval for one probability; logistic or probit regression for factor effects; mixed-effects logistic for clustered results.
- Continuous outcomes, report: individual valid values; mean or median; spread; percentiles; worst valid case when important; confidence interval; measurement uncertainty; condition breakdown.
- Count/rate outcomes: Poisson or negative-binomial; use negative-binomial when variation exceeds a simple Poisson model.
- Time-to-event: Kaplan-Meier or another survival method when censoring is material. Report the probability that the event completes by mission-relevant times. Record competing events such as defeat, boundary crossing, abort, or truth loss.
- Repeated/clustered: mixed-effects or hierarchical models when observations share a day, operator, article, raid, site, or configuration state. Do not create false precision by treating related observations as independent.

### 2.12 Denominator and validity rules for calculations

- Primary denominator rule: for a probability, the denominator is normally the number of valid opportunities. Do not use messages, scans, plots, files, all planned runs, or invalid runs unless the approved measure definition requires that unit.
- Valid failure: stays in the denominator. A system failure is not the same as an invalid test.
- Invalid run: remains in the campaign record for safety, diagnosis, integration learning, or repeat planning. Do not place it in a performance denominator unless the approved method says to do so.
- Conditionally valid run: can support named measures but not others.

### 2.13 Sensitivity analysis for unknown binary outcomes

When unknown outcomes can change the decision, report all four cases:

```text
Case 1: all unknowns treated as failures
Case 2: all unknowns treated as successes
Case 3: approved model-based treatment
Case 4: primary analysis with adjudicated outcomes only
```

Do not select only the favorable case.

### 2.14 Outlier rule

Review an outlier. Do not remove it because it is inconvenient. Use the preapproved rule. If no rule applies, report the result with and without the outlier and explain the effect.

---

## 3. Checklists

### 3.1 Daily quantitative workflow: before the first run

- Compute every P1 measure from rehearsal data.
- Verify units, schemas, time, registration, and identity.
- Test code against a known case.
- Compare an independent calculation for each P1 measure.
- Confirm the run-count plan and drop order.

### 3.2 Daily quantitative workflow: after each run (ordered, 9 steps)

1. Check required files.
2. Check truth and source health.
3. Check time and registration.
4. Assign measure-level validity.
5. Compute run-level measures.
6. Store intermediate values.
7. Compare with thresholds.
8. Record uncertainty.
9. Preserve deviations and anomalies.

### 3.3 Daily quantitative workflow: at the daily evidence review

- Count attempted, valid, conditional, invalid, and pending runs.
- Check P1 measure coverage.
- Check minimum valid samples by matrix cell.
- Review variability and worst valid cases.
- Review missing, unknown, and censored results.
- Update competing explanations.
- Select the next event under the approved adaptation policy.

### 3.4 Daily quantitative workflow: at campaign completion

- Freeze the included-run manifest.
- Freeze code and parameters.
- Reproduce every P1 result.
- Conduct independent review.
- Assess missingness and exclusion bias.
- Reconcile conflicting sources.
- Compare configuration, threat, condition, operator, and procedure effects.
- State performance boundaries and trade-offs.

### 3.5 Design review questions (strategist, before approving a design; 14 questions)

1. What is one independent unit?
2. What exact event counts?
3. What is the denominator?
4. Which truth source proves the event?
5. Which factors change on purpose?
6. Which factors stay fixed?
7. Which factors can confound the result?
8. What difference matters to the decision?
9. How many valid units are required?
10. How many attempts are needed?
11. What interval or uncertainty is required?
12. What causes a stop, repeat, or adaptation?
13. Which conditions may be combined?
14. Which conclusions are prohibited?

### 3.6 Finding review questions (strategist, before approving a finding; 10 questions)

1. Can another analyst reproduce it?
2. Are all counts visible?
3. Are valid failures retained?
4. Are invalid runs excluded correctly?
5. Are censored and unknown outcomes visible?
6. Does the method respect clustering?
7. Does the interval answer the right question?
8. Is the worst valid case visible?
9. Would a reasonable sensitivity case change the decision?
10. Is the finding bounded to the tested scope?

### 3.7 Common quantitative errors (reject these 21 patterns)

- A percentage without counts.
- A probability with the wrong denominator.
- Messages treated as independent runs.
- Several threats in one raid treated as independent raids.
- Invalid evidence mixed with valid evidence.
- Unknown outcomes silently called failures or successes.
- A timeout inserted as a completed latency.
- A mean used to hide the worst valid case.
- A confidence interval for the mean used as a claim about every mission.
- Different configurations pooled without a model.
- Different threats pooled as one condition.
- A threshold selected after results are known.
- Many comparisons searched for one favorable result.
- Free play used to claim a general probability.
- A surrogate given one overall fidelity score that hides a critical omission.
- A system-under-test message used as its own independent truth.
- Clock or coordinate error ignored.
- An outlier removed because it is inconvenient.
- Exploratory results presented as confirmatory.
- Association presented as cause without a causal design.
- Extrapolation beyond the tested factor space.

### 3.8 Multiple-comparison controls (before execution)

- Name the primary comparisons.
- Label exploratory comparisons.
- Limit the number of formal claims.
- Select familywise or false-discovery control when required.
- Prefer effect sizes and intervals over isolated p-values.

Do not search many cells until one favorable result appears and then present it as the planned result.

### 3.9 Missingness bias questions

- Did data fail more often during difficult conditions?
- Were invalid runs concentrated in one configuration?
- Did unknown outcomes occur more often after failures?
- Would a different treatment of missing data change the decision?

### 3.10 Calibration failure procedure (if a post-test check fails; ordered, 5 steps)

1. Find the last known good check.
2. Bound the affected time.
3. Identify affected runs and measures.
4. Estimate the possible effect.
5. Re-adjudicate the evidence.

### 3.11 Minimum learning standard (strategist readiness checklist)

The strategist is ready when the strategist can:

- Build a complete measure definition.
- Calculate a probability, rate, latency, duration fraction, error, and mission margin.
- Explain experimental unit and independence.
- Explain randomization and blocking.
- Explain confidence, credible, prediction, and tolerance intervals.
- Read a Wilson interval.
- Plan a simple sample for one proportion.
- Inflate attempts for expected invalid evidence.
- Identify when censoring needs time-to-event analysis.
- Identify when clustering needs a mixed or hierarchical model.
- Explain why exploratory and confirmatory evidence stay separate.
- Review an uncertainty budget.
- Verify run and measure validity.
- Explain a bounded finding in plain language.

The role does not require deriving every statistical method by hand. It requires control of why the method exists, what data it can use, what decision it supports, and what the result cannot prove.

### 3.12 Role capability lists (who does what)

Strategist must be able to do: state the exact quantitative question; select the correct experimental unit; define simple probabilities, rates, times, errors, and margins; set the numerator and denominator; define start and stop events; identify dependence and obvious confounders; set the factor cells and comparison logic; explain why repetitions are needed; read counts, distributions, intervals, and sensitivity results; identify an invalid average or unsupported claim; explain the result and its limits to a customer; decide whether more evidence can change the decision.

Strategist with the analysis lead: select the sample-size method; select the confidence or credible interval; select randomization and blocking; select the model for clustered or repeated data; define sequential stopping rules; define treatment of missing, unknown, and censored outcomes; review outliers and sensitivity cases; approve aggregation across conditions; review the analysis code and reproduction record.

A qualified analyst should lead: exact power calculations; formal comparison of two or more treatments; mixed-effects or hierarchical models; survival models with material censoring; response-surface or Gaussian-process models; formal multiple-comparison control; complex measurement-uncertainty propagation; Bayesian prior selection and sensitivity analysis; simulation of adaptive or sequential decision rules. The strategist still owns the decision meaning and the allowed conclusion.

---

## 4. Templates, forms & cards

### 4.1 Required quantitative record set (4 controlled records per campaign)

```text
Question record
├── Hypothesis
├── Primary response
├── Experimental unit
├── Factor space
├── Minimum meaningful effect
└── Decision rule

Measure record
├── Event and opportunity definitions
├── Numerator and denominator
├── Start and stop events
├── Truth and data fields
├── Validity and missingness rules
└── Calculation and uncertainty method

Design record
├── Test matrix
├── Controls and covariates
├── Run order and blocks
├── Sample rationale
├── Sequential looks
└── Stop and adaptation rules

Analysis record
├── Included-run manifest
├── Data and transformation versions
├── Code and parameters
├── Results and intervals
├── Sensitivity analyses
└── Independent review
```

### 4.2 Required reporting language pattern (fill-in template for every finding)

> Under **[configuration, threat, condition, operator, and procedure]**, **[x]** of **[n]** valid independent opportunities met **[event rule]**. The estimate was **[value]** with **[interval or uncertainty]**. The result **[met, missed, or did not resolve]** the approved threshold. The finding applies only to **[tested scope]** and does not establish **[prohibited conclusion]**.

### 4.3 Five standard experiment patterns (recipe templates)

**Pattern 1: Detection and track characterization**

- Primary question: Where does the sensor detect and establish a stable track?
- Unit: one independently controlled threat presentation.
- Primary outputs: detection probability; first-detection range or time; first-stable-track range or time; track continuity; track error; false-track rate.
- Design controls: range, altitude, aspect, speed, threat class, clutter, weather, and configuration; randomize or block geometry and order; keep registration and truth within tolerance.
- Main risk: treating repeated track updates as independent tests.

**Pattern 2: Fusion and C2 handoff**

- Primary question: Does a qualifying source track become the correct usable receiving track in time?
- Unit: one qualifying source-track offer.
- Primary outputs: handoff success; source-to-receive latency; source-to-usable latency; warning time; failure-stage category.
- Design controls: source, adapter, schema, C2 version, network state, and object state; reset stale tracks and queues; preserve source, master, and receiver identities.
- Main risk: counting a source track that never met the offer criterion.

**Pattern 3: EW soft-kill characterization**

- Primary question: Does the treatment create the defined mission-relevant effect, and for how long?
- Unit: one independently reset threat presentation.
- Primary outputs: effect probability; time to effect; recovery time; effect duration; mission result.
- Design controls: threat control, navigation, communications, geometry, treatment, environment, and reset state; use treatment and control conditions; control carryover.
- Main risk: equating temporary disruption with mission defeat.

**Pattern 4: Interceptor defeat**

- Primary question: Does the complete tested kill chain defeat the threat before the mission boundary?
- Unit: one valid engagement opportunity.
- Primary outputs: intercept probability; defeat probability; mission success; stage times and margin; first failure stage.
- Design controls: sensor, C2, effector, threat, geometry, operator procedure, inventory, and truth.
- Main risk: calling an intercept a defeat without independent mission-outcome truth.

**Pattern 5: Saturation and multi-threat load**

- Primary unit: one complete raid. Nested unit: one threat object within the raid.
- Primary outputs: leaker fraction; raid-failure probability; detection, track, handoff, assignment, and engagement by object; maximum concurrent load; queue delay; operator intervention; resource exhaustion and recovery.
- Design controls: raid size, arrival spacing, threat mix, geometry, configuration, staffing, and inventory.
- Main risk: treating several threats from one raid as independent raids.

### 4.4 Experiment design element types (design vocabulary for forms)

- **Baseline**: states current or reference performance; must use a controlled configuration and condition.
- **Positive control**: a condition where the chain should observe the intended event; tests whether the test method can see a known favorable case.
- **Negative control**: a condition where the intended event should not occur; tests false alarms and unintended scoring.
- **Direct comparison**: change one decision-relevant factor when practical. If two factors change together, treat the result as a new combined condition.
- **Factorial design**: changes two or more factors to estimate main effects and interactions. Example: passive defense (absent or present) × active defense (nominal or degraded) = four cells. The interaction matters when the effect of passive defense changes with active-defense state. Do not report only separate main effects when the interaction changes the mission conclusion.
- **Fractional factorial**: selected combinations when a full factorial is too costly. Protect P1 cells. State which interactions remain unresolved.
- **Response-surface design**: use after screening finds the important continuous factors; can locate a boundary across range, speed, altitude, or load. Do not extrapolate beyond the tested region.
- **Scripted test**: for controlled comparison, characterization, confirmation, and regression.
- **Bounded-adaptive test**: when the threat response is a test factor. Record each trigger, choice, time, and rationale. Adaptive choices can damage simple independence; treat the result as exploratory unless the approved model supports a stronger claim.
- **Free play**: to find failures and generate hypotheses. Free play can show an event occurred during one interaction; it does not by itself estimate a probability across the operating envelope.

---

## 5. Outputs & deliverables

### 5.1 Result report (per finding; every result must include)

- Exact configuration.
- Threat and condition.
- Experimental unit.
- Planned, attempted, valid, and successful counts.
- Point estimate.
- Measurement uncertainty.
- Sampling interval.
- Variability and worst valid case.
- Missing, censored, unknown, and excluded data.
- Dependence and sample limits.
- Threshold comparison.
- Sensitivity result.
- Allowed conclusion.
- Prohibited conclusion.

Plus the required language pattern (section 4.2).

### 5.2 Reproducibility package (freeze at campaign end)

- Included-run manifest.
- Measure-definition version.
- Input-file hashes or custody identifiers.
- Schema and adapter versions.
- Time and coordinate transformations.
- Calibration and registration versions.
- Code and package versions.
- Parameters.
- Random seeds.
- Inclusion and exclusion rules.
- Censoring rules.
- Model formula.
- Output data and figures.
- Sensitivity analyses.
- Independent review result.

Rule: raw data stays unchanged. A correction creates a new derived version.

### 5.3 Evidence-accounting report (per measure)

All counts from section 1.20, always preserved and reported.

### 5.4 Campaign performance report (Valkryn self-measurement)

Decision impact, evidence quality, and operating leverage metrics per section 2.10.

---

## 6. Workflow & sequencing logic

### 6.1 Five linked forms of quantitative work (ordered chain)

```text
Decision math
→ Measure definition
→ Experiment design
→ Data and uncertainty control
→ Analysis and decision interpretation
```

### 6.2 Analysis separation chain (the strategist must keep these distinct)

```text
Observation
→ Calculation
→ Interpretation
→ Recommendation
→ Customer decision
```

### 6.3 Evidence accounting flow (one flow for every measure, before calculation)

```text
Planned
→ Attempted
→ Eligible
→ Valid for this measure
→ Event observed or not observed
→ Included in the stated analysis
```

### 6.4 Recommended experiment sequence

```text
Scripted baseline
→ bounded exploration
→ diagnostic isolation
→ scripted confirmation
→ mission-thread event
→ targeted regression
```

Keep exploratory and confirmatory evidence separate.

### 6.5 Sequential and adaptive analysis

Simple pattern:

```text
Screen
→ Augment
→ Validate
```

Predefine all fields in section 1.13.

- Frequentist rule: use an approved group-sequential or alpha-spending method when formal false-positive control matters. Repeatedly checking ordinary 95% intervals and stopping when the result looks favorable increases error.
- Bayesian rule: can review probability that performance exceeds a threshold; probability that improvement exceeds the meaningful difference; predictive probability that the final decision will succeed. The probability cutoffs must be approved before execution.

### 6.6 Stop rules

Evidence sufficiency (a line can stop when):

- The approved minimum evidence exists.
- Remaining uncertainty is within the accepted limit.
- More runs are unlikely to change the decision.
- Required condition coverage exists.
- The evidence authority accepts the evidence strength.

Futility (a line can stop when):

- Required truth, system, condition, or authority cannot be restored.
- Remaining events cannot support the intended conclusion.
- Expected information gain does not justify risk, time, or cost.
- A design flaw requires a new campaign.

Minimum rule: do not stop because the current result is favorable. Do not continue only because range time remains.

### 6.7 Run order, learning, and carryover

Record possible order effects from: operator learning; threat-operator learning; fatigue; heating; battery or fuel state; maintenance; weather change; time of day; software or queue state; EW or treatment carryover.

Mitigations: randomized order; alternating order; blocking; washout; full system reset; withheld feedback until a block ends.

A later run after red learns a weakness is not a simple repeat of an earlier run.

### 6.8 Freeze points (before-execution gates)

- Freeze thresholds before execution.
- Freeze the class set and the treatment of "unknown" before execution (classification).
- Freeze the definition of mission-capable time (availability).
- Freeze the cost and resource basis before comparison (resource expenditure).
- Approve Bayesian priors and probability cutoffs before execution.
- Do not choose the required success count after seeing results.
- Name primary comparisons and label exploratory comparisons before execution.
- Define each denominator before using it for comparison (campaign performance).

### 6.9 Design protections (the strategist must protect during experiment design)

- Fair comparisons.
- Independence.
- Control of order effects.
- Coverage of P1 conditions.
- Clear separation of exploratory and confirmatory work.
- Safe and approved adaptation between runs.

### 6.10 Data and uncertainty control chain (evidence chain per measure)

- Independent ground truth.
- Common time.
- Spatial registration.
- Calibration.
- Source health.
- Event and object identity.
- Data lineage.
- Measure-level validity.

### 6.11 Quantitative gate (final gate, verbatim intent)

Proceed only when the question, unit, event, denominator, truth, factor space, sample rationale, calculation, uncertainty, validity, stopping rule, and allowed conclusion are controlled. A result is decision-ready only when another qualified analyst can reproduce it and the customer can understand both its meaning and its limit.

---

## 7. Worked examples & real data

All examples are marked illustrative in the source. They are not Valkryn results. Use as test fixtures.

1. **Proportion**: `16 successes / 20 valid opportunities = 0.80 = 80%`.
2. **Wilson interval**: 16 detections / 20 valid opportunities; p-hat = 0.80; approximate 95% Wilson interval = 0.58 to 0.92 (z = 1.96). Interpretation: suggests good observed performance; does not establish precise performance.
3. **Beta-binomial update**: Prior = Beta(1, 1); observed = 16 successes in 20 opportunities; Posterior = Beta(17, 5).
4. **Sample size for one proportion**: desired 95% half-width = 0.10; planning p = 0.50; z = 1.96; `n ≈ 1.96² × 0.5 × 0.5 / 0.10² ≈ 96.0`; round up to about 97 independent valid opportunities.
5. **Attempt inflation**: required valid opportunities = 40; expected valid-run fraction = 0.80; required attempts = 40 / 0.80 = 50.
6. **Timing-to-position error**: speed = 30 m/s; time offset = 0.10 s; approximate position error = 3 m.
7. **Mission margin**: boundary time after decision-ready track = 42 s; required action chain = 36 s; required safety and uncertainty margin = 4 s; mission margin = 42 − 36 − 4 = 2 s. Interpretation: small positive margin; does not support a broad claim without measurement uncertainty and tested-condition limits.
8. **Zero-failure reliability bound**: zero failures in 30 valid hours; upper 95% rate bound ≈ 3 / 30 ≈ 0.10 failures per hour. Model-dependent; does not prove zero risk.
9. **Factorial cells**: passive defense (absent or present) × active defense (nominal or degraded) = four cells.
10. **Confounder narrative**: Configuration B always tested later in the day during worse weather; the difference can come from the configuration, the weather, or both.

---

## 8. Product implications

What the app must let the user DO, based on sections 1-7:

1. **Measure-definition builder.** A form that enforces the 15 minimum measure fields (1.3) and the 13 measure-definition elements (1.2). Block a measure from "approved" status until all fields are complete. Store threshold with its source-order level (1.5) and a frozen/unfrozen state.
2. **Computed measure engine with IDs.** Implement all 18 CUAS measures (2.2) plus the basic families (2.1), operational calculations (2.3), and mission-time arithmetic (2.4) as pure functions keyed by measure ID. Each takes typed inputs (counts, timestamps, exposures) and returns estimate plus counts. Never render a percentage without its x/n counts (error list 3.7).
3. **Evidence accounting ledger.** Every run carries the state chain Planned → Attempted → Eligible → Valid → Event → Included (6.3), a data-state enum (1.6), a validity level (1.7), and measure-level validity flags. Denominators auto-derive from valid opportunities only; valid failures stay in; invalid runs stay in the record but out of performance denominators (2.12).
4. **Interval calculators.** Wilson interval (default, z = 1.96 at 95%), exact-interval flag, beta-binomial posterior update, mean ± t·sd/sqrt(n), combined uncertainty root-sum-square, and latency uncertainty budget (2.5, 2.6). Label every interval with its type (confidence/credible/prediction/tolerance, 1.8).
5. **Sample-size planner.** Compute n ≈ z²p(1−p)/h², inflate by expected valid-run fraction, and show per-cell minimums against the test matrix (2.7, 1.9). Warn when planned runs fall below required attempts.
6. **Mission-margin calculator on the timeline.** Available time, required chain time (stage sum), margin, and the met/borderline/missed decision rule with an uncertainty band (2.4). This connects directly to RangeBoard's kill-chain and timeline playback.
7. **Experiment designer.** Templates for the 5 patterns (4.3) with pre-filled unit, outputs, design controls, and main-risk warning. Support design element types (baseline, positive/negative control, factorial cells, scripted/bounded-adaptive/free-play run types, 4.4) and the recommended sequence (6.4). Tag every run exploratory or confirmatory and keep them separate in analysis views.
8. **Freeze and gate enforcement.** Implement the freeze points (6.8) as state transitions: thresholds, class sets, priors, denominators, and pass rules lock at execution start; changes after lock require a new version. Implement the quantitative gate (6.11) as a campaign readiness check.
9. **Daily workflow checklists.** Render 3.1-3.4 as phase-bound dynamic checklists (before first run, after each run, daily review, campaign completion) with the after-run steps ordered 1-9. Wire "assign measure-level validity" and "compare with thresholds" items to the ledger and engine.
10. **Sensitivity and error guards.** Auto-generate the 4 unknown-outcome sensitivity cases (2.13); require outlier with/without reporting (2.14); lint results against the 21 common-error patterns (3.7) and flag violations (for example percentage without counts, timeout as latency, raid threats as independent units).
11. **Finding composer.** Generate the required language pattern (4.2) from stored fields and require every element of the result report (5.1) before export. Include allowed and prohibited conclusions as mandatory fields.
12. **Reproducibility export.** One-click package of the 15 reproducibility items (5.2), with the raw-data-immutable / derived-version rule enforced in data storage.
13. **Adaptive next-run scorer.** Weighted score Event value = sum(weight_j × score_j) over the 10 criteria (1.14), presented as advisory only with an override note for safety/authority/mission context.
14. **Data-health monitor.** Per-source state machine (green/warning/stop/degraded/unknown) driven by the 10 controlled parameters (1.18), plus clock offset/drift and loss-fraction calculators (2.3) and the calibration-failure procedure (3.10) as a guided flow.
15. **Test fixtures.** Seed the calculation engine's unit tests with the 10 worked examples in section 7 (exact expected values: 0.80, 0.58-0.92, Beta(17,5), 97, 50, 3 m, 2 s, 0.10 failures/hour, 4 cells).
