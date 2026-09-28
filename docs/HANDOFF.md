# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [README.md](README.md) and the
commit log. This file holds only the position, the current task and the landmines. A
fresh agent starts from this file and the docs index. This file does not authorize a
commit, push or merge.

[timeline/SPEC.md](timeline/SPEC.md) is the run timeline spec and plan (2026-09-26):
four phases that replace the threat-only engagement strip with a multi-row run timeline.
Phases 1 (the model, no UI), 2 (the strip) and 3 (interaction) are on `main` and
`origin/main`. Phase 4 (hardening and close) is complete on `timeline/p4`, not merged
and not pushed. The SPEC plan is complete; this file selects nothing. [Plan.md](Plan.md)
is the completed chrome refactor queue (Rows A to D merged and pushed as `f4363a3`); it
selects nothing.

## Position

- Repository `~/Projects/rangeboard`, checked out on `timeline/p4`, branched from `main`
  at `1c7cd00` (Phase 3). `timeline/p4` holds Phase 4 and waits for the user to
  authorize a fast-forward merge to `main` and a push. No lane worktree or lane branch
  exists; `git worktree list` shows the main checkout only.
- Run timeline Phase 4 (2026-09-28) on `timeline/p4`: one `opus-high` lane in the main
  checkout: the accessibility and contrast commit `c8550e1`, the dead exports `8ba3ec5`,
  the first evidence `cd57691`, its docs `9a09c49`; the orchestrator's index `ef18139`;
  the lane's row windowing `41476e2`, the evidence rerun `fe7e088` and its docs
  `53f002d`; the `fable-medium` design review (read-only); the `opus-medium` fixes
  `cd69b3c` and the evidence rerun `eed39bf`; the orchestrator's docs final review
  `691f301` and this handoff.
- What Phase 4 built. The strip's group name reads `Run timeline. Shown through T+m:ss`
  and adds the word Complete once the horizon reaches the run end. A sensor sub-lane label is
  a `.runtl-select` button that selects the track's threat (a false track sub-lane stays
  text). The window readout carries a visually hidden prefix, the word Window and a
  space (`.runtl-zoom-name`). Every strip ink is a `.runtl` token (`--runtl-*`):
  `RunTimeline.tsx` hands `KIND_INK` to the root as `--runtl-kind-*`, the dark theme
  keeps it with `--ew` and `--de` plus a lighter ghost (`#7b838b`) and a quiet ink
  (`#7e8480`) for the undetected span and the unobserved edge; the two daylight blocks
  map `--runtl-paper-*`, each the lightest value in its own hue that clears 3:1 on the
  panel, the selected ground and at 0.75 opacity (a search). `KIND_INK` is unchanged.
  Row windowing: `lineWindow` in `layout.ts` (one view height of overscan, at least
  `MIN_OVERSCAN_PX` 120) and `useRowWindow.ts` (an external store of the scroll view,
  fed once per frame and by a `ResizeObserver`); the gutter, the grounds and the rows
  draw only the windowed lines while `stripLayout` keeps every line. Dead exports made
  module private: `ROW_H`, `SUB_H`, `runTimeText`, `WHEEL_ZOOM_RATE`, `WHEEL_LINE_PX`.
  Design review fixes: a row name's trailing instance number sits in `.runtl-name-tail`
  and never shrinks, the meta shrinks four times as fast at most 40 percent wide and
  drops when the name starts with it; the blue group square takes the sensor ink; the
  overview draws the cursor (`OverPlayhead`, clock-only, no glide); the resizer shows a
  36 by 2 px `--rule-strong` grip at rest; an effector's rounds-left chip and pk print
  only with 44 px to the next mark in the row.
- Phase 4 measurement
  ([evidence](field-te/evidence/run-timeline-p4-2026-09-28/README.md)): the 54-entity
  performance board at 30x, 1265 by 900, every group and sensor row open (119 lines,
  3,761 SVG nodes before windowing, 1,011 after). Production build, the measurement of
  record: before windowing the expanded strip added about 80 intervals of 20 to 25 ms
  per 10 s (max 33.3 ms); after windowing 0 intervals over 20 ms and 18 over 16.7 ms
  against 15 closed (max 17.5 ms), so the SPEC target passes in production. Dev server:
  the expanded strip still adds 11 to 24 intervals over 33 ms beyond the closed run
  (max 50 ms, down from 83 ms and 15 long tasks); the CPU profile after windowing puts
  the strip's components at about 270 ms of 10 s against `CanvasStage` with
  `trialSeriesOf` at about 820 ms and the React dev runtime, and the closed run itself
  reaches 25 ms on publication frames. The Phase 1 row-reuse follow-up is measured and
  closed without a change: the first build takes 5.7 ms, 265 horizon passes take 1.4 ms
  in total, about 14.9 rows are new per pass. `runTimeline.ts` and `timeViewport.ts`
  are unchanged.
