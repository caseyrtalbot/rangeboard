# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [README.md](README.md) and the
commit log. This file holds only the position, the tasking ahead and the landmines. A
fresh agent starts from this file and the docs index. This file does not authorize a
commit, push or merge.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch. The
  run-crash investigation of 2026-09-21 is committed on top of `97ce4cf` and pushed.
- That commit fixes the reported run crashes and sweeps source comments. Root cause of
  the tab crash: the pooled Monte Carlo run kept every replicate row on the main thread
  (`src/playback/workerPool.ts`) with no budget, so a large raid at `stopCap` 2000 grew
  the page heap until the renderer died with no error. The pool now applies
  `DEFAULT_BUDGET` (refusal at start, rule 'budget' at the merged retained count or wall
  time) and finishes on the contiguous prefix when a cancelled worker stays silent past
  `CANCEL_GRACE_MS`. Also fixed: sweep cancel inside a cell, Sobol cancel as a null
  result, a silent react-konva render failure (`src/canvas/SceneErrorBoundary.tsx`
  plus a notice with Retry in `CanvasStage.tsx`), a zero-point path refused at load,
  Try again on the board boundary, per-adapter save errors and a retried baseline pin.
- Comment sweep: about 930 comment lines removed from `src` (plan and phase history,
  restating banners, repeated cross-references). Behaviour, exports and string literals
  unchanged except `fieldGroup` (deleted, unused) and one local rename in
  `src/playback/intercept.ts`.
- Gate on that tree: `npm run check` passed (200 test files, 2,153 tests), `npm run
  check:bundle` passed (entry 362,194 bytes gzip against 364,000), the 11 Board shell
  browser checks passed, and headless Monte Carlo, trial Play and sensitivity runs on the
  firing fixture completed clean. Evidence scripts stayed in the session scratchpad.
- Open defect, unchanged: `src/playback/shot.ts` charges the assignment-to-release delay
  as an open-loop coast of the fire-control track, so the physical kinetic model kills
  nothing on the firing laydown. See
  [the zero-kill kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md).
  Until it lands, `legacyKineticPk` is the defensible model choice.

## Tasking

Each item is one session task with its own gate. Task 2 is the next task retained from
the prior handoff; Tasks 2, 3 and 4 remain unstarted. Do not enable further tsconfig flags
or start an adjacent refactor as part of any task.

### Task 2: Land the kinetic miss horizon and recapture the estimate-path anchors

- Outcome: `src/playback/shot.ts:319` uses the flight as the miss horizon, with a
  regression test sized like `src/playback/kinetic.verify.test.ts`, and
  `src/playback/estimate.parity.test.ts` recaptured. The candidate change, its measured
  effect and the five moved pins are in
  [the zero-kill kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md).
- Do the `flyoutSpeedMps` adoption gap first or decide against it explicitly. The layered
  golden fixture saves no `flyoutSpeedMps` and `ADOPTED_SEED_KEYS.effector`
  (`src/model/libraryLifecycle.ts`) does not adopt it, so its interceptors fly with a
  zero flight time while the physical Pk model still applies. Recapturing that fixture's
  kills mean as 4.68 without fixing this pins a teleporting interceptor.
