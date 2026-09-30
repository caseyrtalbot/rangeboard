# Right panel redesign plan

This file is the frozen queue for the right panel redesign. Do not edit it when a row
lands, and do not record completion here. Progress lives only in
[HANDOFF.md](../HANDOFF.md). That file links here and selects exactly one row. After a
row's gate passes, rewrite the handoff so its Tasking section is the next row in the order
table, and leave this file unchanged.

Authored against `main` at `79f6f73` (2026-09-29). Line numbers are positions at
authorship; confirm them before an edit.

## Source

The user approved the redesign on 2026-09-29 from an HTML prototype, after one change:
every box aligns on one grid, and the layout accounts for the drawer.

- The approved prototype: [prototype/index.html](prototype/index.html), with `panel.css`
  and `panel.js` beside it. Open the file in a browser; it needs no server. The bar at the
  top switches the sample data (Before run, After run), the theme and the drawer width
  (280, 408, 560, Closed). Change notes lists each change on the current screen as CUT,
  MERGE, MOVE, NEW or EDIT. Point at a note to mark its element.
- The same prototype as an artifact that anyone with the link can open:
  <https://claude.ai/artifact/WUuoMJLkcctLzBQHuJqG7Y>. It holds the same three files as
  the repository copy. Give this link to an agent or a reviewer with no checkout.
- Screenshots of the current panel: `~/Desktop/ClaudeReference` on the user's machine.

The prototype is a behavior and layout source. It is not a pixel spec and not code to
copy. Its numbers are samples: the trial values come from RUN-0006, and the ensemble,
sweep, sensitivity, placement and saved-run values are invented. Its tokens are the tokens
in [DESIGN_SYSTEM.md](../design/DESIGN_SYSTEM.md) section 2. Where the prototype and the
design system disagree, the design system wins, except for the rules this plan adds
(D5, D6 and D8).

A read-only `sonnet-medium` survey on `79f6f73` (2026-09-29) supplied the test, entry
point, drawer, CSS and docs pointers below. The orchestrator checked the drawer, entry
point, status bar and consumer claims against the source.

Problems the redesign fixes:

| ID | Problem |
| --- | --- |
| P1 | Validity findings render in five places: Inputs, Fragility, Outcome, Compare and the evidence record |
| P2 | The panel repeats the chrome: the phase word, the scenario name, the run id, the clock, the seed, the speed and the MC progress are in the top bar, the transport or the status bar |
| P3 | Screen titles repeat the tab name |
| P4 | Fragility has three response selects, and its Run Monte Carlo button repeats the top-bar Run |
| P5 | The requirement thresholds (Inputs) and the forecast gate record (Analyze, Evidence products) are apart |
| P6 | Boxes do not share edges: pass-line inputs, inline labels and disclosure chevrons move the left edge |
| P7 | Tables clip names and times at 408 px (`THR-G3-...`, `13:...`) |
| P8 | The panel has no layout rule for its 280 to 560 px range |
| P9 | Execute omits C2 and the time left before arrival; a track cannot be selected from the panel without leaving the monitor |
| P10 | Exports and the run history are in three places across Outcome and Compare |

## Decisions

The user approved these with the prototype on 2026-09-29. The four open questions of the
first version took the prototype default (D1 to D4). D2 corrects an error in that version.

- D1. One Validity line sits under the tab row in Prepare and Analyze. It is the only
  place in the panel where findings render. It shows the state word, the count and a
  chevron, and it opens in place. A finding with a fix carries its action:
  `no-defended-asset` gets Place asset (`openLibrary('asset')`), and `spawn-in-ring` keeps
  its Select buttons. Prepare reads the forecast assessment. Analyze reads the completed
  trial's `view.validity`, else the forecast (as `OutcomeScreen.tsx:159` does now), and
  reads PENDING before a completed trial. Execute hides the line unless the status bar
  opened it (D10).
- D2. The Entity register stays, as the Entities section at the end of Inputs. It is
  closed by default, and its closed head reads `n placed · n threats`. The rail's
  Entities button (`openEntities`, `App.tsx:869-876`) opens it. The first prototype cut
  the register; that was wrong, because the rail has no other entity list.
- D3. When every track name in a table shares a prefix, the section head shows the prefix
  once and each row shows the rest. The row title carries the full name. The rule is one
  pure function with a unit test.
