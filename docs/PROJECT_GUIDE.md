# RangeBoard project guide

RangeBoard supports C-UAS test design. The Board explores a modeled laydown. A model run
can inform a test, but it does not automatically become an observed trial or an approved
requirement. No future refactor is selected by this guide.

Equations and implementation contracts live in the [engineering reference](ENGINEERING_REFERENCE.md).
This guide maps user activities to source; the [verification guide](VERIFICATION.md)
maps changes to checks.

## Board features

The Board shell provides Prepare, Execute and Analyze lifecycle views. The three tabs and
the run status sit in the header. There is no separate phase row. These are local
navigation choices stored only for the session: changing a view preserves the playback
cursor, observed horizon and analysis basis. Execute starts with engagement layers and
retains its own session-only layer override; Prepare and Analyze share the saved layers.
Prepare > Inputs holds five panel sections in
[BoardPreparation](../src/panels/BoardPreparation.tsx): Run, Environment, Fire control,
Requirements and Entities. Entities is a keyboard-accessible register, closed by default;
a row selects its entity and keeps the current tab.
The [analysis navigation](../src/panels/analysis/AnalysisNavigation.tsx) is the phase's
screen tabs inside the one right-panel tab row (Inputs, Fragility and Placement in
Prepare; Monitor in Execute; Outcome and Compare in Analyze). The row stays outside
the scrolling panel. A contextual tab with the selected object's name follows the screens
while something is selected. The model library editor opens in the Library drawer in place
of the model list, with a Back to library control; the `openLibrary` store action routes
Model basis, New model, the palette's model commands, Edit model specs and Place asset
there. The panel has no header: a Panel options menu with the field help switch, Collapse
all and Expand all ends the tab row. In Prepare and Analyze the
[Validity line](../src/panels/analysis/ValidityLine.tsx) under the tab row shows the
state, the finding count and, when opened, the findings with Place asset and Select
actions. The status-bar Validity button opens the drawer at the line. The `requestPanel`
store action opens the drawer at a phase, a screen and a section.

The Library resource opens a drawer with model/system placement, drag-and-drop, model-basis
editing, tactics and library import/export. `L` toggles it and Escape returns focus to its
button. Prepare groups run configuration, environment, doctrine and requirement inputs.
Prepare > Inputs is the one editor for Fire doctrine and Environment; Settings links to it.
The board editing tools and Range show only in Prepare. The one Run control sits in the
top bar: Run in Prepare, Pause or Resume in Execute, Run again in Analyze. After a delete or a place the
timeline shows the action and "Undo ⌘Z" for 4 s.
The canvas tool row separates View preferences (layer presets, theme, units, basemap and
layers) from Range (location, calibrated image, image movement and saved opacity). Existing
scenario actions govern changes and undo; automatic documented connections remain their
own undo step. Pending placement is cancelled by a competing tool or a change to the entity
or system-preset count. Escape closes an open dialog before it
cancels a placement. The calibrate tool shows a strip until Escape or Cancel ends it.
A UAS takes either a hand-drawn flight path or an ISR CAP. Draw ISR CAP in the context
menu or the Inspector arms the cap tool: the first click sets the orbit center and the
second sets the radius; a double click on the center takes 1 km. The orbit is stored as
`FlightPath.cap` (center, radius, laps, default 3) and its points are generated from it
(`src/model/cap.ts`), so the engine flies a plain path. The board draws the ingress leg,
the dashed circle and one caption (radius, laps, flight time); the Inspector Flight path
section edits Radius and Laps on blur or Enter, one undo step each.
The connect popup opens after a blue-force drop or from the Inspector Network section.
It lists every known integration of the system against the board: a partner with an
unlinked instance on the board reads ON BOARD with the distance to the nearest one and a
Connect button (also beyond the suggest radius); a fully linked partner reads LINKED, or
`LINKED · auto` when the drop wired it; a partner with no instance reads NOT ON BOARD with
a Place button that arms placement of that model. A requirement group with no member on
the board (`requiredC2`, or `fcSources` under fc-uplink guidance) prints one alert line
and marks its members REQUIRED · NOT ON BOARD. In-range shared-protocol partners join the
list from `suggestLinksFor`. Connect all links every in-range partner.

