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
  The flight horizon is `7fdcb1e`. The authorized estimate-path recapture is
  `225e027`. The row L docs commit carries this handoff. An untracked `.cursor/`
  directory, if present, is not part of the queue.
- The frozen queue is [Plan.md](Plan.md). This handoff selects row D. The next rewrite
  selects row E.
- The estimate-path expects are the authorized 2026-09-21 recapture. Layered events
  stay 11, layered kill mass stays 1, layered kills mean is 1.115, JIATF leakers mean
  is 0.895, and JIATF kills mean is 0.105. `4.68` is not a pin.

## Tasking

### Row D: Bound trial retention

- Repository `~/Projects/rangeboard`. Base is local `main`. The flight horizon is
  `7fdcb1e`. The authorized recapture is `225e027`. Leave `docs/Plan.md` unmodified.
  Do not start row E.
- Outcome: bound what the UI reads from a retained trial. `src/playback/trial.ts`
  `runTrial` appends every scan observation and every per-step track estimate.
  `src/state/analysisRequests.ts` `acceptTrialMessage` stores that whole
  `TrialResult` on `TrialState.result` in `src/state/runState.ts`. React also keeps
  the previous result on the alternate fiber after New run. Exported ledgers need
  parity before and after. Browser memory check on the firing fixture.
- Owned files: the retention path (`src/playback/trial.ts`, `src/state/runState.ts`,
  `src/state/analysisRequests.ts`) and the readers that must keep the same ledger.
  Export parity is `src/io/trialExport.test.ts`.
- Exclusions: do not edit `docs/Plan.md`. Do not start row E. Do not change the
  estimate-path expects. Do not pin 4.68. Do not restore 16 events, kill mass 0, or
  kills mean 0.005. Do not change Coyote `lethalRadiusM`, `guidanceNoiseM`, or
  `engageTimeS`. Do not add a terminal-homing term. Do not restore
  `src/analysis/series.ts`.
- Verified on this tree before row D: row L changed only the uncertainty-crosswalk
  analysis-panel sentence and this handoff. `npm run check` passed (200 files,
  2118 tests).
- Next action: bound retained observations and tracks to what the UI reads, then
  show ledger parity and a flat firing-fixture heap across New run.
- Completion: ledger parity held; firing-fixture heap stays flat across New run.
- Stop when that gate passes. Do not edit `docs/Plan.md`. Do not start row E.

## Landmines

- The assignment-to-release coast is no longer the code. `shot.ts` calls
  `predictionSigmaAtS(est, est.state.tS + flightS)` with
  `flightS = max(0, intercept.tEffectS - (t + es.engageTimeS))`.
  `kinetic.verify.test.ts` still feeds hand-supplied miss sigmas.
  `kinetic.horizon.test.ts` is the regression that uses `predictionSigmaAtS`. Do not
  put `engageTimeS` back into that call.
- The estimate-path expects are the authorized recapture: layered events 11, kill
  mass 1, layered kills 1.115, JIATF leakers 0.895, JIATF kills 0.105. Do not pin the
  record's 4.68 kills mean. Do not restore 16, 0, and 0.005.
- Flyout semantics are landed. A saved builtin that omits `flyoutSpeedMps` adopts the
  seed cruise speed. An interceptor with no positive cruise speed uses `kineticPk`,
  matching `flyoutProfile`. Coyote is 154 m/s and MEROPS is 78 m/s. Roadrunner and
  Anvil have no seed cruise speed, so they stay on the legacy curve.
- `seekerAcquisitionRangeM` gates feasibility only. Nothing reduces miss sigma for a
  seeker-equipped round.
- Physics tab: a checked box selects the prior planning fallback; a cleared box selects
  the physical model when its required fields are present.
- `docs/Plan.md` row L still names `withBands`, `TRACK_LADDER_STYLE`, and `series.ts`
  inside `docs/ENGINEERING_REFERENCE.md`. Those sentences are gone from the reference.
  The crosswalk analysis-panel sentence cites `trialSeries.ts` and `mc.ts`. Dated
  evidence, including the doctrine link to the pre-deletion `OutcomeSummary` blob,
  stays. Do not restore `src/analysis/series.ts`.
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
