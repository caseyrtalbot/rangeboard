# RangeBoard verification guide

Commands and checks for current development. Run results belong in dated evidence or a
session handoff; historical test counts are not the current baseline.

## Commands

Use Node.js 22.12 or later and the committed npm lockfile. Node 22 is the verified local
major version; `.nvmrc` selects it. `npm ci` installs the locked dependencies; no global test or browser package is required.

| Command | Purpose |
| --- | --- |
| `npm run dev -- --port <port> --strictPort` | Start Vite on an available explicit port |
| `npm run typecheck` | Check application and colocated TypeScript tests |
| `npm test` | Run current-source Vitest tests under `src/` |
| `npx vitest run --dir src src/playback/pk.test.ts` | Run one file; `-t 'fragment'` selects test names |
| `npm run lint` | Run oxlint; do not add to existing fast-refresh warnings |
| `npm run format` | Write Prettier layout for `.ts`, `.tsx` and `.mjs` sources |
| `npm run format:check` | Reject sources that differ from Prettier (`prettier.config.mjs`) |
| `npm run build` | TypeScript project build and Vite production bundle |
| `npm run schema:generate` | Regenerate runtime descriptors after domain type changes |
| `npm run schema:check` | Reject descriptors that differ from current types |
| `npm run library:build` | Compile `data/library` into `src/model/seedLibrary.generated.ts` after a library edit |
| `npm run priors:build` | Derive `data/priors` and `src/analysis/classPriors.generated.ts` from the L1 entries |
| `npm run library:check` | Reject a stale generated library or prior file and run the data health check |
| `npm run docs:check` | Lint Markdown, validate local links, placement and source review |
| `npm run test:docs` | Exercise documentation maintenance failure paths |
| `npm run evidence:report` | Measure `docs/field-te/evidence`: size by type, duplicate JSON groups, uncompressed JSON over 512 kB |
| `npm run check:evidence` | Fail on a byte-identical JSON copy or an uncompressed JSON capture over 512 kB, except paths in `scripts/evidence/allowlist.json` |
| `npm run test:evidence` | Test the evidence gate and the shared capture helper |
| `npm run check:silent` | Fail when an added line intersects a hidden failure: an empty catch, a catch that returns a substitute without reporting, a no-op promise catch, or a comment or string that says silent, swallow, fallback, fail-open, fail-soft, or best-effort. Diff against `main` (`--base <ref>` overrides, `--staged` scans the exact index snapshot) |
| `npm run check:silent:all` | Report the same patterns across every tracked source file without failing |
| `npm run test:silent` | Run the ast-grep rule cases in `scripts/silent/rule-tests` and the gate script tests |
| `npm run hooks:install` | Point `core.hooksPath` at `.githooks` so `check:silent --staged` runs before each commit. Opt in per clone |
| `npm run test:bundle` | Test bundle accounting and over-budget rejection |
| `npm run check:bundle` | Check the current `dist/` entry and initial JavaScript + CSS gzip budgets |
| `npm run test:e2e` | Run the Board shell Playwright spec against a dev server (`E2E_URL`, default port 5377) |
| `npm run engine:build` | Build the headless engine bundle `dist-engine/engine.js` from `src/engine/index.ts` |
| `npm run engine -- <scenario.json> --replicates N --seed S --out run.json [--overrides overrides.json]` | Run a fixed replicate count over worker threads, an override set applied from the manifest, and write a run record |
| `npm run test:engine` | Check the runner record equals the in-process summary at one seed |
| `npm run check` | Complete documentation, evidence, silent-gate test, type, library, schema, engine, test, lint, format and build gate |

