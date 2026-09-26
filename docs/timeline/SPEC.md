# Run timeline: spec and plan

The run timeline is the strip under the board that shows every platform's activity in one
run on one time axis. It replaces the threat-only engagement strip
([EngagementStrip.tsx](../../src/panels/analysis/EngagementStrip.tsx)). Vocabulary is in
[CONTEXT.md](../../CONTEXT.md). Decisions were settled with the user on 2026-09-26. The
mockup is a published artifact: <https://claude.ai/artifact/PYWeMH5tEhE9fNS9uhrBEt>. This
file is the one plan. It stays unmodified while phases run; [HANDOFF.md](../HANDOFF.md)
selects the phase and holds the position.

## 1. Product spec

### 1.1 Where it lives

- One strip at the bottom of the board area, above the playback bar, in Execute and
  Analyze. Prepare shows one line: `No trial yet. Press Play in Execute to run one.`
- The playback bar toggle reads `Timeline`. Its open state keeps the existing storage key
  `ENGSTRIP_OPEN_KEY` (value unchanged, see landmines).
- A drag resizer sits above the strip. The height is saved under a new storage key.
  Minimum 120 px, maximum 60 percent of the window. Rows scroll inside the strip. The
  header, the axis and the overview stay fixed.

### 1.2 Rows

Order is side then kind. Each kind is a group with a header row that shows the count.

| Group | Side | Row | Content |
| --- | --- | --- | --- |
| Sensors | blue | one per sensor | merged hold and coast of every track the sensor holds; expands to one sub-lane per held track, shaded by track estimate quality, dashed while coasting; a detect mark at the start of each hold |
| C2 | blue | one per C2 node | a fused-init tick and a firm mark per fused track; an assignment mark per engagement event, labeled with the effector name |
| Tracks | blue | one per fused track | init ring, firm dot, the classification ramp (unknown, suspected, hostile), an assignment mark per event, a drop mark when the track ends without an outcome |
| Effectors | blue | one per effector | per event: a preparation span (hatched), then a flight, burst or dwell span; a release mark; an effect mark (hard kill, mission kill, miss, or jam decision); rounds left after each release; pk at each effect |
| Threats | red | one per threat with a flight path | undetected line, the classification ramp from first detection, the in-range window per effector, a release tick per shot, the effect mark, then a ghost line to the planned arrival after a kill, or an arrival mark for a leaker or a CPA mark |

Rules:

- Side follows from kind: `uas` is red, every other kind is blue. No side field exists.
- Groups start collapsed to one summary row that draws every member's items at reduced
  opacity. Sensor rows start merged. Expansion state is session only.
- Past 14 threat rows, same-named threats fold as today (`GROUP_AT`).
- Any row hides for the session with its × control. `Show all (n hidden)` restores.
- An enabled platform is present from T+0. There is no activation mark. A disabled
  platform has no row.
- Jammer dwell is the release-to-effect span of its engagement event. A `jam` channel
  event ends in a jam decision mark; a soft-shot kill ends in a mission kill mark.
- Assets and markers have no row. Asset impact is the arrival mark on the threat row.

### 1.3 Time axis

- The viewport is a window `[t0S, t0S + winS]`. Default `winS` is 120 s, minimum 10 s,
  maximum the run duration.
- While playing with Follow on, the playhead sits at two thirds of the viewport width.
  A horizontal wheel, an overview drag or a mark seek turns Follow off. Play and the
  Follow control turn it on.
- Ctrl or Meta wheel, and pinch, zoom about the cursor time. `Fit` shows the whole run.
  Zoom in and Zoom out step by 1.5 about the viewport center.
- Ticks reuse `tickStepS`. The gutter header reads `T+ from run start`.
- The overview under the axis shows the whole run: the threat ramps, kill marks, the
  unobserved region and the viewport rectangle. Dragging it moves the viewport.

### 1.4 Horizon

- Nothing draws past the observed horizon. In Execute the horizon is the lesser of the
  cursor and `observedThroughS`. In Analyze it is the run duration.
- Spans clip at the horizon. Marks at or past it do not draw. Tooltips and the
  accessibility text carry the horizon: `Shown through T+m:ss`.
- Scrubbing and mark seeks move the cursor and never advance observation.

### 1.5 Interaction

- Row label click selects the entity on the board through the existing selection action.
  A track row selects its threat. A false track selects nothing.
- Board selection highlights the row and scrolls it into view.
- Mark click seeks the playhead to the mark time through the existing `scrub` command.
- Hover shows a tooltip with the exact times and values, strip relative so the scroll
  container never clips it.
