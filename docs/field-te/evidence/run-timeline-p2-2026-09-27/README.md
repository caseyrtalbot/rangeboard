# Run timeline Phase 2 browser check, 2026-09-27

Captured on branch `timeline/p2` at `020e540` (lanes 2A and 2B merged, the engagement
strip deleted, the axis and the overview moved under the rows, the entry-graph freeze
rewritten). The Vite dev server ran the source at that commit. Playwright used headless
Chromium at a 1265 by 900 viewport in the dark theme. The fixture is the JIATF-401
laydown with the threat spawned outside every ring,
[detection-outside-rings.json](../../../../src/playback/__fixtures__/detection-outside-rings.json),
loaded through `parseAutosave` and `loadScenario`. The run is 1,500 s long.

The script is preserved as `run-timeline-capture.mjs.txt`. It is evidence of a dated run,
not a test.

## Shots

| File | State |
| --- | --- |
| `execute-midrun-collapsed.png` | Execute, paused at T+4:59 after 10 s at 30x, strip open at 240 px, every group collapsed |
| `execute-group-and-sensor-expanded.png` | Execute at T+4:59, the Sensors group open, the KuRFS sensor expanded to its sub-lane |
| `analyze-strip-open.png` | Analyze after `completeRun`, strip open, the whole record shown |

## Findings

`findings.json` holds each measurement. The numbers below are from that file.

- Frames (6a). The script played 10 s at 30x from T+0 with the strip open, then scrubbed
  to T+0, closed the strip and played 10 s again. It recorded every
  `requestAnimationFrame` interval.

  | Strip | Intervals | Over 20 ms | Over 33 ms | Max ms | p99 ms |
  | --- | --- | --- | --- | --- | --- |
  | Open | 1,149 | 0 | 0 | 16.9 | 16.7 |
  | Closed | 1,202 | 0 | 0 | 13.4 | 9.3 |

  The open run has no interval over 33 ms beyond the closed run, so the check passes.
- Marks and the horizon (6b). Every group and sensor was open. At T+1:15, T+2:30, T+3:44
  and T+4:59 (paused) the script read each drawn mark glyph. A glyph sits at
  `cx = tS * pxPerS` in the pan wrapper, so its time is `cx / pxPerS`; no product code
  changed. It compared the glyphs with `runTimelineOf(view, horizon)` and with the same
  view at the run duration. At each time, 54, 110, 184 and 266 marks drew. No drawn
  mark is past the horizon. The drawn set equals the model set. Every mark of the full
  record at or before the horizon drew.
- Scrub (6c). At T+4:59, `observedThroughS` read 299.10 and 266 marks drew. After a
  scrub back to T+1:30, 64 marks drew. After a scrub forward to T+4:59, 266 marks drew.
  `observedThroughS` stayed 299.10 through all three reads.
- Analyze (6d). After `completeRun`, the model horizon is 1,500 s, equal to the run
  duration. The plot and the overview draw no unobserved region (width 0 px). The header
  reads `Shown through T+25:00`. The drawn marks equal the model marks (522).
- Height (6e). The dock read 240 px. Three Shift+ArrowUp presses on the resizer set it
  to 360 px and stored `360` under `rangeboard.runtimeline.height`. After a reload and a
  return to Execute, the dock read 360 px.
- Page errors: 0.

## Rerun

Start a dev server with `npm run dev -- --port <port> --strictPort`. Copy the script to
a `.mjs` file in a folder whose parent chain reaches the repository `node_modules` (or
link `node_modules` beside it). Run
`node run-timeline-capture.mjs http://localhost:<port> <out-dir> <repo-root>`. Run
`oxipng -o 4 --strip safe` on the PNGs before a commit. The trial is sampled, so mark
counts can differ between runs; the pass conditions do not depend on the counts.
