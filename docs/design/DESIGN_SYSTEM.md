# RangeBoard design system

Visual rules, tokens, type roles and shared components of the implemented UI in
`src/index.css` and `src/ui/kit.tsx`. The sheet is the source; this file names the rules
it follows. Konva ink colors for the canvas live in `src/ui/ink.ts`.

## 1. Surface rules

1. **Almost nothing is enclosed.** Separation comes from alignment, one hairline rule and
   space. A border marks an input, a segmented group, a `.mini` button, a panel-body
   action, the run monitor card or a floating surface. A plain chrome button has a transparent border and shows
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
   radius and entry and also takes `.surface-float` for the shadow. A field's method
   note is the native `title` of its `.field-info` button, so it draws no surface of
   its own. The sheet has no
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
9. **Canvas ink follows the theme.** A Konva layer cannot read a CSS variable. Every
   board ink comes from `useBoardInk()` (`src/canvas/useBoardInk.ts`), which resolves
   `ui.theme` and `prefers-color-scheme` the way the sheet does and returns
   `BOARD_INK_DARK` or `BOARD_INK_PAPER` from `src/ui/ink.ts`. A layer never hard-codes a
   theme-dependent ink. `BoardInk` holds the grid, label, link caption and callout leader
   inks; the selection, board-tone, tool and control inks (the selection ring, a selected
   link, the path draft, the calibrate marks, the connect ring, the range button and the
   marquee); the dim link ink (`#6a7178` night, `#767d84` paper) for a probable or
   inferred link; the knob rim (`#121415` night, text 1 on paper); the at-rest ring ink
   `ringIdle` (`#f4f3ee` night, text 1 on paper); and the identity and amplifier inks:
   `hostile` (`#e46f62`, `--status-critical`; paper `#d43725`), `unknown` and `neutral`
   (`#e6cf5a`; paper `#98691b`), `friend` (`#7fbfe6`; paper `#2862b0`), `ew` (`#5ad1e0`,
   `--ew`; paper `#227f8c`), `ghost` (`#6a7178`; paper `#666c74`), `destroyed`
   (`#cfd4cc`; paper `#4e504b`), `noTrack` (`#82887e`; paper `#7b7d73`) and `warn`
   (`#e6cf5a`; paper `#98691b`). Every one clears 3:1 on its board (`src/ui/ink.test.ts`).
   `boardInk(entity, ink)` gives an entity one hue per affiliation: friend for a sensor,
   effector, C2 node or asset, hostile for a threat, neutral for a marker. An explicit
   entity colour wins; a model colour stays on the palette, the library and the run
   timeline and never reaches the board. Board selection is a solid 1.5 px ring in text 1
   over a 2 px board-tone halo. Hover shows the pointer cursor and a 1 px ring in the
   entity ink at 60 %. A link caption draws only on a link of 80 screen px or more whose
   caption box clears every glyph and data block; otherwise it draws on hover. A path
   caption takes the first clear slot back along its last leg; an ISR CAP draws a dashed
   ingress leg and circle in the entity ink with one caption at the east point, and its
   draft circle and radius readout take the selection ink. The system rotation handle,
   the move-underlay outline, the placement preview (an outline ground frame with its
   function icon at 0.7 opacity, a `[4, 4]` dashed leader and a one-line block) and a
   measurement (a 1.5 px line, `[6, 4]` dashed while it follows the cursor, a dot on a
   point end, and a mono readout over the glyph halo above its midpoint) take the
   tool ink (8.8:1 night, 5.3:1 paper). The data block and a spoke callout draw over a
   board-tone glyph halo (`LABEL_HALO_PX`, a 2.5 px stroke under the fill, 1.25 px outside
   each letter), so a flight path, a leader or a coverage tint does not run through the
   text and no filled patch shows over a tint. The block sits right of the frame at
   `DATA_BLOCK_X[kind]` with its first baseline 4 px under the centre; a heading knob that
   would cover it flips it to the left of the frame, right-aligned (`anchoredBlockPos`),
   and the handle keeps its 34 px reach. A spoke callout draws line one of the block.
