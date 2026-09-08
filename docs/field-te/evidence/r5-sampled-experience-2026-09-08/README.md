# R5 sampled experience evidence, 2026-09-08

Stage R5 of the [playback realism proposal](../playback-realism-plan-2026-09-07.md).
Before captures were taken at clean `main` HEAD `838f5bb017117478f2b696d82934b7bfe17d54bb`.
After captures were taken on the uncommitted working tree of branch
`codex/r5-sampled-experience` from that base, Node `v22.23.1`. Sampled Play is the
default in that tree. Numbers below describe that tree only.

## Numerical capture and source tests

The retained R4 harness ran from `src/playback/__scratch_r5_capture.test.ts` so
its relative imports remained valid. Only its output directory changed. The scratch
probe passed (1 file / 1 test), then was deleted before `npm test`.
Fixed fixtures, IDs, seed and settings remain those of the retained harness.

`numerical-before.json` exactly matches the R4 `numerical-after.json`, with no
fields excluded. `cmp` exited 0. Both files contain 1,683,876 bytes and have SHA-256:

```text
692db20000653392a95c8e14d53276ea517c0905bb0abd069f5f35adba76b2a6
```

Current-source `npm test`: **128 files / 1656 tests passed**, exit 0.
The current output supersedes the historical R4 count for this capture.
Production build passed; raw output is retained.

## Browser and performance capture

The Codex worker's Chromium and preview attempts were blocked by its sandbox
(`MachPortRendezvousServer` permission denied; `listen EPERM` on `::1:5462`).
The orchestrating Claude session then ran the same unchanged scripts from
`/private/tmp/r5-before-capture/` on the same firing fixture: the dev server on
owned port 5461 and the built `dist/` on owned port 5462 through the profile script's
static server. Chromium 151.0.7922.34 (Playwright 1.62.1), headless, disposable
contexts. Port 5174 and the user's Chrome profile were untouched. Servers were stopped.

`browser-before.json` status is `captured` with zero page errors. It records the four
deterministic engagement events (assignment 20/122/215.5/303 s; release +60 s;
effects 111.7/205.2/292.9/379.0 s) and five captures: `before-play.png`,
`paused-t30.png`, `scrub-forward.png`, `scrub-back.png` at 1400×900 with the 320 px
panel, and `ordinary-play-compact.png` at 1280×800. Trial state stayed idle during
ordinary Play. Raw profiler output is in `profile-dev-before.txt` and
`profile-prod-before.txt`.

## Paired timing table

Script milliseconds per phase, except load wall time. Long tasks are counted above
50 ms with the maximum duration. Production store-only phases are unsupported by the
retained harness.

| Phase | Dev before | Production before |
| --- | --- | --- |
| Load to first canvas (wall) | 329 ms | 182 ms |
| Idle 3 s | 3058 ms, 118 fps, 0 long | 3033 ms, 119 fps, 0 long |
| Playback 5 s at 1x | 5041 ms, 119.8 fps, 0 long | 5067 ms, 119.8 fps, 0 long |
| Playback 5 s at 8x | 5042 ms, 119.8 fps, 0 long | Unsupported |
| Zoom, 30 wheel events | 1801 ms, 118.3 fps, 0 long | 1733 ms, 120 fps, 0 long |
| Pan drag, 40 moves | 1067 ms, 117.2 fps, 0 long | 1025 ms, 120 fps, 0 long |
| moveEntity, 20 edits | 2300 ms, 119.1 fps, 0 long | Unsupported |
| Select/clear, 10 cycles | 2617 ms, 118.9 fps, 0 long | Unsupported |
| Right tabs, 3 cycles | 1925 ms, 118.4 fps, 0 long | Unsupported |
| Lifecycle phases, 3 cycles | 2367 ms, 111.1 fps, 2 long, max 66 ms | 2142 ms, 115.8 fps, 0 long |
| Library drawer, 3 toggles | 1659 ms, 115.1 fps, 0 long | 1584 ms, 116.8 fps, 0 long |
| Undo/redo, 5 steps | 1392 ms, 115.7 fps, 0 long | Unsupported |

## Exact file list

- `README.md`
- `numerical-after.json`, `check.txt`, `check-rest.txt`, `bundle.txt`, `e2e.txt`
- `profile-dev-after.txt`, `profile-prod-after.txt`
- `r5-browser.mjs.txt`, `r5-browser-notes.txt`, `browser/` (results, export, retained trial, screenshots)
- `browser-attempt-before.txt`
- `browser-before.json`
- `browser-before.mjs.txt`
- `build-before.txt`
- `before-play.png`, `paused-t30.png`, `scrub-forward.png`, `scrub-back.png`,
  `ordinary-play-compact.png`
- `execution-before.txt`
- `numerical-before.json`
- `numerical-capture.ts.txt`
- `numerical-parity-before.json`
- `profile-dev-before.txt`
- `profile-prod-before.txt`
- `profile.mjs.txt`
- `source-tests-before.txt`

## After captures and integrated verification

Fixed-ID numerical after capture `numerical-after.json` (same harness, same fixtures,
seed 4821, four replicates) is byte-identical to `numerical-before.json` and to the R4
after capture: `cmp` exit 0, 1,683,876 bytes, same SHA-256 as above. Deterministic,
aleatory MC, total MC and sensitivity outputs are unchanged by R5, with no fields excluded.

