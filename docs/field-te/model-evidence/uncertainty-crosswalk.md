# Uncertainty coverage crosswalk

Status: E1 evidence baseline, 2026-09-05. Source tree `d8a76f1`; numerical source files unchanged by this lane. [Index and verification](README.md).

## Intended quantity and use

Monte Carlo estimates replicate means, quantiles and conditional times under the implemented event and selected parameter distributions. `total` means aleatory draws plus the fields enumerated below; it does not include all parameter, measurement or model uncertainty. Applicability is conditional on those distributions and stable draw identities.

## Sampled versus fixed inventory

[parameterBasis.ts](../../../src/analysis/parameterBasis.ts#L23) is the resolver/enumeration source; [uncertainty.ts](../../../src/analysis/uncertainty.ts#L138) writes exactly those fields into a sampled scenario. Full per-seed spec/provenance inventory: [seed-inventory.json](seed-inventory.json).

| Scope/field | Default distribution | When/effective nominal |
| --- | --- | --- |
| sensor.detectRangeM | lognormal 3 dB | Used active library model; nominal spec range |
| sensor.trackInitS | triangular -30%, +50% | Resolver time; sampled value can be inert for a scan-mode radar whose initiation uses M/N |
| effector.pk | beta pseudo-count 20 | Mean at nominal/resolved default unless provenance count overrides |
| effector.engageTimeS | triangular -20%, +30% | Spec nominal |
| effector.targetS, bdaS | triangular -30%, +50% | Spec/type/scenario resolver |
| uas.rcsM2 | lognormal 6 dB | Spec or group RCS |
| connection.latencyS | triangular -50%, +100% | Every connection; absent nominal kind default with doctrine, else zero |
| doctrine.declareHostileS | triangular -30%, +50% | Enabled doctrine only |

Library rows can override these shapes; explicit provenance spread:null pins the field. Rows without a spread fall back to PF_SPREAD even if nominal basis is sourced. A spread on a field outside FIELDS_BY_KIND does not cause sampling. Library fields sample once per model per replicate, shared by all instances using that model. Connections sample by connection ID; no joint covariance model connects distinct parameter fields.

Fixed/not enumerated: max/min/instrumented/classify ranges; reference RCS; placard Pd/Pfa and Swerling; scan period/M/N/drop; sensor mount/ceiling/elevation; entity position/altitude/defended radius; target span/IR/acoustic signature, path speed/delay and formation; jam bands/EIRP/resistance/angle/band factors; commit Pk, cooldown, magazines and launch policy; environment and propagation coefficients; size/evasion penalties; flyout stated speed and 0.7 factor. Model discrepancy, measurement error, missed mechanisms and source-selection uncertainty have no draw.

`PF_SPREAD.sizePenalty/evasionPenalty` exist as 1 dB definitions but are unused by enumeration/writes. R-F-2's flyout-factor spread is absent. This confirms R-F-29; definitions alone are not implemented coverage.

## Equations, time, pedigree and calibration

Lognormal is `nominal*10^(sigmaDb*z/10)` (power-ratio dB); nominal is median, not generally mean. Triangular bounds are fractions of nominal with mode at nominal; asymmetric bounds shift the mean. Pseudo beta uses `(nominal*trials,(1-nominal)*trials)`; source counts use `(successes+0.5,failures+0.5)`. Quantile transforms clamp uniforms away from endpoints. [Effect dossier](effect-ew.md) qualifies the two vendor-count calibrations; their posterior is not a distribution-free uncertainty estimate or independent comparison.

[policy.ts](../../../src/playback/policy.ts#L87) draws detect, kill, continue-jam, scan phase and parameters from counter-keyed uniforms. Detect key includes sensor/threat/admitted-member index/step; kill includes effector/threat/ship/salvo index; phase shares the sensor key. Stable IDs preserve pairing only while semantic member ordering remains stable (R-F-15). No stream is consumed in execution order; fidelity copy claiming a stream is stale.

[mcRun.ts](../../../src/playback/mcRun.ts#L187) filters finite samples, reports n and total, t-mean CI at 95%, SD/SE, type-7 quantiles and Wilson interval on defined fraction. Times are seconds conditional on the event being defined; no-detection is not a time of zero. The mean CI does not cover 95% of missions; quantiles are sample distribution summaries without their own uncertainty intervals. The shared [stats.ts](../../../src/te/calc/stats.ts#L181) returns a degenerate mean interval for n=1 and NaNs for n=0; this is arithmetic behavior, not evidence of certainty.

The optional stop checks end-of-run leaker mean half-width at n=30 then every 10; it does not target precision of every KPI, tails, conditional times or sensitivity row. OAT sensitivity varies each enumerated parameter to p10/p90 at a common seed with others nominal and stopping disabled; it measures a local leaker-mean swing, not global importance or interactions.

## Verification and numerical error

E1 reran [uncertainty.test.ts](../../../src/analysis/uncertainty.test.ts), [policy.test.ts](../../../src/playback/policy.test.ts), [mcRun.test.ts](../../../src/playback/mcRun.test.ts) and [convergence.verify.test.ts](../../../src/playback/convergence.verify.test.ts). Coverage includes inverse-normal anchors, spread endpoints/shapes, exact write inventory, CRN keys, finite/undefined statistics and constant-Pd/Bernoulli/partition comparisons. No statistical test was modified, and no claim of new empirical coverage is made. Inverse CDF and floating-point checks establish numerical behavior at selected points; no exhaustive extreme-tail error bound was produced here.

Historical [MASTER-CALCULATIONS.md §2](../../te-compilation/MASTER-CALCULATIONS.md#L325) distinguishes measurement/sampling/operational/model uncertainty, clustered opportunities, censoring and sequential inference. These are methodological constraints and illustrative calculation fixtures; they are not a supplied independent dataset or authority to apply an unapproved rule to the Board.

## Unsupported claims and E3 data needs

No demonstrated frequentist coverage after optional stopping; no guarantee a narrow leaker-mean interval makes other quantities precise; no joint dependence/model-discrepancy estimate; no held-out validation for spread widths. E3 needs measure-specific fixed-n/stop coverage studies, skew/rare-event/undefined-time cases, dependence assumptions, sensitivity to trial-count pooling and independently justified PF spreads. Do not invent a replacement distribution or stopping threshold as part of this crosswalk. C2 is responsible for consistent display/export semantics; E1 documents the statistical scope underneath it.
