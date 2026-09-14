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

- Repository `~/Projects/rangeboard`, branch `main`, base commit `7541880`, equal to
  `origin/main` (pushed 2026-09-11). Working tree clean.
- No lane worktrees or lane branches remain. The Phase 3 worktrees and all `calib/*`
  branches were removed on 2026-09-14 after their merges.
- Plan: Phases 0 to 3 complete, each marked in the plan with its merge commit. Phase 4
  not started.
- `npm run check` on `7541880` passed on 2026-09-14: 186 test files, 2,069 tests, engine
  CLI, library, schema, docs, typecheck, lint, build and bundle budget.
- Open defects: four, recorded in the [Phase 3 integration review](CodeReview.md) and
  confirmed against the current source on 2026-09-14. No code has changed since the
  reviewed commit `1803900`.

## Tasking

Tasks run in this order. Each is one session task with its own gate.

### Task 1: close the Phase 3 review findings

- Outcome: CR-01 to CR-04 in [CodeReview.md](CodeReview.md) closed. Each fix ships a
  regression test that fails before the fix and passes after it.
- Owned files: `src/playback/shot.ts`, `src/playback/attrition.ts`, `src/playback/sim.ts`,
  `src/playback/intercept.ts` and their tests.
- Exclusions: no Phase 4 files; no edits to the protected fixtures under
  `src/playback/__fixtures__/`; no library or schema changes.
- Order: CR-01 (P1) first. CR-02 next; its fix must also reconcile the fine-step window
  requested at `attrition.ts:493` with the credited illumination window. Then CR-03.
  CR-04 last.
- Constraint for CR-04: the `sensitivity.parity` fixture's interceptor runs the fallback
  intercept branch with flight limits disabled. Gate the new time-of-flight solve on
  limited flight so constant-speed flight stays bit-identical. Update the pinned fallback
  value in `intercept.test.ts` only together with the fix.
- Completion checks: `npm run check` passes; `sensitivity.parity.test.ts`,
  `accuracy.verify.test.ts` and `convergence.verify.test.ts` unchanged and passing; the
  estimate-path tests pass, or are repinned with the reason recorded in dated evidence.
- Stop: all four findings closed and this file rewritten. Do not start Phase 4 in the
  same task.

### Task 2: Phase 4, hypothesis tools

- Begins at [plan section 6](IMPLEMENTATION_PLAN.md#6-phase-4-hypothesis-tools) after
  Task 1 closes. Contract 4.a is sequential and comes first.
- Every lane brief must tell the worker to remove its worktree at the merge, as
  [WORKFLOW.md](WORKFLOW.md#handoffs-and-orchestration) requires. The Phase 3 briefs
  omitted this line and left six worktrees behind.

## Landmines

- The three protected suites run constant-speed flight. Any ungated change to the
  fallback intercept branch moves their pinned swing and standard-error values.
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

- [Phase 3 integration review, 2026-09-11](CodeReview.md)
- [Phase 3 gate](field-te/evidence/p3-gate-2026-09-10/README.md)
- [Estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Phase 3 lane rules and briefs as issued](field-te/evidence/p3-lanes-2026-09-10/briefs/p3-lane-common.md)
- [Phase 2 gate](field-te/evidence/p2-gate-2026-09-10/README.md)
