# R2 execution scope and layers, 2026-09-07

Stage R2 of the [playback realism proposal](../playback-realism-plan-2026-09-07.md).
Before captures ran at `2074a41` from a detached worktree on port 5431. After captures
ran on the uncommitted R2 tree on port 5432; the JSON commit field identifies its base,
not the source edits. Same onboarding firing fixture as R1: one Mavic 3, routed KuRFS
and Coyote, with an audit asset. Both JSON files record fixture SHA-256
`fb62cc6fce749f73f0809f7cf26962c81184d4e8d002005a6cc0277b11cffaa9`.
Playwright headless Chromium 151.0.7922.34, 1400 by 900, right panel 320 px, isolated
context. Port 5174 and the user's autosave were not touched. Script preserved as
[r2-capture.mjs.txt](r2-capture.mjs.txt); text, attributes, store state and screenshot paths
in [before/r2-capture.json](before/r2-capture.json) and
[after/r2-capture.json](after/r2-capture.json), with 11 screenshots alongside each JSON.

## What changed

| Surface | Before | After |
| --- | --- | --- |
| Strip tooltip at paused T+0:30 | `det 0:00 · hostile 0:00 · win 0:20–8:20 · shot 0:20 · arr 7:55` | `det 0:00 · hostile 0:00 · win 0:20–0:30 · shot 0:20 · arr —` |
| Saved frame at 383.9568 s, `applyFrame` | Promotes `observedThroughS` from 30.0911 to 383.9568 s | Leaves observation at 30.0441 s |
| Execute after Analyze | Run context T+6:24 | Run context T+0:30 |
| Forward scrub to T+6:24 | Expected-defeat line and effect rows expose the T+6:18 effect | Run context T+0:30; detail-chart playhead T+6:24, with `Shown through T+0:30`; no future expected-defeat line |
| Selected threat arrival and CPA | `Arrival (full path)` T+7:55 and `CPA (full path)` T+8:20 among track-file rows | `Planned arrival` T+7:55 and `Planned CPA` T+8:20 under `Planned path` |
| Before first Play | Full-run curves and projection visible | `No outcomes observed yet`, `No threat telemetry yet.` and the Analyze forecast placeholder |
| Custom layout at T+0:30 | Requirement verdict, projection and sensitivity action visible | All 12 widget types retained; requirement gates, projection and sensitivity read `Forecast available in Analyze` |
| Custom-layout event ledger at T+0:30 | `1 of 4`, `0:20 → 1:51`, `P 53.4%`, `ΔE[k] 0.534` | `1 of 1`, `0:20 → —`, `P —`, `ΔE[k] —` |
| Backward scrub to T+0:10 | Cursor changes; observation stays at 30.0911 s | Readouts and chart scope text narrow to T+0:10; observation stays at 30.0441 s |
| `applyLayerPreset('clean')` in Execute, then Prepare | Changes `ui.layers` and writes `rangeboard.layers.v1`; Prepare inherits clean layers | `ui.layers` and the storage key remain unchanged through all seven round-trip snapshots |

The runs paused at slightly different wall-clock times: 30.0911 s before and 30.0441 s
after. Both quantize to T+0:30. The after JSON therefore records 30.04 s preserved by
frame navigation, rather than the 30.09 s in the integration brief.

The custom layout contains KPI tiles, time series, system status, threat picture,
requirement gates, event ledger, environment, fire doctrine, projection, run validity,
engagement lanes and sensitivity, in that order. The script restores the `run-summary`
lens before the layer round trip. Its layout, including order, parameters and collapsed
flags, is equal across all seven snapshots. The after capture keeps the original
`ui.layers` throughout Prepare → Execute → Analyze → Prepare and the clean-preset check;
`rangeboard.layers.v1` remains absent (`null`). The JSON records saved layers, not the
resolved Execute layer override; source and store tests establish the engagement default
and session-only `ui.executeLayers` routing.

## Checks

- `npx vitest run --dir src`: 122 files, 1573 tests passed.
- Numerical parity: the R0 probe re-run on the R2 tree is byte-identical to
  `../r0-playback-realism-2026-09-07/numerical-baseline.json`.
- `npm run typecheck` and `npm run lint` exit 0 (63 pre-existing lint warnings).
- Both browser captures have status `ok`, zero page errors and zero console errors.
- Documentation integration read both JSON files and confirmed the custom-layout widget
  types, forecast placeholders, frame observation and saved-layer/layout round trips.
- `npm run check` on the final R2 tree: exit 0. Broad `npm test` discovery: 223 files, 2989 tests (includes ignored checkouts); lint 63 pre-existing warnings; build 214 ms.

Test, numerical-parity and lint results above are the orchestrator's supplied verification
for the R2 tree; this documentation pass did not rerun those source checks.

## Limits and follow-ups

- The Codex worker sandbox could not launch Chromium; the orchestrator ran the captures.
- Chart horizon strings in the JSON include accessibility-only text. Current `ChartFrame`
  supplies a legend accessibility label or a visually hidden span, not a visible caption.
- The disabled-asset engine definedness split recorded in R1 remains: run validity can
  report no defended asset while engine forecasts still report leakage and warning
  against the disabled asset. R2 does not change that engine question.
- R3 physical launch timing is next.
