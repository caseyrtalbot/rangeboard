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
- Done 2026-09-05 (this commit, capture `field-te/evidence/e2-solver-spreads-2026-09-05/`):
  R-F-43 closed-form intercept solver (`analyticTofS`; firing fixture moves under 0.06 DT and
  Pk under 1e-5; detection fixture one replicate's effect one DT earlier; layered identical);
  R-F-35 Stinger and Leonidas `pk` rows take the PF pseudo-beta (no capture moves); F-62
  SPEXER 2000 `refRcsM2` 0.04 recorded as a PF provenance row; R-F-20 `Engage` row in the
  Threat detail names the missing fire-control source (browser-checked, `browser-check.md`).
  The engine rule for a typed route without a fire-control source is unchanged.
- Done 2026-09-06: E2 radar study (`7f2bea6`, `field-te/model-evidence/radar.md` section "E2
  study, 2026-09-05") and its correction (this commit): Swerling 0 is the exact Marcum Q, not the
  Albersheim inverse whose tail floored at 0.017; fixtures byte-identical (no seed target is
  Swerling 0). Placard Pd stays 0.5 by Casey's word; its sensitivity (firm track at 0.79 to
  1.29 of the quoted range for Pd 0.5 to 0.9) is in the dossier.

## Next

1. Wave 3, E2: poll Casey on the next family: Geometry and time; EO/IR, acoustic and RF;
   Environment (dossiers in `field-te/model-evidence/`). Radar is done. No open finding
   remains in any of them; each study starts from its dossier's unsupported-conditions
   section.
2. Wave 4: design steps 6, 7, 9, 10, 13; then 8, 11, 12; then 14. Wave 5: T1 static bundle,
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
