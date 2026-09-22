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
file. Row J is the last row in the order table. After it passes, Tasking says the
order table is complete. Do not invent a next row. Do not edit `docs/Plan.md`.
Do not start the following row in the same session.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch.
  HEAD contains row O. Its parent is `d712cf1` (row N). The flight horizon is
  `7fdcb1e`. The authorized estimate-path recapture is `225e027`. An untracked
  `.cursor/` directory, if present, is not part of the queue. An uncommitted
  `AGENTS.md` edit, if present, is not part of the queue.
- The frozen queue is [Plan.md](Plan.md). This handoff selects row J. There is no
  following row in the order table.
- Row O: `withObservedLens`, `pruneSelection`, `rangeBounds`, `acceptMorrisMessage`,
  `acceptSobolMessage`, `chartPng`, `downloadPng`, and `SavedRunCompare` are no
  longer exported. Each still runs inside its own module. `exportChartPng` and
  `SavedRunCompareView` stay exported. `selectObservedThroughWholeS`, `bandNote`,
  `bandStep`, and `TrialOutcomeSummary` stay exported: nothing references them, and
  `noUnusedLocals` rejects a private unused binding. `ANALYSIS_KEY` stays exported.
  `spreadFor` and `spreadBasisFor` stay exported. `src/engine/index.ts` is unchanged.
- The estimate-path expects are the authorized 2026-09-21 recapture. Layered events
  stay 11, layered kill mass stays 1, layered kills mean is 1.115, JIATF leakers mean
  is 0.895, and JIATF kills mean is 0.105. `4.68` is not a pin.
- `releaseRetainedTrial` empties only the page copy from `boundRetainedTrial`.
- Row F (`3491866`): chunk grids are packed `Float64Array`s. `finish` transfers
  them to one worker, which merges, keeps the contiguous prefix, and calls
  `finishSummary`. At the retained cap (108 tracks, 3001 steps, 283 replicates,
  95,968,979 numbers) the transfer round trip was 31 ms and `finishSummary` was
  7088 ms on the worker.
- Row G: progress `done` is the contiguous prefix. `discarded` is the completed
  rows finish drops when a hole remains. The Run button says Stopping, and is
  disabled, while `pool.stopping` is set. That covers an ending and the summary
  worker, because `cancel` returns false in both.
- Row M: `censorLane` and `Lane` live in `src/panels/analysis/censorLane.ts`.
  `EngagementStrip.tsx` exports only the component and carries no
  `only-export-components` suppression.
- Row N: `basisJson` lives in `src/model/basisJson.ts`. It sorts object keys and
  preserves array order. `dropEditedProvenance`, `resetBuiltin`, and
  `sameAppliedOverrides` use it. A reordered object keeps the caller's object or
  array. Array order stays significant.

## Tasking

### Row J: subscriber throws

- Repository `~/Projects/rangeboard`. Base is local `main` at the row O commit.
  Leave `docs/Plan.md` unmodified. Do not start another row. J is last in the
  order table.
- Outcome: an injected throw from the overrides subscriber stays inside a boundary.
  The plan names a raw subscriber in `App.tsx` around the overrides subscription
  that can throw out of `setState`, with no ancestor boundary in `main.tsx`.
  Toolbar selectors sit under the board boundary.
  - The live override-edit subscriber is the module-level `useOverrides.subscribe`
    at the end of `src/state/store.ts`. It calls `overridesChanged` when the
    override list identity changes. It is not in `App.tsx`.
  - `App.tsx` subscribes to `useStore` only to clear placement. `main.tsx` renders
    `App` with no boundary. `App` wraps the board, including `Toolbar`, in
    `ErrorBoundary` with label `Board`.
  - `src/io/persistOverrides.ts` has a separate autosave subscription. Do not fold
    that adapter into the render boundary.
- Owned files: the subscriber, the boundary that must contain its throw, their
  tests, and guides that fingerprint those sources. Browser check the injected
  throw.
