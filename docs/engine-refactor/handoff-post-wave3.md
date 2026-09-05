# Handoff: engine refactor complete, wave 3 committed and pushed

> Status (2026-09-04): HISTORICAL HANDOFF, as of `e55aa86`. Superseded by
> `docs/AI_HANDOFF.md`. The R-F-20 trace that followed this file is in `outstanding.md`
> (R-F-20 status cell) and `docs/AI_HANDOFF.md` section 12.

Written 2026-09-04 by the wave 3 orchestrator (session 64a02f7b). It replaces
`handoff-wave3.md`. Read this, then `docs/engine-refactor/PLAN.md` (sections 5, 6, 10, 11),
`docs/data-engine/handoff-orchestrator.md` (the protocol, the browser recipe, the lessons) and
`docs/data-engine/outstanding.md` rows R-D-1 to R-D-24, R-F-1 to R-F-23 and M-9. Do not
duplicate them here.

## Where things stand

| | |
| --- | --- |
| Repo | `/Users/caseytalbot/Projects/rangeboard`, branch `analysis-hardening` |
| Head | `e55aa86` (wave 3) on `2d27e32` (wave 2) on `eff6ecc` on `965a62b` on `8f70566`, all 2026-09-04. Pushed on 2026-09-04; `git log origin/analysis-hardening..HEAD` is 0. |
| Tree | Clean. The planning docs were committed on 2026-09-04 after this file was written (see `docs/AI_HANDOFF.md` section 2.3). |
| Final gate at `e55aa86` | `npx tsc --noEmit -p tsconfig.app.json` clean; `npx vitest run` 1202 tests in 69 files; `npm run lint` 74 warnings (baseline 74); `npm run build` clean, main 1,981.57 kB / 572.08 kB gzip, worker 287.24 kB, CSS 75.42 kB. Browser checks C1 to C8 and F1 to F6 pass. |
| MC timing | Scenario B, 100 replicates in the worker, median of three: base `2d27e32` 662 ms, wave 3 aleatory 666 ms, wave 3 total 686 ms (R-D-24). Sensitivity under total: A 11 fields 1.9 s, B 14 fields 9.3 s. |
| Plan | PLAN section 11 had three waves; wave 3 was the last. Every slice 0 to 7 is built. Nothing in PLAN.md is left. |
| Next | On the user's word only. Candidates, in the order the rows suggest: the user's accept-or-overrule pass over R-D-21 to R-D-24; R-F-20 (no browser laydown fires); the seed cleanup pass (R-F-3, R-F-6, R-F-16, one Opus high apply agent from a fixed contract, R-F-4 stays with the user); R-F-22 (Sources table at 320 px). |

## What wave 3 built (facts a follow-on needs)

- `src/model/types.ts`: `UncertaintyMode`, `Scenario.uncertainty` (default `aleatory` in
  `emptyScenario()`), `runSettings().uncertainty`; `Spread` beta has `pseudo?: true` (the PF
  table beta; a row beta has no flag). No schema bump.
- `src/playback/policy.ts`: `DrawPolicy.param(modelId, field)` (line 41), deterministic 0.5
  (62), MC `u(DRAW_KIND.param, modelId, h(field), 0, 0)` (96). `kill`'s `salvoIdx` is the
  salvo count at that (effector, threat, ship).
- `src/playback/mcRun.ts`: the loop samples at line 319 (`const s = total ? sampleScenario(...)
  : scenario`); `endLeakerMean` (427, private, no bands); `runSensitivity` (459);
  `McRequest` (134), `McSensitivityMessage` (143: `sens-progress`, `sens-done`, `sens-error`),
  `SensitivityRow` (149), `SensitivitySummary` (164, carries `nominal`). `mcRun.test.ts` holds
  the total-mode tests, the ranking and pairing tests (fixed literal ids, K = 40 seed pairs)
  and the kill-key CRN test (a Mohajer-6 at (0, -2500), 1000 ft, 15 m/s engaged first).
- `src/analysis/uncertainty.ts`: `modelsInUse` (93, private: models an `entityActive` entity
  references); `uncertainFields` (107) and `sampleScenario` (319) cover those models only; the
  sampler may return null to keep a field nominal; `sampleSpread` (235) clamps u to
  [2^-32, 1 - 2^-32] and samples a row beta under a Jeffreys prior; `isTableSpread` reads
  `pseudo`.
- `src/playback/attrition.ts`: `salvoCounts` map in `resolveEngagements` (796), read in
  `commitSalvo` (896) keyed `effectorId:uasId:shipIdx`.
