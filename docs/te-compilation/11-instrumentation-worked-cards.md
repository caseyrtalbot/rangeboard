# Instrumentation & Ground Truth + Worked C-UAS Test Cards (Agent 11)

## Sources fetched

- "12 — Instrumentation & Ground Truth" — https://app.notion.com/p/3c16f36564f781788d23fb731ed2f14d
- "13 — Worked C-UAS Test Cards" — https://app.notion.com/p/3c16f36564f781149d93ee0d42dea514

Both pages contain only `<mention-page>` cross-references to other manual sections (measure dictionary, quantitative design, test-card execution, instrumentation cross-links) that the page map assigns to other agents. No in-scope sub-pages exist; recursion complete.

## 1. Input variables & fields

### 1.1 Ground-truth plan record (one per required truth variable)

Fields, verbatim from source:

| Field | Notes |
|---|---|
| Truth variable | Name of the state needing independent truth |
| Measures supported | List of measure IDs |
| Primary source | |
| Backup source | |
| Independence from system under test | Justification text |
| Device/source ID | |
| Coordinate frame and units | |
| Time source | |
| Update rate | |
| Accuracy and uncertainty | |
| Coverage | |
| Calibration or validation | |
| Failure indicator | |
| Conflict rule | |
| Missingness rule | |
| Fallback | |
| Measures lost if unavailable | List of measure IDs |

### 1.2 Ground-truth categories (each is a record type with required fields)

**Position and trajectory truth** — required for: detection range, stable-track range, track error, warning time, engagement geometry, intercept assessment, boundary crossing, raid membership and leaker determination. Record fields:
- Source and device ID
- Coordinate frame, datum, origin, axes, and units
- Update rate and latency
- Accuracy and precision
- Coverage
- Dropout behavior
- Calibration and validation method
- Processing mode: enum {real-time, post-processed, fused}

**Identity and threat-state truth** — required for: correct object association, classification accuracy, threat-profile fidelity, guidance/navigation state, emissions or communications state, payload/state changes, EW effect and recovery, raid membership. Record for each state its provenance: enum {measured, commanded, inferred, manually adjudicated}.

**Configuration truth** — required for every comparison. Record fields:
- Hardware/article IDs
- Software and firmware versions
- Model and mission-data versions
- Settings and modes
- Network and interface state
- Operator procedure and training state
- Threat software/profile
- Instrumentation configuration
- Calibration state

Rule: a planned configuration is not configuration truth. Capture the actual state before and after the run and monitor material changes during execution.

**Event truth** — required for: detection and track events, message send/receive, decision and assignment, launch, intercept, effect, and assessment, operator actions, start, pause, abort, restart, and completion. Every event-truth entry must identify:
```
event type
object or track
source
event time
event state/value
confidence or quality
source or derivation record
```

**Effect and outcome truth** — required for: EW effect, intercept, defeat, mission success, defended-asset outcome, recovery. Rule: define the physical or functional criterion before execution. "Unknown outcome" and uncertainty are valid adjudication states and must be preserved.

**Environment and operator truth** — record when relevant:
- Weather and illumination
- Terrain/clutter state
- RF and network state
- Background traffic
- Operator identity, role, procedure, workload, and interventions
- Maintenance, power, battery/fuel, thermal, and support state

### 1.3 Time-source record

- Authoritative epoch and time scale
- Distribution method
- Devices disciplined directly and indirectly
- Holdover behavior
- Expected offset, jitter, and drift
- Loss-of-source indication
- Check method

Rule: preserve original source timestamps. Corrected time is a derived field with a transformation version.

### 1.4 Spatial registration declarations (required for every positional source)

- Datum
- Coordinate frame
- Origin
- Axis order and handedness
- Units
- Altitude reference
- Orientation convention
- Sensor reference point
- Platform lever arm
- Boresight or alignment
- Transformation sequence
- Transformation version

### 1.5 Association gate definition (truth-to-source matching rule)

- Maximum time difference
- Maximum position or angular difference
- Identity/class constraints
- Kinematic consistency
- Persistence
- Cardinality behavior: enum {one-to-one, one-to-many, many-to-one}
- Ambiguity state

Rule: do not force a match when two truth objects satisfy the gate. Mark the association ambiguous and apply the measure's ambiguity rule.

### 1.6 Calibration record (form)

```
Instrument/device ID:
Measured quantity:
Calibration standard or known reference:
Procedure:
Date/time:
Operator:
As-found result:
Adjustment:
As-left result:
Uncertainty:
Valid range and conditions:
Expiration or next check:
Measures supported:
```

### 1.7 Identifier model (minimum required identifiers)

```
Campaign ID
Card ID and version
Run ID
Configuration ID
Threat-profile ID
Condition ID
Truth-object ID
Source-system ID
Source-track ID
Correlated master-track ID
Event ID
Operator/role ID
Instrument ID
File/data-product ID
Transformation/analysis version
```

