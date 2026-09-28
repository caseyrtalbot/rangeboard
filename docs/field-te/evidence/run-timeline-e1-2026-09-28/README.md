# Run timeline Row E lane E1 browser check, 2026-09-28

Captured on branch `polish/e1` with the source of `1188323` (the lane commit `1a69d8d`
plus the playhead cap fix). The Vite dev server ran the source on port 5421. Playwright
used headless Chromium at a 1265 by 900 viewport. Each board ran in a new browser
context, so each started from a fresh profile with empty storage. The boards:

- The JIATF-401 laydown,
  [detection-outside-rings.json](../../../../src/playback/__fixtures__/detection-outside-rings.json)
  (6 entities, a 1,500 s run).
- The 54-entity performance board "Layered (Acoustic + MEROPS)",
  [perf-2026-09-06/scenario.json](../perf-2026-09-06/scenario.json) (a 1,322 s run).

Both load through `parseAutosave` and `loadScenario`. The script is preserved as
`run-timeline-e1-capture.mjs.txt`. It is evidence of a dated run, not a test. The trial
is sampled, so counts can differ between runs.

## Shots

Each state has a dark and a daylight shot (`-dark.png`, `-daylight.png`).

| File stem | State |
| --- | --- |
| `jiatf-execute-fresh`, `perf54-execute-fresh` | Execute at T+0, fresh profile, strip at the 264 px default, every group collapsed |
| `jiatf-execute-expanded`, `perf54-execute-expanded` | Expand all pressed at T+0, then 20 s (JIATF) or 10 s (54-entity) of play at 30x, paused; sensor rows that gained a track during play are open |
| `jiatf-analyze-fit`, `perf54-analyze-fit` | Analyze after the run completes, Fit, the C2 group open |

## Findings

`findings.json` holds every measurement. `pass` sums each item per board. Every item
passed on both boards, and there were 0 page errors.

1. **C2 assign labels.** Rule: a C2 assign label prints when the gap to the next mark in
   its row is at least `max(44, ceil(12 + 6.6 × characters))` px (`assignLabelMinPx` in
   `layout.ts`). The 12 px is the 6 px offset from the glyph plus 6 px clear of the next
   glyph (its 4 px half width plus 2 px). 6.6 px is one mono character at 11 px (0.6 em),
   the width the rounds-left chip already uses. The last mark in a row has the row to
   itself. At Fit the 54-entity board's busiest C2 row (7 assign marks) printed 1 label
   and a row with 3 marks printed 1. In a 90 s window from the first assign mark they
   printed 4 of 7 and 3 of 3. The JIATF C2 row printed its one label in both views. No
   label overlapped another label or a glyph in any view.
2. **Summary label.** Each summary row reads lower case (`all sensors`, `all C2 nodes`,
   `all tracks`, `all effectors`, `all threats`). The computed font is JetBrains Mono at
   11 px, with an 18 px left padding.
3. **Header buttons: kept at 24 px.** Reason: the design system allows three button
   heights and no fourth (section 4, Buttons). The canvas tool row is the same pattern: a
   28 px row of 24 px `.mini` controls. A 20 px variant would be a fourth height. The six
   header buttons measured 24 px in the 28 px header on both boards.
4. **Playhead cap.** `.runtl-playhead::before` is a 5 px text 1 triangle, 7 px wide at the
   top, narrowing to the 1 px line. Computed: a 5 px solid top border in the line colour,
   3 px transparent sides and a 1 by 0 px box at left −3 px. The cap is part of the
   playhead box, so it moves with the playhead's transform (`transform 0.1s`). With
   reduced motion emulated, the playhead's transition is `none 0s`.
5. **Analyze header.** After the run completes, the header reads `Complete · T+25:00`
   (JIATF) and `Complete · T+22:02` (54-entity). The accessible name stays
   `Run timeline. Complete. Shown through T+m:ss`. A hovered mark's tooltip horizon line
   stays `Shown through T+m:ss`.
