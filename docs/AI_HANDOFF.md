# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-05, moves at each wave boundary. Remote verified equal after each push. Tree carries
the uncommitted R-F-38 study (`model-evidence/track-c2-doctrine.md`, in flight) and untracked
`.claude/`. Contributor: Claude Fable under [AGENTS.md](../AGENTS.md).

## Verified

- Gates at this commit: type-check, 1,406 tests in 93 files, lint 74 warnings (identical
  set) and 0 errors, build (one pre-existing chunk-size warning). Parity baseline:
  `evidence/r1-leaf-2026-09-05/numerical-baseline.json`, byte-identical on the firing fixture
  through E2 R-F-30 (`evidence/e2-rf30-jam-2026-09-05/`).
- Design steps 2, 3 and 4 done: fonts and type roles (`171ba23`), surface rules and one kit
  (`dca021a`, `931f152`), daylight theme with OS follow and top-bar switch (this commit);
  contrast in both themes 3.8:1 to 14.7:1 (`evidence/design-step4-2026-09-05/`). Eleven
  canvas and chart colours read badly on paper (`findings.json`); steps 8, 12, 14 own them.
- E3 study `7fe74dc`; E2 R-F-30 `b7ec949`; Wave 2 engine `a5d2ae3` (store 1,611 lines,
  sim 922, attrition 849, no re-exports, no `sim`/`policy` cycle).

## Next

1. Record the R-F-38 study (MC detection at low Pd; a draw-site decision for Casey).
2. Wave 3: next E2 family from PLAN section 5 with a before-and-after capture.
3. Wave 4: design steps 6, 7, 9, 10, 13; then 8 (R-F-33, paper chart colours), 11, 12
   (paper canvas colours); then 14 with R-F-34. R-F-39 copy fixes ride the first UI slice.
4. Wave 5: T1 static offline bundle, then A1 against R-D-33. The 74 lint warnings fold
   into the slices that own `src/te/ui`, `src/charts` and the widgets.

## Inputs Casey holds

R-D-37 to R-D-42 (E3 spreads, intervals and presentation): recommendations in the rows;
none blocks the next items. Defaults taken, reversible: `DEFAULT_BUDGET`; `@fontsource`
packages kept until Casey approves removal; light state inks darkened for 3:1 on paper;
theme stored as a field of `rangeboard.view.v1`; T1 as a static bundle.

## Open findings

R-F-20 (step 7). R-F-33. R-F-34. R-F-35 to R-F-40 (E3). R-F-38 study in flight.
