# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the phase marks of [the plan](IMPLEMENTATION_PLAN.md), the dated
evidence indexed in [docs/README.md](README.md) and the commit log. This file holds only
the position, the tasking ahead and the landmines. A fresh agent starts from the plan,
this file and the docs index. This file does not authorize a commit, push or merge.

## Position

- Repository `~/Projects/rangeboard`, branch `p4f/apply-overrides`, checked out from
  `main` at `5b1eb27` (the Phase 4 handoff commit). The branch carries Task 1
  uncommitted: nothing on it is committed, pushed or merged.
- `main` and `origin/main` moved to `e35c0f1` (the shell-rework right drawer, merged
  and pushed by a separate session on 2026-09-15). That commit touches `src/App.tsx`,
  `src/index.css`, `src/io/storageKeys.ts`, the Toolbar files and
  `scripts/e2e/board-shell.e2e.mjs`; Task 1 touches none of them, so a rebase onto
  `main` is clean. Rebase before the commit.
- No lane worktrees or lane branches exist; the five `p4/*` branches were merged and
  deleted.
- Plan: Phases 0 to 4 complete, each marked in the plan with its merge commits. Phase 4
  is the last phase in the plan; there is no Phase 5 tasking.
- Task 1 (apply overrides to the run) is done on this branch: `applyOverrides`
  (`src/model/applyOverrides.ts`) writes an override over a copy of the model's spec
  for one run; `runTrial` applies the manifest's list, the replicate, sensitivity,
  sweep and optimize requests apply the active list before the worker starts, and
  `scripts/run-engine.mjs --overrides FILE` applies a saved `OverrideSet` from its
  manifest. A review of the first cut found and closed three defects: a run keeps the
  list it applied (`AnalysisRunState.overrides`) and goes stale when an override edit
  changes the values in force; Save to history and `pinBaseline` write that list; the
  Outcome and Compare forecasts run `trialForecast` on the applied scenario.
- Gate on the working tree, 2026-09-15: `npm run check` passed (202 test files, 2,173
  tests; main had 198 and 2,160), `npm run test:engine` 3 pass, and `npm run
  check:bundle` passed with the entry at 360,844 bytes gzip against the 364,000 budget
  (main 360,322). The Phase 4
  gate on the committed tree is recorded in
  [the Phase 4 gate record](field-te/evidence/p4-gate-2026-09-15/README.md).
- Open defect found at the Phase 4 gate and not fixed: on the firing-scenario laydown the
  default physical kinetic model fires the Coyote's magazine and kills nothing, so every
  placement ties and every Sobol index is undefined.

## Tasking

Tasks run in this order. Each is one session task with its own gate. None is selected;
the user picks. Each is a follow-up from the Phase 4 gate, not plan tasking.

### Task 1: Zero-kill kinetic outcome on the firing laydown

- Outcome: a written finding on why the physical kinetic model (`src/playback/pk/kinetic.ts`,
  lane 3.5) yields no defeat effect from four Coyote shots on the firing-scenario probe
  where `legacyKineticPk` yields 2.25 kills, and either a defect fix or a documented
  model limit with the datasheet reasoning.
- Source pointers: `docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json`,
  gate screenshots `02-run.png` and `04-outcome.png`, `src/playback/kinetic.verify.test.ts`,
  the Phase 3 gate comparison note on no-arrival classifications.
- Constraints: no parity fixture moves without a hand-derived replacement in the report.

### Task 2: Entry chunk lazy split

- Outcome: the entry chunk back under 340 kB gzip with the budget lowered again, by
  loading an engine or analysis addition lazily. Measure with `npm run build && npm run
  check:bundle`; `npm run check` does not run `check:bundle`.
- Source pointers: `scripts/check-bundle.mjs` (history of raises in its comment),
  `src/io/persist.ts` and `src/io/runRecordPackage.ts` (the split made at the gate),
  `src/state/analysisRequests.ts` (the optimize wiring is the newest entry weight).

### Task 3: Smaller follow-ups, each a short task

- `RunRecord` gains `sobol: SobolResult | null` so the SQLite `sobol` table fills
  (`src/model/runRecord.ts`, `src/io/exportSqlite.ts` already reads the field, the save
  path in `OutcomeScreen.tsx`).
