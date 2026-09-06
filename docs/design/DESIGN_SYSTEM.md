# RangeBoard design system

This file describes the visual rules, tokens, type roles and shared components of the
implemented UI in `src/index.css` and `src/ui/kit.tsx`. The design was locked on
2026-09-05 and its first four steps shipped: self-hosted fonts, one token layer, one shared
kit, and the daylight theme. Every rule below was checked against the source on 2026-09-06.

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
override. The switch is a `Seg` in the toolbar (`system`, `dark`, `light`); the choice is
the `theme` field of the saved view record. Channel colours are the same in both themes;
the contrast findings for them on paper are in
`../field-te/evidence/design-step4-2026-09-05/findings.json`.

## 3. Type

Two faces. Archivo carries the interface at weights 400 and 500. JetBrains Mono carries
machine data at 400 and 500. Both are self-hosted woff2 files under `src/assets/fonts` with
their OFL licences, declared by `@font-face` in `index.css`. `font-variant-numeric:
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
axis and rows, and the KPI sub-line. The right panel is 320 px wide (280 px minimum) and no
element under it may overflow.

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
- **KPI tiles** (`.tiles.c2`, `.tiles.c3`, `.tile`). Two or three columns, no borders.
  Label in text 3 (`.tl`), value in mono at value size with a small denominator (`.tv`).
- **Inspector rows** (`.insp-row`). Flex rows, 28 px minimum height, baseline aligned,
  bleeding to the panel padding line.
