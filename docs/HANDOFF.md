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

- Repository `~/Projects/rangeboard`, branch `main`, base commit `e199461`, equal to
  `origin/main`. The working tree is dirty and uncommitted: Task 1 fixes in
  `src/playback/{shot,attrition,sim,intercept}.ts` and their tests, plus the docs listed in
  the [review-fix record](field-te/evidence/cr-fixes-2026-09-14/README.md). Casey decides
  the commit.
- No lane worktrees or lane branches exist. Task 1 ran as three lanes in the shared tree.
- Plan: Phases 0 to 3 complete, each marked in the plan with its merge commit. The four
  Phase 3 review findings closed on 2026-09-14. Phase 4 not started.
- `npm run check` on the dirty tree passed on 2026-09-14: 186 test files, 2,075 tests,
  engine CLI, library, schema, docs, typecheck, lint, build and bundle budget.
- Open defects: none recorded. Three unselected follow-ups are listed in the review-fix
  record.

## Tasking

Tasks run in this order. Each is one session task with its own gate.

### Task 1: commit the review fixes

- Outcome: the Task 1 working tree lands on `main` as one commit, or as Casey directs.
  This file does not authorize that commit.
- Owned files: the dirty paths above and nothing else. Stage only those paths.
- Completion checks: `git status` clean after the commit; `npm run check` unchanged.
- Stop: the commit exists. Do not start Phase 4 in the same task.

### Task 2: Phase 4, hypothesis tools

- Begins at [plan section 6](IMPLEMENTATION_PLAN.md#6-phase-4-hypothesis-tools) after
  Task 1 lands. Contract 4.a is sequential and comes first.
- Every lane brief must tell the worker to remove its worktree at the merge, as
  [WORKFLOW.md](WORKFLOW.md#handoffs-and-orchestration) requires. The Phase 3 briefs
  omitted this line and left six worktrees behind.
- Lane briefs that describe engagement physics can trip a Fable safeguard at launch.
  On 2026-09-14 the CR-04 lane failed that way before any edit and ran on Opus instead.
  Open each brief with the tool's purpose line from the top of this file.

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
