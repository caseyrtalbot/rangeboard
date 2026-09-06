# RangeBoard project guide

RangeBoard supports C-UAS test design and the evidence workflow around a test campaign.
The Board explores a modeled laydown; T&E Ops organizes controlled campaign records.
A model run can inform a test, but it does not automatically become an observed trial
or an approved requirement. No future refactor is selected by this guide.

Equations and implementation contracts live in the [engineering reference](ENGINEERING_REFERENCE.md).
This guide maps user activities to source; the [verification guide](VERIFICATION.md)
maps changes to checks.

## Board features

| Activity | Implemented features | Source entry points |
| --- | --- | --- |
| Build a laydown | Model palette, system presets, placement, duplication, rotation, inspection, selection and undo/redo | [store](../src/state/store.ts), [Palette](../src/panels/Palette.tsx), [Inspector](../src/panels/Inspector.tsx) |
| Describe the range | Meter-scaled pan/zoom, boundaries, calibrated image underlay, geo reference, satellite basemap, layers and per-entity rings | [CanvasStage](../src/canvas/CanvasStage.tsx), [layers](../src/canvas/layers/), [view state](../src/io/viewState.ts) |
| Represent an architecture | Sensor/C2/effector links, integration profiles, suggested pairings, typed routes and fire-control eligibility | [integration](../src/model/integration.ts), [killChain](../src/playback/killChain.ts) |
| Represent a threat | Paths, speed/delay/altitude, formations, raid waves and tactic-driven raid construction | [tracks](../src/playback/tracks.ts), [tactics](../src/playback/tactics.ts), [raidBuilder](../src/state/raidBuilder.ts) |
| Inspect assumptions | Editable library, field provenance, sourced/PF labels, parameter spreads, seed reset and library JSON | [LibraryEditor](../src/panels/LibraryEditor.tsx), [types](../src/model/types.ts), [parameterBasis](../src/analysis/parameterBasis.ts) |
| Play a scenario | Run identity, play/pause/reset, speed, cursor, observation horizon and derived track/engagement display | [TimelineBar](../src/panels/TimelineBar.tsx), [runState](../src/state/runState.ts), [frameClock](../src/canvas/frameClock.ts) |
| Analyze a configuration | Deterministic envelope, Monte Carlo, aleatory/total uncertainty, sensitivity, requirements, validity, timelines, event ledgers and analysis lenses | [AnalysisPanel](../src/panels/AnalysisPanel.tsx), [analysis UI](../src/panels/analysis/), [mcRun](../src/playback/mcRun.ts) |
| Retain work | Autosave, scenario/library/run JSON, saved Board frames, basic test cards and run logs | [persist](../src/io/persist.ts), [runResultGroups](../src/io/runResultGroups.ts), [TestCardsPanel](../src/panels/TestCardsPanel.tsx) |

Board test cards (`Scenario.testCards`) differ from controlled T&E cards
(`TeCampaign.cards`). Board saved frames and T&E captured image records also have
different purposes. Follow their types and import paths before changing either feature.

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

1. [main.tsx](../src/main.tsx) loads the Board autosave and starts both autosave paths.
   [App.tsx](../src/App.tsx) switches workspaces and manages common interaction chrome.
2. Board actions create new scenario objects. Scenario identity also keys the deterministic
   [engagement picture](../src/analysis/impact.ts) cache. Detection/track assessment feeds
   engagement resolution; live views and full-run projections consume those results.
3. Monte Carlo and sensitivity use separate worker slots. Results require the current
   slot, run and analysis basis. Cancellation and stale-result behavior are contracts.
4. Runtime validation precedes default filling and adoption. Recovery preserves unreadable
   saves and suppresses autosave when preservation fails.
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
| Board actions/history | `state/store.ts`, `runState.ts`, `analysisBasis.ts`, `store*.test.ts` | Edits, undo/redo, load/reset, stale callbacks and cancellation |
| Numerical engine | `playback/sim.ts`, `attrition.ts`, `mcRun.ts`, `policy.ts`, `analysis/` | Fixed IDs/seeds; deterministic, both MC modes and sensitivity parity |
| Workers | [workerGraph.test.ts](../src/playback/workerGraph.test.ts), `mcClient.ts`, `mc.worker.ts` | Isolated dependencies; real-worker completion/cancellation |
| Save shapes | `model/types.ts`, `te/model/types.ts`, `io/`, `te/io/` | Schema descriptors, legacy defaults, rejection and recovery |
| T&E lifecycle | `te/state/teStore.ts`, `te/validate.ts`, `te/calc/` | Freeze guards, admissible evidence, observations and traceability |
| Rendering | `canvas/`, `panels/`, `charts/`, `ui/`, `te/ui/`, `index.css` | Clock horizons, tokens, panel width, chart rendering and overflow |

Paths in the last table are relative to `src/`. These are navigation boundaries, not
permission to refactor them together. Use the [workflow](WORKFLOW.md) for a selected slice.
