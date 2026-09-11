# Code review: Phase 3 physics integration

Review date: 2026-09-11. Reviewed commit:
`1803900293535a9f498ae122ac289960b300a1c9` (Complete Phase 3 physics integration).

This is a dated review of that commit and its affected core code paths. All four
findings were open at capture; this document does not claim that fixes have been
implemented. Source line numbers below refer to the reviewed commit.

## Findings

### CR-01 [P1] Reject unconverged optical dwell solutions

Location: [src/playback/shot.ts](../src/playback/shot.ts), lines 149–185,
especially line 183.

The fixed-point iteration accepts its twelfth result even when it has not converged.
An oscillating solution can therefore credit an unjustified near-instant effect.

Reproduction: call `evaluateShot` at time zero with an optical effector at the origin,
100 kW power, beam quality 2, aperture 0.3 m, jitter 10 urad, nominal engagement delay
5 s, maximum range 12 km, and a quadcopter target at the same altitude. Set visibility
to 5 km with the environment enabled, disable `legacyBeamPk`, use an engagement window
of 0–200 s, and sample target position as `x = max(100, 10000 - 50 * t)`, `y = 0`.
The returned effect time is 1.000030586 s with 0.000030586 s of dwell at a range of
9,949.998 m. Re-evaluating `beamEffect` at that returned range requires approximately
673.172 s of dwell. The returned position and dwell do not satisfy the model's own
equation.

Use a bounded solver with an explicit convergence/residual check. Add regression
coverage for approaching targets and low visibility; never accept an unconverged
candidate as a physical solution.

### CR-02 [P2] Reserve the optical effector until its dwell finishes

Location: [src/playback/attrition.ts](../src/playback/attrition.ts), line 491.

`nextReadyS` advances by cooldown alone, even when optical illumination remains in
progress longer. Another target can receive a concurrent beam from the same effector,
and both effects remain credited.

Reproduction: run `assessAllThreats` and `resolveEngagements` with doctrine disabled,
free ROE, a wide-coverage radar linked directly to one optical effector, and two
quadcopter targets moving at 1 m/s from `(10000, 0)` and `(10000, 100)` to points
100 m farther east. Set every entity to the 4 m mount altitude. Use the optical
parameters from CR-01, base probability 0.8, a 15 s cooldown, 8 km visibility and no
wind; enable `truthTracks`, `noFalseTracks` and `noOperatorQueue` only.
The first event releases at 1 s and takes effect at 39.646 s. The same effector
assigns the second target at 15 s, releases at 16 s and takes effect at 55.072 s.
Its illumination intervals overlap.

Reserve the modeled optical effector through its effect time, respecting the defined
cooldown semantics. Cover competing targets with dwell longer than cooldown.

### CR-03 [P2] Include drifted flight geometry in assessment invalidation

Location: [src/playback/sim.ts](../src/playback/sim.ts), line 331;
related dependency selection is in `threatEntityInputs`.

Assessment now samples bounded, wind-drifted motion, but sensor dependency selection
still uses distance from the original waypoint segments. A sensor can detect the
drifted target while being excluded from the memo's inputs. Moving that sensor can
then reuse stale detection and engagement assessments.

Reproduction: use a target path from `(0, 0)` to `(0, -1000)`, speed 10 m/s,
acceleration 10 m/s2 and altitude zero. Enable a 10 m/s wind from 270 degrees.
Place an acoustic sensor with 100 m detection range at `(500, -495)`.
`assessThreatReusing` records first detection at 45.5 s. Replace the sensor entity
with a copy at `(1000, -495)` and pass the original memo: the same memo is returned,
still reporting 45.5 s. A fresh `assessThreat` returns no detection.

Derive conservative dependency bounds from the actual flight model, or retain sensors
conservatively when flight limits apply. Test cached-versus-fresh equality after edits
around wind drift and bounded turns.

### CR-04 [P2] Solve fallback intercept timing against the sampled flight

Location: [src/playback/intercept.ts](../src/playback/intercept.ts), lines 185–186;
related timing logic is in `analyticTofS` and `interceptAt`.

Position sampling now honors flight limits, but fallback intercept timing still assumes
constant-speed waypoint motion. This affects `legacyKineticPk` and effectors whose
physical-model fields are incomplete. The timing solution and its feasibility check
can describe different target trajectories.

Reproduction: start a target at `(1000, 0)` with a path to `(0, 0)`, requested speed
20 m/s and acceleration 1 m/s2, without wind. Place an interceptor at the origin at
the same altitude, with zero engagement delay and stated flyout speed 100 m/s; omit
physical-profile fields so its fallback speed is 70 m/s. At time zero, `interceptAt`
selects 11.111 s, samples the target at 938.272 m and returns `infeasible: true`.
Solving against the actual accelerated trajectory gives a valid intercept at
13.066 s and 914.637 m.

Use the same trajectory for timing, position and feasibility. Preserve the analytic
shortcut only when the trajectory actually satisfies its constant-speed assumptions.

## Cleaner code opportunities

- Centralize trajectory sampling and conservative spatial bounds so assessment caching
  and intercept resolution cannot silently retain different motion assumptions.
- Pass a structured accepted-shot result into commitment instead of separate timing
  arguments. Keep release, dwell, effect and next-ready calculations together so an
  occupancy constraint cannot be lost between evaluation and scheduling.
- Isolate optical timing resolution from the general shot evaluator, with explicit
  success, nonconvergence and infeasibility results. Test its numerical residual as well
  as its returned timestamps.

These are proposed directions for the findings above, not implemented refactors.

## Verification and assessment

The review inspected the commit diff, surrounding engine code, callers and relevant
tests. Targeted in-memory probes loaded the TypeScript modules through Vite and
reproduced the four failures; no scratch tests or implementation edits were retained.

- `npm test -- --reporter=dot`: 2,069 tests passed across 186 files, 29.23 s.
- `npm run typecheck`: passed.
- `npm run docs:check`: passed on the reviewed tree.
- No fresh browser check was performed during the review.

The existing suite passes but misses these integration cases. The commit needs the
four fixes and focused regression coverage before its integrated physical behavior can
be considered verified. Numerical probes establish implementation inconsistencies;
they do not validate real-world weapon or sensor performance.