Effector rings show MIR (max intercept range), MRIR (max recommended intercept range, the
doctrinal range) and Min range, ground projected at the selected threat altitude. MRIR is
the recorded library value, else 2/3 of MIR as a planning factor; the Inspector Rings
section edits it as a fraction of MIR. MRIR is a board ring only; the engine does not read
it. A ring rests as a dashed outline and turns solid and filled while its system is
selected, or at the run time cursor while the effector engages or the sensor holds a track.
Hovering a ring shows its readout: system, ring, distance in nm, threat height and the
MRIR basis. A click on the ring pins the readout; Escape or a click on empty board clears it.

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
observation horizon. A hard-killed threat's sensor holds, track estimates and fused track
end at the kill, so a destroyed threat holds no track; a mission-killed airframe still
flies, so its track runs to the path end. The run timeline draws its ghost span from
a hard kill to the planned arrival. A threat pill reads `HARD KILL`, `MISSION KILL` or
`DEFEATED (MIXED)` once every member is removed. A threat killed after its arrival
leaked: it reads `LEAKED` with a `late kill T+m:ss` word, and FX reads only a
pre-arrival death. A C2 node fuses the sensor tracks that reach it after link latency;
the fused track sets the firm-track time and, on the estimate path, predicts the intercept
point. A sensor whose model states no accuracy reports the truth position instead.

Play prepares one sampled trial in its own worker slot, using nominal parameters,
aleatory draws and a frozen manifest, then starts playback when that trial is ready.
Execute surfaces share its retained ledger and observations. Replay keeps the run identity,
ledger, completion and achieved observation; New run clears them and redraws on the next Play.
Trial preparation and errors show their state without substituting forecast outcomes.

Forecast and Monte Carlo remain separate, explicitly labeled analyses with unchanged
numerical paths. Forecast uses the deterministic `engagementPicture`. It draws no outcome
on an analysis screen. It sets Met in the Requirements gate table on Prepare > Inputs and
Gates met on Outcome, it remains in the run export, and the Validity line in Analyze falls
back to the forecast assessment when a trial captured none. Run settings (mode, uncertainty, seed, replicates, stop rule, confidence, sampling,
sensitivity depth, Sobol base) live on the **Run** tab of Settings, each with its default and
a reset. One Run button sits in the top bar; Mode (Monte Carlo or Deterministic), Runs
and Seed sit in the Run section on Prepare > Inputs. A run uses
the worker pool and its progress line names the stop rule and the pool size. While the
pool is ending or its summary worker is in flight the button says Stopping. After
a cancelled run finishes, the progress line names the stop as "stopped by the user". A stop that
drops completed rows past a hole prints that count. The line also prints
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
closes and opens it, and the open state is saved. Entities, Details in Analysis and a
Prepare link reopen it; a selection does not.

The [run timeline](../src/panels/timeline/RunTimeline.tsx) replaces the engagement strip.
It opens from the Timeline button at the right end of the playback bar in Execute and
Analyze. The bar is 28 px high. The strip sits above the bar and pushes the canvas up. It
shows every platform's activity in one run on one time axis. Rows run by side then kind:
Sensors, C2, Tracks, Effectors and Threats. Each group starts collapsed to one summary
row. A sensor row expands to one sub-lane per held track. Any row hides for the session
with its × control. Nothing draws past the observed horizon. The strip draws the model
from [runTimeline.ts](../src/analysis/runTimeline.ts) and loads in its own lazy chunk. A
resizer above the strip sets its height from 120 px to 60 percent of the window. The open
state and the height are saved.

A click on a row label selects that entity on the board; a track row and a sensor's
sub-lane select their threat, and a false track selects nothing. A board selection highlights every line that draws
the entity and scrolls the entity's own row into view, or the summary or fold line that
holds it. A click on a mark seeks the playhead to the mark time and turns Follow off.
Hovering an item shows a tooltip with its exact times and values and the horizon; Escape
closes it and keeps the board selection. A Ctrl or Meta wheel, or a pinch, zooms about
the time under the cursor. With Follow on, Follow sets the window start from the clock
again, so the cursor anchor holds only with Follow off. A horizontal wheel pans and
turns Follow off, and a vertical wheel scrolls the rows. The overview marks the cursor
time on the whole run. Dragging the overview moves the window and turns Follow off. The header holds Follow, Zoom out, the window readout, Zoom
in, Fit, Collapse all and Expand all. Play turns Follow on. No strip interaction
advances observation: a seek stops playback, moves the cursor and turns Follow off, and
never advances observation. The strip is one labelled group whose name carries the
horizon, `Shown through T+m:ss`, with `Complete` once the whole run shows; the header
then reads `Complete · T+m:ss` and draws a legend of the span and mark kinds. Expand all
stays in force for the session, so a sensor row opens when it gains its first track,
until Collapse all or a single row toggle.

