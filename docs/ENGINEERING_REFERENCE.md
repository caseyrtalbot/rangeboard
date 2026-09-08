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
- **Schema:** `Scenario.schemaVersion = 1`. `fillScenario`
  (`src/io/persist.ts`) spreads a save over `emptyScenario()` and deep-fills one level into
  `environment`, `requirements`, `doctrine`, `mcdaWeights`, `underlay`, `raid`. A new
  top-level field, or a field inside one of those, needs only a default in
  `emptyScenario()`; a new nested object needs its own `fillScenario` line. New fields
  added to schema 1 must remain compatible with legacy saves, using optional fields and
  defaults where needed. Bump the version only for a breaking shape change, and only
  when the user asks. A save that cannot load is copied to
  `rangeboard.scenario.recovered.<ms>` before anything writes; the copy is read back and
  checked. Read denial or a failed recovery pauses autosave so the only raw copy survives.
  Read denial uses the save-status error; failed recovery queues an in-app Storage notice
  explaining export, storage cleanup and reload. Runtime validation
  (`src/io/runtimeValidation.ts`, `validateScenario.ts`) checks shapes, finite and ranged
  values, ids, references and engine representability before default filling. Missing
  legacy fields fill; a malformed present field fails with a path and reason. Unknown
  extension data survives. Reserved object-prototype ids are rejected. Triangular spread
  bounds are fractional offsets around zero. Base64 image syntax follows native decoder
  padding. A new underlay image passes a 5 MiB admission budget; an existing valid image
  is not size-capped. `loadScenario` is the one load path; `replaceScenario` clears
  history, selection, drafts and the tool, and prunes per-entity view state.
- **Storage keys live in `src/io/storageKeys.ts`;** never rename one; add a new key
  instead. The scenario and T&E autosaves have their own read and error paths; both run
  through the one lifecycle in `src/io/autosave.ts`, and their adapters keep the keys,
  the records and the save status separate. Every other
  settings key (view, layers, rings, run sequence, analysis layout, units, panel widths,
  collapse flags) is read and written through `readSetting` and `writeSetting` in
  `src/io/viewState.ts`, the one guarded localStorage path for settings. The camera write
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
  `trialClient.ts`, both over `workerSlot.ts`; the store starts an analysis only through
  `src/state/analysisRequests.ts` and calls the adapters directly only to cancel. The worker value-import
  graph must stay independent of stores, React, zustand, localStorage and panel modules.
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
  `CANCEL_GRACE_MS`. `mcClient.ts` (two slots: replicates and sensitivity) and
  `trialClient.ts` (one slot) are protocol adapters over it: they own the worker URL,
  the request envelope, decoding, identity checks (run id; for a trial also request token,
  basis and manifest) and their cancellation semantics (graceful with grace period for MC,
  immediate terminate for a trial). Above them, `src/state/analysisRequests.ts` owns what
  a request is for the three kinds `mc`, `sensitivity` and `trial`: `requestAnalysis` builds
  the identity (run id, analysis basis, trial token and manifest), publishes the pending
  slice state first and starts the worker second, so a synchronous startup error or a
  missing `Worker` lands as a terminal error on that state; `acceptMcMessage`,
  `acceptSensitivityMessage` and `acceptTrialMessage` accept a message only while the
  request is live, for the current playback id and analysis basis (and for a trial the
  token and manifest). Terminal states accept nothing. Store actions `runMonteCarlo`,
  `runSensitivity` and `prepareTrial` request an analysis; the store's `mcMessage`,
  `sensitivityMessage` and `trialMessage` sinks reduce through the accept functions. Adding
  a fourth worker-backed analysis means one adapter and one launch/accept pair, not a new
  slot implementation.
- **Monte Carlo worker:** `runMonteCarlo` requests the `mc` kind, which posts through
  `src/playback/mcClient.ts` to `mc.worker.ts`, which runs `runReplicates`
  (`src/playback/mcRun.ts`). The result lives in the
  `mc` slice: view state, never persisted, never in `past`. `resetRun` and `replaceScenario`
  clear it; edits, undo and redo use `analysisBasisSignature` to mark mismatched results
  stale. The signature includes domain fields by default, removes named presentation and
  evidence metadata, resolves scenario/entity/link defaults, and uses `uncertainFields`
  for effective spreads and draw identities. Raw model specs are conservatively included;
  object key order is ignored and array order is preserved. See the input matrix in
  `docs/field-te/C1_COMPLETION.md`. A second worker slot runs `runSensitivity` on demand.
  `engagementPicture` stays the deterministic path; the replicate loop never touches its cache.
