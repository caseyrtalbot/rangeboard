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
| 2 | Structural performance: Layer split, shared timeline cache, first-play hitch, phase-switch layout thrash, engine hot loop, memory | Done 2026-09-06; gate, parity and browser check green; first-play and phase-switch targets met, four dev targets open for Casey's decision (section 4) | `ae55f0a` | same directory: `profile-dev-wave2.txt`, `profile-prod-wave2.txt`, `browser-check-wave2.json`, `browser-check.mjs.txt` (extended), README "After Wave 2", "Parity after Wave 2", "Memory after Wave 2" |
| 3 | Bundle and startup: lazy T&E workspace, lazy charts, deferred T&E autosave load, seed data, fonts; plus the open-target change set (per-threat assessment memo, identity lending, pixel-snapped callouts) | Done 2026-09-06; gate, parity and browser check green; every Wave 3 criterion met; moveEntity and undo met in dev, playback, zoom and select closed on the prod numbers (section 2) | `00e25e5`, `442c1b0` | same directory: `profile-dev-wave3.txt`, `profile-prod-wave3.txt`, `browser-check-wave3.json`, `browser-check.mjs.txt` (extended), README "After Wave 3", "Parity after Wave 3", "Memory after Wave 3", "Browser check after Wave 3" |
| 4 | Correctness, accessibility, deduplication, docs drift, one browser test | Not started | | |
| 5 | Capabilities: error boundary, storage admission and recovery UI, CI browser test and size budget, then scenario library, bundle export, two-way seam, canvas keyboard access | Not started | | |

Base: branch `codex/board-workspace-ui` at `955ad6b`, one commit ahead of `main`. Gate at base:
typecheck passes, 101 test files and 1414 tests pass, oxlint shows only pre-existing fast-refresh
warnings, `node scripts/check-docs.mjs` passes.

Head after Wave 3: `442c1b0` plus this handoff update. Gate: 203 test files and 2838 tests pass,
63 pre-existing oxlint warnings, entry chunk 246 KB gzip, build warning-free. Not merged to
`main`; the merge needs Casey's word. The replicate test that failed once in Wave 2 now builds
its laydown with fixed ids.

Measured after Wave 3, script milliseconds per phase, same harness and scenario as section 3:

| Phase | Dev after Wave 2 | Dev after Wave 3 | Prod after Wave 2 | Prod after Wave 3 |
| --- | ---: | ---: | ---: | ---: |
| Load to first canvas | 450 | 419 | 326 | 280 |
| Playback 5 s at 1x | 1385 | 842 | 583 | 461 |
| Playback script share of wall time | 28 percent | 17 percent | 12 percent | 9 percent |
| First-play long task | none | none | none | none |
| Zoom, 30 wheel events | 450 | 407 | 117 | 124 |
| Pan drag, 40 moves | 82 | 76 | 69 | 67 |
| moveEntity, 20 edits | 1339 | 426 | n/a | n/a |
| Select and clear, 10 cycles | 204 | 210 | n/a | n/a |
| Right tabs, 12 switches | 93 | 105 | n/a | n/a |
| Lifecycle phases, 9 switches | 503 | 478 | 239 | 230 |
| Lifecycle forced layouts, 9 switches | 33 | 31 | 34 | 32 |
| Library drawer, 6 toggles | 72 | 77 | 16 | 16 |
| Undo and redo, 10 steps | 271 | 146 | n/a | n/a |

Wave 3 acceptance: entry chunk 245.75 kB gzip (target 400; the preloaded initial set is 365 kB
of JS plus 14 kB of CSS), build warning-free, Board and Ops load and switch, one recharts
surface in every time-series widget of every lens, load to first canvas dev 419 and prod 280
(targets 450 and 326), PROJECT_GUIDE reviewed. Open Wave 2 targets after the debugger's change
set, dev harness: moveEntity 21 ms per edit with no long task (target 40, met), undo and redo
14.6 ms per step (target 15, met), playback 17 percent (target 15; prod 9), zoom 13.6 ms per
event (target 10; prod 4.1), select and clear 10.5 ms per change (target 10; all of it the
Inspector mount). Fixed-ID parity byte-identical. Memory: 30 edits grow the heap by 4.6 MB.
The evidence README carries the attribution and the element-count correction for Wave 2.

## 2. Decisions

Approved by Casey on 2026-09-06:

1. Fix on `codex/board-workspace-ui`. Merge to `main` after Wave 1. The merge itself needs Casey's word
   (given 2026-09-06, with push). Later merges need it again.
2. Keep the deterministic engine on the main thread and optimize it. No worker offload of `engagementPicture`.
3. Commit the measurement harness and both profile outputs as dated evidence under `docs/field-te/evidence/perf-2026-09-06/`.
4. Keep recharts. Lazy-load it in Wave 3.
5. Wave 5 starts with the error boundary, storage admission, and the CI browser test.
6. The open Wave 2 dev targets, 2026-09-06, after one debugger pass with the brief "find a
   solution inside the invariants or show that none exists": moveEntity and undo and redo are
   met. Playback script share, zoom and select and clear close on the production numbers
   (playback 9 percent, zoom 4.1 ms per event, no long task in any phase); their dev numbers
   stay in the evidence README as the React development runtime's element cost. No imperative
   Konva update outside render.

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

## 4. Current task: Wave 4, correctness, accessibility, deduplication

Owner `opus-high` for items 1 to 5 (mechanical work with a fixed contract), `fable-medium` for
item 6 and for the review; the orchestrator session integrates and reviews. Line numbers are at
`442c1b0`. Read first: `AGENTS.md`, `docs/ENGINEERING_REFERENCE.md` sections 3 and 7,
`docs/PROJECT_GUIDE.md`, `docs/VERIFICATION.md`, the evidence README
`docs/field-te/evidence/perf-2026-09-06/README.md` ("Browser check after Wave 3"), then
`.claude/plans/perf-2026-09-06/lane4-correctness.md` if present locally.

Shared rules:

- Scenario changes go through `mutate`, view state through `set`, panels subscribe through
  selectors. `loadScenario` stays the one load path. Storage keys are never renamed. The worker
  value-import graph stays independent of stores, React and panels. The Wave 3 lazy boundaries
  stay where they are; a Board-side write into the T&E store calls `restoreTeAutosave()` first.
- Two spaces, no semicolons, single quotes, named exports, short rationale comments only where needed.
- Run the focused tests for each touched file, then `npm run typecheck` and `npm run lint` before
  reporting. Report: diff summary, checks run with output, anything not done, findings outside scope.

Items:

1. `DebriefRecord.tsx:191`: the `<details>` gets `open` when the run completes; `role="status"`
   on its summary.
2. Escape precedence with the Location dialog while a placement is armed: the placement listener
   at `App.tsx:461-471` runs in the capture phase and the dialog Escape at `App.tsx:590-595` in
   the bubble phase; the open dialog must win. A "Calibrating, Esc cancels" strip while
   `tool === 'calibrate'`. Cancel the placement on an entity or system count change instead of
   any scenario write (`App.tsx:474-476`).
3. Accessibility: lens tabs render only when the Overview tab shows analysis, or use
   `role="group"` with `aria-pressed` (`AnalysisNavigation.tsx:56-70`); `role="application"` on
   the canvas host (`CanvasStage.tsx:288-290`); Range setup, View and File dialogs move focus on
   open; entity heading `h3`.
4. One `usePopover(wrapRef, buttonRef)` hook for Toolbar, RangeSetupMenu and ViewMenu (each owns
   a pointer-outside listener today); one `nextTabIndex(key, index, length)` helper for the four
   roving tablists (find them by `role="tablist"`: the lifecycle nav in `App.tsx`,
   `AnalysisNavigation.tsx` and two more); one `THEMES` constant; remove or use `AnalysisPanel`
   `showNavigation` and `showDetail` (`AnalysisPanel.tsx:30-38`; `App.tsx` passes both false);
   delete `data-open` (`Palette.tsx:266`) and the dead `autoFocus` (`Palette.tsx:285`).
5. Docs: correct the ENGINEERING_REFERENCE two-viewport overflow claim and the standalone
   AnalysisPanel sentence; add the scenario-write placement cancel to PROJECT_GUIDE, or remove
   it with item 2.
6. One Playwright spec that loads the firing fixture through `window.__store`, exercises phase
   switching, placement, selection routing and the Escape chain, and asserts store state. Wire
   it into CI in Wave 5.

### Integration (orchestrator)

1. `npm run check`; the build must stay warning-free.
2. Browser check: extend `browser-check.mjs.txt` with the Escape chain (placement armed, then
   the Location dialog open), the calibrate strip, the debrief `open` on run completion and the
   lens tab roles.
