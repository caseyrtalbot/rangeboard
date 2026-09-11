# Slice 3.0 stamps browser check, 2026-09-10

Dated capture for slice 3.0 (stamps) of the
[calibration implementation plan](../../../IMPLEMENTATION_PLAN.md). It records the two
visible stamps in a real browser. Measurements describe the lane branch `calib/p3-stamps`,
not the current tree.

## Method

Dev server on port 5386. The legacy firing board
[`firing-scenario.json`](../onboarding-2026-09-04/firing-scenario.json) was written to
`localStorage` under `rangeboard.scenario.v1` and the page reloaded, so the board reached
the app through `restoreAutosave` and `fillScenario`. That save predates the Phase 2 seed
keys and carries no `c2` block on FAAD C2, so the reconcile adopts. No physics switch is
set and `runMode` is `monte-carlo`, so the operator queue is active.

## Files

| File | Content |
| --- | --- |
| [`systems-notice-and-chips.png`](systems-notice-and-chips.png) | Settings, Systems tab: the load notice over the field table, and a `seed v2` chip beside each KuRFS value the load adopted |
| [`systems-tab-full.jpg`](systems-tab-full.jpg) | The same tab full frame, KuRFS and Giraffe 1X |
| [`run-progress-floor-stamp.png`](run-progress-floor-stamp.png) | The Run progress line after a stochastic run, with the operator floor stamp |
| [`outcome-floor-stamp.png`](outcome-floor-stamp.png) | The Analyze panel: the ensemble line and the completed trial's Outcome record, each with its own count |
| [`outcome-full.jpg`](outcome-full.jpg) | The same panel full frame at the completed horizon |

## What the check saw

Seed adoption stamp. The Systems tab printed `Load adopted 157 seed fields on 46 builtin
models from data package v2`. A `seed v2` chip sat beside `rangeAccuracyM`,
`azimuthAccuracyDeg`, `elevationAccuracyDeg` and `falseAlarmRatePerScan` on KuRFS and on
Giraffe 1X. No chip appeared on `detectRangeM`, `sectorDeg`, `resolutionM` or any other
field the save already held. The 46 models match the count the Phase 2 tip timing recorded
for the same board.

Operator floor stamp. The default run of 30 replicates reported
`30 of 30 replicates · stop on the replicate count · operator wait floored in 29 of 60
decisions`. Sixty is two decisions a replicate, the declare gate and the weapon
assignment, on the one threat-effector pair of this board. The stamp reproduced after a
reload and a second run.

The trial record carried its own count: with playback complete at T+8:20 the Outcome
record printed `operator wait floored in 1 of 2 decisions` under the tiles, beside a
defeated Mavic with first effect at T+3:25. The ensemble line and the trial line stood
together on one panel, which is the point of the stamp: Play and Run never differ in
timing without saying why.

Page errors: 0 over the session, across two page loads, two ensemble runs and one full
playback at 30x. The console carried only the Vite connect messages and the React DevTools
notice.