- D4. The Selected object tab (the Inspector and the detail panes) keeps its layout. It is
  out of scope.
- D5. The panel grid has four equal columns with 12 px gutters. A form control spans one,
  two or four columns. The requirement gate table uses the same four columns (gate,
  label, box, met), so its boxes align with the Run and Environment boxes above it.
- D6. The layout holds from 280 to 560 px. The panel (`.right-panel`) is a size
  container, and the rules key on the panel width, never on the viewport. Under 360 px
  the grid folds to two columns, a four-option segmented control becomes 2 × 2, gate
  labels stack above their boxes, and low-value columns (Held by, Effect, Slv) and the
  state word beside a state square drop. A dropped value stays in the row or cell
  `title`, so no text becomes unreachable.
- D7. A selection made from a panel row keeps the current tab and adds the Selected object
  tab. A board selection still switches to that tab (`App.tsx:903-905`).
- D8. Disclosure chevrons hang in the left padding, so every section title starts on the
  14 px content edge. The first tab label starts on the same edge.
- D9. These hooks stay: `#prepare-run`, `#prepare-environment`, `#prepare-doctrine`,
  `#prepare-requirements`, `#insp-tab-analysis`, `#insp-tabpanel`, `#drawer-toggle`,
  `.right-resizer`, the `AnalysisScreen` value `now`, and the storage keys
  `RIGHT_PANEL_OPEN_KEY` and `RIGHT_PANEL_WIDTH_KEY`. `#prepare-entities` is new. The
  Execute tab label becomes Monitor; its value stays `now`.
- D10. The status-bar Validity cell becomes a frameless button. It opens the drawer,
  selects the phase's screen tab and opens the Validity line.
- D11. No engine, physics, schema or saved-file change. Every value comes from an existing
  function or store field. New values (time to arrival, funnel counts, the kill-chain
  stage) are derived in panel code from existing fields.
- D12. Placement Preview draws a candidate laydown as ghosts on the board. It is the only
  board change, and it has its own row (R3).
- D13. The time-to-arrival tone thresholds are display constants in one named table:
  warning under 120 s, critical under 60 s. They are not requirements. The user confirmed
  D13 on 2026-09-29.

## Do not mix

- No parity expect moves; the parity files run inside `npm test`. If an expect moves,
  stop and report the numbers.
- No change to `Scenario` or any saved type. `npm run schema:check` passes. A new UI store
  field is not persisted unless its row says so.
- `src/panels/analysis/` is a guarded prefix, and `AnalysisPanel` loads lazily
  (`App.tsx:51-52`). Shell code (`App.tsx`, `StatusBar.tsx`, the other files in
  `src/panels/` that the entry reaches, and `src/ui/`) must not gain a static import of a
  guarded module. Do not run `node scripts/check-entry-graph.mjs --write`. A piece that
  both the shell and a screen need goes in `src/ui/` or the store.
- Keep the exports other panes use: `SystemStatus.tsx` exports `STATE_LABEL` and
  `stateTone` to the three detail panes; `controls.tsx` holds `EmptyRow` and `NoteInfo`
  for the detail panes. The `.insp-row`, `.tb`, `.tb-dense`, `.field-info` and
  `.field-help` rules also serve the Inspector and Settings; change them only in a
  panel-scoped selector.
- No feature beyond the prototype. Record every other finding as a follow-up.
- `src/index.css` is shared. A lane edits only the selector groups it owns and adds new
  rules only inside its own block in the Right panel region that R1 creates. Lanes that
  pass `check:bundle` alone can fail together; the integrator measures the merged build.
- No `git stash` while lane worktrees exist: the worktrees share one stash list.

## Order

| Row | Content | Parallel | Waits on | Worker | Budget |
| --- | --- | --- | --- | --- | --- |
| R1 | Shell and shared primitives | serial | the user's word | `opus-high` | 2,400 s |
| R2 | Screens, lanes R2a to R2d | the four lanes | R1 merged | `opus-high` (R2a, R2b, R2c), `opus-medium` (R2d) | 2,400 s each |
| R2-int | Integration, docs, review, capture | serial | the four lanes | orchestrator, `opus-high` review, `fable-medium` comparison | 1,500 s per worker |
| R3 | Placement preview on the board | serial | R2-int merged | `opus-high` | 1,500 s |

