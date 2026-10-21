# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This file holds only open work: the current task, the follow-ups and the landmines. It is
rewritten in place, never appended. Completed work lives in the commit log and in the
dated evidence that [README.md](README.md) indexes. A fresh agent starts from this file
and the docs index. This file does not authorize a commit, push or merge.

## Tasking

None selected. `main` and `origin/main` hold all completed work, including the board
symbology refactor merged from `symbology/primer` on 2026-10-21 (the seven rows of the
symbology primer in one commit: identity inks in `src/ui/ink.ts`, the `Glyph.tsx` symbol
library and its Konva twins `symbols.tsx`, white lines and effector rings, the
`EntityLayer` frames and amplifiers, the time-based leader and the data block in
`labelLayout.ts`, and the new `PairingLineLayer` and `OutcomeMarkLayer`). Its gate was
`npm run check` end to end (233 files, 2583 tests) and the browser evidence at
`field-te/evidence/symbology-primer-2026-10-21/`. The branch is deleted. The primer is a
suggested symbol set, not an approved one; its open items are under Board symbology below.

The only open plan is [code-quality/Plan.md](code-quality/Plan.md), a frozen queue. Q1 is
merged. Q2 (delete the orphaned test-card actions) is held: decide it with the T&E Ops
redesign, because the card data model and the `EntityLayer.tsx` card ring depend on it.
Q3 (one sorted-index helper) waits on Q2. Start a row only when the user asks. Leave the
plan file unmodified; record progress here.

## Follow-ups (not fixed)

These are candidates, not rows. Never turn one into a row without the user's word. Line
numbers were checked on `3b51e7e` (2026-10-02). Items marked "browser" were seen in a
capture and not checked again.

### Right panel screens

- The debrief JSON embeds the ensemble only on the same run id, while the CSV items and
  Save gate on the basis (`DebriefRecord.tsx:139`). A change alters export content.
- The Compare inside/outside flag compares the trial with the unrounded interval bounds
  (`CompareScreen.tsx:119`), so a trial of 0 against a printed `0.0 to 0.3` can read
  outside. The visible flag and the spoken text agree.
- `Confirm delete` has no live region; a screen reader may not announce the new label,
  because focus stays on the same button (`RunHistory.tsx:364-375`).
- Monitor `prior` takes the hold at the cursor, so a leaker that lost its hold before
  arrival reads `detect › leaked` (`NowScreen.tsx:139-144`).
- The status-bar Validity count reads the forecast in every phase (`StatusBar.tsx:125`).
  In Analyze the line reads the completed trial's `view.validity`, so the button can open
  a line with a different count. The firing fixture's completed trial carries no
  `view.validity`, so Analyze reads its forecast and labels it Forecast validity.
- The Outcome operator floor stamp stays in the body (`OutcomeScreen.tsx:66-72`). It is a
  trial model note; moving it into the Validity line needs a `runValidity` finding.
- At the full sensitivity depth Fragility shows the Morris and Sobol widget and no swing
  rows; swing rows come only from the one-at-a-time depth.
- The Outcome Manifest record lists every manifest field, `basisSignature` included
  (`DebriefRecord.tsx:215-219`); the approved prototype listed seven rows.
- Narrow widths (browser): at 280 px the Outcome stat row folds 3 + 1, the Event ledger
  squeezes names and the Compare baseline Clear wraps; one-threat track names clip at
  408 and 280 px (titled); the Sobol widget clips labels and overprints values at 408 px;
  Placement Systems to move repeats a name whose short and full names match; a slider
  puts its value beside a short slider, not in the label row.
- Wording and chrome: Settings is a framed button, not a text link; fields carry their
  own (i); Monitor Systems rows have no kind tag; the result bar reads "of 1 members"
  (`OutcomeScreen.tsx:317`); Saved runs shows a notice line (`RunHistory.tsx:607`), not a
  toast; the chart legend reads Simulated trial (`controls.tsx:52`).
- The Run section has no new-seed button; the approved prototype had one.
- Fragility Pin is a text button: `src/ui/icons` has no pin glyph.
- The sweep map keeps its three-tone status cells (`SweepMap.tsx`); the prototype drew
  a ramp.
- The Inputs Entities rows show full names, not a shared-prefix split: `trackNames.ts` is
  under a guarded prefix and outside the entry freeze.
- The Inputs `.prep-note` lines are status sentences, which the `EmptyRow` landmine says
  render as an `EmptyRow` (`BoardPreparation.tsx:227`, `EnvironmentSettings.tsx:114`,
  `FireDoctrineSettings.tsx:154`).
- Muted status lines remain: `RunHistory.tsx:613` (`No saved run yet.`), three in
  `CompareScreen.tsx` (396, 634, 695) and `PlayPrompt` in `NowScreen.tsx:44` (it holds a
  control).
- Back to overview does not clear the selection; it shows the Outcome screen and focuses
  `insp-tab-analysis` (`App.tsx:1213-1217`).
- Placement: a preview marker can sit under another board label (no collision layout by
  decision); the screen keeps its goal, systems and budget in local state, so a phase
  change away and back resets them; the Candidates (i) note (`resultNote`) describes
  Apply only, not Preview.
