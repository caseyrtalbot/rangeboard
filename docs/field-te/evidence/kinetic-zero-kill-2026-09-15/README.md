# Zero-kill kinetic outcome on the firing laydown

Captured 2026-09-15 on branch `p4f/kinetic-zero-kill`, checked out from `main` at
`31a6d5d`. This is the Task 1 finding from the Phase 4 gate follow-up list. No engine
file changed. The probe that produced every number is
[`zeroKill.probe.ts`](zeroKill.probe.ts); its raw output is
[`probe-baseline.txt`](probe-baseline.txt) for the committed tree and
[`probe-fixed.txt`](probe-fixed.txt) for the candidate fix.

## Decision

One defect and one model limit together explain the zero kills.

- Defect: `src/playback/shot.ts:319` charges the assignment-to-release delay as an
  open-loop coast of the fire-control track. At the Coyote's `engageTimeS` of 60 s the
  process-noise term alone is 90.4% of the miss variance and the miss 1 sigma reaches
  282 m against a 10 m lethal radius. The correct horizon is the flight, release to
  effect. The fix is derived below and measured, but it is **not landed**: it moves five
  pinned values in `src/playback/estimate.parity.test.ts` that cannot be hand derived,
  and one of them is contaminated by a second defect found here.
- Model limit: the interceptor model has no terminal-homing term. With the correct
  horizon the Coyote still reaches only Pk 0.034 to 0.050 per shot on this laydown,
  against 0.556 to 0.564 from the planning fallback. A lead-point-only miss model cannot
  reproduce a fragmentation interceptor's advertised effectiveness.

## What was probed

The laydown is
[`firing-scenario.json`](../onboarding-2026-09-04/firing-scenario.json): a Giraffe 1X at
(0, 0), a KuRFS fire-control radar at (100, 0), FAAD C2 at (-600, 0), one Coyote Block 2
at (1700, -1700), and a DJI Mavic 3 flying (0, -6000) to (0, 0) at 12 m/s and 300 ft.
Seed 4821, 30 replicates, total uncertainty, doctrine `pkCommit` 0.35 and launch policy
`pk-commit`.

The p4 gate browser check ran this board with a four-ship Mavic line, which is where its
"magazine of four" and "2.25 kills" came from. The probe runs both. The four-ship
physical result reproduces the gate exactly: 4 salvos, MC kills mean 0 (0 to 0.4),
MC leakers mean 4 (3.6 to 4). The gate did not record the formation spacing, so the
probe assumes 50 m, the Inspector default. The legacy four-ship kills mean comes out at
2.2333 against the gate's 2.25. The physical side matches the gate to every digit
because it is degenerate; the small legacy gap is the formation spacing or the range
boundary the gate added, neither of which the saved JSON carries.

| Laydown and model | Shots | First shot, s | MC kills mean | MC leakers mean |
| --- | ---: | ---: | ---: | ---: |
| One ship, physical | 2 | 313.5 | 0 | 1 |
| One ship, `legacyKineticPk` | 1 | 29 | 0.9667 | 0.0333 |
| Four ship, physical | 4 | 315 | 0 | 4 |
| Four ship, `legacyKineticPk` | 4 | 29 | 2.2333 | 1.7667 |

## Per-shot table, committed tree

One-ship laydown, physical model. `sigma(t)` is the fused track's own position 1 sigma.
`sigma(rel)` is what the code uses: the same estimate propagated to `t + engageTimeS`.
`sigma(tof)` is the same estimate propagated by the flight time only. `sigma(eff)` is
propagation to the effect time. All in meters.

| Shot | t, s | release, s | effect, s | TOF, s | Track hits | sigma(t) | sigma(rel) | sigma(tof) | sigma(eff) | Miss sigma | P(within 10 m) | Pk used | Pk legacy |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 313.5 | 373.5 | 384.753 | 11.253 | 689 | 3.626 | 282.21 | 28.69 | 362.30 | 282.22 | 0.00062758 | 0.00053344 | 0.56417 |
| 2 | 395 | 455 | 468.643 | 13.643 | 930 | 2.648 | 279.56 | 34.95 | 377.25 | 279.56 | 0.00063954 | 0.00054361 | 0.55665 |

Four-ship laydown, physical model, same run.

