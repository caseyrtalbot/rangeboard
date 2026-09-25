# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [README.md](README.md) and the
commit log. This file holds only the position, the current task and the landmines. A
fresh agent starts from this file and the docs index. This file does not authorize a
commit, push or merge.

[Plan.md](Plan.md) is the chrome refactor queue (Option C plus the inspector text-density
pass, 2026-09-24). Rows A, B and C are built. Row C is merged to local `main`
(2026-09-25) and waits on a bundle-budget decision and a push. No row is selected.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch at
  `05e9e73`, 18 commits ahead of `origin/main` (`01fd3ac`, the Row B handoff commit).
  Not pushed.
- Row C (2026-09-24) was fast-forwarded into `main` on 2026-09-25 with the user's merge
  authorization: the four lane merges (`chrome/c1` `16c8027`, `chrome/c2` `4a5584b`,
  `chrome/c3` `355d68b`, `chrome/c4` `2790101`), the integrator fixes, the docs, the
  `opus-high` review fixes, the final capture, the canvas-comparison fix and the two
  Row B ride-along fixes. The lane worktrees and the lane branches (`chrome/c1..c4`,
  `chrome/int`) are deleted; `~/Projects/rangeboard-wt` is empty.
- Row C gate on `main` at `05e9e73` (2026-09-25): `npm run check` passes (210 files, 2,264
  tests, docs and evidence gates green, build green), `test:e2e` 13 of 13 on a dev
  server at 5393. `check:bundle` fails: entry gzip 368,173 against 368,000, initial 385,659 against
  400,000. The lanes cost about 1,111 entry bytes against 992 of headroom (C1 625, C3
  424, C4 40, C2 22); the integrator removed the top-bar Deterministic switch, the unused
  `onOpenSettings` prop and the unreachable `openPreparation` branches, and the review
  fixes added bytes back. Per D3 the shortfall of 173 bytes goes to the user: raise the
  budget to at least 368,200, or name a removal. `WORKFLOW.md` and the Quality workflow
  state the budget; both change with it.
- Final capture: [chrome-2026-09-24](field-te/evidence/chrome-2026-09-24/README.md), nine
  shots at 1440 × 900 dark on the firing fixture with `findings.json` (header 32 px at
  13/500, tab row 32 px at 12/500, every (i) 24 px, finding rows 28 px, detail section
  headers 28 px, 0 page errors). The `fable-medium` comparison with the two canvases is
  in the follow-ups below.
- What Row C built. C1: one right-panel tab row (`.insp-tabs`, the phase's screen tabs in
  `.insp-tab-group` with `insp-tab-analysis` on the current screen, then the contextual
  tab: the selected object's name with a 6 px accent dot, `N entities`, a boundary or
  connection name, `Raid builder`, or `Model library` while the editor is open), the
  32 px `.insp-head` with the phase word and the Panel options ⋯ (`#panel-options-panel`:
  Show field help switch, Collapse all, Expand all over every `details` and every
  `.det-s-toggle` in `#insp-tabpanel`), `FieldHelpProvider` mounted from
  `ui.showFieldHelp`, `Placement` in place of `Where to put it`, a saved `rightTab`
  'library' mapped to 'analysis'. C2: `No ensemble` and `No defended asset` chips with
  `Place asset` (clicks the rail Library trigger), the sweep readout `n cells · 40
  reps/cell`, sweep value `Field`s with `unit`, placeholder and `error` (empty string
  while valid), section (i) notes with `.frag-help` lines under the switch, finding
  headline rows (28 px button, `aria-expanded`, open under the switch). C3: the threat
  pane's `Model basis` row with a (i), `DetailSection` `collapsible` and `defaultOpen`
  (Track open; Engagement, Path, Phase collapsed with mono summaries), one line per
  value with the full text in `title`, the `N sensors ›` drill-in, the altitude band in
  its (i), the LiveStrip status sentence removed from the entity workspace. C4: every
  settings field through `Field` with `unit` and `help`, `Auto` placeholders, slider mono
  readouts, one mono forecast line `MC done / loop end · seed n` with the stopping rule
  in its title, the `Deterministic (fixed seed)` checkbox under it; the top-bar switch is
  gone, so the checkbox and the Settings Run tab are the two run-mode controls.
