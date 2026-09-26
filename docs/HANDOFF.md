# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [README.md](README.md) and the
commit log. This file holds only the position, the current task and the landmines. A
fresh agent starts from this file and the docs index. This file does not authorize a
commit, push or merge.

[timeline/SPEC.md](timeline/SPEC.md) is the run timeline spec and plan (2026-09-26):
four phases that replace the threat-only engagement strip with a multi-row run timeline.
Phase 1 is selected. [Plan.md](Plan.md) is the completed chrome refactor queue (Rows A
to D merged and pushed as `f4363a3`); it selects nothing.

## Position

- Repository `~/Projects/rangeboard`. Local `main` equals `origin/main` at `f4363a3`
  (the Row D merge and the engine follow-up candidates), no worktrees, no lane branches.
- Uncommitted on `main` (2026-09-26, this session): `CONTEXT.md` (the run timeline
  glossary), `docs/timeline/SPEC.md` (the spec and plan), the `docs/README.md` rows and
  `docs/maintenance.json` entries for both, and this file. `npm run docs:check` passes.
  Commit them as one docs commit before the Phase 1 branch, with the user's authorization.
- Run timeline design (2026-09-26): the grilling settled the tree recorded in
  `timeline/SPEC.md` section 1; the mockup is
  <https://claude.ai/artifact/PYWeMH5tEhE9fNS9uhrBEt> (synthetic trial, both themes,
  Playwright-checked, 0 page errors). Facts the plan relies on: the Execute trial is one
  precomputed draw and playback moves a cursor; `retainTrial.ts` drops per-step
  `fusedTracks` from each assessment; `trialSeries.ts` already derives hold, coast,
  window, preparation, flight, dwell and beam spans; no activation or per-decision
  operator record exists.
- Entry budget rework (`8ac3bf6`, 2026-09-25): the entry ceiling in `check-bundle.mjs` is
  380,000. The chunk boundary is `scripts/check-entry-graph.mjs` with its freeze
  `scripts/entry-graph.json`, run by `npm run check`; `check:bundle` also freezes the
  preloaded JavaScript to the rolldown and JSX runtime chunks.
- Row D (2026-09-25) ran as four lanes in `~/Projects/rangeboard-wt/d1..d4` on
  `chrome/d1..d4` from `8ac3bf6`: D1 `b14f642` (`opus-high`), D2 `069f87a` (`opus-high`),
  D3 `809f802` (`opus-high`), D4 `695d20d` (`opus-medium`). `chrome/int` (checked out in
  the main checkout) holds the Row D plan commit `d7231ea` and the four lane merges to
  `e9e6a18`. `chrome/d-int` (worktree `~/Projects/rangeboard-wt/int`) continues from there:
  the integrator folds `87ce397`, the two placeholder folds `954e517` and `a23865b`, the
  design system `efaf7e0`, the docs reviews `531ef2c`, and the `opus-high` review fixes
  `fbe6ac5` (one must-fix: the drawer resizer wrote the list width from the editor view;
  four should-fix: two status sentences moved from an error line and an (i) to empty-state
  rows, the Run key hint hidden from the accessible name, and handler tests for Palette,
  ContextMenu and LibraryEditor). The main checkout carries an uncommitted engine-profile
  section in this file and a `maintenance.json` change from another session; neither is
  in `chrome/d-int`. Merge `chrome/d-int` to `main` only with the user's authorization, and
  let that session commit its section first or resolve this file by hand.
- Row D gate on `chrome/d-int` (2026-09-25): `npm run check` passes (211 files, 2,287 tests,
  docs and evidence gates green, entry graph 107 of 208, build
  green), `test:e2e` 13 of 13 on a dev server at 5395, `check:bundle` entry 368,760 against
  380,000 and initial 386,297 against 400,000. The lanes cost 587 entry bytes over the
  Row C 368,173.
