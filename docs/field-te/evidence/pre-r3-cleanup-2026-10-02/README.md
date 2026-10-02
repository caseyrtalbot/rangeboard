# Pre-R3 cleanup browser check, 2026-10-02

This is the browser check of the pre-R3 cleanup on branch `cleanup/pre-r3` at `dfe5699`.
The cleanup closes the items of the fresh R1 and R2 review in
[HANDOFF.md](../../../HANDOFF.md). The Vite dev server ran the source on port 5195.
Playwright used headless Chromium at a 1400 by 900 viewport, with a fresh isolated
context for each check and theme.

The fixture is the firing laydown,
[firing-scenario.json](../onboarding-2026-09-04/firing-scenario.json), loaded through
`parseAutosave` and `loadScenario`. It holds one threat track.

The script is preserved as `pre-r3-cleanup-check.mjs.txt`. It is evidence of a dated
run, not a test. `findings.json` holds every reading.

## Checks

Each check ran in Night and Paper. The two themes gave the same readings.

1. Prepare, Inputs at 280 px, with `#prepare-entities` open.
   - The Validity line label is `display: none`. The line `title` starts with the label:
     `Forecast validity: A gate below is not scored: ...`.
   - The Entities row reads `Select DJI Mavic 3 (G1 quad) 1` to assistive technology.
   - The Run mode control has the name `Mode`; no control has the old name `Run mode`.
2. Execute, Monitor at 408 px after a completed trial.
   - The one track is leaked. Its chain pips read
     `detect › track › identify › target › engage › leaked`; no leaked track reads
     `defeat`.
   - No row carries `aria-current` before a click. A click on the row sets
     `aria-current="true"` on it, and `ui.rightTab` stays `analysis`.
   - A click on the State header sets `aria-sort="ascending"` on that column.
3. Analyze, Compare at 408 px after a Monte Carlo run and a completed trial.
   - Each of the 5 interval rows carries a spoken description, for example
     `Kills · trial 0 /1 members · ensemble mean 0.1 /1 members · 95 % CI of mean 0.0 to
     0.3 /1 members · trial outside the 95 % CI`.
   - Save current added one saved run. In its row menu, the first Delete press left the
     menu open with focus on `Confirm delete`. Escape closed the menu. On reopen the item
     read `Delete`. Two presses then removed the row (1 row before, 0 after).
4. Console and page errors: 0 in every check. No dialog opened.

## Shots

| File | State |
| --- | --- |
| `inputs-280-night.png`, `inputs-280-paper.png` | Prepare, Inputs at 280 px with Entities open |
| `monitor-complete-408-night.png`, `monitor-complete-408-paper.png` | Execute, Monitor after the completed trial, the row selected and sorted |
| `compare-mc-408-night.png`, `compare-mc-408-paper.png` | Analyze, Compare after the saved run was deleted |

## Not exercised

- The State sort order across rows: the fixture has one track. The unit test
  `sorts State ascending from the least advanced stage, like every other column` covers
  the order.
- The Fragility chip text, the suggestion pool, the refused-add clear, the Placement zero
  change and the requirement table span. Unit tests cover each.
- Screen reader output. The check reads the accessible names and text, not speech.

## Seen, not changed

The Kills row reads `trial outside the 95 % CI` with a trial of 0 and a printed interval
of `0.0 to 0.3`. The flag compares against the unrounded bounds, so a trial just below a
bound that rounds to it reads outside. The visible flag and the spoken text agree.

## Rerun

Start a dev server with `npm run dev -- --port <port> --strictPort`. Copy the script to a
`.mjs` file in a folder that can resolve the repository `node_modules`. Run
`node pre-r3-cleanup-check.mjs http://localhost:<port> <out-dir> <repo-root>`. Run
`oxipng -o 4 --strip safe` on the PNGs before a commit.
