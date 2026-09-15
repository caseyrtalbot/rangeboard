# RangeBoard design system

Visual rules, tokens, type roles and shared components of the implemented UI in
`src/index.css` and `src/ui/kit.tsx`. The sheet is the source; this file names the rules
it follows. Konva ink colors for the canvas live in `src/ui/ink.ts`.

## 1. Surface rules

1. **Almost nothing is enclosed.** Separation comes from alignment, one hairline rule and
   space. A border marks an input, a segmented group, a `.mini` button or a floating
   surface. A plain button has a transparent border and shows the hover tone.
2. **One radius.** `--radius-control` is 2 px and is the only non-zero `border-radius` in
   the sheet. Containers are square.
3. **Colour is ink.** A state is a text colour, a stroke, or a solid 8 px square. The
   sheet has no `rgba(` tint; hover and selection are the opaque rule tone.
4. **No blur, no shadow.** The sheet has no `box-shadow` and no `backdrop-filter`. The
   right panel is separated from the board by one 1 px rule.
5. **Three surfaces.** Board, panel, and one sunken tone for an input. The board carries an
   inline SVG noise grain at 3.5 percent opacity (`--board-grain`).
6. **Sentence-case labels.** Every `text-transform` in the sheet is `none` or `inherit`.
7. **Two weights.** Every `font-weight` is 400 or 500 through a `--type-*-weight` token.
   `b`, `strong`, `th` and the headings are folded onto the title weight.
8. **Mono for machine data only.** Ids, times, coordinates, units, keys and numeric
   readouts use `--font-mono`. Prose, labels and titles use `--font-ui`.

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
| `--rule` | `#2a2c2b` | row separators; also `--border-subtle`, `--border-default`, `--surface-hover` |
| `--rule-strong` | `#454846` | section separators, control borders (`--border-control`), floating edges, disabled text |
| `--text-primary` | `#ebe9e3` | values, titles; 14.4:1 on panel, measured 2026-09-05 |
| `--text-secondary` | `#a9a9a3` | body, meta; 7.4:1 |
| `--text-tertiary` | `#74766f` | labels at 12 px weight 500; 3.8:1 |
| `--ink` | `#121313` | text on a pressed or primary control |
| `--status-nominal` | `#7fc39a` | state ink; 8.5:1 |
| `--status-warning` | `#e2ad55` | state ink |
| `--status-critical` | `#e46f62` | state ink |
| `--status-inactive` | text 3 | state ink |
| `--ew`, `--de`, `--ghost` | `#7da7c4`, `#9aa8b0`, `#6a7178` | jam channel, directed-energy channel, defeated track |
| `--chart-1` to `--chart-5` | `#3987e5`, `#d95926`, `#199e70`, `#c98500`, `#d55181` | chart series slots, assigned by first detection |

Spacing is `--space-1` (4 px) to `--space-6` (24 px) plus `--panel-pad` (14 px). Motion is
`--dur-fast` 120 ms and `--dur` 140 ms; `prefers-reduced-motion` cuts every transition to
1 ms. A pressed control inverts to text 1 on ink. Focus is a 2 px outline in
`--border-focus`, which is text 1.

**Daylight theme.** The `--paper-*` palette holds the values once: board `#eeebe4`, panel
`#f7f5f0`, sunken `#e4e0d8`, rule `#d8d3c9`, rule strong `#b0aa9e`, text 1 `#212220`
(14.4:1), text 2 `#4e504b` (7.5:1), text 3 `#7b7d73` (3.8:1), ink is the paper board,
nominal `#378154`, warning `#98691b`, critical `#d43725` (4.4:1 each). Two blocks map the
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
the canvas and holds the board center. A selection does not reopen it. Its lifecycle and
analysis navigation sit outside the scroll body. Labels wrap and no panel text may be inaccessible.

## 4. Components

- **Buttons.** 28 px high (5 px pad, 16 px line, 1 px border), 2 px radius, label size and
  weight. Default: transparent border, hover tone on hover, inverted on active. `.primary`:
  filled text 1 on ink. `.danger`: critical text, border on hover. `.mini`: bordered in
  rule strong, meta size. `.active`: hover tone plus text 1. Disabled drops to
  `--text-disabled`.
- **Segmented control** (`Seg` in `src/ui/kit.tsx`, `.seg`). One bordered group with
  hairline dividers drawn as marks; the pressed segment inverts to text 1 on ink;
  `role="group"` with an `aria-label`.
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
- **Track picture** (`TrackLayer.tsx`, constants in `footprintStyle.ts`). In Watch each
  sensor track draws its estimated position as a 3 px screen cross (`TRACK_MARKER_PX`)
  and, when the track carries error, its 1 sigma covariance ellipse in world meters with
  a 1 px screen stroke. Ink is the sage asset ink (`TRACK_ESTIMATE_INK`, `KIND_INK.asset`);
  a false track takes the muted grey of an inert ring (`TRACK_FALSE_INK`). An updated
  track draws solid; a coasting track takes the even `[4, 4]` dash (`TRACK_ELLIPSE_DASH`),
  distinct from every ring dash. A truth-path track draws the cross alone. The layer is
  censored at the observed horizon like every other trial surface.
- **KPI tiles** (`.tiles.c2`, `.tiles.c3`, `.tile`). Two or three columns, no borders.
  Label in text 3 (`.tl`), value in mono at value size with a small denominator (`.tv`).
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

The Board has a 60 px resource rail and an overlaid Library drawer (306 px default,
existing saved width retained). Drawing tools and the View and Range setup disclosures
sit above the canvas. Drawer search receives focus on opening; Escape returns it to the
resource button. Library names and scoped control labels wrap. Scenario input sections
use native disclosures; menus scroll within the available viewport height.

The selected entity workspace keeps its Telemetry / Configure / Model basis tabs outside
one content scroller. Long names, values, source records and statistical subtitles wrap;
source rows disclose labeled fields instead of squeezing evidence into a narrow table.
The canvas readout is 252 px wide, with cursor, speed/heading, altitude and a Details
control. Complete telemetry stays in the canonical pane, including full-path scope labels.
In Execute, Planned path uses the existing detail section header and rows for Planned
arrival and Planned CPA; times retain the machine-data role.

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
