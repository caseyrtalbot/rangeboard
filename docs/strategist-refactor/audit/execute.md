# Execute panel input audit

Source: `src/te/ui/ExecutePanel.tsx` (tabs: Day, Run console, Checklists, Adjudication).
63 user inputs. 36 are free text today. 20 stay free text in the proposal.
Schema: `src/te/model/types.ts`. Gates: `src/te/validate.ts` and `src/te/state/teStore.ts`.
No schema field is removed.

Legend for the second column: derive, inherit, default, select, chips, entity-pick, numeric-units, builder, short-text, long-text (brief section 2 hierarchy).

| Existing field | Proposed interaction | Data preserved | Trigger/logic | Downstream use |
|---|---|---|---|---|
| **Day tab: record go/no-go** | | | | |
| Scope (`TeGoNoGo.scope`, Seg) | select (keep). Rename to "Which decision is this?". Vocab: `GoNoGoScope` in types.ts | `scope` unchanged | Always visible on Day tab | DaySheetPrint go/no-go table, Day tab history list |
| Decision (`TeGoNoGo.decision`, Seg) | select (keep). Vocab: `GoNoGo` in types.ts | `decision` unchanged | Always visible | DaySheetPrint, Day tab pills, checklist gate outcomes share the vocab |
| Approvers (`TeGoNoGo.approvers`, PersonField, free text) | entity-pick from people register. Default already inherits `decisionRightHolder(campaign, 'daily go/no-go')` | `approvers` string unchanged (picker writes the same string) | Default from decision-rights row; editable | DaySheetPrint, `allPeople` pool |
| Note (`TeGoNoGo.note`, TextField, free text) | short-text (keep, optional) | `note` unchanged | Optional | DaySheetPrint, Day tab history |
| **Run console: start a run** | | | | |
| Issued card (`TeRun.cardId` via `createRunFromCard`, SelectField) | entity-pick (keep). Default to the card of the highest-priority thin matrix cell (Day tab already computes `nextCells`) | `cardId`, `cardVersion`, `matrixCellId`, `plannedPurpose` copied from card | GATE: `canStartRun` blocks unless card status is `issued` (pocket rule 6) | calc/matrix coverage, calc/accounting, RunRecordPrint, Analyze |
| **Run console: run roles** | | | | |
| Role (`TeRun.roles[i].role`, SelectField) | select (keep). Vocab: `RUN_ROLES` in types.ts | `roles[i].role` unchanged | Row added by "+ role" | RunRecordPrint roles table |
| Person (`TeRun.roles[i].person`, PersonField, free text) | entity-pick from people register. Auto-prefill from last run of the same card (the "Copy roles" button logic, applied as a default) | `roles[i].person` unchanged | Prefill when a prior run of this card has roles | RunRecordPrint, `allPeople` pool |
| **Run console: event marks** | | | | |
| Event mark (chip buttons, writes `RunEvent.mark`) | chips (keep, already single-tap). Vocab: `GENERIC_MARKS` in seed/constants.ts plus `TeCard.eventMarks` | `events[]` unchanged | Visible only with an active run. "mark deviation" and "mark anomaly" chips also create records | calc/timeline intervals, RunRecordPrint event log, exportCsv events |
| **Run console: observations per measure** | | | | |
| Status (`MeasureObservation.status`, SelectField) | select (keep). Vocab: `ObservationStatus` in types.ts. Needs inline definitions for `censored` and `unknown-outcome` | `status` unchanged | One row per `card.measureIds` entry | calc/measures opportunity accounting, Analyze, RunRecordPrint |
| Success (`MeasureObservation.success`, Seg yes/no) | select (keep) | `success` unchanged | Conditional: shown when `measure.family === 'binomial'` | calc/measures binomial results |
| Value (`MeasureObservation.value`, NumberField) | numeric-units (keep). Unit already inherited from `measure.unit` | `value` unchanged | Conditional: non-binomial families | calc/measures continuous and latency results |
| Note (`MeasureObservation.note`, TextField, free text) | short-text (keep, optional) | `note` unchanged | Optional | RunRecordPrint observations |
| Operator observations (`TeRun.operatorObservations`, TextField rows=3, free text) | long-text (keep). Raw run narrative is expert content. Add "Show example" | `operatorObservations` unchanged | Active run only. Also blocks the "Discard run" shortcut when non-empty | RunRecordPrint, discard-run evidence check |
| **Run console: deviation record (created by the "mark deviation" chip)** | | | | |
| Planned state (`TeDeviation.plannedState`, SuggestField, free text) | derive: select the card statement it deviates from (red initial state, condition note, or a procedure step). Short-text override kept | `plannedState` unchanged | Suggestions already come from the active card | RunRecordPrint deviations table |
| Actual state (`TeDeviation.actualState`, TextField, free text) | short-text (keep). Observed fact | `actualState` unchanged | | RunRecordPrint |
| Direct observation (`TeDeviation.directObservation`, TextField, free text) | short-text (keep) | `directObservation` unchanged | | RunRecordPrint |
| Affected variable, control, measure, or rule (`TeDeviation.affected`, SuggestField, free text) | entity-pick over `campaign.factors` and `campaign.measures`, card-linked ones first. Rename to "What did this deviation touch?" | `affected` string unchanged | Card context orders the options | Analyze validity reasoning, RunRecordPrint |
| Immediate action (`TeDeviation.immediateAction`, TextField, free text) | chips (continue, pause, safe state, stop, resume after fix) plus other short-text. New seed list; card `siteCalls` supply the words | `immediateAction` unchanged | | RunRecordPrint |
| Effect (`TeDeviation.effect`, SelectField) | select (keep). Vocab: `DeviationEffect` in types.ts. Merge candidate (see below) | `effect` unchanged | | Adjudication reasoning, RunRecordPrint |
| Disposition (`TeDeviation.disposition`, SelectField) | select (keep). Vocab: `DeviationDisposition` in types.ts. Rename to "What happens to this run now?" | `disposition` unchanged | | Adjudication, RunRecordPrint |
| Easier or harder (`TeDeviation.easierOrHarder`, Seg) | select (keep). Rename to "Did this make the test easier or harder for the system?" | `easierOrHarder` unchanged | Merge candidate | Adjudication reasoning |
| Validity effect (`TeDeviation.validityEffect`, TextField, free text) | folds into the validity-impact builder (see merge candidates); one generated line, editable | `validityEffect` unchanged (builder writes it) | Shown inside the merged decision | Adjudication, RunRecordPrint |
| Data preserved (`TeDeviation.dataPreserved`, CheckField) | checkbox (keep) | `dataPreserved` unchanged | | Adjudication |
| Generalization limit (`TeDeviation.generalizationLimit`, TextField, free text) | short-text (keep). Rename to "What can this run no longer prove?". Needs example | `generalizationLimit` unchanged | | Analyze applicability bounds |
| Approver (`TeDeviation.approver`, PersonField, free text) | entity-pick. Already auto-filled from `decisionRightHolder(campaign, 'run validity')` on creation | `approver` unchanged | Inherit on create; editable | RunRecordPrint, `allPeople` |
| **Run console: anomaly record (created by the "mark anomaly" chip)** | | | | |
| Observation, record before discussing causes (`TeAnomaly.observation`, TextField rows=2, free text) | long-text (keep). Doctrine requires raw wording. Keep the before-causes instruction as helper text | `observation` unchanged | First field, always | RunRecordPrint anomalies, Analyze |
| Source (`TeAnomaly.source`, SuggestField, free text) | select from measure truth sources and `card.dataSources`, other allowed | `source` unchanged | Suggestions already built from measures and card | RunRecordPrint |
| Classification (`TeAnomaly.classification`, SelectField) | select (keep). Vocab: `AnomalyClass` in types.ts | `classification` unchanged | | Analyze anomaly rollup, RunRecordPrint |
| Mission effect (`TeAnomaly.missionEffect`, TextField, free text) | select (none, degraded, data loss, safety) plus optional note | `missionEffect` unchanged | | RunRecordPrint |
| Preservation action (`TeAnomaly.preservationAction`, TextField, free text) | chips from a small seed list (freeze files, screenshot, keep hardware state, copy logs) plus other. Rename to "What did you do to protect the data?" | `preservationAction` unchanged | | RunRecordPrint |
| Root cause status (`TeAnomaly.rootCauseStatus`, SelectField) | select (keep). Vocab: `RootCauseStatus` in types.ts. Keep `HELP.anomaly` (vendor statement rule) attached | `rootCauseStatus` unchanged | Closure group | Analyze, closeout review |
| Candidate causes (`TeAnomaly.candidateCauses`, TextField, free text) | short-text (keep). Expert judgment | `candidateCauses` unchanged | Closure group | Analyze |
| Corrective action (`TeAnomaly.correctiveAction`, TextField, free text) | short-text (keep) | `correctiveAction` unchanged | Closure group | Closeout |
| Verification test (`TeAnomaly.verificationTest`, SuggestField, free text) | entity-pick over `campaign.cards` card codes. "Create diagnostic card" should fill it automatically | `verificationTest` unchanged | Closure group | Traceability to diagnostic card |
| Owner (`TeAnomaly.owner`, PersonField, free text) | entity-pick from people register | `owner` unchanged | Closure group | `allPeople`, action tracking |
| Open (`TeAnomaly.open`, CheckField) | checkbox (keep) | `open` unchanged | Closure group | Closeout blockers view |
| **Run debrief (after Complete run)** | | | | |
| What was planned and what occurred in time order (`TeRun.debrief.plannedVsOccurred`, TextField rows=2, free text) | derive a draft from the card procedure and the event log, then editable long-text | `debrief.plannedVsOccurred` unchanged | Form opens on run completion | RunRecordPrint debrief block, DeliverPanel immediate debriefs |
| What differed (`TeRun.debrief.differences`, TextField rows=2, free text) | derive a draft from this run's deviation records, then editable long-text | `debrief.differences` unchanged | Same | RunRecordPrint, DeliverPanel |
| Were all sources recorded (`TeRun.debrief.sourcesRecorded`, YesNoSeg over string) | select yes/no (keep). Could derive a suggested answer from the data-files checklist (see merge candidates) | `sourcesRecorded` string unchanged | Same | RunRecordPrint |
| Warnings or failures (`TeRun.debrief.warningsOrFailures`, TextField, free text) | short-text (keep), pre-filled from failure-type event marks when present | `warningsOrFailures` unchanged | Same | RunRecordPrint |
| Which result was unexpected (`TeRun.debrief.unexpectedResult`, TextField, free text) | short-text (keep). Pair with the card prediction shown read-only above it | `unexpectedResult` unchanged | Same | RunRecordPrint, Analyze surprise review |
| Repeat needed (`TeRun.debrief.repeatNeeded`, YesNoSeg over string) | derive from Preliminary use = repeat (logic partly exists); show as confirm, editable | `repeatNeeded` unchanged | Auto-set when preliminary use is repeat | RunRecordPrint, run planning |
| Preliminary use (`TeRun.preliminaryUse`, Seg) | select (keep). Rename to "Can we use this run's data now?". Vocab: `PreliminaryUse` in types.ts. `valid-failure` needs a definition | `preliminaryUse` unchanged | Debrief form | exportCsv runs, RunRecordPrint, completed-runs pill |
| **Checklists tab (per instance item)** | | | | |
| Item done (checkbox, `ChecklistInstanceItem.state` checked/unchecked) | checkbox (keep). `at` timestamp and completer already derive on check | `state`, `at` unchanged | Disabled when state is `na`. GATE: `holdOnUnknown` template items left unchecked hold the run (pre-run rule) | ChecklistPrint, pre-run release gate |
| Value (`ChecklistInstanceItem.value`, TextField, free text) | short-text (keep). Template-defined content; type the field per template item where the template knows the unit | `value` unchanged | Conditional: only when `item.type === 'value'` | ChecklistPrint |
| Completer (`ChecklistInstanceItem.completer`, PersonField, free text) | entity-pick. Already inherits the previous item's completer; better default: one runner picked once per checklist (schema already has `runner`) | `completer` unchanged | Auto-fill on check when empty | ChecklistPrint, `allPeople` |
| n/a (CheckField over `state === 'na'`) | checkbox (keep) | `state` unchanged | Toggles the reason field | ChecklistPrint |
| n/a reason (`ChecklistInstanceItem.naReason`, TextField, free text) | short-text (keep) | `naReason` unchanged | Conditional: only when state is `na` | ChecklistPrint |
| Gate outcome (`TeChecklist.outcome`, Seg) | select (keep). Vocab: `GoNoGo` | `outcome` unchanged | Conditional: only when the template names a gate | Completed list, gate dashboards |
| Conditional limits (`TeChecklist.conditionalLimits`, TextField, free text) | short-text (keep) but tighten trigger: show only when outcome is `conditional-go` | `conditionalLimits` unchanged | Conditional (today: any gated template; proposed: conditional-go only) | Gate record |
| **Adjudication tab (per selected run)** | | | | |
| Actual configuration (`TeRun.actualConfigId`, SelectField, empty = same as planned) | inherit-with-override: show the planned config from the card read-only, one "differed" toggle reveals the picker. Vocab: `campaign.configs` | `actualConfigId` unchanged (null = as planned) | Conditional on "differed from plan" | Analyze comparability, RunRecordPrint actuals |
| Actual threat (`TeRun.actualThreatId`, SelectField) | same inherit-with-override pattern. Vocab: `campaign.threats` | `actualThreatId` unchanged | Same | Same |
| Actual condition (`TeRun.actualConditionId`, SelectField) | same inherit-with-override pattern. Vocab: `campaign.conditions` | `actualConditionId` unchanged | Same | Same |
| As-run note (`TeRun.actualsNote`, TextField, free text) | short-text (keep). Rename to "What actually ran, when it differed" | `actualsNote` unchanged | Show with the override group | RunRecordPrint |
| Data files note (`TeRun.dataFilesNote`, TextField, free text) | builder: per-file received checklist generated from `card.requiredFiles`, plus a note line | `dataFilesNote` unchanged (builder renders into it) | Card supplies the file list | QuickLookPrint "Files recorded", RunRecordPrint |
| Initial data quality (`TeRun.initialDataQuality`, SuggestField, free text) | select (complete, gaps noted, truth dropout) plus other. Move the vocabulary to seed/constants.ts (today it is inline in ExecutePanel) | `initialDataQuality` unchanged | | RunRecordPrint, adjudication reasoning |
| Validity (`TeRun.validity`, Seg) | select (keep). Vocab: `TeRunValidity`. Keep `HELP['run-validity']` | `validity` plus `adjudications[]` entry unchanged | GATE: `runIncludable` requires non-pending; the Execute phase pill counts pending runs; Analyze consumes only adjudicated runs | calc/accounting, calc/matrix, calc/measures, Analyze, RunRecordPrint |
| Allowed measures (`TeRun.allowedMeasureIds`, MultiPicker) | multi-select (keep). Options already scoped to `card.measureIds` | `allowedMeasureIds` unchanged | Conditional: only when validity is `conditionally-valid` (required then) | calc/measures `measureIncludable` |
| Prohibited uses (`TeRun.prohibitedUses`, TextField, free text) | short-text (keep) with template chips from `card.prohibitedConclusion`. Keep `HELP['conditionally-valid']` | `prohibitedUses` unchanged | Conditional: conditionally-valid only | RunRecordPrint |
| Limits (`TeRun.limits`, TextField, free text) | short-text (keep) | `limits` unchanged | Conditional: conditionally-valid only | RunRecordPrint |
| Adjudicator (`RunAdjudicationEntry.by`, PersonField, free text) | entity-pick. Default already inherits `decisionRightHolder(campaign, 'run validity')` | `by` unchanged | Default from decision rights | Adjudication history, `allPeople` |
| Reason (`RunAdjudicationEntry.reason`, TextField, free text) | short-text (keep). The defensibility record | `reason` unchanged | Recorded with each adjudication version | Adjudication history, RunRecordPrint |
| Excluded (`TeRun.excluded`, CheckField) | checkbox (keep). Rename to "Leave this run out of the counts", keep the accounting-not-adjudication note as helper | `excluded` unchanged | Independent of validity | calc/accounting, calc/matrix, calc/measures |