10. **Board symbology follows the primer.** The frame carries identity and the icon
    carries function (`src/panels/Glyph.tsx` is the one symbol library; `symbols.tsx`
    draws its Konva twins, so the palette and the board agree). Every frame is a closed
    line frame with a board-tone knockout; no symbol on the board is filled. Air track: a
    circle for pending, unknown and friend, a diamond for suspect and hostile, a square
    for neutral; pending and suspect are dashed; until a sensor holds the track the truth
    draws a grey `noTrack` diamond at 0.7. Ground system: a circle for equipment, a
    rectangle for a unit (C2) and a rectangle with a top bar for an installation (the
    defended asset), with the 2525 radar, sensor, launcher and laser icons or the text
    EW, C2 and DA inside; under 16 px (`ICON_MIN_PX`) the letter S, E, EW, C2 or DA
    stands in. A radar's boresight tick starts at the frame edge. A switched-off system is
    a dashed frame at 0.55. Amplifiers: white corner brackets (17 px) while a track is
    targeted or engaged; the 2525D engagement bar above the frame in the object's hue
    with board-tone text, `ASN` assigned, `ENG` engaging, `MIF` missile in flight, with the
    suffix `M`, `GN`, `EA` or `DE` (`ENG-DE` and `ASN ?` are house codes); a cyan `J`
    beside a jammed track; one slash for a mission kill; a solid ghost frame under a
    destroyed X for a hard kill; a yellow condition bar under a sensor that cannot hold
    the selected threat; `EMPTY` in white under a spent effector. The velocity leader is
    the distance the track flies in 10 s, held between 10 and 48 px. The data block reads
    the designator, `×N` for a raid and one word (`HK`, `MK`, `LOST`, `CST`) on line one,
    and altitude in hundreds of feet with speed in knots on line two while the track is
    held. Nothing on the board blinks.
11. **Gray text has four jobs.** Status, rule, method note and first-run instruction.
    Each job has its own home. Status becomes control state. A rule becomes a placeholder
    and an error line that shows only when the field is invalid. A method note goes behind
    a 24 px (i) button. A first-run instruction becomes an empty-state row that the first
    result replaces. A per-panel "Show field help" switch (`ui.showFieldHelp`) renders
    every help sentence as a `.field-help` line. No full sentence is set in muted gray.

## 2. Tokens

Warm graphite, not blue-black. The chrome has one accent, for the primary action and the
active mark. Red, blue and orange stay free to mean threat, sensor and effector on the
board, and the board channel inks are unchanged. Components read the semantic names; the
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
| `--text-tertiary` | `#8c8e88` | labels at 12 px weight 500; 5.27:1 on panel, 4.87:1 on raised |
| `--text-disabled` | `#6c6f69` | disabled controls; 3.42:1 on panel, 3.16:1 on raised |
| `--ink` | `#121313` | text on a pressed control |
| `--accent` | `#7ba7e8` | the `.primary` fill and the active mark |
| `--accent-ink` | `#121313` | text on the accent; 7.56:1 |
| `--status-nominal` | `#7fc39a` | state ink; 8.5:1 |
| `--status-warning` | `#e2ad55` | state ink |
| `--status-critical` | `#e46f62` | state ink |
| `--status-limit` | `#e0894b` | the LIMITS tag on a validity count; 6.52:1 |
| `--status-inactive` | text 3 | state ink |
| `--ew`, `--de`, `--ghost` | `#5ad1e0`, `#9aa8b0`, `#6a7178` | the one friendly EW ink (jam channel, beam, footprint, the J), directed-energy channel, defeated track |
| `--chart-1` to `--chart-5` | `#3987e5`, `#d95926`, `#199e70`, `#c98500`, `#d55181` | chart series slots, assigned by first detection |
| `--radius-control` | 4 px | buttons, inputs, segmented groups, checkboxes |
| `--radius-surface` | 6 px | floating surfaces |
| `--h-dense` | 24 px | `.mini` control height |
| `--h-default` | 28 px | default control height |
| `--h-primary` | 32 px | `.primary` control height |
| `--type-lead-size` | 15 px | the panel title, the clock and a KPI tile value |
| `--elev-1` | `0 8px 24px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.3)` | the one shadow, floating surfaces only |
| `--scrim` | `rgba(0,0,0,.32)` | the board under a modal floating surface |

Spacing is `--space-1` (4 px) to `--space-6` (24 px) plus `--panel-pad` (14 px). Motion is
`--dur-fast` 120 ms, `--dur` 140 ms and `--dur-enter` 120 ms for the floating-surface entry
(`@keyframes surface-enter`); `prefers-reduced-motion` cuts every transition and animation
to 1 ms. A pressed control inverts to text 1 on ink. Focus is a 2 px outline in
`--border-focus`, which is text 1. The board (`.canvas-host`) takes focus for its shortcuts
but shows no focus ring; selection and the hooked object are its focus cues.

**Daylight theme.** The `--paper-*` palette holds the values once: board `#eeebe4`, panel
`#f7f5f0`, sunken `#e4e0d8`, raised `#fbfaf7`, rule `#d8d3c9`, rule strong `#b0aa9e`,
text 1 `#212220` (14.4:1), text 2 `#4e504b` (7.5:1), text 3 `#7b7d73` (3.8:1), disabled
`#8c877d` (3.28:1), ink is the paper board, nominal `#378154`, warning `#98691b`, critical
`#d43725` (4.4:1 each), accent `#2862b0` with accent ink the paper board (5.09:1 under the ink, 5.56:1 on the
paper panel), EW `#227f8c` (3.9:1 on the paper board), limit
`#a85a1c` (4.65:1 on the paper panel), elevation `0 8px 24px rgba(33,34,32,.12)`, scrim
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
| lead | `--type-lead-size` | 15, the panel title, the clock and a KPI tile value |