### 1.8 Event record (form)

```
Event ID:
Run ID:
Event type:
Event time:
Original source time:
Corrected/common time:
Time uncertainty:
Truth-object ID:
Source-track/master-track ID:
Source:
Measured, inferred, commanded, or manually annotated:
State/value:
Units:
Quality/confidence:
Person or process creating record:
Transformation version:
Notes:
```

### 1.9 Data-health specification (one per critical source)

```
Source:
Measures supported:
Mandatory or diagnostic:
Expected update rate:
Minimum acceptable update rate:
Maximum allowed gap:
Maximum packet/record loss:
Maximum timestamp offset:
Maximum drift:
Coverage requirement:
Calibration requirement:
Identifier requirement:
Storage/buffer margin:
Backup:
Warning threshold:
Stop threshold:
Recovery criterion:
```

### 1.10 Gap/packet-loss specification fields (per source; a single global loss percentage is insufficient)

- Maximum total loss
- Maximum consecutive gap
- Maximum loss during critical mission phases
- Whether interpolation is permitted
- Maximum interpolation duration
- Effect on each measure

### 1.11 Data-lineage fields (for every derived product)

- Input file IDs and integrity identifiers
- Source-system version
- Schema and adapter version
- Ingestion time
- Coordinate and time transformations
- Correlation method
- Calibration and registration versions
- Inclusion, exclusion, correction, and interpolation rules
- Code, package, and parameter versions
- Output ID
- Operator and reviewer
- Review status

Rule: raw data remains immutable. Corrections create new derived versions.

### 1.12 Fallback design record (for every mandatory source)

- Failure indication
- Local buffer
- Backup instrument or source
- Manual export
- Recovery time
- Data lost during transition
- Measures preserved
- Measures lost
- Validity limit
- Test procedure for the fallback

Rule: a written but untested fallback is not ready.

### 1.13 Track-reconciliation rules (define one rule per case)

- Duplicate source tracks
- Split tracks
- Merged tracks
- Reused vendor track IDs
- Track handover
- Track drop and reacquisition
- One truth object represented by several source tracks
- Several truth objects represented by one source track
- Manual correlation and override

Rule: never discard the source track identity when creating a master track.

## 2. Calculations & formulas

### 2.1 Latency time-uncertainty budget

```
u_latency = sqrt(
  u_start_timestamp²
  + u_stop_timestamp²
  + u_synchronization²
  + u_event_definition²
)
```

Variables:
- `u_latency` — combined uncertainty of a measured latency (time units).
- `u_start_timestamp` — uncertainty of the start-event timestamp.
- `u_stop_timestamp` — uncertainty of the stop-event timestamp.
- `u_synchronization` — uncertainty from clock synchronization between the recording devices.
- `u_event_definition` — uncertainty from ambiguity in when the event is defined to occur.

Computed during instrumentation planning, before execution, per latency measure. Acceptance rule: the approved tolerance must be small enough to distinguish the minimum decision-relevant latency difference. Do not use one universal timing tolerance; derive each tolerance from its measure.

### 2.2 Along-track spatial error from time offset

```
approximate along-track error from timing = object speed × time offset
```

Inputs: object speed (distance/time), time offset between clocks (time). Output: position error along track (distance). Used to check whether a clock tolerance invalidates a position-comparison measure. Stated caution: a clock tolerance acceptable for slow ground activity may invalidate a high-speed intercept measure.

### 2.3 Health-state logic (per-source classification, evaluated live)

Time-health states per time source:
- **Green:** offset and drift support every assigned measure.
- **Warning:** assigned P1 measures remain valid, but margin is reduced or recheck is required.
- **Stop:** at least one mandatory measure cannot meet its time-uncertainty limit.
- **Unknown:** health cannot be determined; treat as stop for affected mandatory measures.

Data-health states per data source:
- **Green:** all mandatory limits pass.
- **Warning:** a limit approaches failure; evidence remains valid under the written rule.
- **Stop:** a mandatory limit fails and the affected measure cannot be recovered.
- **Degraded:** only named measures remain available under an approved fallback.
- **Unknown:** health cannot be established; mandatory affected measures are unavailable.

The data monitor records every state transition with event time and source.

Loss-clustering rule: a 1% packet loss clustered around the handoff event can be more damaging than a larger loss outside the active interval; therefore loss limits are phase-specific (see 1.10).

### 2.4 Measure-level validity model (four-level assessment)

1. **Source validity:** did the individual source meet calibration, timing, coverage, and integrity requirements?
2. **Event validity:** can the event be identified and associated within tolerance?
3. **Measure validity:** do all sources and transformations required by the measure pass?
4. **Run use:** which measures and comparisons may use the run?

A conditionally valid run can support one measure and be invalid for another. Validity is not only a run-level label.

## 3. Checklists

### 3.1 Clock-control procedure (data monitor / instrumentation lead)

