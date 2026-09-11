# Phase 3 estimate-path comparison

The protected truth-path fixtures retain their eight fallback switches and did not move.
This comparison is the deliberate recapture of `src/playback/estimate.parity.test.ts`
with those switches removed, after all six Phase 3 physical models were integrated.
Seed: 4821. Monte Carlo: 200 aleatory replicates.

## JIATF-401 detection fixture

| Measure | Phase 2 gate | Phase 3 gate |
| --- | ---: | ---: |
| First detection, s | 1 | 1 |
| Stable track, s | 509.5 | 505 |
| Hostile declaration / gate, s | 547.5 | 548 |
| Events | 2 | 2 |
| Successful-intercept mass | 1 | 0 |
| Captured track estimates | 3,173 | 3,168 |
| MC mean leakers | 0.06 | 1 |
| MC mean kills | 0.94 | 0 |
| MC mean firm-track time, s | 509.575 | 505.0625 |

The RF model leaves the initial one-second detection unchanged. Radar dwell and the RF
estimate path move firm-track timing. The interceptor's physical miss-radius calculation
combines prediction and guidance error and produces no successful intercept in this fixed
trial or ensemble; the prior curve credited nearly one.

## Layered acoustic/MEROPS fixture

| Threat | Phase 2 status / first detect / confirm / stable / declare | Phase 3 status / first detect / confirm / stable / declare |
| --- | --- | --- |
| `2q` | engageable / 196 / 942.5 / 785.5 / 795.5 | no stable track / 1177.5 / null / null / null |
| `2s` | engageable / 236.5 / 1062.5 / 903 / 913 | no stable track / 986.5 / null / null / null |
| `2u` | no path / null / null / null / null | no path / null / null / null / null |
| `2v` | engageable / 15.5 / 699 / 352 / 362 | no stable track / 24.5 / null / null / null |
| Six Mavic targets | engageable / 0.5 / 72-85.5 / 1.5 / 11.5 | engageable / 0.5 / 0.5 / 1.5 / 6.5 |

| Aggregate | Phase 2 gate | Phase 3 gate |
| --- | ---: | ---: |
| Events | 25 | 16 |
| Successful-intercept mass | 6 | 0 |
| Captured track estimates | 25,157 | 14,192 |
| MC mean leakers | 2.12 | 0 |
| MC mean kills | 6.88 | 0.005 |
| MC mean firm-track time, s | 1.5 | 1.5 |

The passive-RF link budget shortens several placard-range detections, so three FPV-class
threats no longer reach a stable track before their paths end. EO/IR DRI recognizes the
six Mavic targets at first detection and advances their declaration. Bounded flight,
including acceleration and wind drift, changes whether paths cross the defended arrival
area. The zero leaker mean therefore does **not** show improved defeat: almost every target
is categorized as no-arrival while the kill mean falls from 6.88 to 0.005. The lower track
count follows the later or absent holds and the changed flight horizon.

These values are regression anchors for the integrated default physical path. They are
not field validation of the combined laydown.
