# Plan

This file is the frozen queue. Do not edit it when a row lands, and do not record
completion here. Progress lives only in [HANDOFF.md](HANDOFF.md). That file always
links here and selects exactly one row. After that row's gate passes, rewrite the
handoff so its Tasking section is the next row in the order table, and leave this
file unchanged.

Authored against local `main` at `76074bb` (2026-09-24). Line numbers are positions
at authorship; confirm them before an edit.

## Source

The chrome audit of 2026-09-24 (`~/Downloads/rangeboard-chrome-audit.md`) found nine
core problems and 18 quick wins outside the board canvas. Three chrome options were
rendered on a Design canvas; Option C, the dense pro console, was chosen. A second canvas
re-rendered Option C with the inspector text-density pass. The two canvases are the
visual source for every row below. Nothing on the canvas is a pixel spec; the token sheet
on the first canvas is.

- Options A, B, C and the shared token sheet: <https://claude.ai/artifact/8bWcNT4F1UYorsuZnNnaW9>
- Option C with the text-density pass: <https://claude.ai/artifact/5HAE99aeahPA3Fkmkrvz6v>

Audit problems, referenced as P1 to P9 in the rows:

| ID | Problem |
| --- | --- |
| P1 | No single primary action per phase: Run, Play and New run compete |
| P2 | Repetition: run id three times, scenario name three times, ROE twice, library twice, import and export in three places |
| P3 | Two stacked inspector tab levels in two styles; Selected object shown with nothing selected |
| P4 | Ten control heights; dropdowns, segments and buttons each styled differently |
| P5 | Top bar, tool row and panel headers on different baselines |
| P6 | Labels carry units, defaults and help text; slider values live inside labels |
| P7 | Muted text fails WCAG AA; unlabeled icon buttons; 14 px info targets |
| P8 | Declutter presets duplicate the View layer toggles and take about 300 px |
| P9 | Transport controls active in Prepare with no run |

The text-density pass adds one rule: gray text does four jobs (status, rule, method note,
first-run instruction) and each job gets a home. Status becomes control state. A rule
becomes a placeholder and an error line shown only when the field is invalid. A method
note goes behind a 24 px (i). A first-run instruction becomes an empty-state row that the
first result replaces. A per-panel "Show field help" switch brings every sentence back as
a normal-weight line. No full sentence is set in muted gray.

## Decisions

Each decision has a default. A row that waits on a decision uses the default unless the
user chose otherwise before the row starts.

| ID | Question | Default | Waits |
| --- | --- | --- | --- |
| D1 | Status inks | Keep nominal, warning and critical. Add `--status-limit` `#e0894b` for LIMITS tags. The four-hue CVD set on the token sheet is not adopted | Row A |
| D2 | Primary action fill | One accent, `#7ba7e8`, ink text; `.primary` becomes 32 px. The board channel inks are unchanged | Row A |
| D3 | Entry gzip budget (367,000 bytes, 1,276 bytes of headroom at `76074bb`) | No lane raises it. Icons enter `src/ui/icons.tsx` only for the chrome; library per-type icons render from `Glyph.tsx` shapes already in the entry. Removals (Declutter control, Model library tab, library footer, frame-name input, the second RunControl) must pay for additions. The A gate measures; a shortfall goes to the user | Row A, B-int |
| D4 | Rail destinations Layers and Frames | Route to existing surfaces: Layers opens the View menu at its Layers section; Frames opens the frames strip. No new docked panels | B3 |
| D5 | Storage | Folds into the scenario ⋯ menu as its last item; the Storage panel opens from there | B1 |
| D6 | "Show field help" | Off by default. Stored as `ui.showFieldHelp` in the saved view record next to `rightTab`; one switch in the inspector ⋯ menu | Row A, C1, C2 |
| D7 | Primary action per phase | Prepare: Run. Execute: Pause, Resume when paused. Analyze: Run again. One `RunControl` in the top bar; the body instances are removed | B1 |
| D8 | Status bar below 1440 px | Cells drop from the right in this order: units, MC, seed. Run id, phase, T+, ROE and validity never drop | B4 |
| D9 | Transport when no run exists | Not rendered in Prepare. In Execute and Analyze it renders at 28 px above the status bar | B4 |

