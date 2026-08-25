# T&E module shared infrastructure audit

Scope: `src/te/`. Sources read: `ui/kit.tsx`, `state/teStore.ts`, `model/types.ts`, `model/empty.ts`, `model/ids.ts`, `ui/help.ts`, `ui/OpsWorkspace.tsx`, `validate.ts`, all `seed/*.ts`, panel imports and usage counts. Line references are as of 2026-08-25.

## 1. Kit controls (src/te/ui/kit.tsx)

All controls wrap `Field`, which renders the app `field` CSS class and an optional `help-dot` tooltip.

| Control | Props | Notes |
|---|---|---|
| `Field` | `label, help?, children` | Base label wrapper. `help` renders a hover dot with `data-help` text. |
| `TextField` | `label, value, onChange, rows?, placeholder?, help?, disabled?` | `rows` switches input to textarea. |
| `NumberField` | `label, value: number\|null, onChange, step?, help?, disabled?` | Empty string maps to `null`. |
| `CheckField` | `label, value: boolean, onChange, help?, disabled?` | CSS turns a checkbox field into a row. |
| `SelectField<T>` | `label, value: T\|null, options: {v,label}[], onChange, allowEmpty?, help?, disabled?` | `allowEmpty` gives a null option with that label. |
| `Seg<T>` | `value, options: {v,label}[], onChange, disabled?` | Segmented buttons. One active option, no typing. |
| `DateField` | `label, value: string\|null, onChange, help?, disabled?` | ISO `YYYY-MM-DD`. Legacy free text stays editable as text. |
| `PersonField` | `label, value, onChange, people: string[], help?, placeholder?, disabled?` | Input plus datalist of known people. Free text stays allowed. |
| `SuggestField` | `label, value, onChange, suggestions: string[], help?, placeholder?, rows?, disabled?, onBlur?` | Input gets a datalist. Textarea gets max 6 click-to-insert chips. |
| `VersionField` | `label, value, onBump?, disabled?` | Read-only version display with a "Bump minor" button. |
| `LinesField` | `label, value: string[], onChange, rows?, help?, disabled?` | One item per line through a textarea. Blur strips empty lines. |
| `MultiPicker` | `label, options: {id,label}[], value: string[], onChange, help?, disabled?` | Check rows over record links. The standard many-to-many link control. |
| `ChipList` | `items: {id,label,dim?}[], selectedId, onSelect, onAdd?, addLabel?` | Master list for master-detail panels, with an add chip. |
| `SubTitle` | `children, action?` | `panel-subtitle` header with an optional right action. |
| `Pill` | `kind: good\|warn\|bad\|neutral, text` | Status pill using the `status` color classes. |
| `GateList` | `items: string[], kind: bad\|warn` | Blocker or warning list for gate dashboards. |
| `PhaseIntro` | `phase: TePhaseTab, gate?: {kind,text}` | Phase banner from `PHASE_INTRO`, optional gate pill. |
| `fmtDate` | `(iso) => string` | Helper, not a component. |

Approximate usage today: TextField ~180, SelectField ~57, SuggestField ~51, PersonField ~32, MultiPicker 15, ChipList 11 across the seven panels.

## 2. Store actions and selectors relevant to inheritance and reuse (src/te/state/teStore.ts)

Store: `useTeStore` (zustand, no undo, persisted at `rangeboard.te.v1`). `activeCampaign(s)` is the selector for the current campaign. UI state: `ui.workspace`, `ui.phase`, `ui.selected` (one selected id per list key, via `selectRecord(key, id)`).

Generic record operations, typed by `TeListKey` (every array-of-`{id}` field on `TeCampaign`):

- `addItem(key, item)`, `patchItem(key, id, patch)`, `removeItem(key, id)`.
- `patchCampaign(patch)` for singleton fields (charter, decision, evidencePackage).

Inheritance and reuse machinery:

