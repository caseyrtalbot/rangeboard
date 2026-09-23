# finishSummary time at the retained cap, 2026-09-23

Measured 2026-09-23 on branch `polish4/fidelity` from base `1b39c03`. The
one-entry `tQuantile` cache in `src/analysis/stats.ts` is in that tree. The
branch's fidelity tag change does not touch the summary path. This note is a
measurement. It does not set a target or select work.

## Method

The script `measure.mjs.txt` (preserved with `.txt`; copy it back to
`measure.mjs` to run) imports `dist-engine/engine.js`. Run it from the
repository root after `npm run engine:build`:

```sh
node --expose-gc measure.mjs docs/field-te/evidence/perf-2026-09-06/scenario.json 21 measure.json
```

1. The script sets the board to Monte Carlo with no half-width stop.
2. It sets the replicate count to the rows the pool keeps at the cap. The pool
   stops at the first checkpoint where the retained numbers reach
   `DEFAULT_BUDGET.retainedNumbers`, so the count is
   `ceil(96,000,000 / numbers per row)`.
3. It runs those replicates on a `worker_threads` pool through
   `scripts/engine-worker.mjs`, 12 threads. The rows are real replicates, not
   copies.
4. It merges the partials with `mergePartials(parts, { release: true })` and
   `contiguousPrefix`, as the summary worker in `src/playback/mc.worker.ts` does.
5. It times `finishSummary` on the merged prefix 21 times with
   `performance.now()`. It calls `gc()` before each run. The first run is
   included.

Raw output: `measure.json`.

## Machine

Apple M4 Pro, 14 logical cores, 24 GB memory, macOS 26.6.2, Node v22.23.1. The
timed calls run on the Node main thread after the pool threads close.

## Board

The Performance baseline board, `docs/field-te/evidence/perf-2026-09-06/scenario.json`,
"Layered (Acoustic + MEROPS)". It is the largest tracked seed or evidence board:
54 entities, 10 UAS, 9 tracks with a path. Seed 4821, aleatory uncertainty.

| Quantity | Value |
| --- | ---: |
| Grid steps | 2,645 |
| Tracks | 9 |
| Numbers per row, `2,645 x (5 + 9)` | 37,030 |
| Rows at the cap | 2,593 |
| Retained numbers | 96,018,790 |
| Replicate run, 12 threads | 48.9 s |

## Result

| Statistic over 21 runs | `finishSummary` ms |
| --- | ---: |
| Median | 1,438.7 |
| Max | 1,468.4 |
| Min | 1,400.9 |

The time does not stay under a 16.7 ms frame at 60 Hz. The median is about 86
frames. In the app, `finishSummary` runs in the summary worker
(`finish-summary` in `src/playback/mc.worker.ts`), not on the page thread. The
page thread does not block for this time. The summary reaches the page about
1.4 s after the merge on this machine and board.
