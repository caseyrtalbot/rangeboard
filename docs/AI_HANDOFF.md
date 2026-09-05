# RangeBoard: technical handoff to a follow-on coding model

Status: CURRENT TRANSFER RECORD.

Written 2026-09-04 by Claude (Fable 5.1) for Astra (GPT 6) at tree `e55aa86` on branch
`analysis-hardening`. Updated the same day in the ownership-transfer pass at `2d367ba`
(section 18 lists every edit). This file is the state transfer. It does not change the app.

## 0. How to read this file

Every statement carries one of four marks.

| Mark | Meaning |
| --- | --- |
| [V] | Verified in this session against the tree, git, or tool output. |
| [D] | Stated by a document on disk (`CLAUDE.md`, `docs/`), not re-verified line by line. |
| [I] | Inferred from code reading. Plausible, not proven by a test or a browser run. |
| [U] | Uncertain. Conversation history, memory, or a guess. Check before you rely on it. |

Read order: `AGENTS.md` (the one engineering contract, model-neutral), then this file, then
`docs/data-engine/outstanding.md`. The two orchestrator handoffs
(`docs/engine-refactor/handoff-post-wave3.md`, `docs/data-engine/handoff-orchestrator.md`)
are historical; read them for the browser recipe and the protocol lessons. Section 2.3 says
which planning files are in git and which were left out.

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
| [V] Branch | `analysis-hardening`, HEAD `2d367ba` (2026-09-04). The three commits after `e55aa86` are documentation only: `e981c10` (this file), `8af337c` (the planning record), `2d367ba` (a handoff note). |
| [V] Remote | `origin` = `https://github.com/caseyrtalbot/rangeboard.git`; `origin/analysis-hardening` at `2d367ba`; zero commits ahead and zero behind (checked 2026-09-04 in the transfer pass). |
| [V] `main` | `3620fca` (2026-08-24), equal to `origin/main`. The branch is 31 commits ahead of `main`, and `main` is the merge base, so a fast-forward is possible. No merge or PR exists. |
| [V] History | 72 commits, first on 2026-08-19. Slice and wave commits carry long messages; `git log -20 --format=%B` is the build record. |
| [V] Stashes | none |
| [V] Tracked tree | clean at `2d367ba`. The transfer pass then changed only `AGENTS.md` (new), `CLAUDE.md`, this file, `docs/data-engine/outstanding.md` and the status headers of eight documents (section 18). No file under `src/` changed. |
| [V] Untracked | `docs/data-engine/build_mockup.py`, `build_mockup_te.py`, `mockup.html`, `mockup-te.html` (section 2.3). They are not ignored, so `git status` lists them. `.claude/settings.local.json` exists and is ignored by the user's global git ignore. |

### 2.2 Verification

At `e55aa86`, the session that wrote this file:

| Command | Result |
| --- | --- |
| [V] `npx tsc --noEmit -p tsconfig.app.json` | clean |
| [V] `npx vitest run` (scratch files excluded) | 1202 tests in 69 files, all pass |
| [V] `npm run lint` | 75 warnings, 0 errors. One warning is from the untracked scratch file `src/playback/zz_rf20b.scratch.test.ts`. Without it the count is 74, the documented baseline. |
| [U] `npm run build` | Not run in that session. |

At `2d367ba` plus the transfer-pass document edits (2026-09-04, section 18):

| Command | Result |
| --- | --- |
| [V] `npx tsc --noEmit -p tsconfig.app.json` | clean, exit 0 |
| [V] `npx vitest run` | 1202 tests in 69 files, all pass, exit 0 |
| [V] `npm run lint` | 74 warnings, 0 errors: 72 `react(only-export-components)`, 2 `react(set-state-in-effect)`. Equal to the baseline. |
| [V] `npm run build` | clean, exit 0. Main chunk 1,981.57 kB / 572.08 kB gzip, worker `mc.worker-*.js` 287.24 kB, CSS 75.42 kB / 13.15 kB gzip; the one chunk-size warning above 500 kB. Equal to the wave 3 gate. |

### 2.3 Untracked files

[V] On 2026-09-04, after this file was written, the user chose which planning files enter
git. Committed: `docs/data-engine/PLAN.md`, `outstanding.md`, `handoff-orchestrator.md`,
`docs/engine-refactor/PLAN.md`, `handoff-post-wave3.md`. Left out on purpose:
`docs/data-engine/HANDOFF.md` (the slice protocol for the agent teams that built the plan;
its content is process, not code), `mockup.html`, `mockup-te.html`, `build_mockup.py`,
`build_mockup_te.py` (visual targets for slices that are built; the code is the truth now).
A reference to one of those five files points at nothing in the repo.

[V] The three `zz_rf20*` scratch files named in sections 2.2 and 2.4 were deleted on
2026-09-04 (confirmed absent at `2d367ba`). The lint count without them is 74. Section 12
keeps the R-F-20 finding. An earlier paragraph here that still offered the user the choice
to keep them was retired in the transfer pass (`outstanding.md` M-10).

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
one scratchpad folder. [V] Resolved: the user took option 2; the handoff commits `e981c10`,
`8af337c` and `2d367ba` followed and the scratch files were deleted.

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

