# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RangeBoard: a local-first web "integrated air defense whiteboard" for Counter-UAS test-and-evaluation planning. Infinite meter-scaled canvas with sensor footprints, kill-chain links, threat flight paths, test cards, timeline playback, and engagement analysis. Single user, no backend. Stack: React 19, react-konva, zustand, recharts 3, vitest, oxlint. Deliberately not tldraw (license and document-model friction).

## Commands

```
npm run dev                          # Vite dev server (picks the next port if busy)
npm run test                         # vitest run, every test
npx vitest run src/analysis/series   # one file or directory
npx tsc --noEmit -p tsconfig.app.json   # type-check only
npm run build                        # tsc -b && vite build
npm run lint                         # oxlint; react(only-export-components) is warn-level and has known hits
```

No jsdom or testing-library. Component tests use `renderToStaticMarkup` and assert on the HTML string; Recharts sizes its chart in an effect, so a chart renders only its wrapper div in static markup. Playwright is a devDependency for scripted browser checks only. Under the Claude Code sandbox the Vite port bind and Chromium both fail; run the dev server and Playwright with the sandbox disabled.

## Core invariants (breaking these breaks the app)

- **World frame:** meters. +x east, **+y south** (screen-down). Heading 0 = north, clockwise degrees. All conversions live in `src/geometry/geo.ts` (pure, unit-tested). `bearingDeg({0,0},{0,-100}) === 0`.
- **Camera:** `{x, y, scale}` = Konva Stage pixel offset plus **pixels per meter**. `sx = wx*scale + x`. Layer children are positioned in meters; the Stage transform scales.
- **Single source of truth:** the `Scenario` object in `src/state/store.ts` (zustand). The Konva tree and every panel are pure views of it. Never write derived state (positions at time t, detections, assessments) into the scenario.
- **Playback is derived:** position at sim time comes from `posAtTime` in `src/playback/sim.ts`. `playback.simTimeS` is the only mutable playback state. Any pulse, blink, or playhead derives from it; never a timer.
- **Undo model:** `mutate(fn)` pushes a full scenario snapshot to `past` (cap 100) and clears `future`. Only scenario changes are undoable. A scenario-touching action goes through `mutate`; view state (camera, selection, ui, layers, ring overrides, analysis layout) goes through `set` and never pushes history. One exception: `Scenario.observedPresetId` is stamped through `set` on reset and first play, and undo and redo carry the current stamp over a restored snapshot.
- **Schema:** `Scenario.schemaVersion = 1`. `fillScenario` (`src/io/persist.ts`) spreads a save over `emptyScenario()` and deep-fills one level into `environment`, `requirements`, `doctrine`, `mcdaWeights`, `underlay`, `raid`. A new top-level field, or a field inside one of those, needs only a default in `emptyScenario()`; a new nested object needs its own `fillScenario` line. Bump the version only for a breaking shape change. A save that cannot load is copied to `rangeboard.scenario.recovered.<ms>` before anything writes. `loadScenario` is the one load path; `replaceScenario` clears history, selection, drafts and the tool, and prunes per-entity view state.
- **Storage keys live in `src/io/storageKeys.ts`;** never rename one. View state outside the `Scenario` has its own key (`rangeboard.view.v1`, `rangeboard.layers.v1`, `rangeboard.rings.v1`, `rangeboard.runseq.v1`, `rangeboard.analysis.v1`) and is written eagerly by its setter in `src/io/viewState.ts`. Shared constants that both `store.ts` and `viewState.ts` need live in a leaf module, never in `store.ts` (module cycle).
- **Thresholds are test-defined:** `Scenario.requirements` (`RequirementThresholds`, defaults in `DEFAULT_REQUIREMENT_THRESHOLDS`) holds what the test asks the system to meet. Every reader spreads `{ ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }`. Never gate a requirement on an engine constant: a gate at `SHIP_DEAD_BELOW` passes itself by construction.
- **Planning factors are labeled:** every unsourced number is a PF. `SpecModel.provenance` records field, value, source, url, date and basis; `basisFor(model, field)` answers `pf` when nothing is recorded and the UI shows the PF tag. Never invent a value to fill a blank.

## Architecture map

