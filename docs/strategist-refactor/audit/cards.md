# Cards phase input audit

Source file: `src/te/ui/CardsPanel.tsx`. Schema: `TeCard`, `ProcedureStep` in `src/te/model/types.ts`.
Every user input in the file appears in the table. No schema field is removed.

Shorthand used in the table:

- **REQ**: blocks the issue gate (`cardIssueBlockers` in `src/te/validate.ts`).
- **PLC**: the gate also rejects an unresolved `[placeholder]` in this field.
- **Fill-src**: picking this drives `linkedRecordFill` (`src/te/state/teStore.ts`).
- **Fill-tgt**: `linkedRecordFill` writes this field when it is empty.
- **Print** = `TestCardPrint`; **DaySheet** = `DaySheetPrint`; **QuickLook** = `QuickLookPrint`; **Exec** = `ExecutePanel`.
- Verdicts use the brief section 2 hierarchy: derive | inherit | default | select | chips | entity-pick | numeric-units | builder | short-text | long-text.

| Existing field | Proposed interaction | Data preserved | Trigger/logic | Downstream use |
|---|---|---|---|---|
| Card list + "+ New card" (`ChipList`; selects `ui.selected.cards`, `addCard`) | Keep. entity-pick list with status pills | n/a (navigation) | Always visible | Selects the record every other input edits |
| "+ From template" (raw `select`; `addCard(t.patch)`) | Keep. select; promote to the primary "start from" action per brief sec 10 | Full template patch | Always visible | Seeds most card fields; vocab: `CARD_TEMPLATES` (`src/te/seed/cardTemplates.ts`) |
| "New card from cell" (raw `select` + Create; `createCardFromMatrixCell`) | Keep. entity-pick; make it the default creation path | `matrixCellId` + linked fill | Only when `campaign.matrix` is non-empty | Store fills links + `linkedRecordFill` |
| Cold reader (`PersonField` `coldReaderBy` + Record check button `coldReaderAt`) REQ | entity-pick person from campaign roster; one "Record check" action stamps name + time together | `coldReaderBy`, `coldReaderAt` | Hidden when card frozen | Gate (Val); Print sign-off block. Needs definition (term of art) |
| Dry-run lead (`PersonField` `dryRunBy` + Record check `dryRunAt`) REQ | Same pattern as cold reader | `dryRunBy`, `dryRunAt` | Hidden when frozen | Gate (Val); Print. Needs definition |
| S1 Title (`TextField` `title`, free text) REQ | derive: compose from linked question + threat + condition; short-text override | `title` | Recompute offer when links change | Val; Print header; chip labels |
| S1 Version (`VersionField` `version`, read-only) | Keep. derive; changes only through Revise | `version` | Always | Print; card identity (`cardCode` + version) |
| S1 Owner (`PersonField` `owner`, free text) | entity-pick from campaign people (`allPeople`) | `owner` | Always | Print control block |
| S1 Approvers (`PersonField` `approvers`, free text single string) | entity-pick multi (chips of people); store joined string, schema unchanged | `approvers` | Always | Print control block |
| S2 Questions (`MultiPicker` `questionIds`) REQ | Keep. entity-pick; offer campaign questions first, seed bank `QUESTION_BANKS` (`src/te/seed/questionBanks.ts`) for new ones | `questionIds` | Pre-checked when created from cell | Val (no orphan runs); Fill-src (purpose); Print traceability |
| S2 Hypotheses (`MultiPicker` `hypothesisIds`) | Keep. entity-pick | `hypothesisIds` | Show after a question is linked | Fill-src (prediction); Print |
| S2 Measures (`MultiPicker` `measureIds`) REQ | Keep. entity-pick; suggest from matrix cell and `MEASURE_DICTIONARY` (`src/te/seed/measureDictionary.ts`) | `measureIds` | Pre-checked from cell | Val; Fill-src (data sources, truth, tolerance); S9 list; event-mark vocab; Print |
| S2 Matrix cell (`SelectField` `matrixCellId`) | entity-pick; prefer creation-time pick, then show as read-only provenance with change action | `matrixCellId` | Hide when card was created from a cell (already set) | Fill-src (question, hypothesis, config, threat, condition, measures, order/blocking); Print |
| S2 Configuration (`SelectField` `configId`) REQ | Keep. entity-pick with frozen-state badge | `configId` | Inherited from cell when set | Val (must exist and be frozen); Fill-src (system state, training); Print |
| S2 Threat (`SelectField` `threatId`) REQ | Keep. entity-pick | `threatId` | Inherited from cell | Val; Fill-src (red fields, blinding); suggestions for S6, S18, S19; Print |
| S2 Condition (`SelectField` `conditionId`) REQ | Keep. entity-pick | `conditionId` | Inherited from cell | Val; Fill-src (condition note); S18/S19 suggestions; Print |
| S3 Purpose (`TextField` `purpose`, 2 rows, free text) REQ PLC | inherit from linked question wording (already a Fill-tgt); long-text edit kept | `purpose` | Offer fill when question links | Val; Print; diagnostic-card seed |
| S3 Why this is the highest-value next run (`TextField` `whyHighestValueNext`, free text) | select reason chips (closes largest evidence gap / unblocks other runs / decision deadline / cheapest discriminator / perishable access) + optional short-text note. Merge with Priority reason | `whyHighestValueNext` | Always; example needed | Print |
| S3 Result that could change the decision (`TextField` `resultThatCouldChangeDecision`, free text) | inherit from `campaign.decision.resultThatChangesChoice` (already Fill-tgt); confirm, do not retype | `resultThatCouldChangeDecision` | Offer when decision record exists | Print. Needs example |
| S3 Prediction (`TextField` `prediction`, free text) PLC | builder from linked hypothesis (`predictedValue` + `producesBehavior`, already Fill-tgt); editable result | `prediction` | Show after hypothesis links | Val (PLC); Print |
| S3 Changed factor (`SelectField` `changedFactor`) | Keep. select from independent-variable factor names | `changedFactor` | Show only when IV factors exist | Print |
| S4 Repetition number (`NumberField` `repetitionNumber`) | numeric-units (count); part of one "sampling plan" builder | `repetitionNumber` | Always | DaySheet; Print |
| S4 Minimum valid sample (`NumberField` `minValidSample`) | numeric-units (count) in the same sampling builder; needs definition | `minValidSample` | Always | DaySheet; Print |
| S4 Priority reason (`TextField` `priorityReason`, free text) | Merge into the S3 "why this run next" decision (see merge candidates) | `priorityReason` | Always | Print |
| S4 Order and blocking (`TextField` `orderAndBlocking`, free text) Fill-tgt | inherit from matrix cell `orderOrBlock`; else builder: order (randomized / restricted) + blocking chips (day, operator, threat article, weather, none) | `orderAndBlocking` | Fill when cell links; needs example | Print |
| S5 System state (`TextField` `systemStateNote`, 2 rows) Fill-tgt | inherit from config (name, version, settings and modes); override allowed with provenance | `systemStateNote` | Fill when config links | Exec run-brief display; Print |
| S5 Operators (`PersonField` `operators`, free text) | entity-pick multi from people | `operators` | Always | Print |
| S5 Training state (`TextField` `trainingState`, free text) Fill-tgt | inherit from config `operatorsAndTraining` | `trainingState` | Fill when config links | Print |
| S6 Red initial state (`TextField` `redInitialState`, 2 rows) PLC | builder: threat profile (inherited) + geometry numeric-units (route, altitude, speed, approach aspect) | `redInitialState` | Section shows only when `threatId` set | Val (PLC); Exec run-brief; Print |
| S6 Red-controlled variables (`TextField` `redControlled`, free text) Fill-tgt | inherit from threat `redControlledVariables`; render as chips | `redControlled` | Fill when threat links | Print |
| S6 Red fixed variables (`TextField` `redFixed`, free text) Fill-tgt | inherit from threat `redFixedVariables`; chips | `redFixed` | Fill when threat links | Print |
| S6 Blinding and information control (`TextField` `blinding`, free text) Fill-tgt | inherit from threat `blinding`; needs definition + example | `blinding` | Fill when threat links | Print |
| S6 Invalidating red deviations (`SuggestField` `invalidatingRedDeviations`, free text) | chips from threat `prohibitedActions` + `adaptationRules[].trigger` + free-add | `invalidatingRedDeviations` | Suggestions appear when threat links | Print |
| S6 Reset before repeat (`TextField` `resetBeforeRepeat`, free text) | chips from a standard reset checklist + free-add; needs example | `resetBeforeRepeat` | Show when repetitionNumber > 1 or minValidSample > 1 | Print |
| S7 Condition notes (`TextField` `conditionNote`, 2 rows) Fill-tgt | inherit from condition (name, weather and illumination, EM environment) | `conditionNote` | Fill when condition links | Exec run-brief; Print |
| S7 Operating limits (`TextField` `operatingLimits`, free text) Fill-tgt | inherit from active authorities' `operatingLimits`; read-only with provenance + override | `operatingLimits` | Fill when active authorities exist | Print |
| S8 Independent variables (`MultiPicker` `independentFactorIds`) | Keep. entity-pick filtered to class `independent-variable` | `independentFactorIds` | Show only classes with members | Print |
| S8 Held controls (`MultiPicker` `heldFactorIds`) | Keep. entity-pick, class `held-control`; label rewrite needed | `heldFactorIds` | Same | Print |
| S8 Recorded covariates (`MultiPicker` `covariateFactorIds`) | Keep. entity-pick, class `recorded-covariate`; needs definition | `covariateFactorIds` | Same | Print |
| S9 Card-local measures note (`TextField` `measuresNote`, 2 rows) | long-text, justified (expert caveat on how a measure applies to this run); optional, collapsed by default | `measuresNote` | Show only when measures are linked | Print |
| S10 Data sources (`TextField` `dataSources`, 2 rows) Fill-tgt | inherit from linked measures' truth sources (primary + backup); chips with provenance | `dataSources` | Fill when measures link | Print |
| S10 Ground truth (`TextField` `groundTruth`, 2 rows) Fill-tgt | inherit from measures (`truth.primarySource` + `independenceFromSut`); label rewrite to "Truth source" | `groundTruth` | Fill when measures link | Print |
| S10 Common time and tolerance (`TextField` `commonTimeAndTolerance`, free text) Fill-tgt | derive: tightest `truth.timeToleranceS` across linked measures; numeric-units override | `commonTimeAndTolerance` | Fill when any measure has a tolerance | Print |
| S10 Monitoring and fallback (`TextField` `monitoringAndFallback`, free text) | select monitor role (RUN_ROLES) + short-text fallback action; needs example | `monitoringAndFallback` | Always | Print |
| S10 Event marks (`LineChecklist` `eventMarks`: checkbox vocab + free-add row) | Keep. chips: `DEFAULT_EVENT_MARKS` (CardsPanel) + `GENERIC_MARKS` (`src/te/seed/constants.ts`) + measure `startEvent`/`stopEvent`; free-add stays | `eventMarks` (string[]) | Measure events appear when measures link | Exec tap buttons; QuickLook event table; Print |
| S11 Required state before start (`LineChecklist` `preconditions`) | derive rows from authority register (`authorityType: status`, live status); chips + free-add | `preconditions` (string[]) | Authority rows appear when authorities exist | Print |
| S12 Start call (`SuggestField` `siteCalls.start`, free text) | default "START RUN"; select from range SOP + prior cards; free override rare | `siteCalls.start` | Default on create (store copies last card) | Print comms block |
| S12 Pause call (`SuggestField` `siteCalls.pause`) | default "HOLD"; same pattern | `siteCalls.pause` | Same | Print |
| S12 Stop call (`SuggestField` `siteCalls.stop`) | default "STOP STOP STOP"; same pattern | `siteCalls.stop` | Same | Print |
| S12 Abort call (`SuggestField` `siteCalls.abort`) | default "ABORT ABORT ABORT"; same pattern | `siteCalls.abort` | Same | Print |
| S12 Pre-event margin (s) (`NumberField` `preEventMarginS`) | numeric-units with default; needs definition | `preEventMarginS` | Always | Print recording block |
| S12 Post-event margin (s) (`NumberField` `postEventMarginS`) | numeric-units with default | `postEventMarginS` | Always | Print |
| S12 Step action (raw `textarea` per `ProcedureStep.action`) REQ | short-text, justified; seed steps from `CARD_TEMPLATES`; keep + step, reorder, delete row controls | `procedure[].action` | Row exists per step | Val (no empty action, at least one step); Exec step list; Print procedure table |
| S12 Step role (`SelectField` `ProcedureStep.role`) | Keep. select from `RUN_ROLES` (`src/te/model/types.ts`) | `procedure[].role` | Per step | Print |
| S12 Complete when (raw `input` `ProcedureStep.observableCompletion`) REQ | short-text, justified; suggestion patterns ("X reports Y", "log shows Z"); needs example | `procedure[].observableCompletion` | Per step | Val; Print |
| S12 INV (checkbox `ProcedureStep.canSilentlyInvalidate`) | Keep. checkbox; needs definition (label rewrite) | `procedure[].canSilentlyInvalidate` | Per step | Print flag column |
| S12 REC (checkbox `ProcedureStep.isRecorderStartStop`) | Keep. checkbox; needs definition | `procedure[].isRecorderStartStop` | Per step | Print flag column |
| S13 Nominal behavior (`TextField` `expectedResult`, 2 rows) PLC | builder from prediction + linked measures; editable result | `expectedResult` | Show after prediction set | Val (PLC); Print |
| S13 Known expected artifacts (`TextField` `knownArtifacts`, free text) | chips from threat/condition known-artifact lists + free-add; needs definition + example | `knownArtifacts` | Always | Print |
| S14 Safety and regulatory stops (`TextField` `safetyStops`, 2 rows) | inherit from authority operating limits + range SOP chips; free-add | `safetyStops` | Fill offer when authorities exist | Print stop block |
| S14 Data and equipment stops (`TextField` `dataEquipmentStops`, 2 rows) | chips from a standard stop taxonomy (truth loss, recorder failure, time-sync loss) + free-add | `dataEquipmentStops` | Always | Print |
| S14 Safe state (`TextField` `safeState`, free text) | short-text, justified (site and system specific); suggestions from prior cards | `safeState` | Always | Print |
| S14 Restart authority (`SuggestField` `restartAuthority`, free text) | entity-pick person or role (people + `RUN_ROLES`) | `restartAuthority` | Always | Print |
| S14 Run-specific hold conditions (`TextField` `holdConditions`, 2 rows) | short-text, justified (genuinely run-specific) with weather/spectrum chips first | `holdConditions` | Always | Print |
| S15 Required validity conditions (`TextField` `requiredValidityConditions`, 2 rows) | structured rows (builder): condition + effect=required; reuse downstream in run validity review | `requiredValidityConditions` | Always; example needed | Print; referenced by execute-phase validity judgment |
| S15 Invalidating failures (`TextField` `invalidatingFailures`, 2 rows) | structured rows: condition + effect=invalidates; chips from instrumentation-failure taxonomy | `invalidatingFailures` | Always | Print |
| S15 Conditional uses (`TextField` `conditionalUses`, 2 rows) | long-text, justified (expert judgment on partial evidence); needs definition + example | `conditionalUses` | Always | Print |
| S16 Required files (`SuggestField` `requiredFiles`, 2 rows) | chips from `DATA_STANDARDS` (`src/te/seed/constants.ts`) + measure sources + prior cards; free-add | `requiredFiles` | Always | QuickLook checklist; Print |
| S16 Storage path (`SuggestField` `storagePath`, free text) | derive from campaign naming convention (pattern with `cardCode`); short-text override | `storagePath` | Always | Print |
| S18 Allowed conclusion (`SuggestField` `allowedConclusion`, 2 rows) | inherit seed from threat/condition `permittedGeneralization`; long-text edit kept (scope statements are expert judgment) | `allowedConclusion` | Suggestions when threat/condition link | Print evidence-scope block |
| S19 Prohibited conclusion (`SuggestField` `prohibitedConclusion`, 2 rows) | inherit seed from threat/condition `prohibitedGeneralization`; long-text edit kept | `prohibitedConclusion` | Same | Print |
| Canvas frames (`MultiPicker` `frameIds`) | Keep. entity-pick from `campaign.frames` | `frameIds` | Show only when frames exist | Board frame links on the printed card |

