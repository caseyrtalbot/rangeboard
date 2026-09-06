# C1: analysis identity and result invalidation

Dated completion record, verified 2026-09-04 in the working tree at source baseline
`8b528f2`, branch `analysis-hardening`. Source and tests decide current behaviour. The
work and its records were published as `002684c` on `origin/analysis-hardening` on
2026-09-05; the verification below predates publication and its source/evidence hashes
were rechecked.

## Behavior and scope

`analysisBasisSignature` now includes domain fields by default and removes only named
presentation/evidence metadata. This avoids another incomplete positive list. It includes
altitude, defended radius, doctrine, requirements, connection draw IDs and effective
spreads. Object keys are sorted; array order remains significant. Consumers still receive
the original Scenario, not the signature projection.

The existing spread table, resolver and field enumeration moved unchanged into
`src/analysis/parameterBasis.ts`. `uncertainty.ts` re-exports the existing public API and
continues to own sampling. The helper depends only on model types/defaults, so sharing it
with the store adds no engine/store cycle. Equations, field order, distributions and draw
keys did not change.

A worker instance owns its client slot. Replacing/canceling that instance makes all its
queued progress, completion and native/error-message callbacks inert, even when the new
request has the same playback run ID. The store additionally requires a running slot,
matching playback ID and matching current basis. Done/error/stale/idle states cannot be
overwritten by late callbacks. MC and sensitivity retain independent slots.

The sensitivity widget had bypassed the shared status rule: it displayed stale rows with
a warning. It now uses `currentSensitivity`, hides stale rows and replicate metadata, and
shows STALE with the rerun control. This narrow UI correction is needed for C1 acceptance;
C2 estimator/interval/export semantics were not changed.

Changed production files: `src/state/store.ts`, `src/playback/mcClient.ts`,
`src/analysis/parameterBasis.ts` (new), `src/analysis/uncertainty.ts`, and
`src/panels/analysis/widgets/SensitivityWidget.tsx`. Tests: `src/state/store.test.ts`,
`src/state/store.analysis.test.ts` (new), and `SensitivityWidget.test.tsx` beside the widget.

## Input, consumer and regression matrix

Tests named below are in `src/state/store.analysis.test.ts` unless noted. Existing
consumer tests remain the equation-level evidence; the new tests check freshness.

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

Default resolution covers scenario run/doctrine/requirement/environment/raid/ROE settings,
entity altitude/radius/activity/formation, link latency/typing and effective spreads. Raw
specifications and path configurations remain conservative inputs: an unused spec edit or
an explicit numeric override equal to its fallback can still require recomputation. This
is intentional (R-D-27), not a claim of minimal dependency tracking. The shared basis also
invalidates aleatory MC on spread changes because sensitivity depends on those spreads.

Excluded descriptive fields must be reconsidered if a future numerical consumer starts
reading them. Future domain fields are included without requiring a new signature entry.

## Verification

- Initial focused regressions: 9 failed / 4 passed. Failures reproduced the five named
  omissions, connection identity, basis cancellation, same-run replacement and terminal
  callback overwrite. The first test-authoring typo (`patchEntity`) was corrected to the
  real `updateEntity` action before this reproduction was recorded.
- Final gates: type-check passes; 1,222 tests in 70 files pass; lint 74 warnings, zero
  errors; build passes with the existing chunk-size warning. No added dependency.
- Numerical parity: temporary `src/playback/c1-parity.verify.test.ts` captured the original
  saved probe at four replicates before source edits, then compared serialized deterministic
  assessments/report, aleatory MC, total MC and sensitivity after edits. Exact equality
  passed. Wall time is zero in these direct engine calls. Scratch test removed after use;
  source and output digest are recorded in the evidence manifest. This is a bounded probe,
  supplemented by the full existing engine suite, not proof for every possible scenario.
- Isolated Playwright session, real Vite workers, saved typed KuRFS/C2/Coyote probe, total
  uncertainty and 30 replicates: all five edits changed both slots to stale, both current
  summary helpers returned null, and sensitivity tables had zero rows. Rerun restored done
  results and 13 rows (12 with pinned Pk). Undo/rerun restored the original four deterministic
  events. Baseline MC end means: kills 0.9666666667; leakers 0.0333333333.
- Browser validity retained `spawn-in-ring` and `unvalidated-model` for the baseline;
  altitude changes legitimately alter geometry findings. This probe is not detection
  accuracy evidence. No page exceptions in the completed run. Initial favicon 404 is
  unrelated. An initial browser-script call omitted the required assessments argument to
  `assessRunValidity`; corrected before the retained successful evidence.
- Inspected stale and recomputed sensitivity screenshots: the stale view contains no
  table/chart; the recomputed view restores both. Existing narrow-panel truncation remains
  R-F-21/R-F-22 and is outside C1.

Preserved evidence: [manifest](evidence/c1-2026-09-04/manifest.json),
[browser results](evidence/c1-2026-09-04/browser-results.json),
[stale view](evidence/c1-2026-09-04/c1-sensitivity-stale.png),
[recomputed view](evidence/c1-2026-09-04/c1-sensitivity-recomputed.png).

## Remaining work

C2 is the next implementation slice when selected: consistent result estimators, intervals,
units, gates and exports (R-F-25). C3/C4, R1 and model-credibility findings remain open.
No schema/storage/draw changes, T&E changes or new numerical claims occurred. Commit and
push were subsequently authorized and completed as recorded above.
Pre-existing documentation changes and Casey's four untracked mockup files were preserved.
