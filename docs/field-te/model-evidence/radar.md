# Radar dossier

Status: E1 evidence baseline, 2026-09-05. Source tree `d8a76f1`; numerical source files unchanged by this lane. [Index and verification](README.md).

## Intended quantity and applicability

Model single-scan detection probability and a threshold range, then pass observations to scan/track logic. Applicable mathematically to the implemented square-law, single-look reduced model with specified RCS and fluctuation case. Published range comparisons are conditional on the calibration target, configuration and assumptions below; no independent detection-to-effect validation exists.

## Equations and units

[radarPd.ts](../../../src/analysis/radarPd.ts#L63) implements linear SNR `S=S0*(sigma/sigma0)*(r0/r)^4*fenv^4`, where S0 is the inverse Pd curve at placard Pd/Pfa/case. Ranges are slant meters, RCS square meters; dBsm converts as `10^(dBsm/10)`. Swerling 1 uses `Pd=Pfa^(1/(1+S))`; Swerling 3 uses `exp(-v/d)*(S*(1+v/d)+2)/(S+2)`, `v=-ln(Pfa)`, `d=1+S/2`. Swerling 0 uses the algebraic inverse of the N=1 Albersheim approximation. `rangeForPd` inverts the fourth-root relation. Instrumented range is a hard reporting cap ([sensorEnv.ts](../../../src/analysis/sensorEnv.ts#L142)); elevation/horizon eligibility remains separate.

## Pedigree, PFs and calibration

The implementation cites Mahafza and Albersheim/Richards; those full texts were not retrieved in E1. [Historical engine plan](../../engine-refactor/PLAN.md#L768) lists broader radar references without implementing every method. [types.ts](../../../src/model/types.ts#L126) supplies placard Pd=0.5, Pfa=1e-6, Swerling 1 PF; [rcsFactors.ts](../../../src/model/rcsFactors.ts#L33) supplies reference RCS=0.01 m² and group tiers 0.01/0.05/0.2/1/5 m². Actual per-model rows and omissions are retained in [seed-inventory.json](seed-inventory.json). Missing source conditions are assumptions, even when the nominal range is sourced. A source's false alarms/day is not per-look Pfa without an opportunity count.

Calibration sets S0 to pass through the nominal placard. Under matched Swerling and Pd the range is exactly `r0*(sigma/sigma0)^0.25`; equality at that point is calibration. `rangeBasis:'planning'` bypasses target/Pd scaling; provenance basis alone does not choose that branch.

## Published comparison reconciliation

Original PDFs were saved before extraction; the relevant pages were rendered and inspected. See [source register](sources.md).

| Case | Actual comparison and limit |
| --- | --- |
| Blighter A400 | M10S free-space table: seed anchor 2730 m at 0.01 m²; five other table rows check the range relation, not measured Pd. The test's 2% allowance is an existing regression tolerance. Seed elevation combines a 30° W20S envelope with M10S range; configuration applicability is unresolved. The sheet's scan modes do not establish the PF 2 s A422 revisit. |
| EchoShield | Published bands are typical **tracking** ranges, adopted as `detectRangeM`. Midpoint-RCS predictions lying inside bands do not validate first detection. The 10 Hz figure is track output, not an independent scan opportunity rate. |
| EchoGuard | Published sUAV ranges are lower bounds (>1 km Phantom 4, >1.4 km Matrice 600). The 1495 m prediction using M350 PF RCS is 6.8% above the latter bound, not a measured error. Back-solving RCS from the same two bounds would be calibration under assumed equalities, not an independent M600 signature measurement. |

The new source evidence supports tightening descriptions of these tests; no numerical source or fixture was changed. R-F-16 remains a proposed seed decision with an independence limitation.

## Numerical error and verification

Swerling 3 inverse uses bracket doubling plus at most 200 halvings; closed-form tests compare pinned numerical references. Albersheim's code-documented domain is Pd 0.1–0.9, Pfa 1e-3–1e-7, about 0.2 dB approximation; E1 has not independently rederived that global bound. Outside it the logistic extrapolates, including a zero-SNR floor around 0.017 at Pfa 1e-6 instead of Pfa. Do not interpret bounded arithmetic as verified tail accuracy.

Rerun [radarPd.test.ts](../../../src/analysis/radarPd.test.ts), [sensorEnv.test.ts](../../../src/analysis/sensorEnv.test.ts), [validation.verify.test.ts](../../../src/analysis/validation.verify.test.ts) and [scanModel.test.ts](../../../src/playback/scanModel.test.ts). The Blighter radial inbound fixture starts at 4330 m and checks first detection at 40 s/2730 m under explicitly pinned altitude, phase and 2 s scan assumptions. It provides the outside-range model case absent from the old browser probe. Constant-Pd convergence cases are separate from range-law checks.

## Omissions, unsupported conditions and next data

No explicit pulse integration, clutter, Doppler filters, aspect/frequency-dependent RCS, false-target generation or scan correlation is modeled. The scalar environment term has no frequency-resolved atmospheric basis. E2 needs hardware/firmware/antenna/mode, scan schedule, Pd/Pfa definition, independent target signature, and matched reference measurements. Preserve calibration and comparison partitions; do not tune RCS to remove the proxy residual. No operational tolerance is inferred from a passing datasheet fixture.