- **Sampled Play:** `trial.ts` runs nominal parameters with aleatory draws through
  `monteCarloPolicy` → `assessAllThreats` → `resolveEngagements`. Its complete assessments
  and event/attrition ledger remain separate from the deterministic picture and MC summaries.
  Optional sweep capture retains actual scan attempts, admitted member detections and misses,
  cue/gate state and classification; existing assessment intervals retain holds and coasts.
  Formation `memberIdx` is distinct from the nearest-first `drawIndex` used by the existing
  policy. Continue-jam outcomes are retained separately because ledger `killDelta` does not
  encode that draw. Default and ensemble sweeps collect no new observation histories.
  `trialTypes.ts` freezes the run id, configuration basis, seed, `idHash(runId)` numeric
  replicate index, nominal/aleatory basis and compatibility versions. Build provenance is
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
  live in `panels/analysis/ForecastSettings.tsx` under **Forecast and analysis**.
  Completed-run export adds `TrialResultGroup` under `resultGroups.trial`, with captured
  scenario, manifest, ledger, observations, jam decisions, members and integer counts.
  Its basis is `simulated-trial`, with no ensemble confidence interval or independently
  instrumented T&E claim. Missing build provenance reads **Build revision unavailable**.
  `persist.ts` checks run identity and completion; `runResultGroups.ts` revalidates the
  captured basis and result. Existing forecast/MC groups retain their own semantics.
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
- **Thresholds are test-defined:** `Scenario.requirements` (`RequirementThresholds`,
  defaults in `DEFAULT_REQUIREMENT_THRESHOLDS`) holds what the test asks the system to
  meet. Every reader spreads `{ ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }`.
  Never gate a requirement on an engine constant: a gate at `SHIP_DEAD_BELOW` passes itself
  by construction.
- **No invented values:** every unsourced number is a planning factor (PF) and is labeled
  as one. Never invent a value to fill a blank; record the blank as an open item instead.
- **No `Math.random` under `src/`.** Every draw goes through `DrawPolicy` (section 5). The
  engine draws in exactly five places; a sixth changes the draw keys and the CRN tests.
- **T&E store is separate** (section 8 below). Never embed campaign data in `Scenario`.

## 4. Architecture map