- Phase 4 accessibility and contrast: 187 gutter buttons all named on the full render;
  106 ink pairs per theme, 100 with a floor (4.5:1 text, 3:1 text 3 and graphics,
  summary marks judged at 0.75 opacity), 0 fail in either theme. Before the fix the
  dark theme had 6 failures and daylight 43. Lowest graphic 3.13 dark and 3.01
  daylight; lowest text 4.87 dark and 3.46 daylight. The duration on a dwell or burst
  fill stays in the paper board ink (4.53 and 4.52); text 1 there cannot meet 4.5:1
  while the 0.75 summary floor holds.
- Phase 4 gate on `691f301` (2026-09-28, run by the orchestrator): `npm run check`
  passes (222 files, 2,430 tests, docs and evidence gates green, entry graph 105 of 206,
  build green); `check:silent` passes; `check:bundle` entry 367,140 against 380,000 and
  initial 385,802 against 400,000 (Phase 3: 367,139 and 385,441); `test:e2e` 13 of 13 on
  a dev server at 5411. Lint prints 31 warnings, the same count as `main`. The build
  prints the Vite chunk-size warning as before.
- Phase 4 design review (`fable-medium`, against the mockup): two must-fix (row identity
  lost in the 172 px gutter; daylight inks darkened to 5:1 to 9:1, away from the board)
  and four should-fix (the header square in the EW ink, no overview cursor, no resizer
  grip at rest, effector texts colliding at Fit), all closed in `cd69b3c`. Its nits are
  follow-ups below.
- Phase 4 departures, each with its reason: the daylight inks differ from the board's
  channel inks (the design system says channel colours are the same in both themes)
  because the board inks fall under 3:1 on paper; the overview cursor is in the mockup
  but not in SPEC 1.3; the harness opens every sensor row through
  `expandAllRunTimeline` with whole-run keys, since Expand all opens only the sensor
  rows that hold a track at the current horizon; the S4 gate reads the gap to the next
  mark, so the last mark's pk still prints at Fit; the Phase 4 screenshots stand from
  the review-fix rerun and windowing changes nothing visible.
- Run timeline Phase 3 (2026-09-28), on `main`: the contract `9c6b0e6`
  (orchestrator), the handoff `cfd99d7`, lane 3A `49e6b41` and `ea10324`
  (`opus-medium`, the board link) merged as `2e8609d`, lane 3B `e27f83c` and `f3ce588`
  (`opus-medium`, pointer and keyboard) merged as `50650a4`, the integration `246661b`
  (`opus-medium`), the evidence `000475f`, the docs `f8cc3c1`, the review fixes
  `e643e19` and the evidence rerun `b6b7c0a` (`opus-medium`), and the close `d0f26a3`.
- What Phase 3 built. Store (`ui.runTimeline`): `collapseAllRunTimeline`,
  `expandAllRunTimeline(groups, sensorRows)`, `seekRunTimeline(tS, shown)` (Follow off,
  the viewport held at `shown`, then `scrubTo`) and a `follow` argument on
  `setRunTimelineViewport`; a transition to playing turns Follow on. `useShownT0.ts`:
  `shownViewport` (the viewport on screen at event time) and `panGlide` (the pan, the
  axis ticks and the overview window glide only with Follow on). `hit.ts`: `hitAt`, the
  nearest mark within 6 px, else the span on top. `useRunTimelineSelection.ts`: a row
  label click selects the entity (a track row its threat, a false track nothing); a
  board selection highlights every line that draws the entity and scrolls to the
  entity's own row (`scrollTargetLine`: the non-track row, else its summary or fold
  line, else the first line). `useRunTimelineSeek.ts`: a mark click seeks; a span click
  does nothing. `Tooltip.tsx` and `tooltipText.ts`: the hover tooltip with the kind, the
  row, the model text, the mono data line and the horizon line; it lives inside the
  `.runtl` root, holds `{ hit, model }` and renders `liveHit` (nothing for a stale
  model); Escape closes it in the capture phase and the item stays dismissed until the
  pointer leaves it. `Controls.tsx` and `viewportActions.ts`: Follow (`aria-pressed`),
  Zoom out, the window readout, Zoom in, Fit, Collapse all, Expand all (every group and
  every sensor row); `zoomStep`, `wheelZoom`, `panBy`, `pinchFactor`, the overview grab
  and place math. `useViewportGestures.ts`: a native `passive: false` wheel listener on
  `.runtl-scroll`; Ctrl or Meta wheel and WebKit pinch zoom about the cursor, a
  horizontal wheel pans and turns Follow off, a vertical wheel scrolls the rows.
  `Overview.tsx`: a pointer drag moves the window and turns Follow off. CSS: the
  controls, the tooltip, the `.runtl-select` label (chrome free on hover and press), the
  `.selected` line and `.runtl-ground-selected` ground, the grab cursors and the
  reduced-motion override.
- Phase 3 gate on `b6b7c0a` (2026-09-28): `npm run check` passes (222 files,
  2,418 tests, docs and evidence gates green, entry graph 105 of 206, build green);
  `check:silent` passes; `check:bundle` entry 367,139 against 380,000 and initial
  385,441 against 400,000 (Phase 2: 367,029 and 385,027); `test:e2e` 13 of 13
  on a dev server at 5397. The build prints the Vite chunk-size warning as before.
