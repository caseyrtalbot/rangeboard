# Effect and EW dossier

Status: E1 evidence baseline, 2026-09-05. Source tree `d8a76f1`; numerical source files unchanged by this lane. [Index and verification](README.md).

## Intended quantity and applicability

Estimate pre-arrival kills, late kills, leakers, no-arrival mass and expenditure from a simplified per-salvo response; estimate temporary RF suppression under modeled band and geometry conditions. These quantities support planning hypotheses. Distinct mechanisms share a response abstraction whose source applicability must remain explicit.

## Equations, units, coordinates and time

[attrition.ts](../../../src/playback/attrition.ts#L160) defines distance factor `1-0.3*r/Rmax` inside max range, zero outside; `kineticPk=clamp(basePk*distanceFactor*sizeFactor*evasionFactor,0,1)`. Size by group is 0.7/0.8/0.9/1/1 PF; FPV evasion multiplier is 0.7 PF. Every non-jammer, including DE/HPM, uses this response family; that name is not a laser/HPM mechanism model. Range is intercept slant for this Pk. Default Pk/cooldown tables are at [attrition.ts:116](../../../src/playback/attrition.ts#L116); per-model overrides and source rows are in [seed inventory](seed-inventory.json).

Deterministic kills consume probability mass; MC kills are 0/1 policy outcomes. For independent fixed-probability shots without constraints, survival is `product(1-pk_i)`; actual assignment also depends on magazine, doctrine, window and pending effects. Raid invariant is kills+leakers+noArrival=raidSize; late kills belong within leaker mass. Kinetic shots, DE salvos and EW salvos are separate expenditure channels. One engine magazine decrement is one modeled salvo; source rounds/bursts need reconciliation, not simple unit relabeling.

[ewPhysics.ts](../../../src/analysis/ewPhysics.ts#L116) sets jam reach `Rmax*sqrt((EIRP/ratedEIRP)/10^(resistanceDb/10))`; absent powers preserve ratio 1. Factor is band coverage (0/0.6/1) times cosine boresight taper (1 to 0.5 at sector edge) times `1-0.3*r/R_eff`. Bands/nav mode gate first; missing jammer bands mean all modeled bands. A continue-jam is illumination that can lapse rather than permanent damage.

Geometry convention, reconciled 2026-09-05 (E2, R-F-30): `assessJam` now takes the target-minus-mount altitude difference and evaluates its range, min-range and power falloff on the slant range, the same convention as the envelope gate at [attrition.ts:489](../../../src/playback/attrition.ts#L489) and the sim window; the sector test stays in plan view. Before this change the factor used horizontal `dist(jammerPos,targetPos)`, which overstated the falloff factor by `0.3*(slant-horizontal)/R_eff` (at most 0.061 for the seed jammers and threat altitudes, at the 1 km envelope edge against a 2000 ft threat) and applied a nonzero min range in the wrong convention. No other equation changed. Before-and-after captures: [evidence/e2-rf30-jam-2026-09-05](../evidence/e2-rf30-jam-2026-09-05/diff.md); the firing fixture has no placed jammer and is byte-identical, the layered-acoustic-merops fixture moves in the deterministic report only.

## Source pedigree, PFs and calibration

Range/power data can anchor reach; no available source establishes universal size, evasion, band or angle Pk factors. EnforceAir's cyber takeover is stored as jammer type even though its own description distinguishes takeover from broadband denial. Source applicability to this common factor model is unestablished.

The reopened [Epirus release](../evidence/model-evidence-2026-09-05/epirus-leonidas.html) reports 61 targets across five scenarios, including a 49-target event with one pulse, using a first-generation system. This is a manufacturer report with clustered opportunities and restricted demonstration conditions. It is not 61 independent shots sampled across RangeBoard's full domain. The [2017 Raytheon release](../evidence/model-evidence-2026-09-05/stinger-2017.html) reports two proximity-fuzed Stinger interceptions of two different target types; detailed per-trial conditions and independent records are absent.

Those counts configure beta spreads (61.5,0.5) and (2.5,0.5) after Jeffreys prior in total mode. They calibrate parameter draws; they are not held-out validation. Nominal PF Pk remains separate (Stinger 0.7; Leonidas 0.7). The total draw means therefore change to about 0.8333 and 0.9919 respectively before geometry factors; total mode is not merely symmetric broadening around nominal. Do not infer transferability from reported success fractions.

## Numerical verification and independent comparison

[ewPhysics.test.ts](../../../src/analysis/ewPhysics.test.ts) verifies power square-root scaling, resistance, gates and taper. [convergence.verify.test.ts](../../../src/playback/convergence.verify.test.ts#L384) checks one/two-shot Bernoulli means, continue-jam fraction and per-replicate partition against analytical expectations; [accuracy.verify.test.ts](../../../src/playback/accuracy.verify.test.ts) checks magazines and delayed effects. E1 reran them. These establish selected arithmetic/state properties, not fit of response PFs. Reported vendor demonstrations are not independent predictions-versus-observations comparisons.

## Unsupported conditions and next data

No ballistic lethality, fragment distribution, laser irradiance/spot/jitter/dwell/thermal response, HPM waveform/coupling/vulnerability or RF jammer-to-signal link budget is represented. Power-scaled nominal reach alone does not model target receiver susceptibility, protocol takeover support, multipath or resistance adaptation. Generalizing clustered all-success demonstrations can understate uncertainty. Need matched effect definition, variant, independent opportunity definition, range/aspect/environment, exposure/dwell, trial counts grouped by event and held-out outcomes. E2 must isolate mechanism changes; E3 must review trial-count applicability and cluster dependence without inventing a replacement distribution.
