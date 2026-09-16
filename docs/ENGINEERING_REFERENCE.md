# RangeBoard engineering reference

Technical reference for the application as built. [AGENTS.md](../AGENTS.md) is the
concise agent entry point; this file holds the details. Source and tests decide
behavior. Paths in code spans are relative to the repository root. Section numbers start
at 3 because other documents link to them by number.

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
  (`useFrameClock`, mounted once in `LiveScene` on the live Konva Layer) derives its display time
  from the last published `simTimeS` plus the wall time since that publication at
  `speedMult`, clamped to one period. Any pulse, blink or playhead derives from `simTimeS`
  or that display time; never a timer. Panels subscribe through `src/state/selectors.ts`.
  Playback commands own observation and replay: `src/state/playbackCommands.ts` is
  store-free and resolves one intent (`play`, `pause`, `toggle`, `scrub`, `frame`,
  `publish`, `advance`, `complete`, `newRun`) into a transition that the store action
  `playbackCommand` applies through `set`; the named actions (`startTrialRun`, `pauseRun`,
  `scrubTo`, `applyFrame`, `advanceRun`, `completeRun`, `resetRun`) are those commands.
  The module owns reset versus replay, the first-start stamps (`startedAtMs`,
  `basisSignature`, the observed lens, the run sequence write), observation advance,
  the one completion at the run duration, cancellation of a pending automatic start and
  frame = scrub + camera. `TimelineBar` publishes only; a publication while stopped
  changes nothing. `scrub` and `frame` neither advance `observedThroughS` nor stamp
  `startedAtMs` or `basisSignature`.
- **Board phase and horizon:** `BoardPhase` is exported only from `state/runState.ts`.
  `ui.boardPhase` starts at Prepare and is never persisted or recorded in undo history.
  `analysis/horizon.ts` is store-free: frozen full-run and empty horizons, inclusive time
  checks and leading sample counts. `selectExecutionHorizon` returns the
  full-run constant in Prepare and Analyze, the empty constant when `startedAtMs == null`
  (including a scrub before first Play), otherwise a stable object for the minimum of
  quantized cursor and observed time. `useExecutionHorizon` and `useRunCursor.horizon`
  expose that scope; scrubbing can narrow it but never advances observation. Changing
  navigation alone never changes scenario, history or playback.
  Sampled consumers use `trialSelectors.ts`: `selectTrialSelection` validates the retained
  run and basis, and `selectTrialHorizon` bounds the raw cursor by observed time and the
  retained result in every phase. `useTrialResult.ts` exposes no snapshot before Play.
  `selectExecutionHorizon` remains the scope for explicit forecast consumers.
- **Undo model:** `mutate(fn)` pushes a full scenario snapshot to `past` (cap 100) and
  clears `future`. Only scenario changes are undoable. A scenario-touching action goes
  through `mutate`; view state (camera, selection, ui, layers, ring overrides, analysis
  layout, the `mc` and `trial` slices) goes through `set` and never pushes history.
  `mutate`, `undo`, `redo` and `replaceScenario` all install the next scenario through
  `installScenario(slices, { op })` in `src/state/scenarioInstall.ts`, the one place that
  decides per operation what history, selection, ring overrides, playback, `mc` and
  `trial` do (`edit` pushes, `undo`/`redo` walk, `replace` clears history and cancels every
  worker). A rule for "a new Scenario is current" belongs there, keyed by operation, never
  in one caller. One exception:
  `Scenario.observedPresetId` is stamped through `set` on reset and first play, and undo
  and redo carry the current stamp over a restored snapshot. A stamp that already matches
  replaces nothing. A new stamp is a presentation variant of the current object
  (`markPresentationVariant` in `src/model/scenario.ts`): every engine-keyed cache reads
  `engineKeyOf(scenario)`, the base of that chain, so the Play click misses no cache.
- **Schema:** `Scenario.schemaVersion = 1`. `src/io/compat.ts` owns Board schema-1
  compatibility. `SCENARIO_LEGACY_FIELDS` declares every field a legacy save may omit
  together with the filler that supplies it. The validator's accepted omissions and
  `fillScenario` both derive from that one declaration, so an accepted omission cannot
  exist without a fill. `fillScenario`
  (`src/io/persist.ts`) validates the shape, spreads a save over `emptyScenario()` and
  deep-fills one level into every `container` entry
  (`environment`, `requirements`, `doctrine`, `mcdaWeights`, `underlay`, `raid`).
  `library` and `systemPresets` reconcile against the current seeds; `doctrine` and `roe`
  carry named migrations. A new
  top-level field, or a field inside one of those, needs only a default in
  `emptyScenario()`; a new nested object needs a `container` entry in the declaration.
  New fields
  added to schema 1 must remain compatible with legacy saves, using optional fields and
  defaults where needed. Bump the version only for a breaking shape change, and only
  when the user asks. A save that cannot load is copied to
  `rangeboard.scenario.recovered.<ms>` before anything writes; the copy is read back and
  checked. Read denial or a failed recovery pauses autosave so the only raw copy survives.
  Read denial uses the save-status error; failed recovery queues an in-app Storage notice
  explaining export, storage cleanup and reload. Runtime validation
  (`src/io/runtimeValidation.ts`, `validateScenario.ts`) checks shapes, finite and ranged
  values, ids, references and engine representability before default filling. The shape
  check runs once, inside `fillScenario`; `parseScenarioData` and `parseAutosave` both
  reach it through that one call. Missing
  legacy fields fill; a malformed present field fails with a path and reason. Unknown
  extension data survives. Reserved object-prototype ids are rejected. Triangular spread
  bounds are fractional offsets around zero. Base64 image syntax follows native decoder
  padding. A new underlay image passes a 5 MiB admission budget; an existing valid image
  is not size-capped. `loadScenario` is the one load path; `replaceScenario` clears
  history, selection, drafts and the tool, and prunes per-entity view state.
- **Storage keys live in `src/io/storageKeys.ts`;** never rename one; add a new key
  instead. The live keys are `SCENARIO_KEY` (`rangeboard.scenario.v1`), `BOARD_BASELINE`
  (`rangeboard.baseline.v1`), `LAYERS_KEY`,
  `RINGS_KEY`, `UNITS_KEY`, `VIEW_KEY`, `RUNSEQ_KEY`, `RIGHT_PANEL_WIDTH_KEY`,
  `RIGHT_PANEL_OPEN_KEY`,
  `PALETTE_WIDTH_KEY`, `PALETTE_COLLAPSED_KEY`, `ENGSTRIP_OPEN_KEY` and the retired
  `ANALYSIS_KEY` (`rangeboard.analysis.v1`), which earlier builds wrote for the removed
  lens layout and nothing reads now, and `OVERRIDES_KEY` (`rangeboard.overrides.v1`), an
  `OverrideSet` written by `overridesAutosaveAdapter` (`src/io/persistOverrides.ts`) from
  the separate `useOverrides` store with its own `OVERRIDES_RECOVERY_PREFIX`. Run history
  is not a localStorage key: `RUNS_DB_NAME` (`rangeboard.runs.v1`) names the IndexedDB
  database `src/io/runStore.ts` owns, with a 64 MiB cap and oldest-first eviction. The removed T&E Ops workspace wrote
  `rangeboard.te.v1` and `rangeboard.te.recovered.*`; nothing reads or lists them now,
  and no code deletes them. Two recovery namespaces exist: `SCENARIO_RECOVERY_PREFIX` and
  `BASELINE_RECOVERY_PREFIX` (`rangeboard.baseline.recovered.`); `storageManagement.ts`
  derives the live-key list and the namespace list from every export of `storageKeys.ts`
  by the `_RECOVERY_PREFIX` name suffix. The scenario and baseline autosaves have their
  own read and error paths; both run through the one lifecycle in `src/io/autosave.ts`,
  and their adapters keep the keys, the records and the save status separate. The baseline adapter
  (`baselineAutosaveAdapter`, `src/io/persist.ts`) writes a `BaselineSave` (`schemaVersion`
  1, `baseline` or null; a cleared baseline is written as null, never removed, so a
  pending pin write cannot revive it). `parseBaselineSave` validates before adoption: the
  scenario passes `parseScenarioData`, the `McSummary` passes `validateMcSummary`
  (`src/state/baseline.ts`), and `label`, `pinnedAt` and `scenarioHash` must be nonempty
  strings with an ISO time. JSON has no NaN, so a NaN statistic is saved as null and
  restored as NaN; an arrival stays null. An unreadable copy goes to the baseline
  recovery prefix through the same `recoverUnreadableSave`. Every other
  settings key (view, layers, rings, run sequence, units, panel widths,
  collapse flags) is read and written through `readSetting` and `writeSetting` in
  `src/io/viewState.ts`, the one guarded localStorage path for settings. An older saved
  view can still carry an `analysis` lens layout; the reader drops it and never fails. The camera write
  is queued and flushed by `flushViewWrites` on pagehide and tab hide. `storageManagement.ts`
  guards enumeration, exact raw recovery downloads and per-key deletion; it cannot delete
  live keys or change autosave admission. `recovery.ts` retains startup notices in memory
  until dismissed, so recovery before React mounts is visible in `StoragePanel.tsx`.
  Usage is an estimate of UTF-16 key and value bytes, not a browser quota guarantee.
- **Module cycles:** `model/scenario.ts` owns `modelFor`, `pathSpeed` and
  `scenarioDurationS`; engine and validation consumers import that leaf directly.
  `state/rings.ts` owns shared ring keys/types, so `viewState.ts` has no runtime store
  dependency. Panels and canvas import every leaf directly; `store.ts`, `sim.ts` and
  `attrition.ts` carry no re-exports.
  Keep `store.ts` free of value imports from `mcRun.ts`, `series.ts`, `impact.ts` and
  `attrition.ts` or `trial.ts`; worker execution stays behind `mcClient.ts` and
  `trialClient.ts`, both over `workerSlot.ts`; `store.ts` and `scenarioInstall.ts` reach
  those adapters only through `src/state/analysisRequests.ts`, to start and to cancel
  alike, and import neither adapter. The worker value-import graph must stay independent
  of stores, React, zustand, localStorage and panel modules.
  `runSession.ts` is a main-thread store adapter, outside that graph. `playback/clock.ts`
  owns `DT` and `stepIndex`, so `sim.ts` and `policy.ts` form no cycle.
  `src/analysis/fidelity.ts` reads the scenario, never the picture, so it stays cycle-free.