## Do not mix

- No change to engine logic, statistics, provenance marks, or the wording of findings and
  caveats. Moving a finding paragraph behind a headline row is allowed; changing its
  words is not.
- The entry gzip budget rule is D3. Run `npm run build && npm run check:bundle` at every
  gate. Do not raise the budget without the user.
- `src/index.css` is shared. Each lane owns the selector blocks listed for it. Add a new
  rule inside or directly after an owned block. Never append at the end of the file,
  never reorder blocks, and never edit an unowned block. Report a needed change in an
  unowned block to the integrator.
- Only Row A and the integrator edit `docs/design/DESIGN_SYSTEM.md`. A lane reports the
  rule and token text its change needs.
- Lanes run in their own worktrees. Scope tests with `npx vitest run --dir src <file>`.
  Never run bare `npx vitest run` while a worktree exists in the repository.
- Keep JSX button labels on one line. Sentence case everywhere. Mono for machine data
  only. Four text sizes: 11, 12, 13, 15. Three control heights: 24, 28, 32.
- Every icon-only button carries `aria-label` and a `title` that ends with its key in
  parentheses. Every (i) is a 24 px button.
- Do not split `store.ts` or `Inspector.tsx`.
- `scripts/e2e/board-shell.e2e.mjs` reads `.toolbar`, `.timeline`, `.canvas-host` and
  `[aria-label="Analysis screens"]`. A lane that renames one updates the e2e in the same
  change.

## Order

| Row | Content | Parallel | Waits on | Worker |
| --- | --- | --- | --- | --- |
| A | Foundation: tokens, control heights, icons, store flag, design system | Serial | D1, D2, D6 | `opus-medium` |
| B | Chrome bands: lanes B1 to B4, then B-int | Four lanes | A merged | per lane |
| C | Inspector and density: lanes C1 to C4, then C-int and the final capture | Four lanes | B merged | per lane |

One row is one agent turn for the orchestrator. Inside rows B and C the orchestrator
launches the lanes in one message, keeps working, then integrates. Every lane brief
states the worktree, the owned files, the gate command, the report shape and a time
budget of 1,800 seconds (Row A: 900 seconds). The lane's report is a claim. The
orchestrator runs the gate or reads the diff before it counts a lane done.

Reviews are two, not one per lane. `opus-high` reviews the B-int diff and the C-int diff
for correctness against this file. `fable-medium` reviews the final capture against the
two canvases once, after C-int, and reports deviations as follow-ups; it changes nothing.

## Row A. Foundation

Serial. `opus-medium`. Budget 900 seconds.

Owns:

- `src/index.css` token blocks only: `:root` (40-110), the paper `:root` (189-215), the
  light blocks (217-260), and the `.surface-float` block after them.
- `src/ui/kit.tsx`, `src/ui/icons.tsx`, `src/state/store.ts` (the `ui` slice and the
  saved view record only), `docs/design/DESIGN_SYSTEM.md` and its `docs:review`.

Work:

1. Tokens. `--text-tertiary: #8c8e88` (5.3:1 on panel; paper keeps `#7b7d73`).
   `--accent: #7ba7e8`, `--accent-ink: #121313` (paper accent `#2f6fc4`, ink paper).
   `--status-limit: #e0894b` (paper `#a85a1c`). `--h-dense: 24px`, `--h-default: 28px`,
   `--h-primary: 32px`. `--type-dense-size` stays 11; add `--type-lead-size: 15px` for the
   panel title and the clock. No other size token.
2. Kit. `.primary` reads `--h-primary`, `--accent` fill, `--accent-ink` text, weight 500.
   `.mini` reads `--h-dense`. Every other button reads `--h-default`. `Field` gains a
   `help` prop: when set, the label row ends in a 24 px (i) button (`aria-label="About
   <label>"`) whose title holds the text; when `ui.showFieldHelp` is true the text also
   renders as a `.field-help` line (12 px, text 2) under the control. `Field` gains an
   `error` prop that renders a `.field-error` line (11 px, critical) under the control and
   sets `aria-invalid` on the child. `Field` gains a `suffix` prop for the unit, rendered
   inside the frame in mono text 2 (`.nu-unit` exists; reuse it).
