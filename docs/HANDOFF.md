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
pass, 2026-09-24). Row A is merged. Row B is selected. The design and UX polish plan the
queue replaces is complete in history at `76074bb`.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch.
  `origin/main` holds the polish4 run through `76074bb`. Local `main` holds the plan
  commit `65c0005` and Row A (`fc47469`), not pushed. No worktree and no lane branch
  exist.
- Row A (2026-09-24) landed: `--accent #7ba7e8` with `--accent-ink`, `--status-limit`,
  `--text-tertiary #8c8e88` (5.27:1 on panel), `--h-dense` 24, `--h-default` 28,
  `--h-primary` 32, `--type-lead-size` 15; paper `--paper-accent #2862b0` and
  `--paper-limit #a85a1c`. `.primary` is 32 px accent fill with accent ink; `.mini` is
  24 px. `Field` has `help` (a 24 px (i) button plus a `.field-help` line under
  `FieldHelpProvider`), `error` (a `.field-error` line, `aria-invalid`) and `unit` (the
  plan's "suffix"). `src/ui/icons.tsx` has 22 icons. `ui.showFieldHelp` with
  `setShowFieldHelp` is in the saved view record. Gate: 2,241 tests, lint, format,
  bundle, docs and silent checks pass; browser check at 1440 × 900 in both themes
  shows the 32 px accent primary, 28 px default and 24 px segment heights with 0 page
  errors.
- Entry gzip at the Row A gate: 365,970 bytes against 367,000, 1,030 bytes of headroom.
  Initial JavaScript and CSS: 382,635 against 400,000.
- The authorized estimate-path recapture is `225e027`. Its expects: layered events 11,
  layered kill mass 1, layered kills mean 1.115, JIATF leakers mean 0.895, JIATF kills
  mean 0.105. `4.68` is not a pin.
- The flight horizon is `7fdcb1e`.

## Tasking

Row B of [Plan.md](Plan.md) is selected: the chrome bands. Four lanes in one message,
each in its own worktree on a branch from local `main` at `fc47469`, budget 1,800 seconds
each, then B-int on `chrome/int`. Workers: B1 `opus-medium`, B2 `opus-medium`, B3
`opus-high`, B4 `opus-medium`. `opus-high` reviews the B-int diff against Rows A and B.
Decisions D3, D4, D5, D7, D8 and D9 apply at their defaults unless the user says otherwise
before the lanes start. Merge `chrome/int` to `main` only with the user's authorization.

The plan's line numbers are positions at `76074bb`. Row A moved `src/index.css` down by
about 43 lines before the field block and about 31 after it. Current anchors at
`fc47469`:

| Lane | File | Anchor |
| --- | --- | --- |
| B1 | `src/panels/Toolbar.tsx` | `Toolbar` at 269; `board-run-context` at 383; `status-pills` and `RoeMenu` at 387-394 |
| B1 | `src/index.css` | `.toolbar` 414 to `.toolbar-left > .scenario-name` 475; `.tb-menu-wrap` 784 to `.tb-menu-row` 884; `.board-run-context` 4339 |
| B1 | `RunControl` body mounts | `AnalysisNavigation.tsx:30`, `ForecastSettings.tsx:97` |
| B2 | `src/panels/Toolbar.tsx` | `BoardTools` at 435 to the end (509) |
| B2 | `src/index.css` | `.board-tools` 4595 to `.board-tools > .seg button` 4686; `.toolbar > .seg button.tb-glyph` 771 |
| B3 | `src/App.tsx` | `ResourceRail` 119-156; its props at 766-771 |
| B3 | `src/index.css` | `.board-resource-rail` 4483-4517; `.palette` 1081 to `.palette-item` 1170-1200 |
| B4 | `src/App.tsx` | `EngagementStrip` and `TimelineBar` mounts at 834-835; `Toolbar` props at 752-759 |
| B4 | `src/index.css` | `.timeline` 2540 to `.timeline select` 2571; `.status-pills` 1213 |

Facts the lanes need from Row A:

- Icons in `src/ui/icons.tsx`: `IconLibrary`, `IconObjects`, `IconCommands`, `IconUndo`,
  `IconRedo`, `IconClose`, `IconCaret`, `IconSettings`, `IconMore`, `IconDrawer`,
  `IconEntities`, `IconLayers`, `IconFrames`, `IconPlay`, `IconPause`, `IconReset`,
  `IconInfo`, `IconChevronDown`, `IconChevronRight`, `IconPlus`, `IconSearch`,
  `IconPencil`. Only `App.tsx` and `Toolbar.tsx` import the set today, so an icon costs
  entry bytes the first time a lane imports it (D3). `IconObjects` stays until B3 moves
  the rail to `IconEntities`; the integrator removes it if nothing imports it.
- `--accent` is now blue, and 31 rules read it: the brand word, the scenario name focus
  rule, `button.primary` and its hover and active, the `.rr-bar-fill`, and the selected
  and pressed marks listed by `grep -n 'var(--accent)' src/index.css`. A lane
  that owns one of those blocks decides whether its rule keeps the accent or moves to
  text 1; it reports the choice.
- `.mini` is 24 px through `min-height: var(--h-dense)` and `padding: 3px 7px`. The base
  `button` rule keeps 28 px through `line-height: calc(var(--h-default) - 12px)`; rules
  that set their own padding (`.seg button`, `.tabs button`, `.frame-chip button`) are
  unchanged and are each lane's to resize.
- `Field` with `help` or `error` renders a `div.field` and needs one React element as its
  child, which takes the label's `id`. The `.field-help` and `.field-error` lines are
  direct children of `.field`. `FieldHelpProvider` is not mounted yet; C1 mounts it from
  `ui.showFieldHelp`.

After B-int passes its gate and the review, rewrite this section for Row C: four lanes
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
  touches the entry. The entry gzip budget is 367,000 bytes with 1,030 bytes headroom
  (last measured 365,970 at the Row A gate). Icons and new components add entry bytes;
  the Row B removals (Declutter control, library footer, frame-name input, the second
  `RunControl`) must pay for them (D3). `sql.js` must stay behind `await import` with
  its wasm URL.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- `newId` embeds `Date.now()`. A test that asserts a seed-dependent Monte Carlo outcome
  must build its entities with fixed ids, or its random stream changes with the clock.
- Keep `.board-library-drawer` and `.undo-cue` siblings inside `.board-stage`; the cue
  reads `--library-w` there. The ROE `+N` count comes from one `ResizeObserver` on
  `.status-inline` in `Toolbar.tsx`; B4 moves it with the chips.
- The top bar grid has equal side tracks, so the tabs hold the center from about
  1115 px; the narrowest supported window is 1024 px. B1 keeps both.
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