- Spans print their duration when at least 44 px wide. Effector rows print rounds left
  after each release and `pk 0.00` at each effect. Marks use the existing glyph inks.
- Keyboard: the strip is one `group` with a label; each group header and row label is a
  button; Escape closes the tooltip.

### 1.6 Out of scope

- No engine change. No physics change. No per-decision operator record (the engine keeps
  only counts). No explicit side field. No Monte Carlo view. No PNG export of the strip.

## 2. Architecture

### 2.1 Modules

| Module | Role | Owner phase |
| --- | --- | --- |
| `src/playback/retainTrial.ts` | at retention, derive one `fusedTrack` summary per assessment from `fusedTracks` before the per-step list is dropped: `initAtS`, `lastAtS`, `memberSensorIds` | 1A |
| `src/analysis/runTimeline.ts` | pure model: `runTimelineOf(view, horizonS)` returns groups, rows, sub-lanes and items, already censored; memoized per view like `trialSeries.ts` | 1B |
| `src/charts/timeViewport.ts` | pure viewport math: follow, zoom about an anchor, clamp, ticks, `xOf` | 1C |
| `src/panels/timeline/RunTimeline.tsx` and siblings (`Gutter`, `Plot`, `LaneMarks`, `Axis`, `Overview`, `Tooltip`) | the strip; reads the model and the viewport, emits callbacks | 2A |
| `src/state/store.ts` `ui.runTimeline` | open, height, collapsed groups, open sensors, hidden rows, follow, viewport; only open and height persist | 2B |
| `src/App.tsx`, `src/panels/TimelineBar.tsx` | lazy mount above the bar, the resizer, the `Timeline` toggle | 2B |

### 2.2 Model contract

```ts
export type RunTimelineSide = 'blue' | 'red'
export type RunTimelineKind = 'sensor' | 'c2' | 'track' | 'effector' | 'threat'
export interface RunTimelineSpan {
  kind: 'hold' | 'coast' | 'classify' | 'window' | 'prep' | 'flight' | 'burst' | 'dwell' | 'undetected' | 'ghost'
  startS: number
  endS: number
  /** Track estimate quality 0..1 for hold chunks; classification band for classify. */
  level?: number | 'unknown' | 'suspected' | 'hostile'
  label?: string
}
export interface RunTimelineMark {
  kind: 'detect' | 'init' | 'firm' | 'drop' | 'assign' | 'release' | 'shot' | 'hard-kill' | 'mission-kill' | 'miss' | 'jam-decision' | 'arrival' | 'cpa'
  tS: number
  text?: string
  /** Rounds left after a release, or pk at an effect, as display text. */
  after?: string
}
export interface RunTimelineRow {
  key: string
  kind: RunTimelineKind
  label: string
  meta: string
  /** The board entity a click selects; null for a false track. */
  entityId: string | null
  spans: RunTimelineSpan[]
  marks: RunTimelineMark[]
  /** Sensor rows only: one per held track. */
  subLanes?: RunTimelineRow[]
}
export interface RunTimelineGroup {
  key: RunTimelineKind
  side: RunTimelineSide
  label: string
  rows: RunTimelineRow[]
}
export interface RunTimelineModel {
  durationS: number
  horizonS: number
  groups: RunTimelineGroup[]
}
```

Censoring happens in the model, once, with `reached` from `analysis/horizon.ts`. The
component never compares a time with the horizon.

### 2.3 Viewport contract

```ts
export interface TimeViewport { t0S: number; winS: number }
export function clampViewport(v: TimeViewport, durationS: number): TimeViewport
export function followViewport(v: TimeViewport, tS: number, durationS: number): TimeViewport
export function zoomViewport(v: TimeViewport, factor: number, anchorS: number, durationS: number): TimeViewport
export function viewportTicks(v: TimeViewport, widthPx: number): number[]
export function xOf(v: TimeViewport, widthPx: number): (tS: number) => number
```

### 2.4 Code standards

- Pure derivation first. The model and the viewport modules have no React and no DOM.
  Every rule in section 1 that can be a unit test is a unit test on these modules.
- One memo per input. The model memoizes per `TrialResultView` in a `WeakMap` and per
  horizon bucket, as `trialSeries.ts` does. The component maps times to pixels in render
  with `xOf`; it never re-derives items.
- The playhead subscribes to `simTimeS` alone, as today. The plot re-renders on a
  viewport change, a model change or a state change, never on every clock publication.
  Follow updates the viewport once per `PUBLISH_PERIOD_MS`.