The right panel presents one [analysis screen](../src/panels/AnalysisPanel.tsx) per
question, each on one result basis. Prepare offers Fragility and Inputs. Execute offers
Monitor. Analyze offers Outcome and Compare. Prepare also offers Placement after Inputs.
The selected screen of Prepare and of Analyze is
session state in [App.tsx](../src/App.tsx), never saved; a Prepare link from a results
screen selects Inputs.

| Screen | Phase | Basis | Content |
| --- | --- | --- | --- |
| [Fragility](../src/panels/analysis/screens/FragilityScreen.tsx) | Prepare | Monte Carlo ensemble and sensitivity | One Measure select (a measure that needs a defended asset is disabled without one and falls back to Kills); an Ensemble table of five quantities with the mean and the 95 % interval on the mean, and Pin; a factor [sweep map](../src/charts/SweepMap.tsx) over one or two scenario factors with value chips; sensitivity rows for the measure, top five and Show all; Run sweep and Run sensitivity. The top-bar Run runs the ensemble |
| Inputs | Prepare | Scenario | Run, Environment, Fire control, Requirements (the gate table) and Entities in [BoardPreparation](../src/panels/BoardPreparation.tsx) |
| [Placement](../src/panels/analysis/screens/PlacementScreen.tsx) | Prepare | Optimize run over the current scenario | Objective, movable systems and budget; progress with the best evaluation so far; up to five candidate laydowns with intervals; Preview draws one candidate on the board; Apply installs one as a new scenario named with the suffix `(placement N)` |
| [Monitor](../src/panels/analysis/screens/NowScreen.tsx) | Execute | Sampled trial at the cursor | A kill-chain funnel of six counts (DET, ID, TGT, ENG, DEF, LEAK); Tracks with chain pips, the state, Held by and time to arrival; one Systems list grouped Sensors, C2 and Effectors; the last five salvo and identification events |
| [Outcome](../src/panels/analysis/screens/OutcomeScreen.tsx) | Analyze | Completed trial | A provenance line with Save run and an Export menu; a result bar with one segment per member; First detect, First effect, Salvos and Gates met; Tracks as strips or a sortable table; Event ledger, Systems at end of run and Manifest records that open in place |
| [Compare](../src/panels/analysis/screens/CompareScreen.tsx) | Analyze | Ensemble with the trial marked, plus a pinned baseline; any two saved runs | [Band chart](../src/charts/BandChart.tsx), interval rows with an inside/outside flag, a Baseline row with Pin current and Clear, PNG export of the chart, and a saved-run table with A and B picks, row menus and the A − B table (means differenced, no interval on the difference) |

Before the first Play, Monitor, Outcome and Compare each show one line: `No trial yet.
Press Play in Execute to run one.` on Outcome and Compare, and `No trial yet. Press Play to
run one.` with a Play button on Monitor. Trial outcomes are bounded by the lesser of the cursor and
observed horizon, capped by the retained result. Scrubbing and saved-frame navigation
never advance observation. Charts, the run timeline, WEZ impact badges, selected-object
details and the Monitor screen censor outcomes at that horizon, including tooltips and
accessibility text. Chart accessibility text identifies the shown horizon separately from
a forward preview playhead. Outcome and Compare wait for a completed trial; Compare also
needs an ensemble for the current run; the top bar's Run again starts one.

A sweep runs one ensemble per grid cell on the sensitivity worker slot, so a sweep and a
sensitivity run replace each other. A pinned baseline keeps the current laydown and its
finished ensemble under its own storage key; Compare draws its mean dashed and a
baseline tick on each interval row. The baseline never enters the scenario, the
undo history or a worker request. Under the full depth, the Fragility status line names
the Sobol row count, base times (kept fields + 2), as soon as Morris finishes, and warns
when that count can use most of the 10 minute worker budget. The Sobol stage follows
Morris unless the screening was cancelled or kept no field; a cancel during Morris ends
the run done on the trajectories completed.

