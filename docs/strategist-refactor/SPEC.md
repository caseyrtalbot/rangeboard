# Strategist redesign: implementation spec

Single implementation spec for the guided Deployment Strategist workflow.
Sources: `BRIEF.md`, the six audit files in `audit/`, and the code as of 2026-08-25.
Rule of the whole spec: simplify the interaction, never the data model. Every builder, chip set, and picker writes the schema field that exists today. No schema field is removed.

Anti-goals (BRIEF section 19): no giant cards, no one-question-per-screen flow, no chat UI, no decorative pills or gradients. Dense but legible. Keyboard first. An expert must be able to tab through a stage without opening one example.

---

## 1. Guided information architecture

Each stage keeps its panel file and its lifecycle position. Inside each stage, tabs give way to ordered decision groups. A group is a `DecisionGroup`: one plain-language question as the header, 3 to 7 decisions inside, a completion dot, and a tier badge where needed. Groups render in one scrolling column (the existing `.te-panel` layout). Navigation between groups is free. Only the stage gate blocks.

The formal T&E term never appears in the group question. It appears in the secondary line or in a `?` hint.

### 1.1 Qualify (CampaignPanel.tsx)

| # | Group | Question (primary text) | Decisions inside | Schema fields written |
|---|---|---|---|---|
| Q0 | Start | Start from | Preset pick (see section 7); campaign name and code | `TeCampaign.name`, `code`, `presetKey`, `sourceCampaignId` |
| Q1 | Intake | What did the customer ask for? | Exact request verbatim; requesting organization; sponsor; date received (default today); contract and funding owner | `charter.exactRequest`, `requestingOrganization`, `sponsor`, `dateReceived`, `contractAndFundingOwner` |
| Q2 | Determination | What is the customer asking us to determine? | One selection maps to both enums; derived tasking line shown for confirm | `charter.engagementType`, `valkrynTasking` (merge candidate 1, qualify audit) |
| Q3 | Mission | What are we protecting, and what must keep working? | Sentence builder: Protect [asset] so that [mission effect] continues | `charter.missionAndProtectedOutcome` |
| Q4 | Decision | What choice must the decision owner make, and when? | Bounded-choice builder; alternatives rows (delay and no action pre-seeded); blocking uncertainty (pick from unknown registers); decision date (inherits requested date); derived deliverables date and latest accepted-evidence date; post-test action, action authority, consequence of no action | `decision.boundedChoice`, `alternatives`, `blockingUncertainty`, `decisionDate`, `charter.requestedDecisionDate`, `deliverablesDate`, `decision.latestAcceptedEvidenceDate`, `postTestAction`, `actionAuthority`, `consequenceOfNoAction` (merge candidates 2, qualify audit) |
| Q5 | People and authority | Who owns the decision, and who accepts the evidence? | Decision owner (one entry, syncs roles row); evidence acceptance authority; deployment strategist; method approval authority; relying organization (inherited, confirm); required witnesses | `charter.customerDecisionOwner`, `evidenceAcceptanceAuthority`, `deploymentStrategist`, `acceptance.methodApprovalAuthority`, `relyingOrganization`, `requiredWitnesses`, matching `roles` rows (merge candidate 3) |
| Q6 | Sufficient evidence | What evidence ends this campaign with a usable answer? | One evidence builder writes four strings; threshold row (value, unit, source) keyed to engagement type; result-that-changes / result-that-does-not builders; can-accept-unfavorable check; rejection conditions; 2x2 action map | `charter.successCriteria`, `acceptance.evidenceStandard`, `decision.acceptanceConditions`, `requiredEvidenceStrength`, `minimumMeaningfulDifference`, `acceptableThreshold`, `resultThatChangesChoice`, `resultThatDoesNot`, `canAcceptUnfavorableEvidence`, `acceptance.rejectionConditions`, `actionOnMeet/Miss/Mixed/Inconclusive` (merge candidates 4, 5, 6, 9) |
| Q7 | Scope and limits | What is in, what is out, and what limits us? | Included-scope chips plus note; excluded-scope rows (exclusion plus what results cannot say); minimum viable campaign; known-limits category chips (seed feasibility); planned sites and dates; security class (default CUI) | `charter.includedScope`, `excludedScope`, `minimumViableCampaign`, `knownLimits`, `plannedSitesAndDates`, `dataSecurityReleaseClass` (merge candidate 8) |
| Q8 | Registers | What do we assume, claim, and not know? | Register table per kind (assumption, claim, unknown, known fact); charter assumptions string derives from the register; risk rows; source-document rows | `registers[]`, `charter.majorAssumptions` (derived), `majorRisks`, `sourceDocumentsAndPriorEvidence` (merge candidate 7) |
| Q9 | Authorities and schedule | What approvals and dates gate the campaign? | Authority rows (type pick fills lead time; due date derives); decision-rights rows; schedule (seed standard track is the default); customer commitments | `authorities[]`, `decisionRights[]`, `schedule[]`, `charter.commitments[]` |
| Q10 | Gate | Ready to qualify? | Feasibility screen (rows seeded from known-limits chips); StageReview; pass button | `feasibility[]`, `passQualificationGate()` |

Deviation note (BRIEF sections 5 and 21): the BRIEF opens Qualification with test-object and threat selection. This spec keeps the full records in Design D2 and D3 on purpose. `TeConfigBaseline` and `TeThreatProfile` are Design records; they freeze at the design gate, and full entry during Qualification would split one record across two stages. Qualification still captures both at intent level: Q0 preset pick seeds config and threat skeletons (section 7), Q3 names the protected asset from the board, and Q7 scope bounds the system under test. D2 and D3 inherit these picks with provenance, so nothing is asked twice.

### 1.2 Design (DesignPanel.tsx)

| # | Group | Question | Decisions inside | Schema fields written |
|---|---|---|---|---|
| D1 | Questions | What must this test answer? | Bank pick is the primary add path; pattern radio drives the wording builder; priority; evidence today; consequence if unanswered; answer date (inherited); freeze | `questions[]`: `wording`, `pattern`, `priority`, `currentEvidenceState`, `consequenceIfUnanswered`, `requiredAnswerDate`, `evidenceAuthority` (inherited), `frozen` |
| D2 | Test object | What exact system are we testing? | Describe from board (auto with provenance); boundaries; hardware, software, firmware rows; operators and training; functional check; freeze with mini review | `configs[]`: all `TeConfigBaseline` fields (merge: config system description, design audit) |
| D3 | Threats | What flies against it? | Vignette or board-model pick fills physical identity (airframe, group, nav, speed band, alt band); count and raid note; representation class with fidelity grid; OPFOR mode with adaptation rules; red control trio from factor classes; blinding; generalization bounds | `threats[]`: all `TeThreatProfile` fields (merges: threat physical identity, red control trio) |
| D4 | Conditions | Under what conditions? | Adopt board environment or pick a named preset (weather, EM, network in one decision); terrain chips; workload; degraded modes; supporting systems; background activity; generalization bounds | `conditions[]`: all `TeCondition` fields (merge: condition environment) |
| D5 | Measures | How do we measure the answer? | Dictionary pick is the primary path (fills 12 fields); threshold row (offers the Qualify Q6 threshold as prefill); truth sources with independence; data rules; family-conditional fields; freeze | `measures[]`: all `TeMeasure` fields (merge candidate 5 from qualify links here) |
| D6 | Predictions | What do we expect to happen? | One prediction builder per hypothesis (measure pick, prediction type, value shape); derived result trio (supports, refutes, inconclusive); null hypothesis default; competing explanations chips; assumption links | `hypotheses[]`: all `TeHypothesis` fields (merges: result mapping, prediction) |
| D7 | Factors | For each thing that can move a result: vary it, hold it, record it, or forbid it | Seed standard covariates; name combobox; classification radio with one-line definitions; conditional levels, tolerance, risk statement | `factors[]`: all `TeFactor` fields |
| D8 | Matrix | Which combinations, how many times? | Sample-size decision (helper output applies to measure reps and cell minimums); guided add-cells flow driven by method; per-cell links inherit from context; baseline row check; priority and drop order | `matrix[]`: all `TeMatrixCell` fields, `measures[].requiredRepetitions` (merges: sample size, matrix cell links) |
| D9 | Gate | Design ready? | designLint warnings with acknowledge; StageReview; approve | `approveDesign()` |

### 1.3 Cards (CardsPanel.tsx)

