# Environment dossier

Status: E1 evidence baseline, 2026-09-05. Source tree `d8a76f1`; numerical source files unchanged by this lane. [Index and verification](README.md).

## Intended quantity and applicability

Apply explicit planning derates to sensor ranges under selected categorical conditions. The input is a scenario covariate, not a weather measurement or terrain dataset. These factors are useful for exposing assumptions; they do not establish performance at a named rain rate, visibility profile or atmospheric state.

## Equations, units and parameter pedigree

[sensorEnv.ts](../../../src/analysis/sensorEnv.ts#L48) multiplies the following dimensionless range factors when `environment.apply` is true. Missing precipitation/background/light resolve clear/rural/day. `apply=false` makes environmental multipliers unity while target-signature scaling remains active.

| Parameter | Radar | EO/IR | RF | Acoustic | Basis |
| --- | --- | --- | --- | --- | --- |
| Rain | 0.75 | 0.6 | 1 | 0.7 | PF |
| Fog | 0.85 | 0.4 | 1 | 1 | PF |
| Urban background | 0.9 | 1 | 0.6 | 0.85 | PF |
| Wind | No term | No term | No term | max(0.4,1-0.03*windMps) | PF; scalar noise term |

Visible-only night multiplies by 0.2; thermal/dual use thermal behavior. Positive user visibility overrides clear/rain/fog defaults 20000/6000/600 m; EO/IR range is capped at visibility. Radar uses the fourth power of its range multiplier in SNR. Acoustic alpha=5 dB/km remains in its target-reference loss solver independently of the weather toggle. Wind bearing is unused in the noise derate. EW resistance/EIRP is part of target/link closure, not an additional meteorological modifier.

The code references the retrieved [COURAGEOUS paper](../evidence/model-evidence-2026-09-05/courageous.pdf) §3.1/Table 1 as qualitative technology context. That table does not specify these coefficients. No weather calibration data were found in the existing inventory research. Historical [gaps.md](../../inventory/gaps.md#L236) predates current per-band night behavior; its old 0.6 night description is not current code.

## Represented mechanisms and double-counting check

1. Radar precipitation/background range factor enters SNR once through f^4; adding an ITU attenuation term later without removing/recalibrating that factor risks counting a loss twice.
2. EO/IR precipitation scales range, then precipitation-derived visibility may cap it. Two restrictions currently coexist; they are not independently calibrated and should not be interpreted as independent uncertainties. Thermal receives the same categorical visibility cap despite spectral differences.
3. Acoustic baseline absorption is already present. Rain/urban/wind are intended as noise-floor proxies applied afterwards. Do not add absorption because the fidelity note incorrectly says it is absent.
4. RF vendor urban range replaces generic urban derating (rather than multiplying both). Propagation changes must preserve or explicitly reconsider that source normalization.

No empirical calibration was performed. Source references in [historical plan §12](../../engine-refactor/PLAN.md#L768) to ITU-R/standard atmosphere/terrain are candidate methods, not code implementations or compliance claims.

## Numerical error, verification and independent comparison

Multiplication/caps are algebraic; their floating-point error is negligible relative to unspecified PF error for ordinary finite inputs, without a globally tested bound. Discontinuous categorical changes and caps can dominate small numerical changes. The sensor environment tests pin unity/off, categorical multiplication, wind floor, night branch, visibility cap and urban replacement; all rerun in E1. Those assertions intentionally verify the implemented values, not environmental realism.

Independent quantified weather comparison: absent. The paper is a method/technology discussion, not a parameter-fit dataset for these factors. Its §3.1 also contains an apparent wavelength typo (10 GHz stated as 0.3 m; c/f is about 0.03 m); do not propagate that number into the model or treat primary-publication status as error-free evidence.

## Unsupported conditions and data needs

No frequency-specific rain absorption, fog liquid water, aerosol/visibility extinction, gaseous absorption, scintillation, temperature/humidity profile, refraction profile, terrain/buildings, optical turbulence or directional acoustic transport is computed. Future physical models need actual inputs plus a defined band/path/domain and measurement units. E2 should first identify which existing PF mechanism each new term replaces, preserve clear/neutral baselines, and report deltas by measured quantity. Missing site/environment data is an explicit use limit; it does not justify arbitrary coefficients or acceptance thresholds.
