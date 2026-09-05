# RangeBoard: technical handoff to a follow-on coding model

Written 2026-09-04 by Claude (Fable 5.1) for Astra (GPT 6). Tree at `e55aa86` on branch
`analysis-hardening`. This file is the state transfer. It does not change the app.

## 0. How to read this file

Every statement carries one of four marks.

| Mark | Meaning |
| --- | --- |
| [V] | Verified in this session against the tree, git, or tool output. |
| [D] | Stated by a document on disk (`CLAUDE.md`, `docs/`), not re-verified line by line. |
| [I] | Inferred from code reading. Plausible, not proven by a test or a browser run. |
| [U] | Uncertain. Conversation history, memory, or a guess. Check before you rely on it. |

Read order after this file: `CLAUDE.md` (127 lines, the one contract for the code), then
`docs/engine-refactor/handoff-post-wave3.md`, then `docs/data-engine/handoff-orchestrator.md`,
then `docs/data-engine/outstanding.md`. Those three files under `docs/data-engine/` and
`docs/engine-refactor/` are untracked on purpose (section 2.3).

## 1. Purpose

[D] RangeBoard is a local-first, single-user web app for Counter-UAS (C-UAS) test and
evaluation planning. It has two workspaces.

- **Board.** An infinite meter-scaled canvas with sensors, effectors, C2 nodes, assets,
  threats, kill-chain links, flight paths, timeline playback, and an Analysis panel with a
  deterministic engagement engine and a Monte Carlo replicate loop.
- **T&E Ops.** A campaign workspace that carries a C-UAS test campaign from customer request
  to delivered evidence: questions, measures, test matrix, test cards, run console, analysis,
  findings, printable deliverables.

[D] The claim the tool makes, from `docs/engine-refactor/PLAN.md` section 1: a
planning-factor model with quantified uncertainty, used for test design. It reports the
expected engagement window, its spread, a confidence interval on every headline measure, and
the assumptions that drive the answer. It is not a simulation of truth and not a source of
operational effectiveness claims.

[V] No backend, no server, no CI. Persistence is `localStorage`. `dist/` is gitignored and
never deployed by any script in the repo.

## 2. State at handoff

### 2.1 Git

| Fact | Value |
| --- | --- |
| [V] Branch | `analysis-hardening`, HEAD `e55aa86` |
| [V] Remote | `origin` = `https://github.com/caseyrtalbot/rangeboard.git`; `origin/analysis-hardening` at `e55aa86`; zero commits ahead |
| [V] `main` | `3620fca` (2026-08-24). The branch is 28 commits ahead of `main`. No merge or PR exists. |
| [V] History | 69 commits, first on 2026-08-19. Slice and wave commits carry long messages; `git log -15 --format=%B` is the build record. |
| [V] Stashes | none |
| [V] Tracked tree | clean |

### 2.2 Verification run in this session at `e55aa86`

| Command | Result |
| --- | --- |
| [V] `npx tsc --noEmit -p tsconfig.app.json` | clean |
| [V] `npx vitest run` (scratch files excluded) | 1202 tests in 69 files, all pass |
| [V] `npm run lint` | 75 warnings, 0 errors. One warning is from the untracked scratch file `src/playback/zz_rf20b.scratch.test.ts`. Without it the count is 74, the documented baseline. |
| [U] `npm run build` | Not run in this session. The wave 3 handoff records it clean at `e55aa86` (main chunk 1,981.57 kB, worker 287.24 kB). |

### 2.3 Untracked files

[V] `git status` shows exactly these untracked paths.

- `docs/data-engine/` (8 files: `PLAN.md`, `HANDOFF.md`, `outstanding.md`,
  `handoff-orchestrator.md`, `mockup.html`, `mockup-te.html`, `build_mockup.py`,
  `build_mockup_te.py`).
- `docs/engine-refactor/` (2 files: `PLAN.md`, `handoff-post-wave3.md`).
- `src/playback/zz_rf20.scratch.test.ts`, `src/playback/zz_rf20b.scratch.test.ts`,
  `src/playback/zz_rf20_scenario.json`.

[D] The two `docs/` folders are the user's planning folders. Every orchestrator handoff says
"never `git add` them". [U] The reason was never written down. The safe reading: the user
decides when and whether they enter git.

[V] The three `zz_rf20*` files are scratch tests from the session that was cut off (section
12). They are not part of any commit. They pass. They add one lint warning. Delete them or
keep them as the R-F-20 reproduction; the choice is the user's.

### 2.4 The session that was cut off

[V] Timeline on 2026-09-04, from file modification times:

| Time | Event |
| --- | --- |
| 18:58 | `docs/data-engine/outstanding.md` last written |
| 19:00 | `docs/engine-refactor/handoff-post-wave3.md` written |
| 19:04 to 19:06 | the three `zz_rf20*` scratch files written |
| 19:05 to 19:08 | a Playwright investigation of R-F-20 in the scratchpad of session `95f7cccf` (`rf20/repro.mjs`, `repro2.mjs`, `fixture-kurfs.png`, `sources.mjs`, `sources-320.png`) |

[V] `outstanding.md` itself is complete and well formed. Its "Committed so far" line matches
git. Its last rows are R-D-24, R-F-23 and M-9, which is what the wave 3 handoff says it
holds. Nothing in it was cut mid-row. What was cut off is the R-F-20 investigation that
followed the handoff: its findings were never written into `outstanding.md`. Section 12
records them here.

