# Board refactor: implementation handoff

Status: **specified, not built.** No source file under `src/` has been changed for this work.

Read this file end to end before you write code. Read the repository `CLAUDE.md`
first if you have not. Its "Core invariants" section outranks anything here.

| | |
| --- | --- |
| Baseline commit | `9d5843f` "Replace analysis scoring with operational evidence" |
| Baseline tests | 482 passing in 37 files (`npm run test`) |
| Baseline lint | 3 warnings, listed in section 9. Zero errors. |
| Baseline build | `npm run build` clean |
| Approved mockup | `docs/board-refactor/mockup.html` (open in a browser) |
| Published mockup | https://claude.ai/code/artifact/d4c41498-7fab-46b7-a844-8c417946e5bf |
| Mockup generator | `docs/board-refactor/build_mockup.py` (`python3 build_mockup.py`) |

The mockup is the visual acceptance target. When this document and the mockup
disagree, the mockup wins on appearance and this document wins on behavior.

---

## 1. What the user asked for

1. Declutter the interface. Target look: SpaceX mission control, Anduril Lattice.
   Clean and restrained, with no vibe-coded ornamentation.
2. A selected trackfile shows real-time telemetry, including tracked and jammed
   state.
3. The trackfile highlight changes with track state: tracked, then targeted,
   then fired upon. An eliminated trackfile becomes a ghost track that keeps
   flying its course.
4. Counter-UAS effectors draw a thin line from the effector to the threat with a
   small arrow travelling along it as the projectile. The effector glyph fills in
   when semi-active and blinks when active, matched to how that weapon guides and
   holds track.
5. Logical declutter controls, in a dropdown and on right-click.
6. Run tests and checks. Clean up stale or deprecated code on completion.

## 2. Open decisions

These three were surfaced to the user with the mockup. Each has a default so no
agent is ever blocked. If the user has since answered, that answer wins.

| # | Question | Default to build | If the user says otherwise |
| --- | --- | --- | --- |
| D1 | The user wrote "triangle" for the effector. Effectors today draw the MIL-STD-2525 rectangle frame, matching `src/panels/Glyph.tsx` and the palette. | Keep the rectangle frame. The travelling round is the triangle. | Change the effector frame in BOTH `EntityLayer.tsx` and `Glyph.tsx` so the canvas and the palette stay consistent. |
| D2 | Where the telemetry readout sits. | Dock at a fixed board corner with a leader line to the selected track. A card that floats next to the track always covers the inbound axis. | Float it beside the track with viewport clamping. |
| D3 | Ghost threshold. | Reuse the engine's existing `SHIP_DEAD_BELOW` (0.05) from `src/playback/attrition.ts`. | Never invent a second threshold. Escalate instead. |

## 3. Rules that bind every agent

- Work in `/Users/caseytalbot/projects/rangeboard`. Do NOT create a branch,
  commit, push, or stash. Leave changes in the working tree.
- Touch ONLY the files your task assigns you (section 7). Another agent owns
  every other file. If you believe you must edit a file you do not own, do not
  edit it. Report it instead.
- Copy the surrounding code style exactly: no trailing semicolons, 2-space
  indent, single quotes, named exports, `interface` for object shapes, JSDoc on
  exported symbols, short "why" comments above non-obvious blocks. No narration
  comments.
