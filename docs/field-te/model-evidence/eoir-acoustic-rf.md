# EO/IR, acoustic and passive RF dossier

Dated evidence dossier, 2026-09-05, against source tree `d8a76f1`. Source and tests decide current behaviour. [Index and verification](README.md).

## Intended quantity and applicability

Estimate a reduced detection/classification range and eligibility gate from an existing placard. This supports planning comparisons with known target class and explicitly assumed signatures. It does not compute image quality, microphone-array performance, RF receiver sensitivity or classification error distributions.

## Equations, units, frame and time

[sensorEnv.ts](../../../src/analysis/sensorEnv.ts#L236) applies EO/IR span ratio `D/Dref`, a thermal class multiplier when thermal carries, and visible-night factor when enabled. Dual-band uses visible by day and thermal by night. Environment multiplies range and visibility caps it. Ground bearing defines sector/cue geometry; distance eligibility uses slant meters. Classification range follows the same target/environment scaling where present. Time outcomes come from DT and role/cue logic in the track dossier.

Acoustic solves `20*log10(R/Rref)+alpha*(R-Rref)/1000=deltaDb`; alpha=5 dB/km PF. Delta is source-level difference relative to the placard target, not received SNR. Equal levels return Rref. Bisection uses 80 iterations after bracketing; the weaker-source lower bracket is Rref*1e-9. Noise/environment multipliers apply after this solve. This is a calibrated loss difference, not a measured site noise model.

RF requires an emitting nav mode (`rf-manual`/`mixed`) and overlap between modeled control/video bands and receiver coverage; GNSS reception is not a transmitted target signal. Missing receiver bands default to all modeled bands. There is no RCS/span scaling; vendor urban-range override replaces the generic urban multiplier. Range is still a geometric cutoff.

## Inputs, pedigree, PF/defaults and calibration

[signatureFactors.ts](../../../src/model/signatureFactors.ts) supplies span group tiers 0.4/1.2/3/10/20 m, acoustic levels 70/80/95/100/105 dB re 20 µPa at 1 m, thermal class factors 0.7/0.85/1. Visible-night factor is 0.2 PF; absent EO band is dual. These are PFs, not inferred measured signatures. Per-model span/range rows are in [seed inventory](seed-inventory.json). The acoustic level represents broadband source data while alpha is a fixed 1 kHz planning value; a single coefficient cannot represent a real broadband spectrum.

The current formula cites Johnson-style angular-size reasoning; no optics/resolution/contrast calibration is provided. The acoustic nominal range defines an implicit received threshold at one source level; no microphone/noise-floor data establish it. RF nominal range may be sourced but unknown waveform/power/receiver conditions limit portability. R-F-4 correctly leaves the Wisp unspecified-UAS range and Spynel human range unapplied to a small-UAS quantity.

The retrieved [COURAGEOUS paper](../evidence/model-evidence-2026-09-05/courageous.pdf) §3.1/Table 1 discusses technology-dependent light, weather, cueing and interference limitations. It supplies context, not RangeBoard's scalar factors or a held-out comparison dataset.

## Verification, numerical error and independent comparison

[sensorEnv.test.ts](../../../src/analysis/sensorEnv.test.ts) checks linear span scaling, thermal/day/night branches, visibility caps, equal acoustic levels, short/long range loss behavior, RF silence/bands and urban replacement. E1 reran it. The acoustic solve is monotone for positive range and alpha; 80 bisections constrain numerical root error to the bracket width divided by 2^80 before floating-point limits, provided the root is actually bracketed. Extreme inputs outside that condition have no claimed bound. Missing target/planning-range paths preserve nominal scaling by design.

Independent hardware comparison: none for these three families. Existing tests verify laws and gates selected by the model; their expected factors do not measure the realism of those factors. Fidelity copy currently says acoustic has no atmospheric absorption, which contradicts alpha=5 in the equation. Historical inventory notes also predate per-threat acoustic fields and per-band night behavior; preserve those notes as history.

## Omitted mechanisms, unsupported conditions and data needs

EO/IR needs optics, pixel pitch/resolution, spectral response, integration time, target critical dimension/aspect/contrast, atmospheric transmission and detector/observer criterion before a fidelity increment. Span alone cannot predict recognition/identification, thermal crossover or glare. The code's named Koschmieder cap is a hard cutoff; it does not calculate contrast extinction or wavelength-dependent transmission.

Acoustic needs spectra/directivity, sensor response/array geometry, background spectra, temperature/humidity/wind profile and obstruction data; ceiling-only eligibility does not establish propagation through every obstacle. Passive RF needs emission duty cycle, waveform/frequency hopping, transmit EIRP, receive antenna/polarization, sensitivity/detection criterion and propagation. RF-silent means silent under the chosen navigation abstraction, not a survey of all incidental emissions. E2 should retain these unsupported conditions explicitly and define comparison quantities before collecting data.