Recommendation on the user's two options: option 2, a smooth handoff. There is nothing to
roll back. No tracked file changed after `e55aa86`. The residue is three scratch files and
one scratchpad folder.

## 3. Architecture

### 3.1 Stack

[V] From `package.json`: React 19.2, react-konva 19.2 on Konva 10.3, zustand 5, recharts
3.10.1 (exact pin), IBM Plex fonts. Dev: Vite 8.2, TypeScript 6.0, vitest 4.1, oxlint 1.75,
Playwright 1.62 (scripted browser checks only). No jsdom, no testing-library, no formatter.

[D] Deliberate exclusions: tldraw (license and document-model friction), Tailwind, shadcn,
Rust or WebAssembly engine (drafted and deleted on 2026-09-04, section 10).

### 3.2 Source map

[V] Directory listing at `e55aa86`. `CLAUDE.md` "Architecture map" describes each file; this
table adds what that map leaves implicit.

| Path | Role | Notes |
| --- | --- | --- |
| `src/main.tsx` | entry | loads the autosave into the store, starts both autosaves, exposes `window.__store` and `window.__teStore` in dev |
| `src/App.tsx` | shell | workspace toggle (Board / T&E Ops), right panel tabs, keyboard map, resizer |
| `src/model/` | domain types and seeds | `types.ts` (1,035 lines), `seedLibrary.ts` (3,792 lines, every builtin model with provenance rows), `integrationData.ts` (2,792 lines, researched pairings between systems), `seedSystems.ts` (system presets), `seedCards.ts`, PF factor tables |
| `src/geometry/` | pure math | `geo.ts`, `slant.ts`, `prng.ts` (`mulberry32`, `hashU01`), `webmerc.ts` |
| `src/state/` | one zustand store | `store.ts` (2,244 lines, about 99 actions), `analysisLayout.ts` |
| `src/playback/` | engine | `sim.ts` (detection sweep, threat assessment, kill-chain routes), `attrition.ts` (fire distribution), `policy.ts` (draw policy), `mcRun.ts` (replicates, statistics, sensitivity), `mc.worker.ts` and `mcClient.ts`, `trackState.ts`, `tactics.ts`, `raid.ts`, `runSession.ts` |
| `src/analysis/` | pure analysis over the scenario | physics (`sensorEnv.ts`, `radarPd.ts`, `ewPhysics.ts`), `impact.ts` (the `engagementPicture` cache), `series.ts` (chart series), `uncertainty.ts`, `fidelity.ts`, `runValidity.ts`, `requirements.ts`, `mcda.ts`, `aar.ts`, `liveStats.ts`, `systemTelemetry.ts`, `threatAggregation.ts`, `range.ts`, `doctrineFactors.ts` |
| `src/charts/` | recharts kit, props only | `TimeSeries`, `Ladder`, `Tornado`, `Sparkline`, `ChartFrame`, `tokens.ts`, `timeAxis.ts` |
| `src/canvas/` | Konva stage and layers | one layer per concern under `layers/`; `footprintStyle.ts` is the ring style source |
| `src/panels/` | React panels | Inspector, LibraryEditor, AnalysisPanel with `analysis/widgets/` and `analysis/detail/`, Toolbar, ViewMenu, Palette, TimelineBar, CommandPalette |
| `src/io/` | persistence | `persist.ts` (autosave, load, `fillScenario`, export), `viewState.ts`, `storageKeys.ts`, `recovery.ts` |
| `src/te/` | T&E Ops workspace | own store, model, calc, seed, print, ui (section 6) |
| `src/playback/__fixtures__/` | one JSON fixture | `layered-acoustic-merops.json` |

[V] Size: about 61,000 lines of non-test TypeScript under `src/`; 69 test files.

### 3.3 Control and data flow

[D] Board: a Konva event calls a store action; the action produces a new `Scenario`; React
re-renders the layers and panels as pure views. Drag in progress is Konva-native; the store
updates once on `dragend`.

[D] Analysis reads `engagementPicture(scenario)` (`src/analysis/impact.ts`), a WeakMap cache
keyed on the scenario object, so the deterministic sweep runs once per scenario change.

[D] Playback: `playback.simTimeS` is the only mutable playback state. `TimelineBar` owns the
requestAnimationFrame loop. Every position, pulse and playhead derives from `simTimeS`
through `posAtTime` in `sim.ts`. Never a timer.

[D] Monte Carlo: the store action `runMonteCarlo` posts an `McRunRequest` through
`mcClient.ts` to `mc.worker.ts`, which calls `runReplicates` (`mcRun.ts`). Messages are
`progress`, `done`, `error`; the store ignores a message whose `runId` is not current. The
result lives in the `mc` slice (view state, never persisted, never in undo history). A
scenario basis change marks it `stale`. A second worker slot runs `runSensitivity` on demand.

[V] Engine entry points, in call order: `assessAllThreats(scenario, policy?)` (`sim.ts`)
sweeps detection and builds one `ThreatAssessment` per active threat; `resolveEngagements
(scenario, assessments, policy?)` (`attrition.ts`) distributes fire and returns totals,
events and per-effector rows. A bare call is the deterministic policy.

