# Right panel R2 browser check, 2026-10-01

This is the browser check of Row R2 of the right panel redesign
(`docs/right-panel/Plan.md`, R2-int steps 3 and 6; the plan is removed and stays in Git
history at `3b51e7e`). It ran on branch
`panel/r2-int` at `7d53ac6`. The working tree held uncommitted doc edits only; no file
under `src/` differed from the commit. The Vite dev server ran the source on port 5187.
Playwright used headless Chromium at a 1400 by 900 viewport, with a fresh isolated
context for each combination of drawer width, theme and state.

The fixture is the firing laydown,
[firing-scenario.json](../onboarding-2026-09-04/firing-scenario.json), loaded through
`parseAutosave` and `loadScenario`. The empty state loads no fixture.

The script is preserved as `right-panel-r2-capture.mjs.txt`. It is evidence of a dated
run, not a test. `findings.json` holds every reading. Each capture row has `kept` true
when its PNG is in this folder.

## Matrix

- Drawer widths 280, 408 and 560 px, set in `rangeboard.rightpanel.width` before load.
- Themes Night (`setTheme('dark')`) and Paper (`setTheme('light')`).
- States:
  - empty board;
  - fixture after `runMonteCarlo()` (status `done`);
  - fixture after a completed trial: `startRun()`, then trial status `ready`, then
    `completeRun(durationOf(scenario))`;
  - fixture after `runSweep` on threat altitude 100, 300 and 600 ft AGL with the default
    replicates (status `done`).
- Screens, opened through `requestPanel`: Prepare (Inputs with every section open,
  Fragility, Placement), Execute (Monitor), Analyze (Outcome, Compare).

In the trial state, Monitor was read during the trial. The script paused the playback
at about T+1:00 (59.9 to 60.0 s). It then completed the trial and read Outcome, Compare
and the Prepare screens. In the other states, Monitor shows no running trial.

That is 3 widths, 2 themes, 4 states and 6 screens: 144 captures checked.

## Pass criteria

From the plan: no console error, no horizontal scroll in `#insp-tabpanel`, and no clipped
text without a `title`. The script reads them as follows:

- Errors: console errors and page errors since the last capture.
- Sideways scroll: `scrollWidth` above `clientWidth` on `#insp-tabpanel`, or a visible
  descendant wider than its `clientWidth`.
- Clipped text: an element with text whose `scrollWidth` is above its `clientWidth`, with
  hidden or clipped overflow or an ellipsis, and no `title` on itself or on an ancestor up
  to its row. Visually hidden text (1 px boxes, a zero clip) is ignored.

## Results

136 of 144 captures pass. The 8 failures are all Fragility at 280 px.

| Screen | 280 | 408 | 560 |
| --- | --- | --- | --- |
| Inputs | pass | pass | pass |
| Fragility | fail: clipped readout, no title | pass | pass |
| Placement | pass | pass | pass |
| Monitor | pass | pass | pass |
| Outcome | pass | pass | pass |
| Compare | pass | pass | pass |

Each cell covers both themes and all four states.

- Fragility at 280 px, both themes, all four states. The Sweep section head readout
  (`span.psec-readout`) clips with an ellipsis and has no `title`. It reads
  `12 cells · 40 runs each`, plus `· ~4 s` or `· ~6 s` once an estimate exists. It shows
  83 px of a 152 to 198 px text. In the Monte Carlo state, the Ensemble head readout
  `30 runs · seed 4821 · T+8:21` also clips (136 of 185 px) with no `title`.
  `fragility-sweep-280-night.png` shows the Sweep head.
- Console and page errors: 0 in all 144 captures. No dialog opened in the matrix.
- Sideways scroll: none. `scrollWidth` equals `clientWidth` in every capture (279, 407
  and 559 px), and no descendant is wider. No element inside the panel scrolls sideways.
- Inputs: every section opened (0 closed sections in each of 24 Inputs captures).

## After the capture

Commit `390257f` fixes the Sweep readout: its `title` now starts with the readout text,
then the method note. At 7d53ac6 the `title` held only the method note.