1. Synchronize before integration rehearsal.
2. Record source, method, offset, and device.
3. Check at day start.
4. Check before the first P1 run.
5. Monitor during the run when supported.
6. Recheck after power, network, firmware, recorder, or source changes.
7. Recheck after suspected drift.
8. Check at day end.
9. Fit or apply a drift correction only through an approved versioned transformation.
10. Retain pre- and post-correction timestamps and uncertainty.

### 3.2 Spatial registration procedure

1. Survey or establish instrument locations and reference points.
2. Verify coordinate declarations.
3. Apply lever-arm and boresight corrections.
4. Use a known reference object or trajectory.
5. Estimate residual spatial bias by region and geometry.
6. Record uncertainty and coverage.
7. Repeat after movement, impact, maintenance, remounting, or suspected shift.
8. Preserve raw coordinates and derived registered coordinates.

### 3.3 Calibration schedule (per instrument)

- Pre-campaign calibration.
- Installation/registration check.
- Day-start functional check.
- Pre-run check where required.
- Continuous health/reference signal where available.
- Post-run check after a suspected event.
- Day-end drift check.
- Post-campaign calibration.

### 3.4 Out-of-tolerance handling (if a post-test calibration check fails)

1. Preserve the as-found state.
2. Identify the last known valid check.
3. Bound the affected interval.
4. Identify measures and runs that used the instrument.
5. Estimate the possible effect.
6. Re-adjudicate affected measures.
7. Repeat testing when required.

Rule: do not retroactively declare the instrument valid because the result appears plausible.

### 3.5 Truth-conflict procedure (when truth sources disagree)

1. Preserve both observations.
2. Verify time, frame, calibration, and identity first.
3. Apply the approved precedence or reconciliation rule.
4. Record the conflict and resolution.
5. Propagate remaining uncertainty.
6. Mark the measure unavailable if the disagreement cannot be bounded adequately.

### 3.6 Missing-truth procedure

- Do not substitute the system under test without approved justification.
- Determine which measures remain possible.
- Mark affected observations missing, censored, ambiguous, or invalid under their definitions.
- Preserve diagnostic data.
- Trigger the written fallback or repeat rule.

### 3.7 End-to-end rehearsal (before live P1 execution)

1. Generate a representative truth object and source event.
2. Exercise every required source.
3. Verify identifiers.
4. Verify common time and registration.
5. Trigger warning and stop health states.
6. Exercise buffering and fallback.
7. Ingest the data.
8. Correlate truth and source objects.
9. Compute every P1 measure.
10. Trace each result back to raw data and configuration.
11. Reproduce the result independently.
12. Record the rehearsal acceptance result and deficiencies.

### 3.8 Instrumentation readiness gate (all must pass)

- Independent truth covers every P1 measure.
- Common time and registration meet measure-specific tolerances.
- Calibration is current and traceable.
- Event and object identities reconcile across systems.
- Green, warning, stop, and degraded limits are implemented and tested.
- Raw data and transformations are versioned and reproducible.
- Missing and conflicting truth have written rules.
- Fallback paths have passed rehearsal.
- The team can state exactly which conclusions disappear when any critical source fails.

### 3.9 Independence rules (go/no-go review items for truth sourcing)

- Do not use the radar under test as truth for its own detection probability.
- Do not use the receiving C2's track as the only truth for handoff correctness.
- Do not use the EW system's "effect achieved" flag as the only proof of mission effect.
- Do not use the interceptor's internal closest-approach estimate as the only intercept truth unless independently validated.
- Do not use the planned threat route as proof of the actual route.
- A source can support both system operation and truth only when its independence and intended use are explicitly justified.

### 3.10 Worked-card completion gate (card ready for issue only when all pass)

- Every bracketed placeholder resolves to a controlled record.
- Measures use the current dictionary versions.
- Planned repetitions and stopping rules trace to the quantitative design.
- Truth, time, registration, and data-health limits trace to the instrumentation plan.
- Event and denominator definitions are frozen.
- The complete procedure has passed cold-reader review and dry run.
- The team can name which measures remain available after each permitted degraded condition.
- Allowed and prohibited conclusions are explicit.

### 3.11 Shared card rules (apply to every test card)

- One issued card controls one run type.
- One run receives one immutable run ID.
- Actual differences become deviations; never edit the card to match the run.
- Planned sample sizes come from the approved quantitative design.
- Each card references controlled configuration, threat, condition, measure, and instrumentation records.
- Exact safety, regulatory, security, range, stop, and restart controls come from the active campaign plan.
- A dry run is not scored unless the issued card and design explicitly define it as a scored event.
- Invalid evidence is preserved and excluded only under the approved measure rule.

## 4. Templates, forms & cards

The five worked cards below are the manual's illustrative gold-standard card designs. Every value in brackets `[...]` is a placeholder that must be replaced by an approved campaign record before issue. Source states explicitly: these are illustrative designs, not reconstructions of a Valkryn campaign and not Valkryn performance results. Reproduced field by field.

