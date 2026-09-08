# R1 honest readouts and setup, 2026-09-07

Stage R1 of the [playback realism proposal](../playback-realism-plan-2026-09-07.md).
Before captures ran on `main` at `8f018be` from a detached worktree. After captures ran on
the R1 working tree. Same fixture as R0: the onboarding firing scenario, one Mavic 3 against
KuRFS and Coyote with an audit asset. Playwright headless Chromium, 1400 by 900, right panel
320 px, isolated context on owned ports 5411 and 5412. Port 5174 and the user's autosave
were not touched. Script preserved as `r1-capture.mjs.txt`; text and store state in each
`r1-capture.json`.

## What changed

| Surface | Before | After |
| --- | --- | --- |
| KPI tile at scrub end, expected kills 0.9600 | `Kill E[k] 1.0` | `Expected kills 0.96` |
| Selected threat pill below the residual cutoff | `DEFEATED` | `EXPECTED DEFEAT` |
| Selected threat ghost line | `DEFEATED track at T+6:18 by hard kill.` | `Expected residual below cutoff at T+6:18 (hard-kill effects). Motion continues along the planned path.` |
| Projection defeat metric | `Defeat 96.0% · 1.0 of 1 ships` | `Expected kills 96.0% · 0.96 of 1 ships` |
| Projection leakers metric | `Leakers 4.0%` | `Residual survival 4.0%` |
| Spawn-in-coverage finding | `Flight paths start inside a detect ring (detected at T0): ... held by ...` | `First detection not assessed: <name> starts inside detection coverage.` plus a `Select <name>` button |
| No-asset finding | `... no track has an arrival time.` | `No defended asset is placed. Warning time, arrival and leakage are not measurable.` |
| Prepare run validity | Findings only inside the disclosure | Invalidating and limiting setup findings listed first, model caveats stay in the disclosure |

The no-asset forecast label reads `Expected neutralization` and the residual, leakage and
warning metrics read as unavailable with the reason. The signal is the engine's own
`reportedLeakers == null`, not a second definition of "asset placed".

## Checks

- `npx vitest run --dir src`: 109 files, 1471 tests passed.
- Numerical parity: the R0 probe re-run on the R1 tree is byte-identical to
  `../r0-playback-realism-2026-09-07/numerical-baseline.json`.
- `npm run typecheck` and `npm run lint` exit 0 (63 pre-existing lint warnings).
- Both browser captures ended with no page errors and no console errors.

## Limits and follow-ups

- A disabled asset still counts as placed in the engine (`src/playback/sim.ts` filters
  assets without `entityActive`), while run validity reports "No defended asset is placed".
  The `prepare-no-asset` and `execute-no-asset-scrub-end` captures show that split: the
  finding appears, and the forecast still reports leakage and warning against the disabled
  asset. Not changed in R1; it is an engine definedness question for a later stage.
- A missing-asset finding has no "place asset" button. Placement is armed through local
  App state and the Palette, with no store action to reuse.
- Horizon leaks at a forward scrub remain as recorded in R0; R2 owns them.
- The Prepare screenshots show the panel above the fold; the validity text is in the JSON.