- Phase 3 browser check
  ([evidence](field-te/evidence/run-timeline-p3-2026-09-28/README.md)), 1265 by 900,
  JIATF-401 laydown, headless Chromium, dark theme: every SPEC 1.5 interaction and 1.3
  control passes, `observedThroughS` is read from the store before and after each item
  and moves only where the script plays by design, 0 page errors. WebKit pinch
  (`gesture*` events) is untested.
- Phase 3 reviews. The `opus-high` diff review found one must-fix (a board selection
  scrolled to the first line that drew the entity, so a threat's track row won and the
  threat row stayed out of view) and should-fix items: Escape reached App's board Escape
  and cleared the selection; Escape then a 1 px move reopened the tooltip; the
  hook-runtime `Tooltip.test.tsx`; the pinch factor inline and untested; `.runtl-select`
  hover and active chrome; three doc sentences. The `fable-high` observation check
  confirmed from the store, the tests and the evidence that no interaction advances
  `observedThroughS`: the only writes are the clock's advance and complete transitions
  while playing and the `newRun` reset. Its gaps (no store test for the
  `patchRunTimeline` actions and `select`, none for Play with Follow on, no browser item
  for the × hide control) are closed. All must-fix and the listed should-fix items are
  closed in `e643e19`; the rest are follow-ups below.
- Phase 3 departures from the SPEC and the mockup, each with its reason: new files
  `hit.ts` (both lanes need one hit rule, and the Node tests have no DOM), `Controls.tsx`,
  `tooltipText.ts` and `viewportActions.ts` (a `.tsx` file exports components only);
  Expand all also opens every sensor row (the mockup); a summary or fold line highlights
  for a selected member (groups start collapsed); a false track label is text (it selects
  nothing); the pan glides only with Follow on (a gesture pan renders at once); a mark
  click seeks and a span click does nothing (SPEC 1.5 names marks; the mockup also seeks
  on spans); the tooltip omits a mark `text` or span `label` equal to the row label; the
  overview SVG sets `touch-action: none`; the zoom buttons disable at the window limits;
  a zoom with Follow on keeps the zoomed width while Follow sets the start from the clock
  again, so the cursor anchor and the center rule hold with Follow off (the mockup
  behaves the same); a selection that exists when the strip opens is highlighted but not
  scrolled to (`useScrollToSelection` acts on a change of `selection.entityIds`); an
  open tooltip hides on a model change; Escape with a tooltip open does not reach the
  board.
- Run timeline Phase 2 (2026-09-27) on `timeline/p2`: the contract commit `4f63211` (the
  `ui.runTimeline` slice with its session actions, and a stub lazy target), lane 2A
  `8be6b60` and `bb9a182` (`opus-high`, the strip), lane 2B `c5b6449` and `3f1672c`
  (`opus-medium`, persistence, mount, resizer, toggle, e2e), the merges `34c663f` and
  `3cf96c0`, then the integration (`opus-high`): `d43ec18` (the old strip deleted),
  `2bcacfb` (the layout order of the mockup), `020e540` (the entry-graph freeze
  rewrite), `80d9de7` (evidence), `46b2897` (docs), `3e1c397` (the SPEC link), then the
  review fixes `8e58df2` and `abb1b64` (`opus-medium`) and this handoff.
- What Phase 2 built. `src/panels/timeline/`: `RunTimeline.tsx` is the connected root
  and its own lazy chunk (about 8.3 kB gzip); `Gutter.tsx`, `Plot.tsx`, `LaneMarks.tsx`
  (`LaneItems`), `Axis.tsx`, `Overview.tsx`; `fold.ts` (the GROUP_AT fold); `layout.ts`
  (`stripLayout`, `playheadX`, `spanBox`, `panPx`); `useShownT0.ts` (`GLIDE`). The strip
  draws groups collapsed to a summary row, group expansion, sensor sub-lanes, the fold,
  the × hide control, `Show all (n hidden)`, the header with the horizon, the axis and
  the overview. `ui.runTimeline` in `store.ts`: `open` persists under
  `ENGSTRIP_OPEN_KEY`, `heightPx` under `RUN_TIMELINE_HEIGHT_KEY`
  (`rangeboard.runtimeline.height`), the rest is session only. `App.tsx`:
  `RunTimelineDock` and `RunTimelineResizer`. `TimelineBar.tsx`: the `Timeline` toggle
  `#run-timeline-toggle`. Deleted: `EngagementStrip.tsx`, its test, `censorLane.ts` and
  `SEVERITY_RANK`.
- Phase 2 gate on `abb1b64` (2026-09-27): `npm run check` passes (215 files, 2,349
  tests, docs and evidence gates green, entry graph 105 of 206, build green);
  `check:silent` passes; `check:bundle` entry 367,029 against 380,000 and initial
  385,027 against 400,000 (Phase 1: 368,901 and 386,438); `test:e2e` 13 of 13 on a dev
  server at 5393. The build prints the Vite chunk-size warning (index 1,254.72 kB against
  1,250 kB); `main` prints it at 1,260.26 kB.
