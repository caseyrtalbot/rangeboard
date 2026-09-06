# C-UAS Measure Dictionary & Quantitative Test Design (Agent 9)

## Sources fetched

- "10 — C-UAS Measure Dictionary" — https://app.notion.com/p/3c16f36564f78156b05cdb925422f320
- "11 — Quantitative Test Design & Analysis" — https://app.notion.com/p/3c16f36564f781fbbfbedb8388e08695

Both pages contain no child sub-pages. Each carries "Builds on" mention-links to other manual sections (page 10: `9e41125f6302483eb08877541a5430a5`, `a9faf8d4f6244d8e942dfc5157a71e9b`, `3c16f36564f780cf84b8d7afdac2175d`, `b41400f6b11943b8be7d9ffaad44c74c`; page 11: `9e41125f6302483eb08877541a5430a5`, `7e11e631947543688ee95453acea5913`, `3be6f36564f781bca64acbc1459db94c`, `3be6f36564f7810aaeb9eae00937d920`, `3be6f36564f78147bad9d3ee4fd9187f`). These are cross-references to sections assigned to other agents and were not fetched.

Scope note from source: the dictionary entries are measure definitions, not Valkryn performance claims. All numeric calculations on page 11 are illustrative examples, not Valkryn results.

---

## 1. Input variables & fields

### 1.1 Measure instantiation fields (per campaign measure registry entry)

Every campaign copies a dictionary entry into the campaign measure registry and replaces every bracketed parameter with an approved value or record. Fields the user must supply per measure instance:

| Field | Meaning | Type |
| --- | --- | --- |
| Configuration | Approved system configuration (CFG record) | record link |
| Threat | Approved threat / threat profile (THR record) | record link |
| Conditions | Environmental and operating condition bounds (COND records) | record link(s) |
| Threshold | Pass value with its source recorded separately (mission, requirement, safety, baseline, or customer-decision source) | number + source enum |
| Event gates | Spatial, temporal, identity, persistence association gates | structured rule set |
| Uncertainty limits | Time and coordinate tolerances; maximum event-time uncertainty | numbers + units |
| Event rule | What counts as the event (frozen before execution) | rule text |
| Denominator rule | What counts as a valid opportunity (frozen before execution) | rule text |
| Truth rule | Required independent truth source(s) | rule text |
| Missing-data rule | Written treatment of missing data (frozen before execution) | rule text |
| Validity rule | Written run/opportunity validity conditions (frozen before execution) | rule text |
| Uncertainty rule | Stated method for measurement and sampling uncertainty (frozen before execution) | rule text |
| Links | Decision (DEC), investigative question (Q), hypothesis (HYP), mission task, test-matrix cell | record links (all required) |

### 1.2 Detection-rule parameter (per campaign)

The campaign must define whether detection requires one report, `K` consecutive updates, or a minimum dwell. A single uncorrelated plot is not automatically a detection.

### 1.3 Stable-track rule parameters (per measure record)

- Minimum number of consecutive updates.
- Maximum allowed update gap.
- Required position or velocity quality.
- Required identity confidence.
- Minimum dwell time.

The exact rules belong in the measure record.

### 1.4 Handoff success criteria fields

- Correct object identity or approved correlation.
- Required fields present.
- Usable quality and freshness.
- A traceable receiving-system event time.

Packet receipt alone is not a successful operational handoff unless packet receipt is the approved question.

### 1.5 Decision-ready track definition fields

Can include: position quality, velocity, classification, confidence, freshness, continuity, and required metadata. Customer-approved for the next mission task.

### 1.6 Defeat outcome taxonomy (enum, must be distinguished per campaign)

- Physical destruction.
- Functional mission kill.
- Diversion or forced landing.
- Lost guidance or navigation.
- Temporary suppression.
- Unknown outcome.

### 1.7 EW effect-state taxonomy (enum, define explicitly per campaign)

Navigation deviation, control-link loss, mission abort, forced recovery, loss of terminal function, temporary suppression.

### 1.8 Intercept outcome taxonomy (enum, report separately)

No assignment, no launch, launch failure, guidance failure, miss, intercept with unknown effect, intercept.

### 1.9 Defeat measure outcome taxonomy (enum, report separately)

Confirmed defeat, probable defeat if allowed, no defeat, unknown outcome, no-test.

### 1.10 Handoff failure categories (enum)

No transmission, rejected message, schema failure, identity error, stale data, duplicate/merge error, unusable quality, timeout.

### 1.11 False/nuisance track report categories (enum, report separately)

False tracks, duplicate tracks, split tracks, uncorrelated real objects, nuisance but real objects.

### 1.12 Downtime categories (enum, for availability)

System fault, scheduled maintenance, test infrastructure, operator, external constraint, unknown. Denominator inclusion of scheduled maintenance, test-infrastructure downtime, external range holds, and operator unavailability must be defined before execution.

### 1.13 Operator intervention types (enum)

Required decision, correction, override, recovery, false-alarm handling, unplanned troubleshooting. Must distinguish planned doctrinal action from intervention caused by system behavior.

### 1.14 Observation status labels (enum, applies to every observation)

- **Missing:** Expected data is absent.
- **Invalid:** A written validity rule failed.
- **Conditionally valid:** The run supports named measures or uses but not others.
- **Censored:** Partial time-to-event information exists.
- **Unknown outcome:** The opportunity is valid but the decisive state cannot be classified.
- **No-test:** The intended experimental opportunity did not occur under the preapproved rule.

### 1.15 Quantitative design pre-record (fields to record before selecting a method)

- Decision and investigative question.
- Primary response measure.
- Experimental unit.
- Configurations or treatments being compared.
- Threat and condition factor space.
- Minimum operationally meaningful effect.
- Threshold or comparison.
- Required uncertainty width or decision risk.
- Expected variability.
- Independence structure.
- Maximum feasible valid sample.
- Sequential looks, adaptation limits, and stopping rules.
- Conclusions allowed if the planned sample cannot be obtained.

Rule: the available data or software must not define the question.

### 1.16 Valid experimental unit examples (enum of choices)

- One independently reset threat presentation.
- One complete handoff opportunity.
- One engagement opportunity.
- One complete raid.
- One operating-hour block.
- One system article over a defined mission period.

