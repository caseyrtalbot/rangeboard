# RangeBoard engineering reference

Current technical contract, extracted from AGENTS.md on 2026-09-05 at `66db3ad`.
Read the sections relevant to a change before editing. Source and tests determine actual
behavior; requirements and known implementation gaps are distinguished below.
Repository paths in code spans are relative to the repository root.
For workflow and authorization, read [AGENTS.md](../AGENTS.md); for current scope and evidence,
read [the handoff](AI_HANDOFF.md). Section numbers are retained for existing references.

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
  `src/geometry/geo.ts`, which `src/playback/sim.ts` imports. `playback.simTimeS` is the
  simulation clock; the playback slice also owns speed, flags, run identity and basis state.
  `TimelineBar` owns the requestAnimationFrame loop that publishes `simTimeS` every 100 ms of
  wall time at every speed (10 Hz, `PUBLISH_PERIOD_MS` in `src/canvas/frameClock.ts`); each
  publication advances by the measured wall time at playback speed. The canvas frame clock
  (`useFrameClock`, mounted in `LiveScene` under the Konva stage) derives its display time
  from the last published `simTimeS` plus the wall time since that publication at
  `speedMult`, clamped to one period. Any pulse, blink or playhead derives from `simTimeS`
  or that display time; never a timer. Panels subscribe through `src/state/selectors.ts`.
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
  `rangeboard.scenario.recovered.<ms>` before anything writes when recovery storage is
  available. Recovery names avoid collisions and exact readback is verified. Read denial or failed
  recovery pauses autosave so the only raw copy is retained; the notice explains export,
  storage cleanup and reload. C3 validates required/nested shapes, finite/ranged values,
  IDs/references and engine representability before default filling and adoption.
  Missing supported legacy fields fill; malformed present fields fail with a path/reason.
  Unknown extension data and legitimate legacy edits remain. `loadScenario` is the one
  load path; `replaceScenario` clears history, selection, drafts and the tool, and prunes
  per-entity view state.
  Validation descriptors share the domain types; semantic/reference rules remain explicit.
  Reserved object-prototype IDs are rejected before object-backed engine maps can lose
  records. Triangular spread bounds are fractional offsets around zero, matching the sampler.
  Base64 image syntax follows native decoder padding rules. New underlay ingestion uses
  a conservative 5 MiB storage admission budget; existing valid images are not size-capped.
  Representation checks are not a crash journal; the execution budget is the worker's
  (`DEFAULT_BUDGET` in `mcRun.ts`, below).
- **Storage keys live in `src/io/storageKeys.ts`;** never rename one; add a new key
  instead. View state outside the `Scenario` has its own keys (`rangeboard.view.v1`,
  `rangeboard.layers.v1`, `rangeboard.rings.v1`, `rangeboard.runseq.v1`,
  `rangeboard.analysis.v1`, `rangeboard.units.v1`, the panel chrome keys) and is written
  eagerly by its setter in `src/io/viewState.ts`.
- **Module cycles:** `model/scenario.ts` owns `modelFor`, `pathSpeed` and
  `scenarioDurationS`; engine and validation consumers import that leaf directly.
  `state/rings.ts` owns shared ring keys/types, so `viewState.ts` has no runtime store
  dependency. Panels and canvas import every leaf directly; `store.ts`, `sim.ts` and
  `attrition.ts` carry no re-exports (Wave 2, 2026-09-05).
  Keep `store.ts` free of value imports from `mcRun.ts`, `series.ts`, `impact.ts` and
  `attrition.ts`; worker execution stays behind `mcClient.ts`. The worker value-import
  graph must stay independent of stores, React, zustand, localStorage and panel modules.
  `runSession.ts` is a main-thread store adapter, outside that graph. `policy.ts` imports
  `stepIndex` from `playback/clock.ts`, so `sim.ts` and `policy.ts` no longer form a cycle.
  `src/analysis/fidelity.ts` reads the scenario, never the picture, so it stays cycle-free.
- **Monte Carlo worker:** the store action `runMonteCarlo` posts a request through
  `src/playback/mcClient.ts` to `mc.worker.ts`, which runs `runReplicates`
  (`src/playback/mcRun.ts`). Each client slot forwards callbacks only from its current
  worker instance, including repeated requests within one playback run. The store accepts
  progress, completion and errors only while that slot is running, for the current playback
  id and analysis basis. Terminal states reject later callbacks. The result lives in the
  `mc` slice: view state, never persisted, never in `past`. `resetRun` and `replaceScenario`
  clear it; edits, undo and redo use `analysisBasisSignature` to mark mismatched results
  stale. The signature includes domain fields by default, removes named presentation and
  evidence metadata, resolves scenario/entity/link defaults, and uses `uncertainFields`
  for effective spreads and draw identities. Raw model specs are conservatively included;
  object key order is ignored and array order is preserved. See the input matrix in
  `docs/field-te/C1_COMPLETION.md`. A second worker slot runs `runSensitivity` on demand.
  `engagementPicture` stays the deterministic path; the replicate loop never touches its cache.
