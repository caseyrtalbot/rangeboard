# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RangeBoard: a local-first web "battlespace whiteboard" for Counter-UAS test-and-evaluation planning. Infinite meter-scaled canvas with sensor footprints, kill-chain links, threat flight paths, test cards, timeline playback, and engagement analysis. Single user, no backend.

## Commands

```
npm run dev              # Vite dev server (picks next port if busy)
npm run test             # vitest run (all tests)
npx vitest run src/geometry   # one test file/dir
npm run build            # tsc -b && vite build (type-check + bundle)
npm run lint             # oxlint
```

Deliberately NOT tldraw (license + document-model friction). Stack: React 19, react-konva, zustand, vitest. Playwright is a devDependency for scripted browser verification only.

## Core invariants (breaking these breaks the app)

- **World frame:** meters. +x east, **+y south** (screen-down). Heading 0 = north (up), clockwise degrees. All conversions live in `src/geometry/geo.ts` (pure, fully unit-tested). North on screen is negative y: `bearingDeg({0,0},{0,-100}) === 0`.
- **Camera:** `{x, y, scale}` = Konva Stage pixel offset + **pixels per meter**. World→screen: `sx = wx*scale + x`. Konva layer children are positioned in meters; the Stage transform does the scaling.
- **Single source of truth:** the `Scenario` object in `src/state/store.ts` (zustand). The Konva tree is a pure view of it. Never store derived state (positions at time t, detections) back into the scenario.
- **Playback is derived:** entity position at sim time = `posAtTime(path, speed, delay, t)` computed in `src/playback/sim.ts` from the base scenario. `playback.simTimeS` is the only mutable playback state.
- **Undo model:** `mutate(fn)` inside the store pushes a full scenario snapshot to `past` (cap 100) and clears `future`. Only scenario changes are undoable; camera/selection/ui are not. Any new scenario-touching action must go through `mutate`, not `set`.
- **Schema:** `Scenario.schemaVersion = 1`. Autosave key `rangeboard.scenario.v1` in localStorage; loader spreads over `emptyScenario()` to fill new fields. If you add a scenario field, add a default in `emptyScenario()` and the round-trip stays valid — bump the version only for breaking shape changes.

## Architecture map

```
src/model/     types.ts (all domain types + newId), seed.ts (seed spec library, emptyScenario)
src/geometry/  geo.ts pure math: bearings, wedges, path interpolation, grid steps, formatters
src/state/     store.ts: one zustand store (scenario + history + selection + camera + ui + playback)
src/playback/  sim.ts: liveTracks / detectionsAt (render-time), assessThreat (0.5 s sampling sweep)
               trackState.ts: track phase, shots in flight, effector state at sim time t
src/canvas/    CanvasStage.tsx (stage, pan/zoom, tool click routing, HTML5 drop target)
               TrackFileReadout.tsx (DOM telemetry card for the one selected track)
               layers/: Underlay, Grid, Boundary, Footprint, Path, Connection, Engagement,
                        Entity, Hud(DOM)
src/panels/    Toolbar, ViewMenu (layer/basemap/units dropdown), Palette (drag source),
               Inspector, LibraryEditor, TestCardsPanel,
               AnalysisPanel, TimelineBar (owns the rAF playback loop + frames strip)
src/io/        persist.ts: localStorage autosave, JSON export/import, library export/import,
               underlay image import
```

Data flow for a click/drag: Konva event → store action → new scenario → React re-render of layers. Drag-in-progress is Konva-native; the store is updated once on `dragend`.

## Konva conventions used everywhere

- Constant screen-size strokes: `strokeScaleEnabled={false}` (stroke width and dash are then in px).
- Constant screen-size icons/labels: wrap in a Group with `scale={1/camera.scale}`; inner units are px.
- Footprints and other large fills must be `listening={false}` or they swallow stage clicks.
- Hit tolerance for thin lines with `strokeScaleEnabled={false}`: `hitStrokeWidth={n}` (screen px — the hit stroke ignores the stage transform too; dividing by camera.scale inflates it to hundreds of px).
- Drawing tools do not use Konva drag: stage `draggable` only when `ui.tool === 'select'`; other tools consume plain clicks (`ui.draftPoints` holds the rubber-band draft).

## Domain semantics worth knowing

