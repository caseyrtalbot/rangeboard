# R1 first extraction: brief and evidence

Selected by Casey on 2026-09-05 through the R1 entry handoff. Baseline: `74eb94d`
on `analysis-hardening`. This slice stops after extraction, verification and record updates.
The register remains the status authority.

## Bounded contract

Move `modelFor`, `pathSpeed` and `scenarioDurationS` unchanged from `state/store.ts`
to `model/scenario.ts`. The module uses only domain types, `geometry/geo.ts` and
`playback/raid.ts`; these dependencies do not reach a store or an engine sweep.
Move `RingKey`, `RingOverrides`, `SENSOR_RING_KEYS`, `EFFECTOR_RING_KEYS` and `RING_KEYS`
unchanged to `state/rings.ts`, which has no imports.

Owned production paths: `src/model/scenario.ts`, `src/state/rings.ts`,
`src/state/store.ts`, `src/playback/sim.ts`, `src/analysis/series.ts`,
`src/io/validateScenario.ts`, `src/io/viewState.ts`. Engine and validation callers use
the leaf directly. The store keeps the same public exports for existing callers in
Fable-owned panels/canvas; these are re-exports, with no duplicate implementation.
Owned tests cover leaf behavior, public export identity and the worker value-import graph.
Records: this brief/evidence under `docs/field-te`, Astra/shared handoff, register and the
module-cycle paragraph in the engineering reference as required by the working contract.

Public compatibility surface: the three scenario helpers and five ring symbols remain
available from `state/store.ts`. Remove these re-exports only in a separately selected
consumer migration after all panel/canvas/test callers use the leaf modules. Existing
save migrations remain supported. `runSession.ts` remains a main-thread store action
adapter; it is not a worker dependency and is outside this extraction.

## Verification plan

1. Run the four baseline gates; preserve their logs and warning baseline.
2. Capture the existing fixed-ID firing fixture with deterministic assessments/report,
   aleatory MC, total MC and sensitivity, before production edits. Compare exact serialized
   outputs after extraction. Retain the fixture's integration-only evidence limitation.
3. Verify the transitive worker value-import graph contains no store, React, zustand,
   persistence, localStorage or panel modules. Exercise a fresh worker entry independently.
4. Run focused regressions and the four final gates. Preserve evidence, inspect the diff,
   then update the current handoff/register. No commit or push is authorized.

## Later R1 obligations

F1 stays open. Treat the proposed 10 Hz as playback store publication cadence, while
preserving engine `DT = 0.5 s`. A later brief must define wall-clock publication versus
simulation time at every speed and preserve boundary/event horizons. Measure named
components before accepting the unmeasured claim that every widget renders 60 times/s.
Cross-owner paths needed for F1 include `src/panels/TimelineBar.tsx`,
`src/panels/Inspector.tsx` and named interpolation consumers under `src/canvas`; resolve
exact paths through the register before implementation. This slice changes no cadence.

R-F-31 budget/cancellation policy, larger store/sweep/attrition extractions, E2/E3,
R-F-30 jam geometry, F10 and design steps 2 to 14 are outside this slice. Existing C3
schema version 1, validation, compatibility defaults, recovery and autosave suppression
already implement protections absent from F10's problem statement. Reconcile any actual
persistence gap and ownership before proposing a follow-on implementation.

## Verified result, 2026-09-05

[V] The seven production paths above contain the extraction. The helper bodies and ring
block are unchanged. The store exports are the same function/array objects as the leaf
exports. No UI, T&E, schema, key, timestep, draw, numerical or playback behavior changed.

[V] Baseline four gates passed: 1,355 tests in 77 files, 74 lint warnings, zero errors,
existing build chunk warning. Both graph regressions first failed on the store's zustand
edge. Final focused regressions passed: 347 tests in 12 files, including the temporary
parity probe. Final four gates passed: type-check; 1,360 tests in 80 files; lint with the
same 74 warnings and zero errors; build with the existing chunk warning. Schema drift
check passed. The five permanent new tests cover leaf semantics, public identity and graphs.

[V] Exact serialized deterministic assessments/report, seed-4821 aleatory MC, total MC
and sensitivity match the pre-edit capture at four replicates. The temporary parity test
was removed after comparison; its source and full baseline remain in
[evidence](evidence/r1-leaf-2026-09-05/). The probe is integration evidence, with existing
spawn-in-ring and model-validity limitations; it does not validate detection accuracy.

[V] The transitive worker source graph shrank from 38 to 30 modules, with no external
runtime imports (previously zustand). It reaches no store, persistence or panel module.
It still reaches `charts/tokens.ts` through `series.ts`; that existing module has a
DOM-guarded reader and token constants. Separating series grid helpers from presentation
metadata is a possible later extraction, not part of this result. The production worker
bundle shrank from 288.46 kB to 121.65 kB. This is a build-size observation, not a runtime
performance or render-count claim.

[V] Isolated Chromium used real store MC/sensitivity actions plus a fresh native module
worker importing `mc.worker.ts` independently. Both worker summaries matched direct
engine calls exactly except worker elapsed time: four replicates, 13 sensitivity rows,
four deterministic events, no page exceptions. The screenshot was inspected for app-load
and result presentation; this is not F1 profiling or design acceptance. The initial
favicon 404 is unrelated. A later metadata read saw HMR-reset state during source cleanup;
the full browser harness was rerun successfully after the final source edits.

Verification corrections: the initial graph guard treated a local `window` path interval
as a browser global and rejected the existing chart-token module. It now checks the stated
store/panel/persistence boundary and all external runtime imports. The first compiler run
caught an unused store import plus Node-only scratch-test typing; the unused import was
removed, the scratch probe retired and the graph test uses the existing Node-test import
convention. A temporary browser harness caused one lint warning; it was preserved as text
and removed before the final lint pass. No production behavior changed to satisfy a test.

## Stop and next task

This completes the selected first extraction, not all of R1. Next proposed bounded task:
write an F1 cadence/selector brief with baseline render counts for `TimelineBar`, `Inspector`
and named canvas consumers on a fixed fixture. Resolve exact cross-owner paths and define
10 Hz wall-clock publication at every playback speed while preserving engine DT and event
horizons. Stop after that measured brief and ownership/cadence agreement, before changing
UI cadence. R-F-31 remains a separate measured budget/cancellation task within R1.

## Commit authorization, 2026-09-05

Casey's subsequent instruction authorized committing this first extraction and its R1
record updates. The shared-record patch preserves the other session's pilot decisions;
those changes in the handoff/register and PLAN remain uncommitted and outside this slice.
The five pre-existing untracked entries also remain untouched. No push is authorized.
Source and evidence hashes were rechecked against the successful final verification.
