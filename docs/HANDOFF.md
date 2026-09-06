# RangeBoard refactor handoff

This is the one handoff for the performance and quality refactor that follows the Board workspace
UI refactor (`955ad6b`). It is central and tracked. Update it only at the end of a wave whose gate
passed, in the same commit as that wave. Do not write a second handoff for this refactor.

The review that produced this plan ran on 2026-09-06. Its five lane reports and the measurement
harness are local, ignored working files under `.claude/plans/` on Casey's machine; the tracked
baseline lives under `docs/field-te/evidence/perf-2026-09-06/` once Wave 0 lands. This file carries
every instruction a session needs; the lane reports add detail, not requirements.

## 1. Status ledger

| Wave | Scope | State | Commit | Evidence |
| --- | --- | --- | --- | --- |
| 0 | Baseline evidence into the repo | Not started | | `docs/field-te/evidence/perf-2026-09-06/` |
| 1 | Performance hot fixes: React shell and canvas/engine micro | Not started | | after-capture in the same evidence directory |
| 2 | Structural performance: Layer split, shared timeline cache, first-play hitch, phase-switch layout thrash, engine hot loop, memory | Not started | | |
| 3 | Bundle and startup: lazy T&E workspace, lazy charts, deferred T&E autosave load, seed data, fonts | Not started | | |
| 4 | Correctness, accessibility, deduplication, docs drift, one browser test | Not started | | |
| 5 | Capabilities: error boundary, storage admission and recovery UI, CI browser test and size budget, then scenario library, bundle export, two-way seam, canvas keyboard access | Not started | | |

Base: branch `codex/board-workspace-ui` at `955ad6b`, one commit ahead of `main`. Gate at base:
typecheck passes, 101 test files and 1414 tests pass, oxlint shows only pre-existing fast-refresh
warnings, `node scripts/check-docs.mjs` passes.

## 2. Decisions

Approved by Casey on 2026-09-06:

1. Fix on `codex/board-workspace-ui`. Merge to `main` after Wave 1. The merge itself needs Casey's word.
2. Keep the deterministic engine on the main thread and optimize it. No worker offload of `engagementPicture`.
3. Commit the measurement harness and both profile outputs as dated evidence under `docs/field-te/evidence/perf-2026-09-06/`.
4. Keep recharts. Lazy-load it in Wave 3.
5. Wave 5 starts with the error boundary, storage admission, and the CI browser test.

Standing rules for this refactor: no per-slice approvals; poll Casey at a real choice with one
recommendation; commit on the branch when the integrated gate is green; never push or merge without
being told; owner types are `opus-high` for mechanical work with a fixed contract, `fable-medium` where
judgment is needed, and the orchestrator session integrates and reviews.

## 3. Measured baseline at 955ad6b

Headless Chromium (Playwright 1.62), 1400 by 900, right panel 320, scenario "Layered (Acoustic +
MEROPS)": 54 entities, 9 paths, 39 connections, 8 raid waves. Script milliseconds per phase.

| Phase | Dev | Prod | Note |
| --- | ---: | ---: | --- |
| Load to first canvas | 594 | 379 | Dev fetches 218 modules, 19.2 MB; prod 5 files, 2.3 MB |
| Idle 3 s | 5 | 5 | No idle churn |
| Playback 5 s at 1x | 2387 | 1285 | 46 percent of wall time in script (dev), 25 percent (prod); first-play long task 157 ms dev, 97 ms prod |
| Zoom, 30 wheel events | 750 | 197 | 25 ms per event dev, 6.6 ms prod |
| Pan drag, 40 moves | 116 | 78 | Konva native drag |
| moveEntity, 20 edits | 2143 | n/a | 20 long tasks of 105 ms; prod has no `window.__store` |
| Select and clear, 10 cycles | 716 | n/a | 36 ms per change |
| Right tabs, 12 switches | 474 | n/a | 40 ms per switch |
| Lifecycle phases, 9 switches | 815 | 287 | about 120 forced layouts per switch in both builds |
| Library drawer, 6 toggles | 74 | 16 | |
| Undo and redo, 10 steps | 371 | n/a | 37 ms each; engine cache held |

