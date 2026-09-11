# Phase 2 tip timing, 2026-09-10

Repo `/Users/caseytalbot/Projects/rangeboard` on main at `7c65ca1` ("Record the handoff review
for the Phase 2 gate"), working tree clean, read-only. Vite 8.2.1 dev server on port 5386,
started outside the sandbox. Chrome through the `claude-in-chrome` tools, window 1500x960,
viewport 1500x817, tab visible for the whole session. Machine: `navigator.hardwareConcurrency`
14, pool `mc.pool.workers` 8 in every run. Display refresh about 85 Hz; a bare rAF loop measured
85.7 fps before the first run, so no occlusion throttle applied.

Wall time is measured in the page from the store action to the terminal store state, so it
includes worker startup and the store round trip. `elapsedMs` is `mc.summary.elapsedMs`, the
pool's own clock. Runs used `window.__store.getState().runMonteCarlo()`, not the Run button.

Comparison baseline: `docs/field-te/evidence/p1-gate-2026-09-10/timing.txt`.

## Item 1: Run and Monte Carlo wall time

Fixtures loaded through `parseAutosave` from the Vite server, then `loadScenario`.

`detection-outside-rings.json`: 6 entities, duration 1500 s, seed 4821, `runMode`
'monte-carlo', `replicates` 30, `targetHalfWidth` null, `uncertainty` 'total'.
`layered-acoustic-merops.json`: 54 entities, duration 1321 s, no `runMode` key, no
`replicates` key (default 100), no `targetHalfWidth`, no `uncertainty` key.

All wall and elapsed numbers in ms.

| Fixture | Configuration | Wall 1 | Wall 2 | elapsedMs 1 | elapsedMs 2 | Replicates | Stop rule | Pool |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| detection | default, nothing touched, physics on | 371 | 374 | 173 | 172 | 30 | replicates | 8 |
| detection | targetHalfWidth 0.5, physics on | 487 | 459 | 216 | 196 | 60 | halfWidth | 8 |
| detection | 1000 reps, thw null, total, physics on | 2271 | 2279 | 849 | 844 | 1000 | replicates | 8 |
| detection | default, physics [] | 392 | 375 | 198 | 179 | 30 | replicates | 8 |
| detection | targetHalfWidth 0.5, physics [] | 496 | 508 | 228 | 236 | 60 | halfWidth | 8 |
| detection | 1000 reps, thw null, total, physics [] | 2800 | 2714 | 1297 | 1272 | 1000 | replicates | 8 |
| layered | default, nothing touched, physics on | 1969 | 1913 | 1261 | 1197 | 100 | replicates | 8 |
| layered | targetHalfWidth 0.5, physics on | 1146 | 1067 | 700 | 641 | 33 | halfWidth | 8 |
| layered | 1000 reps, thw null, total, physics on | 12830 | 12642 | 9250 | 9091 | 1000 | replicates | 8 |
| layered | default, physics [] | 2223 | 2192 | 1473 | 1444 | 100 | replicates | 8 |
| layered | targetHalfWidth 0.5, physics [] | 1210 | 1213 | 756 | 761 | 33 | halfWidth | 8 |
| layered | 1000 reps, thw null, total, physics [] | 15482 | 15804 | 11902 | 12256 | 1000 | replicates | 8 |

Two late recheck runs, taken after a page reload with console capture on, agree with the table:
detection 1000 reps physics on, wall 2383, elapsed 915, 1000 replicates; layered default,
wall 1885, elapsed 1198, 100 replicates.

Cost of removing the physics switches, on `elapsedMs` at equal replicate counts:

| Fixture | Configuration | physics on | physics [] | Ratio |
| --- | --- | --- | --- | --- |
| detection | 30 replicates | 173 / 172 | 198 / 179 | 1.09 |
| detection | 60 replicates (half-width) | 216 / 196 | 228 / 236 | 1.13 |
| detection | 1000 replicates | 849 / 844 | 1297 / 1272 | 1.52 |
| layered | 100 replicates | 1261 / 1197 | 1473 / 1444 | 1.19 |
| layered | 33 replicates (half-width) | 700 / 641 | 756 / 761 | 1.13 |
| layered | 1000 replicates | 9250 / 9091 | 11902 / 12256 | 1.31 |

### Watch (Play) trial, one per fixture

Speed 30x, the highest the UI offers. `prepMs` is `prepareTrial()` to `trial.status` 'ready'.
First frame is the first rAF callback after the play command; first publish is the first store
`playback.simTimeS` above zero.

| Fixture | Trial prep ms | First frame ms | First publish ms | Frames | fps | Total wall ms | Sim s covered |
| --- | --- | --- | --- | --- | --- | --- | --- |
| detection | 86 | 18.0 | 121.4 | 4259 | 85.0 | 50119 | 1500 |
| layered | 489 | 81.4 | 193.0 | 3706 | 83.9 | 44153 | 1321 |

Both runs reached `playback.phase` 'complete' at the full duration. Total wall time is the
clock, not the compute: 1500 s / 30 = 50.0 s and 1321 s / 30 = 44.0 s. The engine keeps up at
30x on both fixtures with no dropped-frame signature.

## Item 2: legacy board adoption against a current-seed board

Legacy board: `docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json`, 176427 bytes,
6 entities, duration 500 s, `runMode` 'monte-carlo', 90 library models, no `physics` key.

Current-seed board: the same JSON with `library` replaced by `initialLibrary()` from
`/src/model/libraryLifecycle.ts`, 139038 bytes, everything else identical. Verified that
`parseAutosave` changes zero models on it, so no adoption runs.

Legacy + physics board: the legacy JSON with `physics: ['truthTracks','noFalseTracks',
'noOperatorQueue']`, library untouched, so adoption still runs.

| Board | Load ms x5 (parse + loadScenario) | Median | First frame ms | fps | Trial prep ms | Watch total ms | Models adopted |
| --- | --- | --- | --- | --- | --- | --- | --- |
| legacy (adoption) | 8.2, 6.8, 6.3, 5.5, 5.4 | 6.3 | 3.1 | 85.1 | 66 | 16736 | 46 |
| legacy + physics switches | 5.4, 5.0, 4.9, 4.6, 4.7 | 4.9 | 2.8 | 85.1 | 86 | 16739 | 46 |
| current seed (no adoption) | 8.4, 7.8, 7.9, 7.5, 7.6 | 7.8 | 3.4 | 85.1 | 85 | 16742 | 0 |

The three sets above ran as sequential blocks of five, so they carry a warm-up trend. A second
pass with the three boards interleaved, five rounds:

| Board | Load ms x5, interleaved | Median |
| --- | --- | --- |
| legacy (adoption) | 11.8, 6.0, 13.9, 4.1, 4.2 | 6.0 |
| legacy + physics switches | 7.9, 5.5, 5.5, 4.1, 4.1 | 5.5 |
| current seed (no adoption) | 12.5, 9.4, 23.3, 7.4, 7.6 | 9.4 |

Load time is dominated by `JSON.parse` of the file, not by adoption: `loadScenario` itself
measured 0.0 to 0.5 ms on every repeat of every board, and the current-seed board, which adopts
nothing, is not faster than the legacy board. Spread between repeats on one board (4.1 to 23.3
ms) exceeds the spread between boards, so the adoption cost is not resolvable at five repeats.

All three Watch runs produced exactly 1424 frames in about 16.74 s at 30x and the same 85.1 fps.
Playback on this board is clock-bound, so first-frame latency (2.8 to 3.4 ms) is the only
playback figure that separates the boards, and the three are inside each other's noise.

### Models the adoption changed

46 of the 90 library models, all builtin, no seed rows appended, no model removed:

| Count | Kind | Keys gained |
| --- | --- | --- |
| 19 | sensor | rangeAccuracyM, azimuthAccuracyDeg, elevationAccuracyDeg, falseAlarmRatePerScan |
| 19 | sensor | rangeAccuracyM, azimuthAccuracyDeg, elevationAccuracyDeg |
| 8 | c2 | whole `c2` block: decisionLatencyS, decisionLatencySigmaDb, operatorTrackCapacity |

The 19 radars gain the false-alarm rate; the other 19 sensors have no `falseAlarmRatePerScan` in
the seed, so they gain only the three accuracy fields. The 8 C2 models, FAAD C2 among them, had
no `c2` spec block in the save and adopt the seed's whole block. Adopted sensor ids include
lib-rps42, lib-rps62, lib-kurfs, lib-echoshield, lib-lstar, lib-tpq53, lib-iris, lib-r8ss.

## Console errors

Zero. `window.onerror` and `unhandledrejection` handlers were installed before every measured run
and collected nothing. The MCP console reader was attached late in the session; over the two
recheck Monte Carlo runs after attachment it reported 3 messages, all Vite or React DevTools
notices, and no error or exception.

## What did not work, and deviations

1. Both fixtures ship `targetHalfWidth` null, so the untouched default run uses the
   replicate-count stop rule (30 on detection, 100 on layered), not the half-width rule the
   brief names. The untouched run is reported as-is, and a `targetHalfWidth` 0.5 row was added
   for each fixture so the Phase 1 default-run line has a comparable number.
2. `layered-acoustic-merops.json` has no `runMode` key, so `runSettings` reads 'deterministic'
   and `runMonteCarlo()` is a no-op on it. Every layered row sets `runMode: 'monte-carlo'` on
   the parsed scenario before `loadScenario`. Nothing else on that fixture was touched.
3. Playback runs in real time. Durations are 1500 s (detection), 1321 s (layered) and 500 s
   (both legacy boards and the current-seed board), so a Watch run at speed 1 would take 25, 22
   and 8 minutes. Every Watch run used `speedMult` 30, the highest value the timeline offers.
   Total trial time is therefore duration / 30, and fps is the rAF rate, which the speed does
   not change.
4. Neither `TrialResult` nor the `trial` slice carries an `elapsedMs`. The trial worker figure
   is the wall time from `prepareTrial()` to `trial.status` 'ready', measured in the page.
5. Mid-session, three consecutive `javascript_tool` calls and one screenshot failed with
   "Cannot access a chrome-extension:// URL of different extension" while `tabs_context_mcp`
   still listed the tab as selected and healthy. A `navigate` to the same URL cleared it. The
   reload destroyed the in-page harness, which was reinstalled; no measurement was lost, since
   the detection Monte Carlo rows were already recorded.
6. `javascript_tool` fails a call with "CDP sendCommand Runtime.evaluate timed out after
   45000ms" when the evaluated code runs longer than 45 s, although the page keeps running and
   the result lands. Watch runs longer than 45 s were started fire-and-forget into a page global
   and polled.