```text
src/model/     types.ts (domain types, newId, resolvers like mountHeightOf, basisFor),
               scenario.ts (modelFor index, pathSpeed, scenarioDurationS, engineKeyOf and
               markPresentationVariant), seed.ts (emptyScenario, DEFAULT_SEED),
               seedLibrary.ts (builtin specs with
               provenance rows), integrationData.ts (researched pairings and profiles),
               seedSystems.ts (system presets), seedCards.ts,
               rcsFactors / signatureFactors / weaponFactors (PF tiers)
src/geometry/  geo.ts (bearings, wedges, path interpolation, formatters), slant.ts (slant
               range, horizon), prng.ts (mulberry32, idHash, hashU01), webmerc.ts
src/state/     store.ts: one zustand store (scenario + history + selection + camera + ui +
               playback + mc + trial), playbackCommands.ts (store-free playback intents:
               play, pause, scrub, frame, publish, newRun and their transitions),
               analysisLayout.ts (lens presets and pure layout reducers),
               layers.ts (LayerVisibility, presets, ringVisible), runState.ts (playback and
               MC/trial state shapes), scenarioInstall.ts (installScenario: the per-operation
               edit/undo/redo/replace response of history, selection, ring overrides,
               playback, mc and trial), analysisRequests.ts (requestAnalysis and the accept
               reducers for the mc, sensitivity and trial requests), analysisBasis.ts
               (analysisBasisSignature), raidBuilder.ts (standoff search, buildRaid),
               labels.ts (run, connection, frame and card-version labels), camera.ts
               (fitCameraTo), rings.ts (ring keys, pruneRingOverrides), selectors.ts,
               trialSelectors.ts (retained run/basis selection and raw observation horizon),
               useTrialResult.ts (shared trial snapshot and series hook)
src/playback/  clock.ts (DT = 0.5 s, stepIndex), tracks.ts (positions at t), detection.ts
               (prepareSweep: per-sensor terms resolved once per threat; sweepSensorHits,
               detectionsAt, spawn ring check), killChain.ts (kill-chain
               routes), sim.ts (assessThreat, assessAllThreats), pk.ts (Pk model and
               expenditure channels), intercept.ts (time of flight, intercept, launch
               releases), shot.ts (evaluateShot: per-ship shot eligibility shared by both
               firing passes), attritionReport.ts (report types), sweepState.ts (sweep
               state types), attrition.ts (resolveEngagements: fire distribution,
               expected kills, events), trackState.ts
               (phase at t, trackTimelineOf), sweepAt.ts (the per-publication sweep memo:
               hits, track states, effector states, held sensors), tactics.ts (threat
               tactics), raid.ts, runSession.ts (thin adapter: toggle and reset commands),
               policy.ts (DrawPolicy), mcRun.ts (runReplicates, runSensitivity, Stat,
               McSummary), workerSlot.ts (the one worker slot: start, cancel, dispose),
               mc.worker.ts + mcClient.ts (the replicate and sensitivity protocol adapters),
               trial.ts (one retained nominal/aleatory trial), trialTypes.ts + trialMessages.ts
               (manifest/result/transport contracts), trial.worker.ts + trialClient.ts
               (the trial protocol adapter), controlledWorker.ts (the shared Worker test
               double), trialTrackState.ts (retained member
               outcomes and geometry), trialSweepAt.ts (retained scan/hold and effector state)
src/analysis/  sensorEnv.ts (sensor physics), radarPd.ts (Pd closed forms), ewPhysics.ts
               (jam), doctrineFactors.ts (per-system factors), impact.ts
               (engagementPicture cache, WEZ), liveStats.ts (KPIs at t), series.ts (chart
               series on the DT grid), runValidity.ts, requirements.ts, uncertainty.ts
               (sampling), parameterBasis.ts (pure spread resolution and enumeration),
               fidelity.ts (model tags), aar.ts, systemTelemetry.ts,
               threatAggregation.ts, range.ts, trialResult.ts (validated trial view and
               integer counts), trialSeries.ts (observation-bounded trial chart adapters)
src/ui/        kit.tsx: the shared primitives Field, Seg, State and ProvMark that both the
               Board panels and the T&E kit render; reads index.css classes only, no store.
               ink.ts: the Konva ink table (danger red, entity kind fallback colors) that
               the layers, the palette glyphs, the detail panels and trackState share.
               usePopover.ts: the one dismissal rule for the toolbar dropdowns (outside
               pointer, capture-phase Escape, focus in on open and back on close).
               rovingTabs.ts: nextTabIndex, the one arrow-key mapping for every
               roving-tabindex group
src/charts/    chart kit: types.ts (Series), tokens.ts, timeAxis.ts, seriesData.ts (pure
               series helpers), TimeSeries (a lazy shell whose fallback holds the plot
               box), TimeSeriesChart + ChartFrame (the recharts plot, loaded on first
               render), Ladder and Tornado (plain SVG). Props only; never reads the store.
src/canvas/    CanvasStage.tsx (stage, pan/zoom, tool routing, drop target, the two scene
               Layers), StaticScene.tsx (boundaries, footprints, range rings and
               connections on the static Layer), LiveScene.tsx (the frame clock and every
               moving layer on the live Layer), TrackFileReadout.tsx, frameClock.ts,
               ringModel.ts (store-free, Konva-free: prepareRingModel resolves every ring
               record from Scenario, RingView and the selected threat, and hitAt finds the
               ring edge under a world point over the same records), useRingModel.ts (the
               store-bound hook FootprintLayer and HudLayer share),
               layers/ (one component per drawn concern; footprintStyle.ts is the ring
               style source)
src/panels/    Toolbar, ViewMenu, Palette, Inspector (+ inspector/kit.tsx over src/ui/kit.tsx,
               spreadText.ts),
               LibraryEditor, TestCardsPanel, AnalysisPanel (+ analysis/, analysis/widgets/,
               analysis/detail/, analysis/ForecastSettings.tsx for forecast/MC controls),
               TimelineBar (owns the rAF loop; publishes the clock only), CommandPalette,
               Glyph.tsx (symbology), ringLabels.ts (ring names), headlines.ts
src/io/        autosave.ts (the one autosave lifecycle: createAutosave returns read,
               restore, observe, flush and stop, and owns the read, the recovery, the
               write gate, the 500 ms debounce, the pagehide and visibilitychange flush;
               an AutosaveAdapter supplies key, parser, record selection, adoption and
               save status), persist.ts (scenarioAutosaveAdapter and the Board autosave
               entry points, fillScenario, adoptSeedProvenance, JSON and library
               import/export, runExportObject), runResultGroups.ts (per-group basis/units
               and separately typed TrialResultGroup),
               runtimeSchema.ts + generateRuntimeSchema.mjs (domain shape descriptors),
               runtimeValidation.ts + validateScenario.ts (runtime semantics),
               viewState.ts (readSetting and writeSetting over every settings key),
               storageKeys.ts, recovery.ts
src/te/        T&E Operations workspace (own store, section 8)
src/main.tsx   restores the Board autosave (restoreAutosave reads and adopts it), starts
               both autosave subscriptions, schedules the T&E restore on idle,
               exposes window.__store and window.__teStore in dev
src/App.tsx    workspace toggle, right panel tabs, keyboard map, resizer; lazy boundaries
               for OpsWorkspace (which restores the T&E record first), AnalysisPanel,
               TestCardsPanel and CommandPalette
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
the formation spread); `impact.ts` only keeps the memos from one run to the next. A new
scenario read inside `assessThreat` joins `threatAssessmentInputs` in `sim.ts` in the same
change. `resolveEngagements` runs fresh every time. Engine entry
points in call order: `assessAllThreats(scenario, policy?)` (`sim.ts`) sweeps detection and
builds one `ThreatAssessment` per active threat; `resolveEngagements(scenario, assessments,
policy?)` (`attrition.ts`) distributes fire and returns totals, events and per-effector rows.

## 5. One source per fact

Each fact below has exactly one definition. Read it there; never add a second copy.

- **Sample grid:** `DT` (0.5 s) and `stepIndex` in `src/playback/clock.ts`. `tickStepS` in
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
  hold while the M-of-N window keeps counting.
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
  meeting time is the smallest root of a quadratic per phase in time order), and it caps the
  flight at the end of the envelope interval that holds the release: a flight past that end
  lands at the end and the event carries `flightCapped`. It also reports `infeasible`:
  the slant to the credited point exceeds the reach `v * (tEffectS - release)` by
  more than one DT of flight, which with the exact solution happens only at a cap or when
  no meeting exists; both selection passes decline such a shot (no event, no round, no
  cooldown). `kineticPk(basePk, maxRangeM, uas, slantM)` is the one
  kinetic per-shot Pk, at the intercept slant; `footprintStyle.ts` imports it to invert the
  commit ring. `SIZE_PENALTY` and `EVASION_PENALTY` (`pk.ts`) stay PF. Per-system factors and spec
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
  field. `DRAW_KIND` names the kinds and `stepIndex` (`clock.ts`, beside `DT`) is the one
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
  and `editModel` drop the row of a spec field they change (`dropEditedProvenance`); an
  edited field takes no row and stays PF. "Reset to seed" (`resetModelToSeed`, undoable)
  puts a builtin back to its seed.
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
  with `se`, the paired standard error of the per-replicate difference; the
  `sensitivity` widget runs it on demand on its own worker slot into `mc.sensitivity`,
  which a basis change marks stale. The sensitivity widget reads `currentSensitivity`
  and hides stale rows and replicate metadata. `spreadText` (`src/panels/inspector/spreadText.ts`) is
  the one spread wording, shown by the Sources table and appended to the `PfTag` title.
- **Fidelity** (`src/analysis/fidelity.ts`): `MODEL_TAGS` is the one tag table, one row
  for each of the fourteen model ids with a tier, a validation status and, where a
  published method applies, a `standard` that quotes a row of section 9. `modelsUsed
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
  cone. Only a selected-threat ring carries a label.