| Shot | Ship | t, s | release, s | effect, s | TOF, s | Track hits | sigma(t) | sigma(rel) | sigma(tof) | Pk used | Pk legacy |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | 315 | 375 | 385.598 | 10.598 | 773 | 3.450 | 281.38 | 26.25 | 0.00053659 | 0.56413 |
| 2 | 1 | 345 | 405 | 415.685 | 10.685 | 863 | 3.148 | 280.73 | 26.15 | 0.00053907 | 0.56233 |
| 3 | 2 | 375 | 435 | 446.784 | 11.784 | 953 | 2.845 | 280.03 | 29.15 | 0.00054179 | 0.55932 |
| 4 | 0 | 405 | 465 | 478.563 | 13.563 | 1043 | 2.541 | 279.24 | 34.50 | 0.00054486 | 0.55532 |

Shot 4 lands after arrival at 476 s, so its mass would be a late kill.

Alternative Pk at shot 1, same geometry and the same Coyote fields:

| Prediction sigma fed to the model | Value, m | Pk |
| --- | ---: | ---: |
| Truth track (no estimate) | null | 0.84999 |
| Track sigma at `t` | 3.626 | 0.80397 |
| Propagated over the flight (the fix) | 28.69 | 0.04987 |
| Propagated over `engageTimeS` (the code) | 282.21 | 0.00053 |
| Propagated to the effect time | 362.30 | 0.00032 |

## Value chain

1. `attrition.ts:534` builds the shot context with `fusedEstimateAt(ts, t)`: the track as
   held at the assignment time.
2. `intercept.ts:563` sets `releaseS = tS + es.engageTimeS` and solves the aim point from
   that estimate through `interceptFromEstimateProfile`.
3. `shot.ts:319` computes `launchPredictionSigmaM = predictionSigmaAtS(estimate, t +
   es.engageTimeS)`.
4. `intercept.ts:447` routes that through `predictedStateAt`, which calls
   `kalman.predict` with `PROCESS_NOISE_Q`.
5. `kalman.ts:72` and `kalman.ts:78` grow the position variance by
   `2 T P_xv + T^2 P_vv + q T^3 / 3` per axis. `kalman.ts:183` takes the root of the mean
   of the two axis variances.
6. `pk/kinetic.ts:88` roots that against `guidanceNoiseM`. `pk/kinetic.ts:102` evaluates
   the Rayleigh CDF at `lethalRadiusM`. `pk/kinetic.ts:174` multiplies by the saved base
   Pk.

The documented rule is in the
[lane 3.5 brief](../p3-lanes-2026-09-10/briefs/lane-3.5.md): "miss distance sigma = root
sum square of the track prediction error at launch (`missDistanceSigmaM` already roots
the estimate covariance) and `guidanceNoiseM`". The brief's parenthetical points at the
estimate covariance itself. `ShotAccepted.predictionSigmaM` (`shot.ts:53`) is documented
as the sigma at the intercept time. The code uses neither; it introduced a third
quantity.

## Hand derivation

The engine reproduces from the logged covariance and the documented constants. Inputs
for shot 1 are the fused estimate at t = 313.5 s, 689 hits, source `estimate`:
`P_xx` 18.3872, `P_yy` 7.9075, `P_x,vx` 4.5409, `P_y,vy` 2.7285, `P_vx,vx` 2.3127,
`P_vy,vy` 1.6835. Constants: `PROCESS_NOISE_Q` q = 1 m^2/s^3 (`kalman.ts:18`),
`lethalRadiusM` 10 m, `guidanceNoiseM` 2 m, `pk` 0.85, `engageTimeS` 60 s.

At the coded horizon T = `engageTimeS` = 60 s, per `kalman.ts:72` and `kalman.ts:78`:

- var(x) = 18.3872 + 2(60)(4.5409) + 3600(2.3127) + (1)(60^3)/3
  = 18.39 + 544.91 + 8325.72 + 72000 = 80,889.02 m^2
- var(y) = 7.9075 + 2(60)(2.7285) + 3600(1.6835) + 72000
  = 7.91 + 327.42 + 6060.60 + 72000 = 78,395.93 m^2
- sigma = sqrt((80889.02 + 78395.93) / 2) = sqrt(79,642.48) = **282.210 m**
  (engine 282.21)
- miss sigma = sqrt(79,642.48 + 2^2) = **282.217 m**
- P(miss < 10 m) = 1 - exp(-100 / (2 x 79,646.48)) = **0.00062758**
  (engine 0.00062758)
- Pk = 0.00062758 x 0.85 = **0.00053344** (engine 0.000533440)

The process-noise term is 72,000 of 79,642.48 m^2, or **90.40%** of the variance. The
guidance-noise term is 4 of 79,646.48 m^2, or 0.005%.