Run one row per agent turn. Start each row from `main` after the user merges the row
before it. R1 commits on `panel/r1` and R3 on `panel/r3`. The R2 lanes run in worktrees
outside the repository at `~/Projects/rangeboard-wt/r2a` to `r2d`, with a `node_modules`
symlink, on branches `panel/r2a` to `panel/r2d`. The integrator merges them on
`panel/r2-int`. Merge and push wait for the user's word. Remove the worktrees at the
merge.

Gate for every row and lane:

```sh
npm run check
npm run check:bundle
npm run check:silent
E2E_URL=http://localhost:<port> npm run test:e2e
```

Start the dev server for the e2e run on a free port of your own
(`npm run dev -- --port <port> --strictPort`) and stop only that process. In a worktree,
select a single test file with `npx vitest run --dir src <file>`.

Report the test files and tests against the base (225 files and 2,518 tests on `fdfa6b3`;
confirm on the plan commit) and explain each difference. The screen tests render with
`renderToStaticMarkup` and assert on the markup string, so every lane rewrites its own
tests: list each test deleted, rewritten or added, with the reason. Report the
`check:bundle` entry and initial bytes and the entry-graph line.

Browser check for every row: a Playwright pass at drawer widths 280, 408 and 560, in the
Night and Paper themes, on an empty board and on a board after a Monte Carlo run, a
completed trial and a sweep. Visit every screen the row touches. Pass: no console error,
no horizontal scroll in `#insp-tabpanel`, and no clipped text without a `title`. R2-int and
R3 save their captures under `docs/field-te/evidence/right-panel-<row>-<date>/` with a
README, following the evidence rules (`npm run check:evidence`).

Docs: R1 and R3 update the docs their change affects. The R2 lanes do not edit docs;
R2-int owns every R2 doc edit. Record each review that `npm run docs:check` asks for with
a concrete note (`npm run docs:review -- <document> --note "..."`).

## R1. Shell and shared primitives. `opus-high`

Owns:

- `src/App.tsx`: `PanelTabs` (335-392), `PanelMenu` (394-470), the panel heading
  (1131-1134), `openDoctrine` (906-921), the selection effect (903-905) and the
  `StatusBar` mount (1123)
- `src/panels/StatusBar.tsx`, the validity cell (260-263) and its props, and its test
- `src/state/store.ts`: the new UI fields and actions below
- `src/panels/AnalysisPanel.tsx` and `AnalysisPanel.test.tsx`
- `src/panels/analysis/screens/navigation.ts`, `AnalysisNavigation.tsx` and its test
- `src/panels/analysis/runValidityText.tsx`
- new: `src/panels/analysis/ValidityLine.tsx`, `PanelSection.tsx`, `trackNames.ts` and
  `useRunHistorySave.ts`, each with a test where it has logic
- `src/panels/analysis/screens/OutcomeScreen.tsx`: the `useRunHistorySave` import only
- `src/index.css`: the panel heading rules, the tab row padding, and a new Right panel
  region with the shared rules and empty lane blocks R2a to R2d
- `scripts/e2e/board-shell.e2e.mjs`: the tab lists (190-201; Execute expects `Run monitor`) and one new drawer test
- `docs/design/DESIGN_SYSTEM.md`, `docs/PROJECT_GUIDE.md` (23-26),
  `docs/ENGINEERING_REFERENCE.md` (the App shell and analysis module rows) and
  `docs/VERIFICATION.md` (337-339)

Facts:

- The heading is `.board-panel-heading.insp-head` with `<h2>{PHASE_WORD[boardPhase]}</h2>`
  and `<PanelMenu />` (`App.tsx:1131-1134`). The selected top-bar tab already names the
  phase.
- `PanelMenu` holds Show field help, Collapse all and Expand all. Collapse all and Expand
  all act on every `details` in the panel body. `openDoctrine` sets `open` on the
  `#prepare-doctrine` `details` and focuses its `summary`.
- The screen choice is component state (`App.tsx:670-671`), not persisted.
  `analysisScreen` is `now` in Execute (672-673).
- The selection effect runs `setRightTab('inspect')` when the selection becomes non-empty
  (903-905). Validity finding buttons call `select` and then `setRightTab('inspect')`
  themselves (`runValidityText.tsx:47-60`).
