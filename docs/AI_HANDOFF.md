# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` last fast-forwarded on
2026-09-05 before Wave 2 (merge is Casey's word). Remote verified equal after each push. Tree
clean except untracked `.claude/`. Contributor: Claude Fable under [AGENTS.md](../AGENTS.md).
Rule change at this commit: at every choice, stop and poll Casey in the conversation with
the evidence and one recommendation; never park a choice in the register or a report.

## Verified

- Gates at `3c1282a` (last source change): type-check, 1,406 tests in 93 files, lint 74
  warnings (identical set) and 0 errors, build (one pre-existing chunk-size warning). Parity
  baseline `evidence/r1-leaf-2026-09-05/numerical-baseline.json`, byte-identical through E2
  R-F-30 (`evidence/e2-rf30-jam-2026-09-05/`). This commit changes documents only.
- Done 2026-09-05: Wave 2 engine (`a5d2ae3`; store 1,612 lines, sim 913, attrition 819, no
  re-exports); design steps 2, 3, 4 (`171ba23`, `dca021a`, `931f152`, `3c1282a`); E2 R-F-30
  (`b7ec949`); E3 study (`7fe74dc`); R-F-38 study (`8b6eed0`). Casey decided R-D-37 to
  R-D-43 in conversation; the register rows carry the answers.

## Next

1. E3 intervals slice, one agent, serial, with before-and-after capture under
   `evidence/e3-intervals-<date>/`: R-D-37 remove the size and evasion `PF_SPREAD` rows and
   the Inspector spread label; R-D-39 Wilson for 0/1 statistics, clamp sums, rule of three at
   k = 0 (`mcRun.ts` `statOf`, panel display); R-D-40 band minimum n 10 and 40; R-D-41 time
   tiles show the defined-fraction interval, mean CI hidden below 30 defined; R-D-42 paired SE
   per sensitivity row (`runSensitivity`, tornado); R-D-43 relabel the MC first-detect
   sub-label (`OutcomeSummary.tsx`) and add a firm-track time statistic to `McSummary`.
   R-F-39 copy fixes ride along. Any new choice inside the slice: stop and poll Casey.
2. Register sweep: classify the 74 open pre-contract D rows as closed by code, superseded,
   work for Fable, or a real choice; poll Casey on the real choices four at a time; close the
   rest with dated notes. Casey chose this over leaving them.
3. Wave 3: next E2 family from PLAN section 5, decision polled, then capture.
4. Wave 4: design steps 6, 7, 9, 10, 13; then 8 (R-F-33, paper chart colours), 11, 12
   (paper canvas colours); then 14 with R-F-34. Wave 5: T1 static bundle, then A1.

## Inputs Casey holds

None pending. Defaults still standing, reversible on Casey's word: `DEFAULT_BUDGET`;
`@fontsource` packages unused since `171ba23` and kept; light state inks darkened for 3:1 on
paper; theme as a field of `rangeboard.view.v1`; T1 as a static bundle.

## Open findings

R-F-20 (step 7). R-F-33. R-F-34. R-F-35 to R-F-40 (E3; R-F-38 answered by R-D-43).