- `SpecModel` (library entry) vs `Entity` (canvas instance referencing `specId`). Entities survive model deletion (`specId → null`). Custom models: `builtin: false`; duplicate-and-edit supported.
- Kill chain = `Connection` list; `sim.killChainConnected` accepts sensor→C2→effector or direct sensor→effector.
- `assessThreat` statuses: `no-path | never-detected | not-confirmed | detect-only | no-kill-chain | window-too-short | weapons-hold | engageable`. Engagement windows are gated by `Scenario.roe` (`free` = first detection, `tight` default = hostile classification, `hold` = none); the derived classification ladder (`pending → unknown → suspected → hostile`) lives in `sim.ts`. Legacy `engageOn` saves migrate on load in `persist.ts` (`detected` → `free`, `confirmed` → `tight`). `not-confirmed` = tight ROE, never reached hostile.
- **Arrival vs closest approach** (two different questions, never merge them). ARRIVAL (`ThreatAssessment.arrivalS`) = the first sample the threat is inside an asset's `Entity.defendedRadiusM` (`DEFAULT_DEFENDED_RADIUS_M` 500 m when unset; set it in the Inspector). Null when the threat never crosses one, and null when no asset is placed. CLOSEST APPROACH (`cpaS` / `cpaDistanceM` / `cpaAssetId`) is pure geometry to the nearest asset and exists whenever any asset is placed, so a fly-by that turns away has a CPA and no arrival. Warning time (`warningS`) = arrival minus first detection, so it is null without an arrival. `assetId` / `closestApproachM` are the old names for the CPA pair, kept for older callers.
- **Raid partition** (`src/playback/attrition.ts`): every ship lands in exactly one bucket and `expectedKills + expectedLeakers + expectedNoArrival === raidSize`. `expectedKills` is PRE-ARRIVAL kill mass only (the defeat number). `expectedLateKills` is destruction whose effect landed after arrival: real, but too late to defend, so it is a sub-measure of the leaker mass and never a deduction from it. `expectedLeakers` counts only threats that actually crossed a boundary; `expectedNoArrival` takes fly-bys and every ship in an asset-free run. Display `totals.reportedLeakers` (null when no asset exists, render a dash), never `expectedLeakers`, which is a partition term.
- **Expenditure is three channels**, independent of the hard/soft kill channel (`isHardKill`): `shotsFired` = KINETIC (interceptor, gun, net), `deSalvos` = DIRECTED ENERGY (de, hpm), `jamSalvos` = EW (jammer). `expenditureChannel()` answers what a salvo SPENT; `isHardKill()` answers what it DESTROYS. DE and HPM are hard kills that fire no round, so they must never be counted as kinetic. `TrackFileState` mirrors the three as `kineticSalvos` / `deSalvos` / `jamSalvos`.
- **Route latency is charged from the ROE gate**, not from T0: an effector is a candidate for a threat only from `gateS +` that (effector, threat) kill-chain route latency, so a late gate still pays the full delay. Assignment-to-effect latency is separate: a salvo fired at `tS` lands at `tEffectS = tS + engageTimeS`, expenditure counts at `tS`, kill and jam mass count at `tEffectS`.
- **Run validity has one source of truth:** `src/analysis/runValidity.ts` (`assessRunValidity`). Findings are `invalidating` (the named gates cannot be scored for the named tracks; a result the run cannot support is neither a pass nor a fail) or `limiting` (scored, with a caveat). The requirement gates, the exported record, and the toolbar spawn-in-ring chip all derive from it, so they can never disagree. Derived live, never stored on the `Scenario`.
- **Requirement thresholds are test-defined, not engine constants:** `Scenario.requirements` (`RequirementThresholds`, defaults in `DEFAULT_REQUIREMENT_THRESHOLDS`) holds what the test asks the system to meet. Never set a gate threshold to an engine constant: the attrition model stops firing at `SHIP_DEAD_BELOW`, so a requirement at that value passes itself by construction.
- Sensor physics live in `src/analysis/sensorEnv.ts` (COURAGEOUS-based planning factors): rain/fog/night/urban-EM/wind derate ranges per `SensorType`; radar range scales with target `UasGroup` (rings show the Group 1 range); RF sensors only hear `rf-manual`/`mixed` nav modes; EO/IR only holds targets another technology already holds; jammers cannot affect `fiber`/`inertial`/`optical` threats. `SensorSpec.resolutionM` merges formations spaced below it into one track (`swarmMerged`).
- Threat tactics: `src/playback/tactics.ts` (THREAT_TACTICS, study-coded, platform pairings by seed designator). The raid builder arms a ui-only `raidDraft` and `commitRaid` creates entities + paths + waves in ONE `mutate()` (single undo); spawn standoff clears every enabled sensor ring measured from the sensor position.
- Threat WEZ + I&W: weapon fields on `UasSpec` (warheadKg, effectRadiusM, standoffRangeM, weaponProfile); `effectRadiusM` values are PLANNING FACTORS (`src/model/weaponFactors.ts`) — the threat study declines lethal radii, so label them PF in UI. `src/analysis/impact.ts` derives WEZ geometry (coincident impact circles merge with a count) and leaker severity; `engagementPicture` WeakMap-caches one sweep per scenario object. `ui.layers.threatWez` is a render toggle (View menu, right-click Display flyout, Analysis header, command palette).
- **Plan view only:** the engine holds no altitude and no slant range. `UasSpec.altBandFt`, `SensorSpec.elevationDeg`, `SensorSpec.maxAltitudeFt` and `EffectorSpec.maxAltitudeFt` are recorded spec data that nothing in `src/playback`, `src/analysis` or `src/geometry` reads. Keep the fields, but any UI that shows them marks them as recorded, not modeled (Inspector, LibraryEditor, TrackFileReadout).
- **Symbology contract** (one definition per fact, never a second hardcoded copy). MIL-STD-2525 split: the FRAME carries affiliation, an inner ICON carries function. `src/panels/Glyph.tsx` holds `FRAME_FOR` (friend rounded-top rectangle for sensor/effector/c2/asset, hostile diamond for uas, neutral square for marker), `FUNCTION_LETTER`, and `FRIEND_FRAME_D`; `EntityLayer` draws the same constants in Konva, so the palette, the library lists and the board agree by construction. `PHASE_STYLE` in `src/playback/trackState.ts` is the single source for track phase COLOR and LABEL (ghost reads DEFEATED), shared by the canvas ring, the board tag and the telemetry pill. Canvas entity labels draw `boardDesignator(entity.name)` from `src/canvas/labelLayout.ts`; anything stacked under a label measures with `labelLineCount` on that same drawn string.
- **Layer visibility:** `ui.layers` (`LayerVisibility`, 12 boolean keys). Actions are `setLayer`, `toggleLayer`, and `applyLayerPreset` (`full | planning | engagement | clean`, default `full`). This is view state. The setters write it to `rangeboard.layers.v1`, `savedLayers()` spreads the stored value over the defaults on load, undo never touches it, and it never enters the `Scenario`. Each Konva layer reads its own flag and returns `null`; `CanvasStage` does no gating.
- `src/analysis/mcda.ts` scores a configuration 0-100 from `Scenario.mcdaWeights`; pinned results live in `Scenario.scorecards`. Card templates and the standard covariate checklist live in `src/model/seedCards.ts`.
- Basemap modes (`canvas | sat | airspace`) are render toggles only — never move data. Sat underlay scale is set by two-point calibration, which scales the image about point A.
- Test cards follow the Field Guide standard card; `linkedEntityIds` drive the cyan on-canvas highlight when a card is selected.