- The drawer: `rightOpen` (707) under `RIGHT_PANEL_OPEN_KEY` (720); `rightW` (923) under
  `RIGHT_PANEL_WIDTH_KEY` (928); `RIGHT_MIN_W` 280 and `RIGHT_MAX_W` 560 (71-72); default
  408 (76); `RIGHT_CLOSE_DRAG` 60 (213); the 44 % cap in CSS (`index.css:5249`); the
  keyboard nudge (930-945); the drag (947-966); `]` (1003-1006). None of this changes.
- The status bar counts findings with `assessRunValidity` (`StatusBar.tsx:125-135`) and
  renders `<span className="sb-validity">` (260-263). It already imports
  `analysis/runValidity`, so a button adds no graph edge.
- `ui.libraryRequest` (`store.ts:161, 629, 1441`) is the pattern for a shell request with a
  sequence number.
- `useRunHistorySave` is defined in `OutcomeScreen.tsx` (253-285). R2c (Save run) and
  R2d (Save current) both need it.
- `index.css` has no `@container` rule today.

Work:

1. Remove the panel heading row. Put `PanelMenu` at the end of the tab row, after the
   contextual tab, pushed right. Keep its label `Panel options` and its three items.
2. Put the first tab label on the 14 px content edge (D8). Label the Execute tab Monitor.
3. Store, UI only, not persisted:
   - `selectionOrigin: 'board' | 'panel'`, written by `select(patch, additive, origin)`
     with `origin` defaulting to `'board'`. The App effect switches to `inspect` only for
     `'board'` (D7). Check that every current `select(` caller keeps its behavior.
   - `openSections: Record<string, boolean>` with `setSectionOpen(id, open)` and
     `setAllSections(open)`. Section ids are the DOM ids (D9).
   - `validityOpen: boolean` with `setValidityOpen(open)`.
   - `panelRequest: { seq, phase, screen, section }` with `requestPanel(...)`, on the
     `libraryRequest` pattern. App handles it: it sets the phase and the screen, selects
     the analysis tab, opens the drawer, opens the section and scrolls it into view.
     `openDoctrine` becomes a `requestPanel` call.
4. `PanelSection.tsx`: the one section head for every screen. It takes a title (`h3`), an
   optional mono readout, an end slot for actions and (i), an optional DOM id, and an
   optional collapse with a closed-state summary. A collapsible section is a toggle
   button with `aria-expanded` and `aria-controls`, and its state is
   `ui.openSections[id]`. The chevron hangs in the left padding (D8). Collapse all and
   Expand all call `setAllSections` and still act on each remaining `details`.
5. `ValidityLine.tsx` (D1): props for the phase and the assessment; the open state is
   `ui.validityOpen`. Order the findings invalidating first, as
   `BoardPreparation.tsx:113-116` does. Place asset calls `openLibrary('asset')`. Keep
   `FindingThreatActions` for `spawn-in-ring`.
6. `AnalysisPanel.tsx`: render `ValidityLine` at the top of the body, sticky under the tab
   row, in Prepare and Analyze, and in Execute while `validityOpen` is true. Compute the
   assessment there (D1). The screens keep their own validity renders until their R2 lane
   removes them.
7. `StatusBar.tsx`: the validity cell becomes `<button type="button">` with an
   `onOpenValidity` prop and the same text and `LIMITS` tag. App passes a handler that opens
   the drawer, selects the analysis tab and calls `setValidityOpen(true)` (D10).
8. `trackNames.ts` (D3): `splitCommonPrefix(names)` returns the shared prefix, cut at the
   last space or hyphen, and the rest of each name. It returns an empty prefix when fewer
   than two names share one.
9. Move `useRunHistorySave` from `OutcomeScreen.tsx` to `useRunHistorySave.ts` with no
   change in behavior, and fix the one import.
10. `index.css`, new Right panel region: `container: right-panel / inline-size` on
    `.right-panel`; the panel grid (`.pgrid`, `.pg-1`, `.pg-2`, `.pg-4`); the section head,
    the hanging chevron and the closed summary; the unenclosed stat row (a top rule, no
    frame, used by R2c); the rules under 360 px for these pieces and for `.seg.pg-seg4`
    (2 × 2); then empty blocks headed R2a, R2b, R2c and R2d. Delete the heading rules
    that no element uses after step 1.
11. `board-shell.e2e.mjs`: expect the Monitor label in the tab list. Add one test: at
    stored widths 280 and 560 (`rangeboard.rightpanel.width`), Prepare, Inputs has no
    horizontal overflow in `#insp-tabpanel`.
