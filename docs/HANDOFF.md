# RangeBoard continuation status

One handoff for the calibration plan. It is rewritten in place at each phase gate of
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), from the Phase 0 gate through the Phase 4
gate. It records verified completion and the next boundary. It does not authorize a
commit, push or merge, and it never becomes a task list. Old handoffs are cancelled and
live only in Git history.

Rules for each rewrite: keep this shape, replace the content, and keep only the current
phase and the one before it. Every claim names a commit, a test or a browser check. Prose
about an unfinished lane goes in Open items, not in Completed.

## Phase status

| Phase | Gate | Merge commit | Date |
| --- | --- | --- | --- |
| 0 Data foundation | passed | `f024709` | 2026-09-10 |
| 1 Real-mode statistics | passed, one exit item open | see the next commit | 2026-09-10 |
| 2 Tracks and kill chain | not started | | |
| 3 Sensor and effector physics | not started | | |
| 4 Hypothesis tools | not started | | |

## Completed

Phase 0, gate `f024709` on `main`, nothing pushed. Contract `8e9a0bc`, lanes merged at
`ff24472`, `b1493ec`, `e48b3ab`, `a56291c`, integration `248f4ca`. Data package under
`data/library` with schema, build and health check; class priors; overrides store and the
Systems tab; IndexedDB run store with history. Evidence in
[p0-gate-2026-09-10](field-te/evidence/p0-gate-2026-09-10/README.md).

Phase 1, all on `main`, nothing pushed. Base `7f2997d`.

- 1.a Contract, `calib/p1-contract`, `64c9f83` plus the orchestrator's `c4473e7`.
  `McSettings` is the return type of `runSettings` and gains `sampling`,
  `sensitivityDepth`, `sobolBase`, `stopFloor`, `stopCap`, `confidence` with `DEFAULT_*`
  constants; a fresh scenario is Monte Carlo, total, LHS, half-width 0.5 with floor 30 and
  cap 2000; a save without the run fields stays deterministic and aleatory through
  `runSettings` and `fillScenario`. `PoolProgress`, `MorrisResult`, `SobolResult` in
  `src/playback/mcTypes.ts`; `McState` gains `pool`, `morris`, `sobol`; `src/engine/index.ts`
  barrel; `.oxlintrc.json` forbids react, konva, `window`, `document` under `src/playback`,
  `src/analysis`, `src/geometry`, `src/engine`. Stop condition: `runSettings.test.ts`,
  the lint proof in the report, full suite 149 files and 1763 tests.
- 1.3 part A, `calib/p1-range`, `ec80ac0`, fast-forwarded. `McPartial`,
  `replicateRangeLoop`, `halfWidthReached` (floor from the settings), `finishSummary`,
  `mergePartials` (`mergeSummaries.ts`). Stop condition: `mergeSummaries.test.ts` (two
  ranges in either order equal `runReplicates`, aleatory and total); parity files unchanged.
- 1.5 Sobol chart, `calib/p1-sobolchart` (`652a028`), merged `570ada4`. `SobolChart.tsx`
  (two bars per row with bootstrap whiskers, 0 to 1 scale, hidden ranking text),
  `SensitivityWidget.tsx`, `charts/__fixtures__/sobolFixture.ts`. Stop condition: 71 tests
  under `src/charts` and the widget.
- 1.4 Run tab, `calib/p1-runtab` (`3e38201`), merged `abf332f`. `settings/RunTab.tsx` with
  every field, its default and a reset; `RunControl.tsx` (Deterministic switch, Run or Stop,
  progress line with the stop rule and the pool size) on Prepare and Analyze; the popover
  is gone. Stop condition: browser check on port 5383, 0 page errors.
- 1.2 Browser pool, `calib/p1-pool` (`201d7c3`), merged `ac8343d`. `workerPool.ts`:
  `min(hardwareConcurrency - 1, 8)` workers, chunks by index, half-width rule on the
  contiguous prefix from the floor, cap, slot cancel semantics; `run-range` in
  `mc.worker.ts`; `startPooledRun` in `mcClient.ts`. Stop condition: `workerPool.test.ts`
  (pooled equals `runReplicates` at 1, 3 and 7 workers, aleatory and total);
  `workerGraph.test.ts` and `workerSlot.test.ts` unchanged.
- 1.3 part B, `calib/p1-sampling` (`8fff845`), merged `3891fcb`. `sampling.ts` (LHS stratum
  per replicate index from a keyed permutation over the loop end), `morris.ts`,
  `sobol.ts`, Morris and Sobol requests and messages, loop end `stopCap` under a target.
  Stop condition: Ishigami inside every bootstrap interval at base 1024; a range slice
  equals the full loop's slice under LHS; parity files unchanged.