- Code nits: the Requirements summary adds "· n not evaluated" to the plan text
  (`BoardPreparation.tsx:195`); `RecordExports` is exported for in-file use;
  `InfoButton` is defined in three screens and `IconDownload` in `CompareScreen.tsx`; the
  Monitor defeated state word carries an inline `--ghost` style (`NowScreen.tsx:337`);
  `.prepare-entity-group` has no rule.
- `NoteInfo` in `panels/analysis/controls.tsx` has no user. Delete it with `.frag-head`
  when no pane needs it.
- `ForecastSettings.tsx` copies the replicate and seed bounds of `RunTab.tsx`, which does
  not export them. `FragilityScreen.tsx` keeps a local `TIME_CI_MIN_N = 30` that mirrors
  `mc.ts`.
- `RunHistory.tsx` and `DebriefRecord.tsx` keep local copies of the popover dismissal
  code, because a static `usePopover` import splits the store (Landmines). Find the
  cause, then share the hook.

### Selected object tab, Inspector and library

- Entity view keeps a second tab level (Telemetry · Configure · Model basis) under the
  one tab row (`EntityWorkspace.tsx:16`).
- Configure view of a sensor: `East (km)` and `North (km)` keep the unit in the label
  (`Inspector.tsx:795, 807`), Heading is a slider with a value box, and the section names
  are muted labels, not 32 px collapsible rows; three muted sentences remain.
- Sweep factor selects carry the unit in the option text (`SweepMap.tsx:12-17`); the
  section (i) sits at the far right, not beside the title.
- Panel options: `Reset section layout` is absent. Whether Collapse all and Expand all
  are disabled on the Configure view is not confirmed.
- `DetailTable` cells in the collapsible sections (gates, doctrine, hops, timing) wrap
  and carry no `title` (`detailRows.tsx:101-121`).
- The Inspector MRIR slider moves the ring on release only (one undo step per drag).
- NINJA `sectorDeg` is graded MANUFACTURER_CLAIM in `ninja.json`, but the model has no
  provenance row for it. The Inspector effector row renders only below 360
  (`Inspector.tsx:1033`), so NINJA at 360 shows no Azimuth row; the gap shows on the
  library and editor surfaces. Adding a row changes the frozen seed fixture that
  `src/model/seedLibrary.test.ts` compares.
- No public source gives the jam beam width of CUAEWS DF or Modi II; both stay 360.
- The Palette editor view follows `selection.libraryId`: selecting a board entity returns
  the list without dismissing the request. Escape closes the whole drawer from the
  editor. Opening the editor clears the entity selection, so the right panel falls back
  to the analysis screens while the model edits on the left.
- `.chip.det` has one user (`SystemsTab.tsx:202`).

### ISR CAP and connect popup (added 2026-10-21, not checked against a commit)

- Connect all in the connect popup draws one `completeConnect` per link, so it costs one
  undo step per link; the removed candidate list made one (`ConnectSuggestPopup.tsx`).
- `applyConnectSuggestion` and `ui.connectSuggestion.candidates` have no UI consumer; the
  popup renders from `integrationBoardStatus`. Removing them is a store change.
- The popup clamps itself inside the canvas host; the Inspector Network trigger still
  pre-clamps with its own 280 and 260 px constants (`Inspector.tsx`, `suggest()`).
- A required spec id absent from the library prints as the raw id in the missing line,
  while `integrationSummary` guidance drops it.
- Moving a UAS after drawing does not regenerate its path points; a hand-drawn path and
  an ISR CAP behave the same, and only `updateCap` rebuilds from the current position.
- Enter does nothing under the cap tool; the second click or a double click finishes it.
  `HudLayer` says so. A CAP ends after its laps, so laps bound the scenario duration.
- The cap caption takes one fixed slot at the east point, with no `captionClear` search.

### Board, rail and header

- With a pinned ring readout, Esc clears the pin and also the selection. The HUD pin is
  local state (`HudLayer.tsx:33`) that the Escape precedence in `interactionRouter.ts`
  cannot see.
- No production code sets `Selection.cardId`, so the `EntityLayer.tsx` card ring
  (606-608) never draws. Q2 keeps it with the card data model.
- The rail's Frames button is disabled in Prepare with the reason only in its title
  (`App.tsx:310-315`); a route into Execute that focuses `#frame-add` would serve better.
- No test covers the rail routes (`openLayers`, `openFrames`) or that Pause and Resume
  stay enabled in Execute under deterministic mode. Some `+ Frame` and popover items may
  have no static-render test (not checked).
- `F2` focuses the scenario name only while focus is inside the header
  (`Toolbar.tsx:192-198`); the drawer toggle's icon no longer shows the open state.

### Board symbology

- No rounds-remaining line. The primer's `4 RDS` on a launcher needs a magazine count per
  effector at the cursor; `TrialSweep` carries only `effectorStates`, and the magazine
  history lives in `TrackTimeline.effectors` (`trackState.ts`), which `LiveScene` builds
  for shots but does not pass to `EntityLayer`. One `Map<string, number>` prop away.
- The label layout measures a track's block without its status word
  (`blockLinesAtRest`), so `×N HK` can run up to 5 characters past the measured box.
- HOSTILE against ENGAGED on the telemetry pill is 1.14:1 by value (`PHASE_STYLE`
  identified `#e46f62`, engaged `#f2795e`); the board no longer draws the engaged
  colour, so only the pill shows both.
