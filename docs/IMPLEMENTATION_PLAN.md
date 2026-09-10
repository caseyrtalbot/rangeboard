# RangeBoard calibration implementation plan

Current reference. Written 2026-09-10 against `ffde21b`. The design it implements is the
RangeBoard Calibration Blueprint (artifact, version 3, 2026-09-10). Source and tests decide
what is built; this plan sequences the work and assigns each slice to an owner. Old plans
remain cancelled.

## 1. Rules for every slice

- The orchestrator is this session at Fable high. Workers are the agent types under
  `~/.claude/agents`: `fable-medium` for work that needs judgment, `fable-high` only for a
  review or a decision where correctness is critical, `opus-high` and `opus-xhigh` for
  mechanical work with a fixed contract.
- Every phase has three steps: a **contract** slice (sequential, one owner), **lanes**
  (parallel, disjoint files), then **integration and gate** (orchestrator). A lane never
  starts before its contract merges.
- A lane owns the files listed for it and no others. A lane that must change another
  lane's file stops and reports the exact line; the orchestrator resolves it.
- `src/model/types.ts`, `src/io/storageKeys.ts` and `src/state/store.ts` are contract
  files. Only the contract slice of a phase edits them.
- Every lane runs `npm run typecheck` and `npx vitest run <its test files>` before it
  reports. A lane with UI runs a real browser check and records what it saw. The
  orchestrator runs `npm run check` at each gate.
- Parity: `sensitivity.parity.test.ts`, `accuracy.verify.test.ts` and
  `convergence.verify.test.ts` must pass unchanged unless the slice's brief names the pinned
  number and gives the hand-derived replacement.
- Type changes require `npm run schema:generate`. Library changes require the data health
  check once it exists.
- A worker reports: files changed, tests run with output, browser check if any, open items,
  the exact stop point. No claim without tool output.
- Each phase ends with a commit per lane on a branch named `calib/p<n>-<lane>`, merged to
  `main` by the orchestrator after the gate.

## 2. Phase 0: data foundation

Goal: the library becomes JSON files with grade, layer, lineage and spread on every field;
overrides and a run store exist. Two to three weeks.

### 0.a Contract (sequential)

| Owner | Files | Deliverable |
| --- | --- | --- |
| `fable-medium` | `src/model/types.ts`, `src/io/storageKeys.ts`, `src/model/libraryField.ts` (new) | `LibraryField<T>` object type (`value, unit, rangeType, condition, grade, layer, source, url, date, spread, estimator, comparisonSet, note`); `Override` record (`modelId, field, value, reason, date`); `RunRecord` shape for the run store; `TrialManifest` gains `dataPackageVersion, overrides[], physicsSwitches[], fidelityFloor, producer`. Adds `rangeboard.overrides.v1` key. Runs `npm run schema:generate`. No behaviour change. |

Stop: typecheck and the full test suite pass. Merge before any lane starts.

### 0.b Lanes (parallel, four agents)

