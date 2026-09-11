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
| 1 Real-mode statistics | passed | `70a7a0e` | 2026-09-10 |
| 2 Tracks and kill chain | passed | `GATE_COMMIT` | 2026-09-10 |
| 3 Sensor and effector physics | not started | | |
| 4 Hypothesis tools | not started | | |

## Completed

Phase 1, gate `70a7a0e` on `main`. Contract `64c9f83` and `c4473e7`; range primitive
`ec80ac0`; lane merges `570ada4` (1.5 Sobol chart), `abf332f` (1.4 Run tab), `ac8343d`
(1.2 pool), `3891fcb` (1.3 sampling and sensitivity), `4f0730f` (1.1 headless runner);
integration `0f5231a`. `McSettings` with the real-mode defaults, the worker pool, the Node
runner, LHS, Morris and Sobol, the Run tab and one Run button. Evidence in
[p1-gate-2026-09-10](field-te/evidence/p1-gate-2026-09-10/README.md).

Phase 2, all on `main`, nothing pushed. Base `2a6f87f`.

- 2.a Contract, `calib/p2-contract`, `6e33ef2`, plus the orchestrator's amendment
  `259fa86`. `SensorSpec` gains `rangeAccuracyM`, `azimuthAccuracyDeg`,
  `elevationAccuracyDeg`, `falseAlarmRatePerScan` and `classification`; `C2Spec`
  (`decisionLatencyS`, `decisionLatencySigmaDb`, `operatorTrackCapacity`) on
  `SpecModel.c2` and `LibraryFile.spec: 'c2'`; `Scenario.physics` with
  `physicsSwitches()`; `src/playback/trackTypes.ts` (`TrackState`, `Covariance4`,
  `TrackEstimate`, `FusedTrack`, `TrackMeasurement`, `TrackEstimateSink`);
  `ClassificationMatrix` and `ClassificationBand` in `types.ts`; `TrialResult.tracks`;
  fidelity tags `tracker`, `fusion`, `classification`, `operator`, `false-tracks`. Stop
  condition: `fidelity.test.ts`, schema regenerated, full suite.
- 2.3 Track layer, `calib/p2-tracklayer`, `67bce5c`, fast-forwarded. `TrackLayer.tsx`
  (1 sigma covariance ellipse and a screen cross per track, dash on coast, muted ink on a
  false track, censored at the horizon), `trackEstimateView.ts` (`latestEstimatesAt`,
  `positionEllipse`), style constants in `footprintStyle.ts`, mounted in `LiveScene.tsx`.
  Stop condition: `TrackLayer.test.tsx` and `trackEstimateView.test.ts` on a fixture that
  shrinks then grows; browser check on port 5384 with injected tracks, 0 page errors.
- 2.2 Kalman tracker, `calib/p2-tracker` (`3b8ab4e`), merged `10c6675`. `kalman.ts`
  (CWNA predict, Joseph update, `PROCESS_NOISE_Q` 1 m^2/s^3, `QUALITY_SCALE_M` 50 m,
  `INIT_SPEED_SIGMA_MPS` 20 m/s), `tracker.ts` (one track per sensor and threat, polar
  noise from the accuracy fields, truth path with no draw on a null field or under
  `truthTracks`), `DrawPolicy.noise` kind 7, the sink threaded through `sim.ts` and
  `trial.ts`. Stop condition: the steady-state gain equals the closed form of the CWNA
  tracking index to 1e-6 (`kalman.test.ts`); `tracker.test.ts`; parity unchanged.
- 2.1 Accuracy data, `calib/p2-accuracy` (`d70a113`), merged `68cde42`. 38 sensor files
  gain 133 accuracy fields (L1 25, L2 80, L3 28); 8 C2 files gain `spec: 'c2'` with one
  planning factor each (median 10 s, 3 dB, 6 tracks); every radar carries a
  `falseAlarmRatePerScan` planning factor; changelog section; priors rebuilt. Stop
  condition: `npm run check:library`; parity unchanged. The orchestrator's `aac28db`
  taught `seedLibrary.test.ts`, `fidelity.test.ts` and `tracker.test.ts` the new keys.
- 2.5 False tracks and operator, `calib/p2-operator` (`a46c4b0`), merged `f69d049`.
  `falseTracks.ts` (Poisson false tracks per scan through the M-of-N rule,
  `FALSE_TRACK_CELLS` 1e4, kind 9), `operator.ts` (decision latency lognormal from the C2
  median and sigma, linear overload above capacity, kind 10), wired at the declare and
  assign gates in `attrition.ts`; false tracks reach `TrialResult.tracks`. Stop condition:
  `falseTracks.test.ts` convergence within 4 sd of the closed form, `operator.test.ts`,
  `attrition.operator.test.ts`; parity unchanged. Orchestrator `26d5c40`: the queue adds
  only the excess over its median (a median decision under capacity leaves the doctrine
  timeline where it was) and the false scan clock starts at zero.