### 1.17 Common dependence structures (checklist of what breaks independence)

- Many sensor reports from one threat presentation.
- Many tracks produced during one common system fault.
- Several threats in the same raid.
- Repeated runs with the same operator, article, battery, day, or weather block.
- Multiple measurements from one truth trajectory.
- Repeated engagements using one software/configuration state.

Rule: use the highest level at which observations can reasonably vary independently, or model the lower-level correlation explicitly. Do not assume independence merely because records have different rows.

### 1.18 Threshold / pass-fail design fields

- Unacceptable probability `p0`.
- Operationally acceptable probability `p1`.
- False-accept risk.
- False-reject risk.
- Exact decision rule.
- Maximum sample.
- Whether sequential stopping is permitted.

### 1.19 Two-proportion comparison design fields

- Baseline probability.
- Minimum meaningful difference or risk ratio.
- Allocation between configurations.
- One- or two-sided question.
- Confidence and power.
- Blocking factors and common environmental exposure.
- Whether observations are paired.

Note: paired comparisons can be more efficient when the same controlled condition is presented to both configurations, but order and carryover effects must be controlled.

### 1.20 Randomizable factors (candidates)

Configuration order, threat approach direction, factor combinations, operator assignment, time within a block.

### 1.21 Blocking factors (candidates)

Day or range window; operator or crew; threat article; sensor or interceptor article; weather regime; battery or fuel batch; site or emplacement; software build; maintenance state.

### 1.22 Candidate C-UAS design factors (for factorial designs)

Range, altitude, azimuth/aspect, speed, threat class, raid size, emissions or guidance mode, clutter, RF/network state, configuration, operator condition.

### 1.23 Regression model record fields (always record)

- Formula and factor coding.
- Interaction terms.
- Reference levels.
- Inclusion/exclusion rules.
- Software and version.
- Residual/model checks.
- Sensitivity to plausible alternative specifications.
- Interpolation region and prohibited extrapolation.

Model-to-response mapping:

- Continuous response: linear or nonlinear regression.
- Binary response: logistic or probit regression.
- Count/rate response: Poisson or negative-binomial regression.
- Repeated or clustered observations: mixed-effects or hierarchical model.
- Time to event: survival/time-to-event model.
- Nonlinear spatial response: justified spline, Gaussian process, or other model with validation.

Rule: association is not causation unless the design supports causal attribution.

### 1.24 Sequential design pre-definition fields

- Initial sample or budget share.
- Interim-review schedule.
- Statistics or posterior quantities reviewed.
- Efficacy/sufficiency boundary.
- Futility boundary.
- Maximum sample.
- Allowed factor-space augmentation.
- Confirmatory sample held back when needed.
- Treatment of repeated looks.

### 1.25 Latency definition fields (per latency measure)

- Freeze the start event.
- Freeze the stop event.
- State the common time source.
- State the maximum event-time uncertainty.
- Define the observation window.
- Define censoring.
- Define repeated opportunities and clustering.

### 1.26 Censored observation record fields

```text
Observed time = time from start to observation-window end
Status = right censored
Reason = approved code
```

Record the observed time and censoring reason; do not substitute the timeout as if the event occurred.

### 1.27 Reliability incident record fields (for every incident)

- Time or cycles at risk.
- Failure time.
- Failure mode.
- System/configuration state.
- Mission consequence.
- Repair action.
- Return-to-service time.
- Repeat or recurrence.
- Scoring classification.

Failure definitions must be frozen before execution.

### 1.28 Adaptive run selection record fields

- Triggering evidence.
- Candidate conditions.
- Expected information gain.
- Comparability effect.
- New run-list/card version.
- Whether the selected run is exploratory or confirmatory.

### 1.29 Reproducible analysis record (freeze all of these)

- Included-run manifest.
- Measure-definition version.
- Input-file hashes or custody identifiers.
- Transformation and adapter versions.
- Code and package versions.
- Parameters and random seeds.
- Exclusion and censoring rules.
- Model formula.
- Output tables and figures.
- Independent review result.
- Sensitivity analyses.

### 1.30 Bayesian prior fields

Prior distribution `Beta(a, b)`; justification record; sensitivity result against another defensible prior when the prior materially affects the decision.

---

## 2. Calculations & formulas

### 2.0 Common event vocabulary (event definitions that feed all formulas)

**Threat presentation:** one controlled exposure of the system under test to one defined threat object, raid, or mission vignette. A valid presentation has: a unique threat-object or raid identifier; a recorded threat profile and configuration; independent truth for required threat state; entry into the card-defined eligible region; required environmental and operating-condition records; no validity failure affecting the measure. Repeated messages, scans, detections, or tracks within one presentation are not independent presentations.

**Detection opportunity:** begins when truth shows the threat enters the measure's approved surveillance volume, range band, time window, or other eligibility boundary. Ends when the threat exits that boundary, the vignette ends, or an approved censoring event occurs. Eligible only if: sensor is in approved configuration and declared available; required truth covers the complete eligibility interval; threat satisfies profile and condition bounds; required instrumentation and time alignment remain within tolerance.

**Detection event:** a sensor-originated report that is produced during an eligible opportunity; is associated with the correct truth object under the approved spatial, temporal, identity, and persistence gate; meets the approved confidence, quality, or declaration state; and is not a duplicate of the same report or an excluded test artifact.

**Stable-track event:** a track associated with the correct truth object satisfies all approved quality and persistence rules (see 1.3).

**Handoff event:** the receiving system accepts the intended source track or object into the operational workflow with correct identity/correlation, required fields, usable quality and freshness, and a traceable receiving-system event time.

**Decision-ready track:** a track satisfying the customer-approved information requirements for the next mission task (see 1.5).

**Effect event:** independent evidence shows the approved effect criterion has been reached. Criterion may be physical, functional, behavioral, electromagnetic, cyber, or mission-level. System-generated "effect achieved" messages are not independent truth unless separately validated for that intended use.

**Defeat event:** truth establishes the threat can no longer complete the card-defined mission during the remaining vignette (distinguish outcomes per 1.6).

**Valid opportunity:** an opportunity that passes every validity rule required by the measure. Invalid or no-test opportunities remain in campaign accounting but do not enter the primary denominator.

