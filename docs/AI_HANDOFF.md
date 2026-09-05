# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-05, moves at each wave boundary. Remote verified equal after each push. Tree clean
except untracked `.claude/`. Contributor: Claude Fable under [AGENTS.md](../AGENTS.md).

## Verified

- Gates at this commit: type-check, 1,390 tests in 92 files, lint 74 warnings (identical
  set) and 0 errors, build, schema check. Fixed-ID parity byte-identical against
  `evidence/r1-leaf-2026-09-05/numerical-baseline.json` after each of the three slices
  (`evidence/wave2-engine-2026-09-05/parity-slice1..3.log`).
- Wave 2 engine: `store.ts` 2,257 to 1,611 lines, `sim.ts` 1,503 to 922, `attrition.ts`
  1,313 to 849; `DT` value and `stepIndex` body byte-identical in `clock.ts`; the
  `sim.ts`/`policy.ts` cycle and the store's value import from `sim.ts` are gone.
- Design step 2 at `171ba23`: fonts, type roles, floor and contrast per
  `evidence/design-step2-2026-09-05/`.

## Next

1. Move `src/panels` and `src/canvas` callers off the `store.ts`, `sim.ts` and
   `attrition.ts` re-exports; delete each re-export with no consumer left.
2. Design steps 3 (surface rules, one kit, F2) and 4 (F3 daylight theme) in series. Step 2
   left five `text-transform: uppercase` pills for step 3 and 10 px SVG axis text in
   `src/charts/*.tsx` for step 8.
3. Wave 3: E2 one model at a time from R-F-30; E3 studies beside it.
4. Wave 4: design steps 6, 7, 9, 10, 13; then 8 (R-F-33), 11, 12; then 14 with R-F-34.
5. Wave 5: T1 static offline bundle, then A1 against R-D-33. The 74 lint warnings fold
   into the slices that own `src/te/ui`, `src/charts` and the widgets.

## Inputs Casey holds

None blocking. Defaults taken, reversible on Casey's word: `DEFAULT_BUDGET` (96 million
retained numbers, ten minutes); `@fontsource/ibm-plex-*` packages unused since `171ba23`
but kept until Casey approves the dependency removal; T1 as a static bundle.

## Open findings

R-F-20 blocked-route row (step 7). R-F-30 jam geometry. R-F-33 raw-horizon subscriptions. R-F-34 canvas memo.