Gate on the after tree: `npm run check` stopped only at `docs:check` before the
documentation update (`check.txt`); every remaining step then passed in `check-rest.txt`:
test:docs, test:bundle, typecheck, schema:check (no descriptor change), **142 files /
1749 tests**, lint (pre-existing warnings only) and build. Bundle budget passed
(`bundle.txt`): entry 246,173 bytes, initial JavaScript + CSS 392,313 bytes, gzip -9.
The tracked shell browser spec passed 6/6 on owned port 5461 after its completion case
was changed to wait for trial readiness (`e2e.txt`); sampled Play rejects a synchronous
completion without a prepared trial by design.

### R5 browser harness

`r5-browser.mjs.txt` (notes in `r5-browser-notes.txt`) ran headless Chromium 151.0.7922.34
against the owned dev server on port 5461 with the same firing fixture and disposable
contexts. Results are in `browser/r5-browser.json`: **15/15 checks passed, zero page
errors, zero console errors**. Retained outputs: `browser/export.json`,
`browser/retained-trial.json` and screenshots `execute-ready.png`, `execute-paused.png`
(T+2:10), `execute-complete.png`, `analyze-complete.png` at 1400×900 with the 320 px panel,
and `compact-ready.png`, `compact-complete.png` at 1280×800 with reduced motion and no
right-panel overflow.

- Ready state is idle with no outcome glyphs or shots. Play prepares the trial, and the
  clock starts only after the matching result is ready; one trial worker per run.
- Two `startTrialRun` calls during preparation share one request token and one worker.
- Horizon agreement at a paused T+130 s (observed 202 s, duration 500 s): KPI tiles,
  time-series axis domains (0–130), engagement strip, event ledger and the selected
  track readout expose no effect later than the horizon; the one exposed effect is
  at 112.1 s. Rendered active sensors equal the sampled sweep's measured/held set.
- Completion, then Replay: cursor returns to 0; manifest, ledger and result are
  byte-equal; completion time and achieved observation are preserved through 1x/5x
  speed changes and pause. New run clears the manifest and changes run identity.
- A sensor move during a ready trial invalidates it; undo restores the basis with no
  stale trial; a presentation change keeps the trial. An injected trial error leaves
  the clock stopped with Retry and no forecast counters.
- Thirty new runs produced 30 unique manifest ids and zero live trial workers.
  Harness-observed preparation round trips were 68–95 ms (mean 83.8 ms) including
  polling and protocol overhead; R4 measured 25–41 ms with the same method before any
  consumer adapters existed. This is preparation latency, reported separately from
  playback cost.
- Export after completion contains the existing forecast, MC and sensitivity groups
  plus the `trial` group whose manifest and ledger equal the retained store result,
  integer counts, and the "Build revision unavailable" disclosure.
- Keyboard: Space toggles play/pause and the aria-live region updates.
- Long tasks during 5 s of actual 1x and 5x playback: none observed. The Long Tasks
  API floor is 50 ms, so this does not establish the plan's 40 ms Play-task target.
  The profile below bounds frame time instead. The fixture has a single-member
  formation, so the mixed-formation case is covered by unit tests only.

### Paired timing after

Same scripts, fixture and environment as the before table. Dev load wall time was
378 ms on the recorded run and 270–279 ms on three repeats, so the recorded value is
warm-up noise. No phase shows a repeatable regression above 10 percent and no phase
recorded a long task.

| Phase | Dev after | Production after |
| --- | --- | --- |
| Load to first canvas (wall) | 378 ms (repeats 270–279 ms) | 182 ms |
| Idle 3 s | 3058 ms, 118 fps, 0 long | 3033 ms, 119 fps, 0 long |
| Playback 5 s at 1x | 5042 ms, 119.2 fps, 0 long, max frame 25 ms | 5058 ms, 120 fps, 0 long, max frame 9 ms |
| Playback 5 s at 8x | 5050 ms, 119.4 fps, 0 long, max frame 33 ms | Unsupported |
| Zoom, 30 wheel events | 1792 ms, 118.9 fps, 0 long | 1758 ms, 120 fps, 0 long |
| Pan drag, 40 moves | 1058 ms, 117.2 fps, 0 long | 1033 ms, 119 fps, 0 long |
| moveEntity, 20 edits | 2308 ms, 117.8 fps, 0 long | Unsupported |
| Select/clear, 10 cycles | 2592 ms, 118.1 fps, 0 long | Unsupported |
| Right tabs, 3 cycles | 1933 ms, 119 fps, 0 long | Unsupported |
| Lifecycle phases, 3 cycles | 2117 ms, 118.6 fps, 0 long | 2116 ms, 119.1 fps, 0 long |
| Library drawer, 3 toggles | 1650 ms, 116.4 fps, 0 long | 1567 ms, 119.4 fps, 0 long |
| Undo/redo, 5 steps | 1317 ms, 120 fps, 0 long | Unsupported |

## Limits

- Preparation round trip roughly doubled against R4's harness figure. It stays well
  under one second and is not a playback cost, but it was not profiled to a cause.
- The 40 ms Play-task target is bounded only by frame-time maxima and the 50 ms
  Long Tasks floor, not measured directly.
- Mixed-formation rendering, soft mission kills and late effects are verified by unit
  tests, not in this fixture's browser run.
- A time-series axis end label is clipped at the right edge of the chart in both
  viewports (cosmetic, visible in `execute-paused.png` and `compact-complete.png`).

## Stop point

Before and after evidence captured; R5 verified on the working tree of
`codex/r5-sampled-experience`. Existing R0–R4 evidence bytes are unchanged. No commit
or push. Before-capture commands and exits are retained in `execution-before.txt`.
The `docs/README.md` index link and guide fingerprint reviews were made in the same
change so `npm run docs:check` passes.