3. Icons. Add to `src/ui/icons.tsx`: settings, more, drawer, entities, layers, frames,
   play, pause, reset, info, chevron down, chevron right, plus, search, pencil. Same
   contract as the seven that exist. No per-type library icons here (D3).
4. Store. `ui.showFieldHelp: boolean` with `setShowFieldHelp`, persisted in the saved
   view record beside `rightTab` (`store.ts:124,513,1314`). Default false. One test in
   the existing store view test file.
5. `DESIGN_SYSTEM.md`. Rewrite section 4 Buttons for the three heights and the accent
   primary. Add the accent and limit tokens to the section 2 table. Add rule 10: "Gray
   text has four jobs" with the four homes and the muted-sentence ban. Add the (i)
   and `Field` help, error and suffix contracts to the Field entry.

Gate: `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`,
`npm run build && npm run check:bundle`, `npm run docs:review -- docs/design/DESIGN_SYSTEM.md
--note "…"`, `npm run docs:check`. Report the entry gzip bytes.

## Row B. Chrome bands

Four lanes in one message, then B-int.

### B1. Top bar. `opus-medium`

Owns `src/panels/Toolbar.tsx` (the `Toolbar` header, lines 340-437), `src/ui/StorageMenu.tsx`,
`src/panels/analysis/RunControl.tsx` (mount point only), `src/panels/analysis/AnalysisNavigation.tsx:30`
and `src/panels/analysis/ForecastSettings.tsx:97` (remove the body `RunControl`),
`index.css` blocks `.toolbar` to `.toolbar-left > .scenario-name` (389-460), `.tb-menu-wrap`
to `.tb-menu-row` (741-850), `.board-run-context` (4308). Tests: `Toolbar.test.tsx`,
`RunControl.test.tsx`.

Work: bar height 36. Order: brand · scenario name (pencil affordance on hover, `F2`
focuses the input) · phase tabs centered (unchanged markup; active tab in text 1 with a
2 px `--accent` underline; the `num` in mono, accent when active) · `RunControl` as the
one `.primary` per D7 · Settings icon · ⋯ menu (New, Import, Export, separator, Storage
per D5) · drawer toggle. Remove `board-run-context` and `status-pills` from the bar; B4
takes them. The scenario name renders once (P2). Keep the equal side tracks and the
1024 px floor from the polish run. Solves P1, P2, P5.

Gate: `npm run typecheck`, `npx vitest run --dir src src/panels/Toolbar.test.tsx
src/panels/analysis/RunControl.test.tsx`, `npm run lint`, `npm run format:check`.

### B2. Tool row. `opus-medium`

Owns `src/panels/Toolbar.tsx` (`BoardTools`, lines 440-509), `src/panels/ViewMenu.tsx`,
`src/panels/RangeSetupMenu.tsx`, `index.css` blocks `.board-tools` to `.board-tools > .seg
button` (4564-4700) and `.toolbar > .seg button.tb-glyph` (728-740). Tests:
`Toolbar.test.tsx` (the `BoardTools` cases only; B1 and B2 edit disjoint `describe`
blocks and the integrator merges).

Work: row height 28; every control `.mini` (24 px). Drawing tools stay a segmented group
with the new icons and `title="Select (V)"` style keys. `Range setup` becomes a `Range`
select-style trigger with the same look as `View`. `DeclutterControl` is deleted from the
row; its four presets become a `Preset` section at the top of the View menu (a `Seg`), and
the floating "Declutter" label is gone. Undo and Redo keep their icons and gain
`title="Undo (⌘Z)"` and `title="Redo (⇧⌘Z)"` with the key visible in the tooltip. Outside
Prepare the drawing group and Range are not rendered (unchanged). Solves P4, P7, P8.