- `linkedRecordFill(campaign, card, all=false)` (exported function, line ~200). Derives card text from linked records: config -> `systemStateNote`, `trainingState`; threat -> `redControlled`, `redFixed`, `blinding`; condition -> `conditionNote`; active authorities -> `operatingLimits`; measures -> `dataSources`, `groundTruth`, `commonTimeAndTolerance`; matrix cell -> `orderAndBlocking`; decision charter -> `resultThatCouldChangeDecision`; question -> `purpose`; hypothesis -> `prediction`. With `all=false` only empty fields fill. With `all=true` every derived field overwrites (the explicit refill path in CardsPanel). This is the single existing inheritance engine.
- `createCardFromMatrixCell(cellId)`: new card prelinked to the cell's question, hypothesis, config, threat, condition, and measures, then `linkedRecordFill` runs.
- `addCard(patch?)`: defaults owner from the `test-conductor` role and copies `storagePath` and `siteCalls` from the last card.
- `createDiagnosticCard(anomalyId)`: card titled from the anomaly; card code writes back to `anomaly.verificationTest`.
- `createActionFromFinding(findingId)`: action with `requiredWork` from `finding.recommendedAction` and `decisionOwner` from the `customer action` decision-rights row.
- `duplicateConfig(configId)`: clones text fields, bumps minor version, clears freeze, snapshot, and drift log.
- `bumpRecordVersion(key, id)`: minor bump on any versioned record; frozen records stay locked.
- `createRunFromCard(cardId)`: only for issued cards; run inherits card links and one `no-test` observation per card measure (`emptyRun`).
- ID allocation: `allocate(code, build)` uses `nextId` (src/te/model/ids.ts) with grammar `VLK-<campaign code>-<type code>-<seq>`. Type codes in `TYPE_CODES` (28 codes, includes CLM/UNK/ASM/REG for register entries even though registers use `newId` today).

Gate and lifecycle actions:

- `passQualificationGate()`, `approveDesign()` set timestamps and advance the phase.
- `issueCard(cardId)` returns blockers from `cardIssueBlockers` or issues and advances to `ready`.
- `reviseCard(cardId)` supersedes and creates the next draft with a major version bump and cleared cold-read and dry-run gates.
- `adjudicateRun(runId, validity, by, reason)` appends an adjudication entry and advances to `analyzing`.
- `markPackageDelivered()` advances to `decision-ready`.
- `advance()` is forward-only over `PHASE_ORDER`; a campaign never moves backward.

Person pools (src/te/ui/help.ts, not the store):

- `rolePeople(campaign)`: names from the role table only.
- `allPeople(campaign)`: every name typed in any person-bearing field across the whole campaign, deduped and sorted. Feeds every `PersonField`.
- `decisionRightHolder(campaign, decisionType)`: accountable authority for one decision type. Used to default go/no-go approvers, run-validity adjudicator, and finding actions.

## 3. Entity registers in TeCampaign: creators and consumers