| # | Group | Question | Decisions inside | Schema fields written |
|---|---|---|---|---|
| C1 | Start | Where does this card come from? | From matrix cell (default), from template, or blank; links and fills inherit | `cards[]` create; `matrixCellId`, `questionIds`, `hypothesisIds`, `configId`, `threatId`, `conditionId`, `measureIds`, `claimIds` |
| C2 | Why this run | Why run this next, and what do we expect? | Derived title; inherited purpose; reason chips plus note (writes two fields); prediction builder; result that could change the decision (inherited) | `title`, `purpose`, `whyHighestValueNext`, `priorityReason`, `prediction`, `resultThatCouldChangeDecision`, `changedFactor` (merge: why-next) |
| C3 | Sampling plan | How many attempts, in what order? | One builder: attempt number, valid runs needed, order, blocking; reset-before-repeat chips when reps exceed 1 | `repetitionNumber`, `minValidSample`, `orderAndBlocking`, `resetBeforeRepeat` (merge: sampling plan) |
| C4 | System and crew | What state is the system in, and who runs it? | Inherited block from the config with per-field override; operators; training state | `systemStateNote`, `operators`, `trainingState` (merge: system and crew) |
| C5 | Red picture | What does red do, and what voids the run? | Red initial state builder (profile plus geometry); inherited red freedoms and limits chips; blinding; invalidating red deviations; condition note; operating limits (read-through from authorities) | `redInitialState`, `redControlled`, `redFixed`, `blinding`, `invalidatingRedDeviations`, `conditionNote`, `operatingLimits` (merge: red freedoms and limits) |
| C6 | Truth and timing | How do we know what really happened? | Derived truth block from linked measures; monitoring role plus fallback; event mark chips; required files chips; storage path (derived pattern) | `dataSources`, `groundTruth`, `commonTimeAndTolerance`, `monitoringAndFallback`, `eventMarks`, `requiredFiles`, `storagePath` (merge: truth and timing) |
| C7 | Procedure | What are the exact steps? | Steps with role, done-when, void and recorder flags; site calls (defaults); recording margins; preconditions derived from authority rows | `procedure[]`, `siteCalls`, `preEventMarginS`, `postEventMarginS`, `preconditions` |
| C8 | Stops and validity | When do we stop, and when does a run still count? | One stop and hold list with a class per row (safety, data, hold); safe state; restart authority; one validity-rules list with an effect per row (required, invalidates, conditional) | `safetyStops`, `dataEquipmentStops`, `holdConditions`, `safeState`, `restartAuthority`, `requiredValidityConditions`, `invalidatingFailures`, `conditionalUses` (merges: stop list, validity rules) |
| C9 | Evidence scope | What can this run prove? | Expected result builder; known artifact chips; inherited allowed and prohibited conclusions | `expectedResult`, `knownArtifacts`, `allowedConclusion`, `prohibitedConclusion` |
| C10 | Checks and issue | Is this card safe to issue? | Cold read record check; dry run record check; issue gate StageReview; issue | `coldReaderBy/At`, `dryRunBy/At`, `issueCard()` (merge: record checks) |

### 1.4 Execute (ExecutePanel.tsx)

| # | Group | Question | Decisions inside | Schema fields written |
|---|---|---|---|---|
| E1 | Day start | Are we go today? | Go/no-go: which decision, decision, approver (inherited), note; checklist instances from templates | `gonogos[]`, `checklists[]` |
| E2 | Start a run | Which card runs next? | Issued card pick (default: card serving the thinnest priority cell); roles prefilled from the last run of the card | `runs[]` create, `roles[]` |
| E3 | During the run | What happened, when? | Event mark chips; per-measure observations (status, success or value by family, note); operator observations | `events[]`, `observations[]`, `operatorObservations` |
| E4 | Deviations | Something differed. Does the run still count? | Planned state picked from the card; actual state; what it touched; immediate action chips; one merged validity decision writes five fields | `deviations[]`: all fields (merge: deviation validity block) |
| E5 | Anomalies | Something unexpected. Record it first | Raw observation first; source pick; classification; mission effect; protect-the-data chips; closure stepper (root cause, causes, corrective action, verification card, owner, open) | `anomalies[]`: all fields, including `distinguishingEvidence` and `diagnosticAction` (merge: anomaly closure) |
| E6 | After the run | What did we get? | Derived run story (procedure plus events, then deviations) edited once; sources-recorded derived from the files checklist; warnings; unexpected result; one use decision (preliminary use plus repeat needed) | `debrief.*`, `preliminaryUse` (merges: debrief story, use decision) |
| E7 | Adjudication | Does each run count? | Differed-from-plan toggle reveals actual pickers; per-file received checklist; initial data quality; one adjudication action (validity, allowed measures, prohibited uses, limits, adjudicator, reason); excluded checkbox | `actualConfigId/ThreatId/ConditionId`, `actualsNote`, `dataFilesNote`, `initialDataQuality`, `validity`, `allowedMeasureIds`, `prohibitedUses`, `limits`, `adjudications[]`, `excluded` (merges: adjudication, data files) |

### 1.5 Analyze (AnalyzePanel.tsx)

| # | Group | Question | Decisions inside | Schema fields written |
|---|---|---|---|---|
| A1 | Results | What do the numbers say? | Computed measure results (read-only calc); hypothesis outcome with a derived suggestion to confirm; outcome note | `hypotheses[].outcome`, `outcomeNote` |
| A2 | Coverage | Where is evidence still thin? | Matrix coverage view; chain health; both feed the gap pick in A3 | none (derived views) |
| A3 | Daily review | What is the one next move? | Next action select with definitions; triggering evidence pick (run, measure, anomaly, cell); gap pick from live chain health; change builder (kind plus reason); factor grid changed or held; comparability segment plus note; approver (inherited); priority calculator (ephemeral) | `changes[]`: all `TeChange` fields (merges: trigger and gap, change builder, factor grid) |

### 1.6 Deliver (DeliverPanel.tsx)

| # | Group | Question | Decisions inside | Schema fields written |
|---|---|---|---|---|
| L1 | Findings | What did we learn? | Statement builder start plus refuted-claims lint; chain links (question, claim, hypothesis, runs) with single-candidate fills; derived evidence detail block (auto on link change); generalization bounds derived and confirmed; assumptions register chips; strength and ladder with definitions and suggestions; evidence life; dissent behind an action | `findings[]`: all `TeFinding` fields (merges: evidence detail, generalization bounds) |
| L2 | Decision effect | What should the customer do? | Decision implication seeded from the Qualify action map by result label; customer effect; recommended action | `findings[].decisionImplication`, `customerEffect`, `recommendedAction` (merge: decision effect) |
| L3 | Actions | Who does what by when? | From-finding create; owners inherited from decision rights; due date; required work inherited; advanced: risk if late, who must be told | `actions[]`: all `TeAction` fields |
| L4 | Debriefs | What did the team learn? | AAR prompts from the seed bank; improvements with owner, date, destination | `debriefs[]` |
| L5 | Package | Is the evidence package complete? | 20 sections generated (edited flag protects manual text); 5 manual sections get templates; acceptance names inherited from the charter; final authority split control | `evidencePackage` |
| L6 | Closeout | Can we close? | Question dispositions with suggestions from finding strengths; claim dispositions with suggestions; open actions list; StageReview; deliver | `questions[].disposition`, `evidenceLevel`, `dispositionNote`, `registers[].disposition`, `markPackageDelivered()` |

---

## 2. Conditional logic map

Answer on the left, what appears on the right. Everything not listed stays visible by tier rules (section 6). Conditions marked (exists) already run in code; keep them.

### 2.1 Engagement type (Qualify Q2, `charter.engagementType`)

| Answer | Appears |
|---|---|
| comparison | Q6 shows minimum meaningful difference first; Design D2 prompts a second baseline config; D8 add-cells flow offers a baseline row plus a delta row per condition; comparison measures ranked first in the dictionary pick |
| evaluation, demonstration | Q6 shows acceptable threshold plus threshold source first |
| characterization, experiment | Q6 leads with the evidence builder; threshold row moves under Advanced |
| any | The other threshold row stays reachable under Advanced (qualify audit conditional rules) |

### 2.2 System role (derived, no schema field)

The role signal derives from the board scenario linked through the config (describe-from-board reads which entity kinds exist: sensors, C2, effectors, and their types). No new field. Effects:

| Board content | Appears |
|---|---|
| Effector present, kinetic type | Interceptor and engagement measures ranked first (dictionary); Cards C5 geometry slots include intercept range; expenditure event marks offered |
| Effector present, EW or DE type | Jam and effect-recovery measures ranked first; EW template (TC-CUAS-EW-SOFTKILL-001) suggested |
| Sensors only | Detection and track measures ranked first; defeat measures moved down, never hidden |
| C2 present | Handoff and fusion measures ranked; TC-CUAS-C2-HANDOFF-001 suggested |

Ranking only. Nothing is hidden by system role; suppressing measures would delete rigor.

### 2.3 Environment and spectrum (Design D4, `TeCondition.emEnvironment` select)

| Answer | Appears |
|---|---|
| benign, representative | Base condition fields only |
| congested, contested, denied | Degraded-modes chips promoted (GPS denied, comms out, sensor down); EW factor suggestions in D7; nav-mode and emissions questions promoted on threats (D3); truth-source independence question flagged as recommended on every linked measure (instrumentation must survive the spectrum) |
| Adopt board environment | Drift check against `Scenario.environment` stays live (exists) |

### 2.4 Other triggers the audits flag

| Trigger | Appears |
|---|---|
| Measure family binomial (exists) | Interval method; numerator and denominator rules; success control on observations |
| Measure family latency or time-to-event | Start and stop events; censoring rule |
| Interval method bayes (exists) | Prior alpha and beta |
| Threshold value set | Threshold source; customer-approved check |
| Threat representation class not actual-threat | Fidelity grid |
| OPFOR mode bounded-adaptive or free-play | Adaptation rules table |
| Threat count above 1 | Raid note |
| Factor classification independent-variable or bounded-red-choice | Planned levels chips |
| Factor classification held-control | Tolerance and verification |
| Factor classification unobserved-nuisance (exists) | Risk statement |
| Register kind unknown (exists) | Rank (drag order) |
| Register kind claim (exists) | Disposition |
| Unknown register entries exist | Blocking uncertainty becomes a picker; otherwise plain text with example |
| Alternatives rows exist | Action map cells pick from them; otherwise plain text |
| Measures or dictionary available | Result builders render as builders; otherwise plain text |
| Feasibility score not feasible (exists) | Owner, fallback, effect on conclusions |
| Card `threatId` set | C5 red picture group |
| Card `conditionId` set | Condition note block |
| Independent-variable factors exist | Changed factor select; S8 factor pickers show only classes with members |
| Reps or valid sample above 1 | Reset before repeat |
| Card created from matrix cell | Cell picker hides; provenance line with change action shows |
| Runs exist on card | Deviations and runs section renders; otherwise collapsed |
| Checklist item type value (exists) | Value input |
| Checklist item state na (exists) | Reason field |
| Gated checklist template (exists) | Gate outcome; conditional limits only when outcome is conditional-go |
| Run validity conditionally-valid (exists) | Allowed measures (required), prohibited uses, limits |
| Adjudication differed-from-plan toggle | Actual config, threat, condition pickers plus as-run note |
| Deviation or anomaly mark tapped (exists) | The matching record form |
| Run completed (exists) | Debrief form |
| Preliminary use repeat | Repeat needed auto-set, confirmable |
| Hypothesis outcome set | Outcome note |
| Comparability segment not none | Comparability note |
| Linked measure has threshold | Threshold comparison; else auto-text "characterization only" |
| Hypothesis linked on finding | Comparison with prediction |
| Question disposition not answered | Disposition note |
| Campaign phase before analyzing | Question disposition block hidden in Design D1 |
| `holdOnUnknown` checklist items unchecked (exists) | Run hold banner |

