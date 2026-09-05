# RangeBoard T&E Operations module: product plan and implementation plan

> Status (2026-09-04): COMPLETED / HISTORICAL IMPLEMENTATION SPEC for `src/te/`. The module
> was built in `c3f9853` (2026-08-19) and `901248e` (2026-08-22). Which of the stages in
> section 11 were completed is not recorded in this historical plan. Later ownership
> review and C3 persistence work are recorded in `docs/AI_HANDOFF.md` and
> `docs/field-te/WAVE_C2_C3_E1_COMPLETION.md`; internal transition gaps remain C4.

Part B deliverable. Sources: `docs/te-compilation/MASTER-DATAMODEL.md`, `MASTER-CALCULATIONS.md`, `MASTER-FORMS.md`, `MASTER-SEEDDATA.md`. Those four documents are the authoritative build inputs. This plan selects scope, resolves decisions, and sequences the build.

## 1. Product summary

RangeBoard gains a second workspace: **T&E Ops**. The existing canvas remains the spatial planning plane. The new workspace is the campaign plane. It carries a C-UAS test campaign from customer request to delivered evidence:

1. **Input** all known variables: administrative (campaign, people, authorities, schedule), tactical administrative (configurations, threats, conditions, factors), mission and experiment (questions, hypotheses, measures, test matrix), and test cards.
2. **Process** automatically: sample sizes, run counts, matrix generation, mission-time arithmetic, measure computation, confidence intervals, evidence accounting, adaptive run priority, and validation gates.
3. **Output** deliverables: printable and tablet-ready test cards, day sheets, run records, checklists, quick-look reports, guided debriefs, a customer decision evidence package, CSV spreadsheets, and canvas frame captures.

The reference user is a deployment strategist supporting JIATF-401. The app ships with the complete JIATF-401 campaign as labeled illustrative seed data.

## 2. User journey (end to end)

1. **Campaign.** Intake wizard: register the request, fill the decision charter, pick engagement type, answer clarification questions, record customer commitments, run the feasibility screen, pass the qualification gate. Set roles and authorities. Register claims, unknowns, and assumptions.
2. **Design.** Write ranked questions (9-pattern enum, vague-term flags). Write hypotheses with predictions (recorded before the test). Instantiate measures from the 20-entry dictionary and freeze thresholds. Define threat profiles (with fidelity grid) and conditions. Classify factors. Generate the test matrix with run counts, sample sizes, and drop order. Snapshot a configuration baseline from the canvas scenario.
3. **Cards.** Build 19-section test cards. Sections auto-fill from design records (no re-entry). Author the procedure steps. Pass the card gate (placeholders resolved, cold reader, dry run). Issue. Print.
4. **Execute.** Day-start checklist and go/no-go. Pre-run release checklist. Run console: current card, procedure, event-mark tap buttons with timestamps, deviation and anomaly quick entry, observations. Run completion and immediate debrief. Post-run validation checklist. Day-end: adjudication board sets run validity, daily evidence review picks one of 9 next actions, change records issue new versions.
5. **Analyze.** Measure results computed from run events. Wilson or exact or Bayesian intervals. Evidence accounting (planned, attempted, eligible, valid, included). Coverage map against the matrix. Quick-look per run.
6. **Deliver.** Findings with full traceability and bounded language. Actions with owners and due dates. Nine-question after-action debrief. Generated 20-section decision evidence package. CSV and JSON exports. Print set.

## 3. Scope

### In v1 (this build)

- Records, tier 1 (full form + logic): Campaign, DecisionCharter, Question, Hypothesis, MeasureInstance, ThreatProfile, Condition, ConfigurationBaseline, Factor, TestMatrixCell, TestCard (19 sections + ProcedureStep), Run (+RunEvent, adjudication), Deviation, Anomaly, ChangeRecord, MeasureResult (computed), Finding, ActionRecord, ChecklistInstance, GoNoGoDecision, Debrief (immediate + AAR), DecisionEvidencePackage.
- Records, tier 2 (simple table editors on the Campaign page): RoleAssignment, AuthorityApproval (with lead-time seeds), register entries (Claim, Unknown, Assumption with a kind enum), schedule items (T-countdown).
- Calculation engine with the 36 master fixtures as unit tests.
- Checklist runner + the canonical merged checklist templates (readiness, day-start, pre-run, run initiation, run completion, post-run validation, end-of-day, daily evidence review, anomaly response, safety stop, data stop, decision package, closeout, and the card gate).
- Validation gates: the 11 pocket rules plus the ordering rules as hard blocks or structured warnings (section 10).
- Print artifacts and CSV/JSON export. Canvas frame PNG capture attached to cards and runs.
- Seed data: measure dictionary (20), 6 worked card templates, 9 threat vignettes, question banks (17), constants, JIATF-401 demo campaign with illustrative results.

