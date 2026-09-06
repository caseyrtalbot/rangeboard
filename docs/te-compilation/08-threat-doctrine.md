# OPFOR & Threat Representation + C-UAS Doctrine-to-Test Application

Agent 8 extraction. Assigned pages: 08 and 09 of the Valkryn Deployment Strategist Manual, plus referenced reference pages not assigned to other agents.

## Sources fetched

Assigned pages:

- "08 — OPFOR & Threat Representation for C-UAS T&E" - https://app.notion.com/p/3c16f36564f7814c8d38d75a1530770f
- "09 — C-UAS Doctrine-to-Test Application" - https://app.notion.com/p/3c16f36564f781ff83b3d1fedf410a94

Referenced pages fetched (in scope, not assigned to other agents):

- "Doctrine" - https://app.notion.com/p/3bf6f36564f780338765dd687cca2600 (operational-concepts basis for page 09)
- "Unmanned Warfare in the Russo-Ukraine War — OSINT Research Compendium" - https://app.notion.com/p/3be6f36564f781d797d3dc816d742890 (the "observed or emergent practice" source for pages 08/09)

Referenced pages fetched for ownership check; extracted only for the threat-parameter content pages 08/09 explicitly invoke [AMBIGUOUS: both sit under "Questions to Master" corpus, page map assigns that to agent 13]:

- "03 · DESIGN I — Measures, Threat, and Experimental Design" - https://app.notion.com/p/3be6f36564f781bca64acbc1459db94c
- "08 · Frontier — AI, Autonomy, and Counter-UAS T&E" - https://app.notion.com/p/3be6f36564f781e998f0d9ab03ee2e68

Fetched for ownership check only, NOT extracted (assigned to agent 12):

- "JIATF-401" - https://app.notion.com/p/3c06f36564f780c99604de623790660c (the "Jordan case" cited by pages 08/09)

Links inside assigned pages skipped as other agents' scope: evidence-planning method page (agent 2), execution-controls page (agent 4), records page (agent 1).

## 1. Input variables & fields

### 1.1 Test-decision record (page 08, sec 1)

Begin with the uncertainty the test must resolve, not with an available red aircraft. Record:

- Decision-relevant question.
- System boundary.
- Mission thread being evaluated.
- Threat behavior that could change the answer.
- Threat features to vary.
- Threat features to hold.
- Conditions in which the conclusion must apply.
- Required evidence strength.
- Conclusion the representation may support.
- Conclusion the representation may not support.

### 1.2 Threat profile record (page 08, sec 2)

One version-controlled profile per operationally distinct threat presentation. A change that can alter blue-system performance creates a new profile or a recorded profile variant.

Threat mission / intended effect (enum, one or more):

- Reconnaissance or target development
- Persistent observation
- Route or site reconnaissance
- One-way attack
- FPV attack
- Munition delivery
- Decoy or defensive-system stimulation
- Electronic attack or relay
- Saturation or magazine depletion
- Combined reconnaissance and attack
- Post-strike assessment
- Other stated mission behavior

Rule: do not infer payload effect from airframe type alone.

Physical and kinematic profile fields:

- Airframe class and relevant UAS group
- Dimensions and weight when relevant
- Payload state
- Speed bands
- Altitude bands
- Climb, descent, acceleration, and turn behavior
- Endurance required for the test
- Route and approach axis
- Launch point or entry point
- Standoff, release, or terminal geometry
- Terrain masking and line-of-sight behavior
- Hover, loiter, orbit, dive, pop-up, or crossing behavior
- Recovery, impact, timeout, or lost-link behavior
- Formation spacing and timing for multi-aircraft events

Rule: use ranges when natural variation is part of the threat; use exact values when repeatability is necessary to isolate a blue-system factor.

Control, navigation, and autonomy profile fields (record separately):

- Manual control
- Waypoint or preplanned navigation
- GNSS dependence
- Inertial or alternate navigation
- EO or other terminal guidance
- Automated target recognition or tracking
- Lost-link behavior
- Behavior after navigation degradation
- Behavior after control-link degradation
- Human intervention points
- Degree of autonomy actually exercised during the run

Rule: do not label an aircraft "autonomous" from a product description; record the behavior executed in the test.

Emissions and observable-signature fields:

- Command-link behavior
- Video-link behavior
- Frequency or band
- Channel, waveform, duty cycle, and power when available and relevant
- Frequency agility
- Emission timing
- RF-silent portions of flight
- Navigation emissions or dependencies
- Radar cross-section representation
- EO/IR appearance
- Acoustic signature
- Visual signature
- Transponder, identification, or cooperative-track state
- Any signature augmentation used for range safety or truth collection

Rule: a safety beacon, tracker, transponder, or telemetry radio can change the representation. Record it as an augmentation and assess whether it can affect blue detection or identification.

Coordination and raid behavior fields (multi-aircraft):

- Number of aircraft
- Same-type or mixed-type composition
- Simultaneous or sequential entry
- Approach axes
- Spacing in time and distance
- Altitude deconfliction
- Decoy-to-attack ratio
- Reconnaissance-to-attack relationship
- Cooperative or independent behavior
- Re-tasking logic
- Response to blue emissions or effects
- Repeated-wave timing
- End condition for the raid

Rule: "Swarm" is not a sufficient profile. State the coordination behavior actually represented.

Threat adaptation fields: define the observable trigger and the allowed response. Example trigger/response pairs:

- Change altitude after detection of a stated blue emission
- Change route after a stated engagement cue
- Shift control method after a stated degradation condition
- Increase spacing after a stated loss
- Use an alternate approach axis after a stated defensive action

Rule: never allow an undefined instruction to "act realistically." Undefined adaptation prevents repeatability and obscures which blue-system factor caused the outcome.

Threat-operator state fields (red operator is part of the representation when human action affects the aircraft):

- Experience with the specific aircraft
- Experience with the script or mission
- Familiarity with the range
- Information available before and during the run
- Ability to observe blue-system behavior
- Permitted coaching
- Permitted retries or corrections
- Workload and number of aircraft controlled
- Fatigue and run-order effects
- Communication delay
- Manual intervention count

Rule: operator identity is not a substitute for a proficiency description. If red-operator variation can change the result: hold it, block on it, randomize it, or record it as a covariate.

### 1.3 Representation class (enum, page 08 sec 3)

- Actual threat: relevant threat article and behavior represented directly.
- Validated surrogate: substitute supported for the intended test use by a documented feature-to-feature comparison.
- Generic representation: article creates a defined stimulus, not claimed to represent a specific threat.
- Model, simulation, or constructive representation: part or all of the threat exists through an accredited or otherwise accepted model for the stated use.
- Hybrid representation: live and modeled threat elements combined.

Rule: the label alone does not establish adequacy; complete the fidelity assessment.

### 1.4 Surrogate-fidelity matrix record (page 08, sec 4)

Fidelity state enum with required treatment:

| Fidelity state | Meaning | Required treatment |
| --- | --- | --- |
| Faithful | Feature represented within the tolerance required by the measure | Record the verification method and observed tolerance |
| Approximated | Feature represented imperfectly but useful for a bounded purpose | State the difference, expected direction of effect, and allowed conclusion |
| Omitted | Feature absent | State which measures and conclusions cannot use the run |
| Unknown | Available evidence cannot establish the relationship | Treat generalization as unresolved; do not assume equivalence |

Minimum feature list to assess (one row each):