Run the complete gate for source changes and after integrating lanes. `npm run check`
does not run `check:bundle`; `test:bundle` tests the accounting script only. Run
`npm run check:bundle` after `npm run build` for any change that touches the entry chunk.
The budget (`scripts/check-bundle.mjs`) is 365,000 bytes gzip for the entry and 400,000
for initial JavaScript plus CSS. It was raised from 364,000 on 2026-09-22, when the
column-buffer track ledger in `retainTrial.ts` added 682 bytes and the entry measured
364,422 (initial 380,121), so the entry headroom is under 1 kB. Documentation-only
changes need `docs:check`; maintenance-script changes also need `test:docs`.
`npm run check` runs the silent-gate tests but not `check:silent` itself; CI runs `check:silent`
against the pull request base or the pushed-from commit, and a local run diffs against `main`.
A finding is accepted with `// silent-ok: <reason>` on the line, the line above, or inside the
matched block. Domain terms `RF silent` and `jam-degraded`, and comments that negate the
pattern (`never silent`), are exempt. An exemption covers only the line it sits on: every
other line of the matched block that holds a weasel word must carry its own. These two
exemptions apply to `weasel-word` and `weasel-word-tsx` alike. The weasel-word regex lives
in `scripts/silent/rules/weasel-word.yml` and in the `WEASEL_WORD` constant of
`check-silent.mjs`; change both together.

Rules live in `scripts/silent/rules`. Each rule has a `-tsx` twin (`empty-catch-tsx`,
`silent-catch-tsx`, `noop-promise-catch-tsx`, `weasel-word-tsx`), so `.ts` and `.tsx` files
are both scanned. `silent-catch` flags a catch that returns, continues, breaks, assigns or
evaluates `void` without a call or throw; a `new` or `await` substitute is no longer exempt,
and assigning the caught error itself (`lastError = e`, `this.error = e`) counts as recording.
`noop-promise-catch` flags an arrow or function-expression handler in `.catch()` and a no-op
second (rejection) argument to `.then()`.

The gate pins its `git diff` options (`core.quotePath=false`, `-U0`,
`--inter-hunk-context=0`, `--no-color`, `--no-ext-diff`, `--no-renames`, `--no-relative`,
fixed `a/` and `b/` prefixes), so user git config does not change the result. Tracked and
untracked files are listed with `-z` and read raw. A path that git still quotes in diff
output (a double quote, backslash or control character) stops the gate with an error. A
`--base` ref with no merge-base, or no `main` or `origin/main` ref in changed-lines mode,
is an error; the gate no longer falls back to a diff against `HEAD`. A scan of a missing
file is an error, and `check:silent:all` skips tracked files deleted from the working tree.

