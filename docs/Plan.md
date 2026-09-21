# Plan

This file is the frozen queue. Do not edit it when a row lands, and do not record
completion here. Progress lives only in [HANDOFF.md](HANDOFF.md). That file always
links here and selects exactly one row. After that row's gate passes, rewrite the
handoff so its Tasking section is the next row in the order table, and leave this
file unchanged.

Authored against local `main` at `7149cd2` (2026-09-21). Measurements below were
checked against that tree. Line numbers are positions at authorship.

## Already landed

`7149cd2` fixed the tab crash and several adjacent run-path failures. The pool
applies `DEFAULT_BUDGET`, finishes on the contiguous prefix, and drops a worker
that stays silent past `CANCEL_GRACE_MS`. Also landed: sweep cancel inside a
cell, a null Sobol result on cancel, the Konva `SceneErrorBoundary`, refusal of
a zero-point path at load, Try again on the board boundary, scenario-save errors
that no longer erase another adapter, a retried baseline pin, and a typed-array
sort inside `meanInterval`. `finishSummary` still runs on the main thread.

These items from the previous handoff are closed:

- Run-store NaN. `saveRun` writes NaN as null. `getRun` restores those nulls
  through `validateMcSummary` in `src/state/baseline.ts`.
- Sobol is not a fixed 2,560 rows. 2,560 is the default maximum: base 256 and at
  most eight Morris fields, `base × (k + 2)`. What remains is a cost estimate
  before the run starts.
- The uncommitted-deletion note. Position matches the pushed tip.

The comment sweep kept the budget and Kalman invariants. It did not document the
miss horizon inside `shot.ts`. That explanation is in the handoff landmines and
in the [zero-kill kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md).

## Do not mix

Each row is one session with its own gate. Do not enable further TypeScript
flags. Do not split `store.ts`, `Inspector.tsx`, or `integrationData.ts`. Do not
raise `DEFAULT_BUDGET` or `MAX_REPLICATES`. The pool budget is the page heap. A
chunk can still land after the check, so the cap is not a hard ceiling.

The horizon fix will not restore the planning fallback. On the firing laydown
the flight horizon still yields about Pk 0.05, under `pkCommit` 0.35, so shots
stay late. Do not change Coyote `lethalRadiusM`, `guidanceNoiseM`, or
`engageTimeS`, and do not add a terminal-homing term in the horizon session.
Until the horizon lands, size kinetic engagements with `legacyKineticPk` (Physics
tab checked).

Rows A and K do not share files and may run in either order. B waits on A. C
waits on explicit authorization for each replacement value.

## 1. Debug the kinetic zero-kill

`evaluateShot` propagates the fire-control track across the assignment-to-release
delay:

`src/playback/shot.ts:320` calls `predictionSigmaAtS(ctx.estimate ?? null, t + es.engageTimeS)`.