Causes, ranked: every scenario edit reruns the full deterministic engine on the main thread
(`engagementPicture` is keyed by scenario identity and every `mutate` replaces the scenario;
`modelFor` is a linear library scan worth 13 ms per edit); the refactor made `App` subscribe to the
whole `selection` and `scenario` objects so every click re-renders the tree twice and writes
localStorage; per-frame Konva reconciliation from one shared Layer, inline array literals and
hover state; whole-`camera` subscriptions on zoom; layout thrash on phase switch; one 2.1 MB chunk
with no code splitting and synchronous T&E autosave validation before first paint.

## 4. Current task: Wave 0, then Wave 1

### Wave 0. Baseline evidence into the repo (integrator)

1. Create `docs/field-te/evidence/perf-2026-09-06/`. Copy from the local harness directory:
   `profile.mjs` as `profile.mjs.txt` (preserved scripts use `.txt`, see the verification guide),
   `profile-dev.txt`, `profile-prod.txt`, `scenario.json`.
2. Write `docs/field-te/evidence/perf-2026-09-06/README.md`: capture date, commit `955ad6b`, browser and
   viewport, the scenario shape, the table in section 3, and the two run commands. State that the numbers
   describe `955ad6b` only.
3. Add one line under "Captured checks" in `docs/README.md` linking the new README.
4. `npm run docs:check`. For each reported reference, read the changed input, then
   `npm run docs:review -- <doc> --note "<what you checked>"`.
5. Commit on the branch: `docs: preserve the 955ad6b performance baseline (perf-2026-09-06)`. Do not push.

### Wave 1. Performance hot fixes

Two parallel lanes with disjoint files, both `opus-high`. Read first: `AGENTS.md`,
`docs/ENGINEERING_REFERENCE.md` sections 3 and 7, then the lane reports if available locally.

Shared rules:

- Touch only the owned files. Preserve the other lane's edits; both lanes share the tree.
- Scenario changes go through `mutate`, view state through `set`, panels subscribe through selectors,
  never write derived state into the scenario, playback derives from `simTimeS` or the frame clock.
- Two spaces, no semicolons, single quotes, named exports, short rationale comments only where needed.
- Run the focused tests for each touched file, then `npm run typecheck` and `npm run lint` before reporting.
- Report: diff summary, checks run with output, anything not done, findings outside the owned files.

#### Lane A: React shell

Owned: `src/App.tsx`, `src/state/store.ts` (two guards only), `src/panels/Palette.tsx`,
`src/panels/Toolbar.tsx`, `src/panels/BoardPreparation.tsx`,
`src/panels/analysis/widgets/ThreatPictureWidget.tsx`, `src/panels/Inspector.tsx` (one subscription),
`src/canvas/CanvasStage.tsx` (the `memo` wrapper on the export only).

Line numbers are at `955ad6b`.

1. `src/App.tsx:261-262`. Replace the whole `selection` and `scenario` subscriptions with primitive
   selectors: the single selected entity id or null (only when the entity exists), a boolean for any
   object selection (entityIds, boundaryId or connectionId), and a selection key string
   (`entityIds.join('|')`) for the `entityView` memory at 264-267. `selectedEntity` at 268-269 is used
   only for `.id` at 595.
2. `src/App.tsx:347-351`. Depend on the boolean. Skip when `useStore.getState().ui.rightTab === 'inspect'`.
3. `src/state/store.ts:1330-1333` (`setRightTab`): return early when the tab is unchanged, before
   `writeView`. `src/state/store.ts:1296-1302` (`select`): return the current state when the merged
   selection equals the current one field by field (`entityIds` in order, `boundaryId`, `connectionId`,
   `libraryId`, `cardId`). This also fixes the undo tab jump and the section memory reset.
