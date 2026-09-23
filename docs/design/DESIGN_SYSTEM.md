# RangeBoard design system

Visual rules, tokens, type roles and shared components of the implemented UI in
`src/index.css` and `src/ui/kit.tsx`. The sheet is the source; this file names the rules
it follows. Konva ink colors for the canvas live in `src/ui/ink.ts`.

## 1. Surface rules

1. **Almost nothing is enclosed.** Separation comes from alignment, one hairline rule and
   space. A border marks an input, a segmented group, a `.mini` button, a panel-body
   action or a floating surface. A plain chrome button has a transparent border and shows
   the hover tone.
2. **Two radii.** A control (button, input, segmented group, checkbox) uses
   `--radius-control`, 4 px. A floating surface uses `--radius-surface`, 6 px. No other
   `border-radius` is non-zero. Docked containers are square.
3. **Colour is ink.** A state is a text colour, a stroke, or a solid 8 px square. Hover and
   selection are the opaque rule tone. The only `rgba(` values in the sheet are the
   `--elev-1` shadow and the `--scrim`.
4. **One elevation.** A floating surface (a menu, popover, palette, readout or tooltip)
   takes `.surface-float`: the raised tone, a 1 px `--rule-strong` border, the 6 px
   radius and `--elev-1`. It is the only element with a `box-shadow`. It enters over
   `--dur-enter` (opacity and a 4 px rise). A modal surface dims the board with
   `--scrim`; the palette and Settings are modal. A top-bar menu (`.tb-menu-panel`: the
   View, Range setup, ROE and file menus and Settings) carries the raised tone, rule,
   radius and entry and also takes `.surface-float` for the shadow. The `.help-dot`
   bubble is a pseudo-element: tone, rule and radius, no shadow. The sheet has no
   `backdrop-filter`. Docked panels cast no shadow: the right panel is separated from the
   board by one 1 px rule.
5. **Four surfaces.** Board, panel, one sunken tone for an input and one raised tone for a
   floating surface. The board carries an inline SVG noise grain at 3.5 percent opacity
   (`--board-grain`).
6. **Sentence-case labels.** Every `text-transform` in the sheet is `none` or `inherit`.
7. **Two weights.** Every `font-weight` is 400 or 500 through a `--type-*-weight` token.
   `b`, `strong`, `th` and the headings are folded onto the title weight.
8. **Mono for machine data only.** Ids, times, coordinates, units, keys and numeric
   readouts use `--font-mono`. Prose, labels and titles use `--font-ui`.
9. **Canvas ink follows the theme.** A Konva layer cannot read a CSS variable. The grid,
   label, link caption and callout leader inks come from `useBoardInk()`
   (`src/canvas/useBoardInk.ts`), which resolves `ui.theme` and `prefers-color-scheme` the
   way the sheet does and returns `BOARD_INK_DARK` or `BOARD_INK_PAPER` from
   `src/ui/ink.ts`. A layer never hard-codes a theme-dependent ink. Board selection is a
   solid 1.5 px ring in text 1 over a 2 px board-tone halo. Hover shows the pointer
   cursor and a 1 px ring in the entity ink at 60 %. A link caption draws only on a link
   of 80 screen px or more whose caption box clears every glyph and anchored label;
   otherwise it draws on hover. A path caption takes the first clear slot back along its
   last leg. `BoardInk` also holds the selection, board-tone, tool and control inks, so the
   selection ring, a selected link, the path draft, the calibrate marks, the connect ring,
   the range button and the marquee read the theme.

## 2. Tokens

Warm graphite, not blue-black. Chrome is monochrome so red, blue and orange stay free to
mean threat, sensor and effector on the board. Components read the semantic names; the
short aliases (`--bg`, `--text`, `--border`, `--accent`, `--danger`, `--good`, `--warn`)
map onto them.