- Exclusions: do not edit `docs/Plan.md`. Do not invent a row after J. Do not
  change Sobol indices, Morris rankings, the Sobol row-count warning, or the
  estimate-path expects. Do not pin 4.68. Do not restore 16 events, kill mass 0,
  or kills mean 0.005. Do not change Coyote `lethalRadiusM`, `guidanceNoiseM`,
  or `engageTimeS`. Do not add a terminal-homing term. Do not restore
  `src/analysis/series.ts`. Do not add a handoff bullet that treats run-store
  NaN as an open export failure. Do not structured-clone the packed grids back
  onto the page. Do not relax the two-point boundary or flight-path load check.
  Do not clear the existing `only-export-components` suppressions. Do not put
  `censorLane` back on `EngagementStrip.tsx`. Do not replace `basisJson` with
  `JSON.stringify`. Do not re-export the helpers row O made private. Do not
  delete `selectObservedThroughWholeS`, `bandNote`, `bandStep`, or
  `TrialOutcomeSummary`. Do not un-export `ANALYSIS_KEY`. Do not change
  `src/engine/index.ts`.
- Next action: isolate the override subscriber so a throw it injects is contained
  by a boundary, and confirm that in the browser. Toolbar selectors already sit
  under the board boundary.
- Completion: an injected throw stays inside a boundary. `npm run check` passes.
  The browser check is recorded.
- Stop when that gate passes. Do not edit `docs/Plan.md`. Rewrite this handoff so
  Tasking says the order table is complete.

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
- No production `as unknown as` remains in model or state. Test fixtures still use
  that cast. `basisJson` (`src/model/basisJson.ts`) sorts object keys and preserves
  array order. `dropEditedProvenance`, `resetBuiltin`, and `sameAppliedOverrides`
  use it.
- A run's identity is its basis signature and the override list it applied. An override
  edit that changes a value in force reaches the store only through the
  `useOverrides.subscribe` line at the end of `src/state/store.ts`.
  `sameAppliedOverrides` ignores object key order and keeps array order.
- The Systems tab is the only view that shows an override; rings, WEZ, telemetry and the
  Prepare forecast read `trial.scenario` or the board scenario, which keep the library
  value.
- Chunk grids are packed row-major `Float64Array`s (`i * steps + k`). `finish`
  transfers those buffers. Do not structured-clone them onto the page to summarize.
  Progress `done` is the prefix, not every landed index. `discarded` is set only
  when finish commits a hole. The Run button stays Stopping while `pool.stopping`
  is set; `cancel` returns false for that wait.
- The Fragility Sobol warning is a planning factor from one board: 29 entities at
  2560 rows took 499 s, scaled by entity count and row count, and it fires at half
  of `DEFAULT_BUDGET.timeMs`. It is not a clock reading for the board on screen.
- Load refuses a flight path or boundary with fewer than two points. In-memory
  fixtures may still hold an empty `points` array (`scenarioHasWork` in
  `src/io/persist.test.ts`, `scenarioInstall.test.ts`). Those objects do not pass
  `parseScenarioData`.
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
  does not fail on them. `EngagementStrip.tsx` no longer carries a suppression.
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
- `docs/Plan.md` is frozen. Rewrite this handoff when row J passes. Do not mark a row
  done inside the plan. Do not invent a row after J.
- `storageManagement.ts` derives live keys from every non-prefix export of
  `storageKeys.ts`. Un-exporting `ANALYSIS_KEY` changes that readout.
- `selectObservedThroughWholeS`, `bandNote`, `bandStep`, and `TrialOutcomeSummary`
  have no importer. Un-exporting one of them fails `noUnusedLocals`. Do not delete
  them and do not add a suppression to keep them private.

## Evidence

- [Plan](Plan.md)
- [Flight-horizon measurement, 2026-09-21](field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md)
- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