- What Row D built. D1: a store action `openLibrary(kind?, modelId?)` that bumps
  `ui.libraryRequest.seq`; App subscribes and opens the drawer; Palette expands and focuses
  the kind's group, or shows `LibraryEditor` in the drawer in place of the list at no less
  than 408 px with a `Back to library` control; the five `setRightTab('library')` callers
  (Palette New model and Model basis, CommandPalette model commands, ContextMenu Edit model
  specs, LibraryEditor) use it; the right-panel editor mount and the contextual `Model
  library` tab are gone; `Place asset` calls `openLibrary('asset')`. D2: Run Monte Carlo is
  a default 28 px button; `Run sensitivity` with the method in the (i); the Validity header
  carries the finding count as a tag; finding rows are glyph, headline and chevron with the
  severity word as the glyph title; the sweep help reads the replicates per cell and the
  value rule; the SweepMap caption sentence became a chip with `Place asset`. D3:
  `Deterministic (no sampling)` (D10); the forecast line in mono text 1 without `· total`;
  the `None` placeholder; the Run monitor card (`.live-card`: clock, progress bar,
  Replicate, Seed, Speed rows); Placement, Outcome, Debrief and Compare sentences moved to
  placeholders, error lines, (i) titles and `EmptyRow`s; tile values at 15 px; Replay and
  Retry icon-only; the Run button `⌘↵` hint with a Meta+Enter (Ctrl+Enter) listener in
  `RunControl`. D4: the sensor, effector and C2 panes take the C3 pattern (Model basis row,
  no trial line, collapsible sections with mono summaries); the RCS and Swerling provenance
  squares are gone; the active tab underline is text 1; the `.lens*` rules are deleted;
  `.frag-info` and `.frag-help` folded into `.field-info` and `.field-help`.
- Plan text the build departed from, each with its reason: the Back control is the
  mirrored chevron icon with the word Library, not the `‹` glyph (a chrome control uses the
  icon set); `RightTab` keeps 'library' because `viewState.ts`, `store.test.ts` and the e2e
  still name it (a follow-up); the Replicate row shows the trial's replicate index, not
  `12 / 80` (the Execute trial is one draw; pool progress is in the status bar); the 15 px
  tile value applies to every `.tv`, Fragility and RunHistory included; the board ground
  was not changed: there is no Konva ground fill, `.canvas-host` sets `--surface-board`
  (`#121313`) with a 3.5 percent grain, and the capture's `#212528` matches the grid inks
  in `src/ui/ink.ts`, so the sample hit a grid line; the sweep-map chip is a second chip
  keyed to the sweep response, separate from the sensitivity chip.
- The authorized estimate-path recapture is `225e027`. Its expects: layered events 11,
  layered kill mass 1, layered kills mean 1.115, JIATF leakers mean 0.895, JIATF kills
  mean 0.105. `4.68` is not a pin.
- The flight horizon is `7fdcb1e`.

## Follow-ups (not fixed)

Handling: candidates, not rows. Row D took the Row C review items and the class 2, 3 and 4
canvas deviations. What remains:

From the Row D review:

- Muted full sentences remain on changed screens: `FragilityScreen.tsx` about 592, 597,
  733, 736, 773; `LiveStrip.tsx:69` (the no-trial placeholder, kept because `PlayPrompt`
  was out of scope); the detail panes' `No …` empty lines (SensorDetail 95, 213, 232, 254,
  276; EffectorDetail 139, 239; SystemDetail 134, 147, 160; ThreatDetail 287, 302);
  `SystemStatus` lines inside the Outcome and Debrief disclosures.
- The Validity header dropped the VALID or PENDING verdict word when there are no
  findings; decide whether the verdict needs a home on the Fragility screen.
- The objective direction (`Maximize leakers.`) lives only in the Placement response (i).
- `RunControl.tsx` duplicates App's `isTypingTarget`; `PlacementScreen` no longer
  duplicates `EmptyRow`.
- `.chip.mc` (`index.css` about 3378) is dead; `.chip.det` has one user (`SystemsTab`).
  `.empty-row` and `.line-error` sit after the run-strip block; move them beside the Field
  rules at the next CSS pass. The four drawer rules D1 added copy the `.right-panel` rules
  near 5205; fold with `:is(.right-panel, .board-library-drawer)`.
- `RightTab` still includes 'library'; `viewState.ts` `RIGHT_TABS`, `store.test.ts:1049`
  and e2e line 82 name it. Narrow the type and drop App's saved-view mapping together.
- `DetailHeader.tsx:53` aria-label `Back to the lens stack` names the removed lens UI.
- `TrialOutcomeSummary` (`DebriefRecord.tsx`) has no production caller; `.outcome-metric
  strong` still uses the 24 px value size.