- Plan text the build departed from, each with its reason: the `LibraryEditor` mount
  stays as a contextual `Model library` tab (Palette, CommandPalette, ContextMenu and
  LibraryEditor still call `setRightTab('library')`; removing the mount would make those
  actions no-ops and saves no bytes); `PHASE_SCREENS` keeps Fragility first and
  `SCREEN_ORDER` sorts the row (AnalysisPanel defaults to the first screen); the
  contextual tab covers every selection kind, not only an entity (the inspect view
  renders boundaries and connections too); the screen group carries no ARIA role (a
  tablist may own only tabs); `Place asset` opens the library but not at Assets (App
  holds the drawer state locally and Palette has no filter preset); the Model basis row,
  the collapsible sections and the removed status sentence apply to the threat pane
  only (the sensor, effector and system panes were outside C3's files); the sweep
  fields' error also goes on the last text field for grid-level rules; the sensitivity
  sampling record is the section readout and its method note sits behind the (i).
- The authorized estimate-path recapture is `225e027`. Its expects: layered events 11,
  layered kill mass 1, layered kills mean 1.115, JIATF leakers mean 0.895, JIATF kills
  mean 0.105. `4.68` is not a pin.
- The flight horizon is `7fdcb1e`.

## Follow-ups (not fixed)

Handling: candidates, not rows. The one triage after Row C: the user picks fix-now items
for a follow-up row in `Plan.md`, folds them into a later row, or drops them.

From the Row C review and the lanes:

- `Deterministic (fixed seed)` misstates the model: deterministic mode samples nothing
  and uses no seed. The plan and the canvas both carry that text; a wording change
  (`Deterministic (no sampling)`) needs a plan decision.
- `Place asset` should open the library at Assets: a store action App and Palette read
  (`openLibrary(kind)`), then focus or filter the Assets group.
- Move the `setRightTab('library')` callers (Palette `New model` and `Model basis`,
  CommandPalette model commands, ContextMenu `Edit model specs`, LibraryEditor) to the
  left panel, then drop the `LibraryEditor` mount and the contextual tab.
- `src/charts/SweepMap.tsx:115` still renders the muted sentence `No defended asset;
  response unavailable.` in its figcaption; the chip beside the widget carries it now.
- The sensor, effector and system detail panes keep the fid-tag chips and the
  `Simulated trial · …` line; apply the C3 pattern there.
- Dead CSS with no TSX user: the `.lens`, `.lens-b*`, `.lens-layout*` rules
  (`index.css` about 2264-2335, 4745, 5377-5520); `.field > .field-help` and
  `.frag-help`, and `.field-info` and `.frag-info`, hold the same declarations.
- `RunTab.tsx:151` asserts the `none` placeholder in `inputs.tsx`, which is not sentence
  case.

From the Row B review, still open:

- The rail's Frames button is disabled in Prepare with the reason only in its title; a
  route into Execute that focuses `#frame-add` would serve D4 better.
- No test covers the rail routes (`openLayers`, `openFrames`) or that Pause and Resume
  stay enabled in Execute under deterministic mode.
- Library rows draw the friend-frame dome for sensor, effector, C2 and asset kinds;
  per-subtype shapes need new `Glyph.tsx` shapes.
- `F2` focuses the scenario name only while focus is inside the header; the drawer
  toggle's icon no longer shows the open state.
- Some `+ Frame` and popover items have no static-render test.

From the `fable-medium` canvas comparison (capture versus the two canvases; class in
brackets: 1 structure, 2 density rule, 3 text, 4 tokens):

- Entity view keeps a second tab level (Telemetry · Configure · Model basis) under the
  one tab row, so P3 stays open there [1].
- `Run Monte Carlo` on Fragility is a filled accent button; the canvas shows an outline
  28 px button, and the token sheet allows one accent control per phase [4].
- Outcome: `Export debrief JSON` is a second accent-filled control and `New clean run` is
  a rival run verb beside the top-bar `Run again` (P1) [1, 4].
- Run monitor opens with a muted status sentence (`Paused · Simulated trial · observed
  through …`); the canvas shows a card with the clock, a progress bar and Replicate,
  Seed and Speed rows [2].
- Run monitor keeps body buttons `New run` and `Forecast and analysis` under Sensors;
  the canvas has no body run controls (D7) [1].
- Run monitor sections are `Kill chain`, `Effectors`, `Sensors` as 15 px headings; the
  canvas shows Engagements (open), Tracks and Run validity as 32 px collapsible rows with
  counts; no Run validity section exists in Execute [1].
- Inputs carries the `Entity register` list and a `Run validity` block with full finding
  paragraphs; the canvas shows findings as one collapsed row with a count and tag [1].
- Inputs repeats the scenario name and run id in its header (P2) with an INVALID tag;
  the canvas card reads `Scenario inputs` with a PENDING tag [1].
- The forecast line renders in accent; the canvas sets it mono text 1, and `· total` is
  extra [3, 4].
- Fragility has no `Monte Carlo` section header or (i); the 15 px `Fragility` heading
  repeats the tab label [1].
- `Run sensitivity · Morris then Sobol` carries the method in the label; the canvas
  reads `Run sensitivity` [2].
- The muted meta line `Full-run setup findings · INVALID` sits above the finding rows;
  the canvas puts the count tag in the Validity header [2].
- Finding rows carry the INVALIDATES or LIMITS word and a border; the canvas rows are a
  glyph, the headline and a chevron [3].
- Sweep help under the switch reads `Planning-factor values. Estimated time: no rate
  yet.`; the canvas reads `Planning-factor values. 40 replicates per cell.` and adds a
  second line with the 2 to 6 value rule [3, 2].
- Open findings show the `Gates:` line and a Select button; `Review finding scope` is one
  disclosure at the bottom, not a dense button per finding [1].
- Sweep factor selects carry the unit in the option text; the canvas shows a mono suffix.
  The section (i) sits at the far right, not beside the title [3, 1].
- Panel options: the switch has no visible state; `Reset section layout` and the
  separator are absent; Collapse all and Expand all are disabled on the Configure view
  [2, 1].
- Telemetry: RCS and Swerling carry trailing provenance squares; the header meta line is
  the UI face, not mono [3].
- Configure view of a sensor: `East (km)` and `North (km)` keep the unit in the label
  (P6), Heading is a slider with a value box, and the section names are muted labels,
  not 32 px collapsible rows; the canvas shows Lat, Lon, Elevation and Heading with mono
  suffixes; three muted sentences remain [1, 3, 2].
- Placement: five muted full sentences and the first-run line `No current placement
  result.` are set in gray, not behind a (i) or as an empty-state row [2].
- Outcome tiles use about 40 px digits and a 27 px clock, outside the 11/12/13/15 scale;
  seven muted sentences remain [3, 2].
- The Analyze transport reads `▷ Replay` as a text button; the canvas uses a 24 px icon
  button [3].
- The active inspector tab underline is accent; the canvas CSS sets it text 1 [4].
- The top-bar Run button shows no `⌘↵` key hint; the canvas Run button carries it [3].
- The board ground reads about `#212528`, not the sheet's `#121313` (board, outside the
  chrome lanes) [4].