## 4. State and data model

### 4.1 `Scenario` (the one source of truth)

[V] `src/model/types.ts`, `interface Scenario`, `schemaVersion: 1`. Fields: `name`,
`library: SpecModel[]`, `systemPresets`, `deletedSeedIds?`, `observedPresetId?`, `runMode?`,
`seed?`, `replicates?`, `targetHalfWidth?`, `uncertainty?`, `environment`, `engageOn?`
(legacy, migrated to `roe`), `roe?`, `doctrine?`, `mcdaWeights?`, `scorecards?`, `raid?`,
`requirements`, `entities`, `connections`, `boundaries`, `paths`, `testCards`, `frames`,
`underlay`, `geoRef`.

[V] `SpecModel` is a library entry (`builtin` flag, one of `sensor`, `uas`, `effector`,
`threatProfile`, plus `provenance?: Provenance[]`). `Entity` is a canvas instance with
`specId: string | null`, `pos`, `headingDeg`, `enabled?`, `systemId?`, `altitudeFt?` (UAS),
`defendedRadiusM?` (asset). `Connection` has `fromId`, `toId`, `label`, and optional typed
fields `medium`, `confidence`, `note`, `latencyS`.

[D] Schema rules: a new top-level field needs a default in `emptyScenario()`
(`src/model/seed.ts`) and nothing else; `fillScenario` (`src/io/persist.ts`) spreads a save
over the empty scenario and deep-fills one level into `environment`, `requirements`,
`doctrine`, `mcdaWeights`, `underlay`, `raid`. Bump the version only for a breaking shape
change. No commit in the project has bumped it.

### 4.2 View state outside the scenario

[V] `src/io/storageKeys.ts` holds every key. Never rename one.

| Key | Holds |
| --- | --- |
| `rangeboard.scenario.v1` | the Scenario autosave (500 ms debounce [D]) |
| `rangeboard.scenario.recovered.<ms>` | a save that failed to load, copied before anything writes |
| `rangeboard.te.v1`, `rangeboard.te.recovered.<ms>` | the T&E store |
| `rangeboard.layers.v1` | layer visibility |
| `rangeboard.rings.v1` | per-entity ring overrides |
| `rangeboard.units.v1` | `metric` or `aviation` (default aviation [D]) |
| `rangeboard.view.v1` | camera, basemap, right tab, workspace |
| `rangeboard.runseq.v1` | next run number |
| `rangeboard.analysis.v1` | analysis lens layout and user presets |
| `rangeboard.rightpanel.width`, `rangeboard.palette.width`, `rangeboard.palette.collapsed`, `rangeboard.engstrip.open` | panel chrome |

[D] Undo: `mutate(fn)` in `store.ts` (line 913 [V]) pushes a full scenario snapshot to
`past` (cap 100) and clears `future`. Only scenario changes are undoable. View state goes
through `set` and never enters history. Undo and redo restore through `set`, not `mutate`,
so a rule added to `mutate` must be added to both (F-57 in `outstanding.md`).

### 4.3 The `mc` slice

[D] `McState`: `status` (`idle`, `running`, `done`, `stale`, `error`), `runId`,
`basisSignature`, `summary: McSummary`, `total`, `error`, `sensitivity`. `McSummary` carries
`Stat` values (mean, sd, se, t-interval `lo` and `hi`, quantiles, `n`, `total`, `defined`
with a Wilson interval), band series over time, per-effector and per-threat stats, and
`stopped` (the stopping rule and the replicate it fired at).

## 5. Important interfaces

[V] Locations at `e55aa86`.

- `DrawPolicy` (`src/playback/policy.ts`): five draw points, `detect`, `kill`, `jam`,
  `phase`, `param`. `deterministicPolicy` is the planning envelope; `monteCarloPolicy(seed,
  replicate, thresholds)` is counter-based through `hashU01`, no stream. `DRAW_KIND` names
  the kinds; `stepIndex` in `sim.ts` is the one draw-step index.
- `runReplicates(scenario, onProgress?)` and `runSensitivity(...)` (`src/playback/mcRun.ts`
  lines 282 and 459). `McRunRequest`, `McSensitivityRequest`, `McWorkerMessage`,
  `McSensitivityMessage`, `SensitivityRow`, `SensitivitySummary` are the worker protocol.
- `engagementPicture(scenario)` (`src/analysis/impact.ts`): the deterministic cache every
  panel reads. The replicate loop never touches it.
- Series builders (`src/analysis/series.ts`): pure `(scenario, id?) => Series[]`, sampled
  from t = 0 at `DT` (0.5 s, exported from `sim.ts`) to `scenarioDurationS`, NaN where
  undefined. `withBands` is the one band reader.
- `sampleScenario`, `uncertainFields`, `spreadFor`, `sampleSpread`
  (`src/analysis/uncertainty.ts`).
- `MODEL_TAGS`, `modelsUsed`, `modelsForEntity` (`src/analysis/fidelity.ts`): fourteen
  model ids with tier and validation status.
- `assessRunValidity` (`src/analysis/runValidity.ts`): findings `invalidating` or
  `limiting`; `planning-envelope` is limiting under every deterministic run,
  `unvalidated-model` under every run that uses a model with validation `none`.