---

## 3. Input conversion table

Consolidated from the five panel audits. One row per field whose control changes. Fields the audits keep unchanged (justified free text, existing selects, checkboxes, dates) are not listed; the audits are the record for those. Every converted select must keep unknown legacy values in its option list (the existing `SECURITY_CLASSES` pattern).

Legend: EP = EntityPicker, PP = PersonPicker, SC = SegChips, SB = SentenceBuilder, RT = RegisterTable, NU = NumberUnitField, RC = RecordCheck, PV = Provenance wrapper.

### Qualify

| Field | New control | Vocab source | Trigger |
|---|---|---|---|
| `charter.requestingOrganization`, `sponsor`, `contractAndFundingOwner` | EP (org, free add) | `allOrganizations` pool | always |
| `charter.dateReceived` | DateField, smart default | today on create | silent fill |
| `charter.engagementType` | SC single behind plain question | `EngagementType` (types.ts) | writes `valkrynTasking` too |
| `charter.valkrynTasking` | derived line, PV, expand to edit | `ValkrynTasking` | after Q2 answer |
| `charter.customerDecisionOwner`, `evidenceAcceptanceAuthority`, `deploymentStrategist` | PP | `allPeople` | roles sync stays one-way |
| `charter.missionAndProtectedOutcome` | SB: Protect [asset] so that [effect] | board assets plus free | always |
| `charter.includedScope` | SC multi plus note line | mission functions, `EvidenceLevel`, condition classes | chips filtered by Q2 |
| `charter.excludedScope` | RT rows: exclusion, what results cannot say | none | always |
| `charter.majorAssumptions` | RT (register-first); string derives | `registers` kind assumption | replaces one-way seed button |
| `charter.majorRisks` | RT rows: statement, owner, criticality | people pool for owner | always |
| `charter.successCriteria` + `acceptance.evidenceStandard` + `decision.acceptanceConditions` + `decision.requiredEvidenceStrength` | one SB: [n] valid repetitions of [measure] at [interval method] confidence in [fidelity]; writes all four strings | `MEASURE_DICTIONARY`, `IntervalMethod`, `FidelityLevel` | one decision, four fields |
| `charter.plannedSitesAndDates` | site EP plus date range | prior site strings | always |
| `charter.deliverablesDate` | derived, confirm | decision date minus `SCHEDULE_MILESTONES` lead | on decision date entry |
| `charter.dataSecurityReleaseClass` | select, default CUI | `SECURITY_CLASSES` moved to seed/constants.ts | silent default on create |
| `charter.knownLimits` | category chips, one line each | fixed six categories | filled chip offers add-as-feasibility |
| `charter.sourceDocumentsAndPriorEvidence` | RT rows: title, date | none | always |
| `CustomerCommitment.owner` | PP | `allPeople` | per row |
| `acceptance.relyingOrganization` | EP with PV, confirm | inherits `requestingOrganization` | GATE, visible confirm |
| `acceptance.methodApprovalAuthority` | PP | `allPeople` | always |
| `acceptance.requiredWitnesses` | PP multi chips, joined string | `allPeople` | always |
| `decision.decisionDate` | DateField with PV, confirm | inherits `requestedDecisionDate` | GATE, confirm |
| `decision.authorizedDecisionOwner` | PP with PV, confirm | inherits `customerDecisionOwner` | GATE, confirm |
| `decision.boundedChoice` | SB: choose between [A] and [B] for [purpose] | alternatives rows | GATE |
| `decision.alternatives` | RT option rows, delay and no action pre-seeded | none | prefill on first open |
| `decision.blockingUncertainty` | EP over unknown registers, free override | `registers` kind unknown, rank order | GATE; picker only when unknowns exist |
| `decision.resultThatChangesChoice`, `resultThatDoesNot` | SB: [measure] [comparator] [value unit] | campaign measures, `MEASURE_DICTIONARY` | builder only when options exist |
| `decision.latestAcceptedEvidenceDate` | derived, confirm | decision date minus review lead | on decision date entry |
| `decision.minimumMeaningfulDifference` | NU linked to a measure | dictionary units | comparison first; Advanced otherwise |
| `decision.acceptableThreshold` | NU plus source select | `ThresholdSource` | evaluation first; Advanced otherwise |
| `decision.actionOnMeet/Miss/Mixed/Inconclusive` | one 2x2 action map | alternatives rows plus common actions | cells free-text without alternatives |
| `RoleAssignment.primary`, `backup` | PP | `allPeople` | hide roles already assigned |
| `AuthorityApproval.owner` | PP | `allPeople` | per row |
| `AuthorityApproval.dueDate` | derived, confirm | first live-run date minus parsed lead | when schedule has the date |
| `AuthorityApproval.status` | Seg (4 states) | `AuthorityStatus` | per row |
| `DecisionRightRow.accountableAuthority`, `performer`, `escalationPath` | PP | `allPeople`, role defaults | per row |
| `RegisterEntry.sourceAndDate` | EP combobox, free | source-document rows | suggestions exist today |
| `RegisterEntry.relevance` | select link (blocking uncertainty or a question) plus note | decision, questions | per entry |
| `RegisterEntry.rank` | drag reorder; rank derived | list order | kind unknown only |
| `ScheduleItem.name` | combobox | `SCHEDULE_MILESTONES` | seed standard track stays default |
| `ScheduleItem.owner` | PP | `allPeople` | per row |
| `ScheduleItem.tMinusDays` | NU, unit label working days | none | per row |
| `FeasibilityItem.item` | short text with chips | known-limits categories | rows seeded from Q7 chips |
| `FeasibilityItem.score` | Seg | inline union | per row |
| `FeasibilityItem.owner` | PP | `allPeople` | score not feasible |

### Design