[V] First built in `c3f9853` (2026-08-19) and `901248e` (2026-08-22), then rebuilt as a
guided decision workflow in `3d93aa1` (2026-08-25: every `ui/` panel, `teStore.ts`,
`validate.ts`, `calc/readiness.ts`, about 15,000 lines), with `persistTe.ts` hardened in
`7e5a5ae` (2026-09-02). After that only `calc/stats.ts` changed (`c5ec3c0`, `965a62b`, the
exports the engine imports). The earlier statement here that it was built in two commits
was wrong; `git log --stat -- src/te` is the record. Files: `model/`
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
`docs/te-plan.md` section 11 was completed is not recorded in the repo. No logic in the
module has changed since 2026-09-02 and every plan from 2026-09-03 on put `src/te/` out of
scope, so treat it as frozen and unreviewed by the later work. Known stale string: `src/te/ui/DesignPanel.tsx`
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

[V] Every document below carries a status header as of the transfer pass; `AGENTS.md`
section 10 holds the same table and is the one to keep current.

| Path | Status | Use |
| --- | --- | --- |
| `AGENTS.md` | tracked, CURRENT CONTRACT | the one engineering contract, model-neutral; cite by section and bullet, never by line |
| `CLAUDE.md` | tracked, CURRENT CONTRACT (pointer) | points at `AGENTS.md`; holds only Claude Code environment notes |
| `docs/AI_HANDOFF.md` | tracked, CURRENT TRANSFER RECORD | this file |
| `docs/data-engine/outstanding.md` | tracked, CURRENT OUTSTANDING REGISTER | the decision and follow-up log: D-1 to D-77 (no D-58), F-1 to F-72, R-D-1 to R-D-24, R-F-1 to R-F-23, M-1 to M-10. Append only. |
| `docs/data-engine/PLAN.md` | tracked, COMPLETED / HISTORICAL IMPLEMENTATION SPEC | 23 settled decisions (D1 to D23), nine slice contracts. Its body is frozen; discrepancies go to `outstanding.md`. |
| `docs/data-engine/HANDOFF.md` | not in git, absent on purpose | the slice protocol, gate agents, ownership tables, report template. A reference to it points at nothing. |
| `docs/data-engine/handoff-orchestrator.md` | tracked, HISTORICAL HANDOFF | protocol lessons, the browser recipe (Scenario A and B do not fire a Coyote, R-F-20), the brief skeleton |
| `docs/data-engine/mockup.html`, `mockup-te.html`, `build_mockup.py`, `build_mockup_te.py` | not in git, present untracked | the approved visual targets for built slices; the code is the truth now |
| `docs/engine-refactor/PLAN.md` | tracked, COMPLETED / HISTORICAL IMPLEMENTATION SPEC | ten decisions R-1 to R-10, eight slices, the wave schedule, the standards table (section 12 is cited by `fidelity.ts`) |
| `docs/engine-refactor/handoff-post-wave3.md` | tracked, HISTORICAL HANDOFF | the wave 3 orchestrator handoff at `e55aa86`; superseded by this file |
| `docs/inventory/` | tracked, REFERENCE / RESEARCH | the August 2026 source record behind the seed library. The current provenance record is `SpecModel.provenance` in `seedLibrary.ts`, not this folder. |
| `docs/threat/` | tracked, REFERENCE / RESEARCH | the public-source UAS threat study |
| `docs/te-plan.md`, `docs/te-compilation/` | tracked, HISTORICAL SPEC and REFERENCE for `src/te/` | the T&E Ops spec; `MASTER-CALCULATIONS.md` is the fixture source of the `src/te/calc/` tests |
| `README.md` | tracked, STALE | the unmodified Vite template |

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
still open. [V] In the transfer pass five rows whose code had landed but whose status cell
still read `open` were closed against the source: R-F-1 (the Stinger and Leonidas `pk`
rows), R-F-5 and R-F-8 (the `pseudo` flag), R-F-10 (`scanPeriodS(spec, false)` in the
panels), R-F-13 (`timeStatSub` wording). Nothing else was closed. The items a follow-on is
most likely to meet:

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

What remains to close R-F-20 (updated in the transfer pass, 2026-09-04).

1. Done: the trace above is recorded in the R-F-20 status cell of `outstanding.md`. The
   row stays `open`. Still the user's: whether the panels should explain `no-fc-uplink`.
   [V] No panel or canvas file renders `ThreatStatus` (`git grep ThreatStatus -- src
   ':!*.test.*'` hits `sim.ts` only), so the word reaches no user today; the earlier [U]
   guess that it "already exists in the UI" was wrong.
2. Open: replace Scenario A and B in the browser recipe with a laydown that carries a
   KuRFS (the `repro2.mjs` fixture), and confirm in a browser that it fires. [U] The one
   browser run that fired was in the cut-off session; its screenshot is gone with that
   scratchpad, so no surviving artifact shows a browser laydown firing.