- Rows are memoized components keyed by row key. Sub-lane chunks for quality shading are
  5 s wide; do not draw one rect per DT step.
- No new dependency. React SVG as in the current strip. CSS under one `.runtl` prefix in
  `index.css`, tokens only, 11 px floor, mono for machine data, Archivo for labels.
- Keep `censorLane.ts` only if the model uses it. Delete the engagement strip, its test
  and its CSS in Phase 2. Do not leave a dead code path.
- No `useEffect` that mirrors store state into local state. Session state lives in
  `ui.runTimeline`; the component reads it with selectors.
- Preserve the storage key value `rangeboard.engstrip.open`.
- Follow Prettier, named exports, short rationale comments, `check:silent` rules.

## 3. Plan

Four phases. Every phase ends with `npm run check`, `npm run check:silent`,
`npm run check:bundle` after `build`, green docs, evidence where the phase has a browser
check, and the handoff rewritten in place to select the next phase. Lanes run in
worktrees outside the repository (`~/Projects/rangeboard-wt/tl-<lane>`, `node_modules`
symlinked to the main checkout, tests scoped with `--dir src`, no `git stash`). Each
lane owns disjoint files. One integrator owns shared types, the store, schema generation,
shared docs and integration. A worker's report is a claim; the integrator runs the gates.

Worker choice follows the task class: `opus-medium` for a mechanical change with a fixed
contract, `opus-high` for a multi-file build or a diff review, `fable-medium` for a design
judgment, `fable-high` for horizon and observation semantics.

### Phase 1: model, no UI change

Contract commit first (integrator, on the phase branch): add the `fusedTrack` summary
field to `ThreatAssessment` in `src/playback/sim.ts` and the empty modules with the
types in section 2.2 and 2.3, so the three lanes build against one contract.

| Lane | Worker | Owns | Delivers |
| --- | --- | --- | --- |
| 1A retention | `opus-medium` | `src/playback/retainTrial.ts`, `src/playback/retainTrial.test.ts` | `boundAssessment` derives `fusedTrack` from `fusedTracks` before the drop; bound results carry it; a result without `fusedTracks` carries none; `alreadyBound` unchanged |
| 1B model | `opus-high` | `src/analysis/runTimeline.ts`, `src/analysis/runTimeline.test.ts` | `runTimelineOf` per section 2.2 from assessments, `sensorObservations`, `report.events`, `jamDecisions`, `tracks` (latest estimate quality per 5 s chunk) and `fusedTrack`; reuse `engagementReleaseS`, `engagementIsKinetic`, `reached`; tests per rule in section 1.2 and 1.4 on a fixed-id fixture |
| 1C viewport | `opus-medium` | `src/charts/timeViewport.ts`, `src/charts/timeViewport.test.ts` | section 2.3 with tests for clamp at both ends, follow at two thirds, zoom about an anchor at the limits, ticks at 64 px spacing |

Integration: merge the lanes, `npm run schema:generate` if `schema:check` asks for it,
`npm run check`. Review: `opus-high` on the diff; `fable-high` on the censoring rules in
`runTimeline.ts` against ENGINEERING_REFERENCE section 3. Docs: one paragraph in
ENGINEERING_REFERENCE on the run timeline model and the retained `fusedTrack` summary,
then `docs:review`. Exit: gates green; the entry graph is unchanged because nothing
imports the new modules yet; the handoff selects Phase 2.

### Phase 2: the strip

| Lane | Worker | Owns | Delivers |
| --- | --- | --- | --- |
| 2A component | `opus-high` | `src/panels/timeline/**`, `src/index.css` (the `.runtl` block and the resizer rule; the `.engstrip` block is deleted) | the strip per sections 1.1 to 1.4 from props: model, viewport, session state, callbacks; gutter with group headers, rows, sub-lanes, hide controls; plot with clipped spans, marks, duration labels, playhead; axis; overview; component tests for empty state, collapsed default, expansion, hide and show all, censoring at a horizon, viewport mapping |
| 2B state and mount | `opus-medium` | `src/state/store.ts` (`ui.runTimeline` and its actions), `src/state/store.test.ts`, `src/io/storageKeys.ts`, `src/App.tsx`, `src/panels/TimelineBar.tsx`, `src/panels/TimelineBar.test.tsx`, `scripts/e2e/board-shell.e2e.mjs` | the slice with open and height persisted, the rest session only; `RUN_TIMELINE_HEIGHT_KEY`; the lazy mount above the bar in Execute and Analyze; the resizer with pointer capture and a saved height; the `Timeline` toggle with `aria-controls="run-timeline"`; the e2e playback-bar tests renamed and passing |

