# Uncertainty coverage crosswalk

Status: E1 evidence baseline, 2026-09-05. Source tree `d8a76f1`; numerical source files unchanged by this lane. [Index and verification](README.md). E3 study appended 2026-09-05 against `b7ec949`; line pointers below cite that tree. Numerical source files are unchanged by E3; the E3 tests are in the tree.

## Intended quantity and use

Monte Carlo estimates replicate means, quantiles and conditional times under the implemented event and selected parameter distributions. `total` means aleatory draws plus the fields enumerated below; it does not include all parameter, measurement or model uncertainty. Applicability is conditional on those distributions and stable draw identities.

## Sampled versus fixed inventory

[parameterBasis.ts](../../../src/analysis/parameterBasis.ts#L21) holds `PF_SPREAD` (L21 to L33), `spreadFor` (L39), `FIELDS_BY_KIND` (L54 to L58) and `uncertainFields` (L83 to L104); [uncertainty.ts](../../../src/analysis/uncertainty.ts#L222) `sampleScenario` (L222 to L248) writes exactly those fields into a sampled scenario through `sampleModel` (L173) and `nominalOf` (L198), one inverse-CDF draw each in `sampleSpread` (L138). Full per-seed spec/provenance inventory: [seed-inventory.json](seed-inventory.json).

Nine field names sample. `PF_SPREAD` has eleven rows; `sizePenalty` and `evasionPenalty` (L31, L32) are on no `FIELDS_BY_KIND` list and are never read by the sampler. Every default row has `source: 'planning factor'`, date 2026-09-04 (L11 to L13). Two seed provenance rows carry their own spread (`lib-leonidas` pk 61 of 61, `lib-stinger` pk 2 of 2; `seedLibrary.ts` L1990 and L2393); no seed row pins a field with `spread: null`.

| Scope/field | Default distribution | Nominal and conditioning (current source) | Where the engine reads it; when the sample is inert |
| --- | --- | --- | --- |
| sensor.detectRangeM | lognormal 3 dB (power ratio) | Spec `detectRangeM`. Library model in use (an active entity references it) with a `sensor` spec. | Pd-modeled radar: the calibration anchor `r0M` ([sensorEnv.ts L154](../../../src/analysis/sensorEnv.ts#L154)); every other sensor: the effective range (L520). Not inert for a sensor that admits the target. |
| sensor.trackInitS | triangular -30%, +50% | `trackInitSFor` (spec, else the role table, else `doctrine.trackFirmS`). Same conditioning. | [sim.ts L727 to L745](../../../src/playback/sim.ts#L727): continuous-hold initiation for radar and EO/IR sensors WITHOUT a scan state only. Inert for a scan-model radar (M-of-N wrote `trackInitAtS` in the sweep), inert for every RF and acoustic sensor model (L736 skips them), and with doctrine off it moves `stableTrackAtS`, which is informational there (L733). |
| effector.pk | beta, pseudo-count 20, mean at nominal | Spec `pk`, else `DEFAULT_PK[type]`. A provenance count row replaces the pseudo beta with Beta(successes + 0.5, failures + 0.5). | Kinetic: `kineticPk` ([attrition.ts L585, L678](../../../src/playback/attrition.ts#L585)); jam: the dwell probability (L315); DE/HPM: L584. Not inert. |
| effector.engageTimeS | triangular -20%, +30% | Spec `engageTimeS` (required field). | Release-to-effect time for every channel (attrition.ts L279; intercept.ts L75, L83). Not inert. |
| effector.targetS | triangular -30%, +50% | `targetSFor` (spec, type table, `doctrine.targetS`). | [sim.ts L797](../../../src/playback/sim.ts#L797), inside the doctrine-enabled branch only. Inert with doctrine off. |
| effector.bdaS | triangular -30%, +50% | `bdaSFor` (spec, type table, `doctrine.bdaS`). | Shoot-look hold after a committed salvo (attrition.ts L626, L718), doctrine on or off. Not inert for a kinetic, DE or HPM effector. |
| uas.rcsM2 | lognormal 6 dB | `rcsM2For` (spec `rcsM2`, else the group tier 0.01 to 5 m2). | Radar range factor `(rcs / refRcs)^(1/4)` and the Pd model ([sensorEnv.ts L124 to L127, L167](../../../src/analysis/sensorEnv.ts#L124)), target-scaled radars only. Inert when every radar in use has `rangeBasis: 'planning'` (the `mcRun.test.ts` hand-built fixture) and for non-radar sensors. |
| connection.latencyS | triangular -50%, +100% | Every connection, by connection id. Nominal: stated `latencyS`, else the kind default with doctrine on, else 0. | Minimum summed edge latency over valid routes ([killChain.ts L8](../../../src/playback/killChain.ts#L8)); doctrine on: `effectorReadyS` (sim.ts L798) and attrition.ts L230; doctrine off: sim.ts L842. Inert when the nominal is 0 (no stated latency, doctrine off: the triangular bounds are 0 and 0; tested), and for an edge off every minimum-latency route. |
| doctrine.declareHostileS | triangular -30%, +50% | `doctrine.declareHostileS`; enumerated only when doctrine is enabled. | Declaration dwell (sim.ts L789), halved by `CONFIRMED_DECLARE_FACTOR` when two phenomenologies confirm. Inert under ROE hold and when no routed sensor reaches a firm track. |

A library field samples once per model per replicate; every instance of that model shares the value. A connection samples per connection id. Parameter draw keys are `(seed, replicate, param, hash(modelId), hash(field), 0, 0)` ([policy.ts L96](../../../src/playback/policy.ts#L96)), so a sampled field that is inert in a laydown consumes no uniform another field could read. No joint covariance connects distinct fields. Library rows can override these shapes; explicit provenance `spread: null` pins the field. Rows without a spread fall back to `PF_SPREAD` even if the nominal basis is sourced. A spread on a field outside `FIELDS_BY_KIND` does not cause sampling. Example count: the firing fixture (`detection-outside-rings.json`, Giraffe 1X, KuRFS, FAAD C2, Coyote, Mavic 3, three connections, doctrine on) enumerates 13 fields; a C2 model has no field list.

Fixed/not enumerated: max/min/instrumented/classify ranges; reference RCS; placard Pd/Pfa and Swerling; scan period/M/N/drop; sensor mount/ceiling/elevation; entity position/altitude/defended radius; target span/IR/acoustic signature, path speed/delay and formation; jam bands/EIRP/resistance/angle/band factors; commit Pk, cooldown, magazines and launch policy; environment and propagation coefficients; the kinetic size and evasion factors (`SIZE_PENALTY`, `EVASION_PENALTY`, [pk.ts L23, L27](../../../src/playback/pk.ts#L23)); the flyout stated speed and its 0.7 factor (`FLYOUT_SPEED_FACTOR`, [intercept.ts L29](../../../src/playback/intercept.ts#L29)). Model discrepancy, measurement error, missed mechanisms and source-selection uncertainty have no draw.

`PF_SPREAD.sizePenalty/evasionPenalty` exist as 1 dB definitions but are unused by enumeration/writes; the Inspector still titles those two rows "planning factor · spread ±1 dB" through `spreadFor` ([kit.tsx L104](../../../src/panels/inspector/kit.tsx#L104), Inspector.tsx L1075 and L1083). R-F-2's flyout-factor spread is absent, and the R-F-2 note names `doctrineFactors.ts` for a constant that lives in `intercept.ts`. This confirms R-F-29; definitions alone are not implemented coverage. Decision proposals are in the E3 section.

## Equations, time, pedigree and calibration

Lognormal is `nominal*10^(sigmaDb*z/10)` (power-ratio dB); nominal is median, not generally mean (a 3 dB spread has mean 1.2695 times the nominal, tested). Triangular bounds are fractions of nominal with mode at nominal; asymmetric bounds shift the mean (the -30%, +50% default has mean 1.0667 times the nominal, tested). Pseudo beta uses `(nominal*trials,(1-nominal)*trials)`; source counts use `(successes+0.5,failures+0.5)`. Quantile transforms clamp uniforms to `[2^-32, 1 - 2^-32]`. [Effect dossier](effect-ew.md) qualifies the two vendor-count calibrations; their posterior is not a distribution-free uncertainty estimate or independent comparison.

[policy.ts](../../../src/playback/policy.ts#L72) `monteCarloPolicy` (L72 to L98) draws detect, kill, continue-jam, scan phase and parameters from counter-keyed uniforms. Detect key: sensor, threat, `memberIdx`, step; `memberIdx` is a formation member's rank by slant range, nearest first ([detection.ts L60 to L76, L118](../../../src/playback/detection.ts#L60)), not an entity position. Kill key: effector, threat, ship, salvo index per (effector, threat, ship). Phase shares the sensor key. Stable IDs preserve pairing only while member rank stays stable (R-F-15). No stream is consumed in execution order; the fidelity copy "One seeded stream per replicate" ([fidelity.ts L139](../../../src/analysis/fidelity.ts#L139)) is stale.

[mcRun.ts](../../../src/playback/mcRun.ts#L241) `statOf` (L241 to L268) filters finite samples, reports n and total, t-mean CI at 95%, SD/SE, type-7 quantiles and a Wilson interval on the defined fraction. Times are seconds conditional on the event being defined; no-detection is not a time of zero. The mean CI does not cover 95% of missions; quantiles are sample distribution summaries without their own uncertainty intervals. The shared [stats.ts](../../../src/te/calc/stats.ts#L181) `meanInterval` returns a degenerate interval for n=1 and NaNs for n=0; this is arithmetic behavior, not evidence of certainty.

The optional stop (`STOP_FIRST` 30, `STOP_EVERY` 10, mcRun.ts L58 and L492 to L499) checks the end-of-run leaker mean half-width; it does not target precision of every KPI, tails, conditional times or sensitivity row. `sensitivityLoop` (L612 to L655) is one-at-a-time: each enumerated field at its p10 and p90 sample with every other field nominal, aleatory runs at a common seed and replicate index, stopping disabled; it measures a local, paired leaker-mean swing, not global importance or interactions.

## Verification and numerical error

E1 reran [uncertainty.test.ts](../../../src/analysis/uncertainty.test.ts), [policy.test.ts](../../../src/playback/policy.test.ts), [mcRun.test.ts](../../../src/playback/mcRun.test.ts) and [convergence.verify.test.ts](../../../src/playback/convergence.verify.test.ts). Coverage includes inverse-normal anchors, spread endpoints/shapes, exact write inventory, CRN keys, finite/undefined statistics and constant-Pd/Bernoulli/partition comparisons. E3 added four tests to `uncertainty.test.ts` (support over 2000 uniforms; convergence of lognormal and triangular means within 3 SE; mean-interval narrowing against fixed analytic p10/p90; the inert 0-nominal latency) and five in [mcRun.e3.test.ts](../../../src/playback/mcRun.e3.test.ts) (byte-identical summaries at one seed; entity, connection, path and library order reversed with the same ids; a half-width stop equal to the fixed-n run at that n; a rare outcome at n 30; an undefined time in the panel sub-line). Every expected number is derived in the test comment. Inverse CDF and floating-point checks establish numerical behavior at selected points; no exhaustive extreme-tail error bound was produced.

Historical [MASTER-CALCULATIONS.md §2](../../te-compilation/MASTER-CALCULATIONS.md#L325) distinguishes measurement/sampling/operational/model uncertainty, clustered opportunities, censoring and sequential inference. These are methodological constraints and illustrative calculation fixtures; they are not a supplied independent dataset or authority to apply an unapproved rule to the Board.

## Unsupported claims and E3 data needs

No demonstrated frequentist coverage after optional stopping beyond the one-fixture study below; no guarantee a narrow leaker-mean interval makes other quantities precise; no joint dependence/model-discrepancy estimate; no held-out validation for spread widths. Still needed: coverage studies for skewed and rare measures, dependence assumptions, sensitivity to trial-count pooling and independently justified PF spreads. Do not invent a replacement distribution or stopping threshold as part of this crosswalk. C2 is responsible for consistent display/export semantics; E1 documents the statistical scope underneath it.

## E3 study, 2026-09-05

Study only. Nothing below changed a distribution, a pairing or a reported measure; each such change is a proposed register row at the end. Measurements ran as a scratch vitest file under `src/playback/`, deleted after; the numbers are recorded here.

### Decision proposals for the two known gaps

Measured on the firing fixture (`src/playback/__fixtures__/detection-outside-rings.json`, seed 4821, 200 replicates, replicate i paired across cases by the counter keys). The penalty and flyout spreads were emulated without a code change by scaling the Coyote `pk` or `flyoutSpeedMps` per replicate by a factor drawn from the candidate spread; kill and leaker means are ships at the end of the run.

| Case | Kills mean (SE) | Leakers mean (SE) | Paired difference against `total` |
| --- | --- | --- | --- |
| aleatory | 0.935 (0.017) | 0.065 (0.017) | |
| total (as committed) | 0.915 (0.020) | 0.085 (0.020) | 0 |
| total + size factor lognormal 1 dB | 0.875 (0.023) | 0.125 (0.023) | -0.040 kills, +0.040 leakers |
| total + evasion factor lognormal 1 dB | 0.915 (0.020) | 0.085 (0.020) | 0 (Mavic 3 is a quad airframe; the factor applies to fpv only) |
| total + flyout factor triangular -30%, +30% | 0.915 (0.020) | 0.085 (0.020) | 0.000 |
| total + flyout factor lognormal 1 dB | 0.915 (0.020) | 0.085 (0.020) | 0.000 |

First detection on this fixture: aleatory mean 2.0 s (defined in 200 of 200), total mean 124.3 s, deterministic 250.5 s. The aleatory value is a finding on its own (row R-F-38 below).

Gap 1, `PF_SPREAD.sizePenalty` and `evasionPenalty`. Option A, remove the two rows: no numerical change; the Inspector title on the size and evasion rows stops advertising a ±1 dB spread that never samples; R-D-4 needs a note because it accepted the rows as built. Option B, enumerate them: neither is a model field (a UAS-group table and a constant in `pk.ts`), so enumeration needs a new draw target the engine reads and a new key, a hard-exception change; the measured consequence of the size spread on this fixture is -0.040 kills over a one-ship raid (about three paired standard errors), the evasion spread moves nothing unless an fpv airframe is present. Option C, leave as a placeholder: no change, the misleading Inspector title stays. Recommendation: A. A spread that the Inspector shows and the sampler ignores is worse than no spread; B is available later as a declared E2/E3 item with this table as its before capture.

Gap 2, the R-F-2 flyout-factor spread. Option A, amend R-F-2 to "no spread; stated speed times 0.7 stays fixed" and correct the file names in its note. Option B, enumerate `flyoutSpeedMps` under `effector` (a real spec field: `FIELDS_BY_KIND`, one `PF_SPREAD` row, one `nominalOf` branch; `timeOfFlightS` already reads the field), with a declared shape and a before-and-after capture. Option C, placeholder. Measured consequence: both candidate shapes moved no kill or leaker outcome in 200 paired replicates on this fixture; the Coyote shot here does not bind on the flyout term. Recommendation: A now; B only together with a fixture on which the flyout term binds (a long flyout into a closing window), because a spread with no measured effect on the one fixture that fires is not evidence for a distribution.

### Evidence basis per sampled distribution

Every default shape and width is a planning factor (`PF_SOURCE = 'planning factor'`, `PF_DATE` 2026-09-04, parameterBasis.ts L11 to L20; accepted in R-D-4). No default row cites data. The repo records two count-based spreads; both are flagged.

| Field | Shape and width basis | Natural variation | Uncertain parameter | Missing mechanism |
| --- | --- | --- | --- | --- |
| rcsM2 | PF 6 dB; `rcsFactors.ts` states RCS is not consistently available in public sources; the tiers are class values | Aspect and frequency fluctuation is the Swerling model per scan, not this draw | The class tier itself; sampled once per replicate per model | Aspect-dependent mean RCS along the path |
| detectRangeM | PF 3 dB; the placard is a vendor figure at a reference RCS | none in this draw | Placard against unstated conditions | Clutter, operator load, environment beyond the derates |
| pk | PF pseudo-count 20 at the nominal (R-D-4); two seed rows use vendor counts | The per-shot Bernoulli draw | The nominal Pk itself | Aspect, range and countermeasure dependence beyond falloff and the two factors |
| engageTimeS, targetS, bdaS, trackInitS, declareHostileS, latencyS | PF triangulars, one row each; all asymmetric toward longer times | These are per-engagement human and system timings, so mostly natural variation in reality | Sampled once per replicate per model, so the draw acts as a per-replicate bias | Within-replicate, engagement-to-engagement variation is absent |

Flags on selected or very small success counts (`seed-inventory.json`, [effect-ew.md](effect-ew.md) L23 to L25). `lib-stinger` pk: 2 of 2 from a 2017 vendor page, two target types, no per-trial conditions; Beta(2.5, 0.5) has mean 0.833 and is applied to every Stinger engagement in any laydown. `lib-leonidas` pk: 61 of 61 from a vendor press release across five scenarios including 49 targets in one pulse; Beta(61.5, 0.5) has mean 0.992 and treats 61 clustered opportunities as 61 independent trials. Both are used outside their trial domain and both replace the PF pseudo-beta whose mean sits at the nominal 0.7, so `total` mode shifts those means up rather than spreading around the nominal. Register row proposed below.

### Common random numbers and reproducibility

Keying (policy.ts L86 to L96): every uniform is `hashU01(seed, replicate, kind, hash(id), b, c, d)`. Detect: `(sensorId, hash(uasId), memberIdx, stepIndex)`; kill: `(effectorId, hash(uasId), shipIdx, salvoIdx)`; jam: `(effectorId, hash(uasId), 0, stepIndex)`; phase: `(sensorId)`; param: `(modelId, hash(field))`. Pairing is by member identity for everything except `memberIdx`, which is the member's slant-range rank inside one formation (detection.ts L75 sorts the admitted slants). Entity array order enters no key. Verified: two runs at one seed give byte-identical JSON; reversing the entity, connection, path and library arrays with the same ids gives value-identical summaries in aleatory and total mode on the regression laydown (Giraffe 1X, Coyote, FAAD C2, Mohajer-6, Mavic 3) and on the firing fixture; only the key order of the `perThreat` and `perEffector` maps follows entity order (a byte compare of two exports then differs while every value is equal). No pairing change is proposed. The open quality-of-CRN item stays R-F-15's member-rank swap inside a formation.

Fixed n against optional stopping, one fixture (the `mcRun.test.ts` one-shot laydown, Pk 0.5, asset; end-of-run leakers Bernoulli(q) with q = 0.5013 from the deterministic run), 100 seeds, target half-width 0.1156:

| Rule | Mean of the 100 leaker means | RMSE about q | 95% t-interval covers q | n |
| --- | --- | --- | --- | --- |
| stop on half-width | 0.5027 | 0.0545 | 98 of 100 | 70 to 80, mean 79.9 |
| fixed 30 | 0.5117 | 0.0802 | 98 of 100 | 30 |
| fixed 100 | 0.5056 | 0.0501 | 95 of 100 | 100 |

No bias is detectable (the SE of a mean of 100 means is 0.0055). This is one symmetric Bernoulli fixture near p 0.5, where the sample sd, and so the stop, barely depends on the estimate; it does not establish coverage for skewed times, rare counts or any measure the rule does not target. At one seed the stopped summary equals the fixed-n summary at the stopped n exactly (tested): stopping picks n, not the estimate at n.

### Adequacy rule per reported measure

Measures the analysis panels read from a summary: `KpiTilesWidget.tsx` L147 to L205, `OutcomeSummary.tsx` L100 to L142, `TimeSeriesWidget` and `ThreatDetail` through `withBands` (`series.ts`), `SensitivityWidget.tsx`, `LiveStrip.tsx` L83 to L95. Sub-lines come from `mc.ts` (`countSub` L38, `timeStatSub` L53).

| Measure | Shown | Interval shown | Adequacy rule that would apply | Status |
| --- | --- | --- | --- | --- |
| Detected, Track now, Engaged (count at the cursor step) | band mean | ±t half-width, 95% mean CI, n; "CI unavailable" under n 2 | n at least 2; a half-width target per tile; the interval clamped to the count's support | not established (no target; not clamped) |
| Kill E[k], Defeat % | band mean, Defeat scaled by 100/raid | same | same | not established |
| Leakers E[n] | band mean | same | the stop rule bounds the END-step half-width only; coverage measured 98 of 100 on one fixture | rule exists for the end step; one-fixture evidence |
| First detect, Min warning (full-run conditional means) | Stat mean | ±t half-width, n of total defined | defined n at least 30 given the right skew (total-mode first detection on the firing fixture has mean 124 s against an aleatory 2 s); show the defined-fraction Wilson interval that `Stat.defined` already holds | not established (Wilson interval computed, not shown) |
| Time-series bands (kills, leakers, detected, engaged, tracks held, per-threat residual) | MC mean line | p10 to p90 and p025 to p975 replicate bands | minimum n 10 for p10/p90 and 40 for p025/p975 so the quantile is an order statistic, not an interpolation toward one extreme sample (at n 30 the type-7 p975 of a 0/1 count with one 1 is 0.275, a value no replicate produced); no quantile interval is computed | not established |
| Sensitivity rows (nominal, low, high, swing) | leaker means | none ("Mean CI unavailable") | a paired SE of the swing from per-replicate differences (the loop keeps sums only); until then, n and seed | not established |
| Replicates run, stop rule | count and rule name | | informational | n/a |
| Per-threat killed, leaked, first detection and per-effector salvos, kills | not shown; exported with the run record (`DebriefRecord.tsx`) | t-interval in the export | same rare-count limits as above | not established |

Rare outcomes at small n (measured, one-shot fixture at per-shot Pk 0.0291, n 30): 1 of 30 gives a t-interval of -0.035 to 0.102 on a count whose support starts at 0 (Wilson would give 0.006 to 0.167); 0 of 30 gives a zero-width interval where the rule of three gives an upper bound of 0.1. The `lo >= 0` expectation fails on the committed code and is not in the tree; the passing facts (mean, sd, se, p90 hides the event, the p975 interpolation) are in `mcRun.e3.test.ts`.

Sensitivity presentation: `runSensitivity` is one-at-a-time (mcRun.ts L590 to L655) and the widget copy says so ("One parameter at p10/p90, all others nominal; paired replicates. Endpoints are parameter perturbations, not uncertainty intervals. Mean CI unavailable.", SensitivityWidget.tsx L67; the module comment L13 reads "One-at-a-time sensitivity"). No panel copy implies a global or interaction method. Two adjacent copy findings: fidelity.ts L139 "One seeded stream per replicate" (stale, counter-based draws); LiveStrip.tsx L57 "the half-width rule" does not name the measure it bounds (end-of-run leakers).

### Proposed register rows

IDs are placeholders; the orchestrating session assigns numbers.

| Proposed ID | Finding | Decision or follow-up | Recommendation |
| --- | --- | --- | --- |
| R-D-37 | `PF_SPREAD.sizePenalty` and `evasionPenalty` (1 dB) are never enumerated or written; the Inspector titles both rows "spread ±1 dB" through `spreadFor`. Measured size-spread consequence if enumerated: -0.040 kills on the firing fixture; evasion 0 (no fpv airframe). | Remove the rows (note on R-D-4); or enumerate with a new draw target and key; or keep as placeholder. | Remove. |
| R-D-38 | R-F-2's decided flyout-factor `PF_SPREAD` row was never added; the note names `doctrineFactors.ts` for `FLYOUT_SPEED_FACTOR`, which is in `intercept.ts` L29. Two candidate shapes moved nothing on the firing fixture in 200 paired replicates. | Amend R-F-2 to no spread; or enumerate `flyoutSpeedMps` under `effector` with a declared shape and a binding fixture. | Amend; enumerate only with a fixture on which the flyout term binds. |
| R-D-39 | The t-interval on a bounded count or probability leaves its support at small n or rare outcomes (1 of 30: lower bound -0.035) and has zero width at 0 of n; panels show it unclamped. | Clamp to support; or Wilson/Agresti-Coull for per-replicate 0/1 statistics and clamping for sums; or rule-of-three note at k = 0; or leave documented. | Wilson for 0/1 statistics, clamp for sums, rule of three at k = 0. Changes a reported measure. |
| R-D-40 | Replicate quantile bands have no minimum n; at n under 40 the p025/p975 interpolate toward one extreme sample. | Minimum n 10 for the 80% band and 40 for the 95% band with "band unavailable" below; or leave. | Adopt the minimums. Presentation change. |
| R-D-41 | Conditional-time tiles show the t-interval but not the defined-fraction Wilson interval already in `Stat.defined`; no minimum defined n for a skewed time. | Show the defined-fraction interval; minimum defined n 30 for the mean CI. | Adopt both. Presentation change. |
| R-D-42 | Sensitivity swings carry no interval; a paired SE needs the nominal run's per-replicate leakers kept in the loop. | Keep per-replicate leakers and report a paired SE per row; or state "no interval" as now. | Report the paired SE. Changes a reported measure. |
| R-F-35 | Two seed spreads are selected or clustered vendor counts used outside their trial domain: Stinger 2 of 2 (mean 0.833), Leonidas 61 of 61 (mean 0.992, 49 targets in one pulse). Both replace the PF pseudo-beta centered on the nominal 0.7. | Keep as is; replace with the PF pseudo-beta until independent counts exist; or record an effective sample size per row. | PF pseudo-beta with the count kept in the row text. Changes a distribution. |
| R-F-36 | Enumerated fields that are inert in a laydown (trackInitS on scan radars and RF/acoustic sensors; rcsM2 with planning-basis radars only; targetS with doctrine off; 0-nominal latencyS with doctrine off) are sampled and appear as sensitivity rows with swing 0. | Skip inert fields in `uncertainFields` (no other key changes, keys are per field); or keep and label the row. | Keep the enumeration, label the row. Presentation. |
| R-F-37 | Timing triangulars sample once per replicate per model, so within-replicate engagement-to-engagement variation is a missing mechanism and the draw acts as a per-replicate bias. | Evidence gap; no change proposed now. | Record. |
| R-F-38 | On the firing fixture the aleatory first detection has mean 2.0 s (200 of 200 defined) against 250.5 s deterministic and 124.3 s under total: the Monte Carlo policy draws `u < Pd` at any admitted Pd above 0 while the deterministic run requires Pd at or above `pdDetect`, so a Mavic 3 spawned 18 km out is detected within a few scans in nearly every replicate. The fixture was built for a late deterministic detection. | Confirm the intended MC detection semantics at low Pd; decide whether the R-F-20 detection fixture is valid under MC. | Study item for E2; record now. |
| R-F-39 | Stale or incomplete copy: fidelity.ts L139 "One seeded stream per replicate"; LiveStrip.tsx L57 stop label does not name the leaker measure. | One-line copy fixes outside E3's write paths. | Fix in the next UI slice. |
| R-F-40 | Stopping coverage is measured on one symmetric Bernoulli fixture only (98 of 100 at target 0.1156); no study for skewed times or rare counts. | Evidence gap. | Record; run the same study on the firing fixture's first-detection time before any stop rule extends to times. |