- 2.4 Fusion and classification, `calib/p2-fusion` (`41218ff`), merged `9c937e8`.
  `fusion.ts` (information-form `fuseTracks`, `createFusionStage` with a per-sensor ring
  and predict over the link latency, `FC_QUALITY_MIN` 0.5), `classification.ts`
  (`matrixFor`, `bandFor`, `classifyByMatrix`, kind 8), `ThreatAssessment.fusedTracks`,
  the stable track gated on fused quality. Stop condition: two equal tracks halve the
  covariance (`fusion.test.ts`); the no-matrix laydowns keep their declaration times
  (`sim.test.ts`).
- 2.6 Intercept from estimate, `calib/p2-intercept` (`17e79d3`), merged `8f02175`.
  `interceptFor`, `interceptFromEstimate`, `predictedStateAt`; `ShotContext.estimate`,
  `ShotAccepted.predictionSigmaM` and `interceptSource`; `missDistanceSigmaM` in `pk.ts`.
  Stop condition: a truth-source estimate returns the `interceptAt` result exactly; a
  velocity delta moves the point by delta times the time of flight; the 1 sigma at a 10 s
  lead matches the hand-derived value (`intercept.test.ts`).
- 2.d Integration `4359d28`: the latest fused track at the tick enters the shot context;
  `createRunManifest` and `createTrialManifest` read `physicsSwitches(scenario)` and drop
  `fidelityFloor` to `fallback` when a switch is on; `DATA_PACKAGE_VERSION` 2; the five
  fidelity tags state the current engine; `ADOPTED_SEED_KEYS` in `libraryLifecycle.ts`
  gives a saved builtin the Phase 2 seed keys it lacks on load; the two golden fixtures pin
  `physics: ['truthTracks', 'noFalseTracks', 'noOperatorQueue']`.
- 2.d Review (`fable-high`, read-only on `8f02175` and `4359d28`): two blockers, four
  defects, three nits. Fixed in `25bd78f` (a decision index in the kind-10 key; a fused
  entry older than one step falls back to the truth intercept) and `feab222` merged
  `467ceda` (the fire-control gate is a quality condition, so a firm time decided on a
  missed scan no longer moves one step; a truth member yields to an estimate member when
  the switch is off; unlinked sensors fuse at `NO_C2`; duplicate links count once). The
  remaining findings are in Open items.
- 2.d Docs `ec7d1fb`: `ENGINEERING_REFERENCE.md`, `PROJECT_GUIDE.md`, `VERIFICATION.md`,
  `WORKFLOW.md`, `DESIGN_SYSTEM.md` and the docs index updated and reviewed; evidence in
  [p2-gate-2026-09-10](field-te/evidence/p2-gate-2026-09-10/README.md).

## Decisions taken without a poll

Casey was not in the loop during this phase. Each item below is one commit to revert or
amend; put them to Casey before Phase 3 starts.

- C2 decision fields live on a `C2Spec` block in the library, not on `FireDoctrine`
  (`6e33ef2`); decision latency is a lognormal median in seconds plus a sigma in dB, two
  numeric library fields.
- The operator queue adds only the excess over its median, floored at 0 (`26d5c40`). The
  reviewer notes the floor biases the Monte Carlo mean: at median 10 s and 3 dB an
  engagement adds about 8.8 s on average while the deterministic run adds 0.
- Physics switches live on `Scenario.physics`; a switch sets `fidelityFloor: 'fallback'`
  on the manifest (`4359d28`). No Physics tab yet (Phase 3 lane 3.7).
- `ADOPTED_SEED_KEYS`: a saved builtin adopts the Phase 2 seed keys it lacks on load, so
  existing boards receive the tracker (`4359d28`). A blanket adoption of every absent seed
  key was tried and rejected because it moved older physics (`updateRateS`-class keys).
- The golden fixtures pin the three switches, so the parity tests keep guarding the truth
  path exactly; the estimate path is documented in `comparison.md` instead of pinned.
- `SensorSpec.classification` carries the confusion matrix (`259fa86`); no library sensor
  states one, so the rule ladder classifies everywhere.

## Open items

- Review finding 4: a confusion matrix on one sensor silences the classified flag of every
  other fire-control sensor (`sim.ts`, `matrixSensors.length > 0`); needs a per-sensor
  classified flag on `SweepStepResult`. Unreachable with library data today.
- Review nit 8: link latency is quantized to the DT grid in the fusion ring (a 0.3 s link
  carries back one step and predicts 0.5 s). Nit 9: the cross-range sigma uses slant range
  over ground range (0.2 percent at 1000 ft and 5 km); `elevationAccuracyDeg` is in the
  library and not modeled.
