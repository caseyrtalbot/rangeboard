# RangeBoard project guide

RangeBoard supports C-UAS test design and the evidence workflow around a test campaign.
The Board explores a modeled laydown; T&E Ops organizes controlled campaign records.
A model run can inform a test, but it does not automatically become an observed trial
or an approved requirement. No future refactor is selected by this guide.

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
Setup findings that cost a measurement appear first, with a Select button for a threat
that starts inside detection coverage; model caveats stay inside the disclosure.
The [analysis navigation](../src/panels/analysis/AnalysisNavigation.tsx) is one segmented
control of the current phase's screens. It stays outside the scrolling panel, including
while an object is selected. Test cards, selected-object configuration and the model
library remain available in the panel tabs.

The Library resource opens a drawer with model/system placement, drag-and-drop, model-basis
editing, tactics and library import/export. `L` toggles it and Escape returns focus to its
button. Prepare groups run configuration, environment, doctrine and requirement inputs.
The canvas toolbar separates View preferences (theme, layers, units and basemap) from
Range setup (location, calibrated image, image movement and saved opacity). Existing
scenario actions govern changes and undo; automatic documented connections remain their
own undo step. Pending placement is cancelled by a competing tool, a change to the entity
or system-preset count, or a workspace change. Escape closes an open dialog before it
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

Play prepares one sampled trial in its own worker slot, using nominal parameters,
aleatory draws and a frozen manifest, then starts playback when that trial is ready.
Execute surfaces share its retained ledger and observations. Replay keeps the run identity,
ledger, completion and achieved observation; New run clears them and redraws on the next Play.
Trial preparation and errors show their state without substituting forecast outcomes.

Forecast and Monte Carlo remain separate, explicitly labeled analyses with unchanged
numerical paths. Forecast uses the deterministic `engagementPicture`. It appears on no
analysis screen. It remains in the run export and the requirement record, and the
Outcome validity row falls back to forecast requirement validity when a trial captured
none. Forecast/MC settings live under **Forecast and analysis** in Prepare and Settings.
Where a forecast count still prints, as in the test-card headline, it reads as an
expected value with two decimals below ten. No surface labels a forecast as a realized
kill.

The right panel presents one [analysis screen](../src/panels/AnalysisPanel.tsx) per
question, each on one result basis. Prepare offers Fragility and Inputs. Execute offers
Now. Analyze offers Outcome and Compare. The selected screen of Prepare and of Analyze is
session state in [App.tsx](../src/App.tsx), never saved; a Prepare link from a results
screen selects Inputs.

