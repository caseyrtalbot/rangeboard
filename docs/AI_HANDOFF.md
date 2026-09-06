# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` last fast-forwarded on
2026-09-05 before Wave 2 (merge is Casey's word). Remote verified equal after each push. Tree
clean except untracked `.claude/`. Contributor: Claude Fable under [AGENTS.md](../AGENTS.md).
Rule: at every choice, stop and poll Casey in the conversation with the evidence and one
recommendation; never park a choice in the register or a report.

## Verified

- Gates at `106cffe` (E3 intervals slice; this commit changes documents only): type-check, 1,410 tests in 93 files, lint 74
  warnings (identical set) and 0 errors, build (one pre-existing chunk-size warning).
- Parity baseline: `evidence/e3-intervals-2026-09-05/numerical-after.json` (firing
  fixture, 4 replicates). Its `numerical-before.json` reproduces the r1-leaf baseline
  byte-identically; `diff.md` lists every changed leaf: only interval ends, the new
  `interval` method, NaN quantiles under the minimums, `firmTrackS` and `rows[].se`.
  Every mean, sd, se, band mean, assessment, report leaf and sensitivity endpoint is
  identical.
- Browser check 2026-09-05 (`evidence/e3-intervals-2026-09-05/`, detection fixture, real
  worker runs, no page errors): tiles name "first single-scan hit", show the defined
  fraction's Wilson interval, withhold the mean CI under 30 defined, print count intervals
  as two ends; time-series note words the band minimums; Sensitivity table has the SE
  column; the Inspector size-factor tag has no spread.
- Done 2026-09-05: Wave 2 engine (`a5d2ae3`); design steps 2, 3, 4 (`171ba23`, `dca021a`,
  `931f152`, `3c1282a`); E2 R-F-30 (`b7ec949`); E3 study (`7fe74dc`); R-F-38 study
  (`8b6eed0`); E3 intervals slice (`106cffe`): R-D-37, R-D-39 to R-D-43 implemented,
  R-F-38 and R-F-39 closed, register rows carry the notes.

## Next

1. Register sweep: the 74 D rows whose status cell starts with `open` (D-1 to D-76 except
   D-11, decided, and D-58, absent; D-77 is a note). For each row read the code it names, then classify it as
   closed by code, superseded, work for Fable, or a real choice; poll Casey on the real
   choices four at a time with one recommendation each; close the rest with dated notes.
   Casey chose this over leaving them. Nothing of the sweep has started.
2. Wave 3: next E2 family from PLAN section 5, decision polled, then capture. R-F-41 and
   R-F-42 (from the E3 intervals slice) are E3 follow-ups to poll with it: the all-zero sum
   interval and the stop rule's t half-width against the displayed Wilson interval.
3. Wave 4: design steps 6, 7, 9, 10, 13; then 8 (R-F-33, paper chart colours), 11, 12
   (paper canvas colours); then 14 with R-F-34. Wave 5: T1 static bundle, then A1.

## Inputs Casey holds

None pending. Defaults still standing, reversible on Casey's word: `DEFAULT_BUDGET`;
`@fontsource` packages unused since `171ba23` and kept; light state inks darkened for 3:1 on
paper; theme as a field of `rangeboard.view.v1`; T1 as a static bundle. Assumptions taken
in the E3 intervals slice, reversible: a 0/1 count is one whose support maximum is 1 (not
one whose samples happen to be 0/1); the rule of three applies at n of n as the mirror of
0 of n; count subs print the interval as two ends because a Wilson or clamped interval is
not symmetric; the Defeat interval is printed in percent, not percentage points.

## Open findings

R-F-20 (step 7). R-F-33. R-F-34. R-F-35 to R-F-37, R-F-40 to R-F-42 (E3).