## T&E Operations module (src/te/)

- Second workspace ("T&E Ops" toggle in the toolbar): end-to-end C-UAS test campaigns from customer request to delivered evidence. Spec sources: `docs/te-plan.md` and the four MASTER-*.md files in `docs/te-compilation/`.
- **Separate store, no undo:** `src/te/state/teStore.ts` (zustand), persisted at `rangeboard.te.v1`. T&E records are versioned and append-only by doctrine (runs never renumber; issued cards freeze; changes create new versions), so undo does not apply. Never embed campaign data in `Scenario`.
- IDs follow `VLK-<code>-<type>-<seq>` (`src/te/model/ids.ts`); versions live on the record, not in the id. Cards use `id` (unique per version record) + `cardCode` (shared across versions).
- Gates live in `src/te/validate.ts` (pocket rules: no issued card no run, no validity status no analysis, no traceability no finding). `issueCard` enforces blockers in the store.
- Calc engine `src/te/calc/` is pure TS, fixture-tested from MASTER-CALCULATIONS.md. Measure labels suppress pass/fail unless `thresholdApproved`.
- Seeds `src/te/seed/`: measure dictionary, checklist templates, card templates, vignettes, question banks, and `buildJiatf401()` (demo campaign, `illustrative: true`).
- Print artifacts `src/te/print/` render into `PrintOverlay` (portals to body; `@media print` hides `.app`); CSV exports in `src/te/io/exportCsv.ts`. The Products phase tab is the deliverables hub.
- Board frame capture: `src/te/io/frameCapture.ts` (stage registered by CanvasStage; capture only works from the Board workspace).

## Testing and verification

- Unit tests colocate as `*.test.ts` next to source (geometry, store). Keep geometry/store logic in pure TS so it stays testable without a DOM.
- Dev builds expose `window.__store` (the zustand hook) — scripted browser checks drive real store actions and assert state. Pattern: Playwright headless against the dev server; screenshots for visual confirmation.
- Keyboard map (in `App.tsx`): Cmd+Z / Shift+Cmd+Z, Delete, Esc (cancel draft + tool→select), Enter (finish boundary/path), Space (play/pause). Shortcuts are suppressed while typing in inputs.