| Field | New control | Vocab source | Trigger |
|---|---|---|---|
| `TeQuestion.wording` | SB, pattern-driven, editable output | `QUESTION_BANKS`, template per `pattern` | vague-term lint live in builder |
| `TeQuestion.pattern` | radio with one-line definitions | `QuestionPattern` | drives the builder template |
| `TeQuestion.requiredAnswerDate` | inherit with PV | decision date | editable |
| `TeQuestion.currentEvidenceState` | select plus note | new list: none, vendor claim only, prior test, model only, operational report (seed/constants.ts) | always |
| `TeQuestion.evidenceAuthority` | PV chip plus PP override | `charter.evidenceAcceptanceAuthority` | autofill exists; make visible |
| `TeQuestion.disposition`, `evidenceLevel`, `dispositionNote` | unchanged selects, now conditional | `QuestionDisposition`, `EvidenceLevel` | hidden until Analyze |
| `TeHypothesis.questionId` | EP, inherited default | campaign questions | hidden when only one question |
| `TeHypothesis.underConditions` | EP chips | conditions, threats | sentence preview stays |
| `TeHypothesis.measuredBy` | EP | measures, dictionary | feeds relative-to derivation |
| `TeHypothesis.relativeTo` | derived with PV | picked measure threshold and unit | only when measure has threshold |
| `TeHypothesis.predictedValue` | NU shaped by prediction type | none | shape follows `predictionType` |
| `TeHypothesis.predictionType` | radio with definitions | `PredictionType` | controls value shape |
| `TeHypothesis.supportingResult`, `refutingResult`, `inconclusiveResult` | derived trio, one decision, editable drafts | measure, threshold, `higherIsBetter` | draft marked until accepted |
| `TeHypothesis.nullHypothesis` | default text per prediction type, editable | none | silent default |
| `TeHypothesis.competingExplanations` | chips plus custom | factors class unobserved-nuisance | always |
| `TeHypothesis.assumptions` | EP links to registers | `registers` kind assumption | text stays for legacy |
| `TeMeasure.name` | dictionary pick first, custom text after | `MEASURE_DICTIONARY` | always |
| `TeMeasure.family`, `measureType`, `higherIsBetter` | derive from dictionary, select or check fallback | dictionary, enums | on dict pick |
| `TeMeasure.exactDefinition`, `numeratorRule`, `denominatorRule` | inherit from dictionary, edit behind action | dictionary | rules only for binomial, rate, probability |
| `TeMeasure.unit` | combobox | dictionary units plus s, m, nm, ft, %, count | always |
| `TeMeasure.startEvent`, `stopEvent` | combobox | dictionary events plus `GENERIC_MARKS` | latency and time-to-event only |
| `TeMeasure.experimentalUnit` | select plus custom | new list: engagement, run, track, sortie, day | always |
| `TeMeasure.truth.primarySource`, `backupSource` | EP | truth-source pool from existing measures | LINT on empty primary |
| `TeMeasure.truth.independenceFromSut` | select plus note | new list: fully independent, shares components, derived from tested system | always |
| `TeMeasure.missingDataRule`, `invalidDataRule`, `censoringRule` | select plus custom | new standard-rule lists | censoring: latency families only |
| `TeMeasure.thresholdSource` | select | `ThresholdSource` | only when threshold set |
| `TeMeasure.requiredRepetitions` | derived accept from helper | sample-size helper | numeric override stays |
| `TeThreatProfile.name` | EP | vignettes, board UAS library | custom text stays |
| `TeThreatProfile.uasGroup`, `airframe`, `navMode`, `speedBandMps`, `altBandFt` | derive from linked board model with PV; chips, select, RangeField fallback | board model, promoted `NAV_MODES` and airframe lists | fill-from-model extends to group and nav |
| `TeThreatProfile.emissionsSummary` | band chips plus text | new list: 2.4 GHz, 5.8 GHz, silent | always |
| `TeThreatProfile.representationClass` | radio with definitions | `RepresentationClass` | not actual-threat reveals fidelity grid |
| `TeThreatProfile.redControlledVariables`, `redFixedVariables`, `prohibitedActions` | chips over factor classes | factors by classification | one classification view, three strings |
| `TeThreatProfile.blinding` | select plus note | new list: none, red blind, blue blind, both | always |
| `TeThreatProfile.validationSource` | EP | source-document rows | always |
| `TeThreatProfile.permittedGeneralization`, `prohibitedGeneralization` | SB: evidence extends to [class] under [conditions] | threat classes, conditions | editable output |
| `FidelityRow.feature` | select plus custom in builder table | new list: emissions, speed, payload, nav | grid rows only |
| `TeCondition.terrainAndClutter` | chips plus note | new list: open, rolling, urban, coastal, mountain | always |
| `TeCondition.weatherAndIllumination` | derive from board or NU builder (wind, temp, precip, light) | `Scenario.environment` | drift check stays |
| `TeCondition.emEnvironment` | select plus derive from board | new spectrum list: benign, representative, congested, contested, denied | drives 2.3 |
| `TeCondition.networkState` | select plus note | new list: nominal, degraded, denied | always |
| `TeCondition.operatorWorkload` | select | new list: low, moderate, high, saturated | always |
| `TeCondition.supportingSystems` | EP | board entities, configs | always |
| `TeCondition.degradedModes` | chips plus custom | new list: GPS denied, comms out, sensor down | promoted when spectrum contested |
| `TeCondition.permittedGeneralization`, `prohibitedGeneralization` | SB, same pattern as threats | | |
| `TeConfigBaseline.hardwareAndSerials`, `softwareVersions`, `firmwareVersions` | RT rows (item, serial or version); paste fallback | none | locked when frozen |
| `TeConfigBaseline.operatorsAndTraining` | PP multi | `allPeople` | locked when frozen |
| `TeConfigBaseline.sensorConfiguration`, `c2AndNetworkConfiguration`, `effectorConfiguration` | auto describe-from-board with PV, edit allowed | board scenario | fills only empty fields (exists) |
| `TeConfigBaseline.functionalCheckResult` | Seg | pass, pass with notes, fail | locked when frozen |
| `TeConfigBaseline.releasedBy` | PP | `allPeople` | locked when frozen |
| `TeConfigBaseline.boundaryInside`, `boundaryExcluded` | EP | `Scenario.boundaries` | locked when frozen |
| `TeConfigBaseline.knownDefectsAndWaivers` | RT rows (defect, waiver state) | none | locked when frozen |
| `TeFactor.name` | combobox | `STANDARD_COVARIATE_FACTORS`, cross-campaign names, BRIEF section 6 list | custom allowed |
| `TeFactor.classification` | radio with definitions | `FactorClass` | drives conditionals |
| `TeFactor.plannedLevels` | level chips | none | IV and bounded-red-choice only |
| `TeMatrixCell.questionId`, `hypothesisId`, `configId`, `threatId`, `conditionId` | EP, inherited defaults, guided add-cells flow | campaign records | hypothesis filtered to question |
| `TeMatrixCell.method` | select | `MATRIX_METHODS` promoted to seed/constants.ts | LINT baseline row |
| `TeMatrixCell.measureIds` | multi, default from question measures | campaign measures | inherit on create |
| `TeMatrixCell.plannedReps`, `minValidEvidence` | derived apply from helper | sample-size helper, `requiredRepetitions` | override stays |
| `TeMatrixCell.priority` | select 1 to 3 | none | per cell |
| `TeMatrixCell.dropOrder` | derive from priority rank, override | none | per cell |
| `TeMatrixCell.orderOrBlock` | select plus custom | randomized, blocked by day, fixed order | per cell |

### Cards

| Field | New control | Vocab source | Trigger |
|---|---|---|---|
| `TeCard.title` | derived compose, short-text override | linked question, threat, condition | recompute offer on link change |
| `owner`, `approvers`, `operators`, `restartAuthority` | PP (approvers, operators multi; restart adds roles) | `allPeople`, `RUN_ROLES` | always |
| `coldReaderBy/At`, `dryRunBy/At` | RC (one action stamps name and time) | `allPeople` | hidden when frozen |
| `matrixCellId` | creation-time EP, then PV line with change action | matrix | hidden when created from cell |
| `purpose` | inherit with PV, edit | linked question wording | fill on question link |
| `whyHighestValueNext` + `priorityReason` | reason chips plus one note, writes both | new list: closes largest gap, unblocks runs, decision deadline, cheapest discriminator, perishable access | always |
| `resultThatCouldChangeDecision` | inherit with PV, confirm | `decision.resultThatChangesChoice` | when decision record exists |
| `prediction` | builder from hypothesis, editable | linked hypothesis | after hypothesis link |
| `repetitionNumber` + `minValidSample` + `orderAndBlocking` | one sampling SB | order and blocking chips: day, operator, threat article, weather, none | cell `orderOrBlock` inherits first |
| `systemStateNote`, `trainingState` | inherited block with PV, per-field override | config record | fill on config link |
| `redInitialState` | SB: profile inherit plus geometry NU (route, alt, speed, aspect) | threat record | threat linked |
| `redControlled`, `redFixed` | inherited chips with PV | threat record | fill on threat link |
| `blinding` | inherit with PV | threat record | fill on threat link |
| `invalidatingRedDeviations` | chips plus free add | threat `prohibitedActions`, adaptation triggers | threat linked |
| `resetBeforeRepeat` | chips plus free add | new standard reset list | reps above 1 |
| `conditionNote` | inherited block with PV | condition record | fill on condition link |
| `operatingLimits` | read-through with PV, override action | active authorities | active authorities exist |
| `dataSources`, `groundTruth`, `commonTimeAndTolerance` | one derived truth block with PV; NU override on tolerance | linked measures | fill on measure link; label Truth source |
| `monitoringAndFallback` | role select plus short text | `RUN_ROLES` | always |
| `eventMarks` | chips (exists), extended | `DEFAULT_EVENT_MARKS`, `GENERIC_MARKS`, measure events | measure events appear on link |
| `preconditions` | derived rows plus chips and free add | authority register live status | authorities exist |
| `siteCalls.start/pause/stop/abort` | defaults plus select | range SOP list, prior cards | silent default on create |
| `expectedResult` | builder from prediction and measures, editable | linked records | after prediction set |
| `knownArtifacts` | chips plus free add | threat and condition artifact lists | always |
| `safetyStops` + `dataEquipmentStops` + `holdConditions` | one stop and hold RT, class per row | authority limits, new stop taxonomy: truth loss, recorder failure, time-sync loss | always |
| `requiredValidityConditions` + `invalidatingFailures` + `conditionalUses` | one validity-rules RT, effect per row (required, invalidates, conditional) | instrumentation-failure taxonomy | reused by E7 adjudication view |
| `requiredFiles` | chips plus free add | `DATA_STANDARDS`, measure sources, prior cards | always |
| `storagePath` | derived pattern with `cardCode`, override | campaign convention | silent default |
| `allowedConclusion`, `prohibitedConclusion` | inherited seed with PV, long-text edit | threat and condition generalization fields | fill on link |
| `claimIds` | EP multi (new editor; schema exists) | `registers` kind claim | always |

### Execute

