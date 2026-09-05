# Track, C2 and doctrine dossier

Status: E1 evidence baseline, 2026-09-05. Source tree `d8a76f1`; numerical source files unchanged by this lane. [Index and verification](README.md).

## Intended quantity and applicability

Produce observation/hold/classification states, route eligibility and release-ready time for a specified scenario. It is a state/timing planning model. It does not estimate a tracker covariance, association error, human decision distribution or real network queue.

## Equation and timing contract

Units are seconds for all timing values; geometry uses meters and clockwise degrees in the common Board frame.

[sim.ts](../../../src/playback/sim.ts#L615) schedules scans from sweep delay plus phase*period, snapped forward to DT. A period below DT counts only one scan per step, so a 10 Hz report stream cannot be represented as ten independent looks per second. Initial state has no hold. Misses before admission advance the scan counter but do not enter its M-of-N window. Coast preserves continuity and cannot advance classification.

`recordScan` at [sim.ts:686](../../../src/playback/sim.ts#L686) requires at least M detections among stored scans **and** the binomial tail `sum(k=M..N) C(N,k)*pbar^k*(1-pbar)^(N-k)` to reach the configured cumulative threshold. Early windows retain full N while pbar averages only recorded looks. With unequal Pd this tail is a mean-Pd approximation, not the Poisson-binomial probability of those specific looks. Initiation is stamped once; subsequent hold/drop state remains distinct from initiation time.

Non-scan radar and EO/IR use role-based uninterrupted hold times; RF/acoustic do not provide firm fire-control initiation. [doctrineFactors.ts](../../../src/analysis/doctrineFactors.ts) resolves spec override → role/type table → scenario fallback. Routes determine the relevant sensors; ready time is gate + best valid route latency + target dwell. Multi-phenomenology confirmation can halve declaration dwell (0.5 PF). Later assignment/effect/BDA times are described in motion/effect timing.

## Inputs, pedigree, defaults and calibration

Scan M/N/drop defaults are 3/5/5; role scan seconds are FC 0.5, tracking 1, acquisition/classification/surveillance 2, early warning 6. Role hold times are 2/3/4/5/6/8 s in those corresponding role categories. Target dwell gun/DE/HPM/interceptor/net/jammer is 4/5/3/8/6/0 s; BDA is 5/3/3/10/20/5 s. Commit probabilities are 0.25/0.2/0.2/0.35/0.35/0. These values are PF tables, not measured system latencies. Ordinary untyped link defaults are 2 s, C2→effector 3 s; typed media have their own suggestions in [integration.ts](../../../src/model/integration.ts#L56). Scenario declaration defaults to 10 s.

[Inventory doctrine](../../inventory/doctrine.md) is a historical terminology audit, not a source for those times. Its joint/Army source editions were not reopened in E1. [integration-matrix.csv](../../inventory/integration-matrix.csv) and [integrationData.ts](../../../src/model/integrationData.ts) carry pairing pedigree; a shared protocol does not establish demonstrated pair interoperability. Fully typed fc-uplink routes require routed FC sources; untyped links preserve the legacy assumption. This qualifies conclusions from hand-written fixtures.

The retrieved [RTX Coyote/KuRFS release](../evidence/model-evidence-2026-09-05/rtx-kurfs-coyote.html) confirms a joint demonstration context. It supplies no per-hop latency, dwell, probability, numeric intercept range or average-speed calibration. No state/timing calibration to measured log data exists.

## Numerical error, verification and independent comparison

Grid scan error is below DT for a represented nominal look, but sub-DT looks are collapsed. [scanModel.test.ts](../../../src/playback/scanModel.test.ts) and [convergence.verify.test.ts](../../../src/playback/convergence.verify.test.ts#L221) verify constant-Pd cumulative detection `1-(1-Pd)^k` and M-of-N behavior within their declared 3 SE analytic comparisons. [attrition.doctrine.test.ts](../../../src/playback/attrition.doctrine.test.ts), [accuracy.verify.test.ts](../../../src/playback/accuracy.verify.test.ts), and [trackState.test.ts](../../../src/playback/trackState.test.ts) check route timing, gates, state precedence and effects. E1 reran these; no test was changed.

Independent trial comparison: absent. The mean-Pd tail, early-window rule and PF scan timing remain local policy assumptions. `countOr` rounds positive counts separately; it does not itself ensure M≤N. C3 persistence validation may reject malformed saved counts; E2 must still examine direct engine-input semantics without claiming C3 establishes physical validity.

## Unsupported conditions and next data

No false-track/association process, sensor fusion estimation, communications losses, network congestion, bandwidth/resource timing or measured operator response is represented. Capacity/route tests exercise implementation rules, not vendor scale claims. Need synchronized observations, measured scan/revisit schedule, declared track-initiation/drop policy, route configuration, FC eligibility and gate-to-release timestamps. E2 should separate detection, tentative hold, firm initiation and reacquisition rather than choosing one generic track metric. Track update rates must not silently replace scan periods.