- No new npm dependencies.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json`. Test with
  `npx vitest run`. Do NOT run `npm run build`; it writes `dist/` and races
  other agents. Only the gate agents build.
- User-facing copy is ASD-STE100 Simplified Technical English: short sentences,
  active voice, plain words, no em-dashes.
- Do not create documentation, plan, or status files.

## 4. Engine facts you must respect

- The engine is **deterministic expected value**. There are no random rolls and
  no discrete kill event. Everything new is derived from data the ledger already
  holds. Do not add a sweep, a threshold, or a stored field.
- `EngagementEvent` (`src/playback/attrition.ts`) already carries what the
  projectile animation needs: `tS` (assignment, the launch), `tEffectS` (the
  effect lands), `effectorId`, `uasId`, `shipIdx`, `channel` (`'kill' | 'jam'`),
  `softShot`, `pk`, `killDelta`.
- Expenditure counts at `tS`. Kill mass counts at `tEffectS`. Keep that split.
- World frame is meters, +y is south, heading 0 is north clockwise.
- Konva conventions in `CLAUDE.md` are binding: `strokeScaleEnabled={false}`,
  screen-size icons wrapped in a Group at `scale={1/camera.scale}`, big fills
  `listening={false}`, `hitStrokeWidth` in screen px.
- Playback re-renders every rAF frame because `playback.simTimeS` changes. Any
  blink or pulse MUST derive from `simTimeS`. Never a `setInterval`,
  `setTimeout`, or `Date.now()`. A paused run correctly freezes the pulse.
- Derived state is never written back into the `Scenario`. Layer visibility is
  view state and lives in `ui`, persisted to its own localStorage key.

## 5. Design language

The palette already exists in `src/index.css` `:root`. Keep the token names. The
look comes from restraint, not from new colors.

- Hairline separation. 1px borders at low contrast. Prefer a border or a gap
  over a filled panel.
- Radius 2px or 3px. Nothing pill-shaped except genuine status pills.
- Micro-labels: `--font-mono`, 9px to 10px, uppercase, `letter-spacing: .1em`,
  `--text-dim`. Values: 12px to 13px, `--text`, weight 500 to 600.
- One accent (`--accent`), used sparingly. State reads through weight and tone,
  not through large blocks of saturated fill.
- Fewer controls visible at rest. Secondary controls live behind a menu.
- No gradients, no glow, no drop shadows except on true floating surfaces, no
  emoji, no icon fonts.

### Canonical state colors

| State | Value | Meaning |
| --- | --- | --- |
| undetected | entity color, no ring | no sensor has held it |
| searching | `#82887e` (`--text-dim`) | held before, not held now |
| tracked | `#d9a441` amber | held now, not yet hostile |
| identified | `#c4564a` (`--danger`) | hostile classification reached |
| targeted | `#c4564a` plus corner brackets | inside a usable ROE-gated window now |
| engaged | `#c4564a`, brackets, pulsing | a salvo is in flight at it now |
| ghost | `#6a7178` hollow, dashed | expected residual below `SHIP_DEAD_BELOW` |
| jam / EW | `#7da7c4` (`--ew`) | the EW channel, everywhere |

---

## 6. Technical contract

### 6.1 `src/playback/trackState.ts` (NEW)

Pure TypeScript. No React, no Konva, no store import, no DOM. Unit tested in
`src/playback/trackState.test.ts`.

