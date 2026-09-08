# Playback realism implementation proposal

Captured 2026-09-07 against `main` at `5076ecc16edb7bfa6c1260d1d82ff7fb1dad88d9`.
Status: implementation plan prepared; no application changes started. This dated proposal
records the requested scope. It does not replace current implementation documentation or
the separate performance-refactor handoff in `docs/HANDOFF.md`.

## 1. Outcome and boundaries

Keep the workflow Prepare → Play → Analyze. Execute depicts one reproducible simulated
trial, with only events reached in playback. Analyze separates that trial from the
deterministic forecast and Monte Carlo estimates. Add no required setup fields or dialogs.

Correct presentation first, then introduce sampled playback as one integrated release.
Preserve the existing physics, Pk functions, doctrine, sensor models, engine time step,
common-random-number draw keys, deterministic forecasts and Monte Carlo statistics.
Sampling changes the realization shown, not the validation status of the model.

Out of scope: new aerodynamic/seeker models, acceleration curves, debris, simulated range
instrumentation, operator/BDA error models, terrain/weather research, tactical optimization,
T&E Ops lifecycle changes, scenario-library Wave 6, authentication and deployment.
This is an execution display, not a new fog-of-war or blind operator-training product.

## 2. Evidence and corrections to the initial recommendation

Verified in the preceding review of localhost:5174:

- RUN-0004 was in deterministic mode at T+302.5 s of approximately 366 s. It showed
  95.2 percent expected defeat, 4.8 percent residual survival, three kinetic salvos and
  first effect at T+1:43. These are UI observations, not an archived numerical fixture.
- Planning was selected and hid flyouts. Engagement at T+1:13 visibly showed an interceptor.
- The validity panel flagged a threat starting inside detection coverage and no defended
  asset. Neither condition should be silently repaired: both can be intentional test setups.
- Focused source tests passed: five files, 103 tests. The command was
  `npx vitest run --dir src src/playback/intercept.test.ts src/playback/trackState.test.ts src/analysis/series.test.ts src/panels/analysis/widgets/KpiTilesWidget.test.tsx src/panels/analysis/widgets/ProjectionWidget.test.tsx`.
  No full application gate or full audit was claimed for that review.

Current source confirms:

| Finding | Source and consequence |
| --- | --- |
| Full-run results exist before playback | `src/analysis/series.ts`, `src/analysis/impact.ts`; censor presentation, not engine computation. |
| Canvas remains deterministic even with MC | `src/canvas/CanvasStage.tsx`, `src/panels/analysis/widgets/controls.tsx`; a sampled run requires an explicit shared result source. |
| MC keeps statistics, not an individual ledger | `src/playback/mcRun.ts`; retain one trial directly, never reconstruct it from means or bands. |
| Live sensor hits have a separate deterministic path | `src/playback/sweepAt.ts` calls `detectionsAt`; replacing the attrition report alone would mix bases. |
| Animation starts too early | `src/playback/trackState.ts` interpolates assignment-to-effect; `src/playback/intercept.ts` starts physical flight after `engageTimeS`. |
| Export time wording is inconsistent | `src/io/runResultGroups.ts` calls `events.tS` release time, while `src/playback/attritionReport.ts` defines assignment time. Correct the metadata with the timing slice. |
| A fractional expected kill rounds to a whole kill | `src/panels/analysis/widgets/KpiTilesWidget.tsx` uses one decimal; `src/playback/trackState.ts` labels the below-5-percent residual state DEFEATED. |
| Replay currently can create a new run | `src/playback/runSession.ts` resets after completion; sampled playback must explicitly change that lifecycle. |
| Playback is not persisted | `src/state/runState.ts`; retain this boundary and make export provenance explicit. |

Do not add an invented “effect assessed” delay or “confirmed kill” state. Render the modeled
effect time; preserve existing BDA doctrine where it already controls subsequent firing.
Do not change the engine's expected-dead targeting cutoff merely to improve a display label.

## 3. Product contract

### Prepare and readiness

Reuse `BoardPreparation` and `assessRunValidity`. Show a compact, actionable summary of
consequential findings with the existing details disclosure. A spawn-in-coverage finding
selects the affected threat/path. A missing-asset finding opens existing asset placement.
Do not move objects, place an asset, invent thresholds or require acknowledgement to Play.
Wording explains the lost measurement, such as “First detection not assessed: starts in coverage.”

### Execute visibility

