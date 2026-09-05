# AGENTS.md: the RangeBoard engineering contract

Status: CURRENT CONTRACT. Model-neutral. It binds every coding agent (Claude, GPT, Codex,
Cursor, or a person) that changes this repository. `CLAUDE.md` is a thin pointer to this
file. Written 2026-09-04 at tree `2d367ba` on branch `analysis-hardening`.

Read order for a new agent:

1. This file.
2. `docs/AI_HANDOFF.md`: the state transfer, with every statement marked `[V]` verified,
   `[D]` documented, `[I]` inferred or `[U]` uncertain.
3. `docs/data-engine/outstanding.md`: the live decision and follow-up register.
4. The source under `src/`. The code outranks every document. Section 10 says what each
   document under `docs/` is.

## 1. What RangeBoard is

RangeBoard is a local-first, single-user web app for Counter-UAS (C-UAS) test and evaluation
planning. No backend, no server, no CI, no deployment. Persistence is `localStorage`.
Stack: React 19, react-konva, zustand, recharts 3, vitest, oxlint. Deliberately not tldraw
(license and document-model friction), not Tailwind, no Rust or WebAssembly engine.

It has two workspaces.

- **Board.** An infinite meter-scaled canvas with sensors, effectors, C2 nodes, assets,
  threats, kill-chain links, threat flight paths, test cards, timeline playback, and an
  Analysis panel with a deterministic engagement engine and a Monte Carlo replicate loop.
  Its domain state is the `Scenario` object.
- **T&E Ops.** A campaign workspace that carries a C-UAS test campaign from customer
  request to delivered evidence: questions, measures, test matrix, test cards, run console,
  analysis, findings, printable deliverables. Its domain state is the separate T&E store.

The claim the tool makes, and the only one: RangeBoard is a planning-factor model with
quantified uncertainty, used for test design. It reports the expected engagement window,
the spread of that window, a confidence interval on every headline measure, and the
assumptions that drive the answer. It is not a simulation of truth and not a source of
operational-effectiveness claims. Every number the tool shows carries its basis (sourced or
planning factor), its model fidelity tags and its run-validity findings. Do not add a
feature that presents a bare point as a result.

## 2. Commands and verification

```
npm run dev                             # Vite dev server (takes the next port if busy)
npx tsc --noEmit -p tsconfig.app.json   # type-check only
npx vitest run                          # every test
npx vitest run src/analysis/series      # one file or directory
npm run lint                            # oxlint
npm run build                           # tsc -b && vite build
```

Baseline at `2d367ba` (2026-09-04): tsc clean; 1202 tests in 69 files, all pass; lint 74
warnings and 0 errors, all `react(only-export-components)` (72) or
`react(set-state-in-effect)` (2), warn level; build clean with one chunk-size warning. A
change adds no lint warning and no test failure. Count lint with
`npm run lint 2>&1 | grep -c warning`. Run all four commands before you report a change
done, and report their actual output.

Test conventions:

- No jsdom, no testing-library, no formatter. Unit tests colocate as `*.test.ts` and
  `*.test.tsx`. Keep engine, geometry and store logic in pure TypeScript so it tests
  without a DOM.
- Component tests use `renderToStaticMarkup` and assert on the HTML string. Recharts sizes
  its chart in an effect, so a chart renders only its wrapper div in static markup.
- zustand 5 hands `react-dom/server` the store's `getInitialState()` snapshot. Every
  static-markup test of a store reader runs
  `Object.assign(useStore.getInitialState(), useStore.getState())` before each render.
- A statistical test asserts within 3 standard errors of an analytic value named in a
  comment. When you touch one, sweep the entity ids: a test once passed only by the ids it
  happened to get (`outstanding.md` R-D-23).
- A scratch check that must import TypeScript runs as a vitest file under `src/` and is
  deleted after. Report it.

Browser verification:

- Playwright is a devDependency for scripted browser checks only. Chromium lives in the
  user cache. Playwright uses its own profile, so the user's autosave is never touched.
- Dev builds expose `window.__store` (the Board zustand hook) and `window.__teStore`.
  Browser checks drive real store actions through them. The action list and the demo
  laydowns are in `docs/data-engine/handoff-orchestrator.md`, "Browser recipe".
- A Coyote under a fully typed route needs a fire-control source (KuRFS or TPQ-53) in the
  kill chain. `completeConnect` types a hand-drawn link when a researched pairing exists,
  so a browser laydown Giraffe 1X to FAAD C2 to Coyote reaches the status `no-fc-uplink`
  and fires nothing. Add a KuRFS to a Coyote demo laydown (`outstanding.md` R-F-20).
- Before a change to the save shape: build a scenario, read the autosave, strip the new
  fields, write it back, reload, and expect no `rangeboard.scenario.recovered.*` key.
- Never click the run reset control with a dirty run in a script without handling the
  `window.confirm` dialog first.

## 3. Hard architectural invariants

Breaking one of these breaks the app.

- **World frame:** meters. +x east, **+y south** (screen-down). Heading 0 = north,
  clockwise degrees. All conversions live in `src/geometry/geo.ts` (pure, unit-tested).
  `bearingDeg({0,0},{0,-100}) === 0`.
- **Camera:** `{x, y, scale}` = Konva Stage pixel offset plus **pixels per meter**.
  `sx = wx*scale + x`. Layer children are positioned in meters; the Stage transform scales.