- Mission behavior
- Airframe size and shape
- Payload state
- Speed and altitude
- Maneuver and terminal behavior
- Route and geometry
- Radar signature
- RF emissions
- EO/IR appearance
- Acoustic signature
- Control method
- Navigation method
- Autonomy
- Lost-link behavior
- Resistance to countermeasures
- Coordination and raid behavior
- Operator behavior
- Environmental interaction
- Blue-system observables created by instrumentation or safety equipment

Per-feature record fields:

- Intended threat state
- Represented state
- Fidelity classification
- Verification source or measurement
- Tolerance relevant to the measure
- Likely effect of the difference
- Measures affected
- Permitted generalization
- Prohibited generalization
- Follow-on evidence needed

Rule: do not calculate one overall fidelity score that hides a critical omission.

### 1.5 OPFOR execution mode (enum + per-mode required fields, page 08 sec 5)

Scripted mode (use for controlled comparison or confirmatory evidence). Define:

- Exact initial state
- Route or maneuver sequence
- Timing and speed tolerances
- Trigger points
- Allowed corrections
- Abort behavior
- Reset state
- Information available to red
- Invalidating deviations

Best uses: baseline characterization; direct configuration comparison; sensor performance across geometry or range; latency comparison; confirmatory repetitions; regression testing. Limitation: may not expose weaknesses that depend on adversary adaptation.

Bounded-adaptive mode (use when threat response is a test factor but uncontrolled free play would prevent interpretation). Define:

- Red objective
- Observable triggers
- Menu of permitted responses
- Bounds for altitude, route, emissions, timing, and maneuver
- Information red may use
- Information withheld from red
- Maximum number or sequence of adaptations
- Required logging of the trigger and response
- Measures designated exploratory or confirmatory

Best uses: blue response to route or altitude changes; EW-reactive behavior; alternate approach selection; decision-chain resilience; controlled exploration of defensive boundaries. Limitation: adaptive choices are endogenous and can confound a simple treatment comparison. Preserve the complete choice history; avoid claiming classical independent repetitions unless the analysis supports that claim.

Free-play mode (use to discover failure modes, generate hypotheses, or challenge a complete mission thread). Define:

- Red objective
- Starting resources and state
- Prohibited actions
- Safety and range bounds
- Time limit
- Information available
- Required event and decision log
- Instrumentation minimum
- Conditions that end the event

Best uses: failure discovery; human-machine interaction; defensive coordination; novel adversary behavior; end-to-end operational stress. Limitation: free-play results show an outcome occurred under one observed interaction; they do not by themselves estimate probability of success across the operating envelope.

### 1.6 Red variable classification (enum, page 08 sec 6)

Classify every threat variable before issuing a test card:

| Class | Meaning | Execution treatment |
| --- | --- | --- |
| Independent variable | Changed deliberately to answer the question | Set the planned levels, order, and comparison |
| Held control | Must remain within tolerance | Verify before and during the run |
| Bounded red choice | Red may select within a stated envelope | Record the choice, trigger, time, and rationale |
| Recorded covariate | Not controlled but measured | Preserve for analysis and interpretation |
| Prohibited variable | Cannot change during the run | A change is a deviation and may invalidate the run |
| Unobserved nuisance | Can affect the result but is neither controlled nor measured | Remove it, instrument it, or state the validity risk |

Minimum variables to classify:

- Airframe and payload
- Software and control configuration
- Route and approach axis
- Speed and altitude
- Launch or entry timing
- Emission state
- Navigation and guidance
- Maneuver
- Raid size and spacing
- Counter-countermeasure behavior
- Operator
- Red access to blue information
- Weather and illumination
- Safety or telemetry augmentation

### 1.7 Information and learning controls (page 08, sec 7)

Record:

- What red knows about blue placement, settings, coverage, and procedures
- What blue knows about threat timing, route, type, and behavior
- What both sides learn after each run
- Whether feedback is withheld until a block ends
- Whether routes or profiles are randomized
- Whether the same operators repeat the event
- Whether the test seeks trained response, surprise response, or both
- How blue or red learning affects later comparisons

Rule: if red learns a defensive weakness and exploits it in later runs, later results are not simple repetitions of the original condition. Treat learning as a changed condition or a recorded sequential effect.

### 1.8 Threat-coverage matrix (page 08, sec 8)

Rows = operationally distinct threat profiles. Columns = performance-driving conditions. Each cell is a candidate design point.

Candidate threat rows:

- Single manually controlled quadcopter
- Single waypoint-controlled aircraft
- RF-silent or reduced-emission segment
- FPV attack profile
- Reconnaissance orbit
- One-way attack profile
- Decoy followed by attack
- Mixed reconnaissance and attack
- Repeated waves
- Multi-axis raid
- Saturation or capacity stress
- Adaptive response to blue action

Candidate condition columns:

- Fixed site or moving force
- Open terrain, complex terrain, or urban clutter
- Day, night, and transition light
- Clear, adverse, and changing weather
- Permissive, congested, contested, and degraded spectrum
- Full, limited, delayed, or disconnected C2
- Friendly UAS and civil-air background
- Nominal and degraded sensor states
- Nominal and depleted effector states
- Normal and elevated operator workload

Cell-selection criteria (do not attempt every combination; select cells that):

- Resolve a P1 uncertainty
- Represent the expected operating center
- Probe a likely failure boundary
- Distinguish competing explanations
- Test a degraded state that could change the decision
- Confirm a previously observed weakness

### 1.9 Red truth / threat instrumentation record (page 08, sec 9)

Capture as applicable:

- Unique aircraft and mission identifier
- Launch, entry, phase-transition, effect, and recovery times
- Position, altitude, velocity, and heading
- Route and maneuver
- Control and navigation state
- Emission state
- Operator commands or interventions
- Lost-link and failsafe events
- Payload or effect state
- Red-observed blue action
- Safety or instrumentation augmentation
- Ground-truth accuracy, update rate, time source, and gaps

Define:

- Which source establishes red position
- Which source establishes red emissions
- Which source establishes red behavior or operator action
- Required update rate and accuracy for each blue-system measure
- Identifier mapping between red truth, blue tracks, engagement records, and run logs
- What happens if red truth is late, incomplete, or outside tolerance

Rule: no independent threat truth means no defensible claim about detection range, track error, latency, intercept geometry, or defeat timing.

### 1.10 Red deviation record (page 08, sec 11)

A red deviation is any material difference between the issued profile and observed execution. Record:

- Planned state
- Actual state
- Time and duration
- Direct evidence
- Cause if known
- Threat feature affected
- Blue measures affected
- Comparisons affected
- Whether the deviation created an easier or harder presentation
- Whether the run remains valid for another purpose
- Repeat or diagnostic need
- Generalization limit

Example deviation types (seed enum):

- Altitude outside tolerance
- Route or approach-axis change
- Late launch
- Unplanned maneuver
- Emission state incorrect
- Navigation mode changed
- Red operator intervened when intervention was prohibited
- Aircraft entered lost-link behavior
- Safety tracker failed or altered the observable state
- Raid spacing differed from the card
- One member of a mixed raid did not participate
- Red reacted outside the permitted menu

Rule: do not discard an invalid run. It may retain diagnostic value; label its allowed use.

### 1.11 Realism-constraint record (page 08, sec 12)

For every realism constraint, identify:

- Threat feature affected
- Reason it cannot be fully reproduced
- Substitute used
- Direction in which the substitute may bias the result
- Measure affected
- Conclusion narrowed
- Evidence needed to close the gap

### 1.12 Evidence-boundary label (enum; both pages)

Page 08 (three kinds, keep separate):

