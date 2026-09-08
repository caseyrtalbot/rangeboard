# R0 browser and performance baseline, 2026-09-07

Date 2026-09-07. Branch `main`, commit `5076ecc16edb7bfa6c1260d1d82ff7fb1dad88d9`.
Status: captured. The Codex lane wrote and syntax-checked both scripts but its sandbox
refused the Chromium launch and the port bind. The orchestrator session ran the same scripts
unchanged outside that sandbox and produced every file in this record.

## Harness and fixture

Playwright 1.62.1 with Chromium headless shell 151.0.7922.34. Viewport 1400 by 900, right
panel width 320 through `rangeboard.rightpanel.width` in an isolated context init script.
Node v22.23.1. Dev server on `localhost:5391`; production static server on `127.0.0.1:5392`.
Port 5174 and the user's autosave were not touched.

Fixture: [firing-scenario.json](../onboarding-2026-09-04/firing-scenario.json), copied
unchanged to `/private/tmp/r0-perf/scenario.json`. It is one Mavic 3 against a routed KuRFS
and Coyote laydown with an audit asset. The 2026-09-06 performance fixture was the larger
Layered laydown, so the two phase tables are not comparable to each other. R5 compares
against this table only, on this fixture.

## Commands

```sh
cd /Users/caseytalbot/Projects/rangeboard
mkdir -p /private/tmp/r0-perf
cp docs/field-te/evidence/r0-playback-realism-2026-09-07/profile.mjs.txt /private/tmp/r0-perf/profile.mjs
cp docs/field-te/evidence/r0-playback-realism-2026-09-07/browser-baseline.mjs.txt \
  /private/tmp/r0-perf/browser-baseline.mjs
cp docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json /private/tmp/r0-perf/scenario.json
npm run dev -- --port 5391 --strictPort
cd /private/tmp/r0-perf
node profile.mjs scenario.json http://localhost:5391 dev > profile-dev.txt 2>&1
node browser-baseline.mjs scenario.json http://localhost:5391
cd /Users/caseytalbot/Projects/rangeboard && npm run build
cd /private/tmp/r0-perf
SERVE_DIR=/Users/caseytalbot/Projects/rangeboard/dist node profile.mjs scenario.json \
  http://127.0.0.1:5392 prod > profile-prod.txt 2>&1
```

Raw output: [profile-dev.txt](profile-dev.txt), [profile-prod.txt](profile-prod.txt),
[browser-baseline.json](browser-baseline.json). Both profiles ended with
`page errors/warnings: []`. The build passed with the existing chunk-size warning
(entry chunk 814.47 kB, warning limit 810 kB); no source was changed.

## Paired phase table

Script milliseconds per phase from the CDP profile, except the first row, which is wall
milliseconds from navigation to the first Konva canvas. `n/a` marks store-driven phases
the production build cannot run because it has no `window.__store`.

| Phase | Dev | Prod | Note |
| --- | ---: | ---: | --- |
| Load to first canvas (wall) | 368 | 177 | Dev 180 resources, 11.7 MB; prod 18 files, 1.5 MB |
| Idle 3 s | 7 | 5 | |
| Playback 5 s at 1x | 432 | 137 | Zero long tasks in both builds; max frame 17 ms dev, 9 ms prod |
| Playback 5 s at 8x | 412 | n/a | Dev only in this harness |
| Zoom, 30 wheel events | 142 | 43 | |
| Pan drag, 40 moves | 33 | 19 | |
| moveEntity, 20 edits | 235 | n/a | |
| Select and clear, 10 cycles | 152 | n/a | |
| Right tabs, 3 cycles | 67 | n/a | |
| Lifecycle phases, 3 cycles | 355 | 200 | Dev: 3 long tasks, max 70 ms; prod: none |
| Library drawer, 3 toggles | 72 | 11 | |
| Undo and redo, 5 steps | 106 | n/a | |

First-play long task: none at or above the 50 ms Long Tasks threshold in either build.
The plan's 40 ms target is below that threshold, so R5 needs the phase CPU profile or a
tighter tracer to prove it; this row proves only the absence of a 50 ms task.
Preparation latency does not exist yet; the trial worker is R4 work.

## Deterministic events in the fixture

`engagementPicture(scenario).report.events` at the current source, seconds:

| Event | Assignment `tS` | Effect `tEffectS` | `killDelta` |
| --- | ---: | ---: | ---: |
| 1 | 20.0 | 111.67 | 0.534 |
| 2 | 122.0 | 205.23 | 0.256 |
| 3 | 215.5 | 292.89 | 0.118 |
| 4 | 303.0 | 378.96 | 0.052 |

Threat arrival at the asset is T+7:55; run end is T+8:20. The four captures are
`before-play.png` (ready, T+0), `paused-t30.png` (paused after real 1x playback, cursor
30.0 s, observed through 30.039 s), `scrub-forward.png` (cursor 379.96 s, observed horizon
unchanged) and `scrub-back.png` (cursor 30 s again).

## Surfaces that show outcomes later than the observed horizon

All rows are the paused capture at T+30 unless stated. The first modeled effect is T+1:52.

| Surface | Text seen | Time exposed |
| --- | --- | --- |
| Event strip tooltip | `win 0:20–8:20 · shot 0:20 · arr 7:55` | Window end 8:20, arrival 7:55 |
| Event strip bar | Window bar drawn from 0:20 to the 8:00 tick | Full engagement window |
| Time series widget | `Expected kills · MC mean` curve to the `ARR` marker | Full run to 8:20 |
| Projection widget | `Defeat 96.7%`, `First effect 1:51`, `Min warning 7:54` | Labeled full run |
| Selected threat telemetry | `Salvos 1 kinetic · 1 inbound`, `Arrival (full path) T+7:55`, `CPA (full path) T+8:20`, `Warning (full path) 7:55`, `Engage status (full run) engageable` | Full path and full run |
| Selected threat survival chart | MC mean survival with `FX` and `ARR` markers | Full run |
| KPI tiles | `Track now 0.8/1 MC mean · n=30`, `Kill E[k] 0 MC mean` | Cursor-scoped values on an ensemble basis, not a trial |
| Scrub forward to T+6:20 | Compact readout `DEFEATED`; telemetry `DEFEATED track at T+6:18 by hard kill`; `Kill E[k] 0.9`; run label `Preview · cursor only · observed through 0:30` | Effects at 1:52, 3:25, 4:53, 6:19 shown past the 0:30 horizon |
| Scrub back to T+30 | Readout returns to `ENGAGED`, `Kill E[k] 0`; run label `Replay` | Restored |

The Projection and Run validity widgets label themselves `full run · not live`. The
telemetry rows label themselves `(full path)` or `(full run)`. The strip tooltip and the
forward scrub carry no such label. R2 owns the horizon; R1 owns the wording.

## Evidence gaps

- This is the default Execute layout only, not the full acceptance case 4 matrix of
  every lens, saved layout, axis domain and frame navigation.
- Hover text was read from the event strip plot at one x position. Other strip hover
  positions and chart tooltips were not sampled.
- Reduced motion, keyboard operation and the 1280 by 800 viewport were not captured.
- The first-play sub-50 ms task cost is not isolated from the 5 s playback script total.