- **Single source of truth:** the `Scenario` object in `src/state/store.ts` (zustand). The
  Konva tree and every panel are pure views of it. Never write derived state (positions at
  time t, detections, assessments, Monte Carlo results) into the scenario.
- **Playback is derived:** position at sim time comes from `posAtTime` in
  `src/playback/sim.ts`. `playback.simTimeS` is the only mutable playback state.
  `TimelineBar` owns the requestAnimationFrame loop. Any pulse, blink or playhead derives
  from `simTimeS`; never a timer.
- **Undo model:** `mutate(fn)` pushes a full scenario snapshot to `past` (cap 100) and
  clears `future`. Only scenario changes are undoable. A scenario-touching action goes
  through `mutate`; view state (camera, selection, ui, layers, ring overrides, analysis
  layout, the `mc` slice) goes through `set` and never pushes history. Undo and redo
  restore through `set`, so a rule added to `mutate` must be added to both. One exception:
  `Scenario.observedPresetId` is stamped through `set` on reset and first play, and undo
  and redo carry the current stamp over a restored snapshot.
- **Schema:** `Scenario.schemaVersion = 1`. No commit has bumped it. `fillScenario`
  (`src/io/persist.ts`) spreads a save over `emptyScenario()` and deep-fills one level into
  `environment`, `requirements`, `doctrine`, `mcdaWeights`, `underlay`, `raid`. A new
  top-level field, or a field inside one of those, needs only a default in
  `emptyScenario()`; a new nested object needs its own `fillScenario` line. Every new field
  is optional with a default. Bump the version only for a breaking shape change, and only
  when the user asks. A save that cannot load is copied to
  `rangeboard.scenario.recovered.<ms>` before anything writes. `loadScenario` is the one
  load path; `replaceScenario` clears history, selection, drafts and the tool, and prunes
  per-entity view state.
- **Storage keys live in `src/io/storageKeys.ts`;** never rename one; add a new key
  instead. View state outside the `Scenario` has its own keys (`rangeboard.view.v1`,
  `rangeboard.layers.v1`, `rangeboard.rings.v1`, `rangeboard.runseq.v1`,
  `rangeboard.analysis.v1`, `rangeboard.units.v1`, the panel chrome keys) and is written
  eagerly by its setter in `src/io/viewState.ts`.
- **Module cycles:** `sim.ts` imports from `store.ts`, so `store.ts` must never
  value-import `mcRun.ts`, `series.ts`, `impact.ts` or `attrition.ts` (`import type` is
  safe). Shared constants that both `store.ts` and `viewState.ts` need live in a leaf
  module, never in `store.ts`. `policy.ts` and `sim.ts` share a function-only cycle that
  works by hoisting; a value import at module scope in the wrong direction crashes at load.
  `src/analysis/fidelity.ts` reads the scenario, never the picture, so it stays cycle-free.
- **Monte Carlo worker:** the store action `runMonteCarlo` posts a request through
  `src/playback/mcClient.ts` to `mc.worker.ts`, which runs `runReplicates`
  (`src/playback/mcRun.ts`). The store ignores a message whose `runId` is not current. The
  result lives in the `mc` slice: view state, never persisted, never in `past`.
  `resetRun` and `replaceScenario` clear it; a basis change (`analysisBasisSignature`)
  marks it `stale`; a `done` that arrives after a stale mark is ignored. A second worker
  slot runs `runSensitivity` on demand. `engagementPicture` stays the deterministic path;
  the replicate loop never touches its cache.
- **Thresholds are test-defined:** `Scenario.requirements` (`RequirementThresholds`,
  defaults in `DEFAULT_REQUIREMENT_THRESHOLDS`) holds what the test asks the system to
  meet. Every reader spreads `{ ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }`.
  Never gate a requirement on an engine constant: a gate at `SHIP_DEAD_BELOW` passes itself
  by construction.
- **No invented values:** every unsourced number is a planning factor (PF) and is labeled
  as one. Never invent a value to fill a blank; record the blank as an open item instead.
- **No `Math.random` under `src/`.** Every draw goes through `DrawPolicy` (section 5). The
  engine draws in exactly five places; a sixth needs a plan entry and a decision row.
- **T&E store is separate** (section 8). Never embed campaign data in `Scenario`.

## 4. Architecture map

