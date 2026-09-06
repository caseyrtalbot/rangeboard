# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-05 on Casey's word (after the register sweep and D-20). Remote verified equal after
each push. Tree clean except untracked `.claude/`. Contributor: Claude Fable under
[AGENTS.md](../AGENTS.md). Rule: at every choice, stop and poll Casey in the conversation
with the evidence and one recommendation; never park a choice in the register or a report.

## Verified

- Gates at the D-20 commit (this commit; it changes `CLASSIFY_DASH`, its test pin and
  documents): type-check, 1,410 tests in 93 files, lint 74 warnings (identical set) and
  0 errors, build (one pre-existing chunk-size warning). The register-sweep commit
  `c0737da` before it passed the same gates.
- Parity baseline: `evidence/e3-intervals-2026-09-05/numerical-after.json` (firing
  fixture, 4 replicates); no engine change since `106cffe`. Its `numerical-before.json`
  reproduces the r1-leaf baseline byte-identically; `diff.md` lists every changed leaf.
- Browser check 2026-09-05 (`evidence/d20-classify-dash-2026-09-05/`, detection fixture
  plus one RPS-42, Full preset, Mavic 3 selected, no page errors): the live Konva nodes
  carry three Pd 0.9 contours at `[4, 6]` and two classify rings at `[10, 4]`.
- Browser check 2026-09-05 (`evidence/e3-intervals-2026-09-05/`, detection fixture, real
  worker runs, no page errors): tiles name "first single-scan hit", show the defined
  fraction's Wilson interval, withhold the mean CI under 30 defined, print count intervals
  as two ends; time-series note words the band minimums; Sensitivity table has the SE
  column; the Inspector size-factor tag has no spread. The sweep's one copy change (the
  T&E altitude-band help string, `DesignPanel.tsx`) had no browser check.
- Register sweep 2026-09-05 (`c0737da`): all 74 open D rows read against source, tests
  and git; 69 closed by code, 2 superseded (D-61, D-69), 3 done (D-2, D-31, D-59 plus the
  `Scenario.seed` JSDoc), D-20 decided and done in this commit. No D row is open.
- Done 2026-09-05: Wave 2 engine (`a5d2ae3`); design steps 2, 3, 4 (`171ba23`, `dca021a`,
  `931f152`, `3c1282a`); E2 R-F-30 (`b7ec949`); E3 study (`7fe74dc`); R-F-38 study
  (`8b6eed0`); E3 intervals slice (`106cffe`).

## Next

1. Wave 3, E2: poll Casey on the next family from [PLAN section 5](field-te/PLAN.md)
   before any study. Done so far: Effect/EW jam envelope (R-F-30). Dossiers for every
   family are in `field-te/model-evidence/`. Recommendation to carry into the poll: Motion
   and effect timing (`tactics.ts`, `attrition.ts`, `intercept.ts`), because PLAN section
   5 puts physical-feasibility violations first and R-F-7's window-end cap does not
   establish a feasible intercept. The study ends in a polled decision, then a bounded
   correction with a before-and-after capture on the firing fixture.
2. Wave 3, E3 follow-ups polled with the same conversation: R-F-41 (an all-zero sum keeps
   a zero-width clamped interval) and R-F-42 (the stop rule tests the t half-width while
   the tile shows Wilson or clamped). R-F-35 to R-F-37 and R-F-40 are evidence gaps to
   raise only if the chosen family touches them.
3. Wave 4: design steps 6, 7, 9, 10, 13; then 8 (R-F-33, paper chart colours), 11, 12
   (paper canvas colours); then 14 with R-F-34. Wave 5: T1 static bundle, then A1.

## Inputs Casey holds

None pending. Defaults still standing, reversible on Casey's word: `DEFAULT_BUDGET`;
`@fontsource` packages unused since `171ba23` and kept; light state inks darkened for 3:1
on paper; theme as a field of `rangeboard.view.v1`; T1 as a static bundle. Assumptions
taken in the E3 intervals slice, reversible: a 0/1 count is one whose support maximum is 1
(not one whose samples happen to be 0/1); the rule of three applies at n of n as the
mirror of 0 of n; count subs print the interval as two ends because a Wilson or clamped
interval is not symmetric; the Defeat interval is printed in percent, not percentage
points. Assumption in D-20: `[10, 4]` is the distinct classify dash; no other dash changed.

## Open findings

R-F-20 (step 7). R-F-33. R-F-34. R-F-35 to R-F-37, R-F-40 to R-F-42 (E3).
