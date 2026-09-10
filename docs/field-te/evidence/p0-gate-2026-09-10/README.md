# Phase 0 gate evidence, 2026-09-10

Dated capture for the Phase 0 (data foundation) gate of the
[calibration implementation plan](../../../IMPLEMENTATION_PLAN.md). Measurements describe
the tree at the gate commit on `main`, not the current tree.

## Files

| File | Content |
| --- | --- |
| `check.txt` | `npm run check` output at the gate: docs, docs tests, bundle tests, library check, typecheck, schema check, 148 test files and 1757 tests, lint, build |
| `p0-gate.mjs.txt` | The Playwright harness of the orchestrator's browser check (scratch copy, port 5391) |
| `1-systems-override.png` | Settings, Systems tab: KuRFS `detectRangeM` overridden to 3200 m with a reason |
| `2-history-saved.png` | Analyze, Outcome: one saved run in the history list after Save to history |
| `3-history-after-reload.png` | After a page reload: the saved run reopened in place with its tiles |

## Orchestrator browser check (firing scenario fixture, 1400 by 900, right panel 320 px)

1. Systems tab lists 5 systems in use. Edit `detectRangeM` on KuRFS to 3200 with the
   reason `gate check 2026-09-10`; the row shows the override beside the source value.
2. `startTrialRun()` reaches `ready`; `trial.manifest.overrides` holds the one override
   with model id, field, value, reason and ISO date.
3. `runMonteCarlo()` with 4 replicates; Save to history lists one record.
4. Reload: `rangeboard.overrides.v1` still holds the override; the history row is still
   listed and opens in place with 4 tiles.
5. Reset every override: the key holds an empty list. Page errors: 0.

## Lane browser checks (reported by the lane workers, screenshots kept outside the repo)

- Lane 0.3 (port 5381): Systems tab edit, `localStorage` write, reload, reset; 0 page errors.
- Lane 0.4 (port 5382): Monte Carlo run, Save to history, reload, open in place; 0 page errors.

## Defect found and fixed at integration

Before the fix, every sampled trial in the browser ended in `Invalid trial result
response`: the trial client compared manifests key by key with identity, and the new
array-valued manifest keys never match across a structured clone from the worker. The
unit tests never saw it because the controlled worker returns the same object. The fix
is a value comparison on the array keys in five places (`trialClient.ts`,
`analysisRequests.ts`, `trialResult.ts`, `trialSelectors.ts`, `trialTypes.ts`) and a
test that sends a structured clone through the client.