| Field | New control | Vocab source | Trigger |
|---|---|---|---|
| `TeGoNoGo.approvers` | PP with PV | `decisionRightHolder('daily go/no-go')` | default, editable |
| `TeRun.cardId` (create) | EP, smart default | card serving thinnest priority cell | GATE issued only |
| `TeRun.roles[].person` | PP, prefilled | last run of same card | prefill default |
| `MeasureObservation.status` | select with inline defs for censored, unknown-outcome | `ObservationStatus` | per measure row |
| `TeDeviation.plannedState` | pick the card statement it deviates from | card fields and steps | override stays |
| `TeDeviation.affected` | EP | factors, measures, card-linked first | always |
| `TeDeviation.immediateAction` | chips plus other | new list: continue, pause, safe state, stop, resume after fix | always |
| `TeDeviation.effect` + `easierOrHarder` + `validityEffect` + `disposition` + `generalizationLimit` | one merged decision: does the run still count? Writes five fields | `DeviationEffect`, `DeviationDisposition` | guided, editable output |
| `TeDeviation.approver` | PP with PV | `decisionRightHolder('run validity')` | default on create (exists) |
| `TeAnomaly.source` | select plus other | measure truth sources, `card.dataSources` | suggestions exist |
| `TeAnomaly.missionEffect` | select plus note | new list: none, degraded, data loss, safety | always |
| `TeAnomaly.preservationAction` | chips plus other | new list: freeze files, screenshot, keep hardware state, copy logs | always |
| `TeAnomaly.verificationTest` | EP over cards | campaign cards | diagnostic-card action fills it |
| `TeAnomaly.owner` | PP | `allPeople` | closure group |
| Anomaly closure group | closure stepper; surfaces `distinguishingEvidence`, `diagnosticAction` | `RootCauseStatus` | one guided flow |
| `debrief.plannedVsOccurred`, `differences` | derived drafts, edited once | procedure, event log, deviations | on run completion |
| `debrief.sourcesRecorded` | derived from files checklist, confirm | `card.requiredFiles` | with data files check |
| `debrief.repeatNeeded` + `preliminaryUse` | one use decision: can we use this data? | `PreliminaryUse`, valid-failure gets a definition | repeat auto-sets repeat-needed |
| `TeRun.actualConfigId/ThreatId/ConditionId` | PV of planned, differed toggle reveals EP | campaign records | conditional on toggle |
| `TeRun.dataFilesNote` | per-file received checklist plus note, renders to string | `card.requiredFiles` | card supplies list |
| `TeRun.initialDataQuality` | select plus other | new list in seed/constants.ts: complete, gaps noted, truth dropout | always |
| Adjudication block | one action: validity, allowed measures, prohibited uses, limits, adjudicator, reason | `TeRunValidity`, card measures | status choice reveals the rest |
| `RunAdjudicationEntry.by` | PP with PV | `decisionRightHolder('run validity')` | default (exists) |
| `TeRun.prohibitedUses` | short text with chips | `card.prohibitedConclusion` | conditionally-valid only |
| `ChecklistInstanceItem.completer` | PP, per-instance runner default | `allPeople`, `runner` | auto on check |
| `TeChecklist.conditionalLimits` | short text | none | outcome conditional-go only (tightened) |

### Analyze and Deliver

| Field | New control | Vocab source | Trigger |
|---|---|---|---|
| `TeHypothesis.outcome` | select with derived suggestion, confirm | measure result label vs prediction | suggestion when estimate exists |
| `TeChange.trigger` | EP: run, measure result, anomaly, or cell, plus note | campaign records | always |
| `TeChange.gapToResolve` | pick from live gap list, text fallback | `chainHealth`, coverage gaps | gap list derives live |
| `TeChange.selectedChangeAndReason` | builder: kind select plus reason text | mirrors `NextAction` | always |
| `TeChange.variablesChanged` + `variablesHeld` | one factor grid, changed or held toggle per factor | campaign factors | chips only when factors exist |
| `TeChange.comparabilityEffect` | Seg plus note | reuse `DeviationEffect` values | note when not none |
| `TeChange.approvals` | PP with PV | `decisionRightHolder('card change')` | default exists |
| `TeFinding.statement` | builder start (system, result, condition) plus long-text; refuted-claims lint stays | `REFUTED_CLAIMS` lint | GATE |
| `TeFinding.quantifiedResult` | auto-derive, editable; helper select removed | `measureSummary` from `measureIds` | auto when links change |
| `TeFinding.claimId` | EP with statement preview | `registers` kind claim | single-candidate fill exists |
| `TeFinding.threatIds`, `conditionIds` | derived defaults, confirm chips | linked runs' cards | fill on run link |
| Evidence detail (thresholdComparison, sampleAndIndependence, uncertaintyNote, missingAndExcludedData, comparisonWithPrediction) | one auto-generated block, per-field edit | existing `generatedEvidence` | auto on link change, empty-guard stays |
| `TeFinding.strength`, `ladderLevel` | Seg with inline defs and derived suggestion | `FindingStrength`, `LadderLevel` | suggestion when measures compute |
| `TeFinding.confoundersAndAlternatives` | short text with suggestions | `hypothesis.competingExplanations` | hypothesis linked |
| `TeFinding.appliesTo` + `doesNotApplyTo` | one generalization-bounds review, confirm | permitted and prohibited generalization on linked records | auto, GATE on appliesTo |
| `TeFinding.assumptions` | register chips; free add creates a register entry | `registers` kind assumption | always |
| `TeFinding.evidenceLifeAndStaleness` | date pick plus condition | `decision.latestAcceptedEvidenceDate` default | default when date exists |
| `TeFinding.decisionImplication` | builder seeded by result label | Qualify action map fields | seed when measures compute |
| `TeFinding.approvers` | PP with PV | `decisionRightHolder('findings')` | default exists |
| `TeFinding.dissent` | short text behind Record disagreement action | none | collapsed when empty |
| `TeAction.decisionOwner`, `executionOwner` | PP with PV | `decisionRightHolder('customer action')`, `allPeople` | defaults exist |
| `TeAction.riskIfLate`, `communicationRequired` | short text; person multi plus note | `allPeople` | Advanced disclosure |
| `TeDebrief.improvements[].owner` | PP | `allPeople` | per row |
| `evidencePackage.methodAcceptance`, `evidenceAcceptance` | EP with PV, confirm | charter acceptance fields | inherit as default |
| `evidencePackage.finalAuthorityAndDate` | person pick plus date pick, joined string | `allPeople` | always |
| `TeQuestion.disposition` (closeout) | select with suggestion | linked finding strengths | suggestion when findings exist |
| `RegisterEntry.disposition` (closeout) | select with suggestion | linked findings, hypothesis outcomes | suggestion when findings exist |
| AAR prompts | source from seed | `AAR_QUESTIONS` in questionBanks.ts; delete the DeliverPanel local copy | on New AAR |

---

## 4. Inheritance and prefill rules

One engine, three behaviors. The engine stays `linkedRecordFill` plus the per-field derivations the audits list. The UI change: derived values render read-through with provenance instead of being copied into blank boxes by a button.

### 4.1 The three behaviors

| Behavior | When | Mechanics |
|---|---|---|
| Silent fill | Pure convenience defaults that no gate reads and no artifact signs: `dateReceived` today, site calls, `storagePath` pattern, checklist completer, null hypothesis default, security class CUI, seeded alternatives rows | Value written on create or on trigger. No chip. Plain editable field. |
| Fill with provenance | Every `linkedRecordFill` target, describe-from-board text, dictionary-applied measure fields, threat fill-from-model, derived dates, derived titles, evidence generation on findings and package sections | Value fills when the field is empty. A `Provenance` chip shows the source: from RPS-42 baseline v1.2. Editing flips the chip to edited. Revert restores the derivation. Refill-all (existing CardsPanel path) keeps working and re-marks fields as inherited. |
| Confirm before write | GATE fields (`relyingOrganization`, `decisionDate`, `authorizedDecisionOwner`), any derived suggestion for a judgment enum (hypothesis outcome, question disposition, claim disposition, finding strength), anything that would overwrite nonempty user text, and anything AI-drafted (BRIEF section 20) | The value renders as a pending suggestion with source. It writes only on an explicit confirm click or keystroke. Never authoritative until accepted. |

### 4.2 Sources, in priority order

1. Campaign context singletons: charter, decision, acceptance. Feed dates, people, organizations, thresholds downstream.
2. Registers and records: configs, threats, conditions, measures, factors, questions, hypotheses, matrix cells, authorities, decision rights, registers. Feed cards, runs, findings.
3. Board scenario: describe-from-board, fill-from-model, environment prefill, boundaries, frames. Drift checks stay live.
4. Seed vocabularies: dictionary, banks, vignettes, templates, constants. Never fabricate facts; they seed structure and wording only.
5. Prior records of the same kind: last card's site calls and storage path, last run's roles, other cells' blocking strings.

### 4.3 Provenance display

- One inline chip per inherited value: `from <record name>` in dim text, `edited` after override, `confirm` button on gate fields.
- The chip is text plus a 1 px rule, tokens only, no new visual primitives (infra audit section 7).
- Derivations recompute live for display; the stored string stays the single persisted truth. Inherited state = stored value equals current derivation. Edited state = differs. No provenance metadata is stored (keeps the data model unchanged).
- Ask once, reuse everywhere: a value entered in Qualify never gets asked for again in Design, Cards, or Deliver. It appears with provenance and an override.

---

## 5. New kit.tsx components

All new components reuse `field`, `field-row`, `subsection`, `seg`, `card-chip`, `status`, `gate-item` classes and the existing tokens. No CSS-in-JS, no new libraries. New CSS classes go in `src/index.css` under the existing T&E block. Keyboard: every control reachable by tab; combobox filtering on type; Enter selects; Esc closes.