```
src/model/     types.ts (domain types, newId, resolvers like mountHeightOf, basisFor),
               seed.ts (emptyScenario, DEFAULT_SEED), seedLibrary.ts (builtin specs with
               provenance rows), integrationData.ts (researched pairings and profiles),
               seedSystems.ts (system presets), seedCards.ts,
               rcsFactors / signatureFactors / weaponFactors (PF tiers)
src/geometry/  geo.ts (bearings, wedges, path interpolation, formatters), slant.ts (slant
               range, horizon), prng.ts (mulberry32, idHash, hashU01), webmerc.ts
src/state/     store.ts: one zustand store (scenario + history + selection + camera + ui +
               playback + mc), analysisLayout.ts (lens presets and pure layout reducers)
src/playback/  sim.ts (detection sweep at DT = 0.5 s, assessThreat, kill-chain routes),
               attrition.ts (fire distribution, expected kills, events), trackState.ts
               (phase at t), tactics.ts (threat tactics), raid.ts, runSession.ts,
               policy.ts (DrawPolicy), mcRun.ts (runReplicates, runSensitivity, Stat,
               McSummary), mc.worker.ts + mcClient.ts (the replicate worker)
src/analysis/  sensorEnv.ts (sensor physics), radarPd.ts (Pd closed forms), ewPhysics.ts
               (jam), doctrineFactors.ts (per-system factors), impact.ts
               (engagementPicture cache, WEZ), liveStats.ts (KPIs at t), series.ts (chart
               series on the DT grid), runValidity.ts, requirements.ts, uncertainty.ts
               (parameter spreads), fidelity.ts (model tags), mcda.ts, aar.ts,
               systemTelemetry.ts, threatAggregation.ts, range.ts
src/charts/    recharts kit: types.ts (Series), tokens.ts, timeAxis.ts, ChartFrame,
               TimeSeries, Ladder, Tornado, Sparkline. Props only; never reads the store.
src/canvas/    CanvasStage.tsx (stage, pan/zoom, tool routing, drop target),
               TrackFileReadout.tsx, layers/ (one Konva layer per concern;
               footprintStyle.ts is the ring style source)
src/panels/    Toolbar, ViewMenu, Palette, Inspector (+ inspector/kit.tsx, spreadText.ts),
               LibraryEditor, TestCardsPanel, AnalysisPanel (+ analysis/, analysis/widgets/,
               analysis/detail/), TimelineBar (owns the rAF loop), CommandPalette,
               Glyph.tsx (symbology), ringLabels.ts (ring names), headlines.ts
src/io/        persist.ts (autosave, fillScenario, adoptSeedProvenance, JSON and library
               import/export, runExportObject), viewState.ts, storageKeys.ts, recovery.ts
src/te/        T&E Operations workspace (own store, section 8)
src/main.tsx   loads the autosave, starts both autosaves, exposes window.__store and
               window.__teStore in dev
src/App.tsx    workspace toggle, right panel tabs, keyboard map, resizer
```

Data flow for a click or drag: Konva event, store action, new scenario, React re-render of
layers. Drag-in-progress is Konva-native; the store updates once on `dragend`. Analysis
reads `engagementPicture(scenario)` (`src/analysis/impact.ts`), a WeakMap cache keyed on
the scenario object, so the deterministic sweep runs once per scenario change. Engine entry
points in call order: `assessAllThreats(scenario, policy?)` (`sim.ts`) sweeps detection and
builds one `ThreatAssessment` per active threat; `resolveEngagements(scenario, assessments,
policy?)` (`attrition.ts`) distributes fire and returns totals, events and per-effector rows.

## 5. One source per fact

Each fact below has exactly one definition. Read it there; never add a second copy.

- **Sample grid:** `DT` exported from `src/playback/sim.ts`. `tickStepS` in
  `src/charts/timeAxis.ts`. A chart's `tS` prop is quantized to DT by the caller.
- **Altitude and geometry:** `threatAltitudeFt(scenario, uas)` (entity value, else the
  threat profile, else the `altBandFt` midpoint) and `mountHeightOf(spec)` are the
  resolvers. Slant range, not ground range, feeds every sensor and effector range test; the
  azimuth wedge stays a ground-plane bearing test. Board rings against a selected threat
  ground-project through `groundRangeM`; the placard ring is unprojected. Terrain,
  per-waypoint altitude and refraction beyond the 4/3 horizon stay out.
- **Sensor physics** (`src/analysis/sensorEnv.ts`): a placard range is quoted against a
  reference target and scales to another target by a physical law per technology (radar
  fourth root of RCS, EO/IR Johnson linear, acoustic transmission-loss solve, RF none).
  `rangeBasis: 'planning'` turns scaling off. `sensorHoldGate` is the one hold gate,
  `sensorGeometryGate` the one vertical gate, with a 0.001 degree tolerance (PF) at both
  elevation edges, `radarPdAt` the one Pd evaluation, `effectiveDetectRangeM` the one
  range. The environment multiplier enters radar SNR as the fourth power.
- **Track initiation** (`sim.ts`): `scanPeriodS(spec, pdModeled)` (`doctrineFactors.ts`)
  is the one scan period: a stated `updateRateS`, else `SCAN_S` by role for a Pd-modeled
  radar, else null. A sensor with a period runs the scan model (M-of-N over scans, coast on
  a missed scan, drop at the miss limit); a null period takes the `TRACK_INIT_S` role
  table; RF and acoustic initiate no fire-control track. Scan k falls at the scan origin
  plus k periods, snapped forward to the first step at or after it; the origin is the sweep
  start (`effectivePathDelayS`) plus `policy.phase(sensorId)` times the period. The scan
  state is created at the sweep start with a `none` hold. A Pd-modeled radar draws once per
  scan per admitted member and only at a scan step; a threshold radar with a stated period
  samples its range test there. Between its scans a scan radar, Pd-modeled or threshold,
  has no hit of its own and cues EO/IR through its carried hold only;
  `ScanSteering.scanStep` answers true for a sensor with no scan state. A scan before
  admission is a miss at Pd 0 that advances the counter and stays out of the M-of-N window.
  `SensorObservation.trackInitAtS` is the one field consumers read; `pdSeriesStartS` is
  where `pdSeries` starts, the first scan taken. A coast is extrapolation, not a
  measurement: it holds continuity and never moves the classification ladder.