- **Worker slots and analysis requests:** `src/playback/workerSlot.ts` is the one worker
  slot implementation (`createWorkerSlot`: `start`, `cancel`, `dispose`). A slot holds at
  most one live worker; `start` replaces it, forwards callbacks only from its current
  worker instance (a replaced or disposed worker's queued callbacks are dropped by exact
  ownership), turns a synchronous construction or post failure into one terminal error in
  the protocol's own shape, and releases the worker on a terminal message before delivering
  it. `cancel` posts the protocol's stop request and terminates a worker silent for
  `CANCEL_GRACE_MS`. `mcClient.ts` (a worker pool for replicates, `workerPool.ts`, and one slot for
  sensitivity shared with the sweep, Morris and Sobol) and
  `trialClient.ts` (one slot) and `optimize/client.ts` (one slot for the placement
  optimizer, `startOptimize` and `cancelOptimize`) are protocol adapters over it: they own the worker URL,
  the request envelope, decoding, identity checks (run id; for a trial also request token,
  basis and manifest) and their cancellation semantics (graceful with grace period for MC,
  immediate terminate for a trial). Above them, `src/state/analysisRequests.ts` owns what
  a request is for the five kinds `mc`, `sensitivity`, `sweep`, `trial` and `optimize`
  (`AnalysisKind`): `requestAnalysis` builds
  the identity (run id, analysis basis, trial token and manifest), publishes the pending
  slice state first and starts the worker second, so a synchronous startup error or a
  missing `Worker` lands as a terminal error on that state; `acceptMcMessage`,
  `acceptSensitivityMessage`, `acceptSweepMessage`, `acceptTrialMessage` and `acceptOptimizeMessage` accept a message only while the
  request is live, for the current playback id and analysis basis (and for a trial the
  token and manifest). Terminal states accept nothing. Store actions `runMonteCarlo`,
  `runSensitivity`, `runSweep` and `prepareTrial` request an analysis; the store's `mcMessage`,
  `sensitivityMessage`, `sweepMessage` and `trialMessage` sinks reduce through the accept functions.
  The optimize kind carries an `OptimizeSpec` (objective, movable ids, bounds, budget)
  that no other request has, so it has its own entry `requestOptimize` (`RequestKind`
  excludes it from `requestAnalysis`); the store's `runOptimize`, `optimizeMessage`,
  `cancelOptimize` and `clearOptimize` are its launch, sink, cancel and clear. Its
  result lives in `McState.optimize` (`AnalysisRunState<OptimizeResult>`) with the best
  evaluation so far in `optimizeBest`; `installScenario` cancels a live optimize run and
  marks the result stale, like the other analyses.
  A sweep launch replaces a pending sensitivity run and a sensitivity launch replaces a
  pending sweep, because they share one slot; `runSweep` takes a `SweepSpec` (factors,
  `replicatesPerCell` and `responses`, defaults in `SWEEP_DEFAULTS`) and is refused
  without it or under deterministic mode. Adding
  another worker-backed analysis means one adapter and one launch/accept pair, not a new
  slot implementation.
- **Monte Carlo worker:** `runMonteCarlo` requests the `mc` kind, which posts through
  `src/playback/mcClient.ts` to a pool of `min(hardwareConcurrency - 1, 8)` `mc.worker.ts`
  instances (`workerPool.ts`), each running `replicateRangeLoop` (`mcRun.ts`) over a chunk
  of replicate indices. The coordinator merges the partials by index (`mergeSummaries.ts`),
  applies the half-width rule on the contiguous prefix from `stopFloor`, stops at `stopCap`
  and finishes with `finishSummary`, so the pooled summary equals the single-worker
  `runReplicates` at one seed (`workerPool.test.ts`). The result lives in the
  `mc` slice: view state, never persisted, never in `past`. `resetRun` and `replaceScenario`
  clear it; edits, undo and redo use `analysisBasisSignature` to mark mismatched results
  stale, and each run keeps the override list it applied (`AnalysisRunState.overrides`,
  `activeOverrides` at launch) as the second half of its identity: an override edit that
  changes the values in force reaches the store through `useOverrides.subscribe` and
  `overridesChanged` (`runsForOverridesChange` in `scenarioInstall.ts`), which marks the
  replicate, sensitivity, sweep and optimize runs stale, drops a trial whose manifest
  lists other values, and restarts a started playback as a configuration change. Save
  to history (`runRecordOf`, `panels/analysis/mc.ts`) and `pinBaseline` write that list,
  never the overrides in force at the click; the Outcome and Compare forecasts and the
  export's requirement validity run `trialForecast`, the picture of the captured
  scenario with the manifest's overrides applied, so a detection-side override raises
  no forecast-trial disagreement. The signature includes domain fields by default, removes named presentation and
  evidence metadata, resolves scenario/entity/link defaults, and uses `uncertainFields`
  for effective spreads and draw identities. Raw model specs are conservatively included;
  object key order is ignored and array order is preserved. See the input matrix in
  `docs/field-te/C1_COMPLETION.md` in Git history. A second worker slot runs `runSensitivity` and
  `runSweep` on demand.
  `engagementPicture` stays the deterministic path; the replicate loop never touches its cache.