| Lane | Owner | Files owned | Deliverable and stop condition |
| --- | --- | --- | --- |
| 0.1 Data package | `opus-xhigh` | `data/library/**` (new), `data/schema/library.schema.json` (new), `scripts/build-library.mjs` (new), `scripts/check-library.mjs` (new), `src/model/seedLibrary.ts`, `src/model/seedLibrary.test.ts`, `package.json` scripts only | One JSON file per model migrated from `seedLibrary.ts`; grades and layers folded in from `docs/inventory/provenance.md`; the build writes `src/model/seedLibrary.generated.ts` and `seedLibrary.ts` re-exports it. Health check rules from blueprint section D. Stop: the compiled library equals the old one field for field in a test; `npm run check:library` passes on every file. |
| 0.2 Class priors | `fable-medium` | `scripts/derive-priors.mjs` (new), `data/priors/**` (new), `src/analysis/classPriors.ts` (new), `src/analysis/classPriors.test.ts` (new), `src/analysis/parameterBasis.ts` | Class definition (kind, type, band, target class), log-median and spread per field per class from L1 entries only, member list recorded. `PF_SPREAD` becomes the fallback behind a class prior. Stop: a test shows the prior for one class equals a hand computation; parity fixtures unchanged. |
| 0.3 Overrides and Systems tab | `opus-high` | `src/state/overrides.ts` (new), `src/state/overrides.test.ts` (new), `src/io/persistOverrides.ts` (new), `src/panels/settings/SystemsTab.tsx` (new), `src/panels/SettingsPanel.tsx`, `src/panels/settings/*.css` if needed | Override store with its own key and recovery prefix following the baseline pattern in `src/state/baseline.ts`. Systems tab lists every field of every system in the scenario with grade, layer, source and spread; edit creates an override with a reason; reset per field, per system, all. Stop: an override appears in an exported run manifest; a browser check shows edit and reset. |
| 0.4 Run store | `opus-high` | `src/io/runStore.ts` (new), `src/io/runStore.test.ts` (new), `src/panels/analysis/RunHistory.tsx` (new), `src/panels/analysis/screens/OutcomeScreen.tsx` | IndexedDB store of `RunRecord` (manifest, scenario snapshot, summary, sensitivity, per-threat, per-effector). Outcome gains Save to history; a history list opens any record in place. Size cap with oldest-first eviction and a notice. Stop: a saved run reloads after a page reload in a browser check; tests use a fake IndexedDB. |

Lane 0.2 depends on 0.1's file format for reading L1 entries. Start 0.2 after 0.1 reports
the format frozen, or let 0.2 read `seedLibrary.ts` and switch when 0.1 merges.

### 0.c Integration and gate

Orchestrator: wire the run manifest to list overrides and the data package version; update
`docs/PROJECT_GUIDE.md` and `docs/ENGINEERING_REFERENCE.md` sections that name the
library; `npm run check`; browser check of Settings and history. Exit: blueprint Phase 0
exit.

## 3. Phase 1: real-mode statistics

Goal: one Run button with real defaults, a worker pool, a headless runner, Morris and
Sobol. Two to three weeks.

### 1.a Contract (sequential)

| Owner | Files | Deliverable |
| --- | --- | --- |
| `fable-medium` | `src/model/types.ts`, `src/state/store.ts`, `src/playback/mcTypes.ts` (new) | `McSettings` gains `sampling: 'lhs' \| 'independent'`, `sensitivityDepth: 'quick' \| 'full'`, `sobolBase`, `stopFloor`, `stopCap`, `confidence`. Defaults change to Monte Carlo, total, LHS, stop on half-width with floor 30 and cap 2000. `SobolResult`, `MorrisResult` and `PoolProgress` types. `src/engine/index.ts` barrel (new) that re-exports the engine surface and a lint rule in `oxlint` config that forbids `react`, `konva` and `window` under `src/playback/`, `src/analysis/`, `src/geometry/`. |

### 1.b Lanes (parallel, five agents)

