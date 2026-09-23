# Plan

This file is the frozen queue. Do not edit it when a row lands, and do not record
completion here. Progress lives only in [HANDOFF.md](HANDOFF.md). That file always
links here and selects exactly one row. After that row's gate passes, rewrite the
handoff so its Tasking section is the next row in the order table, and leave this
file unchanged.

Authored against local `main` at `293f7bd` (2026-09-23). Line numbers are positions
at authorship; confirm them before an edit.

## Source

The frontend design and UX review of 2026-09-23 found 36 findings. It drove the dev
server with Playwright in dark mode at 2100 × 1325, 1600 and 1440, and in light mode, on
the fixture `docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json`. The
screenshots stayed outside the repository. Each finding below has an ID (V visual
finish, F friction, U user functionality, C canvas), its location and its change. A lane
works from this table.

## Findings

| ID | Location | Change |
| --- | --- | --- |
| V1 | Palette, context menu, connect popover, readout, menus, Storage, Settings, tooltips: no elevation | Apply the Row A floating surface: raised tone, 6 px radius, `--elev-1`, 1 px border |
| V2 | `index.css:400-413`: panel actions have a transparent border and read as text | Panel-body actions get a `--rule-strong` border; the main run action on a screen is `.primary` |
| V3 | `--text-disabled` is `--rule-strong`, 1.88:1 on panel | Dark `#6c6f69` (3.42:1 panel, 3.16:1 raised); paper `#8c877d` (3.28:1 panel) |
| V4 | `CommandPalette.tsx:204-213`, `index.css:2852-2915`: category prefix on each row, no keys, no scrim | Group headers per category, right-aligned key in mono text 3, 560 px wide, 32 px rows, `--scrim` |
| V5 | `TrackFileReadout.tsx:70-75` (CURSOR, SPEED / HDG, ALT), `DebriefRecord.tsx:204` (COMPLETE), `Toolbar.tsx:322,327,332` (WEZ On, Env Derate, Spawn In Ring) | Sentence case. The finding words in `runValidityText.tsx:35-36` wait on D6 |
| V6 | `index.css:3820,3836-3842`: Evidence products header in mono, green left rule | UI font at title size; rule in `--rule` |
| V7 | `index.css:3243-3256`: a wrapped tile label pushes its value 13 px down | `.tl { min-height: 2.4em }` or subgrid rows |
| V8 | Execute: one-option segmented control "Now" draws a full-width inverted bar | Do not render the screen navigation for a phase with one screen |
| V9 | `Inspector.tsx:282`, `index.css:1819`: ring override "Global" wraps | `.insp-rings .seg button { white-space: nowrap; padding: 4px 8px }` |
| V10 | `ConnectSuggestPopup.tsx:50-53,112-117`, `index.css:2555`: mark column gap, dismiss touches title | `.suggest-meta .prov-mark { width: 8px }`; title text 1 at title weight; 20 px dismiss button right |
| V11 | `index.css:4292-4297` column flow puts the info button on its own line; label "apply" (`EnvironmentSettings.tsx:20`) | Row flow, centered, `--space-2` gap; label "Apply effects" |
| V12 | `index.css:341`: top bar grid has no column gap; tabs touch the run status at 1440 | `column-gap: 24px`; below 1600 px fold ROE, warning and saved chips into one status button (D7) |
| V13 | Rail and undo/redo use text glyphs (⊞ ⌖ ⌘ ↶ ↷) | One inline SVG set, 16 px, 1.5 px stroke, `currentColor` |
| V14 | Menus and the palette appear with no transition | 120 ms opacity and 4 px entry; reduced motion keeps the 1 ms cut |
| F1 | Palette: a mouse click in the list moves focus to the body; Escape then does nothing (`interactionRouter.ts:102`, `App.tsx:509-535`) | `onMouseDown={(e) => e.preventDefault()}` on `.cmdk-list`; panel `tabIndex={-1}`; one regression test |
| F2 | `App.tsx:140-141,593`: "Keys" opens the palette, which shows no keys | Label "Commands", title with ⌘K |
| F3 | `FragilityScreen.tsx:301-311,364-380`: disabled actions give no reason | A title and a muted line with the reason, for example "Run Monte Carlo first" |
| F4 | Fire doctrine and Environment are editable in Settings and in Prepare > Inputs | One editor per D2 |
| F5 | `App.tsx:842-846`: screen tabs stay visible under Selected object; "‹ Overview" repeats the Overview tab | Render the screen navigation only for the analysis tab; remove "‹ Overview" |
| F6 | `EntityWorkspace.tsx:89-95` and `inspector/kit.tsx:137-145` both show name and type | Keep the header with the state mark |
| F7 | Execute keeps Boundary, Connect, Path and Range setup | Per D3 |
| F8 | At 1440 the Library drawer covers the canvas tools and the play button | Drawer starts below the canvas tools row and stops above the timeline |
| F9 | `Palette.tsx:419-429`: "Model basis" on every library row | Show on row hover or focus |
| F10 | `NowScreen.tsx:141`, `LiveStrip.tsx:46`: "Press Play in Execute" inside Execute | Inline Play button; drop "in Execute" in that phase |
| F11 | Analyze has a header Run control and a "Run Monte Carlo" button | Per D4 |
| F12 | `FragilityScreen.tsx:329-345`: bare "Two factors" label, no gap between field groups | `className="check-row"`; `gap: var(--space-3)` on the wrapper |
| U1 | Empty first-run board has no guidance | Top-left hint "Add a system: press L or right-click the board" with "Open library (L)"; see D5 |
| U2 | Context menu and tool buttons show no keys | Right-aligned key in mono text 3; separator above Delete |
| U3 | No undo cue exists in `src` | Per D8: timeline status line "Deleted KuRFS 1 · Undo ⌘Z", fades after 4 s |
| U4 | No hover state on entities; cursor stays `auto` | Pointer cursor on entity enter; 1 px ring in entity ink at 60 % |
| U5 | `Toolbar.tsx:330-334`: "Spawn in ring" warning is a span | A button that selects the entity |
| C1 | `GridLayer.tsx:29-30`, `EntityLayer.tsx:724`, `CalloutLayer.tsx:31`, `ConnectionLayer.tsx:84`: dark-only ink; paper labels 1.61:1 | Read the Row A board ink. Paper: grid `#dcd7cd` / `#c9c3b8`, label `#4e504b` (6.9:1), link `#5c5f57` (5.5:1) |
| C2 | `ConnectionLayer.tsx:70-86`, `PathLayer.tsx:57-64`: captions outside `layoutLabels` collide at the origin | Hide a link caption under 80 screen px (show on hover); path caption joins the layout as an obstacle |
| C3 | `ConnectionLayer.tsx:83`: 10 px caption under the 11 px floor | 11 px |
| C4 | Selection is a thin dashed ring; readout leader dashed at 45 % | Solid 1.5 px ring in text 1 with a 2 px board-tone halo; solid leader at 60 % |
| C5 | `camera.ts:30-32`: proportional margin, labels ignored; the cluster lands on the canvas edge | Fixed 64 px screen padding and label boxes in the fit |

