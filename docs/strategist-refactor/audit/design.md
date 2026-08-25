# Design phase field audit (src/te/ui/DesignPanel.tsx)

Scope: every user input in `DesignPanel.tsx` (tabs: Questions, Hypotheses, Measures, Threats, Conditions, Configs, Factors, Matrix, Gate). Schema: `src/te/model/types.ts`. Gates: `src/te/validate.ts` (`designLint`, `cardIssueBlockers`, `closeoutBlockers`) and `src/te/state/teStore.ts` (`approveDesign`, `issueCard`, `linkedRecordFill`). Line references are as of 2026-08-25.

Counts: 131 schema-backed data fields, plus 3 creation pickers, 2 routing selects, 3 ephemeral calculator inputs, and 9 action buttons. 82 of the 131 fields are free text today (TextField, SuggestField, PersonField). The proposal keeps 24 as typed text.

Notation in the table:

- Existing field: UI label, then `Type.property`, then current kit control. `FT` marks free text today.
- Proposed interaction: verdict from the brief section 2 hierarchy (derive, inherit, default, select, chips, entity-pick, numeric-units, builder, short-text, long-text), then the control and vocabulary source. `EX` = needs an inline example. `DEF` = needs a definition tooltip.
- Gate marks in Trigger/logic: `LINT` = designLint warning, `CARD` = cardIssueBlockers, `CLOSE` = closeoutBlockers. The design gate itself only requires `qualificationPassedAt` plus acknowledged warnings.