- **Worker budget and cancel (R-F-31):** `replicateLoop` and `sensitivityLoop` (`mcRun.ts`)
  are generators that yield a `Checkpoint` after every replicate; `runReplicates` and
  `runSensitivity` drive them synchronously and unchanged. The worker drives them
  asynchronously under `DEFAULT_BUDGET` (96 million retained numbers, one quarter of the
  measured 384 million at which a Chromium 151 worker took the page down; ten minutes of
  wall time), yields to the event loop every 50 ms so a `cancel` request is read, and
  posts progress every tenth replicate or after 250 ms of silence. A run whose summary
  alone exceeds the budget is refused before its first replicate. A budget stop or a
  cancel keeps the replicates done and reports `stopped.rule` 'budget' or 'cancelled'; a
  sensitivity run drops the field in progress and carries `stopped` only when cut short.
  The store actions `cancelMonteCarlo` and `cancelSensitivityRun` post the request through
  `mcClient.ts`, which terminates a worker silent for `CANCEL_GRACE_MS`. Measurements:
  `docs/field-te/evidence/rf31-budget-2026-09-05/`.
- **Thresholds are test-defined:** `Scenario.requirements` (`RequirementThresholds`,
  defaults in `DEFAULT_REQUIREMENT_THRESHOLDS`) holds what the test asks the system to
  meet. Every reader spreads `{ ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }`.
  Never gate a requirement on an engine constant: a gate at `SHIP_DEAD_BELOW` passes itself
  by construction.
- **No invented values:** every unsourced number is a planning factor (PF) and is labeled
  as one. Never invent a value to fill a blank; record the blank as an open item instead.
- **No `Math.random` under `src/`.** Every draw goes through `DrawPolicy` (section 5). The
  engine draws in exactly five places; a sixth needs a plan entry and a decision row.
- **T&E store is separate** (section 8 below). Never embed campaign data in `Scenario`.

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
               playback + mc), analysisLayout.ts (lens presets and pure layout reducers),
               layers.ts (LayerVisibility, presets, ringVisible), runState.ts (playback and
               MC state shapes and their scenario-change reducers), analysisBasis.ts
               (analysisBasisSignature), raidBuilder.ts (standoff search, buildRaid),
               labels.ts (run, connection, frame and card-version labels), camera.ts
               (fitCameraTo), rings.ts (ring keys, pruneRingOverrides), selectors.ts
src/playback/  clock.ts (DT = 0.5 s, stepIndex), tracks.ts (positions at t), detection.ts
               (sensor sweep, detectionsAt, spawn ring check), killChain.ts (kill-chain
               routes), sim.ts (assessThreat, assessAllThreats), pk.ts (Pk model and
               expenditure channels), intercept.ts (time of flight, intercept, launch
               releases), attritionReport.ts (report types), sweepState.ts (sweep state
               types), attrition.ts (resolveEngagements: fire distribution, expected
               kills, events), trackState.ts
               (phase at t), tactics.ts (threat tactics), raid.ts, runSession.ts,
               policy.ts (DrawPolicy), mcRun.ts (runReplicates, runSensitivity, Stat,
               McSummary), mc.worker.ts + mcClient.ts (the replicate worker)
src/analysis/  sensorEnv.ts (sensor physics), radarPd.ts (Pd closed forms), ewPhysics.ts
               (jam), doctrineFactors.ts (per-system factors), impact.ts
               (engagementPicture cache, WEZ), liveStats.ts (KPIs at t), series.ts (chart
               series on the DT grid), runValidity.ts, requirements.ts, uncertainty.ts
               (sampling), parameterBasis.ts (pure spread resolution/enumeration), fidelity.ts (model tags), mcda.ts, aar.ts,
               systemTelemetry.ts, threatAggregation.ts, range.ts
src/ui/        kit.tsx: the shared primitives Field, Seg, State and ProvMark that both the
               Board panels and the T&E kit render; reads index.css classes only, no store
src/charts/    recharts kit: types.ts (Series), tokens.ts, timeAxis.ts, ChartFrame,
               TimeSeries, Ladder, Tornado, Sparkline. Props only; never reads the store.
src/canvas/    CanvasStage.tsx (stage, pan/zoom, tool routing, drop target),
               TrackFileReadout.tsx, layers/ (one Konva layer per concern;
               footprintStyle.ts is the ring style source)
