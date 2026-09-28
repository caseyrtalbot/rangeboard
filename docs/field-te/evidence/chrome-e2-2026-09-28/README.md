# Chrome cleanup lane E2 browser check, 2026-09-28

Captured on branch `polish/e2` at `8491e7b` (Row E lane E2, items 1 to 6). The Vite
dev server ran the source. Playwright used headless Chromium at a 1265 by 900 viewport
in the dark theme, field help off. The fixture is the JIATF-401 laydown,
[detection-outside-rings.json](../../../../src/playback/__fixtures__/detection-outside-rings.json),
loaded through `parseAutosave` and `loadScenario`. The run is 1,500 s long. The script
selected a sensor in Prepare, opened Execute before Play, started a trial, called
`completeRun` at T+25:00 and moved to Analyze.

The script is preserved as `chrome-e2-capture.mjs.txt`. Copy it to a `.mjs` in the
repository root and run `node chrome-e2-capture.mjs <dev-url> <out-dir> <repo-root>`.
It is evidence of a dated run, not a test.

## Shots

| File | State |
| --- | --- |
| `prepare-sensor-detail.png` | Prepare, no trial, the first sensor's Telemetry view, every section open: four empty-state rows |
| `execute-before-play.png` | Execute, no trial: the Run monitor with the inline Play prompt, kept as a line |
| `analyze-outcome.png` | Analyze, Outcome, after `completeRun`, disclosures closed |
| `analyze-outcome-manifest.png` | Analyze, Outcome, the Manifest disclosure open at the system record and its (i) |
| `analyze-debrief.png` | Analyze, Outcome, the Evidence products debrief record in view |
| `analyze-sensor-detail.png` | Analyze, the first sensor's Telemetry view, every section open |
| `analyze-effector-detail.png` | Analyze, the effector's Telemetry view, every section open |
| `analyze-c2-detail.png` | Analyze, the C2 node's Telemetry view, every section open |
| `analyze-threat-detail.png` | Analyze, the threat's Telemetry view, every section open |

## Findings

`findings.json` holds, for each shot, the visible muted lines, the visible and hidden
empty-state rows, the (i) buttons with their labels and heights, the Back button label,
the tile value font and the `.outcome-metric strong` font. `errors` is the page error
list. It is empty.

- Empty-state rows. Prepare shows `No Pd model for this sensor.`, `No track observed.`
  twice and `No threats with flight paths.` as 28 px hollow warning rows. No muted line
  shows in that pane.
- The end-of-run telemetry note sits behind a 24 px (i), `About telemetry state`, at the
  head of the system record. The per-component `Details` lines stay closed.
- Back button. Every detail pane reads `Back to overview`. A click returns to the
  Outcome screen and focuses `insp-tab-analysis`.
- Tile values. The Outcome `.tv` reads 15px/400 JetBrains Mono. No screen mounts
  `TrialOutcomeSummary`, so no `.outcome-metric` node exists on the Outcome screen. The
  script adds a temporary `.outcome-grid > .outcome-metric > strong` probe in the right
  panel and removes it. The probe reads 15px/400 JetBrains Mono, the same as `.tv`.
- Muted lines left. Execute before Play keeps `No trial yet. Press Play to run one.`,
  because it holds the Play control (PlayPrompt, out of scope). The C2 pane keeps
  `Every detected threat routes through this node.` It is a positive status, and the
  empty-state row is a warning state. The Run history keeps `0 saved runs` and
  `No saved run yet.`, outside lane E2.

Run `oxipng -o 4 --strip safe` on the PNGs before a commit.
