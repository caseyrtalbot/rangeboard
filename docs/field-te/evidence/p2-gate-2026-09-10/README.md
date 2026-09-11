# Phase 2 gate evidence, 2026-09-10

Dated capture for the Phase 2 (tracks and kill chain) gate of the
[calibration implementation plan](../../../IMPLEMENTATION_PLAN.md). Measurements describe
the tree at the gate commit on `main`, not the current tree.

## Files

| File | Content |
| --- | --- |
| [`before/timeline.json`](before/timeline.json) | Monte Carlo means and one deterministic-seed trial per golden fixture at the contract commit 6e33ef2: truth tracks, no false tracks, no operator queue |
| [`after/timeline.json`](after/timeline.json) | The same capture on the gate tree (467ceda) with the golden fixtures pinned to the three physics switches |
| [`after-estimate/timeline.json`](after-estimate/timeline.json) | The same capture with the switches removed: Kalman estimate, fusion, false tracks and the operator queue on |
| [`comparison.md`](comparison.md) | The three captures side by side: end-of-run means, the per-threat trial timeline and the engagement ledger |
| [`capture-timeline.mjs`](capture-timeline.mjs) | The capture script: it reads the CLI run record in a directory, runs one trial per fixture through `dist-engine/engine.js`, and writes `timeline.json` |
| [`compare-timelines.mjs`](compare-timelines.mjs) | Renders `comparison.md` from the three `timeline.json` files |
| [`check.txt`](check.txt) | `npm run check` output at the gate: 168 test files, 1955 tests, engine CLI test 2 of 2, library 90 models and 790 fields, build entry 1,196.69 kB (353.20 kB gzip) |
| [`browser/`](browser) | Nine screenshots from the gate browser check on port 5385: the ellipses at 1.5 s and 200 s, solid at 497 s and dashed at 500 s, horizon censoring, the finished run and the outcome tiles |

Monte Carlo rows are 200 replicates at seed 4821, aleatory, on 4 workers. Trial rows are
seed 4821, replicate 0.

## Blueprint Phase 2 exit against the evidence

| Exit item | Result |
| --- | --- |
| The steady-state Kalman gain matches the closed form | Met: `playback/kalman.test.ts` runs the constant-velocity filter to convergence and holds the gain against the closed form of the CWNA tracking index, with symmetry after 1000 predict and update steps |
| A laydown with null accuracy fields runs on the truth path with a lowered fidelity tag | Met in two parts: `playback/tracker.test.ts` pins the truth path (zero covariance, quality 1, no draw consumed) for a sensor with a null accuracy field and for every sensor under `truthTracks`; `createRunManifest` and `createTrialManifest` drop `fidelityFloor` from `datasheet` to `fallback` whenever a physics switch is on, and the `tracker` row of `MODEL_TAGS` states the truth path |
| Timeline parity documented before and after | Met: [`comparison.md`](comparison.md), with the pinned path against `before` and the estimate path beside it |

The second item is met by the switch, not by the null field alone: a null accuracy field
takes the truth path inside the tracker but writes no switch, so a laydown that reaches
the truth path that way keeps the `datasheet` floor. Only `Scenario.physics` lowers it.

## Reading of the comparison

The pinned path is identical to `before`: 0 assessment field differences over the eleven
threats, the same engagement ledgers (2 events and kill mass 1 on detection-outside-rings,
22 events and kill mass 7 on layered-acoustic-merops) and the same Monte Carlo summaries.
An earlier capture on 4359d28 showed a one-step `stableTrackAtS` move on two threats; the
review traced it to the fire-control quality gate reading a fused entry at a firm step the
sweep had decided on a missed scan, and the merge 467ceda made the gate a quality
condition. The recapture on that tree holds.

The estimate path is the phase's intended change. On layered-acoustic-merops the leaker
mean rises from 1.990 [1.819, 2.161] to 2.120 [1.963, 2.277] and kills fall from 7.010
to 6.880; the intervals overlap. One threat, ent-mt5bofdd-2q, firms 2.0 s later and its
declaration and gate follow; the other nine hold their times. The engagement ledger goes
from 22 events at kill mass 7 to 25 events at kill mass 6: the shooters solve the intercept
from the fused estimate, spend more rounds and lose one kill in the trial. On
detection-outside-rings the estimate path moves nothing in the trial and the leaker mean
goes from 0.065 to 0.060, inside the interval.

Track estimates emitted in the trial are the same on both after paths: 3173 on
detection-outside-rings and 25157 on layered-acoustic-merops.

## Browser check

Port 5385 at `ec7d1fb`, the onboarding firing scenario loaded through `parseAutosave`. The
saved Giraffe 1X and KuRFS adopted their seed accuracy fields and FAAD C2 its spec, so the
Kalman path ran. Two sage ellipses with cross markers drew on the tracked Mavic. The
Giraffe track's 1 sigma semi-major axis fell from 83.5 m at 1.5 s to 2.8 m at 490 s, then
grew from 2.8 m to 7.6 m over 2.5 s of coast with the dash. With the horizon at 151.5 s
and the playhead dragged to 400 s the ellipses stayed at 151.5 s. The default Run
finished 30 replicates on 8 workers in about 0.17 s. 0 page errors over the session.
Outcome tiles render only after a completed trial, which is the existing design.