4. `src/App.tsx:272-300, 542`. `useCallback` for `openTelemetry` (read the selection key through
   `useStore.getState()` at call time) and `placeAt` (deps `[placement]`). `memo` on the CanvasStage export.
5. `src/App.tsx:278-291, 532` and `src/panels/Palette.tsx`. `useCallback` for `closeLibrary` and
   `armPlacement` (deps `[]`). `memo(Palette)`.
6. `src/panels/Toolbar.tsx:180`. Subscribe to `ui.layers.threatWez` only; use it at 250.
7. `src/panels/BoardPreparation.tsx:47`. Move the `mc` subscription into a wrapper around `McPopover`.
8. `src/panels/analysis/widgets/ThreatPictureWidget.tsx:30`. Use `selectObservedThroughStep`.
9. `src/panels/Inspector.tsx:569`. Drop the `camera` subscription; read it inside `suggest()`.
10. `src/App.tsx:414-478`. Remove the `libraryOpen` dependency with a functional setter. Delete the
    unreachable Escape branch at 453-457. Split the Escape at 428-434: the Location dialog Escape closes
    the dialog only; the calibrate Escape keeps `cancelDraft` and `setTool('select')`.

Tests: `npx vitest run src/panels/Toolbar.test.tsx src/panels/Palette.test.tsx src/panels/BoardPreparation.test.tsx src/panels/Inspector.test.tsx src/state/store.test.ts src/state/store.analysis.test.ts src/panels/AnalysisPanel.test.tsx`.
Add a store test for the two guards, sized like its neighbors in `src/state/store.test.ts`.

#### Lane B: canvas and engine micro

Owned: `src/canvas/**` except the `memo` wrapper on the `CanvasStage` export, `src/playback/detection.ts`,
`src/model/scenario.ts`.

1. `src/model/scenario.ts:4-8` (`modelFor`). Build a `Map<string, SpecModel>` per library array identity
   (module-level `WeakMap<SpecModel[], Map>`). Same return for a missing id. No signature change.
2. `src/canvas/layers/EntityLayer.tsx:125, 191, 387`. `perfectDrawEnabled={false}` on the FriendFrame
   `Path`, the hostile diamond and the formation member `RegularPolygon`.
3. Hoist every inline `dash={[...]}` and `points={[...]}` literal in `src/canvas` to module constants
   (13 dash sites, 18 points sites). Memoize `wedgePoints` in FootprintLayer `Ring` (105, 123) and
   `JammerNode` (645, 647) on `[pos.x, pos.y, headingDeg, sectorDeg, radiusM]`. Memoize the per-render
   `flatMap` arrays in PathLayer (29, 70).
4. `src/canvas/CanvasStage.tsx:51, 321-325`. Keep `mouseWorld` in a ref. Set state only while a draw or
   calibrate tool or a marquee is active (PathLayer reads it only then: 60-66, 85-87). Give HudLayer its
   own pointer position from a stage `mousemove` listener registered in a `useEffect` on `stageRef`.
5. `src/canvas/layers/FootprintLayer.tsx:706-743`. `memo(FootprintLayer)`. Compute `activeSensorIds` once
   in `LiveScene` and pass the `Set`. Replace the whole-`ui` subscription at 708 with field subscriptions
   (`ui.units`, `ui.basemap`, `ui.layers`, `ui.ringOverrides`; `useShallow` where an object is needed).
6. `src/canvas/layers/EntityLayer.tsx:242-248` and `src/canvas/layers/SystemHandleLayer.tsx:57-69`.
   Preview rotation with local Konva node rotation during the drag. Commit one `updateEntity` or
   `rotateSystem` on `dragEnd`. One undo entry per gesture.
