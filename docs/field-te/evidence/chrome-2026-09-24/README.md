# Chrome refactor final capture, 2026-09-24

Captured on branch `chrome/int` after Row C (lanes C1 to C4, the integrator fixes
and the `opus-high` review fixes) on the Vite dev server with Playwright, viewport
1440 by 900, dark theme, the
[typed firing fixture](../onboarding-2026-09-04/firing-scenario.json) loaded through
`parseAutosave` and `loadScenario`. The script is preserved as
`chrome-capture.mjs.txt`; copy it to a `.mjs` in the repository root and run
`node chrome-capture.mjs <dev-url> <out-dir> <repo-root>`. It is evidence of a dated
run, not a test.

## Shots

| File | State |
| --- | --- |
| `prepare-fragility-help-off.png` | Prepare, Fragility screen, field help off |
| `prepare-fragility-help-on.png` | Prepare, Fragility screen, field help on |
| `prepare-inputs.png` | Prepare, Inputs screen (forecast line, Deterministic checkbox, collapsed sections) |
| `prepare-placement.png` | Prepare, Placement screen |
| `prepare-selected-system.png` | Prepare with a sensor selected: the contextual tab and the Configure view |
| `prepare-panel-menu.png` | The Panel options menu open |
| `execute-midrun.png` | Execute, trial paused at T+0:04 after five seconds of playback |
| `execute-threat-telemetry.png` | Execute with the threat selected: Model basis row and the four sections |
| `analyze-outcome.png` | Analyze, Outcome screen after `completeRun` |

## findings.json

`shots.<name>` holds the live measurements at each shot: the top bar, panel header
and tab row boxes; the header and tab fonts; the tab labels with `aria-selected`; the
heights of every (i) button, `.mini` button, finding row, detail section header and
detail value; the count of help lines and error lines; the status bar and transport
boxes; and any muted sentence longer than 40 characters left in the panel body.
`errors` is the page error list (empty).

Read at the capture: header 32 px at 13/500; tab row 32 px at 12/500; every (i) 24 px;
finding rows 28 px; detail section headers 28 px; three help lines appear on Fragility
with the switch on and none with it off; 0 page errors. The muted sentences that remain
are on Placement, the Configure view of a sensor and the Outcome screen, outside the
Row C lanes.
