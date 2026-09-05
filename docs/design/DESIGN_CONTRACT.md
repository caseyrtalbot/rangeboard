# RangeBoard: frontend design contract

Status: LOCKED DIRECTION, 2026-09-05. Casey locked this design after reviewing
[concepts.html](concepts.html), the interactive concept page that this document describes
in prose. The page is the visual reference. This document is the acceptance contract.
Implementation is not yet selected; see [AI_HANDOFF.md](../AI_HANDOFF.md) for the next
exact task. This contract replaces the U1 layer table in
[PLAN.md section 7](../field-te/PLAN.md#7-u1-ui-quality-with-measurable-acceptance).
Owner: Casey (acceptance); Claude Fable 5.1 (every step, and the engineering plan, since
`edb0da7` on 2026-09-05). See [AGENTS.md, Contributor and ownership](../../AGENTS.md#contributor-and-ownership).

## 1. Why this exists

The board is the product. The panels beside it serve two jobs at once: a scan surface the
operator reads in one second while a run streams, and a detail surface the analyst opens
when a number needs its basis. On 2026-09-05 both jobs shared one long column of 10 px
text. Measured in `src/index.css` at `9e1c5e2`: 75 rules set 10 px text, 117 rules set
11 px or smaller, 5 rules set the declared 13 px base. The Analysis column stacks 12
widgets. One KPI widget repeats "planning envelope" six times. Six gate cards repeat the
same three caveat sentences eighteen times. The library holds 230 px of the board at all
times. These concepts split the two jobs and remove the repetition.

A first draft of the concepts was rejected as "plastic". The causes were measured: 119
bordered boxes, 41 radius rules across six values, tinted translucent fills for state,
four backdrop blurs, eight drop shadows, tracked uppercase labels, and thirty weight-600
rules. The eight surface rules below are the correction. The rebuilt page has zero
shadows, zero blur, zero tints, zero uppercase labels, and one radius on controls.

## 2. Surface rules

Every component follows all eight. A review that finds a violation fails the step.

1. **Almost nothing is enclosed.** Separation comes from alignment, one hairline rule and
   space. A border marks an input or a floating surface. Nothing else has a border.
2. **One radius.** Containers are square. Controls are 2 px. Nothing is rounded past that.
3. **Colour is ink.** A state is a text colour, a stroke, or a solid 8 px square. Never a
   translucent tint over the surface. One opaque fill is allowed for the single headline
   judgement on a panel, and there is at most one on screen.
4. **No blur, no shadow, no glow.** A floating surface is opaque with a 1 px edge. Depth
   comes from stacking order.
5. **Three surfaces.** Board, panel, and one sunken tone for an input. The board carries a
   faint grain so it reads as a material.
6. **Sentence-case labels.** Size and colour separate a label from a value. No tracked
   caps, no condensed cuts.
7. **One emphasis per region.** Values are large and regular weight. Titles are medium
   weight. Weight 600 and above does not appear inside a panel.
8. **Mono for machine data only.** Ids, times, coordinates, units and keys. Prose, labels
   and titles are sans.

## 3. Tokens

Warm graphite, not blue-black. Chrome is monochrome so red, blue and orange stay free to
mean threat, sensor and effector everywhere.

| Token | Value | Use |
| --- | --- | --- |
| board | `#121313` | canvas ground, with a 3.5 percent noise grain |
| panel | `#191a1a` | every panel, flyout, drawer, card |
| sunken | `#0e0f0f` | inputs only |
| rule | `#2a2c2b` | row separators |
| rule strong | `#454846` | section separators, control borders, floating edges |
| text 1 | `#ebe9e3` | values, titles; 14.9:1 on panel |
| text 2 | `#a9a9a3` | body, meta; 7.6:1 |
| text 3 | `#74766f` | labels at 12 px weight 500 only; 3.9:1 |
| ink (on a filled control) | `#121313` | text on a pressed or primary control |
| nominal | `#7fc39a` | state ink; 8.9:1 |
| warning | `#e2ad55` | state ink |
| critical | `#e46f62` | state ink |
| threat, sensor, effector, C2 | `#e25b4e`, `#6cb0e6`, `#e4934f`, `#d3d5cf` | board channels, unchanged in meaning from `PHASE_STYLE` and the chart tokens |

Motion stays at the existing 120 and 140 ms. Reduced motion is honoured. A pressed
control inverts to text 1 on ink. Focus is a 2 px outline in text 1.

## 4. Type

Two faces. Archivo carries the interface at normal width, weights 400 and 500. JetBrains
Mono carries machine data at 400 and 500. Both come from Google Fonts in the concept page;
the app must self-host them under `src/assets` the way IBM Plex is self-hosted today.
Tabular figures everywhere.

| Role | Size and weight | Face |
| --- | --- | --- |
| display | 26 / 500 | sans |
| value | 24 / 400 | sans |
| title | 13 / 500 | sans |
| body | 13 / 400 | sans |
| meta | 12 / 400, text 2 | sans |
| label | 12 / 500, text 3, sentence case | sans |
| machine | 12 / 400 | mono |

The floor is 11 px and only the compact density reaches it. A density control on the
panel header offers compact, standard and relaxed. It moves label, body, value and row
height together and is remembered per user.

## 5. Components

- **Buttons.** 28 px high, 2 px radius, four weights: primary (filled text 1), secondary
  (1 px rule strong border), ghost (no border, underline on hover), danger (critical text,
  border on hover). Small variant 24 px. Icon buttons carry a name.
- **Segmented control.** One bordered group; the pressed segment inverts.
- **Inputs.** Sunken fill, rule strong border, text 1 border on focus. Units in mono text 3
  inside the field. Only a field that accepts input carries an input frame.
- **State.** A solid 8 px square and a word. Hollow square for undecided or qualifying
  counts. Circle for live. The filled bar is reserved for the one headline judgement.
- **Provenance mark.** Replaces the PF, SRC, DOC and PROB pills. An 8 px shape in a fixed
  36 px column after the value: filled for sourced, hollow for planning factor, half for
  estimated, dashed for probable, circle for inferred. Hover shows the word and source
  line. The column is always present so its absence carries meaning.
- **Key and value grid.** Three columns: key in text 2, value in mono right-aligned, mark.
  Rows separated by rule only.
- **KPI tiles.** Three columns, rule on top of each row, no borders. Label, value with a
  small denominator, one sub-line that carries a fact the tile alone owns.
- **Phase chain.** Six steps DET, TRK, ID, TGT, ENG, FX as a stepper: mono label, mono
  count, a 2 px underline in nominal for reached and rule strong for pending.
- **Gate row.** Square, name with a text 3 qualifier, mono value, chevron. Six gates fit
  in 200 px.

## 6. Layout concepts

**Analysis rail.** Three layers. A pinned scan strip at the top that never scrolls: live
state, run id, MC seed, the run clock, and four pinned figures at value size. A rail of
widget rows, one line each, that show the headline figure or state while closed and open on
click. Pin and focus actions appear on hover. Sub-tabs Run, Sensors, Effectors, System and
Threat filter the same twelve widgets; a widget can sit in two tabs. Provenance is stated
once per widget in the row caption and once in the footer mark. Caveats are counted in the
row and listed once. A focus drawer on the board holds the one widget that needs width.

**Library dock.** A 52 px dock with one glyph per category replaces the 230 px column. A
category opens an opaque flyout over the board that closes on drop or Escape. Search is the
first control and ⌘K opens it from anywhere. Pinned items carry a number key. The board
never reflows.

**Entity card.** Replaces the fourteen-row mono table on the canvas: name and class, three
keyed figures (position, speed and heading, altitude), five facts, and the actions the
operator reaches for.

**Inspector.** Sticky identity header with the live state. A sub-nav with counts replaces
one long scroll. Sections use the key and value grid with the mark column.

**Scrubber.** Detection ticks in text 3 and shot ticks in effector on the timeline bar.
The collapsed engagement strip is retired once the ticks exist.

## 7. Foundation changes F1 to F10

Found in source at `9e1c5e2`, not in screenshots.

| ID | Change | What it fixes | Where |
| --- | --- | --- | --- |
| F1 | Playback cadence. Advance the store at a fixed 10 Hz simulation tick; the canvas interpolates with its own frame loop; every panel subscribes with a selector, never to the scenario object. | `TimelineBar` advances the store on every animation frame and `Inspector` subscribes to `s.scenario`, so every widget re-renders sixty times a second during a run. | `TimelineBar` · `store` · `Inspector` |
| F2 | One token layer, one kit. The board panels and the T&E Ops kit read the same tokens; field, segmented, state and provenance exist once. | 367 classes in `index.css` and a second kit of 33 components in `te/ui/kit.tsx` with no shared primitive. | `index.css` · `te/ui/kit.tsx` |
| F3 | Daylight theme from the same tokens: paper ground, ink text, the same three state inks. Follows the OS, manual switch in the top bar. | No light theme and no colour-scheme query exist. | `index.css` |
| F4 | Keyboard on the board: tab order across entities, arrow nudge, Enter inspects, Escape clears, visible focus on the canvas and every control, a name on every icon button. | 11 aria labels across all panels, 14 focus rules, no keyboard path onto the canvas. | `CanvasStage` · `EntityLayer` · panels |
| F5 | Events on the scrubber from the run record; hover names, click seeks. | The bar is a bare slider; the engagement strip is collapsed. | `TimelineBar` · playback |
| F6 | View presets Plan, Live, Debrief, Clean; the toggles stay under Advanced. | `LayerVisibility` has 17 booleans behind one menu. | `ViewMenu` |
| F7 | Charts drawn to the board as one path per series with board line weights. | Recharts rebuilds its tree on each data change at run cadence and its defaults do not match the board. | `charts/TimeSeries` |
| F8 | Inspector split by tab, one file per tab, each subscribing to its own slice. | One 1,579 line file that re-renders whole on any store change. | `Inspector` · `inspector/*` |
| F9 | Library search: fuzzy across name, maker and role; recents first; numbered pins; one list behind the dock and ⌘K. | Substring filter only, a separate command palette. | `Palette` · `CommandPalette` |
| F10 | Withdrawn 2026-09-05. The claim "one localStorage key, no version, no recovery path" was wrong: C3 already supplies `schemaVersion` 1 on both stores, versioned storage keys, runtime validation before adoption, recovery copies of an unreadable save and autosave suppression (`src/io/storageKeys.ts`, `src/io/recovery.ts`, `src/io/validateScenario.ts`). Any remaining durability work, such as an automatic export on save, belongs to T1 (PLAN section 6) and needs its own decision row. | none | none |

## 8. Order of work and owners

Each step stands alone and ships alone with its own gates. Owner effort classes follow the
user's rule: Fable medium for delegated judgment work, Fable high only where semantics
decide the outcome and always for orchestration and correctness review, Opus high or xhigh
for mechanical work with a fixed contract. Fable orchestrates every step and delegates
mechanical work to Opus where the table says so.

| # | Step | Reach | Owner | Acceptance evidence |
| --- | --- | --- | --- | --- |
| 1 | F1 playback cadence and selectors, inside R1 | App | Fable high (R1 continuation) | Deterministic and seeded MC parity on fixed IDs; a profile on a named fixture showing per-tick render counts before and after; the store exposes the selectors the panels will subscribe to; 10 Hz is the wall-clock store publication cadence at every playback speed, engine DT 0.5 s and event horizons unchanged |
| 2 | Type floor and roles; self-host Archivo and JetBrains Mono; headings from mono caps to sans | Every panel | Opus high | `git grep` shows zero `font-size` rules below 11 px; contrast measured on actual surfaces; 320 px and 200 percent zoom inspection |
| 3 | Surface rules and one kit (F2); tokens, one radius, no shadow or blur, state as ink, provenance mark | Every panel | Opus xhigh for the CSS fold, Fable medium for the kit merge | Counts of `border-radius`, `box-shadow`, `backdrop-filter`, `text-transform:uppercase` and `rgba(` tints in `index.css` and `kit.tsx`; browser screenshots of every panel |
| 4 | F3 daylight theme | Every panel | Opus high | Both themes rendered for every panel; contrast table for both |
| 5 | Withdrawn with F10 on 2026-09-05; the number is kept so later references hold | none | none | none |
| 6 | Widget row and scan strip; pin, focus, density; cancel affordance for an MC run (R-F-31) | Analysis | Fable medium | Every closed row shows its headline; pins persist per user; browser check at compact, standard, relaxed |
| 7 | Gates as rows, caveats once; per-threat blocked-route explanation (R-F-20) | Analysis | Fable medium | Six gates in 200 px; caveat text appears once per widget; `no-fc-uplink` is named per threat |
| 8 | F7 charts drawn to the board | Analysis | Opus high | Same series values as before on the fixed fixture; render cost per tick measured |
| 9 | F8 Inspector split, sub-nav, key and value grid | Inspect | Opus xhigh | One file per tab; each tab's selector named; existing Inspector tests pass |
| 10 | F9 library dock, flyout, search | Board layout | Fable medium | Board width unchanged when the flyout opens; ⌘K and the dock show one list; drag to board still works |
| 11 | Focus drawer | Board layout | Opus high | One widget at a time; Escape closes; the widget renders the same data as in the rail |
| 12 | F5 scrubber events and the entity card | Board | Fable medium | Ticks match the run record; the card shows the fourteen facts of the old table in its five rows and three figures |
| 13 | F6 view presets | Board | Opus high | Four presets; the seventeen toggles still reachable |
| 14 | F4 keyboard on the board | Board | Fable medium | Keyboard-only walkthrough recorded in the browser; WCAG 2.2 AA focus and target size checks |

## 9. Sequencing against the open engineering items

Decided with Casey on 2026-09-05. Recorded as R-D-32 in the register.

| Item | Register | Placement | Reason |
| --- | --- | --- | --- |
| R1 store and worker dependencies | PLAN section 4 | Before the design; step 1 folds into it | `sim.ts`, `series.ts` and `runSession.ts` import from `state/store`; F1 changes the store contract those cycles cross |
| E2 and E3 evidence | PLAN section 5 | Parallel with R1 | Engine and dossier work; no panel file in scope |
| Jam geometry | R-F-30 (E2) | Parallel with R1 | Slant range versus horizontal distance in `assessJam`; no UI dependency |
| Blocked-route presentation | R-F-20 (C2) | Design step 7 | A panel feature; build it once in the new threat row |
| Execution limits and cancellation | R-F-31 (R1, T1) | Policy in R1; cancel affordance in design step 6 | Worker budget is engine work; the control is a scan-strip element |
| U1 panel cleanup | PLAN section 7 | Replaced by this contract | The old layer table said "preserve the existing graphite visual language" |
| T1 packaging and durability | PLAN section 6 | F10 in design step 5; packaging after the platform decision | Persistence is small and tested; packaging needs hardware |
| Field pilot hardware, question, owner | PLAN section 9 | Now, Casey's decision | Blocks daylight theme acceptance, touch targets and the density default |

Recommended order: field pilot decision; R1 with step 1 inside it, with E2, E3 and jam
geometry in parallel; F10; then design steps 2 to 14; then T1 packaging; then A1.

## 10. What this contract does not authorize

- No source edit, commit or push. Each step needs Casey's selection and its own brief.
- No schema version, storage key, draw point or raid partition change without a decision
  row and Casey's instruction.
- No new dependency. Fonts are self-hosted files, not a package.
- No numerical change disguised as design. Parity on fixed IDs is the gate for steps 1,
  8 and 12.
- The concept page uses illustrative run values. They are not results.
