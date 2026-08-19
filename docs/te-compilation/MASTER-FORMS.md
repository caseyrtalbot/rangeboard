# MASTER-FORMS — Checklists, Templates, Print Artifacts & Deliverables

Synthesis lane: everything the user fills in, checks off, prints, or hands to a customer.
Sources: extraction files 01–13 in this directory. Citations use `NN §x.y` = file `NN-*.md`, section x.y.
Item lists are verbatim from the extractions. Conflicts are marked `[CONFLICT: ...]`.

Global rules that govern every form and checklist in this document:

- "The approved plan and current test card always control execution. A checklist confirms the control. It does not replace it." (07)
- Every unused field on a completed record is marked "not applicable" with a stated reason; blank is not a valid state. (07)
- Every controlled record carries the standard 10-field header: Identifier, Title, Version, Status (Draft / In review / Approved / Issued / Superseded / Withdrawn / Closed), Owner, Approver, Effective date and time, Superseded version, Change summary, Related identifiers. Render this header on every record form and every printed/exported record. (01 §1.3, §4.6)
- Identifier pattern `VLK-<campaign>-<record type>-<sequence>-v<major>.<minor>`; runs carry no version suffix; runs are never overwritten or renumbered. (01 §4.2; 13 §1.1)

---

## 1. Checklist catalog

Legend for item types: **C** = check (yes/done), **V** = value entry, **G** = go/no-go decision, **S** = signature/approval. Unless stated, items are type C.

### Catalog index

| # | Canonical checklist | Phase | Who runs it | Items | Gate it feeds | Sources (canonical + variants) |
|---|---|---|---|---|---|---|
| 1 | Control gate | before-deployment | deployment strategist | 4 | unlock phase 01 (qualification) | 01 §3.6 |
| 2 | Qualification gate | before-deployment | deployment strategist | 4 | unlock evidence planning (phase 02) | 01 §3.7; 13 §3.5 gate statement |
| 3 | Structured discovery order | before-deployment | strategist + stakeholders | 10 steps | discovery complete | 01 §3.4 |
| 4 | Discovery question list | before-deployment | strategist | 13 | feeds question register | 01 §3.5 |
| 5 | Pre-Campaign Gate | before-deployment | strategist | 14 | campaign start | 13 §3.1 |
| 6 | Configuration control procedure | before-deployment + per run | strategist + system owner | 13 steps | baseline freeze / per-run verify | 01 §3.1 |
| 7 | Design gate | before-deployment | evidence authority + analysis lead approve | 6 | unlock phases 03/04 | 02 §3.2 |
| 8 | Stop / hold / repeat / adapt rule lists | configured before-deployment; fired in-run/day-of | test conductor et al. | 8+6+5+6 conditions | run stop / next-run hold / repeat / replanning | 02 §3.1 |
| 9 | Design checks (design lint) | before-deployment | app (warnings) | 12 | card generation | 04 §3.13 |
| 10 | Design review questions | before-deployment | strategist | 14 | design approval | 10 §3.5 |
| 11 | Measure dictionary use rules | before-deployment | strategist | 8 | measure instantiation | 09 §3.1 |
| 12 | Dictionary completion gate | before-deployment | strategist | 9 | measure "ready" status | 09 §3.2 |
| 13 | Threat-representation gate | before-deployment | red lead + strategist | 11 | execution (card issue) | 08 §3.1 |
| 14 | Doctrine-to-test gate | before-deployment | strategist | 11 | execution (card issue) | 08 §3.2 |
| 15 | Randomization / blocking / multiple-comparison rules | before-deployment | strategist + analysis lead | 3+3+5 | design approval | 09 §3.6–3.7; 10 §3.8 |
| 16 | Card review-and-issue lifecycle | before-deployment | conductor, engineering, red lead, data/analysis leads, safety | 13 steps | card issue | 04 §4.3 |
| 17 | Card completion gate | before-deployment | strategist | 8 | card issue | 11 §3.10 |
| 18 | Shared card rules (invariants) | all phases | app-enforced | 8 | — | 11 §3.11 |
| 19 | System and interface integration sequence | before-deployment | integration team | 10 steps | integration readiness review | 03 §3.2 |
| 20 | Clock-control / time-sync procedure | before-deployment + daily | data lead / data monitor | 10 steps | per-measure supportability | 11 §3.1 (canonical); 03 §3.1 variant (8 steps) |
| 21 | Spatial registration procedure | before-deployment | instrumentation lead | 8 steps | instrumentation gate | 11 §3.2 |
| 22 | Calibration schedule | campaign-bracketing | instrumentation lead | 8 points | instrumentation gate | 11 §3.3 |
| 23 | End-to-end rehearsal | before-deployment | full team | 12 steps | instrumentation gate / TRR | 11 §3.7 (canonical); 13 §3.8 variant (7 demonstrations) |
| 24 | Instrumentation readiness gate | readiness | instrumentation lead | 9 | live P1 execution | 11 §3.8 |
| 25 | Independence rules | readiness | strategist / reviewers | 6 | go/no-go review | 11 §3.9 |
| 26 | Safety rehearsal | before-deployment | safety authority | 8 rehearse items | range readiness review | 03 §3.3 |
| 27 | Test readiness review (TRR) | readiness | deployment strategist | 24 | go / conditional go / hold / no-go | 07 §3.1 (canonical); 03 §3.4 variant (16 evidence items); 13 §3.10 variant (4 domains + gate questions) |
| 28 | Readiness gate conditions | readiness | strategist | 6 | live-run unlock | 03 §3.5 |
| 29 | Baseline ideal standard | readiness (reference) | strategist | 14 | campaign completeness | 12 §3.7 |
| 30 | Day-start checklist | day-start | team, per-item responsible role | 36 (5 groups) | daily go/no-go | 04 §3.1 (canonical); 07 §3.2 variant (22 items); 13 §3.15 variant (4 items) |
| 31 | Daily quantitative before-first-run | day-start | analysis lead / data lead | 5 | daily go/no-go | 10 §3.1 |
| 32 | Pre-run release check | pre-run | test conductor (challenge-and-response) | 19 | run release | 04 §3.2 (canonical); 07 §3.3 variant (17); 13 §3.1 Pre-Run Gate variant (13); 12 §3.1–3.2 card-level variant (5+5) |
| 33 | Run initiation sequence | pre-run | test conductor + all roles | 10 steps | authoritative start time | 04 §3.3 |
| 34 | In-run duty lists | in-run | conductor / run logger / data monitor / strategist | 5+9+7+4 | — | 04 §3.4 |
| 35 | Safety or regulatory stop | in-run | any authorized; safety authority controls | 6 steps | restart gate | 04 §3.5 |
| 36 | Data-quality or equipment stop | in-run | data monitor / technical lead / conductor | 7 steps | degraded-operation approval | 04 §3.6 |
| 37 | Procedure deviation response | in-run | conductor + logger | 5 steps | post-run adjudication | 04 §3.7 |
| 38 | Anomaly response | in-run / post-run | conductor + team | 9 steps | anomaly record | 04 §3.8 |
| 39 | Run completion | post-run | conductor + team | 9 steps | debrief + validation | 04 §3.9 |
| 40 | Immediate factual debrief | post-run (≤10 min) | conductor-led, all roles | 6–8 prompts | run record | 04 §3.10; 13 §4.7 — see §3.7 of this document |
| 41 | Post-run data validation | post-run | data monitor / data lead | 11 | dependent next run + run status | 04 §3.11 |
| 42 | After-each-run quantitative workflow | post-run | analysis staff | 9 ordered steps | measure results | 10 §3.2 |
| 43 | Post-Run Gate | post-run | strategist | 10 | run enters evidence | 13 §3.1 |
| 44 | Deviation process | post-run (at deviation) | conductor / strategist | 7 steps | run status | 01 §3.2 |
| 45 | Out-of-tolerance handling | post-run / day-end | instrumentation lead | 7 steps | re-adjudication | 11 §3.4 (canonical); 10 §3.10 variant (5 steps) |
| 46 | Truth-conflict procedure | post-run | data lead | 6 steps | measure availability | 11 §3.5 |
| 47 | Missing-truth procedure | post-run | data lead | 5 | measure availability | 11 §3.6 |
| 48 | Per-run data-validity rules (by measure) | post-run (automated) | app + data monitor | 7 conditions | measure-level validity | 12 §3.5 |
| 49 | End-of-day procedure | day-end | conductor + team | 13 steps | next-day plan issue | 04 §3.12 |
| 50 | Daily evidence review | day-end | strategist-led board | 14 ordered items | next-day plan + approvals | 07 §3.4 (canonical); 05 Part H variant (5 steps); 13 §3.11 variant (4 steps); 10 §3.3 variant (7 items); 13 §3.1 Daily Closeout Gate variant (9 items); 13 §3.15 replanning variant (5 steps) |
| 51 | Run-validity board review | day-end | strategist, conductor, data lead, analysis lead (+specialists, +safety when safety evidence) | 8 review items | run final status | 05 §3 |
| 52 | Evidence intake | day-end / per run | data/analysis staff | 7 steps | pipeline entry | 05 §3 |
| 53 | Analytical QC | before metric production | analysis lead | 10 | measure computation | 05 §3 |
| 54 | Correction checklist | any correction | person making correction | 5 | derived-version creation | 05 §3 |
| 55 | Preapproved adaptation rules | day-of, conditional | conductor + strategist | 6 IF/THEN rules | next-run selection | 12 §3.4 |
| 56 | Run-ordering rules | day-end (schedule generator) | strategist | 7 | run list | 12 §3.3 |
| 57 | Causal diagnosis | triggered by anomaly/failure | analysis + strategist | 10 steps | root-cause classification | 05 §3 (canonical); 13 §3.11 variant (7 steps) |
| 58 | Sufficiency stop | day-end / campaign | strategist + evidence authority | 5 (all must apply) | stop a test line | 05 §3 |
| 59 | Futility stop | day-end / campaign | strategist | 4 (any applies) | stop a test line | 05 §3 |
| 60 | Missingness bias questions | analysis | analysis lead | 4 | finding approval | 10 §3.9 |
| 61 | Common quantitative errors (lint) | analysis | app (reject patterns) | 21 | finding approval | 10 §3.7 |
| 62 | Finding review questions | analysis | strategist | 10 | finding approval | 10 §3.6 |
| 63 | Quantitative analysis gate | analysis | analysis lead | 8 | quantitative finding ready | 09 §3.3 |
| 64 | Valid threat presentation | per run (denominator rule) | app + data monitor | 6 (all required) | opportunity counting | 09 §3.4 |
| 65 | Eligible detection opportunity | per run (denominator rule) | app + data monitor | 4 (all required) | opportunity counting | 09 §3.5 |
| 66 | Invalid-run preservation | post-run | data lead | 5 uses | archive rules | 09 §3.8 |
| 67 | Evidence "do not treat" guard | analysis / reporting | app lint on conclusions | 8 | report generation | 08 §3.3 |
| 68 | Completed-campaign synthesis | closeout | analysis lead | 10 steps | final findings | 05 §3 (canonical); 10 §3.4 variant (8 items) |
| 69 | Analysis-complete gate | closeout | strategist | 5 conditions | findings export | 05 §3 |
| 70 | Decision evidence package checklist | closeout | strategist | 18 | evidence delivery | 07 §3.5 |
| 71 | Independent-reviewer test | closeout | independent reviewer | 7 questions | package acceptance | 06 §3 (canonical); 13 §3.12 variant (6 questions) |
| 72 | Architecture and mission assessment | closeout | analyst / evidence team | 10 | package section 11 | 06 §3 |
| 73 | Delivery and custody | closeout | campaign lead / data custodian | 9 steps | package delivered | 06 §3 |
| 74 | Closeout and regression checklist | closeout | campaign lead | 18 | campaign closed | 07 §3.6 (canonical); 06 §3 variant (4 groups); 13 §3.13 variant |
| 75 | Closeout gate | closeout | campaign lead | 6 conditions | status → Closed | 06 §3 |
| 76 | After-action review (nine questions) | closeout (≤5 working days) | whole team, facilitated | 9 questions | improvement records | 06 §3 — see §3.7 of this document |
| 77 | Reuse-harvest steps | closeout | asset owner | 8 steps per asset | controlled library | 06 §3 |
| 78 | Change-impact and regression process | post-baseline, on change | evidence authority + analyst | 8 steps | regression plan | 06 §3 |
| 79 | C-UAS regression assessment | post-baseline | analyst | 7 | regression coverage | 06 §3 |
| 80 | Deployment Strategist's Standard | continuous | strategist | 9 questions | traceability health | 13 §3.2 |
| 81 | Ten continuous control questions | continuous | campaign lead | 10 | traceability health | 13 §3.3 |
| 82 | Pocket rules | continuous | app-enforced validation gates | 11 | multiple hard gates | 07 §6 |

Count: 82 canonical checklists/rule-lists after merging variants (roughly 95 raw lists across the 13 files before dedup).

---

### 1.1 Before-deployment checklists

#### 1.1.1 Control gate checklist (01 §3.6) — end of phase 00; deployment strategist. Gate: unlock qualification phase.
Proceed only when:
- Every decision type has one accountable authority.
- Every controlled record has an owner.
- The configuration process can reconstruct each run.
- All participants know the stop, restart, change, and escalation paths.

Item types: all C. Gate outcome: proceed / do not proceed (G).

#### 1.1.2 Qualification gate checklist (01 §3.7) — end of phase 01; deployment strategist. Gate: unlock evidence planning.
Proceed only when the team can state (fill-in statement, 01 §4.4):
- The specific decision and its date. (V)
- The organization that will accept evidence, and its conditions. (V)
- The uncertainty the campaign can reduce. (V)
- That the mission, evaluated boundary, customer commitment, authority path, and execution conditions are sufficiently feasible to begin detailed evidence planning. (C)

Rendered as the fill-in gate statement: "The customer must make **this decision** by **this date**. **This organization** will accept evidence that meets **these conditions**. The campaign can reduce **this uncertainty**. The mission, evaluated boundary, customer commitment, authority path, and execution conditions are sufficiently feasible to begin detailed evidence planning." Variant wording in 13 §3.5 ("this bounded decision ... these acceptance conditions ... decision-critical uncertainty ... required customer commitment and execution conditions are feasible").