```tsx
/** Group wrapper: plain question header, completion dot, tier badge, children. */
DecisionGroup: { id: string; question: string; hint?: string;        // formal term goes here
  tier?: 'required' | 'recommended' | 'advanced';
  state?: 'done' | 'partial' | 'empty';                              // completion dot
  defaultOpen?: boolean; children: ReactNode }

/** Chip select. Single or multi. Free add optional. Replaces comma text. */
SegChips<T extends string>: { label?: string; help?: string;
  options: Array<{ v: T; label: string; def?: string }>;             // def renders as help-dot
  value: T | T[] | null; multi?: boolean; allowCustom?: boolean;
  onChange: (v: T | T[] | null) => void; disabled?: boolean }

/** Searchable combobox over records. Keyboard-first. Free entry optional. */
EntityPicker: { label: string; help?: string;
  options: Array<{ id: string; label: string; sub?: string; pill?: PillKind }>;
  value: string | null; onChange: (id: string | null) => void;
  onCreate?: (text: string) => void;                                 // add-new path
  prefill?: { id: string | null; source: string };                   // inherited default + provenance
  allowFree?: boolean; freeValue?: string; onFree?: (v: string) => void;
  multi?: boolean; values?: string[]; onChangeMulti?: (ids: string[]) => void;
  disabled?: boolean }

/** Person picker: EntityPicker over allPeople/rolePeople; writes the same string fields. */
PersonPicker: { label: string; value: string; onChange: (v: string) => void;
  people: string[]; prefillSource?: string; multi?: boolean; help?: string; disabled?: boolean }

/** Inherited-value wrapper. Wraps any field. */
Provenance: { source: string;                                        // "from RPS-42 baseline v1.2"
  state: 'inherited' | 'edited' | 'pending';                         // pending = confirm-before-write
  onConfirm?: () => void; onRevert?: () => void; children: ReactNode }

/** Structured sentence builder; renders to one string field. */
SentenceBuilder: { slots: Array<
    | { kind: 'literal'; text: string }
    | { kind: 'select'; key: string; options: string[]; value: string }
    | { kind: 'entity'; key: string; options: Array<{id: string; label: string}>; value: string }
    | { kind: 'number'; key: string; unit?: string; value: number | null }
    | { kind: 'text'; key: string; placeholder?: string; value: string }>;
  onSlot: (key: string, v: string | number | null) => void;
  render: () => string;                                              // composed sentence
  value: string; onChange: (v: string) => void;                      // the stored string; editable after build
  disabled?: boolean }

/** On-demand help: definition, example, why it matters, use-this-structure. */
ExampleHint: { definition?: string; example?: string; why?: string;
  onUse?: (text: string) => void;                                    // inserts editable template
  illustrative?: boolean }                                           // marks example data as illustrative

/** Numeric with a unit. */
NumberUnitField: { label: string; value: number | null; unit: string;
  unitOptions?: string[]; onUnit?: (u: string) => void;
  onChange: (v: number | null) => void; step?: number; help?: string; disabled?: boolean }

/** Min-max pair with a unit (speed band, alt band). */
RangeField: { label: string; min: number | null; max: number | null; unit: string;
  onChange: (min: number | null, max: number | null) => void; disabled?: boolean }

/** Structured add-row register (BRIEF section 14). Typed columns, add, remove, reorder. */
RegisterTable<Row extends { id: string }>: { columns: Array<{
    key: keyof Row & string; label: string;
    kind: 'text' | 'select' | 'person' | 'date' | 'number' | 'pill';
    options?: string[]; width?: string }>;
  rows: Row[]; onAdd: () => void; onPatch: (id: string, patch: Partial<Row>) => void;
  onRemove: (id: string) => void; onReorder?: (ids: string[]) => void;
  removeImpacts?: (id: string) => string[];                          // section 11: nonempty blocks remove; listed as the reason
  addLabel: string; empty?: string }

/** One action stamps person + timestamp together (cold read, dry run). */
RecordCheck: { label: string; help?: string; by: string; at: string | null;
  people: string[]; onRecord: (by: string) => void; disabled?: boolean }

/** Persistent readiness readout (BRIEF section 15). Rendered by OpsWorkspace. */
ReadinessRail: { pct: number; items: Array<{
    label: string; state: 'done' | 'partial' | 'missing'; detail?: string;  // "4/6"
    onPreview?: () => void }> }

/** Generated stage-gate summary (BRIEF section 16). */
StageReview: { title: string;
  rows: Array<{ label: string; value: string; source?: string }>;    // generated from structured data
  issues: Array<{ level: 'block' | 'warn'; text: string }>;          // from validate.ts
  passLabel: string; onPass: () => void; onBack?: () => void; disabled?: boolean }

/** Tier badge. Small, one per group or field; never a wall of red. */
RequiredBadge: { tier: 'required' | 'recommended' | 'advanced' }

/** Collapsed advanced fields inside a group. */
AdvancedDisclosure: { label?: string; children: ReactNode }          // default "Advanced"
```

Not added on purpose: no wizard/stepper component (navigation stays free), no modal framework (help stays inline), no toast system. `MultiPicker`, `ChipList`, `Seg`, `GateList`, `Pill`, `PhaseIntro` stay as they are; panels keep using them.

---

## 6. Required, recommended, advanced tiers and StageReview

### 6.1 Tier definitions

- Required: a validate.ts gate reads it (`qualificationBlockers`, `cardIssueBlockers`, `canStartRun`, `runIncludable`, `findingBlockers`, `closeoutBlockers`). Blocks the stage gate. Shown with one `RequiredBadge` on the group, not per-field red.
- Recommended: `designLint` warnings, `chainHealth` items, and every fill-with-provenance target. Improves quality; never blocks; the gate lists open items and asks for acknowledgment (existing design-gate behavior, extended to all stages).
- Advanced: specialized fields behind `AdvancedDisclosure`: failure boundary, bayes priors, fidelity grid, adaptation rules, drop order, risk if late, communication required, censoring rule, off-type threshold row, dissent, package manual sections.

Per stage:

| Stage | Required (gate source) | Recommended | Advanced |
|---|---|---|---|
| Qualify | decision owner, bounded choice, decision date, blocking uncertainty, acceptance conditions, relying organization, no infeasible feasibility item | mission, scope, registers, authorities, schedule, evidence builder completeness | off-type threshold row, action map, commitments detail |
| Design | qualification passed; warnings acknowledged | all 12 designLint checks (question-measure links, truth sources, threshold sources, refuting results, baseline row, rep minimums) | bayes priors, failure boundary, fidelity grid, adaptation rules |
| Cards | cardIssueBlockers: title, purpose, linked question, measure, config, threat, condition; nonempty procedure with done-when per step; cold read and dry run recorded; no `[placeholder]`; config and measures frozen | inherited blocks confirmed, validity rules, truth block | conditional uses, measures note, frames |
| Execute | `canStartRun` (issued card); `holdOnUnknown` checklist holds; adjudication required before analysis (`runIncludable`) | debrief, data files checklist, deviations closed | anomaly closure detail |
| Analyze | none (gate is adjudication upstream) | hypothesis outcomes set, gaps reviewed, changes recorded | priority calculator |
| Deliver | findingBlockers: statement, question link, run links, exact config, measures, applicability bounds; closeoutBlockers: every question disposed, every claim disposed, no open actions | evidence detail confirmed, package generated sections reviewed | dissent, manual package sections, communication plan |

### 6.2 StageReview content (generated, never typed)

Each gate group ends with a `StageReview` built from campaign data plus the validate.ts result. Rows per stage:

- Qualify: Customer asks (exactRequest first line); Determination (engagement type label); Decision (bounded choice); Decision owner; Evidence authority; Decision date; Scope (included chips summary); Key exclusions; Open issues (blockers plus unverified assumptions count, authorities not active count). Buttons: Back to edit, Pass qualification gate.
- Design: Questions (count by priority, frozen count); Measures (count, with truth source n/m, thresholds approved n/m); Threats and conditions (counts, representation classes); Configs (frozen n/m); Factors (count by class); Matrix (cells, baseline present, total planned reps vs min evidence); Open lint warnings. Buttons: Back, Approve design (acknowledge warnings).
- Cards (per card, above Issue): What it tests (question); Against (threat, condition); Configuration (name, version, frozen pill); Sampling (attempts, valid needed); Checks (cold read by/at, dry run by/at); Blockers. Buttons: Back, Issue card.
- Execute (per run, above adjudication): Card and version; Planned vs actual entities; Events count, deviations count, anomalies open; Data files received n/m; Validity choice. Buttons: Back, Record adjudication.
- Deliver closeout: Questions disposed n/m; Claims disposed n/m; Findings by strength; Open actions; Package sections complete n/20; Acceptance names. Buttons: Back, Mark package delivered.

`ReadinessRail` (OpsWorkspace right edge, collapsible) shows the same data continuously: Campaign readiness percent plus the artifact list (Charter, Decision statement, Configuration, Threats, Measures n/m, Assumptions n, Risks n, Matrix, Cards issued n, Runs adjudicated n/m, Findings n, Package n/20). Each row previews its artifact through the existing print components. Percent = weighted mean of gate completion per stage; computed in `src/te/calc/readiness.ts`, derived live, never stored.

---

## 7. Presets

Preset pick is Qualify group Q0, one `Start from` row of chips. A preset seeds structure and recommended records. It never fabricates factual test data (BRIEF section 10). Seeded records carry normal ids from `allocate`; text placeholders use `[placeholder]` so the card gate catches them.

| BRIEF template | Maps to existing seed data | What it seeds |
|---|---|---|
| Blank campaign | `emptyCampaign()` | Nothing else |
| Previous campaign | Any existing campaign in the store | See below |
| C-UAS sensor characterization | Card template `TC-CUAS-SEN-CHAR-001`; dictionary detect/track measures; QB-QTM banks | engagementType characterization; 1 question skeleton; measures from dictionary; 1 card draft from template |
| Radar comparison | `TC-CUAS-SEN-CHAR-001` twice (A/B); comparison engagement | engagementType comparison; two config skeletons; matrix baseline plus delta rows; comparison measures |
| Sensor-to-C2 integration | `TC-CUAS-C2-HANDOFF-001` | integration question skeleton, handoff measures, card draft |
| C2 track fusion evaluation | `TC-CUAS-C2-HANDOFF-001`; vignette V-08/V-09 as offered threats | evaluation engagement; fusion measures; threat skeletons |
| EW resilience | `TC-CUAS-EW-SOFTKILL-001`; contested spectrum condition preset | condition with emEnvironment contested; EW measures; adaptation-rule threat skeleton |
| Interceptor evaluation | `TC-CUAS-DEF-INTERCEPT-001` | defeat measures; interceptor card draft |
| End-to-end detect-to-defeat | `TC-CUAS-SOS-EWBUF-001`, `TC-CUAS-SAT-RAID-001`; vignette V-01 | multi-question skeleton across the kill chain; raid threat skeleton |
| Regression test | Previous-campaign copy plus engagementType evaluation | see below; matrix marked baseline-repeat |
| Custom template | none | Reserved; renders as Blank until a template store exists (out of scope) |