---

### Card 1 — Detection and track characterization

**1. Control**
- Card ID: `TC-CUAS-SEN-CHAR-001`
- Title: Detection and stable-track characterization by geometry
- Version/status: `[version] / draft, approved, or issued`

**2. Traceability**
- Decision: `[decision ID]`
- Question: Under the defined threat and conditions, where does the sensor detect and establish a stable track?
- Hypothesis: Detection and stable-track performance vary with `[range, altitude, azimuth/aspect, speed, or selected factors]`.
- Measures: `CUAS-SEN-PD-001`, `CUAS-SEN-FD-002`, `CUAS-TRK-FST-003`, `CUAS-TRK-CONT-004`, `CUAS-TRK-ERR-005`, `CUAS-SUR-FTR-007`
- Matrix cell: `[cell ID]`

**3. Purpose**
Characterize the sensor's valid detection and track boundary under one controlled configuration and approved factor cell.

**4. Planned repetition**
- Valid opportunities required: `[from quantitative design]`
- Current repetition/block: `[number and block]`
- Order: `[randomized or restricted schedule]`
- Blocking: `[day, operator, threat article, weather, or none]`
- Invalid-run allowance: `[planning value only]`

**5. System state**
- Sensor/configuration: `[configuration ID]`
- Placement/boresight: `[registration record]`
- Network/C2 state: `[included or isolated]`
- Operator procedure: `[procedure ID]`
- Training state: `[record]`

**6. Threat state**
- Threat profile: `[threat-profile ID]`
- Truth-object ID assigned before run.
- Geometry: `[route, altitude, speed, approach azimuth/aspect]`
- Red-controlled variables: `[exact list]`
- Held variables: `[exact list]`
- Fidelity limitations: `[threat record]`

**7. Condition**
- Condition ID: `[weather, clutter, illumination, RF/network state]`
- Eligibility volume/range band: `[controlled definition]`
- Limits: `[from condition record]`

**8. Variables**
- Independent variables: `[selected geometry or configuration factors]`
- Held controls: sensor settings, placement, threat profile elements, operator procedure, and other design controls.
- Covariates: actual speed/altitude/aspect, weather, RF state, temperature, battery/power state, and time of day as applicable.

**9. Data and truth**
- Independent trajectory/identity truth: `[source ID]`
- Sensor plots/tracks/status: `[source fields]`
- Registration record: `[ID]`
- Common time/tolerance: `[time record and measure-specific limit]`
- Ground-truth coverage: complete eligibility interval.
- Health stop: loss of mandatory truth, unknown configuration, time/registration outside tolerance, or source gap exceeding the measure rule.

**10. Preconditions**
- Correct card/run/configuration/threat/condition IDs active.
- Sensor available and approved settings loaded.
- Truth and sensor recording active.
- Clocks and registration pass.
- Route and operating volume ready.
- Data-health alerts and fallback tested.
- Active campaign constraints and stop conditions confirmed.

**11. Procedure**
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

**12. Expected nominal result**
The system may transition through no report, detection, tentative track, stable track, loss, and reacquisition states. No performance value is assumed.

**13. Validity and repeat**
Valid for a measure only if:
- Truth establishes the full opportunity.
- Configuration and profile remain within bounds.
- Association, time, and registration meet tolerance.
- Required source health passes.
- No uncontrolled change affects the measure.

Repeat when a written validity rule fails. Preserve valid failures as results.

**14. Required outputs**
- Opportunity-level detection outcome.
- First-detection and first-stable-track observation or censoring record.
- Track continuity and error.
- False/nuisance-track accounting.
- Data-health and uncertainty record.
- Run status and allowed/prohibited uses.

**15. Allowed conclusion**
Performance under the tested configuration, threat, geometry, and conditions.

**16. Prohibited conclusion**
Universal detection range, all-aspect coverage, or operational effectiveness outside the tested factor space.

---

### Card 2 — Fusion and C2 handoff

**1. Control**
- Card ID: `TC-CUAS-C2-HANDOFF-001`
- Title: Source-track fusion and C2 handoff performance
- Version/status: `[version/status]`

**2. Traceability**
- Question: When the source sensor produces a qualifying track, does the receiving C2 create the correct usable track within the mission timeline?
- Hypothesis: `[configuration B or interface state]` changes handoff success or latency relative to `[baseline]`.
- Measures: `CUAS-C2-HS-008`, `CUAS-C2-LAT-009`, `CUAS-MSN-UWT-010`
- Matrix cell: `[source × C2 × network × threat/condition]`

**3. Purpose**
Measure source-to-C2 success, identity correctness, latency, and usable warning time while isolating interface behavior.

**4. Planned repetition**
- Qualifying offers required per cell: `[design]`
- Configuration order: `[randomized/blocked]`
- Network blocks: `[nominal/degraded as approved]`
- Pairing: `[whether the same controlled input supports paired comparisons]`

