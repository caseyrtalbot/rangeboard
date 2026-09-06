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

## After Wave 1

Same harness, same scenario, same viewport, captured 2026-09-06 on the Wave 1 tree (both lanes
integrated, the heading-handle bubble guard included; the commit is in the handoff ledger). Raw
output: `profile-dev-after.txt` and `profile-prod-after.txt`. Script milliseconds per phase.

| Phase | Dev before | Dev after | Prod before | Prod after |
| --- | ---: | ---: | ---: | ---: |
| Load to first canvas | 594 | 542 | 379 | 364 |
| Idle 3 s | 5 | 5 | 5 | 6 |
| Playback 5 s at 1x | 2387 | 2162 | 1285 | 1103 |
| Playback script share of wall time | 46 percent | 42 percent | 25 percent | 21 percent |
| First-play long task | 157 | 127 | 97 | 82 |
| Zoom, 30 wheel events | 750 | 703 | 197 | 169 |
| Pan drag, 40 moves | 116 | 91 | 78 | 70 |
| moveEntity, 20 edits | 2143 | 1710 | n/a | n/a |
| Select and clear, 10 cycles | 716 | 250 | n/a | n/a |
| Right tabs, 12 switches | 474 | 145 | n/a | n/a |
| Lifecycle phases, 9 switches | 815 | 540 | 287 | 245 |
| Library drawer, 6 toggles | 74 | 78 | 16 | 13 |
| Undo and redo, 10 steps | 371 | 358 | n/a | n/a |

Wave 1 acceptance, dev harness:

| Phase | Baseline | Target | Measured | Met |
| --- | ---: | ---: | ---: | --- |
| moveEntity per edit | 105 ms | 60 ms | 85 ms | no |
| Select and clear per change | 36 ms | 10 ms | 12.5 ms | no |
| Playback script share | 46 percent | 25 percent | 42 percent | no |
| Zoom per wheel event | 25 ms | 10 ms | 23 ms | no |
| Undo and redo per step | 37 ms | 15 ms | 36 ms | no |

Why the dev targets are out of reach for this scope: in every phase the largest self-time is
`exports.jsxDEV` in the React 19.2 development JSX runtime (444 of 703 ms on zoom, 224 of 358 ms
on undo and redo, 426 of 2162 ms on playback, 317 of 1710 ms on moveEntity). That function
constructs an `Error` and a `console.createTask` per element for owner stacks; the cost is per
React element created, and it does not exist in the production build. The Wave 1 scope removed
re-renders that were pure waste (the App-level cascade, the whole-`ui` and whole-`camera`
subscriptions, per-frame array literals, per-move store writes) and the phases those governed
moved most: right tabs 3.3 times faster, select and clear 2.9 times faster, lifecycle 1.5 times.
The remaining dev cost is the element count of a legitimate re-render: every layer on a zoom,
every scenario subscriber on an undo, the whole `LiveScene` on each of the 120 animation frames
per second during playback, and the deterministic engine on each edit. Those are the Wave 2
items (Layer split, timeline cache, first-play hitch, engine hot loop).

## Parity after Wave 1

`parity-after.json` is the same probe on the Wave 1 tree. `cmp` against `parity-before.json`
reports no difference: the `modelFor` index and the `sweepSensorHits` lookup changed no number.

## Browser check after Wave 1

`browser-check.mjs.txt` (run as `browser-check.mjs` against the dev server on port 5377, headless
Chromium, 1400 by 900, panel 320, this scenario) drives real pointer and keyboard input and
asserts store state. Results in `browser-check-after.json`: canvas click selects one entity;
an entity drag moves it with one undo entry; a heading-handle drag changes the heading with one
undo entry and no position change, and one undo restores it; Space plays and Space pauses; hover
while paused raises no error; wheel zoom raises `camera.scale`; `L` opens the drawer with focus in
its search field, Escape closes it and returns focus to the trigger, `L` from the canvas closes
it; the three lifecycle buttons switch `data-board-phase`; undo and redo keep the right tab.

The first run found a defect present at `955ad6b`: the heading handle's `dragend` bubbled to the
entity group, whose handler moved the entity to the handle's local coordinates and pushed a second
undo entry. The group now ignores any drag whose target is not itself.