| Screen | Phase | Basis | Content |
| --- | --- | --- | --- |
| [Fragility](../src/panels/analysis/screens/FragilityScreen.tsx) | Prepare | Monte Carlo ensemble and sensitivity | Kills, Leakers and Min warning tiles with the band inside; a factor [sweep map](../src/charts/SweepMap.tsx) over one or two scenario factors; ranked sensitivity bars for a selected response; validity findings; Run Monte Carlo, Run sweep, Run sensitivity and Pin as baseline |
| Inputs | Prepare | Scenario | The existing [BoardPreparation](../src/panels/BoardPreparation.tsx) content |
| [Now](../src/panels/analysis/screens/NowScreen.tsx) | Execute | Sampled trial at the cursor | Run line, kill-chain table, one inventory bar per effector, sensor rows, New run and Forecast and analysis |
| [Outcome](../src/panels/analysis/screens/OutcomeScreen.tsx) | Analyze | Completed trial | Six count tiles with their denominator, a sortable per-threat table, and Event ledger, Manifest and Validity rows that open the existing records in place, with export |
| [Compare](../src/panels/analysis/screens/CompareScreen.tsx) | Analyze | Ensemble with the trial marked, plus a pinned baseline | [Band chart](../src/charts/BandChart.tsx), delta table with an inside/outside flag, findings that name a cause, and a Baseline row with Pin and Clear |

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
| Describe the range | Meter-scaled pan/zoom, boundaries, calibrated image underlay, geo reference, satellite basemap, layers, per-entity rings, declutter presets on the board tools bar, ring hover hints and one Settings dialog for scenario, run and view inputs | [CanvasStage](../src/canvas/CanvasStage.tsx), [layers](../src/canvas/layers/), [SettingsPanel](../src/panels/SettingsPanel.tsx), [view state](../src/io/viewState.ts) |
| Represent an architecture | Sensor/C2/effector links, integration profiles, suggested pairings, typed routes and fire-control eligibility | [integration](../src/model/integration.ts), [killChain](../src/playback/killChain.ts) |
| Represent a threat | Paths, speed/delay/altitude, formations, raid waves and tactic-driven raid construction | [tracks](../src/playback/tracks.ts), [tactics](../src/playback/tactics.ts), [raidBuilder](../src/state/raidBuilder.ts) |
| Inspect assumptions | Editable library, field provenance, sourced/PF labels, parameter spreads, seed reset and library JSON | [LibraryEditor](../src/panels/LibraryEditor.tsx), [types](../src/model/types.ts), [parameterBasis](../src/analysis/parameterBasis.ts) |
| Play a scenario | Sampled trial preparation, retained Replay, New run, speed, cursor and observation-bounded track/engagement display | [TimelineBar](../src/panels/TimelineBar.tsx), [trialSelectors](../src/state/trialSelectors.ts), [useTrialResult](../src/state/useTrialResult.ts), [trialTrackState](../src/playback/trialTrackState.ts), [trialSweepAt](../src/playback/trialSweepAt.ts), [frameClock](../src/canvas/frameClock.ts) |
| Watch a trial | Now screen: run line, kill chain at the cursor, effector inventory bars and sensor rows | [NowScreen](../src/panels/analysis/screens/NowScreen.tsx), [trialSweepAt](../src/playback/trialSweepAt.ts), [systemTelemetry](../src/analysis/systemTelemetry.ts) |
| Read a completed trial | Outcome screen: count tiles, per-threat table, event ledger, manifest, validity and export | [OutcomeScreen](../src/panels/analysis/screens/OutcomeScreen.tsx), [trialResult](../src/analysis/trialResult.ts), [DebriefRecord](../src/panels/analysis/DebriefRecord.tsx) |
| Compare against expectation | Compare screen: ensemble band with the trial marked, delta table, disagreement finding and a pinned baseline | [CompareScreen](../src/panels/analysis/screens/CompareScreen.tsx), [BandChart](../src/charts/BandChart.tsx), [runValidity](../src/analysis/runValidity.ts), [baseline](../src/state/baseline.ts) |
| Find where a laydown fails | Fragility screen: Monte Carlo tiles, factor sweep map, ranked multi-response sensitivity and validity; aleatory/total uncertainty and run settings under Forecast and analysis | [FragilityScreen](../src/panels/analysis/screens/FragilityScreen.tsx), [SweepMap](../src/charts/SweepMap.tsx), [sweepFactors](../src/playback/sweepFactors.ts), [mcRun](../src/playback/mcRun.ts), [ForecastSettings](../src/panels/analysis/ForecastSettings.tsx) |
| Retain work | Autosave, scenario/library/run JSON, saved Board frames, basic test cards and run logs | [autosave lifecycle](../src/io/autosave.ts), [persist](../src/io/persist.ts), [runResultGroups](../src/io/runResultGroups.ts), [TestCardsPanel](../src/panels/TestCardsPanel.tsx) |

Opening a saved Board frame scrubs to its time and restores its camera and basemap. It
never advances observation or stamps a run start or analysis basis.

Board test cards (`Scenario.testCards`) differ from controlled T&E cards
(`TeCampaign.cards`). Board saved frames and T&E captured image records also have
different purposes. Follow their types and import paths before changing either feature.

The shared toolbar's Storage section shows estimated UTF-16 bytes per live and recovery key.
It retains startup recovery notices and lets the user download the exact unreadable copy or
explicitly delete one recovery key. Deletion does not resume a paused autosave. New campaign
frames and Board config snapshots have a 5 MiB admission budget; refusals appear beside the
capture action. Existing valid saved payloads remain loadable.

The Board, T&E Ops and print boundaries isolate render failures. Their Export action
reads the owning scenario or campaign, and Reload reloads the page. Both autosave
subscriptions remain outside React and continue when a view fails; the Board subscription
carries the scenario and the pinned baseline as two lanes.

## T&E Ops features

The [workspace](../src/te/ui/OpsWorkspace.tsx) presents six phases plus Products.