- Phase 2 browser check
  ([evidence](field-te/evidence/run-timeline-p2-2026-09-27/README.md)), 1265 by 900,
  JIATF-401 laydown (`detection-outside-rings.json`), 30x: frame intervals max 24.9 ms
  with the strip open (one over 20 ms, none over 33 ms) and 16.8 ms closed; the drawn
  marks equal the censored model at four paused times; a scrub leaves
  `observedThroughS` unchanged; Analyze draws 532 of 532 marks and keeps them after a
  scrub back; the height survives a reload; 0 page errors.
- Phase 2 reviews. The `opus-high` diff review found no must-fix. Should-fix: the axis
  jumped while the rows glided; the Analyze horizon followed the cursor; the playhead
  was clipped at the run end; `stripLayout` had no test. Nits: the fold label count, a
  storage write per drag frame, a click that saved a clamped height, the first paint at
  scale 0, the playhead rounding. All closed in `8e58df2`.
- Spec text Phase 2 departed from, each with its reason: the contract commit wrote the
  slice and its session actions so both lanes built on real types (the SPEC table gives
  the store to 2B; 2B added the persistence); the layout is header, rows, axis,
  overview, as in the mockup; no dock mounts in Prepare, because the transport and its
  toggle render only outside Prepare (D9), so the SPEC 1.1 Prepare line has no place;
  the no-trial line reads the SPEC text; durations print on flight, burst and dwell spans
  only, `after` on effector rows only and `text` on C2 assign marks only, as in the
  mockup; fold rows and sub-lanes have no × control; no legend; burst uses `--de`; the
  kind inks come from `KIND_INK`; `setRunTimelineHeight` takes `persist`; the SPEC line
  5 link to the deleted strip is code text so `docs:check` passes, and
  `docs/maintenance.json` moves the SPEC review input to `RunTimeline.tsx`. No tooltip,
  row selection or mark seek exists until Phase 3; the old strip's name-click select and
  plot drag scrub are gone.
- Run timeline Phase 1 (2026-09-26) on `timeline/p1` from `f4363a3`, merged to `main` as
  `019d747`. Lane 1B's first run stalled for 600 s with nothing on disk; resumed with
  writes of about 150 lines and a WIP commit, it finished.
- What Phase 1 built. `ThreatAssessment.fusedTrack` (`FusedTrackSummary` in `sim.ts`):
  `boundAssessment` derives the first and last fused step, each C2 node that held the
  fused picture and each member sensor, each with its first step, before it drops the
  per-step list. `runTimelineOf(view, horizonS)` in `src/analysis/runTimeline.ts`: the
  groups, rows, sub-lanes, spans and marks of SPEC 1.2, censored once at the lesser of the
  horizon and `observedThroughS`, memoized per view with four models per horizon, a fully
  reached row returned as the same object. `src/charts/timeViewport.ts`: `clampViewport`,
  `followViewport`, `zoomViewport`, `viewportTicks`, `xOf` and `DEFAULT_WINDOW_S`,
  `MIN_WINDOW_S`, `FOLLOW_AT`, `ZOOM_STEP`. The Phase 2 strip imports both.
  ENGINEERING_REFERENCE carries the model paragraph and the summary text.
- Spec text Phase 1 departed from, each with its reason: the summary is `{ initAtS,
  lastAtS, nodes, members }` in place of `memberSensorIds` (the C2 row needs every node
  that held the picture; the track row meta needs first steps to censor the member
  list); ticks reuse `tickStepS`, so they sit at least 70 px apart, not 64; a mark exactly
  at the horizon draws (`reached` is inclusive; section 1.4 says "at or past"); the
  GROUP_AT fold of same-named threats is not in the model (the contract has no fold
  shape; lane 2A builds it); `jamDecisions` is not read (every effect mark prints the
  event pk; no rule uses the continue-jam outcome); a fused track row appears at its
  first fused step even when an assignment came first; after a kill the ghost runs to
  the planned arrival, else to the path end, and in-range windows stop at the kill; the
  C2 row marks init on every node that held the fused picture and firm on the nodes that
  held it by then.
- Run timeline design (2026-09-26): the grilling settled the tree recorded in
  `timeline/SPEC.md` section 1; the mockup is
  <https://claude.ai/artifact/PYWeMH5tEhE9fNS9uhrBEt> (synthetic trial, both themes,
  Playwright-checked, 0 page errors). Facts the plan relies on: the Execute trial is one
  precomputed draw and playback moves a cursor; `retainTrial.ts` drops per-step
  `fusedTracks` from each assessment; `trialSeries.ts` already derives hold, coast,
  window, preparation, flight, dwell and beam spans; no activation or per-decision
  operator record exists.
- Entry budget rework (`8ac3bf6`, 2026-09-25): the entry ceiling in `check-bundle.mjs` is
  380,000. The chunk boundary is `scripts/check-entry-graph.mjs` with its freeze
  `scripts/entry-graph.json`, run by `npm run check`; `check:bundle` also freezes the
  preloaded JavaScript to the rolldown and JSX runtime chunks.
