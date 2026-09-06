# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-05, moves at each wave boundary. Remote verified equal after each push. Tree carries
untracked `.claude/` only.
Contributor: Claude Fable under [AGENTS.md](../AGENTS.md).

## Verified

- Gates at this commit: type-check, 1,404 tests in 93 files, lint 74 warnings (identical
  set) and 0 errors, build (one pre-existing chunk-size warning). Parity baseline:
  `evidence/r1-leaf-2026-09-05/numerical-baseline.json`, byte-identical on the firing fixture
  through E2 R-F-30 (`evidence/e2-rf30-jam-2026-09-05/`).
- Design step 3 done: part B at this commit puts Field, Seg, State and ProvMark once in
  `src/ui/kit.tsx`; 41 state elements with no fill, 45 mark columns at 36 px, 41 squares at
  8 px (`evidence/design-step3b-2026-09-05/`). Part A `dca021a`, step 2 `171ba23`.
- E3 study at `7fe74dc` (no numerical change, twelve register rows R-D-37 to R-D-42 and
  R-F-35 to R-F-40). E2 R-F-30 at `b7ec949`. Wave 2 engine at `a5d2ae3`.

## Next

1. Design step 4 (F3 daylight theme, OS follow, switch in the top bar; the choice stored as
   a field of the existing view record, no new storage key).
2. Wave 3: E2 next family from PLAN section 5 with a capture; R-F-38 (MC low-Pd detection
   semantics) first, since it questions the R-F-20 fixture under MC.
3. Wave 4: design steps 6, 7, 9, 10, 13; then 8 (R-F-33), 11, 12; then 14 with R-F-34.
4. Wave 5: T1 static offline bundle, then A1 against R-D-33. The 74 lint warnings fold
   into the slices that own `src/te/ui`, `src/charts` and the widgets.

## Inputs Casey holds

R-D-37 to R-D-42 (dead size and evasion spreads, R-F-2 flyout spread, bounded intervals,
band minimum n, conditional-time intervals, sensitivity SE): recommendations in the rows;
none blocks the next items. Defaults taken, reversible: `DEFAULT_BUDGET`; `@fontsource`
packages kept until Casey approves removal; T1 as a static bundle.

## Open findings

R-F-20 (step 7). R-F-33. R-F-34. R-F-35 to R-F-40 from E3 (R-F-39 copy fixes land in the next UI slice).