- The primer's jamming-threat semicircle and the J it carries wait on threat-side EW in
  the model; there is none.
- Konva hinting of the stroked 2525 icons (radar, launcher, laser) at the 24 px board
  frame needs the browser pass verdict; the letter fallback is the DOM `Glyph` only.
- `labelLayout` `GLYPH_HALF` is 18 (the brackets reach 17); `captionClear` and the spoke
  clustering read it.
- The primer is suggested, not approved. Nothing here fixes the symbol set.

### Run timeline

- The dev-server frame rule fails on the 54-entity board fully expanded (11 to 24
  intervals over 33 ms beyond the closed run) while the production build passes. The
  remaining cost is in `CanvasStage` (`trialSeriesOf`), the React dev runtime and
  react-konva, with the strip at about 270 ms per 10 s. Horizontal windowing of the 5 s
  hold chunks, or row object reuse in `runTimeline.ts`, needs a new measurement first.
- An effector label can still reach the next glyph: the effector gate is a flat 44 px
  while `pk 0.45` needs about 53 px. Measuring it is a design decision (Landmines).
- The duration on a dwell or burst fill prints in the paper board ink on daylight. Text 1
  there needs the 0.75 summary-opacity floor to drop, a design decision.
- When the header is narrower than the first legend item (about 45 px), `hold` is cut
  mid-item, and the clipped items stay in the accessibility tree.
- Row meta is Archivo 11 px; the mockup's `.count` is mono.
- Expand all does not open threat folds (`openFolds`, `store.ts:1576-1581`).
- A focused gutter button that scrolls far out of the row window unmounts and loses
  focus; Tab order still reaches the next lines through the overscan.
- `.runtl-plot` takes `onClick` with no keyboard path (`Plot.tsx:216`); the transport
  covers the seek.
- A Ctrl wheel over the gutter anchors at `t0S`, because the anchor clamps to the plot's
  left edge.
- The strip's Collapse all and Expand all share their names with the inspector ⋯ menu
  items.
- Long model names truncate in the 172 px gutter; the instance number survives the
  ellipsis and the `title` holds the full name.
- A node that held the fused picture and lost it before the firm time still gets a firm
  mark on its C2 row (`runTimeline.ts:458`).
- Tests: the strip component tests leave `openSensors` set between tests, so they depend
  on order (`RunTimeline.test.tsx`); no unit test drives the Controls handlers, the
  horizontal-wheel pan, the Overview drag, the Escape close, the scroll listener of
  `useRowWindow` or the App resizer; an empty trial and a zero duration have no model
  test.

### Engine and analysis

- `shnidmanPdFromSnr` (`src/playback/radarDwell.ts`) is the largest self time in the
  engine profile of 2026-09-25 (11 percent, plus 4 percent in its forward call): a
  24-step bisection per uncached SNR. A table over SNR per (pfa, pulses, swerling) or a
  closed-form inverse would remove it. The cache and the fixed-ID parity expects bound
  the change.
- The sweep step (`stepSweep` in `sweep.ts`; `sensorHit` and the sweep's `hits` in
  `detection.ts`) and `dist` and `bearingDeg` in `geo.ts` take about 30 percent; entity
  and member state as typed arrays inside one sweep would cut the object reads.
- Garbage collection is 5 percent: `trackSamples` and `fusedTracks` grow one object per
  step per threat (`sim.ts:378-379`), and `scenario.entities.find` runs inside the
  attrition loops. Preallocated per-step buffers and an id index would remove both.
  `systemTelemetry` also looks up the formation count with `scenario.entities.find` per
  assessment per call (`systemTelemetry.ts:210`).
- `ThreatPicture` has no production importer; only `threatReadout.test.ts` renders it.
  Its forecast row keeps `Expected FX` at the first mass-removing effect.
- On the threat detail survival chart the FX and ARR labels overlap when the death is
  near the arrival (evidence `detail-survival-hard-dark.png`).
- `trialSeries` phase 6 (Neutralized) covers a late death; leaked has no phase value.
- `soft` comes from the latching salvo (`deadTimes.ts:123`), so a fractional
  deterministic death (0.7 soft then 0.3 hard) reads hard. Trials and replicates draw
  whole ships, so no clip or pill sees it.

## Landmines

- A placement preview draws only while `currentOptimize` returns the same result object
  as `ui.placementPreview.source`. A rerun or a basis change hides it and leaves the field
  set; a check that reads only the field reads a stale preview as shown. `cancelDraft`
  keeps the preview, because library placement and calibration call it.
- Right panel entry points find panel elements by DOM id or class: `openDoctrine` is a
  `requestPanel` call, and `showPanel` (`App.tsx:923-949`) opens the section by DOM id
  (a `details` or a `PanelSection` toggle) and focuses its head; `openEntities` is a
  `requestPanel` call to `#prepare-entities`; the status-bar button focuses
  `#validity-line`; the e2e file reads `#insp-tab-analysis`, the tab labels
  (`scripts/e2e/board-shell.e2e.mjs` 112, 207, 270) and `.right-resizer`. Keep
  `#prepare-run`, `#prepare-environment`, `#prepare-doctrine`, `#prepare-requirements`,
  `#prepare-entities`, `#validity-line`, `#insp-tab-analysis`, `#insp-tabpanel`,
  `#drawer-toggle` and `.right-resizer`, or move the caller in the same change.