Notes on non-field inputs: Auto-fill from design, Refill from linked records, Issue card, Revise, and Print are actions, not data fields. `claimIds` exists in the schema and prints, but the panel has no editor for it today; the redesign should give it the same entity-pick as questions.

## Derivable/inheritable

Already wired through `linkedRecordFill` and should become visible inheritance with provenance, not blank text boxes: `purpose`, `resultThatCouldChangeDecision`, `prediction`, `orderAndBlocking`, `systemStateNote`, `trainingState`, `redControlled`, `redFixed`, `blinding`, `conditionNote`, `operatingLimits`, `dataSources`, `groundTruth`, `commonTimeAndTolerance`. New derivations: `title` (compose from links), `storagePath` (naming convention), `preconditions` (authority register rows), `commonTimeAndTolerance` (min measure tolerance, already computed). The UI change is to show the source record and an override affordance instead of relying on the Auto-fill button.

## Selectable (vocab source)

- People fields (`owner`, `approvers`, `operators`, `coldReaderBy`, `dryRunBy`, `restartAuthority`): campaign roster via `allPeople` (`src/te/ui/help.ts`); make them true pickers, not free-typed names.
- `procedure[].role`: `RUN_ROLES` (`src/te/model/types.ts`).
- `eventMarks`: `DEFAULT_EVENT_MARKS` (CardsPanel) + `GENERIC_MARKS` (`src/te/seed/constants.ts`) + measure start/stop events.
- `requiredFiles`: `DATA_STANDARDS` (`src/te/seed/constants.ts`).
- `changedFactor`, S8 pickers: campaign factor register by `FactorClass`.
- `invalidatingRedDeviations`: threat `prohibitedActions` + `adaptationRules[].trigger`.
- `allowedConclusion` / `prohibitedConclusion`: threat/condition `permittedGeneralization` / `prohibitedGeneralization`.
- New questions/measures during card work: `QUESTION_BANKS` (`src/te/seed/questionBanks.ts`), `MEASURE_DICTIONARY` (`src/te/seed/measureDictionary.ts`).
- Card creation: `CARD_TEMPLATES` (`src/te/seed/cardTemplates.ts`) and matrix cells.