**Censored observation:** event time not fully observed even though part of the time-at-risk is known. Example: a valid threat leaves the test volume before handoff occurs.

### 2.0.1 Denominator discipline (universal accounting pipeline)

```text
Planned
→ attempted
→ eligible
→ valid for this measure
→ event observed or not observed
```

- **Planned:** listed in the approved design.
- **Attempted:** execution began.
- **Eligible:** actual conditions created an opportunity under the measure definition.
- **Valid:** required configuration, truth, procedure, timing, and data passed.
- **Successful:** the defined event occurred within the eligible interval.

The denominator for a probability is normally the number of valid opportunities, not the number of messages, scans, tracks, or files. Never remove a valid failure from the denominator because the result is inconvenient. Never keep an invalid opportunity in the primary denominator merely to preserve the planned sample count. Always report `planned / attempted / eligible / valid / successful`.

### 2.0.2 Uncertainty vocabulary (four distinct uncertainties on every result)

- **Measurement uncertainty:** error in truth, timing, registration, calibration, or instrumentation.
- **Sampling uncertainty:** uncertainty because only a finite number of opportunities was observed.
- **Operational variability:** real variation across threats, operators, environments, configurations, or system behavior.
- **Model uncertainty:** uncertainty introduced by correlation, interpolation, simulation, classification, or analytical assumptions.

Do not compress these into an unsupported "high confidence" label.

### 2.1 Measure dictionary — sensing and track measures

#### CUAS-SEN-PD-001 — Probability of detection

**Question:** During valid opportunities under the defined condition, how often does the sensor produce a valid detection of the truth object?

```text
Estimate = number of valid opportunities with a detection event
           ---------------------------------------------------
           total valid detection opportunities
```

- **Experimental unit:** One threat presentation in one approved range/condition cell.
- **Numerator event:** At least one valid detection event occurs within the eligible interval.
- **Denominator:** All valid detection opportunities in the same defined cell.
- **Truth:** Independent threat identity, position, trajectory, and eligibility interval.
- **Aggregation:** Report by configuration, threat profile, range band, aspect/azimuth, altitude, speed, environment, and other design factors.
- **Uncertainty:** Binomial confidence or credible interval plus relevant truth/correlation uncertainty.
- **Invalid when:** Truth cannot establish eligibility; sensor availability is unknown; configuration is unknown; time alignment or association exceeds tolerance.
- **Do not claim:** Detection probability outside the tested factor space.

#### CUAS-SEN-FD-002 — First-detection range or time

**Question:** Where or when does the first valid detection occur?

- **Start event:** Threat enters the approved eligibility region or vignette begins.
- **Stop event:** First valid detection event.
- **Value:** Truth-derived slant range, ground range, distance to defended boundary, or elapsed time at the stop event, as defined.
- **Experimental unit:** One valid detection opportunity.
- **Missing:** No detection and no complete eligible interval.
- **Censored:** No detection before a valid opportunity ends.
- **Truth:** Independent position and time.
- **Uncertainty:** Truth-position uncertainty, clock uncertainty, interpolation uncertainty, and sampling interval.
- **Report:** Individual observations, censored observations, median/percentiles or other approved summary, and interval.
- **Invalid when:** Truth or common time cannot support the stated range/time accuracy.

#### CUAS-TRK-FST-003 — First-stable-track range or time

**Question:** Where or when does the system first produce a stable track?

- **Stop event:** First time the associated track satisfies the complete stable-track rule.
- **Value:** Truth-derived range or elapsed time at that event.
- **Experimental unit:** One valid opportunity.
- **Truth:** Independent threat trajectory and identity.
- **Censoring:** No stable track before the opportunity ends.
- **Uncertainty:** Truth, registration, timing, association, persistence-rule sensitivity, and sampling uncertainty.
- **Validity:** The complete persistence window must remain observable; a late track cannot be counted if required post-event updates are missing.

#### CUAS-TRK-CONT-004 — Track continuity

**Question:** For what fraction of the required mission interval is a valid associated track available?

```text
Continuity = eligible time with valid associated track
             -----------------------------------------
             total valid eligible tracking time
```

- **Experimental unit:** One truth object during one card-defined interval.
- **Numerator:** Duration in which the correct associated track satisfies the approved quality state.
- **Denominator:** Total valid eligible tracking duration, excluding only preapproved no-test intervals.
- **Gap rule:** Define the maximum update gap before continuity is considered lost.
- **Truth:** Independent object trajectory, identity, eligibility interval, and time.
- **Uncertainty:** Clock and association uncertainty; interval estimate across independent opportunities.
- **Report with:** Number and duration of track losses, reacquisition time, and worst valid opportunity.
- **Invalid when:** Eligible duration or association cannot be reconstructed.

#### CUAS-TRK-ERR-005 — Track position error

**Question:** How far does the reported track position differ from independent truth?

```text
Error vector(t) = transformed blue-track position(t)
                  − transformed truth position(t)
```

- **Experimental unit:** Define as opportunity-level summary, not every update, unless the correlation structure is modeled.
- **Required fields:** Blue position, truth position, coordinate frames, common time, transformation version, registration calibration.
- **Metrics:** Radial error, along-track error, cross-track error, vertical error, percentile, RMS error, or threshold exceedance as approved.
- **Truth:** Calibrated independent position source.
- **Uncertainty:** Truth accuracy, blue quantization, interpolation, coordinate transformation, registration, and clock error.
- **Validity:** Compare only time-correlated samples inside truth coverage and approved geometry.
- **Do not:** Treat thousands of correlated updates from one run as thousands of independent trials.

#### CUAS-CLS-ACC-006 — Classification accuracy

**Question:** How often does the system assign the correct approved class?

```text
Accuracy = correctly classified valid objects
           ----------------------------------
           valid objects requiring classification
```

- **Experimental unit:** One independently identified truth object per defined classification opportunity.
- **Numerator:** Final or card-defined classification state equals truth class.
- **Denominator:** Valid classification opportunities.
- **Truth:** Independent identity/class label with a documented source and adjudication record.
- **Required output:** Confusion matrix, unclassified/unknown rate, and results by threat class.
- **Uncertainty:** Multinomial/binomial interval and truth-label uncertainty.
- **Validity:** Freeze class taxonomy, decision time, and treatment of "unknown" before execution.