- 1.1 Headless runner, `calib/p1-runner` (`9fc436e`), merged `4f0730f`.
  `vite.engine.config.ts` builds `dist-engine/engine.js`; `scripts/run-engine.mjs` with
  `scripts/engine-worker.mjs` over `worker_threads`; `src/engine/loadScenario.ts`;
  `npm run engine`, `engine:build`, `test:engine` (now inside `check`). Stop condition:
  `scripts/test-engine-cli.mjs` (the record equals `runReplicates` at one seed, 3 workers
  and 1 worker); timing in
  [p1-runner-2026-09-10](field-te/evidence/p1-runner-2026-09-10/timing.txt).
- 1.c Integration, `0f5231a`, plus the gate commit. The Run button runs on the pool
  (`mcLaunch` through `startPooledRun`, the pool sink writes `mc.pool` while running);
  `sensitivityDepth: 'full'` runs Morris then Sobol on the sensitivity slot with the kept
  fields; Fragility mounts `SensitivityWidget`; `RunControl` and the chip read the loop end
  after a half-width stop; docs updated and reviewed.

## Open items

- Phase 1 exit item not met: the runner cannot complete 10 000 replicates on the largest
  fixture (`layered-acoustic-merops.json`, 37 002 retained numbers per replicate) because
  `DEFAULT_BUDGET.retainedNumbers` (96 million, a browser-worker limit) refuses it; 2594
  replicates fit and ran in 21.6 s on 14 threads. Decision for Casey; recommendation: give
  the Node runner its own budget from the machine's memory and keep the browser budget.
- The Morris `'leakers'` response on the JIATF-401 laydown is 0 in every row at ten
  trajectories, so every mu star is 0 there; `'firstDetectS'` screens well. The Fragility
  response selector picks the response; no default change made.
- A Sobol response with zero variance over the base rows gives NaN indices, which JSON
  writes as null.
- Wilson intervals keep z 1.96 and the rule of three keeps 3 / n; the t interval follows
  `confidence`. `DEFAULT_CONFIDENCE` and `STAT_CONF` are equal and not linked.
- `RunManifest` and `McSummary` do not record the sampling mode; `RunRecord` does not
  carry `morris` or `sobol`.
- `src/state/analysisBasis.ts` excludes the five old raw run keys from the signature but
  not the six new ones (the resolved settings already carry them, so the keys appear twice).
- `src/engine/loadScenario.ts` repeats `fillScenario` from its pieces because `persist.ts`
  imports the store; no drift test yet.
- The worker applies `DEFAULT_BUDGET` per range chunk; a chunk stopped on budget would
  leave a hole and the pool would finish on a shorter prefix. Not reachable at today's chunk
  sizes.
- `PoolProgress.perWorkerDone` includes in-flight range progress, so its sum can exceed
  `done` between merges.
- Bundle: entry 344.62 kB gzip against the 360 kB budget after the pool joined the entry
  chunk; the engine additions do not load lazily yet.
- The CLI sets `runMode: 'monte-carlo'` on the loaded scenario so the manifest matches its
  summary; the fill default for a file without run fields is deterministic.
- The Run tab names the fresh-scenario mode and uncertainty as defaults with local
  constants; `types.ts` has no `DEFAULT_RUN_MODE` or `DEFAULT_UNCERTAINTY`.
- No pinned parity number moved in Phase 1. `convergence.verify.test.ts` and
  `mcRun.test.ts` fixtures pin aleatory, a null target or `stopCap` where they read the
  loop end.
- Seven agent worktrees under `.claude/worktrees/` hold the lane branches; every commit is
  merged.

## Continuation boundary

The next task is the Phase 2 contract slice in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#4-phase-2-tracks-and-kill-chain): a
`fable-medium` worker on `src/model/types.ts`, `src/playback/trackTypes.ts` and
`src/analysis/fidelity.ts`. Wave one (2.1 to 2.3) starts only after it merges. One poll
is open: the runner budget decision above.

## Verification at the last gate

- `npm run check` at the gate: exit 0; 159 test files, 1853 tests; engine CLI test 2 of 2;
  library check 90 models and 633 fields; build entry 1,170.44 kB (344.62 kB gzip).
  Output in [check.txt](field-te/evidence/p1-gate-2026-09-10/check.txt).
- Parity: `sensitivity.parity.test.ts`, `accuracy.verify.test.ts`,
  `convergence.verify.test.ts` unchanged and passing inside that run.
- Browser checks recorded in
  [the gate evidence](field-te/evidence/p1-gate-2026-09-10/README.md): Run tab defaults,
  default run on the pool, 1000 replicates, Morris then Sobol to the chart, 0 page errors.
- Timing against blueprint section J: default run 0.13 s, 1000 replicates 2.2 s,
  sensitivity 5.9 s, all inside target; the 10 000 replicate command-line target is
  blocked by the budget (open item).
