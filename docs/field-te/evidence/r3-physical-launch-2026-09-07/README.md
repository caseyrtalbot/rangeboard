# R3 physical launch timing, 2026-09-07

Stage R3 of the [playback realism proposal](../playback-realism-plan-2026-09-07.md).
Before captures ran on clean `main` at `39b6b13`; after captures ran on its uncommitted
R3 working tree. Scope is physical launch timing only. No commit or push was performed.

## Implemented behavior

New engagement events record `tReleaseS = tS + resolved engageTimeS`. Assignment `tS`,
effect `tEffectS`, magazine/cooldown accounting, draw keys and outcomes are unchanged.
Playback and charts share the pure `engagementTiming.ts` resolver. Legacy events use
explicit release metadata or the captured effector spec, including its engine zero-delay
default; missing or invalid timing stays unavailable. Raw legacy exports keep omissions.

Launchers show PREP during preparation and LAUNCH ? when timing is unavailable. Kinetic
rounds move only over a positive release-to-effect interval. Beam and EW channels have
no traveling round; zero-duration beam/dwell effects retain the 0.6 s display-only pulse.
The effector pane distinguishes ASG, REL and FX marks (combined at coincident times)
and preparation/channel spans;
legend membership is censored to the execution horizon. Export metadata names `tS`,
`tReleaseS`, `tEffectS` and `shipIdx` correctly and counts release-timing availability.

## Browser evidence

The isolated Playwright Chromium context used owned port 5443, a 1400 by 900 viewport
with a 320 px panel, and a 1280 by 800 reduced-motion check. Port 5174 and the user's
saved scenario were untouched. Fixture SHA-256:
`fb62cc6fce749f73f0809f7cf26962c81184d4e8d002005a6cc0277b11cffaa9`.
The base fixture is the onboarding firing scenario, not RUN-0004. The beam case changes
only the captured Coyote spec to DE, no flyout speed and one magazine unit as a controlled
channel-rendering fixture; it makes no claim about that system's actual capability.

[Before JSON](before/r3-capture.json) and [after JSON](after/r3-capture.json) retain ten
paired captures at assignment, preparation, release, midflight and effect for kinetic
and beam cases. Scripts are [before](r3-capture-before.mjs.txt) and
[after](r3-capture-after.mjs.txt). Screenshots are alongside their JSON.

| Case | Before | After |
| --- | --- | --- |
| Kinetic assignment 20 s, release 80 s, effect 111.674256233 s | Round begins at assignment | PREP until release |
| Kinetic at 79 s | Round at progress 0.643583078 | No round; PREP |
| Kinetic at 80 s | Round at progress 0.654491266 | Round at progress 0 |
| Kinetic at 95.837128116 s | Round at progress 0.827245633 | Round at progress 0.5 |
| Beam assignment 17 s, release/effect 77 s | Beam during preparation, gone at release | No early beam; pulse at 77 s |

After evidence also records actual 1x and 5x playback across 78–82 s, after observing
through 82 s at 30x and rewinding. This uses the real frame clock and store actions;
it does not promote a preview into observation. Both contexts report zero page/console
errors. The release legend was inspected at both sizes; panel overflow is recorded.
The harness initially timed out because resume clamps to the observed horizon; it was
corrected to observe the interval before rewinding. No application change was needed.

## Numerical and test evidence

The fixed-ID R0 harness captured deterministic assessments/report, aleatory MC, total MC
and sensitivity for both fixtures with seed 4821 and four replicates. Preserved files:
[numerical-before.json](numerical-before.json),
[numerical-after-node24.json](numerical-after-node24.json),
[numerical-after-node22.json](numerical-after-node22.json), and
[numerical-capture.ts.txt](numerical-capture.ts.txt). Comparison results and hashes are
in [numerical-parity.json](numerical-parity.json). Copy the harness to a scratch Vitest
file and select a fresh output filename when recapturing; preserve these baseline bytes.

- Node 24.12.0 before/after: every previous field is exactly equal after removing only
  `tReleaseS`. All eight deterministic records add precisely the captured 60 s delay.
- Node 22.23.1 after: every previous field equals the R0 baseline after removing only
  `tReleaseS`. Comparing Node 24 directly to R0 exposes tiny runtime floating-point
  differences; matching Node 22 removes them.
- Focused lane checks: timing/canvas 189 tests, chart/export 48 tests, detail 19 tests.
- `npx vitest run --dir src`: 124 files, 1599 tests passed.
- Schema generation produced no descriptor change; typecheck passed.
- `npm run check` under Node 22.23.1 passed: 225 files, 3014 tests in broad discovery
  (includes ignored checkouts); 63 existing lint warnings; production build passed.
- Source review fingerprints were refreshed with `npm run docs:review` on 2026-09-08
  UTC, which was still 2026-09-07 in the local America/Los_Angeles timezone.
- Independent integration review covered all 12 R3 consumer rows and found no actionable
  defect; it independently confirmed numerical equality excluding only release metadata.

Coverage includes moving/stationary targets, fractional release times, simultaneous
committed late/missed rounds after target expected defeat, kinetic zero-flight intervals,
DE/HPM/EW durations and pulses, and legacy available/unavailable/invalid timing. The
stationary engine test reuses a controlled eligibility window because a zero-length path
alone has no full-sweep duration; it isolates release and intercept kinematics.

## Stop point

R4 trial engine and lifecycle remains unstarted. The temporary continuation packet selects
R4 only. Existing R1 disabled-asset definedness and R2 accessibility-only horizon captions
remain separate follow-ups. The unrelated central handoff is unchanged.