```ts
import type { EffectorSpec, Scenario, Vec2 } from '../model/types'
import type { ThreatAssessment, ThreatClassification } from './sim'
import type { AttritionReport } from './attrition'

/** Seconds a zero-flight-time effect (beam, instantaneous burst) stays drawn. */
export const BEAM_DISPLAY_S = 0.6

/** Pulse period, seconds. */
export const BLINK_PERIOD_S = 0.5

/**
 * Track lifecycle, highest precedence first:
 * ghost > engaged > targeted > identified > tracked > searching > undetected.
 */
export type TrackPhase =
  | 'undetected' | 'searching' | 'tracked' | 'identified'
  | 'targeted' | 'engaged' | 'ghost'

export interface TrackFileState {
  uasId: string
  phase: TrackPhase
  /** Any sensor has held it at or before t. */
  detected: boolean
  /** A sensor holds it at t. */
  heldNow: boolean
  holdingSensorIds: string[]
  /** Ladder rung reached by t. */
  classification: ThreatClassification
  /** Inside a usable ROE-gated effector window at t. */
  targetedNow: boolean
  /** Salvos assigned whose effect has not landed at t. */
  incomingSalvos: number
  /** Salvos assigned at or before t (kinetic plus jam). */
  salvosAssigned: number
  kineticSalvos: number
  jamSalvos: number
  /** Effects landed at or before t. */
  effectsLanded: number
  /** Expected kill mass landed at or before t, in ships. */
  expectedKills: number
  shipCount: number
  /** shipCount minus expectedKills, floored at 0. */
  residual: number
  /** residual / shipCount, 0..1. */
  residualFraction: number
  /** Probability the track is degraded by a 'continue' jam at t, 0..1. */
  jammedFraction: number
  /** residualFraction < SHIP_DEAD_BELOW. */
  eliminated: boolean
  /** Effect time at which it first fell below the cutoff; null while alive. */
  eliminatedAtS: number | null
  /** True when the dominant landed kill mass came from jammers. */
  eliminatedBySoft: boolean
  arrivalS: number | null
  arrived: boolean
}

/** A salvo drawn on the canvas between launch and effect. */
export interface ShotInFlight {
  effectorId: string
  uasId: string
  shipIdx: number
  tS: number
  tEffectS: number
  /** 0 at launch, 1 at effect. Always 1 for zero-flight-time effects. */
  progress: number
  channel: 'kill' | 'jam'
  softShot: boolean
  pk: number
  /** Effector world position. */
  from: Vec2
  /** Target ship world position at tEffectS. */
  to: Vec2
  mode: EffectorEngagementMode
}

/**
 * How the weapon guides, which drives what the canvas draws.
 * 'semi-active' - the effector keeps illuminating or steering the round, so its
 *   glyph stays FILLED for the whole time of flight and the guidance line stays
 *   bright.
 * 'active' - the round guides itself, so the glyph BLINKS at launch and then
 *   returns to outline while a seeker ring rides the round.
 * 'beam' - continuous directed energy or jamming: no discrete round, a pulsing
 *   dashed beam for the dwell, glyph stays FILLED.
 */
export type EffectorEngagementMode = 'semi-active' | 'active' | 'beam'

/** Effector glyph treatment at t. 'idle' draws the outline frame only. */
export type EffectorLiveState = 'idle' | 'semi-active' | 'active' | 'beam'

/**
 * Guidance mapping, read from the researched integration profile
 * (`profileFor(specId)?.guidance` in src/model/integration.ts):
 *   fc-uplink -> semi-active, operator -> semi-active,
 *   c2-cue    -> active,      self     -> active.
 * Fallback by effector type when no profile exists:
 *   interceptor -> active, gun -> semi-active, net -> semi-active,
 *   jammer | de | hpm -> beam (these always win, profile or not).
 */
export function effectorEngagementMode(
  specId: string | null,
  effectorType: EffectorSpec['effectorType'] | undefined,
): EffectorEngagementMode

/** Built once per (scenario, assessments, report). Opaque to callers. */
export interface TrackTimeline { /* implementation-defined */ }

export function buildTrackTimeline(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
): TrackTimeline

/** Track state for every threat with a flight path, keyed by uasId. */
export function trackStatesAt(tl: TrackTimeline, tS: number): Map<string, TrackFileState>

/** Salvos currently drawn. Zero-flight-time salvos stay for BEAM_DISPLAY_S. */
export function shotsInFlightAt(tl: TrackTimeline, tS: number): ShotInFlight[]

/** Effector glyph treatment at t, keyed by effector id. Absent means idle. */
export function effectorStatesAt(tl: TrackTimeline, tS: number): Map<string, EffectorLiveState>

/** True on the lit half of the pulse. Derived from sim time, never a timer. */
export function blinkOn(tS: number): boolean
```

Derivation rules, all binding:

- `heldNow` and `holdingSensorIds` come from
  `assessment.sensorObservations[].intervals`, using the tolerance the repo
  already uses: `tS >= start - 0.25 && tS <= end + 0.25` (see `heldAt` in
  `src/analysis/threatAggregation.ts`). Do NOT re-run `detectionsAt`.
- `classification` is the highest rung in `assessment.classificationAtS` whose
  time is `<= tS`; `'pending'` when none.
- `targetedNow` is `assessment.status === 'engageable' && assessment.windowS != null`
  and `tS` inside `windowS`. This matches `liveKpisAt`'s `targetable`.
- `expectedKills` is the prefix sum of `killDelta` over this threat's events
  ordered by `tEffectS`, for `tEffectS <= tS`.
- `jammedFraction` replays the engine rule over this threat's `channel === 'jam'`
  events in `tEffectS` order for `tEffectS <= tS`: `jammed += (1 - jammed) * pk`,
  then aggregated to the formation the same way `ThreatAttrition.continueJamProb`
  does.
- `incomingSalvos` counts events with `tS <= t < tEffectS`. A zero-flight-time
  event (`tEffectS === tS`) counts as incoming for `BEAM_DISPLAY_S` after `tS`.
- `eliminated` and `eliminatedAtS`: the first `tEffectS` at which
  `residualFraction` drops below `SHIP_DEAD_BELOW`. Once eliminated, never
  un-eliminated.
- `eliminatedBySoft`: at `eliminatedAtS`, the larger accumulated `killDelta`
  share came from `softShot` events.
