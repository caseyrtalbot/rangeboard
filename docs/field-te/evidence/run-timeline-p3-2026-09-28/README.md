# Run timeline Phase 3 browser check, 2026-09-28

Captured on branch `timeline/p3` at `246661b` (the two lane merges `2e8609d` and `50650a4`,
then the integration commit: the tooltip hides when the model changes, and the strip
header uses `horizonText` from `tooltipText.ts`). The Vite dev server ran the source at
that commit. Playwright used headless Chromium at a 1265 by 900 viewport in the dark
theme. The fixture is the JIATF-401 laydown with the threat spawned outside every ring,
[detection-outside-rings.json](../../../../src/playback/__fixtures__/detection-outside-rings.json),
loaded through `parseAutosave` and `loadScenario`. The run is 1,500 s long. The script
started a trial in Execute, opened the strip, played 10 s at 30x and paused at T+4:59
(`observedThroughS` 299.62).

The script is preserved as `run-timeline-p3-capture.mjs.txt`. It is evidence of a dated
run, not a test. Each interaction reads the store before and after, including
`observedThroughS`.

## Shots

| File | State |
| --- | --- |
| `tooltip-over-mark.png` | Execute, paused at T+4:59, every group collapsed, the pointer over a detect mark on the sensor summary line, the tooltip open inside the strip |
| `board-selected-row.png` | Execute, paused at T+4:45, every group and sensor row open, the Giraffe sensor selected on the board, its row highlighted and scrolled into view |
| `header-follow-off-after-zoom.png` | Execute, paused at T+4:45, Follow off after a Ctrl wheel zoom, the window readout at `66 s` |

## Findings

`findings.json` holds each measurement under `items`, keyed by the item number below.
Items run in the order 4, 5, 3, 13, 1, 2, 10, 6, 7, 8, 9, 11, 12, 14, 15.

| Item | Interaction | Result | `observedThroughS` before, after |
| --- | --- | --- | --- |
| 1 | Row label click | pass | 359.12, 359.12 |
| 2 | Board selection highlight and scroll | pass | 359.12, 359.12 |
| 3 | Mark click seek | pass | 359.12, 359.12 |
| 4 | Tooltip and Escape | pass | 299.62, 299.62 |
| 5 | Tooltip after a model change | pass | 299.62, 359.12 (Play) |
| 6 | Ctrl wheel zoom, Follow off | pass | 359.12, 359.12 |
| 7 | Horizontal wheel | pass | 359.12, 359.12 |
| 8 | Vertical wheel | pass | 359.12, 359.12 |
| 9 | Overview drag | pass | 359.12, 359.12 |
| 10 | Follow button | pass | 359.12, 359.12 |
| 11 | Fit | pass | 359.12, 359.12 |
| 12 | Zoom in and Zoom out | pass | 359.12, 359.12 |
| 13 | Collapse all and Expand all | pass | 359.12, 359.12 |
| 14 | Play turns Follow on | pass | 359.12, 359.12 |
| 15 | Reduced motion | pass | 359.12, 359.12 |
| 16 | Page errors | 0 | |

No timeline interaction moved `observedThroughS`. Item 5 plays for 2 s by design, so
observation moves there. Item 14 pauses within one publication, so it does not.

- Row label click (1). With every group open, a click on the first `.runtl-select`
  button (`Giraffe 1X 3D radar (Saab) 1`) set `selection.entityIds` to
  `["ent-mtnvzhmr-22"]`, the row's entity.
- Board selection (2). The script scrolled the rows to the bottom (`scrollTop` 43) and
  called `select` on the Giraffe sensor, whose row sat above the view. `scrollTop` moved
  to 18 and the row came fully into view. One gutter line took `.selected` and one plot
  ground took `.runtl-ground-selected`.
- Mark seek (3). Paused with Follow on at T+5:59, the viewport on screen was
  `t0S` 279.12, `winS` 120. A click on a mark glyph at 285.0 s moved `simTimeS` from
  359.12 to 285.0, a model mark time within the 6 px hit reach. Follow turned off and the
  stored viewport read `t0S` 279.12, `winS` 120, equal to the shown viewport at the
  click.
