# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-05, moves at each wave boundary. Remote verified equal after each push. Tree clean
except untracked `.claude/`. Contributor: Claude Fable under [AGENTS.md](../AGENTS.md).

## Verified

- Gates at `3a79c6a` (the R-F-31 and R-F-20 slice, the last source change): type-check,
  1,376 tests in 82 files, lint 74 warnings (identical set) and 0 errors, build, schema check.
  Fixed-ID parity against `evidence/r1-leaf-2026-09-05/numerical-baseline.json` byte-identical
  (`evidence/rf31-budget-2026-09-05/parity-after.log`).
- R-F-31 done: 3.2 ms per replicate on the firing fixture, 100 ms on Merops, page crash at
  384 million retained numbers; `DEFAULT_BUDGET`, checkpoint generators, store cancel
  actions; browser cancel in 261 ms. R-F-20 fixture `src/playback/__fixtures__/detection-outside-rings.json`:
  no ring violation, detection at 250.5 s, four events, MC kills 0.9, browser-confirmed.

## Next

1. Wave 2 engine track, serial, parity-gated on the r1-leaf baseline: extract from `store.ts`
   (2,257 lines), `sim.ts` (1,503), `attrition.ts` (1,313) per PLAN section 4, contracts
   tested first; then move panel callers off the store re-exports (`store.ts` 77 to 78).
2. Wave 2 design track beside it on disjoint panel paths: design steps 2, 3, 4 in series.
3. Wave 3: E2 one model at a time from R-F-30; E3 studies beside it, E3 source changes after.
4. Wave 4: design steps 6 (cancel control on the new actions), 7 (R-F-20 blocked-route row),
   9, 10, 13 on disjoint panel paths; then 8 (carries R-F-33), 11, 12; then 14 with R-F-34.
5. Wave 5: T1 as a static offline bundle for Chrome on macOS, then A1 against R-D-33. The 74
   lint warnings fold into the slices that own `src/te/ui`, `src/charts` and the widgets.

## Inputs Casey holds

None blocking. Defaults taken, reversible on Casey's word: `DEFAULT_BUDGET` (96 million
retained numbers, ten minutes); Archivo and JetBrains Mono fetched as open-licence files into
`src/assets/fonts` (Casey supplies them if the proxy blocks the hosts); T1 as a static bundle.

## Open findings

R-F-20 blocked-route row (step 7). R-F-30 jam geometry. R-F-33 raw-horizon subscriptions. R-F-34 canvas memo.