All outcome data uses a single execution horizon: no events before first Play; subsequently
no events later than `min(cursor, observedThroughS)`. Scrubbing never advances observation.
Forward scrubs and saved-frame navigation retain existing geometry-preview behavior but do
not expose future outcomes. Returning from Analyze must apply the Execute horizon again.

Apply this to graph values, bands, y-axis domains, tooltips, legends with numeric summaries,
event strips, engagement windows, threat outcomes, selected-object telemetry, impact warnings,
accessibility text and custom layouts. Configuration geometry and known paths may remain;
forecasted arrival/CPA times belong in explicitly identified planning details, not event history.
Future-sensitive widgets become a compact “Forecast available in Analyze” entry in Execute.
Do not delete, reorder or overwrite the user's saved widget configuration.

Use phase-local effective layer visibility. Execute defaults to engagement visibility with
coverage subdued, and allows explicit user overrides for that phase. Prepare retains the
saved planning view; phase navigation alone writes no scenario/history change and does not
overwrite persisted global layer preferences. Reuse the existing declutter controls.

### Results and controls

- Forecast: label fractional outcomes “Expected kills” or “Expected neutralization,” retain
  two decimals for small expected counts, and show residual survival. A forecast below the
  engine's residual cutoff is not labeled a confirmed or realized defeat.
- No active asset: label the forecast metric “Expected neutralization”; asset protection,
  warning and leakage stay unavailable. With an asset, preserve pre-arrival defeat versus
  late destruction. Do not redefine existing numerical measures through wording changes.
- Trial: show realized integer member counts and modeled hit/miss or mission-kill events.
  A missed shot leaves the threat active. A hard-killed member stops at its effect position;
  one killed formation member does not remove surviving members. Keep committed rounds visible
  through their effect. Soft mission kills get an appropriate state without inventing return
  or drift trajectories that the motion model does not simulate.
- Play starts or resumes the current trial. After completion it becomes Replay, returning
  to T0 with the same identity and event record. Pause, speed changes, scrub, phase changes
  and display preferences never draw again. New run replaces the trial identity and draws
  another trial; another draw may legitimately produce the same outcome.
- Analyze presents completed trial results first, then separately labeled Forecast and
  Monte Carlo estimates. Before completion, trial results stop at the observed horizon;
  users may deliberately inspect a full deterministic forecast there. Never silently
  display the unobserved sampled future as a forecast.

## 4. Technical design

### One trial result, existing numerical engine

Introduce a pure worker-safe single-trial entry point, proposed `src/playback/trial.ts`.
Use `monteCarloPolicy(seed, replicateIndex, thresholds)` with the existing
`assessAllThreats` → `resolveEngagements` path. Begin with nominal parameters and aleatory
draws only. Parameter spreads remain in the existing total-uncertainty analysis; do not
silently couple the visible trial to changing MC settings or completion order.

Capture a trial manifest containing run id, configuration basis, seed, replicate index,
nominal/aleatory basis, draw-policy version and engine/build revision. Derive the index
once from the run id using the existing stable id hash and store the actual numeric value.
No new random source or draw kind is needed. Reproduction requires the captured scenario,
manifest and compatible engine revision, not merely a human RUN number.

Retain assessments, the event/attrition ledger and enough per-sensor/member observation
history to render sampled detections consistently. Prefer existing assessment observations;
where they omit admitted scan outcomes, capture the existing draw decisions during the sweep.
Do not add fresh display-time draws or substitute deterministic `detectionsAt` results.
Keep per-member outcomes available for formation rendering; do not recover them from a
group mean. Bound storage to the current trial and compact histories; do not keep MC ledgers.

Keep deterministic `engagementPicture` and its cache unchanged. A separate trial-result
adapter supplies the canvas, execution widgets, telemetry, event strip and completed trial
debrief. Existing forecast and requirement consumers explicitly continue using the envelope.
Every series and exported result group declares its own basis, horizon and denominator.
Do not apply the current deterministic requirement report to a sampled trial and call it a
trial verdict; forecast requirement gates retain their existing, clearly labeled semantics.

### Lifecycle and concurrency

Use a dedicated trial worker/client slot, following existing worker graph and stale-callback
rules. It must not replace or cancel the MC or sensitivity slot. Proposed modules are
`trial.worker.ts` and `trialClient.ts`, with typed worker messages in a store-free leaf.
The deterministic forecast stays on its current main-thread path.