## Decisions

Each decision has a default. A row that waits on a decision uses the default unless the
user chose otherwise before the row starts.

| ID | Question | Default | Waits |
| --- | --- | --- | --- |
| D1 | Adopt the design-system rule changes in Row A | Adopt all | Row A |
| D2 | Which surface edits Fire doctrine and Environment | Prepare > Inputs edits; Settings links to it | C1 |
| D3 | Editing tools during Execute | Hide outside Prepare | C2 |
| D4 | Which Analyze run control stays | The header Run control; remove the body button on Compare | C3 |
| D5 | "Load example" on the empty board | No; hint and "Open library (L)" only (bundle budget) | B3 |
| D6 | Sentence case for LIMITS, INVALIDATES, PENDING | No change; `AGENTS.md` protects finding wording | none |
| D7 | Fold the top-bar chips below 1600 px | Yes | B5 |
| D8 | Undo cue after delete and place | Yes | C4 |

## Do not mix

- No change to engine logic, statistics, provenance marks, or the wording of findings and
  caveats. New UI hint text is allowed; changed finding text is not.
- The entry gzip budget is 365,000 bytes with about 0.5 kB headroom (`check-bundle.mjs`).
  Icons and new components add entry bytes. Run `npm run build && npm run check:bundle`
  at every gate. Do not raise the budget without the user.