| Token | Value | Use |
| --- | --- | --- |
| `--surface-board` | `#121313` | canvas ground, with the grain |
| `--surface-panel` | `#191a1a` | every panel, flyout, drawer, card |
| `--surface-sunken` | `#0e0f0f` | inputs only |
| `--surface-raised` | `#202121` | floating surfaces only (`.surface-float`) |
| `--rule` | `#2a2c2b` | row separators; also `--border-subtle`, `--border-default`, `--surface-hover` |
| `--rule-strong` | `#454846` | section separators, control borders (`--border-control`), floating edges |
| `--text-primary` | `#ebe9e3` | values, titles; 14.4:1 on panel, measured 2026-09-05 |
| `--text-secondary` | `#a9a9a3` | body, meta; 7.4:1 |
| `--text-tertiary` | `#74766f` | labels at 12 px weight 500; 3.8:1 |
| `--text-disabled` | `#6c6f69` | disabled controls; 3.42:1 on panel, 3.16:1 on raised |
| `--ink` | `#121313` | text on a pressed or primary control |
| `--status-nominal` | `#7fc39a` | state ink; 8.5:1 |
| `--status-warning` | `#e2ad55` | state ink |
| `--status-critical` | `#e46f62` | state ink |
| `--status-inactive` | text 3 | state ink |
| `--ew`, `--de`, `--ghost` | `#7da7c4`, `#9aa8b0`, `#6a7178` | jam channel, directed-energy channel, defeated track |
| `--chart-1` to `--chart-5` | `#3987e5`, `#d95926`, `#199e70`, `#c98500`, `#d55181` | chart series slots, assigned by first detection |
| `--radius-control` | 4 px | buttons, inputs, segmented groups, checkboxes |
| `--radius-surface` | 6 px | floating surfaces |
| `--elev-1` | `0 8px 24px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.3)` | the one shadow, floating surfaces only |
| `--scrim` | `rgba(0,0,0,.32)` | the board under a modal floating surface |

Spacing is `--space-1` (4 px) to `--space-6` (24 px) plus `--panel-pad` (14 px). Motion is
`--dur-fast` 120 ms, `--dur` 140 ms and `--dur-enter` 120 ms for the floating-surface entry
(`@keyframes surface-enter`); `prefers-reduced-motion` cuts every transition and animation
to 1 ms. A pressed control inverts to text 1 on ink. Focus is a 2 px outline in
`--border-focus`, which is text 1.

**Daylight theme.** The `--paper-*` palette holds the values once: board `#eeebe4`, panel
`#f7f5f0`, sunken `#e4e0d8`, raised `#fbfaf7`, rule `#d8d3c9`, rule strong `#b0aa9e`,
text 1 `#212220` (14.4:1), text 2 `#4e504b` (7.5:1), text 3 `#7b7d73` (3.8:1), disabled
`#8c877d` (3.28:1), ink is the paper board, nominal `#378154`, warning `#98691b`, critical
`#d43725` (4.4:1 each), elevation `0 8px 24px rgba(33,34,32,.12)`, scrim
`rgba(33,34,32,.2)`. Two blocks map the
palette onto the semantic tokens: `:root[data-theme='light']` for the manual switch and
`@media (prefers-color-scheme: light)` for the OS setting, with `data-theme='dark'` as the
override. The switch is a `Seg` in Board View controls (`system`, `dark`, `light`); the choice is
the `theme` field of the saved view record. Channel colours are the same in both themes;
the contrast findings for them on paper are in
`../field-te/evidence/design-step4-2026-09-05/findings.json`.

## 3. Type

Two faces. Archivo carries the interface at weights 400 and 500. JetBrains Mono carries
machine data at 400 and 500. Both are self-hosted woff2 files under `src/assets/fonts` with
their OFL licences, declared by `@font-face` in `index.css`. The JetBrains Mono files are
subset to Latin plus the non-ASCII code points the source uses, with every layout feature
kept; the two 400 faces are preloaded from `index.html`. `font-variant-numeric:
tabular-nums` is set on `:root`.

| Role | Tokens | Size and weight |
| --- | --- | --- |
| display | `--type-display-*` | 26 / 500 |
| value | `--type-value-*` | 24 / 400 |
| title | `--type-title-*` | 13 / 500 |
| body | `--type-body-*` | 13 / 400 |
| meta | `--type-meta-*` | 12 / 400 |
| label | `--type-label-*` | 12 / 500, text 3, sentence case |
| machine | `--type-machine-*` | 12 / 400, mono |
| dense | `--type-dense-size` | 11 |

The floor is 11 px. No `font-size` rule in the sheet is below it. Only dense machine rows
reach it: the detail and register tables, the event ledger, the phase chips, the timeline
axis and rows, and the KPI sub-line. The Board right panel defaults to 408 px (280 px minimum, 560 px maximum, capped at
44 percent of the viewport); an existing saved width is preserved. The right panel is a
drawer: the drawer button at the right end of the top bar, or `]`, closes and opens it,
and a resize drag 60 px past the minimum also closes it. A closed drawer gives its width to
the canvas and holds the board center. A selection does not reopen it. The header is 40 px high. It carries the lifecycle tabs in
its center and the run status at the start of its right group; the phase row is gone. Its
groups keep a 24 px column gap (`--space-6`). Below 1600 px the status chips fold into the
ROE button, which shows a `+N` count in mono warning ink and lists them in its panel; a
failed save stays in the bar. The lifecycle navigation sits outside the scroll body. The
analysis screen navigation also sits outside it, draws only on the Overview tab, and draws
no segmented control for a phase with one screen. Labels wrap and no panel text may be
inaccessible.