- Store actions used by browser checks: `addEntityFromModel`, `updateEntity`, `beginPath`,
  `addDraftPoint`, `finishPath`, `beginConnect`, `completeConnect`, `patchScenario`
  (undoable), `updateModel`, `addModel`, `resetModelToSeed`, `startRun`, `advanceRun`,
  `pauseRun`, `scrubTo`, `resetRun`, `applyLens`, `runMonteCarlo`, `runSensitivity`,
  `setRightTab`, `select`, `undo`, `redo`. The full recipe is in
  `docs/data-engine/handoff-orchestrator.md`, "Browser recipe".
- `runExportObject` (`src/io/persist.ts`): the debrief export with `dataBasis`, `validity`,
  `models`, `mcSummary`, `sensitivity`.

## 6. T&E Ops module (`src/te/`)

[V] Built in two commits: `c3f9853` (2026-08-19) and `901248e` (2026-08-22). Files: `model/`
(`types.ts` 1,111 lines, `ids.ts`, `empty.ts`), `state/teStore.ts` (1,046 lines),
`calc/` (accounting, matrix, measures, priority, readiness, stats, timeline, each with a
test), `seed/` (measure dictionary, templates, vignettes, `jiatf401.ts` demo campaign),
`print/` (eight print components), `ui/` (panels per phase, own `kit.tsx`),
`io/` (`persistTe.ts`, `exportCsv.ts`, `frameCapture.ts`), `validate.ts`.

[D] Rules from `CLAUDE.md`: separate store, no undo, versioned append-only records, IDs
`VLK-<code>-<type>-<seq>`, gates in `validate.ts` (no issued card no run, no validity status
no analysis, no traceability no finding). Never embed campaign data in `Scenario`.

[V] The engine imports `meanInterval`, `quantile`, `wilson` and `betaQuantile` from
`src/te/calc/stats.ts`. This is the one engine dependency on `src/te/` (decision R-D-1, O-6).

[D] Spec sources: `docs/te-plan.md` and `docs/te-compilation/MASTER-*.md`. The JIATF-401
campaign is illustrative and renders a banner. [U] Whether every stage C1 to C5 of
`docs/te-plan.md` section 11 was completed is not recorded in the repo. The module has been
untouched since 2026-08-22 and every later plan put `src/te/` out of scope, so treat it as
frozen and unreviewed by the later work. Known stale string: `src/te/ui/DesignPanel.tsx`
carries "Recorded, not modeled. The board is plan view.", false since data-engine slice 1
(D-2, open).

## 7. Environment and workflow

### 7.1 Commands

[V] `package.json` scripts: `dev` (vite), `build` (`tsc -b && vite build`), `lint` (oxlint),
`preview`, `test` (`vitest run`). Type-check alone: `npx tsc --noEmit -p tsconfig.app.json`.
One file: `npx vitest run src/analysis/series`.

[D] Lint baseline is 74 warnings, all `react(only-export-components)` or
`react(set-state-in-effect)`, warn level. A change should add none. Count with
`npm run lint 2>&1 | grep -c warning`.

### 7.2 Test conventions

[D] Component tests use `renderToStaticMarkup` and assert on the HTML string. Recharts sizes
its chart in an effect, so a chart renders only its wrapper div in static markup. zustand 5
hands `react-dom/server` the store's `getInitialState()` snapshot, so every static-markup test
of a store reader runs `Object.assign(useStore.getInitialState(), useStore.getState())`
before each render (F-39). Hand-built threat fixtures resolve altitude to the `altBandFt`
midpoint; pin `altitudeFt` where slant must equal ground range; pin `swerling` on a
fixed-wing fixture behind a Pd expectation. A statistical test asserts within 3 standard
errors of an analytic value named in a comment.

### 7.3 Sandbox and browser facts (Claude Code specific, [D] from the handoffs)

- The Claude Code sandbox blocks the Vite port bind and Chromium's mach port bootstrap.
  Dev server and Playwright ran with the sandbox disabled. Ports 5173 to 5200 were used;
  take a higher port, start the server with `--strictPort`, write its PID, stop only your
  own.
- Playwright Chromium is installed in the user cache. Scripts import `chromium` from
  `node_modules/playwright/index.mjs`, viewport 1400 x 900, right panel pinned to 320 px
  through `localStorage`. Playwright uses its own profile, so the user's autosave is safe.
- The shell `grep` is ugrep (no `--exclude`); use `git grep --untracked`.
- `npx vite-node` is not installed. A scratch check that imports TS runs as a vitest file
  under `src/` and is deleted after.
- `WebFetch` returns binary for a PDF (save and `pdftotext`); several manufacturer domains
  return 403 or a bot challenge through the proxy (F-66, R-F-6).

### 7.4 Deployment

[V] None. No CI config, no deploy script, no hosting reference in the repo. `README.md` is
the unmodified Vite template.

## 8. Invariants and conventions

[D] `CLAUDE.md` "Core invariants" and "One source per fact" are the contract. They were
rewritten on 2026-09-03 (`f079b87`) and edited by every slice since; they match the tree at
`e55aa86` as far as the wave 3 gate checked. Do not duplicate them here. The ones that most
often bite a newcomer:

- World frame is meters, +y is south. Heading 0 is north, clockwise.
- Never write derived state into the scenario. Position at time t, detections, assessments
  and Monte Carlo results are all derived.
