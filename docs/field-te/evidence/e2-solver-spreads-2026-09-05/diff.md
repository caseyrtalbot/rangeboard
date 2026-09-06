# Closed-form intercept solver and PF spreads: before-and-after capture, 2026-09-05

Two source changes, captured separately.

R-F-43 (`src/playback/intercept.ts`). `interceptAt` now takes the exact constant-speed
meeting time along the path (`analyticTofS`): the target holds the first point before its
delay and the last point after the path ends; on each straight segment the formation member
moves at constant velocity, so the meeting time is the smallest root of a quadratic per
phase, taken in time order. The window-end cap (R-F-7) and the `infeasible` test (R-D-44)
are unchanged. A ship with no path or no speed is stationary where the sampler puts it. The
three fixed-point passes are gone.

R-F-35 (`src/model/seedLibrary.ts`). The Stinger (2 of 2) and Leonidas (61 of 61) `pk` rows
drop their `spread`, so both take the PF pseudo-beta around the nominal 0.7 like every other
effector; the counts stay in the row text. F-62 adds a `refRcsM2` provenance row to the
SPEXER 2000 (basis `pf`, value unchanged at 0.04): no output moves.

No draw site, key, `DT`, CRN pairing, raid partition or persistence changed.

Probe: `e2s-capture.ts.txt`, run as the scratch vitest file `src/playback/e2s.capture.test.ts`
and deleted after. Three fixtures as in `track-c2-slice-2026-09-05`: firing (assessments,
deterministic report, aleatory, total, sensitivity at `replicates: 4`), detection (assessments
and 30 total replicates at seed 4821), layered (assessments, report, 30 aleatory at seed 7).
Tags: `before` (unchanged tree, byte-identical to `track-c2-slice-2026-09-05/*-after.json`
for the firing fixture), `after-solver` (solver only, seed change stashed), `after` (both).
Every file produced twice and compared with `cmp`; all byte-stable.

## Solver (before to after-solver)

| Fixture | Moved | Bound |
| --- | --- | --- |
| firing, deterministic report | the four Coyote `tEffectS` by -0.029, -0.013, -0.002 and +0.00004 s; `pk` and `killDelta` by at most 5.4e-6; threat and total kill and leaker masses by 6.6e-7 | under 0.06 DT; Pk under 1e-5, as the E2 study predicted |
| firing, aleatory, total, sensitivity | nothing | no kill draw crosses the moved Pk |
| detection, 30 total replicates | `kills` and one threat's `residual` band at 3 steps by 1/30 | one replicate's effect lands one DT earlier |
| layered | nothing | byte-identical |

## Spreads (after-solver to after)

Nothing moves in any fixture: every firing-fixture event is a Coyote, and total mode never
samples a Stinger or Leonidas Pk that fires. `seedLibrary.test.ts` asserts the rows carry no
spread and keep their counts in the text.

## Browser check

`ThreatDetail.tsx` gains an `Engage` row (R-F-20); see `browser-check.md` in this directory.
The solver and the seed rows change no panel file.