- **Fire doctrine** (`Scenario.doctrine`, enabled by default): the gate is per effector and
  route-aware (a firm track from a sensor routed to that effector, hostile ID, the
  declaration dwell); `readyS` = gate + route latency + target dwell is the first possible
  release. Fire distribution is shoot-look-shoot with a BDA dwell; the launch point follows
  `doctrine.launchPolicy`. `tEffect = t + engageTimeS + timeOfFlightS(spec, interceptSlant)`
  from `flyoutSpeedMps` (kinetic only; no speed means no flyout term), charged at
  `flyoutSpeedMps` times `FLYOUT_SPEED_FACTOR` (0.7, PF, in `attrition.ts` beside
  `SIZE_PENALTY`) because a stated speed is a maximum. `interceptAt` is the one predicted
  intercept, solved by three fixed-point passes, and it caps the flight at the end of the
  envelope interval that holds the release: a flight past that end lands at the end and the
  event carries `flightCapped`. `kineticPk(basePk, maxRangeM, uas, slantM)` is the one
  kinetic per-shot Pk, at the intercept slant; `footprintStyle.ts` imports it to invert the
  commit ring. `SIZE_PENALTY` and `EVASION_PENALTY` stay PF. Per-system factors and spec
  overrides live in `src/analysis/doctrineFactors.ts`. Doctrine off is the legacy
  instant-release path; keep it for regression and pin legacy fixtures with
  `doctrine.enabled = false`. Route latency is charged from the ROE gate, not from T0.
- **Fire-control uplink gate** (`sim.ts`, `attrition.ts`, `src/model/integration.ts`):
  when every path of a route is fully typed and the effector's integration profile has
  `guidance: 'fc-uplink'`, the route needs a sensor in `route.fcSourceIds`; otherwise the
  window is geometry only and the threat status is `no-fc-uplink`. Hand-written test
  connections are untyped and the gate does not bind; UI-drawn connections are typed by
  `completeConnect` when `evaluateIntegration` finds a researched pairing.
- **Draw policy** (`src/playback/policy.ts`): `DrawPolicy` is the one draw point. The
  engine draws in exactly five places (`sensorHit` detect, `applyEffect` kill,
  `applyEffect` continue-jam, `phase`, drawn once per scan state, and `param`, drawn once
  per uncertain field per replicate under `total`), through a policy passed as the
  defaulted last parameter of `sweepSensorHits`, `assessThreat`, `assessAllThreats` and
  `resolveEngagements`; a bare call is the deterministic policy, so its output is unchanged
  by construction (a test pins it). `detect` carries the `memberIdx` of the admitted
  member. `deterministicPolicy` is the planning envelope: it compares `pd >= pdDetect`,
  returns `pk` and `p` as mass and phases every scan at 0, and the chip meta names it
  `envelope · Pd threshold` against `estimate · n replicates`, which gains `· total` under
  the total uncertainty mode. `monteCarloPolicy(seed, replicate, thresholds)` keeps no
  stream: every draw is `hashU01(seed, replicate, kind, idHash(id), ...)`
  (`src/geometry/prng.ts`), keyed detect by sensor, threat, member and `stepIndex(tS)`,
  kill by effector, threat, ship and `salvoIdx`, the salvos that effector already committed
  at that ship, jam by effector, threat and step, phase by sensor, param by model id and
  field. `DRAW_KIND` names the kinds and `stepIndex` (`sim.ts`, beside `DT`) is the one
  draw-step index, so common random numbers hold across laydowns. A change to a key part
  (`memberIdx`, `salvoIdx`, `stepIndex`) silently breaks pairing; only the CRN tests in
  `mcRun.test.ts` and `policy.test.ts` catch it. Ships are discrete (`killDelta` 0 or 1).
  `runMode`, `seed`, `replicates`, `targetHalfWidth` and `uncertainty` are scenario facts
  read through `runSettings` (defaults in `emptyScenario()`, `DEFAULT_SEED` 4821, no
  schema bump), edited through `patchScenario` and part of `analysisBasisSignature`. The
  seed is bounded to `[0, 4294967295]` because `hashU01` reads every key part modulo 2^32.
- **Statistics** (`mcRun.ts`): `Stat` is the one statistic shape: mean, sd, se, the
  t-interval `lo` and `hi` at `conf`, the quantiles, `n` finite samples of `total` run, and
  the `defined` fraction with a Wilson interval, built from `meanInterval`, `quantile` and
  `wilson` in `src/te/calc/stats.ts` (the one engine dependency on `src/te/`; import a
  statistic from there, never copy it). The replicate loop stops after 30 replicates, and
  every 10 after that, when the 95 percent half-width of the end-of-run leaker mean is
  under `targetHalfWidth`; `McSummary.stopped` records the rule and the replicate. Panels
  read a time `Stat` through `timeStatSub(stat, quantity)` and a band step through
  `countSub` (`widgets/mc.ts`). Bands and tile subs read `McSummary` only through
  `withBands` (`series.ts`) and only when `mc.status` is `done` for the current run id;
  under a summary the line becomes the replicate mean.
- **Provenance** (`Provenance` in `src/model/types.ts`): a `SpecModel` carries one row per
  field (field, value, source, url, date, basis, spread); `basisFor(model, field)` is the
  one basis resolver and answers `pf` when the field has no row. `PfTag`
  (`src/panels/inspector/kit.tsx`) is the one tag: `.pf` for a planning factor, `.pf.src`
  for a sourced value, hover title `basis · source · date`. Every sensor, effector and
  threat seed carries rows: a sensor leads with `detectRangeM`, an effector with
  `maxRangeM`, a threat with `rcsM2`; an unsourced value keeps the basis `pf`.
  `Provenance.spread` is the row's epistemic spread (`Spread`: lognormal `sigmaDb`,
  triangular fraction bounds, beta counts); a `pf` row may carry a spread, and then it may
  also carry the url of the trial count behind that spread (the Stinger and Leonidas `pk`
  rows). `adoptSeedProvenance` (`src/io/persist.ts`), called from `fillScenario`, copies
  seed rows onto a saved builtin only for fields the user has not edited, and `updateModel`
  drops the row of a spec field it changes (`dropEditedProvenance`); an edited field takes
  no row and stays PF. "Reset to seed" (`resetModelToSeed`, undoable) puts a builtin back
  to its seed.