| Lane | Owner | Files owned | Deliverable and stop condition |
| --- | --- | --- | --- |
| 1.1 Headless runner | `fable-medium` | `scripts/run-engine.mjs` (new), `vite.engine.config.ts` (new), `src/engine/**` except `index.ts`, `scripts/test-engine-cli.mjs` (new), `package.json` scripts only | Engine bundle built for Node with `vite build` in library mode. Runner: `npm run engine -- scenario.json --replicates 10000 --seed 4821 --out run.json`, `worker_threads` pool over every core, merges by replicate index, writes a `RunRecord`. Stop: the CLI summary equals the browser summary at one seed on the JIATF-401 fixture in a test; 10 000 replicates complete on the largest fixture with the time recorded. |
| 1.2 Browser pool | `opus-high` | `src/playback/workerPool.ts` (new), `src/playback/workerPool.test.ts` (new), `src/playback/mergeSummaries.ts` (new), `src/playback/mergeSummaries.test.ts` (new), `src/playback/mcClient.ts`, `src/playback/mc.worker.ts` | Pool of `min(hardwareConcurrency - 1, 8)` workers, replicate ranges by index, deterministic merge, cancel semantics as `workerSlot.ts`. Stop: pooled and single-worker summaries identical at one seed in a test; `workerGraph.test.ts` and `workerSlot.test.ts` unchanged. |
| 1.3 Sampling and sensitivity | `fable-medium` | `src/playback/mcRun.ts`, `src/playback/sampling.ts` (new), `src/playback/morris.ts` (new), `src/playback/sobol.ts` (new), their tests, `src/analysis/uncertainty.ts`, `src/analysis/stats.ts` | LHS strata assigned per replicate index from the seed so common random numbers hold. Morris: ten trajectories over every uncertain field. Sobol: Saltelli on the top eight fields by group, base 256, first-order and total indices with bootstrap intervals. One-at-a-time kept as quick mode. Wilson interval returned on every defined fraction. Stop: Sobol on a fixture with an analytic ranking (Ishigami or a two-factor Bernoulli) recovers it within the bootstrap interval; parity fixtures unchanged in aleatory mode with independent sampling. |
| 1.4 Run tab and Run button | `opus-high` | `src/panels/settings/RunTab.tsx` (new), `src/panels/analysis/ForecastSettings.tsx`, `src/panels/analysis/AnalysisNavigation.tsx`, `src/panels/analysis/screens/FragilityScreen.tsx` | Run tab exposes every `McSettings` field with default and reset. One Run button beside a Deterministic switch on Prepare and Analyze; the popover goes. Progress shows the stop rule and the pool size. Stop: browser check shows a default run finish with no setting touched. |
| 1.5 Sobol chart | `opus-high` | `src/charts/SobolChart.tsx` (new), `src/charts/SobolChart.test.tsx` (new), `src/panels/analysis/SensitivityWidget.tsx` | Ranked bars of first-order and total indices with intervals, keyed to the `SobolResult` type. Copy names the method. Stop: renders from a fixture result; accessibility text lists the ranking. |

Lane 1.3 owns `mcRun.ts`. Lane 1.2 reads summaries only through `mergeSummaries.ts`.
Lane 1.5 builds against the contract type and a fixture until 1.3 merges.

### 1.c Integration and gate

Orchestrator: wire the Run button to the pool; Fragility runs Morris then Sobol after a
Monte Carlo run finishes; `npm run check`; record pool timing on the largest fixture
against blueprint section J. Exit: blueprint Phase 1 exit.

## 4. Phase 2: tracks and kill chain

Goal: tracks carry an estimated state; fusion, classification and the operator read it.
Three to four weeks. This phase has the highest correctness risk, so it ends with a
`fable-high` review.

### 2.a Contract (sequential)

| Owner | Files | Deliverable |
| --- | --- | --- |
| `fable-medium` | `src/model/types.ts`, `src/playback/trackTypes.ts` (new), `src/analysis/fidelity.ts` | Sensor fields `rangeAccuracyM, azimuthAccuracyDeg, elevationAccuracyDeg, falseAlarmRatePerScan`; C2 fields `decisionLatencyS` (distribution), `operatorTrackCapacity`; `TrackEstimate` (state, covariance, quality, source sensor ids); `FusedTrack`; `ClassificationMatrix`; physics switches `truthTracks, noFalseTracks, noOperatorQueue`. Fidelity tags for `tracker, fusion, classification, operator, false-tracks`. |

### 2.b Wave one (parallel, three agents)

| Lane | Owner | Files owned | Deliverable and stop condition |
| --- | --- | --- | --- |
| 2.1 Accuracy data | `fable-medium` with web search | `data/library/sensor/**`, `data/library/c2/**`, `docs/inventory/changelog.md` | Every sensor gets accuracy fields by the priority of evidence: advertised, open reference, class estimate with comparison set. C2 gets decision latency and capacity. Stop: `npm run check:library` passes; the changelog names each source. |
| 2.2 Kalman tracker | `fable-medium` | `src/playback/kalman.ts` (new), `src/playback/tracker.ts` (new), their tests, `src/playback/sweep.ts`, `src/playback/detection.ts` | Constant-velocity Kalman filter per sensor track; measurement noise from accuracy fields; coasting grows covariance; drop on covariance or misses; track quality from covariance. Truth path when accuracy is null or `truthTracks` is on. Stop: steady-state gain equals the closed form in a test; with `truthTracks` on every parity fixture is unchanged. |
| 2.3 Track layer | `opus-high` | `src/canvas/layers/TrackLayer.tsx` (new), its test, `src/canvas/CanvasStage.tsx`, `src/canvas/layers/footprintStyle.ts` | Covariance ellipse and estimated position per track in Watch, censored at the observed horizon, styled by the design system. Stop: browser check with a fixture trial shows ellipses that shrink on update and grow on coast. |

