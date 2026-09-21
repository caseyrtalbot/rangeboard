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
  This commit removes the orphan chart adapter on top of `6371ba0`. The three
  `mcRun.test.ts` oracles call `heldTracksOnGrid`, `liveKpisAt`, and `residualOnGrid`.
  Nothing under `src/` imports `analysis/series`. An untracked `.cursor/` directory,
  if present, is not part of the queue.
- The frozen queue is [Plan.md](Plan.md). This handoff selects row B. The next rewrite
  selects row C.
- Open defect, this row's target: `src/playback/shot.ts:320` charges the
  assignment-to-release delay as an open-loop coast of the fire-control track. Until
  this row lands, `legacyKineticPk` is the defensible model choice. See
  [the zero-kill kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md).

## Tasking

### Row B: Flight horizon in `shot.ts`

- Repository `~/Projects/rangeboard`. Base is this commit on `main`, the series
  deletion on top of `6371ba0`. Leave `docs/Plan.md` unmodified. Do not restore
  `src/analysis/series.ts` or the old chart-adapter oracles.
- Outcome: a regression the size of `kinetic.verify.test.ts` uses the engine's own
  sigma. A long `engageTimeS` must not enter `predictionSigmaAtS`, and the horizon
  must be `max(0, intercept.tEffectS - releaseS)` from the estimate time. Then replace
  the horizon at `src/playback/shot.ts:320`. The candidate from the kinetic record is
  `predictionSigmaAtS(est, est.state.tS + flightS)` when an estimate exists.
- Owned files: `src/playback/shot.ts`, the new regression beside
  `src/playback/kinetic.verify.test.ts`, and a before/after note beside
  [the Phase 3 comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md). The
  before values are the post-flyout pins in `src/playback/estimate.parity.test.ts`:
  layered events 11, layered kill mass 1, layered kills mean 1.1, JIATF leakers mean
  1, JIATF kills mean 0. Write the measured after values. Do not edit those expects.
- Exclusions: do not edit expected values in `estimate.parity.test.ts`. Do not change
  Coyote `lethalRadiusM`, `guidanceNoiseM`, or `engageTimeS`. Do not add a
  terminal-homing term. Do not restore 16 events, kill mass 0, or kills mean 0.005.
  Do not pin the record's 4.68 kills mean. Do not enable TypeScript flags or split
  store, Inspector, or integration data. Do not start row C.
- Verified on this tree before row B: the Pd 1 / Pk 1 oracle in `mcRun.test.ts`
  matches one replicate of `heldTracksOnGrid`, `residualOnGrid`, and `liveKpisAt`.
  `npm run check` passed (199 test files, 2,116 tests). Flyout semantics are in the
  kinetic evidence file. The layered kills mean after this horizon will differ from
  both 1.1 and 4.68.
- Next action: add the sigma regression, replace the horizon at `shot.ts:320`, run
  `kinetic.verify.test.ts`, `estimate.parity.test.ts`, the protected truth-path
  suites, and the intercept and attrition flyout tests. Expect the five pins above
  to fail. Write before and after beside the Phase 3 comparison.
- Completion: the five pins fail with measured values written down, and no expected
  value is edited. If a registered guide's inputs changed, review it before
  `npm run docs:check`.
- Stop when the five parity pins have failed and the measured values are written
  down. Ask before replacing any expected value. Rewrite this handoff so Tasking is
  row C. Do not edit `docs/Plan.md`.

## Landmines

- Zero kills from the default physical kinetic model are a defect, not physics.
  `src/playback/shot.ts:320` propagates the track over `engageTimeS` before the Rayleigh
  miss. `kinetic.verify.test.ts` passing at hand-supplied miss sigmas is not evidence the
  integrated interceptor model works. The two golden fixtures pin `truthTracks` and
  `legacyKineticPk`. Row B must not edit `estimate.parity.test.ts` expected values.
- Flyout semantics are landed. A saved builtin that omits `flyoutSpeedMps` adopts the
  seed cruise speed. An interceptor with no positive cruise speed uses `kineticPk`,
  matching `flyoutProfile`. Coyote is 154 m/s and MEROPS is 78 m/s. Roadrunner and
  Anvil have no seed cruise speed, so they stay on the legacy curve. The layered
  estimate-path pins are now 11 events, kill mass 1, and kills mean 1.1. Do not restore
  16, 0, and 0.005. Do not pin the record's 4.68 kills mean. The horizon is still open,
  so that 1.1 is not a physical-miss result.
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
- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