Placement runs a placement optimizer on its own worker slot: a Gaussian process
with expected improvement over the movable positions inside the range polygon, each
evaluation a replicate run under common random numbers at one seed (defaults 60
evaluations of 40 replicates). A range boundary with fewer than three vertices cannot
bound the run; the screen leaves it out of the choice and prints how many it skipped,
and the store starts no placement run on one. A range whose points lie on one line, or
enclose under 1 m² or under 4e-3 of their bounding box, is refused at launch with that
reason, and no worker starts. Apply copies the scenario through the existing replace
action, so the candidate is a new scenario and the optimize result is cleared with the
other analyses on install. Preview on a candidate row draws that laydown on the board: a
hollow friend frame in the tool ink at each candidate position, a dashed leader from the
current position (none under 0.5 m) and the short name. It writes nothing to an entity
and never enters the undo history. One candidate shows at a time; Preview on the shown
row hides it. The preview draws only while the result still matches the board (the same
run, the same analysis basis, the same result), and it clears on Escape, on a phase
change and on any scenario replace, Apply included. Calibrate, a button per field on the Systems tab, opens a
dialog that turns typed counts or times into a posterior (beta with the Jeffreys prior
for a proportion, normal-gamma for a time); Accept writes an ordinary override whose
reason records the prior, the observation and the posterior. Saved runs on Compare
export every saved run as one SQLite file; a row menu exports one record as a JSON
package that Import run reads back, and the per-threat, per-effector and sensitivity CSV
tables. Open shows the record in place, with its lineage on demand. Delete takes two
presses: the first turns the item into Confirm delete and keeps the menu open.

The Outcome Export menu holds the debrief record (JSON), the final board frame (PNG) and
the per-threat and per-effector tables (CSV); the CSV items need a finished ensemble for
the current basis and state the reason while disabled. Completed-run JSON adds a
separately typed `trial` result group with the captured scenario, frozen manifest,
ledger, observations, jam decisions and integer counts. It identifies one simulated
realization, carries no ensemble confidence interval, and discloses **Build revision
unavailable** when no revision was captured. Existing forecast and MC groups keep their
own basis and quantity semantics. Gates met on Outcome opens Prepare > Inputs at
Requirements; screen changes preserve the result basis.

