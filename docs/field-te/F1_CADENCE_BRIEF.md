# F1 cadence and selector brief

Status: PROPOSED BRIEF, 2026-09-05. Written by Claude Fable under the current handoff
(R-D-34) at `dc10895` on `analysis-hardening`. This brief measures the baseline and defines
the F1 rule inside R1. It authorizes nothing. Implementation needs Casey's selection.
The register remains the status authority. Evidence:
[f1-cadence-2026-09-05](evidence/f1-cadence-2026-09-05/manifest.json).

## 1. What F1 is

The [design contract](../design/DESIGN_CONTRACT.md) F1 row asks for three things: the store
advances at a fixed 10 Hz tick, the canvas interpolates with its own frame loop, and every
panel subscribes with a selector. The R1 record narrowed the first point: 10 Hz is the
wall-clock store publication cadence; engine `DT = 0.5 s` and the event horizons do not
change. Section 3 states that rule for every speed. Section 4 defines the interpolation.
Section 5 lists the selectors. Section 6 names the parity gate.

## 2. Baseline measurements

### Method

One Playwright script, preserved as
[f1-render-probe.mjs.txt](evidence/f1-cadence-2026-09-05/f1-render-probe.mjs.txt), against
the Vite dev server at `dc10895`. No source file changed. An init script installs a minimal
React DevTools global hook before React loads. On every commit the hook walks the finished
fiber tree and counts each function, class, memo or forwardRef fiber that carries the
`PerformedWork` flag, so one count is one committed render of one component instance.
react-konva does not register with the hook, so the script imports the app's own
`KonvaRenderer` module instance and injects it; the Konva tree is then counted the same way.
Store publications are counted by a zustand `subscribe` on `playback.simTimeS`. The
`actualDuration` of each root fiber gives the render time per commit.

Fixture: the verified firing fixture
(`evidence/onboarding-2026-09-04/firing-scenario.json`, 500 s, six entities, KuRFS routed),
loaded through `parseAutosave` and `loadScenario`, run mode patched to deterministic except
in the one named Monte Carlo cell. Viewport 1400 by 900, device scale factor 2, right panel
320 px, Chromium 151 through Playwright 1.62.1, React 19.2.8, react-konva 19.2.5,
recharts 3.10.1. Each cell resets the run, sets the tab and the speed, waits 500 ms, starts
the run, records for 6 s wall clock or until completion, then pauses. Two idle cells
record 3 s with playback stopped. The Inspect cells select the UAS so the Inspector shows a
full entity view. The Analysis cells use the `run-summary` lens with nothing selected. The
UI offers 1x, 2x, 5x, 10x and 30x; 20x was set through `setSpeedMult` because the handoff
named it. The headless run and a headed run on this Mac are both preserved; they differ
only in frame rate.

### Results

Idle, both tabs: 0 publications, 0 commits, 0 renders in 3 s. Playback is the only source
of load.

Store publications per wall-clock second and per simulated second, headless (headed in
brackets). The publication rate is the frame rate of the `requestAnimationFrame` loop in
`TimelineBar`, and it falls when a commit is slow:

| Tab, mode | Speed | Pub/s wall | Pub/s sim | Gap p50 ms | react-dom ms/commit |
| --- | --- | --- | --- | --- | --- |
| Inspect, det | 1x | 119 (85) | 120 (85) | 8.3 (11.8) | 0.7 (1.2) |
| Inspect, det | 5x | 120 (85) | 24 (17) | 8.3 (11.8) | 0.6 (1.0) |
| Inspect, det | 20x | 120 (85) | 6.0 (4.2) | 8.3 (11.8) | 0.6 (1.1) |
| Inspect, det | 30x | 120 (85) | 4.0 (2.8) | 8.3 (11.8) | 0.6 (1.1) |
| Analysis, det | 1x | 46 (48) | 46 (49) | 20 (19) | 5.4 (5.4) |
| Analysis, det | 5x | 45 (49) | 9.1 (9.9) | 21 (19) | 5.4 (5.3) |
| Analysis, det | 20x | 45 (47) | 2.3 (2.4) | 21 (19) | 5.4 (5.5) |
| Analysis, det | 30x | 44 (48) | 1.5 (1.6) | 21 (19) | 5.5 (5.4) |
| Analysis, MC 30 | 1x | 17 (17) | 17 (18) | 56 (55) | 15.1 (15.3) |

Committed renders per store publication, identical at every speed and in both runs:

| Component | Renderer | Renders per publication | Why |
| --- | --- | --- | --- |
| `TimelineBar` | react-dom | 1 | subscribes to `s.playback` |
| `CanvasStage` | react-dom | 1 | subscribes to `playback.simTimeS` |
| `StageWrap`, `HudLayer`, `TrackFileReadout`, `ContextMenu`, `ConnectSuggestPopup` | react-dom | 1 each | unmemoized children of `CanvasStage` |
| `Inspector` and its tabs | react-dom | 0 | its `s.scenario` selector does not change during playback |
| `AnalysisPanel`, `LiveStrip` | react-dom | 1 each | subscribe to `playback.observedThroughS`, which moves every publication |
| `WidgetFrame` (5), `TimeSeriesWidget`, `KpiTilesWidget`, `Metric` (7) | react-dom | 1 each | unmemoized children of `AnalysisPanel` |
| Recharts tree (`forwardRef` 25, `ZIndexLayer` 10, ...) | react-dom | 1 tree, plus a second commit | Recharts re-renders whole, then `RenderedTicksReporter` and `ZIndexLayer` (13) commit again |
| Konva root | react-konva | 2 commits | `ThreatWezLayer` subscribes to `simTimeS` itself, then the `CanvasStage` props arrive |
| All 14 layers, every `EntityNode` (6), `Glyph`, `FriendFrame`, `Ring` | react-konva | 1 each per prop commit | no memo; new `tracks`, `detections` and state maps every publication |

Per simulated second at 1x on the Inspect tab (headless) this is 120 `TimelineBar`
renders, 120 `CanvasStage` renders, 240 Konva commits and 720 `EntityNode` renders. At 30x
the same work is spread over 30 simulated seconds: 4 publications per simulated second.
The full per-cell numbers, per-component inclusive render times and the first twelve
commits of each cell are in
[render-counts-headless.json](evidence/f1-cadence-2026-09-05/render-counts-headless.json) and
[render-counts-headed.json](evidence/f1-cadence-2026-09-05/render-counts-headed.json);
[manifest.json](evidence/f1-cadence-2026-09-05/manifest.json) carries a summary per cell and
the hashes.

### Findings

1. There is no cadence. The store publishes once per animation frame at whatever rate the
   display and the render cost allow: 120 Hz headless, 85 Hz headed on this Mac, and about
   46 Hz on the Analysis tab because a commit there takes 5.4 ms plus a second Recharts
   commit of 9 to 11 ms. With Monte Carlo bands drawn, 17 Hz. Simulated time still advances
   at the right rate because the loop integrates measured wall time, so the visible effect is
   uneven motion and heavy main-thread load, not a wrong clock.
2. The F1 problem statement is wrong on the Inspector. `Inspector` rendered once per cell,
   on selection, never on a publication. zustand compares the selected `scenario` object by
   identity, and playback does not touch it. F8 (Inspector split) stays justified for edit
   cost and file size, not for playback.
3. The per-tick load on the right panel is the Analysis rail, through
   `playback.observedThroughS`. `AnalysisPanel` and `LiveStrip` subscribe to it, and every
   widget re-renders as their child even though the widgets themselves read time through the
   DT-quantized `useSimTimeStep` (2 Hz). Recharts then rebuilds its tree and commits twice.
4. The canvas commits twice per publication because `ThreatWezLayer` holds its own
   `simTimeS` selector beside the props from `CanvasStage`.
5. `TrackFileReadout` costs 0.32 ms of the 0.64 ms `CanvasStage` commit on the Inspect tab;
   it recomputes a text card every frame.
6. The "sixty times a second" claim in the contract was unmeasured. The measured rate is the
   display rate on the Inspect tab and lower elsewhere. The pilot hardware (R-D-33, MacBook
   Pro 13 or 15 inch) has a 60 Hz panel, so the field baseline is 60 publications per wall
   second on the Inspect tab and about 46 on the Analysis tab.

Limits: counts are committed renders, so StrictMode's development double invocation is not
counted twice. Render times are development-build times with the probe's tree walk inside
the commit callback, so they overstate production cost; the ratios and counts do not depend
on that. Frame rate is not the field display; the per-publication columns are.

## 3. The cadence rule

Proposed for Casey's decision; the R1 record already directs points 1 and 3.