src/panels/    Toolbar, ViewMenu, Palette, Inspector (+ inspector/kit.tsx over src/ui/kit.tsx,
               spreadText.ts),
               LibraryEditor, TestCardsPanel, AnalysisPanel (+ analysis/, analysis/widgets/,
               analysis/detail/), TimelineBar (owns the rAF loop), CommandPalette,
               Glyph.tsx (symbology), ringLabels.ts (ring names), headlines.ts
src/io/        persist.ts (autosave, fillScenario, adoptSeedProvenance, JSON and library
               import/export, runExportObject), runResultGroups.ts (per-group basis/units),
               runtimeSchema.ts + generateRuntimeSchema.mjs (domain shape descriptors),
               runtimeValidation.ts + validateScenario.ts (runtime semantics),
               viewState.ts (view, layers, rings, run sequence and units keys), storageKeys.ts,
               recovery.ts
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
  measurement: it holds continuity and never moves the classification ladder, and it
  exists only after the track has initiated; a missed scan before `trackInitAtS` ends the
  hold while the M-of-N window keeps counting (F-15).
- **Fire doctrine** (`Scenario.doctrine`, enabled by default): the gate is per effector and
  route-aware (a firm track from a sensor routed to that effector, hostile ID, the
  declaration dwell); `readyS` = gate + route latency + target dwell is the first possible
  release. Fire distribution is shoot-look-shoot with a BDA dwell; the launch point follows
  `doctrine.launchPolicy`. `tEffect = t + engageTimeS + timeOfFlightS(spec, interceptSlant)`
  from `flyoutSpeedMps` (kinetic only; no speed means no flyout term), charged at
  `flyoutSpeedMps` times `FLYOUT_SPEED_FACTOR` (0.7, PF, in `attrition.ts` beside
  `SIZE_PENALTY`) because a stated speed is a maximum. `interceptAt` is the one predicted
  intercept: the exact constant-speed meeting time along the path (`analyticTofS`, R-F-43:
  the target holds the first point before its delay and the last point after the path ends,
  and on each straight segment the formation member moves at constant velocity, so the
  meeting time is the smallest root of a quadratic per phase in time order), and it caps the
  flight at the end of the envelope interval that holds the release: a flight past that end
  lands at the end and the event carries `flightCapped`. It also reports `infeasible`
  (R-D-44): the slant to the credited point exceeds the reach `v * (tEffectS - release)` by
  more than one DT of flight, which with the exact solution happens only at a cap or when
  no meeting exists; both selection passes decline such a shot (no event, no round, no
  cooldown). `kineticPk(basePk, maxRangeM, uas, slantM)` is the one
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
  interval `lo` and `hi` at `conf` with its `interval` method, the quantiles, `n` finite
  samples of `total` run, and the `defined` fraction with a Wilson interval, built from
  `meanInterval`, `quantile` and `wilson` in `src/te/calc/stats.ts` (the one engine
  dependency on `src/te/`; import a statistic from there, never copy it). `statOf` takes
  the statistic's kind (R-D-39, R-F-41): a time keeps the t-interval; a count clamps it to
  [0, max] (ships, tracks, or unbounded for salvos); a 0/1 count (max 1) takes the Wilson
  interval; a count with a finite max at 0 of n reports the rule-of-three upper bound
  3 max / n on its mean (no independence between ships), and at n of n the mirror
  max - 3 max / n; an all-zero unbounded count keeps its zero-width clamped t-interval.
  `p10`/`p90` are NaN under `BAND80_MIN_N` (10) samples and `p025`/`p975` under
  `BAND95_MIN_N` (40) (R-D-40). `McSummary.firmTrackS` is the earliest `stableTrackAtS`
  per replicate; `firstDetectS` is the first single-scan hit (R-D-43). The replicate loop
  stops after 30 replicates, and every 10 after that, when the half-width of the displayed
  interval on the end-of-run leaker mean (the leakers `Stat` through `statOf` over the
  raid's ships, R-F-42) is under `targetHalfWidth`; `McSummary.stopped` records the
  rule and the replicate. Panels read a time `Stat` through `timeStatSub(stat, quantity)`
  (names the single-scan-hit basis, shows the defined fraction's Wilson interval, withholds
  the mean CI under `TIME_CI_MIN_N` 30 defined; R-D-41) and a band step through
  `countSub` (the interval as its two ends, since a count interval is not symmetric)
  (`widgets/mc.ts`). Bands and tile subs read current `McSummary` through `withBands`
  (`series.ts`) and `currentSummary`, only when `mc.status` is `done` for the current run
  id. Covered chart lines become replicate means with 80/95 percent replicate-quantile
  bands, each drawn only when its quantiles are finite; `bandNote` words the rule. Tile
  intervals describe means, not those quantiles. Values and intervals share
  quantity/denominator; Defeat converts ship count and interval to percent by the same raid
  size. Missing/zero-sample estimates remain unavailable and n=1 carries no claimed mean
  CI. Full-run conditional time means are labeled; quantities without a replicate
  statistic retain an individual planning-envelope label.
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
- **Parameter uncertainty** (`src/analysis/parameterBasis.ts`, re-exported by
  `uncertainty.ts`): `spreadFor(model, field)` is
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
  nominal, paired by the same seed and replicate index, rows sorted by swing, each row
  with `se`, the paired standard error of the per-replicate difference (R-D-42); the
  `sensitivity` widget runs it on demand on its own worker slot into `mc.sensitivity`,
  which a basis change marks stale. The sensitivity widget reads `currentSensitivity`
  and hides stale rows and replicate metadata. `spreadText` (`src/panels/inspector/spreadText.ts`) is
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
  `none`. Derived live, never stored. `valid` depends on the models and conditions used.
  Requirement gates always evaluate the deterministic planning envelope using complete
  envelope findings, even in MC mode; a mean CI is not probability of meeting a gate.
  Run exports retain deterministic payloads and declare `resultGroups` basis, horizon,
  validity and quantity semantics, plus configuration equality identity. `packageBasis`
  scopes the legacy `dataBasis` field to its named groups. Sensitivity endpoints are
  paired OAT parameter perturbations, not mean CIs or outcome quantiles; leaker display
  remains undefined without a defended asset.
  A sensor-only MC case at neutral covariates with environment application and doctrine
  disabled can be `valid`; the old universal claim in R-F-14 was disproved in onboarding.
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
  gate; `flightCapped` marks a flight cut at the envelope end; an *infeasible* intercept
  (interceptor cannot reach the credited point) is declined and leaves no event. `expectedKills` is
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
- **Type floor is 10 px in the current source.** The right panel is checked at 320 px
  width: no element under it may overflow (`scrollWidth <= clientWidth`). The
  [design contract](design/DESIGN_CONTRACT.md) raises the floor to 11 px and replaces the
  token, radius and shadow rules below when its steps 2 and 3 land; update this section in
  that slice.
- **Separators, not cards.** Hierarchy comes from surface tone, spacing, typography, a 1 px
  rule and interaction state. `--radius` is 3 px. The only shadows are `--shadow-float`
  (menus, dialogs, palette), `--shadow-pop` (tooltips, popovers) and the wash on
  `.right-panel`. The design contract removes shadows and reduces the radius to 2 px on
  controls and 0 elsewhere.
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
  campaign data in `Scenario`. C4 enforces issued/superseded card immutability, frozen
  baselines and generic action guards. Delivery freezes campaign evidence; closure remains
  available. See [C4 record rules](field-te/C4_COMPLETION.md#record-rules).
- IDs follow `VLK-<code>-<type>-<seq>` (`src/te/model/ids.ts`); versions live on the
  record. Cards use `id` (per version) plus `cardCode` (shared across versions).
- Gates in `src/te/validate.ts`: no issued card no run, no validity status no analysis, no
  traceability no finalized finding. Qualification, acknowledged design review, issue and
  delivery enforce blockers in the store. Delivery finalizes findings; prefilled approver
  names are not finalization. Quantitative and failure-investigation inclusion use the
  explicit policy in `validate.ts`; invalid runs cannot count as valid quantitative trials.
  Observation corrections preserve both values and require re-adjudication. Optional
  history fields do not fabricate past snapshots on legacy loads.
- `src/te/calc/` is pure TypeScript, fixture-tested from MASTER-CALCULATIONS.md. The Board
  engine imports `meanInterval`, `quantile`, `wilson` and `betaQuantile` from
  `src/te/calc/stats.ts`; that is the one dependency from the engine on `src/te/`.
- Seeds in `src/te/seed/` (measure dictionary, templates, vignettes, `buildJiatf401()` demo
  campaign marked `illustrative`). Print artifacts in `src/te/print/` render into
  `PrintOverlay`; CSV exports in `src/te/io/exportCsv.ts`. Board frame capture
  (`src/te/io/frameCapture.ts`) works only from the Board workspace.
- The module was built 2026-08-19 to 2026-08-22, rebuilt as a guided decision workflow in
  `3d93aa1` (2026-08-25), and its persistence hardened in `7e5a5ae` (2026-09-02). Since
  then `calc/stats.ts` gained the engine exports. C3 now also hardens persistence and
  imports through `io/validateTe.ts`, including embedded Board snapshots and campaign-local
  references. C4 adds internal transition and evidence-history checks. Do not touch
  `src/te/` unless the task names it.