- **Analysis layout** (`src/state/analysisLayout.ts`): `BUILTIN_LENSES` the five lenses,
  `WIDGETS` (`src/panels/analysis/widgets/registry.ts`) the one type-to-component map,
  `ui.analysis` view state under `ANALYSIS_KEY` written by every layout action, builtin
  lenses never persisted. `Scenario.observedPresetId` is written on reset and first
  play only and stays out of the basis signature. `SURVIVAL_LABELS` and `KPI_LABELS`
  (`widgets/labels.ts`) are the one name table (Leakers, Survives, Survival limit; the
  effect gate is relabeled at render); `useSimTimeStep` (`widgets/controls.tsx`) supplies
  quantized forecast time; `useTrialResult` supplies trial cursor telemetry.
  `AnalysisNavigation` keeps all five destinations outside the content scroller;
  `AnalysisLayoutControls` owns view-only preset/add/edit/save controls. WidgetFrame and
  AnalysisSection use keyboard-operable disclosure buttons with named content regions.
  Analyze presents Trial results through observed time, with Trial cursor telemetry,
  Forecast and Monte Carlo separately labeled; customized widgets keep their stored order
  and parameters. Trial series remain cursor/observation-bounded in Analyze too.
  DebriefRecord retains completion guards, current-result readers and exports
  behind Evidence products, without rendering a second OutcomeSummary. Execute replaces
  projection, requirement-gates and sensitivity bodies with “Forecast available in Analyze”
  using the same instance controls without changing saved layouts. Registry horizon metadata
  and WidgetProps carry the scope;
  WidgetFrame hides meta when given a scoped horizon unless `metaWithinHorizon` is true.
  Execute mounts DebriefRecord only when the horizon reaches duration; Analyze retains
  full-run evidence while scrubbing. Cursor widgets sample within the execution horizon;
  event counts include reached assignments, while effect times, Pk and kill deltas wait for
  the effect. EngagementStrip clips windows and censors lane marks, tooltips and labels.
  Environment, doctrine and thresholds route Board scenario edits to Prepare. Forecast/MC
  controls live under Forecast and analysis in Prepare and Settings.
