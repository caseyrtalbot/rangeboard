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
| 3 | Bundle and startup: lazy T&E workspace, lazy charts, deferred T&E autosave load, seed data, fonts | Not started | | |
| 4 | Correctness, accessibility, deduplication, docs drift, one browser test | Not started | | |
| 5 | Capabilities: error boundary, storage admission and recovery UI, CI browser test and size budget, then scenario library, bundle export, two-way seam, canvas keyboard access | Not started | | |

Base: branch `codex/board-workspace-ui` at `955ad6b`, one commit ahead of `main`. Gate at base:
typecheck passes, 101 test files and 1414 tests pass, oxlint shows only pre-existing fast-refresh
warnings, `node scripts/check-docs.mjs` passes.

Head after Wave 2: `ae55f0a` plus this handoff update. Gate: 203 test files and 2836 tests pass,
63 pre-existing oxlint warnings, build 606 KB gzip. Not merged to `main`; the merge needs Casey's
word. One flaky test is recorded in section 7.

Measured after Wave 2, script milliseconds per phase, same harness and scenario as section 3:

| Phase | Dev after Wave 1 | Dev after Wave 2 | Prod after Wave 1 | Prod after Wave 2 |
| --- | ---: | ---: | ---: | ---: |
| Load to first canvas | 542 | 450 | 364 | 326 |
| Playback 5 s at 1x | 2162 | 1385 | 1103 | 583 |
| Playback script share of wall time | 42 percent | 28 percent | 21 percent | 12 percent |
| First-play long task | 127 | none | 82 | none |
| Zoom, 30 wheel events | 703 | 450 | 169 | 117 |
| Pan drag, 40 moves | 91 | 82 | 70 | 69 |
| moveEntity, 20 edits | 1710 | 1339 | n/a | n/a |
| Select and clear, 10 cycles | 250 | 204 | n/a | n/a |
| Right tabs, 12 switches | 145 | 93 | n/a | n/a |
| Lifecycle phases, 9 switches | 540 | 503 | 245 | 239 |
| Lifecycle forced layouts, 9 switches | 1091 | 33 | about 1080 | 34 |
| Library drawer, 6 toggles | 78 | 72 | 13 | 16 |
| Undo and redo, 10 steps | 358 | 271 | n/a | n/a |

Wave 2 acceptance, dev harness: first-play long task met (none; target 40 ms), phase-switch
forced layouts met (3.7 per switch, 15 on the first Analyze mount; target 20). Open: playback
script share 28 percent (target 15; prod 12), moveEntity 67 ms per edit (target 40), select and
clear 10.2 ms per change (target 10; lane runs on the same tree 6.2 to 10.5), zoom 15 ms per
wheel event (target 10; prod 3.9), undo and redo 27 ms per step (target 15). Engine share in
Node: `engagementPicture` 110.8 to 64.6 ms on the harness scenario, parity byte-identical.
Memory: 30 edits grow the heap by 4.7 MB (was 26 MB) with the picture cache bounded to eight.
The evidence README carries the analysis; the open targets are a decision for Casey (section 4).

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

## 4. Current task: Wave 3, bundle and startup

Owner `opus-high` for the code (mechanical work with a fixed contract); the orchestrator session
integrates, measures and reviews. Line numbers are at `ae55f0a`. Read first: `AGENTS.md`,
`docs/ENGINEERING_REFERENCE.md` sections 3, 4 and 8, the execution section of
`docs/PROJECT_GUIDE.md`, the evidence README `docs/field-te/evidence/perf-2026-09-06/README.md`
("After Wave 2"), then `.claude/plans/perf-2026-09-06/lane3-bundle-startup.md` and
`bundle-modules.tsv` if present locally.

Decision Casey owes before or during this wave: four Wave 2 dev targets stay open (playback
script share 28 versus 15 percent, moveEntity 67 versus 40 ms, zoom 15 versus 10 ms, undo and
redo 27 versus 15 ms; select and clear 10.2 versus 10 ms). The prod numbers are at or under every
target that the prod harness can measure (playback 12 percent, zoom 3.9 ms, no long task in any
phase). The next dev cut needs imperative Konva position updates outside render, which the
"derived at render" invariant forbids. Recommendation: close the four on the prod numbers and
record the dev numbers as the React development runtime's element cost. Until Casey decides, the
targets stay in the acceptance tables as open, not lowered.

Shared rules:

- Scenario changes go through `mutate`, view state through `set`, panels subscribe through
  selectors. `loadScenario` stays the one load path. Storage keys are never renamed. The worker
  value-import graph stays independent of stores, React and panels. A lazy boundary must not change
  what either store does before first paint: the Board autosave still loads synchronously in
  `src/main.tsx`.
- Two spaces, no semicolons, single quotes, named exports, short rationale comments only where needed.
- Run the focused tests for each touched file, then `npm run typecheck` and `npm run lint` before
  reporting. Report: diff summary, checks run with output, the gzip size of the initial chunk after
  each step, anything not done, findings outside scope.

Items:

1. `React.lazy` the T&E Ops workspace: `src/App.tsx:6` imports `OpsWorkspace`, rendered at
   `App.tsx:624-628` when `workspace === 'ops'`. One `Suspense` boundary with the design-system
   `State` as its fallback. About 112 KB gzip.
2. `React.lazy` the three chart shells in `src/charts` (TimeSeries, Tornado, Ladder) so recharts
   leaves the initial graph. About 106 KB gzip. Call sites unchanged: one lazy wrapper per shell
   with the same named export, a `Suspense` fallback the height of the plot. `ChartFrame`,
   `tokens.ts` and `timeAxis.ts` stay synchronous.
3. Split `startTeAutosave` (`src/te/io/persistTe.ts:91`) into subscribe and restore; restore on
   idle or on first entry to Ops (`src/main.tsx:14`). Move `parseAutosave(scenarioSnapshot)` from
   `fillCampaign` (`persistTe.ts:20-38`, the call at line 37) to config open.
4. Emit `runtimeShapes` as `JSON.parse('...')` in `src/io/generateRuntimeSchema.mjs`; run
   `npm run schema:generate`, then `npm run schema:check`.
5. Dynamic import for `INTEGRATION_PROFILES` consumers; lazy accessors for the three teStore seed
   tables (`src/te/state/teStore.ts:52-54`: `MEASURE_DICTIONARY`, `CARD_TEMPLATES`,
   `THREAT_VIGNETTES`) and their use in `src/te/validate.ts`.
6. `React.lazy` LibraryEditor, TestCardsPanel, AnalysisPanel and CommandPalette (`App.tsx:12-14`
   and `23`; rendered at `700-701` and in the analysis branch).
7. Preload the two 400-weight woff2 faces in `index.html`. Subset JetBrains Mono to Latin.
8. `build.chunkSizeWarningLimit` last, only for what remains after items 1 to 7.

### Integration (orchestrator)

1. `npm run check`; the build must be warning-free.
2. Bundle: record the gzip size of the initial chunk after each item in the evidence README as
   "After Wave 3"; run the harness load phase in dev and prod as section 6 says.
3. Browser check: extend `browser-check.mjs.txt` with an Ops entry and a return to Board, a chart
   presence check per widget after the lazy boundary resolves (`svg.recharts-surface` inside each
   chart-bearing widget at the panel width), and a T&E autosave round trip across a reload.
4. Docs: `docs/PROJECT_GUIDE.md` execution section, `docs/ENGINEERING_REFERENCE.md` section 4
   (the lazy boundaries) and section 8 (the autosave split); `npm run docs:review` with a
   concrete note per document.
5. Commit on the branch when gate and browser check are green:
   `perf: lazy-load the T&E workspace and the charts, defer the T&E autosave restore (Wave 3)`.
   Do not push.
6. Update this file: ledger row, sizes, the new current task (Wave 4).
   `npm run docs:review -- docs/HANDOFF.md --note "..."`. Ask Casey before any merge or push.

### Wave 3 acceptance

Initial chunk at or below 400 KB gzip (after Wave 2: 606 KB); build warning-free; Board and Ops
load and switch; every chart renders in every lens after its boundary resolves; harness load to
first canvas at or below the Wave 2 numbers (dev 450 ms, prod 326 ms); PROJECT_GUIDE execution
section updated and reviewed. `npm run check` green. No new lint warnings.

## 5. Remaining waves

Each wave is one session. Update section 1 and section 4 at its end.

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
- `src/playback/mcRun.test.ts` "replicate i depends on i only" builds its laydown with time-based
  `newId` ids, so the draw keys change per run and the three replicates can coincide. It failed
  once in the Wave 2 gate and passed on eight reruns; the engine output is byte-identical with
  fixed ids. Wave 4 gives that laydown fixed ids.
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