```
src/model/     types.ts (domain types, newId, resolvers like mountHeightOf), seed.ts (emptyScenario),
               seedLibrary.ts (builtin specs), rcsFactors / signatureFactors / weaponFactors (PF tiers)
src/geometry/  geo.ts (bearings, wedges, path interpolation, formatters), slant.ts (slant range, horizon)
src/state/     store.ts: one zustand store (scenario + history + selection + camera + ui + playback),
               analysisLayout.ts (lens presets and pure layout reducers)
src/playback/  sim.ts (detection sweep at DT = 0.5 s, assessThreat, kill-chain routes),
               attrition.ts (fire distribution, expected kills, events), trackState.ts (phase at t),
               tactics.ts (threat tactics), runSession.ts (run reset / play)
src/analysis/  sensorEnv.ts (sensor physics), radarPd.ts (Pd closed forms), ewPhysics.ts (jam),
               doctrineFactors.ts (per-system factors), impact.ts (engagementPicture cache, WEZ),
               liveStats.ts (KPIs at t), series.ts (chart series on the DT grid), runValidity.ts,
               requirements.ts, mcda.ts, aar.ts
src/charts/    recharts kit: types.ts (Series), tokens.ts, timeAxis.ts, ChartFrame, TimeSeries,
               Ladder, Sparkline. Props only; never reads the store.
src/canvas/    CanvasStage.tsx (stage, pan/zoom, tool routing, drop target), TrackFileReadout.tsx,
               layers/ (one Konva layer per concern; footprintStyle.ts is the ring style source)
src/panels/    Toolbar, ViewMenu, Palette, Inspector (+ inspector/kit.tsx), LibraryEditor,
               TestCardsPanel, AnalysisPanel (+ analysis/, analysis/widgets/),
               TimelineBar (owns the rAF loop), CommandPalette, Glyph.tsx (symbology),
               ringLabels.ts (ring names)
src/io/        persist.ts (autosave, JSON and library import/export), viewState.ts, storageKeys.ts
src/te/        T&E Operations workspace (own store, see below)
```

Data flow for a click or drag: Konva event, store action, new scenario, React re-render of layers. Drag-in-progress is Konva-native; the store updates once on `dragend`. Analysis reads `engagementPicture(scenario)` (`src/analysis/impact.ts`), a WeakMap cache keyed on the scenario object, so the sweep runs once per scenario change.

## Konva conventions

- Constant screen-size strokes: `strokeScaleEnabled={false}` (stroke width and dash are then in px).
- Constant screen-size icons and labels: a Group with `scale={1/camera.scale}`; inner units are px.
- Footprints and other large fills are `listening={false}` or they swallow stage clicks.
- Thin-line hit tolerance: `hitStrokeWidth={n}` in screen px (do not divide by `camera.scale`).
- Drawing tools do not use Konva drag: the stage is `draggable` only when `ui.tool === 'select'`; other tools consume plain clicks and keep the rubber-band draft in `ui.draftPoints`.
- Each layer reads its own `ui.layers` flag and returns `null`; `CanvasStage` does no gating.

## One source per fact

Each fact below has exactly one definition. Read it there; never add a second copy.

