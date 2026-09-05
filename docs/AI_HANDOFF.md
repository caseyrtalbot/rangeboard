# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-05, moves at each wave boundary. Remote verified equal after each push. Tree clean
except untracked `.claude/`. Contributor: Claude Fable under [AGENTS.md](../AGENTS.md).

## Verified

- Gates at this commit: type-check, 1,389 tests in 91 files, lint 74 warnings (identical
  set) and 0 errors, build. Fixed-ID parity byte-identical against
  `evidence/r1-leaf-2026-09-05/numerical-baseline.json` after each engine slice and after
  the caller moves (`evidence/wave2-engine-2026-09-05/parity-*.log`).
- Wave 2 engine done: `store.ts` 2,257 to 1,611 lines, `sim.ts` 1,503 to 922,
  `attrition.ts` 1,313 to 849; `DT` value and `stepIndex` body byte-identical in `clock.ts`;
  no re-exports remain; the `sim.ts`/`policy.ts` cycle and the store's `sim.ts` import gone.
- Design step 2 at `171ba23`: fonts, type roles, floor and contrast per
  `evidence/design-step2-2026-09-05/`.

## Next

1. Design steps 3 (surface rules, one kit, F2) and 4 (F3 daylight theme) in series. Step 2
   left five `text-transform: uppercase` pills for step 3 and 10 px SVG axis text in
   `src/charts/*.tsx` for step 8.
2. Wave 3: E2 one model at a time from R-F-30; E3 studies beside it.
3. Wave 4: design steps 6, 7, 9, 10, 13; then 8 (R-F-33), 11, 12; then 14 with R-F-34.
4. Wave 5: T1 static offline bundle, then A1 against R-D-33. The 74 lint warnings fold
   into the slices that own `src/te/ui`, `src/charts` and the widgets.

## Inputs Casey holds

None blocking. Defaults taken, reversible on Casey's word: `DEFAULT_BUDGET` (96 million
retained numbers, ten minutes); `@fontsource/ibm-plex-*` packages unused since `171ba23`
but kept until Casey approves the dependency removal; T1 as a static bundle.

## Open findings

R-F-20 blocked-route row (step 7). R-F-30 jam geometry. R-F-33 raw-horizon subscriptions. R-F-34 canvas memo.