- **Parameter uncertainty** (`src/analysis/uncertainty.ts`): `spreadFor(model, field)` is
  the one spread resolver: the row's spread, else `PF_SPREAD` by field, else null; a row
  with `spread: null` is pinned and fixed. `sampleSpread` is the one inverse-CDF sample
  (lognormal `sigmaDb` a power ratio, triangular bounds fractions of the nominal, a beta
  with `pseudo` the PF table rescaled to the nominal, a beta without it the row's stated
  counts under a Jeffreys prior). `sampleScenario` is pure and returns a new scenario, and
  a `null` from its sampler keeps that field at its nominal; `uncertainFields` is the
  stable field order, over the library models an active entity uses, then connections,
  then doctrine; `sampleScenario` samples the same models. `Scenario.uncertainty`
  (`UncertaintyMode`, `aleatory` or `total`, default `aleatory`) is what a replicate
  varies: under `total` the loop draws one `param` uniform per uncertain field through the
  policy and calls `sampleScenario` once per replicate before `assessAllThreats`, under
  `aleatory` it never calls it. `runSensitivity` (`mcRun.ts`) is one-at-a-time on the
  end-of-run leaker mean, the field at its p10 and at its p90 with every other field
  nominal, paired by the same seed and replicate index, rows sorted by swing; the
  `sensitivity` widget runs it on demand on its own worker slot into `mc.sensitivity`,
  which a basis change marks stale. `spreadText` (`src/panels/inspector/spreadText.ts`) is
  the one spread wording, shown by the Sources table and appended to the `PfTag` title.
- **Fidelity** (`src/analysis/fidelity.ts`): `MODEL_TAGS` is the one tag table, one row
  for each of the fourteen model ids with a tier and a validation status. `modelsUsed
  (scenario)` and `modelsForEntity(scenario, id)` read the scenario, never the picture; the
  run-validity widget and the detail pane header show the tags, and the export carries
  `models` and `dataBasis.semantics`. `parameter-spread` is reported under Monte Carlo with
  `total` only. `radar-pd` is `datasheet`: `validation.verify.test.ts` checks the range law
  against the Blighter A400 and Echodyne sheets, and `convergence.verify.test.ts` holds the
  closed forms. A tag says `datasheet` or `trial`, never "validated" alone.
- **Arrival vs closest approach:** never merge them. Arrival (`arrivalS`) is the first
  sample inside an asset's `defendedRadiusM`; null without an asset or a crossing. CPA is
  pure geometry to the nearest asset. Warning time is arrival minus first detection.
- **Raid partition** (`attrition.ts`): `expectedKills + expectedLeakers + expectedNoArrival
  === raidSize`, in the deterministic run and in every replicate. `expectedKills` is
  pre-arrival mass only; `expectedLateKills` is a sub-measure of the leaker mass. Display
  `totals.reportedLeakers` (null with no asset), never the partition term.
- **Expenditure channels:** `shotsFired` kinetic, `deSalvos` directed energy, `jamSalvos`
  EW, independent of hard versus soft kill (`expenditureChannel` versus `isHardKill`). DE
  and HPM are hard kills that fire no round. The engine round counter drops on every salvo.
- **Jam physics** (`src/analysis/ewPhysics.ts`): a jam holds only when nav mode, band
  coverage, boresight taper and power-range closure all pass. A 'continue' jam is
  illumination, not damage; the hold lapses when the target leaves the beam.
- **Run validity** (`src/analysis/runValidity.ts`): findings are `invalidating` or
  `limiting`; the requirement gates, the exported record and the toolbar chip all derive
  from it. `planning-envelope` is limiting on every gate under every deterministic run;
  `unvalidated-model` is limiting on every gate and names the used models with validation
  `none`. Derived live, never stored. `valid` is unreachable with the real `MODEL_TAGS`
  (the environment model has validation `none`); accepted as is (R-F-14).
- **Symbology** (`src/panels/Glyph.tsx`, `src/playback/trackState.ts`): MIL-STD-2525
  split, the frame carries affiliation and the icon carries function; `FRAME_FOR`,
  `FUNCTION_LETTER` and `FRIEND_FRAME_D` are shared by the palette, the library lists and
  `EntityLayer`. `PHASE_STYLE` is the one track-phase color and label table. Canvas labels
  draw `boardDesignator(entity.name)`.
- **Rings** (`src/canvas/layers/footprintStyle.ts`, `src/panels/ringLabels.ts`): seven
  ring keys under `ui.layers`, per-entity overrides under `ui.ringOverrides`,
  `ringVisible(ui, entityId, key)` the one resolver, `RING_STYLE` the one style source,
  `RING_LABELS` and `RING_HINTS` the one name table. Effector rings draw in `--danger`; a
  jammer keeps its entity-color cone. Only a selected-threat ring carries a label.