Note: `TeAnomaly.distinguishingEvidence` and `TeAnomaly.diagnosticAction` exist in the schema but have no input in this panel. The closure builder should surface both.

## Derivable/inheritable

- Approvers, deviation approver, and adjudicator already default from `decisionRightHolder`. Keep and show provenance.
- Run roles: auto-prefill from the last run of the same card (button exists, make it the default).
- Issued card: default to the card that serves the highest-priority thin matrix cell.
- Actual config, threat, condition: inherit the planned entities from the card; ask only "did anything differ?".
- Debrief planned-vs-occurred: draft from card procedure plus event log. Differences: draft from deviation records. Repeat needed: from preliminary use.
- Deviation planned state: select the card statement, do not retype it.
- Checklist completer: inherit from the previous item (exists) or a per-instance runner.
- Observation unit and value-vs-success control: already derived from the measure. Timestamps and day date: already automatic.

## Selectable (vocab source)

- Schema enums in `src/te/model/types.ts`: `GoNoGo`, `GoNoGoScope`, `TeRunValidity`, `ObservationStatus`, `PreliminaryUse`, `DeviationEffect`, `DeviationDisposition`, `AnomalyClass`, `RootCauseStatus`, `RUN_ROLES`.
- `GENERIC_MARKS` in `src/te/seed/constants.ts` plus `TeCard.eventMarks` for event chips.
- Campaign registers: `campaign.configs`, `threats`, `conditions`, `factors`, `measures`, `cards` for entity picks.
- People: `allPeople` in `src/te/ui/help.ts`; propose a first-class people register.
- Truth sources: `measure.truth.primarySource/backupSource` plus `card.dataSources` for anomaly source.
- New seed lists needed: initial-data-quality states, immediate-action verbs, preservation actions (add to `src/te/seed/constants.ts`).