**5. Controlled state**
- Source configuration: `[ID]`
- C2 configuration: `[ID]`
- Adapter/schema/version: `[ID]`
- Network state: `[condition ID]`
- Correlation/fusion settings: `[ID]`
- Operator procedure and information state: `[ID]`

**6. Threat/input state**
Use either:
- A live truth threat producing a qualifying source track; or
- A verified recorded/synthetic input approved for the interface question.

Rule: do not use synthetic input to claim live sensor performance.

**7. Events**
- Start: source track first meets the approved qualifying-offer criterion.
- Send: source/adapter records the outbound object/message.
- Receive: C2 records receipt.
- Usable stop: receiving C2 track meets the decision-ready criterion.
- Failure window: `[approved maximum observation interval]`.

**8. Data and truth**
- Source-track fields and event logs.
- Adapter/network transmission logs.
- Receiving-system object/event logs.
- Truth/master-object correlation.
- Common time meeting latency tolerance.
- Identifier map preserving source, master, and receiver IDs.

**9. Procedure**
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

**10. Stop and validity**
Stop/hold for:
- Clock offset beyond latency tolerance.
- Ambiguous object identity.
- Unapproved schema/configuration change.
- Mandatory log loss.
- Stale state from the prior run.
- Network condition outside the card.

Rule: a valid failed handoff remains in the denominator.

**11. Required outputs**
- Successful handoffs / valid qualifying opportunities.
- Source-to-receive and source-to-usable latency with censoring.
- Correct, duplicate, split, merged, stale, or misassociated outcomes.
- Usable warning time.
- Failure-stage classification.
- Allowed/prohibited comparisons.

**12. Allowed conclusion**
Interface/fusion performance for the tested source, C2, adapter, network, object state, and operational criterion.

**13. Prohibited conclusion**
End-to-end mission effectiveness when sensing, decision, engagement, or effect was not represented.

---

### Card 3 — EW soft-kill characterization

**1. Control**
- Card ID: `TC-CUAS-EW-SOFTKILL-001`
- Title: Mission-relevant EW effect and recovery
- Version/status: `[version/status]`

**2. Traceability**
- Question: Under the approved threat, geometry, and represented EW condition, does the threat enter the defined mission-relevant effect state, and for how long?
- Hypothesis: The treatment changes the probability or time of the defined effect relative to the approved baseline/control.
- Measures: `CUAS-EW-EFF-011`, `CUAS-EW-REC-012`, `CUAS-MSN-E2E-015` when a complete mission vignette is represented.
- Matrix cell: `[threat guidance × geometry × treatment × environment]`

**3. Purpose**
Characterize a bounded functional or mission effect without equating temporary disruption with physical defeat.

**4. Planned repetition and order**
- Valid opportunities per treatment/control cell: `[design]`
- Treatment order: `[randomized or blocked]`
- Washout/reset: `[approved state and duration]`
- Threat article/software blocks: `[design]`
- Sequential rule: `[if used]`

**5. Threat state**
- Threat profile/configuration: `[ID]`
- Guidance/navigation/communications state: `[ID]`
- Mission task: `[defined route or objective]`
- Independent truth telemetry/state sources: `[IDs]`
- Reset state verified before each opportunity.

**6. Treatment state**
Reference the approved campaign representation:
- Treatment condition ID.
- Commanded/applied state.
- Monitored exposure fields.
- Geometry and timing.
- Control or sham condition.
- Permitted factor variation.
- Applicable operating limits.

**7. Effect definition**
Freeze one or more states:
- Navigation deviation beyond `[criterion]`.
- Loss of control or guidance for `[criterion]`.
- Mission-route abandonment.
- Failure to reach a required waypoint/terminal condition.
- Forced recovery or safe-state entry.
- Temporary suppression.
- Recovery to nominal mission state.

Rule: do not change the effect definition after viewing results.

**8. Data and truth**
- Independent threat trajectory and state.
- Treatment exposure/event record.
- Threat onboard telemetry when allowed.
- Environmental/RF record.
- Operator actions.
- Common time meeting effect-latency tolerance.
- Effect-state adjudication record.

**9. Procedure**
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

**10. Stop and validity**
Stop under existing campaign controls for any safety, regulatory, system, data, or security trigger.
Measure invalid when:
- Qualifying exposure cannot be established.
- Threat state or mission task differs materially.
- Independent effect truth is unavailable.
- Time alignment exceeds tolerance.
- Reset/carryover cannot be excluded.

**11. Required outputs**
- Effect successes / valid opportunities.
- Time to effect and recovery with censored cases.
- Effect mode and duration.
- Mission outcome.
- Treatment/exposure uncertainty.
- Carryover and repeatability assessment.
- Conditions where generalization is prohibited.

**12. Allowed conclusion**
Bounded functional or mission effect under the represented treatment, threat state, geometry, and conditions.