- **Analysis layout** (`src/state/analysisLayout.ts`): `BUILTIN_LENSES` the five lenses,
  `WIDGETS` (`src/panels/analysis/widgets/registry.ts`) the one type-to-component map,
  `ui.analysis` view state under `ANALYSIS_KEY` written eagerly by every layout action,
  builtin lenses never persisted. `Scenario.observedPresetId` is written on reset and first
  play only and stays out of the basis signature. `SURVIVAL_LABELS` and `KPI_LABELS`
  (`widgets/labels.ts`) are the one name table (Leakers, Survives, Survival limit; the
  effect gate is relabeled at render); `useSimTimeStep` (`widgets/controls.tsx`) is the one
  quantized time in the panels.
- **Selection detail** (`src/panels/analysis/detail/`): `DetailPane` is the one
  kind-to-pane map (sensor, effector, uas, c2); the panel reads `selection.entityIds` and
  nothing else from selection; exactly one entity with a pane replaces the widget stack,
  two or more keep it with a note, and the preset id never changes on selection. A pane
  carries no edit action; the Inspector owns edits. Series and ladder rows memo on
  `[scenario, runId]`, so only the now-readouts read the quantized time.
  `TRACK_LADDER_STYLE` (`series.ts`) is the one track-ladder legend and `STATE_LABEL`
  (`SystemStatus.tsx`) the one component-state word.
- **Chart series** (`src/analysis/series.ts`): every builder is pure `(scenario, id?) =>
  Series[]`, `LadderRow[]` or `ChartMark[]`, a series sampled from t = 0 at DT to
  `scenarioDurationS`, NaN where undefined, one `engagementPicture` call per builder.
  `trackSlots` assigns the five chart hues by first detection and never reassigns under a
  filter; status colors never color a series.
- **Model versus instance:** `SpecModel` (library entry, `builtin` flag,
  duplicate-and-edit) versus `Entity` (canvas instance referencing `specId`; survives model
  deletion with `specId` set to null). `Scenario.deletedSeedIds` keeps the seed merge from
  resurrecting a deleted builtin. A seed field change does not reach an existing save's
  copy of a builtin model; "Reset to seed" does.
- **Other:** kill chain = `Connection` list, sensor to C2 to effector or direct. Threat
  tactics live in `src/playback/tactics.ts`; the raid builder commits entities, paths and
  waves in one `mutate`. Threat WEZ geometry is `src/analysis/impact.ts`; `effectRadiusM`
  values are PF. Basemap modes are render toggles and never move data.
  `src/analysis/mcda.ts` scores 0 to 100 from `Scenario.mcdaWeights`.

## 6. Domain and analytical integrity

- **Three kinds of number.** A *sourced* value has a provenance row with basis `datasheet`
  (a manufacturer page, PDF or release that was opened and read) or `reference` (a named
  publication or government document that quotes the manufacturer), a URL and a read date.
  A *planning factor* (PF) is every other number: a seed value with no source, an engine
  constant (`SIZE_PENALTY`, `SCAN_S`, `FLYOUT_SPEED_FACTOR`, `EL_EPS_DEG`, the `PF_SPREAD`
  table), a group tier. A *user value* is a field the user edited; it loses its row and
  becomes PF. The UI tags every one. A blank stays PF; nothing is invented.
- **Seed value changes** need a `datasheet` or `reference` row in the same unit against a
  small-UAS class; a range band takes the lower bound. Every change is listed in the commit
  message. Seed values are load-bearing for fixtures and for the claims the tool makes.
- **Illustrative data** is labeled. The T&E demo campaign (`buildJiatf401()`) is marked
  `illustrative` and renders a banner; MASTER-CALCULATIONS fixtures are labeled
  illustrative in their sources and still bind the unit tests.
- **Fixture pins.** When a sourced seed value moves a fixture, pin the fixture, never the
  seed, with a comment that names the row. Hand-built test threats resolve altitude to the
  `altBandFt` midpoint; pin `altitudeFt` where slant must equal ground range; pin
  `swerling` on a fixed-wing fixture that feeds a Pd expectation; pin `rangeBasis:
  'planning'` on a radar whose scan time must not move a hand-derived latency; pin
  `doctrine.enabled = false` on a legacy fixture.
- **Deterministic versus stochastic.** The deterministic run is the *planning envelope*:
  threshold detection at `pdDetect`, kills as mass, phases at 0. It carries a `limiting`
  finding on every gate. The Monte Carlo run is the *estimate*: every headline number is a
  mean with a t-interval, a standard error, the replicate count and, for a conditional
  quantity, the defined fraction with a Wilson interval. Under `aleatory` only the draws
  vary; under `total` the parameter vector is sampled once per replicate too. Pd never
  multiplies kill mass in the deterministic mode. The two modes disagree by construction;
  do not tune one to match the other.
- **Statistical evidence.** A test that checks a random quantity asserts within 3 standard
  errors of a hand-derived value named in a comment, at a replicate count that makes the
  failure probability small and stated. Common random numbers are a promise of the draw
  keys; paired comparisons depend on them.
- **Engagement vocabulary.** A salvo record is an *event* (`report.events`), never a
  ledger. `tS` is the release (launch) time; `tEffectS` is the effect time, release plus
  `engageTimeS` plus flyout; `readyS` is the first possible release under the doctrine
  gate; `flightCapped` marks a flight cut at the envelope end. `expectedKills` is
  pre-arrival mass; `expectedLateKills` is a sub-measure of the leaker mass. Arrival and
  closest approach are different quantities. `reportedLeakers` is the display value.