- **Sample grid:** `DT` exported from `src/playback/sim.ts`. `tickStepS` in `src/charts/timeAxis.ts`. A chart's `tS` prop is quantized to DT by the caller.
- **Altitude and geometry:** `threatAltitudeFt(scenario, uas)` (entity value, else the threat profile, else the `altBandFt` midpoint) and `mountHeightOf(spec)` are the resolvers. Slant range, not ground range, feeds every sensor and effector range test; the azimuth wedge stays a ground-plane bearing test. Board rings against a selected threat ground-project through `groundRangeM`; the placard ring is unprojected. Terrain, per-waypoint altitude and refraction beyond the 4/3 horizon stay out.
- **Sensor physics** (`src/analysis/sensorEnv.ts`): a placard range is quoted against a reference target and scales to another target by a physical law per technology (radar fourth root of RCS, EO/IR Johnson linear, acoustic transmission-loss solve, RF none). `rangeBasis: 'planning'` turns scaling off. `sensorHoldGate` is the one hold gate, `sensorGeometryGate` the one vertical gate, `radarPdAt` the one Pd evaluation, `effectiveDetectRangeM` the one range. The environment multiplier enters radar SNR as the fourth power.
- **Track initiation** (`sim.ts`): a radar with a finite `updateRateS` runs the scan model (M-of-N over scans, coast on a missed scan, drop at the miss limit); every other radar and EO/IR uses the `TRACK_INIT_S` role table; RF and acoustic initiate no fire-control track. `SensorObservation.trackInitAtS` is the one field consumers read. A coast is extrapolation, not a measurement: it holds continuity and never moves the classification ladder.
- **Fire doctrine** (`Scenario.doctrine`, enabled by default): the gate is per effector and route-aware (a firm track from a sensor routed to that effector, hostile ID, the declaration dwell); `readyS` = gate + route latency + target dwell is the first possible release. Fire distribution is shoot-look-shoot with a BDA dwell; the launch point follows `doctrine.launchPolicy`. Per-system factors and spec overrides live in `src/analysis/doctrineFactors.ts`. Doctrine off is the legacy instant-release path; keep it for regression and pin legacy fixtures with `doctrine.enabled = false`.
- **Arrival vs closest approach:** never merge them. Arrival (`arrivalS`) is the first sample inside an asset's `defendedRadiusM`; null without an asset or a crossing. CPA is pure geometry to the nearest asset. Warning time is arrival minus first detection.
- **Raid partition** (`attrition.ts`): `expectedKills + expectedLeakers + expectedNoArrival === raidSize`. `expectedKills` is pre-arrival mass only; `expectedLateKills` is a sub-measure of the leaker mass. Display `totals.reportedLeakers` (null with no asset), never the partition term.
- **Expenditure channels:** `shotsFired` kinetic, `deSalvos` directed energy, `jamSalvos` EW, independent of hard versus soft kill (`expenditureChannel` versus `isHardKill`). DE and HPM are hard kills that fire no round. The engine round counter drops on every salvo.
- **Jam physics** (`src/analysis/ewPhysics.ts`): a jam holds only when nav mode, band coverage, boresight taper and power-range closure all pass. A 'continue' jam is illumination, not damage; the hold lapses when the target leaves the beam.
- **Run validity** (`src/analysis/runValidity.ts`): findings are `invalidating` or `limiting`; the requirement gates, the exported record and the toolbar chip all derive from it. Derived live, never stored.
- **Symbology** (`src/panels/Glyph.tsx`, `src/playback/trackState.ts`): MIL-STD-2525 split, the frame carries affiliation and the icon carries function; `FRAME_FOR`, `FUNCTION_LETTER` and `FRIEND_FRAME_D` are shared by the palette, the library lists and `EntityLayer`. `PHASE_STYLE` is the one track-phase color and label table. Canvas labels draw `boardDesignator(entity.name)`.
- **Rings** (`src/canvas/layers/footprintStyle.ts`, `src/panels/ringLabels.ts`): seven ring keys under `ui.layers`, per-entity overrides under `ui.ringOverrides`, `ringVisible(ui, entityId, key)` the one resolver, `RING_STYLE` the one style source, `RING_LABELS` and `RING_HINTS` the one name table. Effector rings draw in `--danger`; a jammer keeps its entity-color cone. Only a selected-threat ring carries a label.
- **Analysis layout** (`src/state/analysisLayout.ts`): `BUILTIN_LENSES` the five lenses, `WIDGETS` (`src/panels/analysis/widgets/registry.ts`) the one type-to-component map, `ui.analysis` view state under `ANALYSIS_KEY` written eagerly by every layout action, builtin lenses never persisted. `Scenario.observedPresetId` is written on reset and first play only and stays out of the basis signature. `SURVIVAL_LABELS` and `KPI_LABELS` (`widgets/labels.ts`) are the one name table (Leakers, Survives, Survival limit; the effect gate is relabeled at render); `useSimTimeStep` (`widgets/controls.tsx`) is the one quantized time in the panels.
- **Chart series** (`src/analysis/series.ts`): every builder is pure `(scenario, id?) => Series[]`, sampled from t = 0 at DT to `scenarioDurationS`, NaN where undefined, one `engagementPicture` call per builder. `trackSlots` assigns the five chart hues by first detection and never reassigns under a filter; status colors never color a series.
- **Model versus instance:** `SpecModel` (library entry, `builtin` flag, duplicate-and-edit) versus `Entity` (canvas instance referencing `specId`; survives model deletion with `specId → null`). `Scenario.deletedSeedIds` keeps the seed merge from resurrecting a deleted builtin. A seed field change does not reach an existing save's copy of a builtin model.
- **Other:** kill chain = `Connection` list, sensor to C2 to effector or direct; route latency is charged from the ROE gate, not from T0. Threat tactics live in `src/playback/tactics.ts`; the raid builder commits entities, paths and waves in one `mutate`. Threat WEZ geometry is `src/analysis/impact.ts`; `effectRadiusM` values are PF. Basemap modes are render toggles and never move data. `src/analysis/mcda.ts` scores 0 to 100 from `Scenario.mcdaWeights`.

