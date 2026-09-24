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
pass, 2026-09-24). Rows A and B are merged. Row C is selected. The design and UX polish
plan the queue replaces is complete in history at `76074bb`.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch.
  `origin/main` holds the polish4 run through `76074bb`. Local `main` holds the plan
  commit `65c0005`, Row A (`fc47469`) and the Row B handoff (`00b241b`), not pushed.
- Row B (2026-09-24) merged to local `main` from `chrome/int`: lanes `chrome/b1` to
  `chrome/b4`, four merges, the integrator folds, the docs and the `opus-high` review
  fixes. The lane worktrees and branches are deleted. Not pushed.
- Row B gate: `npm run check`, `check:bundle`, `check:silent` and `test:e2e` (13 of 13)
  pass; 2,254 tests. Entry gzip 367,008 against 368,000 (the user raised the budget from
  367,000 at this gate), initial 384,130 against 400,000. Headroom 992 bytes.
- Browser check at 1440 × 900 in both themes (Playwright on the dev server, the firing
  fixture): 36 px top bar, 32 px accent primary, 28 px icon buttons, 28 px tool row with
  24 px controls and 22 px segments, 44 px rail with 32 px buttons, 32 px library header,
  24 px filter, 36 px rows, 28 px transport with 24 px controls in Execute and none in
  Prepare, 24 px status bar, the frame popover at 36 px, 0 page errors. Execute reads
  Play before a run and Analyze reads Run again.
- What Row B built: `Toolbar` (36 px: brand, scenario name once with a pencil and `F2`,
  centred tabs with an accent underline, one `RunControl` with a `phase` prop, icon
  Settings, the ⋯ menu with Storage as its last item through `StorageMenuItem` and
  `StorageDialog`, icon drawer toggle); `BoardTools` (28 px, `.mini` controls, `Range`
  and `View` chevron triggers, `Preset` section at the top of the View menu wrapping
  `LayerSettings` in `#view-menu-layers`, no Declutter control); `ResourceRail` (44 px:
  Library, Entities, Layers, Frames, Commands; Layers clicks the View trigger and focuses
  inside `#view-menu-layers`; Frames focuses `#frame-add` and is disabled in Prepare);
  `Palette` (32 px header with `LibraryActions` ⋯ holding Import and Export, no footer,
  36 px two-line rows through `rowLines`, `aria-expanded` collapse toggles);
  `TimelineBar` (28 px, outside Prepare; exports `usePlaybackLoop`, which `App` mounts,
  and `FrameAddPanel`); new `StatusBar` (24 px: run id, phase, `T+`, seed, `MC n / N`,
  the ROE chip with the folded chips, units, `Validity n` with `LIMITS`; D8 drops at
  1440, 1280 and 1152 px); `selectPlayLabel` in `state/selectors.ts` (Pause, Retry,
  Replay, Resume when paused, else Play) feeds the transport and the Execute action.
- Plan text the build departed from, each with its reason: the units cell reads
  `nm · kt · ft AGL` (the app has no MSL datum); no `Reload built-in` item (no
  whole-library reload action exists; only `resetModelToSeed`); the drawing tools keep
  text labels with hint titles (no tool icons in Row A and no tool shortcuts exist);
  Reset run has no `(⇧R)` and Settings no key (no such shortcuts exist); the transport
  clock is gone (P2, the status bar carries it).
- The authorized estimate-path recapture is `225e027`. Its expects: layered events 11,
  layered kill mass 1, layered kills mean 1.115, JIATF leakers mean 0.895, JIATF kills
  mean 0.105. `4.68` is not a pin.
- The flight horizon is `7fdcb1e`.

## Follow-ups from the Row B review (not fixed, the user picks)

- `StatusBar` subscribes to the clock, so its `useLayoutEffect(measure)` runs a layout
  read about ten times a second during playback. Move the `T+` cell into a child that
  holds the clock subscription.
- The ⋯ trigger keeps `aria-controls="file-actions-panel"` while the Storage dialog is
  the open panel. `aria-controls={storage ? 'storage-panel' : 'file-actions-panel'}`
  costs about 10 entry bytes.