1. Doctrine or approved operational basis
2. Observed or emergent practice (may inform test factors but is not doctrine)
3. Test-specific assumption (label the assumption and limit the conclusion)

Page 09 (six labels for every input to a mission-thread design):

- Doctrine: formal operational concept, task, process, or principle
- Observed practice: reported behavior from current operations or exercises
- Test assumption: necessary scenario choice not established by doctrine or observation
- Site constraint: range, safety, spectrum, airspace, instrumentation, or resource limitation
- Measured result: evidence produced in the campaign
- Inference: interpretation beyond direct observation; must state basis and limit

### 1.13 Mission-thread package fields (page 09, sec 2)

Mission and protected outcome:

- Force or activity being protected
- Mission that must continue
- Asset, function, formation, route, or population at risk
- Time period of protection
- Acceptable degradation, if defined
- Consequence of threat success
- Mission condition that ends the scenario

Friendly posture:

- Fixed, moving, displacing, halted, or transitioning
- Sensor placement and coverage
- C2 and network path
- Effector placement and coverage
- Passive-defense state
- Friendly UAS and manned-air activity
- Supporting systems
- Known degraded components
- Operator staffing and workload
- Relevant procedures and exercised command relationships

Rule: record command relationships as test conditions; do not infer broader organizational authority from the scenario.

Adversary action:

- Threat mission
- Airframe and payload class
- Control, navigation, emissions, and autonomy
- Approach geometry
- Raid composition
- Reconnaissance, decoy, attack, and assessment behavior
- Adaptation allowed
- Expected interaction with passive and active defenses

Test boundary (enum; state which the event evaluates):

- One component
- One interface
- One transition
- A partial chain
- The complete active-defense chain
- Passive defense
- Combined passive and active defense
- Mission continuity after engagement
- Recovery and re-engagement

Rule: do not call a partial chain "end to end."

### 1.14 Operator and command-relationship test factors (page 09, sec 7)

- Centralized or distributed monitoring
- Local or remote decision point
- Number of handoffs
- Voice, digital, or mixed dissemination
- Shared or separate common operating pictures
- Information visible at each position
- Alert priority
- Decision aids
- Staffing
- Operator-to-track ratio
- Simultaneous duties
- Shift turnover
- Training and procedure state
- Time pressure
- Communications delay or loss
- Need to coordinate friendly UAS or manned aircraft
- Manual versus automated effector assignment
- Local action during disconnected operation

Rule: the finding must state the exercised arrangement, operator state, procedure, and information available. Do not generalize to a different arrangement without evidence.

### 1.15 Contested-spectrum condition definition (page 09, sec 16)

Record:

- Baseline spectrum state
- Applied emissions or interference
- Time and location
- Band, power, waveform, and duty cycle when available and relevant
- Systems intended to be affected
- Systems that must remain unaffected
- Threat control and navigation dependencies
- Friendly-system dependencies
- Monitoring source
- Stop limits
- Actual measured environment

Rule: a nominal label such as "EW on" is not a reproducible test condition. Measure the environment and state what was actually applied.

### 1.16 C2 degradation states (enum, page 09 sec 15)

- Increased latency
- Packet loss
- Intermittent link
- Loss of central picture
- Loss of one sensor feed
- Loss of one effector connection
- Local-only operation
- Stale track data
- Conflicting tracks
- Clock misalignment
- Manual voice fallback
- Complete partition followed by restoration

Degradation test factors: time and phase at which degradation begins; duration; nodes affected; information retained locally; fallback procedure; local decision state; operator awareness of degradation; recovery sequence; track and message reconciliation after restoration.

### 1.17 Doctrine reference fields (Doctrine page; doctrine terms for the library)