## T&E Operations module (src/te/)

- Second workspace ("T&E Ops" toggle): end-to-end C-UAS test campaigns from customer request to delivered evidence. Spec sources: `docs/te-plan.md` and the MASTER-*.md files in `docs/te-compilation/`.
- **Separate store, no undo:** `src/te/state/teStore.ts`, persisted at `rangeboard.te.v1`, recovery copy at `rangeboard.te.recovered.<ms>`. Records are versioned and append-only (runs never renumber, issued cards freeze, changes create new versions). Never embed campaign data in `Scenario`.
- IDs follow `VLK-<code>-<type>-<seq>` (`src/te/model/ids.ts`); versions live on the record. Cards use `id` (per version) plus `cardCode` (shared across versions).
- Gates in `src/te/validate.ts`: no issued card no run, no validity status no analysis, no traceability no finding. `issueCard` enforces blockers in the store.
- `src/te/calc/` is pure TS, fixture-tested from MASTER-CALCULATIONS.md. Measure labels suppress pass/fail unless `thresholdApproved`.
- Seeds in `src/te/seed/` (measure dictionary, templates, vignettes, `buildJiatf401()` demo campaign marked `illustrative`). Print artifacts in `src/te/print/` render into `PrintOverlay`; CSV exports in `src/te/io/exportCsv.ts`. Board frame capture (`src/te/io/frameCapture.ts`) works only from the Board workspace.

## Design system (src/index.css)

- **Tokens, not literals.** `:root` holds a graphite ramp (`--surface-*`, `--border-*`, `--text-*`, `--status-*`) and short aliases (`--bg`, `--text`, `--accent`, `--danger`, `--good`, `--warn`, `--ew`, `--chart-1` to `--chart-5`). New rules read the semantic names. Spacing is `--space-1` to `--space-6` plus `--panel-pad`; motion is `--dur-fast` / `--dur`. `--border-control` is the boundary of an interactive control (WCAG 1.4.11 needs 3:1); `--border-default` and `--border-subtle` are decorative hairlines and never go on an input.
- **Monospace is machine data only:** ids, coordinates, timestamps, units, keys, numeric readouts, fixed abbreviation codes, chart axis ticks. Interface chrome and prose are `--font-ui`; mark a number in prose with `.num`.
- **Type floor is 10 px.**
- **Separators, not cards.** Hierarchy comes from surface tone, spacing, typography, a 1 px rule and interaction state. `--radius` is 3 px. The only shadows are `--shadow-float` (menus, dialogs, palette), `--shadow-pop` (tooltips, popovers) and the wash on `.right-panel`.
- **Charts:** `src/charts/tokens.ts` resolves CSS variables once per chart render and keeps `TOKEN_FALLBACK` equal to the sheet (a test proves it) for node and static markup.
- **Inspector kit** `src/panels/inspector/kit.tsx`: `Section`, `Row`, `ObjectHeader`, `Status`, `EmptyState`, `Kbd`, `ShortcutList`, `Actions`. A read-only property is a `Row`. The tab bar in `App.tsx` follows the ARIA tabs pattern; `.right-resizer` is a keyboard-operable separator.

## Working conventions

- Style: 2-space indent, no semicolons, single quotes, named exports, `interface` for object shapes, JSDoc on exported symbols, short "why" comments only where the code is not obvious. Keep lines under about 100 characters; no formatter is installed.
- User-facing copy is ASD-STE100 Simplified Technical English. No em-dashes.
- Keep engine, geometry and store logic in pure TS so it tests without a DOM. Unit tests colocate as `*.test.ts`. Hand-built test threats resolve altitude to the `altBandFt` midpoint; pin `altitudeFt` where slant must equal ground range, and pin `swerling` on a fixed-wing fixture that feeds a Pd expectation.
- Dev builds expose `window.__store` (the zustand hook). Browser checks drive real store actions through it with Playwright headless against the dev server. Playwright uses its own profile, so the user's autosave is never touched.
- Keyboard map (`App.tsx`): Cmd+Z / Shift+Cmd+Z, Delete, Esc (cancel draft, tool to select), Enter (finish boundary or path), Space (play/pause). Shortcuts are suppressed while typing in inputs.
- `docs/` holds plans and reference material; do not create plan, status or summary files for a task.
