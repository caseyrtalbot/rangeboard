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
| 0 | Baseline evidence into the repo | Done 2026-09-06 | `e1a877a` | `docs/field-te/evidence/perf-2026-09-06/`: README, harness, both profiles, `parity-before.json` |
| 1 | Performance hot fixes: React shell and canvas/engine micro | Done 2026-09-06; gate, parity and browser check green; the five dev acceptance targets were not met and are carried to Wave 2 | `10aadd3` | same directory: `profile-dev-after.txt`, `profile-prod-after.txt`, `parity-after.json`, `browser-check.mjs.txt`, `browser-check-after.json`, README "After Wave 1" |
| 2 | Structural performance: Layer split, shared timeline cache, first-play hitch, phase-switch layout thrash, engine hot loop, memory | Not started | | |
| 3 | Bundle and startup: lazy T&E workspace, lazy charts, deferred T&E autosave load, seed data, fonts | Not started | | |
| 4 | Correctness, accessibility, deduplication, docs drift, one browser test | Not started | | |
| 5 | Capabilities: error boundary, storage admission and recovery UI, CI browser test and size budget, then scenario library, bundle export, two-way seam, canvas keyboard access | Not started | | |

Base: branch `codex/board-workspace-ui` at `955ad6b`, one commit ahead of `main`. Gate at base:
typecheck passes, 101 test files and 1414 tests pass, oxlint shows only pre-existing fast-refresh
warnings, `node scripts/check-docs.mjs` passes.

Head after Wave 1: `10aadd3` plus this handoff update. Gate: 101 test files and 1415 tests pass,
63 pre-existing oxlint warnings, build 604 KB gzip. Casey approved the merge to `main` on
2026-09-06; `main` is fast-forwarded to this branch and pushed in the same session as this update.

Measured after Wave 1, script milliseconds per phase, same harness and scenario as section 3:

| Phase | Dev before | Dev after | Prod before | Prod after |
| --- | ---: | ---: | ---: | ---: |
| Load to first canvas | 594 | 542 | 379 | 364 |
| Playback 5 s at 1x | 2387 | 2162 | 1285 | 1103 |
| Playback script share of wall time | 46 percent | 42 percent | 25 percent | 21 percent |
| First-play long task | 157 | 127 | 97 | 82 |
| Zoom, 30 wheel events | 750 | 703 | 197 | 169 |
| Pan drag, 40 moves | 116 | 91 | 78 | 70 |
| moveEntity, 20 edits | 2143 | 1710 | n/a | n/a |
| Select and clear, 10 cycles | 716 | 250 | n/a | n/a |
| Right tabs, 12 switches | 474 | 145 | n/a | n/a |
| Lifecycle phases, 9 switches | 815 | 540 | 287 | 245 |
| Library drawer, 6 toggles | 74 | 78 | 16 | 13 |
| Undo and redo, 10 steps | 371 | 358 | n/a | n/a |

The dev numbers count React elements: in every phase the largest self-time is the React 19.2
development JSX runtime, which builds an `Error` and a `console.createTask` per element and is
absent from the production build. Wave 1 removed the wasted re-renders (right tabs 3.3 times
faster, select 2.9 times, lifecycle 1.5 times). What remains is the element count of legitimate
re-renders: every layer on a zoom, every scenario subscriber on an undo, the whole `LiveScene` on
each of the 120 animation frames per second during playback, the engine on each edit. Wave 2 owns
those. The evidence README carries the analysis and the acceptance table.

## 2. Decisions

Approved by Casey on 2026-09-06:

1. Fix on `codex/board-workspace-ui`. Merge to `main` after Wave 1. The merge itself needs Casey's word
   (given 2026-09-06, with push). Later merges need it again.
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

## 4. Current task: Wave 2, structural performance

Owner `fable-medium` for the code; the orchestrator session reviews, integrates and measures.
Line numbers are at `10aadd3`. Read first: `AGENTS.md`, `docs/ENGINEERING_REFERENCE.md` sections 3,
4 and 7, the evidence README `docs/field-te/evidence/perf-2026-09-06/README.md` ("After Wave 1"),
then `.claude/plans/perf-2026-09-06/lane2-canvas-engine.md` and `lane1-react-render.md` if present
locally.

Shared rules:

- Scenario changes go through `mutate`, view state through `set`, panels subscribe through
  selectors, never write derived state into the scenario, playback derives from `simTimeS` or the
  frame clock. `engagementPicture` and `buildTrackTimeline` are keyed by scenario identity.
- Two spaces, no semicolons, single quotes, named exports, short rationale comments only where needed.
- Run the focused tests for each touched file, then `npm run typecheck` and `npm run lint` before
  reporting. Report: diff summary, checks run with output, anything not done, findings outside scope.

Items:

1. Split the LiveScene Konva Layer (`src/canvas/CanvasStage.tsx:358-382`) into a static Layer
   (Boundary, Footprint, Range, Connection) and a live Layer (WEZ, Path, Engagement, Entity,
   SystemHandle, Callout, marquee). The frame clock stays mounted once, in the live Layer. Same
   child order. The static Layer must not re-render on a frame: its inputs are the scenario, the
   camera and the ui slices it already subscribes to.
2. Shared `buildTrackTimeline` cache keyed by scenario identity (WeakMap, next to `durationOf` in
   `src/state/selectors.ts` or in `src/playback/trackState.ts:388`). Callers today:
   `src/canvas/CanvasStage.tsx:121` and `src/panels/analysis/detail/ThreatDetail.tsx:49`.
