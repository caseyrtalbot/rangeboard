# E3 follow-ups before-and-after capture, 2026-09-05

Source change (`src/playback/mcRun.ts`, register R-F-41 and R-F-42). `intervalOf`: a count
with a finite support maximum that samples 0 of n reports the rule-of-three upper bound
3 max / n on its mean, with no independence assumed between ships (or tracks), and at n of n
the mirror max - 3 max / n; the mirror is the default taken, consistent with the R-D-39
mirror on a 0/1 count. At max 1 both are the R-D-39 bounds 3 / n, so every 0/1 result is
unchanged. An unbounded count (salvos, max Infinity) keeps its clamped t-interval, zero
width when every sample is 0. The label stays `rule-of-three`: one definition per fact, and
`countSub` already prints a rule-of-three result as its two ends. `halfWidthOf(values, ships)`
now goes through `statOf(values, count(ships))`, the leakers Stat's own path and support
(`raidSizeOf`), so the stopping rule tests the half-width of the displayed interval. The
STOP_FIRST 30 and STOP_EVERY 10 cadence is unchanged. No draw site, key, `DT`, CRN pairing,
raid partition, sampler or persistence changed.

Probe: `e3b-capture.ts.txt`, run as the scratch vitest file `src/playback/e3b.capture.test.ts`
and deleted after. Its first test is the body of `r1-leaf-2026-09-05/parity-probe.ts.txt`
(assessments, deterministic report, aleatory MC, total MC, sensitivity; `replicates: 4`) on
the firing fixture (`onboarding-2026-09-04/firing-scenario.json`), written to
`numerical-before.json` on the unchanged tree and `numerical-after.json` on the changed tree.
Its second test writes `stop-before.json` and `stop-after.json`: the firing fixture at
`replicates: 200`, `targetHalfWidth: 0.04`, aleatory (`firingStop`) and total
(`firingStopTotal`), and the layered fixture (`src/playback/__fixtures__/layered-acoustic-merops.json`
through `fillScenario`, seed 7, 30 replicates, aleatory; 9 tracks, 9 ships, 10 effectors).
Each file was produced twice and compared with `cmp`; all four are byte-stable.
`numerical-before.json` is byte-identical to `e3-intervals-2026-09-05/numerical-after.json`
(`cmp`).

## What is identical

`numerical-before.json` and `numerical-after.json` are byte-identical: the firing fixture is
a one-ship raid with one track, so every count is 0/1 and R-F-41 changes nothing, and the
fixture has no stop target. `numerical-after.json` stays the parity baseline for later
refactors. `firingStopTotal` is byte-identical: both rules stop at 150 (leakers 0.06,
Wilson 0.032 to 0.110, half-width 0.039 under the 0.04 target). In `layered`, every `mean`,
`sd`, `se`, `n`, `total`, `defined`, quantile, `stopped` (`replicates` at 30), `seed`,
`durationS`, `shipCount`, and every salvos Stat; every `lo` and `hi` of a count that is
neither 0 of n nor n of n.

## What changed

| Leaf | Before | After | Rule |
| --- | --- | --- | --- |
| `firingStop.stopped.at` (aleatory, target 0.04) | 30 | 40 | R-F-42: leakers 0 of n every replicate; t half-width 0 at 30 stopped at once; the displayed rule-of-three half-width 1.5 / n is 0.05 at 30 and 0.0375 at 40 |
| `firingStop.leakers.hi` at the last step | 0.1 (3 / 30) | 0.075 (3 / 40) | same |
| every other `firingStop` leaf that depends on n | at 30 | at 40 | the stopped n; each is the fixed-n summary at that n |
| `layered.kills.hi`, 169 all-zero steps | 0 | 0.9 (3 * 9 / 30) | R-F-41 over 9 ships |
| `layered.leakers.hi`, 482 all-zero steps | 0 | 0.9 | same |
| `layered.perEffector[*].kills` on the 5 effectors with no kill | lo 0, hi 0, `t` | lo 0, hi 0.9, `rule-of-three` | same |
| `layered.detected.hi` (1 step), `tracked.hi` (2), `engaged.hi` (49), all-zero steps | 0 | 0.9 (3 * 9 / 30) | R-F-41 over 9 tracks |
| `layered.detected.lo` (1767 steps) and `engaged.lo` (533), 9 of 9 tracks | 9 | 8.1 (9 - 0.9) | R-F-41 mirror |
| `layered.perEffector[*].salvos` on the 5 effectors with no salvo | lo 0, hi 0, `t` | lo 0, hi 0, `t` | unbounded count, unchanged |

The direction is the statistical one: a constant count over more than one ship no longer
claims a zero-width interval, the bound is the 3 max / n upper bound and its mirror, and a
run with a target half-width stops on the interval the tile shows. Intervals on times and on
0/1 counts are unchanged.

## Browser check

No panel file changed; `countSub` prints the new bound as its two ends through the existing
copy. No browser check.
