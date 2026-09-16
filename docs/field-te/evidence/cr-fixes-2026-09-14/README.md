# Phase 3 review fixes, Task 1 evidence

Captured 2026-09-14 on local `main` at `e199461` with the fixes in the working tree.
Nothing was committed or pushed. This closes CR-01 to CR-04 of the
then-current `docs/CodeReview.md`.

## Fixes

| Finding | File | Change | Regression test |
| --- | --- | --- | --- |
| CR-01 | `src/playback/shot.ts` | `solveBeamTiming`: twelve fixed-point iterates with a residual stop test, then a 32-cell bracket and bisection of the residual over the engagement window; a candidate that fails the residual check is declined as `no-dwell-solution` | `shot.test.ts`: approaching target at 5 km and 1 km visibility; the returned dwell, position and `beamEffect` at the returned slant agree within 1e-4 s |
| CR-02 | `src/playback/attrition.ts` | `nextReadyS` is the later of cooldown and effect time when a modeled dwell runs; the fine-step window is release to effect | `attrition.test.ts`: two targets on one optical effector; illumination intervals do not overlap |
| CR-03 | `src/playback/sim.ts` | `flightDeviationM` adds one turn radius plus wind speed times path duration to the spread margin in `threatEntityInputs`; zero without flight limits or under `noFlightLimits` | `sim.test.ts`: wind drift and bounded turn; a moved sensor produces a fresh memo equal to `assessThreat` |
| CR-04 | `src/playback/intercept.ts` | `interceptAt` keeps the closed-form time only when a constant-speed flyout closes on the sampled target (`closesOnSample`, 1e-6 relative miss); otherwise `profileMeetTau` solves against the sampled trajectory | `intercept.test.ts`: accelerating target; 13.066 s and 914.637 m, feasible |

Solved optical cases, 100 kW at 12 km maximum range against the review's approaching
quadcopter: 5 km visibility gives an effect at 51.901 s and 7,404.9 m; 1 km visibility
gives 153.041 s and 2,347.9 m inside a 200 s window and no solution inside 100 s.

## Judgments

- CR-02 reads `salvoCooldownS` as the minimum spacing between assignments, so the
  reservation is `max(t + cooldownS, tEffect)`, not `tEffect + cooldownS`. A thermal
  recovery after illumination would be a one-line change at that site.
- CR-04 gates on the residual, not on the presence of `sampleFlightAt`, because
  `attrition.ts` sets the sampler on every threat with a path, including the
  `sensitivity.parity` fixture under `noFlightLimits`. Constant-speed flight agrees with
  the closed form to float noise, so its results are bit-identical.
- CR-03 bounds the deviation analytically instead of sampling the trajectory, so the memo
  does not depend on the sweep step.

## Checks

- Each regression test failed on the pre-fix source and passes after it (lane reports).
- `npm run check` on the integrated tree: 186 test files, 2,075 tests (six new), engine
  CLI, library, schema, docs, typecheck, lint, build and bundle budget all passed.
- `sensitivity.parity.test.ts`, `accuracy.verify.test.ts`, `convergence.verify.test.ts`
  and `src/playback/__fixtures__/` are unchanged and pass. No pinned value moved.
- `docs/ENGINEERING_REFERENCE.md` and `docs/PROJECT_GUIDE.md` reviewed with notes.

## Follow-ups, not selected

- `EngagementEvent.tReleaseS` is optional in `attritionReport.ts` although `commitSalvo`
  always sets it.
- The bracketing dwell solve costs up to about 100 beam evaluations per candidate and
  runs only when the fixed point fails; it is not profiled under a Monte Carlo sweep.
- `flightDeviationM` recompiles the route that `scenarioDurationS` already compiled per
  memo check; the route cache keeps it cheap.