## Tasking

No row is selected. One decision waits on the user before anything else: the entry
budget (raise to at least 368,200 or name a removal). The Quality workflow runs
`check:bundle`, so a push of `main` before that decision goes red. After the decision,
push `main` and run the one triage over the follow-ups above.

## Landmines

- `.wg-b[hidden] { display: none }` keeps a collapsed `DetailSection` body hidden; the
  `.wg-b` flex display would otherwise override the attribute.
- The right-panel wrap overrides (`index.css`, the `:is(… .rv)` block near 5154 and the
  `:is(.tb th, .tb td, .wg-t, .wg-m)` block near 5203) make every detail value and
  section title wrap. The collapsible telemetry sections are excluded through
  `.det-s[data-open]`, and `Rows` wraps the value text in `.rv-t` so a tag or drill-in
  stays visible. A new one-line pane needs the same exclusion.
- `Field` renders a `<label>` root while both `help` and `error` are undefined, and a
  framed `<div>` root once either is passed. Pass `error=''` while a value is valid, or
  the control remounts on every validity change and loses focus.
- The e2e reads `.insp-tab-group [role="tab"]`, `#board-phase-*`,
  `.board-app[data-board-phase]`, `.toolbar`, `.timeline` and `.canvas-host`. The
  current screen tab carries `insp-tab-analysis`; Back to overview focuses it.