#### 1.1.3 Structured discovery order (01 §3.4) — deployment strategist with decision owner, mission owner, operators, system owner, analysts, and evidence authority present when possible. Ordered steps:
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

#### 1.1.4 Discovery question list (01 §3.5) — verbatim; feeds question/claim/unknown/assumption registers:
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

Rule (01 §1.5 via 13): convert each customer statement into one of four categories — Claim, Known fact, Unknown, Assumption — then ask "What evidence would resolve this unknown?" The much larger phase-2 RFI question bank (mission/system/claims/threat/conditions/known problems/assumptions/priorities) is in 13 §3.4 and should seed the discovery workspace prompt library.

#### 1.1.5 Pre-Campaign Gate (13 §3.1) — Field Guide; strategist. Gate: campaign start.
- [ ] Customer decision defined.
- [ ] Operational questions identified.
- [ ] System boundary defined.
- [ ] Configuration known.
- [ ] Claims and unknowns captured.
- [ ] Threat context defined.
- [ ] Existing evidence reviewed.
- [ ] Measures defined.
- [ ] Ground-truth approach defined.
- [ ] Data availability verified.
- [ ] Test levels selected.
- [ ] Range constraints understood.
- [ ] Stop/retest criteria defined.
- [ ] Customer understands intended outputs.

Overlap note: this condensed gate spans what the Control gate, Qualification gate, and Design gate cover in the manual proper. Treat it as the Field Guide quick-reference view of those three gates, not a fourth independent gate.

#### 1.1.6 Configuration control procedure (01 §3.1) — deployment strategist with system owner. Feeds: baseline freeze; per-run baseline verification.
1. Define the configuration item list.
2. Record hardware model, serial number, firmware, software, model, mission data, feature flags, thresholds, calibration, interfaces, network settings, security settings, operator procedure, and training state. (V)
3. Export machine-readable settings where the system supports it.
4. Photograph or record physical settings when an export is not possible. (conditional: only when export impossible)
5. Record known defects, waivers, temporary fixes, and vendor modifications. (V)
6. Assign the baseline identifier. (V)
7. Complete functional checkout.
8. Obtain system-owner release. (S)
9. Freeze the baseline before the first dependent run.
10. Verify the baseline before each run by export, checksum, screen capture, or signed check.
11. Record every observed drift. (V)
12. Link every run to the active baseline.
13. Preserve all superseded baselines.

Conditional rule: a configuration change requires a new baseline when it can affect behavior, data, safety, comparability, or applicability.

#### 1.1.7 Design gate checklist (02 §3.2) — final gate of evidence planning. Gate: unlock integration/card phases.
Proceed only when ALL of:
- Every P1 question has a defensible evidence path.
- Measures are reproducible.
- Thresholds have accepted rationale.
- Threats and conditions support the intended conclusion.
- Repetition supports the promised evidence strength.
- The evidence authority accepts the method. (S)

Runner: [AMBIGUOUS in source: evidence authority and analysis lead named as approvers; overall executor unnamed.]

#### 1.1.8 Stop / hold / repeat / adapt rule lists (02 §3.1) — configured before execution; fired during execution. Four conditional lists, verbatim.

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

Governance rule: "For every adaptation class, name the approver and maximum change allowed without a new design review." (two V fields per adaptation class). Related stop taxonomy by authority (13 §3.7): safety/regulatory stop (campaign safety plan), data-quality stop, equipment stop, evidence-sufficiency stop, futility stop, resource stop.

#### 1.1.9 Design checks — design lint (04 §3.13) — app warnings before card generation:
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

#### 1.1.10 Design review questions (10 §3.5) — strategist, before approving a design:
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

#### 1.1.11 Measure dictionary use rules (09 §3.1) — run when instantiating a measure:
1. Copy a dictionary entry into the campaign measure registry.
2. Replace every bracketed parameter with an approved value or record.
3. Freeze event, denominator, truth, missing-data, validity, and uncertainty rules before execution.
4. Link each measure to a decision, investigative question, hypothesis, mission task, and test-matrix cell.
5. Report results by configuration, threat, and condition. Do not collapse materially different conditions into one average.
6. Preserve the counts of planned, attempted, valid, conditionally valid, invalid, missing, and censored observations.
7. A threshold is not inherent in the measure. Record its mission, requirement, safety, baseline, or customer-decision source separately.
8. A measure is available only when its required truth, timing, configuration, and data-quality conditions pass.

#### 1.1.12 Dictionary completion gate (09 §3.2) — a measure is ready only when all pass:
- Its event and opportunity definitions are executable.
- Its numerator and denominator cannot be interpreted two different ways.
- Its experimental unit is explicit.
- Its truth and data sources are identified.
- Its time and coordinate tolerances are approved.
- Missing, invalid, censored, and ambiguous observations have written rules.
- Measurement and sampling uncertainty have a stated method.
- Required condition breakdowns and prohibited aggregation are known.
- A cold reader can reproduce the result from retained data.

#### 1.1.13 Threat-representation gate (08 §3.1) — go/no-go, run before execution:
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

#### 1.1.14 Doctrine-to-test gate (08 §3.2) — go/no-go:
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

#### 1.1.15 Randomization rules (09 §3.6), blocking rules (09 §3.7), multiple-comparison controls (10 §3.8)

Randomization:
- Randomize when practical: configuration order, threat approach direction, factor combinations, operator assignment, time within a block.
- Do not randomize across unsafe, infeasible, or destructive transitions merely for statistical appearance. Record restrictions and use an appropriate blocked or split-plot design.
- Preserve the randomization schedule and actual order. A field-driven departure becomes a recorded deviation or approved adaptation.

Blocking:
- Block on nuisance factors that cannot be eliminated but can be grouped.
- Within a block, compare configurations under conditions that are as similar as practical.
- Do not confuse blocking with aggregation. Preserve block identity in analysis.

Multiple-comparison controls (before execution):
- Name the primary comparisons.
- Label exploratory comparisons.
- Limit the number of formal claims.
- Select familywise or false-discovery control when required.
- Prefer effect sizes and intervals over isolated p-values.
Rule: Do not search many cells until one favorable result appears and then present it as the planned result.

#### 1.1.16 Card review-and-issue lifecycle (04 §4.3) — gate: card issue. Ordered steps:
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
11. Obtain required approvals. (S)
12. Issue the execution version.
13. Freeze it until the run ends.

Gate rule: a card that fails the cold-reader or dry-run test is not ready.

#### 1.1.17 Card completion gate (11 §3.10) — card ready for issue only when all pass:
- Every bracketed placeholder resolves to a controlled record.
- Measures use the current dictionary versions.
- Planned repetitions and stopping rules trace to the quantitative design.
- Truth, time, registration, and data-health limits trace to the instrumentation plan.
- Event and denominator definitions are frozen.
- The complete procedure has passed cold-reader review and dry run.
- The team can name which measures remain available after each permitted degraded condition.
- Allowed and prohibited conclusions are explicit.

#### 1.1.18 Shared card rules (11 §3.11) — invariants the app enforces on every card:
- One issued card controls one run type.
- One run receives one immutable run ID.
- Actual differences become deviations; never edit the card to match the run.
- Planned sample sizes come from the approved quantitative design.
- Each card references controlled configuration, threat, condition, measure, and instrumentation records.
- Exact safety, regulatory, security, range, stop, and restart controls come from the active campaign plan.
- A dry run is not scored unless the issued card and design explicitly define it as a scored event.
- Invalid evidence is preserved and excluded only under the approved measure rule.

#### 1.1.19 System and interface integration sequence (03 §3.2) — ordered; rule: "Do not use live mission runs to find basic component or interface faults."
1. Inventory all hardware, software, cables, networks, credentials, licenses, power, cooling, mounts, and support equipment.
2. Verify component function against a known input.
3. Verify every interface against the current interface definition.
4. Confirm units, coordinate frames, message semantics, identity, and timing.
5. Exercise expected loads and failure states.
6. Confirm security and access controls.
7. Run a complete sample event.
8. Compute every P1 measure from the sample data. (V)
9. Restore from backup.
10. Record defects, owners, correction dates, and retest evidence. (V)

#### 1.1.20 Clock-control / time-synchronization procedure — canonical: 11 §3.1 (data monitor / instrumentation lead):
1. Synchronize before integration rehearsal.
2. Record source, method, offset, and device. (V)
3. Check at day start.
4. Check before the first P1 run.
5. Monitor during the run when supported.
6. Recheck after power, network, firmware, recorder, or source changes. (conditional)
7. Recheck after suspected drift. (conditional)
8. Check at day end.
9. Fit or apply a drift correction only through an approved versioned transformation.
10. Retain pre- and post-correction timestamps and uncertainty. (V)

Variant (03 §3.1, data lead, 8 steps): adds "Select the authoritative time source", "Define the maximum offset and drift for each measure" (per-measure tolerance, V), and "Preserve original source timestamps". Merge both into one procedure: selection + tolerance definition happen once at campaign level (03), the check cadence follows 11. Gating rule (03 §2): "If time uncertainty exceeds the tolerance for a measure, the run cannot support that measure."

#### 1.1.21 Spatial registration procedure (11 §3.2):
1. Survey or establish instrument locations and reference points.
2. Verify coordinate declarations.
3. Apply lever-arm and boresight corrections.
4. Use a known reference object or trajectory.
5. Estimate residual spatial bias by region and geometry. (V)
6. Record uncertainty and coverage. (V)
7. Repeat after movement, impact, maintenance, remounting, or suspected shift. (conditional)
8. Preserve raw coordinates and derived registered coordinates.

#### 1.1.22 Calibration schedule (11 §3.3) — per instrument; brackets the campaign:
- Pre-campaign calibration.
- Installation/registration check.
- Day-start functional check.
- Pre-run check where required. (conditional)
- Continuous health/reference signal where available. (conditional)
- Post-run check after a suspected event. (conditional)
- Day-end drift check.
- Post-campaign calibration.

#### 1.1.23 End-to-end rehearsal (11 §3.7) — before live P1 execution; prerequisite of the instrumentation gate:
1. Generate a representative truth object and source event.
2. Exercise every required source.
3. Verify identifiers.
4. Verify common time and registration.
5. Trigger warning and stop health states.
6. Exercise buffering and fallback.
7. Ingest the data.
8. Correlate truth and source objects.
9. Compute every P1 measure. (V)
10. Trace each result back to raw data and configuration.
11. Reproduce the result independently.
12. Record the rehearsal acceptance result and deficiencies. (V)

Variant (13 §3.8, QtM 04 rehearsal acceptance — before range execution, demonstrate that):
- Every required source reaches the analysis environment.
- Every trial and configuration is uniquely tagged.
- Time synchronization and ground-truth correlation meet tolerance.
- Required metrics can be computed from representative rehearsal data.
- Data-quality monitoring detects defined failure modes.
- Backup, buffering, disconnected, access-control, and recovery procedures work.
- A reviewer can trace a rehearsal result to raw data, configuration, method, and transformation version.

Gate (13 §3.8): proceed only when the complete evidence chain has passed rehearsal, or every deficiency has a named owner, approved disposition, and explicit effect on achievable conclusions.

#### 1.1.24 Instrumentation readiness gate (11 §3.8) — all must pass before live P1 execution:
- Independent truth covers every P1 measure.
- Common time and registration meet measure-specific tolerances.
- Calibration is current and traceable.
- Event and object identities reconcile across systems.
- Green, warning, stop, and degraded limits are implemented and tested.
- Raw data and transformations are versioned and reproducible.
- Missing and conflicting truth have written rules.
- Fallback paths have passed rehearsal.
- The team can state exactly which conclusions disappear when any critical source fails.

#### 1.1.25 Independence rules (11 §3.9) — go/no-go review items for truth sourcing:
- Do not use the radar under test as truth for its own detection probability.
- Do not use the receiving C2's track as the only truth for handoff correctness.
- Do not use the EW system's "effect achieved" flag as the only proof of mission effect.
- Do not use the interceptor's internal closest-approach estimate as the only intercept truth unless independently validated.
- Do not use the planned threat route as proof of the actual route.
- A source can support both system operation and truth only when its independence and intended use are explicitly justified.

#### 1.1.26 Safety rehearsal checklist (03 §3.3) — pre-execution. Rehearse:
stop words, safe states, evacuation, medical response, fire response, lost-link response, flight termination, restart authority.

---

### 1.2 Readiness checklists

#### 1.2.1 Test readiness review (TRR) — CANONICAL: 07 §3.1, 24 items. Gate: outcome enum `go | conditional go | hold | no-go`.
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
- [ ] Go, conditional go, hold, or no-go is recorded. (G + V: time, approvers)

Variant A (03 §3.4 — TRR evidence checklist; the strategist provides objective evidence for): issued campaign charter and test plan; active authorities; released configuration baselines; signed test cards; trained operators and conductors; threat and condition readiness; safety and emergency rehearsal; calibration and synchronization; ground-truth verification; complete sample capture; P1 metric computation from rehearsal data; storage, backup, access, and recovery test; spares and maintenance; current defects and waivers; weather and reserve plan; customer and evidence-authority participation. (16 evidence items — same gate, phrased as evidence-attachment requirements; each canonical item should accept attached evidence.)

Variant B (13 §3.10 — QtM 06): readiness grouped into Technical (6), Operational (4), Safety/regulatory/security (4), and Data (4) readiness statements, plus per-control record fields (baseline or approval reference, status, deficiency, owner, due date, waiver authority, supporting evidence) and go/no-go gate questions (which controls must be green; which deficiencies may be accepted, by which authority, with what effect on conclusions; which require delay, redesign, rescoping, or cancellation; who makes and records the final decision).

Readiness review series (03 §6.2): five gated review events, in order — Design readiness review; Integration readiness review; Range readiness review; Test readiness review; Daily readiness review (recurring). Each carries the outcome enum: Go / Conditional go (named authority accepts defined deficiencies; limits written into the cards and conclusion plan) / Hold / No-go. Note (13 §6.9): DoD practice distinguishes the systems-engineering TRR from certification of readiness for dedicated OT — different purposes and owners.