At first Play, freeze the manifest, prepare the trial, then start the clock only when the
matching result is ready. Show an inline preparing state only while needed. Keep worker
construction/render computation outside reducers and preserve the store's forbidden-import
boundary. Cancellation may terminate this one-trial worker immediately; ignore every late
progress/error/result after reset, configuration change, load or replacement request.
Key acceptance by request token, run id and analysis basis, including repeated requests
within one run. A failed trial never falls back silently to the deterministic forecast.

Material scenario edits invalidate the trial, including undo/redo; presentation edits do not.
Reuse `analysisBasisSignature`, not object cloning or a second definition of material inputs.
Replay preserves the original completion record and achieved observation horizon while
cursor-scoped Execute renders only its replay prefix. New run clears both. Reload retains
the existing ready-state behavior; do not introduce playback autosave or a run archive.

Existing `Scenario.runMode`, seed and MC settings retain their saved meanings for forecasts
and ensemble analysis. Relocate their UI description to forecast/analysis settings so a
DET label never describes a sampled scene. No new required persisted scenario field.

### Assignment, release and effect

Preserve `events.tS` as assignment time and all current magazine/cooldown accounting. Add an
explicit physical release time to newly produced engagement records, equal to assignment
plus resolved engagement delay; propagate it to `ShotRecord`/`ShotInFlight`. Interpolate a
kinetic round only from release to effect. During preparation show launcher status, not a
moving round. Distinguish beam/dwell channels from kinetic flight and handle zero-flight
and zero-duration intervals without division by zero or fabricated travel.

Legacy records without release time must still load where supported. Reconstruct only
when the captured scenario provides the resolved delay; otherwise disclose unavailable
launch timing. Never silently declare assignment to be a known physical launch time.
Adding timing metadata must leave assignment/effect times and existing outcomes unchanged.

### Export and provenance

Extend the existing completed-run package additively with a separately typed simulated-trial
group and manifest. Keep existing forecast/MC groups and schema-1 scenario compatibility.
Retain the scenario snapshot, trial events, observations and realized counts needed to audit
the scene. Include the authoritative assignment/release/effect definitions and undefined
asset metrics. Identify missing build provenance explicitly in a development build.
One trial has no ensemble confidence interval and is not an independently observed T&E trial.
No new run-import UI or automatic write into T&E Ops is included.

## 5. Implementation stages and ownership

Execute sequentially with one integrator owning shared types, store, schema, exports and
documentation. No agent dispatch is required by this plan. If delegation is later requested,
assign disjoint paths and integrate at each stage; do not parallelize shared consumer migration.

| Stage | Owned responsibility and source entry points | Exit evidence |
| --- | --- | --- |
| R0 — Baseline | Read-only inventory; fixed-ID fixtures and before captures under a dated evidence directory. Map every forecast/trial consumer using `impact.ts`, `sweepAt.ts`, analysis widgets, `EngagementStrip.tsx`, `persist.ts`. | Consumer matrix, reproducible fixture, numerical baseline, browser baseline and measured startup/playback cost. No product edits. |
| R1 — Honest readouts and setup | `BoardPreparation.tsx`, run-validity/Projection/KPI widgets, `ThreatPicture.tsx`, `threatReadout.ts`, `TrackFileReadout.tsx`, relevant tests. Reuse existing resolvers and styles. | 0.952 never looks like one realized kill; no-asset protection stays undefined; actionable findings preserve laydown and validity; targeting cutoff unchanged. |
| R2 — Execution scope and layers | `AnalysisPanel.tsx`, widget registry/controls, chart adapters, `EngagementStrip.tsx`, relevant selected-object/readout and WEZ consumers, phase/layer view state. | All Execute surfaces obey the horizon, including custom layouts and accessibility text; explicit Analyze forecasts remain available; saved views survive round trips. |
| R3 — Physical launch timing | `attritionReport.ts`, `attrition.ts`, `trackState.ts`, `EngagementLayer.tsx`, effector display states, `runResultGroups.ts`, export consumers and tests. | Positive engagement delay produces no early round; physical travel starts at release; beams work; previous numerical fields are identical and metadata is accurate. |
| R4 — Trial engine and lifecycle | New trial runner/client/worker leaves; minimal detection-history capture; `runState.ts`, `store.ts`, `runSession.ts`, worker/schema tests. | Fixed-seed ledger matches the existing policy path; preparation/cancel/stale-result/replay contracts pass. Infrastructure is not made the default until R5 passes. |
| R5 — Integrated sampled experience | One integrator migrates `CanvasStage.tsx`, `LiveScene.tsx`, sweep/readouts, widgets, event strip, run controls, debrief, `persist.ts` and result groups together. | A single trial identity explains every display and export; per-member outcomes agree; sampled Play becomes default only with end-to-end checks green. |