| Activity | Implemented features | Source entry points |
| --- | --- | --- |
| Build a laydown | Model palette, system presets, placement, duplication, rotation, inspection, selection and undo/redo | [store](../src/state/store.ts), [Palette](../src/panels/Palette.tsx), [Inspector](../src/panels/Inspector.tsx) |
| Describe the range | Meter-scaled pan/zoom, boundaries, calibrated image underlay, geo reference, satellite basemap, layers, per-entity rings (MIR, MRIR and Min range on effectors), layer presets in the View menu, a ring readout on hover or click and one Settings dialog for scenario, run, systems and view inputs | [CanvasStage](../src/canvas/CanvasStage.tsx), [layers](../src/canvas/layers/), [SettingsPanel](../src/panels/SettingsPanel.tsx), [view state](../src/io/viewState.ts) |
| Represent an architecture | Sensor/C2/effector links, integration profiles, suggested pairings, typed routes and fire-control eligibility | [integration](../src/model/integration.ts), [killChain](../src/playback/killChain.ts) |
| Represent a threat | Paths, ISR CAP orbits, speed/delay/altitude, formations, raid waves and tactic-driven raid construction | [tracks](../src/playback/tracks.ts), [cap](../src/model/cap.ts), [tactics](../src/playback/tactics.ts), [raidBuilder](../src/state/raidBuilder.ts) |
| Inspect assumptions | Editable library, field provenance, sourced/PF labels, parameter spreads, seed reset and library JSON; the Systems tab lists every field of every system in use with grade, layer, source and spread, and an edit there is an override with a reason, reset per field, per system or all | [LibraryEditor](../src/panels/LibraryEditor.tsx), [SystemsTab](../src/panels/settings/SystemsTab.tsx), [overrides](../src/state/overrides.ts), [types](../src/model/types.ts), [parameterBasis](../src/analysis/parameterBasis.ts) |
| Calibrate from counts | Calibrate per field on the Systems tab: a beta posterior with the Jeffreys prior for a proportion, a normal-gamma posterior for a time; Accept writes an override with the prior, observation and posterior in its reason | [calibrate](../src/analysis/calibrate.ts), [CalibrateDialog](../src/panels/settings/CalibrateDialog.tsx), [SystemsTab](../src/panels/settings/SystemsTab.tsx) |
| Trace a value | The library is a JSON data package, one file per model, with grade, layer, range type, condition, source and spread on every numeric field; every sensor carries range, azimuth and elevation accuracy and a radar false-alarm rate, every C2 model carries decision latency, its sigma and an operator track capacity; class priors are derived from the sourced entries | [data package](../data/library/), [libraryField](../src/model/libraryField.ts), [classPriors](../src/analysis/classPriors.ts) |
| Follow a track | Per-sensor Kalman track estimates with covariance ellipses on the board, track-to-track fusion at the C2 after link latency, confusion-matrix classification where a sensor states one, false tracks from the radar false-alarm rate and an operator decision queue at the C2 | [kalman](../src/playback/kalman.ts), [tracker](../src/playback/tracker.ts), [fusion](../src/playback/fusion.ts), [classification](../src/playback/classification.ts), [falseTracks](../src/playback/falseTracks.ts), [operator](../src/playback/operator.ts), [TrackLayer](../src/canvas/layers/TrackLayer.tsx) |
| Play a scenario | Sampled trial preparation, retained Replay, New run, speed, cursor and observation-bounded track/engagement display | [TimelineBar](../src/panels/TimelineBar.tsx), [trialSelectors](../src/state/trialSelectors.ts), [useTrialResult](../src/state/useTrialResult.ts), [retainTrial](../src/playback/retainTrial.ts), [trialTrackState](../src/playback/trialTrackState.ts), [trialSweepAt](../src/playback/trialSweepAt.ts), [frameClock](../src/canvas/frameClock.ts) |
| Watch a trial | Monitor screen: kill-chain funnel and track rows at the cursor, one Systems list with C2, and recent events | [NowScreen](../src/panels/analysis/screens/NowScreen.tsx), [trialSweepAt](../src/playback/trialSweepAt.ts), [systemTelemetry](../src/analysis/systemTelemetry.ts) |
| Read a completed trial | Outcome screen: provenance line, result bar, track strips or table, event ledger, systems at end of run, manifest and the Export menu | [OutcomeScreen](../src/panels/analysis/screens/OutcomeScreen.tsx), [trialResult](../src/analysis/trialResult.ts), [DebriefRecord](../src/panels/analysis/DebriefRecord.tsx) |
| Compare against expectation | Compare screen: ensemble band with the trial marked, interval rows, a pinned baseline, chart PNG export and a comparison of any two saved runs | [CompareScreen](../src/panels/analysis/screens/CompareScreen.tsx), [BandChart](../src/charts/BandChart.tsx), [baseline](../src/state/baseline.ts), [exportPng](../src/charts/exportPng.ts) |
| Find where to put it | Placement screen: objective, movable systems and budget; a GP with expected improvement over the range polygon, common random numbers, candidates with intervals; Apply installs one as a new scenario | [PlacementScreen](../src/panels/analysis/screens/PlacementScreen.tsx), [optimize loop](../src/playback/optimize/loop.ts), [gp](../src/playback/optimize/gp.ts), [polygon](../src/playback/optimize/polygon.ts), [optimize client](../src/playback/optimize/client.ts), [optimizeTypes](../src/playback/optimizeTypes.ts) |
| Find where a laydown fails | Fragility screen: the Ensemble table, factor sweep map, Morris screening then Sobol first-order and total indices with bootstrap intervals under the full sensitivity depth (one-at-a-time under quick); run settings on the Run tab | [FragilityScreen](../src/panels/analysis/screens/FragilityScreen.tsx), [SweepMap](../src/charts/SweepMap.tsx), [SobolChart](../src/charts/SobolChart.tsx), [morris](../src/playback/morris.ts), [sobol](../src/playback/sobol.ts), [mcRun](../src/playback/mcRun.ts), [RunTab](../src/panels/settings/RunTab.tsx) |
| Run outside the browser | `npm run engine -- scenario.json --replicates N --seed S --out run.json` builds the headless engine bundle and spreads a fixed replicate count over worker threads; `--overrides overrides.json` applies a saved override set from the run's manifest; the run record equals the browser summary at one seed | [run-engine](../scripts/run-engine.mjs), [engine barrel](../src/engine/index.ts), [workerPool](../src/playback/workerPool.ts) |
| Retain work | Autosave, scenario/library/run JSON, saved Board frames and run logs; Save run on Outcome and Save current on Compare keep a finished ensemble in IndexedDB with its manifest, and the saved-run table opens any record in place with its lineage | [autosave lifecycle](../src/io/autosave.ts), [persist](../src/io/persist.ts), [runResultGroups](../src/io/runResultGroups.ts), [runStore](../src/io/runStore.ts), [RunHistory](../src/panels/analysis/RunHistory.tsx) |
| Export a record | One saved run as a JSON package (`rangeboardRunRecord: 1`) that Import run reads back; per-threat, per-effector and sensitivity CSV with units in the headers; every saved run as one SQLite file with runs, per_target, per_effector, sensitivity and sobol tables | [runRecordPackage](../src/io/runRecordPackage.ts), [exportCsv](../src/io/exportCsv.ts), [exportSqlite](../src/io/exportSqlite.ts), [RunHistory](../src/panels/analysis/RunHistory.tsx) |