#### 1.2.2 Readiness gate conditions (03 §3.5) — final gate before live runs. Start live runs only when all true:
- The complete mission and evidence chain has passed rehearsal.
- Mandatory authorities are active.
- Current cards and configurations are issued.
- People can perform the procedure.
- Fallback paths work.
- Every open deficiency has an approved disposition with an explicit effect on achievable conclusions.

#### 1.2.3 Baseline ideal standard (12 §3.7) — campaign-completeness reference checklist:
A baseline ideal campaign is complete when:
- The customer question is measurable.
- The test object and exact change are explicit.
- The hypothesis can be supported or contradicted.
- Predictions exist before results.
- The experimental unit is correct.
- The factor space supports the intended claim.
- Repetitions trace to a quantitative reason.
- Every measure has independent truth and required data.
- The card contains only execution-critical content.
- The day-of interface captures actual conditions and events.
- Calculations are reproducible.
- Uncertainty and trade-offs remain visible.
- The finding states both the result and its limit.
- The customer receives a practical action and next test.

---

### 1.3 Day-start checklists

#### 1.3.1 Day-start checklist — CANONICAL: 04 §3.1 (grouped procedure, complete before the first live run; record each item and responsible person). Gate: daily go/no-go.

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
4. Export or capture the configuration record. (V)
5. Confirm known defects, maintenance state, battery or fuel state, spares, and recovery tools.
6. Confirm red configuration and profile assets.

**Instrumentation and data**
1. Inspect and calibrate required instruments.
2. Verify ground-truth sources against a known reference.
3. Synchronize all recorders to the common time source.
4. Record offsets and drift status. (V)
5. Verify storage space, permissions, naming, and backup targets.
6. Start a representative sample event.
7. Capture it through every required source.
8. Ingest the data.
9. Compute at least one P1 measure. (V)
10. Verify data-quality alerts and fallback paths.
11. Record the evidence-chain acceptance result. (V)

**Go/no-go**
1. Review open defects and waivers.
2. State each affected measure and conclusion. (V)
3. Obtain the daily safety decision. (S)
4. Obtain the daily range, airspace, spectrum, security, and system decisions. (S)
5. Obtain the deployment strategist's evidence-readiness decision. (S)
6. Record go, conditional go, hold, or no-go with time and approvers. (G + V)

