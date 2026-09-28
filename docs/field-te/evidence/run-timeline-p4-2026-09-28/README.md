# Run timeline Phase 4 browser check, 2026-09-28

Captured on branch `timeline/p4` at `8ba3ec5` (the Phase 4 accessibility and contrast
commit `c8550e1` and the dead export commit). The baseline frames are from `1c7cd00`,
before any Phase 4 source change, with the same script. The Vite dev server ran the
source. Playwright used headless Chromium at a 1265 by 900 viewport, dark theme unless a
row says daylight. The fixture is the 54-entity performance board "Layered (Acoustic +
MEROPS)",
[perf-2026-09-06/scenario.json](../perf-2026-09-06/scenario.json), loaded through
`parseAutosave` and `loadScenario`. The run is 1,322 s long.

The scripts are preserved as `run-timeline-p4-capture.mjs.txt` (dev server, through
`window.__store`) and `run-timeline-p4-prod-frames.mjs.txt` (the production build,
through the transport). They are evidence of a dated run, not tests.

## Shots

| File | State |
| --- | --- |
| `execute-expanded-30x-dark.png` | Execute, paused at T+4:59 after 10 s at 30x, strip open at 420 px, every group and sensor row open, dark theme |
| `execute-expanded-30x-daylight.png` | The same state in the daylight theme |

## Findings

`findings.json` holds every measurement and ratio. The numbers below are from it.

### Frames: the measurement fails

Each run plays 10 s at 30x from T+0 and records every `requestAnimationFrame` interval
and every `longtask` entry. "Open" is the strip open with every group and every sensor
row open: the script presses Expand all, then calls the same store action
(`expandAllRunTimeline`) with the keys of the whole run, so a sensor row that gains its
first track during play is open too. At T+4:59 the open strip draws 119 lines, 55
sub-lanes, 656 marks and 1,956 spans (3,761 SVG nodes). Over 16 ms means over 16.7 ms,
one 60 Hz frame.