#### CUAS-SUR-FTR-007 — False or nuisance track rate

**Question:** How frequently does the system create an operationally relevant track without a corresponding truth object?

```text
Rate = number of adjudicated false or nuisance tracks
       ----------------------------------------------
       valid surveillance exposure time
```

- **Experimental unit:** A valid surveillance interval, normally summarized by run or block.
- **Numerator event:** A track satisfies the operational-track criterion but has no truth association under the approved reconciliation rule.
- **Denominator:** Valid surveillance hours, optionally stratified by surveillance volume and condition.
- **Truth:** Complete-enough truth inventory for real objects in the observed volume.
- **Uncertainty:** Count/rate interval, truth-coverage uncertainty, and clustering by interval.
- **Report separately:** False tracks, duplicate tracks, split tracks, uncorrelated real objects, and nuisance but real objects.
- **Invalid when:** Truth coverage is inadequate to decide whether an object existed.

### 2.2 Measure dictionary — fusion and command-and-control measures

#### CUAS-C2-HS-008 — Handoff success probability

**Question:** How often does a qualifying source track become a usable receiving-system track?

```text
Estimate = successful usable handoffs
           --------------------------
           valid qualifying handoff opportunities
```

- **Experimental unit:** One qualifying source-track offer.
- **Numerator event:** Receiving system creates or updates the correct object into the card-defined usable state within the allowed interval.
- **Denominator:** Valid source tracks that met every prerequisite for handoff.
- **Truth:** Source-to-master-to-receiver object correlation, message/event logs, and common time.
- **Uncertainty:** Binomial interval and association uncertainty.
- **Failure categories:** No transmission, rejected message, schema failure, identity error, stale data, duplicate/merge error, unusable quality, or timeout.
- **Validity:** Do not count opportunities in which the source never met the approved offer criterion.

#### CUAS-C2-LAT-009 — Sensor-to-C2 or handoff latency

**Question:** How long does the defined information transition take?

```text
Latency = receiving-system usable-track event time
          − source qualifying-track event time
```

- **Experimental unit:** One valid handoff opportunity.
- **Start event:** Source track first satisfies the offer criterion.
- **Stop event:** Receiving system first satisfies the usable-track criterion.
- **Truth:** Source and receiver event logs on a verified common time base; independent correlation to the correct object.
- **Censored:** No successful handoff before the approved window closes.
- **Uncertainty:** Source timestamp, receiver timestamp, synchronization, logging, transport, correlation, and event-resolution uncertainty.
- **Report:** Distribution, median/percentiles, successful fraction, censored fraction, and condition breakdown.
- **Do not:** Replace failed or censored handoffs with the timeout value and analyze them as completed latencies.

#### CUAS-MSN-UWT-010 — Usable warning time

**Question:** How much decision-and-engagement time remains when the architecture first produces a usable track?

```text
Usable warning time = truth time at defended-asset boundary
                      − decision-ready-track event time
```

- **Experimental unit:** One valid threat presentation.
- **Start/stop convention:** The value begins at decision-ready-track availability and ends at truth crossing of the approved defended-asset or latest-action boundary.
- **Truth:** Independent trajectory and boundary-crossing time; receiving-system decision-ready-track event.
- **Censored/failure:** If no decision-ready track occurs, report no-warning outcome; do not assign zero unless the approved definition requires it.
- **Uncertainty:** Boundary geometry, truth trajectory, time synchronization, event-definition, and sampling uncertainty.
- **Interpret with:** Track quality, false-track burden, handoff success, and effector timeline.
- **Validity:** Boundary, threat route, and decision-ready-track definition must remain frozen.

### 2.3 Measure dictionary — EW soft-kill measures

#### CUAS-EW-EFF-011 — Probability of mission-relevant EW effect

**Question:** How often does the approved EW condition produce the defined mission-relevant effect?

```text
Estimate = valid EW opportunities reaching the effect state
           -----------------------------------------------
           total valid EW effect opportunities
```

- **Experimental unit:** One independently reset threat presentation.
- **Numerator event:** Independent truth shows the card-defined effect state.
- **Denominator:** Valid presentations in which the EW system was available, authorized, correctly configured, and applied inside the approved geometry.
- **Effect states:** Define explicitly, such as navigation deviation, control-link loss, mission abort, forced recovery, loss of terminal function, or temporary suppression.
- **Truth:** Independent trajectory/state telemetry plus effect-state evidence not solely generated by the EW system under test.
- **Uncertainty:** Binomial interval, truth uncertainty, emission/exposure uncertainty, and clustering by threat article or software state.
- **Validity:** Record actual frequency/power/profile using the campaign's permitted representation; exclude only under preapproved no-test rules.
- **Do not claim:** Physical defeat when only temporary suppression was shown.

#### CUAS-EW-REC-012 — Time to effect and recovery

**Question:** How long after valid exposure does the threat enter and, if applicable, leave the defined effect state?

```text
Time to effect = effect-entry event − qualifying-exposure event
Recovery time  = effect-exit event − effect-entry event
```

- **Experimental unit:** One valid EW opportunity.
- **Truth:** Time-aligned emission/exposure record and independent threat-state record.
- **Censoring:** Effect not observed before exposure or vignette ends; recovery not observed before observation ends.
- **Uncertainty:** Exposure-event timing, truth-state timing, state-classification, and synchronization uncertainty.
- **Report:** Time-to-event distribution, censored fraction, recurrence, and condition breakdown.
- **Validity:** The qualifying exposure and state transitions must be independently reconstructable.

### 2.4 Measure dictionary — defeat and mission measures

#### CUAS-DEF-PINT-013 — Probability of intercept

**Question:** How often does an approved engagement opportunity produce the defined intercept event?

- **Numerator event:** Independent evidence confirms the interceptor meets the card-defined intercept criterion.
- **Denominator:** Valid engagement opportunities in which the system created a qualifying engagement and the interceptor was available and correctly released.
- **Truth:** Independent geometry, interceptor and threat trajectories, and intercept-event evidence.
- **Uncertainty:** Binomial interval, trajectory/registration uncertainty, and clustering by article/operator.
- **Report separately:** No assignment, no launch, launch failure, guidance failure, miss, intercept with unknown effect, and intercept.
- **Validity:** Do not include detection-only opportunities in the intercept denominator.