Variant A (07 §3.2 — condensed 22-item print form, same gate; item list verbatim): Range window confirmed. / Airspace status confirmed. / Spectrum status confirmed. / Weather and forecast within limits. / Site access and nonparticipant controls active. / Emergency support ready. / Authorities and waivers active. / Required people present and fit for duty. / Day objective and minimum viable campaign briefed. / Communications and stop calls checked. / Blue and red systems inspected. / Released configurations loaded and captured. / Maintenance, battery, fuel, spares, and recovery state ready. / Instruments calibrated. / Ground truth verified. / Clocks synchronized and offsets recorded. / Storage and backup ready. / Sample capture completed. / P1 sample measure computed. / Data alerts and fallback tested. / Open defects and limits briefed. / Daily go/no-go recorded.
[CONFLICT: 07's daily gate records only `go | no-go`; 04 records `go | conditional go | hold | no-go` with time and approvers. Adopt the 04 four-state enum; 07 flags its own two-state wording as ambiguous.]

Variant B (13 §3.15, Corpus 05 go/no-go check — 4 items): weather and range clearance; instrumentation and ground-truth recording; active spectrum authority; test configuration against the frozen baseline. Rule: stop the test if one required item is not ready. Corpus 05 also prepends a pretest briefing: review each test card; practice the knock-it-off and terminate calls.

#### 1.3.2 Daily quantitative workflow — before the first run (10 §3.1):
- Compute every P1 measure from rehearsal data. (V)
- Verify units, schemas, time, registration, and identity.
- Test code against a known case.
- Compare an independent calculation for each P1 measure.
- Confirm the run-count plan and drop order.

---

### 1.4 Pre-run checklists

#### 1.4.1 Pre-run release check — CANONICAL: 04 §3.2 (test conductor, challenge-and-response, immediately before each run). Gate: run release. Conditional rule: **if any answer is unknown, hold the run.**
Confirm:
- Correct card and version.
- Unique run identifier.
- Run purpose and matrix cell.
- Required repetition and reason for this run now.
- Correct blue and red configurations.
- Correct operators and procedures.
- Actual weather, environment, spectrum, airspace, and range state. (V)
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

Variant A (07 §3.3 — 17 items; final item names the releasing role): Correct card and version. / Unique run ID. / Purpose and matrix cell stated. / Correct blue configuration. / Correct threat profile. / Correct condition and operating limits. / Correct operators and procedure. / Required authorities active. / Safety area clear. / Stop and emergency channels work. / Ground truth records. / Instruments and time meet tolerance. / Recorders and storage ready. / Data monitor sees required sources. / Blinding preserved. / No unrecorded change. / **Test conductor releases the run.** (G/S)
Delta vs canonical: 07 adds "Correct condition and operating limits" and the explicit release action; 04 adds "Required repetition and reason for this run now", "Actual weather/environment... state", "Preconditions complete", and splits blue/red configurations.

Variant B (13 §3.1 — Field Guide Pre-Run Gate, 13 items): Correct Test Card/version. / Correct run ID. / Correct configuration. / Correct threat profile. / Independent variable identified. / Controls verified. / Ground truth healthy. / Mandatory feeds healthy. / Time synchronization verified. / Calibration valid. / Range/safety ready. / Abort criteria understood. / Expected evidence stated.
Delta: adds "Independent variable identified", "Abort criteria understood", "Expected evidence stated" — carry these three onto the canonical form.

Variant C (12 §3.1–3.2 — card-embedded): "Required state" checklist (5 items: paired-invariants unchanged; stale tracks and queues cleared; configuration manifest matches selected A/B state; truth/sensor/adapter/C2/environment/run log healthy; clock offset within measure limit) and "Run-specific hold conditions" (hold if any true: configuration state unknown; truth or common time not healthy; queues or tracks from prior run remain; threat route/altitude/speed cannot meet cell tolerance; a required source unavailable). These are card-specific instantiations of the canonical check; the card builder emits them into card sections "Required state" and "Hold conditions."

Also related: Field Guide 6 execution-prep sequence (13 §6.6): confirm card/version; confirm customer question; freeze intended configuration; verify participant responsibilities; verify range/safety constraints; verify data-path readiness — then configuration check, calibration, time sync, dry run ("Do not quietly convert a dry run into scored evidence"), then live run.

#### 1.4.2 Run initiation sequence (04 §3.3) — use the site-approved words; ordered:
1. The test conductor states card ID, version, run ID, purpose, and expected duration. (V)
2. Each role reports ready or not ready. (G per role)
3. The run logger records the ready state and time. (V)
4. The data monitor confirms recording and source health.
5. The ground-truth operator confirms truth recording.
6. The safety authority confirms the operating area and safety state.
7. The test conductor authorizes red and blue to enter the initial state.
8. The test conductor makes the approved start call.
9. The run logger records the authoritative start time. (V)
10. The procedure begins exactly as written.

Rule: do not start recorders at the same instant as the active event; use the pre-event margin defined by the card.

---

### 1.5 In-run checklists and duty lists

#### 1.5.1 In-run duty lists (04 §3.4) — continuous during the run:

**Test conductor:** keeps the approved sequence; makes required phase-transition calls; prevents coaching, helpful tuning, or unapproved resets; controls pauses and restarts; maintains communications discipline.

**Run logger time-tags (V, each with time):** start and stop; threat launch and recovery; phase transitions; operator calls and actions; system alerts; track, classification, decision, assignment, effect, and assessment events when called; weather or spectrum changes; data warnings; pauses, deviations, anomalies, aborts, and restarts.

**Data monitor watches:** required source presence; update rate and packet loss; ground-truth health; clock offset or drift; storage and network health; identifier mapping; data-quality stop limits.

**Deployment strategist:** guards the variable plan; confirms that the run still serves the stated purpose; records evidence-relevant observations; does not direct technical troubleshooting during the active run.

Authority rules (04 §1.6): only the test conductor controls the run sequence; any authorized person may call the approved safety stop; the data monitor may call a data hold or stop under the card; the deployment strategist controls evidence release and the next-run decision.

#### 1.5.2 Safety or regulatory stop (04 §3.5) — ordered:
1. Any authorized participant uses the approved stop word.
2. All roles enter the defined safe state.
3. The test conductor acknowledges the stop.
4. The safety authority controls the response.
5. Preserve data and system state when safe.
6. Do not restart until the named authority clears the cause and the card restart criteria pass. (G)

#### 1.5.3 Data-quality or equipment stop (04 §3.6) — ordered:
1. The data monitor or technical lead reports the condition.
2. The test conductor pauses or stops under the card.
3. Preserve all data and state.
4. Record the time, source, symptoms, and last known good point. (V)
5. Determine which measures are affected. (V)
6. Decide whether the run can continue for another valid purpose. (G)
7. Obtain degraded-operation approval when required. (S, conditional)

#### 1.5.4 Procedure deviation response (04 §3.7) — if the procedure differs from the card:
1. Do not edit the card.
2. Complete or stop according to the existing rules.
3. Record the exact difference and time. (V)
4. Identify variables and measures affected. (V)
5. Adjudicate after the run.

#### 1.5.5 Anomaly response (04 §3.8) — use this order:
1. Make the activity safe.
2. Preserve raw data, logs, configuration, physical state, and operator recollection.
3. Record the observation before discussing causes. (V)
4. Separate system fault, test artifact, environmental effect, operator effect, and unknown cause.
5. Quarantine suspect data.
6. Decide whether immediate troubleshooting would destroy evidence. (G)
7. Apply the approved repeat or diagnostic policy.
8. Create an anomaly record.
9. Link all later diagnosis and corrective work.

Rule: do not let a vendor explanation close the anomaly without evidence.

---

### 1.6 Post-run checklists

#### 1.6.1 Run completion (04 §3.9) — ordered:
1. The test conductor makes the approved stop or completion call.
2. Red and blue enter the defined safe or recovery state.
3. Continue recording for the post-event margin.
4. Stop recorders in the written order.
5. Confirm threat and system recovery.
6. Record actual configuration, threat, operators, conditions, and procedure. (V)
7. Save and lock the run log.
8. Collect perishable observations in ten minutes or less. (V)
9. Do not form campaign conclusions in the immediate debrief.

#### 1.6.2 Immediate factual debrief — see §3.7 (debrief guide) for the full merged structure. Prompts here for catalog completeness (04 §3.10, page 04 version — state only): what was planned; what occurred in time order; what differed; what sources recorded; what warnings or failures occurred; what each operator directly observed. Rules: label opinion as opinion; save causal interpretation for analysis.

#### 1.6.3 Post-run data validation (04 §3.11) — before a dependent next run. Gate: run status assignment.
Check:
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

Then assign one run status (G): **Valid** (actual configuration, threat, conditions, procedure, instrumentation, data, and ground truth satisfy all validity rules for the stated measures) / **Conditionally valid** (a known difference limits specific measures, comparisons, or conditions; list allowed and prohibited uses — V) / **Invalid** (a failure prevents the run from supporting its intended measure or hypothesis; preserve the run and reason). Rule: no status means the run is not available for analysis. [CONFLICT: status enums vary — 04 §1.8 gives 3 states; 07 §4.8 run record gives `valid | conditionally valid | invalid | pending`; 13 §1.14 Field Guide gives `valid; valid with limitation; invalid; pending adjudication`; 12 §4.2 card-level preliminary-use enum gives `usable | limited | repeat | valid failure`. Adopt the 4-state `valid | conditionally valid | invalid | pending` for the run record, with 12's 4-state enum as the card-level *preliminary* use rule before board adjudication, and note "valid with limitation" = "conditionally valid".]

#### 1.6.4 After-each-run quantitative workflow (10 §3.2) — ordered, 9 steps:
1. Check required files.
2. Check truth and source health.
3. Check time and registration.
4. Assign measure-level validity. (G, per measure)
5. Compute run-level measures. (V)
6. Store intermediate values.
7. Compare with thresholds. (V)
8. Record uncertainty. (V)
9. Preserve deviations and anomalies.

#### 1.6.5 Post-Run Gate (13 §3.1) — Field Guide:
- [ ] Intended configuration executed.
- [ ] Threat remained within profile.
- [ ] Required data captured.
- [ ] Ground truth valid.
- [ ] Deviations recorded.
- [ ] Run validity assigned. (G)
- [ ] Observations separated from interpretation.
- [ ] Evidence gap updated.
- [ ] Retest requirement identified.
- [ ] Next test priority assessed.

#### 1.6.6 Deviation process (01 §3.2) — run at time of deviation:
1. Make the activity safe.
2. Record the time and observed difference. (V)
3. Preserve the system and data state.
4. Identify the affected control, measure, or validity rule. (V)
5. Classify the effect as none, bounded, material, or unknown. (enum V)
6. Assign the run status. (G)
7. Decide whether to repeat, analyze with limits, or exclude. (G)

#### 1.6.7 Out-of-tolerance handling (11 §3.4) — if a post-test calibration check fails:
1. Preserve the as-found state.
2. Identify the last known valid check.
3. Bound the affected interval. (V)
4. Identify measures and runs that used the instrument. (V)
5. Estimate the possible effect. (V)
6. Re-adjudicate affected measures.
7. Repeat testing when required. (conditional)
Rule: do not retroactively declare the instrument valid because the result appears plausible.
Variant (10 §3.10, 5 steps): find last known good check → bound affected time → identify affected runs and measures → estimate possible effect → re-adjudicate the evidence. (Subset; same procedure.)

#### 1.6.8 Truth-conflict procedure (11 §3.5) — when truth sources disagree:
1. Preserve both observations.
2. Verify time, frame, calibration, and identity first.
3. Apply the approved precedence or reconciliation rule.
4. Record the conflict and resolution. (V)
5. Propagate remaining uncertainty.
6. Mark the measure unavailable if the disagreement cannot be bounded adequately. (conditional)

#### 1.6.9 Missing-truth procedure (11 §3.6):
- Do not substitute the system under test without approved justification.
- Determine which measures remain possible. (V)
- Mark affected observations missing, censored, ambiguous, or invalid under their definitions. (enum V)
- Preserve diagnostic data.
- Trigger the written fallback or repeat rule.

#### 1.6.10 Per-run data-validity rules, by measure (12 §3.5) — automated + data monitor. A run can support usable warning time only if ALL hold:
- Truth covers the complete opportunity.
- Threat speed, altitude, and route remain inside tolerance.
- Configuration IDs are known.
- Decision-ready and boundary events are reconstructable.
- Object association is unambiguous.
- Common time passes.
- No critical data gap overlaps either event.

Key rule: validity is assigned BY MEASURE, not only by run — a run may remain valid for detection probability but become invalid for latency. Related denominator checklists (09 §3.4–3.5): Valid threat presentation requires ALL of — a unique threat-object or raid identifier; a recorded threat profile and configuration; independent truth for required threat state; entry into the card-defined eligible region; required environmental and operating-condition records; no validity failure affecting the measure. Eligible detection opportunity requires ALL of — sensor in approved configuration and declared available; required truth covers the complete eligibility interval; threat satisfies profile and condition bounds; required instrumentation and time alignment within tolerance.

---

### 1.7 Day-end checklists

#### 1.7.1 End-of-day procedure (04 §3.12) — ordered:
1. Reconcile every planned and actual run.
2. Confirm a status and reason for every run. (G per run)
3. Complete end-of-day calibration and clock checks.
4. Copy data to two approved locations.
5. Verify copy integrity and access.
6. Secure classified, CUI, proprietary, or controlled data.
7. Update configuration, maintenance, consumables, battery, and spares status. (V)
8. Hold the run-validity board.
9. Update evidence gained, gaps, risks, and anomalies. (V)
10. Re-rank the next-day run list.
11. Issue all approved card or plan changes.
12. Brief the next day's first-run conditions.
13. Secure the site and equipment.

#### 1.7.2 Daily evidence review — CANONICAL: 07 §3.4 (ordered agenda, run in this sequence at end of each test day). Gate: next-day plan, approvals, and briefing.
1. Run accounting: attempted, valid, conditional, invalid, and pending. (V counts)
2. Data state: complete, missing, conflicting, or quarantined. (enum V)
3. P1 measure state. (V)
4. Hypotheses that gained or lost support. (V)
5. New anomalies, limits, and failure boundaries. (V)
6. Matrix coverage and minimum valid samples. (V)
7. Questions answered, partial, and open. (V)
8. Decision uncertainty reduced and remaining. (V)
9. Planned runs now redundant. (V)
10. Candidate next events and decision value. (V)
11. Selected next event and rationale. (G + V)
12. Card, run-list, configuration, or schedule changes. (V)
13. Required approvals and briefing. (S)
14. Minimum viable plan for the next day. (V)

Variant A (05 Part H — fixed 5-step sequence with sub-questions): 1. Reconcile evidence (which runs are valid, conditional, invalid, or pending; which P1 measures are available; which source or method problems remain). 2. Update hypotheses (which gained or lost support; which competing explanations remain; what unexpected behavior appeared; is it repeatable and mission-relevant). 3. Update the coverage map (which matrix cells meet the minimum valid sample; which cells remain empty or thin; which planned events are now redundant). 4. Update decision uncertainty (what can the customer now know; what remains decision-critical; which uncertainty can no longer be resolved in the current campaign). 5. Select the next action — choose exactly ONE of nine options: execute the next issued card; repeat for validity or stability; isolate one variable; repair and verify the evidence chain; revise a threat or condition within the approved policy; introduce a new diagnostic card; stop a low-value line; end testing for sufficiency; end testing for futility or resource limit.

Variant B (13 §3.11, QtM 07 — 4 steps): adjudicate available evidence → update hypotheses and uncertainty → identify decision-critical gaps → select the next event under the approved adaptation policy (options: repeat the run; change one variable; change the configuration; add or repair instrumentation; modify the threat profile; isolate a component or interface; stop a low-value line; expand into a newly identified failure boundary; end testing for sufficiency or futility). Selection rule: maximize information gain and decision value while preserving necessary comparability.

Variant C (10 §3.3 — quantitative items): count attempted, valid, conditional, invalid, and pending runs; check P1 measure coverage; check minimum valid samples by matrix cell; review variability and worst valid cases; review missing, unknown, and censored results; update competing explanations; select the next event under the approved adaptation policy.

Variant D (13 §3.1 — Field Guide Daily Closeout Gate, 9 items): Each operational question updated. / Invalid runs excluded appropriately. / Unexpected results adjudicated. / Missing data documented. / Uncertainty recorded. / Remaining evidence gaps ranked. / Next-day cards versioned. / Configuration changes recorded. / Customer aligned on what is known and unknown.

Variant E (13 §3.15, Corpus 05 daily replanning): add authenticated runs to the status display, linking each to its IDSK/matrix cell → complete interim analysis, apply sequential-design stop or augment rules → identify the largest evidence gaps, select runs that reduce them most → build the next test-card set within the approved plan → record every departure from the plan. Rule of thumb: run order, replication, and factor levels can usually change inside an approved matrix; new conditions or objectives usually require new approval.

Merge intent: the 07 14-item agenda is the canonical screen; wire item 1 to the run-accounting rollup, item 6 to the coverage map, items 10–11 to the adaptive priority score (Field Guide: decision importance × uncertainty reduction × likelihood of valid evidence ÷ time/cost/burden, H/M/L), and item 11's selection to the 9-option action list from Variant A. Item 11 generates an Adaptation record when it changes the plan.

#### 1.7.3 Run-validity board review (05 §3) — held end of each day and whenever new data changes a prior decision. Participants: deployment strategist; test conductor; data lead; analysis lead; system or range specialist as needed; safety authority when safety evidence is involved.
Review items (assessed per run):
- Planned versus actual state.
- Configuration identity.
- Threat and condition fidelity.
- Procedure compliance.
- Ground-truth and source health.
- Data completeness and time quality.
- Deviations and anomalies.
- Independence and comparison integrity.

Recorded outputs (V/G/S): final status; measures allowed; comparisons allowed; limits; repeat decision; dissent; approver and time. Versioning: a changed status creates a new adjudication version; preserve the prior decision and reason. Corpus 05 rules (13 §3.15): classify every run on the same day; do not delete invalid data — flag it and preserve raw data; the authenticated data set is a flagged view of the raw data; a standing decision group (vendor, test conductor, government representative, analyst) adjudicates; keep failure responsibility separate from data validity (separate scoring conference; incident classes: system fault, no-test event, crew error, other).

#### 1.7.4 Evidence intake checklist (05 §3) — per run; data/analysis staff. Gate: only runs with a recorded validity status may enter the analytical pipeline.
1. Verify the run evidence package.
2. Confirm card, run, configuration, threat, condition, operator, and method identifiers.
3. Confirm included measures and prohibited uses.
4. Register missing, corrected, duplicate, or conflicting data. (V)
5. Preserve the raw package.
6. Create a versioned analysis input manifest. (V)
7. Record the analytical code, configuration, and environment. (V)
Rule: do not let quick-look files become the authoritative analytical source.

#### 1.7.5 Analytical quality-control checklist (05 §3) — before metric production:
- Verify schemas and units.
- Verify coordinate transformations.
- Verify time alignment.
- Verify object and track correlation.
- Verify inclusion and exclusion rules.
- Verify missingness labels.
- Test code against a known case.
- Review a sample manually.
- Compare independent calculations for P1 measures.
- Record software, package, and parameter versions. (V)

#### 1.7.6 Correction checklist (05 §3) — for every correction:
- Preserve the source value.
- Record the corrected value. (V)
- State the rule and reason. (V)
- Identify the person and time. (V)
- Assess effect on results. (V)

#### 1.7.7 Preapproved adaptation rules (12 §3.4) — day-of conditional logic (seed example set; each campaign defines its own):
- IF required truth, configuration, or timing fails THEN repeat the run.
- IF a handoff failure appears twice in the same geometry THEN add one diagnostic pair.
- IF the observed warning margin is within ±10 seconds of zero THEN add one boundary cell.
- IF the minimum valid sample exists and more runs are unlikely to change its interpretation THEN stop that cell.
- ALWAYS preserve at least eight Configuration B opportunities for final confirmation.
- NEVER use an exploratory diagnostic run as confirmatory evidence.
Rule: keep each adaptation inside an approved rule and preserve the original and revised run lists.

#### 1.7.8 Run-ordering rules (12 §3.3) — schedule generator constraints (seed example set):
- Pair A and B within the same day and weather block.
- Reverse pair order across blocks.
- Do not change altitude and azimuth at the same moment when the result would be difficult to diagnose.
- Clear queues and stale tracks before each run.
- Require a full configuration check after every A/B switch.
- Hold confirmatory opportunities until screening identifies the final core condition.
- Separate exploratory augmentation from confirmatory evidence.

---

### 1.8 Analysis and adaptive checklists (cross-day; run at day-end or campaign level)

#### 1.8.1 Causal diagnosis checklist (05 §3) — for every consequential failure or anomaly:
1. Define the observation with time, configuration, condition, and source. (V)
2. List candidate causes across component, interface, configuration, operator, environment, threat, instrumentation, data, and method. (9-domain enum)
3. Identify evidence expected under each cause. (V)
4. Identify evidence that can distinguish causes. (V)
5. Check existing records before adding a live run.
6. Reproduce the effect when safe and valuable. (conditional)
7. Change one discriminating factor when possible. (conditional)
8. Record the result. (V)
9. Classify root cause as confirmed, supported, plausible, contradicted, or unknown. (enum G)
10. State corrective action and verification test. (V)
Rule: "A vendor statement may be evidence about mechanism. It is not proof of root cause."
Variant (13 §3.11, QtM 07 — 7 steps, same loop; root-cause classes `confirmed | supported | plausible | unknown`). [CONFLICT: 05 adds a fifth class `contradicted` to the root-cause enum; 13 omits it. Adopt the 5-class enum.] Rule (13): do not present a hypothesized root cause as a confirmed finding.

#### 1.8.2 Sufficiency stop checklist (05 §3) — stop a line when ALL apply:
- The approved minimum evidence exists.
- Remaining uncertainty is within the accepted limit.
- Additional runs are unlikely to change the decision.
- Required threat, condition, and configuration coverage exists.
- The evidence authority accepts the level of confidence. (S)

#### 1.8.3 Futility stop checklist (05 §3) — stop a line when ANY applies:
- Required systems, truth, conditions, or authorities cannot be restored.
- Remaining events cannot support the intended conclusion.
- The likely information gain does not justify safety, time, or cost.
- A design flaw requires a new campaign.
Rule: record the decision and the evidence gap left open. (V)

#### 1.8.4 Missingness bias questions (10 §3.9):
- Did data fail more often during difficult conditions?
- Were invalid runs concentrated in one configuration?
- Did unknown outcomes occur more often after failures?
- Would a different treatment of missing data change the decision?

#### 1.8.5 Common quantitative errors — reject these 21 patterns (10 §3.7); implement as analysis/report lint:
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

#### 1.8.6 Finding review questions (10 §3.6) — strategist, before approving a finding:
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

#### 1.8.7 Quantitative analysis gate (09 §3.3) — a quantitative finding is ready only when all pass:
- The experimental unit and dependence structure are correct.
- Planned, valid, invalid, missing, and censored evidence is accounted for.
- The interval answers the stated question.
- The sample rationale and stopping rule were not chosen after the outcome.
- Condition-specific results and material interactions are visible.
- Measurement, sampling, operational, and model uncertainty are distinguished.
- The result can be reproduced from the retained manifest and code.
- Prohibited extrapolations are stated.

#### 1.8.8 Invalid-run preservation checklist (09 §3.8) — keep invalid runs for:
- Test-process learning.
- Safety evidence.
- Anomaly diagnosis.
- Integration defects.
- Planning the repeat.
Rule: do not include them in a performance denominator unless the approved method explicitly defines that use.

#### 1.8.9 Evidence "do not treat" guard (08 §3.3) — interpretation lint on conclusions:
Do not treat:
- A reported field adaptation as universal doctrine.
- A doctrinal sequence as proof that a fielded system performs it.
- A vendor architecture as the required operational architecture.
- A single successful intercept as end-to-end mission effectiveness.
- A component measure as proof of the complete defensive chain.
- A fixed-site result as evidence for maneuver.
- A scripted presentation as evidence against an adaptive threat.
- An exercised command relationship as an asserted authority outside the test.

---

### 1.9 Closeout checklists

#### 1.9.1 Completed-campaign synthesis (05 §3) — before final findings:
1. Freeze the included-run manifest.
2. Freeze analytical code and parameters.
3. Reproduce every P1 result from retained data.
4. Conduct independent review of critical calculations.
5. Assess missingness and exclusion bias.
6. Reconcile conflicting sources.
7. Compare results across configurations, threats, conditions, operators, and procedures.
8. Identify performance boundaries and trade-offs. (V)
9. Assess mission-thread consequences. (V)
10. Define evidence life and staleness triggers. (V)
Variant (10 §3.4 — 8-item campaign-completion workflow; same content minus items 9–10's phrasing: freeze manifest; freeze code and parameters; reproduce every P1 result; conduct independent review; assess missingness and exclusion bias; reconcile conflicting sources; compare configuration, threat, condition, operator, and procedure effects; state performance boundaries and trade-offs.)

#### 1.9.2 Analysis-complete gate (05 §3) — verbatim conditions. Analysis is complete only when:
- every decision-relevant result is reproducible,
- every finding is traceable to adjudicated evidence,
- uncertainty and alternatives are explicit,
- applicability is bounded, and
- every remaining gap has a stated effect on the customer decision.

#### 1.9.3 Decision evidence package checklist (07 §3.5) — evidence delivery gate; every item confirms package content (maps to the 20-section template in §3.8 of this document):
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
- [ ] Method review completed. (S)
- [ ] Analytical review completed. (S)
- [ ] Evidence acceptance recorded. (S)

#### 1.9.4 Independent-reviewer test (06 §3) — package review before acceptance; run by an independent reviewer, who must be able to answer:
- What happened?
- How was it measured?
- Which runs support it?
- Which exact conditions apply?
- How uncertain is it?
- What must not be inferred?
- What action follows?
Variant (13 §3.12, QtM 08 — 6 questions): What was observed? How was it established? Under which exact conditions is it true? With what confidence and limitation? What must not be inferred? What decision implication follows?

#### 1.9.5 Architecture and mission assessment checklist (06 §3) — feeds package section 11. Assess:
- Best-performing configuration by threat and condition.
- Warning, decision, assignment, effect, and assessment time budgets.
- Coverage gaps.
- Interface and semantic failures.
- Operator workload and procedural effects.
- Single points of failure.
- Resilience and recovery.
- Trade-offs among performance, complexity, cost, safety, spectrum, sustainment, and mission risk.
- Whether one component compensates for another's weakness.
- Residual threat after the tested effect.
Rule: separate observed architecture behavior from assumed behavior outside the evaluated boundary.

#### 1.9.6 Delivery and custody checklist (06 §3) — before delivery; campaign lead / data custodian:
1. Confirm the recipient list and need to know.
2. Mark each file correctly.
3. Confirm permitted vendor and comparative-result content.
4. Confirm checksums or custody records when required. (conditional)
5. Confirm delivery media and encryption.
6. Test that the recipient can open the package.
7. Record transfer and receipt. (V)
8. Record corrections as new versions.
9. Archive the accepted version.

#### 1.9.7 Closeout and regression checklist — CANONICAL: 07 §3.6 (18 items). Gate: campaign status → Closed.
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
- [ ] Campaign status changed to closed. (G)

Variant A (06 §3 — campaign closeout checklist in 4 groups): Deliverables (deliver all contractual products; record acceptance, reservations, and open items; transfer actions to named owners); Data and knowledge (archive raw and processed data; archive code, schemas, configurations, methods, cards, logs, findings, and approvals; verify analysis can be reproduced; verify tested configuration can be reconstructed; apply retention and deletion rules; review permissions); Operations and property (restore sites and networks; return systems, instruments, media, tools, and credentials; close damage, maintenance, safety, security, and property records; transfer unresolved items); Commercial and customer (confirm final invoice and contract actions; record customer outcome and next decision; record approved vendor feedback). Delta: adds the commercial/customer group — carry those three items onto the canonical list.

Variant B (13 §3.13, QtM 09 closure checklist): same three non-commercial groups phrased as deliverables-and-acceptance / data-and-knowledge / operations-and-property, plus vendor feedback and comparative-result control.

#### 1.9.8 Closeout gate (06 §3) — the campaign is closed only when:
- The customer has the accepted evidence and limits.
- Every action has an owner.
- All data and records have the correct custody.
- Sites and property are restored.
- Lessons and assets have owners.
- Future changes map to a defensible regression decision.

#### 1.9.9 Reuse-harvest steps (06 §3) — per asset:
1. Remove campaign-specific identifiers.
2. Preserve validity limits.
3. Add purpose and use instructions. (V)
4. Add known edge cases. (V)
5. Run the cold-reader test.
6. Assign owner and review date. (V)
7. Version it into the controlled library.
8. Add it to the next-campaign start pack.
Asset types (06 §1): decision and discovery prompts; question and hypothesis patterns; measure definitions and calculation code; threshold rationales; threat and condition profiles; test cards; data schemas and adapters; data-quality rules; range and authority patterns; checklists; analysis modules and report sections; failure modes and corrective actions. Reusable asset metadata block (13 §1.21, 14 fields): Asset ID; Version; Originating campaign; Mission context; Applicable configurations; Threat scope; Required inputs; Method; Assumptions; Validity limits; Known failure modes; Dependencies; Owner; Last validated date/configuration.

#### 1.9.10 Change-impact and regression process (06 §3) — post-baseline, on any relevant change:
1. Identify the changed configuration item or assumption.
2. Link it to affected interfaces, measures, findings, and decisions.
3. Classify the change mechanism. (V)
4. Assess whether prior evidence remains valid, narrows, or fails. (enum G)
5. Select the least costly evidence that restores confidence.
6. Obtain evidence-authority agreement. (S)
7. Execute the regression plan.
8. Update the evidence baseline.
Change-impact outcome enum (exactly one): No effect on accepted findings / Applicability narrows / Analysis-only review required / Simulation or bench evidence required / Limited live regression required / Full reevaluation required.

#### 1.9.11 C-UAS regression assessment checklist (06 §3, worked example) — if the prior baseline established detection, stable tracking, C2 handoff, interceptor assignment, and engagement timing, assess the changed system against:
1. Detection range.
2. False-alarm rate.
3. Track continuity.
4. Track-to-ground-truth accuracy.
5. Radar-to-C2 handoff.
6. Total engagement time.
7. Performance under RF or GPS disruption.
Rule: a component-level pass does not establish that the end-to-end mission thread remains supported; cover the affected interfaces and mission thread, not only the changed component.

---

### 1.10 Continuous standards and hard gates

#### 1.10.1 The Deployment Strategist's Standard (13 §3.2) — nine questions answerable at any point; render as a live traceability health dashboard:
1. What customer decision are we supporting?
2. What operational question are we answering now?
3. What exact configuration is under test?
4. What threat and conditions are represented?
5. What hypothesis does this run examine?
6. What evidence will answer it?
7. Is the evidence valid?
8. What can and cannot be concluded?
9. What should we test next, and what should TestOS retain?
If any answer is unclear, the campaign has lost test traceability.

#### 1.10.2 Ten continuous control questions (13 §3.3):
1. What exact customer decision are we supporting?
2. Who has authority to make it?
3. Who must accept the evidence for it to matter?
4. What uncertainty currently prevents or weakens the decision?
5. What evidence would resolve that uncertainty?
6. Does the next planned activity generate that evidence?
7. Are configuration, threat, conditions, method, and data controlled and traceable?
8. Are we operating safely, legally, and within Valkryn's authority?
9. What did we learn, and what is now the highest-value next test or action?
10. How will this campaign make the next comparable effort faster, cheaper, and less bespoke?

#### 1.10.3 Pocket rules (07 §6) — 11 hard validation gates, verbatim; each blocks the second clause absent the first:
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

#### 1.10.4 Minimum learning standard (10 §3.11) — strategist readiness (training checklist; not a run-time gate). The strategist is ready when the strategist can: build a complete measure definition; calculate a probability, rate, latency, duration fraction, error, and mission margin; explain experimental unit and independence; explain randomization and blocking; explain confidence, credible, prediction, and tolerance intervals; read a Wilson interval; plan a simple sample for one proportion; inflate attempts for expected invalid evidence; identify when censoring needs time-to-event analysis; identify when clustering needs a mixed or hierarchical model; explain why exploratory and confirmatory evidence stay separate; review an uncertainty budget; verify run and measure validity; explain a bounded finding in plain language.

---

## 2. The canonical test card

### 2.1 The five source templates

| Source | Structure | Count |
|---|---|---|
| 04 §4.1 (manual page 04, Part A) | Flat ordered field list | **20 fields** |
| 07 §4.7 (templates page) | Numbered titled sections | **17 sections** |
| 13 §4.1 (Field Guide 5, Standard Test Card) | Flat labeled fill-in template with embedded Change Record block | ~24 labels in 15 groups |
| 11 §4.1 (union of the 5 worked cards) | Structured sections ending in Allowed/Prohibited conclusion | **16–17 sections** (varies by card type) |
| 12 §4.1–4.2 (lean-card policy + issued card TC-J401-EW-COMP-01-v1.0) | Lean execution card; everything else by record link | **9 kept blocks** + 7 rendered sections |

Supplementary content requirements folded in: 08 §4.1 (19 threat-content items every card must state), 08 §4.2 (mission-thread card content + minimum time-tag chain), 13 §1.13 (QtM 06 pre-run card: Purpose / Controlled state / Authorization-and-validity blocks), 04 §4.5 (generated-card content list — 18 items pulled from design, no re-entry).

### 2.2 Source disagreements

[CONFLICT: **Section count and granularity.** 04 has 20 fields; 07 has 17 sections; 11's worked-card union has 16–17; 13's Field Guide card is a flat form; 12's lean card keeps only 9 blocks. The differences are packing, not content: 07 merges 04's fields 15+16 (stop conditions + restart/degraded rules) into one "Stop and restart" section, and merges 04's field 19 (blinding and information-control rules) into its section 6 "Threat state"; 07 splits 04's field 1 into Control and keeps Traceability separate (04 fields 1–2 = 07 sections 1–2 unchanged).]

[CONFLICT: **Sections that exist in only some sources.** Allowed conclusion / Prohibited conclusion appear as top-level card sections only in 11 (and as "Permitted and prohibited conclusions" in 08 §4.1); 04 carries prohibited uses on the run record instead; 07 carries them in the Run record §4.8. Event marks (tap-button vocabulary) and the Preliminary use rule (usable | limited | repeat | valid failure) appear only on 12's issued card. Expected result exists in 04 (field 14), 07 (section 13), 13 (EXPECTED RESULTS), 11 (Card 1 only). Preconditions is explicit in 04 (field 12), 07 (section 11), 13 (PRECONDITIONS), but in 11 only Card 1 has it.]

[CONFLICT: **Change record on the card.** 13's Field Guide card embeds a CHANGE RECORD block (Change ID / Date/time / Previous value / New value / Evidence/reason / Responsible owner) and RUN NUMBERS on the card itself. 04 §4.4 doctrine says the issued card is frozen and never edited; changes route through separate CHG records issued end-of-day. Resolution: the card template carries a read-only change-history rendering of linked CHG records and a read-only list of RUN IDs executed against the card version, never editable fields.]

[CONFLICT: **Lean policy vs full-section templates.** 12 §4.1 explicitly moves off the card: full customer background, complete system manifests, full threat-fidelity analysis, full measure formulas, full statistical plan, full instrumentation dictionary, general safety and emergency plan, general authority and contact lists, full report language. 07/04/11 templates include measure thresholds, data/truth plans, and authorities as card sections. Resolution: the canonical card keeps the section skeleton of 07/04 but populates each section by reference (record ID + only the values needed to execute or validate), per 04's card-writing rule "Reference canonical records instead of copying uncontrolled values" and 12's retention criterion "keep only information that can change execution, evidence validity, or immediate interpretation." Print can expand references into a field-pack appendix.]

[CONFLICT: **Threshold display.** 13 §2.3: absent a customer-approved threshold, suppress pass/fail and render characterization output instead (estimate, interval, variability, trades, validity limits); "customer operational pass/fail threshold is an execution blocker until customer-approved" appears on the notional card. 04/07 simply include "Measures and thresholds". Adopt 13's conditional rendering.]

### 2.3 Canonical unified card — section order

One card entity, 19 sections. Spine = 07's 17 sections in 07's order (which preserves 04's field order); +2 sections adopted from 11 (Allowed/Prohibited conclusions) and 2 sub-blocks adopted from 12 (Event marks inside section 10; Preliminary use rule inside section 17). Status enum: `draft | approved | issued` (11 §4.1) within the record-header lifecycle (01 §1.3).

| # | Section | Fields (verbatim origin) | Auto-fill source | 04-field map |
|---|---|---|---|---|
| 1 | **Control** | Card ID, title, version, status, owner, approvers, effective time (07 §4.7-1). Print as a control ribbon: Card / Run (generated at release) / Matrix cell / Configuration / Threat / Condition IDs (12 §4.2) | Controlled-record header (01 §1.3); Run ID minted at release | 1 |
| 2 | **Traceability** | Decision, question, claim, hypothesis, measure, and matrix-cell IDs (07 §4.7-2) | DEC, Q/OQ, CLM, HYP, M records; matrix cell from test matrix | 2, 4 (cell) |
| 3 | **Purpose / Intent** | One sentence that states why the run exists (07 §4.7-3); plus from 13 §1.13: why this run is the highest-value next event; result that could change the customer decision or campaign plan; plus Prediction and Changed factor (12 §4.2 Intent block: question, prediction, changed factor, primary result, secondary results) | Q + HYP + prediction records; priority score from adaptive queue | 3 |
| 4 | **Planned repetition** | Repetition number, minimum valid sample, and reason for run priority (07 §4.7-4); plus from 11: valid opportunities required, current repetition/block, order (randomized or restricted), blocking, invalid-run allowance | Quantitative design record; sample-size calc; randomization schedule | 4 |
| 5 | **System state** | Boundary, configuration ID, systems, interfaces, operators, procedure, and training (07 §4.7-5) | CFG baseline record (28 fields); roles from role assignments | 5, 8 |
| 6 | **Threat state** | Threat ID, exact profile, red-control variables, and blinding (07 §4.7-6); expand with the 19 threat-content items of 08 §4.1 (representation class; fidelity limitations that affect the run; exact red initial state; red operator and information state; red-controlled variables; fixed variables; bounded-adaptive choices; prohibited actions; route, geometry, speed, altitude, and timing tolerance; emission, control, navigation, and autonomy state; raid composition and coordination; truth and telemetry sources; safety and realism bounds; red launch, start, phase, stop, abort, and recovery calls; invalidating red deviations; data required from red; reset required before repeat; permitted and prohibited conclusions) | THR record (29 fields) + fidelity grid; blinding from 04 field 19 | 6, 19 |
| 7 | **Condition** | Condition ID, weather, terrain, RF, network, background, and limits (07 §4.7-7) | COND record | 7 |
| 8 | **Variables** | Independent variables, held controls, and recorded covariates (07 §4.7-8) | Factor classification record (02 §1; 04 §1.5) | 9 |
| 9 | **Measures** | Measure IDs, thresholds, objectives, and expected evidence (07 §4.7-9). Threshold rendering conditional on approved threshold source (13 §2.3) | Measure registry (M records); threshold records | 10 |
| 10 | **Data and truth** | Sources, fields, truth, calibration, common time, tolerances, monitoring, and fallback (07 §4.7-10); plus **Event marks** sub-block: the tap-button event vocabulary for this card (12 §4.2, e.g. threat enters eligibility region; first valid detection; first stable track; qualifying source track; usable C2 track; operator decision; assignment; represented effect-ready event; protected-boundary crossing; run complete) and the minimum time-tag chain for integrated runs (08 §4.2) | Measure-to-data map (03 §1.1); ground-truth plan (11 §1.1); measure start/stop events generate event marks | 11 |
| 11 | **Preconditions** | Authorities, area, system, threat, people, safety, data, and communications (07 §4.7-11); render as the card "Required state" checklist (12 §3.1 pattern) | Authority tracker (03 §1.9); day-start results | 12 |
| 12 | **Procedure** | Numbered steps, one action per step, named role, and observable completion (07 §4.7-12). Card-writing rules (04 §4.2): include recorder start and stop steps; include the exact start, stop, pause, and abort words approved for the site; mark steps that can silently invalidate the run; state pre/post-event recording margins; state the required reset before a repeat | Step editor; site words from campaign plan | 13 |
| 13 | **Expected result** | Nominal behavior and known expected artifacts (07 §4.7-13) | HYP prediction | 14 |
| 14 | **Stop and restart** | Safety, regulatory, equipment, data, and security triggers; safe state; restart authority (07 §4.7-14); plus run-specific hold conditions (12 §3.2). General safety/range stops stay in the active field plan, referenced not repeated (12 governance hook) | Stop/hold/repeat/adapt rule set (02 §3.1); hazard worksheet abort triggers (03 §1.10) | 15, 16 |
| 15 | **Validity and repeat** | Required conditions, invalidating failures, conditional uses, and reset needs (07 §4.7-15); per-measure validity rules (12 §3.5 pattern) | Measure invalid-when rules (09 §4.1); data-health spec (11 §1.9) | 17 |
| 16 | **Outputs** | Files, run log, observations, quick-look product, status decision, and storage path (07 §4.7-16) | Data-field manifest; storage config | 18 |
| 17 | **Deviation record + Preliminary use rule** | Deviation area: time, actual difference, affected control, validity effect, disposition, and linked change (07 §4.7-17); DEV-### identifiers associated with run, affected measure, and resulting validity decision (13 §4.2); Preliminary use rule enum `usable | limited | repeat | valid failure` (12 §4.2) | DEV records; adjudication board | 20 |
| 18 | **Allowed conclusion** | What the run's evidence may support, bounded to tested configuration/threat/geometry/conditions (11 §4.1) | Derived from design + threat fidelity grid | — |
| 19 | **Prohibited conclusion** | What must not be inferred (11 §4.1; 08 fidelity-derived generalization limits) | Auto-derived permitted/prohibited generalization statements (08) | — |

### 2.4 Auto-fill map (no re-entry rule)

"A card pulls from the design; the user should not enter the same information again" (04 §4.5). Auto-fillable: sections 1–2 (record header, traceability links), 3 (question/hypothesis/prediction), 4 (quantitative design), 5 (CFG), 6 (THR + fidelity), 7 (COND), 8 (factor classification), 9 (measure registry), 10 (measure-to-data map + ground-truth plan + event vocabulary), 11 (authority tracker), 13 (prediction), 14 (rule sets + hazard worksheet), 15 (measure validity rules), 18–19 (fidelity-derived generalization bounds). User-authored per card: section 3's one-sentence purpose, section 12's procedure steps, card-specific hold conditions, and any card-specific event marks. Placeholder rule (11): every bracketed placeholder must resolve to a controlled record before status can advance to `issued` (gate §1.1.17).

### 2.5 Print layout intent

- One card per run type; tablet-first, print-equivalent. Sections in the fixed order above; section 12 renders as a numbered step table (step #, action — one per step, role, observable completion, flags: silently-invalidates-run, recorder start/stop) (07 §4.7 layout note; 04 §4.2).
- Control ribbon across the top (12 §4.2): Card ID+version, Run ID, matrix cell, CFG, THR, COND.
- Lean rendering: linked records show ID + execution-critical values only (12 §4.1). Card users: conductor, operator, red team, data monitor, customer observer.
- Event marks render as large tap targets on tablet and as a tick-box event table on paper.
- Standard header block (01 §1.3) prints on every card.
- The Field Guide flat layout (13 §4.1) is the minimal print fallback: TEST CARD ID / VERSION / CAMPAIGN / QUESTION ID(S) / CUSTOMER QUESTION / TEST PURPOSE / HYPOTHESIS / SYSTEM CONFIGURATION / CONFIGURATION BASELINE ID / THREAT PROFILE / THREAT PROFILE VERSION / PRECONDITIONS / INDEPENDENT VARIABLES / CONTROLLED VARIABLES / COVARIATES / MEASURES / MEASURE DEFINITIONS / DATA SOURCES / GROUND TRUTH / TIME-SYNCHRONIZATION REQUIREMENT / PROCEDURE 1..n / EXPECTED RESULTS / PERFORMANCE-DECISION THRESHOLDS / SAFETY CRITERIA / ABORT CRITERIA / DATA-QUALITY CHECKS / REQUIRED OUTPUTS / RUN NUMBERS / DEVIATIONS / CHANGE RECORD.
- Seed fixtures: notional card `TC-CUAS-SOS-EWBUF-001` v1.0 (13 §4.2, with its 15-step procedure and 6 measures), issued card `TC-J401-EW-COMP-01-v1.0` (12 §4.2), and the five worked cards `TC-CUAS-SEN-CHAR-001`, `TC-CUAS-C2-HANDOFF-001`, `TC-CUAS-EW-SOFTKILL-001`, `TC-CUAS-DEF-INTERCEPT-001`, `TC-CUAS-SAT-RAID-001` (11 §4). All are explicitly illustrative, not campaign reconstructions.

### 2.6 Card lifecycle and immutability (all sources agree)

Draft → per-discipline reviews → cold-reader pass → dry-run pass → approved → issued (frozen) → run complete (04 §4.3, 11 §3.10–3.11). One issued card controls one run type; one run gets one immutable run ID; differences become DEV records; the team never edits the card to match what occurred; card version changes only when the planned method changes; a deviation that becomes the intended method requires a new card version before the next execution (04 §4.4; 13 §1.1, §6.9).

---

## 3. Other print/screen artifacts

### 3.1 Day dashboard (run sheet)

Merged from 04 §4.7 (canonical) and 12 §4.3. Tablet screen + printable day sheet. Shows:
- Day objective (04) / Today's question and target evidence (12).
- Questions being addressed (04).
- Test coverage completed (04) / Valid evidence by matrix cell (12).
- Current environmental conditions (04).
- Current system configuration (04, 12).
- Current threat and condition (12).
- Available assets (04).
- Planned and completed runs (04) / Planned and completed pairs (12).
- Valid, questionable, and failed runs (04).
- Open gaps (12).
- Remaining priority runs (04) / Next three priority runs (12).
- Estimated time remaining (04, 12).

### 3.2 Current-run screen

Merged from 04 §4.7 (canonical) and 12 §4.4. Shows ONLY:
- Card and run identifiers.
- Purpose.
- Hypothesis and prediction (04) / Purpose and prediction (12).
- Current configuration.
- Current threat and condition (04) / Threat profile (12).
- Changed factor (12).
- Procedure (04) / Procedure step (12 — current step highlighted).
- Role assignments (04).
- Required recorders (04) / Required sources and health (12).
- Data-source health.
- Large event controls (04) / Large event-mark buttons (12).
- Deviation and observation entry (12).

**Event controls** (04 §4.7 — each tap creates a timestamp, V):
Start recording / Start run / Mark event / Mark phase transition / Record operator action / Record system response / Add observation / Mark deviation / Mark anomaly / Pause / Stop / Complete run.
Card-specific event marks come from card section 10 (e.g. the 10-mark vocabulary of 12 §4.2). Run-logger time-tag duty list (§1.5.1) defines the always-available generic marks.

### 3.3 Run record and immediate debrief form (07 §4.8 — canonical, 29 fields, orange/execution phase)

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
- Final status: valid, conditionally valid, invalid, or pending. (enum G)
- Allowed measures and comparisons:
- Prohibited uses:
- Repeat recommendation:
- Adjudicators and time: (S)

Planned-vs-actual capture rule (04 §1.7): the app distinguishes planned values from actual values for configuration, threat behavior, weather, route and geometry, operators, procedure, start/stop times, data-source status, deviations, direct observations. Variant (13 §1.14, QtM 06 run adjudication record): planned versus actual sequence; actual configuration, threat profile, operators, and conditions; ground-truth and instrumentation validity; data completeness and quality; procedural, safety, configuration, or method deviations; operator observations and initial technical interpretation; determination valid/conditionally valid/invalid with rationale; measures and hypotheses that may use the run; repeat recommendation and urgency; adjudication authority. The board-level adjudication record adds versioning + dissent (05, §1.7.3 above).

### 3.4 Deviation record (07 §4.9 — canonical, 13 fields)

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
- Approver: (S)

Effect classification enum from 01 §3.2: none / bounded / material / unknown. ID rule (13): `DEV-###`, associated with the run, affected measure, and resulting validity decision; a deviation stays attached to the original card and run.

### 3.5 Anomaly record (07 §4.10 — canonical, 14 fields)

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
- Root-cause status: (enum: confirmed | supported | plausible | contradicted | unknown)
- Corrective action:
- Verification test:
- Owner and status:

First-response classification card (13 §4.6) — do not immediately call an unexpected result a system failure; classify: System behavior? / Test infrastructure? / Threat deviation? / Operator action? / Data artifact? / Unknown? Full cause taxonomy for diagnosis (05): component | interface | configuration | operator | environment | threat | instrumentation | data | method. Corpus 05 (13 §3.15): open a test incident report for each anomaly before the next run.

### 3.6 Change / adaptation record

Canonical: 07 §4.11 Change record (14 fields):
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
- Required approvals: (S)
- Effective time:
- Briefing completed:
- Result after change:

Variants: 05 Adaptation record (11 fields — adds "Gap to resolve", "Expected decision value", "Result after execution"); 13 §1.15 QtM 07 version (adds "applicable approved change class"); 13 §1.15 Field Guide 8 version (Change ID; triggering evidence; original plan; revised plan; reason; question affected; configuration/threat impact; comparability impact; test-card version; timestamp — rule: "Never rewrite history. The old test card remains preserved."); 09 §4.6 Adaptive run selection record (triggering evidence; candidate conditions; expected information gain; comparability effect; new run-list/card version; exploratory vs confirmatory flag). Merge: one CHG entity with the 07 fields + change class + expected decision value + exploratory/confirmatory flag + result after execution.

### 3.7 Debrief guide

Three debrief structures at three time scales; all become guided forms.

**A. Immediate factual debrief** (post-run, within minutes; perishable-observation window ten minutes or less). Canonical merged prompt list:
1. What was planned. (04, 15)
2. What occurred in time order. (04) / What occurred. (15)
3. What differed. (04, 15)
4. What sources recorded / what the instruments recorded. (04, 15)
5. Which sources failed. (15)
6. What warnings or failures occurred. (04)
7. What each operator directly observed. (04, 15)
8. Which result was unexpected. (15)
9. Whether a repeat is needed. (15) (G)
Rules: label opinion as opinion; save causal interpretation for analysis; keep observations separate from explanations; do not form campaign conclusions in the immediate debrief.
Field Guide variant (13 §4.7 — six yes/no questions within minutes): Was the intended configuration executed? / Did the threat execute as planned? / Did required data exist? / Were there deviations? / Is the run valid? / Was anything unexpected observed?

**B. Daily debrief** = daily evidence review (§1.7.2) + daily evidence board (13 §4.4), one row per question:
```
Question
Evidence collected
Current finding
Confidence / uncertainty
Remaining gap
Next action
```
Campaign closeout status per operational question: Resolved / Partially resolved / Unresolved, with the reason stated.

**C. Nine-question after-action debrief** (06 Part I — the standardized campaign debrief; conduct within five working days while details remain current; whole team, facilitated):
1. What created decision value?
2. What produced invalid runs or delay?
3. Which assumptions failed?
4. Which authority or acceptance issue arrived late?
5. Which interface or data failure repeated?
6. Which control was too heavy or too weak?
7. Which work depended on one person?
8. Which task should be standardized, automated, trained, redesigned, or removed?
9. What must change before the next campaign?
Closure rule: assign each improvement an owner, due date, and destination in standard work or product backlog (improvement record: owner, due date, destination enum). Variant question set (13 §3.13, QtM 09 after-action review): What worked, failed, or surprised the team? Which assumptions were wrong? Where did the campaign lose time, quality, or decision value? What required founder or exceptional intervention? Which risks or failure modes were not anticipated? What should be standardized, automated, trained, redesigned, or never repeated? What must change before the next comparable campaign?

**Evidence-language discipline** (13 §4.5) — applies to every debrief and report field; every conclusion receives exactly one category:
- Observed fact (e.g., "The tracking radar dropped the target for 6.2 seconds during Run 47.")
- Analysis (e.g., "The loss coincided with sector transition in three of five valid opportunities.")
- Inference (e.g., "Sector-transition behavior is a plausible contributor to the track loss.")
- Recommendation (e.g., "Conduct a controlled sector-boundary characterization test.")
Do not collapse these into "The radar has a sector-boundary defect." Matching five-level findings ladder (05): Observation → Calculation → Interpretation → Recommendation → Decision; never merge levels. Uncertainty documentation fields (13 §4.5): sample size; run-to-run variability; measurement uncertainty; missing conditions; missing data; invalid runs; confounding factors; degree of operational representativeness.

### 3.8 Decision evidence package (06 §4 — canonical, 20 ordered sections; the customer-facing result document)

Use this order:
1. Decision, owner, alternatives, and deadline.
2. Decision-critical uncertainty.
3. Executive answer and bounded recommendation.
4. Mission, system boundary, and configuration.
5. Threats, conditions, operators, procedures, and range representation.
6. Approved questions, hypotheses, measures, thresholds, and design.
7. Evidence-acceptance conditions.
8. Run accounting: planned, attempted, valid, conditional, invalid, and excluded.
9. Primary findings.
10. Supporting diagnostic findings.
11. Architecture and mission-thread assessment.
12. Uncertainty, limitations, dissent, and unresolved gaps.
13. Claims disposition.
14. Alternatives and trade-offs.
15. Recommended action, restrictions, and residual risk.
16. Retest and evidence-refresh triggers.
17. Raw-to-result reproduction instructions.
18. Data delivery, classification, distribution, retention, and deletion.
19. Action plan.
20. Acceptance record.

Layout intent: fixed section order; executive answer at position 3, before the detailed evidence; provenance and custody sections close the document. Format: reviewed, versioned, marked document with acceptance record; export print/PDF. Auto-fill: section 8 from RUN state rollup; 13 from claim dispositions; 9–10 from FIND records; 6 from design records; 19 from ACT records. Gates: must pass the independent-reviewer test (§1.9.4) and carry method acceptance status, evidence acceptance status, and final approving authority and date. The 18-item checklist (§1.9.3) is the completeness gate over these sections. Assembly variant (13 §4.9, QtM 08 — 9 assembly bullets, same content). Embedded bounded-recommendation record (06 §1): recommended action; evidence strength; exact conditions and configuration; limits and prohibited interpretation; alternatives considered; residual uncertainty and risk; authority that must decide; trigger for reconsideration. Rule: "Valkryn recommends from evidence. The authorized organization decides."

### 3.9 The four review forms (06 Part E) — sequential; shared record fields per review: Reviewers; Comments; Corrections; Dissent; Adjudication; Method acceptance status; Evidence acceptance status; Conditions and reservations; Final approving authority and date.

1. **Configuration-fact review** — vendors and system owners confirm factual configuration, version, and interface details. They do not control conclusions.
2. **Method review** — the evidence authority confirms that the executed method and deviations remain acceptable.
3. **Analytical review** — qualified reviewers check run inclusion, calculations, uncertainty, and finding logic.
4. **Customer decision review** — the decision owner reviews options, risks, and actions.

Rules: dissent entries are append-only ("Do not remove a valid dissent to make the package appear unanimous"); method and evidence acceptance statuses gate the package.

### 3.10 Quick-look artifacts

Two distinct artifacts. [CONFLICT: "quick look" names both a per-run auto-report (minutes; 12 §4.5, 04 §2.2) and a 24-to-72-hour daily report (13 §4.13, Corpus). Keep both, named Post-run quick look and Quick-look report.]

**A. Post-run quick look** (12 §4.5 — auto-report within minutes; canonical field list):
- Threat profile compliance.
- Required files present.
- Configuration match.
- Clock and source health.
- First-detection time and range.
- First-stable-track time and range.
- Usable C2 track time.
- Boundary crossing time.
- Usable warning time.
- Mission margin.
- Whether the paired run remains comparable.
Rule: quick look supports the next-run decision; it does not replace final analysis; quick-look files must never become the authoritative analytical source (05). Generic computed content (04 §2.2): available measures such as detection range, response latency, track duration, track continuity, classification result, intercept result, data completeness, difference from the prediction, difference from the threshold, difference from the comparison baseline. Ends in the 6-option next-run recommendation (04 §5.3, user decides): accept the run for later review / repeat the run / continue to the next condition / hold for missing data / add a diagnostic run / stop because sufficient coverage exists.

**B. Quick-look report** (13 §4.13 — publish within 24 to 72 hours):
- Use only authenticated runs.
- Mark results preliminary and not final scored results.
- Show test-matrix completion.
- Summarize incidents and schedule effects.
- Link each result to its decision and IDSK cell.
Report sequence it opens: quick-look report → test report → analysis report → evaluation report.

### 3.11 Daily evidence review form

Screen/print artifact for checklist §1.7.2: the 14-item agenda as an ordered meeting form with the enums `attempted | valid | conditional | invalid | pending` (run accounting) and `complete | missing | conflicting | quarantined` (data state), the coverage map panel (matrix cells × valid-run counts vs minimum, empty/thin/redundant flags — 05 §4), the daily evidence board rows (§3.7-B), and the 9-option next-action selector. Output block (07 §5): selected next event and rationale; change list; approvals; minimum viable plan for the next day.

### 3.12 Finding record and result report blocks

**Finding record (FIND)** — canonical: 07 §4.12 (26 fields):
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
- Strength: conclusive, directional, insufficient, or not tested. (enum)
- Applies to:
- Does not apply to:
- Assumptions:
- Evidence life and staleness trigger:
- Decision implication:
- Recommended action:
- Follow-on or regression need:
- Reviewers, dissent, and approval: (S)

Variants: 05 (18 fields, adds ACT link and review/approval state — same content, coarser grouping); 04 §1.11 (14 fields incl. comparison with the prediction, customer effect, restrictions, recommended next test); 13 §1.16 (QtM 07 — strength enum has only conclusive/directional/insufficient). [CONFLICT: strength enum — 07/05 include `not tested`; 13 §1.16 omits it, while the claims disposition enum covers `Untested`. Adopt the 4-state enum.] Completeness rule (13 §4.5): every finding identifies configuration + condition + evidence + uncertainty + limitation. Result chain each finding must complete (04 §5.4): Measured result → Performance meaning → Mission or customer effect → Practical action → Restriction or condition → Next evidence need. Selectable practical-action catalog (04 §1.11): use the tested configuration; use it only under stated conditions; change a threshold or setting; correct a specific defect; change the operator procedure; add training; integrate another component; test an unmeasured boundary; repeat a condition with more trials; run a diagnostic experiment; conduct focused regression; reject the tested approach.

**Required reporting language pattern** (10 §4.2 — fill-in template for every finding):
> Under **[configuration, threat, condition, operator, and procedure]**, **[x]** of **[n]** valid independent opportunities met **[event rule]**. The estimate was **[value]** with **[interval or uncertainty]**. The result **[met, missed, or did not resolve]** the approved threshold. The finding applies only to **[tested scope]** and does not establish **[prohibited conclusion]**.

**Printable result report blocks** (09 §4.2–4.4 — render into exported reports and debriefs):
- Binomial result block: planned, attempted, eligible, valid, and successful counts; `x/n`, not percentage alone; confidence or credible interval; configuration, threat, and condition cell; invalid, missing, unknown, and censored outcomes; dependence or clustering limitations.
- Continuous result block: individual valid results; center and spread; worst valid case when operationally important; condition breakdown; measurement uncertainty; confidence interval; outlier and exclusion sensitivity.
- Required accounting block (every measure/analysis): planned / attempted / eligible / valid / conditionally valid / invalid / missing / censored / unknown / included in each analysis.
Findings-report structure (13 §4.13): background, method, limits, results, evaluation, recommendations; state limits near the start; pair each limit with a mitigation; separate test adequacy from test outcome; report results by condition with uncertainty; never one overall average.

### 3.13 Run evidence package (04 §5.2) — stored together per run at completion/validation:
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

### 3.14 Supporting record forms (structures defined in other lanes; listed here because each is also a fillable form and print artifact)

Planning/records (blue): Campaign charter (29 fields, 07 §4.1); Authority and decision-rights record (12 fields × 22 decision types, 07 §4.2; 17-row authority matrix variant 01 §4.1 [CONFLICT: 07 enumerates 22 decision types, 01 enumerates 17 minimum rows — adopt 22, superset]); Decision–question–evidence traceability record (17 fields, 07 §4.3); Measure definition record (31 fields, 07 §4.4; 18-row dictionary template 09 §4.1; 19-field measure builder 04 §1.3); Configuration baseline record (28 fields, 07 §4.5); Threat and condition record (29 fields, 07 §4.6); question/hypothesis/threshold/evidence-source/matrix-cell/run-list forms (02 §4.3); test object record (12 fields, 04 §1.1); hypothesis record with guided sentence + 11 auxiliary fields (04 §1.4); claim/unknown/assumption/failure-mode registers (01 §4.7); mission-thread package (22 items per vignette, 08 §4.3); doctrine-to-test traceability matrix (9 rows, 08 §4.4).

Integration/readiness: measure-to-data map (03 §1.1 — with data lead + analysis lead signatures and strategist verification); event-identity definition; time-sync check log; ground-truth definition per truth domain; data lineage record; data-quality monitor config (green/warning/stop per channel); fallback path card (tested flag); range-fit matrix (14 dimensions × 5-value classification); authority tracker (12 types × 7 fields); hazard worksheet (10 fields, 14 hazard types); security and data-rights sheet (12 items); campaign schedule; contingency card (13 loss scenarios × 8 fields); deficiency/waiver record (10 fields); readiness review record (03 §4).

Analysis/closeout: analysis input manifest (05); run-level measure result record (result label enum `pass | miss | borderline | descriptive | unavailable`, 05); reproducible analysis manifest (11 fields, 09 §4.7); reliability incident form (9 fields, 09 §4.5); correction record (05); claim disposition (enum: Supported / Contradicted / Directionally supported / Inconclusive / Untested / Outside scope) and question disposition (Answered at the accepted evidence strength / Partially answered with a named gap / Not answered with a reason and path) with evidence-level classification (component behavior / interface behavior / performance under tested mission conditions / end-to-end mission effect) (06 §1); decision-analysis option record + option-type enum (06 §1); action record (10 fields, ACT, 06 §1); evidence baseline record (06 §1); change-impact assessment + minimum regression scope records (06 §1); evidence history tree per claim (06 §4: Claim → Baseline configuration → Original supporting tests → System or threat change → Required regression tests → New results → Current validity); evidence chain template (13 §4.3: Question ID → Hypothesis → Measure → Required data → Ground truth → Test conditions → Comparison method → Decision threshold → Resulting customer action; rule: every run maps to at least one Question ID — no orphan runs); reuse asset record (14-field metadata, 13 §1.21); product requirement generation template (field observation → product requirement → acceptance test, 13 §4.11); gate statement templates (13 §4.10).

---

## 4. Deliverables map

Deduplicated named outputs, grouped by campaign phase. Format tags: **[print]** printable/PDF, **[sheet]** spreadsheet/CSV/Excel, **[json]** structured export, **[screen]** in-app view, **[doc]** versioned marked document. Global export expectation (12 §5.3): **exports in Excel, CSV, JSON, PDF, and print**. Data intake accepts CSV or Excel uploads mapped to run identifiers (04 §4.8).

### 4.1 Framing and qualification (phases 00–01)

| Deliverable | Contents | Format | Source |
|---|---|---|---|
| Decision statement / decision charter | Fill-in charter statement (by [date], [owner] must decide [bounded choice] among [alternatives]...) | doc | 01 §4.3; 13 §5.1 |
| Responsibility matrix | Function × primary owner × strategist role | print/screen | 13 §4.8 |
| Stakeholder map / authority matrix | 22 decision types × 12 authority fields | screen/print | 07 §4.2; 01 §4.1 |
| System/configuration boundary statement | Included/excluded systems, boundary | doc | 13 §5.1 |
| Operational Question Set | `OQ-001...` register, ranked P1/P2/P3 | sheet/screen | 13 §5.1; 02 §5 |
| Claims Register / Unknowns Register / Assumption Register | `CLM-001...`, `UNK-001...`, `ASM-001...` | sheet/screen | 13 §5.1; 01 §4.7 |
| Initial evidence-gap map | Gaps ranked by decision impact | screen | 13 §5.1 |
| Campaign charter | 29-field record | doc/print | 07 §4.1 |
| Qualification gate statement | Fill-in gate statement | doc | 01 §4.4; 13 §3.5 |

### 4.2 Evidence planning and test design (phases 02–04 design)

| Deliverable | Contents | Format | Source |
|---|---|---|---|
| Frozen ranked question set | Question records, P1/P2/P3 | screen/sheet | 02 §5 |
| Hypothesis and prediction sheet | Hypothesis records incl. null, competing explanations, inconclusive criteria, predictions before test | print/sheet | 02 §5; 04 §5.1 |
| Measure dictionary / registry | 31-field measure records + threshold records; seeded from the 18 CUAS dictionary entries | sheet/json | 02 §5; 09 §4.1; 04 §5.1 |
| Evidence matrix / evidence-source and ground-truth plan | Source records per measure; ground-truth plan per truth variable | sheet | 02 §5; 13 §5.1; 11 §5 |
| Threat and condition records / threat profile set | One THR per profile, one COND per state; fidelity grids | doc/json | 02 §5; 13 §5.1 |
| Factor classification / variable and factor list | Every factor typed (IV / control / covariate / nuisance) | sheet | 02 §5; 04 §5.1 |
| Test matrix with sample rationale | Matrix cells, repetition rationale, coverage, drop order; Configuration × Threat × Condition × Method × Repetition = planned runs | sheet/screen | 02 §5; 04 §2.1 |
| Prioritized run list / randomized run order | Run-list entries with scores, drop order; randomization schedule | sheet | 02 §5; 12 §5.1 |
| Stop/repeat/adaptation rule set | Four rule lists + approver and max change per adaptation class | doc | 02 §5 |
| Test cards | Canonical card set (Section 2), lean cards | print/tablet | 04 §5.1; 12 §5.1 |
| Required data-field schema / data-field manifest | Required source fields per measure | sheet/json | 04 §5.1; 12 §5.1 |
| Instrumentation plan | Sources, truth, calibration, sync, health limits, fallbacks | doc | 04 §5.1 |
| Expected-results sheet | Nominal expectations per card | print | 04 §5.1 |
| Day schedule | Runs by day with margins | print/sheet | 04 §5.1 |
| Design review package | 12 ordered contents (02 §4.2) bundled | doc | 02 §4.2 |
| Test objective summary / test-object profile | Object record + objective | doc | 04 §5.1 |
| **Spreadsheet workbook** and **printable field package** | The complete before-test compile: all of the above | sheet + print | 04 §5.1; 12 §5.1 ("spreadsheet field pack") |
| Rehearsal checklist | Campaign-specific rehearsal items | print | 12 §5.1 |

### 4.3 Integration and readiness (phase 03)

| Deliverable | Contents | Format | Source |
|---|---|---|---|
| Signed measure-to-data map | Per-measure source mapping; data lead + analysis lead signatures; strategist verification | doc (S) | 03 §5 |
| Integration defect log | Defects, owners, correction dates, retest evidence | sheet | 03 §5 |
| Range-fit assessment | 14 dimensions × 5-value classification, per-gap validity impact | sheet/print | 03 §5 |
| Authority tracker | 12 authority types, live status | screen/sheet | 03 §5 |
| Safety/hazard package | Hazard worksheets, residual risk, accepting authority | doc | 03 §5 |
| Resource-loaded campaign schedule | Built backward from accepted-evidence date; workstreams, latest viable dates | sheet | 03 §5 |
| Contingency plan + minimum viable campaign | 13 loss scenarios × 8 fields | doc | 03 §5 |
| Readiness review outcomes | One per review event (5 types); go/conditional-go/hold/no-go; conditional-go limits carried into cards | doc | 03 §5 |
| Waiver records | Expiration + retest requirement | doc | 03 §5 |
| Rehearsal acceptance result and deficiencies record | End-to-end rehearsal outcome | doc | 11 §5 |

### 4.4 Execution (per run and per day)

| Deliverable | Contents | Format | Source |
|---|---|---|---|
| Run evidence package | 14 components (§3.13) | archive + print cover | 04 §5.2 |
| Run log / event log | Time-tagged events (run logger + event controls) | json/sheet | 04; 11 §5 |
| Configuration snapshot / export | Baseline verification per run | json | 13 §5.1 |
| Post-run quick look | 11-field auto-report (§3.10-A) + 6-option next-run recommendation | screen/print | 12 §4.5; 04 §5.3 |
| Day dashboard / current-run screen | §3.1–3.2 | screen | 04 §4.7; 12 §5.2 |
| Deviation log / anomaly records | DEV/ANOM records | screen/sheet | 07; 13 §5.1 |
| Raw-data manifest | Files per run with identifiers | sheet/json | 13 §5.1 |
| Data-health state transition log | Every green/warning/stop/degraded/unknown transition, time + source | json | 11 §5 |
| Run-validity status / adjudication records | Per run per version, allowed/prohibited uses | screen/doc | 05 §5; 13 §5.1 |
| Daily evidence review output | Selected next event + rationale, change list, approvals, minimum viable next-day plan | doc/screen | 07 §5; 05 §5 |
| Evidence-coverage map | Matrix cells × valid counts | screen | 12 §5.2; 05 §4 |
| Quick-look report (24–72 h) | Authenticated runs only, preliminary watermark, matrix completion, incidents, IDSK links | print/PDF | 13 §4.13 |

### 4.5 Analysis and findings (phase 05)

| Deliverable | Contents | Format | Source |
|---|---|---|---|
| Versioned analysis input manifest | Admitted runs; code, configuration, environment; frozen at campaign end | json/doc | 05 §5 |
| Run-level measure results | Value, uncertainty, threshold comparison, result label, intermediates, links | sheet/json | 05 §5 |
| Aggregate results report | Counts by category, central tendency, spread, worst valid case, intervals, breakdowns, sensitivity, missingness | print/sheet | 05 §5 |
| Binomial/continuous/accounting report blocks | §3.12 | print | 09 §4.2–4.4 |
| Causal diagnosis records | One per consequential failure/anomaly | doc | 05 §5 |
| Finding records (FIND) | 26-field records with strength + ladder level | doc/screen | 05 §5; 07 §4.12 |
| Prediction-versus-result view / hypothesis evaluation | Outcome enum: supported / directionally supported / contradicted / inconclusive / not tested; effect size, variability, confidence, conditions, confounders, needed evidence | screen/print | 04 §1.10; 12 §5.3 |
| Sensitivity calculations | With/without exclusions, assumption sensitivity | sheet | 12 §5.3 |
| Configuration comparison | A vs B results by cell | print/sheet | 12 §5.3 |
| Completed-campaign synthesis | Reproduced P1 results, independent review, bias assessment, boundaries, trade-offs, mission-thread consequences, evidence life + staleness triggers | doc | 05 §5 |

### 4.6 Decision and delivery (phase 06)

| Deliverable | Contents | Format | Source |
|---|---|---|---|
| **Decision evidence package** | 20 ordered sections (§3.8); must pass independent-reviewer test | doc/print/PDF, versioned + marked | 06 §4–5 |
| Bounded recommendation | 8 fields, embedded at sections 3 and 15 | doc | 06 §1 |
| Claims disposition board | Every CLM in one of 6 states; every Q in one of 3 states; 4-level evidence classification | screen/print | 06 §1; 13 §1.17 |
| Action plan | ACT records (10 fields), tracked to closure or transfer | screen/sheet | 06 §5 |
| Delivered data set | Raw + processed data, classification marks, checksums/custody, encryption, transfer + receipt records, versioned corrections | archive | 06 §5 |
| Review records | Four review forms (§3.9) | doc | 06 §4 |
| Test report / workbook (first-version loop) | Quantified findings + full workbook | print + sheet | 04 §6.5, §5.4 |

Data delivery standards for government-integrated events (13 §5.3 hooks): telemetry in IRIG 106 Chapter 10/11 with IRIG-B time stamps; ground truth and tracks as TENA objects; VAULTIS-aligned, CHEETAS-receivable formats; test data treated as CUI at a minimum.

### 4.7 Closeout, reuse, and follow-on (phase 06 close / 09–10)

| Deliverable | Contents | Format | Source |
|---|---|---|---|
| Closeout record | Contractual acceptance, reservations, open items, archives, property returns, invoice confirmation, customer outcome | doc | 06 §5 |
| After-action review output | Answers to the nine questions + improvement records (owner, due date, destination) | doc | 06 §5 |
| Reuse library additions + next-campaign start pack | Sanitized versioned assets of the 12 harvest types with 14-field metadata | json/library | 06 §5; 13 §1.21 |
| Evidence baseline | Exact scope of accepted evidence (10 field groups), validity period, acceptance status | doc/json | 06 §1, §5 |
| Regression assessment and plan | Change-impact record, minimum regression scope, evidence history tree, updated baseline | doc | 06 §5 |
| Follow-on success metrics / campaign success scorecard | 3 metric groups: decision impact, evidence quality, operating leverage; tracked across campaigns | screen/sheet | 06 §1, §5; 13 §2.7 |
| Product requirement set / regression-test additions / failure-mode library updates / campaign lessons record | Field friction → requirement → acceptance test | sheet | 13 §5.1 |
| Closeout submissions (government hooks) | Final technical report to DTIC with SF-298 + distribution statement; lessons to JLLIS | doc | 13 §5.3 |

Dedup note: "workbench products" (12 §5.1–5.3) = the same before/day-of/after sets as 04 §5.1 + §4.7 + §5.4 and 13 §5.1 phase outputs; the tables above are the union with duplicates collapsed.

---

## 5. UI form inventory (synthesis judgment)

Ordered input-form list the app needs. Order follows the mandated dependency chain (Decision → Question → Claim/Unknown → Hypothesis → Measure → Data/Truth → Threat/Condition → Design → Card → Run → Finding → Action; 02 §6.1) and the six workspace areas Define / Design / Prepare / Execute / Assess / Act with a supporting Constraints panel (04 §6.2). "Field source" names the record the form reads/writes. A wizard step may not open until its source records exist ("Later phases reference canonical records rather than rediscover the same facts", 13 §3.3).

1. **Campaign intake wizard** (Define). Steps mandated by phase-01 sequence (01 §8): register request → decision charter (fill-in template, 01 §4.3) → engagement type → clarification questions (the 10 app-generated questions, 12 §1.2) → customer commitment → feasibility screen → qualification gate. Fields: Campaign charter (07 §4.1, 29 fields); decision charter statement; engagement-type enum. Blocks all design work until the acceptance path is recorded (pocket rule 1: no decision owner, no campaign).
2. **Authority and roles setup** (Constraints). Fields: Authority and decision-rights record ×22 decision types (07 §4.2, auto-instantiated); stakeholder/acceptance register (01 §4.7); per-run role assignments list (04 §1.6, 11 roles). Constraint: exactly one accountable authority per decision type.
3. **Discovery workspace** (Define). Fields: claim/known-fact/unknown/assumption categorizer (13 §1.5); claims/unknowns/assumptions registers (OQ/CLM/UNK/ASM); discovery question prompts (01 §3.5; 13 §3.4); mission-thread editor seeded with the 12-node C-UAS chain (01 §4.5) with 8 transition fields per edge (13 §1.22).
4. **Test-object and system-boundary form** (Define). Fields: test object record (04 §1.1, 12 fields + 9-type object enum); system boundary included/excluded (12 §1.3 pattern); configuration baseline editor (07 §4.5, 28 fields) with freeze/release/drift log (01 §3.1).
5. **Question and hypothesis builder** (Define→Design). Fields: question record with the 9-pattern question enum (04 §1.2) and vague-term detector ("usable", "early enough", "reliably"); hypothesis guided sentence (4 slots) + 11 auxiliary fields + 9-type prediction enum (04 §1.4); P1/P2/P3 priority with freeze action (02). Rule: prediction recorded before the test.
6. **Measure builder** (Quantify). Fields: measure definition record (07 §4.4, 31 fields) unified with the dictionary entry template (09 §4.1, 18 rows) and the 19-field builder list (04 §1.3); measure-type enum (11 values); threshold record with 6-source origin enum (13 §2.3). Instantiation flow = dictionary use rules (§1.1.11); ready-status gated by the completion gate (§1.1.12). Ship the 18 CUAS-* dictionary entries as seed templates.
7. **Threat profile and condition editor** (Design). Fields: threat and condition record (07 §4.6, 29 fields); representation class enum (actual / surrogate / generic); per-feature fidelity grid (faithful / approximated / omitted / unknown) with auto-derived permitted/prohibited generalization (08); red-control fields (13 §1.7); profile class (mandatory / high-probability / high-consequence). Seed: 9 vignettes + threat matrix construction rules (08 §4.5; 13 §1.7).
8. **Factor and matrix builder** (Design). Fields: factor classification (4-class enum + example factor list, 04 §1.5; 5-class variant 02/13 §1.8 [CONFLICT: 04 gives 4 factor classes (changed on purpose / held constant / recorded but not controlled / unknown or unobserved); Field Guide gives 5 (independent / controls / covariates / responses / confounders); QtM 03 gives 5 (independent / dependent / controlled / measured-uncontrolled / uncontrollable). Adopt the QtM 5-class set with "responses" as the dependent class]); method selector (8 method templates, 04 §4.6) + 5 experiment patterns (10 §4.3); matrix generator computing Configuration × Threat × Condition × Method × Repetition with totals, duration, coverage by question/condition, required assets, missing controls, minimum valid evidence, drop order (04 §2.1); randomization/blocking rules; sequential stages (screen → augment → validate, 12 §6.3). Design lint (§1.1.9) runs here.
9. **Instrumentation and data-chain forms** (Prepare). Fields: measure-to-data map (03 §1.1); event-identity model (03 §1.2); time-source + sync log (03 §1.3; 11 §1.3); ground-truth plan per truth domain (03 §1.4; 11 §1.1); data-quality monitor config (03 §1.6; 11 §1.9); fallback path cards (03 §1.7); calibration records (11 §1.6). Signatures: data lead + analysis lead.
10. **Range, safety, and schedule forms** (Constraints/Prepare). Fields: range-fit matrix (03 §1.8); authority tracker (03 §1.9) seeded with lead-time constants (13 §1.23); hazard worksheet (03 §1.10); security/data-rights sheet (03 §1.11); backward-planned schedule (03 §1.12); contingency cards (03 §1.13); deficiency/waiver record (03 §1.14).
11. **Card builder** (Prepare). Source: everything above by reference; canonical 19-section card (Section 2); lean-card rendering policy; procedure step editor (one action / role / observable completion / flags); lifecycle Draft→Approved→Issued with cold-reader and dry-run gates (§1.1.16–1.1.17). Emits print cards + field package.
12. **Checklist runner** (all phases). Source: this document's Section 1 catalog as data. Each instance tracks per-item completer, time, result, and evidence attachment; gate checklists emit go/conditional-go/hold/no-go decisions with time and approvers.
13. **Run capture (Run Desk)** (Execute). Screens: day dashboard (§3.1); current-run screen (§3.2) with 12 generic event controls + card event marks; actual-state capture (04 §1.7); deviation/anomaly quick forms (§3.4–3.5); run record (§3.3); post-run quick look (§3.10-A) with 6-option recommendation.
14. **Adjudication board** (Execute→Assess, day-end). Source: run record + review items (§1.7.3); writes final status, measures/comparisons allowed, limits, repeat decision, dissent, approver+time; versioned; measure-level validity (12 §3.5); feeds run accounting and coverage map.
15. **Data intake and analysis forms** (Assess). Fields: CSV/Excel upload, column mapping, manual observations, event-log import, video/telemetry links, missing/corrupt marking, analysis version (04 §4.8); correction records; analysis input manifest; run-level measure results; reproducible analysis manifest (09 §4.7).
16. **Daily review wizard + adaptation record** (Assess, day-end). The 14-item agenda (§1.7.2) ending in exactly one of 9 next actions; generates CHG/adaptation record (§3.6); priority scoring (importance × uncertainty reduction × likelihood ÷ burden, H/M/L, 13 §2.2).
17. **Finding builder** (Assess→Act). Fields: FIND record (§3.12); findings ladder level; evidence-language category per statement; reporting language pattern; finding review questions (§1.8.6) as pre-approval gate.
18. **Debrief builder** (Act). Immediate factual debrief (auto-created per run, §3.7-A); daily evidence board (§3.7-B); nine-question after-action debrief with 5-working-day due date and improvement-record conversion (§3.7-C).
19. **Decision package composer + four reviews** (Act). Assembles the 20 sections (§3.8) auto-filled from records; runs the 18-item completeness checklist; sequences the four review forms (§3.9); delivery checklist (§1.9.6).
20. **Closeout and reuse forms** (Act/Institutionalize). Claim/question disposition screen (terminal states forced); action tracker; closeout checklist + gate dashboard; after-action flow; reuse harvest (8 steps, 12 asset types, 14-field metadata); evidence baseline object; change-impact wizard (8 steps, 6 outcomes, evidence history tree); success scorecard.

Wizard-ordering rules the sources mandate: predictions before results (04); thresholds and acceptance criteria frozen before execution unless an approved change is recorded (13 §6.9); no card generation before design gate (02 §3.2) and design lint (04 §3.13); no issue before cold-reader + dry run (04 §4.3); no live run without an issued card (pocket rule 6); no analysis without recorded validity status (05); no finding without traceability (pocket rule 8); no closeout while any claim or question is undisposed (06); the 11 pocket rules (§1.10.3) implemented as cross-form validation gates.

---

*End of MASTER-FORMS.md.*
