# Motion and effect timing dossier

Dated evidence dossier, 2026-09-05, against source tree `d8a76f1`. Source and tests decide current behaviour. [Index and verification](README.md).

## Intended quantity and applicability

Estimate assignment, effect and pre-/post-arrival engagement timing along a fixed horizontal path. The flyout model is a constant effective-speed approximation with three iterations. Its analytical evidence applies to the specific straight-line cases; a cap is a bookkeeping rule, not a physically feasible intercept solver.

## Equations, units and calibration

[geo.ts](../../../src/geometry/geo.ts#L174) advances the target at path speed in m/s after delay in seconds. Formation offsets follow the path heading; instantaneous turns have no acceleration constraint. [tactics.ts](../../../src/playback/tactics.ts) builds planning geometries from named historical patterns; counts, spacing, standoff and decoy proportions are not all observations.

[attrition.ts](../../../src/playback/attrition.ts#L578) sets `v_eff=0.7*flyoutSpeedMps` for the kinetic expenditure channel and `tof=slant/v_eff`. Missing speed, DE, HPM and jammers contribute no flyout. `interceptAt` begins tof=0 and performs three updates `tof_next=r(target(t+engageTimeS+tof))/v_eff`; it then samples geometry at the returned effect time. If release is at/before the current window end and the computed flight exceeds it, effect time becomes that end and `flightCapped` is set. A release already beyond the cap is not trimmed.

The event's `tS` records assignment; its effect time includes the modeled engage delay and flight. Route-ready time precedes assignment; BDA/cooldown regulate reattack. Arrival is first sampled defended-radius crossing and stays distinct from CPA and late effect.

[Seed inventory](seed-inventory.json) records six speed anchors: Coyote 154, MEROPS 78, Stinger 750, EAGLS 739, Skyranger 30 1075 and XM914 805 m/s. Pedigree describes maxima, burnout or muzzle velocities, not measured average path speeds. R-F-2's chosen 0.7 factor is implemented in attrition.ts (historical row named doctrineFactors.ts); its promised uncertainty spread is absent. There is no time-of-flight calibration dataset. The factor remains PF, even for sourced muzzle velocity.

## Numerical error and verification

For radial closing motion with separation r at release and target speed u, the independent constant-speed solution is `tof=r/(v_eff+u)` before target passes the launcher. For radial recession it is `r/(v_eff-u)` only when v_eff>u. The fixed-point contraction factor is |u/v_eff| on such a segment; three iterations do not supply a universal DT bound.

[attrition.test.ts:1101](../../../src/playback/attrition.test.ts#L1101) compares the closing example's 27.5802 s flight with the 27.5 s analytic solution (0.0802 s difference). The receding example at [line 1157](../../../src/playback/attrition.test.ts#L1157) starts 1100 m away, u=97, v_eff=54.6 m/s and credits an effect at 29.5 s/3961.5 m with Pk 0.35144375. At that time the interceptor could traverse only 1610.7 m, a 2350.8 m shortfall under the very model used for flight. The capped answer has residual `29.5-3961.5/54.6=-43.0549 s`. This is a verified policy regression plus an independent infeasibility calculation, not physical validation. E1 retains it unchanged for E2.

[accuracy.verify.test.ts](../../../src/playback/accuracy.verify.test.ts) checks assignment, delays, window containment and late effects; [tactics.test.ts](../../../src/playback/tactics.test.ts) checks generated geometry. All named files were rerun. Fixed-path algebra is independently reproducible; no measured interceptor trajectory is available.

## Assumptions, unsupported conditions and data needs

Acceleration, propulsion phases, drag, guidance constraints, turns, seeker acquisition, platform motion and wind do not enter flight dynamics. End-of-path clamping can change the analytic interception case. A generic constant factor cannot establish feasibility for a slower interceptor chasing a faster threat. Weapon engagement delay may overlap real-world launch/acquisition phases; without timestamps it is unknown whether a stated delay double counts processes already in the sourced range/time quantity.

E2 priority is a bounded residual/feasibility study with stationary, closing, receding, crossing, near-equal-speed and path-end cases; separate numerical error from physical model discrepancy. Record unsupported/infeasible outcomes before considering additional fidelity. Do not silently tune factors or change the capped behavior under E1. Required data: exact variant, launch state, time-stamped trajectory and effect event, target motion, definition of engageTimeS and source measurement uncertainty.

## E2 study, 2026-09-05

Source tree `785b4c3`, no engine source changed. Probe and printed results: [evidence/e2-motion-2026-09-05](../evidence/e2-motion-2026-09-05/) (`e2.motion.study.test.ts.txt`, `results.json`). Every direct case calls [`interceptAt`](../../../src/playback/intercept.ts#L59) with the launcher at the origin, mount 4 m, target at 4 m AGL (slant equals ground range), assignment at 0 and the window end computed as [sim.ts](../../../src/playback/sim.ts#L664) samples it (last DT grid time inside `maxRangeM`). Unless stated, the interceptor states 100 m/s (v = 70 m/s), engage time 10 s, release R = 10 s. The analytic time is the constant-speed solution from the release position: stationary `r/v`; radial closing `r/(v+u)`; radial receding `r/(v-u)` when v > u; crossing the smaller positive root of `(u^2-v^2) tof^2 + 2 (P0.d) u tof + |P0|^2 = 0`; path end the stationary solution at the last point when the moving root lands after the path ends. An independent piecewise-linear solver in the probe reproduces each hand value.

| Case | v, u (m/s) | Engine tof (s) | Analytic tof (s) | Residual s (DT) | Cap flag | Reach vs need (m) | Kind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stationary, 3500 m | 70, 0 | 50.000 | 50.000 | 0 (0) | no | 3500 vs 3500 | converged in 2 passes |
| Radial closing, 4800 m | 70, 20 | 54.577 | 53.333 | +1.244 (+2.5) | no | 3820 vs 3709 | numerical |
| Radial receding, slower interceptor (1100 m, [test 1157](../../../src/playback/attrition.test.ts#L1157)) | 54.6, 97 | 29.5 (cap) | none | n/a | yes | 1611 vs 3962, short 2351 | physical |
| Radial receding, faster interceptor, 1200 m | 70, 20 | 23.440 | 24.000 | -0.560 (-1.1) | no | 1641 vs 1669, short 28 | numerical |
| Crossing, 3000 m abeam | 70, 30 | 53.408 | 52.516 | +0.892 (+1.8) | no | 3739 vs 3661 | numerical |
| Near-equal, receding, 1150 m | 70, 65 | 45.849 | 230 (x = 16.1 km, outside) | -184.2 (-368) | no | 3209 vs 4130, short 921 | physical, unflagged |
| Near-equal, closing, 5000 m | 70, 65 | 66.691 | 37.037 | +29.65 (+59.3) | no | 4668 vs 665 | numerical |
| Path end, target stops at 2000 m | 70, 40 | 28.571 | 28.571 | 0 (0) | no | 2000 vs 2000 | converged (clamp) |
| Path end, leaves 5 km envelope | 70, 50 | 30.0 (cap 40) | 175 (x = 12.25 km, outside) | -145 (-290) | yes | 2100 vs 5000, short 2900 | physical |

Reach is `v * (tEffectS - R)`; need is the slant to the credited point at `tEffectS`. A positive shortfall means the interceptor cannot be at the credited point when the effect is credited, under the same constant-speed model that produced the time.

Numerical error. The three passes are a fixed-point iteration with contraction `u/v` on a radial segment. The residual grows with that ratio: 0.29 gives 1.2 s, 0.43 gives 0.9 s, 0.93 gives 30 s. Closing iterates oscillate and the kept third pass credits the effect late and closer (Pk 0.490 against 0.461 in the near-equal closing case); receding iterates climb and credit it early, with a small unreachable margin (28 m). DT quantization does not enter the solver; only the window end is on the grid. Path clamping is not an error source: once the target holds at its last point the iteration is exact. There is no universal DT bound; the residual exceeds one DT whenever `u/v` is above about 0.3.

Physical model discrepancy. Three cases have no intercept inside the envelope under the model itself: a receding target faster than the interceptor, a near-equal receding target whose solution lies 6 km past the envelope, and a slower receding target whose solution lies 7 km past a short envelope. The cap catches two of them, because the third pass happens to exceed the window end, and misses the near-equal case, because the third pass (45.8 s) lands inside the 146 s window. That event is credited at 55.85 s with Pk 0.438 and no flag, 921 m beyond the interceptor's reach. A cap does not make an intercept feasible; it only changes where an infeasible one is credited.

Current behavior on the infeasible receding case, observed through [`resolveEngagements`](../../../src/playback/attrition.ts#L195). Legacy pass: one event at `tS` 0, `tEffectS` 29.5, `pk` 0.35144375, `killDelta` 0.35144375, `flightCapped: true`; the threat reports `expectedKills` 0.35144375 and `expectedNoArrival` 0.64855625; the effector spends its one round. Doctrine pass: the same credit from an assignment at `tS` 24, a 5.5 s flight and a reach of 300 m against 3961.5 m; the doctrine deadline at [attrition.ts:672](../../../src/playback/attrition.ts#L672) reads the capped flight, which is why a shot that late is admitted. The flag is set at [attrition.ts:416](../../../src/playback/attrition.ts#L416) and typed at [attritionReport.ts:156](../../../src/playback/attritionReport.ts#L156); `git grep flightCapped src` outside tests finds only those two files. No panel reads it: the [event ledger](../../../src/panels/analysis/widgets/EventLedgerWidget.tsx#L40) shows release, effect, Pk and kill mass. The run export ([persist.ts:314](../../../src/io/persist.ts#L306)) carries the raw `AttritionReport`, so the flag rides in the JSON when present, but [runResultGroups.ts:58](../../../src/io/runResultGroups.ts#L58) documents no such field.

Firing fixture ([onboarding-2026-09-04/firing-scenario.json](../evidence/onboarding-2026-09-04/firing-scenario.json), deterministic): four Coyote events at 20, 122, 215.5 and 303 s, none capped, shortfalls -3.4, -1.5, -0.2 and +0.004 m (`u/v` = 0.11, so three passes converge). The closed-form times differ by -0.038, -0.026, -0.020 and -0.021 s and the Pk by less than 1e-5. Any correction of the solver moves the fixture by less than 0.1 DT; any correction of the infeasible credit does not move it at all.