The illustrative demo `buildJiatf401()` stays a separate dev/demo entry, not a preset (it contains facts).

Start from previous campaign (`startFromCampaign(sourceId)` store action):

- Copies structure: charter organizations and people, acceptance block, roles, authorities (status reset to `identified`), decision rights, schedule (done flags cleared), registers, factors, measures (unfrozen, `thresholdApproved` cleared), threats, conditions, question skeletons (dispositions cleared, frozen cleared).
- Never copies: configs frozen state and snapshots (configs copy unfrozen with drift log cleared), cards, runs, deviations, anomalies, changes, checklists, gonogos, findings, actions, debriefs, evidence package content, frames.
- All ids reallocate under the new campaign code. `sourceCampaignId` records provenance; copied values render one campaign-level provenance line, not per-field chips.
- Every date field clears except schedule tMinus offsets.

---

## 8. Data model changes and migration

### 8.1 Schema changes (two, both optional and additive)

| Change | Justification |
|---|---|
| `TeCampaign.presetKey?: string \| null` (default null in `emptyCampaign`) | Records which preset seeded the campaign. Needed for StageReview and package provenance (a template-seeded structure is a fact about the evidence). Cannot be derived after the fact. |
| `TeCampaign.sourceCampaignId?: string \| null` (default null) | Same, for start-from-previous. Traceability (BRIEF section 17) wants the ancestry recorded. |

Nothing else changes. Every builder, chip set, and picker writes existing string, enum, number, and array fields, as the audits verified field by field. Provenance is computed, not stored (section 4.3). New vocabularies land in `seed/constants.ts`, not in the schema. Promotions of local consts (`SECURITY_CLASSES`, `NAV_MODES`, airframes, `MATRIX_METHODS`, initial-data-quality, immediate actions, preservation actions, reset list, stop taxonomy, reason chips, current-evidence-state, independence, experimental units, spectrum, terrain, network, workload, degraded modes, blinding, mission effect) are code moves, not schema changes.

### 8.2 localStorage migration (src/te/io/persistTe.ts)

- `schemaVersion` stays 1. Both new fields are optional with null defaults, so `fillCampaign` covers them: it spreads `parsed` over `emptyCampaign()` at the top level, and deep-fills only `charter`, `decision`, and `evidencePackage`.
- Consequence: record arrays (`measures`, `threats`, cards, ...) are NOT deep-filled. Do not add new per-record fields; if one ever becomes necessary, read it defensively (`?? default`) at every use site or extend `fillCampaign` with a per-record filler in the same change.
- Legacy free text in converted fields must stay valid: every new select prepends an unknown stored value to its options (existing `SECURITY_CLASSES` pattern); `DateField` already tolerates non-ISO text; `SentenceBuilder` never parses the stored string, it only writes it, so legacy prose displays in the editable output area untouched.
- Builders and derived fills must never fire on load. Fills run on user triggers only (create, link, pick, confirm), so opening an old campaign changes nothing.
- Export/import format (`rangeboardCampaign: 1`) is unchanged; imports flow through `fillCampaign`.
- Storage-full guard (frame captures) stays; presets add negligible size.

---

## 9. Copy rules for new UI text

1. Primary question first, plain words, present tense, active voice. Target 8 words or fewer. Example: What flies against it?
2. One sentence, one instruction. Split compound asks into separate fields or lines.
3. The formal T&E term never leads. It goes in the secondary line or the `?` hint. Example: primary What is one trial?, hint Experimental unit.
4. Chip and radio labels: 1 to 3 words, sentence case, no trailing period. Field-radio brevity: Compare, Characterize, Verify, Stress, Integrate.
5. Buttons name the action and the object: Add assumption, Issue card, Pass qualification gate. Never OK, Submit, or Done alone.
6. Definitions (in hints): one sentence, no nested jargon. Examples: realistic C-UAS content, marked illustrative, never invented performance numbers.
7. Numbers always carry units. Units follow the deliverable conventions: nm for distance where doctrinal, ft AGL or MSL for altitude, s for time.
8. Approved terms: truth source (never ground truth), target, contact, track per the verbiage standard. Say void the run, not invalidate, in primary text; the enum keeps its name.
9. No filler: no please, no simply, no note that. No repeated jargon: a term defined in a hint is not re-explained elsewhere in the stage.
10. Error and blocker text states the fix, not the failure: Name a decision owner, not Decision owner is required.
11. Provenance text pattern: from <record>, edited, confirm. Lowercase, dim, terse.
12. Adopt the audits' rewrite tables verbatim as the starting copy deck (qualify, design, cards, execute, analyze-deliver audits each carry one). Where audit copy exceeds these rules, tighten it; do not loosen.

---

## 10. Work breakdown for parallel implementation

Strict file ownership. No two agents write the same file. Panel-local new components live in a new sibling file owned by that panel's agent. `src/index.css` and every shared module belong to the foundation agent; panel agents only import.

Sequencing: Agent F completes and merges first (it defines every shared component, vocabulary, store action, and CSS class). Agents P1 through P6 and W then run fully in parallel.

| Agent | Owns (writes) | Work |
|---|---|---|
| F: foundation | `src/te/ui/kit.tsx`, `src/te/model/types.ts`, `src/te/model/empty.ts`, `src/te/state/teStore.ts`, `src/te/validate.ts`, `src/te/seed/constants.ts`, `src/te/ui/help.ts`, `src/te/io/persistTe.ts`, `src/index.css`, `src/te/state/teStore.test.ts` | All section 5 components. Two optional schema fields plus `emptyCampaign` defaults. Store: `startFromCampaign`, `applyPreset`; keep `linkedRecordFill` as the fill engine. Promote local vocab consts into `seed/constants.ts` and add the new lists (section 3). New HELP strings and rewrite copy constants in `help.ts`. `fillCampaign` note comment. All new CSS classes (decision-group, chips, combobox, provenance, readiness-rail, stage-review, register-table) using existing tokens. Section 11 support: `deleteImpacts` in validate.ts; ephemeral `lastSavedAt` and `saveError` store state set from persistTe; `te-scroll-x` overflow wrappers and the responsive rules. |
| P1: qualify | `src/te/ui/CampaignPanel.tsx`, new `src/te/ui/CampaignGroups.tsx` | Rebuild the six tabs into groups Q0 to Q10 (section 1.1). Wire merges 1 to 9, register-first assumptions, feasibility seeding, StageReview on the gate. |
| P2: design | `src/te/ui/DesignPanel.tsx`, new `src/te/ui/DesignBuilders.tsx` | Groups D1 to D9. Dictionary-first measures, vignette and board-model threat fill, prediction builder and result trio, factor classification view, guided add-cells matrix flow, sample-size apply, StageReview. |
| P3: cards | `src/te/ui/CardsPanel.tsx`, new `src/te/ui/CardBlocks.tsx` | Groups C1 to C10. Read-through inherited blocks with provenance, sampling builder, stop and validity rule tables, record checks, `claimIds` editor, issue StageReview. |
| P4: execute | `src/te/ui/ExecutePanel.tsx`, new `src/te/ui/ExecuteBlocks.tsx` | Groups E1 to E7. Merged deviation decision, anomaly closure stepper, derived debrief drafts, data-files checklist, one-action adjudication, differed-from-plan toggle. |
| P5: analyze | `src/te/ui/AnalyzePanel.tsx`, new `src/te/ui/AnalyzeBlocks.tsx` | Groups A1 to A3. Outcome suggestions with confirm, gap and trigger picks from chainHealth, change builder, factor grid, comparability. |
| P6: deliver | `src/te/ui/DeliverPanel.tsx`, new `src/te/ui/DeliverBlocks.tsx` | Groups L1 to L6. Finding builder plus auto evidence detail, generalization bounds review, decision-effect group, package inherits, closeout suggestions, delivery StageReview. Delete the local AAR prompt copy; import from seed. |
| W: workspace and readiness | `src/te/ui/OpsWorkspace.tsx`, new `src/te/calc/readiness.ts` | Compute readiness from validate.ts outputs, chainHealth, and record counts (pure, derived, tested). Mount `ReadinessRail` with artifact preview hooks into existing print components. Keep the stepper dots in sync with the new gate states. Mount the saved-state indicator (section 11) in the workspace header. |

Shared-file contract: P1 to P6 and W import from `kit.tsx`, `types.ts`, `teStore.ts`, `validate.ts`, `seed/*`, `help.ts` and never edit them. If a panel needs a missing shared prop or vocabulary during implementation, it files the need back to F rather than editing the shared file. `ProductsPanel.tsx`, `demo.tsx`, and the print components are out of scope for all agents.

Definition of done per agent: type-checks (`npm run build`), lint clean, existing tests pass, every gate in validate.ts still reachable, no schema field lost, legacy campaign loads and round-trips with no diff until the user acts. The section 11 behaviors hold for every control the agent owns.

---

## 11. Production behavior (BRIEF section 18)

BRIEF section 18 lists the behaviors of serious operational software. Acceptance criterion 14 (real field use) depends on them. This section gives each one a disposition. Validation, stable ids, deterministic data, keyboard access, search and filtering, accessible controls, and provenance are already specified in sections 3 to 6; the table covers the rest.

