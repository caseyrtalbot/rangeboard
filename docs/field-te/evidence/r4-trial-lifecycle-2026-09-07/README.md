# R4 trial engine and lifecycle, 2026-09-07

Stage R4 of the [playback realism proposal](../playback-realism-plan-2026-09-07.md).
Started on clean `main` at `2512d9cb4a4b5627507196e37c65466a49fc2867` on September 7;
final verification and source review completed September 8. No commit or push performed.
This implements the 17 R4 consumer-matrix rows as internal infrastructure. R5 consumer
migration is unstarted; ordinary Play and visible results retain their existing sources.

## Implemented contracts

- `trial.ts` invokes the existing nominal `monteCarloPolicy` → `assessAllThreats` →
  `resolveEngagements` path. It retains complete assessments and the actual attrition/event
  ledger, with member-targeted effects and all R3 assignment/release/effect metadata.
- Optional detection capture records actual scan attempts, sensor/cue/gate state, and
  admitted member hits, misses and classification. Formation `memberIdx` is recorded
  separately from the existing nearest-first `drawIndex`; no draw key changes. Existing
  assessment intervals retain scan holds and coasts. Continue-jam outcomes are retained
  separately because event `killDelta` does not carry that decision. No display-time draws,
  reconstructed summary trials, parameter-spread sampling or MC history retention.
- `trialTypes.ts` freezes run id, `analysisBasisSignature`, seed, numeric `idHash(runId)`
  replicate index, nominal/aleatory basis and engine/draw compatibility versions. The engine
  revision is `rangeboard-trial-r4-v1`, draw version `counter-fnv1a-fmix32-v1`. Build revision
  is explicitly null; no source commit is falsely claimed for a modified development tree.
  Reproduction requires the captured scenario plus compatible engine and manifest.
- `trialClient.ts` owns a third worker slot. Request token, run id, configuration basis,
  matching manifest and exact slot guard acceptance. Completion, errors, cancellation and
  replacement release the worker immediately. Tests cover unavailable Workers, construction,
  post/decode/native errors, malformed terminal responses and repeated/queued delivery.
- The store retains one detached scenario, manifest and result in its non-persisted `trial`
  slice. `prepareTrial` prepares without starting the clock; internal `startTrialRun` waits
  for success before starting. Rapid starts reuse the pending request. Explicit repeated
  preparation replaces the token while retaining draw identity. Failed trials never fall
  back to forecasts. Pause/scrub/frame navigation cancel automatic start while retaining
  preparation. Material edits, undo/redo, load and reset clear the trial through the existing
  configuration-basis definition; presentation changes preserve it.
- Internal Replay retains run identity, ledger, original completion and achieved observation.
  The cursor returns to zero after completion and narrows the replay prefix. Pause/resume
  and speed changes draw nothing. New run replaces identity and clears trial/observation.
  Scenario schema, autosave, storage keys, history and the deterministic picture are unchanged.

The parent owned store/run state/session, shared documentation and integration. Disjoint
engine and transport lanes owned their leaves and tests. Independent integration review
found no actionable defect; its focused run passed 5 files / 61 tests.

## Numerical verification

The preserved R0/R3 fixed-ID harness ran on Node 22.23.1 before and after changes, capturing
both firing and outside-detection fixtures with seed 4821 and four replicates. It includes
deterministic assessments/report, aleatory MC, total MC and sensitivity.

- [Before](numerical-before.json) and [after](numerical-after.json) are byte-identical:
  **no fields excluded**, including all R3 release metadata.
- They also exactly match the preserved R3 Node 22 after capture.
- [Parity record](numerical-parity.json) records hashes, byte count and comparison scope.
  [Harness](numerical-capture.ts.txt) preserves the original before-capture output path;
  choose a fresh filename when rerunning. The scratch source test was removed.
- [Current-source tests](source-tests.txt): **128 files / 1658 tests passed**.
- Schema regeneration changed no descriptor; typecheck passed. Final `npm run check`
  passed: **229 files / 3073 tests** in broad discovery (includes ignored checkouts),
  lint and production build passed. See [complete gate](check.txt). Built bundle budgets
  passed: entry 241575 bytes, initial JavaScript + CSS 389761 bytes (gzip -9).

## Browser verification

Real isolated Chromium used owned port 5454 and Node 22.23.1. The user's origin and port
5174 were untouched. [Browser results](browser/r4-browser.json) record 15 checks, timestamps,
worker construction/termination audit and zero page/console errors. The retained
[scenario and trial](browser/retained-trial.json) exactly match a direct invocation of
`runTrial` under its manifest. Scripts are [main](r4-browser.mjs.txt) and
[settled compact capture](r4-compact.mjs.txt).

Verified ordinary Play at 1x/5x leaves trial idle and constructs no trial worker. The
1400×900/320 px panel [screenshot](browser/ordinary-play.png) retains the forecast labels.
Internal opt-in played through completion, then replayed at 1x/5x with the same ledger,
completion timestamp and achieved observation. Trial cancellation allowed real MC and
sensitivity to finish; canceling those analyses left trial preparation intact.
Reset/edit/undo/redo/load during preparation rejected the obsolete result. Repeated
requests and presentation edits prepared successfully. Reload returned to ready with no trial.

Thirty new trials had 30 unique identities and no live trial worker after each completion.
Harness-observed preparation round trips were 25–41 ms (mean 32.17 ms), including polling
and browser protocol overhead. These are not pure engine timings or production startup
performance measurements. Only one current scenario/result is retained by the application.

The initial compact screenshot caught a lazy-loading transition. The follow-up waited for
Execute selection and its ready-state text before capturing
[settled 1280×800 reduced-motion Execute](browser/ordinary-ready-compact-settled.png).
[Settled state](browser/compact-settled.json) confirms trial idle and no panel overflow.
The original transitional screenshot remains as captured and is not visual acceptance evidence.

## R5 integration boundary and stop point

No UI calls `prepareTrial` or `startTrialRun` in R4. Internal opt-in is for lifecycle
verification only: existing canvas, detections, series, readouts and exports continue using
their current sources, so this does not establish sampled display agreement.

R5 must migrate all 46 R5 matrix rows together: result selection and trial adapters;
canvas/sweep/track/member state; widgets, telemetry, series and event strip; run controls
and preparation/error/replay labels; debrief and separately typed trial export. It must
use captured scan outcomes plus holds/coasts and member-targeted effects, preserve forecast
and ensemble semantics, and explicitly handle missing build provenance. Keep ordinary Play
unchanged until the sampled end-to-end browser/export/performance checks pass.

No production performance target, sampled UI correctness, trial export/import, or release
readiness is claimed here. R1 disabled-asset definedness and R2 visible horizon captions
remain separate follow-ups. The unrelated central handoff and all R0–R3 evidence bytes
are unchanged. Stop before R5 and before commit/push.