- The Palette editor view follows `selection.libraryId`: selecting a board entity returns
  the list without dismissing the request. Escape closes the whole drawer from the editor.
- Opening the editor still clears the entity selection, as the old callers did; the right
  panel falls back to the analysis screens while the model edits on the left.
- `DetailTable` cells in the collapsible sections (gates, doctrine, hops, timing) still
  wrap through the `:is(.tb th, .tb td, …)` block and carry no `title`.
- `npm run test:e2e` needs a running Vite server (`E2E_URL`, default 5377); record that in
  `VERIFICATION.md` or the lane template.

From the engine profile of 2026-09-25 (100 replicates of the 54-entity board on one
Node thread, 95 ms per replicate, flat profile; a Rust port was assessed and declined
because the gain would be about 2x to 4x on work that already runs off the page thread):

- `shnidmanPdFromSnr` (`src/playback/radarDwell.ts`) is the largest self time at 11
  percent, plus 4 percent in its forward call: a 24-step bisection per uncached SNR.
  A precomputed table over SNR per (pfa, pulses, swerling) or a closed-form inverse
  would remove the bisection. The cache and the fixed-ID parity expects bound the change.
- The sweep step (`stepSweep` in `src/playback/sweep.ts`; `sensorHit` and the sweep's
  `hits` in `src/playback/detection.ts`) and `dist` and `bearingDeg` in
  `src/geometry/geo.ts` together take about 30 percent;
  entity and member state as typed arrays inside one sweep would cut the object reads.
- Garbage collection is 5 percent: `trackSamples` and `fusedTracks` grow one object per
  step per threat in `assessThreat`, and `scenario.entities.find` runs inside the
  attrition loops. Preallocated per-step buffers and an id index would remove both.

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

From the `fable-medium` canvas comparison, class 1 (structure) items still open:

- Entity view keeps a second tab level (Telemetry · Configure · Model basis) under the
  one tab row, so P3 stays open there.
- Outcome: `Export debrief JSON` is a second accent-filled control and `New clean run` is
  a rival run verb beside the top-bar `Run again` (P1).
- Run monitor keeps body buttons `New run` and `Forecast and analysis` under Sensors (D7).
- Run monitor sections are `Kill chain`, `Effectors`, `Sensors` as 15 px headings; the
  canvas shows Engagements (open), Tracks and Run validity as 32 px collapsible rows with
  counts; no Run validity section exists in Execute.
- Inputs carries the `Entity register` list and a `Run validity` block with full finding
  paragraphs; the canvas shows findings as one collapsed row with a count and tag.
- Inputs repeats the scenario name and run id in its header (P2) with an INVALID tag;
  the canvas card reads `Scenario inputs` with a PENDING tag.
- Fragility has no `Monte Carlo` section header or (i); the 15 px `Fragility` heading
  repeats the tab label.
- Open findings show the `Gates:` line and a Select button; `Review finding scope` is one
  disclosure at the bottom, not a dense button per finding.
- Sweep factor selects carry the unit in the option text; the section (i) sits at the far
  right, not beside the title.
- Panel options: the switch has no visible state; `Reset section layout` and the
  separator are absent; Collapse all and Expand all are disabled on the Configure view.
- Configure view of a sensor: `East (km)` and `North (km)` keep the unit in the label
  (P6), Heading is a slider with a value box, and the section names are muted labels,
  not 32 px collapsible rows; the canvas shows Lat, Lon, Elevation and Heading with mono
  suffixes; three muted sentences remain.

## Tasking

**Phase 1 of [timeline/SPEC.md](timeline/SPEC.md): model, no UI change.**

- Base: `main` at `f4363a3` plus the docs commit above. Branch `timeline/p1` for the
  contract commit and the integration; lanes `timeline/p1-a`, `p1-b`, `p1-c` in
  worktrees `~/Projects/rangeboard-wt/tl-1a`, `tl-1b`, `tl-1c` outside the repository
  with `node_modules` symlinked to the main checkout.
- Outcome: the three modules of SPEC section 2.1 rows one to three, built to the
  contracts in sections 2.2 and 2.3, with unit tests, and the `fusedTrack` summary
  retained per assessment. No component, store or CSS change. Nothing imports the new
  modules yet, so the entry graph is unchanged.