**13. Prohibited conclusion**
Universal susceptibility, legal operational employment, physical destruction, or effectiveness against an unrepresented foreign system.

---

### Card 4 — Interceptor defeat

**1. Control**
- Card ID: `TC-CUAS-DEF-INTERCEPT-001`
- Title: Interceptor assignment, intercept, and confirmed defeat
- Version/status: `[version/status]`

**2. Traceability**
- Question: Does the tested kill-chain configuration create and execute a valid engagement that defeats the defined threat before the mission boundary?
- Hypothesis: The tested architecture achieves a higher probability of confirmed defeat or greater engagement margin than `[baseline/comparison]`.
- Measures: `CUAS-C2-LAT-009`, `CUAS-MSN-UWT-010`, `CUAS-DEF-PINT-013`, `CUAS-DEF-PDEF-014`, `CUAS-MSN-E2E-015`
- Matrix cell: `[sensor/C2/effector × threat × geometry × condition]`

**3. Purpose**
Separate failures in detection, decision, assignment, launch, guidance, intercept, effect, and mission outcome.

**4. Planned repetition**
- Valid engagement opportunities: `[design]`
- Threat/effector article blocks: `[design]`
- Configuration order: `[design]`
- Rare severe failures: `[handling rule]`
- Reset/maintenance criteria: `[record]`

**5. System and threat state**
- Blue architecture/configuration: `[ID]`
- Interceptor/effector article and state: `[ID]`
- Threat profile/article: `[ID]`
- Engagement and defended-asset boundaries: `[geometry record]`
- Operator procedure: `[ID]`
- Inventory and readiness state: `[record]`

**6. Event chain**
```
qualifying track
→ decision-ready track
→ assignment
→ authorization if represented
→ launch/release
→ guidance
→ intercept
→ effect
→ defeat assessment
→ boundary or mission outcome
```
Rule: freeze the exact event criterion for each stage.

**7. Data and truth**
- Threat and interceptor trajectories.
- Sensor/C2 track and decision logs.
- Assignment and launch/release events.
- Effector health/guidance state.
- Independent intercept/effect evidence.
- Boundary crossing and threat mission outcome.
- Common time and spatial registration inside approved uncertainty.

**8. Procedure**
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

**9. Validity and failure classification**
A valid failure remains evidence. Classify the first mission-relevant failure stage (enum):
- Detection
- Track
- Classification/identification
- C2 handoff
- Decision/assignment
- Authorization/procedure
- Launch/release
- Guidance
- Intercept
- Effect
- Assessment
- Test infrastructure
- Unknown

Unknown effect outcomes follow the approved primary and sensitivity rules.

**10. Required outputs**
- Engagement timeline and margin.
- Valid opportunity, intercept, and defeat counts.
- Probability intervals.
- Stage-specific failure classification.
- Miss/intercept geometry with uncertainty.
- Defeat confidence/adjudication.
- Mission outcome.
- Configuration, condition, and validity limits.

**11. Allowed conclusion**
End-to-end performance for the tested architecture, threat, operators, procedure, and conditions.

**12. Prohibited conclusion**
Operational suitability, broader threat coverage, or effectiveness outside the tested articles and vignettes without supporting evidence.

---

### Card 5 — Saturation and multi-threat load

**1. Control**
- Card ID: `TC-CUAS-SAT-RAID-001`
- Title: Multi-threat tracking, assignment, engagement, and leaker characterization
- Version/status: `[version/status]`

**2. Traceability**
- Question: Under the defined raid size, arrival process, geometry, and threat mix, where does the architecture lose mission capacity?
- Hypothesis: Mission success, track continuity, or engagement completion changes as concurrent load increases.
- Measures: `CUAS-TRK-CONT-004`, `CUAS-C2-HS-008`, `CUAS-C2-LAT-009`, `CUAS-SAT-LEAK-016`, `CUAS-HMI-INT-018`, `CUAS-MSN-E2E-015`
- Matrix cell: `[raid size × spacing × geometry × threat mix × configuration]`

**3. Purpose**
Identify system, interface, operator, or resource bottlenecks under controlled multi-threat load.

**4. Design**
- Raid sizes/levels: `[approved levels]`
- Arrival spacing or process: `[definition]`
- Threat mix: `[profiles and proportions]`
- Geometry: `[routes/axes/altitudes]`
- Configuration: `[ID]`
- Replications per raid cell: `[quantitative design]`
- Blocking: `[day, operator, article, configuration]`
- Escalation/sequential rule: `[preapproved rule]`

Rule: do not escalate load merely because the prior run looked favorable unless the approved sequence permits it.

**5. Experimental units**
- Primary mission unit: one complete valid raid.
- Nested object unit: one truth threat within the raid.
- Preserve raid identity in all object-level analysis.
- Do not treat threats from one raid as independent raids.