| Existing field | Proposed interaction | Data preserved | Trigger/logic | Downstream use |
|---|---|---|---|---|
| **Questions tab (TeQuestion)** | | | | |
| + From question bank (raw `select` in `Field`) | select; keep and promote to the primary add path; vocab `QUESTION_BANKS` (seed/questionBanks.ts) | writes `wording` on a new record | always visible | seeds wording only |
| Wording (bounded and answerable) `TeQuestion.wording` TextField FT | builder: pattern-driven sentence builder with editable output; slots suggest from `QUESTION_BANKS`; EX | string unchanged; builder renders to the same field | LINT vague-term check stays live in the builder; builder template follows `pattern` | designLint, matrix and card option labels, DeliverPanel exec summary, `linkedRecordFill` fills `card.purpose`, AnalyzePanel labels, TestCardPrint via card |
| Priority `TeQuestion.priority` Seg | select; keep segmented P1 to P3; DEF (HELP `question-priority` exists) | enum unchanged | none | DeliverPanel summary line |
| Pattern `TeQuestion.pattern` SelectField | select: radio with a one-line definition per option; enum `QuestionPattern` (types.ts); DEF | enum unchanged | drives the wording builder template | UI only today |
| Required answer date `TeQuestion.requiredAnswerDate` DateField | inherit: default from `charter.requestedDecisionDate` or `decision.decisionDate`, editable date with provenance | string unchanged | none | record only |
| Current evidence state `TeQuestion.currentEvidenceState` TextField FT | select (none, vendor claim only, prior test, model only, operational report) plus optional note; EX | string unchanged; select writes canonical text | none | record only |
| Consequence if unanswered `TeQuestion.consequenceIfUnanswered` TextField FT | short-text with example; EX | string unchanged | none | record only |
| Evidence authority `TeQuestion.evidenceAuthority` SuggestField FT (autofills from charter on blur) | inherit: show `charter.evidenceAcceptanceAuthority` as a provenance chip; entity-pick from `allPeople(campaign)` to override | string unchanged | autofill logic already exists; make it visible | record only |
| Frozen `TeQuestion.frozen` CheckField | keep checkbox with the existing consequence sentence | boolean unchanged | freezing locks the ranked set by doctrine | record only |
| Disposition (set at closeout) `TeQuestion.disposition` SelectField | select; conditional: hide until the campaign reaches Analyze | enum or null unchanged | CLOSE requires a disposition; also edited in DeliverPanel (duplicate entry point) | closeoutBlockers, DeliverPanel |
| Evidence level reached `TeQuestion.evidenceLevel` SelectField | select; conditional with disposition; enum `EvidenceLevel`; DEF | enum or null unchanged | show only at closeout | record only |
| Disposition note `TeQuestion.dispositionNote` TextField FT | short-text; conditional with disposition | string unchanged | show only at closeout | DeliverPanel duplicate entry |
| **Hypotheses tab (TeHypothesis)** | | | | |
| Question for new hypotheses (routing SelectField, not persisted) | inherit: default from `ui.selected.questions`; confirm, do not re-ask | n/a | hidden when only one question exists | routes `addHypothesis(questionId)` |
| Parent question `TeHypothesis.questionId` SelectField | entity-pick; default inherited from creation context | id unchanged | none | traceability chain, matrix cell options |
| Under conditions `TeHypothesis.underConditions` SuggestField FT | entity-pick chips from `campaign.conditions` and `campaign.threats` names (suggestions already exist) | string unchanged; chips write names | sentence preview exists; keep it | rendered sentence only |
| Produces behavior `TeHypothesis.producesBehavior` TextField FT | builder slot; short-text with verb suggestions from `MEASURE_DICTIONARY` names; EX | string unchanged | none | chip labels, matrix hypothesis options, `linkedRecordFill` fills `card.prediction` |
| Measured by `TeHypothesis.measuredBy` SuggestField FT | entity-pick from `campaign.measures` plus `MEASURE_DICTIONARY` | string unchanged | picking a measure feeds the Relative to derivation | rendered sentence |
| Relative to `TeHypothesis.relativeTo` SuggestField FT | derive from the picked measure threshold and unit (current suggestion becomes an autofill with provenance) | string unchanged | conditional: only when the measure has a threshold | rendered sentence |
| Predicted value `TeHypothesis.predictedValue` TextField FT | numeric-units keyed to prediction type: single number, min-max pair, or direction select; EX | string unchanged; structured input renders to string | LINT: empty prediction warns; input shape follows `predictionType` | designLint, `linkedRecordFill` fills `card.prediction` |
| Prediction type `TeHypothesis.predictionType` SelectField | select: radio with definitions; enum `PredictionType`; DEF | enum unchanged | trigger: controls the predicted-value input shape | UI only |
| Expected variability `TeHypothesis.expectedVariability` TextField FT | short-text with example; EX | string unchanged | none | record only |
| Result that supports `TeHypothesis.supportingResult` TextField FT | derive: draft from measure, threshold, and `higherIsBetter`; editable long-text | string unchanged | generated draft marked as draft until accepted | record only |
| Result that refutes `TeHypothesis.refutingResult` TextField FT | derive: mirror of the supporting draft; editable; EX | string unchanged | LINT: empty refuting result warns | designLint |
| Result that is inconclusive `TeHypothesis.inconclusiveResult` TextField FT | default: interval-straddles-threshold wording; editable | string unchanged | none | record only |
| Null hypothesis `TeHypothesis.nullHypothesis` TextField FT | default: "no difference from baseline" variant per prediction type; editable short-text; DEF | string unchanged | none | record only |
| Competing explanations `TeHypothesis.competingExplanations` TextField FT | chips from factors classified `unobserved-nuisance` plus custom entries | string unchanged; chips join to string | none | record only |
| Assumptions `TeHypothesis.assumptions` TextField FT | entity-pick: link register entries (`RegisterKind` 'assumption'); brief section 14 | string field stays; add links via the register, keep text for legacy | none | record only |
| **Measures tab (TeMeasure)** | | | | |
| Question for new measures (routing SelectField, not persisted) | inherit from selection context; confirm, do not re-ask | n/a | hidden when only one question exists | routes `addMeasure(questionId)` |
| + From dictionary (raw `select`) | select; keep and make it the primary path; vocab `MEASURE_DICTIONARY` (seed/measureDictionary.ts) | applies 12 fields in one pick | disabled without a target question (exists) | seeds most measure fields |
| Name `TeMeasure.name` SuggestField FT | select from dictionary, then override; short-text for custom measures | string unchanged | none | all labels, TestCardPrint S9, QuickLookPrint, exportCsv |
| Family `TeMeasure.family` SelectField | derive from dictionary entry; select fallback; enum `MeasureFamily`; DEF | enum unchanged | trigger: binomial shows interval method; binomial, rate, probability show numerator and denominator | calc/measures interval logic |
| Measure type `TeMeasure.measureType` SelectField | derive from dictionary; select fallback; enum `MeasureType`; DEF | enum unchanged | none | calc/measures |
| Exact definition `TeMeasure.exactDefinition` TextField FT | inherit from dictionary; long-text expert edit behind an edit action | string unchanged | none | record and print definitions |
| Unit `TeMeasure.unit` SuggestField FT | select combobox: dictionary units plus s, m, nm, ft, %, count | string unchanged | none | TestCardPrint S9, DeliverPanel, hypothesis Relative to suggestions |
| Numerator rule `TeMeasure.numeratorRule` TextField FT | inherit from dictionary; conditional; long-text edit for custom measures | string unchanged | show only for binomial, rate, probability families | record only |
| Denominator rule `TeMeasure.denominatorRule` TextField FT | same as numerator rule | string unchanged | same condition | record only |
| Start event `TeMeasure.startEvent` SuggestField FT | select combobox from dictionary start events plus `GENERIC_MARKS` (seed/constants.ts) | string unchanged | conditional: latency and time-to-event families | CardsPanel mark vocabulary (line 215) |
| Stop event `TeMeasure.stopEvent` SuggestField FT | same as start event | string unchanged | same condition | CardsPanel mark vocabulary |
| Experimental unit `TeMeasure.experimentalUnit` SuggestField FT | select from a small vocab (engagement, run, track, sortie, day) plus custom; DEF | string unchanged | none | DeliverPanel caveat text (line 105) |
| Primary source `TeMeasure.truth.primarySource` SuggestField FT | entity-pick from an instrumentation source list built from existing truth sources | string unchanged | LINT: empty primary source warns | designLint, chainHealth, `linkedRecordFill` fills `card.dataSources` and `card.groundTruth` |
| Backup source `TeMeasure.truth.backupSource` SuggestField FT | same entity-pick | string unchanged | none | `linkedRecordFill` `card.dataSources` |
| Independence from the system under test `TeMeasure.truth.independenceFromSut` TextField FT | select (fully independent, shares components, derived from the tested system) plus note; DEF | string unchanged | none | `linkedRecordFill` `card.groundTruth` |
| Time tolerance (s) `TeMeasure.truth.timeToleranceS` NumberField | numeric-units; keep; default from dictionary | number or null unchanged | none | `linkedRecordFill` `card.commonTimeAndTolerance` |
| Missing-data rule `TeMeasure.missingDataRule` TextField FT | select from standard rules plus custom short-text | string unchanged | none | record only |
| Invalid-data rule `TeMeasure.invalidDataRule` TextField FT | same | string unchanged | none | record only |
| Censoring rule `TeMeasure.censoringRule` TextField FT | select plus custom; conditional; DEF | string unchanged | show only for latency and time-to-event families | record only |
| Threshold `TeMeasure.threshold` NumberField | numeric-units; keep | number or null unchanged | trigger: a value reveals threshold source and approval; LINT: threshold without source warns | calc/measures pass or fail, TestCardPrint S9, hypothesis suggestions |
| Objective `TeMeasure.objective` NumberField | numeric-units; keep | number or null unchanged | none | TestCardPrint S9 |
| Failure boundary `TeMeasure.failureBoundary` NumberField | numeric-units; advanced tier; DEF | number or null unchanged | conditional: advanced disclosure | record only |
| Threshold source `TeMeasure.thresholdSource` SelectField | select; conditional; enum `ThresholdSource`; DEF | enum or null unchanged | show only when a threshold is set; LINT pairs with threshold | designLint |
| Threshold customer-approved `TeMeasure.thresholdApproved` CheckField | checkbox; keep; conditional on threshold; DEF | boolean unchanged | gates the pass or fail verdict display | calc/measures suppresses pass or fail without it |
| Higher is better `TeMeasure.higherIsBetter` CheckField | derive from dictionary; checkbox fallback | boolean unchanged | none | calc/measures verdict direction |
| Required repetitions `TeMeasure.requiredRepetitions` NumberField | derive: accept button from the sample-size helper; numeric override | number or null unchanged | none | reference for matrix minimums |
| Interval method `TeMeasure.intervalMethod` Seg | select; conditional; default wilson; DEF | enum unchanged | show only for binomial family; bayes reveals priors (exists) | calc/measures interval computation |
| Prior alpha `TeMeasure.priorAlpha` NumberField | numeric; keep; already conditional on bayes | number unchanged | bayes only (exists) | calc/measures `betaPosterior` |
| Prior beta `TeMeasure.priorBeta` NumberField | same | number unchanged | same | same |
| Frozen `TeMeasure.frozen` CheckField | keep as an explicit action with consequence text | boolean unchanged | CARD: unfrozen linked measures block card issue | cardIssueBlockers |
| **Threats tab (TeThreatProfile)** | | | | |
| + From seeded vignette (raw `select`) | select; keep and promote; vocab `THREAT_VIGNETTES` (seed/vignettes.ts) | applies a vignette patch | always visible | seeds most threat fields |
| Name `TeThreatProfile.name` SuggestField FT | entity-pick from vignettes and board UAS library; short-text for custom | string unchanged | none | labels everywhere, AnalyzePanel, ExecutePanel |
| Version `TeThreatProfile.version` VersionField | derive; keep bump-only control | string unchanged | none | chip labels, doctrine versioning |
| Missions represented `TeThreatProfile.missions` MultiPicker | multi-select; keep; enum `ThreatMissionKind` | array unchanged | none | record only |
| UAS group `TeThreatProfile.uasGroup` Seg | derive from the linked board model; segmented fallback; DEF (group size table) | number unchanged | fills when Board model links | record only |
| Airframe `TeThreatProfile.airframe` SuggestField FT | select chips (quad, fixed-wing, vtol, one-way-attack, fpv) plus custom; derive via fill-from-model | string unchanged | fill-from-model overwrites (exists) | record only |
| Board model `TeThreatProfile.specModelId` SelectField | entity-pick from `Scenario.library` UAS models; keep | id or null unchanged | trigger: reveals the fill-from-model action | links the board picture to the profile |
| Navigation mode `TeThreatProfile.navMode` SelectField | select; keep; local `NAV_MODES` list (promote to a shared seed constant); derive from the linked model when set | string unchanged | none | record only |
| Fill airframe and bands from model (button) | derive action; keep; add provenance marks on filled fields | writes airframe, speed band, alt band | visible only with a linked model (exists) | n/a |
| Speed band min and max (m/s) `TeThreatProfile.speedBandMps` two raw number inputs | numeric-units: one min-max range control; derive from the linked model; keep the clamp-on-blur logic | tuple unchanged | fill-from-model derives it | record only |
| Altitude band min and max (ft) `TeThreatProfile.altBandFt` two raw number inputs | numeric-units range; derive from model; label as recorded, not modeled (plan-view app) | tuple unchanged | fill-from-model derives it | record only |
| Emissions summary `TeThreatProfile.emissionsSummary` TextField FT | short-text with band chips (2.4 GHz, 5.8 GHz, silent); EX | string unchanged | none | record only |
| Count `TeThreatProfile.count` NumberField | numeric; keep | number unchanged | trigger: count above 1 reveals raid note | record only |
| Raid note `TeThreatProfile.raidNote` TextField FT | short-text; conditional | string unchanged | show only when count above 1 | record only |
| Operator state note `TeThreatProfile.operatorStateNote` TextField FT | short-text with example; EX | string unchanged | none | record only |
| Representation class `TeThreatProfile.representationClass` SelectField | select: radio with definitions; enum `RepresentationClass`; DEF | enum unchanged | trigger: anything other than actual-threat reveals the fidelity grid | record only |
| Profile class `TeThreatProfile.profileClass` Seg | select; keep segmented; add definitions; DEF | enum unchanged | none | record only |
| OPFOR mode `TeThreatProfile.opforMode` Seg with help line | select; keep (per-option help exists) | enum unchanged | trigger: bounded-adaptive and free-play reveal adaptation rules; scripted hides them | record only |
| Fidelity grid: Feature `FidelityRow.feature` SuggestField FT | builder table; feature select from vocab (emissions, speed, payload, nav) plus custom | row array unchanged | rows exist only when representation is not actual-threat | record only |
| Fidelity grid: Intended `FidelityRow.intendedState` TextField FT | short-text inside the builder row | unchanged | same | record only |
| Fidelity grid: Represented `FidelityRow.representedState` TextField FT | short-text inside the builder row | unchanged | same | record only |
| Fidelity grid: Level `FidelityRow.level` SelectField | select; keep; enum `FidelityLevel` | unchanged | same | record only |
| Fidelity grid: Likely effect `FidelityRow.likelyEffect` TextField FT | short-text; EX | unchanged | same | record only |
| Adaptation rule: Trigger `AdaptationRule.trigger` TextField FT | builder table; short-text; EX (the "never write: act realistically" note exists) | row array unchanged | rows show only for bounded-adaptive and free-play | CardsPanel invalidating-deviation suggestions |
| Adaptation rule: Allowed response `AdaptationRule.allowedResponse` TextField FT | short-text inside the builder row; EX | unchanged | same | record only |
| Red-controlled variables `TeThreatProfile.redControlledVariables` SuggestField FT | chips entity-pick from factors classified `bounded-red-choice` (suggestions exist) | string unchanged; chips join to string | none | `linkedRecordFill` fills `card.redControlled` |
| Red fixed variables `TeThreatProfile.redFixedVariables` SuggestField FT | chips from factors classified `held-control` | string unchanged | none | `linkedRecordFill` fills `card.redFixed` |
| Prohibited actions `TeThreatProfile.prohibitedActions` SuggestField FT | chips from factors classified `prohibited-variable` | string unchanged | none | CardsPanel invalidating-deviation suggestions |
| Blinding and information control `TeThreatProfile.blinding` TextField FT | select (none, red blind to blue state, blue blind to schedule, both) plus note; DEF | string unchanged | none | `linkedRecordFill` fills `card.blinding`; TestCardPrint S6 |
| Validation source `TeThreatProfile.validationSource` SuggestField FT | entity-pick from `charter.sourceDocumentsAndPriorEvidence` lines (suggestions exist) | string unchanged | none | record only |
| Permitted generalization `TeThreatProfile.permittedGeneralization` TextField FT | builder sentence ("evidence extends to [threat class] under [conditions]"), editable output | string unchanged | none | CardsPanel allowed-conclusion suggestions, DeliverPanel limitations |
| Prohibited generalization `TeThreatProfile.prohibitedGeneralization` TextField FT | same builder pattern | string unchanged | none | CardsPanel prohibited-conclusion suggestions, DeliverPanel |
| Notes `TeThreatProfile.notes` TextField FT | long-text; justified catch-all | string unchanged | none | record only |
| **Conditions tab (TeCondition)** | | | | |
| Name `TeCondition.name` TextField FT | short-text; keep (record identity) | string unchanged | none | labels, matrix options, `linkedRecordFill` `card.conditionNote` |
| Prefill from board environment (button; also auto-runs on add) | derive; keep; show provenance; the drift warning already exists | writes weather and EM text | drift warning when text differs from the live board | n/a |
| Terrain and clutter `TeCondition.terrainAndClutter` TextField FT | select chips (open, rolling, urban, coastal, mountain) plus note | string unchanged | none | record only |
| Weather and illumination `TeCondition.weatherAndIllumination` TextField FT | derive from `Scenario.environment` (exists); structured numeric-units builder (wind, temperature, precipitation, light) for manual entry | string unchanged | drift check against the board (exists) | `linkedRecordFill` fills `card.conditionNote` |
| EM environment `TeCondition.emEnvironment` TextField FT | select spectrum condition (benign, representative, congested, contested, denied) plus derive from board `emBackground`; DEF | string unchanged | drift check (exists) | `linkedRecordFill` fills `card.conditionNote` |
| Network state `TeCondition.networkState` TextField FT | select (nominal, degraded, denied) plus note | string unchanged | none | record only |
| Background activity `TeCondition.backgroundActivity` TextField FT | short-text with example; EX | string unchanged | none | record only |
| Operator workload `TeCondition.operatorWorkload` TextField FT | select (low, moderate, high, saturated); DEF | string unchanged | none | record only |
| Supporting systems `TeCondition.supportingSystems` TextField FT | entity-pick from board entities and config records | string unchanged | none | record only |
| Degraded modes `TeCondition.degradedModes` TextField FT | chips (GPS denied, comms out, sensor down) plus custom | string unchanged | none | record only |
| Permitted generalization `TeCondition.permittedGeneralization` TextField FT | builder sentence, same pattern as threats | string unchanged | none | CardsPanel and DeliverPanel limitation suggestions |
| Prohibited generalization `TeCondition.prohibitedGeneralization` TextField FT | same | string unchanged | none | same |
| **Configs tab (TeConfigBaseline)** | | | | |
| Duplicate latest baseline (button) | inherit action; keep | copies a record | visible when a baseline exists (exists) | n/a |
| Snapshot board scenario (button) | derive; keep; writes `scenarioSnapshot` plus a drift log entry | JSON snapshot string | size note renders (exists) | evidence of the frozen picture |
| Describe from board (button) | derive; keep; auto-run on create with provenance; fills only empty fields (exists) | writes sensor, C2, effector text | disabled when frozen (exists) | n/a |
| Freeze baseline (button) | action; keep; add a short review summary before freeze (brief section 16) | sets `frozen`, `freezeTime` | CARD: an unfrozen linked baseline blocks card issue; freezing locks identity fields (exists) | cardIssueBlockers |
| Name `TeConfigBaseline.name` TextField FT | short-text; keep | string unchanged | locked when frozen (exists) | labels, `linkedRecordFill` `card.systemStateNote` |
| Version `TeConfigBaseline.version` VersionField | derive; keep bump-only | string unchanged | locked when frozen | `card.systemStateNote` |
| Boundary: inside `TeConfigBaseline.boundaryInside` SuggestField FT | entity-pick from `Scenario.boundaries` names (suggestions exist) | string unchanged | locked when frozen | record only |
| Boundary: excluded `TeConfigBaseline.boundaryExcluded` SuggestField FT | same | string unchanged | same | record only |
| Hardware and serials `TeConfigBaseline.hardwareAndSerials` TextField FT | builder rows (item plus serial); long-text fallback for pasted lists | string unchanged | locked when frozen | record only |
| Software versions `TeConfigBaseline.softwareVersions` TextField FT | builder rows (component plus version) | string unchanged | same | record only |
| Firmware versions `TeConfigBaseline.firmwareVersions` TextField FT | same | string unchanged | same | record only |
| Settings and modes `TeConfigBaseline.settingsAndModes` TextField FT | short-text; keep | string unchanged | same | `linkedRecordFill` fills `card.systemStateNote` |
| Sensor configuration `TeConfigBaseline.sensorConfiguration` TextField FT | derive from board (button exists); make it auto-fill with provenance; edit allowed | string unchanged | describe-from-board fills only when empty (exists) | record only |
| C2 and network configuration `TeConfigBaseline.c2AndNetworkConfiguration` TextField FT | same derive | string unchanged | same | record only |
| Effector configuration `TeConfigBaseline.effectorConfiguration` TextField FT | same derive | string unchanged | same | record only |
| Operators and training `TeConfigBaseline.operatorsAndTraining` SuggestField FT | entity-pick multiple from `allPeople(campaign)` | string unchanged | locked when frozen | `linkedRecordFill` fills `card.trainingState` |
| Procedure version `TeConfigBaseline.procedureVersion` TextField FT | short-text; keep (version id) | string unchanged | same | record only |
| Known defects and waivers `TeConfigBaseline.knownDefectsAndWaivers` TextField FT | builder register rows (defect, waiver state); brief section 14 | string unchanged | same | record only |
| Functional check result `TeConfigBaseline.functionalCheckResult` SuggestField FT | select segmented (pass, pass with notes, fail); the three values are already the suggestions | string unchanged | same | record only |
| Released by `TeConfigBaseline.releasedBy` PersonField FT | entity-pick from people; keep the control, remove free typing to a confirm step | string unchanged | same | record only |
| Drift log: Time (disabled input) | derive; keep read-only | ISO string | rows via + drift entry | record only |
| Drift log: Note `driftLog[].note` TextField FT | short-text; keep (log entry) | string unchanged | none | snapshot audit trail |
| **Factors tab (TeFactor)** | | | | |
| Seed standard covariates (button) | derive; keep; source `STANDARD_COVARIATE_FACTORS` (local const mirroring src/model/seedCards.ts) | creates named factors | skips existing names (exists) | n/a |
| Name `TeFactor.name` SuggestField FT | select combobox: standard covariates, other campaigns' factors, plus the brief section 6 factor list; custom allowed | string unchanged | none | threat red-control suggestions, CardsPanel changed-factor options, hypothesis confound chips |
| Classification `TeFactor.classification` SelectField | select with one-line definitions; enum `FactorClass`; DEF | enum unchanged | trigger: unobserved-nuisance reveals risk statement (exists); independent-variable reveals planned levels | CardsPanel factor id lists, threat red-control chips |
| Planned levels `TeFactor.plannedLevels` TextField FT | chips level builder (one chip per level) | string unchanged | conditional: independent-variable and bounded-red-choice | record only |
| Tolerance and verification `TeFactor.toleranceAndVerification` TextField FT | short-text; conditional; EX | string unchanged | conditional: held-control | record only |
| Risk statement `TeFactor.riskStatement` TextField FT | short-text with example; already conditional; EX | string unchanged | unobserved-nuisance only (exists); the three-outs note stays | record only |
| **Matrix tab (TeMatrixCell)** | | | | |
| Sample-size helper: Expected proportion p (NumberField, ephemeral) | numeric; keep; add an apply-to-cell action | not persisted | live `sampleSizeProportion` output | calc/stats display only |
| Sample-size helper: Half-width h (NumberField, ephemeral) | same | not persisted | same | same |
| Sample-size helper: Valid fraction (NumberField, ephemeral) | same; feeds `attemptInflation` | not persisted | same | same |
| Question `TeMatrixCell.questionId` SelectField | entity-pick; inherit default from the selected question | id unchanged | none | traceability, AnalyzePanel labels, card creation |
| Hypothesis `TeMatrixCell.hypothesisId` SelectField | entity-pick; conditional options filtered to the picked question | id or null unchanged | options follow `questionId` | card creation |
| Configuration `TeMatrixCell.configId` SelectField | entity-pick | id unchanged | none | card creation (`createCardFromMatrixCell`), CARD chain |
| Threat `TeMatrixCell.threatId` SelectField | entity-pick | id unchanged | none | same, ExecutePanel coverage labels |
| Condition `TeMatrixCell.conditionId` SelectField | entity-pick | id unchanged | none | same |
| Method `TeMatrixCell.method` SelectField (open list) | select; keep `MATRIX_METHODS` plus preserved custom values | string unchanged | LINT: the matrix needs one baseline row | designLint, chip labels, exportCsv |
| Measures `TeMatrixCell.measureIds` MultiPicker | multi-select; default inherit the measures of the picked question | array unchanged | none | card creation, coverage |
| Planned reps `TeMatrixCell.plannedReps` NumberField | numeric; derive suggestion from the helper | number unchanged | LINT: fewer reps than minimum valid evidence warns | calc/matrix coverage, calc/accounting, exportCsv, DaySheetPrint |
| Min valid evidence `TeMatrixCell.minValidEvidence` NumberField | derive from the helper or `measure.requiredRepetitions`; numeric override | number unchanged | pairs with planned reps | calc/matrix cell state, ExecutePanel |
| Priority `TeMatrixCell.priority` NumberField | select 1 to 3 or numeric; keep | number unchanged | none | ExecutePanel run ordering |
| Drop order `TeMatrixCell.dropOrder` NumberField | derive from priority rank; numeric override; DEF | number unchanged | none | exportCsv |
| Order or block `TeMatrixCell.orderOrBlock` SuggestField FT | select (randomized, blocked by day, fixed order) plus custom | string unchanged | none | `linkedRecordFill` fills `card.orderAndBlocking` |
| **Gate tab** | | | | |
| Approve design (button) | action; keep; add a generated stage review summary before approval (brief section 16) | sets `designApprovedAt` | requires `qualificationPassedAt`; open designLint warnings show but do not block | phase advance to designed |

