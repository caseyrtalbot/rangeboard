# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [README.md](README.md) and the
commit log. This file holds only the position, the current row and the landmines. A
fresh agent starts from this file and the docs index. This file does not authorize a
commit, push or merge.

The queue is [Plan.md](Plan.md). That file stays unmodified. This handoff always links
to it and selects exactly one row. After the selected row's gate passes, rewrite this
file so Tasking is the next row in the plan's order table. Do not edit `docs/Plan.md`.
Do not start the following row in the same session.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch.
  The flight horizon is committed. `src/playback/shot.ts` calls
  `predictionSigmaAtS(est, est.state.tS + flightS)` with
  `flightS = max(0, intercept.tEffectS - (t + es.engageTimeS))` when an estimate exists.
  An untracked `.cursor/` directory, if present, is not part of the queue.
- The frozen queue is [Plan.md](Plan.md). This handoff selects row C. The next rewrite
  selects row L.
- The five estimate-path pins are still the pre-horizon expects. Two trial pins still
  pass. Three means moved and are written in
  [the flight-horizon note](field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md).
  No expected value has been replaced.

## Tasking

### Row C: Recapture

- Repository `~/Projects/rangeboard`. Base is the flight-horizon commit on `main`.
  Leave `docs/Plan.md` unmodified. Do not start row L.
- Outcome: replace only the estimate-path expects that this horizon moved, and only
  after the user authorizes each number. Update the kinetic record so it no longer
  describes the assignment-to-release coast as the code. Leave `truthTracks`, the
  golden fixture files, and the Coyote datasheet fields unchanged.
- Owned files: `src/playback/estimate.parity.test.ts` and
  [the kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md).
  The measured before/after is
  [the flight-horizon note](field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md).
- Measured at seed 4821, physics stripped, 200 aleatory replicates. Before is the
  expect still in the test. After is the flight horizon.

  | Pin | Before | After | Expect |
  | --- | ---: | ---: | --- |
  | Layered `report.events` length | 11 | 11 | still passes |
  | Layered kill mass | 1 | 1 | still passes |
  | Layered kills mean | 1.1 | 1.115 | fails |
  | JIATF leakers mean | 1 | 0.895 | fails |
  | JIATF kills mean | 0 | 0.105 | fails; the leakers expect stops the test first |

- Exclusions: do not replace an expect before that number is authorized. Do not pin
  4.68. Do not restore 16 events, kill mass 0, or kills mean 0.005. Do not change
  Coyote `lethalRadiusM`, `guidanceNoiseM`, or `engageTimeS`. Do not add a
  terminal-homing term. Do not restore `src/analysis/series.ts`. Do not enable
  TypeScript flags or split store, Inspector, or integration data.
- Verified on this tree before row C: `kinetic.horizon.test.ts`,
  `kinetic.verify.test.ts`, `shot.test.ts`, and `intercept.test.ts` passed.
  `sensitivity.parity.test.ts`, `accuracy.verify.test.ts`, and
  `convergence.verify.test.ts` passed (28 tests). The attrition flyout describe
  passed (3 tests). `estimate.parity.test.ts` is 2 failed and 2 passed. Layered
  leakers mean stayed 0, layered firm-track mean stayed 1.5 s, and JIATF firm-track
  mean stayed 505.0625 s. `npm run check` was not run: the parity expects are still
  the pre-horizon pins on purpose.
- Next action: ask for authorization of 1.115, 0.895, and 0.105. Leave the two
  passing trial expects as they are. Then update the kinetic record and run
  `estimate.parity.test.ts`.
- Completion: each replaced expect was authorized, the kinetic record matches the
  landed horizon, and the protected truth-path suites still pass.
- Stop when the authorized expects are in the test and the kinetic record is
  updated. Do not edit `docs/Plan.md`.

## Landmines

- The assignment-to-release coast is no longer the code. `kinetic.verify.test.ts`
  still feeds hand-supplied miss sigmas. `kinetic.horizon.test.ts` is the regression
  that uses `predictionSigmaAtS`. Do not put `engageTimeS` back into that call.
- The parity expects are still the pre-horizon pins. Layered events 11 and kill
  mass 1 still pass. The means that fail are layered kills 1.1 against 1.115,
  JIATF leakers 1 against 0.895, and JIATF kills 0 against 0.105. Do not pin the
  record's 4.68 kills mean. Do not restore 16, 0, and 0.005.
- Flyout semantics are landed. A saved builtin that omits `flyoutSpeedMps` adopts the
  seed cruise speed. An interceptor with no positive cruise speed uses `kineticPk`,
  matching `flyoutProfile`. Coyote is 154 m/s and MEROPS is 78 m/s. Roadrunner and
  Anvil have no seed cruise speed, so they stay on the legacy curve.
- `seekerAcquisitionRangeM` gates feasibility only. Nothing reduces miss sigma for a
  seeker-equipped round.
- Physics tab: a checked box selects the prior planning fallback; a cleared box selects
  the physical model when its required fields are present.
- Row L's frozen plan text still names `withBands`, `TRACK_LADDER_STYLE`, and
  `series.ts`. Those sentences were removed from `docs/ENGINEERING_REFERENCE.md` with
  the adapter. `docs/field-te/model-evidence/uncertainty-crosswalk.md` still cites the
  old panel names. Dated evidence stays.
- Three property-order-sensitive JSON comparisons remain findings, not fixes, and are
  row N: `dropEditedProvenance` in `src/model/types.ts:589`, `resetBuiltin` in
  `src/model/libraryLifecycle.ts:239`, and `sameAppliedOverrides` in
  `src/model/applyOverrides.ts:78`. `src/state/analysisBasis.ts:21` already sorts object
  keys and preserves array order. No production `as unknown as` remains in model/state.
- A run's identity is its basis signature and the override list it applied. An override
  edit that changes a value in force reaches the store only through the
  `useOverrides.subscribe` line at the end of `src/state/store.ts`.
- The Systems tab is the only view that shows an override; rings, WEZ, telemetry and the
  Prepare forecast read `trial.scenario` or the board scenario, which keep the library
  value.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate that
  touches the entry. `sql.js` must stay behind `await import` with its wasm URL.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- Prettier wrapping of JSX text can change React `children`. Keep button labels on one
  line, or tests that compare `props.children` to a string will miss the control. See
  `src/ui/ErrorBoundary.tsx`.
- `library:check` and `schema:check` compare generated bytes. Do not hand-edit
  `*.generated.ts` or `src/io/runtimeSchema.ts`.
- Oxlint `only-export-components` warnings already exist; do not add more. `npm run lint`
  does not fail on them.
- The pool's budget is the main thread's: `DEFAULT_BUDGET.retainedNumbers` bounds the
  merged rows the page holds, not a worker. Raising it or `MAX_REPLICATES` in
  `RunTab.tsx` brings the tab crash back on large raids. The check is not a hard cap:
  in-flight chunks can still land.
- A throw inside the react-konva tree never reaches `src/ui/ErrorBoundary.tsx`; only
  `SceneErrorBoundary` sees it. Every layer belongs inside that boundary.
- `sobol-done` carries `result: null` on a cancel. Readers must handle the null.
- `npm run check` fingerprints `src`, so any source edit needs `npm run docs:review` on
  the guides before `docs:check` passes.
- Every edit to a registered reference needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails. Guides
  fingerprint `src/`, so a source commit after a docs review invalidates it.
- `docs/Plan.md` is frozen. Rewrite this handoff for the next row. Do not mark a row
  done inside the plan.

## Evidence

- [Plan](Plan.md)
- [Flight-horizon measurement, 2026-09-21](field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md)
- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