**6. Controlled state**
- Blue configuration and resource inventory: `[ID]`
- Operator/crew procedure and staffing: `[ID]`
- Threat profiles and coordination behavior: `[IDs]`
- Network/environment state: `[condition ID]`
- Reset state, queues, tracks, and inventory cleared before run.

**7. Data and truth**
- Identity-preserving truth for every threat.
- Raid membership and planned/actual arrival times.
- Blue source tracks and master-track associations.
- C2 queue, correlation, assignment, and engagement records.
- Operator actions and workload/interventions.
- Effector inventory, assignment, launch, and outcome.
- Boundary crossing and mission outcome.
- System health, processor/network load, and resource state where available.

**8. Procedure**
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

**9. Stop and validity**
Stop or hold for:
- Loss of identity-preserving truth.
- Threat spacing or raid membership outside tolerance.
- Unapproved load or behavior.
- Unknown blue resource/configuration state.
- Common-time or correlation failure.
- Safety, regulatory, system, or data-health trigger.

Rule: a raid may be conditionally valid for early-stage sensing measures but invalid for defeat if an effector or outcome source fails. Record measure-specific use.

**10. Required outputs**
- Threat-object and raid counts.
- Detection/track/handoff/engagement outcome by object.
- Leaker fraction and raid-failure probability.
- Concurrent-track, assignment, and engagement load.
- Queueing and latency by mission stage.
- Operator intervention rate.
- Resource exhaustion and recovery.
- First observed capacity boundary.
- Uncertainty, clustering, and validity limits.

**11. Allowed conclusion**
Architecture performance and observed bottlenecks for the tested raid definition, threat mix, geometry, configuration, operator procedure, and conditions.

**12. Prohibited conclusion**
Universal swarm capacity, performance against autonomous coordination not represented, or a maximum capacity beyond the tested load.

---

### 4.1 Card section schema (union of the five worked cards; the app's card template)

Common sections in order: Control (Card ID, Title, Version/status) → Traceability (Decision, Question, Hypothesis, Measures, Matrix cell) → Purpose → Planned repetition / Design → System/Controlled state → Threat/Input state → Condition / Treatment / Events / Effect definition (card-type specific) → Variables / Experimental units (card-type specific) → Data and truth → Preconditions (Card 1 only, explicit) → Procedure (numbered steps) → Expected nominal result (Card 1) → Stop and validity / Validity and repeat / Validity and failure classification → Required outputs → Allowed conclusion → Prohibited conclusion.

Version/status enum: {draft, approved, issued}.

## 5. Outputs & deliverables

- **Per-run required outputs** — card-specific lists (Section 4, "Required outputs"): opportunity outcomes, censoring records, latency distributions, failure-stage classifications, probability intervals, leaker fractions, data-health records, and allowed/prohibited-use statements. Produced at run adjudication.
- **Event log** — stream of event records (form 1.8) time-tagged by the run logger during execution.
- **Calibration records** (form 1.6) — produced at each schedule point in 3.3.
- **Ground-truth plan** (form 1.1) — produced during instrumentation planning, one entry per truth variable.
- **Data-health state transition log** — every green/warning/stop/degraded/unknown transition with event time and source, produced live by the data monitor.
- **Rehearsal acceptance result and deficiencies record** — produced at end-to-end rehearsal (3.7 step 12).
- **Derived data products with full lineage** (fields 1.11) — produced during analysis; raw data immutable, corrections as new versions.
- **Conflict-resolution records** — produced whenever truth sources disagree (3.5 step 4).
- **Measure-level validity determinations** — four-level assessment (2.4) per run, stating which measures and comparisons may use the run.

## 6. Workflow & sequencing logic

### 6.1 Evidence chain (canonical pipeline; order is mandatory)

```
Physical event
→ truth and source observations
→ common identifiers and time
→ calibrated and registered data
→ versioned transformations
→ measure
→ uncertainty
→ validity decision
→ finding
```

Readiness definition: a recorder is not ready merely because it produces data. It is ready when the team can show what the data represents, when it occurred, how accurately it was measured, how it maps to the correct object and configuration, and which measures may use it.

### 6.2 Gates and ordering rules

- Instrumentation gate (3.8) must pass before live P1 execution; end-to-end rehearsal (3.7) is a prerequisite of the gate.
- Worked-card completion gate (3.10) must pass before a card is issued.
- Clock sync before integration rehearsal; day-start check; check before first P1 run; recheck after any power/network/firmware/recorder/source change; day-end check (3.1).
- Registration repeats after movement, impact, maintenance, remounting, or suspected shift (3.2 step 7).
- Calibration cadence brackets the campaign: pre-campaign → installation → day-start → pre-run → continuous → post-run-on-event → day-end → post-campaign (3.3).
- Effect definitions, event criteria, and denominators are frozen before execution and never changed after viewing results (Cards 3, 4; gate 3.10).
- Configuration truth captured before and after each run; monitored during.
- Between-run resets: Card 2 steps 8-9 (no stale track or queued message carries into the next run); Card 5 step 12 (reset every queue, track, inventory, and system state before another raid).
- Escalation rule (Card 5): load may not escalate on a favorable prior run unless the preapproved sequence permits it.
- Deviations: actual differences become deviations; never edit the card to match the run.
- Mission-thread event chains are stage-ordered: Card 2 (qualify → send → receive → usable) and Card 4 (qualifying track → decision-ready track → assignment → authorization → launch/release → guidance → intercept → effect → defeat assessment → boundary/mission outcome).

