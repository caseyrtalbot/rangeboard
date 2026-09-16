# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [docs/README.md](README.md),
including the completed [calibration plan](IMPLEMENTATION_PLAN.md), and the commit log. This file holds only
the position, the tasking ahead and the landmines. A fresh agent starts from this file
and the docs index. This file does not authorize a commit, push or merge.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch and
  `origin/main` matches it at the evidence storage merge (`5bd19c0`, 2026-09-16), which
  follows the board-header slice (`8e4545e`) and the zero-kill kinetic finding (`8766728`).
- The authoritative checkout is `~/Projects/rangeboard` on `main`. No lane worktrees,
  unmerged local task branches or stashes remain after this cleanup.
- The board-header slice moves the lifecycle tabs and run status into the 40 px header,
  removes the separate phase row and keeps the existing drawer and playback-bar behavior.
  Its source, tests, current guides and documentation fingerprints are integrated.
- Plan: Phases 0 to 4 complete, each marked in the plan with its merge commits. The plan
  is a historical record; there is no Phase 5 tasking.
- Evidence storage: `npm run check` runs `check:evidence`, which fails on a byte-identical
  JSON copy or an uncompressed JSON capture over 512 kB. New captures go through
  `scripts/evidence/capture.mjs`; screenshots get `oxipng -o 4 --strip safe`. The evidence
  tree is 31 MB after the 2026-09-16 cleanup.
- The zero-kill kinetic task is done on this branch and is a written finding, not a code
  change. No engine file changed. The finding is
  [the zero-kill kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md);
  it carries the per-shot table, the hand derivation, the reference probe and the two
  probe captures.
- Integrated local gate, 2026-09-16: `npm run check` passed (202 test files,
  2,175 tests, plus docs, engine CLI, library, schema, typecheck, lint and build),
  `npm run check:bundle` passed with the entry at 361,510 bytes gzip against the
  364,000 budget, and the real-browser board-shell suite passed 11 of 11 checks at
  1400 by 900. The prior Phase 4 committed-tree result remains recorded in
  [the Phase 4 gate record](field-te/evidence/p4-gate-2026-09-15/README.md).
- Open defect, diagnosed and quantified but not fixed: `src/playback/shot.ts:319` charges
  the assignment-to-release delay as an open-loop coast of the fire-control track, so at
  the Coyote's `engageTimeS` of 60 s the miss 1 sigma is 282 m against a 10 m lethal
  radius and the physical kinetic model kills nothing on the firing laydown. The one-site
  fix is written out in the record. It is not landed because it moves five pinned values
  in `src/playback/estimate.parity.test.ts` that cannot be hand derived, and because one
  of them is contaminated by a second defect: the layered golden fixture runs its
  interceptors at zero flight time. Until the fix lands, `legacyKineticPk` is the
  defensible model choice for sizing a kinetic engagement.

## Tasking

Each is one session task with its own gate. Task 1 is the next bounded task because it
repairs a correctness defect in the default physical kinetic path. It is not started or
authorized by this cleanup. Tasks 2 and 3 are lower-priority Phase 4 follow-ups. None is
plan tasking.

### Task 1: Land the kinetic miss horizon and recapture the estimate-path anchors

- Outcome: `src/playback/shot.ts:319` uses the flight as the miss horizon, with a
  regression test sized like `src/playback/kinetic.verify.test.ts`, and
  `src/playback/estimate.parity.test.ts` recaptured. The candidate change, its measured
  effect and the five moved pins are in
  [the zero-kill kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md).
- Do the `flyoutSpeedMps` adoption gap first or decide against it explicitly. The layered
  golden fixture saves no `flyoutSpeedMps` and `ADOPTED_SEED_KEYS.effector`
  (`src/model/libraryLifecycle.ts:116`) does not adopt it, so its interceptors fly with a
  zero flight time while the physical Pk model still applies. Recapturing that fixture's
  kills mean as 4.68 without fixing this pins a teleporting interceptor.
- The recapture needs the user's authorization for each replacement value. The Monte
  Carlo means over 200 replicates and the layered event count are not hand derivable, and
  `estimate.parity.test.ts`'s own header requires a replacement named in the slice brief.
  Write the before and after into the record beside the Phase 3 comparison, as
  [the Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
  did.
- The residual gap after the fix is a model limit: the interceptor model has no
  terminal-homing term, so the Coyote reaches Pk 0.034 to 0.050 per shot against the
  fallback's 0.556 to 0.564. A terminal-guidance term is separate tasking and is not
  authorized here.

### Task 2: Entry chunk lazy split

- Outcome: the entry chunk back under 340 kB gzip with the budget lowered again, by
  loading an engine or analysis addition lazily. Measure with `npm run build && npm run
  check:bundle`; `npm run check` does not run `check:bundle`.
- Source pointers: `scripts/check-bundle.mjs` (history of raises in its comment),
  `src/io/persist.ts` and `src/io/runRecordPackage.ts` (the split made at the gate),
  `src/state/analysisRequests.ts` (the optimize wiring is the newest entry weight).

### Task 3: Smaller follow-ups, select one per session

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
- From the apply-overrides review: `spreadFor` treats a `spread: null` row as fixed
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
- Zero kills from the default physical kinetic model are a defect, not physics.
  `shot.ts:319` propagates the track over `engageTimeS` before the Rayleigh miss, so at
  the Coyote's 60 s delay the miss 1 sigma is 282 m against a 10 m lethal radius and
  every interceptor Pk sits near 5e-4. `lethalRadiusM` and `guidanceNoiseM` cannot move
  a result while that stands, so both read as sensitive in the Systems tab and are not.
- `kinetic.verify.test.ts` validates the Rayleigh closed form at hand-supplied miss
  sigmas of 1, 5 and 10 m. The live path never reaches that regime, so the verify suite
  passing is not evidence the integrated interceptor model works.
- The two golden fixtures pin `truthTracks` and `legacyKineticPk`, so a change to the
  physical kinetic Pk cannot move them. `estimate.parity.test.ts` is the only suite it
  moves, and it holds five interceptor-sensitive pins: the layered trial event count and
  kill mass, and three 200-replicate means.
- The layered golden fixture saves no `flyoutSpeedMps` and `ADOPTED_SEED_KEYS.effector`
  does not adopt it, so `phase3FlyoutProfile` returns null and its interceptors arrive at
  the instant of release while `kineticEffectProbability` still takes the physical
  branch. The two halves of lane 3.5 disagree on that fixture about whether the physical
  model applies.
- `seekerAcquisitionRangeM` gates feasibility only (`seekerAcquisitionAfterEnd`). Nothing
  reduces the miss sigma for a seeker-equipped round, so the model has no terminal-homing
  term and a hit-to-kill radius such as the Anvil's 0.3 m can never produce a kill.
- Lane briefs that describe engagement physics can trip a Fable safeguard at launch. Open
  each brief with the tool's purpose line from the top of this file; every Phase 4 brief
  did and none tripped.
- Every edit to a registered reference document needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails. Guides
  fingerprint `src/`, so a source commit after a docs review invalidates it.

## Evidence

- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
- [Phase 3 review fixes CR-01 to CR-04, 2026-09-14](field-te/evidence/cr-fixes-2026-09-14/README.md)
- [Phase 3 integration review, 2026-09-11](CodeReview.md)
- [Phase 3 gate](field-te/evidence/p3-gate-2026-09-10/README.md)
- [Estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