12. Docs: in `DESIGN_SYSTEM.md`, replace the paragraph on the 32 px panel header (near
    186-198) and add the D5, D6 and D8 rules. Update the other three docs where they
    describe the heading, the tab row or the e2e drawer tests.

Checks: unit tests for `ValidityLine` (each state, the two actions, the Execute rule),
`PanelSection` (ids, `aria-expanded`, the closed summary), `splitCommonPrefix` (a shared
prefix, none, one name, numbered suffixes) and the store fields (a panel `select` keeps the
tab; the `panelRequest` sequence). The browser check covers the tab row, the Validity line
in Prepare and Analyze, and the status-bar button with the drawer closed.

Stop: the gate passes, the commit is on `panel/r1`, and the handoff selects R2.

## R2. Screens

Four parallel lanes on disjoint files. Each lane builds its screens from the prototype
with the R1 primitives, removes the items the change notes mark CUT, MERGE or MOVE, and
rewrites its tests. No lane edits `App.tsx`, `store.ts`, a doc or another lane's files.
A lane that needs a change outside its files reports it to the integrator.

### R2a. Inputs. `opus-high`

Owns:

- `src/panels/BoardPreparation.tsx` and its test
- `src/panels/analysis/ForecastSettings.tsx` and its test, `EnvironmentSettings.tsx`,
  `FireDoctrineSettings.tsx` and `RequirementSettings.tsx`
- new `src/panels/analysis/RequirementTable.tsx` and its test
- `src/index.css`: the `.prepare-*`, `.board-preparation`, `.forecast-line`, `.run-det`,
  `.apply-check`, `.adv-toggle` and `.roe-label` rules, and the R2a block

Facts:

- `BoardPreparation` renders the `ObjectHeader` (93-98), `#prepare-run` with
  `ForecastSettings` (100-107), the Scenario inputs wrapper with three `details` (61-83,
  109-111), Run validity (113-137) and the Entity register (139-155).
- The run mode is `runMode`, and `replicates` and `seed` are patched through
  `patchScenario` (`RunTab.tsx:174-198`).
- The thresholds (`pdDetect`, `pdTrackCumulative`, `maxResidualPerTrack`, `minWarningS`)
  and their clamp and blank rules are in `RequirementSettings.tsx`.
- `buildRequirementGateReport(scenario, assessments, report, validity)`
  (`requirements.ts:165`) returns six gates (detect, track, identify, target, engage,
  effect; 234-330). Each has `met`, `required`, `status` (`pass`, `fail`,
  `not-evaluated`), `metric`, `detail`, `notEvaluatedReason` and `failures`.
  `DebriefRecord.tsx:241-253` builds it today from the forecast picture.

Work:

1. Remove the `ObjectHeader`, the forecast line and the Deterministic checkbox. The Run
   section (`#prepare-run`) holds Mode (Monte Carlo, Deterministic) over two columns, and
   Runs and Seed over one column each. Its head end holds `ENSEMBLE STALE` while
   `mc.status` is `stale`, and a Settings link that opens Settings at Run. The prototype's
   new-seed button is not in scope; record it as a follow-up.
2. Environment and Fire control are collapsible `PanelSection`s with a closed summary.
   Effects is a switch in the Environment head. Doctrine is a switch beside ROE; with
   doctrine off, the doctrine fields hide and one line states the ROE gating rule. Release
   range shows only for the range-fraction launch point. The launch labels are Max range,
   Fraction, Pk commit and Latest, with the full hint (`LAUNCH_POLICIES`) as the segment
   title and the field help; keep the short labels in the panel file.
   EM clutter reads Rural and Urban, with the full words in the title.
3. Requirements (`#prepare-requirements`): `RequirementTable` on the four columns (D5).
   Rows follow the kill chain. The pass lines are boxes with the current clamp and blank
   rules. DETECT and EFFECT carry `gate.metric` as a sub-line. Met is a state square and
   `met/required` in the tone of `status`; `not-evaluated` shows a hollow `N/E` with
   `notEvaluatedReason` as its title. A failed gate row opens its `failures` with Select
   buttons. The closed summary reads `n of 6 gates met · forecast`.