The floor is 11 px. No `font-size` rule in the sheet is below it. Only dense machine rows
reach it: the detail and register tables, the event ledger, the phase chips, the timeline
axis and rows, and the KPI sub-line. The Board right panel defaults to 408 px (280 px minimum, 560 px maximum, capped at
44 percent of the viewport); an existing saved width is preserved. The right panel is a
drawer: the drawer button at the right end of the top bar, or `]`, closes and opens it,
and a resize drag 60 px past the minimum also closes it. A closed drawer gives its width to
the canvas and holds the board center. A selection does not reopen it.

The top bar is one 36 px row with three grid columns. Equal side tracks keep the
lifecycle tabs at the bar center down to the 1024 px floor; each side keeps a floor, and
its groups keep a 24 px column gap (`--space-6`). Below about 1115 px a group at its floor
pushes the tabs aside and does not cover them. Left to right the bar holds the brand word,
the scenario name, the phase tabs, the phase's primary action, Settings, the ⋯ menu and
the drawer toggle. The scenario name is a borderless input that renders once: it shows a
pencil and a rule on hover and focus, and `F2` focuses it from anywhere in the bar. The
selected phase tab is text 1 over a 2 px accent underline, and its step number is mono
and accent. One `RunControl` holds the bar's single `.primary` button (32 px, accent
fill), and its label follows the phase: Prepare reads Run, then Stop, then Stopping while
the pool ends; Execute reads the transport word (Play, Pause, Resume when paused, Replay,
Retry); Analyze reads Run again. The mono progress line ends in an ellipsis before the
button. The button ends in a `kbd.run-key` that shows ⌘↵ in the button ink, and its title
ends `(⌘↵)`. Meta+Enter (Ctrl+Enter off macOS) runs the phase's primary action unless
focus is in a text field. The run mode is not in the bar: Mode (Monte Carlo or
Deterministic) sits in the Run section of Prepare > Inputs, and the Run tab of Settings
keeps the run mode control. Settings, the ⋯ menu and the drawer toggle are 28 px
icon-only buttons with an `aria-label` and a title. The ⋯ menu holds New, Import and
Export, then a separator, then Storage, which opens the Storage panel in place of the
menu; while recovery notices exist the Storage item shows a warning state with the count
and the ⋯ trigger shows a warning dot. The panel keeps a 14 px right margin on a narrow
window. The run status and the status chips live in the status bar, not the top bar.

The status bar is the last row of the board column: 24 px, `--surface-sunken`, 11 px
mono. It carries, left to right, the run id, the run phase, `T+m:ss / m:ss`, the seed and
`MC n / N`, a grow cell, then the ROE chip, the display units and `Validity n`. The count
takes a `LIMITS` tag in `--status-limit` when a finding exists. Below 1440 px the units
cell drops, below 1280 px MC, and below 1152 px seed; the run id, phase, clock, ROE and
validity cells never drop. The transport sits above it in Execute and Analyze only: 28 px,
`.mini` controls. It holds play or pause (Replay and Retry are icon-only 24 px buttons
too), the Reset run icon, the scrubber, speed, the raid
waves, the frame chips, `+ Frame` (a popover with one name field and Save) and the
Timeline toggle (`#run-timeline-toggle`). The clock and the run id render only in the status bar.

The lifecycle navigation sits outside the scroll body. The right panel has no header:
the selected top-bar tab names the phase. It opens with one 32 px tab row in 12/500 that
holds the phase's screens (Inputs · Fragility · Placement in Prepare; Monitor in Execute;
Outcome · Compare in Analyze), then the contextual tab: the selected object's name after
a 6 px accent dot, shown only while something is selected. The ⋯ Panel options menu ends
the row, pushed right. It holds Show field help (a switch, off by default), Collapse all
and Expand all, which act on every `details` and every collapsible section in the panel
body. The selected tab is marked by a 2 px underline in text 1; the accent stays for the
primary action. A long object name ends in an ellipsis at half the row width. The Model
library editor opens in the Library drawer, not in the right panel. Labels do not wrap,
and no panel text may be inaccessible.

In Prepare and Analyze one 30 px Validity line sits under the tab row, outside the
scrolling body. It is the one place in the panel where validity findings render: the
label, the state word, the finding count and a chevron. It opens in place, invalidating
findings first; a finding with a fix carries its action. Prepare reads the forecast;
Analyze reads the completed trial and reads PENDING before one. Execute shows the line
only after the status-bar Validity button opens it. A selection made from a panel row
keeps the current tab and adds the contextual tab; a board selection switches to it.

