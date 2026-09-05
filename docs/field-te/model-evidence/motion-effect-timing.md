# Motion and effect timing dossier

Status: E1 evidence baseline, 2026-09-05. Source tree `d8a76f1`; numerical source files unchanged by this lane. [Index and verification](README.md).

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