### Simplified in v1

- Instrumentation plane: one light TruthSource record per measure (source, independence, tolerance) instead of the 12 deep instrumentation records. The card's data-and-truth section renders from it.
- Closeout: claim and question disposition screen + AAR + package delivery. No reuse-asset library or regression engine.
- Authority matrix: the 22 decision types render as one editable table, not a wizard.

### Deferred (documented, not built)

EvidenceBaseline and regression scoping, ReuseAsset harvest, SuccessMetrics dashboards, four formal review records (the package carries approver fields instead), deep instrumentation records (TimeSync, SpatialRegistration, Calibration, AssociationGate, DataHealthSpec, DataLineage, FallbackPath, AnalysisManifest), MissionThread editor, HazardRecord and range-fit and contingency forms.

## 4. Architecture

### Data plane

- New module `src/te/`. The T&E plane persists as its **own zustand store** (`useTeStore`) with its own localStorage key `rangeboard.te.v1`. It is **not** embedded in `Scenario`: campaign records grow large, and full-snapshot undo would bloat memory.
- **No undo in the T&E store.** The doctrine is versioned, append-only records (never renumber, never overwrite, deviations instead of edits). Draft records are freely editable; issued records are frozen by gates.
- Store shape: `{ campaigns: TeCampaign[], activeCampaignId, ui }`. Every child record lives in arrays inside its campaign.
- Link to the canvas: ConfigurationBaseline embeds a frozen JSON snapshot of the relevant scenario state (entities, connections, environment, library refs). Cards and runs may hold canvas frame captures (PNG data URLs). Threat profiles may reference a library `SpecModel` id.
- IDs: Grammar A canonical (`VLK-<campaign>-<type>-<seq>-v<maj>.<min>`), per-campaign per-type monotonic sequence in the store, plus an optional human alias (Grammar B). Runs are versionless.
- Export/import: campaign JSON download and file import, following the `persist.ts` pattern.

### UI plane

- `App.tsx` gains a workspace toggle in the toolbar: **Board | T&E Ops**. Board is untouched.
- Ops workspace: left phase nav + main panel. Phases: Campaign, Design, Cards, Execute, Analyze, Deliver. Each phase is master-detail: record list left, editor right. Reuse the existing CSS conventions (`field`, `field-row`, `subsection`, `seg`, chips) plus a small shared form kit in `src/te/ui/`.
- Gate state renders as status pills; blocked actions show the failing rule text.

### Module layout

```
src/te/model/types.ts     all T&E record types + enums
src/te/model/ids.ts       ID grammar, sequence allocation
src/te/model/empty.ts     empty campaign factory + defaults
src/te/state/teStore.ts   zustand store, actions, persistence
src/te/calc/stats.ts      Wilson, Clopper-Pearson, Beta posterior, sample size,
                          inflation, paired, mean CI, RSS, zero-failure bound
src/te/calc/measures.ts   measure computation per family from run events
src/te/calc/accounting.ts evidence accounting chain + valid-run rate
src/te/calc/matrix.ts     run-count and duration math, coverage
src/te/calc/timeline.ts   chain-time decomposition, mission margin, warning time
src/te/calc/priority.ts   adaptive next-run priority (H/M/L form)
src/te/validate.ts        pocket rules, gate checks, design lint
src/te/seed/*.ts          dictionary, checklists, cards, vignettes, banks,
                          constants, jiatf401 demo campaign
src/te/ui/*.tsx           shared form kit + phase panels + workspace shell
src/te/print/*.tsx        print artifact components + print CSS
src/te/io/exportCsv.ts    CSV workbook exports
src/te/io/persistTe.ts    autosave, JSON export/import
```

