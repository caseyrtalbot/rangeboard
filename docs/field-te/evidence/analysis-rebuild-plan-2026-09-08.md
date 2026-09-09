# Analysis rebuild implementation plan

Captured 2026-09-08 against `main` at `5d69c6bffba2dc678ee142592e1c0bdeaad6a75d`.
Status: approved by the user on 2026-09-08 with every decision in section 2 resolved.
No application changes started. This dated proposal records the selected scope and the
per-slice briefs. `docs/HANDOFF.md` records completion as slices finish. Current behavior
is defined by source and tests, not by this file.

## 1. Outcome and boundaries

Replace the five-lens widget stack in the Board right panel with four screens. Each screen
answers one question on one result basis. Add the two engine features test planning needs:
a factor sweep over scenario factors and a pinned configuration baseline for comparison.

Preserve the physics, Pk functions, doctrine, sensor models, engine time step, draw keys,
deterministic forecast numbers and Monte Carlo statistics. Engine slices change what is
recorded, never what is computed for an existing path, and prove it with fixed-ID parity.

Out of scope: T&E Ops, Board test cards, the selected-object workspace, the canvas, the
timeline bar, any storage key rename, and any new physical model. The deterministic
forecast leaves the screens and stays in the run export and the requirement record.

## 2. Evidence and decisions

Verified on 2026-09-08 at localhost:5173 with the JIATF-401 laydown, run RUN-0015:

| Label | Forecast before Play | Trial RUN-0015 | Basis |
| --- | --- | --- | --- |
| First detect | 2:51 | 0:00 | `engagementPicture(scenario)` vs one sampled draw |
| First effect | 20:44 | 20:54 | expected mass removed vs first kill event |
| Min warning | 20:27 | 23:17 | worst-threat expectation vs realized |
| Kills | 95.9 %, 7.68 of 8 | 8 of 8 | expected fraction vs integer count |

Duplication located in source:

- Each trial widget prints its state line as frame meta and again as body
  (`src/panels/analysis/widgets/ThreatPictureWidget.tsx` lines 41 and 48; same pattern in
  KPI tiles, time series, system status, lanes and ledger).
- The trial outcome grid renders in `src/panels/AnalysisPanel.tsx` and again in
  `src/panels/analysis/DebriefRecord.tsx` line 196. The project guide says it does not.
- The projection block is in two lenses; requirement gates are in two lenses
  (`src/state/analysisLayout.ts`).
- Fire doctrine and Environment widgets list scenario inputs inside results lenses.
- Caveats stack four deep: view caption, series caption, forecast caption, per-tile text.

Root cause: the lens and widget system treats each widget as independent, so no component
owns a page. The rebuild gives each screen one owner component.

Decisions, all resolved on 2026-09-08:

| Id | Decision |
| --- | --- |
| D1 | The deterministic forecast leaves every screen. It stays in export and the requirement record. No preview row. |
| D2 | User-saved lenses are dropped. Saved view state still loads; the analysis field is read and discarded. |
| D3 | Sweep factors in the first release: threat altitude, threat speed, approach azimuth, raid size, environment preset. |
| D4 | Sensitivity records five responses: leakers, kills, first detect, minimum warning, salvos. |
| D5 | The sweep runs on the sensitivity worker slot, cells in sequence. No fourth slot. |
| D6 | Outcome tiles show one count, Defeated before arrival. The per-threat Result column states hard or mission when the trial distinguishes them. Late kills stay one tile. |
| D7 | Screens ship first: S1, S2, S3, S5. Engine slices S4 and S6 run in a parallel lane. |

## 3. Product contract

Rules every screen follows:

1. One basis per screen. A second basis is a labeled column in the same table, never a
   second stack of tiles.
