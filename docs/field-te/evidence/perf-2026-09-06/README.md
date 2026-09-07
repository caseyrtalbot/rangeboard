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

## After Wave 2

Same harness, same scenario, same viewport, captured 2026-09-06 on the Wave 2 tree (three lanes
integrated: the Layer split and per-frame memo work, the engine hot loop and the presentation
variant, the recharts grid fix and the panel memo work). Raw output: `profile-dev-wave2.txt` and
`profile-prod-wave2.txt`. Script milliseconds per phase.

| Phase | Dev after Wave 1 | Dev after Wave 2 | Prod after Wave 1 | Prod after Wave 2 |
| --- | ---: | ---: | ---: | ---: |
| Load to first canvas | 542 | 450 | 364 | 326 |
| Idle 3 s | 5 | 5 | 6 | 6 |
| Playback 5 s at 1x | 2162 | 1385 | 1103 | 583 |
| Playback script share of wall time | 42 percent | 28 percent | 21 percent | 12 percent |
| First-play long task | 127 | none | 82 | none |
| Zoom, 30 wheel events | 703 | 450 | 169 | 117 |
| Pan drag, 40 moves | 91 | 82 | 70 | 69 |
| moveEntity, 20 edits | 1710 | 1339 | n/a | n/a |
| Select and clear, 10 cycles | 250 | 204 | n/a | n/a |
| Right tabs, 12 switches | 145 | 93 | n/a | n/a |
| Lifecycle phases, 9 switches | 540 | 503 | 245 | 239 |
| Lifecycle forced layouts, 9 switches | 1091 | 33 | about 1080 | 34 |
| Library drawer, 6 toggles | 78 | 72 | 13 | 16 |
| Undo and redo, 10 steps | 358 | 271 | n/a | n/a |

Wave 2 acceptance, dev harness, with the prod number beside it where the prod harness has the phase:

| Phase | After Wave 1 | Target | Measured | Met | Prod |
| --- | ---: | ---: | ---: | --- | ---: |
| Playback script share | 42 percent | 15 percent | 28 percent | no | 12 percent |
| First-play long task | 127 ms | 40 ms | none (no long task in the phase, browser check `firstPlay` empty) | yes | none |
| Phase switch forced layouts | about 120 per switch | 20 | 3.7 per switch; 15 on the first Analyze mount (browser check) | yes | 3.8 |
| moveEntity per edit | 85 ms | 40 ms | 67 ms | no | n/a |
| Select and clear per change | 12.5 ms | 10 ms | 10.2 ms (lane runs on the same tree: 6.2 to 10.5) | no | n/a |
| Zoom per wheel event | 23 ms | 10 ms | 15 ms | no | 3.9 ms |
| Undo and redo per step | 36 ms | 15 ms | 27 ms | no | n/a |

Engine share in Node, harness scenario, mean of 20 after 2 warm-ups: `assessAllThreats` 98.4 to
51.8 ms, `resolveEngagements` 12.4 to 12.8 ms, `engagementPicture` 110.8 to 64.6 ms. The
first-play hitch is gone because the Play stamp no longer replaces the engine identity
(`markPresentationVariant`, `engineKeyOf`) and a stamp that already matches replaces nothing. The
phase-switch layouts were recharts `CartesianGrid` measuring the label of every data row of the
hidden vertical grid (1071 rows at DT) with `getBoundingClientRect` on the first Analyze mount;
an explicit empty coordinate generator removes them.

Why four dev targets stay open: as after Wave 1, the largest self-time in every open phase is the
React 19.2 development JSX runtime, which builds an `Error` and a `console.createTask` per element
and is absent in production. Playback now creates elements for the ten flying formations only
(their wrapper Group, member Groups, WEZ ring and callout, about 130 elements and 220 Konva
attribute sets per frame at 120 frames per second); the at-rest nodes, rings and paths no longer
render on a frame, and the static Layer draws zero times during playback (Konva draw probe:
static Layer 0, live Layer 180 over 3 s). Zoom re-renders the 54 counter-scale wrappers, the WEZ
rings, the grid and the tiles, about 550 elements. Undo and redo split between react-konva
(26 ms per 10 steps), react-dom (50 ms) and the shared JSX runtime (161 ms). moveEntity is the
engine (65 ms per picture in Node) plus the same scenario-swap render as undo. The next cut in dev
needs imperative Konva position updates outside render, which the "derived at render" invariant
forbids; the prod numbers (playback 12 percent, zoom 3.9 ms per event, no long tasks in any phase)
are the user-facing ones.