#### CUAS-DEF-PDEF-014 — Probability of defeat

**Question:** How often does a valid defeat opportunity prevent the threat from completing its card-defined mission?

```text
Estimate = valid opportunities with confirmed defeat
           -----------------------------------------
           total valid defeat opportunities
```

- **Experimental unit:** One valid engagement against one truth threat object or one defined raid.
- **Numerator event:** Confirmed defeat under the approved physical, functional, or mission criterion.
- **Denominator:** Valid defeat opportunities with the complete kill-chain prerequisites specified by the card.
- **Truth:** Independent threat outcome, trajectory, state, and mission-completion assessment.
- **Uncertainty:** Binomial interval plus outcome-adjudication uncertainty.
- **Report separately:** Confirmed defeat, probable defeat if allowed, no defeat, unknown outcome, and no-test.
- **Validity:** Unknown outcomes do not silently become successes or failures; apply the approved primary and sensitivity analyses.

#### CUAS-MSN-E2E-015 — End-to-end mission success

**Question:** Does the complete mission thread achieve the defined Measure of Success?

```text
Estimate = valid vignettes achieving the mission-success state
           ---------------------------------------------------
           total valid mission vignettes
```

- **Experimental unit:** One complete vignette or raid, as defined.
- **Numerator event:** Mission-level Measure of Success is achieved.
- **Denominator:** Valid mission vignettes.
- **Truth:** Complete mission-event chain, defended-asset state, threat outcome, and required operator/system states.
- **Uncertainty:** Binomial or model-based interval; measurement uncertainty at decisive events; variation across threats and conditions.
- **Required decomposition:** Detection, track, classification, decision, assignment, engagement, effect, assessment, and mission outcome.
- **Validity:** All mission-critical states must be reconstructable. A component success cannot substitute for missing mission-outcome truth.

### 2.5 Measure dictionary — saturation and suitability measures

#### CUAS-SAT-LEAK-016 — Leaker probability under raid load

**Question:** Under the defined raid size and arrival process, what fraction of threats reach the protected boundary without confirmed defeat?

```text
Leaker fraction = truth threats reaching the boundary without prior confirmed defeat
                  ---------------------------------------------------------------
                  valid truth threats in the raid
```

Also report:

```text
Raid failure probability = raids with at least one leaker
                           ------------------------------
                           total valid raids
```

- **Experimental units:** Threat object for leaker fraction; raid for raid-failure probability.
- **Truth:** Identity-preserving multi-object trajectories, boundary crossing, engagement history, and defeat outcome.
- **Uncertainty:** Object-within-raid dependence, raid-level interval, truth-association uncertainty.
- **Validity:** Preserve raid membership and do not treat threats in one raid as independent campaigns.
- **Report with:** Maximum concurrent tracks, assignments, engagements, operator interventions, queue delay, and resource exhaustion.

#### CUAS-SUIT-AVAIL-017 — Operational availability during the test period

**Question:** What fraction of required mission time is the system capable of performing the defined function?

```text
Availability = mission-capable time
               --------------------
               required operating time
```

- **Experimental unit:** Approved operating interval, summarized by day or campaign block.
- **Numerator:** Time the system is in the approved mission-capable state.
- **Denominator:** Required operating time, including downtime categories specified before execution.
- **Truth:** Operator log, system health, maintenance record, configuration, and independent readiness checks.
- **Uncertainty:** Interval or model appropriate to the time basis; classification uncertainty for downtime.
- **Report downtime by:** System fault, scheduled maintenance, test infrastructure, operator, external constraint, or unknown.
- **Validity:** Freeze the mission-capable definition and downtime-accounting rules.

#### CUAS-HMI-INT-018 — Operator intervention rate

**Question:** How often does the architecture require an operator action beyond the approved nominal workflow?

```text
Rate = qualifying operator interventions
       ---------------------------------
       valid operating hours or valid mission vignettes
```

- **Experimental unit:** Valid operating interval or vignette.
- **Numerator event:** A time-tagged action meeting the approved intervention definition.
- **Denominator:** Valid exposure hours or vignettes.
- **Truth:** Operator-interface logs, voice/event log, and observer record.
- **Uncertainty:** Count/rate interval and observer-classification uncertainty.
- **Report by type:** Required decision, correction, override, recovery, false-alarm handling, or unplanned troubleshooting.
- **Validity:** Distinguish planned doctrinal action from intervention caused by system behavior.

### 2.6 Binomial estimation

Use binomial methods when each valid experimental unit has one defined binary outcome (detected/not detected; successful/failed handoff; defeated/not defeated; mission success/failure).

```text
p-hat = x / n

x = number of valid successes
n = number of valid opportunities
```

**Frequentist interval rule:** Use a Wilson interval as the normal default for a binomial proportion. Use an exact interval when the sample is very small, the event is rare, or the accepting method requires it. Avoid the uncorrected normal approximation near zero or one.

**Bayesian interval (beta-binomial conjugate update):**

```text
Prior: Beta(a, b)
Observed: x successes in n valid opportunities
Posterior: Beta(a + x, b + n − x)
```

Record and justify the prior. Report sensitivity to another defensible prior when the prior materially affects the decision.

### 2.7 Sample size — precision-driven, one proportion

For an approximate two-sided interval half-width `h`:

```text
n ≈ z² × p × (1 − p) / h²
```

Variables: `n` = required independent valid opportunities; `z` = standard-normal quantile for the confidence level (1.96 for 95%); `p` = planning value of the proportion; `h` = desired interval half-width. If no defensible planning value exists, `p = 0.5` gives the largest approximate sample. Round up. This is a planning approximation: inflate for expected invalid runs, clustering, blocked cells, and condition-specific reporting.

### 2.8 Sample size — threshold / pass-fail design

Define `p0` (unacceptable probability), `p1` (operationally acceptable probability), false-accept risk, false-reject risk, exact decision rule, maximum sample, and whether sequential stopping is permitted. Use exact binomial calculations or simulation. Do not select the success count after viewing the data.

### 2.9 Sample size — inflation for invalid evidence

```text
Required attempts = required valid opportunities
                    --------------------------------
                    expected valid-run fraction
```