- **Selection detail** (`src/panels/EntityWorkspace.tsx`): the Board shell routes one
  selected entity into Telemetry, Configure and Model basis. `DetailPane` is the one
  telemetry kind-to-pane map (sensor, effector, uas, c2); Inspector owns configuration
  and LibraryEditor owns shared model edits. Overview preserves entity selection and
  the preset id. Multi-selection, boundaries, connections and raid drafts retain the
  existing Inspector. AnalysisPanel renders the widget stack alone; the Board shell owns
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
  `useTrialResult` supplies the same bounded series to execution widgets and detail panes.
- **Model versus instance:** `SpecModel` (library entry, `builtin` flag,
  duplicate-and-edit) versus `Entity` (canvas instance referencing `specId`; survives model
  deletion with `specId` set to null). `Scenario.deletedSeedIds` keeps the seed merge from
  resurrecting a deleted builtin. A seed field change does not reach an existing save's
  copy of a builtin model; "Reset to seed" does.
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
  Measure labels in T&E Ops suppress pass or fail unless `thresholdApproved`.

## 7. UI and rendering invariants

Code follows the existing two-space, single-quote, no-semicolon style. Prefer named
exports and interfaces for object shapes, JSDoc on exported symbols, short rationale
comments and lines near 100 characters. There is no source formatter. Do not add unused
exports or TODO markers.

`src/ui/ErrorBoundary.tsx` isolates Board and Ops roots, each analysis widget invocation
and frame body, and print contents. Its fallback uses `State` with Export and Reload.
Exports read the owning Board scenario or T&E campaign; a caught render error never clears
records. `startAutosave` and `startTeAutosave` stay outside React in `main.tsx`. The widget
render probe is dev-only and absent from the production bundle.

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
  connections) and `LiveScene` (WEZ, paths, engagements, entities, system handles,
  callouts, the marquee). A Konva Layer is one canvas, so a moving glyph repaints the
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
  select), Enter (finish boundary or path), Space (play/pause). Shortcuts are suppressed
  while typing in inputs and inside the T&E workspace. Escape order: the command palette,
  then an open dialog (Location, Calibrate), then a toolbar dropdown or the Layout
  surface, then an armed placement or the open drawer, then the canvas draft and the
  selection. The lens buttons in `AnalysisNavigation.tsx` are a `role="group"` of
  `aria-pressed` buttons with one roving tab stop, since they stay rendered in every
  phase and tab; the calibrate tool shows a `role="status"` strip until Escape or Cancel.

## 8. T&E Operations module (`src/te/`)

- Second workspace ("T&E Ops" toggle). Spec sources: `docs/te-plan.md` and the MASTER-*.md
  files in `docs/te-compilation/`.