- Slant range, not ground range, feeds every sensor and effector range test.
- Thresholds are test-defined (`Scenario.requirements`), never engine constants.
- Every unsourced number is a planning factor (PF). Never invent a value to fill a blank.
- No `Math.random` under `src/` [V, grep is empty]. Every draw goes through `DrawPolicy`.
- `store.ts` must never value-import `mcRun.ts`, `series.ts`, `impact.ts` or
  `attrition.ts` (module cycle through `sim.ts`; `import type` is safe). Shared constants
  that both `store.ts` and `viewState.ts` need live in a leaf module.
- A scan radar between its scans has no hit of its own and cues EO/IR through its carried
  hold only.
- Arrival and closest approach are never merged.

[D] Code style: 2-space indent, no semicolons, single quotes, named exports, `interface` for
object shapes, JSDoc on exported symbols, lines under about 100 characters, "why" comments
only. User-facing copy is ASD-STE100 Simplified Technical English with no em-dashes. Design
tokens, not literals, in CSS (`src/index.css`); monospace is machine data only; type floor
10 px; separators, not cards.

## 9. Documents on disk and what each is

| Path | Status | Use |
| --- | --- | --- |
| `CLAUDE.md` | tracked, current | the code contract; cite by heading and bullet, never by line |
| `docs/data-engine/PLAN.md` | untracked, frozen | 23 settled decisions (D1 to D23), nine slice contracts. Its status header still says "not built"; that is stale by rule (the file is never edited; discrepancies go to `outstanding.md`). |
| `docs/data-engine/HANDOFF.md` | untracked, frozen | the slice protocol, gate agents, ownership tables, report template. Same stale header. |
| `docs/data-engine/outstanding.md` | untracked, live | the decision and follow-up log: D-1 to D-77 (no D-58), F-1 to F-72, R-D-1 to R-D-24, R-F-1 to R-F-23, M-1 to M-9. Append only. |
| `docs/data-engine/handoff-orchestrator.md` | untracked, current as of slice 9 | protocol lessons, the browser recipe, the brief skeleton |
| `docs/data-engine/mockup.html`, `build_mockup.py` | untracked | the approved visual target for slices 4 to 8; the mockup wins on appearance, PLAN wins on behavior |
| `docs/engine-refactor/PLAN.md` | untracked, complete | ten decisions R-1 to R-10, eight slices, the wave schedule, the standards table |
| `docs/engine-refactor/handoff-post-wave3.md` | untracked, current | the last orchestrator handoff; read first |
| `docs/inventory/` | tracked, history | the August 2026 source record behind the seed library. The current provenance record is `SpecModel.provenance` in `seedLibrary.ts`, not this folder. |
| `docs/threat/` | tracked | the public-source UAS threat study |
| `docs/te-plan.md`, `docs/te-compilation/` | tracked | the T&E Ops spec |

## 10. Architectural decisions and abandoned approaches

[D] Decisions with a written record.

- Konva, not tldraw (`CLAUDE.md`). zustand, not Redux. Plain CSS tokens, not Tailwind.
- The engine stays TypeScript and deterministic by default; Monte Carlo is a run mode, not a
  replacement (data-engine D1, D9, D22; refactor R-1, R-2).
- Pd never multiplies kill mass in deterministic mode; the deterministic mode is the
  planning envelope with a `limiting` validity finding on every gate (D22, R-2).
- Draws are counter-based (`hashU01` keyed by seed, replicate, kind, ids, step) so common
  random numbers hold across laydowns (R-4). `mulberry32` remains for the T&E bootstrap.
- Parameter uncertainty lives on the provenance row (`spread`); a field with no row spread
  takes `PF_SPREAD` by field name; `spread: null` pins a field (R-6).
- Provenance rows on every seed; an edited field loses its row and becomes PF; "Reset to
  seed" restores a builtin (D-75, R-D-13).
- No schema bump, no storage key rename, no new npm dependency in either plan (recharts was
  the one exception, exact pin).
- Fixture strategy: when a sourced seed value moves a fixture, pin the fixture (altitude,
  Swerling, `rangeBasis: 'planning'`), never the seed (D-3, R-D-8, F-67).

[D] Abandoned approaches, with the reason.

- A Rust and WebAssembly greenfield engine, drafted 2026-09-04, deleted the same day: the
  TypeScript engine could be refactored in place and no new dependency was wanted. Its
  standards table survives as `docs/engine-refactor/PLAN.md` section 12.
- Scan origin at first detection (D-11): superseded by refactor slice 1 because it
  guaranteed a hit in the first M-of-N window and biased initiation early.
- One PRNG stream per replicate (D-62): replaced by counter-based draws in wave 2 because
  the stream position depended on every step, so no two laydowns could share a draw.
- `docs/board-refactor/`, `docs/strategist-refactor/`, `docs/picogrid-transfer-plan.md`:
  deleted in `8f70566` as built and superseded. [U] Their content is only in git history.
- A jsdom DOM test for the chart kit (D-26): not possible without a new dependency; a
  Playwright check in Chromium stands in for it.
- Drag handles for widget reorder (D-35): up and down buttons instead, for keyboard access
  with no drag library.

## 11. Known bugs, technical debt, incomplete work

