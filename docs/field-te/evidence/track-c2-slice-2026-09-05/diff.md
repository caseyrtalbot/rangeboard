# Track, C2 and doctrine slice: before-and-after capture, 2026-09-05

Source change (`src/playback/sim.ts`, F-15). A scan radar's missed scan before the M-of-N rule
has initiated a track now ends the hold (`hold` returns to `none`) instead of coasting. After
initiation a miss coasts and drops as before. The M-of-N window keeps counting through the
gap in both cases. No draw site, key, `DT`, CRN pairing, raid partition or persistence changed.
The firm-track time (`trackInitAtS`, `stableTrackAtS`), the doctrine gates and every
engagement output are unchanged by construction: they never read the hold.

Editor change (`src/panels/LibraryEditor.tsx`, F-16). The Initiation M and N fields are
coupled: raising M above N raises N to M; lowering N below M lowers M to N. Saved data with
M above N was already rejected by `runtimeValidation.ts`. No engine change.

Probe: `f15-capture.ts.txt`, run as the scratch vitest file `src/playback/f15.capture.test.ts`
and deleted after. Three fixtures, each produced twice on each tree and compared with `cmp`
(byte-stable): the firing fixture (assessments, deterministic report, aleatory MC, total MC,
sensitivity at `replicates: 4`), the detection fixture
(`src/playback/__fixtures__/detection-outside-rings.json`: assessments and 30 total
replicates at seed 4821), and the layered fixture (`layered-acoustic-merops.json`:
assessments, deterministic report and 30 aleatory replicates at seed 7).
`numerical-before.json` is byte-identical to `e2-motion-fix-2026-09-05/numerical-after.json`.

## What is identical

`numerical-before.json` and `numerical-after.json` are byte-identical: the KuRFS initiates on
its first scans and never misses before initiation. `numerical-after.json` stays the parity
baseline. In the detection and layered captures every leaf except those below is identical:
every kill, leaker, residual, salvo and time statistic, every event, every gate time, every
classification time, `firmTrackS`, `stableTrackAtS`, `firstDetectS`, `firstConfirmS`.

## What changed

| Leaf | Before | After | Rule |
| --- | --- | --- | --- |
| `detection.total.tracked` band (mean, lo, hi, p10) at 2243 steps | held count 1 during pre-initiation coasts | 0 at those steps | a Mavic 3 at 18 km draws a hit at low Pd, then misses; the tentative hold no longer extrapolates |
| `layered.aleatory.tracked` band at 1807 steps | as above | as above | same, over 9 tracks |
| `layered.assessments[9].sensorObservations[4]` (deterministic) | `intervals[0]` ends 101.5, `heldSamples` 72, one coast interval | ends 93.5, 56, no coast | the radar never initiated on that track; its coast after the last hit is gone |

The direction is the physical one: "tracked" now counts tracks a radar holds or extrapolates
after initiation, not tentative detections carried through misses. Detection, firm-track and
engagement statistics do not move.

## Browser check

F-16 editor coupling: `browser-check.md` in this directory (seven typed steps through the
library editor inputs, stored pair valid after each, no page errors). F-15 changes no panel
file; no browser check.