## Derivable or inheritable

- Question required answer date, evidence authority: inherit from the charter and decision records. Autofill for evidence authority already exists on blur; surface it as provenance.
- Hypothesis relative to, supporting, refuting, inconclusive results, null hypothesis: derive from the picked measure, threshold, and direction. The three result-mapping texts are one derivation.
- Measure family, type, definition, unit, rules, events, experimental unit, higher-is-better, time tolerance: inherit from `MEASURE_DICTIONARY` on pick. The dictionary path exists; make it primary.
- Threat airframe, speed band, altitude band, UAS group, navigation mode: derive from the linked board model (`fillFromModel` exists; extend it to group and nav mode).
- Condition weather and EM text: derive from `Scenario.environment` (prefill and drift warning exist).
- Config sensor, C2, effector text, snapshot, drift time: derive from the board (buttons exist; auto-run with provenance).
- Matrix min valid evidence and planned reps: derive from the sample-size helper. Add the apply action; the helper currently computes and discards.
- Matrix question, hypothesis, measures: inherit from the selection context and the question's measures.
- Versions, ids, freeze times, drift times: already derived. Keep.

## Selectable (vocab source)

- Question wording seeds: `QUESTION_BANKS` (seed/questionBanks.ts). Pattern: `QuestionPattern` (types.ts). Priority: `QuestionPriority`. Disposition: `QuestionDisposition`. Evidence level: `EvidenceLevel`.
- Hypothesis prediction type: `PredictionType`. Under conditions: campaign conditions and threats. Measured by: campaign measures plus `MEASURE_DICTIONARY`.
- Measure pick: `MEASURE_DICTIONARY` (seed/measureDictionary.ts). Family: `MeasureFamily`. Type: `MeasureType`. Threshold source: `ThresholdSource`. Interval method: `IntervalMethod`. Start and stop events: dictionary events plus `GENERIC_MARKS` (seed/constants.ts).
- Threat pick: `THREAT_VIGNETTES` (seed/vignettes.ts). Missions: `ThreatMissionKind`. Representation: `RepresentationClass`. Fidelity level: `FidelityLevel`. Profile class: `ThreatProfileClass`. OPFOR mode: `OpforMode`. Nav modes and airframes: local consts in DesignPanel.tsx; promote both to seed/constants.ts. Board model: `Scenario.library`.
- Condition spectrum, workload, network: new small vocabularies; add to seed/constants.ts (brief section 6 lists them).
- Config boundaries: `Scenario.boundaries`. People: `allPeople(campaign)`. Functional check: the three existing suggestion values.
- Factor names: `STANDARD_COVARIATE_FACTORS` plus cross-campaign names. Classification: `FactorClass`.
- Matrix method: `MATRIX_METHODS` (local const; promote to seed). Order or block: the three existing suggestion values.

