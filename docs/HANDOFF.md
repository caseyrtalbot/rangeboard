# RangeBoard continuation status

RangeBoard is a modeling and simulation tool for test and evaluation planning. It estimates detection, track and outcome probabilities for a counter-UAS system under test from published datasheet values and open literature. The estimates size a test plan: how many trials, which conditions, and where to place sensors on a range. Every model is an empirical statistical model used as a surrogate for the system under test. The software controls no hardware, connects to no system and produces no targeting data. All inputs are open-source vendor specifications.

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
| 2 Tracks and detect to engage (DTE) sequence | passed | `5373505` | 2026-09-10 |
| 3 Sensor and effector physics | in progress: 3.0, 3.a, 3.R1, 3.R2 merged; physics lanes not started | | |
| 4 Hypothesis tools | not started | | |

## Completed

Phase 3, in progress on `main`, nothing pushed (origin/main is `7c65ca1`). Base `dc8f69f`.

- 3.0 Stamps, `calib/p3-stamps` `a8c1b7a`, integration `3bf29a9`, docs
  `327c849`. An independent review found three defects
  and no blocker, fixed in `b45d7f2`: `OperatorQueue.delayS` returns `{ extraS, floored,
  decided }` and only a C2 that drew counts as a decision; the seed-adoption stamp lives
  in a WeakMap by model object (`seedAdoptionOf`, `loadNoticeFor` in `persist.ts`), so a
  baseline parse, a rejected import or New leaves no stale stamp. Stop condition met:
  `attrition.operator.test.ts`, `libraryLifecycle.test.ts`, `SystemsTab.test.tsx`,
  browser check in [p3-stamps-2026-09-10](field-te/evidence/p3-stamps-2026-09-10/README.md).
- 3.a Contract and split, `calib/p3-contract` `1ecd403`, merge `9cecbd2`,
  integration `23c197c`. `clock.ts` gains `stepCount` and `createSweepClock` (manifest
  step `McSettings.sweepStepS`, default DT, `requestFineStep` per effector window; no
  request reproduces the old sample times bit for bit, `clock.test.ts`);
  `TrialManifest.sweepStepS`; `sensorEnv.ts` is a barrel over `sensorEnv/{common, radar,
  eoir, acoustic, rf}.ts`; `pk.ts` a barrel over `pk/{kinetic, beam}.ts`; the Phase 3
  spec keys in `types.ts` and `UNIT_BY_FIELD` (the table is
  [p3-fields.md](field-te/evidence/p3-lanes-2026-09-10/briefs/p3-fields.md));
  `FIELDS_BY_KIND` learns c2 and the accuracy fields, `uncertainty.ts` samples them at
  their own nominals and skips a null nominal (`uncertainty.test.ts`); `shot.ts` passes
  the base step to `interceptFor`. Parity unchanged.
- 3.R1 Sensor and target UAS data, `calib/p3-sensordata` `bc6464d`: 168
  fields (42 L1, 117 L2, 9 L3) over 38 sensor and 15 uas files, changelog section
  "Phase 3 sensor and target UAS fields". 3.R2 Effector data, `calib/p3-effectordata`
  `3eb0a92`: 84 fields (23 L1, 42
  L2, 19 L3) over 18 effector files, changelog section "Phase 3 effector fields".
- Integration `64572fb`: data package v3, the Phase 3 keys in `ADOPTED_SEED_KEYS`,
  library and priors rebuilt (90 models, 1027 fields), `seedLibrary.test.ts` drops the
  Phase 3 keys, docs reviewed; `npm run check` exit 0 (170 files, 1978 tests, entry
  356.23 kB gzip of 360 kB), output in
  [check-64572fb.txt](field-te/evidence/p3-lanes-2026-09-10/check-64572fb.txt).
- Contract addendum `051adde`: switches `noFlightLimits`, `rfBandGate`, `eoirSpanRatio`,
  `legacyKineticPk`, `legacyBeamPk`. Fixture pin `d81ebdb`: both golden fixtures carry
  all eight switches, so the truth-path parity files hold through the physics lanes.
- Physics lanes 3.1 to 3.5 and UI lane 3.7 were launched from `d81ebdb` and stopped by
  Casey on 2026-09-10 (credit limit); their worktrees and branches were removed with
  nothing merged. Lane 3.7 had one unverified commit, discarded. The issued briefs are
  kept as evidence in
  [p3-lanes-2026-09-10/briefs](field-te/evidence/p3-lanes-2026-09-10/briefs/), not as
  tasking.