At the flight horizon T = TOF = 11.253 s, same inputs:

- var(x) = 18.3872 + 2(11.253)(4.5409) + 126.63(2.3127) + (11.253^3)/3
  = 18.39 + 102.20 + 292.84 + 475.06 = 888.43 m^2
- var(y) = 7.9075 + 2(11.253)(2.7285) + 126.63(1.6835) + 475.06
  = 7.91 + 61.40 + 213.18 + 475.06 = 757.49 m^2
- sigma = sqrt((888.43 + 757.49) / 2) = sqrt(822.96) = **28.687 m** (engine 28.69)
- miss sigma = sqrt(822.96 + 4) = **28.757 m**
- P(miss < 10 m) = 1 - exp(-100 / (2 x 826.96)) = **0.05867**
- Pk = 0.05867 x 0.85 = **0.04987** (engine 0.04987)

Shot 2, estimate at t = 395 s, `P_xx` 8.2163, `P_yy` 5.8083, `P_x,vx` 2.6847,
`P_y,vy` 2.0625, `P_vx,vx` 1.7826, `P_vy,vy` 1.4733, TOF 13.643 s: sigma(rel) 279.558 m
and Pk 0.00054361 (engine 0.000543608); sigma(tof) 34.946 m and Pk 0.03398845 (engine
0.033988399).

## Candidate causes, ruled in or out

**(a) The horizon in `shot.ts`. Ruled in. This is the cause.** The 60 s interval is the
assignment-to-physical-release delay (`ShotAccepted.releaseDelayS`, `shot.ts:61`;
`intercept.ts:563`). It is not a dead-reckoning interval. The tracker runs every 0.5 s
step throughout it: the probe shows 689 accumulated hits at the first shot and 1043 at
the fourth, and the fused sigma falls from 3.626 m to 2.541 m across the engagement. A
shooter that holds a 2.5 m track through the delay does not release on a 282 m
extrapolation of a track it stopped listening to 60 s earlier. After release the lead
point is fixed, because the model carries no datalink update and no seeker correction, so
the flight is the interval over which prediction error becomes miss distance.

**(b) Process-noise magnitude. Ruled out as the cause.** `PROCESS_NOISE_Q` = 1 m^2/s^3 is
justified in `kalman.ts:11` at the 0.5 s step, where it adds 0.7 m/s of velocity random
walk and does not inflate a straight track. That justification does not extend to a 60 s
horizon, where the same constant adds 268 m per axis. But the constant is not the defect.
Set q to zero and the coded horizon still gives sigma 87.42 m, miss sigma 87.44 m,
P(within 10 m) 0.00652 and Pk 0.00554: two orders of magnitude below the fallback. The
horizon breaks the model on its own. Set q to zero at the flight horizon and sigma falls
from 28.69 m to 18.65 m, Pk from 0.0499 to 0.1126, so q is worth a factor of 2.3 there
and is a defensible value for a quadcopter that can turn at 33 deg/s and accelerate at
6.9 m/s^2.

**(c) The sensor providing the track. Ruled out.** Two radars fuse: Giraffe 1X at (0, 0)
and KuRFS at (100, 0). First detection is 0.5 s, stable track 1.5 s, hostile declaration
11.5 s. The fused estimate carries 689 hits at the first shot and holds 2.5 to 3.6 m of
position sigma at 1.7 to 2.1 km slant range. The track is good. Nothing about sensor
choice, update rate or track age contributes.

**(d) `lethalRadiusM` and `guidanceNoiseM` in the Coyote entry. Ruled out, and shown to
be inert.** `lethalRadiusM` 10 m is the class median of the one sourced interceptor
warhead radius, the APKWS M151 burst radius from Eglin AFB, and the entry itself records
that Coyote's 1.8 kg warhead against the M151's 3.95 kg puts 10 m "at the generous end".
`guidanceNoiseM` 2 m is a planning factor for a proximity-fuzed round. Both are recorded
with a lognormal spread of 4 dB. Neither can change the result at the coded horizon,
because Pk there scales as the square of the radius over a variance of 79,646 m^2:

| `lethalRadiusM`, m | Pk at miss sigma 282.22 m | Pk at miss sigma 28.69 m |
| ---: | ---: | ---: |
| 0.3 | 0.00000048 | 0.0000462 |
| 4 | 0.0000854 | 0.00818 |
| 10 | 0.00053344 | 0.04986 |
| 25 | 0.00332852 | 0.26745 |