## 4. Components

- **Buttons.** 28 px high (5 px pad, 16 px line, 1 px border), 4 px radius, label size and
  weight. Default: transparent border, hover tone on hover, inverted on active. `.primary`:
  filled text 1 on ink; the main run action on a screen is `.primary`. `.danger`: critical
  text, border on hover. `.mini`: bordered in rule strong, meta size. `.active`: hover
  tone plus text 1. Disabled drops to `--text-disabled`. A panel-body action
  (`.inspector-body button`) draws a 1 px `--rule-strong` frame, disabled included;
  register rows, table sort headers and danger actions keep their own edges. A disabled
  action states its reason in its title and in a muted line beside it.
- **Segmented control** (`Seg` in `src/ui/kit.tsx`, `.seg`). One bordered group with
  hairline dividers drawn as marks; the pressed segment inverts to text 1 on ink; a
  disabled segment draws in `--text-disabled`; `role="group"` with an `aria-label`.
- **Key hints.** A key at the right end of a menu or palette row is
  `<kbd class="kbd kbd-hint">`: mono, text 3, no chip. A separator above Delete is
  `.ctx-sep`, 1 px `--rule`. The command palette is 560 px wide with 32 px rows under
  one group header per category.
- **Status chips.** A top-bar status chip that acts is a button with no frame; it keeps
  the chip look.
- **Icons** (`src/ui/icons.tsx`). One inline SVG set for chrome glyphs: library, objects,
  commands, undo, redo, close and caret. Each is a 16 px viewBox with a 1.5 px round
  stroke in `currentColor` and `aria-hidden`; the button that holds it carries the label
  or title. A chrome control uses this set, not a text glyph.
- **Inputs.** Sunken fill, rule strong border, text 2 border on hover, 2 px focus outline.
  A unit sits inside the field in mono text 2 (`.nu-unit`). Only a field that accepts
  input carries a frame.
- **Field** (`Field`, `.field`). Label above the control in label size; an optional help
  dot after the label; an optional unit after the control.
- **State** (`State`, `.state`). A solid 8 px square and a word in one state ink. `hollow`
  outlines the square for an undecided or qualifying count; `live` clips it to a circle.
- **Provenance mark** (`ProvMark`, `.prov-mark`). One 8 px shape in a fixed 36 px column
  after a value: filled for sourced, hollow for a planning factor, half for estimated,
  dashed for probable, a circle for inferred; `absent` keeps the column and drops the
  mark. The hover title carries the word and source line. `PfTag` in
  `src/panels/inspector/kit.tsx` maps a spec field's provenance row onto it.
- **Track picture** (`TrackLayer.tsx`, constants in `footprintStyle.ts`). During a sampled
  trial each sensor track draws its estimated position as a 3 px screen cross
  (`TRACK_MARKER_PX`) and, when the track carries error, its 1 sigma covariance ellipse
  in world meters with a 1 px screen stroke. Ink is the sage asset ink
  (`TRACK_ESTIMATE_INK`, `KIND_INK.asset`); a false track takes the muted grey of an
  inert ring (`TRACK_FALSE_INK`). An updated track draws solid; a coasting track takes
  the even `[4, 4]` dash (`TRACK_ELLIPSE_DASH`), distinct from every ring dash. A
  truth-path track draws the cross alone. The layer is censored at the observed horizon
  like every other trial surface.
- **KPI tiles** (`.tiles.c2`, `.tiles.c3`, `.tile`). Two or three columns, no borders.
  Label in text 3 (`.tl`), value in mono at value size with a small denominator (`.tv`).
  A tile label reserves two lines (`min-height: 2.4em`) so the values in a row align.
- **Inspector rows** (`.insp-row`). Flex rows, 28 px minimum height, baseline aligned,
  bleeding to the panel padding line.
