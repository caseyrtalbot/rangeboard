# RangeBoard: current handoff

Revision `8b5acd0` on `analysis-hardening`, pushed; this rewrite follows it. Contributor:
Claude Fable under the standing authorization in [AGENTS.md](../AGENTS.md), decided by Casey
on 2026-09-05 (R-D-36). Working tree: clean except the untracked `.claude/` tool folder.

## Verified

- Gates at `edb0da7` (last source change, Astra's R1 first extraction): type-check, 1,360
  tests in 80 files, lint 74 warnings and 0 errors, build with the existing chunk warning,
  schema drift check. Fixed-ID parity baseline:
  `docs/field-te/evidence/r1-leaf-2026-09-05/numerical-baseline.json`.
- F1 baseline measured at `dc10895`: [F1_CADENCE_BRIEF.md](field-te/F1_CADENCE_BRIEF.md),
  register R-F-32. The store publishes once per animation frame with no fixed cadence; the
  Analysis rail and the canvas carry the per-tick render load; the Inspector does not.
- No source file has changed since `edb0da7`. Rerun the four gates before the first edit.

## Next

Wave 1, in this order unless paths allow parallel work: the F1 slice (brief sections 3 to
7: 10 Hz publication, canvas frame clock, selectors, memo plumbing, two reference sentences,
parity gate); the R-F-31 measured worker budget with cancel checkpoints in `mcClient.ts`,
`mc.worker.ts`, `mcRun.ts`; the R-F-20 detection fixture that spawns outside every ring.
Then wave 2: larger store, sweep and attrition extraction beside design steps 2, 3, 4 in
series. Wave 3: E2 one model at a time from R-F-30; E3 studies beside it, E3 source changes
after. Wave 4: design steps 6, 7, 9, 10, 13 on disjoint panel paths; then 8, 11, 12; then
14 alone. Wave 5: T1 as a static offline bundle for Chrome on macOS, then A1 against the
R-D-33 question. The 74 lint warnings fold into the slices that own `src/te/ui`,
`src/charts` and the analysis widgets.

## Inputs Casey holds

None blocking. Defaults taken under standing authorization, reversible on Casey's word:
Archivo and JetBrains Mono are fetched as open-licence files into `src/assets/fonts` (Casey
supplies them if the proxy blocks the hosts); T1 packages as a static bundle, no dependency.
Hard exceptions (AGENTS.md) still need Casey's word each time.

Open findings: R-F-20 blocked-route presentation and valid detection fixture; R-F-30 jam
geometry; R-F-31 execution budget; R-F-32 playback cadence. The design contract F1 problem
text is wrong on the Inspector and the sixty-per-second claim; correct it in the F1 slice.