1. The store publishes `playback.simTimeS` at 10 Hz wall clock at every playback speed. The
   period is 100 ms. The driver is the existing `requestAnimationFrame` loop in `TimelineBar`
   with an accumulator: a frame publishes only when at least 100 ms of wall time has passed
   since the last publication. The loop still stops in a hidden tab, exactly as today.
2. Each publication advances simulated time by `speedMult` times the measured wall time
   since the last publication, not by a nominal 0.1 s, so the clock does not drift. Nominal
   step per publication: 1x 0.1 s, 2x 0.2 s, 5x 0.5 s, 10x 1.0 s, 30x 3.0 s. At 30x one
   publication spans six DT samples; the run record is the deterministic sweep, so no event
   is lost, only the frame at which the glyph changes, which section 4 restores.
3. Engine `DT = 0.5 s` is unchanged. `simTimeS` stays continuous. DT-grid facts
   (detections, track states, effector states, series) are evaluated at the published time
   through the existing `stepIndex` and `useSimTimeStep` quantization.
4. Event horizons are unchanged. `observedThroughS` is the maximum published `simTimeS`.
   The run completes when the next time reaches `durationS`: `advanceRun(durationS)` then
   `completeRun(durationS)`, as today. `scrubTo`, `pauseRun`, `startRun`, the run sequence,
   the basis signature and the observed-preset exception do not change.
5. The engineering reference sentences "TimelineBar owns the requestAnimationFrame loop" and
   "Any pulse, blink or playhead derives from simTimeS; never a timer" are amended in the
   same slice: the canvas frame clock derives its display time from the last published
   `simTimeS` plus the wall time since that publication times `speedMult`.

## 4. Canvas interpolation

1. A frame clock in `src/canvas` (proposed name `useDisplayTime`) runs a
   `requestAnimationFrame` loop while `playback.playing` is true. It reads the store through
   `subscribe` and `getState`, not through `useStore` selectors, so it causes no React commit
   outside the canvas. On each frame it computes the display time: the last published
   `simTimeS` plus `speedMult` times the wall time since the clock observed that
   publication, clamped to at most one publication period ahead and to `durationS`. The
   wall timestamp lives in the clock, not in the store, so `PlaybackState` does not change.
2. Paused, scrubbed, complete or ready: display time equals `simTimeS`. Display time never
   runs ahead of `observedThroughS` while a run is live except within the current period.
3. Interpolating consumers, evaluated at display time each frame: `liveTracks` for
   `EntityNode` position and heading, `CalloutLayer` label placement, `EngagementLayer`
   shots in flight and `blinkOn`, `EntityNode` pulse and effector blink, `ThreatWezLayer`
   pulse and arrived badges. These are all pure functions of the scenario and a time.
4. Snapped consumers, evaluated at the published time only: `detectionsAt`,
   `trackStatesAt`, `effectorStatesAt`, `FootprintLayer`, `HudLayer`, `TrackFileReadout`,
   the `TimelineBar` readout and scrubber, the `EngagementStrip` playhead (a 100 ms linear
   CSS transition on its transform gives it motion without a subscription change).
5. Interpolation is display state. Nothing derived enters the scenario or the store. The
   `ThreatWezLayer` `simTimeS` selector is removed; it receives display time as a prop, so
   the Konva root commits once per frame, not twice per publication.

## 5. Selectors

The store exposes these selectors in `src/state` (proposed file `src/state/selectors.ts`,
pure functions over the store state, memoized by scenario identity where they derive):

| Selector | Returns | Consumers |
| --- | --- | --- |
| `selectSimTimeS` | `playback.simTimeS` at 10 Hz | `TimelineBar`, `TrackFileReadout`, `Playhead`, frame clock seed |
| `selectSimTimeStep` | `simTimeS` quantized to DT (moves `useSimTimeStep` from `panels/analysis/widgets/controls.tsx`) | `LiveStrip`, `controls`, widgets |
| `selectDurationS` | `scenarioDurationS(scenario)`, cached by scenario identity | `TimelineBar`, `LiveStrip`, `AnalysisPanel` |
| `selectRunComplete` | `completedAtMs != null && observedThroughS >= durationS` | `AnalysisPanel` (replaces its `observedThroughS` subscription) |
| `selectObservedThroughStep` | `observedThroughS` quantized to DT | `LiveStrip` preview flag |
| `selectPlaybackFlags` | `{ playing, speedMult, runSeq, completedAtMs }` with shallow equality | `TimelineBar` |
| `selectFrames`, `selectWaves` | `scenario.frames`, `scenario.raid?.waves ?? EMPTY` | `TimelineBar` |