| Register | Created in | Consumed in |
|---|---|---|
| `roles` (RoleAssignment, CAMPAIGN_ROLES) | CampaignPanel, People tab | `allPeople` everywhere; `addCard` owner default; ExecutePanel run role rows |
| `authorities` (AuthorityApproval) | CampaignPanel, seeded from `AUTHORITY_LEAD_TIMES` | `linkedRecordFill` operatingLimits; CardsPanel preconditions and authority status lines |
| `decisionRights` (DecisionRightRow, DECISION_TYPES) | CampaignPanel | `decisionRightHolder` in ExecutePanel, AnalyzePanel, DeliverPanel; `createActionFromFinding` |
| `registers` (RegisterEntry: claim, known-fact, unknown, assumption) | CampaignPanel, Registers tab; quick assumption add | DeliverPanel claim disposition and section 13 text; `closeoutBlockers`; hypotheses `claimId`; findings `claimId` |
| `schedule` (ScheduleItem) | CampaignPanel, seeded from `SCHEDULE_MILESTONES` | CampaignPanel schedule tab; `calc/timeline` |
| `feasibility` (FeasibilityItem) | CampaignPanel | `qualificationBlockers` |
| `questions` | DesignPanel (`addQuestion`, question banks) | Measures, hypotheses, matrix, cards, findings, AnalyzePanel, DeliverPanel disposition |
| `hypotheses` | DesignPanel (`addHypothesis`) | Matrix, cards, findings, `linkedRecordFill` prediction |
| `measures` | DesignPanel (`addMeasure`, `measureFromDict`) | Matrix, cards, run observations, `calc/measures`, findings, design lint |
| `threats` | DesignPanel (`addThreat`, vignette seed) | Matrix, cards, runs actuals, findings, `linkedRecordFill` red fields |
| `conditions` | DesignPanel (`addCondition`) | Matrix, cards, runs actuals, findings, `linkedRecordFill` conditionNote |
| `configs` | DesignPanel (`addConfig`, `duplicateConfig`) | Matrix, cards, runs actuals, findings, card issue gate (frozen check) |
| `factors` | DesignPanel (`addFactor`) | CardsPanel factor MultiPickers (S8); threat red-variable suggestions |
| `matrix` | DesignPanel (`addMatrixCell`) | CardsPanel `createCardFromMatrixCell`; `calc/matrix` coverage in ExecutePanel and AnalyzePanel |
| `cards` | CardsPanel (`addCard`, templates, from matrix) | ExecutePanel runs; ProductsPanel print; anomaly diagnostic link |
| `runs` | ExecutePanel (`createRunFromCard`) | AnalyzePanel calc; DeliverPanel finding run links; accounting |
| `deviations` | ExecutePanel (`addDeviation`) | Run validity review; print artifacts |
| `anomalies` | ExecutePanel (`addAnomaly`) | `createDiagnosticCard`; print |
| `changes` | AnalyzePanel (`addChange`) | Print; comparability notes |
| `checklists` | ExecutePanel and AnalyzePanel (`startChecklist` from templates) | ExecutePanel checklist tab; ChecklistPrint |
| `gonogos` | ExecutePanel (`recordGoNoGo`) | ExecutePanel history; print |
| `findings` | DeliverPanel (`addFinding`) | `createActionFromFinding`; PackagePrint; `findingBlockers` |
| `actions` | DeliverPanel (`createActionFromFinding`, addItem) | `closeoutBlockers`; DeliverPanel actions tab |
| `debriefs` | ExecutePanel (immediate, daily) and DeliverPanel (`addDebrief('aar')`) | DebriefPrint |
| `evidencePackage` (singleton) | DeliverPanel | PackagePrint; `markPackageDelivered` |
| `frames` | Board workspace (`io/frameCapture.ts` calls `addItem('frames', ...)`) | CardsPanel and run frame MultiPickers; ProductsPanel; print |

## 4. Bounded vocabularies usable for selection controls

Enums in `model/types.ts` (all string unions unless noted):

- Record lifecycle: `TeRecordStatus` (6), `CampaignPhase` (10), `AuthorityStatus` (4), `ActionStatus` (3).
- Charter: `EngagementType` (5), `ValkrynTasking` (5).
- Questions: `QuestionPriority` (P1-P3), `QuestionPattern` (9), `QuestionDisposition` (3), `EvidenceLevel` (4).
- Registers: `RegisterKind` (4), `ClaimDisposition` (6).
- Hypotheses: `PredictionType` (9), `HypothesisOutcome` (5).
- Measures: `MeasureType` (11), `MeasureFamily` (6), `ThresholdSource` (6), `IntervalMethod` (3).
- Factors and threats: `FactorClass` (7), `RepresentationClass` (5), `FidelityLevel` (4), `ThreatMissionKind` (11), `OpforMode` (3), `ThreatProfileClass` (3), `uasGroup` (1-5 numeric).
- Execution: `TeRunValidity` (4), `AccountingState` (6), `GoNoGo` (4), `GoNoGoScope` (3), `DeviationEffect` (4), `DeviationDisposition` (3), `AnomalyClass` (6), `RootCauseStatus` (5), `ObservationStatus` (6), `PreliminaryUse` (4), `NextAction` (9).
- Analysis: `FindingStrength` (4), `LadderLevel` (5), `ResultLabel` (5).
- Checklists: `ChecklistItemType` (4), `ChecklistItemState` (3), `ChecklistPhase` (9), `DebriefKind` (3).
- Const arrays: `DECISION_TYPES` (22), `CAMPAIGN_ROLES` (12), `RUN_ROLES` (11).

