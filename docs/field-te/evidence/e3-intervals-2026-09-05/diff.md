# E3 intervals before-and-after capture, 2026-09-05

Source change (`src/playback/mcRun.ts`, decisions R-D-39 to R-D-43): `statOf` takes the
statistic's kind. A 0/1 count (support {0, 1}: a one-ship threat's killed and leaked, a
one-track raid's detected, tracked and engaged, kills and leakers over a one-ship raid,
residual of a one-ship threat, per-effector kills over a one-ship raid) reports the Wilson
interval on k of n, and at 0 of n or n of n the rule-of-three bound, 3 / n from the observed
end. Any other count clamps the t-interval to [0, max] (max: ships for kills, leakers and
residual; tracks for detected, tracked and engaged; unbounded for salvos). A time keeps the
t-interval. `Stat.interval` names the method. `p10` and `p90` are NaN under 10 samples,
`p025` and `p975` under 40 (R-D-40). `McSummary.firmTrackS` is new: the earliest
`stableTrackAtS` over the tracks per replicate (R-D-43). `sensitivityLoop` keeps the
per-replicate end-of-run leakers and each row carries `se`, the paired standard error of
`high - low` (R-D-42). No draw site, key, `DT`, CRN pairing, raid partition, sampler or
persistence changed. `PF_SPREAD.sizePenalty` and `evasionPenalty` are removed (R-D-37);
neither was enumerated or sampled, so no draw changes.

Probe: the body of `r1-leaf-2026-09-05/parity-probe.ts.txt` (assessments, deterministic
report, aleatory MC, total MC, sensitivity; `replicates: 4`) on the firing fixture
(`onboarding-2026-09-04/firing-scenario.json`), run as a scratch vitest file
`src/playback/e3.capture.test.ts`, deleted after. `numerical-before.json` reproduces
byte-identically on the tree before the change and is a copy of
`r1-leaf-2026-09-05/numerical-baseline.json`. `numerical-after.json` was produced twice and
compared with `cmp`; it is byte-stable and is the parity baseline for later refactors.

## What is identical

`assessments` and `report` (byte-identical). Every `mean`, `sd`, `se`, `n`, `total`,
`defined` and `conf` of every Stat, every band `mean`, `seed`, `replicates`, `stopped`,
`durationS`, `arrivalS`, `shipCount`, under `aleatory` and `total`. The sensitivity
`nominal`, `low`, `high` and `swing` of all 13 rows.

## What changed

| Leaf | Before | After | Rule |
| --- | --- | --- | --- |
| `Stat.interval` (new) | absent | `t`, `wilson` or `rule-of-three` | R-D-39 |
| one-ship `killed`, 4 of 4 kills | lo 1, hi 1 | lo 0.25, hi 1 | rule of three, 1 - 3 / 4 |
| one-ship `leaked`, 0 of 4 | lo 0, hi 0 | lo 0, hi 0.75 | rule of three, 3 / 4 |
| `kills` band step 225, mean 0.5 (2 of 4) | lo -0.419, hi 1.419 | lo 0.150, hi 0.850 | Wilson(2, 4) |
| `kills.lo` under 0 (776 aleatory steps, 768 total) | negative | at or above 0 | Wilson or clamp |
| `residual.hi` over 1 (776 aleatory steps, 768 total) | above the ship count | at most 1 | same |
| every `p10`, `p90`, `p025`, `p975` | type-7 quantile of 4 samples | NaN (JSON null) | R-D-40, n 4 under 10 |
| `firmTrackS` (new) | absent | mean 1.5 s, 4 of 4 defined, both modes | R-D-43 |
| `sensitivity.rows[].se` (new) | absent | 0 on every row (no row moves a leaker on this fixture at 4 replicates) | R-D-42 |

The direction is the statistical one: no interval leaves the support of a count, a
constant 0/1 sample no longer claims a zero-width interval, and a quantile is not
interpolated from four samples. Intervals on times are unchanged.

## Browser check

Dev server on port 5347, Playwright probes `e3-probe.mjs.txt` and
`e3-inspector-probe.mjs.txt`, detection fixture through `parseAutosave` and `loadScenario`,
real worker runs, no page errors (`browser-results.json`). `analysis-iads-30-total.png`:
30 replicates total, the First detect and Min warning tiles read "first single-scan hit",
the 95 percent mean CI at n 30 and the defined fraction 30 of 30 with its Wilson interval
89% to 100%; the Sensitivity table carries the SE column. `analysis-run-summary-10.png`:
10 replicates, count tiles read their interval as two ends (Detect 0.7 to 1, Kill E[k] 0 to
0.3), the time tiles withhold the mean CI under 30 defined, and the time-series note reads
"95% band unavailable under 40 replicates". `inspector-mavic3.png`: the Kinetic size
factor tag title is "planning factor" with no spread.
