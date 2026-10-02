# Right panel R3 browser check, 2026-10-02

This is the browser check of Row R3 of the right panel redesign, the placement preview
on the board (`docs/right-panel/Plan.md`, R3, and the R3 Tasking of `docs/HANDOFF.md`;
both are in Git history at `0c5723f`). It ran on branch `panel/r3` on the R3 change before
its commit; no file under `src/` changed after the run. The Vite dev server ran the source on port 5293. Playwright used
headless Chromium at a 1400 by 900 viewport, with a fresh isolated context for each
combination of drawer width and theme.

The fixture is the firing laydown,
[firing-scenario.json](../onboarding-2026-09-04/firing-scenario.json), loaded through
`parseAutosave` and `loadScenario`. The fixture has no range boundary, and the optimizer
needs one, so the script adds a 5,000 m square range boundary (`R3 range`) centered on
the origin.

The script is preserved as `right-panel-r3-capture.mjs.txt`. It is a copy of the R2
script ([right-panel-r2-capture.mjs.txt](../right-panel-r2-2026-10-01/right-panel-r2-capture.mjs.txt))
extended for this row. It is evidence of a dated run, not a test. `findings.json` holds
every reading. Each capture row has `kept` true when its PNG is in this folder.

## Run

The script drives the Placement screen as a user does. It checks Coyote Block 2
interceptor 1 and Giraffe 1X 3D radar (Saab) 1, sets 6 evaluations of 4 runs each, keeps
the default goal (Minimize leakers) and presses Run placement. Each run returned 5
candidates. Candidate 1 can be the start laydown (evaluation 0), which draws frames with
no leader, so the script previews the first candidate from another evaluation. In every
run that was candidate 2.

## Matrix

- Drawer widths 408 and 280 px, set in `rangeboard.rightpanel.width` before load.
- Themes Night (`setTheme('dark')`) and Paper (`setTheme('light')`).
- States, in order: preview off, preview on, Escape, phase change to Execute, rerun of
  the optimization, Apply.

That is 2 widths, 2 themes and 6 states: 24 captures.

## Pass criteria

The panel criteria are the R2 criteria: no console error, no horizontal scroll in
`#insp-tabpanel`, and no clipped text without a `title`. This script also reads a `title`
on a child of the clipped element (`childTitle`), and a clip passes when that title starts
with the clipped text.

The board reading counts the dashed four-point leaders and the outline frames at opacity
0.7 on the Konva stage, and reads `ui.placementPreview`:

| State | Field | Leaders | Frames |
| --- | --- | --- | --- |
| Off | null | 0 | 0 |
| On | set | 2 | 2 |
| Escape | null | 0 | 0 |
| Phase to Execute, then back to Prepare | null | 0 | 0 |
| Rerun of the optimization | set | 0 | 0 |
| Apply | null | 0 | 0 |

Before Escape, the pointer moves off the panel so that no tooltip is open: the tooltip
capture listener takes Escape while a tip is open. After a rerun the field keeps its old
value, and the layer draws nothing because the current result is a new object. After
Apply the scenario name ends in `(placement 2)`.

## Results

24 of 24 captures pass, and the board reading passes in all four width and theme runs.

- Console and page errors: 0 in all 24 captures.
- Sideways scroll: none. `scrollWidth` equals `clientWidth` in every capture (407 and
  279 px).
- Clipped text: none at 408 px. At 280 px each Placement capture has one clip: the
  Candidates head readout (`span.psec-readout`) shows 144 of 218 px of
  `Leakers (members) · 6 evaluations`. A child span holds the `title`
  `Leakers (members) · 6 evaluations · 24 engine replicates`, which was read by hand.
- The Preview and Apply buttons each fit 64 px on one line at both widths. A pressed
  Preview fills in text 1: `rgb(235, 233, 227)` in Night and `rgb(33, 34, 32)` in Paper.

## Kept captures

- Preview on and off at 408 and 280 px in Night and Paper:
  `placement-on-<width>-<theme>.png` and `placement-off-<width>-<theme>.png`.
- The clears at 408 px in Night: `placement-escape-408-night.png`,
  `placement-phase-execute-408-night.png`, `placement-rerun-408-night.png` and
  `placement-apply-408-night.png`. The same states at 280 px and in Paper are only in
  `findings.json`.