- Phase precedence exactly as listed. `'engaged'` requires `incomingSalvos > 0`.
  `'searching'` means `detected && !heldNow`.
- After the build, every query must be O(log n) or O(k): prefix arrays and
  binary search, following `src/analysis/liveStats.ts`. This runs every frame.
- `buildTrackTimeline` must be memoizable by the caller on object identity. It
  must not read the store.

### 6.2 Store: `ui.layers` in `src/state/store.ts`

```ts
/** Canvas layer visibility. View state only: not undoable, not in the scenario. */
export interface LayerVisibility {
  grid: boolean
  boundaries: boolean
  sensorFootprints: boolean
  classifyRings: boolean
  effectorEnvelopes: boolean
  threatWez: boolean
  flightPaths: boolean
  connections: boolean
  rangeRings: boolean
  engagements: boolean
  labels: boolean
  trackTelemetry: boolean
}

export type LayerKey = keyof LayerVisibility
export type LayerPreset = 'full' | 'planning' | 'engagement' | 'clean'
```

- Actions: `setLayer(key, v)`, `toggleLayer(key)`, `applyLayerPreset(p)`.
- Persist to `rangeboard.layers.v1`, following the existing `units` precedent
  (`UNITS_KEY` and `savedUnits()`): written inside the setter, read by a
  `savedLayers()` helper that spreads over the defaults so a key added later
  still gets one. Not undoable. Not in the autosave payload.
- Default state is the `full` preset.

Preset contents (this table is the acceptance test):

| Layer | full | planning | engagement | clean |
| --- | :-: | :-: | :-: | :-: |
| grid | on | on | on | on |
| boundaries | on | on | on | off |
| sensorFootprints | on | on | off | off |
| classifyRings | on | on | off | off |
| effectorEnvelopes | on | on | on | off |
| threatWez | off | off | off | off |
| flightPaths | on | on | on | off |
| connections | on | on | off | off |
| rangeRings | on | on | off | off |
| engagements | on | off | on | off |
| labels | on | on | on | on |
| trackTelemetry | on | on | on | on |

- Fold `ui.showThreatWez` into `ui.layers.threatWez`. DELETE `ui.showThreatWez`
  and `setShowThreatWez`.

### 6.3 Canvas render

**`src/canvas/layers/EntityLayer.tsx`**

- Replace the single `detected` ring with the `TrackPhase` treatment in section 5.
- `targeted` and `engaged` add four corner brackets (a target reticle) as short
  `Line` segments inside the screen-scaled group.
- `engaged` pulses: brackets and ring alternate opacity with `blinkOn(simTimeS)`.
  Pulse floor is 0.5, not 0. A dimmed state must stay legible.
- `ghost`: hollow diamond (no fill, dashed stroke, `#6a7178`), group opacity
  about 0.45, no ring, no brackets, formation member marks also hollow. Position
  still comes from `tracks`, so it keeps flying with no extra work. Add a mono
  tag `GHOST`, or `GHOST · MISSION KILL` when `eliminatedBySoft`.
- A non-ghost track with `jammedFraction >= 0.5` gets a small `--ew` `JAM` tag.
- Effector glyphs: `idle` draws the 2525 rectangle frame as an OUTLINE (stroke in
  the entity color, no fill). `semi-active` and `beam` draw it FILLED. `active`
  draws it filled and blinking. Sensor, C2, asset, marker, and UAS glyphs keep
  their current filled treatment.
- The selection ring must sit OUTSIDE the target brackets. In the mockup the
  glyph is r11, the state ring r14, brackets at half 19, and the selection ring
  r28.
- Honor `ui.layers.labels` for the inline entity name `Text`.
- Keep every existing interaction: click select, right-click menu, drag move,
  heading handle, the RANGE ON/OFF chip, connect and path tool routing, and the
  raid-draft click passthrough.

**`src/canvas/layers/EngagementLayer.tsx` (NEW)**

Renders `shotsInFlightAt(...)`. Never listens to pointer events. Gated by
`ui.layers.engagements`.

- Trim both ends of the shot line so it does not run through the effector glyph
  or the target ring, the way `ConnectionLayer` already trims its arrows.
  Reference values from the mockup: 13 units off the source, 15 off the target.
- Kill channel uses `#c4564a`. Jam channel uses `#7da7c4`.
- `mode === 'beam'`: full line, dashed `[2, 4]`, opacity pulsing with `blinkOn`.
  No travelling marker.