- **Words.** User-facing copy is ASD-STE100 Simplified Technical English: short sentences,
  active voice, one instruction per sentence, no em-dashes. Use one word for one thing
  ("phase center", "event"). Measure labels in T&E Ops suppress pass or fail unless
  `thresholdApproved`.

## 7. UI and rendering invariants

Konva conventions:

- Constant screen-size strokes: `strokeScaleEnabled={false}` (stroke width and dash are
  then in px).
- Constant screen-size icons and labels: a Group with `scale={1/camera.scale}`; inner units
  are px.
- Footprints and other large fills are `listening={false}` or they swallow stage clicks.
- Thin-line hit tolerance: `hitStrokeWidth={n}` in screen px (do not divide by
  `camera.scale`).
- Drawing tools do not use Konva drag: the stage is `draggable` only when `ui.tool ===
  'select'`; other tools consume plain clicks and keep the rubber-band draft in
  `ui.draftPoints`.
- Each layer reads its own `ui.layers` flag and returns `null`; `CanvasStage` does no
  gating.
- Everything a layer draws at time t is derived at render from the scenario and
  `simTimeS`. A layer never stores derived state.

Design system (`src/index.css`):

- **Tokens, not literals.** `:root` holds a graphite ramp (`--surface-*`, `--border-*`,
  `--text-*`, `--status-*`) and short aliases (`--bg`, `--text`, `--accent`, `--danger`,
  `--good`, `--warn`, `--ew`, `--chart-1` to `--chart-5`). New rules read the semantic
  names. Spacing is `--space-1` to `--space-6` plus `--panel-pad`; motion is `--dur-fast` /
  `--dur`. `--border-control` is the boundary of an interactive control (WCAG 1.4.11 needs
  3:1); `--border-default` and `--border-subtle` are decorative hairlines and never go on
  an input.
- **Monospace is machine data only:** ids, coordinates, timestamps, units, keys, numeric
  readouts, fixed abbreviation codes, chart axis ticks. Interface chrome and prose are
  `--font-ui`; mark a number in prose with `.num`.
- **Type floor is 10 px.** The right panel is checked at 320 px width: no element under it
  may overflow (`scrollWidth <= clientWidth`).
- **Separators, not cards.** Hierarchy comes from surface tone, spacing, typography, a 1 px
  rule and interaction state. `--radius` is 3 px. The only shadows are `--shadow-float`
  (menus, dialogs, palette), `--shadow-pop` (tooltips, popovers) and the wash on
  `.right-panel`.
- **Charts:** `src/charts/tokens.ts` resolves CSS variables once per chart render and keeps
  `TOKEN_FALLBACK` equal to the sheet (a test proves it) for node and static markup.
- **Inspector kit** `src/panels/inspector/kit.tsx`: `Section`, `Row`, `ObjectHeader`,
  `Status`, `EmptyState`, `Kbd`, `ShortcutList`, `Actions`. A read-only property is a
  `Row`. The tab bar in `App.tsx` follows the ARIA tabs pattern; `.right-resizer` is a
  keyboard-operable separator.
- Keyboard map (`App.tsx`): Cmd+Z / Shift+Cmd+Z, Delete, Esc (cancel draft, tool to
  select), Enter (finish boundary or path), Space (play/pause). Shortcuts are suppressed
  while typing in inputs and inside the T&E workspace.

## 8. T&E Operations module (`src/te/`)

- Second workspace ("T&E Ops" toggle). Spec sources: `docs/te-plan.md` and the MASTER-*.md
  files in `docs/te-compilation/`.
- **Separate store, no undo:** `src/te/state/teStore.ts`, persisted at `rangeboard.te.v1`,
  recovery copy at `rangeboard.te.recovered.<ms>`. Records are versioned and append-only
  (runs never renumber, issued cards freeze, changes create new versions). Never embed
  campaign data in `Scenario`.
- IDs follow `VLK-<code>-<type>-<seq>` (`src/te/model/ids.ts`); versions live on the
  record. Cards use `id` (per version) plus `cardCode` (shared across versions).
- Gates in `src/te/validate.ts`: no issued card no run, no validity status no analysis, no
  traceability no finding. `issueCard` enforces blockers in the store.
- `src/te/calc/` is pure TypeScript, fixture-tested from MASTER-CALCULATIONS.md. The Board
  engine imports `meanInterval`, `quantile`, `wilson` and `betaQuantile` from
  `src/te/calc/stats.ts`; that is the one dependency from the engine on `src/te/`.
- Seeds in `src/te/seed/` (measure dictionary, templates, vignettes, `buildJiatf401()` demo
  campaign marked `illustrative`). Print artifacts in `src/te/print/` render into
  `PrintOverlay`; CSV exports in `src/te/io/exportCsv.ts`. Board frame capture
  (`src/te/io/frameCapture.ts`) works only from the Board workspace.
- The module was built 2026-08-19 to 2026-08-22, rebuilt as a guided decision workflow in
  `3d93aa1` (2026-08-25), and its persistence hardened in `7e5a5ae` (2026-09-02). Since
  then only `calc/stats.ts` changed (exports the engine imports). Every plan from
  2026-09-03 on put `src/te/` out of scope, so no later review covers it. Do not touch
  `src/te/` unless the task names it. One known stale string:
  `src/te/ui/DesignPanel.tsx` says "Recorded, not modeled. The board is plan view.", false
  since the Board gained altitude and slant range (`outstanding.md` D-2, open).

