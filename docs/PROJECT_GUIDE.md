# RangeBoard project guide

RangeBoard supports C-UAS test design. The Board explores a modeled laydown. A model run
can inform a test, but it does not automatically become an observed trial or an approved
requirement. No future refactor is selected by this guide.

Equations and implementation contracts live in the [engineering reference](ENGINEERING_REFERENCE.md).
This guide maps user activities to source; the [verification guide](VERIFICATION.md)
maps changes to checks.

## Board features

The Board shell provides Prepare, Execute and Analyze lifecycle views. These are local
navigation choices stored only for the session: changing a view preserves the playback
cursor, observed horizon and analysis basis. Execute starts with engagement layers and
retains its own session-only layer override; Prepare and Analyze share the saved layers.
Prepare composes the existing run inputs, validity findings and a
keyboard-accessible entity register in [BoardPreparation](../src/panels/BoardPreparation.tsx).
Each validity finding appears once with its gates. Setup findings that cost a measurement
come first, with a Select button for a threat that starts inside detection coverage.
The [analysis navigation](../src/panels/analysis/AnalysisNavigation.tsx) is one segmented
control of the current phase's screens. It stays outside the scrolling panel, including
while an object is selected. Selected-object configuration and the model library remain
available in the panel tabs.

The Library resource opens a drawer with model/system placement, drag-and-drop, model-basis
editing, tactics and library import/export. `L` toggles it and Escape returns focus to its
button. Prepare groups run configuration, environment, doctrine and requirement inputs.
The canvas toolbar separates View preferences (theme, layers, units and basemap) from
Range setup (location, calibrated image, image movement and saved opacity). Existing
scenario actions govern changes and undo; automatic documented connections remain their
own undo step. Pending placement is cancelled by a competing tool or a change to the entity
or system-preset count. Escape closes an open dialog before it
cancels a placement. The calibrate tool shows a strip until Escape or Cancel ends it.

A single selected entity opens [EntityWorkspace](../src/panels/EntityWorkspace.tsx):
Telemetry, Configure and Model basis share one content scroller. Overview preserves the
selection. Model basis names all linked instances and reuses the model editor; duplication
leaves the selected instance linked to its original model until explicitly changed.
The compact canvas readout links to full Telemetry, which retains the complete track-file
fields and distinguishes cursor, constant and full-path quantities. In Execute, arrival
and CPA appear under Planned path as Planned arrival and Planned CPA.

Engagement playback separates assignment, preparation, physical release and effect.
Launchers show PREP during the resolved engagement delay; kinetic rounds move only from
release to effect. Beam and EW channels draw without a traveling round. The effector
telemetry pane distinguishes assignment, release and effect marks and preparation/channel
spans. Exported events retain assignment accounting in `tS` and add `tReleaseS`; legacy
launch timing stays unavailable when the captured effector delay cannot resolve it.

Sensor tracks carry an estimated state. Each holding sensor runs its own constant-velocity
Kalman filter from the range and azimuth accuracy of its model, and the board draws the
estimated position with a 1 sigma error ellipse. The ellipse shrinks on a measurement and
grows while the track coasts. A coasting track dashes, a truth track carries no error and
draws its marker alone, a false track draws in a muted ink, and nothing draws past the
observation horizon. A C2 node fuses the sensor tracks that reach it after link latency;
the fused track sets the firm-track time and, on the estimate path, predicts the intercept
point. A sensor whose model states no accuracy reports the truth position instead.

Play prepares one sampled trial in its own worker slot, using nominal parameters,
aleatory draws and a frozen manifest, then starts playback when that trial is ready.
Execute surfaces share its retained ledger and observations. Replay keeps the run identity,
ledger, completion and achieved observation; New run clears them and redraws on the next Play.
Trial preparation and errors show their state without substituting forecast outcomes.