Across the whole plausible range of interceptor lethal radii the coded horizon holds Pk
below 0.0034, far under the doctrine's `pkCommit` of 0.35. The 4 dB spread the library
records on the radius cannot move any run outcome. That is the sense in which the
datasheet value is inert, and it is why `kinetic.verify.test.ts` passes while the engine
fails: the verify test feeds miss sigmas of 1, 5 and 10 m by hand, a regime the live
path never reaches.

**(e) `engageTimeS` itself. Ruled out as the cause, recorded as the amplifier.** 60 s is
an INFERRED planning factor with no provenance row. It is a defensible
decision-to-launch interval. Its only fault is entering the miss sigma at all. Because
the process-noise term grows as T^3, the value sets the severity: reduce it to 10 s and
the coded horizon gives sigma 24.88 m and Pk 0.0656, about what the flight horizon gives
at 60 s. The defect is the horizon, not the number.

## Second defect found: zero time of flight on the layered fixture

Every interceptor event on `layered-acoustic-merops.json` has `tEffectS` exactly equal
to the release time. Time of flight is 0 for all eleven. The cause is a saved-spec gap.
That fixture's Coyote entry holds only `effectorType`, `minRangeM`, `maxRangeM`,
`maxAltitudeFt` and `engageTimeS`. It has no `flyoutSpeedMps` and no `pk`.
`ADOPTED_SEED_KEYS.effector` (`src/model/libraryLifecycle.ts:116`) adopts
`lethalRadiusM`, `guidanceNoiseM`, `seekerAcquisitionRangeM`, `maxFlyoutSpeedMps` and
`boostTimeS`, but not `flyoutSpeedMps`, which predates the list. So on load the fixture
gains the Phase 3 miss-model fields and keeps no flyout speed.

The two halves of lane 3.5 then disagree. `phase3FlyoutProfile`
(`src/playback/intercept.ts:74`) requires a positive `flyoutSpeedMps` and returns null,
so the flight falls back to `interceptFromEstimate` with `averageFlyoutMps` 0, and
`if (v > 0)` leaves the flight time at 0. `kineticEffectProbability`
(`src/playback/pk/kinetic.ts:169`) requires only `lethalRadiusM` and `guidanceNoiseM`,
both adopted, so it takes the physical branch. The interceptor arrives at the instant of
release while its Pk is computed by the physical miss model.

This is invisible on the committed tree, because the coded horizon charges 60 s of coast
whatever the flight time is. It becomes decisive under the fix: with a zero flight time
the fix's horizon is zero, so the miss sigma collapses to the track's own 7.0 to 8.0 m,
Pk rises to 0.41 to 0.49 per shot, and the fixture's Monte Carlo kills mean goes from
0.005 to 4.68. That number would pin an interceptor that teleports.

## Why the fix is not landed

The candidate change is one site, `src/playback/shot.ts:319`:

```ts
const est = ctx.estimate ?? null
const flightS = Math.max(0, intercept.tEffectS - (t + es.engageTimeS))
const launchPredictionSigmaM = est == null
  ? null
  : predictionSigmaAtS(est, est.state.tS + flightS)
```

Measured with that change in the tree: 202 test files, 2,173 tests, 3 failed, all three
in `src/playback/estimate.parity.test.ts`. The three protected truth-path suites, the
two golden fixtures and `kinetic.verify.test.ts` all pass unchanged, because both golden
fixtures pin `truthTracks` and `legacyKineticPk` and `kinetic.verify` supplies its own
sigma.

Five pinned values in `estimate.parity.test.ts` move:

| Pin | Committed | With the fix |
| --- | ---: | ---: |
| Layered trial `report.events` length | 16 | 11 |
| Layered trial kill mass | 0 | 4 |
| JIATF 200-replicate leakers mean | 1 | 0.895 |
| JIATF 200-replicate kills mean | 0 | 0.105 |
| Layered 200-replicate kills mean | 0.005 | 4.68 |

None of these is hand derivable. The two Monte Carlo means are averages of Bernoulli
kill draws over 200 replicates with a per-replicate sampled spec. The layered event
count falls out of the doctrine re-engagement loop once kills start landing. The task
constraint and the test file's own header both forbid moving them on this basis: the
header states that "a later physics change moves one of them only with a replacement
named in its slice brief", and no replacement is named. The layered numbers would also
enshrine the zero-flight-time artifact above.

The engine is therefore unchanged. The fix is specified, derived and measured here for
the session that recaptures the anchors.

## Model limit: no terminal-homing term