Right panel layout rules:

- **Grid.** The panel grid (`.pgrid`) has four equal columns with 12 px gutters. A control
  spans one, two or four columns (`.pg-1`, `.pg-2`, `.pg-4`), so boxes in one section
  share edges with the boxes above them.
- **Width.** The layout holds from 280 to 560 px. `.right-panel` is a size container
  (`right-panel`), and the rules key on the panel width, never on the viewport. Under
  360 px the grid folds to two columns, a four-option segmented control (`.seg.pg-seg4`)
  becomes 2 × 2, and low-value columns and the word beside a state square drop. A dropped
  value stays in the row or cell `title`.
- **Edge.** Every section title and the first tab label start on the 14 px content edge.
  A disclosure chevron hangs in the left padding (`PanelSection` in
  `src/ui/PanelSection.tsx`, `.psec-chev`).

## 4. Components

- **Buttons.** Three heights and no fourth, 4 px radius, label size and weight. `.mini`
  is 24 px (`--h-dense`: 3 px pad, 16 px line, 1 px border), bordered in rule strong, meta
  size. The default button is 28 px (`--h-default`: 5 px pad, 16 px line, 1 px border):
  transparent border, hover tone on hover, inverted on active. `.primary` is 32 px
  (`--h-primary`: 7 px by 12 px pad): the `--accent` fill with `--accent-ink` text at
  weight 500. Its hover keeps the fill at `brightness(1.08)` and its press at
  `brightness(0.92)`, so the ink stays legible. The top-bar Run is the phase's one
  `.primary`. An analysis screen's own run action (Run sweep, Run sensitivity) is a
  `.mini` button at the end of its section head. `.danger`: critical text, border on hover. `.active`: hover tone plus
  text 1. Disabled drops to `--text-disabled`. A panel-body action
  (`.inspector-body button`) draws a 1 px `--rule-strong` frame, disabled included;
  register rows, table sort headers and danger actions keep their own edges. A disabled
  action states its reason in its title and in a muted line beside it.
- **Segmented control** (`Seg` in `src/ui/kit.tsx`, `.seg`). One bordered group with
  hairline dividers drawn as marks; the pressed segment inverts to text 1 on ink; a
  disabled segment draws in `--text-disabled`; `role="group"` with an `aria-label`.
- **Key hints.** A key at the right end of a menu or palette row is
  `<kbd class="kbd kbd-hint">`: mono, text 3, no chip. A separator above Delete is
  `.ctx-sep`, 1 px `--rule`. The command palette is 560 px wide with 32 px rows under
  one group header per category. An icon-only chrome button carries an `aria-label` and
  a `title` that ends with its key in parentheses when a shortcut exists: `Undo (⌘Z)`,
  `Redo (⇧⌘Z)`, `Library (L)`, `Commands (⌘K)`. A control with no shortcut carries no
  parenthetical.
- **Status chips.** Status chips live in the status bar. From 1600 px they sit inline on
  one clipped row, and a chip that does not fit is hidden whole. Below 1600 px they fold
  into the ROE chip. The ROE chip counts hidden chips as `+N`, and its menu opens upward
  and lists them all. A chip that acts is a button with no frame; it keeps the chip look.
  A failed save stays visible as an alert at every width.
- **Icons** (`src/ui/icons.tsx`). One inline SVG set for chrome glyphs: library,
  commands, undo, redo, close, settings, more, drawer, entities, layers, frames,
  play, pause, reset, info, chevron down, chevron right and pencil. Each is a 16 px viewBox with a 1.5 px round
  stroke in `currentColor` and `aria-hidden`; the button that holds it carries the label
  or title. A chrome control uses this set, not a text glyph.
- **Inputs.** Sunken fill, rule strong border, text 2 border on hover, 2 px focus outline.
  A unit sits inside the field in mono text 2 (`.nu-unit`). Only a field that accepts
  input carries a frame.
- **Field** (`Field`, `.field`). Label above the control in label size. Without `help`
  and `error` its root is a `<label>`, which forwards a click on its text to the first
  button inside it, so a segmented control or a switch takes a `div.field` root with a
  `span` label instead. `unit` renders
  in `.nu-unit` inside the frame, after the control. `help` ends the label row in a
  24 px (i) button (`.field-info`, `aria-label="About <label>"`) whose title holds the
  text. The text also renders as a `.field-help` line (12 px, text 2) under the control
  when `FieldHelpProvider` is true; the inspector mounts that provider from
  `ui.showFieldHelp`, so kit imports no store. `error` renders a `.field-error` line (11 px, critical)
  under the control and sets `aria-invalid` on it. With `help` or `error` the frame is a
  div and the child must be one React element, which takes the label's `id`. The label
  holds the noun only. A blank that means a derived default shows the placeholder `Auto`,
  and the derivation sentence goes in `help`. A slider row shows its value as a
  right-aligned mono readout through `unit` (`12 kt`, `270°`). The Run section on
  Inputs (`#prepare-run`) holds Mode over two columns and Runs and Seed over one column
  each. Its head end holds `ENSEMBLE STALE` as a warning `State` while the ensemble is
  stale, and a Settings button that opens Settings at Run.