- Collapse all and Expand all act on `#insp-tabpanel details` and `.det-s-toggle`; a
  third collapse pattern in the panel body needs `panelSections` in `App.tsx`.
- `shot.ts` calls `predictionSigmaAtS(est, est.state.tS + flightS)` with
  `flightS = max(0, intercept.tEffectS - (t + es.engageTimeS))`.
  `kinetic.verify.test.ts` still feeds hand-supplied miss sigmas.
  `kinetic.horizon.test.ts` is the regression that uses `predictionSigmaAtS`. Do not
  put `engageTimeS` back into that call.
- Do not change the estimate-path expects above. Do not restore 16, 0, and 0.005.
- A saved builtin that omits `flyoutSpeedMps` adopts the seed cruise speed. An
  interceptor with no positive cruise speed uses `kineticPk`, matching
  `flyoutProfile`. Coyote is 154 m/s and MEROPS is 78 m/s. Roadrunner and Anvil have
  no seed cruise speed, so they stay on the legacy curve.
- `seekerAcquisitionRangeM` gates feasibility only. Nothing reduces miss sigma for a
  seeker-equipped round.
- Physics tab: a checked box selects the prior planning fallback; a cleared box selects
  the physical model when its required fields are present.
- Do not restore `src/analysis/series.ts`, `withBands` or `TRACK_LADDER_STYLE`.
- `panels/analysis/RunControl.tsx` must not import `panels/TimelineBar.tsx`: that edge
  split the store into a `store-*.js` chunk on 2026-09-24 and the entry metric read
  242,488. `selectPlayLabel` lives in `state/selectors.ts` for that reason.
- The transport renders only outside Prepare (D9). `usePlaybackLoop` in `TimelineBar.tsx`
  is mounted by `App`, not by the transport, so the clock runs in every phase. Do not
  move the loop back into the transport.
- `#view-menu-layers` (View menu) and `#frame-add` (transport) are the rail's D4 targets;
  renaming either breaks the Layers or Frames route silently.
- `src/ui/kit.tsx` imports no store. A `useStore` import there makes rolldown split the
  store into a `store-*.js` chunk of about 124,000 gzip bytes that every lazy chunk
  imports, and the entry metric drops to 242,000 while the budget "passes". Pass store
  state into a kit primitive through a prop or a provider.
- No production `as unknown as` remains in model or state. Test fixtures still use
  that cast. `basisJson` (`src/model/basisJson.ts`) sorts object keys and preserves
  array order. `dropEditedProvenance`, `resetBuiltin`, and `sameAppliedOverrides`
  use it.
- A run's identity is its basis signature and the override list it applied. An override
  edit that changes a value in force reaches the store only through the
  `useOverrides.subscribe` line at the end of `src/state/store.ts`. A throw from that
  line is reported to the override boundary in `main.tsx`. The shell in
  `OverrideSubscriber.tsx` stays armed while its alert is showing, so a later throw
  does not leave `setState`. The overrides autosave subscription stays outside that
  boundary. A throw before the shell mounts still leaves `setState`.
- The Systems tab is the only view that shows an override; rings, WEZ, telemetry and the
  Prepare forecast read `trial.scenario` or the board scenario, which keep the library
  value.
- Chunk grids are packed row-major `Float64Array`s (`i * steps + k`). `finish`
  transfers those buffers. Do not structured-clone them onto the page to summarize.
  Progress `done` is the prefix, not every landed index. `discarded` is set only
  when finish commits a hole. The Run button stays Stopping while `pool.stopping`
  is set; `cancel` returns false for that wait.
- `mergePartials` with `release` empties each transferred part as it copies it. The
  summary worker clears the parts list before `finishSummary`. `mergePartials` with
  `prefix` sizes its grids to the contiguous prefix.
- `tQuantile` keeps a one-entry module cache in `src/analysis/stats.ts`.
- The retained track history is a column ledger. `bound.tracks[i]` returns a fresh,
  equal object on each read. `latestEstimatesAt` uses the ledger's indexed horizon
  read. `releaseRetainedTrial` empties only the copy from `boundRetainedTrial`.