Gate: `npm run typecheck`, `npx vitest run --dir src src/panels/Toolbar.test.tsx
src/panels/ViewMenu.test.tsx` (create the ViewMenu test if none exists, sized like
`Toolbar.test.tsx`), `npm run lint`, `npm run format:check`.

### B3. Rail and library. `opus-high`

Owns `src/App.tsx` (`ResourceRail`, lines 118-156, and its props at 767-773 only),
`src/panels/Palette.tsx`, `src/panels/Glyph.tsx` (read only; per-type shapes),
`index.css` blocks `.board-resource-rail` (4452-4480) and `.palette` to `.palette-item`
(1038-1170). Tests: `Palette.test.tsx`, the rail cases in `App` tests if any.

Work: rail 44 px, five destinations in order: Library, Entities (renamed from Objects
everywhere the rail is concerned; the register keeps its own heading), Layers, Frames,
Commands at the bottom. Layers and Frames route per D4. Each button: 32 px, icon from
`icons.tsx`, `aria-label`, `title` with the key, a 2 px active mark on the left edge in
text 1. Library panel: header 32 px with the title, a ⋯ button (Import library, Export
library, Reload built-in) and Close; the footer is removed. Filter field 24 px. Rows 36 px:
line 1 name at 13/500 with ellipsis (no wrapping parentheticals: the vendor moves to
line 2), line 2 vendor · type at 11 px mono text 3. The row glyph is the per-type
`Glyph` shape, not the dome. Group headers keep their counts in mono; the collapse button
gains `aria-label="Collapse <group>"` and `aria-expanded`. "Model basis" on a row shows
on hover or focus (already so). Solves P2, P7.

Gate: `npm run typecheck`, `npx vitest run --dir src src/panels/Palette.test.tsx`,
`npm run lint`, `npm run format:check`, `npm run build && npm run check:bundle`.

### B4. Transport and status bar. `opus-medium`

Owns `src/panels/TimelineBar.tsx`, new `src/panels/StatusBar.tsx` and
`StatusBar.test.tsx`, `src/App.tsx` (the `TimelineBar` and `EngagementStrip` mount at
834-835 and the `Toolbar` props at 752-759 only), the `RoeMenu` and chip markup moved out
of `Toolbar.tsx` (B1 removes it; B4 re-mounts it; the integrator resolves the seam),
`index.css` blocks `.timeline` to `.timeline select` (2509-2560), `.status-pills` (1170-1200)
and one new `.status-bar` block directly after `.timeline`. Tests: `TimelineBar.test.tsx`,
`StatusBar.test.tsx`; `scripts/e2e/board-shell.e2e.mjs` where it reads `.timeline`.

Work: status bar 24 px, sunken tone, 11 px mono, cells left to right: run id, phase,
`T+m:ss / m:ss`, `seed`, `MC n / N`, grow, ROE chip (the `RoeMenu` with its folded chips;
read-only look, click opens the menu as today), units `nm · ft MSL` (read from the saved
view), `Validity n` with a `LIMITS` tag in `--status-limit` when n > 0. D8 governs the
narrow width. Transport per D9: 28 px, `.mini` controls: play or pause, reset icon
(`title="Reset run (⇧R)"`, replaces the "New run" text), clock, scrubber, speed select,
`+ Frame` (prompts for a name with `window.prompt` replaced by an inline 24 px popover
that holds one input and Save; the permanent frame-name input is removed), Engagement
toggle. The run id and the clock leave the transport; the status bar carries them (P2).
Solves P1, P2, P9.

Gate: `npm run typecheck`, `npx vitest run --dir src src/panels/TimelineBar.test.tsx
src/panels/StatusBar.test.tsx`, `npm run lint`, `npm run format:check`.

### B-int. Integration. Orchestrator, then `opus-high` review