4. Entities (`#prepare-entities`, D2): the register rows grouped by kind with counts, the
   forecast state for threats, closed by default. A row opens the entity in the Selected
   object tab, as it does now.
5. Remove the Run validity section. Delete `ForecastSettings.tsx` if no other module
   imports it.

Checks: the rewritten `BoardPreparation` test finds the five section ids, six gate rows
with four boxes, the stale chip and the entity count. At 280 px the gate labels stack
above their boxes.

### R2b. Fragility and Placement. `opus-high`

Owns:

- `src/panels/analysis/screens/FragilityScreen.tsx` and its test
- `src/panels/analysis/screens/PlacementScreen.tsx` and its test
- `src/panels/analysis/SensitivityWidget.tsx` and its test, placement in the screen only
- `src/charts/SweepMap.tsx` and its test, the caption and the empty grid only
- `src/index.css`: the `.frag-*` rules (1992-2066) and the R2b block

Facts:

- Fragility keeps three response states: `response` (206), `sweepResponse` (207-209) and
  the tiles. A sweep runs every response (`responses: [...SENSITIVITY_RESPONSES]`), and
  a one-at-a-time sensitivity row carries every response, so one select changes only the
  display. A full-depth run screens on one response (`analysisRequests.ts:160-175, 286`).
- In Prepare the top-bar Run runs and stops the ensemble (`RunControl.tsx:106-117`).
- The sweep value rules: `parseFactor` (160-177), `SWEEP_VALUES_MIN` and `_MAX`, and
  `sweepGridValid` (two different factors, at most 36 cells).
- Placement: `RESPONSE_DIRECTION`, the movable kinds, the range boundaries with at least
  three points and `boundsRefusal`, the budget rule, `startOptimize`, `candidateRows`, and
  Apply through `replaceScenario(withPlacement(...))`. The Boundary tool is
  `setTool('boundary')` (`store.ts:93`).

Work:

1. One Measure select over four columns replaces the three selects. An option that needs
   a defended asset is disabled with `· needs asset` when no active asset exists, and the
   screen then falls back to Kills. When a full-depth result ran on another response, the
   Sensitivity head says which one.
2. Ensemble: a table of the five quantities with the mean and the 95 % interval on the
   mean (the `mc.ts` helpers); the horizon once in the readout; Pin in the head end with
   the current disabled reasons. The empty state names the top-bar Run and ⌘↵. Remove Run
   Monte Carlo, Cancel Monte Carlo and the progress line.
3. Sweep: Factor A and Factor B as stacked fields; values as chips with remove buttons, an
   add box (Enter adds, with the current parse rules) and a row of suggested values
   (planning values, kept in the panel file); Add second factor and Remove; the readout
   `cells · runs each · ~s` from the current rate estimate; Run sweep and Cancel in the
   head end. The map draws its empty grid before a run.
4. Sensitivity: Run in the head end; rows on the four columns (the name over two, the bar,
   the value); the top five and Show all; p10, p90, SE and the definedness text when a row
   opens. The Morris and Sobol widget stays above the rows.
5. Remove the Validity section and the repeated no-asset rows.
6. Placement: Goal is one select with the direction in each option; Systems to move rows
   carry a kind tag, the short name, the full name, the count and All and None; the empty
   Bounds state carries Draw boundary; Budget sits on the grid with Total; Run placement
   lists what is missing; the method paragraph moves to the Budget (i).
7. Candidates: rank, the interval bar on one scale per result, the change against the
   start laydown, Apply, and the coordinates when a row opens. R3 adds Preview.

Checks: the rewritten tests cover the Measure fallback, the chip parse rules, the Show all
toggle, the Placement needs list and the candidate scale.

### R2c. Monitor and Outcome. `opus-high`

Owns:

- `src/panels/analysis/screens/NowScreen.tsx`, `LiveStrip.tsx`, `SystemStatus.tsx` and
  their tests (keep the `STATE_LABEL` and `stateTone` exports)
- `src/panels/analysis/screens/OutcomeScreen.tsx`, `DebriefRecord.tsx`,
  `RequirementGates.tsx`, `threatReadout.ts` and their tests
- `src/index.css`: the `.live-*` rules (3289-3380), `.system-telemetry-*`,
  `.component-*`, `.rr-bar`, `.debrief-*`, `.evidence-products`, `.run-validity`,
  `.requirement-gate` and `.gate-*`, and the R2c block

Facts:

- `NowScreen` derives each track's state (86-126) with `deadTimeOf` and
  `trialMemberStatesAt` at `selectTrialHorizon`. `ThreatAssessment.arrivalS` holds the
  planned arrival.
- The `LiveStrip` card shows the clock, the horizon bar, the replicate index, the seed,
  the speed and three counts (75-139). The status bar and the transport show the clock,
  the seed and the speed.
- `trialSystemTelemetryAt(view, horizon)` returns components with `kind` `sensor`, `c2`
  or `effector` (`systemTelemetry.ts:19, 434`). `NowScreen` drops C2 (130-134).
- `view.attrition.events` holds the engagement events for the recent-events feed.
- `CompletedOutcome` (`OutcomeScreen.tsx:137-238`) renders six tiles, the table, the
  records and `DebriefRecord`, which holds Export debrief JSON, Capture final PNG, New
  clean run and the forecast requirement record.
- `exportRunCsv` needs a `RunRecord`. `runRecordOf` in `mc.ts` builds one from a finished
  ensemble, as Save does.

Work:

1. Monitor: remove the `LiveStrip` card. A stat row of six cells (DET, ID, TGT, ENG, DEF,
   LEAK) counts the tracks that reached each milestone; DEF and LEAK count members, as the
   Outcome result bar does, and each cell title names its denominator.
2. Tracks: names by D3; chain pips for the six stages; the state word; Held by (drops
   under 360 px); TTA as `arrivalS` minus the horizon in m:ss, toned by D13, `arrived` at
   or after arrival and `—` without an arrival. The default sort is TTA ascending, with
   the current sortable headers. A row click selects the track with origin `panel` (D7).
3. Systems: one list grouped Sensors, C2 and Effectors, with C2 added. Each row holds a
   state square and word (the word drops under 360 px) and a readout: held tracks and hold
   time for a sensor, routed tracks for C2, and magazine pips with `remaining/capacity`
   for an effector, or `cont.` for a jammer or HPM.
4. Recent events: the last five salvo and identification events at or before the
   horizon, newest first.
5. Remove New run, Forecast and analysis and the lazy Settings import from `NowScreen`.
6. Outcome: one provenance line (`Trial · seed n · T+m:ss`); Save run
   (`useRunHistorySave`) and an Export menu in its end. The menu holds the debrief record
   (JSON), the final board frame (PNG), and the per-threat and per-effector tables (CSV)
   from `runRecordOf` when a finished ensemble exists for the current basis; otherwise the
   CSV items are disabled with the reason.
7. The result bar: one segment per member, defeated before arrival, late kill or leaked.
   Without an active asset the bar states that arrival is not measurable. The stat row
   holds First detect, First effect, Salvos (the kinetic, EW and DE split in the title)
   and Gates met from the forecast report; Gates met opens Prepare, Inputs, Requirements
   through `requestPanel`.
8. Tracks: strips by default, a table on toggle. The strips share one axis from 0 to the
   duration, with marks for detection, identification, each salvo, arrival, and a defeat
   or late kill when present. The table columns are Detect, ID, Engage, Effect, Slv and
   Result, with names by D3; Effect and Slv drop under 360 px.
9. Records: Event ledger, Systems at end of run and Manifest, as disclosures. Remove the
   Evidence products wrapper, New clean run, the forecast requirement record, the
   Validity disclosure and `RunHistory`. Delete `RequirementGates.tsx` and
   `RunValidityBanner` when no module imports them.

Checks: the rewritten tests cover the stage derivation, the TTA text and tones, the C2
row, the event order, the result-bar counts against `trialKpisAt`, and the disabled CSV
items without an ensemble.

### R2d. Compare and saved runs. `opus-medium`

Owns:

- `src/panels/analysis/screens/CompareScreen.tsx` and its test
- `src/panels/analysis/RunHistory.tsx` and its test
- `src/index.css`: the Compare and run history rules and the R2d block (the `.tiles` rule
  stays until R2-int, because Fragility and Outcome use it before the merge)

Facts:

- `CompletedCompare` (116-356), `BaselineRow` (359-397) and `SavedRunCompareView`
  (485-620) render the chart, the five-column table, the details, the findings, the
  baseline row and the two A and B pickers with `RecordExports`.
- `RunHistoryView` (`RunHistory.tsx:325-420`) holds Import run, Export SQLite, Save to
  history and the saved-run list with Open and Delete.