3. First-play hitch: the first `advanceRun` applies `observedPatch` and replaces the scenario
   (`src/state/store.ts:452`, `1451-1457`). Stamp on the Play click before the first publication,
   or let `engagementPicture` reuse the previous picture when only presentation fields differ.
   Decide after reading `src/analysis/analysisBasis.ts`.
4. `src/canvas/TrackFileReadout.tsx`: pass LiveScene's `detections` and `trackStates` into
   `threatReadoutAt` (`src/panels/analysis/threatReadout.ts:68`) instead of rerunning the sweep at
   10 Hz.
5. Phase-switch layout thrash: trace one Prepare to Analyze switch, find the measure-write loop
   (recharts responsive containers are the first suspect), fix at the source.
6. Engine hot loop: profile `assessThreat` (`src/playback/sim.ts:290`), `sweepSensorHits`,
   `admittedSlantsM` with the parity harness in place. Hoist per-sensor constants, reuse
   `deterministicPolicy` across threats, avoid per-step allocation in `recordScan`
   (`src/playback/sim.ts:269`). Parity capture before and after.
7. Memory: heap snapshot after 30 edits. If `pictureCache` (`src/analysis/impact.ts:248`) retention
   through `past` (`HISTORY_LIMIT` 100 at `src/state/store.ts:108`) is confirmed, bound the retained
   pictures.

### Integration (orchestrator)

1. Parity: `parity-after.json` is byte-identical to `parity-before.json`, so either is the baseline.
   Copy `parity-capture.ts.txt` to `src/playback/perf.parity.capture.test.ts`, run
   `PARITY_CAPTURE=1 PARITY_TAG=wave2 npx vitest run src/playback/perf.parity.capture.test.ts`,
   `cmp` against `parity-before.json`, then delete the scratch file. Item 6 must not change a byte.
   Item 3 may change no number either: the observed stamp is presentation.
2. `npm run check`.
3. Harness: copy `profile.mjs.txt` and `scenario.json` to a scratch directory as `profile.mjs` and
   `scenario.json`; start `npm run dev -- --port 5377 --strictPort` and `npm run build` outside the
   sandbox; run the dev and prod commands in the evidence README. Record both after-tables in the
   README and in section 1 here.
4. Browser check: `browser-check.mjs.txt` as `browser-check.mjs` against the dev server, outside the
   sandbox. Add: the first Space press shows no long task over the target, a Prepare to Analyze
   switch, and a heap reading after 30 `moveEntity` calls.
5. Docs: `docs/ENGINEERING_REFERENCE.md` section 4 (architecture map) and section 7 for the Layer
   split, the timeline cache and the readout inputs; `npm run docs:review` with a concrete note.
6. Commit on the branch when gate, parity and browser check are green:
   `perf: split the live layer, share the timeline, fix the first-play hitch and the engine hot loop (Wave 2)`.
   Do not push.
7. Update this file: ledger row, after-tables, the new current task (Wave 3).
   `npm run docs:review -- docs/HANDOFF.md --note "..."`. Ask Casey before any merge or push.

### Wave 2 acceptance (dev harness, same scenario; prod recorded beside it)

| Phase | After Wave 1 | Target |
| --- | ---: | ---: |
| Playback script share | 42 percent | at or below 15 percent |
| First-play long task | 127 ms | at or below 40 ms |
| Phase switch forced layouts | about 120 per switch | at or below 20 |
| moveEntity per edit | 85 ms | at or below 40 ms |
| Select and clear per change (carried from Wave 1) | 12.5 ms | at or below 10 ms |
| Zoom per wheel event (carried from Wave 1) | 23 ms | at or below 10 ms |
| Undo and redo per step (carried from Wave 1) | 36 ms | at or below 15 ms |

Parity unchanged. `npm run check` green. No new lint warnings. If a dev target is out of reach
because the remaining cost is a legitimate element count, say so with the prod number beside it
and poll Casey; do not lower a target silently.

## 5. Remaining waves

Each wave is one session. Update section 1 and section 4 at its end.

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
- The dev harness measures React 19.2's development JSX runtime as much as the app: `jsxDEV`
  builds an `Error` and a `console.createTask` per element. Read the prod run for the user-facing
  number; read the dev run for how many elements a re-render creates.
- Konva drag events bubble from a draggable child to its group. A group drag handler must check
  `e.target === e.currentTarget`, or a handle drag moves the entity.
- The Palette focuses its search field on open, so `L` inside the drawer types a letter. Close with
  Escape or press `L` with focus on the canvas.
- The sandbox refuses a listening port: start the dev server and the Playwright scripts outside it.
- The first `advanceRun` replaces the scenario object (`store.ts:1441-1444`). Wave 2 item 3 owns this.
- `engagementPicture` and `buildTrackTimeline` are keyed by scenario identity. Never pass a spread or
  cloned scenario.

## 8. How to update this file

At the end of a wave whose gate passed: fill the ledger row (state, commit, evidence path), replace
section 4 with the next wave's task and acceptance, move any new trap into section 7, then
`npm run docs:review -- docs/HANDOFF.md --note "<wave, what changed>"` and `npm run docs:check`.
Commit the update with the wave. A wave that did not pass leaves this file unchanged.
