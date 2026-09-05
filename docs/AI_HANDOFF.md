# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to `e1d8423`
on 2026-09-05, moves at each wave boundary. Remote verified equal after each push. Tree clean
except untracked `.claude/`. Contributor: Claude Fable under [AGENTS.md](../AGENTS.md) (R-D-36).

## Verified

- Gates at this commit (the R-F-31 and R-F-20 slice): type-check, 1,376 tests in 82 files,
  lint 74 warnings (identical set) and 0 errors, build, schema drift check. Fixed-ID parity
  against `evidence/r1-leaf-2026-09-05/numerical-baseline.json` byte-identical
  (`evidence/rf31-budget-2026-09-05/parity-after.log`).
- R-F-31 done: measured (3.2 ms per replicate on the firing fixture, 100 ms on Merops, page
  crash at 384 million retained numbers), then `DEFAULT_BUDGET`, checkpoint generators and
  the cancel actions `cancelMonteCarlo`, `cancelSensitivityRun`; browser cancel in 261 ms.
- R-F-20 detection fixture `src/playback/__fixtures__/detection-outside-rings.json`: no ring
  violation, detection at 250.5 s, four events, MC kills 0.9, browser-confirmed.

## Next

1. Wave 2: larger store, sweep and attrition extraction beside design steps 2, 3, 4 in series.
2. Wave 3: E2 one model at a time from R-F-30; E3 studies beside it, E3 source changes after.
3. Wave 4: design steps 6 (cancel control on the new actions), 7 (R-F-20 blocked-route row),
   9, 10, 13 on disjoint panel paths; then 8 (carries R-F-33), 11, 12; then 14. R-F-34 goes
   with the canvas design step.
4. Wave 5: T1 as a static offline bundle for Chrome on macOS; then A1 against R-D-33.
   The 74 lint warnings fold into the slices that own `src/te/ui`, `src/charts`, the widgets.

## Inputs Casey holds

None blocking. Defaults taken, reversible on Casey's word: `DEFAULT_BUDGET` (96 million
retained numbers, ten minutes); Archivo and JetBrains Mono fetched as open-licence files into
`src/assets/fonts` (Casey supplies them if the proxy blocks the hosts); T1 as a static bundle.

## Open findings

R-F-20 blocked-route presentation (design step 7). R-F-30 jam geometry. R-F-33 raw-horizon
subscriptions in `ThreatPictureWidget`, `DebriefRecord`; Recharts rebuilds at 5x and above.
R-F-34 per-node canvas memo.