Even with the correct horizon the physical model does not reach the planning fallback,
and it should not be expected to without a new term.

`seekerAcquisitionRangeM` gates feasibility only. `seekerAcquisitionAfterEnd`
(`src/playback/intercept.ts:207`) rejects a capped intercept whose credited flyout ends
before the seeker would acquire. Nothing anywhere reduces the miss sigma for a
seeker-equipped round. So every interceptor in the library flies to a lead point fixed at
release and is charged the full prediction error over its flight.

The Coyote entry records `seekerAcquisitionRangeM` as UNKNOWN at layer L3: the Block 2
seeker type and its acquisition range are not published, and the RF seeker in open
sources belongs to Block 1B. The same entry annotates `guidanceNoiseM` as "terminal
guidance noise", a term that presupposes homing the model does not apply. The lane 3.5
brief intended `seekerAcquisitionRangeM` to gate the terminal phase, and with the field
null there is no terminal phase to gate.

The consequence, at the flight horizon and with the datasheet values as recorded:

- Coyote, 10 m lethal radius, 11 to 14 s flight against a 12 m/s quadcopter: miss sigma
  28.7 to 35.0 m, Pk 0.034 to 0.050. The fallback gives 0.556 to 0.564.
- Anvil, 0.3 m lethal radius: Pk 0.0007 under any horizon. A hit-to-kill radius needs
  sub-meter miss, which a lead-point model cannot produce at all.

The doctrine interaction matters as much as the Pk. With `launchPolicy` `pk-commit` and
`pkCommit` 0.35, `launchPolicyReleases` (`src/playback/attrition.ts:700`) declines every
physical shot and the salvo only fires at the deadline. That is why the fallback opens at
t = 29 s and 3,661 m slant while the physical model waits until t = 313.5 s. Pk 0.05
still does not clear 0.35, so the horizon fix alone does not restore early engagement.
Only a terminal-guidance term would.

## Recommendations

1. Do not change `lethalRadiusM`, `guidanceNoiseM` or `engageTimeS` in the Coyote entry.
   All three are correctly recorded and graded. None is the cause.
2. Land the `shot.ts` horizon fix as its own task, with the replacement anchors named in
   its brief. Fix the `flyoutSpeedMps` adoption gap first, or recapture the layered
   fixture's anchors knowing they describe a zero-flight-time interceptor.
3. Until then the default physical kinetic model should not be used to size a kinetic
   engagement on any laydown. `legacyKineticPk` is the defensible planning choice for
   that question, and the Physics tab already offers it. The fixture should not change.
4. A laydown that yields a valid physical result today needs a truth-source track
   (`truthTracks`), which returns a null prediction sigma and Pk 0.85. That is the
   configuration the protected suites use, and it measures the distance falloff and the
   base Pk, not the miss model.
5. Treat `kinetic.verify.test.ts` as validating the Rayleigh closed form, not the
   integrated path. A datasheet validation of the integrated model needs the miss sigma
   the engine actually produces.

## Checks

- `npm run check` on the tree as delivered: 202 test files, 2,173 tests, all passed;
  docs, engine CLI, library, schema, typecheck, lint and build passed.
- `npm run build && npm run check:bundle`: entry 361,302 bytes gzip against the 364,000
  budget. Unchanged from `main`, as expected with no source change.
- `estimate.parity.test.ts`, `sensitivity.parity.test.ts`, `accuracy.verify.test.ts`,
  `convergence.verify.test.ts`, `kinetic.verify.test.ts` and
  `src/playback/__fixtures__/` are unchanged and pass. No pinned value moved.

## Follow-ups, not selected

- `flyoutSpeedMps` is missing from `ADOPTED_SEED_KEYS.effector`, so every saved board
  older than that field runs its interceptors at zero flight time while the physical Pk
  model still applies. `phase3FlyoutProfile` and `kineticEffectProbability` should agree
  on the fallback condition.
- `uncertainty-crosswalk.md` describes `effector.engageTimeS` as "release-to-effect time
  for every channel". For a kinetic effector it is assignment-to-release, and the flyout
  follows it.
- `ShotAccepted.predictionSigmaM` is documented as the sigma at the intercept time and is
  carried to the caller, but no Pk path reads it; `shot.ts` computes its own sigma
  instead.
- The Coyote entry records a 4 dB lognormal spread on `lethalRadiusM` and on
  `guidanceNoiseM`. Neither spread can move a result while the horizon defect stands, so
  both fields read as sensitive in the Systems tab and are not.