2. One caveat per section, in the section header. Never on a tile.
3. Inputs never appear in results. A results screen links to Prepare in one line.
4. One placeholder for the whole screen before Play. It names the action that fills it.
5. Every number carries its denominator and horizon inside the tile.
6. Per-track detail is a sortable table with mono columns at `--type-dense-size`.
7. Quantity, unit, denominator, horizon and interval stay distinguishable, as
   [ENGINEERING_REFERENCE](../../ENGINEERING_REFERENCE.md#3-hard-architectural-invariants)
   already requires.

Screens, phases and bases:

| Screen | Phase | Question | Basis | Keeps | Removes |
| --- | --- | --- | --- | --- | --- |
| Fragility | Prepare | Where does this laydown fail, and which factor drives it? | Monte Carlo ensemble and sensitivity | Ensemble tiles, sweep map, ranked sensitivity, validity rows | Forecast tiles |
| Inputs | Prepare | What are the run inputs? | Scenario | Current `BoardPreparation` content unchanged | Nothing |
| Now | Execute | What is happening at the cursor? | Sampled trial at cursor | Run line, kill-chain table, effector bars, sensor rows | Doctrine, environment, gates, sensitivity, placeholders |
| Outcome | Analyze | What happened in this trial? | Completed trial | Six tiles, per-threat table, records rows, export | Debrief grid copy, member cards |
| Compare | Analyze | How does this trial sit against expectation and a baseline? | Ensemble with trial marked, pinned baseline | Band chart, delta table, findings, baseline row | Projection blocks |

Selected object, Test cards and Model library tabs stay as they are. The Layout control and
the five lens buttons leave the navigation.

### Outcome

- Basis line: `simulated trial · one draw · seed N · T+h of d observed`.
- Tiles in `.tiles.c3`: Defeated before arrival k/n, Arrived undefeated k/n, Late kills k/n,
  First detect, First effect, Salvos with kinetic and EW counts in `small`.
- Per-threat table: one row per threat with a path. Columns Track, D, ID, ENG, FX, Slv,
  Result. Result is a `State` word: defeated (hard), defeated (mission), leaked, active,
  no path. Sort by any column header.
- Records: one row each for Event ledger with count, Manifest with component count,
  Validity with status word and count. Each opens its existing content in place.
- Before the first Play the screen is one line: `No trial yet. Press Play in Execute to
  run one.`

### Compare

- Basis line: `Monte Carlo · N replicates · uncertainty mode · seed · 95 % band`. Without
  an ensemble, one line and a Run Monte Carlo button.
- Band chart: ensemble mean and band from `McSummary.kills`, trial line from
  `trialSeries`, endpoint marked. Band in `--rule-strong`, mean in `--text-secondary`,
  trial in `--chart-1`, baseline mean dashed in `--text-tertiary` when pinned.
- Delta table: rows Kills, Leakers, First detect, Min warning, Salvos. Columns Trial,
  Ensemble mean, 95 % band, Baseline when pinned, Flag. Flag is `inside` in nominal ink
  or `outside` in warning ink.
- Findings: `forecast-trial-disagreement` and existing validity findings that name a
  cause, one row each with one action.
- Baseline row: Pin, Clear, label and pin time.

### Now

- Run line: state word, `observed through T+h of d`, tracks, engaged, defeated.
- Kill-chain table: columns Track, State, Held, ID, Eng, Arr. State is the furthest
  reached state at the cursor with `State` ink: engaged critical, targeted warning,
  identified hollow, defeated ghost. Held is the sensor holding the track now. Arr is the
  planned arrival, labeled by the column header only.
- Effectors: one inventory bar per effector, remaining over capacity. EW channels show a
  full bar and `cont.`.
- Sensors: one row per sensor with mode word, held count, hold duration when tracking.
- Buttons: Pause or Play, New run, Forecast and analysis.

### Fragility

- Tiles: Kills, Leakers, Min warning from the current `McSummary` with the band inside.
- Sweep map: CSS grid, factor values on the axes, one cell per result, fill on a
  three-step scale of `--status-nominal`, `--status-warning`, `--status-critical`, value
  printed in `--ink`. Two factors at most, six values each at most, 36 cells at most.
  Header shows replicates per cell and the time estimate from the last measured
  replicate rate.
- Sensitivity: ranked bars of the selected response, swing as length, number at right.
  Response selector in the section header.
- Validity: existing findings from `assessRunValidity`, one row and one action each.
- Buttons: Run Monte Carlo, Run sweep, Pin as baseline.

## 4. Engine contracts

### Multi-response sensitivity (S4)

`sensitivityLoop` in `src/playback/mcRun.ts` pairs replicates by common random numbers
and reports the end-of-run leaker mean per perturbed field. Extend each row:

```ts
type SensitivityResponse = 'leakers' | 'kills' | 'firstDetectS' | 'minWarningS' | 'salvos'
interface SensitivityRow {
  fieldId: string
  label: string
  responses: Record<SensitivityResponse, { lo: number; hi: number; swing: number; se: number }>
  swing: number // alias of responses.leakers.swing until the UI moves
  se: number // alias of responses.leakers.se
}
```

Undefined times keep their definedness statistic. No new worker slot.

### Factor sweep (S6)

```ts
interface SweepFactor {
  id: 'threatAltitudeFt' | 'threatSpeedMps' | 'approachAzimuthDeg' | 'raidSize' | 'environmentPreset'
  values: number[] | string[] // 2 to 6 values
}
interface McSweepRequest {
  type: 'sweep'
  runId: string
  scenario: Scenario
  factors: [SweepFactor] | [SweepFactor, SweepFactor]
  replicatesPerCell: number // default 40
  responses: SensitivityResponse[] // default ['leakers']
}
interface SweepCell {
  index: number[]
  summary: Pick<McSummary, 'kills' | 'leaked' | 'firstDetectS' | 'minWarningS' | 'salvos'>
}
interface SweepSummary {
  factors: SweepFactor[]
  cells: SweepCell[]
  replicatesPerCell: number
  seed: number
}
```

`applySweepValue(scenario, factor, value)` in `src/playback/sweepFactors.ts` is pure and
returns a new `Scenario`:

- altitude and speed: set on every UAS entity that has a path;
- azimuth: rotate every UAS path about the defended asset, or about the laydown centroid
  when no asset exists;
- raid size: truncate or repeat the first wave's members with fresh ids from the one id
  allocator;
- environment preset: replace `scenario.environment` by preset id.

`sweepLoop` yields one checkpoint per cell and drives `replicateLoop` with a replicates
stop rule. Cells run in sequence on the sensitivity slot. `assertSummaryFits` applies per
cell. The UI caps the grid at 36 cells.

### Pinned baseline (S8)

```ts
interface PinnedBaseline {
  pinnedAt: string
  label: string
  scenario: Scenario
  mc: McSummary
  scenarioHash: string
}
```

New key `BOARD_BASELINE` in `src/io/storageKeys.ts`. Runtime validation before adoption,
recovery copy on an unreadable save, `npm run schema:generate` after the type lands. The
baseline never enters `Scenario` or the worker graph.

### Model against trial finding (S5)

`src/analysis/runValidity.ts` gains `forecast-trial-disagreement`. It fires when the
deterministic first detect and the trial first detect differ by more than one scan period
of the first detecting radar, or when trial kills fall outside the ensemble 95 % band. The
text names both values. It reuses `spawn-in-ring` as the cause when that finding is present.

## 5. Slices, lanes and gates

| # | Slice | Kind | Depends on | Owns | Gate |
| --- | --- | --- | --- | --- | --- |
| S1 | Screen shell: four screen components, phase mapping, one placeholder, lens bar removed from the UI | UI | none | `src/panels/AnalysisPanel.tsx`, `src/panels/analysis/screens/*`, `src/panels/analysis/AnalysisNavigation.tsx`, `src/App.tsx` nav wiring | tests, browser at 1265 px |
| S2 | Outcome screen; delete the debrief grid copy | UI | S1 | `screens/OutcomeScreen.tsx`, `analysis/DebriefRecord.tsx`, `analysis/threatReadout.ts` | tests, browser |
| S3 | Now screen | UI | S1 | `screens/NowScreen.tsx`, `analysis/LiveStrip.tsx` | tests, browser during playback |
| S4 | Multi-response sensitivity | Engine | none | `src/playback/mcRun.ts` sensitivity section, `mc.worker.ts`, `mcClient.ts`, their tests | fixed-ID parity on leakers swing and se |
| S5 | Compare screen, band chart, disagreement finding | UI | S2 | `screens/CompareScreen.tsx`, `src/charts/BandChart.tsx`, `src/analysis/runValidity.ts` | tests, browser after a run |
| S6 | Factor sweep engine and store slice | Engine | S4 | `mcRun.ts` sweep section, `src/playback/sweepFactors.ts`, `src/state/analysisRequests.ts`, `src/state/store.ts` sweep slice | parity on every existing path, cell budget test |
| S7 | Fragility screen and Inputs tab wrap | UI | S4, S6 | `screens/FragilityScreen.tsx`, `src/charts/SweepMap.tsx`, `src/panels/BoardPreparation.tsx` tab wrap only | tests, browser |
| S8 | Pinned baseline and Compare baseline column | Store | S5 | `src/state/baseline.ts`, `src/io/storageKeys.ts`, `src/io/persist.ts`, `screens/CompareScreen.tsx` baseline column | schema:generate, recovery tests |
| S9 | Remove the lens system | Cleanup | S2, S3, S5, S7 | `src/state/analysisLayout.ts`, `src/panels/analysis/widgets/*`, `AnalysisLayoutControls.tsx`, `src/io/viewState.ts` | full check, bundle budget |
| S10 | Docs | Docs | S9 | `docs/PROJECT_GUIDE.md`, `docs/design/DESIGN_SYSTEM.md`, `docs/VERIFICATION.md`, `docs/ENGINEERING_REFERENCE.md` | `npm run docs:check` |

Lanes:

- Lane A (screens): S1, then S2 and S3 in parallel, then S5, then S8.
- Lane B (engine): S4, then S6, then S7 once S4 and S6 are merged.
- Integrator: owns `src/state/store.ts`, `src/io/*`, schema generation, shared docs and the
  merge of each lane. S9 and S10 run after both lanes merge.

Gates for every slice: `npm run typecheck`, `npm test` scoped to the owned paths, and a
real browser check at 1265 px wide with the JIATF-401 laydown. Engine slices add the
fixed-ID parity test before any behavior change. The integrator runs `npm run check`
after each merge. No slice commits; the integrator commits after its gate passes.

## 6. Agent briefs

Common rules carried by every brief:

```text
Repository: ~/Projects/rangeboard. Read AGENTS.md first, then docs/PROJECT_GUIDE.md and
docs/field-te/evidence/analysis-rebuild-plan-2026-09-08.md sections 3 to 5, then the files
this brief names.
Style: two spaces, no semicolons, single quotes, named exports, short rationale comments.
Tokens and components from docs/design/DESIGN_SYSTEM.md and src/ui/kit.tsx. No new colors,
radii, borders or shadows.
Invariants: keep modeled, observed and planning-factor results distinguishable. Every number
keeps quantity, unit, denominator, horizon and interval. Never invent missing data. Campaign
data stays out of Scenario. Never rename a storage key.
Scope: only the files this brief owns. You share the tree; preserve others' edits. Report a
nearby bug as a follow-up line. Do not fix it.
Verify: npm run typecheck, npm test for the owned paths, then a real browser check at
localhost:5173 at 1265 px wide with the JIATF-401 laydown. Engine slices add a fixed-ID
parity test before any behavior change.
Finish: the diff, the checks run with their output, limitations, and the exact stop point.
Do not commit.
```

### S1 Screen shell

```text
Task: replace the lens and widget stack in the Board right panel with four screen
components.
Screens and phases: Prepare shows Fragility and Inputs. Execute shows Now. Analyze shows
Outcome and Compare. Selected object, Test cards and Model library tabs stay as they are.
Create src/panels/analysis/screens/FragilityScreen.tsx, NowScreen.tsx, OutcomeScreen.tsx,
CompareScreen.tsx. In this slice each renders its title, one basis line from
trialStateText or the MC summary, and one placeholder paragraph. Inputs renders the
existing BoardPreparation unchanged.
AnalysisNavigation: remove the five lens buttons and the Layout control from the UI. Keep
the component file and the store actions applyLens and setAnalysisCustomize so saved view
state still loads. Do not delete analysisLayout.ts.
Placeholder rule: before the first Play, Now, Outcome and Compare each render one line:
'No trial yet. Press Play in Execute to run one.' Nothing else.
Tests: update AnalysisPanel.test.tsx and AnalysisNavigation.test.tsx for the new
structure. Keep store.analysis.test.ts green without edits.
Stop when: the four screens mount in their phases in the browser, the lens bar is gone,
and no placeholder repeats.
```

### S2 Outcome screen

```text
Task: build the Outcome screen from the completed trial and remove the duplicate grid.
Basis line: 'simulated trial · one draw · seed N · T+h of d observed', from
useTrialResult and the manifest.
Tiles (.tiles.c3): Defeated before arrival k/n, Arrived undefeated k/n, Late kills k/n,
First detect, First effect, Salvos with kinetic and EW counts in small. Values from
trialResultOf and trialKpisAt at the full horizon. Denominator inside the tile. No
caption under a tile.
Per-threat table: one row per threat with a path. Columns Track, D, ID, ENG, FX, Slv,
Result. Times from the trial assessments and attrition events. Result is a State word:
defeated (hard), defeated (mission), leaked, active, no path. Sortable by column header.
Mono cells at --type-dense-size.
Records: one row each for Event ledger with count, Manifest with component count,
Validity with status word and count. Each opens its existing content in place.
DebriefRecord: remove the TrialOutcomeSummary render near line 196. Keep export, PNG
capture and the requirement record.
Tests: OutcomeScreen.test.tsx with the trialTestState helper. DebriefRecord.test.tsx
updated for the removed grid.
Stop when: the grid appears once after a completed run, the table sorts, and the screen
fits one viewport with no disclosure open.
```

### S3 Now screen

```text
Task: build the Execute screen as one run line, one kill-chain table, effector bars and
sensor rows.
Run line: state word, 'observed through T+h of d', tracks, engaged, defeated. Replace the
LiveStrip banner and its buttons. Keep New run and Forecast and analysis as buttons at
the bottom of the screen.
Kill-chain table: one row per threat with a path. Columns Track, State, Held, ID, Eng,
Arr. State is the furthest reached state at the cursor from trialSweepAt, with State
ink: engaged critical, targeted warning, identified hollow, defeated ghost. Held is the
sensor holding the track now. Arr is the planned arrival, labeled by the column header
only.
Effectors: one bar per effector with remaining over capacity. EW channels show a full
bar and 'cont.'.
Sensors: one row per sensor: mode word, held count, hold duration when tracking.
Remove from Execute: fire doctrine, environment, requirement gates, sensitivity and every
'Forecast available in Analyze' placeholder.
Tests: NowScreen.test.tsx at three cursors: ready, mid-run, complete. LiveStrip.test.tsx
updated or removed with its component.
Stop when: the screen updates during 30x playback without a dropped frame in the canvas
and shows no scenario input.
```

### S4 Multi-response sensitivity

```text
Task: record five responses per perturbed field in sensitivityLoop and keep the old
shape as an alias.
First: add a fixed-ID parity test that runs sensitivityLoop on the seeded JIATF-401
scenario and snapshots swing and se per field. It must pass before and after.
Change: per perturbed field, capture lo and hi means and the paired swing and se for
leakers, kills, firstDetectS, minWarningS and salvos. Undefined times keep their
definedness statistic. Add responses to SensitivityRow. Keep swing and se as aliases of
responses.leakers.
Worker and client: the message shape gains responses. No new worker slot.
Tests: parity test, a definedness test for firstDetectS when no replicate detects, and
the existing SensitivityWidget.test.tsx untouched and green.
Stop when: parity holds, the five responses exist in the result, and the UI is
unchanged.
```

### S5 Compare screen

```text
Task: build the Compare screen from the current McSummary and the completed trial.
Basis line: 'Monte Carlo · N replicates · uncertainty mode · seed · 95 % band'. When no
ensemble exists, the screen shows one line with a Run Monte Carlo button and nothing
else.
BandChart: recharts, one series for the ensemble mean with the band as an area from
McSummary.kills lo and hi, one line for the trial from trialSeries, endpoint marked.
Axis labels in --font-mono at dense size. Colors: band --rule-strong, mean
--text-secondary, trial --chart-1. Accessible text names both series and the horizon.
Delta table: rows Kills, Leakers, First detect, Min warning, Salvos. Columns Trial,
Ensemble mean, 95 % band, Flag. Flag is 'inside' in nominal ink or 'outside' in warning
ink.
Findings: add forecast-trial-disagreement to runValidity.ts. Fire when deterministic
first detect and trial first detect differ by more than one scan period of the first
detecting radar, or when trial kills fall outside the band. Text names both values.
Reuse spawn-in-ring as the cause when it is present.
Baseline row: 'No pinned baseline' with a Pin action that is disabled in this slice.
Tests: CompareScreen.test.tsx with a stub McSummary, runValidity.test.ts for the new
finding at both thresholds, BandChart accessibility text test.
Stop when: the chart and table render after a run with an ensemble, and the
disagreement finding fires for the JIATF-401 laydown.
```

### S6 Factor sweep engine

```text
Task: add a sweep request that runs one ensemble per grid cell over one or two scenario
factors.
sweepFactors.ts: applySweepValue(scenario, factor, value) for threatAltitudeFt,
threatSpeedMps, approachAzimuthDeg, raidSize, environmentPreset, each a pure function
that returns a new Scenario. Azimuth rotates every UAS path about the defended asset,
else the laydown centroid. Raid size truncates or repeats first-wave members with fresh
ids from the one id allocator.
mcRun.ts: McSweepRequest, SweepSummary, sweepLoop as a generator over cells that yields
a checkpoint per cell and drives replicateLoop with a replicates stop rule. Cells run in
sequence. The existing assertSummaryFits guard applies per cell.
Worker: route type 'sweep' on the sensitivity slot. Client: startSweep, cancelSweep,
requestSweepCancel, same shape as sensitivity.
Store: sweep state beside sensitivity in McState, runSweep and cancelSweep actions
through requestAnalysis, a message reducer. Result requires the current run and analysis
basis, as MC does.
Tests: parity test that every existing MC and sensitivity path is unchanged, a unit test
per applySweepValue, a sweep of 2 x 2 cells with 4 replicates that completes and cancels
in the real worker.
Stop when: a sweep completes from a store action in a test and no existing numeric test
changes.
```

### S7 Fragility screen

```text
Task: build the Prepare analysis screen.
Tiles: Kills, Leakers, Min warning from the current McSummary with the band inside the
tile. When no ensemble exists, one line with a Run Monte Carlo button.
SweepMap: CSS grid, factor values on the axes, one cell per SweepCell, cell fill from
the response value on a three-step scale using --status-nominal, --status-warning,
--status-critical. The value prints in the cell in --ink. Legend states the scale and
replicates per cell. Factor and value pickers sit in the section header, two factors at
most, six values at most, 36 cells at most. Estimated time from the last measured
replicate rate.
Sensitivity: ranked bars from responses of the selected response, swing as the bar
length and the number at the right. Response selector in the section header.
Validity: existing findings, one row each, one action each.
Inputs tab: the current BoardPreparation content, unchanged.
Tests: FragilityScreen.test.tsx with stub summaries, SweepMap.test.tsx for scale and
cap.
Stop when: a 5 x 4 sweep runs from the screen in the browser and paints as it
completes.
```

### S8 Pinned baseline

```text
Task: let the user pin the current laydown and ensemble as a baseline and compare
against it.
state/baseline.ts: PinnedBaseline with pinnedAt, label, scenario, mc, scenarioHash.
Actions pinBaseline, clearBaseline. The baseline never enters Scenario or the worker
graph.
Persistence: new key BOARD_BASELINE in storageKeys.ts. Runtime validation before
adoption. Recovery preserves an unreadable copy as the other keys do. Run npm run
schema:generate.
Compare: third column Baseline in the delta table, a dashed baseline mean on BandChart,
and a delta column Current minus Baseline. Pin and Clear actions in the Baseline row.
Label defaults to the scenario name and the pin time.
Tests: baseline persistence, recovery and validation tests beside the existing autosave
tests. CompareScreen test with a baseline present.
Stop when: pin, reload, compare and clear work in the browser and the storage panel
lists the new key.
```

### S9 Remove the lens system

```text
Task: delete the widget registry, lens presets, layout controls, widget components and
their tests once every screen is live.
Keep: any pure calculation a screen still imports. Move it beside the screen that uses
it. Keep the view-state reader tolerant of the old analysis field: read and discard it,
never fail a load.
Remove: WidgetFrame, registry, the twelve widget components, the five lens presets,
applyLens, setAnalysisCustomize, the Layout control and every test that exists only for
them.
Check: npm run check in full, including the bundle budget. Report the initial bundle
delta.
Stop when: check passes and no import of analysisLayout remains outside viewState.
```

### S10 Docs

```text
Task: bring the four current docs in line with the four screens, the sweep, the
baseline and the removed lens system.
PROJECT_GUIDE: replace the Analyze and lens paragraphs and the analysis rows of the
activity table. Name the four screens and their bases. State that the deterministic
forecast remains in export and the requirement record.
ENGINEERING_REFERENCE: add the sweep request contract, the apply-value rules and the
baseline key. Keep the invariants section unchanged.
DESIGN_SYSTEM: add the per-threat table, inventory bar and sweep map components with
their tokens.
VERIFICATION: map each screen to its tests and browser check.
Run npm run docs:check and npm run docs:review. Report fingerprint changes.
Stop when: docs:check passes and no doc describes a lens.
```

## 7. Completion record

Every slice passed its gate on 2026-09-08. Evidence:
[analysis-rebuild-2026-09-08](analysis-rebuild-2026-09-08/README.md).

| Slice | Commit | Gate |
| --- | --- | --- |
| S1 | `9a2b981` | tests, browser: screens mount, lens bar gone |
| S4 | `c99b03d` | fixed-ID parity on leakers swing and se, 13 fields |
| S3 | `ab336cb`, fixes `5e91b45` `e92428e` | tests, browser at 30x, 86 fps |
| S2 | `7faad63`, fix `b6295f6` | tests, browser: grid once, table sorts |
| S6 | `bb94514`, fix `2873ab3` | parity on every existing path, 2 x 2 worker sweep |
| S5 | `3032326` | tests, browser with ensemble, finding fired |
| S7 | `399eefa` | tests, browser: 5 x 4 sweep painted |
| S8 | `8d26f1e`, wiring `e919f09` | schema:check, recovery tests, pin, reload, clear |
| S9 | `dff38b0`, e2e `25fd789` | full gate, bundle budget, −1,668 bytes initial |
| S10 | see HANDOFF | `npm run docs:check` |
