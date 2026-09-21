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
  This handoff's commit records the flyout semantics on top of `7149cd2`. Do not
  restore the layered parity pins from that base: 16 events, kill mass 0, kills mean
  0.005.
- The frozen queue is [Plan.md](Plan.md). This handoff selects row K. The next rewrite
  selects row B.
- Open defect, unchanged and out of scope: `src/playback/shot.ts:320` charges the
  assignment-to-release delay as an open-loop coast of the fire-control track. Until
  row B lands, `legacyKineticPk` is the defensible model choice. See
  [the zero-kill kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md).

## Tasking

### Row K: Delete the orphan chart adapter

- Repository `~/Projects/rangeboard`. Base is this handoff's commit on `main`. Leave
  `docs/Plan.md` unmodified. An untracked `.cursor/` directory, if present, is not
  part of this task.
- Outcome: `mcRun.test.ts` no longer uses `heldTracksSeries`, `kpiSeries`, or
  `threatSeries` as oracles. Point those three equalities at `heldTracksOnGrid`,
  `liveKpisAt`, and `residualOnGrid`, which `mcRun.ts` already calls. Then delete
  `src/analysis/series.ts` and `src/analysis/series.test.ts`. If the legacy-release
  NaN rule in `salvosInFlightSeries` still needs a pin, move that one check next to
  engagement timing.
- Owned files: `src/analysis/series.ts`, `src/analysis/series.test.ts`,
  `src/playback/mcRun.test.ts` (the oracle equalities near the `heldTracksSeries`
  import), and `src/playback/engagementTiming.test.ts` only if that NaN pin moves.
  `mcRun.ts` already calls `heldTracksOnGrid` (`projection.ts`), `residualOnGrid`
  (`projection.ts`), and `liveKpisAt` (`liveStats.ts`).
- Exclusions: do not edit `src/playback/shot.ts`, `ADOPTED_SEED_KEYS`, or
  `estimate.parity.test.ts` expected values. Do not change Coyote `lethalRadiusM`,
  `guidanceNoiseM`, or `engageTimeS`. Do not enable TypeScript flags or split store,
  Inspector, or integration data. Do not start row B.
- Verified on the flyout commit: `npm run check` passed (200 test files, 2,156 tests).
  The choice and the moved layered pins are in the kinetic evidence file.
- Next action: retarget the three `mcRun.test.ts` equalities, move the legacy-release
  NaN pin if it still has a caller, delete both series files, and confirm nothing
  under `src/` imports `analysis/series`.
- Completion: `npm run check` passes. If a registered guide's inputs changed, review
  it before `npm run docs:check`. `docs/ENGINEERING_REFERENCE.md` still names
  `series.ts` as the forecast chart series; leave that sentence for row L unless this
  deletion makes a guide you must review factually false.
- Stop when nothing under `src/` imports `analysis/series` and `npm run check` is
  green. Rewrite this handoff so Tasking is row B. Do not edit `docs/Plan.md`.

## Landmines

- Zero kills from the default physical kinetic model are a defect, not physics.
  `src/playback/shot.ts:320` propagates the track over `engageTimeS` before the Rayleigh
  miss. `kinetic.verify.test.ts` passing at hand-supplied miss sigmas is not evidence the
  integrated interceptor model works. The two golden fixtures pin `truthTracks` and
  `legacyKineticPk`. Row K must not move `estimate.parity.test.ts`.
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