Seed constants (`seed/constants.ts`):

- `AUTHORITY_LEAD_TIMES` (16 authority types with lead times), `DOCTRINE_THRESHOLDS` (3), `OBSERVED_PRACTICE` (~29 labeled figures), `REFUTED_CLAIMS` (8, blocklist), `DATA_STANDARDS` (7), `DECISION_READY_TRACK` (5 criteria), `SCHEDULE_MILESTONES` (11), `GENERIC_MARKS` (12 run event marks).

Other seed vocabularies:

- `MEASURE_DICTIONARY` (`seed/measureDictionary.ts`): 20 canonical entries (18 `CUAS-*` keys plus M-02, M-10) with family, type, unit, rules, and events. `measureFromDict(entry, id, questionId)` instantiates a campaign measure.
- `QUESTION_BANKS` (`seed/questionBanks.ts`): 23 banks (QB-DISC-13, QB-CLAR-10, QB-STD-9, QB-CTRL-10, QB-QTM-01..10, QB-FG-PHASE-1..9, QB-DEBRIEF-6) plus `AAR_QUESTIONS` and `IMMEDIATE_DEBRIEF_QUESTIONS`.
- `CARD_TEMPLATES` (`seed/cardTemplates.ts`): 6 templates, each `{key, name, summary, patch: Partial<TeCard>}` with prebuilt procedure steps.
- `THREAT_VIGNETTES` (`seed/vignettes.ts`): 9 vignettes V-01..V-09, each `{key, name, summary, patch: Partial<TeThreatProfile>}`.
- `CHECKLIST_TEMPLATES` (`seed/checklistTemplates.ts`): 20 templates across all `ChecklistPhase` values, with `gate` names; `templateByKey`, `templatesForPhase`.
- `PACKAGE_SECTION_TITLES` (`model/empty.ts`): the 20 fixed evidence-package sections.
- `buildJiatf401()` (`seed/jiatf401.ts`): full illustrative demo campaign; `JIATF_FACTS` labels real vs illustrative facts.
- `HELP` (`ui/help.ts`): ~20 doctrine tooltip strings keyed by stable names. `PHASE_INTRO`: title and one-liner per phase tab.

## 5. Cross-panel reuse opportunities

Values typed as free text today that already exist as records elsewhere:

- People names. `PersonField` is only a datalist; roles, approvers, owners, adjudicators, and completers store free strings. The `roles` register plus `decisionRights` could back typed pickers. `allPeople` already computes the pool from ~30 field sites.
- Card `restartAuthority` (CardsPanel line ~465): SuggestField over people plus RUN_ROLES. The decision-rights matrix already names the `run restart` authority.
- Go/no-go approvers and run-validity adjudicator: prefilled from `decisionRightHolder` but stored as free text, not as a link.
- Question `evidenceAuthority` (DesignPanel ~265): free text with a manual copy from `charter.evidenceAcceptanceAuthority` on blur.
- Card preconditions from authorities (CardsPanel ~188): string lines built from `authorities` records; the source link is lost after the copy.
- All `linkedRecordFill` targets: config, threat, condition, authority, measure, cell, decision, question, and hypothesis text is copied into card strings once, then drifts. A redesign can render these read-through instead of copy-on-fill.
- Measure fields in DesignPanel: name, unit, start and stop events, and experimental unit suggest from `MEASURE_DICTIONARY` but store loose text even when a dictionary row matched (`dictKey` exists for the linked case).
- Threat red-controlled, red-fixed, and prohibited-action strings suggest from `factors` by classification (DesignPanel ~741) but do not link to factor records.
- Config `operatorsAndTraining` suggests from people; card `operators` and `trainingState` re-copy it through `linkedRecordFill`.
- `anomaly.verificationTest` stores a card code string, not a card id.
- Truth sources: measures type primary and backup source strings; the pool is only other measures' strings (`truthSources` suggestion list). No truth-source register exists.
- Matrix `orderOrBlock` suggests from other cells' strings (DesignPanel ~1144).
- Register statements: hypotheses link `claimId`, but claims themselves are only reachable through the CampaignPanel registers tab; DesignPanel offers no claim picker at hypothesis creation.