This is a planning allowance, not permission to weaken validity rules.

### 2.10 Continuous outcomes

Examples: latency, detection range, track error, warning time, recovery time, operator workload.

- **Means:** A confidence interval for a mean addresses uncertainty in the estimated mean under the assumed sampling structure. Check skew, outliers, clustering, and heteroscedasticity.
- **Medians and percentiles:** Latency and recovery distributions are often skewed. Use quantiles, bootstrap intervals, or time-to-event methods when more appropriate than a mean.

**Interval type selection:**

- **Confidence interval:** Uncertainty in an estimated parameter such as a mean or probability.
- **Credible interval:** Posterior probability interval under a Bayesian model.
- **Prediction interval:** Range for a future observation.
- **Tolerance interval:** Range intended to contain a specified fraction of the population with stated confidence.

Do not use a confidence interval for the mean to claim coverage of individual future missions.

### 2.11 Time-to-event / censoring math

Right censoring record: `Observed time = time from start to observation-window end; Status = right censored; Reason = approved code`. Do not replace the censored observation with the timeout and treat it as a completed latency. Use Kaplan–Meier or an appropriate survival model when censoring is material. Report the probability of completing the event by mission-relevant times.

Competing events: if a vignette can end through different mechanisms (defeat, boundary crossing, abort, loss of truth), record the mechanism. Do not treat all mechanisms as equivalent censoring without justification.

### 2.12 Reliability

- **Reliability probability:** For `x` successful mission periods among `n` valid periods, use binomial methods when each period has one binary reliability outcome.
- **Failure rate:**

```text
Failure rate = relevant failures / total valid time at risk
```

Report time at risk and failure count. State the assumed failure process before applying a model.

- **Zero-failure bound (illustrative):** Under a constant-rate exponential model, an approximate one-sided 95% upper bound after zero failures is:

```text
upper failure rate ≈ 3 / total time at risk
```

This does not prove zero risk. It is model-dependent and may be inappropriate when failures cluster, wear changes over time, or mission conditions differ.

- **Availability:**

```text
Availability = mission-capable time / required operating time
```

Define whether scheduled maintenance, test-infrastructure downtime, external range holds, and operator unavailability enter the denominator.

### 2.13 Combining measurement and sampling uncertainty

For a difference derived from independent measurements, a common approximation is:

```text
u_combined = sqrt(u_1² + u_2² + ...)
```

Use covariance terms when errors are correlated. Keep the measurement uncertainty attached to each run-level result. Sampling intervals across runs do not replace it.

### 2.14 Sensitivity analysis cases for binary measures with unknown outcomes

- All unknown outcomes treated as failures.
- All unknown outcomes treated as successes.
- Model-based assumption with justification.
- Primary analysis using only adjudicated valid outcomes.

Do not silently choose the favorable case. Report bounded alternatives when missing or unknown outcomes could change the decision.

### 2.15 Multiple comparisons rules

- Identify primary comparisons in advance.
- Label exploratory comparisons.
- Control familywise or false-discovery error when formal claims require it.
- Prefer effect sizes and intervals over isolated p-values.
- Do not mine conditions until one favorable result appears.

### 2.16 Sequential testing math rules

- **Frequentist:** Use an approved group-sequential or alpha-spending method when formal false-positive control matters. Repeatedly computing ordinary 95% intervals and stopping when favorable inflates error.
- **Bayesian:** A rule can use quantities such as: posterior probability that performance exceeds the threshold; posterior probability that the meaningful improvement exceeds delta; posterior predictive probability that the final decision will succeed. The campaign must choose and approve the actual probability thresholds. Do not invent them during execution.

### 2.17 Factorial / response-surface design rules

- Use factorial or fractional-factorial designs to estimate multiple factor effects and interactions across an operating envelope (candidate factors in 1.22).
- Use a response-surface design when optimizing a continuous response or locating a boundary after screening identifies the important factors.
- Do not attempt a full factorial when the range budget cannot support it. Protect the P1 cells and state which interactions remain unresolved.

---

## 3. Checklists

### 3.1 Measure dictionary use rules (verbatim, run when instantiating a measure)

1. Copy a dictionary entry into the campaign measure registry.
2. Replace every bracketed parameter with an approved value or record.
3. Freeze event, denominator, truth, missing-data, validity, and uncertainty rules before execution.
4. Link each measure to a decision, investigative question, hypothesis, mission task, and test-matrix cell.
5. Report results by configuration, threat, and condition. Do not collapse materially different conditions into one average.
6. Preserve the counts of planned, attempted, valid, conditionally valid, invalid, missing, and censored observations.
7. A threshold is not inherent in the measure. Record its mission, requirement, safety, baseline, or customer-decision source separately.
8. A measure is available only when its required truth, timing, configuration, and data-quality conditions pass.

### 3.2 Dictionary completion gate (a measure is ready only when all pass)

- Its event and opportunity definitions are executable.
- Its numerator and denominator cannot be interpreted two different ways.
- Its experimental unit is explicit.
- Its truth and data sources are identified.
- Its time and coordinate tolerances are approved.
- Missing, invalid, censored, and ambiguous observations have written rules.
- Measurement and sampling uncertainty have a stated method.
- Required condition breakdowns and prohibited aggregation are known.
- A cold reader can reproduce the result from retained data.

### 3.3 Quantitative analysis gate (a quantitative finding is ready only when all pass)

- The experimental unit and dependence structure are correct.
- Planned, valid, invalid, missing, and censored evidence is accounted for.
- The interval answers the stated question.
- The sample rationale and stopping rule were not chosen after the outcome.
- Condition-specific results and material interactions are visible.
- Measurement, sampling, operational, and model uncertainty are distinguished.
- The result can be reproduced from the retained manifest and code.
- Prohibited extrapolations are stated.

### 3.4 Valid threat presentation checklist (all required)

- A unique threat-object or raid identifier.
- A recorded threat profile and configuration.
- Independent truth for required threat state.
- Entry into the card-defined eligible region.
- Required environmental and operating-condition records.
- No validity failure affecting the measure.

### 3.5 Eligible detection opportunity checklist (all required)