## Conditional

- S6 Threat state: show only when `threatId` is set.
- S7: show only when `conditionId` is set; S8 pickers: show only factor classes that have members.
- Changed factor: show only when independent-variable factors exist.
- Reset before repeat: show only when the sampling plan asks for more than one attempt.
- Matrix cell picker: hide (show provenance) when the card was created from a cell.
- Issue-gate block and check buttons: already hidden when frozen; keep.
- S17 Deviations and runs: show only after runs exist (currently prints an empty-state line; collapse instead).
- Measure-derived suggestions (marks, data sources, tolerance): appear only after measures link.

## Justified free text

- `procedure[].action` and `observableCompletion`: real procedures are site-specific; templates seed them.
- `safeState`, `holdConditions`: genuinely run- and site-specific.
- `measuresNote`, `conditionalUses`: expert caveats; keep long-text, collapsed and optional.
- `allowedConclusion`, `prohibitedConclusion`: evidence-scope statements need expert wording; inherited seeds reduce typing.
- `monitoringAndFallback` fallback half: short-text after a role select.
- Free-add rows on `eventMarks` and `preconditions`: keep; the vocabulary cannot be closed.

## Merge candidates

- `whyHighestValueNext` + `priorityReason` -> one "Why run this next?" decision: reason chips + one optional note. Both schema fields stay; the builder writes both.
- `repetitionNumber` + `minValidSample` + `orderAndBlocking` -> one sampling-plan builder (attempt number, valid runs needed, order, blocking).
- `systemStateNote` + `operators` + `trainingState` -> one "System and crew" inherited block from the configuration record with per-field override.
- `redControlled` + `redFixed` + `invalidatingRedDeviations` (+ `blinding`) -> one "Red freedoms and limits" block inherited from the threat record.
- `dataSources` + `groundTruth` + `commonTimeAndTolerance` -> one "Truth and timing" block derived from linked measures.
- `safetyStops` + `dataEquipmentStops` + `holdConditions` -> one stop/hold list where each row carries a class (safety, data, hold).
- `requiredValidityConditions` + `invalidatingFailures` + `conditionalUses` -> one validity-rules list where each row carries an effect (required, invalidates, conditional).
- Cold-reader and dry-run name + timestamp pairs -> one "Record check" action each that stamps person and time in one step.