6. **Legend: built.** It sits after the horizon text, as the mockup places it, with the
   mockup's swatches drawn from the `--runtl-*` tokens and the shared `--accent`,
   `--warn` and `--danger` inks. The words are text 3 at the 12 px header size. At this
   viewport the strip is 813 px wide beside the right panel, so 3 items fit (hold, coast,
   classify). The rest drop whole: they wrap to a clipped second line, so no item is cut.
   The legend cleared the horizon text and the controls on both boards and in both phases.
7. **Expand all.** Expand all at T+0 opened no sensor row by key (none held a track) and
   set `openSensorsAll`. After play, every sensor row that held a track was open: 1 row
   gained its first track on JIATF and 9 rows on the 54-entity board, with no further
   action. A click on one open row's chevron closed that row alone and cleared the flag
   (the 54-entity board went from 9 open rows to 8). Expand all set the flag again and
   Collapse all cleared it.
8. **Default height.** A fresh profile had no saved height and opened the dock at 264 px:
   a 28 px header, a 193 px row view, a 20 px axis and a 22 px overview. In Execute at T+0
   each board showed 4 groups. In Analyze, with the Tracks group added, each showed 5
   group headers and 5 summary rows (180 px) with no scroll. A saved height is read as
   before (store test `restores the open flag and the height at startup`).

### Observation

`observedThroughS` was read before and after each interaction (`steps` per board):
opening the strip, Expand all, a sensor row toggle, Collapse all, Fit, the C2 group
toggle, a mark hover, the 90 s window and Collapse all in Analyze. None moved it. Play
advances it by design (JIATF 0 to 599.1, 54-entity 0 to 299.9), and `completeRun`
moves it to the run end.

### Contrast

This reruns the Phase 4 contrast part
([run-timeline-p4-2026-09-28](../run-timeline-p4-2026-09-28/README.md)) on the 54-entity
board with every group, sensor row and fold open. It adds the legend words, each legend
swatch and the playhead cap. No new `--runtl-*` token was added. The method and floors
are unchanged: 4.5:1 for text 1 and text 2, 3:1 for text 3 and for a graphic a reader
needs. Each theme now has 121 pairs, 114 with a floor, and 0 fail in either theme.

| Pair (on the panel) | Dark | Daylight |
| --- | --- | --- |
| Legend word (text 3) | 5.27 | 3.84 |
| Hold, coast, dwell swatches | 6.81 | 4.79, 4.79, 4.95 |
| Window and flight swatches (`--accent`) | 7.09 | 5.56 |
| Prep hatch (`--warn`) | 8.59 | 4.41 |
| Classify hostile end, hard kill (`--danger`) | 5.61 | 4.41 |
| Mission kill (`--runtl-ew`) | 6.81 | 4.95 |
| Miss outline (`--runtl-ghost`) | 4.54 | 4.86 |
| Playhead cap (text 1; panel, selected, unobserved) | 14.37, 12.43, 15.42 | 14.66, 13.09, 12.86 |

The classify swatch's unknown end (25 percent over the panel) is a graded step with no
floor, as in Phase 4: the hostile end carries it. The summary label keeps text 3 (5.27
dark, 3.84 daylight). The lowest passing pairs are the Phase 4 ones: 3.13 dark (summary
miss) and 3.01 daylight (summary assign) for graphics, and 4.87 dark (tooltip horizon)
and 3.46 daylight (group header name) for text.

## Departures from the mockup

- Legend words: `hard kill` and `mission kill` replace the mockup's `kill` and
  `soft kill`, so the legend uses the tooltip's words (`MARK_TITLE`).
- Legend overflow: an item that does not fit drops whole, where the mockup clips mid-item.
- Playhead cap: the mockup draws it with 3.5 px borders; Chromium draws those as 3 px at
  a device pixel ratio of 1, which moves the cap 0.5 px off the line. The cap is a 1 px
  box with 3 px sides instead: the same 7 px by 5 px outline, centred on the line.

## Rerun

Start a dev server with `npm run dev -- --port <port> --strictPort`. Copy the script to
a `.mjs` file in a folder whose parent chain reaches the repository `node_modules` (or
link `node_modules` beside it). Run
`node run-timeline-e1-capture.mjs http://localhost:<port> <out-dir> <repo-root>`. Run
`oxipng -o 4 --strip safe` on the PNGs before a commit.