- `src/analysis/sensorEnv.ts`: `EL_EPS_DEG = 0.001` (417, PF) at both elevation edges; the
  Blighter sweep fixture in `validation.verify.test.ts` flies at `MOUNT_HEIGHT_M / FT_TO_M`.
- `src/state/store.ts`: `SensitivityState` (262, not exported), `IDLE_SENSITIVITY` (274),
  `McState.sensitivity`, `runSensitivity` (2167, early return under deterministic, `total` 0
  until the first progress message), `sensitivityMessage` (2190), `mcForScenarioChange` (692)
  stales each side on its own signature. `mcClient.ts` `startSensitivity` (47) and
  `cancelSensitivity` (63) on a second worker slot; `mc.worker.ts` dispatches on `type`.
- Panels: `SensitivityWidget.tsx` (type `sensitivity`, `th-sensitivity` and `sos-sensitivity`
  in `analysisLayout.ts` 184 and 173; reads the summary of the run id on the playhead;
  buttons `Run sensitivity` and `Run again`, class `mc-run`); `currentSensitivity`
  (`widgets/mc.ts` 18); `spreadText` (`src/panels/inspector/spreadText.ts`, a leaf so
  `kit.tsx` keeps its lint count); `PfTag` title appends ` · spread <text>` or ` · pinned`;
  Sources table column `Spread` (`±3 dB`, `2 of 2 trials`, `pinned`, `none`; the cell wraps at
  its spaces); popover `Seg` with `data-role="uncertainty"`; chip `MC 100 · total · seed 4821`
  and meta `estimate · 100 replicates · total`. `Tornado.tsx` gutter 110 px, tag at x 76,
  12-character label budget.
- `src/io/persist.ts`: `RunExport.dataBasis.uncertainty`, `sampledFields` (281, under Monte
  Carlo total), `sensitivity` (283); `runExportObject(..., mc, sensitivity)`; `DebriefRecord`
  passes `currentSensitivity(mc, runId)`. `fidelity.ts` reports `parameter-spread` under total
  (229).
- Seed: `pk` rows on `lib-leonidas` (1984, 61 of 61) and `lib-stinger` (2387, 2 of 2), basis
  `pf`, value 0.7 kept, url of the trial count; `seedLibrary.test.ts` allows a url on a pf row
  that carries a spread. (`lib-dronehunter` 2527 is a wave 1 datasheet pk row.)
- The wave 3 working files (contract, briefs, owner reports, gate reports, screenshots)
  lived in a session scratchpad outside the repo. They are not available. The commit
  message of `e55aa86` and the rows in `outstanding.md` hold what they concluded.

## Open defect the next session should read first

R-F-20: no browser laydown fires. Scenario A, Scenario B and three hand-built one-threat
laydowns (asset, Giraffe 1X, Coyote, FAAD C2, Mavic 3 or Mohajer-6 inbound) give `salvos.mean`
0 and `kills.mean` 0 in every replicate; the tiles read `Track now 0/1`, `Engaged 0/1` at
T+200. The base tree gives the same kill mean 0 on B (R-D-20), so this predates wave 3. The
engine fixtures fire (the ranking test's pk swing is 0.25 on a hand-built laydown with a
planning-basis radar). Suspects to check first: the Giraffe 1X `elevationDeg [0, 70]` against
a threat overhead, the M-of-N firm-track gate under the doctrine, and the Coyote's
`pkCommit` ring against the path geometry. Until a browser laydown fires, every browser
tornado is all zero and the sensitivity widget cannot be demonstrated from the seed scenarios.

## Lessons from wave 3

- Phase 0 by the orchestrator (the shared types, the message unions, the run-settings field)
  let three owners build in one phase with no cross-owner tsc error but the one predicted
  (`runSensitivity` in the worker until the engine owner landed it).
- A new interface member breaks hand-built fixtures in files nobody owns (`sim.test.ts`'s
  policy literal, the widget catalog count in `AnalysisPanel.test.tsx`); rule on them by
  message inside the phase.
- The correctness reviewer swept a statistical assertion over 30 entity-id offsets and found
  a test that passed 25 of 30 by the ids it happened to get; the fix was fixed literal ids
  plus a K-sample assertion with a stated failure probability. Ask for the sweep.
- The browser agent's whole-library count (194 fields, 128 s) found a cost defect no unit
  test could; the design agent read the gutter tag at 14 px. Both were fixed in-session and
  by the engine owner still holding context, with the source edits held until the browser
  check ended.
- Keep the engine owner alive through the gate: two fix rounds by `SendMessage` were faster
  than new agents and needed no re-briefing.