Update a
source-review fingerprint only after reading the affected document and changed inputs,
following the [maintenance procedure](WORKFLOW.md#documentation-maintenance).

## Test conventions

- Phase 1 statistics: `workerPool.test.ts` proves the pooled summary equals `runReplicates`
  at one seed (1, 3 and 7 workers, aleatory and total); `mergeSummaries.test.ts` proves the
  range merge in either order; `sampling.test.ts` proves a range slice equals the same slice
  of the full loop under LHS; `sobol.test.ts` recovers the Ishigami indices inside their
  bootstrap intervals at base 1024; `mc.worker.stages.test.ts` drives the Morris and Sobol
  routes. The parity files are aleatory and do not move under LHS. A fixture that sets a
  half-width target pins `stopCap` when it reads the loop end.
- Phase 4 hypothesis tools, one focused command per lane
  (`npx vitest run --dir src <files>`):
  - Contract: `playback/optimizeTypes.test.ts` (the request, result and message shapes
    and the 60 x 40 defaults).
  - Calibrate: `analysis/calibrate.test.ts` (a hand-computed beta posterior under the
    Jeffreys prior, the normal-gamma time posterior, the family from the provenance unit,
    the override reason) and `panels/settings/CalibrateDialog.test.tsx` (Accept writes
    `useOverrides.setOverride`, Accept disabled while a count is incomplete or
    inconsistent).
  - Optimizer: `playback/optimize/loop.test.ts`, `gp.test.ts`, `polygon.test.ts`,
    `client.test.ts` and `playback/optimize.worker.test.ts` (the real worker completes
    and cancels); `playback/workerGraph.test.ts` keeps `optimize.worker.ts` independent
    of stores, React, panels and browser persistence. The optimizer changes no parity
    fixture; `sensitivity.parity.test.ts`, `estimate.parity.test.ts` and the two verify
    suites stay at their anchors.
  - SQLite: `io/exportSqlite.test.ts` (the file opens in the `sqlite3` CLI with every
    table keyed on `run_id`, a join returns per-target rows for two runs, `sobol` is
    empty, a quantile with too few replicates is NULL).
  - Compare and record: `panels/analysis/screens/CompareScreen.test.tsx` (the saved-run
    comparison), `panels/analysis/RunHistory.test.tsx` (lineage disclosure, the export
    buttons), `io/exportCsv.test.ts` (RFC 4180 quoting, units in headers),
    `io/runExport.test.ts` (the `rangeboardRunRecord: 1` package in
    `io/runRecordPackage.ts` round-trips and a
    debrief export is refused), `charts/exportPng.test.ts` (the PNG pipeline under
    injected canvas and image doubles; `svgMarkup` over a live SVG is covered only by
    the browser check).
  - Placement screen and wiring: `panels/analysis/screens/PlacementScreen.test.tsx`,
    `panels/AnalysisPanel.test.tsx`, `state/store.analysis.test.ts` (`runOptimize`,
    `optimizeMessage`, `cancelOptimize`, `clearOptimize`) and
    `state/scenarioInstall.test.ts` (an install cancels and stales the optimize run).
- Phase 3 contract (slice 3.a): `playback/clock.test.ts` holds the no-request sample times
  equal to the legacy `t += DT` loop bit for bit and a fine window sampled at its step;
  `analysis/parameterBasis.test.ts` pins `FIELDS_BY_KIND` and `hasSpec('c2')`;
  `analysis/uncertainty.test.ts` samples a c2 median and an accuracy field at their own
  nominals and leaves a null nominal null; `model/seedLibrary.test.ts` drops the Phase 3
  keys before the fixture comparison, the way it drops the Phase 2 keys.
- Phase 3 physical models:
  - `playback/flight.test.ts` pins unlimited-path identity, the hand-derived bounded turn,
    acceleration and wind drift; `playback/flight.verify.test.ts` checks the seeded DJI
    Mavic 3 figure.
  - `analysis/rfLink.test.ts`, `analysis/sensorEnv/rf.test.ts` and
    `playback/tracker.test.ts` cover the link budget, signal-to-noise direction finding,
    one-node bearing uncertainty and tighter multi-node geolocation;
    `analysis/rfLink.verify.test.ts` checks RF-360 and ARDRONIS ranges.
  - `analysis/sensorEnv/eoir.test.ts` covers DRI and extinction;
    `analysis/sensorEnv/eoir.verify.test.ts` checks the Spynel-S 6000 detect point and
    records its recognize-ratio mismatch.
  - `playback/radarDwell.test.ts` covers pulse counts and inverse Shnidman evaluation;
    `playback/radarDwell.verify.test.ts` pins three hand-derived integration cases while
    `analysis/radarPd.test.ts` keeps the Marcum-Q values unchanged.
  - `playback/ballistics.test.ts`, `playback/pk.test.ts` and
    `playback/shot.test.ts` cover interceptor miss, projectile compounding, burst timing
    and magazine use; `playback/kinetic.verify.test.ts` checks the APKWS radius table and
    Rheinmetall burst timeline.
  - `playback/directedEnergy.test.ts`, `playback/hpm.test.ts`,
    `playback/pk/beam.test.ts` and `playback/shot.test.ts` cover optical dwell, keyed
    fluence, HPM field/beamwidth and recharge; `playback/pk/beam.verify.test.ts` checks
    the Iron Beam anchor and a hand-derived HPM threshold.
- Phase 2 tracks and kill chain, one file per model, plus the estimate-path parity file:
  - `playback/estimate.parity.test.ts`: both golden fixtures with their physics switches
    removed, so the Kalman estimate, fusion, false tracks and the operator queue run; pins
    the seed-4821 trial per threat (status, first detect, confirm, stable track,
    declaration, gate), the event count, the kill mass, the track count, and the 200
    replicate aleatory end-of-run means (leakers, kills, firm track). The layered event
    count and kill mass are the post-flyout measurement. The three means the flight
    horizon moved are the authorized 2026-09-21 recapture: layered kills 1.115, JIATF
    leakers 0.895, and JIATF kills 0.105. The truth-path parity files still move only
    with a hand-derived replacement.
  - `playback/kalman.test.ts`: the steady-state gain against the closed form of the CWNA
    tracking index, symmetry after 1000 predict and update steps, the coast growing and
    an update lowering the position sigma, and the quality map at 0 and at the scale.
  - `playback/tracker.test.ts`: the truth path on a null accuracy field and under the
    `truthTracks` switch, both consuming no draw; two kind-7 noise draws per measured
    scan keyed by sensor, threat, axis and time; the ellipse shrinking over hits and
    growing over misses; `polarMeasurement` along and across the line of sight; and
    `TrialResult.tracks` on both paths.
  - `playback/fusion.test.ts`: `invert4`, two equal members halving the covariance, the
    information weighting of an unequal pair, the truth member dominating, the
    regularization floor, `delayedMember` over the latency ring and `FC_QUALITY_MIN` as
    the quality of a 50 m position sigma.
  - `playback/classification.test.ts`: band selection, the deterministic declaration at
    `pCorrect > 0.5`, the false-hostile branch and the kind-8 draw keys.
  - `playback/falseTracks.test.ts`: the closed-form rate, the Poisson inversion, a
    convergence check of the mean count per scan, the truth-free state inside the radar
    coverage, the `noFalseTracks` switch and the trial integration.
  - `playback/operator.test.ts` and `playback/attrition.operator.test.ts`: the lognormal
    latency and the linear overload factor with the kind-10 key, then the two decisions
    at the declare and assignment gates on the legacy and doctrine paths, with the
    `noOperatorQueue` switch restoring the baseline timeline.
  - `playback/trackEstimateView.test.ts` and `canvas/layers/TrackLayer.test.tsx`: the
    ellipse eigenpair, horizon censoring, the latest entry per track id, and the dashed
    coast, solid update, marker-only truth and muted false styles. Both read the shared
    history in `playback/__fixtures__/trackEstimateFixture.ts`.
  - Wiring: `playback/sim.test.ts` holds the declaration times of the laydowns with no
    confusion matrix; `playback/intercept.test.ts` and `shot.test.ts` hold `interceptFor`
    equal to `interceptAt` on the truth path and the closed-form intercept on the
    predicted path; `playback/policy.test.ts` holds kinds 7 to 11 apart from every other
    kind; `model/libraryLifecycle.test.ts` holds `adoptSeedFields` and the adoption
    report; `playback/attrition.operator.test.ts` counts floored decisions on a fixture
    that floors and 0 on the deterministic policy; and
    `analysis/fidelity.test.ts` holds which laydown reports each Phase 2 tag.
- The golden fixtures `playback/__fixtures__/detection-outside-rings.json` and
  `layered-acoustic-merops.json` pin the three Phase 2 fallbacks plus `noFlightLimits`,
  `rfBandGate`, `eoirSpanRatio`, `legacyKineticPk` and `legacyBeamPk`. Radar dwell keeps
  its placard calibration, so `singlePulseRadar` is not needed for protected parity.
  Removing a pin changes their numbers; capture a timeline comparison before and after.
- `npm test` scopes discovery to `src/`, excluding ignored historical checkouts such as
  `.claude/plans/`. Bare `npx vitest run` can still discover those copies; use the npm command
  or pass `--dir src` when selecting files. Record the scope with a test count.
- Tests colocate as `*.test.ts` or `*.test.tsx`; Vitest uses Node, without jsdom or
  testing-library. Keep engine, geometry and store logic testable without a DOM.
- Component checks use `renderToStaticMarkup`. Recharts sizes charts in an effect, so
  static markup only proves a wrapper exists. Inspect charts and UI changes in a browser.
- For a zustand store reader, synchronize its server-render snapshot before each render:
  `Object.assign(useStore.getInitialState(), useStore.getState())`.
- Statistical checks name an analytic expectation and assert within three standard errors.
  Sweep entity IDs when touching such a check; draw identity can hide a lucky fixture.
- Before an engine/store/playback refactor, capture the current baseline using fixed IDs,
  seed and settings: deterministic, aleatory MC, total MC and sensitivity. Compare after
  the change with the same harness. Select applicable preserved fixtures under
  [evidence](field-te/evidence/); old numerical captures describe their original commits.
- The sensitivity parity test (`src/playback/sensitivity.parity.test.ts`) runs
  `sensitivityLoop` on the seeded JIATF-401 laydown and holds the leaker swing and paired
  se of every field; `sensitivity.responses.test.ts` holds the definedness of an
  undefined time. The sweep tests are `playback/sweepFactors.test.ts` (one case per
  `applySweepValue` factor and input purity), `playback/mcRun.sweep.test.ts` (row-major
  cells, a one-factor sweep at the scenario value equal to the plain replicate run, a
  stop between cells, budget and grid refusal), `playback/mc.worker.sweep.test.ts` (a
  2 x 2 sweep of 4 replicates that completes and cancels in the real worker) and
  `state/store.sweep.test.ts` (the store action, the shared slot and cancellation). Keep
  them green with the fixed-ID captures; a sweep change must leave every existing MC and
  sensitivity number unchanged.
- Baseline checks are `state/baseline.test.ts` (`validateMcSummary` null to NaN, arrival
  stays null, `buildBaseline` labels, the store actions and the scenario/history
  isolation), the baseline lane of `io/autosave.test.ts` (save, restore, corrupt copy and
  recovery beside the scenario lane; a failed rescue resumes when the next edit can store
  the copy), the overrides retry in that same file, and `io/storageManagement.test.ts` (the
  key and its recovery namespace in the storage readout).
- R5 reuses the retained R4 fixed-ID numerical harness, preserved as
  [numerical-capture.ts.txt](field-te/evidence/r5-sampled-experience-2026-09-08/numerical-capture.ts.txt).
  It captures assessments, deterministic attrition, aleatory MC, total MC and sensitivity
  for the firing and detection-outside-rings fixtures with four replicates. Keep fixture
  IDs, seed and settings fixed. New captures go through `scripts/evidence/capture.mjs`:
  `writeCapture` serializes once, hashes, and records the entry in the folder's
  `manifest.json` `captures` list; an identical repeat becomes a `sameAs` entry instead of
  a second file (`<tag>` in the same folder, or `../<folder>/<tag>` when a sibling capture
  folder already holds the bytes), and anything over 512 KB is stored as `.json.gz`. `compareCapture` hashes
  the new serialization against the manifest rather than reading the stored file. The
  relative TypeScript imports still need a Vitest scratch test under `src/playback/`, which
  imports the helper with the `@ts-expect-error` convention; remove it afterward.
  Preserve dated baseline files.
- Trial adapter checks colocate with `analysis/trialResult.ts`, `trialSeries.ts`,
  `playback/trialTrackState.ts`, `trialSweepAt.ts`, `state/trialSelectors.ts` and
  `useTrialResult.ts`. Store transport tests are in `state/store.trial.test.ts`;
  `io/trialExport.test.ts` covers the separately typed completed-trial export.
- Scratch checks that import TypeScript run as Vitest files under `src/`; remove them
  when finished. Node imports in those files follow the existing `@ts-expect-error`
  convention because the app tsconfig omits Node types. `vite-node` is not installed.

## Browser checks

Run `oxipng -o 4 --strip safe` (Homebrew `oxipng`) on new evidence screenshots before
committing; it is lossless and the 2026-09-16 pass cut the retained PNGs by 29 percent.

- Phase 1 gate checks (`docs/field-te/evidence/p1-gate-2026-09-10/`): the Run tab lists
  every run setting with its default; Run on Prepare with nothing touched finishes on the
  pool with the stop rule and the pool size in the progress line; Fragility under the full
  depth renders the Sobol chart after Morris; 0 page errors.
- Playwright is a devDependency for scripted checks only. It uses its own browser profile,
  so the user's autosave is never touched. Use an isolated context for every check.
- Dev builds expose `window.__store` (the Board zustand hook). Drive real store actions
  through it. Read the action interfaces in `src/state/store.ts` before you build a harness.
- Sampled Play calls `startTrialRun` and waits for preparation; `prepareTrial` prepares
  without playing. Check real-worker equality
  against `runTrial(trial.scenario, trial.manifest)`, cancellation and coexistence with
  MC/sensitivity, and retained identity/completion/observation on Replay. Ordinary Play
  prepares one retained trial; New run clears it and redraws on the next Play. Check that
  canvas, telemetry and charts agree with its ledger through the lesser of cursor and
  observation, and that completed exports retain the same manifest and ledger.
- Inspect state with `window.__store.getState()`; read a
  fresh snapshot after a mutation. Exercise real worker actions; never inject a success
  message to verify worker integration.
- A Coyote under a fully typed route needs a fire-control source (KuRFS or TPQ-53) in the
  kill chain. `completeConnect` types a hand-drawn link when a researched pairing exists,
  so a laydown Giraffe 1X to FAAD C2 to Coyote reaches the status `no-fc-uplink` and fires
  nothing. Add a KuRFS to a Coyote demo laydown.
- The [detection fixture](../src/playback/__fixtures__/detection-outside-rings.json) is
  that laydown with the Mavic 3 spawned 18 km north, outside every ring. The linked
  probe records its historical numerical results; recapture before a parity comparison. Load it through
  `parseAutosave` and `loadScenario`. The
  [probe](field-te/evidence/rf20-detection-2026-09-05/rf20-fixture-probe.mjs.txt) confirms
  it through store actions. Use it for detection and warning-time evidence.
- Before a change to the save shape: build a scenario, read the autosave, strip the new
  fields, write it back, reload, and expect no `rangeboard.scenario.recovered.*` key.
- Handle the `window.confirm` dialog before a script clicks the run reset control with a
  dirty run.
- Each analysis screen has its component tests and one browser check at 1265 px wide
  with the JIATF-401 laydown:

  | Screen | Tests | Browser check |
  | --- | --- | --- |
  | Fragility | `panels/analysis/screens/FragilityScreen.test.tsx`, `charts/SweepMap.test.tsx` | Run a sweep from the screen; the map paints cell by cell as it completes |
  | Now | `panels/analysis/screens/NowScreen.test.tsx` | Play at 30x; the run line, kill chain, bars and sensor rows update with no dropped canvas frame and no scenario input shown |
  | Outcome | `panels/analysis/screens/OutcomeScreen.test.tsx`, `panels/analysis/DebriefRecord.test.tsx`, `panels/analysis/RunHistory.test.tsx`, `io/runStore.test.ts` | A completed run; the tiles render once, the table sorts, the records open in place; Save to history lists the ensemble, the row survives a reload and opens in place |
  | Settings Systems | `panels/settings/SystemsTab.test.tsx`, `state/overrides.test.ts`, `state/trialManifestOverrides.test.ts` | Edit a field with a reason; the override shows beside the source value, `rangeboard.overrides.v1` holds it across a reload, a sampled trial's manifest lists it, reset clears it |
  | Settings Physics | `panels/settings/PhysicsTab.test.tsx` | Toggle two fallbacks, reload and check persistence; inspect the completed trial's Manifest for the switch list and fallback floor; Reset physics clears the list; all six Phase 3 controls describe the active physical model selected when cleared |
  | Compare | `panels/analysis/screens/CompareScreen.test.tsx`, `charts/BandChart.test.tsx`, `analysis/runValidity.test.ts` | A completed run with an ensemble; the band chart, delta table and disagreement finding render |
  | Baseline | `state/baseline.test.ts`, the persistence tests above | Pin, reload, compare against the dashed baseline, clear; the Storage section lists `rangeboard.baseline.v1` |
  | Where to put it | `panels/analysis/screens/PlacementScreen.test.tsx`, `playback/optimize.worker.test.ts` | Pick an objective and one movable system, run with a small budget; the progress line advances and the best-so-far updates; up to five candidates list with intervals; Apply installs a scenario named `(placement N)` and the board shows the moved system; an edit after Apply clears the result |
  | Save and Compare | `panels/analysis/screens/CompareScreen.test.tsx`, `panels/analysis/RunHistory.test.tsx` | Save two runs to history; on Compare pick both as saved runs, the delta table differences the means with no interval on the difference; each history tile opens its Lineage in place |
  | Export | `io/runExport.test.ts`, `io/exportCsv.test.ts`, `io/exportSqlite.test.ts`, `charts/exportPng.test.ts` | From a history tile download JSON, the three CSV tables and the chart PNG (the PNG opens with the computed paint); Import run reads the JSON back and lists it; Export SQLite downloads one file that opens in the `sqlite3` CLI and a join across two runs returns rows |
  | Calibrate | `panels/settings/CalibrateDialog.test.tsx`, `analysis/calibrate.test.ts` | On the Systems tab press Calibrate on a proportion field and on a time field; type counts, the posterior and its interval show before Accept; Accept writes an override whose reason names the prior, observation and posterior, and the override survives a reload |

  `panels/AnalysisPanel.test.tsx` and `panels/analysis/AnalysisNavigation.test.tsx` cover
  the phase-to-screen map and the screen control.
- `scripts/e2e/board-shell.e2e.mjs` is the tracked shell spec (`npm run test:e2e`, a
  `node:test` file). It loads the firing fixture through `parseAutosave` and `loadScenario`
  in the page, then checks phase switching, selection routing, placement, the Escape chain
  and the debrief record against store state. One test checks that the analysis
  screen control follows the phase (Outcome and Compare in Analyze, Now in Execute) and
  that no lens bar renders. Two drawer tests close and reopen the right panel with the
  top-bar button and `]`, check that the camera holds the board center, that a selection
  keeps a closed drawer closed, and that a resize drag past the minimum closes it. Two
  playback-bar tests open and close the engagement strip from the Engagement toggle, check
  the 36 px bar height, the strip position above the bar, the canvas height change and the
  saved open state, and check that the saved state restores on reload. One header test
  checks the 40 px header, the lifecycle tablist and run status inside it, and that no
  phase row renders. The
  debrief check calls
  `startRun`, waits for trial status `ready` or `error`, then calls `completeRun`;
  completion requires a matching ready trial. Start the dev server first.
  CI runs it separately after `npm run check`, `npm run check:silent` and `npm run check:bundle`, installing Chromium
  and managing its own fixed-port Vite process. Locally the browser and built-bundle checks
  remain separate commands; bundle-accounting unit tests are included in `check`.
- The performance-wave browser harness additionally verifies surviving Board/T&E
  autosaves, boundary export/reload, oversized frame and snapshot refusal, and recovery
  listing/download/deletion and startup notices. Its widget render failure probe targets
  the widget frames removed on 2026-09-08 and no longer applies. Only an exact injected
  diagnostic is expected; every other page error fails the harness.

## Harness setup

Start `npm run dev -- --port <port> --strictPort`. Stop only the server you started.

A 1400 by 900 viewport and a 320 px right panel match the preserved checks. Set
`rangeboard.rightpanel.width` to `320` through the context's init script before the page
loads. Capture page errors. Check right-panel overflow and text size against the
[UI contract](ENGINEERING_REFERENCE.md#7-ui-and-rendering-invariants).

## Preserved scripts

These scripts are evidence of a dated run. Adapt and inspect them against current source.

- The [R5 browser harness](field-te/evidence/r5-sampled-experience-2026-09-08/r5-browser.mjs.txt)
  checks sampled Play preparation, shared telemetry and canvas outcomes, horizon
  censoring, Replay identity, New run, member geometry, edit invalidation, error/retry,
  repeated worker cleanup, speed changes and completed-trial export groups. It also
  checks the 320 px panel at 1400 by 900 and the compact 1280 by 800 view. The preserved
  harness restricts its dev-server origin to `http://localhost:5461`; inspect its setup
  before reuse. Its assertions do not establish a passing run without captured output.
- The [wave browser harness](field-te/evidence/wave-c2-c3-e1-2026-09-05/wave-results.js.txt)
  loads the [typed firing fixture](field-te/evidence/onboarding-2026-09-04/firing-scenario.json)
  through `parseAutosave` and `loadScenario` and verifies real-worker results, freshness,
  charts and export. The fixture fires four deterministic events with a routed KuRFS. Its
  spawn-in-ring and unvalidated-model findings limit it to integration checks; it is not
  detection evidence. Measured results remain in Git history as
  `docs/field-te/WAVE_C2_C3_E1_COMPLETION.md`.
- For native file input, image decoding, library import and recovery, use the
  [native import recipe](field-te/evidence/wave-c2-c3-e1-2026-09-05/native-import-recipe.md)
  and the [recovery harness](field-te/evidence/wave-c2-c3-e1-2026-09-05/wave-recovery.js.txt).
