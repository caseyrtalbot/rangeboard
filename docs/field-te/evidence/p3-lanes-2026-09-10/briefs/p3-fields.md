# Phase 3 new library fields (orchestrator contract, 2026-09-10)

Fixed before the 3.a contract so the contract and the data lanes agreed on names and
units; every key is now in `src/model/types.ts` and `UNIT_BY_FIELD`. Every key below is a numeric `LibraryField` unless marked
attribute. Units not yet in `UNIT_BY_FIELD` (scripts/build-library.mjs) are new and 3.a
adds them; `ALLOWED_UNITS` derives from the table. New units: `deg/s`, `mps2`, `um`, `mm`,
`mK`, `dBm`, `mil`, `rpm`, `kW`, `ratio`, `urad`, `V/m`.

Already in the library and NOT added again: sensor `elevationDeg` (elevation coverage),
`rangeAccuracyM`, `azimuthAccuracyDeg` (also the RF direction-finding accuracy and the
acoustic bearing accuracy), `elevationAccuracyDeg`, `falseAlarmRatePerScan`, `eoBand`,
`refAcousticDb`; uas `acousticDb` (source level, dB re 20 uPa at 1 m), `linkBands`;
effector `flyoutSpeedMps`, `eirpW`, `sectorDeg`; c2 `decisionLatencyS`,
`decisionLatencySigmaDb`, `operatorTrackCapacity`.

## Sensor (SensorSpec, spec 'sensor')

| Key | Unit | Applies to | Meaning |
| --- | --- | --- | --- |
| `pulsesPerDwell` | `count` | radar | pulses integrated per dwell |
| `dwellTimeS` | `s` | radar | dwell time on target per scan; one of the two may be null |
| `pixelPitchUm` | `um` | eo-ir | detector pixel pitch, micrometres, for the band of record |
| `focalLengthMm` | `mm` | eo-ir | focal length at the narrow zoom stop, millimetres |
| `detectorPixelsH` | `count` | eo-ir | horizontal detector pixel count |
| `fovDeg` | `deg` | eo-ir | horizontal field of view at the narrow zoom stop |
| `mrtdMk` | `mK` | eo-ir thermal | minimum resolvable temperature difference, millikelvin |
| `receiverSensitivityDbm` | `dBm` | rf | receiver sensitivity at the quoted band |
| `geolocationMinNodes` | `count` | rf | nodes needed to geolocate (2 AOA cross, 3 TDOA); null when bearing only |
| `noiseFloorDb` | `dB` | acoustic | array detection threshold, dB re 20 uPa |

A key that does not apply to a sensor type is omitted from that file (not written as null).

## Threat (UasSpec, spec 'uas')

| Key | Unit | Meaning |
| --- | --- | --- |
| `maxTurnRateDegS` | `deg/s` | maximum sustained turn rate |
| `climbRateMps` | `mps` | maximum climb rate |
| `maxAccelMps2` | `mps2` | maximum longitudinal acceleration |
| `radiatedPowerW` | `W` | control or video link radiated power (EIRP) |
| `linkProtocol` | attribute | `LinkProtocol`, one of wifi, ocusync, lightbridge, elrs, crossfire, analog-fpv, cellular, proprietary, fiber, none |

## Effector (EffectorSpec, spec 'effector')

| Key | Unit | Applies to | Meaning |
| --- | --- | --- | --- |
| `seekerAcquisitionRangeM` | `m` | interceptor | seeker acquisition range |
| `lethalRadiusM` | `m` | interceptor, net | lethal or capture radius |
| `guidanceNoiseM` | `m` | interceptor | terminal guidance noise, 1 sigma miss contribution |
| `maxFlyoutSpeedMps` | `mps` | interceptor | peak speed of the flyout profile (`flyoutSpeedMps` stays the average) |
| `boostTimeS` | `s` | interceptor | time to reach peak speed |
| `dispersionMils` | `mil` | gun | round dispersion, 1 sigma, milliradians |
| `fireControlErrorMils` | `mil` | gun | fire control aim error, 1 sigma, milliradians |
| `burstRounds` | `count` | gun | rounds per burst |
| `rateOfFireRpm` | `rpm` | gun | cyclic rate of fire |
| `muzzleVelocityMps` | `mps` | gun | muzzle velocity |
| `outputPowerKw` | `kW` | de | optical output power |
| `beamQualityM2` | `ratio` | de | beam quality M squared |
| `jitterUrad` | `urad` | de | pointing jitter, 1 sigma, microradians |
| `apertureM` | `m` | de | output aperture diameter |
| `dwellToEffectS` | `s` | de | dwell to effect on a Group 1 quadcopter at the quoted range (condition names the range) |
| `fieldStrengthVm` | `V/m` | hpm | field strength at `fieldStrengthRangeM` |
| `fieldStrengthRangeM` | `m` | hpm | range the field strength is quoted at |
| `beamwidthDeg` | `deg` | hpm | half-power beamwidth |
| `rechargeS` | `s` | hpm | recharge time between shots |

Susceptibility thresholds per airframe class (HPM) and dwell scaling per airframe class
(DE) are constants in the physics lane, not library fields.

Range-type rule: `seekerAcquisitionRangeM`, `lethalRadiusM` and `fieldStrengthRangeM` are
not entries in `RANGE_TYPE_BY_FIELD`; they need no `rangeType`.

## Evidence rule for the research lanes

Priority of evidence (blueprint section D): (1) advertised OEM data with its condition,
L1, grade MANUFACTURER_CLAIM, `source`, `url`, `date`; (2) independent open reference,
L1, grade REPORTED (CORROBORATED with two sources); (3) like-system estimate, L2, grade
INFERRED, `estimator: 'class-median'` with a `comparisonSet` of sourced ids, or
`estimator: 'planning-factor'` with the basis in `note`; (4) nothing defensible: `value:
null`, L3, UNKNOWN, with a `note` that says why. Never invent a number. Match the style of
the Phase 2 entries (see `docs/inventory/changelog.md` section "2026-09-10, Phase 2
accuracy fields" and any sensor file's `rangeAccuracyM`).