- Row D (2026-09-25) ran as four lanes in `~/Projects/rangeboard-wt/d1..d4` on
  `chrome/d1..d4` from `8ac3bf6`: D1 `b14f642` (`opus-high`), D2 `069f87a` (`opus-high`),
  D3 `809f802` (`opus-high`), D4 `695d20d` (`opus-medium`). `chrome/int` (checked out in
  the main checkout) holds the Row D plan commit `d7231ea` and the four lane merges to
  `e9e6a18`. `chrome/d-int` (worktree `~/Projects/rangeboard-wt/int`) continues from there:
  the integrator folds `87ce397`, the two placeholder folds `954e517` and `a23865b`, the
  design system `efaf7e0`, the docs reviews `531ef2c`, and the `opus-high` review fixes
  `fbe6ac5` (one must-fix: the drawer resizer wrote the list width from the editor view;
  four should-fix: two status sentences moved from an error line and an (i) to empty-state
  rows, the Run key hint hidden from the accessible name, and handler tests for Palette,
  ContextMenu and LibraryEditor).
- Row D gate on `chrome/d-int` (2026-09-25): `npm run check` passes (211 files, 2,287 tests,
  docs and evidence gates green, entry graph 107 of 208, build
  green), `test:e2e` 13 of 13 on a dev server at 5395, `check:bundle` entry 368,760 against
  380,000 and initial 386,297 against 400,000. The lanes cost 587 entry bytes over the
  Row C 368,173.
- What Row D built. D1: a store action `openLibrary(kind?, modelId?)` that bumps
  `ui.libraryRequest.seq`; App subscribes and opens the drawer; Palette expands and focuses
  the kind's group, or shows `LibraryEditor` in the drawer in place of the list at no less
  than 408 px with a `Back to library` control; the five `setRightTab('library')` callers
  (Palette New model and Model basis, CommandPalette model commands, ContextMenu Edit model
  specs, LibraryEditor) use it; the right-panel editor mount and the contextual `Model
  library` tab are gone; `Place asset` calls `openLibrary('asset')`. D2: Run Monte Carlo is
  a default 28 px button; `Run sensitivity` with the method in the (i); the Validity header
  carries the finding count as a tag; finding rows are glyph, headline and chevron with the
  severity word as the glyph title; the sweep help reads the replicates per cell and the
  value rule; the SweepMap caption sentence became a chip with `Place asset`. D3:
  `Deterministic (no sampling)` (D10); the forecast line in mono text 1 without `· total`;
  the `None` placeholder; the Run monitor card (`.live-card`: clock, progress bar,
  Replicate, Seed, Speed rows); Placement, Outcome, Debrief and Compare sentences moved to
  placeholders, error lines, (i) titles and `EmptyRow`s; tile values at 15 px; Replay and
  Retry icon-only; the Run button `⌘↵` hint with a Meta+Enter (Ctrl+Enter) listener in
  `RunControl`. D4: the sensor, effector and C2 panes take the C3 pattern (Model basis row,
  no trial line, collapsible sections with mono summaries); the RCS and Swerling provenance
  squares are gone; the active tab underline is text 1; the `.lens*` rules are deleted;
  `.frag-info` and `.frag-help` folded into `.field-info` and `.field-help`.
- Plan text the build departed from, each with its reason: the Back control is the
  mirrored chevron icon with the word Library, not the `‹` glyph (a chrome control uses the
  icon set); `RightTab` keeps 'library' because `viewState.ts`, `store.test.ts` and the e2e
  still name it (a follow-up); the Replicate row shows the trial's replicate index, not
  `12 / 80` (the Execute trial is one draw; pool progress is in the status bar); the 15 px
  tile value applies to every `.tv`, Fragility and RunHistory included; the board ground
  was not changed: there is no Konva ground fill, `.canvas-host` sets `--surface-board`
  (`#121313`) with a 3.5 percent grain, and the capture's `#212528` matches the grid inks
  in `src/ui/ink.ts`, so the sample hit a grid line; the sweep-map chip is a second chip
  keyed to the sweep response, separate from the sensitivity chip.
- The authorized estimate-path recapture is `225e027`. Its expects: layered events 11,
  layered kill mass 1, layered kills mean 1.115, JIATF leakers mean 0.895, JIATF kills
  mean 0.105. `4.68` is not a pin.
- The flight horizon is `7fdcb1e`.

## Follow-ups (not fixed)

Handling: candidates, not rows. Row D took the Row C review items and the class 2, 3 and 4
canvas deviations. What remains:

From run timeline Phase 4:

- The dev-server frame rule fails on the 54-entity board fully expanded (11 to 24
  intervals over 33 ms beyond the closed run) while the production build passes. The
  profile after windowing puts the remaining cost in `CanvasStage` (`trialSeriesOf`), the
  React dev runtime and react-konva, with the strip's components at about 270 ms per
  10 s. A further cut would be horizontal windowing of the 5 s hold chunks, or row
  object reuse in `runTimeline.ts` (about 14.9 new rows per horizon pass); both need a
  new measurement first.
- The C2 assign labels (`Coyote Block 2 interceptor 1`, printed at each assign mark)
  overlap each other at Fit on JIATF-401; the 44 px gate covers effector rows only.
- The duration on a dwell or burst fill prints in the paper board ink on daylight. Text 1
  there needs the 0.75 summary-opacity floor to drop, a design decision.