- Tooltip (4). A hover on a detect mark at 260.5 s opened `.runtl-tip` inside
  `#run-timeline`. It read `Detect KuRFS fire-control radar (Raytheon) 1`,
  `DJI Mavic 3 (G1 quad) 1`, `T+4:20` and `Shown through T+4:59`. Escape removed it.
- Tooltip after a model change (5). A hover opened the tooltip while paused. The script
  played 2 s and paused without a pointer move. The tooltip was gone.
- Ctrl wheel (6). With Follow off, the pointer at 0.25 of the plot width (235 s) and one
  Ctrl wheel of -150 px, the window went from 120 s to 65.86 s. The time under the cursor sat at 0.2503 of the new window against
  0.25 before.
- Horizontal wheel (7). With Follow on, a 200 px horizontal wheel moved `t0S` from the
  shown 241.10 s to 261.64 s and turned Follow off.
- Vertical wheel (8). A 120 px vertical wheel moved `scrollTop` from 0 to 43 (the end of
  the rows at this height). The viewport (`t0S` 261.64, `winS` 65.86) and Follow did not
  change.
- Overview drag (9). With Follow on, a press at 0.3 of the overview width and ten moves
  to 0.6 moved `t0S` from the shown 241.10 s to 867.07 s and turned Follow off.
- Follow (10). From Follow off, the Follow button turned it on and `aria-pressed` read
  `true`.
- Fit (11). The readout `.runtl-zoom` read `fit` and `winS` read 1,500 s, the run
  duration.
- Zoom (12). At Fit, Zoom out was disabled. Zoom in took the window from 1,500 s to
  1,000 s and Zoom out back to 1,500 s, each about the center 750 s. Twelve more Zoom in
  steps divided the window by 1.5 each, the center held at 750 s, and the last step
  clamped at 10 s (factor 1.156). At 10 s Zoom in was disabled and Zoom out enabled.
- Collapse all and Expand all (13). Collapse all left `openGroups` empty. Expand all
  opened all five groups (sensor, c2, track, effector, threat) and the one sensor row
  with sub-lanes; the gutter drew 1 `.runtl-sub` line, equal to the model's sub-lane
  count.
- Play (14). With Follow off, `playbackCommand({ type: 'play' })` set Follow on.
- Reduced motion (15). With Follow on, `.runtl-pan`, `.runtl-playhead`,
  `.runtl-axis-svg > g` and `.runtl-over-window` each computed `transform 0.1s linear`.
  With `prefers-reduced-motion: reduce` emulated, each computed `none`.
- Page errors: 0.

## Departures and notes

- Ctrl wheel with Follow on (integration decision (b), recorded, no code change). A Ctrl
  wheel or a pinch with Follow on keeps the zoomed width, but Follow sets the start again
  from the clock, so the time under the cursor holds only with Follow off. The mockup
  behaves the same. This run measured the anchor with Follow off only.
- Scroll to a selection that exists when the strip opens (integration decision (d),
  recorded, no code change). `useScrollToSelection` acts on a change of
  `selection.entityIds`. A selection made before the strip opens is highlighted but not
  scrolled into view.
- Board selection scrolls to the first line that draws the entity. A threat draws on its
  sensor sub-lane, its track row and its threat row. With every group open and the rows
  at the top, selecting the threat `DJI Mavic 3 (G1 quad) 1` highlighted three lines; the
  first two were in view, so the strip did not scroll, and the threat row itself stayed
  below the view. Item 2 therefore measures a sensor row, which draws on one line.
- At the 240 px dock height the expanded rows of this fixture overflow by 43 px only, so
  the scroll distances in items 2 and 8 are small.
- In Execute a seek back lowers the header horizon with the cursor (`Shown through
  T+4:45` after the item 3 seek). SPEC 1.4 sets the Execute horizon to the lesser of the
  cursor and `observedThroughS`, so this is the specified behavior.

## Rerun

Start a dev server with `npm run dev -- --port <port> --strictPort`. Copy the script to
a `.mjs` file in a folder whose parent chain reaches the repository `node_modules` (or
link `node_modules` beside it). Run
`node run-timeline-p3-capture.mjs http://localhost:<port> <out-dir> <repo-root>`. Run
`oxipng -o 4 --strip safe` on the PNGs before a commit. The trial is sampled and the
play steps run on wall time, so times and counts can differ between runs; the pass
conditions do not depend on them.