Merge B1 to B4 into `chrome/int`. Resolve the `Toolbar.tsx` seam (B1 header, B2
`BoardTools`, B4 chip move) and the `App.tsx` seam (B3 rail, B4 mounts). Then `npm run
check`, `npm run test:e2e`, `npm run check:bundle`. Update `DESIGN_SYSTEM.md` section 3
(the top bar paragraph) and section 4 (status chips, key hints) with the text the lanes
reported. `opus-high` reviews the integration diff against Rows A and B and reports
defects; the orchestrator fixes them on `chrome/int`. Merge to `main` only with the
user's authorization.

## Row C. Inspector and density

Four lanes in one message, then C-int and the final capture.

### C1. Inspector frame. `opus-medium`

Owns `src/App.tsx` (`TABS` 75-95, `PanelTabs` 158-190, the `right-panel` markup 838-870,
the `setRightTab('inspect')` sites 468 and 615), `src/panels/analysis/AnalysisNavigation.tsx`,
`src/panels/analysis/screens/navigation.ts`, `src/panels/analysis/screens/PlacementScreen.tsx:148-149`,
`index.css` blocks `.right-panel` to `.inspector-body.insp > .insp-header` (1349-1540).
Tests: `AnalysisNavigation.test.tsx`, `PlacementScreen.test.tsx`, the tab cases in the
`App` tests.

Work: one tab row. The Model library tab is removed (`TABS:77`); the left panel owns the
library. The Selected object tab renders only while an entity is selected, with the
entity name as its label and a 6 px accent dot; selection focuses it (the `615` site
already switches to it). The parent tab row and the screen row merge into one row in one
style: `Inputs · Fragility · Placement` in Prepare, `Run monitor` in Execute (no
segmented control for one screen, unchanged), `Outcome · Compare` in Analyze, then the
contextual entity tab last. "Where to put it" becomes "Placement" in the navigation
table, the screen heading and its `aria-label`; test strings follow. The
`board-panel-heading` becomes a 32 px header: the phase word (`Prepare`, `Execute`,
`Analyze`) at 13/500 and a ⋯ button whose menu holds `Show field help` (a switch bound
to `ui.showFieldHelp`), `Collapse all`, `Expand all`. Solves P2, P3, P5.

Gate: `npm run typecheck`, `npx vitest run --dir src src/panels/analysis/AnalysisNavigation.test.tsx
src/panels/analysis/screens/PlacementScreen.test.tsx`, `npm run lint`, `npm run
format:check`, `npm run test:e2e` (it reads `[aria-label="Analysis screens"]`).

### C2. Fragility density. `opus-high`

Owns `src/panels/analysis/screens/FragilityScreen.tsx` and its test,
`src/panels/analysis/SensitivityWidget.tsx` and its test, `src/panels/analysis/runValidityText.tsx`
(rendering only; finding words unchanged), `index.css` block `.frag` if one exists, else
one new block directly after `.inspector-actions button.mini` (1761).

Work, per the density canvas:

1. Monte Carlo: the line "Monte Carlo · No current ensemble result." becomes a `State`
   chip `No ensemble` (warning, hollow). "Run Monte Carlo first to pin a baseline. Run
   settings are in the Inputs tab." becomes a `Field`-style help line that renders only
   when `ui.showFieldHelp` is true; the disabled Pin as baseline keeps its title reason.
2. Sweep map: the header gains a mono readout `n cells · 40 reps/cell`; the estimate
   sentence moves into the (i) with the planning-factor note. The value fields use
   `Field` with `suffix` for the unit, a placeholder `2–6 values, comma-separated`, and
   `error` set only while the field is invalid, with the rule sentence as the error text.
   The disabled Run sweep keeps `title="Enter valid factor values"`; the muted line
   beside it is removed.
3. Sensitivity: "No defended asset; response unavailable." becomes a `State` chip `No
   defended asset` and a `.mini` action `Place asset` that opens the library at Assets.
   "Morris screening, then Sobol indices on the fields it keeps" moves into the
   section (i). The progress line during a run is unchanged.
4. Validity: each finding renders as a 28 px headline row (glyph, headline, chevron);
   the paragraph and "Review finding scope" open on click. The headline is the first
   clause of the finding text, unchanged in wording. With `ui.showFieldHelp` true the
   rows render open.
