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

- Repository `~/Projects/rangeboard`, branch `main`, base commit `63486ca`, equal to
  `origin/main` (pushed 2026-09-14). Working tree clean.
- No lane worktrees or lane branches exist.
- Plan: Phases 0 to 3 complete, each marked in the plan with its merge commit. The four
  Phase 3 review findings closed in `63486ca`. Phase 4 not started.
- `npm run check` on `63486ca` passed on 2026-09-14: 186 test files, 2,075 tests, engine
  CLI, library, schema, docs, typecheck, lint, build and bundle budget.
- Open defects: none recorded. Unselected follow-ups from the
  [review-fix record](field-te/evidence/cr-fixes-2026-09-14/README.md) and the CR-04
  hand review of 2026-09-14: the CR-04 regression test drives a hand-written sampler,
  not `sampleFlightPath`; `profileMeetTau` finds the first crossing inside its last
  doubling, not the earliest overall (needs a target faster than three times the flyout);
  the fallback solve under limited flight costs about 112 sampler calls and the CR-01
  bracket multiplies it, unprofiled; the `interceptAt` doc comment still claims
  "bit for bit" for every no-option call.

## Tasking

Tasks run in this order. Each is one session task with its own gate. Phase 4 follows
[plan section 6](IMPLEMENTATION_PLAN.md#6-phase-4-hypothesis-tools); this section adds the
source pointers and the constraints the plan does not carry.

### Task 1: Phase 4 contract 4.a (sequential)

- Outcome: `OptimizeRequest`, `OptimizeResult` and `CalibrationRecord` typed in
  `src/model/types.ts` and a new `src/playback/optimizeTypes.ts`, with
  `npm run schema:generate` run and `npm run schema:check` passing. Fields per the plan
  table: objective, movable ids, bounds, budget; candidates with intervals and a trace;
  field, prior, observed, posterior, accepted.
- Owned files: those two files, the generated schema and their tests. No lane code.
- Constraints: types only, no behavior. `Scenario` gains nothing; an optimize request is
  an analysis request, not scenario content. Reuse the interval and statistic shapes the
  analysis screens already consume (`src/analysis/`), never a second interval type.
- Completion checks: `npm run check` passes.
- Stop: the contract merged to `main`, this file rewritten with the lane briefs issued.

### Task 2: Phase 4 lanes 4.1 to 4.4 (parallel, four worktrees)

- Begins after Task 1. Each lane gets a bounded brief with disjoint file ownership per the
  plan table, its own worktree and branch `p4/<lane>`, test selection scoped with
  `--dir src`, and the instruction to remove the worktree at the merge.
- Source pointers per lane:
  - 4.1 placement optimizer: the worker must sit in the worker value-import graph
    (`docs/ENGINEERING_REFERENCE.md` section 3, worker isolation). Model it on
    `src/playback/mc.worker.ts`, `mcClient.ts`, `workerPool.ts` and `workerSlot.ts`; the
    store reaches it only through `src/state/analysisRequests.ts`. Common random numbers
    come from the existing seeded draw policy (`src/playback/policy.ts`).
  - 4.2 calibrate from counts: an accepted posterior becomes an override through
    `useOverrides.setOverride(modelId, field, value, reason)` in `src/state/overrides.ts`;
    a blank reason throws. Overrides stay out of `Scenario` and history and reach a run
    through the trial manifest.
  - 4.3 compare and record: `CompareScreen.tsx` exists; `RunHistory.tsx` already holds
    `RunRecordView`, and `src/io/persist.ts` already exports `exportRunRecord`. The lane
    extends those instead of creating parallel `RunRecord.tsx` and `exportRun.ts` files
    unless the contract decides otherwise; record that decision in the brief.
  - 4.4 SQLite export: `sql.js` must load lazily. The bundle budget in
    `scripts/check-bundle.mjs` is 360 kB entry and 400 kB initial, gzip; the entry stood at
    335 kB at the Phase 0 gate. A static import fails `npm run test:bundle`.
- One integrator owns `src/model/types.ts`, schema generation, `AnalysisNavigation.tsx`,
  `package.json`, shared docs and the merges.
- Lane briefs that describe engagement physics can trip a Fable safeguard at launch.
  On 2026-09-14 the CR-04 lane failed that way before any edit and ran on Opus instead.
  Open each brief with the tool's purpose line from the top of this file.
- Stop: four lanes merged, worktrees removed, `npm run check` green on `main`.

### Task 3: Phase 4 UI lane 4.5 and gate 4.d

- After 4.1 merges: `PlacementScreen.tsx` and its `AnalysisNavigation.tsx` entry
  (`src/panels/analysis/screens/navigation.ts` holds the screen list per phase). Browser
  check required.
- Gate per plan 4.d: `npm run check` and a browser check of the whole loop. Then mark
  Phase 4 in the plan with its merge commit, review `PROJECT_GUIDE.md`,
  `ENGINEERING_REFERENCE.md` and `VERIFICATION.md`, and rewrite this file.

## Landmines

- The three protected suites run constant-speed flight. `interceptAt` keeps their
  closed-form time through the residual gate `closesOnSample`, not through a presence
  check on `sampleFlightAt`; `attrition.ts` sets that sampler on every threat with a path.
  Any change to the gate tolerance moves their pinned swing and standard-error values.
- `salvoCooldownS` is the minimum spacing between assignments. A modeled optical dwell
  reserves the effector to the later of cooldown and effect time. Changing that to effect
  time plus cooldown changes every modeled DE re-attack spacing.
- The optical dwell solve declines a shot as `no-dwell-solution` when no converged effect
  time lies inside the window. Callers test `shot.rejected` for truthiness only.
- The memo dependency set widens by `flightDeviationM` only when the spec has flight
  limits and `noFlightLimits` is clear; legacy scenarios keep their prior memo behavior.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- Physics tab semantics: a checked box selects the prior planning fallback; a cleared box
  selects the physical model. Every physical path carries a fidelity tag.
- `FlightPath` has no altitude profile. `climbRateMps` is recorded and unused; the engine
  invents no altitude change.
- Iron Beam's sourced `dwellToEffectS` spread is not in the runtime provenance ordering
  or `PF_SPREAD`; optical shots use the documented 2 dB event-level default.
- The Spynel recognize-range mismatch against the vendor sheet is retained by design.
- Bounded flight changes arrival classification in the layered estimate fixture. The
  resulting drop in leakers and kills is not evidence of improved defeat.
- Phase 2 remnants stay out of scope until selected: per-sensor classification flag,
  fusion latency quantization, unmodeled elevation accuracy and the C2 editor gaps.
- Every edit to a registered reference document needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails.

## Evidence

- [Phase 3 review fixes CR-01 to CR-04, 2026-09-14](field-te/evidence/cr-fixes-2026-09-14/README.md)
- [Phase 3 integration review, 2026-09-11](CodeReview.md)
- [Phase 3 gate](field-te/evidence/p3-gate-2026-09-10/README.md)
- [Estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Phase 3 lane rules and briefs as issued](field-te/evidence/p3-lanes-2026-09-10/briefs/p3-lane-common.md)
- [Phase 2 gate](field-te/evidence/p2-gate-2026-09-10/README.md)