## Conditional

- Success vs Value: `measure.family === 'binomial'` (exists).
- Allowed measures, prohibited uses, limits: validity `conditionally-valid` (exists).
- n/a reason: item state `na` (exists). Item value: item type `value` (exists).
- Gate outcome: gated templates (exists). Conditional limits: tighten to outcome `conditional-go`.
- Deviation and anomaly forms: only after their marks (exists). Debrief: only after run completion (exists).
- Actual-entity pickers: only after a "differed from plan" toggle (proposed).
- Pre-run hold: `holdOnUnknown` items hold the run while unchecked (exists, keep visible).

## Justified free text

Twenty fields stay free text. All are observation or expert-judgment records that no vocabulary can pre-state: go/no-go note, measure observation note, operator observations, deviation actual state, deviation direct observation, deviation generalization limit, anomaly observation, candidate causes, corrective action, debrief planned-vs-occurred (derived draft), debrief differences (derived draft), warnings or failures, unexpected result, checklist item value, n/a reason, checklist conditional limits, as-run note, prohibited uses, limits, adjudication reason. Doctrine requires verbatim observation before interpretation, so these must accept the operator's own words.

## Merge candidates

- Deviation validity block: Effect, Easier or harder, Validity effect, Disposition, Generalization limit become one guided decision, "Does the run still count?". The user picks a disposition, the builder asks direction and magnitude, and writes all five fields.
- Debrief planned-vs-occurred plus differences: one derived run story from the event log and deviation records, edited once.
- Repeat needed plus Preliminary use: one decision, "Can we use this data?". Repeat implies repeat-needed yes (half exists).
- Adjudication: Validity, Allowed measures, Prohibited uses, Limits, Adjudicator, Reason become one adjudication action; the status choice reveals the rest.
- Anomaly closure: Root cause status, Candidate causes, Corrective action, Verification test, Owner, Open become a closure stepper; "Create diagnostic card" fills the verification test.
- Data files note plus debrief sources-recorded: one per-file received checklist from `card.requiredFiles` answers both.

## Ambiguous labels needing plain-language rewrite

- Preliminary use: "Can we use this run's data now?"
- Easier or harder: "Did this make the test easier or harder for the system?"
- Affected variable, control, measure, or rule: "What did this deviation touch?"
- Validity effect: "Does this change whether the run counts?"
- Generalization limit: "What can this run no longer prove?"
- Initial data quality: "First look at the data: complete, gaps, or truth dropout?"
- Excluded (accounting decision, not an adjudication): "Leave this run out of the counts"
- Disposition: "What happens to this run now?"
- Preservation action: "What did you do to protect the data?"
- Prohibited uses: "What must this data never be used to claim?"
- As-run note: "What actually ran, when it differed"
- Scope (go/no-go): "Which decision is this?"
- Observation statuses `censored` and `unknown-outcome`, and preliminary use `valid-failure`, need inline definitions rather than renames.