## Ambiguous labels needing plain-language rewrite

- "Why this is the highest-value next run" -> "Why run this next?"
- "Result that could change the decision" -> "What result would change the customer's choice?"
- "Changed factor" -> "Which one factor does this run change?"
- "Repetition number" -> "This is attempt number"
- "Minimum valid sample" -> "Valid runs needed before we can score"
- "Order and blocking" -> "Run order and grouping"
- "Blinding and information control" -> "Who is kept unaware, and of what?"
- "Invalidating red deviations" -> "Red actions that void the run"
- "Reset before repeat" -> "What must reset before the next attempt?"
- "Independent variables" -> "Factors this run changes"
- "Held controls" -> "Factors held constant"
- "Recorded covariates" -> "Conditions we record but do not control"
- "Ground truth" -> "Truth source" (also required by deliverable verbiage rules: do not use "ground truth")
- "Common time and tolerance" -> "Shared clock and allowed time error"
- "Monitoring and fallback" -> "Who watches the data live, and what happens if it fails?"
- "Pre-event margin (s)" -> "Seconds recorded before the event"
- "Post-event margin (s)" -> "Seconds recorded after the event"
- "INV" -> "Can silently void the run" (tooltip; keep the short column head)
- "REC" -> "Recorder start/stop step" (tooltip)
- "Complete when" -> "Done when you can observe..."
- "Known expected artifacts" -> "Expected data quirks that are not failures"
- "Conditional uses" -> "When a flawed run still counts, and for what"
- "Allowed conclusion" -> "This evidence can support"
- "Prohibited conclusion" -> "This evidence must not be read as"
- "Cold reader" -> keep the term; add definition: "Someone who did not write the card reads it cold and flags anything unclear."