| Phase | Records and behavior | Source |
| --- | --- | --- |
| Campaign | Decision/customer context, authorities, roles, claims/assumptions, questions, qualification and reusable campaign structure | [CampaignPanel](../src/te/ui/CampaignPanel.tsx), [CampaignGroups](../src/te/ui/CampaignGroups.tsx) |
| Design | Hypotheses, measures, approved thresholds, configurations, threats, conditions, factors, matrix, sampling and readiness | [DesignPanel](../src/te/ui/DesignPanel.tsx), [calculations](../src/te/calc/) |
| Cards | Templates, linked-record filling, draft/issue/revise lifecycle and frozen issued versions | [CardsPanel](../src/te/ui/CardsPanel.tsx), [store](../src/te/state/teStore.ts) |
| Execute | Runs from issued cards, events, observations, adjudication, amendments, exclusions, deviations, anomalies, checklists and go/no-go records | [ExecutePanel](../src/te/ui/ExecutePanel.tsx), [ExecuteBlocks](../src/te/ui/ExecuteBlocks.tsx) |
| Analyze | Inclusion by evidence purpose, measure statistics, findings and traceability | [AnalyzePanel](../src/te/ui/AnalyzePanel.tsx), [measures](../src/te/calc/measures.ts), [validation](../src/te/validate.ts) |
| Deliver | Debriefs, findings/actions, decision package, delivery freeze and closeout | [DeliverPanel](../src/te/ui/DeliverPanel.tsx), [DeliverBlocks](../src/te/ui/DeliverBlocks.tsx) |
| Products | Printable artifacts and CSV products | [ProductsPanel](../src/te/ui/ProductsPanel.tsx), [print](../src/te/print/), [CSV](../src/te/io/exportCsv.ts) |

The JIATF-401 demo is illustrative. Gates run in store actions as well as UI feedback.
T&E has no Board-style undo: issued cards and delivered evidence are protected, while
corrections preserve history. Read [transition tests](../src/te/state/transitions.test.ts)
before changing lifecycle behavior.

## Execution and persistence

1. [main.tsx](../src/main.tsx) restores the Board autosave synchronously, starts both
   autosave subscriptions and schedules the T&E restore on idle; the first switch to Ops
   runs that restore if idle has not. Both subscriptions are one
   [autosave lifecycle](../src/io/autosave.ts) with a Board adapter and a T&E adapter.
   [App.tsx](../src/App.tsx) switches workspaces and manages common interaction chrome. The Ops workspace, the analysis and test-card panels, the command
   palette and the recharts plot load behind lazy boundaries.
2. Board actions create new scenario objects. Scenario identity also keys the deterministic
   [engagement picture](../src/analysis/impact.ts) cache. Detection/track assessment feeds
   engagement resolution; explicit forecasts consume those results.
3. Monte Carlo and sensitivity use separate worker slots; a factor sweep runs on the
   sensitivity slot, so it and a sensitivity run replace each other. Sampled Play
   preparation has a third slot and retains one nominal/aleatory ledger, sampled
   observations and frozen manifest. Results require the current slot, request, run and
   analysis basis. Trial selectors and adapters supply the canvas, telemetry, charts and
   completed-run export from that retained result. Play waits for trial readiness,
   independently of MC and sensitivity. No trial is autosaved or archived in application
   storage.
4. Runtime validation precedes default filling and adoption. Recovery preserves unreadable
   saves and suppresses autosave when preservation fails. The pinned baseline has its own
   key, parser, validation and recovery prefix beside the scenario autosave.
5. T&E can retain Board snapshots and images. The Board engine's only T&E dependency is
   shared statistics; campaign state never belongs in the worker graph.

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
| Workers | [workerGraph.test.ts](../src/playback/workerGraph.test.ts), [workerSlot.test.ts](../src/playback/workerSlot.test.ts), `mcClient.ts`, `mc.worker.ts` | Isolated dependencies; real-worker completion/cancellation |
| Save shapes | `model/types.ts`, `te/model/types.ts`, `io/`, `te/io/` | Schema descriptors, legacy defaults, rejection and recovery |
| T&E lifecycle | `te/state/teStore.ts`, `te/validate.ts`, `te/calc/` | Freeze guards, admissible evidence, observations and traceability |
| Rendering | `canvas/`, `panels/`, `charts/`, `ui/`, `te/ui/`, `index.css` | Clock horizons, tokens, panel width, chart rendering and overflow |

Paths in the last table are relative to `src/`. These are navigation boundaries, not
permission to refactor them together. Use the [workflow](WORKFLOW.md) for a selected slice.