## Parity after Wave 2

The same probe on the integrated Wave 2 tree (`PARITY_TAG=wave2`): `cmp` against
`parity-before.json` reports no difference, so the hoisted sweep terms, the one-pass scan record,
the shared policy and the presentation variant changed no number. The identical capture is not
kept as a third copy.

## Memory after Wave 2

CDP heap usage after a forced collection, harness scenario, 30 `moveEntity` edits (`past` 2 to
32). Lane measurement at the Wave 1 tree: 30.9 to 56.9 MB, of which 20.4 MB was held by `past`
through `pictureCache` (about 0.68 MB per picture). After the bound of eight retained pictures and
the timeline cache keyed on the picture's assessments array: 39.9 to 44.6 MB in the browser check
(`heapAfterEdits`), 0.16 MB per edit.

## Browser check after Wave 2

`browser-check.mjs.txt` now also records the long tasks of the first Space press (`firstPlay`,
target 40 ms), the forced layouts of one Prepare to Analyze switch and back (`phaseLayouts`, target
20), and the heap after 30 `moveEntity` edits (`heapAfterEdits`). Results in
`browser-check-wave2.json`: every Wave 1 assertion still holds, `firstPlay` saw no long task,
`phaseLayouts` 15 and 1, heap growth 4.7 MB, no page errors.

## After Wave 3

Same harness, same scenario, same viewport, captured 2026-09-06 on the integrated Wave 3 tree:
the bundle and startup lane (lazy Ops workspace, lazy recharts plot, deferred T&E restore,
JSON-emitted runtime schema, on-demand T&E seed tables, lazy right-panel tabs and palette, font
preload and subset) plus the open-target change set of the same session (per-threat assessment
memo, identity lending for tracks, spoke ids and sweep parts, pixel-snapped callout geometry,
memo wrappers on the static layers). Raw output: `profile-dev-wave3.txt` and
`profile-prod-wave3.txt`. Script milliseconds per phase.

| Phase | Dev after Wave 2 | Dev after Wave 3 | Prod after Wave 2 | Prod after Wave 3 |
| --- | ---: | ---: | ---: | ---: |
| Load to first canvas | 450 | 419 | 326 | 280 |
| Load transfer, KB | 19351 (220 files) | 11668 (174 files) | 2333 (5 files) | 1443 (13 files) |
| Idle 3 s | 5 | 6 | 6 | 5 |
| Playback 5 s at 1x | 1385 | 842 | 583 | 461 |
| Playback script share of wall time | 28 percent | 17 percent | 12 percent | 9 percent |
| First-play long task | none | none | none | none |
| Zoom, 30 wheel events | 450 | 407 | 117 | 124 |
| Pan drag, 40 moves | 82 | 76 | 69 | 67 |
| moveEntity, 20 edits | 1339 (20 long tasks, max 82 ms) | 426 (no long task) | n/a | n/a |
| Select and clear, 10 cycles | 204 | 210 | n/a | n/a |
| Right tabs, 12 switches | 93 | 105 | n/a | n/a |
| Lifecycle phases, 9 switches | 503 | 478 | 239 | 230 |
| Lifecycle forced layouts, 9 switches | 33 | 31 | 34 | 32 |
| Library drawer, 6 toggles | 72 | 77 | 16 | 16 |
| Undo and redo, 10 steps | 271 | 146 | n/a | n/a |

### Bundle after Wave 3

Vite's gzip figure for the entry chunk (`index-*.js`) after each lane item, all at the same
tree; the baseline is `dc4eaae`.

| After | Entry chunk gzip, kB | Note |
| --- | ---: | --- |
| Baseline `dc4eaae` | 606.41 | one JS file, no code splitting, one chunk-size warning |
| 1 Ops workspace lazy | 493.11 | |
| 2 recharts plot lazy | 379.85 | |
| 3 T&E autosave split | 379.89 | startup work, not bytes |
| 4 runtime schema as `JSON.parse` | 380.23 | construction cost, not bytes |
| 5 T&E seed tables on demand | 368.13 | |
| 6 right-panel tabs and palette lazy | 244.43 | shared code splits into preloaded chunks from here |
| 7 fonts | 244.43 | no JS change |
| 8 chunk warning limit | 244.39 | |
| Integrated tree | 245.75 | Ladder and Tornado kept synchronous (plain SVG, no recharts) |