[D] The full list is `docs/data-engine/outstanding.md`. Every row with status `open` is
still open. The items a follow-on is most likely to meet:

Open defects and semantic questions

- R-F-20: "no browser laydown fires". Traced in the cut-off session; see section 12.
- F-15: a scan radar that never satisfies M-of-N still holds and coasts, so `heldNow` is
  true while `trackInitAtS` is null.
- F-16: `trackInitM` greater than `trackInitN` is not clamped; the track never initiates.
- F-26: `beginPath` seeds a draft point at the entity position, so a two-click path stores
  three points.
- F-5: a threat at 0 ft sits below the 4 m mount and every 0-degree-floor radar gates it.
- R-F-14: `valid` run validity is unreachable with the real `MODEL_TAGS` (the environment
  model has validation `none`), accepted as is.
- D-61: a role-table radar with a Pd model draws once per DT step with no coast, so its hold
  can flicker under Monte Carlo.

Technical debt

- Three copies of the size and evasion Pk terms (`kineticPkPenalty` in `footprintStyle.ts`
  and two inline in `attrition.ts`, F-20).
- The worker chunk bundles `store.ts` and `viewState.ts` because `sim.ts` imports three
  helpers from the store (F-19, F-59). Dead weight, guarded by `typeof window` checks.
- `MountHeight` exists twice with different render (F-6). "phase centre" and "phase center"
  both exist (F-7).
- `src/charts/tokens.test.ts` reads `index.css` through `node:fs` behind a
  `@ts-expect-error` (F-29).
- Lint warnings for helpers exported beside components (F-31, F-41, F-47, F-48, F-63).
- `README.md` is the Vite template.
- Seed descriptions that contradict sourced values on six radars (F-61) and seven other
  models (R-F-3); a seed cleanup pass was decided for after wave 3 and not started.
- Sources table and several metas clip at the 320 px panel width (F-70, R-F-22, F-53, F-55).
- The `src/te/` stale string (D-2).
- Mockup drift from the app in five places (M-1 to M-8).

Decisions the user has not given a word on

- D-1 to D-77 (data-engine) are almost all `open`: the orchestrator took the recommended
  reading and built. R-D-1 to R-D-24 are `decided` or notes. The user's stated next step is
  an accept-or-overrule pass over R-D-21 to R-D-24; the D rows have never had one.

## 12. Work in progress: R-F-20, traced

R-F-20 as recorded: Scenario A, Scenario B and three hand-built one-threat laydowns in the
browser give zero salvos and zero kills in every replicate, so every browser tornado is
empty, while engine fixtures fire.

What this session established.

- [V] `src/playback/zz_rf20.scratch.test.ts` builds Scenario A through store actions in
  vitest with hand-written `Connection` records (no `medium`, `confidence` or `note`). It
  fires: 4 shots, deterministic expected kills 1.73, Monte Carlo kills mean 1.55 over 20
  replicates, both threats `engageable`.
- [V] `src/playback/zz_rf20b.scratch.test.ts` loads `zz_rf20_scenario.json`, a save the
  cut-off session captured from the browser after drawing the same laydown with
  `beginConnect` and `completeConnect`. It does not fire: status `no-fc-uplink`, zero shots,
  `expectedNoArrival` 1. The two connections in that save are typed (`medium: 'cable'`,
  `confidence: 'documented'`, latency 0.5 s, notes from `integrationData.ts`).
- [V] `completeConnect` (`src/state/store.ts` line 1137) types a hand-drawn link when
  `evaluateIntegration` finds a researched pairing. `openConnectSuggestion` auto-wires
  documented pairings.
- [V] `assessThreat` (`src/playback/sim.ts` lines 1433 to 1446): when every path of a route
  is fully typed and the effector's integration profile has `guidance: 'fc-uplink'`, the
  route needs a sensor in `route.fcSourceIds`; otherwise the window is geometry only and the
  status is `no-fc-uplink`. `attrition.ts` line 717 applies the same gate to fire
  distribution.
- [V] The Coyote profile (`src/model/integrationData.ts` line 152) has `guidance:
  'fc-uplink'` and `fcSources: ['lib-kurfs', 'lib-tpq53']`. Giraffe 1X is not an fc source.
- [V] The cut-off session's second Playwright script (`repro2.mjs`) added a KuRFS radar to
  the chain. Its screenshot `fixture-kurfs.png` (session `95f7cccf` scratchpad, `rf20/`)
  shows the browser laydown firing: Engaged 1/1, Kill E[k] 0.8, Defeat 80.9 percent, chip
  `MC 100 · total · seed 4821`. [U] The sensitivity rows of that run were printed to the
  console of the cut-off session and were not saved.

Conclusion, [I]: R-F-20 is not an engine defect. It is the integration model working as
designed: a UI-drawn Giraffe 1X to FAAD C2 to Coyote chain is fully typed, and a Coyote
under a typed route needs a KuRFS or TPQ-53 fire-control source. The engine fixtures fire
because hand-written connections are untyped and the gate does not bind. The demo laydowns
(Scenario A and B in the browser recipe) are the wrong laydowns for a Coyote.

What remains to close R-F-20.