### 2.c Wave two (parallel, three agents, after 2.2 merges)

| Lane | Owner | Files owned | Deliverable and stop condition |
| --- | --- | --- | --- |
| 2.4 Fusion and classification | `fable-medium` | `src/playback/fusion.ts` (new), `src/playback/classification.ts` (new), their tests, `src/playback/sim.ts` | Covariance-weighted track-to-track fusion at the C2 node after link latency; confusion matrix per sensor type by range band with time to declare; rule ladder as fallback. Stop: fusion of two equal tracks halves the covariance in a test; a laydown with no matrix reproduces today's declaration times. |
| 2.5 False tracks and operator | `fable-medium` | `src/playback/falseTracks.ts` (new), `src/playback/operator.ts` (new), their tests, `src/playback/attrition.ts`, `src/playback/killChain.ts` | False alarms from the radar rate enter the tracker; operator queue with a decision latency distribution and an overload threshold delays gates. Stop: expected false track count matches the rate in a convergence test; with the switches on, parity fixtures are unchanged. |
| 2.6 Intercept from estimate | `fable-medium` | `src/playback/intercept.ts`, `src/playback/pk.ts`, `src/playback/shot.ts`, their tests | Intercept point predicted from the estimated state; prediction error carried to the shot record for Phase 3. Stop: with `truthTracks` the closed-form intercept tests are unchanged; with an estimate the predicted point differs by the covariance in a hand-derived test. |

### 2.d Review and gate

