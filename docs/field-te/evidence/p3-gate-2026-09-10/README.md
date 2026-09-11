# Calibration Phase 3 gate evidence

Captured 2026-09-10 on local `main`, with Phase 3 lane merges through `576371e` and the
orchestrator integration changes in the working tree. Nothing was pushed.

## Delivered models

| Lane | Merge | Model and validation |
| --- | --- | --- |
| 3.1 target flight | `14d31d5` | Point-mass acceleration, bounded waypoint turns and wind drift; analytic arc and DJI Mavic 3 figure |
| 3.2 passive RF | `336cc0d` | Link budget, signal-to-noise direction finding and multi-node bearing geometry; RF-360 and ARDRONIS ranges |
| 3.3 EO/IR | `c56c3f2` | Johnson DRI and Beer-Lambert extinction; Spynel-S 6000 detect anchor with the recognize-ratio deviation retained |
| 3.4 radar dwell | `56ddb80` | Noncoherent pulse integration; three Shnidman cases with prior Marcum-Q pins unchanged |
| 3.5 kinetic | `f764a6b` | Interceptor miss-radius and projectile burst models; APKWS radius table and Rheinmetall timeline |
| 3.6 beam | `576371e` | Optical fluence/dwell and HPM field/beamwidth/recharge; Iron Beam anchor and analytic HPM threshold |

The integration routes scenario switches through sensor, track, flight and shot consumers;
uses the same limited-flight sampler for assessment, playback, paths and intercepts; groups
simultaneous RF nodes for a shared bearing solution; charges modeled gun rounds and beam
dwell/recharge; and records all physical model tags. The previously completed Physics tab
now describes active models rather than pending reservations.

## Numerical boundary

The three protected suites remain the contract for the switch-pinned truth path. The
default estimate path changed by design and was recaptured only after the six lanes were
integrated. See [comparison.md](comparison.md). The layered fixture's lower leaker count is
caused by no-arrival classifications after bounded flight; it is not evidence of better
defeat, as the same capture reduces mean kills from 6.88 to 0.005.

## Known limits

- `FlightPath` has no altitude profile, so the sourced climb-rate field is recorded but
  unused; no climb is invented.
- Fixed Johnson 1/4/8-cycle thresholds reproduce Spynel detection but give 1.5 km
  recognition against the vendor's 2 km claim. The vendor publishes no identification
  value; 750 m is analytic only.
- Iron Beam has a sourced 2 dB spread on `dwellToEffectS`, but that field is absent from
  runtime provenance ordering and the parameter-basis table. The event-level model uses
  the documented 2 dB default fluence spread until that metadata is wired.

## Gate results

- `npm test`: 186 files and 2,069 tests passed in 29.55 seconds.
- Protected parity: `sensitivity.parity.test.ts`, `accuracy.verify.test.ts` and
  `convergence.verify.test.ts`, 28 tests passed without changing their anchors.
- Default estimate parity: four recaptured tests passed after all six lanes were wired.
- Type checking and runtime-schema checks passed. The engine CLI's two pooled-run checks
  passed; the library check passed for 90 models, 1,027 fields and 8 derived classes.
- Lint passed. The new unreachable-code warning found during integration was removed;
  the repository's prior React warnings remain.
- Production build passed. `check:bundle` measured the gzip-9 entry at 358,965 bytes
  against 360,000 and initial JavaScript plus CSS at 374,451 bytes against 400,000.
- The complete `npm run check` passed after documentation review.

## Browser

An isolated Playwright session ran the empty-board trial on port 5391. At 1440 by 900 and
1280 by 800, the Physics modal contained nine checkboxes, had no horizontal overflow and
kept every row reachable through its vertical scroll. `noFlightLimits` and
`legacyBeamPk` survived a reload. The real worker completed `RUN-0001`; Outcome's Manifest
showed `physicsSwitches: ["noFlightLimits","legacyBeamPk"]`, `fidelityFloor: fallback`
and `producer: browser`. The session reported zero console warnings and zero errors.

Screenshots: [Physics at 1440 by 900](physics-1440.png),
[lower controls at 1280 by 800](physics-bottom-1280.png), and
[the completed fallback manifest](manifest-switches-1280.png).