Phase 2, all on `main`, pushed at `7c65ca1`. Base `2a6f87f`.

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
  `INIT_SPEED_SIGMA_MPS` 20 m/s), `tracker.ts` (one track per sensor and target UAS, polar
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
- 2.d Integration `4359d28`: the latest fused track at the tick enters the engagement context;
  `createRunManifest` and `createTrialManifest` read `physicsSwitches(scenario)` and drop
  `fidelityFloor` to `fallback` when a switch is on; `DATA_PACKAGE_VERSION` 2; the five
  fidelity tags state the current engine; `ADOPTED_SEED_KEYS` in `libraryLifecycle.ts`
  gives a saved builtin the Phase 2 seed keys it lacks on load; the two golden fixtures pin
  `physics: ['truthTracks', 'noFalseTracks', 'noOperatorQueue']`.
- 2.d Review (independent, read-only on `8f02175` and `4359d28`): two blockers, four
  defects, three nits. Fixed in `25bd78f` (a decision index in the kind-10 key; a fused
  entry older than one step falls back to the truth intercept) and `feab222` merged
  `467ceda` (the commit decision point is a quality condition, so a firm time decided on a
  missed scan no longer moves one step; a truth member yields to an estimate member when
  the switch is off; unlinked sensors fuse at `NO_C2`; duplicate links count once). The
  remaining findings are in Open items.
- Post-gate (Casey's change verdict): `src/playback/estimate.parity.test.ts` pins the
  default estimate path on both golden fixtures (four tests, about 25 s); the plan's parity
  rule and `VERIFICATION.md` name it.
- 2.d Docs `ec7d1fb`: `ENGINEERING_REFERENCE.md`, `PROJECT_GUIDE.md`, `VERIFICATION.md`,
  `WORKFLOW.md`, `DESIGN_SYSTEM.md` and the docs index updated and reviewed; evidence in
  [p2-gate-2026-09-10](field-te/evidence/p2-gate-2026-09-10/README.md).

## Decisions, polled 2026-09-10

Casey answered the six decisions the phase took without a poll. Each verdict below names
the commit it covers and the condition it carries.

| Decision | Verdict | Condition |
| --- | --- | --- |
| C2 fields on a `C2Spec` library block (`6e33ef2`) | Keep | The block alone does not touch the hot path; a later library-scan cost is a separate measured question. |
| Operator queue adds only the excess over its median, floored at 0 (`26d5c40`) | Keep, more evidence | Re-measure Run and Monte Carlo wall time on the Phase 2 tip before Phase 3 (recorded below). The Board must say when the wait was floored, so Play and Run never differ in speed for an unexplained reason: slice 3.0 in the plan. |
| Physics switches on `Scenario.physics` with the `fallback` floor (`4359d28`) | Keep | A switch that turns on heavier physics later is measured alone; where the flag lives is settled. |
| `ADOPTED_SEED_KEYS` fills the Phase 2 seed keys on load (`4359d28`) | Keep, more evidence | Keep the fill only with a visible stamp (slice 3.0). Re-check load and playback on a legacy board that adopts against one that already has the keys (recorded below). |
| Estimate path documented in `comparison.md`, not pinned | Change | Done: `src/playback/estimate.parity.test.ts` pins the seed-4821 trial per target UAS, the event count, the total successful intercepts, the track count and the 200 replicate means on both fixtures with the switches removed; the parity rule in the plan names it, and a gate fails when it moves without a hand-derived replacement. |
| `SensorSpec.classification` carries the matrix (`259fa86`) | Keep | No library sensor states one; when the first ships, measure classify cost against the rule ladder before calling it free. |

## Evidence for the two open verdicts

Measured on the Phase 2 tip `7c65ca1`, browser on port 5386, 8 pool workers, in
[tip-timing.md](field-te/evidence/p2-gate-2026-09-10/tip-timing.md).

- Run and Monte Carlo wall time, pool clock (`elapsedMs`), switches pinned against the
  estimate path: JIATF-401 default 30 replicates 0.17 s against 0.18 s; 1000 replicates
  total 0.85 s against 1.28 s (1.5x); half-width rule at 0.5 stops at 60 replicates in
  0.21 s against 0.23 s. Layered acoustic default 100 replicates 1.23 s against 1.46 s;
  1000 replicates total 9.2 s against 12.1 s (1.3x); half-width rule stops at 33 in
  0.67 s against 0.76 s. Every number is inside the section J reference values (10 s
  default, 20 s for 1000 replicates). Watch trials hold 84 to 85 fps at 30x on both.
- Legacy board against a current-seed board (the onboarding firing scenario, 46 of 90
  models adopt keys: 19 radars four fields, 19 other sensors three, 8 C2 the whole block):
  load medians 6.3 ms adopting, 4.9 ms adopting with the switches, 7.8 ms with the current
  seed and nothing to adopt; `loadScenario` itself 0.0 to 0.5 ms, the rest is JSON.parse.
  Watch first frame 2.8 to 3.4 ms, 85 fps, identical frame counts on all three; trial
  worker 66 to 86 ms. Adoption has no measurable cost; the estimate path costs 1.1x to
  1.5x on the ensemble and nothing visible in playback.

## Open items

- Review finding 4: a confusion matrix on one sensor silences the classified flag of every
  other cueing sensor (`sim.ts`, `matrixSensors.length > 0`); needs a per-sensor
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
  one entry per held step per target UAS); strip it after use if store or message size grows.
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

Main is `be9d54a`, not pushed (origin/main is `7c65ca1`). The next task is the Phase 3
physics wave, plan sections 3.c, 3.d and 3.e in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#5-phase-3-sensor-and-effector-physics).
The contract, the data and the switches it needs are on main. One orchestrator runs it.

Lane briefs, complete and ready to issue, one file per lane plus the common rules:
[p3-lane-common.md](field-te/evidence/p3-lanes-2026-09-10/briefs/p3-lane-common.md),
[lane-3.1](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.1.md) target UAS flight,
[lane-3.2](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.2.md) passive RF,
[lane-3.3](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.3.md) EO/IR,
[lane-3.4](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.4.md) radar dwell,
[lane-3.5](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.5.md) kinetic effectors,
[lane-3.6](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.6.md) beam effectors,
[lane-3.7](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.7.md) Physics tab. A brief
is the common rules followed by the lane section; the base commit in the common rules is
`d81ebdb` and must be replaced by the main tip at launch.

Sequence:

1. Launch 3.1, 3.2, 3.3, 3.4, 3.5 and 3.7 in parallel from the main tip, each in its own
   worktree on its `calib/p3-<lane>` branch. Their file sets are disjoint except
   `src/analysis/fidelity.ts` (one additive row and branch per lane) and the fine-step
   hook line in `src/playback/attrition.ts` (3.5 and 3.6, separate statements).
2. Merge each lane as it reports: `--ff-only` when linear, `--no-ff` otherwise; resolve
   `fidelity.ts` conflicts by keeping every lane's rows. After each merge run
   `npm run typecheck` and the four parity files.
3. Launch 3.6 after 3.2 merges; it reads `src/analysis/rfLink.ts` for jam-to-signal.
4. Before the gate, decide the open items below, then re-pin
   `src/playback/estimate.parity.test.ts` from a fresh capture with a before-and-after
   comparison document under `docs/field-te/evidence/p3-gate-<date>/` (the Phase 2
   comparison.md is the pattern). The three truth-path parity files must not move.
5. Gate (plan 3.e): `npm run check` exit 0; each lane's validation test named in
   docs/ENGINEERING_REFERENCE.md section 8; every model tag `datasheet` or `analytic`;
   a browser check of the Physics tab and one run record with a switch on. Update
   docs/PROJECT_GUIDE.md, docs/ENGINEERING_REFERENCE.md and docs/VERIFICATION.md, record
   the reviews with `npm run docs:review`, rewrite this handoff, mark Phase 3 in the plan.

Open decisions for Casey, taken provisionally and recorded in the briefs and on main:

- One draw per burst or dwell, keyed at its commit step; `policy.ts` unchanged. A fine
  tick advances geometry and the timeline only.
- Phase 3 physics on by default. The golden fixtures pin all eight switches, so the
  truth-path parity files hold; `estimate.parity` moves with each lane and is re-pinned
  at the gate.
- The Phase 3 field key and unit table (p3-fields.md); the Phase 3 keys in
  `ADOPTED_SEED_KEYS`; data package version 3.
- Research-lane modelling choices: acoustic `noiseFloorDb` back-solved from each record's
  quoted range; radar dwell from a literature CPI (20 ms, 100 pulses) on e-scan panels;
  RF `receiverSensitivityDbm` -90 dBm flat; projectile effector dispersion 1.0 mil and pointing error 0.5 to
  1.0 mil flat; optical source M squared 2.0, jitter 10 urad, aperture 0.30 m flat.

Known constraints: the entry bundle is 356.23 kB gzip of a 360 kB budget before any
physics lane lands (`scripts/check-bundle.mjs`); a lane that pushes it over reports it
and the gate decides between a budget change and lazy loading. Draw keys inside a fine
window share the DT step key (`policy.ts`); left as is under the one-draw rule. No poll
is open.

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
  layered-acoustic-merops leaker mean from 1.990 to 2.120 (intervals overlap), one target UAS
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