| Commit | Run | Intervals | Over 16 ms | Over 20 ms | Over 33 ms | Max ms | p99 ms | Long tasks (max ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `1c7cd00` | open 1 | 934 | 86 | 77 | 36 | 83.4 | 50.0 | 11 (86) |
| `1c7cd00` | closed 1 | 1,169 | 8 | 2 | 0 | 24.9 | 16.6 | 0 |
| `1c7cd00` | open 2 | 986 | 72 | 49 | 25 | 66.6 | 50.0 | 15 (74) |
| `1c7cd00` | closed 2 | 1,159 | 5 | 2 | 0 | 25.1 | 16.7 | 0 |
| `8ba3ec5` | open 1 | 921 | 82 | 78 | 40 | 83.3 | 50.0 | 16 (88) |
| `8ba3ec5` | closed 1 | 1,156 | 24 | 7 | 0 | 25.4 | 16.7 | 0 |
| `8ba3ec5` | open 2 | 980 | 67 | 46 | 23 | 75.3 | 50.0 | 15 (83) |
| `8ba3ec5` | closed 2 | 1,163 | 6 | 2 | 0 | 25.0 | 16.7 | 0 |

The open runs add 23 to 40 intervals over 33 ms beyond the closed runs, so the Phase 2
rule fails on the dev server, before and after the Phase 4 changes. The target (no
frame over 16 ms from the strip) also fails.

The production build (`run-timeline-p4-prod-frames.mjs.txt`, `prodFrames` and
`baseline.prodFrames`) has no `window.__store`, so it plays three 10 s segments back to
back at 30x through the transport: A open with Expand all pressed at T+0 (the sensor
rows had no tracks yet, so none opened), B open after Expand all again (119 lines), C
closed.

| Commit | Segment | Intervals | Over 16 ms | Over 20 ms | Over 33 ms | Max ms | p99 ms | Long tasks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `1c7cd00` | A open | 1,115 | 10 | 0 | 0 | 17.1 | 16.7 | 0 |
| `1c7cd00` | B open, expanded | 1,016 | 88 | 80 | 0 | 25.1 | 25.0 | 0 |
| `1c7cd00` | C closed | 1,179 | 11 | 0 | 0 | 16.9 | 16.6 | 0 |
| `8ba3ec5` | A open | 1,127 | 23 | 0 | 0 | 17.4 | 16.7 | 0 |
| `8ba3ec5` | B open, expanded | 1,017 | 88 | 80 | 1 | 33.3 | 25.0 | 0 |
| `8ba3ec5` | C closed | 1,179 | 6 | 0 | 0 | 16.7 | 16.7 | 0 |

In production the expanded strip costs about 80 frames in 10 s at 20 to 25 ms, about
one per clock publication (100 ms), and 0 or 1 over 33 ms.

Cause. A CPU profile of the open dev run (not preserved) put the strip's time in React
renders of `LaneItems` (about 450 ms inclusive over 10 s, most of it in `spanEl`), then
`Plot` (`Grounds` about 90 ms) and `Gutter` rows; `runTimelineOf` did not reach the top
50 functions. The model is cheap (below). A row with any item past the horizon is a new
object at each horizon, so each publication re-renders those rows and every line's
ground, and each sensor row draws hundreds of 5 s hold chunks. No windowing was built:
the brief asks for the numbers first.

### The model per horizon (the Phase 1 follow-up)

On a fresh copy of the view with the whole run observed, `runTimelineOf(view, 0)` built
in 6.5 ms. Then 265 passes at every 5 s to T+22:02 took 1.2 ms in total (each read 0 or
0.1 ms; the page's timer resolution is 0.1 ms). A pass held at most 115 rows and
sub-lanes. Against the previous pass, 3,847 row objects were new and 25,716 were the same
object: 14.5 new rows per pass on average. `runTimeline.ts` is unchanged: the model is
not the cause of the long frames.

### Observation

`observedThroughS` is read before and after each segment. Play advances it by design
(the first open run from 9.35 to 299.26). No strip interaction moved it: the three
horizon label reads (scrubs), the sub-lane click (299.262 before and after) and the
Analyze scrub. `completeRun` moves it to 1,322 by design.

### Accessibility

- Group name. In Execute the group label read `Run timeline. Shown through T+1:15`,
  `T+2:59` and `T+4:58` at three scrubbed cursors, equal to the header each time. After
  `completeRun`, Analyze reads `Run timeline. Complete. Shown through T+22:02`, also
  after a scrub to T+2:00. A stopped run in Analyze keeps `Shown through` without
  `Complete` (component test).
- Buttons. The expanded gutter holds 187 buttons, none without a name: 5 group headers,
  59 row labels, 55 sub-lane labels, 9 sensor expand controls and 59 hide controls. The
  board has no threat fold (fold headers are the same button as a group header).
- Decision (a), the sub-lane label: a `.runtl-select` button that selects the track's
  threat through `selectRunTimelineRow`, the path a track row label takes. Reason: SPEC
  1.5 names row labels as buttons, a sub-lane is a track row under its sensor, and its
  `entityId` is the threat's id already. A false track sub-lane has no threat and stays
  text, as the false track row does. A click on `THR-G1-Q-01 1` selected that `uas`
  entity; `observedThroughS` stayed 299.262.
- Decision (b), the window readout: a visually hidden `Window ` prefix inside
  `.runtl-zoom` (`.runtl-zoom-name`). Reason: an `aria-label` on a span with no role is
  not reliably read, and a live `output` would announce every zoom. The ARIA snapshot
  reads `text: Window 120 s` between Zoom out and Zoom in; the visible text stays
  `120 s`.

### Contrast

WCAG 2.1 relative luminance, from colours computed in the page inside `#run-timeline`
(a drawn element's `fill`, `stroke` or `background-color` where one exists, else the
expression the code draws with). An ink with an opacity is composited over its surface
first. Floors follow the design system: 4.5:1 for text 1, text 2 and other text, 3:1 for
text 3 (its recorded floor in `design-step4-2026-09-05/contrast.json`), and 3:1 for a
graphic a reader needs (marks, spans, the playhead, the unobserved edge, the selected
bar, the ink squares, the overview marks, each summary mark at 0.75 opacity). A graded
step (a hold below quality 1, the unknown and suspected classification steps) has no
floor: the full-strength ink carries it and the tooltip prints the level.

Each theme has 105 pairs, 99 with a floor. Before the fix, 6 failed in the dark theme
and 43 in daylight; after it, 0 fail in either. The lowest passing graphic is 3.13 in
both themes (the summary miss in dark, the summary undetected span in daylight); the
lowest text pair is 4.87 in dark (text 3 on the raised tooltip) and 3.46 in daylight
(text 3 on the paper group header ground), each against the text 3 floor of 3:1.

| Ink (surface: panel unless named) | Dark before | Dark after | Daylight before | Daylight after |
| --- | --- | --- | --- | --- |
| Sensor: detect, hold, coast | `#7da7c4` 6.81 | same | 2.35 | `#406d8d` 5.09 |
| C2: init, firm, ink square | `#d6d9d2` 12.22 | same | 1.31 | `#636a59` 5.16 |
| Effector: assign | `#c9975a` 6.69 | same | 2.39 | `#8a602d` 5.08 |
| EW: jam, mission kill, dwell | `#7da7c4` 6.81 | same | 2.35 | `#29465a` 9.10 |
| DE: burst | `#9aa8b0` 7.14 | same | 2.24 | `#394349` 9.30 |
| Undetected span, unobserved edge (`--rule-strong`) | 1.88 | `#7e8480` 4.57 | 2.12 | `#6e6759` 5.14 |
| Miss at 0.75 (`--ghost`) | 2.55 | `#7b838b` 3.13 | 2.88 | `#62686f` 3.14 |
| CPA at 0.75 (text 3) | 3.54 | same | 2.58 | `#676860` 3.14 |
| Undetected at 0.75 | 1.58 | 3.14 | 1.72 | 3.13 |
| Duration on dwell (accent ink) | 7.26 | same | 2.15 | 8.33 |
| Duration on burst (accent ink) | 7.62 | same | 2.05 | 8.51 |

The fix stays in the strip: each ink is a `.runtl` token (`--runtl-sensor`,
`--runtl-c2`, `--runtl-effector`, `--runtl-uas`, `--runtl-ew`, `--runtl-de`,
`--runtl-ghost`, `--runtl-cpa`, `--runtl-quiet`). `RunTimeline.tsx` hands `KIND_INK`
to the root as `--runtl-kind-*`, so the dark strip keeps the board's kind inks;
`KIND_INK` and the board inks are unchanged. The daylight theme maps the
`--runtl-paper-*` values through the same two blocks the sheet uses (the manual switch
and the OS setting).

Reuse from `design-step4-2026-09-05/findings.json`: `--ew #7da7c4` and `--de #9aa8b0` on
the paper panel read 2.35 and 2.24 there and here. Its `--c2`, `--sensor` and
`--effector` rows measure the canvas inks, which differ from `KIND_INK`, so they do not
apply.

### Dead code

Removed exports: `ROW_H` and `SUB_H` (`layout.ts`), `runTimeText` (`tooltipText.ts`),
`WHEEL_ZOOM_RATE` and `WHEEL_LINE_PX` (`viewportActions.ts`); each is now module
private. Every `.runtl` rule has a class user and no `.engstrip` rule remains. Kept, each
with its reason: the exports only a test reads (`TipBody`, `MARK_HIT_PX`, `lineAt`,
`seekRunTimelineHit`, `selectedLineKeys`, `scrollTopFor`, `scrollTargetLine`) are the
pure seams their hook or component calls, tested in Node without a DOM; `StripLayout`,
`TooltipText`, `ThreatEntry` and `GestureView` name an exported function's argument or
result; `RunTimelineSide` is in `runTimeline.ts`, which this phase does not change.

- Page errors: 0.

## Rerun

Start a dev server with `npm run dev -- --port <port> --strictPort`. Copy the capture
script to a `.mjs` file in a folder whose parent chain reaches the repository
`node_modules` (or link `node_modules` beside it). Run
`node run-timeline-p4-capture.mjs http://localhost:<port> <out-dir> <repo-root>`; add
`--frames-only` to stop after the frames and the shots. For the production frames, build
with `npx vite build --outDir <dist>` and run
`node run-timeline-p4-prod-frames.mjs <dist> <free-port> <scenario.json> <out.json>`.
Run `oxipng -o 4 --strip safe` on the PNGs before a commit. The trial is sampled, so
counts can differ between runs.
