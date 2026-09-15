# Hypothesis tools Phase 4 gate evidence

Captured 2026-09-15 on local `main` at `4f50104`, with the Phase 4 contract, four lane
merges, the UI lane and two integration commits merged. Nothing was pushed by the lanes.

## Delivered lanes

| Lane | Merge | Delivered |
| --- | --- | --- |
| 4.a contract | `86c65e8` | `CalibrationRecord` family types in `src/model/types.ts`; `src/playback/optimizeTypes.ts` (`OptimizeRequest`, `OptimizeResult`, `OptimizeWorkerMessage`, defaults 60 evaluations x 40 replicates); `statOf` and `StatKind` exported from `mcRun.ts` (`6defdf4`) |
| 4.2 calibrate | `72ea030` | `src/analysis/calibrate.ts`: beta posterior with the Jeffreys prior for a proportion, normal-gamma for a time (default prior mu0 = current value, kappa0 = 1, alpha0 = 1, beta0 from the field's spread variance, fallback CV 0.5); family from the provenance unit (`fraction`, `s`) else the spec key; `CalibrateDialog.tsx` opened from a Calibrate button per field in `SystemsTab.tsx`; Accept writes `useOverrides.setOverride` with the prior, observation and posterior in the reason; the record is stored nowhere else |
| 4.1 optimizer | `44575d0` | `src/playback/optimize/{loop,gp,polygon,client}.ts` and `src/playback/optimize.worker.ts`: GP with expected improvement over movable positions inside the range polygon, common random numbers at one seed, each evaluation a replicate run read through `endOfRunResponses` and `statOf`; `LENGTH_SCALE_FRACTION` 0.25, `SEED_EVALUATIONS` 8, `CANDIDATE_CLOUD` 512, candidates capped at five; `client.ts` is the slot adapter (`startOptimize`, `cancelOptimize`); the worker is in `workerGraph.test.ts` |
| 4.4 sqlite | `eddbb59` | `src/io/exportSqlite.ts`: `exportRunsSqlite` and `downloadRunsSqlite`, tables `runs`, `per_target`, `per_effector`, `sensitivity`, `sobol` (sobol empty by construction; no `RunRecord` field carries it); `sql.js` 1.14.2 pinned, loaded only by dynamic import with the wasm URL; the button is in `RunHistory.tsx` (`c59fb90`); the entry chunk measured 359,393 bytes gzip against the 360,000 budget before the UI lane |
| 4.3 compare | `95418bc` | `CompareScreen.tsx` gains a saved-run comparison of any two history records (means differenced, no interval on a difference of independent runs); `RunHistory.tsx` `RunRecordView` gains a collapsed lineage disclosure per tile; `src/io/exportCsv.ts` (per-threat, per-effector, sensitivity CSV, RFC 4180, units in headers); `src/charts/exportPng.ts` (recharts SVG to PNG with computed paint baked in); `runRecordExportObject`, `exportRunRecordPackage`, `parseRunRecordPackage`, `importRunRecordFile` (a `rangeboardRunRecord: 1` envelope; a debrief `rangeboardRun: 1` export is refused), delivered in `persist.ts` and moved to `src/io/runRecordPackage.ts` in `4f50104` to keep `runStore` and the parser out of the entry chunk |
| 4.5 placement | `d8fb1c2` | `PlacementScreen.tsx` (Where to put it, in Prepare after Inputs, in `screens/navigation.ts`, `AnalysisPanel.tsx` and the App callback); store wiring: `McState.optimize: AnalysisRunState<OptimizeResult>` plus `optimizeBest`, `AnalysisKind` gains `optimize` with `RequestKind` excluding it, `requestOptimize`, `acceptOptimizeMessage`, store actions `runOptimize`, `optimizeMessage`, `cancelOptimize`, `clearOptimize`; Apply installs a copy through `replaceScenario` with the name suffix `(placement N)`; `scenarioInstall.ts` cancels and stales the optimize run (`f855d6b`) |

## Numerical boundary

No parity fixture moved. The optimizer and the calibration add paths and change none:
every evaluation reads the existing replicate loop through `endOfRunResponses` and
`statOf`, and a calibration lands as an ordinary override. The protected truth-path
suites, the estimate-path parity file and the Phase 3 verify suites keep the anchors
recorded in [the Phase 3 gate](../p3-gate-2026-09-10/README.md).

## Known limits

- The `sobol` table is empty by construction; no `RunRecord` field carries Sobol indices.
- `CalibrationRecord` is not persisted. The override and its reason are the only durable
  product of a calibration.
- Candidates tie under common random numbers when a placement change does not change the
  draws; the ranking then reflects the objective sign and the trace order, not a
  difference in outcome.
- The entry chunk measured 359,393 bytes gzip against the 360,000 budget before the UI
  lane. After the placement wiring and the package move, `4f50104` raised the entry
  budget in `scripts/check-bundle.mjs` to 364,000; the gate measured the entry at
  360,308 bytes gzip and initial JavaScript plus CSS at 375,965 against 400,000.
  `npm run check` does not run `check:bundle`.
- `exportPng.svgMarkup` over a live SVG is covered only by the browser check; the unit
  tests inject canvas and image doubles.

## Browser check

Run on 2026-09-15 against `4f50104` with a Playwright script driving the dev server at
1280 px width. The firing-scenario probe was loaded, given a range boundary of four points
(-3000, -4000) to (3000, 1500) m and a four-ship Mavic line, at seed 4821 with 30
replicates under total uncertainty. No console error and no page error fired at any step.

| Step | Screenshot | What the screen showed |
| --- | --- | --- |
| Build | `01-board.png` | 6 entities, the range boundary, the board flagged INVALID because a Mavic starts inside detection coverage |
| Run | `02-run.png` | 30 of 30 replicates; kills 0 (0 to 0.4), leakers 4 (3.6 to 4), first detect 0.52 s, min warning 475.5 s; 4 salvos, 0 kills |
| What drives this | `03-fragility.png` | Morris 10 trajectories over 13 fields, 140 runs, kept 8; Sobol base 256, 2560 runs; every index `n/a` because the response has zero variance |
| Where it fails | `04-outcome.png` | 0 of 4 defeated, 4 of 4 arrived undefeated, 4 kinetic salvos, validity INVALID with 2 findings |
| Where to put it | `05-placement.png`, `06-placement-applied.png` | Coyote movable, 6 evaluations x 10 replicates; five candidates all at leakers 4 (2.8 to 4), candidate 1 the start; Apply named the copy "(placement 1)"; applying candidate 2 moved the Coyote from (1700, -1700) to (-791.6, -671.9) |
| Save | `07-history.png` | Two records, both seed 4821, 30 replicates |
| Compare | `08-compare.png` | Saved-run delta table over the two records; every difference 0 for two identical laydowns |
| Export | `09-export.png` | JSON 934,549 bytes, per-threat CSV 863 bytes, SQLite 122,880 bytes; `sqlite3` reports 2 runs and one `per_target` row per run through the join |
| Calibrate | `10-calibrate.png` | Coyote `pk`, 17 of 20: Beta(0.5, 0.5) to Beta(17.5, 3.5), mean 0.8333, interval 0.6514 to 0.9559; Accept wrote the override, the Systems tab reads "1 override" and the next trial manifest carries it |

Findings from the run:

- The saved run record carried no overrides: `OutcomeScreen` built its manifest without
  them. Fixed in `891c4f0`; the trial manifest already carried them.
- The tile lineage printed the full analysis basis signature as the scenario hash. Fixed
  in `891c4f0`: the row shows the FNV-1a digest.
- An accepted override is recorded in the manifests but no engine path reads it, so a
  calibrated `pk` of 0.02 left kills and leakers unchanged. Pre-existing; carried as a
  follow-up in the handoff.
- Under the default physical kinetic model the Coyote fired its magazine of four at every
  position and killed nothing, so every placement tied and every Sobol index was
  undefined; under `legacyKineticPk` the same laydown gives 2.25 kills. Pre-existing
  Phase 3 behaviour on this laydown; carried as a follow-up.