- Order: the integrator makes the contract commit first (the `fusedTrack` field on
  `ThreatAssessment` in `src/playback/sim.ts`, the two empty modules exporting the types).
  Then the three lanes run in parallel with the file ownership in the SPEC Phase 1 table.
  Brief shape per `~/.claude/rules/delegation.md`: working directory, owned files, the
  gate command `npx vitest run --dir src <owned test>` then `npm run typecheck`, the report
  shape (diff summary, checks run with output, unresolved findings), a time budget.
- Exclusions: no edit to `EngagementStrip.tsx`, `App.tsx`, `TimelineBar.tsx`,
  `index.css`, the store, or any doc other than ENGINEERING_REFERENCE.
- Completion checks: `npm run check` green on `timeline/p1`; `npm run check:silent`
  green; `schema:check` green (run `schema:generate` if the assessment type change moves
  it); `opus-high` diff review with must-fix items closed; `fable-high` review of the
  censoring rules in `runTimeline.ts` against ENGINEERING_REFERENCE section 3 with no
  open finding; ENGINEERING_REFERENCE paragraph added and `docs:review` recorded;
  `docs:check` green.
- Next action: ask the user to authorize the docs commit, then make the contract commit.
- Stop condition: Phase 1 merged to `main` with the user's authorization, this file
  rewritten to select Phase 2 with the Phase 1 evidence (gate output, review findings)
  recorded here, worktrees removed.

## Landmines

- Run timeline (see [timeline/SPEC.md](timeline/SPEC.md) section 5): keep
  `ENGSTRIP_OPEN_KEY` exported with the value `rangeboard.engstrip.open`;
  `storageManagement.ts` derives live keys from the exports. Derive the `fusedTrack`
  summary in `boundAssessment` before the per-step drop and keep no reference to the
  list. The e2e playback-bar tests name the Engagement toggle; rename them with the
  toggle in Phase 2. Moving the strip to a lazy chunk changes the entry-graph freeze;
  rewrite it once with `--write` and name the reason in the commit.

- `openLibrary(kind?, modelId?)` in `store.ts` bumps `ui.libraryRequest.seq`; App's
  subscription opens the drawer on a seq change and Palette consumes the request in the
  render-phase adjust pattern. A kind request expands its group for the session only; an
  effect or updater must not write the collapse map to storage.
- The Palette editor view (`editModel` set) renders no resizer; its width is
  `max(saved, 408)`. The resizer and `aria-valuenow` read the list width only.
- `RunControl.tsx` owns the Meta+Enter (Ctrl+Enter) listener on `window`, ignored inside
  inputs, textareas, selects, contenteditable and while `#settings-panel[open]`. App's
  keydown returns early on Meta or Ctrl plus Enter so the boundary and path tools do not
  finish on the run shortcut. Do not add a second listener in App.
- `EmptyRow` and `NoteInfo` are exported from `panels/analysis/DebriefRecord.tsx` and used
  by Outcome, Compare and Placement. `.empty-row` and `.line-error` are the generic rules;
  a first-run instruction or a status sentence is an `EmptyRow`, an error line is for
  invalid input only, a method note goes behind the (i).
- Every `DetailSection` in the sensor, effector, C2 and threat panes is `collapsible`;
  the `.det-s[data-open]` exclusion from the right-panel wrap override covers them all.
- `.frag-info` and `.frag-help` no longer exist; use `.field-info` and `.field-help`.
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
  touches the entry. The entry gzip budget is 380,000 bytes with 11,827 bytes of headroom
  (368,173 at the Row C gate). CSS is not in the entry metric; only JavaScript moves it.
  `sql.js` must stay behind `await import` with its wasm URL.
- `npm run check:entry-graph` (inside `npm run check`) fails when a static value import
  brings a new npm package, or a module under `src/playback/`, `src/analysis/`,
  `src/engine/`, `src/charts/`, `src/panels/analysis/` or the generated data files, into
  the entry graph from `src/main.tsx`, and when a frozen module leaves it. Load such a
  module through `import()` or a worker, or rewrite the freeze with
  `node scripts/check-entry-graph.mjs --write` and name the reason in the commit. The walk
  reads source, so a module that TypeScript elides as type-only can sit in the freeze
  without being in the built chunk; that is expected. `check:bundle` fails on any
  preloaded JavaScript other than the rolldown and JSX runtime chunks.
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