The script looks for a `title` only on the clipped element and its ancestors. Both
Fragility readouts put the `title` on a child span inside `span.psec-readout`, so the
script still flags them after the fix. The Ensemble readout had a child `title` at
7d53ac6 too: `Full run · 30 replicates · seed 4821 · horizon T+8:21`.

A recheck on 2026-10-02 at `390257f` read Fragility at 280 px after a Monte Carlo run, in
Night and Paper, with the same fixture. Both readouts clip (Ensemble 136 of 185 px, Sweep
83 of 198 px). The child `title` of each holds the readout facts; the Sweep `title`
starts `12 cells · 40 runs each · ~6 s.` (Night) and `~5 s.` (Paper). Console and page
errors: 0. With this, the 8 failures meet the plan rule: no clipped text without a
`title`. The recheck saved no shot.

## Behavior checks

All four pass. They ran in Night at 408 px with the fixture, except check 4.

1. Label clicks. A click on the label text `ROE`, `Doctrine` and `Mode` in Prepare,
   Inputs left the store unchanged: `scenario.roe` `tight`, `scenario.doctrine.enabled`
   true and `scenario.runMode` `monte-carlo`, before and after each click.
2. Rail Entities. From Analyze, Outcome with `#prepare-entities` closed, a click on the
   rail button `Entities` opened Prepare with the Inputs tab selected and
   `#prepare-entities` open.
3. Gates met. After a completed trial, a click on Outcome `Gates met` (`button.out-gates`)
   opened Prepare, Inputs with `#prepare-requirements` open, focused, and in view 446 px
   below the panel top.
4. Outcome at 280 px. In all 8 Outcome captures at 280 px (both themes, four states),
   `scrollWidth` and `clientWidth` are both 279 and no descendant is wider.

## Shots

Each shot is the full 1400 by 900 viewport.

| File | State |
| --- | --- |
| `inputs-mc-408-night.png`, `inputs-mc-408-paper.png` | Prepare, Inputs after a Monte Carlo run |
| `fragility-sweep-408-night.png`, `fragility-sweep-408-paper.png` | Prepare, Fragility after a sweep |
| `placement-mc-408-night.png`, `placement-mc-408-paper.png` | Prepare, Placement after a Monte Carlo run |
| `monitor-trial-408-night.png`, `monitor-trial-408-paper.png` | Execute, Monitor paused at about T+1:00 in a trial |
| `outcome-trial-408-night.png`, `outcome-trial-408-paper.png` | Analyze, Outcome after a completed trial |
| `compare-mc-408-night.png`, `compare-mc-408-paper.png` | Analyze, Compare after a Monte Carlo run |
| `inputs-mc-280-night.png` | The 280 px fold of Inputs |
| `monitor-trial-280-night.png` | The 280 px fold of Monitor |
| `outcome-trial-280-night.png` | The 280 px fold of Outcome |
| `fragility-sweep-280-night.png` | The Fragility failure: the clipped Sweep head readout |

## Not exercised

- Play at speed on Monitor. The script read one paused frame and checked no canvas frame
  rate.
- Sections below the viewport. The checks read the whole panel, but the shots show only
  its top.
- Placement with a run. No placement optimization ran, so no candidate list rendered.
- Saved runs on Compare, and Compare against a completed trial.
- Widths other than 280, 408 and 560 px, and the drawer resize drag.
- Placement Preview on the board (R3).

## Rerun

Start a dev server with `npm run dev -- --port <port> --strictPort`. Copy the script to a
`.mjs` file in a folder whose parent chain reaches the repository `node_modules`, or link
`node_modules` beside it. Run
`node right-panel-r2-capture.mjs http://localhost:<port> <out-dir> <repo-root>`. It writes
every capture under `<out-dir>/all` and `findings.json` in `<out-dir>`. Run
`oxipng -o 4 --strip safe` on the PNGs before a commit. Trials and ensembles are sampled,
so the run ids and some counts can differ between runs.