- `src/index.css` is shared. Each lane owns the selector blocks listed for it. Add a new
  rule inside or directly after an owned block. Never append at the end of the file,
  never reorder blocks, and never edit an unowned block. Report a needed change in an
  unowned block to the integrator.
- Only Row A and the integrator edit `docs/design/DESIGN_SYSTEM.md`. A lane reports the
  rule and token text its change needs.
- Lanes run in their own worktrees. Scope tests with `npx vitest run --dir src`. Never
  run bare `npx vitest run` while a worktree exists in the repository.
- Keep JSX button labels on one line (Prettier can split `children`).
- Every layer stays inside `SceneErrorBoundary`. Keep the draw identity and memo
  invariants in [ENGINEERING_REFERENCE.md](ENGINEERING_REFERENCE.md#3-hard-architectural-invariants).
- Do not split `store.ts` or `Inspector.tsx`.

## Order

| Row | Content | Parallel | Waits on | Worker |
| --- | --- | --- | --- | --- |
| A | Foundation: tokens, floating surface, board ink, icons, design system | Serial | D1 | `opus-medium` |
| B | Wave 1: lanes B1 to B5, then B-int | Five lanes | A merged | per lane |
| C | Wave 2: lanes C1 to C4, then C-int and the final capture | Four lanes | B merged | per lane |

One row is one agent turn for the orchestrator. Inside rows B and C the orchestrator
launches the lanes in one message, then integrates.

## Row A. Foundation

Findings: V3, the token part of V1 and V14, the ink part of C1, the icon part of V13.

Owns:

- `src/index.css` token blocks only: `:root` (40-110), the paper `:root` (189-215), the
  light blocks (217-260), and one new block directly after them for `.surface-float`
  and `@keyframes surface-enter`.
- `src/ui/ink.ts`; new `src/canvas/useBoardInk.ts`; new `src/ui/icons.tsx`.
- `docs/design/DESIGN_SYSTEM.md` and its `docs:review`.

Work:

1. Tokens: `--surface-raised` (`#202121`, paper `#fbfaf7`); `--radius-control: 4px`;
   `--radius-surface: 6px`; `--elev-1` (dark `0 8px 24px rgba(0,0,0,.45), 0 1px 2px
   rgba(0,0,0,.3)`, paper `0 8px 24px rgba(33,34,32,.12)`); `--scrim` (dark
   `rgba(0,0,0,.32)`, paper `rgba(33,34,32,.2)`); `--text-disabled` per V3;
   `--dur-enter: 120ms`.
2. `.surface-float`: raised background, `--rule-strong` border, `--radius-surface`,
   `--elev-1`, `surface-enter` animation (opacity 0 to 1, `translateY(4px)` to 0).
   `prefers-reduced-motion` keeps its 1 ms cut.
3. Board ink: a dark and a paper table in `ink.ts` for grid minor, grid major (canvas
   and airspace), label, link caption, callout leader. `useBoardInk()` resolves `ui.theme`
   and `prefers-color-scheme` and returns one table. No layer changes in this row.
4. Icons: library, objects, commands, undo, redo, close, caret. 16 px viewBox, 1.5 px
   stroke, `currentColor`, `aria-hidden`.
5. `DESIGN_SYSTEM.md`: rewrite rules 2 to 5 and the token table for the new values. Add
   the rule "Canvas ink follows the theme." Keep monochrome chrome, mono for machine
   data, sentence case, two weights, the 11 px floor and the contrast floors.

Gate: `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`,
`npm run check:silent`, `npm run build && npm run check:bundle`, `npm run docs:check`.
Browser: dark and light at 2100 and 1440 show the 4 px control radius and readable
disabled text with no layout shift. Record the entry gzip bytes and the headroom in the
handoff for Row B.

Stop: tokens, class, ink table, hook and icons exist and are documented. No component
uses them yet except through global tokens.

## Row B. Wave 1

Five lanes run in parallel, each in its own worktree from the Row A tip. The files and
CSS blocks of each lane are disjoint.

### B1. Floating surfaces and the palette

Worker `opus-medium`, budget 3600 s. Findings: V1 (surfaces), V4, V10, V14 (apply),
F1, U2.

Owns: `src/panels/CommandPalette.tsx`, `src/canvas/ContextMenu.tsx`,
`src/canvas/ConnectSuggestPopup.tsx`, `src/panels/ViewMenu.tsx`,
`src/panels/RangeSetupMenu.tsx`, `src/ui/StorageMenu.tsx`, `src/ui/StoragePanel.tsx`,
`src/panels/Tooltip.tsx`, `src/panels/analysis/Info.tsx`, new
`src/panels/CommandPalette.test.tsx`. CSS: `.tb-menu-panel` to `.tb-menu-row` (674-747),
`.help-dot` (1649-1690), `.ctx-*` (2442-2527), `.connect-suggest` and `.suggest-*`
(2528-2567), `.info-dot`, `.info-pop`, `.tooltip`, `.kbd` (2683-2756); reuse `.kbd` for key hints, `.cmdk-*` (2852-2915),
`.settings-panel` and its backdrop (4780-4800).

Must not touch: `.seg button, .cmdk-input` (1770-1773, B4), `App.tsx`, the readout.

Gate: scoped tests for the owned files, typecheck, lint, format, `check:silent`. Browser:
palette, context menu, connect popover, View, Range setup, Storage, Settings and a
tooltip in dark and light; Escape closes the palette after a click in the list.

### B2. Canvas legibility

Worker `opus-high`, budget 5400 s. Findings: C1 (apply), C2, C3, C4, C5, U4, V5
(readout keys), V1 (readout surface).

Owns: `src/canvas/layers/GridLayer.tsx`, `EntityLayer.tsx`, `CalloutLayer.tsx`,
`ConnectionLayer.tsx`, `PathLayer.tsx`, `src/canvas/labelLayout.ts` and its test,
`src/canvas/CanvasStage.tsx`, `src/canvas/TrackFileReadout.tsx` and its test,
`src/state/camera.ts`. CSS: `.readout` and `.ro-host` to `.ro-details` (829-928) and `.readout.compact`
(4490-4507).

Must not touch: `store.ts`, other layers, `LiveScene.tsx` unless the label inputs need
it (report first).

Gate: scoped tests including `labelLayout.test.ts`, `EntityLayer.test.tsx`,
`CanvasStage.test.tsx`, `TrackFileReadout.test.tsx`; typecheck, lint, format,
`check:silent`. Browser: the fixture origin cluster at 2100 and 1440 in dark and light;
no caption overlaps a glyph or a label; hover shows the pointer and the ring; paper
labels at least 4.5:1.

### B3. Right panel and board shell

Worker `opus-high`, budget 5400 s. Findings: F2, F5, F6, F8, F9, F10, V8, U1 (D5), V13
(rail).

Owns: `src/App.tsx`, `src/panels/EntityWorkspace.tsx` and its test,
`src/panels/inspector/kit.tsx` (header only), `src/panels/analysis/AnalysisNavigation.tsx`
and its test, `src/panels/analysis/screens/NowScreen.tsx`,
`src/panels/analysis/LiveStrip.tsx` and its test, `src/panels/Palette.tsx` and its test,
`scripts/e2e/board-shell.e2e.mjs`. CSS: `.palette*` (932-1060), `.right-panel` to
`.right-panel-body` (1186-1280), `.board-panel-heading` (4030-4040),
`.board-resource-rail` to `.board-placement` (4171-4288), `.entity-workspace-header`
and `.entity-workspace-scroll` (4372-4409).

Note: the e2e test clicks the "‹ Overview" button that F5 removes. Update that test to
use the Overview tab.

Gate: scoped tests for the owned files, typecheck, lint, format, `check:silent`,
`npm run test:e2e` against a dev server on a free port (`E2E_URL`). Browser: Prepare,
Execute and Analyze with and without a selection; the empty board; the drawer at 1440.

### B4. Panel controls and forms

Worker `opus-medium`, budget 3600 s. Findings: V2, V5 (COMPLETE), V6, V7, V9, V11, F3,
F12.

Owns: `src/panels/analysis/screens/FragilityScreen.tsx`,
`src/panels/analysis/EnvironmentSettings.tsx`, `src/panels/analysis/DebriefRecord.tsx`
and its test. CSS: `button` to `button.mini:hover` (400-483), `.insp-rings` (1496-1503),
`.field` to `.check-row` (1507-1610), `.seg` (1749-1822), `.tiles` to `.tile .ts`
(3236-3301), `.debrief-*` (3815-3850), `.prepare-setting-controls` (after 4297),
`.evidence-products` (4717-4728). `.prepare-setting-controls` shares a selector with
two other blocks at 4290-4297: add a separate rule after it, do not edit the shared one.

Gate: scoped tests for the owned files, typecheck, lint, format, `check:silent`. Browser:
Fragility, Inputs, Settings Scenario, a sensor's rings, Outcome tiles in dark and light.
Every panel action has a visible frame; every disabled action states a reason.

### B5. Top bar

Worker `opus-medium`, budget 2700 s. Findings: V12 (D7), V5 (chips), U5, V13 (undo and
redo).

Owns: `src/panels/Toolbar.tsx` and its test. CSS: `.toolbar` to `.scenario-name`
(339-398), `.tb-glyph` to `.tb-caret` (632-672), `.status-pills` (1062-1066),
`.board-phases` (3997-4028).

Gate: scoped tests, typecheck, lint, format, `check:silent`. Browser: top bar at 2100,
1600 and 1440; no two groups touch; the tabs stay centered from 1600 up.

### B-int. Integration

The orchestrator merges B1 to B5 in that order, resolves any `index.css` conflict by
block ownership, then runs `npm run check`, `npm run build && npm run check:bundle`,
and `npm run test:e2e`. It recaptures every stage and overlay in dark and light at 2100
and 1440, edits `DESIGN_SYSTEM.md` for any rule a lane reported, runs `docs:review`,
and rewrites the handoff to Row C. It removes the worktrees.

## Row C. Wave 2

Four lanes run in parallel from the Row B tip. Each waits on its decision.

| Lane | Findings | Owns | Worker, budget |
| --- | --- | --- | --- |
| C1 | F4 (D2) | `src/panels/SettingsPanel.tsx`, `src/panels/settings/`, `src/panels/analysis/FireDoctrineSettings.tsx`, `src/panels/analysis/EnvironmentSettings.tsx`, `src/panels/BoardPreparation.tsx` and their tests | `opus-medium`, 3600 s |
| C2 | F7 (D3) | `src/panels/Toolbar.tsx` board tools and its test | `opus-medium`, 2700 s |
| C3 | F11 (D4) | `src/panels/analysis/RunControl.tsx`, `src/panels/analysis/screens/CompareScreen.tsx` and their tests | `opus-medium`, 2700 s |
| C4 | U3 (D8) | `src/panels/TimelineBar.tsx` and its test; a read-only selector for the last undoable action | `opus-medium`, 3600 s |

C4 reads history state from the store. If the store has no label for the last action,
C4 stops and reports; the integrator adds the store field.

### C-int. Integration and final capture

Merge C1 to C4, run the Row B integration checks, recapture the full shot set, and
compare it against the 36 findings. Record in the handoff each finding that is closed,
changed by a decision, or open with its reason.