- **Per-threat table** (`.tb.tb-dense`, the kill-chain table on Now and the outcome table
  on Outcome). One row per track. Fixed layout: each column header carries its width as a
  percentage, so the three or four time columns hold their width and the name and result
  columns take the slack. Cells are mono at `--type-dense-size`. In the right panel a
  dense cell clips with an ellipsis and never wraps; the full text is in the cell
  `title`. Each header is a sort button with `aria-sort`; an abbreviated header (D, ID,
  ENG, FX, Slv, Arr) spells its meaning and unit in the button title. A result or state
  word is a `State` in its ink: leaked or engaged critical, active or targeted warning,
  identified hollow, defeated in `--ghost`.
- **Inventory bar** (`.rr-bar`, `.rr-bar-fill`; the effector row on Now). An
  `.insp-row` with the effector name and `remaining/capacity` in mono, then a 3 px bar
  in `--border-subtle` with the remaining fraction filled in `--accent`. The bar is a
  `role="meter"` with min, max, now and a value text. A jam or HPM channel shows a full
  bar and `cont.`.
- **Sweep map** (`SweepMap` in `src/charts/SweepMap.tsx`, on Fragility). A CSS grid with
  one label column plus one column per value of the first factor, and one row per value
  of the second factor (one row, `Full run`, with one factor), all in `--font-mono` at
  `--type-dense-size` with `--space-1` gaps. Each cell is filled on a three-step scale of
  the displayed values' range: `--status-nominal`, `--status-warning`,
  `--status-critical`, ordered so the better third is nominal. The value prints in
  `--ink` on the fill. A cell with no value is unfilled: a dash in `--text-secondary`
  while pending, a check mark in `--status-nominal` when complete. The caption states the
  scale, the replicates per cell and that the thirds are relative, never a requirement.
  Each cell title carries the factor values, response, replicates, horizon and interval.

The Board has a 76 px resource rail, wide enough for "Commands" at the meta size, and an
overlaid Library drawer (306 px default, existing saved width retained). The drawer starts
below the canvas tools row and stops above the timeline. A library row shows its Model
basis action only on hover or keyboard focus. Drawing tools and the View and Range setup
disclosures sit above the canvas. The board editing tools (Select, Boundary, Connect, Path
and Range setup) show only in Prepare. Outside Prepare the palette, the Inspector and the
context menu offer no action that starts a tool, and `setBoardPhase` returns the tool to
Select. After a delete or a place, a `.surface-float` cue at the canvas bottom left, above
the timeline, shows `<verb> <name> · Undo ⌘Z`. It fades during the last 15 % of 4 s,
reduced motion cuts it at 4 s, and undo, redo or a load clear it. The name truncates
first, the cue takes no pointer events, and the timeline scrub keeps its 120 px floor. An empty board shows one hint, a `.surface-float` at
the canvas top left with an "Open library (L)" action. Drawer search receives focus on opening; Escape returns it to the
resource button. Library names and scoped control labels wrap. Scenario input sections
use native disclosures; menus scroll within the available viewport height. Fire doctrine
and Environment have one editor, Prepare > Inputs. Settings > Scenario links to it with a
framed panel-body action.

The selected entity workspace keeps its Telemetry / Configure / Model basis tabs outside
one content scroller. Long names, values, source records and statistical subtitles wrap;
source rows disclose labeled fields instead of squeezing evidence into a narrow table.
The canvas readout is a floating surface, 252 px wide, with the keys Cursor, Speed /
heading and Altitude, a Details control and a solid leader in text 2 at 60 %. Complete telemetry stays in the canonical pane, including full-path scope labels.
In Execute, Planned path uses the existing detail section header and rows for Planned
arrival and Planned CPA; times retain the machine-data role.

Analyze has one run control, the header Run button beside the screen tabs. A screen body
in Analyze does not draw its own run button.

Each analysis screen is one labeled section with one basis line (`.analysis-scope`)
under its heading and one caveat per section header, never on a tile. Tiles are `.tiles.c3` with the denominator and horizon inside the tile. Records,
findings and evidence products use native disclosures (`.analysis-disclosure`). A
placeholder before the first Play is one muted line. The band chart on Compare draws the
95 % band in `--rule-strong`, the ensemble mean in `--text-secondary`, the trial in
`--chart-1` with its endpoint marked, and the pinned baseline mean dashed in
`--text-tertiary`; its axis labels are mono at `--type-dense-size`. The delta table flag
is a `State`: `inside` nominal, `outside` warning. Findings link to Prepare without
changing data until an input is edited. Chart scope text reads “Shown
through T+m:ss” or “No outcomes observed yet” in the legend accessibility label, or a
visually hidden span when there is no legend. A preview playhead may show a later time.
These reuse existing chart and text tokens.
