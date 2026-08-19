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
src/canvas/    CanvasStage.tsx (stage, pan/zoom, tool click routing, HTML5 drop target)
               layers/: Underlay, Grid, Boundary, Footprint, Path, Connection, Entity, Hud(DOM)
src/panels/    Toolbar, Palette (drag source), Inspector, LibraryEditor, TestCardsPanel,
               AnalysisPanel, TimelineBar (owns the rAF playback loop + frames strip)
src/io/        persist.ts: localStorage autosave, JSON export/import, library export/import,
               underlay image import
```

Data flow for a click/drag: Konva event → store action → new scenario → React re-render of layers. Drag-in-progress is Konva-native; the store is updated once on `dragend`.

## Konva conventions used everywhere

- Constant screen-size strokes: `strokeScaleEnabled={false}` (stroke width and dash are then in px).
- Constant screen-size icons/labels: wrap in a Group with `scale={1/camera.scale}`; inner units are px.
- Footprints and other large fills must be `listening={false}` or they swallow stage clicks.
- Hit tolerance for thin lines: `hitStrokeWidth={n / camera.scale}`.
- Drawing tools do not use Konva drag: stage `draggable` only when `ui.tool === 'select'`; other tools consume plain clicks (`ui.draftPoints` holds the rubber-band draft).

## Domain semantics worth knowing

- `SpecModel` (library entry) vs `Entity` (canvas instance referencing `specId`). Entities survive model deletion (`specId → null`). Custom models: `builtin: false`; duplicate-and-edit supported.
- Kill chain = `Connection` list; `sim.killChainConnected` accepts sensor→C2→effector or direct sensor→effector.
- `assessThreat` statuses: `no-path | never-detected | not-confirmed | detect-only | no-kill-chain | window-too-short | engageable`. Warning time = arrival at nearest `asset` entity minus first detection. Engagement windows start when the `Scenario.engageOn` track quality is met (`detected` default, or `confirmed` = 2 simultaneous technologies).
- Sensor physics live in `src/analysis/sensorEnv.ts` (COURAGEOUS-based planning factors): rain/fog/night/urban-EM/wind derate ranges per `SensorType`; radar range scales with target `UasGroup` (rings show the Group 1 range); RF sensors only hear `rf-manual`/`mixed` nav modes; EO/IR only holds targets another technology already holds; jammers cannot affect `fiber`/`inertial`/`optical` threats. `SensorSpec.resolutionM` merges formations spaced below it into one track (`swarmMerged`).
- `src/analysis/mcda.ts` scores a configuration 0-100 from `Scenario.mcdaWeights`; pinned results live in `Scenario.scorecards`. Card templates and the standard covariate checklist live in `src/model/seedCards.ts`.
- Basemap modes (`canvas | sat | airspace`) are render toggles only — never move data. Sat underlay scale is set by two-point calibration, which scales the image about point A.
- Test cards follow the Field Guide standard card; `linkedEntityIds` drive the cyan on-canvas highlight when a card is selected.

## Testing and verification

- Unit tests colocate as `*.test.ts` next to source (geometry, store). Keep geometry/store logic in pure TS so it stays testable without a DOM.
- Dev builds expose `window.__store` (the zustand hook) — scripted browser checks drive real store actions and assert state. Pattern: Playwright headless against the dev server; screenshots for visual confirmation.
- Keyboard map (in `App.tsx`): Cmd+Z / Shift+Cmd+Z, Delete, Esc (cancel draft + tool→select), Enter (finish boundary/path), Space (play/pause). Shortcuts are suppressed while typing in inputs.