- sUAS = small UAS; OWUAS = one-way UAS.
- Passive defense: actions to decrease likelihood of detection. Active defense: able to detect, ID, decide, act within AO.
- 6 AMD principles (brigade-level C-UAS): 1. Mass (concentration of fire power); 2. Mix (layered defense, kinetic and non-kinetic fires); 3. Mobility (rapid shifting and ops tempo, setup times); 4. Integration (combined integrated air defense efforts, C2, handoff); 5. Flexibility (apply new and legacy gear, rapid TTP iteration); 6. Agility (swift reaction to changing aerial threats, acute or systemic).
- 7 tenets: 1. Mutual support (WEZ redundancy and coverage); 2. Weighted coverage (with respect to concentration of likely attack); 3. Overlapping fires (fires redundancy); 4. Early engagement (prior to threat weapon engagement or solution); 5. Balanced fires (equal volume of fires); 6. Defense in depth (proportional fires in relation to protected-asset distance); 7. Resilience (maintain continued ops regardless of enemy tactics or blue losses).
- FAAD C2 = Forward Air Defense Command and Control. IFN = inter-FAAD network. JDN = joint data network (external C2 feeds into a COP, displayed via FAAD C2). ADAM = Air Defense Airspace Management (brigade C2 ops). ATAK = Android Team Awareness Kit. MPU5 Smart Radio / Wave Relay: voice, data, high-resolution video; described as the most robust comms infrastructure for C-UAS.
- The FAAD C2 construct is designed around a <=4 minute detect-to-engage.
- Governing performance chain: Detect -> identify -> decide -> disseminate -> defeat.
- Identification methods: (1) Procedural identification: targeting based on geolocation, altitude, heading, time, and flight patterns (example: UAS detected by passive sensor, cross-referenced with the COP for the unit's AO and threat posture); (2) Positive identification: direct observation and analysis of target characteristics, vizobs, electronic support systems, non-cooperative target recognition and IFF, or a mixture.
- Track tag: bearing, altitude, range, speed (acronym BARS).
- Decide phase, two critical considerations: 1. Determine necessity to engage; 2. Select appropriate response to neutralize. Defeat-system selection depends on the quantity and classification of the sUAS (Groups 1 to 3) and the nature of the defense location (static fixed site vs mobile maneuvering brigade).
- Fixed site: originate from center of bullseye out ~30 km / 20K ft AGL. Base Defense Zone holds the BDOC, which holds Target Engagement Authority on all entering aircraft. Engagement hierarchy based on size (e.g., Group 2+ prior to VID) depending on other parameters; typical preference is the weapon with the most standoff range (including DCA / CAP).
- "Left of launch": pre-mission intelligence on operators, craft, or control stations; brigade and battalion plans should include it and consider unique RF signatures of comms and C2 links.
- Planning rule: OS detection happens at approximately 50% of the maximum range of a system, for planning purposes. Radar max-range figures do not equal detect ranges for Group 1-3 sUAS; size, RCS, and radar location determine fidelity of the picture.
- Fire-control radar tactic: a single fire-control radar should only activate outside enemy strike range or when cued by passive radar or another intelligence source, to protect survivability of the lethal defeat systems.
- Sensor layering: acoustic sensors most forward, then passive, then active; together they maintain the target solution to facilitate fires within the layered defense.
- Named systems (doctrine context): Raytheon Sentinel radar + Lockheed Martin Q53 multi-mission radar together give 360-degree detection (AMD, UAS, rotary and fixed-wing) calibrated for low/slow IFF procedures, relayed through JDN and IFN into FAAD C2. Raytheon Ku-band radar integrates into FAAD C2 and serves as fire-control radar for land-based Phalanx, SeaWiz, and Coyote interceptor (counter-RAM).
- Fixed-site limitation: centralized server as primary data hub renders maneuver impractical; cloud mentioned as mitigation for a more dynamic posture.

### 1.18 Threat-and-conditions matrix parameters [overlap: DESIGN I page, agent 13 corpus; quoted because page 08 names it the governing T&E basis]

- Threat as independent variable; the VOLT (Validated Online Lifecycle Threat, DIA-validated under DIAI 5000.002) defines the threat to represent; it forecasts adversary capability at IOC and IOC+10 years.
- For C-UAS tests, include UAS Groups 1 through 3.
- Guidance mode enum: remote control, waypoint, electro-optical terminal, RF-silent, fiber guidance.
- Raid size: from one aircraft to a swarm.
- Flight profile: e.g., loiter or one-way attack.
- Include the electromagnetic environment.
- Matrix rows (threat presentations traced to VOLT), threat features: UAS group and airframe class; guidance and radio-frequency profile; speed and altitude; raid size; resistance to countermeasures.
- Matrix columns (environmental and employment conditions): electromagnetic environment including contested spectrum (JCO tested C-UAS under electronic attack in 2024); clutter; day and night; rules-of-engagement constraints.
- Each cell is one design point. Document and accredit surrogate fidelity per cell; record each remaining fidelity gap as a test limitation.
- Response layers: Sensing (probability of detection, track continuity, classification accuracy at range); Command and control (latency, operator workload); Defeat (probability of defeat per effector-threat pair); Suitability (reliability, false-track rate during endurance runs).
- Use the JIATF-401 and JCO Yuma demonstration series as the government reference scenario set.

## 2. Calculations & formulas

No closed-form formulas appear in the assigned pages. The pages define measure names and decision rules; exact math is deferred to the measure registry (agent 9 scope, "10 C-UAS Measure Dictionary"). Reproduced faithfully:

### 2.1 Measure-registry requirement (page 09, sec 3)

For every measure define: exact start and stop events, denominator, experimental unit, aggregation, truth source, uncertainty, and invalidating conditions.

### 2.2 Transition measures by chain stage (page 09, sec 3 table)

| Transition | Test question | Candidate measures | Required truth |
| --- | --- | --- | --- |
| Detect | Did the defensive system first distinguish the threat from the background early enough to support later action? | Probability of detection by range or condition; first-detection range; warning time; false alerts; missed opportunities | Threat presence, location, time, signature state, sensor state, background activity |
| Track | Did the system create and maintain a usable estimate of threat state? | First-stable-track range; initiation time; continuity; position and velocity error; track purity; drops; swaps; update rate | Time-correlated threat trajectory and identity |
| Identify | Did the process assign the required status or class with sufficient accuracy and timeliness? | Classification accuracy; identification accuracy; time to classification; unknown rate; false-hostile and false-friendly decisions | True threat class, friendly or neutral state, observable features, decision time |
| Decide | Did the human-machine process select and communicate an appropriate response before the available timeline expired? | Decision latency; correct response selection; handoff success; assignment success; operator interventions; workload; expired opportunities | Track state, information presented, operator actions, messages, selected response, available timeline |
| Defeat | Did the selected effect prevent the threat from achieving its mission? | Probability of intercept; probability of defeat; time to effect; engagement attempts; shots or effects per defeat; raid leakage | Effector state, engagement geometry, threat state, observed effect, protected-asset outcome |
| Assess | Did the defensive system correctly determine the result and choose re-engagement, recovery, or continued monitoring? | Assessment time; correct effect assessment; false-success rate; unnecessary re-engagement; missed surviving threat; recovery time | Post-effect threat condition, system assessment, operator decision, subsequent action |

### 2.3 Cross-chain measures (page 09, sec 3)

- End-to-end warning margin
- End-to-end mission success
- Sensor-to-C2 latency
- C2-to-effector latency
- Total detect-to-effect time
- Handoff count and handoff loss
- Simultaneous-target capacity
- Raid leakage
- Re-engagement time
- Availability during the mission window
- Recovery after component loss
- Operator workload and intervention
- Mission continuity
- Cost or resource expenditure per defended effect
- Magazine or duty-cycle exhaustion
- False-action rate against friendly, neutral, or background activity

### 2.4 Passive-defense measures (page 09, sec 4)

- Probability of correct adversary acquisition
- Time to first acquisition
- Correct-versus-decoy selection
- Time the protected asset remained exposed
- Time to displace and resume the mission
- Mission output during degradation
- Signature change
- Alert dissemination time
- Recovery time
- Resource and workload burden

Rule: a test that does not instrument threat perception cannot claim that concealment or deception caused the observed effect.

### 2.5 EW / non-kinetic measures (page 09, sec 6)

- Time to disruption
- Probability of mission interruption
- Probability of route deviation, landing, timeout, or loss of control
- Duration of effect
- Recovery time
- Reacquisition or re-engagement need
- Friendly-system degradation
- Spectrum or collateral effect
- Effectiveness by threat dependency

Rule: loss of a command link is not automatically defeat. The threat may continue a waypoint route, enter terminal guidance, follow a lost-link behavior, or recover.

### 2.6 Kinetic measures (page 09, sec 6)

- Probability of intercept
- Probability of mission defeat
- Time to intercept
- Shots or attempts per defeat
- Engagement-zone utilization
- Re-engagement time
- Magazine expenditure
- Duty-cycle or thermal limit
- False engagement
- Residual hazard

### 2.7 Operator / C2 measures (page 09, sec 7)

- Time from detection to first alert
- Time to each receiving echelon or position
- Message completeness and correctness
- Track association across systems
- Handoff success
- Time to identify
- Time to select a response
- Correct response selection
- Expired engagement opportunities
- Operator intervention
- Workload
- Recovery after communication loss
- Divergence between local and shared pictures

### 2.8 Fidelity decision rule (page 08, sec 4)

A surrogate is adequate only when:

1. The features that drive the evaluated measure are identified.
2. Those features are faithful or their approximation is analytically bounded.
3. Omitted and unknown features are explicitly excluded from the conclusion.
4. Instrumentation and safety augmentation do not silently create the observed performance.
5. The actual run confirms that the intended profile occurred.

Corollary: a representative flight path does not establish representative RF behavior; representative RF behavior does not establish representative terminal behavior. Evaluate each claim against the features that drive it.

### 2.9 Numeric planning rules and thresholds (Doctrine page)

- Detect-to-engage design threshold: <=4 minutes (FAAD C2 construct).
- Planning detection range: approximately 50% of a system's maximum range.
- Fixed-site engagement volume: ~30 km radius / 20,000 ft AGL from bullseye center.

## 3. Checklists

### 3.1 Threat-representation gate (page 08; go/no-go, run before execution)

Proceed only when:

- The operational behavior is stated.
- Performance-driving threat features are identified.
- The representation class is correct.
- Fidelity is assessed feature by feature.
- Omitted and unknown features limit the conclusion.
- Red choices and fixed variables are explicit.
- Red behavior is observable.
- Truth supports the planned measures.
- Safety and instrumentation effects are bounded.
- Deviations have predetermined validity consequences.
- The card can be executed without informal interpretation.

### 3.2 Doctrine-to-test gate (page 09; go/no-go)

Proceed only when:

- The mission and protected outcome are explicit.
- Doctrine and observed practice remain distinguishable.
- The threat behavior is executable.
- Passive and active defense are bounded.
- Every evaluated transition has an observable start and stop.
- Component, interface, partial-chain, and end-to-end claims are separated.
- Operator and C2 arrangements are recorded as test factors.
- EW and physical effects have appropriate truth.
- Conditions represent the intended conclusion.
- Each card identifies what can invalidate the run.
- Findings will state the exact configuration, threat, conditions, procedure, and limits.

### 3.3 Evidence "do not treat" checklist (page 09; interpretation guard)

Do not treat:

- A reported field adaptation as universal doctrine.
- A doctrinal sequence as proof that a fielded system performs it.
- A vendor architecture as the required operational architecture.
- A single successful intercept as end-to-end mission effectiveness.
- A component measure as proof of the complete defensive chain.
- A fixed-site result as evidence for maneuver.
- A scripted presentation as evidence against an adaptive threat.
- An exercised command relationship as an asserted authority outside the test.

### 3.4 Doctrinal testable failure modes (Doctrine page; failure-mode checklist for system-of-systems C-UAS)

- Detection or cue arrives too late for an engagement.
- Identification is delayed or incorrect amid manned aircraft, RQ-28s, loitering munitions, and COTS FPV drones.
- Warning does not reach a defender outside FAAD C2.
- Data does not move reliably among adjacent, subordinate, and higher echelons.
- Engagement criteria or local procedures do not convert warning into action.
- A handoff between defensive layers fails.
- The chain remains too slow even when active and passive sensors can cue continuously and a base-defense operations center controls the intercept options.

## 4. Templates, forms & cards

### 4.1 Threat-specific test-card content (page 08, sec 10; every card must state)

- Threat profile identifier and version
- Representation class
- Fidelity limitations that affect the run
- Exact red initial state
- Red operator and information state
- Red-controlled variables
- Fixed variables
- Bounded-adaptive choices
- Prohibited actions
- Route, geometry, speed, altitude, and timing tolerance
- Emission, control, navigation, and autonomy state
- Raid composition and coordination
- Truth and telemetry sources
- Safety and realism bounds
- Red launch, start, phase, stop, abort, and recovery calls
- Invalidating red deviations
- Data required from red
- Reset required before repeat
- Permitted and prohibited conclusions

Rule: the issued card remains frozen during the run. Record what occurred; do not edit the planned profile to match the event.

### 4.2 Mission-thread test-card content (page 09, sec 19; each card must identify)

- Mission-thread package and matrix cell
- Transition or end-to-end question
- Threat profile
- Friendly posture
- Passive-defense state
- Active-defense configuration
- C2, network, operator, and exercised command conditions
- Environmental condition
- Independent variable
- Held controls
- Recorded covariates
- Measures and thresholds
- Truth required at every evaluated transition
- Numbered red and blue procedures
- Stop and restart conditions
- Validity rules
- Actual-event markers
- Required outputs
- Permitted and prohibited uses

Integrated-run minimum time-tag chain:

```text
Threat launch or scenario entry
-> first detection
-> first usable track
-> classification or identification
-> alert and dissemination
-> decision
-> effector assignment
-> engagement
-> observed effect
-> assessment
-> re-engagement, recovery, or mission continuation
```

### 4.3 Mission-thread package template (page 09, sec 8; 22 items per vignette)

1. Mission and protected outcome.
2. Doctrinal basis.
3. Observed-practice inputs, if any.
4. Test-specific assumptions.
5. System boundary.
6. Friendly posture and geometry.
7. Threat mission and profile.
8. Passive-defense state.
9. Active-defense chain.
10. C2, network, operator, and exercised command relationships.
11. Environmental and operational conditions.
12. Independent variables, controls, covariates, and nuisance risks.
13. Transition measures.
14. End-to-end measures.
15. Required ground truth.
16. Test matrix.
17. Scripted, bounded-adaptive, and free-play events.
18. Stop, repeat, and adaptation rules.
19. Minimum valid evidence.
20. Permitted and prohibited conclusions.
21. Required test cards.
22. Regression triggers.

### 4.4 Doctrine-to-test traceability matrix template (page 09, sec 18)

| Input | Required translation | Test output |
| --- | --- | --- |
| Mission and protected outcome | Observable success and failure states | Mission-level measure |
| Doctrinal action | Observable transition or behavior | Event definition and measure |
| Threat TTP | Controlled or bounded presentation | Threat profile and red card content |
| Friendly posture | Configuration, geometry, procedure, and operator state | Condition and baseline record |
| Passive defense | Observable effect on threat acquisition or mission continuity | Passive-defense measures |
| Active defense | Detect-to-assess event chain | Transition and end-to-end measures |
| C2 and command relationships | Information path, handoffs, exercised decision points, and degraded states | Latency, correctness, workload, and resilience measures |
| Operational condition | Factor, control, or covariate | Test-matrix level and actual-run record |
| Known limitation | Validity or generalization constraint | Prohibited conclusion |

### 4.5 Vignette library (page 09, secs 9-17; reproduce as seed templates)

#### Fixed-site defense vignette

- Decision focus: whether the configured architecture provides sufficient warning, identification, engagement opportunity, defeat, and assessment to protect a defined fixed asset under the tested threat and background conditions.
- Threat presentations: single reconnaissance aircraft; single attack aircraft; reconnaissance followed by attack; decoy followed by attack; mixed low- and higher-altitude approaches; multi-axis raid; repeated waves; reduced-emission or RF-silent segment; threat adaptation after blue emission or engagement.
- Test factors: sensor placement; active and passive sensing mix; early-warning sensor included or excluded; C2 and network path; friendly-air and background-track density; day, night, weather, and clutter; effector type and assignment sequence; passive-defense state; operator workload; one component degraded or unavailable; magazine, duty-cycle, or recovery state.
- Priority measures: first-detection and first-stable-track range; warning margin; track continuity; identification accuracy and time; sensor-to-C2 latency; decision and assignment latency; probability of intercept and mission defeat; raid leakage; effect-assessment time; false-action rate; simultaneous-target capacity; mission continuity.
- Minimum sequence: 1. Positive and negative controls. 2. Single-threat scripted baseline. 3. Geometry and condition characterization. 4. Partial-chain isolation. 5. Integrated single-threat run. 6. Mixed-threat or repeated-wave stress. 7. Degraded-component run. 8. Bounded-adaptive run. 9. Scripted confirmation. 10. End-to-end mission-thread event.
- Limits: do not generalize fixed placement, stable power, centralized infrastructure, or persistent connectivity to maneuver operations.

#### Maneuver formation vignette

- Decision focus: whether the formation retains usable warning and defensive action while moving, halting, displacing, changing geometry, and operating with variable connectivity.
- Threat presentations: route reconnaissance; flank or rear approach; pop-up from terrain masking; FPV or one-way attack during movement; attack during halt or transition; repeated contact after displacement; threat cued by blue emissions; mixed reconnaissance and attack.
- Test factors: movement speed and formation spacing; sensor and effector on-the-move state; setup and teardown time; displacement interval; terrain and masking; network handoff; local versus shared track; loss of one node; communications delay or disconnection; operator task loading; friendly UAS activity; passive-signature state.
- Priority measures: coverage continuity during movement; time without usable detection; time to restore the chain after displacement; track handoff success; alert dissemination time; local decision latency; engagement opportunity lost to movement; setup and re-emplacement time; mission continuity after component loss; workload and intervention.
- Limits: a static emplacement demonstration does not support a maneuver conclusion. A mobile platform must be tested through transition states, not only while halted.

#### Convoy and logistics-node vignette

- Decision focus: whether the defensive approach protects a moving convoy, temporary halt, transfer point, or logistics node without unacceptable disruption to the supported mission.
- Threat presentations: route reconnaissance; single-axis FPV attack; multi-axis attack; attack during halt or congestion; decoy before attack; repeated attacks intended to exhaust attention or effectors; attack after the convoy disperses; threat using terrain, structures, or background traffic.
- Test factors: convoy length and spacing; sensor placement within the convoy; lead, middle, and trail coverage; speed, halt, and restart; route clutter; friendly emissions; network coverage; local alerting; effector field of fire; civil or friendly-air background; operator workload and competing duties; protected-asset substitution or decoy.
- Priority measures: coverage gaps by convoy position; detection and warning by approach axis; time for alert to reach affected vehicles; track continuity during turns and terrain masking; correct threat association; time to protective action; mission delay; engagement opportunity; threat leakage to the protected element; recovery and convoy restart time.
- Limits: one instrumented vehicle does not establish convoy-wide coverage. The test must represent the geometry and dissemination path of the supported formation.

#### Airfield or port defense vignette

- Decision focus: whether the defensive system protects a large, complex site containing friendly aircraft, vehicles, infrastructure, electromagnetic activity, and multiple critical functions.
- Threat presentations: low-altitude perimeter approach; approach mixed with friendly-air activity; reconnaissance of critical nodes; decoy or nuisance traffic; one-way attack against a stated function; multi-axis raid; repeated waves; reduced-emission or autonomous segment; post-strike assessment aircraft.
- Test factors: large-area coverage; buildings, ships, cranes, aircraft, and ground clutter; friendly transponders and identification data; air-operations tempo; spectrum congestion; multiple defended assets; centralized and local alerting; effector sectors and restricted directions; shift turnover; component loss; passive protection of critical functions.
- Priority measures: detection coverage by sector and altitude; false and nuisance tracks; friendly-versus-hostile identification; handoff across coverage sectors; time to protect each critical function; simultaneous-target capacity; raid leakage; false engagement; mission interruption; recovery after attack or component loss.
- Limits: a result for one sector or one protected function does not establish whole-site defense.

#### Urban defense vignette

- Decision focus: whether the defensive chain can distinguish, track, and respond to a threat in cluttered terrain with occlusion, multipath, constrained engagement geometry, and dense neutral activity.
- Threat presentations: low-altitude street or rooftop approach; short exposure after occlusion; hover or loiter near structures; route changes around buildings; threat mixed with neutral UAS; multi-axis approach; reduced-emission aircraft; attack from short range.
- Test factors: building density and height; sensor placement; occlusion and multipath; EO/IR and acoustic background; neutral UAS; civil communications; constrained effector sectors; alternate sensor cueing; local observer reporting; network delay; day, night, and illumination transition.
- Priority measures: probability of detection by exposure duration; time to reacquire after occlusion; track swaps and false tracks; identification accuracy; warning margin; correct response selection; engagement opportunity; collateral or restricted-sector effects; mission defeat; operator workload.
- Limits: urban results are geometry-specific. Record the structures, sight lines, RF environment, background activity, and engagement constraints needed to reproduce the condition.

#### Coalition vignette

- Decision focus: whether a combined defensive chain can exchange usable warning and track information, interpret it consistently, and complete the tested mission thread across heterogeneous systems and procedures.
- Threat presentations: use the same threat profiles employed in a national baseline when possible so the effect of coalition integration can be isolated.
- Test factors: data format and interface; track identifiers; coordinate and time reference; classification markings or releasability constraints represented in the event; voice versus digital exchange; translation and terminology; shared versus separate pictures; sensor-to-partner handoff; partner-to-effector handoff; different procedures; network delay, loss, and fallback; friendly-air identification.
- Priority measures: message delivery; data completeness; track association; coordinate and time error; handoff success; duplicate or conflicting tracks; time to common understanding; decision latency; correct assignment; mission-thread completion after network degradation.
- Limits: record the exact systems, interfaces, procedures, data made available, and exercised relationships. Do not infer interoperability outside the tested configuration.

#### Degraded or disconnected C2 vignette

- Decision focus: which portions of the defensive mission thread remain effective after loss, delay, corruption, or partition of the normal information path.
- Degradation states and factors: see section 1.16 of this file.
- Priority measures: time to detect the degradation; data age; track continuity; local warning and action time; handoff loss; expired opportunities; correct local response; mission success during partition; time to restore; duplicate, stale, or conflicting actions after restoration.
- Limits: do not introduce an unrecorded network failure and treat it only as realism. The degradation must be measurable and tied to the affected transitions and conclusions.

#### Contested-spectrum vignette

- Decision focus: how the complete mission thread changes when sensing, communications, navigation, or effects operate in a defined congested or contested electromagnetic environment.
- Required condition definition: see section 1.15 of this file.
- Priority measures: detection and track degradation; communications loss or delay; navigation error; threat behavior change; blue-system behavior change; friendly-system effect; soft-kill effect; recovery time; handoff success; end-to-end mission success.
- Limits: measure the environment and state what was actually applied.

#### Mass, saturation, decoy, and mixed-threat vignette

- Decision focus: where the defensive architecture loses track quality, decision capacity, engagement capacity, magazine depth, or mission protection as simultaneous demand increases.
- Threat presentations: increasing raid size; increasing arrival rate; multiple approach axes; mixed airframes; decoys mixed with attack aircraft; reconnaissance preceding attack; repeated waves; threats with different emissions or control modes; bounded adaptation after the first defensive effect.
- Test factors: number of simultaneous objects; track density; arrival spacing; classification mix; operator-to-track ratio; sensor and C2 processing load; effector inventory; reload, reset, thermal, or duty-cycle limits; assignment policy exercised; network load; background traffic.
- Priority measures: probability of detection per threat and per raid; track initiation and continuity under load; track swaps and duplicate tracks; identification accuracy; time to decision; assignment conflicts; simultaneous engagements; raid leakage; defeated threats by type; protected-asset outcome; resource expenditure; operator workload; recovery before the next wave.
- Limits: do not describe constructive or simulated raid members as live aircraft. State which objects were live, virtual, or constructive and which mission-thread transitions each could stimulate.

### 4.6 Passive/active factorial template (page 09, sec 5)

```text
Passive defense absent / active defense nominal
Passive defense present / active defense nominal
Passive defense absent / active defense degraded
Passive defense present / active defense degraded
```

Interactions to watch: active sensor emissions revealing the defended position; deception increasing false tracks or consuming effectors; displacement changing network or sensor coverage; emissions control reducing blue coordination; hardening preserving the mission after incomplete defeat; alternate paths increasing latency while improving resilience. Rule: do not report only the main effect when the interaction changes the operational conclusion.

### 4.7 EW/kinetic integration record templates (page 09, sec 6)

EW or non-kinetic effect record: threat dependence being targeted; threat control and navigation mode; threat emission state; applied effect and timing; intended behavior change; observable behavior change; duration of effect; threat recovery or adaptation; effect on friendly systems and background activity; whether the threat mission was prevented.

Kinetic or physical effect record: engagement assignment; launch or fire time; engagement geometry; effector state; intercept or closest-approach event; physical effect; threat post-effect state; debris or residual-threat behavior; protected-asset outcome; reset, reload, or thermal recovery.

Integrated sequences to test: soft kill before hard kill; hard kill as primary with soft-kill support; simultaneous or layered effect; escalation after failed effect; reversion after threat changes control or navigation; assignment under multiple simultaneous threats; handoff between effectors; recovery after one effector becomes unavailable.

Separate in scoring: detection success; assignment success; effector availability; engagement success; mission defeat; post-engagement assessment. A failed kill chain can contain a successful effector event, and an effector miss can be caused by an earlier track or handoff error.

### 4.8 Passive-defense factor and question sets (page 09, sec 4)

Factors: dispersion; displacement and re-emplacement; cover, concealment, camouflage, and visual-signature control; emissions control; deception or decoys; hardening; redundancy; alternate C2 paths; alerting and warning; reduction of exposed time; recovery after detection or attack.

Questions: Did the passive measure delay or prevent threat acquisition? Did it cause the threat to select the wrong object? Did it reduce the time available for threat attack? Did it preserve the defended mission after partial loss? Did it create a cost, delay, signature, or workload that changes its usefulness? Did active-defense emissions negate the passive measure?

## 5. Outputs & deliverables

### 5.1 Required OPFOR/threat outputs (page 08, sec 14; work incomplete until produced)

1. Threat-basis statement separating doctrine, observed practice, and test assumption.
2. One threat-profile record per operationally distinct presentation.
3. Threat feature-to-measure mapping.
4. Surrogate-fidelity matrix.
5. Permitted and prohibited generalization statement.
6. Threat-coverage matrix.
7. Red-variable classification.
8. Red information and blinding plan.
9. Scripted, bounded-adaptive, or free-play execution specification.
10. Red truth and telemetry plan.
11. Red deviation and anomaly rules.
12. Threat-specific test-card content.
13. Actual-profile record for every run.
14. Run-by-run threat-fidelity adjudication.
15. Threat coverage and remaining-gap summary.
16. Minimum reusable OPFOR regression set.

### 5.2 Required doctrine-to-test outputs (page 09, sec 20)

1. Mission-thread package.
2. Doctrine, observed-practice, assumption, and constraint separation.
3. Protected-outcome definition.
4. Friendly-posture and geometry record.
5. OPFOR threat profile.
6. Passive-defense test definition.
7. Detect-Track-Identify-Decide-Defeat-Assess decomposition.
8. Cross-chain event dictionary.
9. Transition measure set.
10. End-to-end measure set.
11. Operator, C2, network, and exercised command-condition record.
12. EW and kinetic integration matrix when applicable.
13. Doctrine-to-test traceability matrix.
14. Test matrix.
15. Required test cards.
16. Truth and instrumentation map.
17. Run-validity rules.
18. Actual mission-thread record for each run.
19. Transition-by-transition failure attribution.
20. Permitted and prohibited conclusion statement.
21. Remaining operational and evidence gaps.
22. Minimum mission-thread regression set.

## 6. Workflow & sequencing logic

### 6.1 Threat-design chain (page 08, sec 1)

```text
Decision uncertainty
-> operational threat behavior
-> performance-driving threat features
-> available representation
-> fidelity assessment
-> test factors and controls
-> executable red profile
-> observed red state
-> bounded finding
```

Rule: if the available representation cannot reproduce a performance-driving feature, redesign the question or narrow the conclusion.

### 6.2 Doctrine-to-evidence chain (page 09, sec 1)

```text
Mission
-> protected outcome
-> friendly posture and conditions
-> adversary mission and TTP
-> passive and active defensive actions
-> Detect
-> Track
-> Identify
-> Decide
-> Defeat
-> Assess
-> re-engage, recover, or continue the mission
-> measures
-> test matrix
-> test cards
-> bounded finding
```

Note: the doctrinal source uses Detect, Identify, Decide, Defeat. Page 09 inserts Track and Assess as explicit analytical transitions because test evidence must distinguish first awareness from a usable track, and an engagement event from verified effect. This is a T&E decomposition, not a doctrine replacement. Dissemination, handoff, command-and-control, and operator action cross the entire chain. (The Doctrine page's own chain is Detect -> identify -> decide -> disseminate -> defeat.)

### 6.3 Hybrid campaign sequence (page 08, sec 5)

```text
Scripted baseline
-> bounded-adaptive exploration
-> diagnostic isolation
-> scripted confirmation
-> free-play mission thread
-> targeted regression
```

Rule: do not merge exploratory and confirmatory runs into one undifferentiated result.

### 6.4 Minimum OPFOR campaign sequence (page 08, sec 13; ordered gate sequence)

1. Profile review: confirm the threat behavior and performance-driving features.
2. Surrogate checkout: verify the actual airframe, control, navigation, emissions, and truth sources.
3. Script rehearsal: confirm timing, geometry, calls, aborts, and data capture.
4. Positive-control run: confirm the test chain can observe the threat under a known favorable condition.
5. Negative-control run: confirm background activity is not scored as the intended threat.
6. Baseline characterization: execute repeatable scripted profiles.
7. Boundary exploration: vary one decision-relevant threat feature at a time when practical.
8. Bounded adaptation: allow controlled red responses.
9. Diagnostic isolation: reproduce observed weaknesses with the smallest useful variable change.
10. Confirmatory run: return to a controlled profile after exploration.
11. Mission-thread event: evaluate the integrated defensive chain under the selected operational conditions.
12. Regression selection: identify the minimum threat set required after relevant blue or red changes.

### 6.5 Card freeze and adjudication rhythm (page 08, secs 10-11)

Issue card -> card frozen during run -> record actual profile -> adjudicate deviations against predetermined validity consequences -> label allowed use of each run (valid / valid-for-other-purpose / diagnostic) -> feed threat-fidelity adjudication and coverage-gap summary.

### 6.6 Representative doctrinal engagement chain (Doctrine page, system-of-systems)

```text
Active or passive sensor detects the threat
-> identification is checked against the friendly air picture
-> the decision and warning are disseminated
-> a squad-level defender or Stinger operator acts under engagement criteria
-> platoon, company, or battalion layers continue the engagement until defeat
```

The Stinger example: the weapon can operate outside FAAD C2, but its operational value depends on warning reaching the operator in time.

## 7. Worked examples & real data

### 7.1 Jordan / JIATF-401 red air (as quoted inside page 08; full case is agent 12 scope)

The Jordan case shows manually flown quadcopters, small fixed-wing UAS, and aircraft intended to represent Shahed-type threats. Page 08 states it does NOT establish exact profiles, payloads, navigation methods, emissions, autonomy, electronic-warfare conditions, repeatability, or surrogate fidelity. Use as evidence that threat definition is required, not as a validated threat-profile library.

### 7.2 Observed practice numbers (OSINT compendium; label = observed practice, never doctrine; preserve caveats)

Verified findings (3-vote adversarial verification, confidence high):

- Ukrainian seven-phase combined-arms framework: survey, isolation, degradation, fixing, suppression, close combat/destroy, consolidation; UAVs in every phase. Emergent practice, not codified doctrine.
- FPV kill zone: majority of Ukrainian FPV kills within ~3 km either side of the forward line of troops; fiber-optic outliers 10-20 km.
- 60-80% of Ukrainian FPVs fail to reach their targets; tactical UAVs accounted for 60-70% of damaged/destroyed Russian systems as of early 2025; March 2026: 96% of 35,351 claimed monthly Russian casualties attributed to tactical drones (unverified Ukrainian General Staff claim).
- Autonomy: operator video-feed control markedly more effective than AI/pixel-lock terminal guidance except against regular-outline targets (air-defense systems, enemy UAVs, EW antennas). Manufacturer claim ~80% AI hit rate vs ~40% manual applies under jamming.
- Battlefield transparency: near-total within 3 km of line of contact; diminishing density to 15 km; taskable reconnaissance to ~40 km.
- Russian Orlan-10/Zala ISR: 1,000-1,300 daily overflights by Aug 2023; 1,000-1,500 daily orbits by Aug 2024 (possible airframe double-counting). Ukrainian response: networked radar/EO-cued interceptor UAVs (Brave1 ELF-P, VB140); FPVs most efficient against slow low reconnaissance drones; radar-guided interceptors handle higher-flying targets.
- GPS jamming is the dominant counter-UAS measure against GNSS-dependent systems; adaptations: fiber-optic tethered drones (~15 Ukrainian firms by early 2025), machine-vision terminal guidance, CRPA antennas. Manually piloted FPVs are defeated by control-link/video jamming instead.
- Shahed campaign: over 19,000 missiles and drones Sep 2022 - Dec 2024, including 14,700+ Shahed/Geran one-way attack drones; Sep-Dec 2024 launches exceeded the preceding 23 months combined; ~2,000/month production by end-2024; unit cost $35k-$80k; CSIS estimate ~$350,000 per target actually struck.
- Ukraine industrial base: 7 manufacturers (2022) to 500+ (2026); ~5,000 to projected 7 million annual capacity (government projection, not realized output).
- NATO C-UAS readiness gap: structured C-UAS capability absent from most NATO land forces (Oct 2024 RUSI assessment) against a 2028 readiness aiming mark.

Refuted claims, DO NOT CITE (failed 3-vote verification):

- Ukrainian drones account for >65% of destroyed Russian tanks (0-3)
- Low-cost drones have "democratized air power," replacing traditional air forces (0-3)
- Drone effectiveness depends less on technology than organizational integration, as stated (0-3)
- Wire/fibre-guided FPVs are EW-immune but limited to ~10 km with degraded flight performance (0-3)
- Most brigades field a UAV company/battalion per 40-70 km of front; each battalion generates 4-6 orbits (1-2)
- Shaheds hit <10% of targets vs 90-95% for Iskander-M/Kh-22 (0-3)
- FPV units: 50-60% targeting efficiency vs 0.5-1.5% for artillery (1-2)
- Interceptor drones (~100k produced 2025, ~2,000/day) down ~70% of Russian Gerans (1-2)

Source-base caveats to carry with any use: RUSI single analytical lineage (6 of 10 findings); Ukrainian government claims unverified; Shahed cost figures sensitive to unit-cost assumption; findings describe 2024-2025 conditions and are time-sensitive.

### 7.3 JIATF-401 program facts [overlap: Frontier page, agent 13 corpus; kept because pages 08/09 direct use for method gaps]

- JIATF-401 established 28 August 2025; replaced the Joint Counter-small Unmanned Aircraft Systems Office; Army-led; reports to Deputy Secretary of Defense; can approve up to $50 million per initiative; 36-month review.
- Adopted the Standard Guidelines for T&E of C-UAS Technologies on 11 March 2026; guidelines require common core data, terms, and schemas for all counter-small-UAS evaluations; they do NOT define measures, surrogate fidelity, or evaluation criteria; not a military standard.
- Yuma demonstrations twice yearly with RCCTO. Demonstration 5 (June 2024): nine systems against more than 40 counter-swarm targets. Demonstration 6 (April 2025): contested electromagnetic environment, Group 3 defeat, dismounted systems.
- No accredited surrogate catalog exists for UAS Groups 1 through 3; no standard defines surrogate fidelity.
- Joint Counter-small UAS University at Fort Sill uses a standard Detect, Identify, Track, and Defeat program.
- No DoD method covers adaptive-threat experimental design (basis of the bounded-adaptive treatment in page 08).

### 7.4 Doctrine numeric values (Doctrine page)

- Detect-to-engage design target: <=4 minutes (FAAD C2 construct).
- Fixed-site engagement volume: ~30 km radius / 20,000 ft AGL from bullseye center.
- Planning detection range: ~50% of system maximum range.
- Engagement hierarchy example: Group 2+ engaged prior to VID, other parameters permitting; prefer the weapon with most standoff range (including DCA/CAP).
- Ukraine component mix targeting 1M drones in 2024 (context line).

## 8. Product implications

What the app must let the user DO, from sections 1-7:

1. Threat profile record builder. A versioned THR-style record per operationally distinct presentation with the field groups of section 1.2: mission enum, kinematics (speed/altitude bands with range-vs-exact toggle), control/nav/autonomy, emissions/signatures (including safety-augmentation flag), raid/coordination, adaptation trigger-response pairs, and red-operator state. Any performance-affecting change forks a new version or variant. These records feed the existing threat library on the map canvas.
2. Representation class + surrogate-fidelity matrix. Per threat profile: one of 5 representation classes, then a per-feature fidelity grid (19 minimum features x 4 states Faithful/Approximated/Omitted/Unknown) with the 10 per-feature fields. Enforce the 5-condition fidelity decision rule; never compute a single overall fidelity score. Auto-derive permitted/prohibited generalization statements onto test cards and debriefs.
3. Execution mode selector. Scripted / bounded-adaptive / free-play as a per-run mode, each mode exposing its own required-field set (1.5) and its limitation text on outputs. Support the hybrid campaign sequence (6.3) as a campaign planner state machine, and the 12-step minimum OPFOR sequence (6.4) with positive/negative-control runs as gate steps before baseline runs.
4. Red variable classification per card. Every threat variable in a test card gets one of 6 classes (IV / held control / bounded red choice / recorded covariate / prohibited / unobserved nuisance) with the mandated 14 minimum variables pre-listed. Prohibited-variable changes auto-flag the run as a deviation.
5. Threat-coverage matrix UI. Grid of 12 candidate threat rows x 10 condition columns; user selects cells against the 6 selection criteria; each selected cell generates a design point that links to a mission-thread package and test card. Show coverage and remaining-gap summary as a deliverable.
6. Mission-thread packages and vignette seeds. Ship the 9 vignettes (fixed site, maneuver, convoy, airfield/port, urban, coalition, degraded C2, contested spectrum, saturation) as templates pre-filled with their threat presentations, factors, priority measures, sequences, and limits. Each instantiates the 22-item mission-thread package.
7. Chain time-tagging in timeline playback. First-class event markers for the 11-event integrated-run chain (launch/entry -> first detection -> first usable track -> ID -> alert -> decision -> assignment -> engagement -> effect -> assessment -> continuation), mapped to the Detect-Track-Identify-Decide-Defeat-Assess decomposition, so transition measures (2.2) and cross-chain latencies (2.3) compute from tagged times. Include the <=4 min detect-to-engage and ~50% planning-range doctrine values as default reference thresholds.
8. Deviation adjudication workflow. Card frozen at issue; actual-profile capture per run; deviation records (1.10) with the 12 seed types; predetermined validity consequences; run relabeled valid / diagnostic / invalid-for-purpose, never silently discarded.
9. Evidence-boundary labeling everywhere. Every scenario input tagged doctrine / observed practice / test assumption / site constraint / measured result / inference; observed-practice data (7.2) ships with caveats and a refuted-claims blocklist the app surfaces when cited.
10. Gates as blocking checklists. Threat-representation gate (3.1) and doctrine-to-test gate (3.2) as go/no-go checklists that block card issue; the "do not treat" list (3.3) as report-generation lint on conclusions (e.g., warn when a fixed-site result is generalized to maneuver).
11. Red truth plan per profile. Truth-source mapping (position/emissions/behavior sources, update rate, accuracy, identifier mapping to blue tracks) with a hard rule: no truth plan, no detection/track/latency/defeat claims in outputs.
12. Doctrine term dictionary. Seed the library with the doctrine enums and terms of 1.17 (AMD principles, tenets, BARS, procedural vs positive ID, FAAD C2/IFN/JDN/ADAM, left of launch, BDOC/TEA, engagement hierarchy) so doctrine terms map to selectable testable conditions and measures.