- The sensor is in its approved configuration and declared available.
- Required truth covers the complete eligibility interval.
- The threat satisfies the profile and condition bounds.
- Required instrumentation and time alignment remain within tolerance.

### 3.6 Randomization rules

- Randomize when practical: configuration order, threat approach direction, factor combinations, operator assignment, time within a block.
- Do not randomize across unsafe, infeasible, or destructive transitions merely for statistical appearance. Record restrictions and use an appropriate blocked or split-plot design.
- Preserve the randomization schedule and actual order. A field-driven departure becomes a recorded deviation or approved adaptation.

### 3.7 Blocking rules

- Block on nuisance factors that cannot be eliminated but can be grouped (list in 1.21).
- Within a block, compare configurations under conditions that are as similar as practical.
- Do not confuse blocking with aggregation. Preserve block identity in analysis.

### 3.8 Invalid-run preservation checklist (keep invalid runs for)

- Test-process learning.
- Safety evidence.
- Anomaly diagnosis.
- Integration defects.
- Planning the repeat.

Do not include them in a performance denominator unless the approved method explicitly defines that use.

---

## 4. Templates, forms & cards

### 4.1 Measure dictionary entry template (structure of every entry; becomes the measure registry form)

| Field | Content |
| --- | --- |
| Measure ID | `CUAS-<DOMAIN>-<ABBR>-<NNN>` (e.g., CUAS-SEN-PD-001) |
| Name | Short name |
| Question | The operational question the measure answers |
| Formula | Numerator/denominator or event-time expression (exact) |
| Experimental unit | Explicit unit definition |
| Numerator event | Event definition |
| Denominator | Valid-opportunity definition |
| Start/stop events | For time/range measures |
| Value definition | For time/range measures (e.g., slant range, elapsed time) |
| Truth source | Required independent truth |
| Aggregation / condition breakdown | Required reporting cells; prohibited aggregation |
| Uncertainty method | Interval type plus measurement-uncertainty components |
| Missing / censored rules | Written treatment |
| Invalid-when rules | Written validity failures |
| Report-with / report-separately | Companion outputs |
| Do-not-claim / do-not | Prohibited interpretations |
| Threshold + source | Recorded separately from the measure |
| Links | DEC, Q, HYP, mission task, test-matrix cell |

### 4.2 Binomial result report block (required fields)

- Planned, attempted, eligible, valid, and successful counts.
- `x/n`, not percentage alone.
- Confidence or credible interval.
- Configuration, threat, and condition cell.
- Invalid, missing, unknown, and censored outcomes.
- Dependence or clustering limitations.

### 4.3 Continuous result report block (required fields)

- Individual valid results.
- Center and spread.
- Worst valid case when operationally important.
- Condition breakdown.
- Measurement uncertainty.
- Confidence interval.
- Outlier and exclusion sensitivity.

### 4.4 Required accounting block (report for every measure/analysis)

```text
planned
attempted
eligible
valid
conditionally valid
invalid
missing
censored
unknown
included in each analysis
```

### 4.5 Reliability incident form

Fields per 1.27: time or cycles at risk; failure time; failure mode; system/configuration state; mission consequence; repair action; return-to-service time; repeat or recurrence; scoring classification.

### 4.6 Adaptive run selection record form

Fields per 1.28: triggering evidence; candidate conditions; expected information gain; comparability effect; new run-list/card version; exploratory vs confirmatory flag.

### 4.7 Reproducible analysis manifest form

Fields per 1.29: included-run manifest; measure-definition version; input-file hashes or custody identifiers; transformation and adapter versions; code and package versions; parameters and random seeds; exclusion and censoring rules; model formula; output tables and figures; independent review result; sensitivity analyses.

---

## 5. Outputs & deliverables

- **Campaign measure registry:** instantiated measure records (per 4.1), frozen before execution.
- **Per-measure results, reported by configuration, threat, and condition cell** — never collapsed across materially different conditions.
- **Accounting summary per measure:** `planned / attempted / eligible / valid / successful` plus conditionally valid, invalid, missing, censored, unknown, and included-in-analysis counts.
- **Binomial result blocks** (per 4.2) with Wilson (default) or exact interval, or Beta posterior credible interval.
- **Continuous result blocks** (per 4.3) with distribution, median/percentiles, censored fraction, and condition breakdown for latency-type measures.
- **Classification deliverable:** confusion matrix, unclassified/unknown rate, results by threat class (CUAS-CLS-ACC-006).
- **Mission-thread decomposition:** detection, track, classification, decision, assignment, engagement, effect, assessment, mission outcome (CUAS-MSN-E2E-015).
- **Saturation companion report:** maximum concurrent tracks, assignments, engagements, operator interventions, queue delay, resource exhaustion (CUAS-SAT-LEAK-016).
- **Downtime report by category** (CUAS-SUIT-AVAIL-017).
- **Sensitivity analysis report** for unknown/missing outcomes (bounded alternatives per 2.14).
- **Reproducible analysis record** (per 4.7) enabling a cold reader to reproduce every result from retained data.
- **Sequential-review record:** looks taken, boundaries applied, stop/continue decisions.
- **Adaptive run selection records** (per 4.6) with exploratory vs confirmatory labeling in final reporting.

---

## 6. Workflow & sequencing logic