Integration (`opus-high`): wire 2A to 2B, delete `EngagementStrip.tsx`, its test and
`censorLane.ts` if unused, rewrite the entry-graph freeze with
`node scripts/check-entry-graph.mjs --write` and name the reason (the strip moves to a
lazy chunk), `npm run check`, `npm run check:bundle`. Browser check at 1265 px on the
JIATF-401 laydown: Play at 30x with the strip open, no dropped canvas frame, marks appear
at the horizon and never before it, scrub back and forward changes nothing observed,
Analyze shows the whole record, the height survives a reload. Capture under
`docs/field-te/evidence/run-timeline-p2-<date>/` and run `oxipng`. Docs: the strip
paragraph in PROJECT_GUIDE, the strip rules in DESIGN_SYSTEM, the e2e paragraph in
VERIFICATION, the storage key line in ENGINEERING_REFERENCE, then `docs:review`. Review:
`opus-high` on the diff. Exit: gates green; evidence indexed in `docs/README.md`; the
handoff selects Phase 3.

### Phase 3: interaction

| Lane | Worker | Owns | Delivers |
| --- | --- | --- | --- |
| 3A board link | `opus-medium` | `src/panels/timeline/useRunTimelineSelection.ts`, `src/panels/timeline/useRunTimelineSeek.ts`, their tests | row click selects through the existing selection action; board selection highlights and scrolls the row; mark click dispatches `scrub`; a seek turns Follow off |
| 3B pointer and keyboard | `opus-medium` | `src/panels/timeline/Tooltip.tsx`, `src/panels/timeline/useViewportGestures.ts`, `src/panels/timeline/Overview.tsx`, their tests | tooltip with times, quality and pk; wheel zoom and horizontal scroll; pinch; overview drag; Follow, Fit, Zoom in, Zoom out, Collapse all, Expand all; Escape closes the tooltip; reduced motion respected |

Integration (`opus-medium`): wire, `npm run check`, browser check of every interaction
in section 1.5 with evidence under `docs/field-te/evidence/run-timeline-p3-<date>/`,
docs updated, `docs:review`. Review: `opus-high` on the diff; `fable-high` confirms that
no interaction advances `observedThroughS` (store test plus browser evidence). Exit:
gates green; the handoff selects Phase 4.

### Phase 4: hardening and close

One lane, `opus-high`, then a `fable-medium` design review against the mockup.

- Measure: frame time with the strip open on the 54-entity board at 30x, every group
  expanded, sensors expanded. Target: no canvas frame over 16 ms attributable to the
  strip, measured with the Performance panel. Add row windowing only if the measurement
  fails.
- Accessibility: the strip group label carries the horizon; headers and labels are
  buttons with names; contrast of every mark ink on the panel meets the design system
  table in both themes.
- Remove dead CSS and dead exports the earlier phases left; keep the exports that the
  landmines protect.
- Docs: final review of PROJECT_GUIDE, ENGINEERING_REFERENCE, DESIGN_SYSTEM and
  VERIFICATION; the mockup link in this file stays as the design record.
- Exit: gates green; `npm run test:e2e` green; the handoff records that this plan is
  complete and selects nothing.

## 4. Gates per phase

| Check | Command |
| --- | --- |
| Full local gate | `npm run check` |
| Silent rules on added lines | `npm run check:silent` |
| Entry budget after build | `npm run build && npm run check:bundle` |
| Shell spec | `npm run test:e2e` with a dev server on the `E2E_URL` port |
| Docs | `npm run docs:check` after `docs:review` on every touched reference |

## 5. Risks and landmines

- The entry-graph freeze fails when a module under `src/analysis/`, `src/charts/` or
  `src/panels/analysis/` enters or leaves the entry statically. Phase 2 moves the strip to
  a lazy chunk and rewrites the freeze once, with the reason in the commit.
- `storageManagement.ts` derives live keys from every export of `storageKeys.ts`. Keep
  `ENGSTRIP_OPEN_KEY` exported with its value; add the height key beside it.
- `retainTrial.ts` drops `fusedTracks` in `boundAssessment`. The summary must be derived
  before the drop and must not keep a reference to the per-step list.
- A type change in `ThreatAssessment` may change the runtime schema. Run
  `npm run schema:generate` and commit the generated file; never hand-edit it.
- Fixed-id fixtures only in tests that read Monte Carlo or trial numbers.
- The e2e spec names the engagement strip and the Engagement toggle. Phase 2 renames both
  tests in the same commit as the toggle.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate.