`fable-high` adversarial review of `kalman.ts`, `tracker.ts`, `fusion.ts` and the draw
keying (does a new draw point disturb another model's draws?). Orchestrator: `npm run
check`; timeline parity captured before and after under `docs/field-te/evidence/`;
Physics switches wired in the manifest. Exit: blueprint Phase 2 exit.

## 5. Phase 3: sensor and effector physics

Goal: one physics per sensor type and per effector type, each with a validation test
against advertised data. Three to four weeks. Phases 2 and 3 may overlap once 2.a merges,
because the file sets are disjoint except `pk.ts` and `intercept.ts`; lane 3.6 starts after
2.6 merges.

### 3.a Contract and split (sequential)

| Owner | Files | Deliverable |
| --- | --- | --- |
| `fable-medium` | `src/model/types.ts`, `src/playback/clock.ts`, `src/playback/attrition.ts`, `src/playback/sweep.ts`, `src/analysis/sensorEnv.ts`, `src/analysis/sensorEnv/*.ts` (new), `src/playback/pk.ts`, `src/playback/pk/*.ts` (new) | Sweep step as a manifest parameter, 0.5 s default, with a per-effector fine-step request honoured only during a burst or dwell. `sensorEnv.ts` split into `radar.ts`, `eoir.ts`, `acoustic.ts`, `rf.ts` with `sensorEnv.ts` as the barrel. `pk.ts` split into `kinetic.ts` and `beam.ts`. New threat fields (turn rate, climb rate, acceleration, radiated power, protocol, acoustic level) and effector fields from blueprint section D. Pure moves; every test unchanged. |

### 3.b Research wave (parallel, two agents, with web search)

| Lane | Owner | Files owned | Deliverable |
| --- | --- | --- | --- |
| 3.R1 Sensor and threat data | `fable-medium` | `data/library/sensor/**`, `data/library/uas/**`, `docs/inventory/changelog.md` | Every new sensor and threat field filled by the priority of evidence. |
| 3.R2 Effector data | `fable-medium` | `data/library/effector/**`, `docs/inventory/changelog.md` (separate section) | Every new effector field filled by the priority of evidence. |

### 3.c Physics lanes (parallel, six agents, after 3.a; data lanes may still be running)

| Lane | Owner | Files owned | Deliverable and stop condition |
| --- | --- | --- | --- |
| 3.1 Threat flight | `fable-medium` | `src/playback/flight.ts` (new), `src/geometry/geo.ts`, `src/playback/tracks.ts`, their tests | Point mass with speed, turn rate, climb rate, acceleration limits; wind drift from the environment vector; same waypoints. Stop: a threat with no limits reproduces `posAtTime`; a limited turn matches a hand-derived arc. |
| 3.2 Passive RF | `fable-medium` | `src/analysis/sensorEnv/rf.ts`, `src/analysis/rfLink.ts` (new), tests | Link budget from radiated power, free-space loss, urban margin, receiver sensitivity; direction-finding accuracy by signal to noise; geolocation from two or more nodes. Stop: a datasheet detection range is reproduced within its condition. |
| 3.3 EO/IR | `fable-medium` | `src/analysis/sensorEnv/eoir.ts`, tests | Johnson criteria per band from pixel pitch and focal length; Beer-Lambert extinction from visibility; detect, recognize, identify ranges. Stop: an advertised DRI triple is reproduced. |
| 3.4 Radar | `fable-medium` | `src/analysis/radarPd.ts`, `src/analysis/sensorEnv/radar.ts`, `src/playback/radarDwell.ts` (new), tests | Pulse integration per dwell, elevation coverage limits, false alarm rate per scan. Stop: `radarPd.test.ts` Marcum-Q pins unchanged; integrated Pd matches Shnidman's approximation within tolerance. |
| 3.5 Kinetic effectors | `fable-medium` | `src/playback/pk/kinetic.ts`, `src/playback/ballistics.ts` (new), `src/playback/intercept.ts`, tests | Interceptor: speed profile, miss distance from track error plus guidance noise, Pk from lethal radius. Gun: dispersion, burst, rate of fire, fire control error. Stop: a Pk table from an advertised lethal radius is reproduced; the 0.1 s step test matches a hand-derived burst timeline. |
| 3.6 Beam effectors | `fable-medium` | `src/playback/pk/beam.ts`, `src/playback/directedEnergy.ts` (new), `src/playback/hpm.ts` (new), `src/analysis/ewPhysics.ts`, tests | DE irradiance from power, beam quality, jitter; dwell per airframe class; slew and settle. HPM field strength against a susceptibility threshold; recharge. Jam-to-signal shares the threat link budget from 3.2 through `rfLink.ts` once it merges. Stop: dwell for an advertised power and range matches a hand computation. |

### 3.d UI lane (parallel with 3.c, one agent)

| Lane | Owner | Files owned | Deliverable |
| --- | --- | --- | --- |
| 3.7 Physics tab | `opus-high` | `src/panels/settings/PhysicsTab.tsx` (new), its test, `src/panels/SettingsPanel.tsx` | One switch per model to its fallback; each switch lowers the fidelity tag on the run record. Browser check. |

### 3.e Gate

Orchestrator: `npm run check`; each lane's validation test named in
`docs/ENGINEERING_REFERENCE.md` section 8; fidelity tags all `datasheet` or `analytic`.
Exit: blueprint Phase 3 exit.

## 6. Phase 4: hypothesis tools

Goal: placement optimization, calibration from typed counts, compare and export. Two to
three weeks.

### 4.a Contract (sequential)

| Owner | Files | Deliverable |
| --- | --- | --- |
| `fable-medium` | `src/model/types.ts`, `src/playback/optimizeTypes.ts` (new) | `OptimizeRequest` (objective, movable ids, bounds, budget), `OptimizeResult` (candidates with intervals, trace), `CalibrationRecord` (field, prior, observed, posterior, accepted). |

### 4.b Lanes (parallel, four agents)

| Lane | Owner | Files owned | Deliverable and stop condition |
| --- | --- | --- | --- |
| 4.1 Placement optimizer | `fable-medium` | `src/playback/optimize/**` (new), `src/playback/optimize.worker.ts` (new), tests | Gaussian process with expected improvement over movable positions inside range bounds; each evaluation is a 40-replicate run under common random numbers; budget 60. Returns candidates with intervals. Stop: on a fixture the best candidate's objective interval lies outside the starting laydown's interval. |
| 4.2 Calibrate from counts | `fable-medium` | `src/analysis/calibrate.ts` (new), its test, `src/panels/settings/CalibrateDialog.tsx` (new) | Beta posterior with the Jeffreys prior for a proportion, normal-gamma for a time; accept writes an override with the posterior as reason. Stop: a hand-computed posterior matches; the override shows in the manifest. |
| 4.3 Compare and record | `opus-xhigh` | `src/panels/analysis/screens/CompareScreen.tsx`, `src/panels/analysis/RunRecord.tsx` (new), `src/io/exportRun.ts` (new), `src/io/exportCsv.ts` (new), tests | Compare any two history runs; run record with lineage on demand for any tile; JSON, CSV per table, PNG per chart. Stop: a record round-trips through export and import in a test; browser check. |
| 4.4 SQLite export | `opus-high` | `src/io/exportSqlite.ts` (new), its test, `package.json` dependency `sql.js` pinned | Export run history as one SQLite file: runs, per-threat, per-effector, sensitivity, sobol tables. Stop: the file opens in the `sqlite3` CLI and a join across two runs returns rows. |

### 4.c UI lane (after 4.1 contract, one agent)

| Lane | Owner | Files owned | Deliverable |
| --- | --- | --- | --- |
| 4.5 Where to put it | `opus-high` | `src/panels/analysis/screens/PlacementScreen.tsx` (new), its test, `src/panels/analysis/AnalysisNavigation.tsx` | Objective, movable systems, budget; progress; candidate laydowns with intervals; apply one as a new scenario. Browser check. |

### 4.d Gate

Orchestrator: `npm run check`; browser check of the whole loop: build, Run, What drives
this, Where it fails, Where to put it, Save, Compare, Export. Exit: blueprint Phase 4 exit.

## 7. Agent count and effort by phase

| Phase | Contract | Parallel lanes | Review | Notes |
| --- | --- | --- | --- | --- |
| 0 | 1 `fable-medium` | 1 `opus-xhigh`, 1 `fable-medium`, 2 `opus-high` | none | 0.2 waits for 0.1's format |
| 1 | 1 `fable-medium` | 2 `fable-medium`, 3 `opus-high` | none | 1.3 owns `mcRun.ts` |
| 2 | 1 `fable-medium` | wave one: 2 `fable-medium`, 1 `opus-high`; wave two: 3 `fable-medium` | 1 `fable-high` | highest risk |
| 3 | 1 `fable-medium` | 2 research `fable-medium`, 6 physics `fable-medium`, 1 `opus-high` | none | may overlap Phase 2 after 2.a |
| 4 | 1 `fable-medium` | 2 `fable-medium`, 1 `opus-xhigh`, 1 `opus-high`, then 1 `opus-high` | none | |

Peak concurrency is nine agents in Phase 3. Every lane has a named owner, a file set and a
stop condition, so a smaller pool runs the same lanes in sequence with no change to the
plan.

## 8. Documentation maintenance

Each phase gate updates `docs/PROJECT_GUIDE.md`, `docs/ENGINEERING_REFERENCE.md` and
`docs/VERIFICATION.md` where their inputs changed, then records the review with
`npm run docs:review`. This plan is a current reference; when a phase completes, mark it
here with the merge commit and move on. Dated evidence goes under `docs/field-te/evidence/`.
[HANDOFF.md](HANDOFF.md) is the one session-state document. The orchestrator rewrites it in
place at every phase gate, from the Phase 0 gate through the Phase 4 gate, and keeps only
the current phase and the one before it.
