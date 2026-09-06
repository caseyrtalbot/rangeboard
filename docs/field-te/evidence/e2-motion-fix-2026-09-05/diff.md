# E2 motion correction before-and-after capture, 2026-09-05

Source change (`src/playback/intercept.ts`, `src/playback/attrition.ts`; register R-D-44).
`interceptAt` returns `infeasible`: true when the effector has a flyout and the slant to the
credited point exceeds the reach `v * (tEffectS - release)` by more than one DT of flight,
`v * DT` (`averageFlyoutMps`, the stated speed times `FLYOUT_SPEED_FACTOR`). Both selection
passes (legacy volley and doctrine assignment) skip an infeasible ship: no event, no round,
no cooldown, no hold. The cap (R-F-7, `flightCapped`) is unchanged and independent. No draw
site, key, `DT`, CRN pairing, raid partition, sampler or persistence changed. The solver
(three fixed-point passes) is unchanged; its replacement is R-F-43.

Probe: `e2fix-capture.ts.txt`, run as the scratch vitest file `src/playback/e2fix.capture.test.ts`
and deleted after. Test 1 is the parity probe body (assessments, deterministic report,
aleatory MC, total MC, sensitivity; `replicates: 4`) on the firing fixture
(`onboarding-2026-09-04/firing-scenario.json`). Test 2 is the layered fixture
(`src/playback/__fixtures__/layered-acoustic-merops.json` through `fillScenario`): the
deterministic report and 30 aleatory replicates at seed 7. Each file was produced twice on
each tree and compared with `cmp`; all four are byte-stable. `numerical-before.json` is
byte-identical to `e3-followups-2026-09-05/numerical-after.json`.

## What is identical

Everything captured. `numerical-before.json` and `numerical-after.json` are byte-identical:
the firing fixture's four Coyote events have shortfalls -3.4, -1.5, -0.2 and +0.004 m
against a tolerance of 0.5 s of flight, so none is declined. `layered-before.json` and
`layered-after.json` are byte-identical: no shot in the layered fixture is infeasible.
`numerical-after.json` stays the parity baseline for later refactors.

## What changed

Only the study cases, covered by the unit test "declines a shot the interceptor cannot
reach" in `src/playback/attrition.test.ts`:

| Case | Before | After |
| --- | --- | --- |
| Receding 97 m/s against 54.6 m/s, 4000 m envelope (was the R-F-7 cap test) | one event at the cap 29.5 s, Pk 0.35144375, `flightCapped`, one round spent, `expectedKills` 0.35144375 | no event, no round, `expectedKills` 0, `expectedNoArrival` 1, in both passes |
| Near-equal receding 65 against 70 m/s, 10 km envelope (the unflagged case) | one event at 55.85 s, Pk 0.438, no flag, 921 m beyond reach | no event, no round, in both passes |
| Receding 20 against 70 m/s, 5 km envelope (solver residual 28 m, under the 35 m tolerance) | one event at 33.44 s | unchanged |
| Closing 40 against 54.6 m/s | one event | unchanged |

## Browser check

No panel file changed. No browser check.
