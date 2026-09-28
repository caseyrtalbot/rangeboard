# Row F engine lane browser check, 2026-09-28

Captured on branch `engine/f` with the item 1 commit `5fef8dd` (the assigning C2 node on
the engagement ledger) plus the uncommitted item 2 source (`killClip.ts`, the trial and
replicate wiring, the `TrackLayer` step rule) and its review fixes (a clipped hold ends on
the sweep grid, the dead rule in `deadTimes.ts`, engine revision `rangeboard-trial-r4-v2`).
The Vite dev server ran the source on port 5439. Playwright used headless Chromium at a 1265 by 900 viewport, dark theme unless a
row says daylight. The fixture is the JIATF-401 laydown with the threat spawned outside
every ring,
[detection-outside-rings.json](../../../../src/playback/__fixtures__/detection-outside-rings.json),
loaded through `parseAutosave` and `loadScenario`. The run is 1,500 s long.

The script is preserved as `engine-f-capture.mjs.txt`. It is evidence of a dated run,
not a test. It starts sampled trials in Execute until one removes the threat's last
survival mass (the first trial did, run id `simrun-mulu058n-2`, four salvos in the ledger,
the last survival mass removed at T+1051.16), completes the run so `observedThroughS` is 1,500, then reads
the board track picture and the run timeline model at four horizons and takes the shots
with the cursor scrubbed. `findings.json` holds every reading.

## Shots

| File | State |
| --- | --- |
| `board-before-kill-dark.png` | Execute, complete run, cursor at T+17:26 (5 s before the kill): the KuRFS track cross and ellipse on the DJI Mavic 3, the KuRFS holds and the fused track row running to the cursor |
| `board-after-kill-dark.png` | Execute, complete run, cursor at T+18:01 (30 s after the kill): the hard-kill glyph and no track cross or ellipse; the KuRFS hold and the track row end at the same step at the kill; the threat row carries the ghost span from the kill |
| `board-after-kill-daylight.png` | The same state in the daylight theme |

## Findings

The kill is the effect time of the salvo that removed the last survival mass, T+1051.16
(off the 0.5 s sweep grid). The readings below are `findings.json` `before`, `atKill`,
`after` and `end`.

| Horizon | Board: latest KuRFS estimate of the threat | Board: drawn (within one step) | KuRFS sub-lane last hold end | Track row last span end | Threat row ghost span |
| --- | --- | --- | --- | --- | --- |
| T+1046.16 | at 1046.0 | 1 | 1046.16 (cursor) | 1046.16 (cursor) | none |
| T+1051.16 (kill) | at 1051.0 | 1 | 1051.16 (cursor) | 1051.16 (cursor) | none |
| T+1081.16 | at 1051.0, stale | 0 | 1051.5 | 1051.5 | 1051.16 to 1081.16 (cursor) |
| T+1500 | at 1051.0, stale | 0 | 1051.5 | 1051.5 | 1051.16 to 1475 (planned arrival) |

- Board. Before the kill the layer draws the threat's KuRFS estimate. After the kill the
  retained ledger still holds the last estimate at T+1051.0 (`latestEstimatesAt` returns
  the latest entry per id at or before the horizon), and the `TrackLayer` step rule
  hides it: an estimate older than one sweep step at the horizon is a dropped track and
  draws nothing. So the board draws no track for the dead threat at T+1081 and at the run
  end, and the `HARD KILL` glyph stands alone.
- Timeline. The KuRFS sub-lane's last hold and the fused track row both end at
  T+1051.5: the clipped hold ends at the last sweep sample at or before the kill
  (T+1051.0) and that sample draws its one 0.5 s step, as the last kept fused step does;
  the first sample after the kill is dropped. The track row carries no drop mark. The
  Giraffe 1X sub-lane's last hold ends at T+1049.5, before the kill, so the clip leaves it
  as swept. The threat row ends at the kill with the `hard-kill` mark and carries the
  ghost span from T+1051.16 to the planned arrival at T+1475, censored to the cursor at
  T+1081.
- All four ledger events carry `c2Id` `ent-mtnvzhmr-23` (FAAD C2), the item 1 field.
- `observedThroughS` stayed 1,500 through every scrub.
- Page errors: 0.

## Rerun

Start a dev server with `npm run dev -- --port <port> --strictPort`. Copy the capture
script to a `.mjs` file in a folder whose parent chain reaches the repository
`node_modules` (or link `node_modules` beside it). Run
`node engine-f-capture.mjs http://localhost:<port> <out-dir> <repo-root>`. Run
`oxipng -o 4 --strip safe` on the PNGs before a commit. The trial is sampled, so the run
id, the kill time and the counts can differ between runs; a run with no kill in 60 trials
exits with status 1 and writes the attempts.