- A board selection switches the right panel to the Selected object tab when it becomes
  non-empty, or when the origin flips from `panel` to `board` (`App.tsx:913-920`). A
  panel control selects with origin `'panel'` and keeps its screen.
  `FindingThreatActions`, the Inputs register rows, the gate table's blocking-track
  buttons and the Monitor rows do. `select` writes `ui.selectionOrigin` even when the selection is
  unchanged, so a board click on a panel-selected object switches the tab.
- `Field` renders a `<label>` root while both `help` and `error` are undefined, and a
  framed `<div>` root once either is passed. A label with no `for` forwards a click to
  its first labelable descendant, and a `<button>` is labelable, so a segmented control
  or a switch under a bare `Field` changes its value on a click on the label text. Wrap
  a segmented control or a switch in a `div`, never a bare `Field`. Pass `error=''` while
  a value is valid, or the control remounts on every validity change and loses focus.
- `PanelSection` is in `src/ui/` because `BoardPreparation` is in the entry graph:
  a module under the guarded `src/panels/analysis/` that it imports fails
  `check:entry-graph`. Never run `check-entry-graph.mjs --write` to get past it.
  `ValidityLine` reaches the shell only through the lazy `PanelValidity` in `App.tsx`.
- A static import of `src/ui/usePopover` from a lazy analysis module (`RunHistory.tsx`,
  `DebriefRecord.tsx`) splits the store into a preloaded chunk (the entry metric falls
  near 243 kB) and fails `check:bundle`.
- Collapse all and Expand all read `[data-section-id]` from the `PanelSection` toggles on
  screen and pass the ids to `setAllSections`; a section that is not rendered keeps its
  state. They still set each `details` and `.det-s-toggle` in the DOM. A third collapse
  pattern in the panel body needs `panelSections` in `App.tsx`.
- The Validity line is a sibling above `.inspector-body` (the scroller), not a sticky
  child. `setBoardPhase` closes it; in Execute only the status-bar button opens it.
- The right panel screen tests render with `renderToStaticMarkup` and assert on the markup
  string, with React hooks mocked, so a markup change breaks them by text.
  `AnalysisPanel.test.tsx` asserts on the markup of every screen. `SystemStatus`
  exports `STATE_LABEL` and `stateTone` to the three detail panes, and the `.insp-row`,
  `.tb`, `.tb-dense`, `.field-info` and `.field-help` rules also serve the Inspector and
  Settings.
- The drawer width lives in `rightW` and `RIGHT_PANEL_WIDTH_KEY`, but its 44 % viewport
  cap is only CSS (`index.css:4485`, `max-width: 44vw`), so the stored width can exceed
  the rendered width on a narrow window.
- The effector ring storage keys keep their old names: `effectorDoctrinal` is the MRIR
  ring and `effectorMaxRange` the MIR ring. Renaming a key breaks saved views and
  `ui.ringOverrides`. A click on a ring edge routes `consume` in the select tool
  (`onRing`), so the selected threat and the pinned readout survive the click.
- `EngagementEvent.c2Id` is written once per (threat, effector) when `attrition.ts`
  builds the threat's routes (`ThreatState.assignC2Ids`), `null` on a direct route and
  absent on a legacy ledger or a unit fixture without the map. `runTimeline.ts`
  `assignerOf` returns the field when it is not `undefined` (a `null` yields no assign
  mark) and routes only when it is absent. A test that builds events by hand and expects
  routing must leave the field out.
- `clipAtKill` (`killClip.ts`) is the only place the sweep products of a killed threat
  are cut. It is wired in `runTrial` and in `rangeLoopInto`; `endOfRunResponses`,
  `engagementPicture` and `raidSizeOf` read unclipped assessments and must keep reading
  only the report, `status`, `firstDetectS` and `warningS`. `trackQuality` on the
  assessment stays as swept; the readers and the export bound it at the hard cut. Only a hard defeat clips, at
  the hard cut `hardKillTimeOf(deadTimeOf(...))`: the last sweep sample at or before it.
  An all-soft or mixed defeat keeps its picture to the path end. The clip also nulls the
  classification rungs, `stableTrackAtS` and `declaredHostileAtS` after the cut. Interval
  ends snap to the sweep grid from their start, so an off-grid kill never leaves an
  off-grid end. A killed threat with nothing to clip and every unchanged list come back as
  the same object (the `assessments` array is new once any threat has a hard cut); a test
  may rely on per-object identity.
- The one dead rule is `deadTimeOf` in `src/playback/deadTimes.ts`; `threatAggregation.ts`
  re-exports `deadTimeOf` and `expectedDeadTimes`. No module under `src/playback/` or
  `src/engine/` may import `analysis/threatAggregation`, or the engine bundle loads the
  picture layer. `liveStats.ts` imports `deadTimeOf` through that re-export: a direct
  `deadTimes` edge splits the store into a preloaded chunk and fails `check:bundle`. The
  latches are cached in a `WeakMap` keyed on the report object; never mutate a report's
  `events` or `threats` after a read.
