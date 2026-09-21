# Flight horizon beside the Phase 3 comparison

Measured 2026-09-21 on local `main` at `1582b88`, with the flight horizon in
`src/playback/shot.ts` uncommitted. This note sits beside
[comparison.md](comparison.md). It does not replace that gate capture.

The miss sigma is `predictionSigmaAtS` at the estimate time plus
`max(0, intercept.tEffectS - releaseS)`. `engageTimeS` does not enter that call.
Coyote `lethalRadiusM`, `guidanceNoiseM`, and `engageTimeS` are unchanged. No
terminal-homing term was added.

Seed 4821, physics stripped, the same path as `src/playback/estimate.parity.test.ts`.
Monte Carlo is 200 aleatory replicates. Before values are the expects still in
that file. Those expects were not edited.

| Pin | Before | After |
| --- | ---: | ---: |
| Layered trial `report.events` length | 11 | 11 |
| Layered trial kill mass | 1 | 1 |
| Layered 200-replicate kills mean | 1.1 | 1.115 |
| JIATF 200-replicate leakers mean | 1 | 0.895 |
| JIATF 200-replicate kills mean | 0 | 0.105 |

The layered kills mean differs from both 1.1 and 4.68. The 4.68 figure is the
zero-flight candidate in the
[kinetic record](../kinetic-zero-kill-2026-09-15/README.md) and is not a pin.

The two trial rows still match their expects. The three means do not. In
`estimate.parity.test.ts` the JIATF kills expect does not run, because the
leakers expect fails first. The measured kills mean is 0.105, which would fail
`toBeCloseTo(0, 9)`.

These quantities did not move: layered leakers mean 0, layered firm-track mean
1.5 s, JIATF firm-track mean 505.0625 s, JIATF events 2, JIATF kill mass 0,
layered tracks 14,192, JIATF tracks 3,168.

This is a regression measurement of the estimate path. It is not field
validation of the laydown.
