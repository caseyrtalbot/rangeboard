# MASTER-CALCULATIONS — Unified Calculation Catalog

Synthesis target: the pure TypeScript calculation engine for the RangeBoard T&E Operations module, plus its vitest fixtures.

Source files (all under `docs/te-compilation/`): `09-measures-quantdesign.md` (09), `10-quant-guide.md` (10), `12-jiatf401.md` (12), `02-evidence-measures-design.md` (02), `04-test-cards-execution.md` (04), `05-validation-analysis.md` (05), `06-decision-closeout.md` (06), `08-threat-doctrine.md` (08), `11-instrumentation-worked-cards.md` (11), `13-field-guide-questions.md` (13). Files 01, 03, 07 contain no formulas (confirmed by grep; each states "no numeric formulas").

Conventions in this catalog:
- One canonical entry per calculation. Duplicates across sources are merged; every source is cited by file number and section.
- Math is reproduced exactly, never paraphrased. Bracketed notes are catalog annotations, not source text.
- All source numeric examples are labeled illustrative in the sources ("not Valkryn results"). They are still binding as unit-test fixtures.
- Units: seconds (s), meters (m), meters/second (m/s), hours (hr), dimensionless fractions in [0, 1].

---

## 1. Measure dictionary

### 1.0 Shared definitions used by every measure

**Universal denominator pipeline** (09 §2.0.1, 10 §6.3):

```
Planned → Attempted → Eligible → Valid for this measure → Event observed or not observed → Included in the stated analysis
```

- Planned: listed in the approved design. Attempted: execution began. Eligible: actual conditions created an opportunity under the measure definition. Valid: required configuration, truth, procedure, timing, and data passed. Successful: the defined event occurred within the eligible interval.
- The denominator of a probability is normally the number of **valid opportunities** — never messages, scans, plots, tracks, files, all planned runs, or invalid runs unless the approved measure definition requires that unit (10 §2.12).
- A **valid failure stays in the denominator**. An **invalid run stays in the campaign record but out of every performance denominator**. A **conditionally valid run** supports only named measures. Always report `planned / attempted / eligible / valid / successful` (09 §2.0.1).

**Observation status enum** (09 §1.14, 10 §1.6): missing, invalid, conditionally valid, censored, unknown outcome, no-test.

**Validity levels** (10 §1.7, 11 §2.4): 1 source validity → 2 event validity → 3 measure validity → 4 allowed run use. Validity is assigned **by measure**, not only by run (12 §3.5).