From item 6 the entry chunk alone understates the load: rolldown moves shared code into chunks
that `index.html` preloads. Final chunk inventory, `gzip -9` bytes in kB, from the built
`dist/`. Initial (entry plus `modulepreload`): index 242.6, uncertainty 84.1 (seedLibrary and
integrationData), kit 17.0, persist 9.7, jsx-runtime 4.5, empty 3.7, react-dom 1.4, persistTe
1.4, types 1.0: 365.2 kB of JS plus 13.6 kB of CSS. Lazy: OpsWorkspace 113.8, TimeSeriesChart
106.4 (recharts, d3, redux, es-toolkit, decimal.js-light: 349 sources, none left in the entry
chunk), mc.worker 37.3, cardTemplates 8.7, measureDictionary 6.3, vignettes 4.8, TestCardsPanel
2.9, AnalysisPanel 2.9, CommandPalette 1.7, aar 0.8. The build emits no warning.

Fonts: both JetBrains Mono faces subset to the Google Latin range plus the 30 non-ASCII code
points found in `src/**` and `index.html`, with every layout feature kept. Regular 92,164 to
35,788 bytes, Medium 93,824 to 36,648; the font payload 290,540 to 176,988. Archivo is left
whole (its scan found symbols outside Latin). The two 400-weight faces are preloaded from
`index.html`; the built page and the built CSS resolve to the same hashed files.

Not done, with the reason: `INTEGRATION_PROFILES` stays in the initial graph (`profileFor` is
a synchronous module-level lookup read by the engine and the worker graph; about 17 kB gzip,
now inside the preloaded uncertainty chunk); `checklistTemplates` stays (`templateByKey` runs
inside zustand `set` updaters; about 19 KB raw); `LibraryEditor` stays static
(`EntityWorkspace` imports it, so a boundary in `App` moves no bytes); a stored configuration
snapshot is kept verbatim at load and `parseConfigSnapshot` validates it at open, which has no
caller until the Wave 5 "Open on Board" seam.

### Wave 3 acceptance

| Criterion | Target | Measured | Met |
| --- | --- | --- | --- |
| Entry chunk gzip | 400 kB or less | 245.75 kB (initial set 365.2 kB plus 13.6 kB CSS) | yes |
| Build warnings | none | none | yes |
| Board and Ops load and switch | no page error | browser check `opsEntry`: mounted, returned, 0 errors | yes |
| Chart in every lens after the boundary resolves | one recharts surface per time-series widget | browser check `charts`: run-summary, sensors, effectors, threat 1 of 1; iads carries no time series | yes |
| Load to first canvas | dev 450 ms, prod 326 ms or less | dev 419, prod 280 | yes |
| PROJECT_GUIDE execution section | updated and reviewed | yes | yes |

### Open Wave 2 targets after the change set

The four open dev targets and the borderline fifth were handed to a debugger with one brief:
find a solution inside the invariants or show that none exists. Dev harness, integrated tree,
prod beside where the prod harness has the phase.

| Phase | After Wave 2 | Target | After Wave 3 | Met | Prod |
| --- | ---: | ---: | ---: | --- | ---: |
| Playback script share | 28 percent | 15 percent | 17 percent | no (dev); prod met | 9 percent |
| moveEntity per edit | 67 ms | 40 ms | 21 ms, no long task | yes | n/a |
| Zoom per wheel event | 15 ms | 10 ms | 13.6 ms | no (dev); prod met | 4.1 ms |
| Undo and redo per step | 27 ms | 15 ms | 14.6 ms | yes | n/a |
| Select and clear per change | 10.2 ms | 10 ms | 10.5 ms | no (dev) | n/a |

Attribution at the Wave 2 tree, dev, by CPU self-time charged to the nearest `src/` frame and
by React's own dev `performance.measure` per component render:

- Playback 5 s: JSX dev runtime 507 ms, reconciler 250, Konva 198, app 69. `Callout` and
  `CalloutLayer` owned 350 of the 507. React logged 39,307 component renders with changed
  props, 30,294 of them `Callout` (47 per frame), and 131,785 Konva attribute sets (203 per
  frame). Root cause: a cluster centroid drifts by about 0.0001 px per frame while one member
  flies, so `layoutLabels` produced new placement objects every frame (12,189 of 12,906
  placements changed identity over 260 commits) and `stablePlacements`, which compared exact
  floats, never reused. The spoke geometry now snaps to whole pixels: Callout renders 30,294 to
  12 per 5 s, attribute sets 131,785 to 9,627. Correction to the Wave 2 text above: playback
  created about 325 elements and 203 attribute sets per frame, not 130 and 220.
- moveEntity, 20 edits: engine 841 ms (assessThreat 212, detection 140, dist 100,
  resolveEngagements 87, geo 50), JSX runtime 272, react-dom 63. In Node, harness scenario:
  `assessAllThreats` 48.7 ms, `resolveEngagements` 13.8 ms. `engagementPicture` now assesses
  threats incrementally on a cache miss: a threat keeps the last run's assessment object while
  every input it reads is the same object (the scenario fields the sweep reads, the run
  duration, the threat, every asset, effector and C2 node, and every sensor whose technology
  gate admits the target and whose reach touches the flight path plus the formation spread).
  On the harness edit every threat reuses, so the engine share per edit is `resolveEngagements`
  plus the relevance scan: 93 plus 11 ms per 20 edits.
- Undo and redo, 10 steps: JSX runtime 141 (Callout 55, EntityGroup 19, FootprintLayer 13),
  react-dom 36, Konva 28. Closed by the same identity lending: tracks, spoke ids and the sweep's
  hits and effector states keep their objects across an edit that changed none of them, and
  `EntityGroup` takes the sweep's parts instead of the sweep.
- Zoom, 30 events: JSX runtime 197, Konva 48, reconciler 32. 157 of the remaining 222 JSX ms
  are the 51 spoke callouts, whose screen positions change on every zoom step by design (the
  layer inverts the stage transform); the other counter-scale wrappers cost 24 ms per 30 events.
- Select and clear: JSX runtime 86 ms, all in the Inspector mount (`App`, `EntityInspector`,
  `Row`, `Section`; 4,176 DOM fibers mounted per 10 cycles); the Konva side is 190 attribute
  sets per 20 commits.

What stays open in dev is the development JSX runtime cost of elements that really move on
each event: one element per moving entity, its Group, body and formation members in playback;
the spoke callouts on zoom. The next cut needs imperative Konva position and scale updates
outside render, which the "derived at render" invariant forbids. The prod numbers (playback 9
percent, zoom 4.1 ms per event, no long task in any phase) are the user-facing ones.

## Parity after Wave 3

The same probe on the integrated Wave 3 tree (`PARITY_TAG=wave3`): `cmp` against
`parity-before.json` reports no difference. The probe calls `assessAllThreats` directly; the
incremental path is covered by `src/analysis/impact.test.ts`, which compares
`engagementPicture` after eleven edit kinds (radar, effector, asset, C2 and threat moves, a
disabled sensor, environment, requirements, path speed, a dropped connection, ROE) with a fresh
`assessAllThreats` and expects byte-identical assessments. The identical capture is not kept.

## Memory after Wave 3

Browser check `heapAfterEdits` on the integrated tree: 4.6 MB over 30 `moveEntity` edits,
0.15 MB per edit (Wave 2: 4.7 MB).

## Browser check after Wave 3

`browser-check.mjs.txt` now also enters the Ops workspace through the T&E store and returns to
the Board (`opsEntry`: the lazy root mounts, no page error), applies each built-in lens in the
Analyze phase and asserts one `svg.recharts-surface` inside every time-series widget at the
saved panel width with no widget overflow (`charts`; the sensitivity widget draws only after a
worker run, so its presence is recorded), and creates a campaign, reloads, enters Ops and
expects the campaign back (`teRoundTrip`; the restore is deferred to idle or the first Ops
entry, and `beforeOps` records that idle had not fired when the canvas appeared). Results in
`browser-check-wave3.json`: every Wave 2 assertion still holds, `firstPlay` saw no long task,
`phaseLayouts` 17 and 1, heap growth 4.6 MB, all three new steps pass, no page errors.