## 9. Repository working conventions

Source of truth, highest first:

1. The source under `src/`, its tests, and the output of the verification commands.
2. Git state and history. Slice and wave commits carry long messages;
   `git log -20 --format=%B` is the build record.
3. This file.
4. `docs/AI_HANDOFF.md` and `docs/data-engine/outstanding.md`.
5. Historical plans and handoffs (section 10). They record intent, not current state.
6. Anything remembered from a conversation. Re-check it against the items above.

Code style: 2-space indent, no semicolons, single quotes, named exports, `interface` for
object shapes, JSDoc on exported symbols, short "why" comments only where the code is not
obvious, lines under about 100 characters (a URL string may exceed it). No formatter is
installed. Follow the libraries the repository already uses; no new npm dependency without
the user's word. Export only what a sibling or a test imports. No TODO comments. Do not
create plan, status, summary or documentation files for a task unless the user asks.

The register, `docs/data-engine/outstanding.md`:

- It is append-only. One row per item in one of five tables. Prefixes: `D` (a decision the
  user holds, data-engine era), `F` (a code follow-up, data-engine era), `R-D` and `R-F`
  (the same two for the engine refactor and later work), `M` (docs and mockup). Continue
  each sequence from its last number; numbering stays contiguous (there is no `D-58`; do
  not fill it).
- Never delete a row, never renumber, never edit a row's text. Close a row by adding
  `decided: <answer>` or `done: <commit or wave>` to its status cell, with the date.
- Every discrepancy between a plan and the code, every accepted deviation, every decision
  an agent takes without the user's word, and every defect found and not fixed gets a row.
  A correct open finding is better than a speculative fix.
- After a commit or a push, update the "Committed so far" line at the top.
- Do not edit `docs/data-engine/PLAN.md` or `docs/engine-refactor/PLAN.md` beyond their
  status header; report discrepancies as rows.

Scope and git:

- Deliver exactly the requested scope. A question or an analysis request is not a change
  request: report findings and stop. Record an out-of-scope defect as a row, do not fix it.
- Do not touch `src/te/` unless the task names it. Do not edit `docs/inventory/` (the
  August 2026 research record).
- Do not bump `schemaVersion`, rename a storage key, add a draw point or change the raid
  partition without a decision row and the user's word.
- Update this file in the same change that alters a contract it describes. Keep the
  register: short bullets, one source per fact, no slice history.
- Commit only when the user says so. Push only when the user says push. Never force-push.
  Do not create a branch, merge to `main`, or stash unless the user asks. Before a commit or
  a push, report `git log origin/<branch>..HEAD --oneline` and the working-tree state.
  Never claim a command ran, a test passed or a file changed without tool output that
  shows it.

## 10. Documents and their status

| Path | Status | What it is |
| --- | --- | --- |
| `AGENTS.md` | CURRENT CONTRACT | this file |
| `CLAUDE.md` | CURRENT CONTRACT (pointer) | the Claude Code entrypoint; points here and holds only Claude-specific environment notes |
| `docs/AI_HANDOFF.md` | CURRENT TRANSFER RECORD | the state transfer with epistemic marks; verify its section 2 against git before you rely on it |
| `docs/data-engine/outstanding.md` | CURRENT OUTSTANDING REGISTER | every decision and follow-up; append only |
| `docs/data-engine/PLAN.md` | COMPLETED / HISTORICAL IMPLEMENTATION SPEC | the data-engine plan, slices 0 to 9, built `3b264e3` to `e6edbb4`; its imperative rules are history |
| `docs/data-engine/handoff-orchestrator.md` | HISTORICAL HANDOFF; browser recipe still useful | the slice 9 orchestrator handoff; its status table and "Do not" list are as of slice 9 |
| `docs/engine-refactor/PLAN.md` | COMPLETED / HISTORICAL IMPLEMENTATION SPEC | the engine refactor plan, slices 0 to 7 in three waves, built `965a62b` to `e55aa86`; section 12 (standards) is still cited by `fidelity.ts` |
| `docs/engine-refactor/handoff-post-wave3.md` | HISTORICAL HANDOFF | the wave 3 orchestrator handoff at `e55aa86`; superseded by `docs/AI_HANDOFF.md` |
| `docs/inventory/` | REFERENCE / RESEARCH | the August 2026 source record behind the seed library; the current provenance record is `SpecModel.provenance` in `seedLibrary.ts` |
| `docs/threat/` | REFERENCE / RESEARCH | the public-source UAS threat study, 2026-08-22 |
| `docs/te-plan.md`, `docs/te-compilation/` | COMPLETED / HISTORICAL IMPLEMENTATION SPEC and REFERENCE for `src/te/` | the T&E Ops product plan and its compiled sources; MASTER-CALCULATIONS.md is the fixture source of `src/te/calc/` tests |
| `README.md` | STALE | the unmodified Vite template |
| `docs/data-engine/mockup.html`, `mockup-te.html`, `build_mockup.py`, `build_mockup_te.py` | NOT IN GIT | visual targets of built slices, present in the working tree as untracked files by the user's choice; the code is the truth |
| `docs/data-engine/HANDOFF.md` | NOT IN GIT, absent on purpose | the agent-team slice protocol; a reference to it points at nothing in the repo |

No plan document exists past the engine refactor. The next body of work is the user's to
name; candidates are listed in `docs/AI_HANDOFF.md` section 13.
