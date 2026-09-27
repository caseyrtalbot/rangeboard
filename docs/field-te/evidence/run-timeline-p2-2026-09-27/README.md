# Run timeline Phase 2 browser check, 2026-09-27

Captured on branch `timeline/p2` at `8e58df2` (the Phase 2 review fixes on top of
`3e1c397`: the axis and the overview window move with the rows' pan and glide, the
Analyze horizon is the observed end, the playhead stays inside the plot at the run end,
and a resizer drag saves once). The Vite dev server ran the source at that commit.
Playwright used headless Chromium at a 1265 by 900 viewport in the dark theme. The
fixture is the JIATF-401 laydown with the threat spawned outside every ring,
[detection-outside-rings.json](../../../../src/playback/__fixtures__/detection-outside-rings.json),
loaded through `parseAutosave` and `loadScenario`. The run is 1,500 s long.

The script is preserved as `run-timeline-capture.mjs.txt`. It is evidence of a dated run,
not a test.

## Shots

| File | State |
| --- | --- |
| `execute-midrun-collapsed.png` | Execute, paused at T+4:58 after 10 s at 30x, strip open at 240 px, every group collapsed |
| `execute-group-and-sensor-expanded.png` | Execute at T+4:58, the Sensors group open, the KuRFS sensor expanded to its sub-lane |
| `analyze-strip-open.png` | Analyze after `completeRun`, strip open, the whole record shown |

## Findings

`findings.json` holds each measurement. The numbers below are from that file.

- Frames (6a). The script played 10 s at 30x from T+0 with the strip open, then scrubbed
  to T+0, closed the strip and played 10 s again. It recorded every
  `requestAnimationFrame` interval.

  | Strip | Intervals | Over 20 ms | Over 33 ms | Max ms | p99 ms |
  | --- | --- | --- | --- | --- | --- |
  | Open | 1,146 | 1 | 0 | 24.9 | 16.7 |
  | Closed | 1,198 | 0 | 0 | 16.8 | 9.3 |

  The open run has no interval over 33 ms beyond the closed run, so the check passes.
- Transforms. Paused after 6a with Follow on, the axis tick group and the pan wrapper
  both read `translateX(-1164.97px)`. The pan wrapper, the playhead, the axis tick group
  and the overview window all read `transform 100ms linear`.
- Marks and the horizon (6b). Every group and sensor was open. At T+1:15, T+2:29, T+3:44
  and T+4:58 (paused) the script read each drawn mark glyph. A glyph sits at
  `cx = tS * pxPerS` in the pan wrapper, so its time is `cx / pxPerS`. It compared the
  glyphs with `runTimelineOf(view, horizon)`, with the horizon RunTimeline.tsx uses, and
  with the same view at the run duration. At each time, 64, 138, 224 and 302 marks drew.
  No drawn mark is past the horizon. The drawn set equals the model set. Every mark of
  the full record at or before the horizon drew.
- Scrub (6c). At T+4:58, `observedThroughS` read 298.16 and 302 marks drew. After a
  scrub back to T+1:29, 76 marks drew. After a scrub forward to T+4:58, 302 marks drew.
  `observedThroughS` stayed 298.16 through all three reads.
- Analyze (6d). After `completeRun`, the model horizon is 1,500 s, equal to the run
  duration. The plot and the overview draw no unobserved region (width 0 px). The header
  reads `Shown through T+25:00`. The drawn marks equal the model marks (532).
- Playhead at the run end. In Analyze at T+25:00 with Follow on, the plot spans x 216 to
  857 px and the playhead spans 856 to 857 px, inside the plot.
- Analyze scrub. After a scrub back to T+5:00 in Analyze, the model horizon stays
  1,500 s, the unobserved region is 0 px wide, the header still reads
  `Shown through T+25:00` and 532 of 532 marks draw.
- Height (6e). The dock read 240 px. Three Shift+ArrowUp presses on the resizer set it
  to 360 px and stored `360` under `rangeboard.runtimeline.height`. A 40 px pointer drag
  down in 40 moves set the dock to 320 px with one storage write (`320`). A click on the
  resizer with no move wrote nothing. One Shift+ArrowUp returned the dock to 360 px.
  After a reload and a return to Execute, the dock read 360 px.
- Page errors: 0.

## Rerun

Start a dev server with `npm run dev -- --port <port> --strictPort`. Copy the script to
a `.mjs` file in a folder whose parent chain reaches the repository `node_modules` (or
link `node_modules` beside it). Run
`node run-timeline-capture.mjs http://localhost:<port> <out-dir> <repo-root>`. Run
`oxipng -o 4 --strip safe` on the PNGs before a commit. The trial is sampled, so mark
counts can differ between runs; the pass conditions do not depend on the counts.
