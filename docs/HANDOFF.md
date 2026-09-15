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

- Repository `~/Projects/rangeboard`, branch `main`, base commit `cf4992d` plus this
  handoff commit. `origin/main` is at `63486ca`; nothing from Phase 4 is pushed.
- Dirty paths not owned by Phase 4: `src/App.tsx`, `src/index.css`, `src/io/storageKeys.ts`,
  `src/panels/Toolbar.tsx`, `src/panels/Toolbar.test.tsx` and
  `scripts/e2e/board-shell.e2e.mjs` carry the uncommitted shell-rework slice (right
  drawer) of a separate session. Do not stage, revert or build on them from this
  handoff. `npm run docs:check` on the dirty tree asks for a `DESIGN_SYSTEM.md` and guide
  review because of them; the committed tree passes.
- No lane worktrees or lane branches exist; the five `p4/*` branches were merged and
  deleted.
- Plan: Phases 0 to 4 complete, each marked in the plan with its merge commits. Phase 4
  is the last phase in the plan; there is no Phase 5 tasking.
- Gate on the committed tree at `62cfeb8`, run in a clean worktree: `npm run check`
  passed (198 test files, 2,160 tests) and `npm run check:bundle` passed with the entry at
  360,322 bytes gzip and the initial set at 375,970 against the entry budget raised to
  364,000 in `4f50104`. The whole-loop browser check is recorded in
  [the Phase 4 gate record](field-te/evidence/p4-gate-2026-09-15/README.md).
- Open defects found at the gate and not fixed: an accepted override is recorded in both
  manifests but no engine path reads it, so a calibration changes no run result; on the
  firing-scenario laydown the default physical kinetic model fires the Coyote's magazine
  and kills nothing, so every placement ties and every Sobol index is undefined.

## Tasking

Tasks run in this order. Each is one session task with its own gate. None is selected;
the user picks. Each is a follow-up from the Phase 4 gate, not plan tasking.

### Task 1: Apply overrides to the run

- Outcome: an override in `useOverrides` replaces the library field value the engine reads,
  for the trial, the replicate run, the sensitivity and sweep runs and the optimizer, and
  the manifest keeps recording it. A calibrated `pk` of 0.02 lowers kills.
- Source pointers: `src/state/overrides.ts` (`activeOverrides`), the trial launch in
  `src/state/analysisRequests.ts` (the only place overrides enter a request today, as
  manifest content), `src/playback/trialTypes.ts` (`TrialManifest.overrides`),
  `src/model/types.ts` (`specFields`, `dropEditedProvenance`), the sampled scenario in
  `src/analysis/uncertainty.ts` (`sampleScenario` is where a per-replicate value is set).
- Constraints: overrides stay out of `Scenario` and history. The engine CLI
  (`scripts/run-engine.mjs`, `src/engine/index.ts`) must apply the same rule from the
  manifest so the browser and CLI summaries stay equal at one seed. The three protected
  parity suites and `estimate.parity` carry no overrides and must not move.
- Completion checks: a test where one override changes a replicate outcome; the CLI
  parity test still passes; `npm run check`.

### Task 2: Zero-kill kinetic outcome on the firing laydown

- Outcome: a written finding on why the physical kinetic model (`src/playback/pk/kinetic.ts`,
  lane 3.5) yields no defeat effect from four Coyote shots on the firing-scenario probe
  where `legacyKineticPk` yields 2.25 kills, and either a defect fix or a documented
  model limit with the datasheet reasoning.
- Source pointers: `docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json`,
  gate screenshots `02-run.png` and `04-outcome.png`, `src/playback/kinetic.verify.test.ts`,
  the Phase 3 gate comparison note on no-arrival classifications.
- Constraints: no parity fixture moves without a hand-derived replacement in the report.

### Task 3: Entry chunk lazy split

- Outcome: the entry chunk back under 340 kB gzip with the budget lowered again, by
  loading an engine or analysis addition lazily. Measure with `npm run build && npm run
  check:bundle`; `npm run check` does not run `check:bundle`.
- Source pointers: `scripts/check-bundle.mjs` (history of raises in its comment),
  `src/io/persist.ts` and `src/io/runRecordPackage.ts` (the split made at the gate),
  `src/state/analysisRequests.ts` (the optimize wiring is the newest entry weight).

### Task 4: Smaller follow-ups, each a short task

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

## Landmines

- An override is a record, not an applied value, until Task 1 lands. The Systems tab
  shows it as in force; the engine reads the library value.
- The optimizer ranks ties by trace order, so when no placement changes the objective the
  starting laydown is candidate 1 and Apply moves nothing. Under common random numbers
  kill draws key by effector and ship, not position, so laydowns that all cover the path
  tie exactly.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate. The
  entry stands 3.7 kB under the 364 kB budget.
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