- **Error line** (`.line-error`). A rule outside a Field that shows only while its input
  is invalid: 11 px, critical, the same style as `.field-error`.
- **Section method note** (`.field-info`, `.field-help`). A section note or (i) outside a
  Field uses the Field classes. A section head may end in a 24 px (i) button
  (`aria-label="About <section>"`, the note in its title). With field help on, the note
  also renders under the head as one or more 12 px text 2 lines at normal weight. A
  machine readout in a section head is mono 12 px text 2 (`n cells · 40 runs each`). It
  clips with an ellipsis at 280 px, so its title holds the readout facts. A section head
  may carry a count tag as a `State` in the tone of the worst item.
- **Empty state** (`.empty-row`). A hollow warning `State` names the missing input
  (`No ensemble`, `No defended asset`), with a `.mini` action beside it when one exists.
  The State may hold a full sentence and wraps.
- **Detail pane header** (`DetailHeader`). Back, glyph, name and state, then the model
  line in mono meta (`.det-m`). Under it one `Model basis` row: tier and validation
  words in text 2 and a 24 px (i) whose title lists each model as label · tier ·
  validation.
- **Detail section** (`DetailSection`, `.det-s`). A collapsible section has a 28 px
  full-width header button with `aria-expanded` and `aria-controls`, a chevron, the title
  and a mono 11 px summary that stays visible while collapsed; the body uses `hidden`.
  Every telemetry section is collapsible: the first is open, and each header carries a
  mono summary. Detail values hold
  one line: a multi-clause value clips with an ellipsis and carries the full text in
  `title`, and a list behind a value opens from a `.mini` count button (`2 sensors ›`).
- **State** (`State`, `.state`). A solid 8 px square and a word in one state ink. `hollow`
  outlines the square for an undecided or qualifying count; `live` clips it to a circle.
- **Provenance mark** (`ProvMark`, `.prov-mark`). One 8 px shape in a fixed 36 px column
  after a value: filled for sourced, hollow for a planning factor, half for estimated,
  dashed for probable, a circle for inferred; `absent` keeps the column and drops the
  mark. The hover title carries the word and source line. `PfTag` in
  `src/panels/inspector/kit.tsx` maps a spec field's provenance row onto it.
