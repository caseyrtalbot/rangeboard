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
  (`8b6eed0`); E3 intervals slice (`106cffe`); E3 follow-ups R-F-41 and R-F-42 (this
  commit, capture `field-te/evidence/e3-followups-2026-09-05/`); E2 motion study (this
  commit, `field-te/model-evidence/motion-effect-timing.md`, section "E2 study,
  2026-09-05"), which ends at the poll on the bounded correction.

## Next

1. Wave 3, E2, Motion and effect timing (R-D-44 decided): poll Casey on the bounded
   correction from the study section in `field-te/model-evidence/motion-effect-timing.md`.
   Findings: the three-pass intercept solver has residual above one DT whenever the target
   to interceptor speed ratio is above about 0.3, and an infeasible intercept (target out of
   reach under the model itself) is credited with kill mass and no flag when the third pass
   lands inside the window. Recommendation: decline the shot when reach is short of need
   with a one DT tolerance, no round spent, event recorded as infeasible; the solver fix is
   a separate follow-up. Then the correction with a before-and-after capture on the firing
   fixture (shortfalls -3.4 to +0.004 m; a strict check with no tolerance would flag the
   fourth Coyote event).
2. Wave 3, E3: R-F-35 to R-F-37 and R-F-40 are evidence gaps to raise only if the chosen
   family touches them.
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