## Conditional

Existing conditions to keep: bayes priors (interval method), risk statement (unobserved-nuisance), fill-from-model (linked model), drift warning (board mismatch), frozen locks (configs), OPFOR help line.

New conditions to add:

- Question disposition block: hide until the campaign reaches Analyze.
- Numerator and denominator rules: binomial, rate, probability families only.
- Start and stop events, censoring rule: latency and time-to-event families only.
- Interval method: binomial family only.
- Threshold source and approval: only when a threshold value is set.
- Raid note: only when count is above 1.
- Fidelity grid: only when representation class is not actual-threat.
- Adaptation rules: only for bounded-adaptive and free-play OPFOR modes.
- Planned levels: independent-variable and bounded-red-choice factors. Tolerance: held-control factors.
- Matrix hypothesis options: filter to the picked question.

## Justified free text

Kept as typed text, with the reason: consequence if unanswered, disposition note (judgment at closeout); hypothesis produces-behavior slot and expected variability (novel claims); measure exact definition, numerator and denominator rules for custom measures (expert definitions the dictionary cannot cover); threat emissions summary, raid note, operator state note, fidelity intended, represented, and likely-effect cells, adaptation trigger and response cells, notes (bounded operational specifics); condition name and background activity; config name, settings and modes, procedure version, drift log note (identity and audit text); factor tolerance and risk statement (engineering judgment). Total kept: 24 of 82.

