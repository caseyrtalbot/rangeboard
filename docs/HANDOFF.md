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
| 4 | Correctness, accessibility, deduplication, docs drift, one browser test | Done 2026-09-07; gate, browser check and the shell spec green; every acceptance number at or below Wave 3 | `0219d21` | same directory: `profile-dev-wave4.txt`, `profile-prod-wave4.txt`, `browser-check-wave4.json`, `browser-check.mjs.txt` (extended), README "After Wave 4", "Browser check after Wave 4"; the tracked spec `scripts/e2e/board-shell.e2e.mjs` |
| 5 | Capabilities: error boundary, storage admission and recovery UI, CI browser test and size budget, then scenario library, bundle export, two-way seam, canvas keyboard access | Not started | | |

Base: branch `codex/board-workspace-ui` at `955ad6b`, one commit ahead of `main`. Gate at base:
typecheck passes, 101 test files and 1414 tests pass, oxlint shows only pre-existing fast-refresh
warnings, `node scripts/check-docs.mjs` passes.

Head after Wave 4: `0219d21` plus this handoff update. Gate: 203 test files and 2830 tests pass
(the eight AnalysisPanel tests that covered the removed selection-detail paths are gone),
63 pre-existing oxlint warnings, entry chunk 245.75 kB gzip, build warning-free. Merged to
`main` and pushed 2026-09-07 on Casey's word; `codex/board-workspace-ui` is deleted and `main`
is the working branch from Wave 5 on.

Measured after Wave 4, script milliseconds per phase, same harness and scenario as section 3:

| Phase | Dev after Wave 3 | Dev after Wave 4 | Prod after Wave 3 | Prod after Wave 4 |
| --- | ---: | ---: | ---: | ---: |
| Load to first canvas | 419 | 432 (then 385, 374) | 280 | 271 |
| Playback 5 s at 1x | 842 | 808 | 461 | 452 |
| Playback script share of wall time | 17 percent | 16 percent | 9 percent | 9 percent |
| First-play long task | none | none | none | none |
| Zoom, 30 wheel events | 407 | 398 | 124 | 115 |
| Pan drag, 40 moves | 76 | 70 | 67 | 67 |
| moveEntity, 20 edits | 426 | 405 | n/a | n/a |
| Select and clear, 10 cycles | 210 | 192 | n/a | n/a |
| Right tabs, 12 switches | 105 | 106 | n/a | n/a |
| Lifecycle phases, 9 switches | 478 | 455 | 230 | 217 |
| Library drawer, 6 toggles | 77 | 69 | 16 | 15 |
| Undo and redo, 10 steps | 146 | 136 | n/a | n/a |