## After Wave 4

Same harness, same scenario, same viewport, captured 2026-09-07 on the integrated Wave 4 tree
(the correctness and accessibility pass: Escape precedence, the calibrate strip, the placement
cancel keyed on entity and system-preset counts, the lens group, `role="application"` on the
canvas host, focus-on-open for the toolbar dropdowns, the shared `usePopover` and `nextTabIndex`
helpers, and the AnalysisPanel detail paths removed). Raw output: `profile-dev-wave4.txt` and
`profile-prod-wave4.txt`. Script milliseconds per phase. Wave 4 changed no engine, store or
playback code, so no parity capture was taken.

| Phase | Dev after Wave 3 | Dev after Wave 4 | Prod after Wave 3 | Prod after Wave 4 |
| --- | ---: | ---: | ---: | ---: |
| Load to first canvas | 419 | 432 | 280 | 271 |
| Playback 5 s at 1x | 842 | 808 | 461 | 452 |
| Playback script share of wall time | 17 percent | 16 percent | 9 percent | 9 percent |
| Zoom, 30 wheel events | 407 | 398 | 124 | 115 |
| Pan drag, 40 moves | 76 | 70 | 67 | 67 |
| moveEntity, 20 edits | 426 | 405 | n/a | n/a |
| Select and clear, 10 cycles | 210 | 192 | n/a | n/a |
| Right tabs, 12 switches | 105 | 106 | n/a | n/a |
| Lifecycle phases, 9 switches | 478 | 455 | 230 | 217 |
| Library drawer, 6 toggles | 77 | 69 | 16 | 15 |
| Undo and redo, 10 steps | 146 | 136 | n/a | n/a |

The dev load figure is the first run after the production build; two further dev runs of the
same harness loaded in 385 and 374 ms with playback at 16 percent and zoom at 396 and 395 ms.
The Wave 4 acceptance (load, playback share and zoom at or below the Wave 3 numbers) holds in
both builds: dev playback 16 percent and zoom 13.3 ms per event; prod load 271 ms, playback
9 percent and zoom 3.8 ms per event. No long task in any phase except the lifecycle cycle in
dev (five, 83 ms max), unchanged from Wave 3. No page errors in either build.

## Browser check after Wave 4

`browser-check.mjs.txt` now also arms a placement from the Library and opens the Location
dialog from Range setup: the first Escape closes the dialog and leaves the placement armed, the
second cancels it (`escapeChain`); picks Calibrate scale and expects a `role="status"` strip
with the word Calibrating that Escape removes while returning the tool to select
(`calibrateStrip`); completes a run in the Analyze phase through `startRun` and `completeRun`
and expects the evidence-products record open with a `role="status"` summary (`debriefOpen`);
and reads the lens group (`role="group"`, five `aria-pressed` buttons, one pressed, one
tabbable, no `role="tab"`) and moves the pressed lens with ArrowRight (`lensRoles`). Results in
`browser-check-wave4.json`: every Wave 3 assertion still holds, `firstPlay` saw no long task,
`phaseLayouts` 17 and 1, heap growth 4.6 MB, all four new steps pass, no page errors.

The tracked Board shell spec `scripts/e2e/board-shell.e2e.mjs` (`npm run test:e2e`) passed
6 of 6 against the same dev server: phase switching, selection routing, placement, the Escape
chain, the debrief record and the lens group.

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

## Wave 5 verification, 2026-09-07

Captured against Wave 5 part one on `main`, based on `12d369f`. The change adds workspace,
widget and print error boundaries; admission for new T&E frame images and config snapshots;
a lazy Storage dialog with startup recovery notices and exact-copy download/deletion; and
CI browser and bundle checks. Later scenario-library and seam capabilities are outside this wave.

`npm run check` passes: 208 Vitest files, 2,850 tests, the documentation tests and five new
bundle-accounting tests; typecheck, runtime schema check, documentation review, lint and build
pass. Lint retains 63 existing warnings. The build is warning-free. `npm run test:e2e` passes
6 of 6. These local checks were captured before publication; remote CI status is verified separately
after push. The browser-server lifecycle was exercised locally, including cleanup of its own PID.