## Merge candidates

- Hypothesis result mapping: supporting, refuting, and inconclusive results collapse into one decision (pick measure, threshold, direction); the system writes all three texts; expert edit stays.
- Hypothesis prediction: measured by, relative to, predicted value, and prediction type become one prediction builder against a picked measure.
- Threat physical identity: board model pick (or vignette pick) fills airframe, speed band, altitude band, UAS group, and navigation mode; the user overrides only deltas.
- Condition environment: weather, EM, and network state become one decision (adopt board environment, or pick a named preset); the drift check stays.
- Config system description: sensor, C2, and effector text plus boundaries become one describe-from-board action with per-field override.
- Red control trio: red-controlled, red-fixed, and prohibited actions become one classification view over the factor register; the threat record stores the resulting names.
- Sample size: the helper, measure required repetitions, and cell minimum valid evidence become one sample-size decision applied to both records.
- Matrix cell links: question, hypothesis, config, threat, and condition become one guided "add cells" flow driven by the method choice; per-cell edit remains.

## Ambiguous labels needing plain-language rewrite

| Current label | Rewrite |
|---|---|
| Wording (bounded and answerable) | What must this test answer? Use numbers, not adjectives. |
| Pattern | What kind of answer does the customer need? |
| Current evidence state | What evidence exists today? |
| Consequence if unanswered | What happens if we do not answer this? |
| Evidence authority | Who accepts this evidence? |
| Under conditions | When does this hold? Pick the condition and threat. |
| Produces behavior | What will the system do? |
| Relative to | Compared with which limit? |
| Expected variability | How much spread do you expect between runs? |
| Null hypothesis | Which result means no effect? |
| Numerator rule | What counts as a success? |
| Denominator rule | What counts as a valid attempt? |
| Experimental unit | What is one trial? One engagement, one run, or one track. |
| Independence from the system under test | Does the truth source share hardware or software with the tested system? |
| Censoring rule | What do you record when the event never happens? |
| Interval method | How to compute the confidence interval. Wilson is the default. |
| Representation class | What stands in for the real threat? |
| Profile class | Why is this threat in the test? |
| OPFOR mode | How free is the red operator? |
| Blinding and information control | Who is kept from knowing what? |
| Operator state note | Who operates the threat, and at what skill level? |
| Fidelity grid | What differs from the real threat, and what does each difference change? |
| Permitted generalization | What may this evidence support beyond the exact setup? |
| Prohibited generalization | What must nobody claim from this test? |
| Order or block | Run order: randomized, blocked by day, or fixed? |
| Drop order | If time runs out, which cells go first? |
| Min valid evidence | How many valid runs make this cell count? |
| Factors (classify every variable that can move a result) | For each thing that can change a result: vary it, hold it, record it, or forbid it. |
