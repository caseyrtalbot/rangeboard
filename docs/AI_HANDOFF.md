# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-06 on Casey's word. Remote verified equal after each push. Tree clean except
untracked `.claude/`. Contributor: Claude Fable under [AGENTS.md](../AGENTS.md). Rule: at
every choice, stop and poll Casey in the conversation with the evidence and one
recommendation; never park a choice in a report or a list. There is no findings register
(retired 2026-09-05); open work lives in this file under Next.

## Verified

- Gates at `f2dccd4` (the last source commit): type-check 0 errors, 1,413 tests in 93 files,
  lint 74 warnings (the same pre-existing set, all `react(only-export-components)`), build
  (one pre-existing chunk-size warning). Every source commit since `785b4c3` passed the same
  four gates before it was pushed.
- Parity baseline: `field-te/evidence/e2-radar-2026-09-05/numerical-after.json` (firing
  fixture, `replicates: 4`; assessments, deterministic report, aleatory, total, sensitivity),
  byte-identical to `e2-solver-spreads-2026-09-05/numerical-after.json`. The same directories
  hold `detection-after.json` (detection fixture, 30 total replicates, seed 4821) and
  `layered-after.json` (layered fixture, report and 30 aleatory replicates, seed 7). A
  refactor of engine, store or playback code reproduces all three byte for byte with the probe
  `e2r-capture.ts.txt` run as a scratch vitest file.
- Browser checks 2026-09-05, all with real store actions and no page errors: F-16 editor
  coupling (`track-c2-slice-2026-09-05/browser-check.md`), the Threat detail `Engage` row
  (`e2-solver-spreads-2026-09-05/browser-check.md`), plus the earlier D-20 classify dash and E3
  intervals checks (`d20-classify-dash-2026-09-05/`, `e3-intervals-2026-09-05/`).

## Done

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
- Wave 3 (E2, E3) closed 2026-09-06 on Casey's word. No E2 study is pending.

## Next

Wave 4 is the design contract, [docs/design/DESIGN_CONTRACT.md](design/DESIGN_CONTRACT.md),
steps 6 to 14 in the order below. Steps 1 to 4 are done (`51ce6cb`, `171ba23`, `dca021a`,
`931f152`, `3c1282a`); step 5 was withdrawn. Each step ships alone with the four gates, a
browser check with real store actions (`VERIFICATION.md`), screenshots in
`field-te/evidence/design-stepN-<date>/`, and a Done line here. The contract's surface rules
(section 2), tokens (3), type roles (4) and components (5) bind every step; a review that
finds a violation fails the step. Open the contract by section, not cover to cover.

1. Step 6, Analysis rail: widget rows and the pinned scan strip. Every closed row shows its
   headline figure or state; rows open on click; pin and focus actions on hover; sub-tabs
   Run, Sensors, Effectors, System and Threat filter the same twelve widgets; a density
   control (compact, standard, relaxed) on the panel header, remembered per user in the view
   record (no new storage key); a cancel control for a running Monte Carlo in the scan strip
   (the worker already honours `DEFAULT_BUDGET`; this is the affordance). Acceptance: every
   closed row shows its headline; pins persist; browser check at the three densities.
   Start by reading `src/panels/AnalysisPanel.tsx`, `src/state/analysisLayout.ts` and
   `src/panels/analysis/widgets/`.
2. Step 7, gates as rows with caveats stated once per widget. Six gate rows fit in 200 px
   (component "Gate row"). The per-threat blocked-route explanation is already built as the
   `Engage` row in `ThreatDetail.tsx` (2026-09-05); step 7 carries the same text into the
   new threat row and does not build it twice.
3. Step 9, Inspector split (F8): one file per tab under `src/panels/inspector/`, each with
   its own selector; sticky identity header; sub-nav with counts; key and value grid with the
   mark column. Existing Inspector tests pass unchanged.
4. Step 10, library dock (F9): 52 px dock, opaque flyout over the board that closes on drop
   or Escape, one fuzzy search list behind the dock and ⌘K, numbered pins. Board width
   unchanged when the flyout opens; drag to board still works.
5. Step 13, view presets (F6): Plan, Live, Debrief, Clean; the seventeen toggles stay under
   Advanced.
6. Then step 8 (charts drawn to the board, F7: same series values on the fixed fixture,
   render cost per tick measured; parity is the gate), step 11 (focus drawer), step 12
   (scrubber events and the entity card, F5: parity is the gate), step 14 (keyboard on the
   board, F4: keyboard-only walkthrough, WCAG 2.2 AA focus and target size).
7. Wave 5: T1 static bundle (PLAN section 6), then A1 (PLAN section 8).

Choices to poll Casey on as they arrive, one recommendation each: the density default;
whether pins live in the view record or a new field of it; the cancel control's placement
and wording; any change to the eleven channel colours that read badly on paper (steps 8, 12
and 14 own them, `design-step4-2026-09-05/findings.json`).

## Inputs Casey holds

None pending. Defaults still standing, reversible on Casey's word: `DEFAULT_BUDGET`;
`@fontsource` packages unused since `171ba23` and kept; light state inks darkened for 3:1
on paper; theme as a field of `rangeboard.view.v1`; T1 as a static bundle. Assumptions
taken in the E3 intervals slice, reversible: a 0/1 count is one whose support maximum is 1
(not one whose samples happen to be 0/1); the rule of three applies at n of n as the
mirror of 0 of n; count subs print the interval as two ends because a Wilson or clamped
interval is not symmetric; the Defeat interval is printed in percent, not percentage
points. Assumption in D-20: `[10, 4]` is the distinct classify dash; no other dash changed.