## 6. Validation and gate logic shape (src/te/validate.ts)

Pattern: pure functions over `TeCampaign` that return `string[]` blockers or `GateWarning[]` (`{level: 'block'|'warn', text}`). Panels render them through `GateList` and gate the action button.

- Qualification gate (`qualificationBlockers`): decision owner, bounded choice, decision date, blocking uncertainty, acceptance conditions, relying organization, and no infeasible feasibility item. Blocks `passQualificationGate`; also drives the stepper dot.
- Design gate (`designLint`, 12 checks): warnings only. Every question needs a measure; vague wording flagged; measures need a truth source and a threshold source; hypotheses need a refuting result and a prediction; matrix reps at least min valid evidence; matrix needs a baseline row. The approve button requires the user to acknowledge open warnings.
- Card issue (`cardIssueBlockers`): title, purpose, linked question, measure, config, threat, condition; nonempty procedure with observable completion per step; recorded cold-reader and dry-run with names; no unresolved `[placeholder]` text in purpose, prediction, red initial state, or expected result; config frozen; every linked measure frozen. Enforced inside `issueCard`.
- Run start (`canStartRun`): card status must be `issued`.
- Analysis inclusion (`runIncludable`): validity not `pending` and not excluded.
- Finding (`findingBlockers`): statement, question link, run links, exact config, measures, applicability bounds.
- Closeout (`closeoutBlockers`): every question disposed, every claim disposed, no open actions.
- `chainHealth`: six live counts (questions without measures, measures without truth, issued cards without runs, runs pending adjudication, findings without runs, undisposed claims) for the chain dashboard and the analyze stepper dot.
- Phase advance is a side effect of actions (`advance` in the store), forward-only; gates never move a campaign backward.

## 7. Styling idiom

- One global stylesheet: `src/index.css` (~3800 lines). No CSS modules, no styled-components, no Tailwind. Design tokens are CSS custom properties (`--bg-panel`, `--border`, `--text-dim`, `--accent`, `--good`, `--warn`, `--danger`, `--space-1..4`, `--radius`).
- Layout shell: `.te-workspace` > `.te-header` (campaign select, phase pill, export seg) > `.te-body` (`.te-nav` 130px left rail + `.te-main` scrolling column). Panels render inside `.te-panel`: a single centered column, `max-width: 980px`, `gap: 8px`, `padding: 10px`.
- Panels are dense forms: stacked `.field` controls (11px labels, secondary color) grouped by `.field-row` (horizontal, align flex-end) and `.subsection` (top border, `--space-4` padding). `panel-subtitle` headers. Checkbox fields flip to rows via `:has()`.
- Master-detail idiom: `ChipList` of `card-chip` buttons on top, detail form below, selection kept in `ui.selected` per list key.
- Status and gates: `.status.good|warn|bad|neutral` pills; `.gate-item` with a colored left border (warn amber, bad red) on `--bg-input`; `.step-dot` progress dots in the nav; `.phase-intro` banner with an accent left border.
- Prose read-outs use `.spec-summary`: left rule, no box, so panels read as one continuous surface.
- Help: pure CSS tooltips (`.help-dot::after` with `attr(data-help)`), no JS tooltip library.
- Print artifacts render in a `.print-overlay` fixed layer with their own `p-*` classes.
- New components should reuse these classes and tokens rather than add new visual primitives; the kit comment says panels "look native" by reusing `field`, `field-row`, `subsection`, `seg`, and `card-chip`.
