# R0 playback realism baseline, 2026-09-07

Stage R0 of the [playback realism proposal](../playback-realism-plan-2026-09-07.md).
Captured 2026-09-07 on `main` at `5076ecc16edb7bfa6c1260d1d82ff7fb1dad88d9`.
No application source changed. Three lanes ran in parallel with disjoint files; the
orchestrator integrated this index. The numbers describe that commit only.

## Records

- [Numerical baseline](numerical-baseline.md): fixed-ID deterministic, aleatory MC, total MC
  and sensitivity captures for the firing fixture and the detection fixture, seed 4821,
  4 replicates. `numerical-baseline.json` is byte-stable across two runs. Current-source
  test count on `--dir src`: 108 files, 1446 tests. Probe preserved as
  `numerical-capture.ts.txt`.
- [Consumer matrix](consumer-matrix.md): 168 read sites grouped by owning stage
  (R1 14, R2 79, R3 12, R4 17, R5 46), each with basis, horizon leak status, surface and
  `file:line`. Includes verified store-boundary facts and evidence gaps.
- [Browser and performance baseline](browser-perf-baseline.md): paired dev and production
  phase table on the firing fixture, the four deterministic event times, and the Execute
  surfaces that show outcomes past the observed horizon at a paused T+30 cursor.
  Screenshots `before-play.png`, `paused-t30.png`, `scrub-forward.png`, `scrub-back.png`;
  raw `profile-dev.txt`, `profile-prod.txt`, `browser-baseline.json`; scripts
  `profile.mjs.txt`, `browser-baseline.mjs.txt`.

## Use

R1 through R5 compare against these files with the same fixtures, seed and scripts.
Preserve these bytes; write after-captures next to them. The fixtures are not RUN-0004,
and no RUN-0004 reproduction is claimed.
