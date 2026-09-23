# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [README.md](README.md) and the
commit log. This file holds only the position, the current task and the landmines. A
fresh agent starts from this file and the docs index. This file does not authorize a
commit, push or merge.

[Plan.md](Plan.md), the design and UX polish plan, is complete. No row of it is
selected. The polish follow-up run that came after it is also complete.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch.
  `origin/main` is at `293f7bd`. Local `main` holds the plan commit `0386b3a`, Rows A, B
  and C with their integration commits (B-int `2028d35`, C-int `d806e33`), and the polish
  follow-up run: the lane merges of `polish2/cue`, `polish2/canvas`, `polish2/panels` and
  `polish2/logic` and the integration commit that holds this handoff. None of them is
  pushed. The audit fixes `181c8ec` to `7da197d` and the documentation update after them
  follow row J (`afaf1ae`) and row O (`de208aa`).
- The authorized estimate-path recapture is `225e027`. Its expects: layered events 11,
  layered kill mass 1, layered kills mean 1.115, JIATF leakers mean 0.895, JIATF kills
  mean 0.105. `4.68` is not a pin.
- The flight horizon is `7fdcb1e`.
- Entry gzip at the polish follow-up gate: 366,212 bytes against 367,000, 788 bytes of
  headroom. The user raised the budget from 366,000 for this run. Initial JavaScript and
  CSS: 382,637 bytes against 400,000.

## Tasking

No task is open. Do not add a row to [Plan.md](Plan.md). The next task comes from the
user.

All 36 plan findings are closed or changed by a decision. The polish follow-up run closed
the four that stayed open after Row C, and most of the follow-ups outside the plan:

- U3: the undo cue is a `.surface-float` at the canvas bottom left, above the timeline
  (`src/panels/UndoCue.tsx`, mounted in `App.tsx` inside `.board-stage`). It takes no
  pointer events and the name truncates inside a 360 px cue. On mount the lazy cue reads
  `actionBeforeMount` (`src/state/lastAction.ts`), so an edit made before its chunk loads
  still shows. The scrub keeps its 120 px floor.
- C1: `BoardInk` (`src/ui/ink.ts`) gains `selection`, `board`, `tool` and `control`. The
  path draft, calibrate marks, connect ring, range button, marquee and a selected link read
  them. In dark, the path draft and a selected link are now text 1, not `#ffffff`.
- C4: `LABEL_ANCHOR_TOP` (`src/canvas/labelLayout.ts`) is 32, so the 28 px ring and its
  halo clear the anchored label. The range button sits below the label.
- U4: `src/canvas/hoverCursor.ts` releases the pointer cursor when the hovered entity
  unmounts.
- Capture defects: the ROE label stays on one line; the Compare `BandChart` y-axis, the
  telemetry charts and the track ladder no longer clip; the Analyze Run control stays
  right-aligned with the progress line on its own row. The Now kill-chain State column is
  30 % wide, so "identified" fits at the 320 px panel; the Track and Held names clip
  harder, with the full text in the cell title.
- Right-panel segments no longer wrap by default. The ring override is
  `.insp-rings .seg button { padding: 4px 8px }`.
- A range with collinear or near-collinear points is refused at launch in
  `optimizeLaunch` (`src/state/analysisRequests.ts`) with the reason from `boundsRefusal`
  (`src/playback/optimize/polygon.ts`): under 1 m² or under 4e-3 of its bounding box.
  `boundingBoxOf` throws the same reason in the worker as a backstop.
- CI: a push whose `before` is the zero sha checks against `origin/main` on a branch,
  `HEAD~1` on `main`, and falls back to `check:silent:all` on a root commit.
- `setBoardPhase` returns the tool to Select outside Prepare. `BoardTools` has no effect.

### Candidates

These follow-ups stay candidates. None is selected.

- A delete made while the Library drawer is open shows no visible cue: the drawer (z 40)
  covers it (z 5). A redo made before the cue chunk loads reads as "Placed" or "Deleted".
- Dark-only inks remain: the heading-handle knob stroke `#121415` (`EntityLayer.tsx`) and
  the dim link ink `#6a7178` (`ConnectionLayer.tsx`).
- The heading handle at reach 34 can overlap the moved label when it points down. The
  flight path line runs through the UAS label (this predates the run).
- The Placement screen Bounds select still lists a degenerate range; a run from it reports
  the refusal reason. A self-intersecting bow-tie with equal lobes is refused with the
  collinear wording.
- The Inspector ring buttons render in mono, inherited from `.insp-row-value`.
- V12 (D7): at 1600 px with five chips, the tabs sit 135 px left of center.
- `src/playback/policy.test.ts` "the Monte Carlo policy gives discrete outcomes" failed
  once under load from parallel lanes and passed on rerun.
- The merge could size its grids to the contiguous prefix.
- The fidelity gun-burst tag cannot see `context.uas`.
- No `finishSummary` cap timing exists after the t-quantile cache.

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
  summary worker clears the parts list before `finishSummary`.
- `tQuantile` keeps a one-entry module cache in `src/analysis/stats.ts`.
- The retained track history is a column ledger. `bound.tracks[i]` returns a fresh,
  equal object on each read. `latestEstimatesAt` uses the ledger's indexed horizon
  read. `releaseRetainedTrial` empties only the copy from `boundRetainedTrial`.
- The Fragility Sobol warning is a planning factor from one board: 29 entities at
  2560 rows took 499 s, scaled by entity count and row count, and it fires at half
  of `DEFAULT_BUDGET.timeMs`. It is not a clock reading for the board on screen.
- Load refuses a flight path or boundary with fewer than two points. A placement run
  refuses a boundary with fewer than three. In-memory fixtures may still hold an empty
  `points` array (`scenarioHasWork` in `src/io/persist.test.ts`,
  `scenarioInstall.test.ts`). Those objects do not pass `parseScenarioData`.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate that
  touches the entry. The entry gzip budget is 367,000 bytes with 788 bytes headroom
  (last measured 366,212 at the polish follow-up gate). Icons and new components add entry bytes. `sql.js` must stay behind `await import` with its wasm URL.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- Prettier wrapping of JSX text can change React `children`. Keep button labels on one
  line, or tests that compare `props.children` to a string will miss the control. See
  `src/ui/ErrorBoundary.tsx`.
- `library:check` and `schema:check` compare generated bytes. Do not hand-edit
  `*.generated.ts` or `src/io/runtimeSchema.ts`.
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
  Guides fingerprint `src/`, so a source commit after a docs review invalidates it.
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

- [Flight-horizon measurement, 2026-09-21](field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md)
- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