7. Subscribe to `camera.scale` where x and y are not read: EngagementLayer.tsx:34, CalloutLayer.tsx:20,
   RangeLayer.tsx:14, ConnectionLayer.tsx:10, ThreatWezLayer.tsx:103, PathLayer.tsx:18, HudLayer.tsx:11,
   TrackFileReadout.tsx:46. In EntityLayer read `camera.x/y` inside handlers through `useStore.getState()`.
   Move `fontSize={n / k}` Text nodes (PathLayer.tsx:52, 103, 128; ConnectionLayer.tsx:75;
   BoundaryLayer.tsx:51) into `scale={1 / k}` Groups with a constant font size.
8. `src/canvas/layers/EntityLayer.tsx:263-337`. Memoize per node `color`, `boardName`, `labelLines`,
   `sectorDeg` on `[entity, model]`. In `src/canvas/LiveScene.tsx:67-78` precompute per-entity label
   inputs on `scenario.entities` so `layoutLabels` does geometry only per frame. `listening={false}` on
   the EntityNode inner shapes other than the hit disc.
9. `src/playback/detection.ts:177-222` (`sweepSensorHits`). Build the sensor spec lookup once per call.
   Pure, no store import.

Tests: `ls src/playback/*.test.ts src/canvas/*.test.tsx` first, then run the detection, sim, trackState,
accuracy, impact and canvas test files. Steps 1 and 9 touch engine inputs; the integrator runs parity.

#### Integration (orchestrator)

1. Before either lane lands, capture the parity baseline at `955ad6b` per the verification guide: fixed
   IDs, seed and settings; deterministic, aleatory MC, total MC and sensitivity. Use
   `src/playback/__fixtures__/detection-outside-rings.json` and
   `docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json`. Keep the capture in
   `docs/field-te/evidence/perf-2026-09-06/parity-before.json`.
2. After both lanes: `npm run check`. Compare parity. Any numerical difference from Lane B steps 1 or 9
   is a defect, because both are pure lookups.
3. Rerun the harness against dev with the same scenario. Start the dev server yourself
   (`npm run dev -- --port 5377 --strictPort`), then
   `node profile.mjs scenario.json http://localhost:5377 dev` from the harness directory. The Chromium
   launch fails inside the Claude sandbox with a Mach port error; run that command with the sandbox
   disabled. Record the after-table in the evidence README and in section 1 of this file.
4. Browser check at 1400 by 900, panel 320: canvas click selection, entity drag, heading rotate (one undo
   entry), Space to play, wheel zoom, hover while paused, Library drawer, phase switches, undo and redo
   keep the right tab.
5. Docs: check `docs/ENGINEERING_REFERENCE.md` section 7 against the `mouseWorld`, HudLayer and
   drag-commit changes; update in the same change and `npm run docs:review` with a concrete note.
6. Commit on the branch when gate, parity and browser check are green:
   `perf: stop the selection re-render cascade; Konva repaint and engine lookup fixes (Wave 1)`. Do not push.
7. Update this file: ledger rows for Wave 0 and Wave 1 with commits, the after-table, and the new current
   task (Wave 2). `npm run docs:review -- docs/HANDOFF.md --note "..."`. Include in the Wave 1 commit.
8. Ask Casey for the merge to `main`.

#### Wave 1 acceptance (dev harness, same scenario)

| Phase | Baseline | Target |
| --- | ---: | ---: |
| moveEntity per edit | 105 ms | at or below 60 ms |
| Select and clear per change | 36 ms | at or below 10 ms |
| Playback script share | 46 percent | at or below 25 percent |
| Zoom per wheel event | 25 ms | at or below 10 ms |
| Undo and redo per step | 37 ms | at or below 15 ms |

Parity unchanged. `npm run check` green. No new lint warnings.

## 5. Remaining waves

Each wave is one session. Update section 1 and section 4 at its end.

### Wave 2. Structural performance (`fable-medium`, orchestrator reviews)