- **Factor sweep** (`src/playback/sweepFactors.ts`, the sweep section of `mcRun.ts`):
  one ensemble per grid cell over one or two scenario factors. The request is

  ```ts
  interface SweepFactor { id: SweepFactorId; values: number[] | string[] }
  type SweepFactorId = 'threatAltitudeFt' | 'threatSpeedMps' | 'approachAzimuthDeg'
    | 'raidSize' | 'environmentPreset'
  interface McSweepRequest {
    type: 'sweep'
    runId: string
    scenario: Scenario
    factors: [SweepFactor] | [SweepFactor, SweepFactor]
    replicatesPerCell: number
    responses: SensitivityResponse[]
  }
  interface SweepCell {
    index: number[]
    values: (number | string)[]
    summary: Pick<McSummary, 'kills' | 'leakers' | 'firstDetectS' | 'minWarningS' | 'perEffector' | 'replicates'>
  }
  interface SweepSummary {
    factors: SweepFactor[]
    responses: SensitivityResponse[]
    cells: SweepCell[]
    replicatesPerCell: number
    seed: number
    elapsedMs: number
    stopped?: { rule: 'budget' | 'cancelled'; at: number }
  }
  ```

  A factor takes `SWEEP_VALUES_MIN` 2 to `SWEEP_VALUES_MAX` 6 values; `assertSweepFactors`
  refuses one or two factors outside that range and the UI caps the grid at 36 cells.
  `SWEEP_REPLICATES_DEFAULT` is 40. `applySweepValue(scenario, factor, value)` is pure
  and returns a new `Scenario`; a non-number for a numeric factor throws:
  - `threatAltitudeFt` sets `altitudeFt` on every active UAS that flies a path.
  - `threatSpeedMps` sets `speedMps` on every path of an active UAS.
  - `approachAzimuthDeg` rotates every threat path and its entity about `approachCenter`
    (the first active defended asset, else the centroid of the active non-threat,
    non-marker entities, else the origin) so `approachAzimuthDeg(scenario)` (the bearing
    from that center to the first point of the first threat's path) becomes the value.
    One rotation moves the whole raid, so its relative geometry holds. A scenario with no
    azimuth is returned unchanged.
  - `raidSize` sets the first wave (`raid.waves[0]`, else every threat with a path) to the
    value, a whole number of 1 or more. Fewer members drops the last ones with their
    paths; more repeats the members in order with fresh ids from `newId`, so their draw
    keys are their own, and appends them to the first wave.
  - `environmentPreset` replaces the precipitation, light and EM background covariates
    from `SWEEP_ENVIRONMENT_PRESETS` (six ids, `clear-day` to `urban-night`), sets
    `visibilityM` to null and `apply` to true, and keeps wind, temperature and field
    elevation. An unknown id throws.

  `sweepCellScenario` applies each factor at its indexed value, sets `replicates` to
  `replicatesPerCell` and turns `targetHalfWidth` off, so every cell runs the same
  replicates from the scenario seed (common random numbers across cells) in the
  scenario's own uncertainty mode. `sweepLoop` yields one checkpoint per cell in row-major
  order (the first factor outermost), drives `replicateLoop` to the cell's replicate
  count, applies `assertSummaryFits` per cell when a budget is given, and reports the
  numbers the cell retained at its peak so the budget rule sees the next cell's cost. A
  stop lands between cells and keeps the cells done under `stopped`; a full run has no
  `stopped` key. The worker routes `type: 'sweep'` on the sensitivity slot and posts
  `sweep-progress`, `sweep-done` and `sweep-error` with `done` and `total` in cells.
  The store keeps the result in `mc.sweep` (`SweepState`) beside `mc.sensitivity`; a
  basis change marks it stale and cancels it with the other analyses. The Fragility
  screen reads it through `currentSweep` (`panels/analysis/mc.ts`).
- **Sampled Play:** `trial.ts` runs nominal parameters with aleatory draws through
  `monteCarloPolicy` → `assessAllThreats` → `resolveEngagements`. Its complete assessments
  and event/attrition ledger remain separate from the deterministic picture and MC summaries.
  Optional sweep capture retains actual scan attempts, admitted member detections and misses,
  cue/gate state and classification; existing assessment intervals retain holds and coasts.
  Formation `memberIdx` is distinct from the nearest-first `drawIndex` used by the existing
  policy. Continue-jam outcomes are retained separately because ledger `killDelta` does not
  encode that draw. Default and ensemble sweeps collect no new observation histories.
  `trialTypes.ts` freezes the run id, configuration basis, seed, `idHash(runId)` numeric
  replicate index, nominal/aleatory basis and compatibility versions, plus the record
  keys `dataPackageVersion`, `overrides` (the active overrides at launch, from
  `activeOverrides`), `physicsSwitches`, `fidelityFloor` and `producer`. Every manifest
  comparison goes through `sameManifest`, which compares the array keys by value because
  a structured clone from a worker never shares array identity; `trialClient.ts` carries
  its own copy so it never imports the engine. The selector skips the record keys; it is
  the store (`overridesChanged`) that drops a ready trial when an override edit changes
  the values in force, and a re-recorded reason keeps it. Build provenance is
  explicitly null until a build revision is supplied; the version tag is not a commit hash.
  `trialClient.ts` owns a third independent worker slot (over `workerSlot.ts`), released at
  completion, error, replacement or cancellation. Adapter and `acceptTrialMessage` require
  the current request token, run id, basis and matching manifest; terminal deliveries
  cannot revive a request.
  `prepareTrial` captures a detached scenario and prepares without starting the clock.
  Ordinary Play calls `startTrialRun` and waits for that result before playing. Repeated
  Play reuses the pending preparation. Pause, scrub and frame
  navigation cancel a pending automatic start. Material edits, undo/redo, load and reset
  clear the trial using `analysisBasisSignature`; presentation edits preserve it.
  Trial Replay retains the ledger, identity, original completion and achieved observation;
  New run replaces identity and clears both trial and observation; the next Play redraws.
  No trial is autosaved or archived in application storage. `analysis/trialResult.ts`
  validates and adapts the captured result; `trialSeries.ts`, `playback/trialTrackState.ts`
  and `trialSweepAt.ts` derive charts, member outcomes and sensor/effector telemetry from
  that one ledger and observation history. Execute outcomes stop at the lesser of cursor
  and observed horizon; unavailable trials never substitute a forecast.
  `useForecastEngagement` retains the deterministic `engagementPicture` path. Forecast
  and Monte Carlo are separately labeled, numerically unchanged analyses; their controls
  live on the Run tab (`panels/settings/RunTab.tsx`) and in the run control
  (`panels/analysis/RunControl.tsx`) on Prepare and Analyze.
  Completed-run export adds `TrialResultGroup` under `resultGroups.trial`, with captured
  scenario, manifest, ledger, observations, jam decisions, members and integer counts.
  Its basis is `simulated-trial`, with no ensemble confidence interval or independently
  instrumented T&E claim. Missing build provenance reads **Build revision unavailable**.
  `persist.ts` checks run identity and completion; `runResultGroups.ts` revalidates the
  captured basis and result. Existing forecast/MC groups retain their own semantics.
- **Placement optimizer** (`src/playback/optimize/loop.ts`, `gp.ts`, `polygon.ts`,
  `optimize.worker.ts`; contract in `optimizeTypes.ts`): `runOptimize` drives
  `optimizeLoop`, a Gaussian process with expected improvement over the movable
  positions inside the range polygon. `SEED_EVALUATIONS` (8) Latin hypercube laydowns seed
  the GP, each later evaluation picks the best of a `CANDIDATE_CLOUD` (512) of polygon
  samples by expected improvement, and the GP length scale is `LENGTH_SCALE_FRACTION`
  (0.25) of the polygon extent. Every evaluation is one replicate run
  (`evaluateLaydown` over `placeLaydown`) under common random numbers at the request's
  one seed, read through `endOfRunResponses` and `statOf` (`mcRun.ts`) with the
  response's `StatKind`. `rankCandidates` returns at most `CANDIDATE_CAP` (5) candidates,
  best first by the objective direction, each with the response `Stat` and its interval.
  Defaults are `DEFAULT_OPTIMIZE_EVALUATIONS` (60) and `DEFAULT_OPTIMIZE_REPLICATES`
  (40). The worker is in the isolation set of `workerGraph.test.ts`. The optimizer adds
  a path and changes no engine number: the replicate loop, `statOf` and every parity
  fixture are unchanged.
- **Worker budget and cancel:** `replicateLoop` and `sensitivityLoop` (`mcRun.ts`)
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
  `mcClient.ts` to the slot, which terminates a worker silent for `CANCEL_GRACE_MS`
  (`workerSlot.ts`). Measurements:
  `docs/field-te/evidence/rf31-budget-2026-09-05/`.
- **Real-mode statistics:** under `uncertainty: 'total'` and `sampling: 'lhs'`
  replicate i draws each uncertain field from stratum `perm(i)` of N strata, N the loop end
  (`stopCap` under a half-width target, else `replicates`; `sampling.ts`), so a replicate
  is a pure function of (seed, i, N) and the pool, the Node runner and the single worker
  agree. `sensitivityDepth: 'full'` runs Morris (`morris.ts`, ten trajectories over every
  uncertain field) then Saltelli Sobol (`sobol.ts`, base `sobolBase`, Jansen total index,
  bootstrap intervals at `confidence`) on the eight kept fields, each design row one
  aleatory replicate under common random numbers; 'quick' keeps the one-at-a-time loop.
  `src/engine/index.ts` is the headless barrel; `.oxlintrc.json` forbids react, konva,
  `window` and `document` under `src/playback`, `src/analysis`, `src/geometry` and
  `src/engine`; `scripts/run-engine.mjs` runs the Vite library bundle over `worker_threads`.
- **Thresholds are test-defined:** `Scenario.requirements` (`RequirementThresholds`,
  defaults in `DEFAULT_REQUIREMENT_THRESHOLDS`) holds what the test asks the system to
  meet. Every reader spreads `{ ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }`.
  Never gate a requirement on an engine constant: a gate at `SHIP_DEAD_BELOW` passes itself
  by construction.
- **No invented values:** every unsourced number is a planning factor (PF) and is labeled
  as one. Never invent a value to fill a blank; record the blank as an open item instead.
- **No `Math.random` under `src/`.** Every draw goes through `DrawPolicy` (section 5). The
  engine draws in exactly five places; a sixth changes the draw keys and the CRN tests.

## 4. Architecture map

```text
src/model/     types.ts (domain types, newId, resolvers like mountHeightOf, basisFor,
               physicsSwitches; C2Spec and the ClassificationMatrix),
               scenario.ts (modelFor index, pathSpeed, scenarioDurationS, engineKeyOf and
               markPresentationVariant), seed.ts (emptyScenario, DEFAULT_SEED),
               seedLibrary.ts (re-export of seedLibrary.generated.ts, which
               scripts/build-library.mjs compiles from the data/library JSON package),
               libraryField.ts (LibraryFile and LibraryField, the grade, layer and range
               type enums, Override, PhysicsSwitch, FidelityTier, DATA_PACKAGE_VERSION),
               runRecord.ts (RunManifest, RunRecord, createRunManifest), libraryLifecycle.ts (the one seed library lifecycle:
               initial library and presets, load reconcile, import merge, reset to seed,
               provenance adoption, ADOPTED_SEED_KEYS field adoption),
               integrationData.ts (researched pairings and profiles),
               seedSystems.ts (system presets), seedCards.ts,
               rcsFactors / signatureFactors / weaponFactors (PF tiers)
src/geometry/  geo.ts (bearings, wedges, path interpolation, formatters), slant.ts (slant
               range, horizon), prng.ts (mulberry32, idHash, hashU01), webmerc.ts
src/state/     overrides.ts (useOverrides: the separate override store, activeOverrides),
               store.ts: one zustand store (scenario + history + selection + camera + ui +
               playback + mc + trial), playbackCommands.ts (store-free playback intents:
               play, pause, scrub, frame, publish, newRun and their transitions),
               baseline.ts (PinnedBaseline, buildBaseline, validateMcSummary),
               layers.ts (LayerVisibility, presets, ringVisible), runState.ts (playback and
               MC/sensitivity/sweep/trial/optimize state shapes), scenarioInstall.ts (installScenario: the per-operation
               edit/undo/redo/replace response of history, selection, ring overrides,
               playback, mc, trial and optimize), analysisRequests.ts (requestAnalysis and the accept
               reducers for the mc, sensitivity, sweep and trial requests, plus
               requestOptimize and acceptOptimizeMessage for the optimize kind and its
               OptimizeSpec), analysisBasis.ts
               (analysisBasisSignature), raidBuilder.ts (standoff search, buildRaid),
               labels.ts (run, connection, frame and card-version labels), camera.ts
               (fitCameraTo), rings.ts (ring keys, pruneRingOverrides), selectors.ts,
               trialSelectors.ts (retained run/basis selection and raw observation horizon),
               useTrialResult.ts (shared trial snapshot and series hook)
src/playback/  clock.ts (DT = 0.5 s, stepIndex, stepCount, createSweepClock: the manifest
               step and per-effector fine-step windows), tracks.ts (positions at t), detection.ts
               (prepareSweep: per-sensor terms resolved once per threat; sweepSensorHits,
               detectionsAt, spawn ring check), sweep.ts (the temporal sweep of one
               threat: prepareSweepRun, stepSweep, finishSweep own scan scheduling,
               holds, cue order, coast and M-of-N; SensorObservation), trackTypes.ts
               (TrackState, Covariance4, TrackEstimate, FusedTrack, TrackMeasurement,
               TrackEstimateSink), kalman.ts (predict, update, initFromMeasurement,
               positionSigmaM, quality), tracker.ts (createTrackManager: one track per
               sensor and threat, polarMeasurement, truthPathFor), killChain.ts
               (kill-chain routes, KillChainRoute), sim.ts (assessThreat consumes sweep
               step results, assessThreatReusing, assessAllThreats), fusion.ts
               (fuseTracks in information form, createFusionStage: the per-sensor ring,
               the link latency and FC_QUALITY_MIN), classification.ts (matrixFor,
               bandFor, classifyByMatrix), falseTracks.ts (prepareFalseTracks: Poisson
               false tracks per radar scan), operator.ts (createOperatorQueue: the C2
               decision latency and its overload factor), pk.ts (barrel over pk/kinetic.ts:
               Pk model, missDistanceSigmaM, and pk/beam.ts: expenditure channels; lane
               3.6 adds the beam physics), intercept.ts (time of flight,
               intercept, launch releases, predictedStateAt, interceptFromEstimate and
               the interceptFor selector),
               shot.ts (evaluateShot: per-ship shot eligibility shared by both
               firing passes), attritionReport.ts (report types), sweepState.ts (sweep
               state types), attrition.ts (resolveEngagements: fire distribution,
               expected kills, events), trackState.ts
               (phase at t, trackTimelineOf), sweepAt.ts (the per-publication sweep memo:
               hits, track states, effector states, held sensors), tactics.ts (threat
               tactics), raid.ts, runSession.ts (thin adapter: toggle and reset commands),
               policy.ts (DrawPolicy), mcRun.ts (runReplicates, runSensitivity, runSweep, Stat,
               McSummary, SensitivitySummary, SweepSummary; reduces analysis/projection.ts quantities into bands and
               imports no chart file), sweepFactors.ts (applySweepValue and the sweep
               factor ids and presets), workerSlot.ts (the one worker slot: start, cancel, dispose),
               mc.worker.ts + mcClient.ts + workerPool.ts (the replicate pool, sensitivity, sweep,
               Morris and Sobol protocol adapters), mergeSummaries.ts (partial merge by
               replicate index), sampling.ts (LHS strata), morris.ts, sobol.ts,
               trial.ts (one retained nominal/aleatory trial), trialTypes.ts + trialMessages.ts
               (manifest/result/transport contracts), trial.worker.ts + trialClient.ts
               (the trial protocol adapter), optimizeTypes.ts (OptimizeRequest,
               OptimizeResult, OptimizeWorkerMessage, the evaluation and replicate
               defaults), optimize/ (loop.ts: optimizeLoop, runOptimize, evaluateLaydown,
               rankCandidates and the constants; gp.ts: the Gaussian process and expected
               improvement; polygon.ts: point-in-polygon and sampling inside the range;
               client.ts: the optimize slot adapter startOptimize and cancelOptimize),
               optimize.worker.ts (the optimize protocol worker),
               controlledWorker.ts (the shared Worker test
               double), trialTrackState.ts (retained member
               outcomes and geometry), trialSweepAt.ts (retained scan/hold and effector
               state), trackEstimateView.ts (latestEstimatesAt and positionEllipse over
               a trial's track history)
src/analysis/  classPriors.ts (classOfModel, classPriorFor over the generated CLASS_PRIORS),
               sensorEnv.ts (barrel over sensorEnv/common.ts, radar.ts, eoir.ts,
               acoustic.ts, rf.ts: sensor physics per technology), radarPd.ts (Pd closed
               forms), ewPhysics.ts
               (jam), doctrineFactors.ts (per-system factors), impact.ts
               (engagementPicture cache, WEZ), liveStats.ts (KPIs at t), projection.ts
               (pure named quantities on the DT grid: sampleCount, hold and residual
               rules, held-track union and count, mean held Pd; no chart ids),
               series.ts (chart Series, labels, colors and ids over projection.ts),
               runValidity.ts, requirements.ts, uncertainty.ts
               (sampling), parameterBasis.ts (pure spread resolution and enumeration),
               fidelity.ts (model tags), aar.ts, systemTelemetry.ts,
               threatAggregation.ts, range.ts, trialResult.ts (validated trial view and
               integer counts), trialSeries.ts (observation-bounded trial chart adapters),
               calibrate.ts (familyFor, the beta and normal-gamma posteriors,
               overrideReason and acceptCalibration over CalibrationRecord)
src/ui/        kit.tsx: the shared primitives Field, Seg, State and ProvMark that the
               Board panels render; reads index.css classes only, no store.
               ink.ts: the Konva ink table (danger red, entity kind fallback colors) that
               the layers, the palette glyphs, the detail panels and trackState share.
               usePopover.ts: the one dismissal rule for the toolbar dropdowns (outside
               pointer, capture-phase Escape, focus in on open and back on close).
               rovingTabs.ts: nextTabIndex, the one arrow-key mapping for every
               roving-tabindex group
src/charts/    chart kit: types.ts (Series), tokens.ts, timeAxis.ts, seriesData.ts (pure
               series helpers), TimeSeries (a lazy shell whose fallback holds the plot
               box), TimeSeriesChart + ChartFrame (the recharts plot, loaded on first
               render), BandChart (the recharts ensemble band with the trial and a dashed
               baseline), SweepMap (the CSS-grid factor sweep map), Ladder and Tornado
               (plain SVG). Props only; never reads the store. exportPng.ts (svgMarkup,
               svgToPng, chartPng, exportChartPng: a recharts SVG to PNG with computed
               paint baked in)
src/canvas/    CanvasStage.tsx (stage, pan/zoom, drop target, the two scene Layers),
               interactionRouter.ts (store-free intent routing: Escape order, click
               precedence, drop, placement), StaticScene.tsx (boundaries, footprints, range rings and
               connections on the static Layer), LiveScene.tsx (the frame clock and every
               moving layer on the live Layer), TrackFileReadout.tsx, frameClock.ts,
               ringModel.ts (store-free, Konva-free: prepareRingModel resolves every ring
               record from Scenario, RingView and the selected threat, and hitAt finds the
               ring edge under a world point over the same records), useRingModel.ts (the
               store-bound hook FootprintLayer and HudLayer share),
               layers/ (one component per drawn concern; footprintStyle.ts is the ring
               style source)
src/panels/    Toolbar (header: brand, scenario name, ⋯ menu, the lifecycle tabs, run
               status, settings, storage, status pills, drawer toggle),
               ViewMenu, Palette, Inspector (+ inspector/kit.tsx over src/ui/kit.tsx,
               spreadText.ts),
               LibraryEditor, settings/ (RunTab, SystemsTab, PhysicsTab and
               CalibrateDialog), AnalysisPanel (+ analysis/screens/ for the
               Fragility, Inputs, Where to put it (PlacementScreen), Now, Outcome and
               Compare screens and their phase map,
               analysis/ for the shared readers, records and settings, analysis/detail/,
               analysis/ForecastSettings.tsx for forecast/MC controls),
               TimelineBar (owns the rAF loop; publishes the clock only; holds the
               Engagement toggle whose open flag lives in App state), CommandPalette,
               Glyph.tsx (symbology), ringLabels.ts (ring names), headlines.ts
src/io/        autosave.ts (the one autosave lifecycle: createAutosave returns read,
               restore, observe, flush and stop, and owns the read, the recovery, the
               write gate, the 500 ms debounce, the pagehide and visibilitychange flush;
               an AutosaveAdapter supplies key, parser, record selection, adoption and
               save status), persist.ts (scenarioAutosaveAdapter and the Board autosave
               entry points, fillScenario, JSON and library
               import/export, runExportObject, downloadJson and pickJsonFile),
               runRecordPackage.ts (the saved-run package: runRecordExportObject,
               exportRunRecordPackage, parseRunRecordPackage, importRunRecordFile; a
               separate module so runStore and the parser stay out of the entry chunk),
               exportCsv.ts (per-threat, per-effector and
               sensitivity CSV, RFC 4180, units in headers), exportSqlite.ts
               (exportRunsSqlite and downloadRunsSqlite over a dynamically imported
               sql.js), compat.ts (the Board schema-1
               legacy-omission declaration the validator and fillScenario both read),
               runResultGroups.ts (per-group basis/units
               and separately typed TrialResultGroup),
               runtimeSchema.ts + generateRuntimeSchema.mjs (domain shape descriptors),
               runtimeValidation.ts + validateScenario.ts (runtime semantics),
               viewState.ts (readSetting and writeSetting over every settings key),
               persistOverrides.ts (overridesAutosaveAdapter, restoreOverrides,
               startOverridesAutosave), runStore.ts (IndexedDB run history: saveRun,
               listRuns, getRun, deleteRun, clearRuns, RUN_STORE_CAP_BYTES) with
               fakeIndexedDb.ts for tests, storageKeys.ts, recovery.ts
src/main.tsx   restores the Board autosave (restoreAutosave reads and adopts it), starts
               the autosave subscription, then does the same for the overrides,
               exposes window.__store in dev
src/App.tsx    right panel tabs and drawer, keyboard map, resizer; lazy boundaries for
               AnalysisPanel and CommandPalette
```

Data flow for a click or drag: Konva event, store action, new scenario, React re-render of
layers. Drag and rotate in progress are Konva-native previews; the store updates once on
`dragend`, one undo entry per gesture. Analysis
reads `engagementPicture(scenario)` (`src/analysis/impact.ts`), a WeakMap cache keyed on
the scenario's engine identity (`engineKeyOf`) and bounded to the eight most recently
used pictures, so the deterministic sweep runs once per scenario change and a deep undo
recomputes one picture. A cache miss assesses the threats incrementally
(`assessThreatsIncremental`) through `assessThreatReusing(scenario, uasId, prior, policy?)`
(`sim.ts`), which returns the prior `ThreatAssessmentMemo` while every input the assessment
reads is the same object and a fresh memo otherwise. The assessment module owns that
dependency set (`threatAssessmentInputs`, beside `assessThreat`: the scenario fields the
sweep reads, the run duration, the threat, every asset, effector and C2 node, and every
sensor whose technology gate admits the target and whose reach touches the flight path plus
the formation spread and the flight model's deviation, `flightDeviationM`: one turn radius
plus wind drift over the path duration, zero under `noFlightLimits` or an unlimited spec);
`impact.ts` only keeps the memos from one run to the next. A new
scenario read inside `assessThreat`, or inside the sweep run it steps (`sweep.ts`), joins
`threatAssessmentInputs` in `sim.ts` in the same change. `resolveEngagements` runs fresh
every time. Engine entry
points in call order: `assessAllThreats(scenario, policy?)` (`sim.ts`) sweeps detection and
builds one `ThreatAssessment` per active threat; `resolveEngagements(scenario, assessments,
policy?)` (`attrition.ts`) distributes fire and returns totals, events and per-effector rows.

## 5. One source per fact

Each fact below has exactly one definition. Read it there; never add a second copy.

- **Sample grid:** `DT` (0.5 s) and `stepIndex` in `src/playback/clock.ts`. `tickStepS` in
  `src/charts/timeAxis.ts`. A chart's `tS` prop is quantized to DT by the caller. The sweep
  step is a manifest parameter since slice 3.a: `McSettings.sweepStepS` (`Scenario.sweepStepS`,
  default `DEFAULT_SWEEP_STEP_S` = DT, filled by `runSettings`) reaches `sim.ts`, `attrition.ts`,
  the fusion ring, the false-track scan clock and `intercept.ts` through `createSweepClock`;
  `TrialManifest.sweepStepS` and `RunManifest.sweepStepS` record it. A lane requests a finer
  step for one effector inside a burst or dwell window with `clock.requestFineStep`; with no
  request `next(t)` is `t + baseS` and the 0.5 s sample times are bit-identical to the old
  loop (`clock.test.ts`). Ordinary temporal draws still use `stepIndex` (the DT grid).
  Optical fluence is keyed once per committed salvo, including effector, target, ship,
  salvo and commit step, so fine ticks reuse the one sampled damage threshold.
- **Altitude and geometry:** `threatAltitudeFt(scenario, uas)` (entity value, else the
  threat profile, else the `altBandFt` midpoint) and `mountHeightOf(spec)` are the
  resolvers. Slant range, not ground range, feeds every sensor and effector range test; the
  azimuth wedge stays a ground-plane bearing test. Board rings against a selected threat
  ground-project through `groundRangeM`; the placard ring is unprojected. Terrain,
  per-waypoint altitude and refraction beyond the 4/3 horizon stay out.
- **Sensor physics** (`src/analysis/sensorEnv.ts`): the barrel dispatches by technology.
  Radar keeps its placard calibration while Shnidman noncoherent pulse integration changes
  Pd by the stated dwell. EO/IR derives Johnson detect, recognize and identify ranges from
  detector optics and applies Beer-Lambert extinction. Passive RF solves a link budget from
  target EIRP, free-space loss, the fixed urban margin and receiver sensitivity. Acoustic
  keeps the transmission-loss solve. A missing physical input, or its checked fallback,
  selects the earlier placard model. `rangeBasis: 'planning'` turns target scaling off.
  `sensorHoldGate` is the one hold gate,
  `sensorGeometryGate` the one vertical gate, with a 0.001 degree tolerance (PF) at both
  elevation edges, `radarPdAt` the one Pd evaluation, `effectiveDetectRangeM` the one
  range. The environment multiplier enters radar SNR as the fourth power.
- **Track initiation** (`sweep.ts`): `scanPeriodS(spec, pdModeled)` (`doctrineFactors.ts`)
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
  hold while the M-of-N window keeps counting.
- **Track estimate** (`src/playback/kalman.ts`, `tracker.ts`): a constant-velocity Kalman
  filter over (x, y, vx, vy) in board meters, with continuous white-noise acceleration at
  `PROCESS_NOISE_Q` (1 m^2/s^3, PF). `Covariance4` is the flat row-major 4x4 of
  `trackTypes.ts`. `createTrackManager` keeps one track per (sensor, threat); a formation
  is one track on its nearest detected member. The sweep's hold decides the step:
  `measure` updates from the truth position plus polar noise, `carry` and `coast` predict
  only, and a sensor the sweep does not hold this step loses its track.
  `polarMeasurement` is the one polar-to-Cartesian noise conversion: `rangeAccuracyM`
  along the ground line of sight, `slantM * azimuthAccuracyDeg` across it, rotated into
  the board frame; `elevationAccuracyDeg` is carried by the library and not modeled in
  this phase. `quality(cov)` is the one quality map, the position 1 sigma through
  `QUALITY_SCALE_M` (50 m, PF): 1 at zero covariance, 0.5 at the scale.
  `INIT_SPEED_SIGMA_MPS` (20 m/s, PF) opens the velocity block of a new track.
  `truthPathFor` is the one truth-path test: any sensor under the `truthTracks` switch,
  or a non-RF sensor missing `rangeAccuracyM` or `azimuthAccuracyDeg`, reports the true
  state with `ZERO_COVARIANCE` and quality 1 and takes no draw. A physically modeled RF
  sensor may enter the estimate path with azimuth only: one node receives a broad range
  sigma equal to its detect range, while simultaneous nodes of the same model derive a
  cross-bearing range sigma from their maximum baseline and signal-to-noise. Capture is opt-in:
  `runTrial` attaches the sink that fills `TrialResult.tracks`, so the ensemble path
  allocates no estimate history.
- **Fusion and classification** (`src/playback/fusion.ts`, `classification.ts`, `sim.ts`):
  `fuseTracks` is information-form track-to-track fusion, the sum of the member inverse
  covariances inverted, with the covariance-weighted mean as the state; two equal members
  halve the covariance. `createFusionStage` runs it once per sweep step for one threat:
  each sensor's estimates enter a short ring, the C2 holds the entry one link latency old
  (`delayedMember`) and dead-reckons it forward with the same `predict`, and the reports
  that have arrived fuse at that node. A truth member bypasses the latency and makes the
  fused track the truth at t, so a `truthTracks` run is unchanged by fusion. With no C2
  node every live track fuses at the sensors with no latency (`NO_C2`). `assessThreat`
  keeps the per-step fused tracks on `ThreatAssessment.fusedTracks` (per replicate, never
  summarized) and the stable track now needs both `trackInitAtS` and a fused quality at
  or above `FC_QUALITY_MIN` (0.5, the quality of a 50 m position sigma). Classification
  reads `SensorSpec.classification` when the sensor states one: `bandFor` picks the first
  band whose `maxRangeM` exceeds the range and `classifyByMatrix` draws the declaration,
  which lands `timeToDeclareS` later in place of the sweep's classified flag. A sensor
  with no matrix leaves the rule ladder of `sim.ts` in charge; no library sensor states
  one yet.
- **False tracks and the operator queue** (`src/playback/falseTracks.ts`, `operator.ts`,
  `attrition.ts`): each active radar with a stated `falseAlarmRatePerScan` (lambda per
  scan over the whole coverage) runs a truth-free per-scan process. The confirmed rate is
  the closed form `FALSE_TRACK_CELLS * mOfN(lambda / FALSE_TRACK_CELLS, M, N)` over the
  radar's own initiation rule, with `FALSE_TRACK_CELLS` 1e4 (PF); the per-scan count is
  Poisson by inversion from one uniform. A false track holds for `trackDropMisses` scans
  at a position uniform in area over the radar's coverage, a speed in
  `FALSE_TRACK_SPEED_MPS` and a uniform heading, and carries `uasId: null` with
  `source: 'false'`. The `noFalseTracks` switch disables it. `createOperatorQueue` charges
  the C2's own decisions: `decisionLatencyS` is lognormal with median
  `C2Spec.decisionLatencyS` and `decisionLatencySigmaDb` (10 log10 of the ratio to the
  median, the `Spread` convention), multiplied by `overloadFactor`, the linear
  load / capacity above `operatorTrackCapacity`. The doctrine dwells already charge the
  planning decision time, so the queue adds only the excess over the median, at the
  declare gate and again at the assignment; `firstC2Of` is the node of a route. It is
  inactive, with no draw and no delay, without a C2 spec that states a median, under the
  `noOperatorQueue` switch, or on a route with no C2 node. `delayS` returns `{ extraS,
  floored, decided }`: decided only when that C2 drew a latency (a C2 with no median is no
  decision), floored when the raw excess was below 0 (the deterministic median draw gives
  exactly 0 and is not floored). `AttritionTotals.operatorDecisions` and
  `operatorFlooredDecisions` count them per run; `McSummary` carries their per-replicate
  means through the merge and `validateMcSummary`; the Run progress line and the Outcome
  record print "operator wait floored in N of M decisions" when N is not 0 (slice 3.0).
- **Physics switches** (`PhysicsSwitch` in `src/model/libraryField.ts`,
  `physicsSwitches(scenario)` in `types.ts`): `Scenario.physics` lists the engine
  simplifications a run switched on, and `physicsSwitches` is the one reader: deduplicated
  and in the declaration order `truthTracks, noFalseTracks, noOperatorQueue,
  singlePulseRadar, noFlightLimits, rfBandGate, eoirSpanRatio, legacyKineticPk,
  legacyBeamPk`, empty on an old save. The Settings Physics section
  (`panels/settings/PhysicsTab.tsx`) edits the list through `patchScenario` and resets
  it to `[]`; it uses the same reader to keep checkbox state and writes canonical.
  `createRunManifest` (`runRecord.ts`) and
  `createTrialManifest` (`trialTypes.ts`) both default `physicsSwitches` from the scenario
  and drop `fidelityFloor` from `datasheet` to `fallback` when any switch is on.
  Every switch selects an alternate engine path. The Phase 3 fallbacks select single-pulse
  radar, unlimited waypoint motion, band-gated placard RF, span-ratio EO/IR, the legacy
  kinetic Pk curve, and the legacy beam Pk curve respectively. Clearing them selects the
  corresponding physical model when its required fields are complete.
- **Fire doctrine** (`Scenario.doctrine`, enabled by default): the gate is per effector and
  route-aware (a firm track from a sensor routed to that effector, hostile ID, the
  declaration dwell); `readyS` = gate + route latency + target dwell is the first possible
  assignment. Fire distribution is shoot-look-shoot with a BDA dwell; the launch point follows
  `doctrine.launchPolicy`. `tEffect = t + engageTimeS + timeOfFlightS(spec, interceptSlant)`
  from `flyoutSpeedMps` (kinetic only; no speed means no flyout term), charged at
  `flyoutSpeedMps` times `FLYOUT_SPEED_FACTOR` (0.7, PF, `intercept.ts`) because a
  stated speed is a maximum. `interceptAt` is the one predicted
  intercept: the exact constant-speed meeting time along the path (`analyticTofS`:
  the target holds the first point before its delay and the last point after the path ends,
  and on each straight segment the formation member moves at constant velocity, so the
  meeting time is the smallest root of a quadratic per phase in time order). The closed form
  is kept only when a constant-speed flyout closes on the sampled limited-flight target at
  that time (`closesOnSample`); otherwise the flyout is solved against the sampled trajectory
  (`profileMeetTau`), so timing, position and feasibility read one trajectory. It caps the
  flight at the end of the envelope interval that holds the release: a flight past that end
  lands at the end and the event carries `flightCapped`. It also reports `infeasible`:
  the slant to the credited point exceeds the reach `v * (tEffectS - release)` by
  more than one DT of flight, which with the exact solution happens only at a cap or when
  no meeting exists; both selection passes decline such a shot (no event, no round, no
  cooldown). `interceptFor` is the one intercept selector both firing passes reach
  through `evaluateShot`: with no estimate, or a truth-source one, it is `interceptAt`
  with the same arguments and the same result; with a Kalman estimate it is
  `interceptFromEstimate`, the closed-form meeting against the constant-velocity
  prediction of `predictedStateAt`, under the same cap, `capped` and `infeasible` rules.
  `attrition.ts` supplies the fused track the shooter holds at t from
  `ThreatAssessment.fusedTracks` through a per-threat cursor. `ShotAccepted` carries
  `predictionSigmaM` (the predicted position 1 sigma at the effect time, null on the
  truth path) and `interceptSource`; `missDistanceSigmaM` (`pk.ts`) roots it with the
  interceptor's guidance error for the physical probability of effect.
  Kinetic shots use `kineticEffectProbability`: interceptors combine predicted track error
  with guidance error and integrate the Rayleigh miss distribution inside effective radius;
  guns compound independent projectile hits from pointing error, dispersion, rate and burst
  size. `legacyKineticPk` restores `kineticPk(basePk, maxRangeM, uas, slantM)`, which
  `footprintStyle.ts` also imports to invert the commit ring. Optical shots compute diffraction,
  jitter, atmospheric transmission and a sampled fluence threshold; their effect time includes
  settle and dwell. `solveBeamTiming` (`shot.ts`) iterates the effect delay to a fixed point,
  brackets and bisects the residual when the iterates oscillate, and declines the shot
  (`no-dwell-solution`) when no converged effect time lies inside the window. A modeled
  dwell reserves the effector until its effect time when that is later than the cooldown,
  and its fine-step window runs from release to effect. HPM compares inverse-distance field strength with an airframe threshold
  inside beamwidth and uses the stated recharge. `legacyBeamPk` restores the prior curve.
  `SIZE_PENALTY` and `EVASION_PENALTY` (`pk.ts`) stay PF. Per-system factors and spec
  overrides live in `src/analysis/doctrineFactors.ts`. Doctrine off is the legacy
  ungated assignment path; keep it for regression and pin legacy fixtures with
  `doctrine.enabled = false`. Route latency is charged from the ROE gate, not from T0.
- **Fire-control uplink gate** (`sim.ts`, `attrition.ts`, `src/model/integration.ts`):
  when every path of a route is fully typed and the effector's integration profile has
  `guidance: 'fc-uplink'`, the route needs a sensor in `route.fcSourceIds`; otherwise the
  window is geometry only and the threat status is `no-fc-uplink`. Hand-written test
  connections are untyped and the gate does not bind; UI-drawn connections are typed by
  `completeConnect` when `evaluateIntegration` finds a researched pairing.
- **Draw policy** (`src/playback/policy.ts`): `DrawPolicy` is the one draw point. The
  engine draws in exactly ten places (`sensorHit` detect, `applyEffect` kill,
  `applyEffect` continue-jam, `phase`, drawn once per scan state, `param`, drawn once
  per uncertain field per replicate under `total`, `noise`, drawn twice per measured
  scan in `tracker.ts`, `classify`, drawn once per declaration attempt in
  `classification.ts`, `falseAlarm`, drawn once per radar scan for the Poisson count and
  once per state uniform of a false track in `falseTracks.ts`, `latency`, drawn once
  per operator decision in `operator.ts`, and `fluence`, drawn once per optical salvo
  commitment in `shot.ts`), through a policy passed as the
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
  field, noise by sensor, threat, axis and step, classify by sensor, threat and step,
  falseAlarm by sensor, draw index and step, latency by C2, threat and step.
  `DRAW_KIND` names the kinds (1 to 5 and 7 to 10; kind 6 is the LHS stratum shuffle in
  `sampling.ts`) and `stepIndex` (`clock.ts`, beside `DT`) is the one
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
  `meanInterval`, `quantile` and `wilson` in `src/analysis/stats.ts` (import a statistic
  from there, never copy it). `statOf` takes
  the statistic's kind: a time keeps the t-interval; a count clamps it to
  [0, max] (ships, tracks, or unbounded for salvos); a 0/1 count (max 1) takes the Wilson
  interval; a count with a finite max at 0 of n reports the rule-of-three upper bound
  3 max / n on its mean (no independence between ships), and at n of n the mirror
  max - 3 max / n; an all-zero unbounded count keeps its zero-width clamped t-interval.
  `p10`/`p90` are NaN under `BAND80_MIN_N` (10) samples and `p025`/`p975` under
  `BAND95_MIN_N` (40). `McSummary.firmTrackS` is the earliest `stableTrackAtS`
  per replicate; `firstDetectS` is the first single-scan hit. The replicate loop
  stops after 30 replicates, and every 10 after that, when the half-width of the displayed
  interval on the end-of-run leaker mean (the leakers `Stat` through `statOf` over the
  raid's ships) is under `targetHalfWidth`; `McSummary.stopped` records the
  rule and the replicate. Panels read a time `Stat` through `timeStatSub(stat, quantity)`
  (names the single-scan-hit basis, shows the defined fraction's Wilson interval, withholds
  the mean CI under `TIME_CI_MIN_N` 30 defined) and a band step through
  `countSub` (the interval as its two ends, since a count interval is not symmetric)
  (`panels/analysis/mc.ts`). Bands and tile subs read current `McSummary` through `withBands`
  (`series.ts`) and `currentSummary`, only when `mc.status` is `done` for the current run
  id; `currentSensitivity` and `currentSweep` apply the same rule to their slices. Covered chart lines become replicate means with 80/95 percent replicate-quantile
  bands, each drawn only when its quantiles are finite; `bandNote` words the rule. Tile
  intervals describe means, not those quantiles. Values and intervals share
  quantity/denominator; Defeat converts ship count and interval to percent by the same raid
  size. Missing/zero-sample estimates remain unavailable and n=1 carries no claimed mean
  CI. Full-run conditional time means are labeled; quantities without a replicate
  statistic retain an individual planning-envelope label.
- **Data package** (`data/library/<kind>/<slug>.json`, one file per model, `index.json`
  for order and version, `DATA_PACKAGE_VERSION` 3 since the Phase 3 fields): every numeric spec field is a
  `LibraryField` with value, unit,
  grade, layer, range type, condition, source and spread; categorical spec keys are bare
  `attributes`. A file's `spec` names the block its fields compile into and now admits
  `'c2'`: eight C2 models carry `decisionLatencyS`, `decisionLatencySigmaDb` and
  `operatorTrackCapacity`, and all 38 sensors carry the four tracker accuracy fields.
  `scripts/build-library.mjs` compiles the package into
  `src/model/seedLibrary.generated.ts`; `scripts/check-library.mjs` is the health check
  (grade, layer, unit, range type and condition, L1 source and date, L2 estimator, index
  and version agreement, and a value more than three spreads from its class prior with no
  note). `scripts/derive-priors.mjs` writes `data/priors/<class>.json` and
  `src/analysis/classPriors.generated.ts` from the L1 entries only, with the member list
  per field. `npm run library:check` runs all three in the gate. A library edit is a JSON
  edit followed by `npm run library:build`; the generated file is never hand-edited.
- **Provenance** (`Provenance` in `src/model/types.ts`): a `SpecModel` carries one row per
  field (field, value, source, url, date, basis, spread, and the optional lineage keys
  grade, layer, rangeType, condition, unit, estimator, comparisonSet, note the package
  supplies); `basisFor(model, field)` is the
  one basis resolver and answers `pf` when the field has no row. `PfTag`
  (`src/panels/inspector/kit.tsx`) is the one tag: `.pf` for a planning factor, `.pf.src`
  for a sourced value, hover title `basis · source · date`. Every sensor, effector and
  threat seed carries rows: a sensor leads with `detectRangeM`, an effector with
  `maxRangeM`, a threat with `rcsM2`; an unsourced value keeps the basis `pf`.
  `Provenance.spread` is the row's epistemic spread (`Spread`: lognormal `sigmaDb`,
  triangular fraction bounds, beta counts); a `pf` row may carry a spread, and then it may
  also carry the url of the trial count behind that spread (the Stinger and Leonidas `pk`
  rows). `adoptSeedProvenance` (`src/model/libraryLifecycle.ts`), called from
  `fillScenario`, copies seed rows onto a saved builtin only for fields the user has not
  edited, and `updateModel` and `editModel` drop the row of a spec field they change; an
  edited field takes no row and stays PF. Both read one field comparison,
  `dropEditedProvenance` (`src/model/types.ts`). "Reset to seed" (`resetModelToSeed`,
  undoable) puts a builtin back to its seed through `resetBuiltin`.
- **Specification field edits** (`src/model/specEdit.ts`): `editSpecField(model, field,
  value)` holds the rule of every edited spec field. It owns the value that clears back to
  the planning factor, the clamps, the M-of-N coupling (N follows M up, M follows N down),
  the elevation and altitude-band tuples, and the mount-height parse. A field name is a
  section key: `sensor.`, `effector.`, `uas.` or `threatProfile.`, plus the synthetic tuple
  ends `elevationMinDeg`, `elevationMaxDeg`, `altFloorFt` and `altCeilingFt`. The function
  is pure and returns the model itself when the section is absent or the value is rejected
  (an empty band set). The store action `editModel(id, field, value)` applies it through
  `mutate`: one edit is one undo step, and a rejected edit writes nothing. LibraryEditor and
  Inspector pass the raw control value and carry no field rules. `updateModel` stays the
  whole-patch action for the model name, description, color and provenance rows.
- **Parameter uncertainty** (`src/analysis/parameterBasis.ts`, re-exported by
  `uncertainty.ts`): `spreadFor(model, field, priors?)` is
  the one spread resolver: the row's spread, else the class prior when a `priors` table
  is passed, else `PF_SPREAD` by field, else null; a row
  with `spread: null` is pinned and fixed. No caller passes `priors` yet, so every
  existing result is unchanged; `spreadBasisFor` names the step that answered. An
  override (`useOverrides`, `src/state/overrides.ts`) never edits the scenario library:
  it is a separate record with a reason and a date, listed in the trial manifest, and
  applied for one run by `applyOverrides` (`src/model/applyOverrides.ts`, the value
  written over a copy of the model's spec with its provenance row dropped): the trial
  and the engine CLI apply the manifest's list, the replicate, sensitivity, sweep and
  optimize requests apply the active list before the worker starts, and the board
  scenario, its basis signature and history keep the library value.
  The Settings Systems tab (`src/panels/settings/SystemsTab.tsx`) shows it beside the
  source value with reset per field, per system and all. `sampleSpread` is the one inverse-CDF sample
  (lognormal `sigmaDb` a power ratio, triangular bounds fractions of the nominal, a beta
  with `pseudo` the PF table rescaled to the nominal, a beta without it the row's stated
  counts under a Jeffreys prior). `sampleScenario` is pure and returns a new scenario, and
  a `null` from its sampler keeps that field at its nominal; `uncertainFields` is the
  stable field order, over the library models an active entity uses, then connections,
  then doctrine; `sampleScenario` samples the same models. `FIELDS_BY_KIND` names the
  fields per kind: sensor `detectRangeM`, `trackInitS` and the four Phase 2 accuracy
  fields; effector `pk`, `engageTimeS`, `targetS`, `bdaS`; uas `rcsM2`; c2
  `decisionLatencyS` (slice 3.a). A field with no resolver and a null nominal (an L3
  accuracy field, a c2 with no median) draws nothing. `Scenario.uncertainty`
  (`UncertaintyMode`, `aleatory` or `total`, default `aleatory`) is what a replicate
  varies: under `total` the loop draws one `param` uniform per uncertain field through the
  policy and calls `sampleScenario` once per replicate before `assessAllThreats`, under
  `aleatory` it never calls it. `runSensitivity` (`mcRun.ts`) is one-at-a-time: for each
  uncertain field it runs the replicates twice, the field at its p10 and at its p90 with
  every other field nominal, paired by the same seed and replicate index (common random
  numbers). Each `SensitivityRow` records five end-of-run responses under `responses`,
  keyed by `SensitivityResponse` (`leakers`, `kills`, `firstDetectS`, `minWarningS`,
  `salvos`, in `SENSITIVITY_RESPONSES` order): per response `lo` and `hi` (the mean over
  the finite replicates on each side, NaN with none), `swing` (`|hi - lo|`), `se` (the
  paired standard error of the per-replicate difference over the replicates finite on
  both sides; 0 with one, NaN with none) and `defined` (each side's defined fraction, so
  an undefined time keeps its definedness statistic). The row's `low`, `high`, `swing`
  and `se` are aliases of `responses.leakers`; rows sort by the leaker swing, largest
  first, ties in `uncertainFields` order. The Fragility screen runs it on demand on its
  own worker slot into `mc.sensitivity`, which a basis change marks stale, reads
  `currentSensitivity`, and ranks the bars of the selected response.
  `spreadText` (`src/panels/inspector/spreadText.ts`) is
  the one spread wording, shown by the Sources table and appended to the `PfTag` title.
- **Fidelity** (`src/analysis/fidelity.ts`): `MODEL_TAGS` is the one tag table, one row
  for each of the twenty-seven model ids with a tier, a validation status and, where a
  published method applies, a `standard` that quotes a row of section 8. Phase 2 added
  `tracker`, `fusion`, `classification`, `operator` and `false-tracks`; Phase 3 adds
  `radar-dwell`, `eoir-dri`, `rf-link`, `threat-flight`, `interceptor-miss`, `gun-burst`,
  `de-dwell` and `hpm-field`. A sensor reports
  the tracker and false tracks, a C2 node fusion, classification and the operator.
  `modelsUsed
  (scenario)` and `modelsForEntity(scenario, id)` read the scenario, never the picture; the
  Outcome validity row and the detail pane header show the tags, and the export carries
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
  Finding text names the lost measurement; `FindingThreatActions` renders selection from
  the finding's `uasIds` and never edits the laydown.
  Run exports retain deterministic payloads and declare `resultGroups` basis, horizon,
  validity and quantity semantics, plus configuration equality identity. `packageBasis`
  scopes the legacy `dataBasis` field to its named groups. Sensitivity endpoints are
  paired OAT parameter perturbations, not mean CIs or outcome quantiles; leaker display
  remains undefined without a defended asset. A sensor-only MC case at neutral covariates
  with environment application and doctrine disabled can be `valid`.
- **Symbology** (`src/panels/Glyph.tsx`, `src/playback/trackState.ts`): MIL-STD-2525
  split, the frame carries affiliation and the icon carries function; `FRAME_FOR`,
  `FUNCTION_LETTER` and `FRIEND_FRAME_D` are shared by the palette, the library lists and
  `EntityLayer`. `PHASE_STYLE` is the one track-phase color and label table. Canvas labels
  draw `boardDesignator(entity.name)`.
- **Rings** (`src/canvas/layers/footprintStyle.ts`, `src/panels/ringLabels.ts`): seven
  ring keys resolved through `selectEffectiveLayers`, per-entity overrides under `ui.ringOverrides`.
  `ui.layers` persists the Prepare/Analyze view. Execute uses `ui.executeLayers` or the
  `EXECUTE_DEFAULT_LAYERS` engagement preset; set, toggle and preset actions update only
  that session override and never write storage. Canvas layers, including ThreatWezLayer,
  and layer controls use effective layers; ring callers pass them to the resolver.
  WEZ impact badges require an arrival reached within the execution horizon; planning
  summary badges at time zero remain outside Execute.
  `ringVisible(ui, entityId, key)` is the one resolver, `RING_STYLE` the one style source,
  `RING_LABELS` and `RING_HINTS` the one name table. Effector rings draw in the danger
  red from `src/ui/ink.ts`, the one Konva ink table; a jammer keeps its entity-color
  cone. Only a selected-threat ring carries a label. `footprintStyle.ts` also holds the
  track style: `TRACK_ESTIMATE_INK`, `TRACK_FALSE_INK`, `TRACK_ELLIPSE_DASH` and
  `TRACK_MARKER_PX`, which `TrackLayer` reads.
- **Track picture** (`src/playback/trackEstimateView.ts`,
  `src/canvas/layers/TrackLayer.tsx`): `latestEstimatesAt` is the one reader of a trial's
  track history, the latest entry per track id at or before the horizon and nothing past
  it; `positionEllipse` is the one error ellipse, the eigenpair of the position block of
  a `Covariance4`. `TrackLayer` draws the 1 sigma ellipse and a position marker on the
  live Layer: a coasting track dashes, an updated track draws solid, a truth track has no
  error so it draws the marker alone, and a false track takes the muted ink. The ellipse
  radii are distances and ride the world transform; the stroke and the marker hold their
  pixel size.
- **Analysis screens** (`src/panels/AnalysisPanel.tsx`, `src/panels/analysis/screens/`):
  `PHASE_SCREENS` (`screens/navigation.ts`) is the one phase-to-screen map: Prepare
  `fragility`, `inputs` and `placement` (Where to put it), Execute `now`, Analyze
  `outcome` and `compare`. `AnalysisPanel`
  takes the phase and the screen, falls back to the phase's first screen, and renders
  `BoardPreparation` for `inputs`. `AnalysisNavigation` is one `Seg` of the phase's
  screens, kept outside the content scroller. Each screen has one owner component and one
  result basis: Fragility the current `McSummary`, `SensitivitySummary` and `SweepSummary`
  through `currentSummary`, `currentSensitivity` and `currentSweep`; Now the retained
  trial through `trialSweepAt` and `trialSystemTelemetryAt` at the cursor horizon;
  Outcome the completed `TrialResultView` through `trialResultOf`; Compare the completed
  trial against the current `McSummary` and the pinned baseline, plus any two saved
  history records side by side (`SavedRunCompareView`: means differenced, no interval on
  a difference of independent runs); Where to put it the `McState.optimize` result and
  `optimizeBest`, and its Apply installs a copy through `replaceScenario` with the name
  suffix `(placement N)`. The deterministic
  forecast appears on no screen; Outcome and Compare call `engagementPicture` only for
  requirement validity and the `forecast-trial-disagreement` finding. Before the first
  Play, Now, Outcome and Compare each render one placeholder line.
  `Scenario.observedPresetId` is written on reset and first play only and stays out of
  the basis signature. `SURVIVAL_LABELS`
  and `KPI_LABELS` (`panels/analysis/labels.ts`) remain the one name table; `useTrialResult`
  supplies trial cursor telemetry. AnalysisSection uses keyboard-operable disclosure
  buttons with named content regions. Trial series remain cursor/observation-bounded in
  Analyze too. DebriefRecord retains completion guards, current-result readers and exports
  behind Evidence products and exports `TrialEventLedger` and `TrialManifestRecord`, which
  the Outcome records rows open in place; the outcome tiles render once, on Outcome.
  Now samples within the execution horizon: event counts include reached assignments,
  while effect times, Pk and kill deltas wait for the effect. EngagementStrip clips
  windows and censors lane marks, tooltips and labels. Compare findings route to Prepare.
  Run settings live on the Run tab; the Run button and the Deterministic switch sit on
  Prepare and Analyze.
- **Pinned baseline** (`src/state/baseline.ts`): `PinnedBaseline` is `pinnedAt` (ISO),
  `label`, `scenario`, `mc` (`McSummary`) and `scenarioHash` (the `analysisBasisSignature`
  at the pin). `pinBaseline(label?)` needs a done summary for the current run and basis
  and builds the record through `buildBaseline`; `defaultBaselineLabel` is the scenario
  name and the local pin time. `clearBaseline` sets null; `restoreBaseline` is the
  persistence-only install. The baseline is store state beside the scenario: never in
  `Scenario`, `past` or a worker request, and never cleared by a scenario edit. Compare
  draws its `mc.kills.mean` dashed on `BandChart` and adds Baseline and Current minus
  Baseline columns to the delta table. Its storage key and validation are under
  **Storage keys** above.
- **Selection detail** (`src/panels/EntityWorkspace.tsx`): the Board shell routes one
  selected entity into Telemetry, Configure and Model basis. `DetailPane` is the one
  telemetry kind-to-pane map (sensor, effector, uas, c2); Inspector owns configuration
  and LibraryEditor owns shared model edits. Overview preserves entity selection and
  the preset id. Multi-selection, boundaries, connections and raid drafts retain the
  existing Inspector. AnalysisPanel renders the active screen alone; the Board shell owns
  selection detail.
  Trial series and ladder adapters memo on the retained result and observation horizon.
  `trialTelemetryAt` and `threatReadoutAt` (`panels/analysis/threatReadout.ts`) share
  retained telemetry between the compact canvas card and complete threat detail. Detail
  readers clamp the cursor to the trial observation horizon and hide unreached
  outcomes. Execute moves full-path fields into a Planned path block labeled Planned
  arrival and Planned CPA; Prepare and Analyze retain full-path scope. Forecast
  expected-defeat semantics remain separate from sampled hard/mission kills.
  `expectedCount` (`headlines.ts`) formats forecast counts, and null `reportedLeakers`
  remains the no-asset signal for display. Model source disclosures preserve all provenance fields.
  `TRACK_LADDER_STYLE` (`series.ts`) is the one track-ladder legend and `STATE_LABEL`
  (`SystemStatus.tsx`) the one component-state word.
- **Forecast chart series** (`src/analysis/series.ts`): every builder is pure `(scenario, id?) =>
  Series[]`, `LadderRow[]` or `ChartMark[]`, a series sampled from t = 0 at DT to
  `scenarioDurationS`, NaN where undefined, one `engagementPicture` call per builder.
  `trackSlots` assigns the five chart hues by first detection and never reassigns under a
  filter; status colors never color a series. Chart `horizonS` censors sample values and
  bands, automatic Y range, marks, endpoint dots, tooltips and legends while preserving
  the full time axis and scrub navigation. Scope text reads “Shown through T+m:ss”
  or “No outcomes observed yet” in the legend accessibility label, or a visually hidden
  span when no legend is shown.
  Ladder clips spans and their labels at the horizon. Tornado shows the Analyze forecast
  placeholder for a scoped horizon. Builders and full-run numerical results stay intact.
  `src/analysis/trialSeries.ts` separately builds `simulated-trial` step series and ladders
  from retained observations and events. Samples, marks and spans end at the trial horizon;
  `useTrialResult` supplies the same bounded series to the screens and detail panes.
- **Model versus instance:** `SpecModel` (library entry, `builtin` flag,
  duplicate-and-edit) versus `Entity` (canvas instance referencing `specId`; survives model
  deletion with `specId` set to null). `src/model/libraryLifecycle.ts` is the one seed
  library lifecycle: `initialLibrary` and `initialSystemPresets` for a new scenario,
  `reconcileLibrary` and `reconcileSeeded` for a save, `importModels` for a library import
  and `resetBuiltin` for "Reset to seed". Saved-id precedence is one rule everywhere: the
  entry the user holds wins over the seed of the same id, and `Scenario.deletedSeedIds`
  keeps the reconcile from resurrecting a deleted builtin. A seed field change does not
  reach an existing save's copy of a builtin model; "Reset to seed" does. The one
  exception is `ADOPTED_SEED_KEYS`, the migration path a new spec field takes into an
  existing board: `adoptSeedFields` gives a saved builtin only the listed keys it does
  not hold (`'*'` adopts a whole block the save lacks), so a key the save holds, null
  included, stays the user's. Phase 2 lists the four sensor accuracy fields and the whole
  `c2` block; Phase 3 adds its sensor, uas and effector keys (the lists in
  `libraryLifecycle.ts`). `reconcileLibraryReport` returns the adopted (model, block, keys) list;
  `fillScenario` keeps it in a WeakMap by model object (`seedAdoptionOf`, never persisted),
  so the stamp follows the installed library and a baseline parse, a rejected import or
  New leaves no stale stamp; the Systems tab reads `loadNoticeFor(scenario.library)` and
  prints a `seed v<N>` chip, N the data package version, on each adopted field (slice 3.0).
- **Calibration posterior** (`src/analysis/calibrate.ts`, `CalibrationRecord` in
  `src/model/types.ts`): `familyFor` picks the family from the provenance unit
  (`fraction` is a proportion, `s` is a time) else from the spec key. A proportion takes
  a beta posterior with the Jeffreys prior (`proportionPosterior`, `betaInterval`); a
  time takes a normal-gamma posterior (`timePosterior`, `meanCredibleInterval`) whose
  default prior (`defaultTimePrior`) is mu0 the current value, kappa0 = 1, alpha0 = 1 and
  beta0 from the field's spread variance (`spreadVariance`), falling back to
  `WEAK_TIME_CV` (0.5). `overrideReason` is the one text of the prior, observation and
  posterior; `CalibrateDialog` Accept writes it through `useOverrides.setOverride`. The
  record is stored nowhere else: the override is the durable product.
- **Placement optimizer:** `src/playback/optimize/loop.ts` owns the loop, the seeding,
  the expected-improvement proposal and the candidate ranking; `gp.ts` the process and
  `polygon.ts` the range containment and sampling. `optimizeTypes.ts` is the one
  contract (`OptimizeRequest`, `OptimizeResult`, the defaults); `optimize/client.ts` is
  the one slot adapter and `state/analysisRequests.ts` (`requestOptimize`,
  `acceptOptimizeMessage`) the one launch/accept pair. Nothing else builds a laydown
  evaluation or reads the optimize worker.
- **SQLite schema** (`src/io/exportSqlite.ts`): the five tables `runs`, `per_target`,
  `per_effector`, `sensitivity` and `sobol` are declared once there and written by
  `exportRunsSqlite`; `downloadRunsSqlite` wraps it for the history button. `sobol` is
  empty by construction because no `RunRecord` field carries Sobol indices. `sql.js`
  1.14.2 is pinned and loaded only by dynamic import with its wasm URL, so it stays out of
  the entry chunk.
- **Run-record package** (`src/io/runRecordPackage.ts`): `runRecordExportObject` is the one
  envelope, `{ rangeboardRunRecord: 1, record }`; `exportRunRecordPackage` downloads it
  and `parseRunRecordPackage` reads it back, refusing a debrief export
  (`rangeboardRun: 1`) by name because it carries no run manifest. `importRunRecordFile`
  saves the parsed record to the run history. The module uses `downloadJson` and
  `pickJsonFile` from `persist.ts` and is imported lazily, so the parser and `runStore`
  stay out of the entry chunk. CSV tables (`exportCsv.ts`: `perThreatCsv`,
  `perEffectorCsv`, `sensitivityCsv`, RFC 4180, units in headers) are one-way exports.
- **Other:** kill chain = `Connection` list, sensor to C2 to effector or direct. Threat
  tactics live in `src/playback/tactics.ts`; the raid builder commits entities, paths and
  waves in one `mutate`. Threat WEZ geometry is `src/analysis/impact.ts`; `effectRadiusM`
  values are PF. Basemap modes are render toggles and never move data.

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
- **Illustrative data** is labeled. MASTER-CALCULATIONS fixtures are labeled
  illustrative in their sources and still bind the unit tests.
- **Fixture pins.** When a sourced seed value moves a fixture, pin the fixture, never the
  seed, with a comment that names the row. Hand-built test threats resolve altitude to the
  `altBandFt` midpoint; pin `altitudeFt` where slant must equal ground range; pin
  `swerling` on a fixed-wing fixture that feeds a Pd expectation; pin `rangeBasis:
  'planning'` on a radar whose scan time must not move a hand-derived latency; pin
  `doctrine.enabled = false` on a legacy fixture; pin `physics` on a golden fixture whose
  timeline must not move with a new engine model. `detection-outside-rings.json` and
  `layered-acoustic-merops.json` pin `['truthTracks', 'noFalseTracks',
  'noOperatorQueue']`, so they hold the pre-Phase-2 kill chain.
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
  ledger. `tS` is assignment time: magazine, cooldown and salvo counts land here.
  Newly produced events add `tReleaseS = tS + engageTimeS` using the resolved delay;
  `tEffectS` is the unchanged effect time. `readyS` is the first possible assignment
  under the doctrine gate; `flightCapped` marks a flight cut at the envelope end; an *infeasible* intercept
  (interceptor cannot reach the credited point) is declined and leaves no event. Shot
  eligibility (in-range interval, intercept, reach, effect containment, envelope, jam link)
  is `evaluateShot` in `playback/shot.ts`; both firing passes call it and a rejection names
  its reason. `expectedKills` is
  pre-arrival mass; `expectedLateKills` is a sub-measure of the leaker mass. Arrival and
  closest approach are different quantities. `reportedLeakers` is the display value.
- **Physical launch display.** `engagementTiming.ts` resolves explicit release metadata,
  or a legacy event's delay from the captured effector spec. Missing entity/spec or invalid
  timing stays unavailable; a present spec's omitted delay uses the engine zero default.
  `trackState.ts` precomputes nullable release times and fixed effect endpoints. A launcher
  reads PREP before release or LAUNCH ? when release is unavailable. Kinetic rounds move
  only over a positive release-to-effect interval; zero-flight kinetic events draw no
  traveling round. Beam/EW channels draw at release without kinetic interpolation; a
  zero-duration channel gets the existing 0.6 s display pulse. Committed rounds remain
  through effect, independent of the target's expected-defeat state. Assignment counters,
  effect calculations and outcomes are unchanged.
  `series.ts` counts only physical kinetic flight, with NaN during an unresolved legacy
  interval; effector marks are ASG, REL and FX, combined at coincident timestamps. Preparation/channel spans have a legend
  censored to the horizon. `runResultGroups.ts` describes `tS`, `tReleaseS`, `tEffectS`
  and `shipIdx` separately and counts recorded, reconstructable and unavailable release
  timing. Exports preserve legacy event omissions and the captured scenario.
- **Words.** UI copy follows the code style in AGENTS.md: short active sentences in the
  domain's terms, no em-dashes. Use one word for one thing ("phase center", "event").

## 7. UI and rendering invariants

Code follows the existing two-space, single-quote, no-semicolon style. Prefer named
exports and interfaces for object shapes, JSDoc on exported symbols, short rationale
comments and lines near 100 characters. Prettier (`prettier.config.mjs`, printWidth 100)
owns `.ts`, `.tsx` and `.mjs` layout; oxlint owns lint. Generated modules
(`*.generated.ts`, `src/io/runtimeSchema.ts`) stay out of the formatter so byte
checks remain exact. Application `tsconfig` files enable `strict`, `noImplicitOverride`
and `noImplicitReturns`. Do not add unused exports or TODO markers.

`src/ui/ErrorBoundary.tsx` isolates the Board root. Its fallback uses `State` with Export
and Reload. Export reads the Board scenario; a caught render error never clears records.
`startAutosave` stays outside React in `main.tsx`.

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
- Each layer reads its flag through `selectEffectiveLayers` and returns `null`;
  `CanvasStage` does no gating.
- Everything a layer draws at time t is derived at render from the scenario and
  `simTimeS`, with outcome badges limited by the execution horizon. A layer never stores derived state. A layer may keep the previous render's
  records in a ref only to lend their identities to the records that did not change
  (`useRingModel` rings, `ThreatWezLayer` zones, `LiveScene` placements, tracks and spoke
  ids; `sweepAt` lends hits, track states and effector states the same way), never to skip
  a derivation. Rings are one prepared model (`ringModel.ts`): `FootprintLayer` draws its
  records and `HudLayer` hit-tests it; neither derives ring geometry, and the HUD never
  imports a drawing file. Spoke callout geometry snaps to whole pixels in `labelLayout.ts`, so a
  sub-pixel centroid drift does not change a placement's identity.
- Two scene Layers, in this order: `StaticScene` (boundaries, footprints, range rings,
  connections) and `LiveScene` (WEZ, paths, track estimates, engagements, entities,
  system handles, callouts, the marquee). A Konva Layer is one canvas, so a moving glyph repaints the
  live canvas alone and the dashed rings stay untouched between publications. The frame
  clock is mounted once, in `LiveScene`; the static scene reads the published `simTimeS`
  and re-renders only when the held-sensor set changes.
- Sampled sensor/effector state and held-sensor rings use `trialSweepAt`; member outcomes
  and geometry use `trialTrackState`. `CanvasStage` passes the retained trial and horizon
  to `LiveScene`; `StaticScene`, the track card and detail panes read the same observations.
  A forward preview never exposes later outcomes. Forecast `sweepAt` and `trackTimelineOf`
  remain separate adapters keyed on `engineKeyOf(scenario)`.
- A frame creates React elements for what moved. `EntityNode` is memoized on per-entity
  primitives, the pulse phase is one boolean computed per frame (never `displayTimeS`
  itself), and the flying entities render in their own group above the at-rest ones.
- Fixed `dash` and `points` arrays are module constants. Konva compares array props by
  identity, so an inline literal re-sets the attribute and dirties the layer on every
  render. Per-render geometry (shot endpoints, grid lines, a trimmed link) stays inline.
- A layer that reads only the zoom subscribes to `camera.scale`. A handler reads
  `camera.x` and `camera.y` through `useStore.getState()`. A pan reaches the layers
  through the stage transform alone and re-renders no layer.
- The heading handle and the system handle preview a rotation on the Konva nodes during
  the drag and commit one store action on `dragend`. Drag events bubble from a child to
  the entity group; the group acts only on a drag whose target is itself.
- The cursor: `CanvasStage` keeps the pointer's world position in a ref and sets state
  only while a boundary, path or calibrate tool or a marquee is active. `HudLayer` reads
  its own cursor from a stage `mousemove` listener. A plain hover re-renders neither the
  stage nor a Konva layer.
- `App` subscribes to primitives (the one selected entity id, an object-selection flag,
  a selection key), never to the whole `selection` or `scenario`. `select` and
  `setRightTab` return the current state when nothing changes, so a repeated call
  re-renders no subscriber and writes no view state.

Design system (`src/index.css`):

- **Tokens, not literals.** `:root` holds a graphite ramp (`--surface-*`, `--border-*`,
  `--text-*`, `--status-*`) and short aliases (`--bg`, `--text`, `--accent`, `--danger`,
  `--good`, `--warn`, `--ew`, `--chart-1` to `--chart-5`). The surfaces are
  `--surface-board`, `--surface-panel` and `--surface-sunken`; the two rules are `--rule`
  and `--rule-strong`; the `--paper-*` palette remaps them under the light theme. New
  rules read the semantic names. Spacing is `--space-1` to `--space-6` plus `--panel-pad`; motion is `--dur-fast` /
  `--dur`. `--border-control` is the boundary of an interactive control (WCAG 1.4.11 needs
  3:1); `--border-default` and `--border-subtle` are decorative hairlines and never go on
  an input.
- **Monospace is machine data only:** ids, coordinates, timestamps, units, keys, numeric
  readouts, fixed abbreviation codes, chart axis ticks. Interface chrome and prose are
  `--font-ui`; mark a number in prose with `.num`.
- **Type floor is 11 px** (`--type-dense-size`); no `font-size` rule in the sheet is
  below it. Sizes and weights come from the `--type-*` role tokens (display, value, title,
  body, meta, label, machine); weights are 400 and 500 only. The right panel is checked by
  the browser harness at 1400 by 900 with a saved 320 px panel width (see
  [VERIFICATION](VERIFICATION.md) "Harness setup"): no panel content may be clipped or
  inaccessible. Lifecycle views are local UI composition;
  they do not advance playback or change the analysis basis. The five built-in analysis
  destinations remain outside the scrolling content, including during object inspection.
- **Separators, not cards.** Hierarchy comes from surface tone, spacing, typography, a 1 px
  rule and interaction state. `--radius-control` (2 px) is the only non-zero radius and
  applies to controls; containers are square. The sheet has no `box-shadow`,
  `backdrop-filter` or `rgba(` tint. The full rule set, token table and component list are
  in the [design system](design/DESIGN_SYSTEM.md).
- **Charts:** `src/charts/tokens.ts` resolves CSS variables once per chart render.
  `tokens.test.ts` checks the five chart slot hues against the sheet. Other
  `TOKEN_FALLBACK` values used in Node/static markup retain earlier palette values;
  the test does not establish full fallback parity with the current CSS. A recharts
  `CartesianGrid` with a hidden axis needs an explicit empty coordinate generator:
  `vertical={false}` only hides the lines, and the default generator still measures the
  label of every data row in the DOM, one forced layout per row.
- **Inspector kit** `src/panels/inspector/kit.tsx`: `Section`, `Row`, `ObjectHeader`,
  `EmptyState`, `Kbd`, `ShortcutList`, `Actions`, `PfTag`. A read-only property is a
  `Row`. The tab bar in `App.tsx` follows the ARIA tabs pattern; `.right-resizer` is a
  keyboard-operable separator.
- Keyboard map (`App.tsx`): Cmd+Z / Shift+Cmd+Z, Delete, Esc (cancel draft, tool to
  select), Enter (finish boundary or path), Space (play/pause), `]` (open or close the
  right drawer; the layout effect shifts the camera by half the canvas width change so
  the board center holds). Shortcuts are suppressed
  while typing in inputs. Escape order: the command palette,
  then an open dialog (Location, Calibrate), then a toolbar dropdown or the Layout
  surface, then an armed placement or the open drawer, then the canvas draft and the
  selection.
- Interaction routing (`src/canvas/interactionRouter.ts`): `routeInteraction(intent,
  state)` is the one owner of that Escape order and of click precedence. `App.tsx`
  (Escape, arming a placement, a tool change), `CanvasStage.tsx` (stage clicks, drops,
  the placement target) and `layers/EntityLayer.tsx` (entity clicks) build a plain
  `InteractionState` snapshot from the store, the DOM surfaces and their own state, and
  dispatch the returned action; none of them orders the rules itself. `continue` hands
  the event to the next owner (`usePopover`, the palette, the stage under an entity).
  Stage click precedence: a marquee-paired click is dropped, then an armed placement,
  then the raid draft, then the draw tools (an in-place double-click's second click is
  no vertex), then a plain select click on empty canvas clears the selection. An entity
  click is owned by connect and select; path owns only the UAS that starts a draft;
  boundary, calibrate and a raid draft bubble it to the stage. The matrix is
  table-tested in `interactionRouter.test.ts`. The screen control in `AnalysisNavigation.tsx`
  is one `Seg` (`role="group"`, one pressed segment) that stays rendered in every phase
  and tab; the calibrate tool shows a `role="status"` strip until Escape or Cancel.

## 8. Standards referenced by model tags

The `standard` column of `MODEL_TAGS` in `src/analysis/fidelity.ts` quotes a row of this
table where a published method applies. A row here is a reference, not a claim that the
code implements the method in full.

| Area | Standard or reference |
| --- | --- |
| VV&A policy | DoDI 5000.61, DoD M&S Verification, Validation and Accreditation |
| VV&A documentation | MIL-STD-3022, Documentation of VV&A for Models and Simulations |
| Credibility assessment | NASA-STD-7009A credibility factors: verification, validation, input pedigree, results uncertainty, results robustness, use history, M&S management, people qualification |
| Statistical rigor in T&E | DOT&E guidance on scientific test and analysis techniques; STAT COE design of experiments guidance |
| Geodesy | WGS 84 (NGA.STND.0036), EGM2008 geoid |
| Atmosphere | US Standard Atmosphere 1976 (ISO 2533); ITU-R P.676 gaseous attenuation; ITU-R P.838 rain attenuation |
| RF propagation | ITU-R P.2001 wide-range terrestrial model; ITU-R P.526 diffraction; ITU-R P.528 aeronautical paths; NTIA ITM (Longley-Rice) as the cross-check model |
| Radar | Blake range performance method; Barton radar equations; Swerling cases evaluated with Marcum-Q and Shnidman; Billingsley land clutter; IEEE 686 definitions |
| EO/IR | NVESD NV-IPM methodology and the Targeting Task Performance metric; Johnson criteria retained as a legacy cross-check |
| Acoustic | ISO 9613-2 outdoor attenuation; ANSI/ASA S1.26 atmospheric absorption |
| Navigation | GPS SPS Performance Standard; INS error as random walk plus bias |
| Tracking | Bar-Shalom and Li, estimation and data association: the constant-velocity Kalman filter and track-to-track fusion are textbook methods there, not a numbered standard; Blackman and Popoli, multi-target tracking |
| Terrain data | DTED (MIL-PRF-89020B), SRTM, USGS 3DEP |
| Symbology | MIL-STD-2525 (already in use) |

Phase 3 validation anchors are executable and dated. `flight.verify.test.ts` checks the
seeded DJI Mavic 3 climb figure while `flight.test.ts` pins the hand-derived turn arc and
wind vector. `rfLink.verify.test.ts` checks Mavic 3 links against RF-360 and ARDRONIS
published ranges. `eoir.verify.test.ts` reproduces the Spynel-S 6000 detect point and
records the vendor recognize-ratio mismatch; identification remains analytic because the
sheet omits it. `radarDwell.verify.test.ts` pins three Shnidman integration cases while
the older Marcum-Q pins remain unchanged. `kinetic.verify.test.ts` checks the APKWS
effective-radius table and the Rheinmetall burst timeline. `beam.verify.test.ts` checks
the Iron Beam power/range/dwell anchor and a hand-derived HPM field threshold.