### 6.3 Health-state driven flow

Green → proceed. Warning → evidence valid under written rule; recheck may be required. Stop → mandatory measure unrecoverable; hold. Degraded → continue for named measures only under approved fallback. Unknown → treat as stop for affected mandatory measures. Every transition is logged with time and source.

## 7. Worked examples & real data

The five worked cards (Section 4) are the manual's worked examples. Exact real identifiers they carry:

- Card IDs: `TC-CUAS-SEN-CHAR-001`, `TC-CUAS-C2-HANDOFF-001`, `TC-CUAS-EW-SOFTKILL-001`, `TC-CUAS-DEF-INTERCEPT-001`, `TC-CUAS-SAT-RAID-001`.
- Measure IDs referenced (seed the measure catalog): `CUAS-SEN-PD-001`, `CUAS-SEN-FD-002`, `CUAS-TRK-FST-003`, `CUAS-TRK-CONT-004`, `CUAS-TRK-ERR-005`, `CUAS-SUR-FTR-007`, `CUAS-C2-HS-008`, `CUAS-C2-LAT-009`, `CUAS-MSN-UWT-010`, `CUAS-EW-EFF-011`, `CUAS-EW-REC-012`, `CUAS-DEF-PINT-013`, `CUAS-DEF-PDEF-014`, `CUAS-MSN-E2E-015`, `CUAS-SAT-LEAK-016`, `CUAS-HMI-INT-018`. (`006` and `017` do not appear in these two pages; full dictionary belongs to agent 9's scope.)
- Numeric example: the "1% loss clustered around the handoff event" illustration for phase-specific loss limits (2.3).

No other real numbers exist in these pages. Every quantitative slot in the worked cards is deliberately a bracketed placeholder to be resolved from approved campaign records — the cards are templates, not campaign reconstructions. Source disclaimer quoted: "These cards are illustrative designs, not reconstructions of a Valkryn campaign and not Valkryn performance results."

## 8. Product implications

1. Ship the five worked cards as seed card templates. Card sections are structured form sections in the schema of 4.1; bracketed placeholders become typed record-reference fields (link to Configuration, Threat-profile, Condition, Measure, Registration, Time, Design records) that must resolve before status can advance to "issued" (enforce gate 3.10 as a validation checklist).
2. Card status lifecycle: draft → approved → issued, with immutable issued versions; a run gets one immutable Run ID; run-time differences are captured as deviation records, never card edits.
3. Implement the identifier model (1.7) as first-class entities: Campaign, Card+version, Run, Configuration, Threat-profile, Condition, Truth-object, Source-system, Source-track, Master-track, Event, Operator/role, Instrument, File/data-product, Transformation version. Every event record links these.
4. Build a Ground-Truth Plan editor: one row per truth variable with the 17 fields of 1.1, cross-linked to measures; auto-report "measures lost if unavailable" and independence-rule warnings (3.9).
5. Build per-source Data-Health specifications (1.9) with live green/warning/stop/degraded/unknown state tracking and a transition log; drive run validity from the four-level model (2.4) so a run can be valid for some measures and invalid for others (measure-specific use flags).
6. Provide a time-tolerance calculator: compute `u_latency` from the four uncertainty components and along-track error = speed × time offset; compare against each measure's decision-relevant tolerance and flag stop states.
7. Provide checklist runners for: clock control (3.1), registration (3.2), calibration schedule (3.3), out-of-tolerance handling (3.4), truth conflict (3.5), missing truth (3.6), end-to-end rehearsal (3.7), instrumentation gate (3.8), card preconditions (Card 1 sec. 10), and between-run resets (Cards 2 and 5).
8. Event logger UI: time-tag entry/phase/operator-call/warning/exit events during a run using the event record form (1.8), preserving original source time vs corrected common time with uncertainty.
9. Calibration record forms (1.6) with schedule reminders and out-of-tolerance workflow that back-flags affected runs and measures.
10. Data lineage: keep raw inputs immutable; every derived product records the lineage fields (1.11); corrections create new versions.
11. Card 5 requires nested experimental units: raid (primary) and threat-within-raid (nested); analysis views must preserve raid identity and never treat nested threats as independent.
12. Every card and run report must render "Allowed conclusion" and "Prohibited conclusion" text blocks; exports carry them verbatim.