1. Split the LiveScene Konva Layer (`src/canvas/CanvasStage.tsx:344-368`) into a static Layer (Boundary,
   Footprint, Range, Connection) and a live Layer (WEZ, Path, Engagement, Entity, SystemHandle, Callout,
   marquee). Frame clock stays mounted once in the live Layer. Same child order.
2. Shared `buildTrackTimeline` cache keyed by scenario identity, next to `durationOf` in
   `src/state/selectors.ts` or in `trackState.ts`. Removes the double build in CanvasStage and ThreatDetail.
3. First-play hitch: `advanceRun` applies `observedPatch` and replaces the scenario (`store.ts:1441-1444`).
   Stamp on the Play click before the first publication, or let `engagementPicture` reuse the previous
   picture when only presentation fields differ. Decide after reading `analysisBasis.ts`.
4. `TrackFileReadout`: pass LiveScene's `detections` and `trackStates` into `threatReadoutAt` instead of
   rerunning the sweep at 10 Hz.
5. Phase-switch layout thrash: trace one Prepare to Analyze switch, find the measure-write loop (recharts
   responsive containers are the first suspect), fix at the source.
6. Engine hot loop: profile `assessThreat` (`sim.ts:80`), `sweepSensorHits`, `admittedSlantsM` with the
   parity harness in place. Hoist per-sensor constants, reuse `deterministicPolicy` across threats, avoid
   per-step allocation in `recordScan`. Parity capture before and after.
7. Memory: heap snapshot after 30 edits. If `pictureCache` retention through `past` (up to 100 scenarios)
   is confirmed, bound the retained pictures.

Acceptance: playback script share at or below 15 percent dev; first-play hitch at or below 40 ms; phase
switch layouts at or below 20; moveEntity at or below 40 ms. Parity unchanged.

### Wave 3. Bundle and startup (`opus-high`)

1. `React.lazy` the T&E Ops workspace (`src/App.tsx:6`, `480-484`) with a `Suspense` boundary. About 112 KB gzip.
2. `React.lazy` the three chart shells in `src/charts` (TimeSeries, Tornado, Ladder) so recharts leaves the
   initial graph. About 106 KB gzip. Call sites unchanged.
3. Split `startTeAutosave` into subscribe and restore; restore on idle or on first entry to Ops
   (`src/te/io/persistTe.ts:92-93`, `src/main.tsx:14`). Move `parseAutosave(scenarioSnapshot)` from
   `fillCampaign` (`persistTe.ts:34-38`) to config open.
4. Emit `runtimeShapes` as `JSON.parse('...')` in `src/io/generateRuntimeSchema.mjs`.
5. Dynamic import for `INTEGRATION_PROFILES` consumers; lazy accessors for the three teStore seed tables
   (`teStore.ts:52-54`, `validate.ts:8`).
6. `React.lazy` LibraryEditor, TestCardsPanel, AnalysisPanel, CommandPalette.
7. Preload the two 400-weight woff2 faces in `index.html`. Subset JetBrains Mono to Latin.
8. `build.chunkSizeWarningLimit` last.

Acceptance: initial chunk at or below 400 KB gzip (baseline 597 KB); build warning-free; Board and Ops
load and switch; PROJECT_GUIDE execution section updated and reviewed.

### Wave 4. Correctness, accessibility, deduplication (`opus-high`, `fable-medium` review)

1. `DebriefRecord.tsx:191`: `open` when the run completes, `role="status"` on the summary.
2. Escape precedence with the Location dialog while a placement is armed (`App.tsx:310-321`); a
   "Calibrating, Esc cancels" strip while `tool === 'calibrate'`; cancel placement on entity or system
   count change instead of any scenario write (`App.tsx:324-326`).
3. Accessibility: lens tabs render only when the Overview tab shows analysis, or use `role="group"` with
   `aria-pressed` (`AnalysisNavigation.tsx:53-67`); `role="application"` on the canvas host
   (`CanvasStage.tsx:279-280`); Range setup, View and File dialogs move focus on open; entity heading `h3`.