- Design review nits: the summary label is Archivo `All sensors` at a 26 px indent, the
  mockup's is mono `all sensors` at 18 px; row meta is Archivo 11 px, the mockup's
  `.count` is mono; the header buttons are 24 px `.mini` in the 28 px header, the mockup
  uses 20 px; the playhead has no top cap, the mockup draws a 5 px triangle; the Analyze
  header reads `Shown through T+25:00`, the mockup `Complete · T+25:00` (the accessible
  name does say Complete). The mockup's legend is absent.
- Expand all opens only the sensor rows that hold a track at the current horizon; a row
  that gains its first track later stays collapsed. Expand all does not open threat
  folds (`openFolds`).
- A focused gutter button that scrolls far out of the row window unmounts and loses
  focus; Tab order still reaches the next lines through the overscan.
- No unit test drives the Controls handlers, the horizontal-wheel pan, the Overview drag,
  the Escape close or the scroll listener of `useRowWindow`; the browser evidence covers
  them. The Node tests have no DOM.
- `.runtl-plot` takes `onClick` with no keyboard path; the transport covers the seek.
- A Ctrl wheel over the gutter anchors at `t0S` because the anchor clamps to the plot's
  left edge.
- The strip's Collapse all and Expand all share their names with the inspector ⋯ menu
  items.
- `.chip.mc` (`index.css`) is dead, from the Row D list; the timeline phases left no
  dead `.runtl` rule.

From run timeline Phase 2:

- Long model names still truncate in the 172 px gutter; since Phase 4 the instance number
  survives the ellipsis and the `title` holds the full name.
- At the default 240 px height in Execute, the Threats group sits below the scroll fold.
- The strip component tests leave `openSensors` set between tests, so they depend on
  order. No unit test drives the App resizer; the e2e and the capture cover it.
- `docs/Plan.md` line 214 names the deleted `EngagementStrip` mount; it is the completed
  chrome plan.

From run timeline Phase 1 (each needs a user decision):

- The C2 assignment row: `runTimeline.ts` routes each assignment with `killChainRoutes`
  over the full-run `detectingSensorIds`, as `attrition.ts` does, so a sensor that first
  detects after the horizon can move an assignment mark between C2 rows. The fix records
  the assigning node on `EngagementEvent` in attrition, an engine change that SPEC 1.6
  excludes from this plan.
- The engine sweep ignores kills: sensor holds, the fused track and the track ramp run to
  the path end after the last member falls, as the board's TrackLayer shows. The timeline
  follows the engine picture; clipping at the kill is a product decision.
- A node that held the fused picture and lost it before the firm time still gets a firm
  mark on its C2 row. An empty trial and a zero duration have no model test.

From the Row D review:

- Muted full sentences remain on changed screens: `FragilityScreen.tsx` about 592, 597,
  733, 736, 773; `LiveStrip.tsx:69` (the no-trial placeholder, kept because `PlayPrompt`
  was out of scope); the detail panes' `No …` empty lines (SensorDetail 95, 213, 232, 254,
  276; EffectorDetail 139, 239; SystemDetail 134, 147, 160; ThreatDetail 287, 302);
  `SystemStatus` lines inside the Outcome and Debrief disclosures.
- The Validity header dropped the VALID or PENDING verdict word when there are no
  findings; decide whether the verdict needs a home on the Fragility screen.
- The objective direction (`Maximize leakers.`) lives only in the Placement response (i).
- `RunControl.tsx` duplicates App's `isTypingTarget`; `PlacementScreen` no longer
  duplicates `EmptyRow`.
- `.chip.mc` (`index.css` about 3378) is dead; `.chip.det` has one user (`SystemsTab`).
  `.empty-row` and `.line-error` sit after the run-strip block; move them beside the Field
  rules at the next CSS pass. The four drawer rules D1 added copy the `.right-panel` rules
  near 5205; fold with `:is(.right-panel, .board-library-drawer)`.
- `RightTab` still includes 'library'; `viewState.ts` `RIGHT_TABS`, `store.test.ts:1049`
  and e2e line 82 name it. Narrow the type and drop App's saved-view mapping together.
- `DetailHeader.tsx:53` aria-label `Back to the lens stack` names the removed lens UI.
- `TrialOutcomeSummary` (`DebriefRecord.tsx`) has no production caller; `.outcome-metric
  strong` still uses the 24 px value size.
- The Palette editor view follows `selection.libraryId`: selecting a board entity returns
  the list without dismissing the request. Escape closes the whole drawer from the editor.
- Opening the editor still clears the entity selection, as the old callers did; the right
  panel falls back to the analysis screens while the model edits on the left.
- `DetailTable` cells in the collapsible sections (gates, doctrine, hops, timing) still
  wrap through the `:is(.tb th, .tb td, …)` block and carry no `title`.

From the engine profile of 2026-09-25 (100 replicates of the 54-entity board on one
Node thread, 95 ms per replicate, flat profile; a Rust port was assessed and declined
because the gain would be about 2x to 4x on work that already runs off the page thread):

- `shnidmanPdFromSnr` (`src/playback/radarDwell.ts`) is the largest self time at 11
  percent, plus 4 percent in its forward call: a 24-step bisection per uncached SNR.
  A precomputed table over SNR per (pfa, pulses, swerling) or a closed-form inverse
  would remove the bisection. The cache and the fixed-ID parity expects bound the change.