- The recapture needs the user's authorization for each replacement value. Write the
  before and after into the record beside the Phase 3 comparison, as
  [the Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
  did.

### Task 3: Later TypeScript and product follow-ups, select one per session

- `src/analysis` and `src/playback` review of `JSON.stringify` keys and `as unknown as`
  (parity required; capture before and after if a golden could move).
- `// @ts-check` and JSDoc on `scripts/*.mjs` and `src/io/generateRuntimeSchema.mjs`.
- Entry chunk lazy split: back under 340 kB gzip with the budget lowered again. Measure
  with `npm run build && npm run check:bundle`.
- `RunRecord` gains `sobol: SobolResult | null` so the SQLite `sobol` table fills
  (`src/model/runRecord.ts`, `src/io/exportSqlite.ts`).
- Split `src/model/integrationData.ts`, `src/state/store.ts` or
  `src/panels/Inspector.tsx` only with an explicit user ask.
- `noUncheckedIndexedAccess` as its own gated slice.

### Task 4: Run-path follow-ups from the 2026-09-21 investigation, select one per session

Each item was traced with file and line during the investigation; none is fixed.

- Trial result retention. `src/playback/trial.ts` collects every scan and every per-step
  track estimate, and `src/state/analysisRequests.ts` retains it all. Measured retained
  `TrialResult` JSON: 2.2 MB for one threat, 26 MB for 8 threats x 6 ships, 121 MB for
  30 x 10 with page heap at 692 MB. React keeps the previous result on the alternate
  fiber after New run, so a landing result doubles the footprint. Bound what the UI
  reads; parity applies to exported ledgers.
- `finishSummary` runs on the main thread in the pool (`workerPool.ts` `finish`). About
  12 s at the budget cap on a 108-track raid. Options: finish in a worker without
  cloning the rows, or a sorted-input path for `meanInterval` as done for `quantile`.
- Pool progress counts landed chunks with holes, so the Run line can exceed the summary
  after a stop (`workerPool.ts` `report` versus `contiguousPrefix`). Cosmetic.
- Stop is ignored while a half-width stop is in flight (`workerPool.ts` `cancel` returns
  false when `ending` is set). The button still reads Stop.
- Sobol full depth is a fixed 2560 rows with no cost estimate before it starts; a
  29-entity fixture took 499 s of the 600 s worker budget.
- `blockAutosave` after an unreadable live save whose rescue copy cannot be written
  pauses autosave for the whole session with no resume path (`src/io/autosave.ts`,
  `persist.ts`). Every later edit is lost. `reportPaused` also overwrites another
  adapter's error, and the overrides adapter has no write retry.
- `saveRun` writes NaN scalars as null and `getRun` rejects them (`src/io/runStore.ts`),
  so one such record fails the whole SQLite export. Trigger from a clean run is
  unconfirmed.
- One reload of a bad autosave leaves two recovery keys (observed, `persist.ts`).
- `Boundary` has no minimum point count in `src/io/runtimeValidation.ts`; paths now do.
- A throw inside a zustand subscriber (`Toolbar.tsx`, `App.tsx` selectors) escapes
  `setState` past every boundary.
- Unused exports: `selectObservedThroughWholeS` (selectors.ts), `withObservedLens` and
  `pruneSelection` exports (scenarioInstall.ts), `rangeBounds`, `acceptMorrisMessage`,
  `acceptSobolMessage` (analysisRequests.ts), `chartPng`, `downloadPng` (exportPng.ts),
  `bandNote`, `bandStep` (panels/analysis/mc.ts), `TrialOutcomeSummary`,
  `SavedRunCompare`, `ANALYSIS_KEY` (storageKeys.ts, tests only). `spreadFor` and
  `spreadBasisFor` take a `priors` argument no app caller supplies, so the class-prior
  branch is reachable only through the engine barrel.

## Landmines

- Model/state review found three property-order-sensitive JSON comparisons, reproduced
  against the current source: `dropEditedProvenance` in `src/model/types.ts:596` drops
  a classification provenance row when only object key order changes;
  `resetBuiltin` in `src/model/libraryLifecycle.ts:244` replaces an equal reordered
  builtin instead of returning the original array; `sameAppliedOverrides` in
  `src/model/applyOverrides.ts:85` treats reordered object values as different and can
  invalidate runs. Numeric/tuple overrides from the current Systems editor do not
  exercise the last case, but restored overrides accept object values. These remain
  findings, not fixes. `src/state/analysisBasis.ts:22` already sorts object keys and
  preserves array order. No production `as unknown as` remains in model/state.
- A run's identity is its basis signature and the override list it applied. An override
  edit that changes a value in force reaches the store only through the
  `useOverrides.subscribe` line at the end of `src/state/store.ts`.
- The Systems tab is the only view that shows an override; rings, WEZ, telemetry and the
  Prepare forecast read `trial.scenario` or the board scenario, which keep the library
  value.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate that
  touches the entry. `sql.js` must stay behind `await import` with its wasm URL.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- Prettier wrapping of JSX text can change React `children`. Keep button labels on one
  line, or tests that compare `props.children` to a string will miss the control. See
  `src/ui/ErrorBoundary.tsx`.
- `library:check` and `schema:check` compare generated bytes. Do not hand-edit
  `*.generated.ts` or `src/io/runtimeSchema.ts`.
- Oxlint `only-export-components` warnings already exist; do not add more. `npm run lint`
  does not fail on them.
- Physics tab: a checked box selects the prior planning fallback; a cleared box selects
  the physical model.
- The pool's budget is the main thread's: `DEFAULT_BUDGET.retainedNumbers` bounds the
  merged rows the page holds, not a worker. Raising it or `MAX_REPLICATES` in
  `RunTab.tsx` brings the tab crash back on large raids.
- A throw inside the react-konva tree never reaches `src/ui/ErrorBoundary.tsx`; only
  `SceneErrorBoundary` sees it. Every layer belongs inside that boundary.
- `sobol-done` carries `result: null` on a cancel. Readers must handle the null.
- `npm run check` fingerprints `src`, so any source edit needs `npm run docs:review` on
  the guides before `docs:check` passes.
- Zero kills from the default physical kinetic model are a defect, not physics.
  `src/playback/shot.ts:319` propagates the track over `engageTimeS` before the Rayleigh
  miss. `kinetic.verify.test.ts` passing at hand-supplied miss sigmas is not evidence the
  integrated interceptor model works. The two golden fixtures pin `truthTracks` and
  `legacyKineticPk`; `estimate.parity.test.ts` is the only suite a physical-Pk change
  moves.
- The layered golden fixture saves no `flyoutSpeedMps` and adoption does not fill it, so
  interceptors arrive at release while `kineticEffectProbability` still takes the
  physical branch.
- `seekerAcquisitionRangeM` gates feasibility only. Nothing reduces miss sigma for a
  seeker-equipped round.
- Every edit to a registered reference needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails. Guides
  fingerprint `src/`, so a source commit after a docs review invalidates it.

## Evidence

- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
- [Phase 3 review fixes CR-01 to CR-04, 2026-09-14](field-te/evidence/cr-fixes-2026-09-14/README.md)
- [Phase 3 gate](field-te/evidence/p3-gate-2026-09-10/README.md)
- [Estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