- Every reader reads the death (outcome: targeting, windows, defeated, FX, the phase) or
  the hard cut `hardKillTimeOf` (picture: track quality, the ghost span, the drop
  suppression, the clip). A new reader picks one; a mission-killed airframe keeps its
  picture. A late death is a leaker: `effectMet` is false, the pill reads `LEAKED`, and FX
  and First effect leave it out. The Now Run monitor `Defeated` row and the Outcome tile
  count pre-arrival defeats over the modeled members (the attrition rows' `shipCount`).
  Some readers count `killDelta === 1` by design: the `trialSeries` removal series and
  mark words, the timeline per-event mark kind, the `trialResultOf` guard, the
  `trialSnapshotAt` counts and the `SystemDetail` detect-to-first-effect latency.
- `TrackLayer` hides an estimate older than `stepS` at the horizon. LiveScene passes
  `trial.manifest.sweepStepS`, the same step the clip used (the `runTrial` guard). A
  caller that omits `stepS` gets the old picture, the latest entry per track at any age.
- `TRIAL_ENGINE_REVISION` is `rangeboard-trial-r4-v3`. A stored trial from an earlier
  revision fails the manifest gate by design. Dated evidence files still carry `r4-v1` and `r4-v2`; leave
  them.
- `threatPictureAt` and the threat readout bound track quality at the hard cut (`tLive`).
  The classification rung has no local bound because the clip nulls a rung after the
  cut, so every caller of `threatPictureAt` and `trialTelemetryAt` must pass clipped
  assessments. `Math.min(null, x)` is 0, so the bound guards a null horizon; keep the
  guard. `trackQualityAt` takes the sweep step (default 0.5 s); the export passes
  `manifest.sweepStepS`.
- Run timeline: keep
  `ENGSTRIP_OPEN_KEY` exported with the value `rangeboard.engstrip.open`; it holds the
  run timeline open flag, and `RUN_TIMELINE_HEIGHT_KEY` holds the height.
  `storageManagement.ts` derives live keys from the exports. The e2e reads
  `#run-timeline-toggle`, `#run-timeline` and `.runtl-dock`.
- The rows are windowed. `stripLayout` keeps every line; only the gutter, the grounds and
  the rows slice it through `useWindowedLines(lines, view)`. A new component that draws
  per line inside `.runtl-scroll` must take the same `view`, or it draws every line and
  the frame cost returns. An unmeasured view (`heightPx: Infinity`) draws every line,
  which the static tests rely on. A drawn line keeps its layout y: the gutter uses a
  spacer for the first drawn line, the plot uses absolute y.
- Strip components draw with `var(--runtl-*)` only, never `KIND_INK` or `--ew`, `--de`,
  `--ghost` directly; `RunTimeline.tsx` passes `KIND_INK` in as `--runtl-kind-*`. The
  `--runtl-paper-*` values are searched to the 3:1 floors (panel, selected ground, 0.75
  opacity); a change to one, or a new ink, needs the contrast rerun of the capture
  script in `docs/field-te/evidence/run-timeline-p4-2026-09-28/` in both themes.
- `OverPlayhead` in `Overview.tsx` subscribes to `selectSimTimeS` alone and has no glide;
  the overview picture must not read the clock.
- A row name with a trailing space and digits (`/ \d+$/`) renders as `.runtl-name-head` plus
  `.runtl-name-tail`; the head keeps the trailing space, so the button text equals the
  label. Tests match that markup. The meta is left out when the label starts with it.
- An effector mark's `after` and pk print only when the gap to the next mark in the row
  is at least `LABEL_MIN_PX` (a flat 44 px, in `layout.ts`); a C2 assign label only when the gap
  is at least `assignLabelMinPx(text)` (12 px plus 6.6 px per character, never under 44);
  marks come sorted by time from `laneOf`.
- `ui.runTimeline.openSensorsAll` is session only. `expandAllRunTimeline` sets it,
  `collapseAllRunTimeline` and `toggleRunTimelineSensor` clear it; while it is on,
  `stripLayout` opens every sensor row with a held track, and `toggleRunTimelineSensor`
  must receive `shownOpen` (the rows open on screen, `openSensorKeys(lines)` from the
  Gutter) or the rows the flag alone opened close. A new caller of the toggle passes it.
- The playhead cap is `.runtl-playhead::before` with whole-pixel borders (5 px top, 3 px
  sides). It is part of the playhead box, so it glides and stops with it; a cap drawn as a
  sibling would need its own glide and reduced-motion rule.
- The legend (`.runtl-legend`) draws with the `--runtl-*` tokens plus `--accent`,
  `--warn` and `--danger`, the same inks the marks and spans use; a new legend item takes
  the ink of the item it names. The header reads `headerText(horizonS, durationS)`; the
  accessible name and the tooltip keep `horizonText`.
- The window readout markup is `<span class="runtl-zoom"><span class="runtl-zoom-name">Window </span>120 s</span>`;
  a test matches it exactly.
- The strip's group name is `Run timeline. Complete. Shown through T+m:ss` once
  `horizonS >= durationS`, and the header then reads `Complete · T+m:ss`; the Analyze
  fixture run is 60 s, so its test expects `Complete`.
- Turn Follow off through
  `setRunTimelineViewport(shownViewport(base, follow, durationS), false)`.
  `setRunTimelineFollow(false)` alone jumps the view to the stale stored start. A store
  test asserts that every `ui.runTimeline` action and `select` leave `playback` the same
  object.
- The tooltip's Escape listener is on `window` in the capture phase and stops
  propagation while a tip is open, so App's board Escape (`clear-board`) does not fire.
  A dismissed item stays closed until the pointer leaves it. The tooltip holds
  `{ hit, model }` and renders `liveHit(held, model)`; a hit from an old model renders
  nothing. `TipBody` is the markup; `Tooltip.tsx` exports components and types only.
- A board selection scrolls to `scrollTargetLine`: the entity's non-track row, else a
  summary or fold line that holds it, else the first selected line. A threat's id is also
  the `entityId` of its sensor sub-lane and its track row, so "first selected line"
  alone picks the wrong row.
- The `.runtl-select` label needs its own `:hover` and `:active` rules; the global
  `button:hover` and `button:active` outrank the one class.
- `panGlide(follow)` gives the pan, the axis tick group and the overview window
  `transition: none` while Follow is off. The reduced-motion rule in `index.css`
  overrides the inline transition with `!important` on `.runtl-pan`, `.runtl-playhead`,
  `.runtl-axis-svg > g` and `.runtl-over-window`. A new gliding element needs both.
- `seekRunTimeline` calls `scrubTo`, which stops playback and never advances
  observation. The store test `seeks with Follow off and the shown viewport held, and
  never advances observation` guards it.
- `hitAt` reads the `stripLayout` line list that the gutter and the plot draw. `Plot`
  maps the pointer through the pan wrapper's `getBoundingClientRect`, so a hit stays
  right during a Follow glide.
- The wheel listener is native with `passive: false` on `.runtl-scroll`; React's
  `onWheel` is passive and cannot prevent the default. The tooltip's state lives in
  `Tooltip.tsx` behind `TooltipHandle`; a pointer move must not re-render `RunTimeline`,
  `Plot`, `Gutter`, `Axis` or `Overview`.
- `Controls.tsx` and `Tooltip.tsx` export components and types only; pure helpers live in
  `viewportActions.ts` and `tooltipText.ts` (`only-export-components`).
- `src/panels/timeline/` imports guarded modules (`analysis/runTimeline.ts`,
  `charts/timeViewport.ts`, `panels/analysis/controls`). App loads the strip through
  `lazy(import())`; a static import from the entry graph fails `check:entry-graph`.
- `RunTimelineDock` in `App.tsx` reads `open` and `heightPx` itself, so a drag re-renders
  only the dock. A drag calls `setRunTimelineHeight(px, false)` once per frame and saves
  once at its end, only when the height changed.
- The strip draws spans and marks at absolute run-time pixels. One wrapper pans them by
  `panPx(t0S, pxPerS)`; the playhead, the axis tick group and the overview window take
  the same transform and the `GLIDE` transition (`useShownT0.ts`). Each gliding element
  is keyed by its scale, so a zoom or a width change remounts it without a glide. Only
  the pan, the axis and the overview window subscribe to the Follow start; a row
  re-renders on a model, scale or session change.
- The model horizon is `trial.horizon` in Execute and `selectTrialHorizon(s, Infinity)`
  in Analyze. The unobserved region compares only `model.horizonS` with 0 and the run
  duration; no component compares an item time with the horizon.
- `ui.runTimeline.hiddenRows` lives for the session across scenarios. A stale key that
  matches a row of a new scenario hides it, and `Show all` appears.
- `fusedTrack` exists only on a retained trial (`boundRetainedTrial`); a view built from
  an engine result has no fused track rows and no C2 init or firm marks. The summary is
  derived before the per-step drop and keeps no reference to the list.
- `runTimeline.ts` maps an estimate to its sensor by id: `trackId(sensorId, uasId)` for a
  sensor track and the `${sensorId}:false:` prefix for a false track. A change to either
  id format in `tracker.ts` or `falseTracks.ts` empties the quality levels and the false
  track rows with no error.
- Censoring lives in `runTimelineOf` alone. It returns the uncensored row object for a
  row whose items all end at or before the horizon; a component must not copy, sort or
  mutate a row, a span list or a mark list.
- `openLibrary(kind?, modelId?)` in `store.ts` bumps `ui.libraryRequest.seq`; App's
  subscription opens the drawer on a seq change and Palette consumes the request in the
  render-phase adjust pattern. A kind request expands its group for the session only; an
  effect or updater must not write the collapse map to storage.
- The Palette editor view (`editModel` set) renders no resizer; its width is
  `max(saved, 408)`. The resizer and `aria-valuenow` read the list width only.
- `RunControl.tsx` owns the Meta+Enter (Ctrl+Enter) listener on `window`, ignored inside
  inputs, textareas, selects, contenteditable and while `#settings-panel[open]`. App's
  keydown returns early on Meta or Ctrl plus Enter so the boundary and path tools do not
  finish on the run shortcut. Do not add a second listener in App.
- `EmptyRow` and `NoteInfo` live in `panels/analysis/controls.tsx` (already in the
  entry-graph freeze; a new module under `panels/analysis/` fails `check:entry-graph`);
  import them from there. `.empty-row` and `.line-error` sit beside the
  Field rules; a first-run instruction or a status sentence is an `EmptyRow`, an error
  line is for invalid input only, a method note goes behind the (i). Tests match
  `<p class="empty-row">` and the sentence, never the `State` internals.
- `RightTab` is `'inspect' | 'analysis'`; `savedView` drops a saved `'library'` and App
  opens a view without a tab on analysis. `isTypingTarget` is one export in
  `src/ui/typingTarget.ts` (no store import); App and RunControl use it.
- The drawer fit rules are `.board-app :is(.right-panel, .board-library-drawer) …` near
  `index.css` 4870; a drawer-only difference needs its own rule after them.
- Every `DetailSection` in the sensor, effector and C2 panes is `collapsible`; in the
  threat pane, Pd by sensor and Survival are not. The `.det-s[data-open]` exclusion from
  the right-panel wrap override covers the collapsible ones.
- `.frag-info` and `.frag-help` no longer exist; use `.field-info` and `.field-help`.
- `.wg-b[hidden] { display: none }` keeps a collapsed `DetailSection` body hidden; the
  `.wg-b` flex display would otherwise override the attribute.
- The right-panel wrap overrides (`index.css`, the `:is(… .rv)` block near 4845 and the
  `:is(.tb th, .tb td, .wg-t, .wg-m)` block near 4901) make every detail value and
  section title wrap. The collapsible telemetry sections are excluded through
  `.det-s[data-open]`, and `Rows` wraps the value text in `.rv-t` so a tag or drill-in
  stays visible. A new one-line pane needs the same exclusion.
- The e2e reads `.insp-tab-group [role="tab"]`, `#board-phase-*`,
  `.board-app[data-board-phase]`, `.toolbar`, `.timeline` and `.canvas-host`. The
  current screen tab carries `insp-tab-analysis`; Back to overview focuses it.
- `shot.ts` calls `predictionSigmaAtS(est, est.state.tS + flightS)` with
  `flightS = max(0, intercept.tEffectS - (t + es.engageTimeS))`.
  `kinetic.verify.test.ts` still feeds hand-supplied miss sigmas.
  `kinetic.horizon.test.ts` is the regression that uses `predictionSigmaAtS`. Do not
  put `engageTimeS` back into that call.
- Do not change the parity pins in `src/playback/estimate.parity.test.ts` (authorized
  2026-09-21). Do not restore 16, 0, and 0.005.
- A saved builtin that omits `flyoutSpeedMps` adopts the seed cruise speed. An
  interceptor with no positive cruise speed uses `kineticPk`, matching
  `flyoutProfile`. Coyote is 154 m/s and MEROPS is 78 m/s. Roadrunner and Anvil have
  no seed cruise speed, so they stay on the legacy curve.
- `seekerAcquisitionRangeM` gates feasibility only. Nothing reduces miss sigma for a
  seeker-equipped round.
- Physics tab: a checked box selects the prior planning fallback; a cleared box selects
  the physical model when its required fields are present.
- Do not restore `src/analysis/series.ts`, `withBands` or `TRACK_LADDER_STYLE`.
- `panels/analysis/RunControl.tsx` must not import `panels/TimelineBar.tsx`: that edge
  split the store into a `store-*.js` chunk on 2026-09-24 and the entry metric read
  242,488. `selectPlayLabel` lives in `state/selectors.ts` for that reason.
- The transport renders only outside Prepare. `usePlaybackLoop` in `TimelineBar.tsx`
  is mounted by `App`, not by the transport, so the clock runs in every phase. Do not
  move the loop back into the transport.
- `#view-menu-layers` (View menu) and `#frame-add` (transport) are the rail's targets;
  renaming either breaks the Layers or Frames route silently.
- `src/ui/kit.tsx` imports no store. A `useStore` import there makes rolldown split the
  store into a `store-*.js` chunk of about 124,000 gzip bytes that every lazy chunk
  imports, and the entry metric drops to 242,000 while the budget "passes". Pass store
  state into a kit primitive through a prop or a provider.
- No production `as unknown as` remains in model or state. Test fixtures still use
  that cast. `basisJson` (`src/model/basisJson.ts`) sorts object keys and preserves
  array order. `dropEditedProvenance`, `resetBuiltin`, and `sameAppliedOverrides`
  use it.
- A run's identity is its basis signature and the override list it applied. An override
  edit that changes a value in force reaches the store only through the
  `useOverrides.subscribe` line at the end of `src/state/store.ts`. A throw from that
  line is reported to the override boundary in `main.tsx`. The shell in
  `OverrideSubscriber.tsx` stays armed while its alert is showing, so a later throw
  does not leave `setState`. The overrides autosave subscription stays outside that
  boundary. A throw before the shell mounts still leaves `setState`.
- The Systems tab is the only view that shows an override; rings, WEZ, telemetry and the
  Prepare forecast read `trial.scenario` or the board scenario, which keep the library
  value.
- Chunk grids are packed row-major `Float64Array`s (`i * steps + k`). `finish`
  transfers those buffers. Do not structured-clone them onto the page to summarize.
  Progress `done` is the prefix, not every landed index. `discarded` is set only
  when finish commits a hole. The Run button stays Stopping while `pool.stopping`
  is set; `cancel` returns false for that wait.
- `mergePartials` with `release` empties each transferred part as it copies it. The
  summary worker clears the parts list before `finishSummary`. `mergePartials` with
  `prefix` sizes its grids to the contiguous prefix.
- `tQuantile` keeps a one-entry module cache in `src/analysis/stats.ts`.
- The retained track history is a column ledger. `bound.tracks[i]` returns a fresh,
  equal object on each read. `latestEstimatesAt` uses the ledger's indexed horizon
  read. `releaseRetainedTrial` empties only the copy from `boundRetainedTrial`.
- The Fragility Sobol warning is a planning factor from one board: 29 entities at
  2560 rows took 499 s, scaled by entity count and row count, and it fires at half
  of `DEFAULT_BUDGET.timeMs`. It is not a clock reading for the board on screen.
- Load refuses a flight path or boundary with fewer than two points. A placement run
  refuses a boundary with fewer than three. `boundsRefusal` refuses every boundary whose
  non-adjacent edges cross, touch or overlap. In-memory fixtures may still hold an empty
  `points` array (`scenarioHasWork` in `src/io/persist.test.ts`,
  `scenarioInstall.test.ts`). Those objects do not pass `parseScenarioData`.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate that
  touches the entry; it measures the last `dist` and does not build. The entry gzip
  budget is 380,000 bytes (370,778 on 2026-10-02). CSS is not in the entry metric; only JavaScript moves it.
  `sql.js` must stay behind `await import` with its wasm URL.
- `npm run check:entry-graph` (inside `npm run check`) fails when a static value import
  brings a new npm package, or a module under `src/playback/`, `src/analysis/`,
  `src/engine/`, `src/charts/`, `src/panels/analysis/`, the generated data files,
  `seedSystems.ts`, `integrationData.ts` or `io/runtimeSchema.ts`, into
  the entry graph from `src/main.tsx`, and when a frozen module leaves it. Load such a
  module through `import()` or a worker. A rewrite of the freeze with
  `node scripts/check-entry-graph.mjs --write` needs the user's word and the reason in
  the commit. The walk
  reads source, so a module that TypeScript elides as type-only can sit in the freeze
  without being in the built chunk; that is expected. `check:bundle` fails on any
  preloaded JavaScript other than the rolldown and JSX runtime chunks.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- `newId` embeds `Date.now()`. A test that asserts a seed-dependent Monte Carlo outcome
  must build its entities with fixed ids, or its random stream changes with the clock.
- Keep `.board-library-drawer` and `.undo-cue` siblings inside `.board-stage`; the cue
  reads `--library-w` there. The ROE `+N` count comes from one `ResizeObserver` on
  `.status-inline` in `StatusBar.tsx`.
- The top bar grid has equal side tracks, so the tabs hold the center from about
  1115 px; the narrowest supported window is 1024 px.
- A redo adds the scenario it makes current to `redone` (`src/state/scenarioInstall.ts`,
  a session-only `WeakSet`). The canvas context menu is its own chunk.
- Lane worktrees share one `git stash` list. A lane must not use `git stash` while a
  sibling worktree exists, or two lanes can swap their diffs.
  Measure a baseline with `git diff > file` or a separate worktree at the base. A
  worktree outside the repository directory with a `node_modules` symlink to the main
  checkout runs every gate command.
- Prettier wrapping of JSX text can change React `children`. Keep button labels on one
  line, or tests that compare `props.children` to a string will miss the control. See
  `src/ui/ErrorBoundary.tsx`.
- `library:check` and `schema:check` compare generated bytes. Do not hand-edit
  `*.generated.ts` or `src/io/runtimeSchema.ts`. `SavedView` is not in the runtime
  schema; a view record field needs no `schema:generate`.
- Oxlint `only-export-components` warnings already exist; do not add more. `npm run lint`
  does not fail on them.
- The pool's budget is the main thread's: `DEFAULT_BUDGET.retainedNumbers` bounds the
  merged rows the page holds, not a worker. Raising it or `MAX_REPLICATES` in
  `RunTab.tsx` (copied in `ForecastSettings.tsx`) brings the tab crash back on large raids. The check is not a hard cap:
  in-flight chunks can still land.
- A throw inside the react-konva tree never reaches `src/ui/ErrorBoundary.tsx`; only
  `SceneErrorBoundary` sees it. Every layer belongs inside that boundary.
- `sobol-done` carries `result: null` on a cancel. Readers must handle the null.
- Every edit to a registered reference needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails.
  `PROJECT_GUIDE.md` and `ENGINEERING_REFERENCE.md` fingerprint all of `src/`, so every
  source commit invalidates them. `VERIFICATION.md` and `WORKFLOW.md` fingerprint
  `scripts/`, `package.json` and other files; `docs/maintenance.json` lists the inputs.
  A deleted reference needs its `maintenance.json` entry removed. `docs:review` stamps
  `reviewedAt` with the UTC date.
- The weasel-word regex lives in `scripts/silent/rules/weasel-word.yml`, its `-tsx`
  twin, and `WEASEL_WORD` in `scripts/check-silent.mjs`. Change all three together.
- Every silent rule has a `-tsx` twin. The pair must stay identical except `id` and
  `language`.
- `storageManagement.ts` derives live keys from every non-prefix export of
  `storageKeys.ts`. Un-exporting `ANALYSIS_KEY` changes that readout.
- Keep the card data model (`Scenario.testCards`, `TestCard`, `RunLogEntry`, the schema,
  `validateScenario.ts` and the `deleteSelection` cascade) while saved boards carry it.
  `fillScenarioReport` passes an old save's `testCards` through, and `analysisBasis.ts`
  excludes the key only while it is a key of `Scenario`; removing it changes the basis
  signature of old saves.