- The Fragility Sobol warning is a planning factor from one board: 29 entities at
  2560 rows took 499 s, scaled by entity count and row count, and it fires at half
  of `DEFAULT_BUDGET.timeMs`. It is not a clock reading for the board on screen.
- Load refuses a flight path or boundary with fewer than two points. A placement run
  refuses a boundary with fewer than three. `boundsRefusal` refuses every boundary whose
  non-adjacent edges cross, touch or overlap. In-memory fixtures may still hold an empty
  `points` array (`scenarioHasWork` in `src/io/persist.test.ts`,
  `scenarioInstall.test.ts`). Those objects do not pass `parseScenarioData`.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate that
  touches the entry. The entry gzip budget is 368,000 bytes with 992 bytes of headroom
  (367,008 at the Row B gate). CSS is not in the entry metric; only JavaScript moves it. `sql.js` must stay behind `await import` with its wasm URL.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- `newId` embeds `Date.now()`. A test that asserts a seed-dependent Monte Carlo outcome
  must build its entities with fixed ids, or its random stream changes with the clock.
- Keep `.board-library-drawer` and `.undo-cue` siblings inside `.board-stage`; the cue
  reads `--library-w` there. The ROE `+N` count comes from one `ResizeObserver` on
  `.status-inline` in `StatusBar.tsx`.
- The top bar grid has equal side tracks, so the tabs hold the center from about
  1115 px; the narrowest supported window is 1024 px.
- A redo adds the scenario it makes current to `redone` (`src/state/scenarioInstall.ts`,
  a session-only `WeakSet`). The canvas context menu is its own chunk.
- Lane worktrees share one `git stash` list. A lane must not use `git stash` while a
  sibling worktree exists; two lanes that popped at once swapped their diffs in polish3.
  Measure a baseline with `git diff > file` or a separate worktree at the base. A
  worktree outside the repository directory with a `node_modules` symlink to the main
  checkout runs every gate command.
- Prettier wrapping of JSX text can change React `children`. Keep button labels on one
  line, or tests that compare `props.children` to a string will miss the control. See
  `src/ui/ErrorBoundary.tsx`.
- `library:check` and `schema:check` compare generated bytes. Do not hand-edit
  `*.generated.ts` or `src/io/runtimeSchema.ts`. `SavedView` is not in the runtime
  schema; a view record field needs no `schema:generate`.
- Oxlint `only-export-components` warnings already exist; do not add more. `npm run lint`
  does not fail on them.
- The pool's budget is the main thread's: `DEFAULT_BUDGET.retainedNumbers` bounds the
  merged rows the page holds, not a worker. Raising it or `MAX_REPLICATES` in
  `RunTab.tsx` brings the tab crash back on large raids. The check is not a hard cap:
  in-flight chunks can still land.
- A throw inside the react-konva tree never reaches `src/ui/ErrorBoundary.tsx`; only
  `SceneErrorBoundary` sees it. Every layer belongs inside that boundary.
- `sobol-done` carries `result: null` on a cancel. Readers must handle the null.
- Every edit to a registered reference needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails.
  `PROJECT_GUIDE.md` and `ENGINEERING_REFERENCE.md` fingerprint all of `src/`, so every
  source commit invalidates them; `VERIFICATION.md` fingerprints `src/io/` and `scripts/`.
  `docs:review` stamps `reviewedAt` with the UTC date.
- The weasel-word regex lives in `scripts/silent/rules/weasel-word.yml`, its `-tsx`
  twin, and `WEASEL_WORD` in `scripts/check-silent.mjs`. Change all three together.
- Every silent rule has a `-tsx` twin. The pair must stay identical except `id` and
  `language`.
- `storageManagement.ts` derives live keys from every non-prefix export of
  `storageKeys.ts`. Un-exporting `ANALYSIS_KEY` changes that readout.
- `selectObservedThroughWholeS`, `bandNote`, `bandStep`, and `TrialOutcomeSummary`
  have no importer. Un-exporting one of them fails `noUnusedLocals`. Do not delete
  them and do not add a suppression to keep them private.

## Evidence

- [finishSummary time at the retained cap, 2026-09-23](field-te/evidence/finish-summary-cap-2026-09-23/README.md)
- [Flight-horizon measurement, 2026-09-21](field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md)
- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
