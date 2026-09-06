# Radar dossier

Dated evidence dossier, 2026-09-05, against source tree `d8a76f1`. Source and tests decide current behaviour. [Index and verification](README.md).

## Intended quantity and applicability

Model single-scan detection probability and a threshold range, then pass observations to scan/track logic. Applicable mathematically to the implemented square-law, single-look reduced model with specified RCS and fluctuation case. Published range comparisons are conditional on the calibration target, configuration and assumptions below; no independent detection-to-effect validation exists.

## Equations and units

[radarPd.ts](../../../src/analysis/radarPd.ts#L63) implements linear SNR `S=S0*(sigma/sigma0)*(r0/r)^4*fenv^4`, where S0 is the inverse Pd curve at placard Pd/Pfa/case. Ranges are slant meters, RCS square meters; dBsm converts as `10^(dBsm/10)`. Swerling 1 uses `Pd=Pfa^(1/(1+S))`; Swerling 3 uses `exp(-v/d)*(S*(1+v/d)+2)/(S+2)`, `v=-ln(Pfa)`, `d=1+S/2`. Swerling 0 uses the algebraic inverse of the N=1 Albersheim approximation. `rangeForPd` inverts the fourth-root relation. Instrumented range is a hard reporting cap ([sensorEnv.ts](../../../src/analysis/sensorEnv.ts#L142)); elevation/horizon eligibility remains separate.

## Pedigree, PFs and calibration

The implementation cites Mahafza and Albersheim/Richards; those full texts were not retrieved in E1. The [standards table](../../ENGINEERING_REFERENCE.md#9-standards-referenced-by-model-tags) lists broader radar references without implementing every method. [types.ts](../../../src/model/types.ts#L126) supplies placard Pd=0.5, Pfa=1e-6, Swerling 1 PF; [rcsFactors.ts](../../../src/model/rcsFactors.ts#L33) supplies reference RCS=0.01 m² and group tiers 0.01/0.05/0.2/1/5 m². Actual per-model rows and omissions are retained in [seed-inventory.json](seed-inventory.json). Missing source conditions are assumptions, even when the nominal range is sourced. A source's false alarms/day is not per-look Pfa without an opportunity count.

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

## E2 study, 2026-09-05

Source tree `5799d1a`, no engine source changed. Probe and printed results:
[evidence/e2-radar-2026-09-05](../evidence/e2-radar-2026-09-05/) (`e2radar.study.test.ts.txt`,
`results.json`). Independent numerics in the probe: the nonfluctuating single-pulse Pd as the
Marcum Q by quadrature of the Rician density (scaled Bessel I0, asymptotic above z 30); the
Swerling 3 single-pulse Pd as that Marcum Q averaged over the 4-dof chi-square target; the
fourth-root law against the Blighter A400 free-space table.

### Closed forms

| Case | Model | Check | Result |
| --- | --- | --- | --- |
| Swerling 1 | `Pfa^(1/(1+S))` | inverse round trip at Pd 0.05, 0.5, 0.95 | exact |
| Swerling 3 | Mahafza 13.51 at np 1 | quadrature at 30 (SNR, Pfa) points, -10 to 21 dB, Pfa 1e-4 to 1e-8 | agrees to 4 decimals everywhere; SNR for Pd 0.1, 0.5, 0.9 at Pfa 1e-6: 7.54, 11.95, 17.30 dB, identical |
| Swerling 0 | inverse of Albersheim (N 1) | Marcum Q at the same 30 points | inside Pd 0.1 to 0.9 the SNR error is under 0.1 dB at Pd 0.5 and 0.9 and 0.9 dB at Pd 0.1 (7.83 against 8.73 dB). Below Pd 0.1 the logistic extrapolation is wrong in kind: at Pfa 1e-6 the model floors at 0.0173 for every SNR under about 3 dB where the exact Pd is 1e-6 to 1e-3; at 6 dB it gives 0.056 against 0.0106. `rangeForPd` at Pd 0.01 returns Infinity for a Swerling 0 target. |

The Swerling 0 tail matters only for a spec that states `swerling: 0`. No seed airframe does:
`SWERLING_BY_AIRFRAME` maps quad, VTOL, one-way-attack and FPV to Swerling 1 and fixed-wing to
Swerling 3. For such a spec the Monte Carlo would draw a hit at 0.017 per scan at any range
inside the instrumented cap: 84 percent chance of a first detection within 100 scans of a
target that returns no signal.

### Range law

Blighter A400 M10S free-space table against `rangeForPd` calibrated at 2730 m for 0.01 m2:
4082 against 4090 (0.05 m2), 4855 against 4870 (0.1), 7259 against 7280 (0.5), 8633 against
8660 (1.0), 15352 against 15400 (10 m2), all -0.19 to -0.31 percent. The table is consistent
with the fourth-root law; it is the maker's own law with rounded ranges, not a measurement.

### The placard Pd planning factor decides the detection and firm-track ranges

Under the PF calibration (placard Pd 0.5, Pfa 1e-6, Swerling 1 reference) and a Swerling 1
target, single-scan Pd against range ratio r/r0: 0.91 at 0.6, 0.75 at 0.8, 0.50 at 1.0, 0.26
at 1.2, 0.054 at 1.5, 0.0018 at 2.0. Pd 0.1 is reached at 1.40 r0 and Pd 0.01 at 1.75 r0. The
3-of-5 rule at cumulative 0.9 needs single-scan Pd 0.753, reached at 0.79 r0 (Swerling 3:
0.90 r0). With the placard read at Pd 0.9 instead, the same table shifts outward: Pd 0.5 at
1.62 r0, firm track at 1.29 r0 (Swerling 3: 1.45 r0). Pfa 1e-4 or 1e-8 in place of 1e-6 moves
these ratios by under 3 percent.

Detection fixture (Mavic 3, 0.01 m2, 12 m/s inbound from 18 km; KuRFS placard 15 km):

| Placard Pd | Deterministic first detect | Deterministic firm track | MC first hit, mean of 30 | MC firm track | Kills |
| --- | --- | --- | --- | --- | --- |
| 0.5 (PF) | 250.5 s (15.0 km) | 509.5 s (11.9 km) | 1.9 s | 509.5 s | 0.967 |
| 0.8 | 0 s (18 km) | 173 s (15.9 km) | 0.7 s | 173.2 s | 0.967 |
| 0.9 | 0 s | 1 s | 0.6 s | 1.9 s | 0.967 |

The placard Pd is the single largest planning factor in the radar chain: it moves the firm
track range between 0.79 and 1.29 of the quoted range. Datasheets in `sources.md` state no Pd.
Pd 0.5 is the Blake-chart convention for "detection range" and stays the PF; a source that
states its Pd goes in `placardPd` on the seed row. Engagement outputs do not move because
the firing window opens on geometry and doctrine gates later than either firm-track time.

### Decision at the end of the study

Decided 2026-09-05, Casey: replace the Albersheim inverse for Swerling 0 with the exact
single-pulse Marcum Q; keep the placard Pd planning factor at 0.5 with the sensitivity above
recorded. Done 2026-09-06: `pdFromSnr` computes Q1(a, b) as the noncentral chi-square tail
(Poisson weights over central chi-square tails, window mean +- 12 sqrt(mean) + 40, `a - b > 12`
returns 1), and `snrForPd` bisects it as it already did for Swerling 3. `radarPd.test.ts` pins
13.183, 11.243 and 8.729 dB at Pd 0.9, 0.5 and 0.1 (Pfa 1e-6), 0.0106 at 6 dB, 1.22e-4 at 0 dB
and Pfa at zero SNR. Capture (`evidence/e2-radar-2026-09-05/*-after.json`): the firing,
detection and layered fixtures are byte-identical to the `e2-solver-spreads-2026-09-05`
after capture, because no seed target is Swerling 0.
