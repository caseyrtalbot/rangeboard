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
| 5 | Error boundaries, storage admission and recovery UI, CI browser test and size budget | Done 2026-09-07; local gate, parity, browser and bundle checks green; Casey accepted paired performance evidence and authorized publication | This commit | same directory: `browser-check-wave5.json`, `ops-boundary-wave5.json`, `parity-wave5-before.json`, `parity-wave5-after.json`, `bundle-size-wave5.json`, all Wave 5 profiles and Wave 4 rechecks; README "Wave 5 verification, 2026-09-07" |
| 6 | Named scenario library | Not started | | Section 4 |

Base: branch `codex/board-workspace-ui` at `955ad6b`, one commit ahead of `main`. Gate at base:
typecheck passes, 101 test files and 1414 tests pass, oxlint shows only pre-existing fast-refresh
warnings, `node scripts/check-docs.mjs` passes.

Historical head after Wave 4: `0219d21` plus this handoff update. Gate: 203 test files and 2830 tests pass
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

Head after Wave 5: this closing commit on `main`. `npm run check` passes: 208 test files,
2,850 tests, five bundle-accounting tests, 63 unchanged lint warnings, warning-free build.
The shell spec passes 6 of 6; the extended browser harness passes every assertion; fixed-ID
numerical captures are byte-identical. Entry 243,196 bytes and initial JavaScript plus CSS
380,735 bytes under the `gzip -9` budgets. Remote CI status is checked after publication;
these counts describe the local gate.

Wave 5 performance is accepted on Casey's 2026-09-07 instruction to commit and push after
reviewing the paired measurements. The historical absolute targets were not all met and are
not relabeled as passed. Dev load 407/414 ms, playback 868/880 ms, zoom 407/395 ms; prod load
271/287 ms, playback 520/497 ms, zoom 124/114 ms. An unchanged Wave 4 snapshot rechecked at
864/513 ms playback (dev/prod) and 410/128 ms zoom. All captures remain in the evidence README;
this acceptance is specific to Wave 5 and does not silently change future performance gates.

## 2. Decisions

Approved by Casey on the dates recorded below:

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

7. Wave 5 closure, 2026-09-07: after the orchestrator reported the historical timing misses
   and paired unchanged-Wave-4 measurements, Casey instructed "commit and push. merge to main."
   Accept that documented performance variation for this wave. The work is already on `main`,
   so publication is a direct commit and push with no separate merge. Later capabilities remain
   unstarted.

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

## 4. Current task: Wave 6, named scenario library

Next bounded session task, from section 5 item 1. Do not start it as part of Wave 5 publication.
Read `AGENTS.md`, the current engineering/project/verification guides, `src/io/storageKeys.ts`,
`src/io/persist.ts` and its tests, `src/state/store.ts` (`loadScenario`, `replaceScenario` and
history), `src/panels/Toolbar.tsx`, and the Wave 5 recovery/admission helpers and tests.

Outcome: retain several named Board scenarios in local browser storage, with an index key,
one body key per scenario, an active pointer and a Toolbar switcher. `loadScenario` stays the
one adoption path. Preserve the existing autosave and recovery key contracts, unknown extension
data, legacy-save compatibility and verified recovery before writes. Preserve the separate
T&E store and the Wave 3/Wave 5 lazy boundaries. Do not place campaign records in a scenario.

Ownership: one implementation owner for the coupled storage/index/active-pointer transition
and its store consumers; the orchestrator owns shared docs and integration. If parallel UI work
is used, give Toolbar/switcher files to one separate owner only after agreeing the transition
contract. Workers preserve each other's edits. Inspect the current source before choosing any
new key names or migration behavior; resolve a material persistence ambiguity with evidence.

Verification: cover retaining and switching named scenarios across reload, compatibility with
the existing autosave, failed reads/writes and recovery, and adoption through `loadScenario`
with the existing history/selection/reset behavior. Run fixed-ID parity for store touches,
real browser checks at 1400 by 900 and 320 px panel width, `npm run check`, `npm run test:e2e`
and `npm run check:bundle`. Recheck load/playback/zoom and compare both the historical evidence
and a matched current baseline; preserve measured misses and seek a decision if necessary.
Update affected current docs and their source reviews in the same closing commit.

Stop after the named-library slice passes and its handoff ledger/current task are updated.
Bundle export, run import, the two-way seam, additional canvas keyboard access, scorecards,
restore points/run comparison and File System Access remain outside this task. Commit locally
when the integrated gate passes; a future push still needs Casey's instruction for that wave.

## 5. Remaining waves

Each wave is one session. Update section 1 and section 4 at its end. Wave 5 part one is
complete. These follow in order; section 4 selects item 1 alone for the next session:

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
