# R0 numerical baseline, 2026-09-07

## Capture summary

Commit: `5076ecc16edb7bfa6c1260d1d82ff7fb1dad88d9`
Capture date: 2026-09-07

Fixtures:

- docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json
- src/playback/__fixtures__/detection-outside-rings.json

Neither fixture is RUN-0004. No RUN-0004 reproduction is claimed.

## Capture procedure

The probe is preserved as `numerical-capture.ts.txt` and is not a tracked test.
Copy it to `src/playback/r0.parity.capture.test.ts`, run the command, then remove the copy.
Re-run 2026-09-07 at the same commit: byte-identical.

```sh
npx vitest run --dir src src/playback/r0.parity.capture.test.ts
```

Deterministic assessments: `assessAllThreats` and `resolveEngagements`.
Aleatory Monte Carlo: `runReplicates` with `uncertainty: 'aleatory'`.
Total uncertainty Monte Carlo: `runReplicates` with `uncertainty: 'total'`.
Sensitivity: `runSensitivity`.

## Fixture settings

Both fixtures use seed 4821 and runMode "monte-carlo".
Test harness: replicates: 4 per fixture, draw-policy pipeline intact.

Firing scenario:

- Seed: 4821
- Replicates: 4
- Uncertainty modes tested: aleatory, total

Detection-outside-rings fixture:

- Seed: 4821
- Replicates: 4
- Uncertainty modes tested: aleatory, total

## Byte stability verification

First run output: numerical-baseline.json
Second run output: temporary copy at /private/tmp/numerical-baseline-verify.json

```sh
cmp docs/field-te/evidence/r0-playback-realism-2026-09-07/numerical-baseline.json \
  /private/tmp/numerical-baseline-verify.json
```

Result: Files are byte-identical

## Current-source test counts

Test command: `npx vitest run --dir src`

Result: Test Files 108 passed (108), Tests 1446 passed (1446)

## Headline values per fixture

### Firing scenario

Deterministic assessments:

- Expected kills: 0.9600 (rounded from 0.9599693850480352)
- Residual survival: 0.0400
- Reported leakers: 0.0400

Aleatory MC (4 replicates):

- Mean leakers at end: 0.00

Total uncertainty MC (4 replicates):

- Mean leakers at end: 0.00

Sensitivity analysis (top entries by swing):

All sensitivity swings: 0.00 (no variation in outcome leaker count)

### Detection-outside-rings fixture

Deterministic assessments:

- Expected kills: 0.9313 (rounded from 0.9313108025321972)
- Residual survival: 0.0687
- Reported leakers: 0.0687

Aleatory MC (4 replicates):

- Mean leakers at end: 0.00

Total uncertainty MC (4 replicates):

- Mean leakers at end: 0.00

Sensitivity analysis (top entries by swing):

All sensitivity swings: 0.00 (no variation in outcome leaker count)

## Evidence status

Fixed-ID numerical baseline captured successfully. Draw-policy pipeline
preserves existing calculations. Both fixtures deterministic and MC results
recorded. Sensitivity analysis shows zero swing across all uncertain fields.
Byte-stable test harness confirms reproducibility at current source.
