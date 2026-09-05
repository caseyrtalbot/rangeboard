# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to `e1d8423`
on 2026-09-05, moves at each wave boundary. Remote verified equal after each push. Tree clean
except untracked `.claude/`. Contributor: Claude Fable under [AGENTS.md](../AGENTS.md) (R-D-36).

## Verified

- Gates at `51ce6cb` (the F1 slice, the last source change): type-check, 1,369 tests in
  82 files, lint 74 warnings (identical set) and 0 errors, build, schema drift check.
- Fixed-ID parity baseline `evidence/r1-leaf-2026-09-05/numerical-baseline.json`,
  byte-identical after F1 (`evidence/f1-slice-2026-09-05/parity-after.log`).
- F1 done (R-F-32): 10 Hz publication at every speed on both tabs, horizon equal to the
  published time, completion exact at `durationS` at 1x to 30x, one react-dom commit per
  publication on the Inspect tab, one Konva commit per frame: `evidence/f1-slice-2026-09-05/`.

## Next

1. Wave 1 continues: the R-F-31 worker budget with cancel checkpoints in `mcClient.ts`,
   `mc.worker.ts`, `mcRun.ts`; then the R-F-20 detection fixture outside every ring.
2. Wave 2: larger store, sweep and attrition extraction beside design steps 2, 3, 4 in series.
3. Wave 3: E2 one model at a time from R-F-30; E3 studies beside it, E3 source changes after.
4. Wave 4: design steps 6, 7, 9, 10, 13 on disjoint panel paths; then 8 (carries R-F-33),
   11, 12; then 14. R-F-34 goes with the canvas design step.
5. Wave 5: T1 as a static offline bundle for Chrome on macOS; then A1 against R-D-33.
   The 74 lint warnings fold into the slices that own `src/te/ui`, `src/charts`, the widgets.

## Inputs Casey holds

None blocking. Defaults taken, reversible on Casey's word: Archivo and JetBrains Mono fetched
as open-licence files into `src/assets/fonts` (Casey supplies them if the proxy blocks the
hosts); T1 packages as a static bundle with no dependency.

## Open findings

R-F-20 blocked-route presentation and valid detection fixture. R-F-30 jam geometry.
R-F-31 execution budget. R-F-33 raw-horizon subscriptions in `ThreatPictureWidget` and
`DebriefRecord`, Recharts rebuilds per publication at 5x and above. R-F-34 per-node canvas memo.