- Otherwise draw the line as the shot's track and a small filled TRIANGLE at
  `from + (to - from) * progress`, rotated along the line of flight. The triangle
  is screen-sized: wrap it in a Group at `scale={1/camera.scale}`, about 6px.
- `semi-active` draws the guidance line at about 0.7 opacity for the whole time
  of flight. `active` draws it at about 0.3 and adds a 1px seeker ring around the
  travelling triangle once `progress > 0.15`.
- A shot whose target is already a ghost still draws to completion. Never delete
  a round in flight.

**`src/canvas/TrackFileReadout.tsx` (NEW, DOM overlay)**

- Shows when exactly one entity is selected, it is `kind === 'uas'`, and
  `ui.layers.trackTelemetry` is true.
- Per D2: docks at a fixed board corner. An SVG leader line ties the card to the
  selected track. `pointer-events: none` on the container.
- Content order, using the micro-label idiom: header (name plus a phase pill in
  the section 5 color), platform, nav, position, altitude, speed and heading,
  hold, class and continuity, EW, salvos, effects, residual, arrival. A ghost
  gets one extra line stating the elimination time and whether it was a hard kill
  or a mission kill.
- Reuse the existing formatters: `formatDistance`, `formatSpeed`, `NM_M`,
  `formatTime`.
- Footer states the data basis: planning model, 0.5 s cadence, not instrumented.
  Never label a figure as measured or as ground truth.

**`src/canvas/CanvasStage.tsx`**

- Build the timeline once with `useMemo` on `(scenario, assessments, report)`
  identity, reusing the existing `engagementPicture(scenario)` memo so no extra
  sweep runs.
- Query `trackStatesAt` / `shotsInFlightAt` / `effectorStatesAt` per frame with
  `useMemo` on `[timeline, simTimeS]` and pass the results down as props. Leaf
  components must not rebuild the timeline.
- Insert `<EngagementLayer />` between `ConnectionLayer` and `EntityLayer`.
- Render `<TrackFileReadout />` beside `<HudLayer />`.

### 6.4 Layer gating

Each Konva layer self-gates by reading its own flag and returning `null`. Do NOT
add gating to `CanvasStage.tsx`.

| File | Flag |
| --- | --- |
| `layers/GridLayer.tsx` | `grid` |
| `layers/BoundaryLayer.tsx` | `boundaries` |
| `layers/FootprintLayer.tsx` | `sensorFootprints` (sensor part), `classifyRings` (the dashed classify circle), `effectorEnvelopes` (effector part) |
| `layers/ThreatWezLayer.tsx` | `threatWez` (replaces `ui.showThreatWez`) |
| `layers/PathLayer.tsx` | `flightPaths` gates the committed path list ONLY. The in-progress draft and the calibrate markers must ALWAYS draw. |
| `layers/ConnectionLayer.tsx` | `connections` |
| `layers/RangeLayer.tsx` | `rangeRings` |
| `layers/CalloutLayer.tsx` | `labels` |

### 6.5 Toolbar and View menu

Goal: the board toolbar fits one row at 1440px and never wraps. Twenty controls
at rest become twelve.

- Keep on the bar: brand, workspace segmented control, scenario name, the five
  tools, undo, redo, the status pill cluster.
- Into a single `View` dropdown: basemap, units, the twelve layer toggles grouped
  under `Coverage` / `Tracks` / `Reference` headings, and the four presets as a
  segmented row at the top. The satellite controls (Location, Image, Move image,
  Opacity) move in under a `Satellite` heading, shown only in satellite mode.
- Into a single overflow menu: New, Import, Export, Capture frame. Keep the text
  labels.
- The scenario name becomes a borderless inline input showing a bottom rule on
  hover and focus only.
- Status pills become a tighter mono cluster: 10px, uppercase, hairline border,
  no filled background except danger and warning.
- Undo and redo become glyph buttons with `title` text.
- Both menus close on outside mousedown and on Escape, and are keyboard
  reachable. Follow the existing outside-click pattern in `ContextMenu.tsx`.
- The `WEZ On` status pill stays.

### 6.6 Right-click declutter

- Add a `Display ▸` flyout to the canvas (no-entity) menu using the existing
  `ctx-sub` / `ctx-flyout` pattern already in `ContextMenu.tsx`.