Work:

1. Trial against ensemble: the head holds the readout, an export-PNG icon button and the
   (i) with the method paragraph. The chart stays. Interval rows replace the table: each
   quantity draws its band, mean, trial dot and baseline tick on one scale, then the trial
   value and the flag (the word drops under 360 px). The interval and definedness notes
   move to the row titles and the (i). The baseline row holds its label and Clear, or Pin
   current.
2. Remove the Findings section.
3. Saved runs: one table with the A and B pick buttons, the run label, the saved time and a
   per-row menu (Open, JSON, per-threat CSV, per-effector CSV, sensitivity CSV, Delete). The
   head end holds Save current (`useRunHistorySave`) and a menu with Import run and Export
   all runs (SQLite). The A − B table shows under the list when A and B differ, with the
   interval under each mean and no interval on the difference. Open keeps the current
   saved-run view. A and B default to the two newest records.

Checks: the rewritten tests cover the interval rows, the pick buttons, the A − B table and
the Save current enable rule.

## R2-int. Integration, docs, review and capture

Orchestrator, then an `opus-high` review, then a `fable-medium` comparison.

Owns: the merges on `panel/r2-int`; `openEntities` in `App.tsx` (the `#prepare-entities`
target through `requestPanel`); the deletion of orphan CSS (`.tiles`, `.tile` and each
lane rule no element uses, checked with a grep of `src/`); every R2 doc edit; the e2e file;
the evidence capture.

Work:

1. Merge R2a, R2b, R2c and R2d in that order. The lane blocks in `index.css` are disjoint;
   resolve a conflict in favor of both blocks.
2. Docs: `DESIGN_SYSTEM.md` (the Run monitor card near 310, the Sweep map near 404, the
   Inputs forecast header and the Deterministic sentence), `PROJECT_GUIDE.md` (94-105,
   152-168, 174), `ENGINEERING_REFERENCE.md` (the analysis module rows) and
   `VERIFICATION.md` (the right panel table near 126-137).
3. Run the gate and the browser check on the merged branch.
4. Brief the `opus-high` review on the full diff against this plan. Fix each must-fix
   finding.
5. Brief the `fable-medium` comparison: the running app against the prototype at 280, 408
   and 560 px in both themes. It lists deviations by class. Fix class 1; list the rest in
   the handoff as follow-ups.
6. Save the capture under `docs/field-te/evidence/right-panel-r2-<date>/`.

Stop: the gate passes, the commit is on `panel/r2-int`, and the handoff selects R3. The
user decides the merge.

## R3. Placement preview on the board. `opus-high`

Owns:

- `src/state/store.ts`: `ui.placementPreview: { rank: number; positions: Laydown } | null`
  and its action, not persisted
- new `src/canvas/layers/PlacementPreviewLayer.tsx` and its test
- `src/canvas/CanvasStage.tsx`, the layer mount only
- `src/panels/analysis/screens/PlacementScreen.tsx`, the Preview button only
- docs: the placement text in `PROJECT_GUIDE.md` and the layer list in
  `ENGINEERING_REFERENCE.md`

Facts:

- `Laydown` (`playback/optimizeTypes.ts`) maps entity ids to `{ x, y }` in the meters
  world frame. Import it as a type only: a value import from `src/playback/` into the
  canvas fails `check:entry-graph`.
- Canvas inks come from `useBoardInk()`; a layer never hard-codes a theme ink
  ([DESIGN_SYSTEM.md](../design/DESIGN_SYSTEM.md) section 1, rule 9).

Work:

1. Preview toggles a candidate: hollow markers in the tool ink at the candidate positions
   of the movable entities, a dashed leader from each current position, and the short
   name. Nothing is written to an entity, and the preview never enters the undo history.
2. The preview clears when the result stops matching the board (the run id or the basis
   signature changes), when the phase leaves Prepare, on Apply and on Escape.

Checks: a unit test that the preview leaves `scenario` and the undo stacks unchanged; the
browser check with a preview on and off in both themes; Apply still installs a copy.

Stop: the gate passes, the commit is on `panel/r3`, the handoff selects nothing, and this
queue is complete.

## Follow-ups outside this plan

- The Selected object tab keeps its layout (D4). A later pass may apply the panel grid.
- The prototype's new-seed button in the Run section (R2a, step 1).