## 5. Data model decisions (resolved)

- Run validity enum: `valid | conditionally-valid | invalid | pending`; accounting state separate (`planned | attempted | valid | conditional | invalid | excluded`).
- Card: 19 sections per MASTER-FORMS 2.3; change history and run list render read-only from linked records.
- Threshold rendering: without a customer-approved threshold source the UI suppresses pass/fail and shows characterization output.
- Factor classes: unified 7-value enum from MASTER-DATAMODEL 1.27.
- THR and COND: separate records; the combined 29-field form is a layout.
- All other conflict resolutions follow MASTER-DATAMODEL section 6 (supersets adopted).

## 6. Calculation engine

Pure TypeScript, no DOM, fully unit-tested against fixtures F-01..F-36 in MASTER-CALCULATIONS section 4. Measure computation consumes RunEvents and per-run observations; each MeasureResult carries value, interval, label (`pass | miss | borderline | descriptive | unavailable`), observation status, and provenance. Aggregation enforces the do-not-combine prohibitions as hard errors. Pre-experiment planning: sample size, attempt inflation, matrix totals, chain-time budget, mission margin. The existing planning predictions (`assessThreat` warning time and windows) surface on cards as predicted values, labeled planning figures.

## 7. Checklists

Checklist templates ship as data (id, phase, runner, gate, items with type `check | value | go-no-go | signature`, conditional rules like hold-on-unknown). A ChecklistInstance is created per use, tracks per-item completer, time, and result, and emits a GoNoGoDecision where the source requires one. The checklist library screen lists every template by phase for reference.

## 8. Print and export

- Print: a print overlay renders one artifact with dedicated print CSS (`@media print`), then calls `window.print()`. Artifacts: test card (19 sections + flat fallback layout), day sheet, run record + immediate debrief, checklist, quick-look, AAR debrief, decision evidence package.
- CSV: runs, measure results, matrix/coverage, accounting, findings, actions. One click exports the set.
- JSON: full campaign export/import.
- Frames: capture the Konva stage as PNG at the current view and sim time; attach to a card or run as a figure; included in print.

## 9. Seed data

From MASTER-SEEDDATA, all illustrative content labeled: 20-entry measure dictionary, 6 worked cards, 9 threat vignettes, observed-practice figures with the 8-claim refuted blocklist, doctrine thresholds, regulatory lead times, question banks QB-*, and the complete JIATF-401 demo campaign (systems, questions, hypotheses, measures M-01..M-10, 12-cell matrix, issued card, 6-day rhythm, illustrative results). A "Load JIATF-401 demo" action creates it.

## 10. Validation gates

Hard blocks: issue a card (placeholders resolved + cold-reader + dry-run checked + design gate passed), start a run (issued card required), include a run in analysis (validity status recorded), save a finding (traceability links present), close a campaign (every claim and question disposed). Structured warnings (gate dashboards): remaining pocket rules, design lint (12 checks), chain-health questions.

## 11. Implementation stages

- **C1 Foundation** (sequential): types, ids, empty factory, store, persistence, validation skeleton. Unit tests for ids, store actions, gates.
- **C2 Engines and data** (parallel agents): calc engine + fixture tests (from MASTER-CALCULATIONS); seed data files (from MASTER-SEEDDATA); checklist template data (from MASTER-FORMS section 1).
- **C3 UI** (shell by hand, panels partly delegated): shared form kit, workspace shell, then phase panels: Campaign, Design, Cards, Execute, Analyze, Deliver.
- **C4 Print and export**: print components, CSS, CSV, JSON, frame capture.
- **C5 Integration and verification**: wiring, `npm run test`, `npm run build`, `npm run lint`, Playwright drive-through with screenshots, demo campaign walkthrough.

## 12. Risks and open items

- Ambiguities 15-18 in MASTER-DATAMODEL section 6 stay as modeled (manual ordinal ranks, 4-state go/no-go, attempted as valid-rate denominator, inferred approval status values).
- localStorage quota: frame captures and large campaigns can exceed it. Autosave degrades gracefully (existing pattern); JSON export always works.
- The old Test cards tab on the Board remains untouched in v1; the T&E Cards phase supersedes it functionally. Migration is a later decision.