Opening a saved Board frame scrubs to its time and restores its camera and basemap. It
never advances observation or stamps a run start or analysis basis.

The Storage item of the top bar's ⋯ menu shows estimated UTF-16 bytes per live and recovery key.
It retains startup recovery notices and lets the user download the exact unreadable copy or
explicitly delete one recovery key. Deletion does not resume a paused autosave. A new
underlay image has a 5 MiB admission budget. Existing valid saved payloads remain loadable.

The Board boundary isolates render failures. Try again renders the board again without a
reload, its Export action reads the scenario, and Reload reloads the page. A failure inside
the canvas layers shows a notice with Retry beside the canvas and leaves the panels usable.
The override subscriber has its own boundary beside the board: a throw from that
subscriber is shown there, the shell stays mounted while the alert is up, and the
board stays mounted. The autosave subscription remains
outside React and continues when a view fails; it carries the scenario and the pinned
baseline as two lanes. The overrides autosave stays outside the override boundary.

## Execution and persistence

1. [main.tsx](../src/main.tsx) restores the Board autosave and the overrides
   synchronously, then starts both subscriptions: one
   [autosave lifecycle](../src/io/autosave.ts) with a scenario adapter and a baseline
   adapter, and the overrides autosave. It mounts the override-subscriber boundary beside
   [App.tsx](../src/App.tsx), which manages the interaction chrome. The analysis panel,
   the command palette, the undo cue, the canvas context menu and the recharts plot load
   behind lazy boundaries.
2. Board actions create new scenario objects. Scenario identity also keys the deterministic
   [engagement picture](../src/analysis/impact.ts) cache. Detection/track assessment feeds
   engagement resolution; explicit forecasts consume those results.
3. Monte Carlo runs on the worker pool and sensitivity on its own worker slot; a factor sweep runs on the
   sensitivity slot, so it and a sensitivity run replace each other. Sampled Play
   preparation has a second slot and retains one nominal/aleatory ledger, compact sampled
   observations and the estimate fields the board reads, plus a frozen manifest. The placement optimizer has a third slot
   ([optimize client](../src/playback/optimize/client.ts)); its result is view state that
   a scenario install cancels and clears. Results require the current slot, request, run and
   analysis basis. Trial selectors and adapters supply the canvas, telemetry, charts and
   completed-run export from that retained result. Play waits for trial readiness,
   independently of MC and sensitivity. No trial is autosaved or archived in application
   storage.
4. Runtime validation precedes default filling and adoption. Recovery preserves unreadable
   saves and pauses that lane when the copy cannot be verified. The next edit retries the
   copy and resumes the lane once the copy verifies; a later load of the same bytes reuses
   the rescue key. The pinned baseline and the library overrides each have their own key,
   parser and recovery prefix beside the scenario autosave. A failed baseline or overrides
   write is retried on the next Board change. A pause fills an empty save status and leaves
   another lane's error in place.

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