- `CalibrationRecord` persistence, if the user wants the record beyond the override
  reason text (`src/analysis/calibrate.ts` returns it; nothing stores it).
- `OptimizeResult` carries no `stopped` field; a cut run is read from
  `trace.length < budget.evaluations`. Add a field if a screen needs the reason.
- `exportPng.svgMarkup` has no unit test; the project has no jsdom.
- `WEAK_TIME_CV = 0.5` in `calibrate.ts` is a planning constant with no source.
- From the Phase 3 review-fix record: the CR-04 regression test drives a hand-written
  sampler; `profileMeetTau` finds the first crossing inside its last doubling; the limited
  flight fallback solve is unprofiled; the `interceptAt` doc comment still says "bit for
  bit" for every no-option call.
- From the Task 1 review, on overrides: `spreadFor` treats a `spread: null` row as fixed
  and `dropEditedProvenance` removes the row, so an override on a user-pinned field makes
  it uncertain again; `trial.scenario` feeds `systemTelemetry.ts` and `ThreatWezLayer.tsx`,
  which display library values while the result reflects the override; the deterministic
  run mode and the Prepare panel (`engagementPicture(scenario)`) never apply overrides;
  the CLI `readOverrideSet` validates less than `parseOverrideSet` in
  `persistOverrides.ts`. Also: the Pd-modeled radars (Giraffe 1X, KuRFS, RPS-42 and
  others) detect earlier in a sampled trial than in the deterministic forecast on the
  firing laydown with no override at all, so `forecast-trial-disagreement` fires on them
  by model behavior; LSTAR, the RF, acoustic and EO/IR sensors agree exactly.

## Landmines

- A run's identity is its basis signature and the override list it applied
  (`AnalysisRunState.overrides`, compared by model, field and value through
  `sameAppliedOverrides`). An override edit that changes a value in force reaches the
  store only through the `useOverrides.subscribe` line at the end of `store.ts`; a test
  that installs a trial with `useStore.setState` and then edits an override drops that
  trial. Set the override first, or give the installed run its list.
- The Systems tab is the only view that shows an override; rings, WEZ, telemetry and
  the Prepare forecast read `trial.scenario` or the board scenario, which keep the
  library value.
- The optimizer ranks ties by trace order, so when no placement changes the objective the
  starting laydown is candidate 1 and Apply moves nothing. Under common random numbers
  kill draws key by effector and ship, not position, so laydowns that all cover the path
  tie exactly.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate. The
  entry stands about 3 kB under the 364 kB budget.
- `sql.js` must stay behind `await import` with its wasm URL; a static import puts 326 kB
  gzip of wasm into the initial set.
- The three protected suites run constant-speed flight. `interceptAt` keeps their
  closed-form time through the residual gate `closesOnSample`; any change to the gate
  tolerance moves their pinned values.
- `salvoCooldownS` is the minimum spacing between assignments; a modeled optical dwell
  reserves the effector to the later of cooldown and effect time.
- The optical dwell solve declines a shot as `no-dwell-solution`; callers test
  `shot.rejected` for truthiness only.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- Physics tab semantics: a checked box selects the prior planning fallback; a cleared box
  selects the physical model.
- `FlightPath` has no altitude profile; `climbRateMps` is recorded and unused.
- Bounded flight changes arrival classification in the layered estimate fixture; the
  resulting drop in leakers and kills is not evidence of improved defeat.
- Lane briefs that describe engagement physics can trip a Fable safeguard at launch. Open
  each brief with the tool's purpose line from the top of this file; every Phase 4 brief
  did and none tripped.
- Every edit to a registered reference document needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails. Guides
  fingerprint `src/`, so a source commit after a docs review invalidates it.

## Evidence

- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
- [Phase 3 review fixes CR-01 to CR-04, 2026-09-14](field-te/evidence/cr-fixes-2026-09-14/README.md)
- [Phase 3 integration review, 2026-09-11](CodeReview.md)
- [Phase 3 gate](field-te/evidence/p3-gate-2026-09-10/README.md)
- [Estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