- The flyout lists the four presets first, then the twelve layer toggles with a
  check mark on the visible ones.
- Clicking a toggle must NOT close the menu, so several can be switched at once.
  Clicking a preset closes it. The existing `Item` component always closes, so
  add a variant rather than changing `Item` for the other entries.
- Add the same `Display ▸` flyout to the entity menu, above `Delete`.
- Keep every existing menu entry and its behavior.

---

## 7. File ownership

One owner per file per phase. This is what makes the parallel phases safe.

| Agent | Phase | Owns |
| --- | --- | --- |
| `core-trackstate` | 1 | `src/playback/trackState.ts`, `src/playback/trackState.test.ts` |
| `core-store` | 1 | `src/state/store.ts`, `src/state/store.test.ts`, `src/panels/CommandPalette.tsx`, `src/panels/AnalysisPanel.tsx` |
| `canvas-engagement` | 2 | `src/canvas/layers/EntityLayer.tsx`, `src/canvas/layers/EngagementLayer.tsx`, `src/canvas/TrackFileReadout.tsx`, `src/canvas/CanvasStage.tsx`, one appended block in `src/index.css` marked `/* ---------- Trackfile readout ---------- */` |
| `canvas-layers` | 2 | `src/canvas/layers/GridLayer.tsx`, `BoundaryLayer.tsx`, `FootprintLayer.tsx`, `ThreatWezLayer.tsx`, `PathLayer.tsx`, `ConnectionLayer.tsx`, `RangeLayer.tsx`, `CalloutLayer.tsx`. No CSS. |
| `chrome-toolbar` | 3 | `src/panels/Toolbar.tsx`, `src/panels/ViewMenu.tsx` (new), one appended block in `src/index.css` marked `/* ---------- View menu ---------- */` |
| `chrome-contextmenu` | 3 | `src/canvas/ContextMenu.tsx` only |
| `design-pass` | 4 | `src/index.css` (sole owner), `CLAUDE.md` |

Only ONE agent per phase may write `src/index.css`. That is why
`canvas-engagement` and `chrome-toolbar` sit in different phases.

---

## 8. Orchestration plan

13 agents, 7 phases. Run in the main working tree with no worktree isolation:
later phases must see earlier edits. Parallel agents inside a phase are disjoint
by the section 7 ownership table.

```
Phase 1  Foundation        [2 parallel]  core-trackstate | core-store
Phase 2  Canvas            [2 parallel]  canvas-engagement | canvas-layers
Phase 3  Chrome            [2 parallel]  chrome-toolbar | chrome-contextmenu
Phase 4  Design pass       [1]           design-pass
Phase 5  Verify            [4 parallel]  gate | browser-verify
                                         review-correctness | review-cleanup
Phase 6  Fix               [1]           fix-apply
Phase 7  Final gate        [1]           final-gate
```

Dependencies:

- Phase 2 needs the `trackState.ts` exports from phase 1 and `ui.layers` from
  phase 1. Both phase 1 agents must finish first.
- Phase 3 needs `ui.layers` only. It could in principle start with phase 2, but
  both would then write `src/index.css`. Keep it sequential.
- Phase 4 needs the markup from phases 2 and 3 so it can fold the two appended
  CSS blocks into the right sections and delete dead rules.
- Phase 6 acts only on findings that phase 5 confirmed.

Per-agent briefs:

1. **`core-trackstate`** Build `src/playback/trackState.ts` to section 6.1
   exactly, plus `trackState.test.ts`. Cover: each phase transition, the ghost
   cutoff and its one-way latch, `jammedFraction` accumulation, `incomingSalvos`
   including the zero-flight-time case, `effectorEngagementMode` for every
   profile guidance value and every type fallback, and `blinkOn` determinism.
   No React, no Konva, no store import.
2. **`core-store`** Add `LayerVisibility`, the three actions, and
   `rangeboard.layers.v1` persistence to section 6.2. Delete `ui.showThreatWez`
   and `setShowThreatWez` and migrate the two call sites you own. Do NOT touch
   `Toolbar.tsx` or `ThreatWezLayer.tsx`. Add store tests for each action, each
   preset against the section 6.2 table, and that a layer change pushes no undo
   history.
3. **`canvas-engagement`** Implement section 6.3. This is the largest single
   task. Do not regress any existing canvas interaction.
