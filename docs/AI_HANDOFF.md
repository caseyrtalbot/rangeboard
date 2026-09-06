# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-05 on Casey's word (after the register sweep and D-20). Remote verified equal after
each push. Tree clean except untracked `.claude/`. Contributor: Claude Fable under
[AGENTS.md](../AGENTS.md). Rule: at every choice, stop and poll Casey in the conversation
with the evidence and one recommendation; never park a choice in a report or a list. The
findings register (`docs/data-engine/outstanding.md`) was retired on 2026-09-05; open items
live in this file under Next.

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
  2026-09-05"); E2 motion correction (this commit, capture
  `field-te/evidence/e2-motion-fix-2026-09-05/`): `interceptAt` reports `infeasible` and both
  selection passes decline the shot; firing and layered fixtures byte-identical.
- Done 2026-09-05: Track, C2 and doctrine slice (this commit, capture
  `field-te/evidence/track-c2-slice-2026-09-05/`): no coast before track initiation (F-15;
  only the tracked-count band and one uninitiated radar's hold interval move; kills, leakers,
  events and gates identical), and the editor couples Initiation M and N (F-16, browser-checked
  through the library editor inputs, `browser-check.md`). Register cut to six rows
  (`347b09e`), then retired in this commit.

## Next

1. Four open choices, each with the specialist review's recommendation (2026-09-05), await
   Casey's word in the conversation:
   - R-F-35 seed Pk spreads. Recommendation: drop the Stinger (2 of 2) and Leonidas (61 of 61)
     `spread` rows so both take the PF pseudo-beta around 0.7; the rows' `basis` is already
     `pf`. Only `total` mode moves, and only where those two fire; `seedLibrary.test.ts:88-98`
     changes. Capture on the firing fixture.
   - R-F-43 intercept solver. Recommendation: replace the three fixed-point passes with the
     closed-form constant-speed root per path segment (`analyticIntercept` in
     `field-te/evidence/e2-motion-2026-09-05/e2.motion.study.test.ts.txt`), keeping the cap
     and the `infeasible` test. Firing fixture moves under 0.1 DT and Pk under 1e-5.
   - F-62 SPEXER 2000 `refRcsM2` 0.04. Recommendation: keep 0.04 and add a `refRcsM2`
     provenance row (`basis: 'pf'`, back-solved from the datasheet's 9 km UAV and 6 km micro-UAV
     lines by the fourth-root law). No output moves. Dropping to 0.01 would move a 0.01 m2
     target's range from 4243 m to 6000 m.
   - R-F-20 remainder. Recommendation: keep the engine rule (a typed route without a
     fire-control source blocks a command-guided Coyote; the untyped hand-drawn edge is the
     degrade path) and add one `Engage` row to the Threat detail Track file section
     (`ThreatDetail.tsx:118-160`) that names the missing source from `profile.fcSources`.
     UI text only; browser check.
2. Wave 3, E2 next family after those: Radar; Geometry and time; EO/IR, acoustic and RF;
   Environment (dossiers in `field-te/model-evidence/`).
3. Wave 4: design steps 6, 7, 9, 10, 13; then 8, 11, 12; then 14. Wave 5: T1 static bundle,
   then A1.

## Inputs Casey holds

None pending. Defaults still standing, reversible on Casey's word: `DEFAULT_BUDGET`;
`@fontsource` packages unused since `171ba23` and kept; light state inks darkened for 3:1
on paper; theme as a field of `rangeboard.view.v1`; T1 as a static bundle. Assumptions
taken in the E3 intervals slice, reversible: a 0/1 count is one whose support maximum is 1
(not one whose samples happen to be 0/1); the rule of three applies at n of n as the
mirror of 0 of n; count subs print the interval as two ends because a Wilson or clamped
interval is not symmetric; the Defeat interval is printed in percent, not percentage
points. Assumption in D-20: `[10, 4]` is the distinct classify dash; no other dash changed.