- **Separate store, no undo:** `src/te/state/teStore.ts`, persisted at `rangeboard.te.v1`,
  recovery copy at `rangeboard.te.recovered.<ms>`. `teAutosaveAdapter` in
  `src/te/io/persistTe.ts` is the T&E half of the shared lifecycle (`src/io/autosave.ts`):
  the T&E key and parser, the campaigns and active-id selection, adoption through
  `replaceState` and an ISO save stamp. It is the deferred adapter, so `startTeAutosave`
  only subscribes and writes nothing until `restoreTeAutosave` has read the saved record
  back; the restore runs once per lifecycle instance, on idle, on the first Ops entry or
  on a Board frame capture, whichever comes first.
  Records are versioned and append-only
  (runs never renumber, issued cards freeze, changes create new versions). Never embed
  campaign data in `Scenario`. The store enforces issued/superseded card immutability,
  frozen baselines and generic action guards. Delivery freezes campaign evidence; closure
  remains available. The [record rules](field-te/C4_COMPLETION.md#record-rules) list them.
- IDs follow `VLK-<code>-<type>-<seq>` (`src/te/model/ids.ts`); versions live on the
  record. Cards use `id` (per version) plus `cardCode` (shared across versions).
- Card links and fill live in `src/te/model/cardLinks.ts` (pure) and reach the UI as four
  store actions: `linkCardCell`, `setCardLinks`, `fillCard`, `refillCard`. Callers pass a
  selection; the module owns link precedence and the fill rules. `linkedRecordFill` writes
  empty fields only, or every derived field on the refill path. A cell merged into an
  existing card unions the id lists and moves a single link only where the cell names a
  record; a cleared or unknown cell changes the cell link alone. `fillCard` adds the default
  event marks and the authority preconditions and runs on a draft only. Creating a card from
  a cell (`createCardFromMatrixCell`) stays a separate operation: the cell decides every link
  and no draft defaults are added. Every one of them writes through `patchItem`, so issued
  and superseded cards reject them.
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
- **Finding evidence** (`src/te/calc/findingEvidence.ts`): `findingComputations` scopes
  `computeMeasure` to the finding's linked runs, so the inclusion policy in `validate.ts`
  decides what counts. `derivedRunLinks` and `derivedRunConfig` take actual run records
  over the card plan. `evidenceDerivation` renders the eight evidence fields with units,
  denominators and intervals; `evidenceFills` proposes text only for empty fields.
  `findingLinkUpdate` builds one patch from a link change: the links, unambiguous chained
  records, run-derived defaults and fills. The store action `setFindingLinks` applies that
  patch as one update. Strength and dispositions are suggestions the user accepts in the
  UI; derivation never writes a judgment.
- **Evidence package** (`src/te/calc/package.ts`): `generatedSection` and the manual
  section templates live here, not in the UI. `resolveSection` is the one precedence
  rule: delivered text, else edited text, else generated text, else stored text.
  `previewPackage` feeds the Deliver panel and `PackagePrint`; `resolvedPackage` is the
  "Save generated text" write. `deliverPackage(campaign, at)` resolves every section,
  runs `deliveryBlockers` on the resolved text and returns one frozen campaign update or
  the blockers; `markPackageDelivered` applies that update in one `mutate`, so delivery
  no longer depends on what the panel saved first.
- Seeds in `src/te/seed/` (measure dictionary, templates, vignettes, `buildJiatf401()` demo
  campaign marked `illustrative`). The measure dictionary, the card templates and the threat
  vignettes load with `applyPreset` (async), not at startup. Print artifacts in `src/te/print/` render into
  `PrintOverlay`; CSV exports in `src/te/io/exportCsv.ts`. Board frame capture
  (`src/te/io/frameCapture.ts`) works only from the Board workspace. New PNG captures and
  serialized Board config snapshots are admitted against `MAX_IMAGE_CODE_UNITS` (5 MiB
  accounting for UTF-16) before the campaign changes. Generic frame/config add and patch
  actions enforce admission too; unchanged legacy payloads remain editable. Capture errors
  render a `State` notice. Admission does not reserve storage or guarantee the actual write.
- Persistence and imports are validated through `io/validateTe.ts`, including campaign-local
  references. An embedded Board snapshot is stored verbatim at load and validated by
  `parseConfigSnapshot` when it is opened. The store checks internal transitions and
  evidence history.

## 9. Standards referenced by model tags

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
| Tracking | Bar-Shalom and Li, estimation and data association; Blackman and Popoli, multi-target tracking |
| Terrain data | DTED (MIL-PRF-89020B), SRTM, USGS 3DEP |
| Symbology | MIL-STD-2525 (already in use) |