4. **`canvas-layers`** Implement section 6.4. Small mechanical changes across
   eight files. Preserve the PathLayer draft and calibrate exception.
5. **`chrome-toolbar`** Implement section 6.5. Verify at 1440px that the bar does
   not wrap.
6. **`chrome-contextmenu`** Implement section 6.6.
7. **`design-pass`** Sole owner of `src/index.css`. Fold the two appended blocks
   into the right sections, remove duplicate rules, apply section 5 consistently
   across toolbar, palette, right-panel tabs, status pills, context menu, HUD,
   and the new components. Do NOT restructure the Analysis panel markup or
   classes beyond token and spacing changes; that panel was rebuilt in `9d5843f`
   and must keep working. Remove dead CSS only after proving each selector is
   unused with a grep over `src/`. Also update `CLAUDE.md`: the architecture map
   gains `trackState.ts`, `EngagementLayer`, and `TrackFileReadout`, and the
   domain-semantics line that says `ui.showThreatWez` is a render toggle must
   become `ui.layers`.
8. **`gate`** Run `npx vitest run`, `npx tsc --noEmit -p tsconfig.app.json`,
   `npm run lint`, `npm run build`. Report the exact output. Fix nothing.
9. **`browser-verify`** Start the dev server, drive the real app through
   `window.__store` per the pattern in `CLAUDE.md`, and capture screenshots.
   Check: the toolbar holds one row at 1440px; the View menu opens, toggles a
   layer, and the canvas responds; each preset changes the picture; selecting a
   UAS opens the readout; scrubbing playback moves a round along its line and
   turns a killed track into a ghost; the right-click Display flyout stays open
   across several toggles. Compare against `docs/board-refactor/mockup.html`.
10. **`review-correctness`** Adversarial review of the diff for correctness only.
    Prioritise: derived-state leaks back into the `Scenario`, undo-history
    pollution, per-frame recomputation, `heldAt` tolerance mistakes, prefix-sum
    or binary-search off-by-ones, Konva hit-testing regressions, and any blink
    driven by a timer instead of `simTimeS`.
11. **`review-cleanup`** Review for stale and deprecated code and for scope
    creep. Confirm section 10 is complete. Flag anything added that no section of
    this document asked for.
12. **`fix-apply`** Apply only the findings that phase 5 confirmed. Re-run the
    gate.
13. **`final-gate`** Full green run of all four commands, plus a final screenshot
    set. Report honestly, including anything left undone.

## 9. Verification gates

- `npx vitest run`: all green, with new tests for `trackState.ts` and the new
  store actions. Baseline is 482 tests in 37 files, so the count must rise.
- `npx tsc --noEmit -p tsconfig.app.json`: clean.
- `npm run lint`: no new warnings beyond these three at baseline.
  - `src/App.tsx:52` react(set-state-in-effect)
  - `src/canvas/layers/UnderlayLayer.tsx:15` react(set-state-in-effect)
  - `src/te/ui/kit.tsx:527` react(only-export-components)
- `npm run build`: succeeds.
- Browser check passes the list in agent 9.

## 10. Cleanup checklist

The user asked for stale and deprecated code to go. Each item must be done or
explained.

- [ ] `ui.showThreatWez` and `setShowThreatWez` deleted from `src/state/store.ts`.
- [ ] All five former call sites migrated to `ui.layers.threatWez`:
      `CommandPalette.tsx`, `AnalysisPanel.tsx`, `Toolbar.tsx`,
      `ThreatWezLayer.tsx`, and the store itself.
- [ ] `CLAUDE.md` domain-semantics line about `ui.showThreatWez` updated.
- [ ] `CLAUDE.md` architecture map lists the new modules.
- [ ] Dead CSS removed from `src/index.css`, each removal proven by grep.
- [ ] No unused export left behind by the `EntityLayer` rewrite.
- [ ] `grep -rn "showThreatWez" src/` returns nothing.

## 11. Out of scope

Do not change these. They are settled.

- The engine: `sim.ts`, `attrition.ts`, `impact.ts`, `sensorEnv.ts`, and every
  threshold in them.
- The Analysis panel rebuilt in `9d5843f`. Token and spacing polish only.
- The T&E Operations workspace under `src/te/`.
- The `Scenario` schema and `schemaVersion`. Layer visibility never enters it.
- The Konva-not-tldraw decision and the react-konva plus zustand stack.