**Threshold source order** (10 §1.5, 02 §2.2; Field Guide variant 13 §2.3): 1 law/regulation/safety limit; 2 contract or validated operational requirement; 3 mission arithmetic; 4 accepted comparison baseline; 5 customer decision rule; 6 analyst judgment clearly labeled. [CONFLICT: Field Guide (13 §2.3) gives six sources whose #5–6 read "customer-approved risk criterion" and "explicitly documented characterization objective" instead of "customer decision rule" and "analyst judgment". Treat 10 §1.5 as canonical enum; store the FG wording as synonyms.] A threshold is never inherent in a measure; record its source separately (09 §3.1.7). With no customer-approved threshold, suppress pass/fail and report characterization only (13 §2.3, §4.2).

**Experimental unit** (10 §1.4): smallest unit that can receive a condition and produce one reasonably independent result. A row is not an experimental unit. Never treat repeated updates from one trajectory, threats within one raid, or messages within one run as independent trials (09 §6.11, 10 §3.7).

### 1.1 CUAS-SEN-PD-001 — Probability of detection

- **IDs:** CUAS-SEN-PD-001 (09 §2.1, 10 §2.2) = JIATF **M-03** (12 §2.1) = Field Guide "Detection Probability" (13 §2.1.2) = "Probability of detection by range band" (04 §7.2).
- **Formula:**
  ```
  p-hat = valid opportunities with a detection event / total valid detection opportunities
  ```
- **Variables:** numerator = count of valid opportunities in which at least one valid detection event occurred within the eligible interval (dimensionless count); denominator = count of valid detection opportunities in the same defined cell (count). Result: fraction [0, 1].
- **Numerator event:** a sensor-originated report produced during an eligible opportunity, associated with the correct truth object under the approved spatial/temporal/identity/persistence gate, meeting the approved confidence/quality/declaration state, not a duplicate or excluded artifact (09 §2.0). The campaign must define whether detection needs one report, `K` consecutive updates, or a minimum dwell; one uncorrelated plot is not automatically a detection (09 §1.2).
- **Denominator rule:** opportunity begins when truth shows the threat enters the approved surveillance volume/range band/time window; ends at exit, vignette end, or approved censoring. Eligible only if sensor in approved configuration and declared available; truth covers the full interval; threat inside profile and condition bounds; instrumentation and time alignment within tolerance (09 §2.0, §3.5).
- **Truth source:** independent threat identity, position, trajectory, and eligibility interval.
- **Validity rule:** invalid when truth cannot establish eligibility, sensor availability unknown, configuration unknown, or time alignment/association out of tolerance.
- **Uncertainty:** binomial confidence or credible interval (§2 methods) plus truth/correlation uncertainty. Report by configuration, threat profile, range band, aspect/azimuth, altitude, speed, environment.
- **Prohibitions:** never claim detection probability outside the tested factor space; never collapse materially different conditions into one average.
- **Thresholds:** none inherent. JIATF open question preserved: "How is Pd (probability of detection) properly defined?" (12 §7.1).

### 1.2 CUAS-SEN-FD-002 — First-detection range or time

- **IDs:** CUAS-SEN-FD-002 (09 §2.1, 10 §2.2) = "First-detection range" (04 §7.2).
- **Formula:**
  ```
  First-detection time = first valid detection time − eligibility-start time
  ```
  Range form: truth-derived slant range, ground range, or distance to the defended boundary at the first valid detection event (m).
- **Variables:** eligibility-start time = truth time the threat enters the approved eligibility region or vignette start (s); first valid detection time = timestamp of first detection event (s).
- **Unit / censoring:** one valid detection opportunity. Censored when no detection occurs before a valid opportunity ends; missing when there is no detection and no complete eligible interval.
- **Truth source:** independent position and time.
- **Validity rule:** invalid when truth or common time cannot support the stated range/time accuracy.
- **Report:** individual observations, censored observations, median/percentiles or approved summary, interval. Uncertainty: truth position, clock, interpolation, sampling interval.
- **Prohibitions:** do not substitute a timeout for a censored value.

### 1.3 CUAS-TRK-FST-003 — First-stable-track range or time

- **IDs:** CUAS-TRK-FST-003 (09 §2.1, 10 §2.2) = JIATF **M-04** (12 §2.1: truth-derived distance from threat to protected boundary when all stable-track rules first pass) = "First-stable-track range" (04 §7.2).
- **Formula:**
  ```
  First-stable-track time = first time all stable-track rules pass − eligibility-start time
  ```
  Range form: truth-derived range at that event (m).
- **Stable-track rule parameters** (define per measure record, 09 §1.3): minimum consecutive updates; maximum allowed update gap; required position/velocity quality; required identity confidence; minimum dwell time.
- **Validity rule:** the complete persistence window must remain observable; a late track cannot be counted if required post-event updates are missing (09), "do not count a late tentative track when the required later updates are missing" (10).
- **Censoring:** no stable track before the opportunity ends. Truth: independent trajectory and identity.
- **Fixture link:** JIATF results A median 2.28 km, B median 3.69 km to boundary (§4, F-28).

### 1.4 CUAS-TRK-CONT-004 — Track continuity

- **IDs:** CUAS-TRK-CONT-004 (09 §2.1, 10 §2.2) = JIATF **M-05** (12 §2.1) = Field Guide "Track Continuity" (13 §2.1.4).
- **Formula:**
  ```
  Continuity = eligible time with valid associated track / total valid eligible tracking time
  ```
- **Variables:** numerator = duration (s) in which the correct associated track satisfies the approved quality state; denominator = total valid eligible tracking duration (s), excluding only preapproved no-test intervals. Result: fraction [0, 1].
- **Gap rule:** define the maximum update gap before continuity is considered lost (09).
- **Unit:** one truth object during one card-defined interval.
- **Truth source:** independent object trajectory, identity, eligibility interval, time.
- **Validity rule:** invalid when eligible duration or association cannot be reconstructed.
- **Report with:** number and duration of track losses, reacquisition time, worst valid opportunity.
- **Threshold (JIATF seed):** Configuration B must not reduce median track continuity by more than 0.03 (12 §1.8.4, H-03).

### 1.5 CUAS-TRK-ERR-005 — Track position error

- **IDs:** CUAS-TRK-ERR-005 (09 §2.1, 10 §2.2) = JIATF **M-06** (12 §2.1) = Field Guide "Track Position Error" (13 §2.1.3).
- **Formulas:**
  ```
  Error vector(t) = transformed blue-track position(t) − transformed truth position(t)
  Radial error   = sqrt(x-error² + y-error² + z-error²)
  RMSE           = sqrt( sum(error_i²) / m )
  ```
- **Variables:** blue-track position(t), truth position(t) in a common coordinate frame after the recorded transformation version (m); error components x/y/z (m); `m` = number of matched (time-correlated) samples; `error_i` = per-sample error magnitude (m).
- **Metrics allowed:** radial, along-track, cross-track, vertical error, percentile, RMS, or threshold exceedance as approved.
- **Unit rule:** opportunity-level summary, not every update, unless the correlation structure is modeled. Matched updates within one run support ONE opportunity-level summary; they do NOT count as independent tests (12 §2.1 M-06, 09 §2.1).
- **Truth source:** calibrated independent position source. Required fields: blue position, truth position, coordinate frames, common time, transformation version, registration calibration.
- **Validity rule:** compare only time-correlated samples inside truth coverage and approved geometry.
- **Uncertainty:** truth accuracy, blue quantization, interpolation, coordinate transformation, registration, clock error. Ground-truth measurement error must be small relative to the smallest decision-relevant effect (13 §2.1).
- **Threshold (JIATF seed):** opportunity-level position RMSE at or below 50 m (12 §1.8.5).

### 1.6 CUAS-CLS-ACC-006 — Classification accuracy

- **IDs:** CUAS-CLS-ACC-006 (09 §2.1, 10 §2.2) = "Classification accuracy" (04 §7.2).
- **Formula:**
  ```
  Accuracy = correctly classified valid objects / valid objects requiring classification
  ```
- **Numerator:** final or card-defined classification state equals truth class. **Denominator:** valid classification opportunities (one independently identified truth object per defined classification opportunity).
- **Truth source:** independent identity/class label with documented source and adjudication record.
- **Validity rule:** freeze class taxonomy, decision time, and treatment of "unknown" before execution.
- **Required companion output:** confusion matrix; unknown/unclassified rate; false-hostile rate; false-friendly rate; results by threat class.
- **Uncertainty:** multinomial/binomial interval plus truth-label uncertainty.

### 1.7 CUAS-SUR-FTR-007 — False or nuisance track rate

- **IDs:** CUAS-SUR-FTR-007 (09 §2.1, 10 §2.2) = JIATF **M-09** (12 §2.1) = Field Guide "Nuisance/False Track Rate" (13 §2.1.6) = "False tracks per hour" (04 §7.2).
- **Formula:**
  ```
  Rate = adjudicated false or nuisance tracks / valid surveillance exposure time
  ```
- **Variables:** numerator = count of tracks satisfying the operational-track criterion with no truth association under the approved reconciliation rule; denominator = valid surveillance hours (hr), optionally stratified by volume and condition. Result: tracks/hr.
- **Truth source:** complete-enough truth inventory for real objects in the observed volume.
- **Validity rule:** invalid when truth coverage is inadequate to decide whether an object existed.
- **Report separately (enum):** false tracks, duplicate tracks, split tracks, uncorrelated real objects, nuisance but real objects (09 §1.11).
- **Uncertainty:** count/rate interval, truth-coverage uncertainty, clustering by interval.
- **Threshold (JIATF seed):** customer screening limit 1.5 false tracks per valid surveillance hour (12 §7.2).

### 1.8 CUAS-C2-HS-008 — Handoff success probability

- **IDs:** CUAS-C2-HS-008 (09 §2.2, 10 §2.2) = JIATF **M-07** (12 §2.1).
- **Formula:**
  ```
  p-hat = successful usable handoffs / valid qualifying handoff opportunities
  ```
- **Numerator event:** receiving system creates or updates the correct object into the card-defined usable state within the allowed interval. Handoff success criteria (09 §1.4): correct identity or approved correlation; required fields present; usable quality and freshness; traceable receiving-system event time. Packet receipt alone is not success unless packet receipt is the approved question.
- **Denominator rule:** valid source tracks that met every prerequisite (the offer criterion). Do not count opportunities in which the source never met the approved offer criterion (10: "a source track must meet the offer rule before it enters the denominator").
- **Truth source:** source-to-master-to-receiver object correlation, message/event logs, common time.
- **Failure categories (enum, 09 §1.10):** no transmission, rejected message, schema failure, identity error, stale data, duplicate/merge error, unusable quality, timeout.
- **Uncertainty:** binomial interval plus association uncertainty.
- **Threshold (JIATF seed):** at least 90% usable handoff success in tested core cells (12 §1.7 H-02).

### 1.9 CUAS-C2-LAT-009 — Sensor-to-C2 / handoff latency

- **IDs:** CUAS-C2-LAT-009 (09 §2.2, 10 §2.2) = JIATF **M-08** (12 §2.1) = Field Guide "C2 Handoff Latency" (13 §2.1.5) = "Sensor-to-command latency" (04 §7.2).
- **Formula:**
  ```
  Latency = receiving-system usable-track event time − source qualifying-track event time
  ```
- **Variables:** start event = source track first satisfies the offer criterion (s); stop event = receiving system first satisfies the usable-track criterion (s). Result: s.
- **Per-latency definition fields (freeze before execution, 09 §1.25):** start event; stop event; common time source; maximum event-time uncertainty; observation window; censoring; repeated opportunities and clustering.
- **Censoring:** no successful handoff before the approved window closes. A failed handoff is censored or failed under the approved rule; it is NEVER assigned the timeout as a completed latency (09, 10, 12 — unanimous prohibition).
- **Truth source:** source and receiver event logs on a verified common time base; independent correlation to the correct object.
- **Uncertainty:** u_latency budget (§3.4); components: source timestamp, receiver timestamp, synchronization, logging, transport, correlation, event-resolution.
- **Report:** distribution, median/percentiles, successful fraction, censored fraction, condition breakdown.
- **Threshold (JIATF seed):** added 90th-percentile source-to-C2 latency at or below 1.0 s versus baseline (12 §1.8.6).

### 1.10 CUAS-MSN-UWT-010 — Usable warning time

- **IDs:** CUAS-MSN-UWT-010 (09 §2.2, 10 §2.2) = JIATF **M-01, primary** (12 §2.1) = Field Guide "Usable Warning Time" (13 §2.1.1) = real JIATF measure "early-warning buffer" (12 §7.1).
- **Formula:**
  ```
  Usable warning time = truth time at defended-asset boundary − decision-ready-track event time
  ```
  Distance/speed form for prediction and cross-check (12 §2.2): `Usable warning time = remaining path distance to boundary (m) / ground speed (m/s)`.
- [CONFLICT: Field Guide 5 (13 §2.1.1) states the subtraction reversed — "time usable track enters C2 − time threat reaches defended-asset boundary" — which yields negative values for useful warning. Files 09, 10, and 12 all state boundary time minus decision-ready time. Canonical: `boundary crossing time − decision-ready track time`. Treat the FG form as a source transposition.]
- **Variables:** truth boundary time = independent-truth time the threat crosses the approved defended-asset or latest-action boundary (s); decision-ready-track time = receiving-system event time when the track first satisfies the customer-approved decision-ready definition (s).
- **Decision-ready track definition fields (09 §1.5):** position quality, velocity, classification, confidence, freshness, continuity, required metadata — customer-approved for the next mission task. JIATF seed instantiation (12 §2.1 M-01): correct truth-object association AND required position and velocity fields AND track age within 1.0 s AND position-quality state within the customer criterion AND C2 track persistence at least 3 consecutive updates.
- **Unit:** one valid threat presentation.
- **No-warning rule:** if no decision-ready track occurs, report a no-warning outcome; do NOT assign zero unless the approved definition requires it (09 §2.2, 10 §2.2).
- **Truth source:** independent trajectory and boundary-crossing time; receiving-system decision-ready-track event.
- **Validity rule:** boundary, threat route, and decision-ready-track definition must remain frozen.
- **Interpret with:** track quality, false-track burden, handoff success, effector timeline.
- **Thresholds (JIATF seed):** median warning time at least 90 s in the core condition (mission arithmetic, §3.3); paired increase at least 25 s (12 §1.8).

### 1.11 M-02 — Paired warning-time improvement (campaign-local; no CUAS dictionary ID)

- **IDs:** JIATF **M-02** (12 §2.1). General form = "Difference" family (10 §2.1).
- **Formula:**
  ```
  Paired improvement = warning time for Configuration B − warning time for Configuration A
  ```
- **Variables:** the two M-01 values (s) from one matched pair. Result: s; positive favors B only because the preferred direction is declared (10 §2.1: "a positive difference is not automatically good; define the preferred direction").
- **Pairing constraint:** pairs must use the same threat profile and factor cell within the same test block (12).
- **Uncertainty:** bootstrap interval on the paired median (§2.9); paired sample size per §2.8.
- **Threshold (JIATF seed):** minimum meaningful paired improvement 25 s; interval must not indicate a material negative effect (12 §1.8).

### 1.12 CUAS-EW-EFF-011 — Probability of mission-relevant EW effect

- **IDs:** CUAS-EW-EFF-011 (09 §2.3, 10 §2.2).
- **Formula:**
  ```
  p-hat = valid EW opportunities reaching the defined effect state / total valid EW effect opportunities
  ```
- **Numerator event:** independent truth shows the card-defined effect state. Effect states (enum, define per campaign, 09 §1.7): navigation deviation (route deviation), control-link loss, mission abort, forced recovery, loss of terminal function, temporary suppression.
- **Denominator rule:** valid presentations in which the EW system was available, authorized, correctly configured, and applied inside the approved geometry. Unit: one independently reset threat presentation.
- **Truth source:** independent trajectory/state telemetry plus effect-state evidence not solely generated by the EW system under test. The EW system's own "effect achieved" flag is never sole truth.
- **Validity rule:** record actual frequency/power/profile using the campaign's permitted representation; exclude only under preapproved no-test rules.
- **Uncertainty:** binomial interval, truth uncertainty, emission/exposure uncertainty, clustering by threat article or software state.
- **Prohibitions:** never claim physical defeat when only temporary suppression was shown. Loss of a command link is not automatically defeat — the threat may continue a waypoint route, enter terminal guidance, follow lost-link behavior, or recover (08 §2.5).

### 1.13 CUAS-EW-REC-012 — Time to effect and recovery

- **IDs:** CUAS-EW-REC-012 (09 §2.3, 10 §2.2).
- **Formulas:**
  ```
  Time to effect = effect-entry event time − qualifying-exposure event time
  Recovery time  = effect-exit event time − effect-entry event time
  ```
- **Variables:** qualifying-exposure event = time-aligned emission/exposure record shows valid exposure began (s); effect-entry/effect-exit = independent threat-state record transitions (s). Results: s.
- **Unit:** one valid EW opportunity.
- **Censoring:** effect not observed before exposure/vignette ends; recovery not observed before observation ends.
- **Truth source:** time-aligned emission/exposure record and independent threat-state record; qualifying exposure and state transitions must be independently reconstructable.
- **Report:** time-to-event distribution, censored fraction, recurrence, condition breakdown. Separate temporary suppression from mission defeat.

### 1.14 CUAS-DEF-PINT-013 — Probability of intercept

- **IDs:** CUAS-DEF-PINT-013 (09 §2.4, 10 §2.2) = "Probability of intercept" (04 §7.2, 08 §2.6).
- **Formula:**
  ```
  p-hat = valid engagement opportunities with confirmed intercept / total valid intercept opportunities
  ```
- **Numerator event:** independent evidence confirms the interceptor meets the card-defined intercept criterion.
- **Denominator rule:** valid engagement opportunities in which the system created a qualifying engagement and the interceptor was available and correctly released, with approved engagement prerequisites. **Never count detection-only opportunities in the intercept denominator** (09 §6.11).
- **Truth source:** independent geometry, interceptor and threat trajectories, intercept-event evidence.
- **Report separately (enum, 09 §1.8):** no assignment, no launch, launch failure, guidance failure, miss, intercept with unknown effect, confirmed intercept.
- **Uncertainty:** binomial interval, trajectory/registration uncertainty, clustering by article/operator.

### 1.15 CUAS-DEF-PDEF-014 — Probability of defeat

- **IDs:** CUAS-DEF-PDEF-014 (09 §2.4, 10 §2.2) = "Probability of defeat" (04 §7.2) = "Probability of mission defeat" (08 §2.6).
- **Formula:**
  ```
  p-hat = valid opportunities with confirmed defeat / total valid defeat opportunities
  ```
- **Defeat event:** truth establishes the threat can no longer complete the card-defined mission during the remaining vignette (09 §2.0). Defeat outcome taxonomy (09 §1.6): physical destruction, functional mission kill, diversion or forced landing, lost guidance or navigation, temporary suppression, unknown outcome.
- **Denominator rule:** valid defeat opportunities with complete kill-chain prerequisites specified by the card. Unit: one valid engagement against one truth threat object or one defined raid.
- **Truth source:** independent threat outcome, trajectory, state, mission-completion assessment.
- **Report separately (enum, 09 §1.9):** confirmed defeat, probable defeat if allowed, no defeat, unknown outcome, no-test.
- **Validity rule / prohibition:** unknown outcomes never silently become successes or failures — apply the four-case sensitivity analysis (§2.15). Never call an intercept a defeat without independent mission-outcome truth (10 §4.3 Pattern 4).

### 1.16 CUAS-MSN-E2E-015 — End-to-end mission success

- **IDs:** CUAS-MSN-E2E-015 (09 §2.4, 10 §2.2) = "End-to-end mission success" (04 §7.2, 08 §2.3).
- **Formula:**
  ```
  p-hat = valid vignettes achieving the mission-success state / total valid mission vignettes
  ```
- **Unit:** one complete vignette or raid as defined. Numerator: mission-level Measure of Success achieved.
- **Truth source:** complete mission-event chain, defended-asset state, threat outcome, required operator/system states.
- **Required decomposition:** detection, track, classification, decision, assignment, engagement, effect, assessment, mission outcome.
- **Validity rule:** all mission-critical states must be reconstructable. A component success cannot substitute for missing mission-outcome truth.
- **Uncertainty:** binomial or model-based interval; measurement uncertainty at decisive events; variation across threats and conditions.

### 1.17 CUAS-SAT-LEAK-016 — Leaker fraction and raid failure probability

- **IDs:** CUAS-SAT-LEAK-016 (09 §2.5, 10 §2.2) = "raid leakage" (08 §2.3).
- **Formulas (two, report both):**
  ```
  Leaker fraction = truth threats reaching the boundary without prior confirmed defeat / valid truth threats in the raid
  Raid failure probability = raids with at least one leaker / total valid raids
  ```
- **Experimental units:** threat object (nested) for leaker fraction; raid (primary) for raid-failure probability. Threats within one raid are related — never independent raids/campaigns (unanimous 09/10/11).
- **Truth source:** identity-preserving multi-object trajectories, boundary crossing, engagement history, defeat outcome.
- **Validity rule:** preserve raid membership.
- **Report with:** maximum concurrent tracks, assignments, engagements, operator interventions, queue delay, resource exhaustion.
- **Uncertainty:** object-within-raid dependence, raid-level interval, truth-association uncertainty.

### 1.18 CUAS-SUIT-AVAIL-017 — Operational availability

- **IDs:** CUAS-SUIT-AVAIL-017 (09 §2.5, 10 §2.2) = "Availability" (04 §7.2) = "availability during the mission window" (08 §2.3).
- **Formula:**
  ```
  Availability = mission-capable time / required operating time
  ```
- **Variables:** mission-capable time = time (s or hr) the system is in the approved mission-capable state; required operating time = total required time (same units), including only the downtime categories specified before execution. Result: fraction [0, 1].
- **Validity rule (freeze before execution):** the mission-capable definition and whether scheduled maintenance, test-infrastructure downtime, external range holds, and operator unavailability enter the denominator (09 §1.12).
- **Downtime categories (enum):** system fault, scheduled maintenance, test infrastructure, operator, external constraint, unknown.
- **Truth source:** operator log, system health, maintenance record, configuration, independent readiness checks.
- **Uncertainty:** interval or model appropriate to the time basis; classification uncertainty for downtime.

### 1.19 CUAS-HMI-INT-018 — Operator intervention rate

- **IDs:** CUAS-HMI-INT-018 (09 §2.5, 10 §2.2) = "Operator intervention rate" (04 §7.2).
- **Formula:**
  ```
  Rate = qualifying operator interventions / valid operating hours or valid mission vignettes
  ```
- **Numerator event:** a time-tagged action meeting the approved intervention definition. Intervention types (enum, 09 §1.13): required decision, correction, override, recovery, false-alarm handling, unplanned troubleshooting.
- **Denominator:** valid exposure hours (hr) or vignettes (count). Result: interventions/hr or interventions/vignette.
- **Truth source:** operator-interface logs, voice/event log, observer record.
- **Validity rule:** distinguish planned doctrinal action from intervention caused by system behavior.
- **Uncertainty:** count/rate interval and observer-classification uncertainty.

### 1.20 M-10 — Mission margin

- **IDs:** JIATF **M-10** (12 §2.1) = "Remaining mission margin" (10 §2.1) = "end-to-end warning margin" (08 §2.3). Full arithmetic in §3.2 (operational calculations); catalog it once as a measure here.
- **Formula (measure form, 12):**
  ```
  Mission margin = usable warning time − required action-chain time − uncertainty reserve
  ```
  General form (10 §2.1): `Available time = boundary-crossing time − decision-ready time; Required action time = decision + authority + assignment + effect + assessment; Mission margin = available time − required action time`.
- **Variables:** usable warning time = M-01/CUAS-MSN-UWT-010 result (s); required action-chain time = sum of chain stage times (s, see §3.2); uncertainty reserve = approved safety-and-uncertainty margin (s).
- **Interpretation:** positive margin means time remains under the defined assumptions; negative margin means the chain is late. A positive margin supports only the tested timeline — not a faster threat, another route, another effector, or another C2 procedure (12 §2.2).
- **Threshold (JIATF seed):** positive mission margin in at least 80% of valid end-to-end confirmation opportunities under the tested core condition (12 §1.7 H-05).

### 1.21 Named-measure index (names without source formulas)

File 08 (§2.2–2.7) and file 04 (§7.2) enumerate candidate measures by name only; exact math is deferred to this dictionary. Names that resolve to canonical entries above: warning time → 1.10; first-detection range → 1.2; first-stable-track range/initiation time → 1.3; continuity → 1.4; position and velocity error → 1.5; classification/identification accuracy, unknown rate, false-hostile/false-friendly → 1.6; false alerts → 1.7; handoff success/assignment success → 1.8; sensor-to-C2 latency, C2-to-effector latency → 1.9 (instantiate with different start/stop events); probability of intercept → 1.14; probability of defeat → 1.15; end-to-end mission success → 1.16; raid leakage / simultaneous-target capacity → 1.17 and §3.6; availability during mission window → 1.18; operator interventions/workload → 1.19; time to effect / duration of effect / recovery time → 1.13; shots or effects per defeat, magazine expenditure, cost per defended effect → §3.7; total detect-to-effect time → §3.2; re-engagement time, assessment time, correct effect assessment, false-success rate, expired engagement opportunities, track purity, drops, swaps, update rate, decision latency, alert-dissemination time, passive-defense measures (time exposed, time to displace, signature change, etc.) → NAME-ONLY: instantiate via the elapsed-time, rate, or proportion family (§2.1/§3.1) with campaign-defined start/stop events and denominators. The measure hierarchy (mission → COI → MOE → MOS → MOP → data requirements, 13 §2.8) organizes the registry but computes nothing.

---

## 2. Statistics engine

All methods below are exact source math. Every interval must carry its type label (confidence / credible / prediction / tolerance, 10 §1.8). Four uncertainty types stay distinct on every result: measurement, sampling, operational variability, model (09 §2.0.2). Never compress them into one "high confidence" label.

### 2.1 Proportion estimate

```
p-hat = x / n
x = number of valid successes
n = number of valid opportunities
```
Report the counts and the percentage; never a percentage alone (10 §2.1). Sources: 09 §2.6, 10 §2.1.

### 2.2 Wilson interval (default binomial interval)

```
center     = (p-hat + z²/(2n)) / (1 + z²/n)
half-width = [ z / (1 + z²/n) ] × sqrt( p-hat(1 − p-hat)/n + z²/(4n²) )
interval   = center ± half-width
```
`z` = standard-normal quantile for the confidence level; `z = 1.96` at 95%. The manual's normal default for a binomial proportion. Never use the uncorrected normal approximation near zero or one. Sources: 10 §2.6, 09 §2.6.

### 2.3 Exact (Clopper-Pearson) interval

Use an exact binomial interval when the sample is very small, the event is rare, or the accepting method requires it (09 §2.6, 10 §2.6). [No closed form is given in the sources; implement standard Clopper-Pearson via the Beta quantile: lower = BetaInv(α/2; x, n−x+1), upper = BetaInv(1−α/2; x+1, n−x); lower = 0 when x = 0, upper = 1 when x = n.]

### 2.4 Bayesian beta-binomial posterior

```
Prior:     Beta(a, b)
Observed:  x successes in n valid opportunities
Posterior: Beta(a + x, b + n − x)
```
The prior must be approved and justified before execution; report sensitivity to another defensible prior when the prior can change the decision (09 §1.30, §2.6; 10 §2.6). Credible interval = posterior probability interval.

### 2.5 Sample size — precision-driven, one proportion

```
n ≈ z² × p × (1 − p) / h²
```
`n` = required independent valid opportunities; `z` = confidence quantile (1.96 at 95%); `p` = planning proportion (use 0.5 for the largest approximate sample when no defensible value exists); `h` = desired two-sided interval half-width. **Round up.** Planning approximation only: inflate for invalid runs, clustering, blocked cells, condition-specific reporting. Sources: 09 §2.7, 10 §2.7.

### 2.6 Attempt inflation for invalid evidence

```
Required attempts = required valid opportunities / expected valid-run fraction
```
A planning allowance, never permission to weaken validity rules. Sources: 09 §2.9, 10 §2.7, 12 §2.4.

### 2.7 Threshold / pass-fail (fixed or sequential) design

Inputs to freeze before execution (09 §1.18, 10 §1.10): unacceptable probability `p0`; operationally acceptable probability `p1`; false-accept risk; false-reject risk; exact decision rule; maximum sample; whether sequential stopping is permitted. Method: exact binomial calculation or simulation. **Never choose the required success count after viewing data.** [No closed form in sources; implement by exact binomial search over (n, c) satisfying both risk constraints.]

### 2.8 Paired / two-proportion comparison

Paired continuous sample-size approximation (12 §2.3):
```
Approximate paired sample = [ (z_alpha + z_power) × sd / min_effect ]²
```
`z_alpha` = confidence quantile (1.96 two-sided 95%); `z_power` = power quantile (0.84 for 80% power); `sd` = expected standard deviation of paired differences (units of the measure); `min_effect` = minimum operationally meaningful paired difference (same units). Round up. Planning approximation; the analysis lead completes the final power or simulation check.

Two-proportion design inputs (09 §1.19, 10 §1.11): baseline probability; minimum meaningful difference or risk ratio; allocation; one-/two-sided; confidence and power; pairing; blocking; order and carryover effects. Use exact calculation or simulation for the final sample. Paired comparisons are more efficient when the same controlled condition is presented to both configurations, but order and carryover must be controlled.

DOE rules (13 §2.4): calculate power for the complete design, not per design point; typical confidence targets 80–95%; show the power-vs-runs trade; never default to "three runs"; worked precedent: four replicates sufficed at 95% confidence (DOT&E DOE example).

### 2.9 Continuous outcomes: mean interval, quantiles, bootstrap

```
mean ± t × standard deviation / sqrt(n)
```
Only when experimental units and assumptions support it (10 §2.7). Latency, warning-time, and recovery distributions are often skewed — prefer median, percentiles, bootstrap intervals, or time-to-event methods (09 §2.10, 10 §2.7). JIATF usage: 95% bootstrap interval on the median paired improvement (12 §2.7). Interval-type selection (09 §2.10, 10 §1.8): confidence (parameter), credible (Bayesian posterior), prediction (future observation), tolerance (population fraction with stated confidence). Never use a mean's confidence interval to claim coverage of individual future missions.

### 2.10 Censoring and time-to-event

Censored record fields (09 §1.26): `Observed time = time from start to observation-window end; Status = right censored; Reason = approved code`. Never substitute the timeout as if the event occurred. Use **Kaplan-Meier** or another survival model when censoring is material; report the probability of completing the event by mission-relevant times. Competing events (defeat, boundary crossing, abort, truth loss): record the mechanism; do not treat all mechanisms as equivalent censoring without justification (09 §2.11, 10 §2.11).

### 2.11 Reliability

```
Reliability probability = successful periods / valid periods          (binomial interval)
Failure rate            = relevant failures / total valid time at risk
Zero-failure bound      ≈ 3 / total time at risk                      (one-sided 95% upper, constant-rate exponential)
Availability            = mission-capable time / required operating time
```
State the failure definition (frozen before execution) and the assumed failure process. The zero-failure bound is model-dependent; inappropriate when failures cluster, wear changes, or mission conditions differ; it never proves zero risk. Sources: 09 §2.12, 10 §2.8.

### 2.12 Combined uncertainty (root-sum-square)

```
u_combined = sqrt(u_1² + u_2² + ... + u_k²)
```
For independent measurement uncertainties; add covariance terms when errors are correlated. Keep measurement uncertainty attached to each run-level result — sampling intervals across runs do not replace it. Sources: 09 §2.13, 10 §2.5. Latency instantiation in §3.4.

### 2.13 Sequential and adaptive rules

Pattern: `Screen → Augment → Validate` (09 §6, 10 §6.5). Predefine before any outcome review (09 §1.24, 10 §1.13): initial sample/budget share; interim-review schedule; statistics or posterior quantities reviewed; efficacy/sufficiency boundary; futility boundary; maximum sample; allowed factor-space augmentation; confirmatory sample held back; treatment of repeated looks.
- **Frequentist:** approved group-sequential or alpha-spending method when formal false-positive control matters. Repeatedly computing ordinary 95% intervals and stopping when favorable inflates error (prohibited).
- **Bayesian:** rules may use posterior probability that performance exceeds the threshold; posterior probability that improvement exceeds delta; posterior predictive probability that the final decision will succeed. Probability cutoffs must be approved before execution — never invented during it.
- Budget guardrail (13 §2.4): limit the first design to 25–40% of the test budget; Bayesian updating supports early stopping when posterior uncertainty is sufficiently small.
- Stop rules (10 §6.6): stop for sufficiency when approved minimum evidence exists, remaining uncertainty within limit, more runs unlikely to change the decision, required coverage exists, authority accepts strength. Stop for futility when truth/system/condition/authority cannot be restored, remaining events cannot support the conclusion, information gain does not justify cost, or a design flaw requires a new campaign. Never stop because the current result is favorable; never continue only because range time remains.

### 2.14 Multiple comparisons

Identify primary comparisons in advance; label exploratory ones; limit formal claims; control familywise or false-discovery error when formal claims require it; prefer effect sizes and intervals over isolated p-values; never mine conditions until one favorable result appears (09 §2.15, 10 §3.8).

### 2.15 Sensitivity analysis for unknown binary outcomes

Report all four cases when unknowns could change the decision (09 §2.14, 10 §2.13):
```
Case 1: all unknowns treated as failures
Case 2: all unknowns treated as successes
Case 3: approved model-based treatment
Case 4: primary analysis with adjudicated outcomes only
```
Never silently choose the favorable case. Outlier rule (10 §2.14, 05 Part D): use the preapproved rule; otherwise report with and without the outlier.

### 2.16 Factorial / response-surface design math

- Cell count = product of factor levels. Example: passive defense (absent/present) × active defense (nominal/degraded) = **4 cells** (10 §4.4). JIATF matrix: 3 azimuths × 2 altitudes × 2 speeds = **12 cells** (12 §2.5).
- Factorial or fractional-factorial estimates main effects and interactions across the envelope (candidate factors 09 §1.22: range, altitude, azimuth/aspect, speed, threat class, raid size, emissions/guidance mode, clutter, RF/network state, configuration, operator condition). Do not report only main effects when the interaction changes the mission conclusion.
- Fractional factorial when full is too costly: protect P1 cells; state unresolved interactions.
- Response-surface after screening finds the important continuous factors; locate boundaries; never extrapolate beyond the tested region. Space-filling + Gaussian process for M&S exploration (13 §2.4).
- Regression record (09 §1.23, 10 §1.19): formula, factor coding, interactions, reference levels, inclusion/exclusion rules, software version, model checks, sensitivity to alternatives, interpolation region, prohibited extrapolation. Association is not causation unless the design supports causal attribution.

### 2.17 Method-selection tree (10 §2.11)

```
Binary result?                    → Binomial interval or binary (logistic/probit) regression
Continuous result?                → Mean/median/percentile with interval
Count over exposure?              → Rate model (Poisson; negative-binomial when overdispersed)
Time until event with censoring?  → Time-to-event analysis (Kaplan-Meier / survival model)
Repeated or clustered data?       → Mixed-effects or hierarchical model
Several controlled factors?       → Regression, factorial, or response-surface model
```
Use the simplest method that answers the approved question and respects the data structure. Model-to-response mapping (09 §1.23): continuous → linear/nonlinear regression; binary → logistic/probit; count/rate → Poisson/negative-binomial; repeated/clustered → mixed-effects/hierarchical; time-to-event → survival; nonlinear spatial → justified spline/Gaussian process with validation.

### 2.18 Hard prohibitions for the engine (09 §6.11, 10 §3.7)

Never: collapse materially different conditions into one average; treat correlated updates or threats-in-raid as independent trials; substitute a timeout for a censored event time; assign zero warning time on no-detection unless the approved definition requires it; select success counts or stopping rules after viewing data; claim performance outside the tested factor space; treat temporary suppression as physical defeat; count detection-only opportunities in the intercept denominator; report a percentage without counts; use a system-under-test message as its own truth; remove an outlier because it is inconvenient; present exploratory results as confirmatory; present association as cause without a causal design.

---

## 3. Operational calculations

### 3.1 Basic families (10 §2.1)

```
Rate            = number of qualifying events / valid exposure            (exposure: time, distance, missions, raids)
Elapsed time    = stop-event time − start-event time
Duration fraction = time in the required state / total valid eligible time
Difference      = result for treatment B − result for treatment A         (declare preferred direction)
Relative change = (new − baseline) / baseline                             (report absolute change alongside; caution near zero baseline)
```

### 3.2 Mission-time arithmetic and chain-time math

**Timeline decomposition** (02 §2.1 — components; 10 §2.1/§2.4 — equations). Work backward from the mission effect. Components: threat speed, release range, processing time, operator decision time, authority time, effector assignment, time of flight or time to effect, assessment, margin.

```
Total chain time = stage 1 time + stage 2 time + ... + stage k time
Total detect-to-effect time = detection time + track time + handoff time + decision time + assignment time + effect time
Required chain time = processing + operator decision + authority + assignment + launch or effect preparation + flight or time to effect + assessment + required margin
Time to boundary = remaining path distance / ground speed        (constant-speed approximation; use measured trajectory when speed/path/altitude changes materially)
Available time = boundary-crossing time − decision-ready time
Mission margin = available time − required action time            (see measure 1.20)
```
Use observed event differences when possible; never add overlapping stage times twice.

**Timing decision rule** (10 §2.4):
```
If available time > required chain time:                     timing condition is met
If available time = required chain time within uncertainty:  result is borderline
If available time < required chain time:                     timing condition is missed
```
The approved uncertainty band controls the borderline rule.

**Warning-threshold derivation (mission arithmetic)** (12 §2.2): `Required warning threshold = required chain time + uncertainty reserve`. JIATF seed: 8 + 4 + 8 + 55 + 5 = 80 s chain; 80 + 10 = 90 s threshold.

**Doctrine planning constants** (08 §2.9, §7.4): detect-to-engage design threshold ≤ 4 minutes (FAAD C2 construct); planning detection range ≈ 50% of a system's maximum range; fixed-site engagement volume ≈ 30 km radius / 20,000 ft AGL from bullseye center.

### 3.3 Warning-time math

Primary event form and no-warning rule: measure 1.10. Distance/speed prediction and cross-check forms (12 §2.2, §2.7):
```
Usable warning time = distance to boundary at decision-ready (m) / ground speed (m/s)
Range gain → time gain: Δrange (m) / speed (m/s) = Δwarning (s)     (cross-check of warning gain against stable-track range gain)
```

### 3.4 Latency budgets (11 §2.1–2.2, 10 §2.5, 12 §2.6)

```
u_latency = sqrt( u_start_timestamp² + u_stop_timestamp² + u_synchronization² + u_event_definition² )
approximate along-track error from timing = object speed × time offset
```
Variables: `u_start_timestamp` / `u_stop_timestamp` = uncertainty of each event timestamp (s); `u_synchronization` = clock-sync uncertainty between recording devices (s); `u_event_definition` = ambiguity in when the event is defined to occur (s); object speed (m/s); time offset (s); result (m). Acceptance rule: u_latency must be smaller than the minimum decision-relevant latency difference; derive each tolerance from its measure — no universal timing tolerance. A clock tolerance fine for slow ground activity may invalidate a high-speed intercept measure.

Clock health math (10 §2.3):
```
Clock offset      = device time − authoritative time
Clock drift rate  = (offset at end − offset at start) / elapsed check time
```
Keep original time; corrections only in a versioned derived field.

### 3.5 Run-count / matrix math

```
Configuration × Threat × Condition × Method × Repetition = Planned runs        (04 §2.1)
Condition cells = product of factor levels                                      (12 §2.5: 3 × 2 × 2 = 12)
Stage totals: Stage 1 cells × configurations + Stage 2 cells × configurations + Stage 3 opportunities = target valid
Required scored attempts = target valid / expected valid-run fraction           (§2.6)
Maximum planned activity = required attempts + control/rehearsal opportunities
```
The matrix generator must also show: total runs, estimated duration, coverage by question, coverage by condition, required assets, missing controls, planned repetitions, minimum valid evidence, and drop order if time is lost (04 §2.1).

### 3.6 Data-quality and capacity calculations (10 §2.3)

```
Valid-run rate        = valid runs / attempted runs
Data completeness     = required records present and usable / total required records
Observed update rate  = usable records / valid observation time      (also report maximum consecutive gap)
Loss fraction         = (expected records − received usable records) / expected records
Queue delay           = service-start time − queue-entry time
Concurrent load       = maximum number of active objects in the defined state
Throughput            = completed qualifying actions / valid time
```
- Valid-run rate shows test-process quality, not system performance. [Denominator note: 06 §2 marks the denominator ambiguous; 10 §2.3 and the JIATF fixture 48/58 attempts both use attempted runs — resolved: attempted.]
- Loss limits are phase-specific: 1% loss clustered around the handoff event can outweigh larger loss outside the active phase (11 §2.3).
- Record the first observed load where mission performance crosses the approved boundary; never claim capacity above the highest tested load.

### 3.7 Resource expenditure (10 §2.3)

```
Effects per defeat                     = effects used / confirmed defeats
Cost per defended effect               = approved resource cost / confirmed defended effects
Personnel days per valid evidence unit = total personnel days / valid evidence units
```
Freeze the cost and resource basis before comparison.

### 3.8 Evidence accounting chain

Per measure, always preserve and report all counts (10 §1.20, 09 §4.4): planned, attempted, eligible, valid, conditionally valid, invalid, missing, censored, unknown, successful, included in each analysis. Denominators derive from status; they are never hand-entered. Aggregation prohibitions (05 Part E): never combine different configuration baselines without a stated model; different threat profiles as one condition; independent runs and repeated samples as equal units; valid and invalid evidence; pre-change and post-change conditions without explicit comparison.

**Preliminary use rule (post-run 4-state enum, 12 §4.2):** Usable (all primary events and states pass) / Limited (supports named sensing measures but not warning or latency) / Repeat (a required validity condition fails) / Valid failure (test valid, system misses the event rule).

### 3.9 Adaptive next-run priority

Three source formulations — implement both computable forms, always advisory:

1. **Field Guide ratio (13 §2.2), canonical quick form:**
   ```
   Priority = decision importance × uncertainty reduction × likelihood of obtaining valid evidence / (time / cost / operational burden)
   ```
   "A qualitative High / Medium / Low scoring system is usually sufficient."
2. **Weighted additive score (10 §2.9):**
   ```
   Event value = sum( weight_j × score_j )
   ```
   over the 10 criteria (10 §1.14): decision effect; current uncertainty; ability to distinguish causes; expected information gain; acceptance value; comparability; range time; safety and technical risk; asset scarcity; schedule effect.
3. **Unweighted criteria comparison (02 §2.4, 05 Part I):** score and rank without a hard-coded formula; "select the event with the best decision value that remains safe, authorized, and methodologically defensible."

[CONFLICT: the three sources give a multiplicative ratio, a weighted sum, and no formula respectively. They are planning aids, not mandated rules — "use the score to inform judgment; do not let a formula override mission or safety context" (02) — so the engine ships both computable forms, labeled advisory, with an override note.]

Preapproved adaptation rule pattern (12 §3.4, conditional logic fixtures): IF required truth/configuration/timing fails THEN repeat the run; IF a handoff failure appears twice in the same geometry THEN add one diagnostic pair; IF observed warning margin within ±10 s of zero THEN add one boundary cell; IF minimum valid sample exists and more runs are unlikely to change interpretation THEN stop that cell; ALWAYS preserve at least eight confirmation opportunities; NEVER use an exploratory diagnostic run as confirmatory evidence.

### 3.10 Quick-look measures (post-run, within minutes)

Compute from run data immediately after each run (04 §2.2, 12 §4.5): detection range; response latency; track duration; track continuity; classification result; intercept result; data completeness; difference from prediction; difference from threshold; difference from comparison baseline. JIATF quick-look additions (12 §4.5): threat-profile compliance; required files present; configuration match; clock and source health; first-detection time and range; first-stable-track time and range; usable C2 track time; boundary crossing time; usable warning time; mission margin; whether the paired run remains comparable. Rule: quick look supports the next-run decision only; it never replaces final analysis. Perishable observations must be collected within ten minutes of run completion (04 §7.3).

### 3.11 Health-state classification (boolean logic, evaluated live; 11 §2.3, 10 §1.18)

Time sources: Green (offset and drift support every assigned measure) / Warning (P1 measures valid, margin reduced) / Stop (≥1 mandatory measure cannot meet its time-uncertainty limit) / Unknown (treat as stop for affected mandatory measures). Data sources: Green / Warning / Stop / Degraded (only named measures available under approved fallback) / Unknown. Controlled parameters per source (10 §1.18): expected update rate, minimum update rate, maximum gap, maximum total loss, maximum critical-phase loss, maximum clock offset, maximum drift, coverage, calibration, storage margin. A campaign-wide average cannot replace a measure-specific limit.

### 3.12 Campaign self-measurement (10 §2.10, 13 §2.6–2.7, 06 §2)

```
Valid-run rate              = valid runs / attempted runs
Reproduction success rate   = independently reproduced P1 results / P1 results reviewed
Data completeness           = usable required data products / required data products
Time from final valid run to decision-ready package = package-acceptance timestamp − last-valid-run timestamp
Time to first valid run     = first-valid-run timestamp − campaign start     [start point undefined in 06; define per campaign]
Personnel days per valid evidence unit = personnel days / valid evidence units
```
Decision-uncertainty reduction needs an approved scale or decision model — never invent a percentage (10 §2.10). Define each denominator before using it for comparison.

### 3.13 Run-level computation procedure (per measure, ordered; 05 Part D)

1 apply the approved definition; 2 use approved start/stop events; 3 apply approved truth and alignment; 4 apply missing/censoring/ambiguity rules; 5 compute the value; 6 compute or state measurement uncertainty; 7 compare with threshold and objective; 8 store intermediate values; 9 link to source records; 10 mark pass / miss / borderline / descriptive / unavailable only when approved logic defines that label. Engine requirements (04 §2.3): check units; check required fields; align time; apply start/stop events; apply missing-data rules; compute run-level measures; aggregate across valid runs; calculate variability; calculate uncertainty; compare with thresholds; compare alternatives; compare predictions with results; preserve intermediate calculations. Dual-computation requirement: compare an independent calculation for each P1 measure (05 Part C, 10 §3.1).

---

## 4. Worked fixtures (vitest input → expected output)

All are labeled illustrative in the sources; exact values are binding for unit tests. Wilson expected values below reproduce under the §2.2 formula within ±0.01 (source figures are rounded).

| # | Calculation | Input | Expected output | Source |
|---|---|---|---|---|
| F-01 | Proportion | x=16, n=20 | p-hat = 0.80 (report "16/20 = 0.80 = 80%") | 09 §7.1, 10 §7.1 |
| F-02 | Wilson 95% | x=16, n=20, z=1.96 | ≈ 0.58 to 0.92 | 09 §7.1, 10 §7.2 |
| F-03 | Beta-binomial posterior | Beta(1,1) + 16/20 | Beta(17, 5) | 09 §7.2, 10 §7.3 |
| F-04 | Sample size, one proportion | h=0.10, p=0.50, z=1.96 | n ≈ 1.96²×0.5×0.5/0.10² = 96.04 → round up ≈ 97 | 09 §7.3, 10 §7.4 |
| F-05 | Attempt inflation | valid=40, fraction=0.80 | 40/0.80 = 50 attempts | 09 §7.4, 10 §7.5 |
| F-06 | Zero-failure bound | 0 failures, 30 valid hr | ≈ 3/30 = 0.10 failures/hr (95% one-sided upper) | 09 §7.5, 10 §7.8 |
| F-07 | Along-track error | speed=30 m/s, offset=0.10 s | 3 m | 10 §7.6, 11 §2.2 |
| F-08 | Mission margin | available=42 s, chain=36 s, reserve=4 s | 42−36−4 = 2 s (small positive; no broad claim) | 10 §7.7 |
| F-09 | Paired sample size | z_alpha=1.96, z_power=0.84, sd=30 s, min_effect=25 s | [(1.96+0.84)×30/25]² = [2.80×1.20]² = 3.36² = 11.29 → 12 pairs | 12 §2.3 |
| F-10 | Required chain time | stages 8+4+8+55+5 s | 80 s | 12 §2.2 |
| F-11 | Warning threshold | chain 80 s + reserve 10 s | 90 s | 12 §2.2 |
| F-12 | Warning time (distance/speed) | 3,600 m, 30 m/s | 120 s | 12 §2.2 |
| F-13 | Mission margin | 120 − 80 − 10 | 30 s | 12 §2.2 |
| F-14 | Matrix cells | 3 azimuths × 2 altitudes × 2 speeds | 12 cells | 12 §2.5 |
| F-15 | Stage totals | 12×2 + 8×2 + 8 | 24 + 16 + 8 = 48 valid opportunities | 12 §2.5 |
| F-16 | Attempt inflation + controls | 48/0.80; +4 controls | 60 attempts; 64 max planned | 12 §2.4 |
| F-17 | u_latency (RSS) | 0.02, 0.02, 0.01, 0.03 s | sqrt(0.0018) = 0.042 s | 12 §2.6 |
| F-18 | Along-track uncertainty | 30 m/s × 0.042 s | 1.26 m | 12 §2.6 |
| F-19 | Valid-run rate | 48 valid / 58 attempted | 0.828 = 82.8% | 12 §2.7, §7.2 |
| F-20 | Wilson 95% | 18/20 | 0.90 (≈ 0.70 to 0.97) | 12 §2.7, §7.2 |
| F-21 | Wilson 95% | 25/28 | 0.893 (≈ 0.73 to 0.96) | 12 §2.7, §7.2 |
| F-22 | Proportion | 3/20 | 0.15 | 12 §2.7, §7.2 |
| F-23 | Bootstrap median paired improvement | paired warning times (seed data) | point 46 s; 95% interval 35 to 57 s | 12 §2.7, §7.2 |
| F-24 | Mission margins A/B | A: 76−80−10; B: 123−80−10 | A = −14 s; B = +33 s | 12 §2.7, §7.2 |
| F-25 | Range→time conversion | 1,410 m / 30 m/s | 47 s (agrees with warning gain) | 12 §2.7, §7.2 |
| F-26 | Sensitivity: faster threat | 3,690 m / 35 m/s; −80 −10 | 105.4 s; margin 15.4 s | 12 §2.8 |
| F-27 | Sensitivity: longer engagement | chain 80+20=100; +10 reserve; B 123, A 76 | requirement 110 s; B margin 13 s; A margin −34 s | 12 §2.8 |
| F-28 | First-stable-track gain | A 2.28 km, B 3.69 km | +1.41 km → 1,410/30 = 47 s at 30 m/s | 12 §7.2 |
| F-29 | Continuity difference vs limit | A 0.96, B 0.94, limit −0.03 | −0.02 → inside limit (pass) | 12 §7.2 |
| F-30 | RMSE vs limit | A 28 m, B 34 m, limit 50 m | both inside (pass) | 12 §7.2 |
| F-31 | Added 90th-pct latency vs limit | A 1.9 s, B 2.5 s, limit +1.0 s | +0.6 s → inside limit (pass) | 12 §7.2 |
| F-32 | False-track rate vs limit | A 0.4/hr, B 1.2/hr, limit 1.5/hr | inside limit; flag workload trade-off | 12 §7.2 |
| F-33 | Handoff proportions | A 19/20; B matched 18/20; B confirmatory 7/8; combined 25/28 | 0.95; 0.90; 0.875; 0.893 | 12 §7.2 |
| F-34 | Factorial cells | 2 levels × 2 levels | 4 cells | 10 §7.9 |
| F-35 | Threshold rule evaluation (H-05 form) | margin > 0 in x of n confirmation runs vs 80% rule | pass/fail per §2.1 + threshold compare | 12 §1.7 |
| F-36 | DOE replicate precedent | software-intensive system, 95% confidence | 4 replicates sufficient (context fixture, not computed) | 13 §2.4, §7 |

Prediction seeds for the prediction-versus-result view (not calculations): Config A median UWT 70–90 s, Config B 110–140 s, paired increase 35–55 s (12 §1.7); card-level prediction A 60–80 s, B 95–125 s (12 §4.2).

---

## 5. Already-computed map (planning predictions in the current app)

The app already computes several catalog quantities as **planning predictions** from scenario geometry. The T&E build reuses them as the "predicted" side of prediction-versus-result; the catalog formulas above compute the "measured" side from run evidence. Mark these PREDICTED-EXISTS.

### `/Users/caseytalbot/Projects/rangeboard/src/playback/sim.ts`

- **`assessThreat()` → `firstDetectS`** — PREDICTED-EXISTS for CUAS-SEN-FD-002 (first-detection time). Sampled at DT = 0.5 s over the flight path against effective sensor ranges.
- **`firstConfirmS`** (first moment two different sensor technologies hold the track) — PREDICTED-EXISTS as a proxy for the stable-track / decision-ready gate (CUAS-TRK-FST-003 / M-01 start event). [Definitional gap: the catalog's decision-ready rule is customer-approved (track age, persistence ≥ 3 updates, quality); the sim's two-technology confirm is a different rule. Keep both; label the sim value "predicted confirm", never "decision-ready".]
- **`warningS = arrivalS − firstDetectS`** — PREDICTED-EXISTS for CUAS-MSN-UWT-010 / M-01. [Definitional gap: sim uses first detection and closest approach to the nearest defended asset; the catalog uses decision-ready-track time and truth crossing of the protected-boundary radius. The build should add a boundary-crossing variant and a decision-ready gate to align.]
- **`windowS` / `windowEffectorId` / `engageTimeS` check → status `engageable` vs `window-too-short`** — PREDICTED-EXISTS for the timing decision rule (§3.2): engagement window length vs required engage time is the geometric analogue of available time vs required chain time. Reuse as the predicted mission-margin input; the catalog adds the named chain-stage sum and uncertainty reserve.
- **`killChainConnected()`** — PREDICTED-EXISTS for the kill-chain prerequisite in intercept/defeat denominators (sensor → C2 → effector connectivity).
- **`arrivalS`, `closestApproachM`** — PREDICTED-EXISTS for truth-time-at-boundary inputs (time-to-boundary math, §3.2).
- **`swarmMerged`, formation handling** — supports raid/saturation planning (CUAS-SAT-LEAK-016 companion data), prediction only.

### `/Users/caseytalbot/Projects/rangeboard/src/analysis/sensorEnv.ts`

- **`effectiveDetectRangeM()` / `effectiveClassifyRangeM()`** — PREDICTED-EXISTS for predicted detection/classification range under environment derates (rain/fog/urban-EM multipliers, acoustic wind loss, instrumented-range cap) and per-technology target scaling against each sensor's reference target: radar RCS fourth-root law, EO/IR linear span scaling (Johnson criteria) with a thermal-contrast class, per-band night handling and a meteorological-visibility cap (Koschmieder), acoustic spherical spreading plus atmospheric absorption against a reference source level, and RF band coverage with a published urban range override; a `rangeBasis: 'planning'` figure is never target-scaled. These generate the per-cell predicted values of CUAS-SEN-FD-002 and feed matrix design (which cells are feasible) and the prediction records the catalog compares against results.
- **`rfDetectable()` / `jammable()`** — PREDICTED-EXISTS eligibility logic: RF-silent threats produce no RF detection opportunities; non-jammable threats produce no EW opportunities. Reuse to pre-filter measure opportunity counts in planning (denominator forecasting).

### `/Users/caseytalbot/Projects/rangeboard/src/analysis/mcda.ts`

- **`mcdaScore()` = round(100 × Σ(w_j × part_j) / Σw_j)** with parts warning/coverage/confirm/engage and `WARNING_FULL_S = 300` cap — PREDICTED-EXISTS as the weighted-additive scoring pattern. The adaptive next-run scorer (§3.9 form 2, `Event value = sum(weight_j × score_j)`) can reuse this normalization/weighting implementation directly. [Note: the 300 s full-score cap is an app constant, not a manual value; the JIATF mission-arithmetic threshold is 90 s — do not conflate.]

Not yet computed anywhere in the app (build new, pure functions): all binomial/Wilson/exact/Beta statistics, sample-size and inflation planners, paired sample size, bootstrap, Kaplan-Meier/censoring, RSS uncertainty budgets, evidence-accounting ledger math, run-count/matrix arithmetic, quick-look deltas, adaptive priority scores, reliability/availability, resource and campaign self-measurement metrics.

---

## Conflict register

1. **[CONFLICT] Usable warning time sign (13 §2.1 vs 09/10/12).** Field Guide states `usable-track time − boundary time`; all other sources state `boundary time − decision-ready time`. Canonical: boundary − decision-ready (positive = warning exists). Treat the FG form as transposed.
2. **[CONFLICT] Threshold source enum wording (10 §1.5 / 02 §2.2 vs 13 §2.3).** Six sources each, but items 5–6 differ ("customer decision rule / analyst judgment clearly labeled" vs "customer-approved risk criterion / explicitly documented characterization objective"). Canonical enum: 10 §1.5; store FG wording as synonyms.
3. **[CONFLICT] Adaptive priority formula (13 §2.2 multiplicative ratio vs 10 §2.9 weighted sum vs 02 §2.4 / 05 Part I no formula).** Ship both computable forms, advisory only, with override note.
4. **Resolved ambiguity: valid-run rate denominator.** 06 §2 marks it ambiguous; 10 §2.3 and JIATF fixture 48/58 both use attempted runs. Canonical denominator: attempted runs.
5. **Non-conflict noted:** app constant `WARNING_FULL_S = 300` (mcda scoring cap) vs JIATF 90 s warning threshold — different purposes; keep separate.
6. **Gap noted:** no H-04 exists in the JIATF seed (Q-04 is exploratory, prediction only) — not an error (12 §1.7).