- With the seed planning factors the false-track process and the operator overload are
  inert: 0.5 to 1 false alarms per scan give 1e-8 to 1e-7 false tracks per scan under
  M 3 of N 5 and 1e4 cells; every seed radar meets the 50 m quality gate at track
  initiation except the Sentinel A4 at 10 km.
- Every RF and acoustic sensor and four EO/IR sensors have `rangeAccuracyM: null`, so they
  take the truth path and yield to an estimate member at fusion. A bearing-only sensor
  should become a measurement with range sigma equal to its detect range (Phase 3).
- `uncertainty.ts` and `parameterBasis.ts` know no `c2` and no accuracy field: the spreads
  lane 2.1 wrote on the new fields do not draw in total mode, and Morris does not screen
  them. `FIELDS_BY_KIND` is the place; the Phase 3 contract should decide.
- The new library fields have no `provenanceOrder` entry, so no provenance row appears at
  runtime for them; the Systems tab shows their values without grade or source until the
  build emits rows for them (a `seedLibrary.test.ts` fixture question).
- `LibraryEditor.tsx` reads `sensor ?? uas ?? effector` and cannot edit a c2 spec.
- `fusedTracks` rides on every assessment, the memoized deterministic one included (about
  one entry per held step per threat); strip it after use if store or message size grows.
- `TrialResult.tracks` holds false tracks with `source: 'false'` and `uasId: null`;
  `trackEstimateView` and the layer handle them, no panel lists them.
- `TRIAL_ENGINE_REVISION` was not bumped: no existing draw key moved and the pinned
  fixtures are bit-identical to the contract commit.
- Performance: 200 replicates on the largest fixture on 4 workers took 3.6 s at the
  contract commit, 4.6 s pinned and 5.4 s on the estimate path at the gate. The trial
  path went from 72 to 102 ms per trial with every model on. Section J values are
  reference values.
- The track layer has no entry in `selectEffectiveLayers`, so it cannot be toggled off;
  its inks are fixed values with weaker contrast on the paper theme.
- Lane 2.3 saw the first load of the 176 KB firing scenario freeze the renderer for over
  30 s; later loads were responsive. Not traced.
- The eight `calib/p2-*` lane branches and `calib/p2-review-fusion` remain; every commit
  is merged and the worktrees are removed.

## Continuation boundary

Put the decisions above to Casey first. The next task is the Phase 3 contract and split
slice in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#5-phase-3-sensor-and-effector-physics):
a `fable-medium` worker on `src/model/types.ts`, `src/playback/clock.ts`,
`src/playback/attrition.ts`, `src/playback/sweep.ts`, `src/analysis/sensorEnv.ts` and its
split, `src/playback/pk.ts` and its split. Research lanes 3.R1 and 3.R2 may start with it.
No poll is open beyond the decisions listed.

## Verification at the last gate

- `npm run check` at the gate: exit 0; 168 test files, 1955 tests; engine CLI test 2 of 2;
  library check 90 models and 790 fields; build entry 1,196.69 kB (353.20 kB gzip against
  the 360 kB budget). Output in
  [check.txt](field-te/evidence/p2-gate-2026-09-10/check.txt).
- Parity: `sensitivity.parity.test.ts`, `accuracy.verify.test.ts`,
  `convergence.verify.test.ts` unchanged and passing inside that run; the golden fixtures
  pin the three physics switches. [comparison.md](field-te/evidence/p2-gate-2026-09-10/comparison.md):
  the pinned path is identical to the contract commit on every assessment field, every
  engagement event and every Monte Carlo summary; the estimate path moves the
  layered-acoustic-merops leaker mean from 1.990 to 2.120 (intervals overlap), one threat
  firms 2 s later, and the trial ledger goes from 22 to 25 events.
- Browser check on port 5385 at `ec7d1fb` (screenshots in
  [browser/](field-te/evidence/p2-gate-2026-09-10/browser)): the firing scenario loaded
  through `parseAutosave` adopted the seed accuracy fields and the FAAD C2 spec; two sage
  ellipses with cross markers drew on the tracked Mavic; the Giraffe ellipse semi-major
  fell from 83.5 m at 1.5 s to 2.8 m at 490 s, then grew from 2.8 m to 7.6 m over 2.5 s of
  coast with the dash; a playhead at 400 s with the horizon at 151.5 s drew nothing past
  the horizon; the default Run finished 30 replicates on 8 workers in about 0.17 s; 0 page
  errors. Outcome tiles need a completed trial, not the ensemble (existing design).
- Timing: 200 replicates on the largest fixture on 4 workers, 4.6 s pinned and 5.4 s on
  the estimate path (3.6 s at the contract commit); one trial 102 ms with every model on
  (72 ms with the switches).