Wave 4 acceptance: the four new browser-check assertions pass (`escapeChain`,
`calibrateStrip`, `debriefOpen`, `lensRoles`) with every Wave 3 assertion still green; the
shell spec passes 6 of 6 locally; dev playback 16 percent and zoom 13.3 ms per event, prod
load 271 ms, playback 9 percent and zoom 3.8 ms per event (all at or below Wave 3; the dev
load's first run after the build read 432, the two runs after it 385 and 374); ENGINEERING_REFERENCE,
PROJECT_GUIDE, VERIFICATION, WORKFLOW, DESIGN_SYSTEM, README and AGENTS reviewed;
`npm run check` green; no new lint warnings. No engine, store or playback file changed, so no
parity capture was taken. The lens buttons stayed rendered in every phase (the documented
contract) and became a `role="group"` of `aria-pressed` buttons rather than a hidden tablist.

## 2. Decisions

Approved by Casey on 2026-09-06:

1. Waves 1 to 4 were fixed on `codex/board-workspace-ui` and merged to `main` on Casey's word
   (2026-09-06 and 2026-09-07, with push). From 2026-09-07 `main` is the working branch: commit
   there when the gate is green; a push still needs Casey's word each time.
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

## 4. Current task: Wave 5, capabilities part one

Decision 5 fixes the order: the error boundary, storage admission and recovery UI, then the CI
browser test and size budget. The later capability items stay in section 5. Owner `fable-medium`
for items 1 and 2 (judgment on failure states and storage semantics), `opus-high` for item 3;
the orchestrator session integrates and reviews. Line numbers are at `0219d21`. Read first:
`AGENTS.md`, `docs/ENGINEERING_REFERENCE.md` sections 3, 7 and 8, `docs/PROJECT_GUIDE.md`,
`docs/VERIFICATION.md`, the evidence README `docs/field-te/evidence/perf-2026-09-06/README.md`
("Browser check after Wave 4"), then `.claude/plans/perf-2026-09-06/lane5-capabilities.md` if
present locally.

Shared rules: the Wave 4 shared rules hold unchanged (mutate and set, selectors, one load path,
storage keys never renamed, worker import graph independent, the Wave 3 lazy boundaries stay,
`restoreTeAutosave()` before any Board-side T&E write, code style, focused tests then
`npm run typecheck` and `npm run lint`, report format).

Items:

1. Error boundary. One class component (`src/ui/ErrorBoundary.tsx`; React 19 still needs a class
   for `getDerivedStateFromError`) that renders the design-system `State` (`src/ui/kit.tsx:95`)
   with an Export action (the existing `exportScenario` from `src/io/persist.ts` for the Board,
   the T&E export for Ops) and a Reload action. Wrap each `WidgetFrame` child
   (`src/panels/analysis/widgets/WidgetFrame.tsx:11`), each print view (`src/te/print/PrintOverlay.tsx:9`
   and the print surfaces in `src/te/ui/ProductsPanel.tsx` and `CardsPanel.tsx`) and each workspace
   root (the Board tree and the `OpsWorkspace` boundary in `src/App.tsx:637-650`). Autosave stays
   outside React: `startAutosave` and `startTeAutosave` in `src/main.tsx` keep running when a
   subtree fails. A caught error must not clear the scenario or the T&E record.
2. Storage admission and recovery UI. T&E frames (`captureFrameToCampaign`,
   `src/te/io/frameCapture.ts:39`) and config snapshots (`src/te/state/teStore.ts:605`) are
   admitted against `MAX_IMAGE_CODE_UNITS` (`src/io/runtimeValidation.ts:29`) the way the underlay
   image is (`src/io/persist.ts:419`); an oversize capture is refused with a `State` notice, not an
   `alert` (`src/panels/Toolbar.tsx:163`, `src/panels/analysis/DebriefRecord.tsx:65`). A storage
   readout (bytes used per live key and per recovery key, from `src/io/storageKeys.ts`) and a
   Storage section that lists, downloads and deletes the `rangeboard.scenario.recovered.*` and
   `rangeboard.te.recovered.*` copies. Replace `notifyRecovery` (`src/io/recovery.ts:34-40`) with
   that section's notice; the recovery copy itself, its key and the autosave pause rules stay.
3. CI. `.github/workflows/quality.yml` runs the Wave 4 spec after `npm run check`: install the
   Playwright Chromium (`npx playwright install --with-deps chromium`), start the dev server on a
   fixed port in the background, wait for it, run `npm run test:e2e`, stop it. Add a bundle size
   budget step: fail when the built entry chunk exceeds 260 kB gzip or the preloaded initial set
   exceeds 400 kB (read the numbers from `dist/` with `gzip -9`; the Wave 3 README section
   "Bundle after Wave 3" holds the method).

### Integration (orchestrator)

1. `npm run check`; the build must stay warning-free.
2. Browser check: extend `browser-check.mjs.txt` with a thrown widget render (force one widget to
   throw through a dev-only hook or a malformed layout param) that leaves the rest of the panel
   and the autosave alive, an oversize frame capture refused, and the Storage section listing a
   planted recovery key.
3. Harness: rerun load, playback and zoom in dev and prod; no regression from the boundaries.
4. Docs: `docs/ENGINEERING_REFERENCE.md` sections 3, 7 and 8, `docs/PROJECT_GUIDE.md`,
   `docs/VERIFICATION.md` and `docs/WORKFLOW.md` (CI now runs a browser check);
   `npm run docs:review` with a concrete note per document.
5. Commit on the branch when gate and browser check are green:
   `feat: error boundaries, storage admission and recovery UI, CI browser test and size budget (Wave 5)`.
   Do not push.
6. Update this file: ledger row, the new current task (section 5 item 1 onward).
   `npm run docs:review -- docs/HANDOFF.md --note "..."`. Ask Casey before any merge or push.

### Wave 5 acceptance

A widget that throws leaves the other widgets, the canvas and both autosaves running; the
boundary offers Export and Reload. An oversize frame or snapshot is refused before it reaches
storage and the user sees why. The Storage section lists, downloads and deletes recovery copies,
and no `alert` remains on the recovery path. CI runs the spec and the size budget and is green.
Harness load, playback and zoom at or below the Wave 4 numbers (dev 385 ms, 16 percent, 13.3 ms
per event; prod 271 ms, 9 percent, 3.8 ms). `npm run check` green. No new lint warnings.

## 5. Remaining waves

Each wave is one session. Update section 1 and section 4 at its end. Wave 5 part one (section 4)
comes first; these follow, in order, one or more per wave:

1. Named scenario library: an index key plus one body key per scenario, an active pointer, a Toolbar
   switcher. `loadScenario` stays the one load path. Never rename existing keys.
2. Bundle export (`rangeboardBundle: 1`: scenario, library, runs, campaigns) and run import as a
   read-only record.
3. Two-way seam: "Open on Board" for a stored config snapshot; a distinct prediction record beside a
   measure, labeled as a modeled estimate, never an observation.
4. Canvas keyboard access: Prepare register covers paths, boundaries, connections and waves;
   arrow-key nudge through `mutate`; a `?` shortcut overlay reusing `ShortcutList`.
5. Decide `mcdaWeights` and `scorecards`: build a scorecard widget, or document both as legacy and
   stop validating them.
6. Named restore points and run compare on top of item 1.
7. File System Access save to a working file.

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
- A tracked Playwright file must not match Vitest's default include (`*.test.*`, `*.spec.*`), or
  `npm test` imports it and fails; `scripts/e2e/board-shell.e2e.mjs` runs under `node --test`.
- `DebriefRecord` mounts only when the run is complete and the Monte Carlo summary is `done`, so
  a check that completes a run through `completeRun` must wait on the worker (about 500 ms; the
  spec allows 10 s) before it reads the record.
- `usePopover` moves focus into the dropdown on open. A menu item that opens a dialog must not
  assume the trigger still holds focus; the bubble-phase Escape in `App.tsx` refocuses the Range
  setup trigger by its `aria-controls`.
- The placement capture listener returns when `ui.locationDialogOpen` is set, so the dialog's
  Escape handler runs first. A new dialog that can open over an armed placement needs the same
  guard, or the placement swallows its Escape.
- The first dev harness run after `npm run build` loads slower (432 ms against 385 and 374 on the
  next two runs); read the later runs for the load number.

## 8. How to update this file

At the end of a wave whose gate passed: fill the ledger row (state, commit, evidence path), replace
section 4 with the next wave's task and acceptance, move any new trap into section 7, then
`npm run docs:review -- docs/HANDOFF.md --note "<wave, what changed>"` and `npm run docs:check`.
Commit the update with the wave. A wave that did not pass leaves this file unchanged.