1. **Design starts with the decision.** Record the full quantitative pre-record (1.15) before selecting any statistical method. The available data or software must not define the question.
2. **Instantiate measures before execution.** Copy dictionary entry → replace bracketed parameters → freeze event, denominator, truth, missing-data, validity, and uncertainty rules → link to DEC/Q/HYP/mission task/test-matrix cell. All freezes precede execution.
3. **Availability gate:** a measure is available only when its required truth, timing, configuration, and data-quality conditions pass. Readiness is defined by the dictionary completion gate (3.2).
4. **Universal opportunity pipeline:** `Planned → attempted → eligible → valid → event observed or not observed`. Invalid and no-test opportunities remain in accounting but never enter the primary denominator.
5. **Freeze-before-execution list:** class taxonomy, decision time, treatment of "unknown" (classification); boundary, threat route, decision-ready-track definition (warning time); mission-capable definition and downtime accounting (availability); failure definitions (reliability); start/stop events, time source, observation window, censoring (every latency).
6. **Randomize where practical; block what cannot be randomized; record all restrictions.** Field-driven departures become recorded deviations or approved adaptations.
7. **Sequential pattern:** `Screen → augment → validate`. All looks, boundaries, maximum sample, augmentation limits, and held-back confirmatory sample are predefined before outcome review (1.24). Repeated ordinary interval checks with opportunistic stopping are prohibited.
8. **Adaptive run selection:** may select the condition with the highest expected decision value, but only inside the approved factor space; every adaptation is recorded (1.28) and exploratory runs must not be reported as preplanned confirmatory evidence.
9. **Primary analysis rule:** use only evidence allowed by the run-validity decision for that measure. Sensitivity analyses handle unknowns; the favorable case is never silently chosen.
10. **Analysis release gate:** the quantitative analysis gate (3.3) must pass before a finding is reported.
11. **Prohibitions (hard rules for the engine):**
    - Never collapse materially different conditions into one average.
    - Never treat correlated updates/threats-in-raid as independent trials.
    - Never substitute a timeout for a censored event time.
    - Never assign zero warning time on no-detection unless the approved definition requires it.
    - Never select success counts or stopping rules after viewing data.
    - Never claim performance outside the tested factor space.
    - Never treat temporary suppression as physical defeat.
    - Never count detection-only opportunities in the intercept denominator.

---

## 7. Worked examples & real data

All examples are labeled in the source as illustrative, not Valkryn results.

### 7.1 Wilson interval example

```text
Valid detections: 16
Valid opportunities: 20
p-hat = 16 / 20 = 0.80
Approximate 95% Wilson interval = 0.58 to 0.92
```

Interpretation from source: the point estimate is 0.80, but the interval shows that 20 opportunities do not establish precise performance.

### 7.2 Bayesian posterior example

```text
Prior: Beta(1, 1)
Observed: 16 successes in 20 opportunities
Posterior: Beta(17, 5)
```

### 7.3 Precision-driven sample size example

```text
Desired 95% interval half-width: 0.10
Planning p: 0.50
z: 1.96

n ≈ 1.96² × 0.5 × 0.5 / 0.10²
n ≈ 96.0

Round up: approximately 97 independent valid opportunities
```

### 7.4 Invalid-evidence inflation example

```text
Required valid opportunities: 40
Expected valid-run fraction: 0.80
Required attempts: 40 / 0.80 = 50
```

### 7.5 Zero-failure reliability bound example

```text
Zero failures in 30 valid hours
Approximate upper 95% rate bound ≈ 3 / 30 = 0.10 failures per hour
```

Caveats from source: model-dependent (constant-rate exponential); may be inappropriate when failures cluster, wear changes over time, or mission conditions differ; does not prove zero risk.

### 7.6 Illustrative Bayesian sequential rule (explicitly "not a default")

```text
Review after each planned block.
Stop for sufficiency if the approved posterior criterion is met.
Stop for futility if the approved predictive criterion is met.
Otherwise continue until the next block or maximum sample.
```

The campaign must choose and approve the actual probability thresholds. Do not invent them during execution.

---

## 8. Product implications

1. **Measure registry with template instantiation.** Ship the 18 dictionary entries (CUAS-SEN-PD-001 through CUAS-HMI-INT-018) as seed templates. "Add measure to campaign" copies a template and forces the user to fill every bracketed parameter (event rule, denominator rule, truth source, gates, tolerances, missing/censored rules, uncertainty method) plus required links to DEC, Q, HYP, mission task, and test-matrix cell. Block save-as-ready until the dictionary completion gate (3.2) passes.
2. **Freeze/lock mechanic.** Measure records, thresholds, class taxonomies, boundaries, latency start/stop events, failure definitions, and sequential stopping rules get a frozen state before execution; post-freeze edits create a versioned change record, not a silent overwrite.
3. **Opportunity accounting engine.** Every run/opportunity carries a status from the fixed enum (planned, attempted, eligible, valid, conditionally valid, invalid, missing, censored, unknown, no-test) plus reason codes. The app auto-computes and always displays `planned / attempted / eligible / valid / successful` per measure per condition cell. Denominators are derived from status, never hand-entered.
4. **Statistics engine (computable spec).** Implement: `p-hat = x/n`; Wilson interval (default) and exact binomial interval; Beta(a,b) → Beta(a+x, b+n−x) posterior with prior justification field; sample size `n ≈ z²p(1−p)/h²` with round-up and inflation `attempts = valid_needed / valid_fraction`; failure rate = failures/time-at-risk; zero-failure bound ≈ 3/T (95% one-sided, exponential); availability = capable time / required time; `u_combined = sqrt(Σ u_i²)`; Kaplan–Meier for censored latencies; quantiles/bootstrap for skewed continuous outcomes.
5. **Censoring-safe latency handling.** Time-to-event fields store observed time + status + reason code; the engine refuses to average censored values as completed latencies and reports completion probability by mission-relevant times.
6. **Condition-cell reporting.** All results are stored and rendered by configuration × threat × condition cell with prohibited-aggregation flags; no cross-cell average without explicit override recorded.
7. **Experimental-unit and dependence guardrails.** Each measure declares its experimental unit; the app warns when row counts exceed unit counts (e.g., correlated track updates, threats within a raid) and prevents them from inflating n.
8. **Design assistant.** Wizard for the quantitative pre-record (1.15), threshold/pass-fail designs (p0, p1, risks), two-proportion comparisons, randomization schedule generation with restriction recording, blocking assignment, and factorial cell budgeting with P1-cell protection.
9. **Sequential/adaptive workflow.** Pre-registered look schedule and boundaries; interim reviews logged; adaptive run picks create versioned run-list/card records with exploratory vs confirmatory labels that flow into final reports.
10. **Sensitivity analysis generator.** For any binary measure with unknown outcomes, auto-produce the four bounded cases (all-fail, all-success, model-based, adjudicated-only) side by side.
11. **Reproducibility manifest.** Every published result bundles the frozen manifest (1.29): run list, measure version, input hashes, code/parameter versions, seeds, exclusions, model formula, outputs, review result.
12. **Report blocks as print/tablet deliverables.** Binomial block (4.2), continuous block (4.3), accounting block (4.4), confusion matrix, mission-thread decomposition, and downtime-by-category views render directly into exported test reports and debriefs.