- **Range rings** (`FootprintLayer.tsx`, constants in `footprintStyle.ts`). A ring at rest
  is a dashed edge in `ringIdle` with no fill and no text: MIR a long dash (`MIR_REST`),
  MRIR a shorter, lighter dash (`MRIR_REST`), Min range round dots (`MIN_REST`) and every
  sensor ring one even dash (`SENSOR_REST`). An active ring takes the solid, filled
  `RING_STYLE` look. Red stays with hostile objects: a sensor ring takes the friend hue
  (`RingInk` `friend`, or the entity's own colour) with an 8 percent tint, an effector ring
  the selection white (`white`: MIR 1.5 px over a 4 percent tint, MRIR 1 px over 5
  percent, Min range dotted) and a disabled system the grey. An active effector labels
  MIR `MAX RG` and Min range `MIN RG` (`RING_LABEL_TEXT`) in the label ink over the board
  halo. A jammer draws a flat wedge in the EW ink (9 percent fill, 70 percent edge) toward
  its sector; at rest it is the dashed outline. A system is active while it is selected,
  or at the run time cursor while an effector engages or a sensor holds a track.
- **Ring readout** (`HudLayer.tsx`, `.ring-readout` in `.surface-float`). Hovering a ring
  edge shows the system name, a mono ring chip, the distance in nm at two decimals, the
  threat height and an MRIR basis line. A click pins it; Esc or a click on empty board
  clears it. The board shows no ring hint sentence.
- **Track picture** (`TrackLayer.tsx`, `PairingLineLayer.tsx`, `OutcomeMarkLayer.tsx`,
  constants in `footprintStyle.ts`). During a sampled trial each sensor track draws its
  estimated position as a 3 px screen cross (`TRACK_MARKER_PX`) and, when the track
  carries error, its 1 sigma covariance ellipse in world meters with a 1 px screen
  stroke. Ink is the theme friend hue (`BoardInk.friend`): a sensor's picture of a track
  is a blue-force product. A false track takes the muted grey of an inert ring
  (`TRACK_FALSE_INK`). An updated track draws solid; a coasting track takes the even
  `[4, 4]` dash (`TRACK_ELLIPSE_DASH`), distinct from every ring dash. A truth-path track
  draws the cross alone. A pairing line joins each holding sensor to its track in the
  friend hue, 1 px at 0.55, trimmed 13 px at the sensor and 14 px at the track; a coast
  dashes it `[4, 4]` and a sensor that holds nothing draws no line. An intercept leaves a
  mark where it landed: a small white cross and `K m:ss` for a hard kill, an open white
  circle and `M m:ss` for a miss, the time in the label ink over the board halo. A mark
  stays after its effect; a jam dwell and a soft kill leave none. Every layer is censored
  at the observed horizon like every other trial surface.
- **KPI tiles** (`.tiles.c2`, `.tile`; the saved-run record). Two columns, no borders.
  Label in text 3 (`.tl`), value in mono at the lead size (15 px) with a small
  denominator (`.tv`).
  A tile label reserves two lines (`min-height: 2.4em`) so the values in a row align.
- **Kill-chain funnel** (`.mon-funnel`, on Monitor). Six cells on one row: DET, ID, TGT,
  ENG, DEF and LEAK. Each cell has a 1 px `--rule-strong` top rule, the key in mono text 3
  at the dense size and the count in mono text 1 at the title size. DET to ENG count the
  tracks that reached the stage; DEF and LEAK count members. The cell title names the
  denominator. A zero count takes text 3, and the LEAK count takes `--status-critical`.
- **Chain pips** (`.mon-pips`, the Chain column on Monitor). Six 5 by 9 px bars, one per
  stage: `--rule-strong` before the stage, text 2 for a stage passed, text 1 for the
  current stage. A leaked track draws them in `--status-critical`, a defeated track in
  `--ghost`. The pips are a `role="img"` with the stages in the title; a leaked track
  names the stages it holds at the cursor, then `leaked`, never `defeat`. The selected track row
  carries `aria-current`.
- **Run timeline** (`src/panels/timeline/`, every class under the `.runtl` prefix in
  `index.css`). The strip sits in `.runtl-dock` between the board and the playback bar in
  Execute and Analyze. From the top: a 28 px header (title, then the horizon in mono
  text 3, `Shown through T+m:ss`, or `Complete · T+m:ss` once the whole run shows, then
  the legend), the rows, a 20 px axis and a 22 px overview. The legend (`.runtl-legend`)
  is a 16 px row of 14 by 6 px swatches and words in text 3 at the 12 px header size, in
  the strip's ink tokens: hold, coast, classify, window, prep, flight, dwell, hard kill,
  mission kill, miss; the header shrinks it first and an item that no longer fits wraps
  to a clipped second line (a header narrower than the first item cuts that item).
  Only the
  rows scroll. The axis has a `--rule-strong` top rule and the overview a `--rule` top
  rule. Only the lines near the rows' view draw, one view height (at least 120 px)
  either side; a drawn line keeps its place, so the scroll bar reads the whole list. The
  gutter is 172 px. Group headers, rows, summary rows and fold rows are 18 px;
  a sensor sub-lane is 14 px. A row's meta shrinks four times as fast as its name and
  takes at most 40 percent of the line; a meta that the name starts with is left out, and
  a trailing instance number (`.runtl-name-tail`) never shrinks, so the ellipsis cuts the
  model text. A group header sits on sunken 55 percent over the panel; its ink square is
  the sensor ink for blue and `--danger` for red. A
  collapsed group draws its summary row at 0.75 opacity. Every ink is a `.runtl` token
  (`--runtl-*`). In the dark theme the kind inks are `KIND_INK`, which `RunTimeline.tsx`
  passes to the root as `--runtl-kind-*`, and the EW and DE inks are `--ew` and `--de`;
  the ghost and quiet inks are lighter than `--ghost` and `--rule-strong`. The daylight
  theme darkens the kind, EW, DE, ghost, CPA and quiet inks in their own hue, each to the
  lightest value that meets these floors, found by a search. Each ink
  clears 3:1 on the panel, on the selected ground and at 0.75 opacity in both themes, and
  a duration on a dwell or burst fill clears 4.5:1
  ([evidence](../field-te/evidence/run-timeline-p4-2026-09-28/README.md)). Sensor holds
  and detect dots take the sensor ink, C2 init and firm marks the C2 ink, assignment
  diamonds hollow in the effector ink. Below, `--ew`, `--de`, `--ghost` and the CPA's
  text 3 name the strip's EW, DE, ghost and CPA inks. A hold chunk's opacity maps track
  quality 0 to 1 onto 0.3 to 1; a coast is a dashed sensor outline. The classification
  ramp is one hue, `--danger` at 25, 55 and 100 percent over the panel. A window is a
  2.5 px `--accent` bar. A preparation span is a `--warn` hatch; a flight is `--accent`,
  a burst `--de` and a dwell `--ew`. Glyphs: a filled diamond in `--danger` for a hard
  kill or an arrival and in `--ew` for a mission kill; a hollow diamond for a miss
  (`--ghost`), a jam decision (`--ew`) and a CPA (text 3); a triangle for a release; a
  tick for a shot or a C2 init; a cross in `--ghost` for a drop. The unobserved region is
  sunken 70 percent with a dashed quiet-ink edge, and an undetected span is a quiet-ink
  line; the playhead is a 1 px text 1
  line under a 5 px text 1 triangle cap (`.runtl-playhead::before`, 7 px wide) that
  glides with it, and the overview draws the cursor as a 1 px text 1 line too. A duration prints on
  a span at least 44 px wide; an effector's rounds-left chip and pk print only with
  44 px to the next mark in the row, and a C2 assign label only with room for its text
  (`assignLabelMinPx`: 12 px plus 6.6 px per character, never under 44 px). The resizer above the dock is a 6 px `row-resize`
  handle that overlaps the boundary and takes no layout space. At rest a 36 by 2 px
  `--rule-strong` grip sits at its centre; the whole handle shows `--rule-strong` on hover
  and focus. No
  strip text is under 11 px (`--type-dense-size`). Times, counts, sides, sub-lane names,
  durations, printed values and a collapsed group's summary label (`all sensors`, lower
  case, at an 18 px indent) are mono; group and row names are Archivo. The header
  buttons stay 24 px `.mini` (the mockup's 20 px would be a fourth button height).
  The header controls (`.runtl-ctl`, 4 px gap) are `button.mini` buttons in the mockup
  order: Follow, Zoom out, the window readout, Zoom in, Fit, Collapse all, Expand all.
  Follow carries `aria-pressed`; pressed, it fills in text 1 with `--ink` text. The
  readout (`.runtl-zoom`) is mono text 3 at 11 px, at least 44 px wide and centered, and
  reads whole seconds or `fit`; a visually hidden prefix (`.runtl-zoom-name`) names it
  `Window 120 s` for a screen reader. Zoom in and Zoom out disable at the window limits. The
  tooltip (`.runtl-tip`) sits inside the `.runtl` root, 12 px right of and 14 px below
  the pointer, clamped inside the strip, so the rows' scroll never clips it. It is at
  most 280 px wide with 5 by 8 px padding, `--surface-raised` on a 1 px `--rule-strong`
  border at `--radius-surface` with `--elev-1`, text 2 at 12 px, and takes no pointer
  events. Its lines: the item kind in text 1 at the title weight, then the row label; any
  model note, a mono text 1 data line (`.runtl-tip-data`: the times, a duration, quality,
  pk or rounds left, joined by a middle dot) and a mono text 3 horizon line at 11 px
  (`.runtl-tip-horizon`). A row label and a sensor sub-lane label are `.runtl-select` buttons with no chrome: no
  fill at rest, on hover or on press, and text 1 on hover and press, as a group header
  takes on hover (a false track label is plain text, in a row or a sub-lane). A line that draws a board-selected entity takes `.selected`:
  text 1 and a 2 px inset text 1 bar at its left edge; its plot ground takes
  `.runtl-ground-selected`, text 1 at 6 percent. A mark under the pointer sets the pointer
  cursor; the overview takes `grab`, `grabbing` while dragged, and `touch-action: none`.
  Under `prefers-reduced-motion: reduce` the pan, the playhead, the axis tick group and
  the overview window take `transition: none !important`, which beats the inline glide.
- **Inspector rows** (`.insp-row`). Flex rows, 28 px minimum height, baseline aligned,
  bleeding to the panel padding line.
- **Per-threat table** (`.tb.tb-dense`, the Tracks table on Monitor and the Table view of
  Tracks on Outcome). One row per track. Fixed layout: the narrow columns hold their width
  and the name and result columns take the slack. Cells are mono at `--type-dense-size`. In the right panel a
  dense cell clips with an ellipsis and never wraps; the full text is in the cell
  `title`. Each header is a sort button with `aria-sort`; an abbreviated header (ID, Slv,
  TTA) spells its meaning and unit in the button title. TTA takes the warning ink under
  120 s and the critical ink under 60 s (`TTA_TONE_S`, display constants, not
  requirements). A result or state
  word is a `State` in its ink: leaked or engaged critical, active or targeted warning,
  identified hollow, defeated in `--ghost`. A leaker's late kill follows the word as
  muted text, `late kill T+m:ss`.
- **Magazine pips** (`.sys-mag`; the effector row in the Systems list). One 5 by 10 px
  pip per round with a 1 px text 3 border, filled in text 2 while the round remains, then
  `remaining/capacity`. A magazine above 12 rounds shows the text only. A jam or HPM
  channel shows `cont.`.
- **Sweep map** (`SweepMap` in `src/charts/SweepMap.tsx`, on Fragility). A CSS grid with
  one label column plus one column per value of the first factor, and one row per value
  of the second factor (one row, `Full run`, with one factor), all in `--font-mono` at
  `--type-dense-size` with `--space-1` gaps. Each cell is filled on a three-step scale of
  the displayed values' range: `--status-nominal`, `--status-warning`,
  `--status-critical`, ordered so the better third is nominal. The value prints in
  `--ink` on the fill. A cell with no value is unfilled: a dash in `--text-secondary`
  for a cell without a value, a check mark in `--status-nominal` when complete. Before a
  run the map draws its empty grid: each cell is a 28 px dashed `--rule-strong` frame
  (`.sweep-cell.blank`). The caption (`.sweep-cap`) sits under the grid in text 3 at the
  dense size. It reads the axes (`Columns: … · Rows: …`) and, at its end, the key: the
  three value ranges, or `Run sweep to fill`, `Running…` or `No values`. Its title holds
  the method sentence: the replicates per cell and that the thirds are relative, never a
  requirement. Each cell title carries the factor values, response, replicates, horizon
  and interval.

The Board has a 44 px resource rail with five 32 px icon-only buttons: Library, Entities,
Layers and Frames at the top, Commands at the bottom. Each button has an `aria-label` and
a title with its key in parentheses when it has one. The Library button carries the rail's
open mark, a 2 px bar in text 1 on the rail's left edge, while the drawer is open.
Entities opens the Entities section of Prepare > Inputs (`#prepare-entities`). Layers opens the View menu at its Layers section
(`#view-menu-layers`). Frames focuses `+ Frame` in the transport and is disabled in
Prepare. The overlaid Library drawer (306 px default, existing saved width retained)
starts below the canvas tools row and stops above the transport. It has a 32 px header
with the title, a ⋯ menu (Import library, Export library) and Close, then a 24 px filter
field, and no footer. Each row is 36 px: the name at 13/500 on one line with ellipsis,
then vendor or variant · type in 11 px mono text 3; a trailing parenthetical in the name
moves to line 2. Group headers show their counts in mono and name their toggle `Collapse
<group>` or `Expand <group>`. A library row shows its Model basis action only on hover or
keyboard focus. Model basis, a group's + (New model), a Model command in the palette and
Edit model specs show the model's editor in the drawer in place of the list, at no less
than 408 px. Its 32 px header holds Back to library (a mirrored chevron with the word
Library) and Close. Back, Close and a deleted model return the list. Place asset opens the
drawer at its Assets group.

The canvas tool row is 28 px tall (`.board-tools`), and every control in it is 24 px at
the `.mini` box; segment buttons are 22 px inside the group's 1 px frame. Drawing tools
are one segmented group with text labels; no drawing tool has a shortcut today. Undo and
Redo are icon-only with their key titles. `Range` and `View` are `tb-menu` disclosure
triggers with the same look: a word and a chevron. The layer presets (Full, Planning,
Engagement, Clean) are the `Preset` section at the top of the View menu, not in the row.
The board editing tools (Select, Boundary, Connect, Path
and Range) show only in Prepare. Outside Prepare the palette, the Inspector and the
context menu offer no action that starts a tool, and `setBoardPhase` returns the tool to
Select. After a delete or a place, a `.surface-float` cue at the canvas bottom left, above
the timeline, shows `<verb> <name> · Undo ⌘Z`. It fades during the last 15 % of 4 s,
reduced motion cuts it at 4 s, and undo, redo or a load clear it. The name truncates
first, the cue takes no pointer events, and the transport scrub keeps its 80 px floor. With
the Library drawer open the cue sits at the canvas bottom right and never under the drawer:
its width shrinks to the room beside the drawer, and below 160 px of room it stays hidden
until the drawer closes. An empty board shows one hint, a `.surface-float` at
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

Each analysis screen is one labeled section (`section.analysis-primary`) that states its
basis once: Outcome in its provenance line, Fragility and Compare in a section head
readout. Records use native disclosures (`.analysis-disclosure`). A placeholder before the first Play is an empty-state row. The band chart on Compare draws the
95 % band in `--rule-strong`, the ensemble mean in `--text-secondary`, the trial in
`--chart-1` with its endpoint marked, and the pinned baseline mean dashed in
`--text-tertiary`; its axis labels are mono at `--type-dense-size`. The interval-row flag
is a `State`: `inside` nominal, `outside` warning. Chart scope text reads “Shown
through T+m:ss” or “No outcomes observed yet” in the legend accessibility label, or a
visually hidden span when there is no legend. A preview playhead may show a later time.
These reuse existing chart and text tokens.