R1–R3 may ship independently because they correct the existing deterministic presentation.
R4 and R5 form one user-facing release: no mixed deterministic/sampled intermediate state.
Each stage updates affected current references and source-review fingerprints after its
behavior is implemented. Do not describe proposed behavior as current in those references.
Keep the unrelated central handoff unchanged. A temporary continuation packet selects only
the next bounded task and points here; it does not duplicate the plan.

## 6. Verification and release gate

R0 captures deterministic, aleatory MC, total MC and sensitivity results with fixed ids and
seeds, using preserved fixtures and the repository verification guide. Preserve old capture
bytes. Record current-source test counts separately from ignored historical checkouts.
Do not claim an exact reproduction of RUN-0004 without its original scenario snapshot.

For source changes run focused tests, then `npm run check`. Use `--dir src` for focused Vitest
runs. Run schema generation/checks for type changes. UI changes require actual browser
inspection in an isolated profile; never reset or replace the user's localhost autosave.
Run the tracked shell browser spec and bundle check at the integrated release.

Required acceptance cases:

1. No path, no asset, starts-in-coverage, no fire-control route and zero threats remain
   explicit undefined/invalid cases. A green effect result does not erase gate findings.
2. A fixed-id positive-delay intercept shows assignment, preparation, release, travel and
   effect at their respective times. Cover stationary/moving targets, late effects, beams,
   missed shots, simultaneous shots and committed rounds after target destruction.
3. A formation with mixed member outcomes retains survivors and does not move killed members
   along the remaining path. Soft mission kill and hard destruction remain distinct.
4. No unreached outcome appears through any built-in lens, saved/custom layout, tooltip,
   axis scaling, strip, selected object, impact warning or accessibility label in Execute.
   Cover ready, pause, backward/forward scrub, frame navigation and Analyze/Execute switching.
5. Same manifest and engine revision yield identical trial events and counts. Replay,
   speed changes, pause and phase navigation leave them unchanged. New run changes draw
   identity; tests must not require every new draw to produce a different outcome.
6. One fixed trial's shot, detection, effect and leakage events agree across canvas state,
   series, counters, debrief and exported JSON. Sampled sensor hits must agree with the
   sampled track history, not the deterministic detection envelope.
7. Configuration edit, undo/redo, load, reset, rapid double Play, trial error and stale
   worker delivery cannot attach an old trial to a new basis. MC/sensitivity completion
   or cancellation cannot replace the trial. No React/store imports enter worker graphs.
8. Preserve legacy scenario loads, recovery copies and storage keys. Export round-trip
   serialization preserves trial manifest/events and all existing groups and undefinedness.
   Recompute a captured trial under the recorded engine version and compare its ledger.
9. Existing deterministic/MC/sensitivity numerical outputs remain equal to R0, excluding
   explicitly added metadata. Sampled results match direct invocation of the existing
   draw-policy pipeline; do not compare sampled counts to deterministic expected values.
10. Inspect at 1400×900/320 px panel and 1280×800, including 1× and 5× actual playback,
    keyboard operation, disclosure overflow and reduced-motion behavior. No new mandatory
    field, modal, hidden-layer prerequisite or per-frame engine sweep.

Record paired dev/production performance against the same R0 fixture and environment.
Require no new main-thread Play task above 40 ms, no engine computation per animation frame,
no accumulating trial workers/results across 30 new runs, and compliance with existing
bundle budgets. Report preparation latency separately from playback cost. Investigate a
repeatable regression above 10 percent against paired baseline; do not replace missed
performance targets with an unqualified pass.

Completion requires the integrated numerical, lifecycle, browser, export, documentation and
bundle checks; all six requested corrections must be demonstrated. Commit, push, merge and
deployment remain separate actions governed by user authorization.

## 7. First implementation task and stop point

Next task is R0 only: establish a reproducible baseline and complete the consumer matrix.
Start by checking the branch/worktree against the captured head and reading
`docs/VERIFICATION.md`. Preserve unrelated edits. Create no trial runner and make no UI change
in R0. The original run's observed behavior is already reviewed; capture a controlled fixture
rather than repeating exploratory UI work on the user's saved run.

At R0 completion, report exact fixture/capture paths, checks, current-source counts, ownership
for R1 and unresolved evidence gaps. Update the temporary continuation packet to R1 only.
Stop before R1 when working from that bounded packet. Executing the full plan requires a
task that selects the full staged implementation; this planning request has not started it.