Subscriptions after the slice:

- `TimelineBar`: `selectPlaybackFlags`, `selectSimTimeS`, `selectDurationS`, `selectFrames`,
  `selectWaves`, `scenario.name`, `ui.basemap`. Its `s.scenario` and `s.playback` object
  subscriptions go.
- `CanvasStage`: keeps `scenario` and `camera` (it is the scenario view), splits `s.ui` into
  `ui.tool`, `ui.basemap`, `ui.moveUnderlay`, `ui.layers`, `ui.connectFromId`,
  `ui.pathEntityId`, `ui.draftPoints`; drops `playback.simTimeS` for the frame clock.
  `HudLayer`, `ContextMenu`, `ConnectSuggestPopup` and `TrackFileReadout` are wrapped in
  `memo` or subscribe on their own.
- `AnalysisPanel`: `selectRunComplete` replaces `observedThroughS` and `completedAtMs`;
  widgets are `memo` components with their own selectors, so a panel render does not
  cascade. `LiveStrip`: `selectObservedThroughStep`, `selectSimTimeStep`.
- `Inspector`: no F1 change. It keeps `s.scenario` until F8 (design step 9).
- `ThreatWezLayer`: display time by prop; no `simTimeS` selector.

## 6. Parity gate

Named gate for the implementation slice, in this order:

1. Fixed-ID numerical parity: deterministic assessments and report, seed 4821 aleatory MC,
   total MC and sensitivity serialized outputs equal
   [numerical-baseline.json](evidence/r1-leaf-2026-09-05/numerical-baseline.json) exactly,
   with the retired parity probe rebuilt from
   [parity-probe.ts.txt](evidence/r1-leaf-2026-09-05/parity-probe.ts.txt) and removed after.
2. Horizon parity: a scripted run at 1x, 5x, 10x and 30x shows `observedThroughS`
   monotone and equal to the last published `simTimeS`, completion exactly at
   `durationS` with `phase` `complete`, and scrub, pause and resume behavior unchanged
   against the store tests.
3. Cadence acceptance: this probe rerun at the same cells shows 10 publications per wall
   second, plus or minus one, on both tabs at every speed; one react-dom commit per
   publication outside Recharts; one Konva commit per frame; `Inspector` 0 and
   `AnalysisPanel` 0 renders per publication while the layout is unchanged.
4. The four gates, the schema drift check and the 74-warning lint baseline.

## 7. Bounded contract for the implementation slice

Owned paths: `src/panels/TimelineBar.tsx`, `src/state/store.ts` (selectors only, no action
semantics), a new `src/state/selectors.ts`, `src/canvas/CanvasStage.tsx`, a new frame clock
under `src/canvas`, `src/canvas/layers/ThreatWezLayer.tsx`, `src/canvas/layers/EntityLayer.tsx`,
`src/canvas/layers/EngagementLayer.tsx`, `src/canvas/layers/CalloutLayer.tsx`,
`src/canvas/TrackFileReadout.tsx`, `src/canvas/layers/HudLayer.tsx`,
`src/panels/AnalysisPanel.tsx`, `src/panels/analysis/LiveStrip.tsx`,
`src/panels/analysis/widgets/controls.tsx`, `src/panels/analysis/EngagementStrip.tsx`,
`docs/ENGINEERING_REFERENCE.md` (the two sentences in section 3). Not owned: `Inspector`,
`src/te/`, engine modules, persistence, schema, draw points.

Out of scope: F7 chart rendering (design step 8), F8 Inspector split (step 9), R-F-31
budget and cancellation, any numerical change.

Effort class: Fable high for the cadence, clock and horizon semantics and the review;
Opus high for the selector plumbing and the `memo` wrappers once the semantics are fixed.

## 8. Deviations and follow-ups

- The handoff named 20x; the UI has no 20x. 30x is the UI maximum and was measured as well.
- The design contract F1 "what it fixes" cell names the Inspector and sixty renders per
  second; both are corrected by this measurement. The contract text is not edited here;
  the correction is recorded in the register (R-F-32) and belongs to the F1 slice.
- `.gitignore` excludes `*.log`; the two console logs in the evidence directory need
  `git add -f`, as the earlier evidence directories did.
- The register carries two rows with the ID R-D-34 (ownership transfer and first
  extraction). Not changed here; renumbering is forbidden.
