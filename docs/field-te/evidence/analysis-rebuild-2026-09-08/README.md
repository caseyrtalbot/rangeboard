# Analysis rebuild evidence, 2026-09-08

Completion evidence for the [analysis rebuild plan](../analysis-rebuild-plan-2026-09-08.md).
Base commit `77c225e` on `main` (the plan record on top of `5d69c6b`). Slices were built
in per-slice git worktrees and merged into the `analysis-rebuild` branch by the integrator.
Node `v22.23.1`. Numbers below describe the recorded tree only.

## Workers

| Slice | Worker | Effort |
| --- | --- | --- |
| S1, S3 | Codex (gpt-6-astra) | medium |
| S2, S5, S7 | Codex (gpt-6-astra) | high |
| S4, S6, S8, S9, S10 | Fable 5.1 | medium |
| Integration, browser checks, fixes | Fable 5.1 (orchestrator) | high |

Codex workers ran in a sandbox without a browser, so every browser gate ran from the
orchestrator's Chrome at 1265 px wide against the user's JIATF-401 laydown (17 entities,
8 threats), or from a Playwright harness in the worker's own worktree (S8, S9).

## Gates per merge

`npm run docs:check` was deferred to S10 because each slice changes the source inputs of
the current docs. Every other step of `npm run check` ran on the integration branch after
each merge: `test:docs`, `test:bundle`, `typecheck`, `schema:check`, `test`, `lint`, `build`.

| After | Test files | Tests | Result |
| --- | --- | --- | --- |
| S1 + S4 | 163 | 1939 | pass |
| S3 | 164 | 1939 | one timeout, fixed in `e92428e` |
| S2 + S6 | 169 | 1978 | pass |
| S5 | 171 | 2002 | pass |
| S7 | 174 | 2021 | pass |
| S8 | 175 | 2059 | pass |
| S9 | 161 | 1934 | pass, bundle budget passed |

`gate-after-s9.txt` is the raw log of the S9 gate including `check:bundle`.
Initial bundle after S9: 385,533 bytes gzip against 387,201 at base (−1,668).
`npm run test:e2e` passed 6 of 6 after the lens e2e check was replaced (`25fd789`).

## Browser checks

- S1: four screens mount in their phases; no lens bar; one placeholder before Play;
  Now and Outcome fill after a completed run.
- S3: 30x playback with the Now screen live ran at 86 frames per second; the kill-chain
  table showed 8 rows, 3 inventory meters and no scenario input. A wrapping defect in the
  table was fixed in `e92428e` and `b6295f6`.
- S2: the outcome grid renders once, six tiles, an 8-row sortable table and three records
  rows. The screen scrolls at 900 px window height; see limitations.
- S5: band chart, a 5-row delta table and findings render after a 100-replicate ensemble.
  `forecast-trial-disagreement` fired: deterministic first detect 171.5 s against a trial
  first detect of 0.5 s.
- S7: a 5 x 4 sweep (threat altitude by threat speed, 40 replicates per cell) ran from the
  screen and painted 20 cells in 59 s.
- S8: pin from Fragility wrote `rangeboard.baseline.v1` (899,969 chars), reload restored
  the label, clear wrote a null baseline. `s8-baseline-browser.mjs.txt` and
  `s8-baseline-browser.json` record the worker's Playwright run including the Baseline
  column, the dashed baseline mean and a corrupted-save recovery copy.
- S9: the user's saved view loaded with no recovery copy and no `ui.analysis` field;
  `s9-lens-removal-browser.mjs.txt` records the worker's seeded old-view check.

## Limitations

- The Outcome screen does not fit one 552 px panel viewport with eight threats; it scrolls.
- Compare shows times in seconds; Outcome shows them as m:ss.
- Fragility tiles carry the pre-existing multi-line statistic captions.