| Behavior | Disposition |
|---|---|
| Autosave | Exists. `startTeAutosave` (`src/te/io/persistTe.ts`) subscribes to the store and writes `rangeboard.te.v1` with a 500 ms debounce. Keep unchanged. |
| Explicit saved state | New. `persistTe.ts` records ephemeral `lastSavedAt` and `saveError` in the store after each write attempt. UI state only: never persisted, no schema change. The OpsWorkspace header shows `Saved HH:MM` in dim text, or `Not saved: storage full. Export the campaign.` on failure. F owns the state; W owns the indicator. |
| Draft recovery | Exists by construction. Every keystroke commits to the store and the autosave. `loadTeAutosave` restores state at startup, so a half-finished group returns exactly as left. Builders write through `onSlot` immediately. No separate draft layer exists or is needed. |
| Undo | None, and none is added. The store is versioned and append-only by design (`teStore.ts` header). Mitigations replace undo: confirm-before-write on gate fields (4.1), Provenance revert restores any derivation, controlled deletion below prevents destructive loss, and `reviseCard` plus config minor bumps preserve superseded content. A general undo needs a store rework and is out of scope. |
| Controlled deletion | New rule. F adds `deleteImpacts(campaign, kind, id): string[]` to `validate.ts`. It returns human-readable referrers of a record: a register entry named by `decision.blockingUncertainty` or linked from `hypotheses[].claimId`, `cards[].claimIds`, or `findings[].claimId`; a measure linked by matrix cells, cards, findings, or `runs[].observations[].measureId`; a question, config, threat, or condition linked by matrix, cards, runs, or findings; a card with runs. Every remove control calls it first. Empty result: remove after one inline confirm; a row whose text fields are all empty removes silently. Nonempty result: remove is disabled and the explanation lists the referrers (`In use: 2 findings, 1 card`). The user clears the references first. `RegisterTable` takes the `removeImpacts` prop (section 5). |
| Error recovery | Autosave failure never crashes and never blocks editing; it sets `saveError` and the header shows it. An invalid import file reports its reason inline near the import control and changes nothing. There is no optimistic UI to roll back; every write is local and synchronous. |
| Loading states | Not applicable, stated on purpose. The store is local and synchronous, and the autosave load completes before first render. No spinners are added. |
| Empty states | Every list names its add action in its empty text (`RegisterTable.empty`, group bodies): `No assumptions yet. Add assumption.` A group with no records shows its primary add path, never a bare table. An EntityPicker with an empty pool falls back to free text (section 2.4 rules). |
| Focus behavior | Opening or closing a group never steals focus. Add-row moves focus to the first cell of the new row. Remove returns focus to the add button. Esc closes a combobox and returns focus to its input. Confirm chips are tab-reachable. No control autofocuses on mount. |
| Responsive layout, no horizontal overflow | Dense grids (RegisterTable, the 2x2 action map, the fidelity grid, matrix views) render inside a `te-scroll-x` wrapper with `overflow-x: auto` and minimum column widths; the panel body never scrolls horizontally. The action map stacks to one column below 480 px. F owns the CSS. |
| Version awareness, change history | Existing mechanisms are the record; no new history store is added. Card `version` with the `reviseCard` supersede chain, config minor bumps with the drift log, append-only `TeRun.adjudications[]`, `TeFinding.version`, and `changes[]` for deliberate Analyze-stage changes. A per-field audit log would need a schema change and is rejected under the no-schema-change rule. |
| Disabled states with explanations | Every disabled control carries a short reason in dim text or `title`: `Locked: baseline frozen`, `In use: 2 findings`. Gate buttons list their blockers through StageReview. All kit components accept `disabled`; the owning panel supplies the reason line. |
| Permission-aware controls | Not applicable, stated on purpose. The app is single-user and local with no auth layer. Person fields record names as strings and enforce nothing. If multi-user ever arrives, this row is the anchor for that decision. |

---

## 12. Traceability chain map (BRIEF section 17)

The BRIEF requires the chain below to survive simplification. Section 3 keeps every link field, so the chain is preserved; this table makes the mapping explicit. `chainHealth` (`validate.ts`) counts broken links live and feeds A2 and the gap picks.

| Chain step | Concrete fields | Link fields |
|---|---|---|
| Customer need | `charter.exactRequest`, `charter.missionAndProtectedOutcome` (Q1, Q3) | The campaign record is the container; `decision.boundedChoice` and `charter.successCriteria` restate the need as a testable ask |
| Operational question | `questions[].wording`, `pattern`, `priority` | `consequenceIfUnanswered` states the tie to the decision; `requiredAnswerDate` inherits the decision date |
| Claim / unknown | `registers[]`, kind claim or unknown | `RegisterEntry.relevance` names the decision or question it affects; `decision.blockingUncertainty` picks an unknown; `hypotheses[].claimId`, `cards[].claimIds`, `findings[].claimId` carry claims forward |
| Evidence gap | Derived, not stored: `chainHealth` counts, matrix coverage (A2) | `changes[].gapToResolve` stores the gap a change answers |
| Measure | `measures[]` | `measures[].questionId`, `hypothesisIds` |
| Test condition | `conditions[]` | `matrix[].conditionId` binds condition, `questionId`, `hypothesisId`, and `measureIds` in one cell; `hypotheses[].underConditions` names them in the prediction |
| Test card | `cards[]` | `matrixCellId`, `questionIds`, `hypothesisIds`, `configId`, `threatId`, `conditionId`, `measureIds`, `claimIds` |
| Observation | `runs[].observations[]`, `runs[].events[]` | `runs[].cardId`, `cardVersion`, `matrixCellId`; `observations[].measureId` |
| Finding | `findings[]` | `questionId`, `claimId`, `hypothesisId`, `supportingRunIds`, `contradictingRunIds`, `configId`, `threatIds`, `conditionIds`, `measureIds` |
| Conclusion | `findings[].statement`, `strength`, `ladderLevel`, `appliesTo`, `doesNotApplyTo`; `questions[].disposition`, `evidenceLevel`; `registers[].disposition`; `evidencePackage` sections | Closeout (L6) writes the dispositions from finding strengths |
| Decision | `decision.*` upstream; `findings[].decisionImplication`, `customerEffect`, `recommendedAction`; `actions[]` | `actions[].findingId` ties tasking back to its finding; `decisionImplication` seeds from the Qualify action map (L2) |

No conversion in section 3 drops an id or link field. `presetKey` and `sourceCampaignId` (section 8.1) extend the chain upstream to campaign ancestry.

---

## 13. Major change rationale (BRIEF section 23)

BRIEF section 23 requires, for each major UX change: current friction, proposed interaction, why it reduces cognitive load, and how data fidelity is preserved. The audits carry the field-level mapping; this table covers the major changes.

| Change | Current friction | Proposed interaction | Why load drops | How fidelity holds |
|---|---|---|---|---|
| Tabs to decision groups (section 1) | Long tabbed checklists per stage; the user hunts for the next relevant field | Ordered groups, one plain question each, free navigation, completion dots | The user answers one question at a time instead of scanning a schema | Every group writes the same schema fields; only the stage gate blocks |
| Copy buttons to fill with provenance (section 4) | Seed and copy buttons duplicate values into blank boxes; copies drift | Derived values render read-through with a provenance chip, edit, and revert | Nothing is retyped; ask once, reuse everywhere | The stored string stays the single truth; no provenance metadata is stored |
| Multi-field prose to sentence builders (sections 3, 5) | Related free-text boxes ask for one thought several ways (evidence standard writes four strings) | One SentenceBuilder writes every target string in one decision | One decision replaces four compositions | Output lands in the existing string fields and stays editable; legacy prose displays untouched |
| Comma text to chips and pickers (section 3) | Free text invites typos and unbounded vocabulary | SegChips and EntityPicker over real vocabularies, free add kept | Recognition beats recall | Same string and id fields; unknown legacy values stay in the option list |
| Assumptions text to register-first (Q8, BRIEF 14) | The charter string and the register duplicate each other one way | RegisterTable is the source; the charter string derives | One entry point, no reconciliation | `registers[]` unchanged; `charter.majorAssumptions` still written, now derived |
| Blank adds to bank and dictionary first (D1, D5) | Blank question and measure forms demand expert wording from memory | Bank or dictionary pick fills the record; custom entry stays | Start from a vetted record, not a blank | Picks fill existing fields; every field stays editable; nothing is invented |
| Hand-built matrix to guided add-cells (D8) | Cell-by-cell entry with manual repetition math | Method-driven add flow plus the sample-size helper with apply | The tool does the combinatorics and arithmetic | Cells keep all link fields; overrides stay; helper output requires an accept |
| Scattered stop and validity fields to classed tables (C8) | Three stop lists and three validity lists split one judgment | One table each, a class or effect per row | One list, one pass | Rows render back to the same six string fields |
| Field-by-field adjudication to one action (E7) | Validity, allowed measures, prohibited uses, limits, and reason sit apart | One adjudication action writes them together | The judgment is made once, whole | Same fields; the append-only `adjudications[]` entry is preserved |
| Typed gate notes to generated StageReview (section 6) | The user restates entered data at each gate | The review generates from campaign data plus validate.ts | Reading replaces retyping | Generated, never stored; gates still read validate.ts only |
| ReadinessRail (section 6.2) | Progress is invisible until a gate fails | A persistent rail shows artifact status with previews | The user always knows what remains (criterion 8) | Derived live from validate.ts and counts; never stored |
| Blank start to presets (section 7) | An empty campaign gives no structure to react to | Preset chips seed structure and skeletons | Editing beats authoring | Presets seed structure only; `[placeholder]` text trips the card gate; facts are never fabricated |