1. Write the finding as an `R-F-20` status update in `outstanding.md` (append, never edit a
   row's text; add `decided:` or `done:` to its status cell) and let the user decide whether
   the Inspector or the threat status should explain `no-fc-uplink` more loudly. [U] The
   status word already exists in the UI; whether it was visible in the panels the cut-off
   session looked at was not checked.
2. Replace Scenario A and B in the browser recipe with a laydown that carries a KuRFS (the
   `repro2.mjs` fixture), so the sensitivity widget can be demonstrated.
3. Delete or keep the three `zz_rf20*` scratch files (section 2.3).

[V] The cut-off session then started R-F-22 (Sources table at 320 px): `sources.mjs`
measured the Stinger Sources table and took `sources-320.png`. No code changed.

## 13. Near-term roadmap

[D] From `handoff-post-wave3.md` "Next", on the user's word only, in the order the rows
suggest:

1. The user's accept-or-overrule pass over R-D-21 to R-D-24.
2. R-F-20 close-out (section 12).
3. The seed cleanup pass: R-F-3 and F-61 (descriptions from rows), R-F-6 (re-fetch
   manufacturer pages outside the proxy), R-F-16 (a Matrice 600 threat seed at 0.038 m2
   PF), R-F-4 stays with the user. Planned as one Opus-class mechanical apply agent from a
   fixed contract.
4. R-F-22 (Sources table clipping).
5. A provenance pass over non-radar sensors, effectors and threat RCS was refactor slice 0
   and is done; the remaining pedigree gaps are in R-F-4 and R-F-6.

[U] No plan document exists past wave 3. Both `PLAN.md` files are complete. The user has
not named the next body of work.

## 14. Highest-risk areas

- **`sim.ts` and `attrition.ts` semantics.** 1,503 and 1,313 lines, dense, with rules that
  interact (scan model, M-of-N, doctrine gates, fc-uplink gate, route latency, intercept
  cap, shoot-look-shoot). A change here moves fixtures with hand-derived numbers. Every
  plan assigned these files to the highest-effort reviewer.
- **Draw-key stability.** Counter-based draws promise common random numbers across
  laydowns. A change to a key part (`memberIdx`, `salvoIdx`, `stepIndex`) silently breaks
  pairing; only the CRN tests in `mcRun.test.ts` and `policy.test.ts` catch it.
- **Persistence.** One autosave key, one schema version, `fillScenario` as the one fill
  path. A field added without a default in `emptyScenario()` produces a recovery copy and a
  lost save for every user of the app. The pre-slice save-shape check in the browser recipe
  exists for this.
- **Module cycles.** `store.ts`, `viewState.ts`, `sim.ts`, `policy.ts` already carry
  function-only cycles that work by hoisting. A value import at module scope in the wrong
  direction crashes at load (F-19 happened once).
- **Seed values.** `seedLibrary.ts` values are load-bearing for fixtures and for the claims
  the tool makes. A value change needs a provenance row and a fixture repair, never a
  fixture move that hides it.
- **The `src/te/` module.** Large, untested in the browser since August, and excluded from
  every review since. Its `stats.ts` is now an engine dependency.
- **Statistical tests.** Several assert within 3 standard errors; a reviewer found one that
  passed by the entity ids it happened to get (R-D-23). Sweep ids when you touch one.

## 15. Knowledge that is not in the repository

Everything below lives in Claude memory files, conversation history, or files outside the
repo. Nothing here is verifiable from `git`.

[U] User working rules, from `~/.claude/CLAUDE.md`, the memory files and the handoffs:

- Writing: ASD-STE100 Simplified Technical English, no em-dashes in deliverables, lead with
  the outcome, no preamble, one orientation line before the first tool use, a banned list
  of prose patterns (hedging, triadic lists, "not X but Y", validation pivots, meta-honesty
  markers, bulletizing by reflex).
- Evidence: repo state outranks memory; never claim a result without tool output.
- Scope: deliver exactly what was asked; questions get findings, not changes; ask only when a
  reading changes the work; otherwise state the assumption, build, and record it as a D row.
- Git: commit only on the user's word ("accept and commit", "Commit slice N", "Push");
  "prepare handoff" means commit if asked, update the "Committed so far" line, rewrite the
  handoff, update memory, no push. Report `git log origin/<branch>..HEAD` before a commit
  or push.
- Delegation: a hard rule from 2026-09-04. Every delegated agent is chosen by effort class:
  a medium-effort reasoning model by default; a high-effort reasoning model only when the
  semantics decide the outcome and always for orchestration and correctness review; a
  mechanical-work model at high effort for plumbing, UI chrome, seed edits from a JSON,
  gates and browser checks. Pre-assign per owner in the plan. Never use a multi-agent
  workflow tool unless the user says "use a workflow".
- Words: the salvo record is an "event", never a "ledger" (user's correction, R-D-16).
- The user is the orchestrator's client: build, gate with four parallel agents plus a design
  agent, fix in-session, final gate, deliver the report verbatim, stop.

[U] Session artifacts outside the repo, in `/private/tmp/claude-501/-Users-caseytalbot-
Projects-rangeboard/<session>/scratchpad/`: wave 3 (`64a02f7b`: `w3/contract.md`,
`w3/notes.md`, owner reports, `w3gate/`), wave 1 gate (`883abc4c`: `w1gate/`), slice 9
(`c5c8832b`: `s9/` with the research JSON that never entered the repo), slice 8
(`546338d4`), slice 7 (`c5247c15`), the R-F-20 investigation (`95f7cccf`: `rf20/`). These
are temporary and may be gone. The research JSON is reproducible: every seed row carries
its URL and date.

[U] The published mockup artifact URL is in `docs/data-engine/PLAN.md` (on disk).

[U] Numbers from the handoffs that this session did not re-measure: Monte Carlo timing on
Scenario B (100 replicates, about 660 to 690 ms in the worker), sensitivity timing (A 1.9 s,
B 9.3 s), build chunk sizes.

## 16. Agent configuration review and AGENTS.md recommendation

### 16.1 What exists

[V] Repository: `CLAUDE.md` only. `.claude/` holds an empty `.cc-writes` folder; no
project settings, hooks, skills or agents.

[V] User level (`~/.claude/`), outside the repo:

| Item | Content | Model-neutral? |
| --- | --- | --- |
| `CLAUDE.md` | communication rules, banned prose patterns, evidence, scope, artifacts, subagents, safety | yes, except the phrase-level list is a personal style guide |
| `rules/fable-5-1.md` | counters to Fable 5.1 defaults (progress messages, density, formatting, effort levels) | no, model-specific |
| `output-styles/ste-engineer.md` | the STE Engineer output style (language, response shape, evidence, scope, code, corrections) | yes |
| `agents/fable-medium.md`, `fable-high.md`, `opus-high.md`, `opus-xhigh.md` | subagent definitions with `model` and `effort` frontmatter, one shared body | no, Claude Code specific; the effort-class idea is neutral |
| `agents/tldraw-offline.md` | unrelated tldraw operator | no |
| `hooks/notify.sh` | macOS notification on permission or idle prompts | Claude Code specific |
| `settings.json` hooks | a `UserPromptSubmit` hook that injects a reminder of the banned-pattern list; `modelSettings` effort high for Fable, xhigh for Opus | Claude Code specific |
| `skills/stat-te-terminology` | STAT COE and DoD T&E vocabulary enforcement with a lexicon and a banned-terms list | yes, project-relevant for T&E deliverables |
| `skills/eli5` | explain a topic with an HTML artifact | no |
| memory (3 files) | `data-engine-orchestrator-handoff`, `engine-refactor-plan`, `subagent-effort-rule` | content is on disk in the handoffs; the memory is a pointer |

[V] Memory drift found: `data-engine-orchestrator-handoff.md` and the `MEMORY.md` index line
still say slice 9 is unpushed. It was pushed on 2026-09-04. This session corrects both.

### 16.2 Recommended root `AGENTS.md`

Migrate these into a model-neutral `AGENTS.md` at the repo root. Keep `CLAUDE.md` as a
one-line pointer to it, or keep both identical; the content below is the recommendation.

1. Everything now in `CLAUDE.md`: what the app is, commands, core invariants, the
   architecture map, Konva conventions, one source per fact, the T&E module rules, the
   design system, working conventions. It is already model-neutral.
2. From the handoffs, the durable protocol facts that no code records:
   - never `git add` `docs/data-engine/` or `docs/engine-refactor/` without the user's word;
   - never edit `docs/data-engine/PLAN.md` or `HANDOFF.md`; append discrepancies to
     `outstanding.md` as `D`, `F`, `R-D`, `R-F` or `M` rows, never delete a row, keep the
     numbering contiguous, update the "Committed so far" line after a commit or push;
   - do not touch `src/te/` unless the task names it;
   - do not bump `schemaVersion`; every new field is optional with a default in
     `emptyScenario()`;
   - a blank stays PF; never invent a value;
   - commit only on the user's word; one commit per slice or wave; report the ahead-of-origin
     count before a commit or push; push only on "push";
   - the four verification commands and the lint baseline (74);
   - the fixture-pin rules (altitude, Swerling, planning basis, the zustand static-markup
     sync);
   - the browser recipe facts that are environment-independent: `window.__store` actions,
     the autosave keys, the Scenario A and B laydowns with the KuRFS correction from section
     12, the `cleanReset` confirm dialog;
   - the module-cycle rule for `store.ts`.
3. From the user rules, the project-relevant writing rules: STE for every user-facing string
   and document, no em-dashes in deliverables, "event" not "ledger". The T&E terminology
   skill's lexicon and banned-terms list could move into `docs/` as a reference the
   `AGENTS.md` points at, since it governs deliverables the repo produces.
4. From memory, the delegation rule in neutral words: assign work by effort class; the
   orchestrator and the correctness reviewer are the highest class; mechanical work is
   never run at the highest class; pre-assign per owner in the plan.

Keep out of `AGENTS.md`: the Fable trait rules, the output style file, the hooks, the agent
definition files, the personal banned-pattern list (put it in the user's own agent config
for the new model), the sandbox and port facts (environment, not project; keep them in the
handoff docs).

### 16.3 A note on the Claude memory directory

The three memory files are pointers to `docs/` files. Astra has no access to them. Every
fact they hold is either in section 15 above or in the handoff files on disk.

## 17. Verification of this file

[V] `docs/AI_HANDOFF.md` was written by this session. No file under `src/` changed. The
verification results in section 2.2 were produced before this file was written and are
unaffected by it.