5. Tests: update the string assertions listed in `FragilityScreen.test.tsx:209-246,
   474-490` to the new homes; add one case each for the error line, the help switch and
   the finding row toggle.

Solves P6, P7.

Gate: `npm run typecheck`, `npx vitest run --dir src src/panels/analysis/screens/FragilityScreen.test.tsx
src/panels/analysis/SensitivityWidget.test.tsx`, `npm run lint`, `npm run format:check`.

### C3. Telemetry. `opus-medium`

Owns `src/panels/EntityWorkspace.tsx`, `src/panels/analysis/detail/ThreatDetail.tsx`,
`src/panels/analysis/detail/DetailSection.tsx`, `src/panels/analysis/detail/detailRows.tsx`,
`src/canvas/TrackFileReadout.tsx` (the popover; values one line each), `index.css`
block `.detail-ghost` and the detail blocks after it (4829-4900). Tests: `Detail.test.tsx`,
`EntityWorkspace.test.tsx`, `TrackFileReadout.test.tsx`.

Work: the four provenance chips under the object header become one `Model basis` row
(value in text 2, a (i) whose title lists the four sources). The readout becomes four
collapsible sections: `Track` open by default; `Engagement`, `Path` and `Phase` collapsed
with a mono summary in the header (`2 kinetic · 1 landed · 0 kills`; `CPA T+10:03 ·
arrival T+9:35`). Every value is one line: a value that would wrap moves its second
clause into the row title (hover) or a `.mini` drill-in (`1 sensor ›` for Held by). The
altitude band goes into the altitude (i). The status sentence at the top ("Running ·
Simulated trial · observed through …") is removed; the status bar carries the run state
and T+ (P2). Solves P2, P6.

Gate: `npm run typecheck`, `npx vitest run --dir src src/panels/analysis/detail/Detail.test.tsx
src/panels/EntityWorkspace.test.tsx src/canvas/TrackFileReadout.test.tsx`, `npm run lint`,
`npm run format:check`.

### C4. Inputs forms. `opus-medium`

Owns `src/panels/analysis/EnvironmentSettings.tsx`, `FireDoctrineSettings.tsx`,
`RequirementSettings.tsx`, `ForecastSettings.tsx` and their tests,
`src/panels/settings/inputs.tsx`, `index.css` blocks for `.field` and `.nu-unit` (report
the line numbers in the brief after Row A lands).

Work: every field uses `Field` with `suffix` for its unit and a placeholder `Auto` where
a blank means a derived default; the derivation sentence ("blank = 20000 from sky") goes
into the (i). Slider rows keep only the noun in the label and show a right-aligned mono
readout (`12 kt`, `270°`). The Deterministic checkbox is labelled by its noun
(`Deterministic (fixed seed)`) and sits under the run forecast line. The two forecast
lines collapse into one mono line `MC 80 / 2000 · seed 4821`; the stopping rule moves to
its title. Solves P6, P7.

Gate: `npm run typecheck`, `npx vitest run --dir src src/panels/analysis/ForecastSettings.test.tsx
src/panels/analysis/RequirementGates.test.tsx`, `npm run lint`, `npm run format:check`.

### C-int. Integration, review, capture. Orchestrator, `opus-high`, `fable-medium`

Merge C1 to C4 into `chrome/int`. `npm run check`, `npm run test:e2e`, `npm run
check:bundle`. `opus-high` reviews the C diff against Rows A to C. Then the final
capture: the dev server with Playwright at 1440 × 900 in dark mode on the fixture
`docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json`, in Prepare with a
system selected, in Execute mid-run and in Analyze, plus the Fragility tab with help off
and on. Store the capture under `docs/field-te/evidence/chrome-2026-<date>/` with a
`findings.json` per [VERIFICATION.md](VERIFICATION.md). `fable-medium` compares the
capture with the two canvases and lists deviations as follow-ups in the handoff. Update
`DESIGN_SYSTEM.md` and its `docs:review`. Rewrite the handoff: position, the follow-ups,
no row selected. Merge to `main` only with the user's authorization.