3. Harness: rerun load, playback and zoom in dev and prod as section 6 says; no regression from
   the accessibility changes.
4. Docs: `docs/ENGINEERING_REFERENCE.md` section 7 and `docs/PROJECT_GUIDE.md`;
   `npm run docs:review` with a concrete note per document.
5. Commit on the branch when gate and browser check are green:
   `fix: correctness and accessibility pass, dedupe the popover and roving-tab helpers (Wave 4)`.
   Do not push.
6. Update this file: ledger row, the new current task (Wave 5).
   `npm run docs:review -- docs/HANDOFF.md --note "..."`. Ask Casey before any merge or push.

### Wave 4 acceptance

Every new browser-check assertion passes; the Playwright spec passes locally; harness load,
playback and zoom at or below the Wave 3 numbers (dev 419 ms, 17 percent, 13.6 ms per event;
prod 280 ms, 9 percent, 4.1 ms); ENGINEERING_REFERENCE and PROJECT_GUIDE reviewed.
`npm run check` green. No new lint warnings.

## 5. Remaining waves

Each wave is one session. Update section 1 and section 4 at its end.

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
   The preserved `browser-check.mjs.txt` also asserts the first Space press raises no long task
   over 40 ms, one Prepare to Analyze switch forces at most 20 layouts, and reads the CDP heap
   after 30 `moveEntity` edits.
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
- The Play click and a reset stamp `observedPresetId` through `observedPatch` in `startRun` and
  `resetRun`. A stamp that already matches replaces nothing; a new stamp is a presentation variant
  (`markPresentationVariant`), so `engineKeyOf(scenario)` still names the object the engine caches
  hold. Any new scenario-keyed cache keys on `engineKeyOf`, and must not retain the picture beyond
  the eight `pictureCache` keeps: the timeline cache keys on the picture's assessments array for
  that reason, and a scenario-keyed entry that held the picture pinned 20 MB through `past`.
- `engagementPicture`, `trackTimelineOf` and `sweepAt` are keyed by engine identity. Never pass a
  spread or cloned scenario.
- A test laydown needs fixed ids: the draw keys hash entity, path and connection ids, so a
  laydown built with time-based `newId` ids gives the replicates a different sample set on
  every run. `src/playback/mcRun.test.ts` failed that way once in the Wave 2 gate; its laydown
  now uses a local counter.
- `assessThreatsIncremental` (`impact.ts`) reuses a threat's assessment while its recorded
  inputs are the same objects. A new read inside `assessThreat` of a scenario field, or of an
  entity kind the input list does not carry, makes the memo stale: extend the shared list or
  `threatEntityInputs` in the same change, and the edit-kind test in `impact.test.ts` must
  stay byte-identical to `assessAllThreats`.
- Spoke callout geometry snaps to whole pixels in `labelLayout.ts`. A new placement field must
  be snapped or compared the same way, or the callouts re-render every frame again.
- `startTeAutosave` writes nothing until `restoreTeAutosave` has run, and the restore latches on
  a module-level flag: only the first call in a test file restores. A Board-side write into the
  T&E store (frame capture today) must call `restoreTeAutosave()` first.
- `applyPreset` on the T&E store is async (it imports the three seed tables); a caller that
  reads state after it must await it.
- `LibraryEditor` is imported statically by `EntityWorkspace`; a lazy boundary in `App.tsx`
  moves no bytes and rolldown reports an ineffective dynamic import.
- Vite rewrites a `<link rel="preload">` href in `index.html` only when it points at a source
  asset path (`/src/assets/...`); check the built page and the built CSS resolve to the same
  hashed file, or the preload fetches a second copy.
- `performance.memory.usedJSHeapSize` is quantized to about 50 MB steps in headless Chromium
  without precise-memory-info. Read `Runtime.getHeapUsage` over CDP after
  `HeapProfiler.collectGarbage`.
- A recharts `CartesianGrid` with `vertical={false}` still measures the label of every data row
  with `getBoundingClientRect` on first mount unless it gets an empty coordinate generator.

## 8. How to update this file

At the end of a wave whose gate passed: fill the ledger row (state, commit, evidence path), replace
section 4 with the next wave's task and acceptance, move any new trap into section 7, then
`npm run docs:review -- docs/HANDOFF.md --note "<wave, what changed>"` and `npm run docs:check`.
Commit the update with the wave. A wave that did not pass leaves this file unchanged.
