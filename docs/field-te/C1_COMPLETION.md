# C1: analysis identity and result invalidation

Dated record, verified 2026-09-04 at source `8b528f2`, published as `002684c`. Source and
tests decide current behaviour.

## What changed

`analysisBasisSignature` includes domain fields by default and removes only named
presentation and evidence metadata. It includes altitude, defended radius, doctrine,
requirements, connection draw ids and effective spreads. Object keys are sorted; array
order stays significant. Consumers still receive the original `Scenario`.

The spread table, resolver and field enumeration moved unchanged into
`src/analysis/parameterBasis.ts`; `uncertainty.ts` re-exports them and owns sampling.
Equations, field order, distributions and draw keys did not change.

A worker instance owns its client slot. Replacing or cancelling that instance makes all
its queued callbacks inert, even when the new request has the same playback run id. The
store also requires a running slot, a matching playback id and the current basis.
Done, error, stale and idle states cannot be overwritten by a late callback. MC and
sensitivity keep independent slots.

The sensitivity widget reads `currentSensitivity`, hides stale rows and replicate
metadata, and shows STALE with the rerun control.

Files: `src/state/store.ts`, `src/playback/mcClient.ts`, `src/analysis/parameterBasis.ts`
(new), `src/analysis/uncertainty.ts`, `src/panels/analysis/widgets/SensitivityWidget.tsx`.
Tests: `src/state/store.test.ts`, `src/state/store.analysis.test.ts` (new),
`SensitivityWidget.test.tsx`.

## Input, consumer and regression matrix

Tests named below are in `src/state/store.analysis.test.ts` unless noted.

| Input or metadata | Consumer / resolution | Coverage |
| --- | --- | --- |
| Run mode, seed, replicates, stopping half-width, uncertainty mode | `runSettings`; `mcRun`, `policy` | Existing store run-setting tests; default-equivalence test; numerical parity |
| Environment, including optional weather/light/EM/visibility | `sensorEnv`, `range`, `runValidity`; clear/day/rural and null visibility fallback | Geometry/routing/specs matrix; missing-default test |
| ROE | `sim` hostile declaration; absent = tight | Geometry/routing/specs matrix; missing-default test |
| All doctrine fields | `effectiveDoctrine`, `doctrineFactors`, `sim`, `attrition`, `sampleScenario` | Every-doctrine-field test; edit/undo/redo and playback reset tests |
| All requirements | Default spread of `DEFAULT_REQUIREMENT_THRESHOLDS`; `sim`, `policy`, `requirements` | Every-requirement-field test; edit/undo/redo |
| Entity ID/kind/spec ID, position, heading, enabled, formation | `sim`, `attrition`, `geometry/geo`, model integration; ID/member ordering feeds draws | Geometry/routing/specs matrix; full formation/CRN suites; enabled resolves through `entityActive` |
| Threat altitude | `threatAltitudeFt`: instance, profile, band midpoint, zero | Altitude edit/undo/redo; missing-default test; browser four events to zero |
| Asset defended radius | `defendedRadiusOf`: positive value, otherwise existing PF default | Radius edit/undo/redo; explicit/absent equivalence; browser |
| Connection ID/endpoints/typing/latency and array order | `killChainRoutes`, integration profiles, uncertainty parameter draw identity; latency uses the same doctrine/kind default | Connection-ID edit/undo/redo; routing and latency cases; missing-default test |
| Paths: ID, owner, points, speed, delays; raid waves | `pathSpeed`, `scenarioDurationS`, `effectivePathDelayS`, `sim` | Geometry/routing/specs matrix; full path and raid suites |
| Sensor specs, all fields retained | `sensorEnv`, `doctrineFactors`, `sim`; raw configuration retains calibration, geometry, signatures, scan and dwell overrides | Sensor mount-height mutation; existing sensor/scan/verification suites |
| Effector specs, all fields retained | `attrition`, `ewPhysics`, `doctrineFactors`, geometry gates | Flyout-speed mutation; existing attrition/doctrine/EW suites |
| UAS specs and threat profile | `sim`, `sensorEnv`, `range`, `impact`, `attrition`; routeIntent text affects hostile-ID logic | RCS, profile altitude and attack-intent mutations; existing model suites |
| Effective library spreads, connection latency spread, doctrine declaration spread | The same `uncertainFields` enumeration used by MC and sensitivity; active model set and stable field order | Spread edit/undo/redo; absent vs explicit PF fallback vs pinned null; unchanged sampling tests |
| Library/entity/connection identities and collection order | Integration lookup, keyed draws, allocation order and sensitivity ordering | ID/reordering cases; full CRN tests; seeded parity |
| Scenario name, frames, cards, scorecards, observed lens, underlay, geo reference, boundaries, preset catalog, deleted-seed records, MCDA weights | Evidence, presentation or load/build bookkeeping; excluded from numerical result identity | Evidence/presentation test plus existing store playback tests |
| Entity names/colors/notes/system grouping/range-ring toggle; model names/colors/descriptions/builtin flag; connection label/note; UAS emissions/range notes and profile designator | Presentation/grouping; excluded. `routeIntent` remains included | Presentation test; current source audit of engine consumers |
| Provenance source/value/URL/date/basis descriptions | Live `PfTag`/Sources display, excluded from numerical identity; effective spread remains included | Source/date edit retains both results; rendered `PfTag` contains updated source/date |
| Camera, selection, layout | Store view state; outside Scenario identity/history | Camera/selection/lens edits retain results |

Raw specifications and path configurations are conservative inputs: an unused spec edit
or an explicit override equal to its fallback can still force recomputation. The shared
basis also invalidates aleatory MC on spread changes because sensitivity depends on those
spreads. An excluded descriptive field must be reconsidered if a numerical consumer
starts reading it.

## Verification

- Focused regressions before the fix: 9 failed, 4 passed. Failures reproduced the five
  named omissions, connection identity, basis cancellation, same-run replacement and
  terminal callback overwrite.
- Final gates: type-check pass; 1,222 tests in 70 files pass; lint 74 warnings, zero
  errors; build pass with the existing chunk-size warning. No added dependency.
- Numerical parity: a temporary parity test under `src/playback/` captured the saved probe
  at four replicates before the edits and compared serialized deterministic assessments
  and report, aleatory MC, total MC and sensitivity after them. Exact equality passed. The
  scratch test was removed; its source and output digest are in the evidence manifest.
- Isolated Playwright session, real Vite workers, typed KuRFS/C2/Coyote probe, total
  uncertainty, 30 replicates: all five edits set both slots stale, both current summary
  helpers returned null, sensitivity tables had zero rows. Rerun restored done results and
  13 rows (12 with pinned Pk). Undo and rerun restored the original four deterministic
  events. Baseline MC end means: kills 0.9666666667; leakers 0.0333333333.
- Browser validity kept `spawn-in-ring` and `unvalidated-model` for the baseline. The
  probe is not detection accuracy evidence. No page exceptions in the completed run.

Evidence: [manifest](evidence/c1-2026-09-04/manifest.json),
[browser results](evidence/c1-2026-09-04/browser-results.json),
[stale view](evidence/c1-2026-09-04/c1-sensitivity-stale.png),
[recomputed view](evidence/c1-2026-09-04/c1-sensitivity-recomputed.png).

No schema, storage, draw or T&E change occurred.
