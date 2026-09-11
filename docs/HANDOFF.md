# RangeBoard continuation status

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This file is rewritten at each gate. Current source, tests and live browser state outrank
older handoffs and evidence. It does not authorize a commit, push or merge.

## Phase status

| Phase | Gate | Merge or gate commit | Date |
| --- | --- | --- | --- |
| 0 Data foundation | passed | `f024709` | 2026-09-10 |
| 1 Real-mode statistics | passed | `70a7a0e` | 2026-09-10 |
| 2 Tracks and detect-to-engage sequence | passed | `5373505` | 2026-09-10 |
| 3 Sensor and effector physics | passed | lane merges through `576371e` | 2026-09-10 |
| 4 Hypothesis tools | not started | | |

## Completed

Phase 3 used the contract and researched seed fields already on `main`. Six disjoint
model lanes were implemented in parallel and merged locally; no remote publication was
performed.

| Lane | Lane commit | Merge | Result |
| --- | --- | --- | --- |
| 3.1 Target UAS flight | `573a07f` | `14d31d5` | Point-mass acceleration, bounded waypoint turns, wind drift and shared path duration/sampling |
| 3.2 Passive RF | `48d0968` | `336cc0d` | Link budget, signal-to-noise direction finding, one-node bearing uncertainty and multi-node geolocation |
| 3.3 EO/IR | `ad37fcf` | `c56c3f2` | Johnson detect/recognize/identify ranges with atmospheric extinction |
| 3.4 Radar dwell | `9d9f7dc` | `56ddb80` | Shnidman noncoherent pulse integration while retaining the placard calibration |
| 3.5 Kinetic effects | `99dbbf2` | `f764a6b` | Interceptor miss-radius and projectile burst probability/timing |
| 3.6 Beam effects | `d1c00c6` | `576371e` | Optical irradiance, fluence and dwell; HPM field, beamwidth and recharge |

The orchestrator wired the lanes through the common consumers:

- Assessment, playback, path rendering and intercept geometry share the scenario-aware
  flight sampler and limited duration.
- Sensor range calls receive the scenario fallback list. RF nodes of one model that hear
  the target simultaneously share the maximum baseline for their bearing solution.
- Physical kinetic probability reads launch-time prediction uncertainty; gun bursts spend
  their modeled round count and request their fine step.
- Optical shots draw one commit-keyed fluence threshold, settle and dwell before effect,
  and request the fine step. HPM applies its final off-boresight angle and recharge.
- The Physics tab's nine checked boxes now select actual fallbacks. Its pending wording
  was removed, and every physical path has a fidelity tag.

The protected truth-path suites remain unchanged and passed after integration:
`sensitivity.parity.test.ts`, `accuracy.verify.test.ts`, and
`convergence.verify.test.ts` (28 tests). The default estimate path moved by design and
was repinned only after a fresh seed-4821 trial and 200-replicate capture on both golden
fixtures; its four tests pass. The exact before/after values and interpretation are in
[comparison.md](field-te/evidence/p3-gate-2026-09-10/comparison.md).

The integrated gate passes 186 test files and 2,069 tests, the engine CLI, the 90-model
library with 1,027 fields, runtime schema, documentation maintenance, type checking, lint
and production build. The gzip-9 bundle check reports a 358,965-byte entry against the
360,000-byte budget and 374,451 bytes of initial JavaScript plus CSS against 400,000.
An isolated browser at 1440 by 900 and 1280 by 800 verified all nine controls, persistence,
the completed fallback manifest and a scrollable modal with no horizontal overflow; it
reported zero console warnings and zero errors.

## Validation anchors

- Flight: an unlimited target is bit-identical to `posAtTime`; the bounded turn uses
  `R = V / omega`; wind displacement is the wind vector times flight time; the seeded
  Mavic 3 acceleration reproduces its published tilt figure.
- Passive RF: the Mavic 3 5.8 GHz threshold is 2,607 m, inside RF-360's published
  2-to-5 km band; its 2.4 GHz threshold is 6,179 m, above ARDRONIS's 5 km claim.
- EO/IR: Spynel-S detection is 6,000.36 m against the 6,000 m sheet value. The fixed
  Johnson thresholds yield 1,500.09 m recognition against the stated 2,000 m; that
  mismatch is retained. The 750.05 m identification result is analytic because the
  sheet publishes none.
- Radar: three hand-derived Shnidman integration cases pass; the prior Marcum-Q pins
  remain unchanged.
- Kinetic: the APKWS effective-radius probability table and Rheinmetall 1,200-round/min
  burst timeline pass.
- Beam: the Iron Beam 100 kW, 10 km, 2 s anchor and a hand-derived HPM threshold range
  pass.

## Current limits

- `FlightPath` has no altitude profile. `climbRateMps` remains recorded but unused, as
  required by the lane brief; the engine invents no altitude change.
- The Spynel recognize-ratio mismatch above is an explicit model/vendor disagreement.
- Iron Beam's sourced `dwellToEffectS` spread is absent from runtime provenance ordering
  and `PF_SPREAD`. Optical shots therefore use the same documented 2 dB event-level
  default until that metadata is wired.
- Bounded flight changes arrival classification in the layered estimate fixture. Its
  Monte Carlo leakers fall from 2.12 to 0 because most threats become no-arrival, while
  kills fall from 6.88 to 0.005. This is not evidence of improved defeat.
- Phase 2's per-sensor classification flag, fusion latency quantization, unmodeled
  elevation accuracy and C2 editor gaps remain outside the Phase 3 lane scope.

## Continuation boundary

Phase 3 is complete locally through the merged lane tip `576371e` plus the orchestrator's
integration working tree. Nothing was pushed and the Phase 3 lane branches were not
cleaned up. Phase 4 begins at section 6 of
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). It remains unstarted and is not current
tasking.

## Evidence

- [Phase 3 gate](field-te/evidence/p3-gate-2026-09-10/README.md)
- [Estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Issued lane rules and briefs](field-te/evidence/p3-lanes-2026-09-10/briefs/p3-lane-common.md)
- [Previously completed Physics UI lane](field-te/evidence/p3-physicstab-2026-09-10/README.md)
- [Phase 2 gate](field-te/evidence/p2-gate-2026-09-10/README.md)