- The rail's Frames button is disabled in Prepare with the reason only in its title. A
  route that enters Execute and then focuses `#frame-add` would serve D4 better.
- No test covers the rail routes (`openLayers`, `openFrames`) or that Pause and Resume
  stay enabled in Execute under deterministic mode.
- Library rows still draw the friend-frame dome for sensor, effector, C2 and asset
  kinds; per-subtype shapes (radar, EO/IR, RF, kinetic, DE, integrated) need new
  `Glyph.tsx` shapes.
- `F2` focuses the scenario name only while focus is inside the header. The drawer
  toggle's icon no longer shows the open state; `aria-expanded` and the hover surface do.
- Some `+ Frame` and popover items have no static-render test; the browser check and
  the e2e cover them.

## Tasking

Row C of [Plan.md](Plan.md) is selected: the inspector and density lanes. Four lanes in
one message, each in its own worktree outside the repository (a `node_modules` symlink
to the main checkout runs every gate) on a branch from local `main`, budget 1,800
seconds each, then C-int on a fresh `chrome/int`, the final capture and the
`fable-medium` canvas comparison. Workers: C1 `opus-medium`, C2 `opus-high`, C3
`opus-medium`, C4 `opus-medium`; `opus-high` reviews the C-int diff against Rows A to C.
D6 applies at its default. Merge to `main` only with the user's authorization.

The plan's line numbers are positions at `76074bb`. Current anchors at the Row B merge:

| Lane | File | Anchor |
| --- | --- | --- |
| C1 | `src/App.tsx` | `TABS` 75-79; `PanelTabs` 182-188; the `aside.right-panel` 881-950 with `board-panel-heading` at 886; `setRightTab('inspect')` at 491 and 653 |
| C1 | `src/index.css` | `.right-panel` 1478 to `.inspector-body.insp > .insp-header` 1666 |
| C1 | screens | `AnalysisNavigation.tsx`, `screens/navigation.ts:9` (`Where to put it`), `PlacementScreen.tsx:148-149` |
| C2 | `src/index.css` | no `.frag` block exists; add one directly after `.inspector-actions button.mini` (1890) |
| C2 | `FragilityScreen.test.tsx` | string assertions at 209-210, 236-246, 474-479 |
| C3 | `src/index.css` | `.detail-ghost` 5085 (eight lines, then `.source-entry`); the `.det-*` detail blocks start at 2335 |
| C4 | `src/index.css` | `.field` 1798, `.field-row` 1843, `.field .field-label > .field-info` 1942, `.field > .field-help` 1959, `.field > .field-error` 1967, `.nu-unit` 1986 |

Facts the lanes need from Rows A and B:

- `FieldHelpProvider` (`src/ui/kit.tsx`) is not mounted; C1 mounts it around the right
  panel from `ui.showFieldHelp` with `setShowFieldHelp`. `Field` with `help` or `error`
  renders a `div.field` and needs one React element as its child, which takes the
  label's `id`; `unit` is the plan's "suffix".
- The entry budget has 992 bytes of headroom; every Row C addition beyond it must be
  paid for by a removal, or the user raises the budget again. Icons cost entry bytes the first time a file imports them.
- Shared selectors go in `src/state/selectors.ts`. An import of `panels/TimelineBar.tsx`
  from `panels/analysis/RunControl.tsx` split the store into its own chunk (see the
  landmine); a panel-to-panel import can do the same.
- The status bar carries the run state and `T+`; C3 removes the telemetry status
  sentence per the plan. The one `RunControl` is in the top bar; nothing in the body
  renders one.
- `ui.showFieldHelp` default false; the "Show field help" switch goes in the inspector ⋯
  menu that C1 builds in the 32 px `board-panel-heading`.

After C-int passes its gate and the review, run the final capture and the canvas
comparison, then rewrite this file: position, the follow-ups, no row selected.

r Row C: four lanes
(C1 inspector frame, C2 Fragility density, C3 telemetry, C4 inputs forms), then C-int,
the final capture and the `fable-medium` canvas comparison.

## Landmines

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