Forecast and Monte Carlo remain separate, explicitly labeled analyses with unchanged
numerical paths. Forecast uses the deterministic `engagementPicture`. It appears on no
analysis screen. It remains in the run export and the requirement record, and the
Outcome validity row falls back to forecast requirement validity when a trial captured
none. Run settings (mode, uncertainty, seed, replicates, stop rule, confidence, sampling,
sensitivity depth, Sobol base) live on the **Run** tab of Settings, each with its default and
a reset. One Run button with a Deterministic switch sits on Prepare and Analyze; a run uses
the worker pool and its progress line names the stop rule and the pool size, plus
"operator wait floored in N of M decisions" when a C2 decision draw fell below its median
(the Outcome record prints the trial's own count). The Systems tab prints a load notice
and a `seed v<N>` chip on each field a saved builtin adopted from the data package.
The **Physics** section of Settings exposes the nine declared fallback switches in
their canonical order. A checked box records a fallback in `Scenario.physics`;
**Reset physics** clears the list. These edits use the existing scenario action, so
they participate in undo, result invalidation and autosave. Every run and trial manifest
records the list and lowers its fidelity floor to `fallback` while the list is not empty.
All nine controls are active. Clearing the six Phase 3 fallbacks selects bounded target
flight, radar dwell integration, passive-RF link and bearing models, EO/IR DRI, physical
kinetic effects, and optical/HPM effects. The corresponding model tags and validation
status travel with the run record.
Where a forecast count still prints, it reads as an expected value with two decimals
below ten. No surface labels a forecast as a realized kill.

The right panel is a drawer. The drawer button at the right end of the top bar, or `]`,
closes and opens it, and the open state is saved. Objects, Details in Analysis and a
Prepare link reopen it; a selection does not.

The engagement timeline opens from the Engagement button at the right end of the playback
bar. The bar is 36 px high. The strip sits above the bar and pushes the canvas up, and its
open state is saved.

The right panel presents one [analysis screen](../src/panels/AnalysisPanel.tsx) per
question, each on one result basis. Prepare offers Fragility and Inputs. Execute offers
Now. Analyze offers Outcome and Compare. Prepare also offers Where to put it after Inputs.
The selected screen of Prepare and of Analyze is
session state in [App.tsx](../src/App.tsx), never saved; a Prepare link from a results
screen selects Inputs.

| Screen | Phase | Basis | Content |
| --- | --- | --- | --- |
| [Fragility](../src/panels/analysis/screens/FragilityScreen.tsx) | Prepare | Monte Carlo ensemble and sensitivity | Kills, Leakers and Min warning tiles with the band inside; a factor [sweep map](../src/charts/SweepMap.tsx) over one or two scenario factors; ranked sensitivity bars for a selected response; validity findings; Run Monte Carlo, Run sweep, Run sensitivity and Pin as baseline |
| Inputs | Prepare | Scenario | The existing [BoardPreparation](../src/panels/BoardPreparation.tsx) content |
| [Where to put it](../src/panels/analysis/screens/PlacementScreen.tsx) | Prepare | Optimize run over the current scenario | Objective, movable systems and budget; progress with the best evaluation so far; up to five candidate laydowns with intervals; Apply installs one as a new scenario named with the suffix `(placement N)` |
| [Now](../src/panels/analysis/screens/NowScreen.tsx) | Execute | Sampled trial at the cursor | Run line, kill-chain table, one inventory bar per effector, sensor rows, New run and Forecast and analysis |
| [Outcome](../src/panels/analysis/screens/OutcomeScreen.tsx) | Analyze | Completed trial | Six count tiles with their denominator, a sortable per-threat table, and Event ledger, Manifest and Validity rows that open the existing records in place, with export |
| [Compare](../src/panels/analysis/screens/CompareScreen.tsx) | Analyze | Ensemble with the trial marked, plus a pinned baseline; any two saved runs | [Band chart](../src/charts/BandChart.tsx), delta table with an inside/outside flag, findings that name a cause, a Baseline row with Pin and Clear, PNG export of the chart, and a saved-run comparison of two history records (means differenced, no interval on the difference) |

Before the first Play, Now, Outcome and Compare each show one line: `No trial yet. Press
Play in Execute to run one.` Trial outcomes are bounded by the lesser of the cursor and
observed horizon, capped by the retained result. Scrubbing and saved-frame navigation
never advance observation. Charts, engagement strips, WEZ impact badges, selected-object
details and the Now screen censor outcomes at that horizon, including tooltips and
accessibility text. Chart accessibility text identifies the shown horizon separately from
a forward preview playhead. Outcome and Compare wait for a completed trial; Compare also
needs an ensemble for the current run and offers Run Monte Carlo without one.

A sweep runs one ensemble per grid cell on the sensitivity worker slot, so a sweep and a
sensitivity run replace each other. A pinned baseline keeps the current laydown and its
finished ensemble under its own storage key; Compare draws its mean dashed and adds
Baseline and Current minus Baseline columns. The baseline never enters the scenario, the
undo history or a worker request.

Where to put it runs a placement optimizer on its own worker slot: a Gaussian process
with expected improvement over the movable positions inside the range polygon, each
evaluation a replicate run under common random numbers at one seed (defaults 60
evaluations of 40 replicates). Apply copies the scenario through the existing replace
action, so the candidate is a new scenario and the optimize result is cleared with the
other analyses on install. Calibrate, a button per field on the Systems tab, opens a
dialog that turns typed counts or times into a posterior (beta with the Jeffreys prior
for a proportion, normal-gamma for a time); Accept writes an ordinary override whose
reason records the prior, the observation and the posterior. The run history exports
every saved run as one SQLite file, one record as a JSON package that Import run reads
back, and per-threat, per-effector and sensitivity CSV tables; each tile opens its
lineage on demand.

Completed-run Evidence products in Outcome retain export, final-frame capture, reset and
full-run records without repeating the outcome tiles. Completed-run JSON adds a
separately typed `trial` result group with the captured scenario, frozen manifest,
ledger, observations, jam decisions and integer counts. It identifies one simulated
realization, carries no ensemble confidence interval, and discloses **Build revision
unavailable** when no revision was captured. Existing forecast and MC groups keep their
own basis and quantity semantics. Findings route to the matching Prepare section;
screen changes preserve the result basis.

| Activity | Implemented features | Source entry points |
| --- | --- | --- |
| Build a laydown | Model palette, system presets, placement, duplication, rotation, inspection, selection and undo/redo | [store](../src/state/store.ts), [Palette](../src/panels/Palette.tsx), [Inspector](../src/panels/Inspector.tsx) |
| Describe the range | Meter-scaled pan/zoom, boundaries, calibrated image underlay, geo reference, satellite basemap, layers, per-entity rings, declutter presets on the board tools bar, ring hover hints and one Settings dialog for scenario, run, systems and view inputs | [CanvasStage](../src/canvas/CanvasStage.tsx), [layers](../src/canvas/layers/), [SettingsPanel](../src/panels/SettingsPanel.tsx), [view state](../src/io/viewState.ts) |
| Represent an architecture | Sensor/C2/effector links, integration profiles, suggested pairings, typed routes and fire-control eligibility | [integration](../src/model/integration.ts), [killChain](../src/playback/killChain.ts) |
| Represent a threat | Paths, speed/delay/altitude, formations, raid waves and tactic-driven raid construction | [tracks](../src/playback/tracks.ts), [tactics](../src/playback/tactics.ts), [raidBuilder](../src/state/raidBuilder.ts) |
| Inspect assumptions | Editable library, field provenance, sourced/PF labels, parameter spreads, seed reset and library JSON; the Systems tab lists every field of every system in use with grade, layer, source and spread, and an edit there is an override with a reason, reset per field, per system or all | [LibraryEditor](../src/panels/LibraryEditor.tsx), [SystemsTab](../src/panels/settings/SystemsTab.tsx), [overrides](../src/state/overrides.ts), [types](../src/model/types.ts), [parameterBasis](../src/analysis/parameterBasis.ts) |
| Calibrate from counts | Calibrate per field on the Systems tab: a beta posterior with the Jeffreys prior for a proportion, a normal-gamma posterior for a time; Accept writes an override with the prior, observation and posterior in its reason | [calibrate](../src/analysis/calibrate.ts), [CalibrateDialog](../src/panels/settings/CalibrateDialog.tsx), [SystemsTab](../src/panels/settings/SystemsTab.tsx) |
| Trace a value | The library is a JSON data package, one file per model, with grade, layer, range type, condition, source and spread on every numeric field; every sensor carries range, azimuth and elevation accuracy and a radar false-alarm rate, every C2 model carries decision latency, its sigma and an operator track capacity; class priors are derived from the sourced entries | [data package](../data/library/), [libraryField](../src/model/libraryField.ts), [classPriors](../src/analysis/classPriors.ts) |
| Follow a track | Per-sensor Kalman track estimates with covariance ellipses on the board, track-to-track fusion at the C2 after link latency, confusion-matrix classification where a sensor states one, false tracks from the radar false-alarm rate and an operator decision queue at the C2 | [kalman](../src/playback/kalman.ts), [tracker](../src/playback/tracker.ts), [fusion](../src/playback/fusion.ts), [classification](../src/playback/classification.ts), [falseTracks](../src/playback/falseTracks.ts), [operator](../src/playback/operator.ts), [TrackLayer](../src/canvas/layers/TrackLayer.tsx) |
| Play a scenario | Sampled trial preparation, retained Replay, New run, speed, cursor and observation-bounded track/engagement display | [TimelineBar](../src/panels/TimelineBar.tsx), [trialSelectors](../src/state/trialSelectors.ts), [useTrialResult](../src/state/useTrialResult.ts), [trialTrackState](../src/playback/trialTrackState.ts), [trialSweepAt](../src/playback/trialSweepAt.ts), [frameClock](../src/canvas/frameClock.ts) |
| Watch a trial | Now screen: run line, kill chain at the cursor, effector inventory bars and sensor rows | [NowScreen](../src/panels/analysis/screens/NowScreen.tsx), [trialSweepAt](../src/playback/trialSweepAt.ts), [systemTelemetry](../src/analysis/systemTelemetry.ts) |
| Read a completed trial | Outcome screen: count tiles, per-threat table, event ledger, manifest, validity and export | [OutcomeScreen](../src/panels/analysis/screens/OutcomeScreen.tsx), [trialResult](../src/analysis/trialResult.ts), [DebriefRecord](../src/panels/analysis/DebriefRecord.tsx) |
| Compare against expectation | Compare screen: ensemble band with the trial marked, delta table, disagreement finding, a pinned baseline, chart PNG export and a comparison of any two saved runs | [CompareScreen](../src/panels/analysis/screens/CompareScreen.tsx), [BandChart](../src/charts/BandChart.tsx), [runValidity](../src/analysis/runValidity.ts), [baseline](../src/state/baseline.ts), [exportPng](../src/charts/exportPng.ts) |
| Find where to put it | Where to put it screen: objective, movable systems and budget; a GP with expected improvement over the range polygon, common random numbers, candidates with intervals; Apply installs one as a new scenario | [PlacementScreen](../src/panels/analysis/screens/PlacementScreen.tsx), [optimize loop](../src/playback/optimize/loop.ts), [gp](../src/playback/optimize/gp.ts), [polygon](../src/playback/optimize/polygon.ts), [optimize client](../src/playback/optimize/client.ts), [optimizeTypes](../src/playback/optimizeTypes.ts) |
| Find where a laydown fails | Fragility screen: Monte Carlo tiles, factor sweep map, Morris screening then Sobol first-order and total indices with bootstrap intervals under the full sensitivity depth (one-at-a-time under quick) and validity; run settings on the Run tab | [FragilityScreen](../src/panels/analysis/screens/FragilityScreen.tsx), [SweepMap](../src/charts/SweepMap.tsx), [SobolChart](../src/charts/SobolChart.tsx), [morris](../src/playback/morris.ts), [sobol](../src/playback/sobol.ts), [mcRun](../src/playback/mcRun.ts), [RunTab](../src/panels/settings/RunTab.tsx) |
| Run outside the browser | `npm run engine -- scenario.json --replicates N --seed S --out run.json` builds the headless engine bundle and spreads a fixed replicate count over worker threads; `--overrides overrides.json` applies a saved override set from the run's manifest; the run record equals the browser summary at one seed | [run-engine](../scripts/run-engine.mjs), [engine barrel](../src/engine/index.ts), [workerPool](../src/playback/workerPool.ts) |
| Retain work | Autosave, scenario/library/run JSON, saved Board frames and run logs; Save to history keeps a finished ensemble in IndexedDB with its manifest, and the history list opens any record in place with its lineage | [autosave lifecycle](../src/io/autosave.ts), [persist](../src/io/persist.ts), [runResultGroups](../src/io/runResultGroups.ts), [runStore](../src/io/runStore.ts), [RunHistory](../src/panels/analysis/RunHistory.tsx) |
| Export a record | One saved run as a JSON package (`rangeboardRunRecord: 1`) that Import run reads back; per-threat, per-effector and sensitivity CSV with units in the headers; every saved run as one SQLite file with runs, per_target, per_effector, sensitivity and sobol tables | [runRecordPackage](../src/io/runRecordPackage.ts), [exportCsv](../src/io/exportCsv.ts), [exportSqlite](../src/io/exportSqlite.ts), [RunHistory](../src/panels/analysis/RunHistory.tsx) |

Opening a saved Board frame scrubs to its time and restores its camera and basemap. It
never advances observation or stamps a run start or analysis basis.

The shared toolbar's Storage section shows estimated UTF-16 bytes per live and recovery key.
It retains startup recovery notices and lets the user download the exact unreadable copy or
explicitly delete one recovery key. Deletion does not resume a paused autosave. A new
underlay image has a 5 MiB admission budget. Existing valid saved payloads remain loadable.

The Board boundary isolates render failures. Its Export action reads the scenario, and
Reload reloads the page. The autosave subscription remains outside React and continues
when a view fails; it carries the scenario and the pinned baseline as two lanes.

## Execution and persistence

1. [main.tsx](../src/main.tsx) restores the Board autosave synchronously and starts the
   autosave subscription, one [autosave lifecycle](../src/io/autosave.ts) with a scenario
   adapter and a baseline adapter. [App.tsx](../src/App.tsx) manages the interaction
   chrome. The analysis panel, the command palette and the recharts plot load behind
   lazy boundaries.
2. Board actions create new scenario objects. Scenario identity also keys the deterministic
   [engagement picture](../src/analysis/impact.ts) cache. Detection/track assessment feeds
   engagement resolution; explicit forecasts consume those results.
3. Monte Carlo and sensitivity use separate worker slots; a factor sweep runs on the
   sensitivity slot, so it and a sensitivity run replace each other. Sampled Play
   preparation has a third slot and retains one nominal/aleatory ledger, sampled
   observations and frozen manifest. The placement optimizer has a fourth slot
   ([optimize client](../src/playback/optimize/client.ts)); its result is view state that
   a scenario install cancels and clears. Results require the current slot, request, run and
   analysis basis. Trial selectors and adapters supply the canvas, telemetry, charts and
   completed-run export from that retained result. Play waits for trial readiness,
   independently of MC and sensitivity. No trial is autosaved or archived in application
   storage.
4. Runtime validation precedes default filling and adoption. Recovery preserves unreadable
   saves and suppresses autosave when preservation fails. The pinned baseline has its own
   key, parser, validation and recovery prefix beside the scenario autosave.

There is no backend, authentication or multi-user synchronization. Storage is per browser
origin: another localhost port has another autosave. Export JSON before moving origins.
The optional satellite basemap fetches Esri tiles through [TileLayer](../src/canvas/layers/TileLayer.tsx)
and needs network access. There is no service-worker offline installation layer.

## Refactor navigation

Trace one behavior through input, transition, calculation, view/export and regression tests.
File size alone does not define a safe slice.

| Boundary | Read together | Evidence to preserve |
| --- | --- | --- |
| Board actions/history | `state/store.ts`, `scenarioInstall.ts`, `runState.ts`, `analysisBasis.ts`, `store*.test.ts` | Edits, undo/redo, load/reset, stale callbacks and cancellation |
| Sampled playback | `state/trialSelectors.ts`, `useTrialResult.ts`, `analysis/trialResult.ts`, `trialSeries.ts`, `playback/trialTrackState.ts`, `trialSweepAt.ts` | One retained draw, member identity, observation bounds and export agreement |
| Numerical engine | `playback/sim.ts`, `attrition.ts`, `mcRun.ts`, `policy.ts`, `analysis/` | Fixed IDs/seeds; deterministic, both MC modes and sensitivity parity |
| Tracks and kill chain | `playback/kalman.ts`, `tracker.ts`, `fusion.ts`, `classification.ts`, `falseTracks.ts`, `operator.ts`, `sweep.ts`, `sim.ts`, `attrition.ts` | Draw keys per kind; the truth path under `truthTracks`; the switched fixtures unchanged |
| Workers | [workerGraph.test.ts](../src/playback/workerGraph.test.ts), [workerSlot.test.ts](../src/playback/workerSlot.test.ts), `mcClient.ts`, `mc.worker.ts` | Isolated dependencies; real-worker completion/cancellation |
| Save shapes | `model/types.ts`, `io/` | Schema descriptors, legacy defaults, rejection and recovery |
| Rendering | `canvas/`, `panels/`, `charts/`, `ui/`, `index.css` | Clock horizons, tokens, panel width, chart rendering and overflow |

Paths in the last table are relative to `src/`. These are navigation boundaries, not
permission to refactor them together. Use the [workflow](WORKFLOW.md) for a selected slice.