- The sweep step (`stepSweep` in `src/playback/sweep.ts`; `sensorHit` and the sweep's
  `hits` in `src/playback/detection.ts`) and `dist` and `bearingDeg` in
  `src/geometry/geo.ts` together take about 30 percent;
  entity and member state as typed arrays inside one sweep would cut the object reads.
- Garbage collection is 5 percent: `trackSamples` and `fusedTracks` grow one object per
  step per threat in `assessThreat`, and `scenario.entities.find` runs inside the
  attrition loops. Preallocated per-step buffers and an id index would remove both.

From the Row B review, still open:

- The rail's Frames button is disabled in Prepare with the reason only in its title; a
  route into Execute that focuses `#frame-add` would serve D4 better.
- No test covers the rail routes (`openLayers`, `openFrames`) or that Pause and Resume
  stay enabled in Execute under deterministic mode.
- Library rows draw the friend-frame dome for sensor, effector, C2 and asset kinds;
  per-subtype shapes need new `Glyph.tsx` shapes.
- `F2` focuses the scenario name only while focus is inside the header; the drawer
  toggle's icon no longer shows the open state.
- Some `+ Frame` and popover items have no static-render test.

From the `fable-medium` canvas comparison, class 1 (structure) items still open:

- Entity view keeps a second tab level (Telemetry · Configure · Model basis) under the
  one tab row, so P3 stays open there.
- Outcome: `Export debrief JSON` is a second accent-filled control and `New clean run` is
  a rival run verb beside the top-bar `Run again` (P1).
- Run monitor keeps body buttons `New run` and `Forecast and analysis` under Sensors (D7).
- Run monitor sections are `Kill chain`, `Effectors`, `Sensors` as 15 px headings; the
  canvas shows Engagements (open), Tracks and Run validity as 32 px collapsible rows with
  counts; no Run validity section exists in Execute.
- Inputs carries the `Entity register` list and a `Run validity` block with full finding
  paragraphs; the canvas shows findings as one collapsed row with a count and tag.
- Inputs repeats the scenario name and run id in its header (P2) with an INVALID tag;
  the canvas card reads `Scenario inputs` with a PENDING tag.
- Fragility has no `Monte Carlo` section header or (i); the 15 px `Fragility` heading
  repeats the tab label.
- Open findings show the `Gates:` line and a Select button; `Review finding scope` is one
  disclosure at the bottom, not a dense button per finding.
- Sweep factor selects carry the unit in the option text; the section (i) sits at the far
  right, not beside the title.
- Panel options: the switch has no visible state; `Reset section layout` and the
  separator are absent; Collapse all and Expand all are disabled on the Configure view.
- Configure view of a sensor: `East (km)` and `North (km)` keep the unit in the label
  (P6), Heading is a slider with a value box, and the section names are muted labels,
  not 32 px collapsible rows; the canvas shows Lat, Lon, Elevation and Heading with mono
  suffixes; three muted sentences remain.

## Tasking

**Nothing is selected.** The [timeline/SPEC.md](timeline/SPEC.md) plan is complete:
Phases 1 to 3 are on `main`, Phase 4 is on `timeline/p4` with the gates green, the
evidence indexed, the docs reviewed and the design review fixes closed. The mockup link
in the SPEC stays as the design record.

- Pending user action: authorize a fast-forward merge of `timeline/p4` to `main` and a
  push. After the merge, delete the `timeline/p4` branch and rewrite the Position here.
- The follow-ups above are candidates, not rows. A next task needs a plan or a user
  decision first.

## Landmines

- Run timeline (see [timeline/SPEC.md](timeline/SPEC.md) section 5): keep
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
  opacity); a change to one, or a new ink, needs the contrast rerun of the Phase 4
  capture script in both themes.
- `OverPlayhead` in `Overview.tsx` subscribes to `selectSimTimeS` alone and has no glide;
  the overview picture must not read the clock.
- A row name with a trailing space and digits (`/ \d+$/`) renders as `.runtl-name-head` plus
  `.runtl-name-tail`; the head keeps the trailing space, so the button text equals the
  label. Tests match that markup. The meta is left out when the label starts with it.
- An effector mark's `after` and pk print only when the gap to the next mark in the row
  is at least `LABEL_MIN_PX` (44 px); marks come sorted by time from `laneOf`.
- The window readout markup is `<span class="runtl-zoom"><span class="runtl-zoom-name">Window </span>120 s</span>`;
  a test matches it exactly.
- The strip's group name is `Run timeline. Complete. Shown through T+m:ss` once
  `horizonS >= durationS`; the Analyze fixture run is 60 s, so its test expects
  `Complete`.
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
- `EmptyRow` and `NoteInfo` are exported from `panels/analysis/DebriefRecord.tsx` and used
  by Outcome, Compare and Placement. `.empty-row` and `.line-error` are the generic rules;
  a first-run instruction or a status sentence is an `EmptyRow`, an error line is for
  invalid input only, a method note goes behind the (i).