3. Done: the three `zz_rf20*` scratch files were deleted on 2026-09-04.

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

[V] No plan document exists past wave 3. Both `PLAN.md` files are complete and carry a
historical status header. The user has not named the next body of work.

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
- **The `src/te/` module.** Large (58 files), rebuilt on 2026-08-25, no logic change since
  2026-09-02, and excluded from every review since. Its `stats.ts` is now an engine
  dependency.
- **Statistical tests.** Several assert within 3 standard errors; a reviewer found one that
  passed by the entity ids it happened to get (R-D-23). Sweep ids when you touch one.

## 15. Knowledge that is not in the repository

Everything below lived in Claude memory files, conversation history, or files outside the
repo when this section was written. [V] Transfer status (2026-09-04): every project rule
below now lives in `AGENTS.md` (evidence and source-of-truth order, scope, the register
rules, the git rules, STE copy, "event" not "ledger", the fixture pins, the three kinds of
number, the fc-uplink rule behind R-F-20). What stays out of the repo is personal (the
user's prose rules, the delegation rule for Claude subagents, the memory pointers), and a
follow-on model does not need it to work on the code. The list is kept so nothing is lost.

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

### 16.2 Root `AGENTS.md`: done

[V] Created on 2026-09-04 in the transfer pass at `2d367ba`. It holds the content of the
former `CLAUDE.md` (architecture map, invariants, one source per fact, T&E rules, design
system, Konva conventions), the protocol facts the handoffs stated (the register rules, the
fixture pins, the browser conventions, the git rules, the module-cycle rule), the three
kinds of number, the engagement vocabulary and a status table of every document.
`CLAUDE.md` is a pointer to it plus the Claude Code sandbox notes. The recommendation that
stood here is in git history (`e981c10`). The T&E terminology lexicon named in that
recommendation was not moved into `docs/`; it is a user skill, not a project file.

### 16.3 A note on the Claude memory directory

The memory files are pointers to `docs/` files. Astra has no access to them. Every fact
they hold is in section 15 above, in `AGENTS.md`, or in the handoff files on disk.

## 17. Verification of this file

[V] `docs/AI_HANDOFF.md` was written at `e55aa86` and updated at `2d367ba`. No file under
`src/` changed in either session. The verification results in section 2.2 were produced
by the tools named there.

## 18. The ownership-transfer pass of 2026-09-04

[V] Run at `2d367ba` with the working tree clean. No branch, merge or stash was made. On the
user's word the edits below were committed as `0256830` and, with the register line that
records that hash, pushed to `origin/analysis-hardening` on 2026-09-04.

| File | Change |
| --- | --- |
| `AGENTS.md` | new: the model-neutral engineering contract |
| `CLAUDE.md` | rewritten as a pointer to `AGENTS.md` plus Claude Code environment notes; the former content moved into `AGENTS.md` |
| `docs/AI_HANDOFF.md` | header, read order, sections 2.1 to 2.4, 9, 11, 12, 13, 15, 16, 17; this section |
| `docs/data-engine/outstanding.md` | status header; "Committed so far" line; status cells of R-F-1, R-F-5, R-F-8, R-F-10, R-F-13 (closed against the source) and R-F-20 (the trace, still open); row M-10 |
| `docs/data-engine/PLAN.md`, `docs/engine-refactor/PLAN.md` | status header: COMPLETED / HISTORICAL IMPLEMENTATION SPEC |
| `docs/data-engine/handoff-orchestrator.md`, `docs/engine-refactor/handoff-post-wave3.md` | status header: HISTORICAL HANDOFF |
| `docs/inventory/README.md`, `docs/threat/UAS_CUAS_Threat_Study_Public_Source_2026-08-22.md` | status header: REFERENCE / RESEARCH |
| `docs/te-plan.md`, `docs/te-compilation/_BRIEF.md` | status header: HISTORICAL SPEC and REFERENCE for `src/te/` |

[V] Facts re-verified against the tree in this pass, beyond the git table in 2.1: no
`Math.random` under `src/`; `schemaVersion` 1 everywhere; the storage key list; `DT`,
`stepIndex` and `DRAW_KIND` locations; the fourteen `ModelId` values; `store.ts` imports
no value from `mcRun.ts`, `series.ts`, `impact.ts` or `attrition.ts`; the engine's only
`src/te/` import is `src/te/calc/stats.ts`; the `DesignPanel.tsx` stale string; the
`fillScenario` deep-fill list; the `emptyScenario()` run-setting defaults; `mutate` at
`store.ts` line 913; `window.__store` and `window.__teStore` in `main.tsx`; the
`completeConnect` typing, the fc-uplink gate in `sim.ts` and `attrition.ts`, the Coyote
profile's `fcSources`; the `pseudo` flag; the Stinger and Leonidas `pk` rows; the panels'
`scanPeriodS(spec, false)` calls; the `MAX_SEED` bound in `LiveStrip.tsx`; the `src/te/`
commit history (section 6 corrected: the 2026-08-25 rebuild and the 2026-09-02 persistence
change were missed at `e55aa86`); the absence of the `zz_rf20*` files.