4. One `usePopover(wrapRef, buttonRef)` hook for Toolbar, RangeSetupMenu and ViewMenu; one
   `nextTabIndex(key, index, length)` helper for the four roving tablists; one `THEMES` constant; remove or
   use `AnalysisPanel` `showNavigation` and `showDetail`; delete `data-open` and the dead `autoFocus` in Palette.
5. Docs: correct the ENGINEERING_REFERENCE two-viewport overflow claim and the standalone AnalysisPanel
   sentence; add the scenario-write placement cancel to PROJECT_GUIDE, or remove it with item 2.
6. One Playwright spec that loads the firing fixture through `window.__store`, exercises phase switching,
   placement, selection routing and the Escape chain, and asserts store state. Wire it into CI in Wave 5.

### Wave 5. Capabilities, in order

1. Error boundary around each `WidgetFrame` child, each print view and each workspace root, rendering the
   design-system `State` with Export and Reload actions. Autosave stays outside React.
2. Storage admission for T&E frames and snapshots (reuse `MAX_IMAGE_CODE_UNITS`), a storage readout, and a
   Storage section that lists, downloads and deletes recovery copies. Replace the recovery `alert`.
3. CI: run the Wave 4 Playwright spec and a bundle size budget in `.github/workflows/quality.yml`.
4. Named scenario library: an index key plus one body key per scenario, an active pointer, a Toolbar
   switcher. `loadScenario` stays the one load path. Never rename existing keys.
5. Bundle export (`rangeboardBundle: 1`: scenario, library, runs, campaigns) and run import as a
   read-only record.
6. Two-way seam: "Open on Board" for a stored config snapshot; a distinct prediction record beside a
   measure, labeled as a modeled estimate, never an observation.
7. Canvas keyboard access: Prepare register covers paths, boundaries, connections and waves; arrow-key
   nudge through `mutate`; a `?` shortcut overlay reusing `ShortcutList`.
8. Decide `mcdaWeights` and `scorecards`: build a scorecard widget, or document both as legacy and stop
   validating them.
9. Named restore points and run compare on top of item 4.
10. File System Access save to a working file.

## 6. Verification protocol for every wave

1. `npm run check` at the end of each lane and after integration.
2. Engine, store or playback touches: fixed-ID parity capture before and after (verification guide).
3. UI touches: real browser check on the dev server at 1400 by 900 with the saved 320 px panel width.
4. Performance touches: rerun the harness against dev and against a production preview with the same
   scenario file. Record the numbers in the evidence README and in section 1 here.
5. Docs touched by a change are updated in the same change and acknowledged with `npm run docs:review`.
6. Commit on the branch when green. Push or merge only when Casey says so.

## 7. Traps

- `window.__store` and `window.__teStore` exist only in dev builds (`src/main.tsx:17`). A production
  harness drives the UI; the harness already does this when the store hook is absent.
- The in-app Browser pane runs hidden when Casey is not watching; `requestAnimationFrame` stops there.
  Measure with the headless harness.
- Playwright's Chromium launch needs the sandbox off (`bootstrap_check_in ... Permission denied`).
- macOS `base64` decodes with `-D -i <file>`.
- `.claude/launch.json` and `.claude/settings*.json` are not writable from the sandbox.
- `select()` always allocates (`store.ts:1296`) until Lane A step 3 lands.
- The first `advanceRun` replaces the scenario object (`store.ts:1441-1444`). Wave 2 item 3 owns this.
- `engagementPicture` and `buildTrackTimeline` are keyed by scenario identity. Never pass a spread or
  cloned scenario.

## 8. How to update this file

At the end of a wave whose gate passed: fill the ledger row (state, commit, evidence path), replace
section 4 with the next wave's task and acceptance, move any new trap into section 7, then
`npm run docs:review -- docs/HANDOFF.md --note "<wave, what changed>"` and `npm run docs:check`.
Commit the update with the wave. A wave that did not pass leaves this file unchanged.
