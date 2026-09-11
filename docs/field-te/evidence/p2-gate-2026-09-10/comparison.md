# Phase 2 timeline comparison, 2026-09-10

`before` is main at the contract commit 6e33ef2 (truth tracks, no false tracks, no operator queue).
`after` is the gate tree with the golden fixtures pinned to the three physics switches.
`after-estimate` is the same tree with the switches removed: Kalman estimate, fusion, false tracks and the operator queue on.
Monte Carlo rows: 200 replicates, seed 4821, aleatory, 4 workers. Trial rows: seed 4821, one replicate.
Rendered by `compare-timelines.mjs`; the timelines come from `capture-timeline.mjs`.

## Monte Carlo end-of-run means

| Fixture | Measure | before | after (pinned) | after-estimate |
| --- | --- | --- | --- | --- |
| detection-outside-rings | kills | 0.935 [0.892, 0.962] | 0.935 [0.892, 0.962] | 0.940 [0.898, 0.965] |
| detection-outside-rings | leakers | 0.065 [0.038, 0.108] | 0.065 [0.038, 0.108] | 0.060 [0.035, 0.102] |
| detection-outside-rings | detected | 1 [0.985, 1] | 1 [0.985, 1] | 1 [0.985, 1] |
| detection-outside-rings | tracked | 1 [0.985, 1] | 1 [0.985, 1] | 1 [0.985, 1] |
| detection-outside-rings | engaged | 1 [0.985, 1] | 1 [0.985, 1] | 1 [0.985, 1] |
| detection-outside-rings | firstDetectS | 2.013 [1.764, 2.261] | 2.013 [1.764, 2.261] | 2.013 [1.764, 2.261] |
| detection-outside-rings | firmTrackS | 509.575 [509.532, 509.618] | 509.575 [509.532, 509.618] | 509.575 [509.532, 509.618] |
| detection-outside-rings | minWarningS | 1472.987 [1472.739, 1473.236] | 1472.987 [1472.739, 1473.236] | 1472.987 [1472.739, 1473.236] |
| layered-acoustic-merops | kills | 7.010 [6.839, 7.181] | 7.010 [6.839, 7.181] | 6.880 [6.723, 7.037] |
| layered-acoustic-merops | leakers | 1.990 [1.819, 2.161] | 1.990 [1.819, 2.161] | 2.120 [1.963, 2.277] |
| layered-acoustic-merops | detected | 9 [8.865, 9] | 9 [8.865, 9] | 9 [8.865, 9] |
| layered-acoustic-merops | tracked | 0 [0, 0.135] | 0 [0, 0.135] | 0 [0, 0.135] |
| layered-acoustic-merops | engaged | 9 [8.865, 9] | 9 [8.865, 9] | 9 [8.865, 9] |
| layered-acoustic-merops | firstDetectS | 0.500 [0.500, 0.500] | 0.500 [0.500, 0.500] | 0.500 [0.500, 0.500] |
| layered-acoustic-merops | firmTrackS | 1.500 [1.500, 1.500] | 1.500 [1.500, 1.500] | 1.500 [1.500, 1.500] |
| layered-acoustic-merops | minWarningS | 240.500 [240.500, 240.500] | 240.500 [240.500, 240.500] | 240.500 [240.500, 240.500] |

## Trial timeline per threat, fields that differ in any column

| Fixture | Threat | Field | before | after (pinned) | after-estimate |
| --- | --- | --- | --- | --- | --- |
| layered-acoustic-merops | ent-mt5bofdd-2q | stableTrackAtS | 783.500 | 783.500 | 785.500 |
| layered-acoustic-merops | ent-mt5bofdd-2q | declaredHostileAtS | 793.500 | 793.500 | 795.500 |
| layered-acoustic-merops | ent-mt5bofdd-2q | engageGateS | 793.500 | 793.500 | 795.500 |

## Engagement events

| Fixture | before | after (pinned) | after-estimate |
| --- | --- | --- | --- |
| detection-outside-rings | 2 events, kill mass 1 | 2 events, kill mass 1 | 2 events, kill mass 1 |
| layered-acoustic-merops | 22 events, kill mass 7 | 22 events, kill mass 7 | 25 events, kill mass 6 |

Pinned path against before: 0 assessment field differences, 0 fixtures with a different engagement ledger, 0 fixtures with a different Monte Carlo summary.
Track estimates emitted in the trial: detection-outside-rings 3173 (estimate path), 3173 (pinned); layered-acoustic-merops 25157 (estimate path), 25157 (pinned).
