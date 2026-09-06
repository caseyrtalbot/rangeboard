# Performance baseline at 955ad6b, 2026-09-06

Capture date 2026-09-06. Commit `955ad6b` (branch `codex/board-workspace-ui`, one commit ahead of
`main`). The numbers in this directory describe `955ad6b` only. Later waves add their own
after-captures next to this file and record them in [the handoff](../../../HANDOFF.md).

## Harness

Headless Chromium (Playwright 1.62), 1400 by 900 viewport, saved right-panel width 320
(`rangeboard.rightpanel.width`). The scenario is the autosave `scenario.json`, "Layered
(Acoustic + MEROPS)": 54 entities (25 sensors, 10 effectors, 8 C2, 10 UAS, 1 asset), 9 paths,
39 connections, 8 raid waves. The script `profile.mjs.txt` (preserved with `.txt`; copy it back to
`profile.mjs` to run) writes the scenario into `localStorage` before load, then records a CDP CPU
profile, `longtask` entries, `requestAnimationFrame` gaps, store publications and renderer metrics
for each phase. Dev phases that drive `window.__store` are skipped on a production build, which
has no store hook.

Run commands, from a directory holding `profile.mjs` and `scenario.json`:

```sh
npm run dev -- --port 5377 --strictPort
node profile.mjs scenario.json http://localhost:5377 dev
```

```sh
npm run build
SERVE_DIR=<repo>/dist node profile.mjs scenario.json http://127.0.0.1:5378 prod
```

Raw output: `profile-dev.txt` and `profile-prod.txt`.

## Script milliseconds per phase at 955ad6b

| Phase | Dev | Prod | Note |
| --- | ---: | ---: | --- |
| Load to first canvas | 594 | 379 | Dev fetches 218 modules, 19.2 MB; prod 5 files, 2.3 MB |
| Idle 3 s | 5 | 5 | No idle churn |
| Playback 5 s at 1x | 2387 | 1285 | 46 percent of wall time in script (dev), 25 percent (prod); first-play long task 157 ms dev, 97 ms prod |
| Zoom, 30 wheel events | 750 | 197 | 25 ms per event dev, 6.6 ms prod |
| Pan drag, 40 moves | 116 | 78 | Konva native drag |
| moveEntity, 20 edits | 2143 | n/a | 20 long tasks of 105 ms; prod has no `window.__store` |
| Select and clear, 10 cycles | 716 | n/a | 36 ms per change |
| Right tabs, 12 switches | 474 | n/a | 40 ms per switch |
| Lifecycle phases, 9 switches | 815 | 287 | about 120 forced layouts per switch in both builds |
| Library drawer, 6 toggles | 74 | 16 | |
| Undo and redo, 10 steps | 371 | n/a | 37 ms each; engine cache held |

## Numerical parity baseline

`parity-before.json` is the fixed-ID engine capture at the `955ad6b` source (captured on tree
`11bbf25`, which differs from `955ad6b` only by documentation). `parity-capture.ts.txt` is the
probe, run as the scratch Vitest file `src/playback/perf.parity.capture.test.ts` and deleted
after. For each of the firing fixture
(`../onboarding-2026-09-04/firing-scenario.json`) and the detection fixture
(`src/playback/__fixtures__/detection-outside-rings.json`), loaded through `parseScenarioData`
with `replicates: 4` and the fixture's own seed and settings, it records the deterministic
assessments and report, aleatory MC, total MC and sensitivity. The file was produced twice and
compared with `cmp`; it is byte-stable. Wave 1 compares its after-capture against this file.