- Every `DetailSection` in the sensor, effector, C2 and threat panes is `collapsible`;
  the `.det-s[data-open]` exclusion from the right-panel wrap override covers them all.
- `.frag-info` and `.frag-help` no longer exist; use `.field-info` and `.field-help`.
- `.wg-b[hidden] { display: none }` keeps a collapsed `DetailSection` body hidden; the
  `.wg-b` flex display would otherwise override the attribute.
- The right-panel wrap overrides (`index.css`, the `:is(… .rv)` block near 5154 and the
  `:is(.tb th, .tb td, .wg-t, .wg-m)` block near 5203) make every detail value and
  section title wrap. The collapsible telemetry sections are excluded through
  `.det-s[data-open]`, and `Rows` wraps the value text in `.rv-t` so a tag or drill-in
  stays visible. A new one-line pane needs the same exclusion.
- `Field` renders a `<label>` root while both `help` and `error` are undefined, and a
  framed `<div>` root once either is passed. Pass `error=''` while a value is valid, or
  the control remounts on every validity change and loses focus.
- The e2e reads `.insp-tab-group [role="tab"]`, `#board-phase-*`,
  `.board-app[data-board-phase]`, `.toolbar`, `.timeline` and `.canvas-host`. The
  current screen tab carries `insp-tab-analysis`; Back to overview focuses it.
- Collapse all and Expand all act on `#insp-tabpanel details` and `.det-s-toggle`; a
  third collapse pattern in the panel body needs `panelSections` in `App.tsx`.
- `shot.ts` calls `predictionSigmaAtS(est, est.state.tS + flightS)` with
  `flightS = max(0, intercept.tEffectS - (t + es.engageTimeS))`.
  `kinetic.verify.test.ts` still feeds hand-supplied miss sigmas.
  `kinetic.horizon.test.ts` is the regression that uses `predictionSigmaAtS`. Do not
  put `engageTimeS` back into that call.
- Do not change the estimate-path expects above. Do not restore 16, 0, and 0.005.
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
- The transport renders only outside Prepare (D9). `usePlaybackLoop` in `TimelineBar.tsx`
  is mounted by `App`, not by the transport, so the clock runs in every phase. Do not
  move the loop back into the transport.
- `#view-menu-layers` (View menu) and `#frame-add` (transport) are the rail's D4 targets;
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
  touches the entry. The entry gzip budget is 380,000 bytes with 11,827 bytes of headroom
  (368,173 at the Row C gate). CSS is not in the entry metric; only JavaScript moves it.
  `sql.js` must stay behind `await import` with its wasm URL.
- `npm run check:entry-graph` (inside `npm run check`) fails when a static value import
  brings a new npm package, or a module under `src/playback/`, `src/analysis/`,
  `src/engine/`, `src/charts/`, `src/panels/analysis/` or the generated data files, into
  the entry graph from `src/main.tsx`, and when a frozen module leaves it. Load such a
  module through `import()` or a worker, or rewrite the freeze with
  `node scripts/check-entry-graph.mjs --write` and name the reason in the commit. The walk
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
  sibling worktree exists; two lanes that popped at once swapped their diffs in polish3.
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
  `RunTab.tsx` brings the tab crash back on large raids. The check is not a hard cap:
  in-flight chunks can still land.
- A throw inside the react-konva tree never reaches `src/ui/ErrorBoundary.tsx`; only
  `SceneErrorBoundary` sees it. Every layer belongs inside that boundary.
- `sobol-done` carries `result: null` on a cancel. Readers must handle the null.
- Every edit to a registered reference needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails.
  `PROJECT_GUIDE.md` and `ENGINEERING_REFERENCE.md` fingerprint all of `src/`, so every
  source commit invalidates them; `VERIFICATION.md` fingerprints `src/io/` and `scripts/`.
  `docs:review` stamps `reviewedAt` with the UTC date.
- The weasel-word regex lives in `scripts/silent/rules/weasel-word.yml`, its `-tsx`
  twin, and `WEASEL_WORD` in `scripts/check-silent.mjs`. Change all three together.
- Every silent rule has a `-tsx` twin. The pair must stay identical except `id` and
  `language`.
- `storageManagement.ts` derives live keys from every non-prefix export of
  `storageKeys.ts`. Un-exporting `ANALYSIS_KEY` changes that readout.
- `selectObservedThroughWholeS`, `bandNote`, `bandStep`, and `TrialOutcomeSummary`
  have no importer. Un-exporting one of them fails `noUnusedLocals`. Do not delete
  them and do not add a suppression to keep them private.

## Evidence

- [Run timeline Phase 4 browser check, 2026-09-28](field-te/evidence/run-timeline-p4-2026-09-28/README.md)
- [Run timeline Phase 3 browser check, 2026-09-28](field-te/evidence/run-timeline-p3-2026-09-28/README.md)

- [Run timeline Phase 2 browser check, 2026-09-27](field-te/evidence/run-timeline-p2-2026-09-27/README.md)
- [finishSummary time at the retained cap, 2026-09-23](field-te/evidence/finish-summary-cap-2026-09-23/README.md)
- [Flight-horizon measurement, 2026-09-21](field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md)
- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