At the Coyote's 60 s `engageTimeS` that coast is about 282 m of miss against a
10 m lethal radius, so the physical model kills nothing.
[The kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
derives the flight, release to `tEffectS`, as the horizon.
`kinetic.verify.test.ts` does not catch this: it feeds miss sigmas of 1, 5, and
10 m by hand and checks the Rayleigh closed form.

A second defect contaminates the golden that would move the most.
`ADOPTED_SEED_KEYS.effector` in `src/model/libraryLifecycle.ts` adopts
`lethalRadiusM` and `guidanceNoiseM` and does not adopt `flyoutSpeedMps`. The
layered fixture's Coyote spec is type, ranges, altitude, and `engageTimeS`.
`flyoutProfile` in `src/playback/intercept.ts` returns null without a positive
cruise speed, so time of flight stays 0, while `kineticEffectProbability` still
takes the physical branch. The horizon fix would turn that into a teleport. The
recorded candidate kills mean of 4.68 must not be pinned.

Five seeded captures in `src/playback/estimate.parity.test.ts` move, and none is
hand-derivable:

| Pin | Now | Candidate, before the flyout decision |
| --- | ---: | ---: |
| Layered `report.events` length | 16 | 11 |
| Layered kill mass | 0 | 4 |
| JIATF leakers mean | 1 | 0.895 |
| JIATF kills mean | 0 | 0.105 |
| Layered kills mean | 0.005 | 4.68 |

The last row is the contaminated one. Truth-track suites and
`kinetic.verify.test.ts` stayed green in the probe because those fixtures pin
`truthTracks` and `legacyKineticPk`.

### A. Flyout semantics

Choose one and record it in the kinetic evidence file:

- Adopt `flyoutSpeedMps` for saved builtins that omit it, so old boards get the seed speed.
- Or make `kineticEffectProbability` take the legacy branch when flyout speed is missing, matching `flyoutProfile`.
- Or migrate the layered fixture explicitly and leave other old saves alone.

Stop when the layered fixture's time of flight is either a real flight or an
explicit legacy Pk, and a regression fails if an interceptor is both physical
and zero-flight. Do not edit `shot.ts` in this row.

### B. Flight horizon

Add a regression the size of `kinetic.verify.test.ts` that uses the engine's own
sigma: a long `engageTimeS` must not enter `predictionSigmaAtS`, and the horizon
must be `max(0, intercept.tEffectS - releaseS)` from the estimate time. Then
replace the horizon at `shot.ts:320`. The candidate from the record is
`predictionSigmaAtS(est, est.state.tS + flightS)` when an estimate exists.

Run `kinetic.verify.test.ts`, `estimate.parity.test.ts`, the protected
truth-path suites, and the intercept and attrition flyout tests. Expect the five
pins above to fail, with the layered kills mean different from 4.68 once row A
has landed. Write before and after beside the
[Phase 3 comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md). Stop
and ask before replacing any expected value.

### C. Recapture

Replace the five pins with the post-flyout measurements, only after authorization
for each number. Update the kinetic record. Leave `truthTracks`, the golden
fixture files, and the Coyote datasheet fields unchanged.

## 2. Debug the remaining run-path failures

Order is by how badly a user can lose a run or a save.

### D. Trial retention

`src/playback/trial.ts` appends every scan and every per-step estimate.
`src/state/analysisRequests.ts` keeps the whole `TrialResult`. Measured retained
JSON: 2.2 MB for one threat, 26 MB for 8 threats by 6 ships, 121 MB for 30 by
10, with the page heap at 692 MB. React also keeps the previous result on the
alternate fiber after New run. Bound what the UI reads. Exported ledgers need
parity before and after. Browser memory check on the firing fixture.

### E. Autosave that stops

`7149cd2` stopped one adapter from erasing another's error and retries the
baseline pin. A failed rescue still blocks that lane for the session
(`src/io/recovery.ts`). `reportPaused` still overwrites the shared status. The
overrides adapter has no write retry (`src/io/persistOverrides.ts`). One reload
of a bad live save leaves the bad record plus a timestamped rescue, and later
reloads add more. Give the blocked lane a resume, stop one adapter from
clobbering another, and retry overrides. Browser check: fail a write and confirm
later edits still persist.

### F. Main-thread finish

`workerPool.ts` `finish` still calls `finishSummary` on the page thread. Measured
about 12 s at the budget cap on a 108-track raid. The sorted quantile path is
already in. Finish in a worker without cloning the rows, or give `meanInterval`
the same sorted-input path as `quantile`. Summary parity, then a timed run at
the cap.

### G. Stop and progress

`cancel` returns false while `ending` is set, and Run still says Stop
(`RunControl.tsx`). `report` counts every landed index, while `finish` keeps
only `contiguousPrefix`, so the Run line can pass the summary after a stop.
Surface how many completed rows the prefix discarded when a budget stop leaves
a hole. Browser only. No parity.

### H. Sobol cost before start

After Morris, `store.ts` starts Sobol immediately and publishes total 0. Show
the row count `base × (k + 2)` and a warning when it can consume most of the
600 s worker budget. A 29-entity fixture took 499 s. No numerical change.

### I. Imported boundaries

UI creation rejects a boundary under two points. `runtimeValidation.ts` rejects
a zero-point path and still accepts an imported boundary with fewer than two
points. Add the same minimum on load.

### J. Subscriber throws

The raw subscriber in `App.tsx` around the overrides subscription can throw out
of `setState` with no ancestor boundary in `main.tsx`. Toolbar selectors sit
under the board boundary. Isolate that subscriber. Inject a throw in the browser.

## 3. Cleanup that is safe beside the kinetic work

None of these rows edit `shot.ts`, adoption keys, or parity pins.

### K. Delete the orphan chart adapter

`src/analysis/series.ts` and `series.test.ts` have no production importer.
`mcRun.test.ts` uses `heldTracksSeries`, `kpiSeries`, and `threatSeries` as
oracles. `mcRun.ts` already calls `heldTracksOnGrid`, `residualOnGrid`, and
`liveKpisAt`. Point those three equalities at those helpers, then delete both
series files. If the legacy-release NaN rule in `salvosInFlightSeries` still
needs a pin, move that one check next to engagement timing. Stop when nothing
under `src/` imports `analysis/series` and `npm run check` is green.

### L. Current docs

`docs/ENGINEERING_REFERENCE.md` still says panels read bands through `withBands`
and that `TRACK_LADDER_STYLE` is the live legend, while also saying `series.ts`
is test-only. `docs/field-te/model-evidence/uncertainty-crosswalk.md` still cites
`OutcomeSummary`, `KpiTilesWidget`, and `withBands`. Rewrite those sentences to
`trialSeries` and `mc.ts`. Leave dated evidence manifests alone. The doctrine
link to the pre-deletion `OutcomeSummary` blob can stay as history. Drop any
handoff bullet that still treats run-store NaN as an open export failure.

### M. censorLane

`censorLane` is exported from `EngagementStrip.tsx` under an
`only-export-components` suppression so the test can reach it. Move the function
and its `Lane` type to a pure module. The gate is that this file no longer adds
a suppression. `npm run lint` does not fail on the existing warnings.

### N. Key-order comparisons

Still unfixed, and independent of kinetics:

- `dropEditedProvenance` (`src/model/types.ts:594`) compares spec values with
  `JSON.stringify`, so a reordered object drops a provenance row.
- `resetBuiltin` (`src/model/libraryLifecycle.ts:244`) replaces an equal builtin
  whose keys were reordered.
- `sameAppliedOverrides` (`src/model/applyOverrides.ts:85`) treats reordered
  object values as different and can invalidate a run. The Systems editor writes
  numeric and tuple overrides. Restored overrides can carry objects.

`src/state/analysisBasis.ts` already sorts object keys and preserves array
order. Reuse that comparison, with a regression that reorders keys and expects
the original object back. Capture before and after if an override-identity
fixture moves.

### O. Unused exports

Un-export rather than delete behavior. No production importer for
`selectObservedThroughWholeS`, `bandNote`, `bandStep`, or `TrialOutcomeSummary`.
`withObservedLens`, `pruneSelection`, `rangeBounds`, `acceptMorrisMessage`,
`acceptSobolMessage`, `chartPng`, `downloadPng`, and `SavedRunCompare` are used
inside their own modules, so drop `export` only. `ANALYSIS_KEY` is imported only
by `viewState.test.ts`. `spreadFor` and `spreadBasisFor` take a `priors`
argument no app caller passes, and `src/engine/index.ts` re-exports them. Leave
the engine surface unless that barrel change is its own session.

## 4. Parked product work

One item per later session, after the debug queue: `JSON.stringify` and casts in
analysis and playback with a parity capture, `@ts-check` on the scripts, the
entry chunk back under 340 kB gzip, `RunRecord.sobol` so the SQLite table fills,
and `noUncheckedIndexedAccess` as its own gate. File splits wait for an explicit
ask.

## Order

| Row | Work | Stop |
| --- | --- | --- |
| A | Flyout adoption or an explicit legacy fallback | Layered fixture is not both physical and zero-flight |
| K | Retarget three `mcRun` oracles and delete `series.ts` | `npm run check` green; no `src/` import of `analysis/series` |
| B | Flight horizon in `shot.ts` plus an integrated regression | Five parity pins fail with measured values written down; no expected value edited |
| C | Recapture those pins | Each replacement value has been authorized |
| L | Docs, including any stale NaN bullet in the handoff | Invariants name live modules only |
| D | Bound trial retention | Ledger parity held; firing-fixture heap stays flat across New run |
| E | Autosave resume, status, overrides retry, recovery keys | A failed write does not drop later edits |
| F | Move or cheapen `finishSummary` | Summary parity; cap run no longer blocks the page for about 12 s |
| G | Stop button, progress holes, discarded-row count | Browser check; no parity |
| H | Sobol row-count estimate before start | Browser check; no numerical change |
| I | Boundary minimum on load | Imported boundaries under two points are refused |
| M | Move `censorLane` | No new `only-export-components` suppression |
| N | Key-order comparisons | Reordered keys keep object identity |
| O | Unused exports | Behavior unchanged; engine barrel left unless split out |
| J | Isolate the overrides subscriber | An injected throw stays inside a boundary |

The first handoff selects row A.