### Browser check after Wave 5

`browser-check-wave5.json` records every previous assertion plus the new capability checks.
The harness uses the visible run-validity widget for the dev-only render probe, then changes
both records through their real store actions and waits for both live autosaves. The boundary
exports the current Board JSON and reloads; five sibling widget frames and the canvas survive.
Only the exact injected render diagnostic is expected; all other page errors fail the harness.

The real Capture frame button rejects a stage adapter returning an oversized image string
before adding a frame, with the 5 MiB reason visible in `State`. The actual Ops snapshot button
rejects a scenario with oversized extension data, preserving the null snapshot and empty drift
history. The Storage dialog lists a planted recovery key, downloads its exact malformed text,
retains it until explicit confirmation, deletes only that key, and leaves both live saves
unchanged. A separate fresh context starts with an unreadable live save: the original text is
rescued, the queued startup notice appears in Storage, and no native dialog opens.

No first-play long task; phase-switch layout counts 17 and 1; heap growth after 30 edits
4.6 MB; no unexpected page errors. At 1400 by 900, Storage has no horizontal overflow and
receives focus on Refresh after its lazy chunk mounts; its contents were visually inspected.

`ops-boundary-wave5.mjs.txt` and `ops-boundary-wave5.json` record the independent-review fix:
a failed first Storage chunk load in Ops is caught by the workspace boundary, which also wraps
the Toolbar. The fallback exports the retained campaign and its autosave survives. The two
network/chunk diagnostics are deliberately induced. Independent source review found no remaining
functional or security blocker after that fix and the lazy-dialog focus fix.

### Parity and bundle after Wave 5

`parity-wave5-before.json` and `parity-wave5-after.json` are byte-identical: the fixed-ID
firing and detection-outside-rings probes cover deterministic assessments/report, aleatory MC,
total MC and sensitivity. The temporary Vitest capture file was removed.

`bundle-size-wave5.json` uses actual `gzip -9` output from `dist/`: entry 243,196 bytes against
260,000; initial JavaScript plus CSS 380,735 against 400,000. As in the Wave 3 method, entry,
modulepreloads and stylesheets form the initial budget. Other preloads (fonts) are reported
separately at 88,204 bytes; the all-in total is 468,939. The Storage panel is lazy so adding
recovery management does not exceed the existing minified-chunk warning threshold. The dev
render probe is absent from production output.

### Performance after Wave 5

Same preserved harness/scenario, viewport and panel width. Load is wall milliseconds to first
canvas; playback and zoom are script milliseconds. All original and repeat outputs are retained;
no run was discarded from the table. No page warnings/errors or playback/zoom long tasks occurred.

| Measure | Wave 4 historical | Wave 4 recheck | Wave 5 first | Wave 5 repeat |
| --- | ---: | ---: | ---: | ---: |
| Dev load | 385 | 565 | 407 | 414 |
| Dev playback, 5 s | 808 | 864 | 868 | 880 |
| Dev zoom, 30 events | 398 | 410 | 407 | 395 |
| Prod load | 271 | 334 | 271 | 287 |
| Prod playback, 5 s | 452 | 513 | 520 | 497 |
| Prod zoom, 30 events | 115 | 128 | 124 | 114 |

The unchanged Wave 4 recheck comes from `git archive 12d369f` in a temporary directory, with
locked dependencies shared and a separate dev server/build. Its cold server startup makes its
load measurement unsuitable as a claimed speedup. Its playback and zoom also exceed the
historical numbers; current Wave 5 dev playback differs from that recheck by 4–16 ms (0.5–1.9
percent), and production playback spans both sides of the recheck. This is evidence of run
variation, not proof of exact equality. The historical absolute acceptance numbers are not all
met: observed dev playback is about 17–18 percent of wall time and production about 10 percent.
Casey accepted closure on this paired evidence on 2026-09-07 by instructing the orchestrator
to commit, push and merge to main after these timing misses were disclosed. The work was
already on `main`; this decision closes Wave 5 without claiming its historical absolute
limits were all met or changing future gates.

Raw captures: `profile-dev-wave5.txt`, `profile-prod-wave5.txt`, their `-repeat.txt` counterparts,
and `profile-dev-wave4-recheck.txt`, `profile-prod-wave4-recheck.txt`.
