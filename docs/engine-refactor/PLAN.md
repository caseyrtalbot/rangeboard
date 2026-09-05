# Engine refactor: a stochastic simulation the T&E community can accept as evidence

Written 2026-09-04 against the tree at `e6edbb4` (slice 9 of `docs/data-engine/PLAN.md`,
branch `analysis-hardening`, 61 test files, 1071 tests green).

This plan refactors the TypeScript engine in place. It does not rebuild the engine. The
Rust and WebAssembly greenfield draft of the same day was deleted on 2026-09-04 as
superseded; its standards table is section 12 here.

The data-engine plan is complete at slice 9. The one pass it deferred (slice 9 "Stays
out: non-radar sensors, effectors, threat RCS values") is slice 0 here. It runs first,
under the slice 9 research rules, because a sourced seed change moves fixtures and every
engine slice must build on settled seeds. It supersedes nothing and nothing waits on it
except slices 4, 5 and 7, which read the rows it writes.

## 1. Purpose and the claim the tool makes

The engine today is a verified expected-value planner with a Monte Carlo layer at three draw
points. It is not yet a stochastic simulation that a STAT COE or DOT&E reviewer will accept
as evidence for a test design. After this plan the tool makes one claim, and only this one:

> RangeBoard is a planning-factor model with quantified uncertainty, used for test design.
> It reports, for a laydown and a raid, the expected engagement window, the spread of that
> window, the confidence interval on every headline measure, the trial count needed to
> resolve a Pd or a Pk at a stated confidence, and the assumptions that drive the answer.
> It is not a simulation of truth and not a source of operational effectiveness claims.

Every reported number becomes an interval with its driving assumptions, its model fidelity
tags and its run-validity findings attached. The tool never shows a bare point as a result.

Against the NASA-STD-7009A credibility factors the engine at `e6edbb4` scores well on
verification and input pedigree, partly on results uncertainty, and not at all on
validation, results robustness and use history. Slice 0 extends input pedigree to every
seed. Slices 1 to 3 close results uncertainty.
Slice 4 closes results robustness. Slices 6 and 7 open validation and give every result a
fidelity record.

## 2. What the assessment found, checked against the tree

The assessment (session of 2026-09-04) made eight findings. Each was checked against the
source. All eight hold.

| # | Finding | Evidence at `e6edbb4` |
| --- | --- | --- |
| A-1 | Baseline and Monte Carlo disagree by construction. Detection is a threshold in one and a Bernoulli draw in the other. Kill and jam are mass in one and 0 or 1 in the other. | `src/playback/policy.ts:33` `detect: (pd) => pd >= pdDetect`; `:44` `detect: (pd) => rng() < pd`; kill and jam return `pk` and `p` at `:34` and `:35`. |
| A-2 | Radar detection draws are oversampled. One draw per admitted member per DT step, whatever the scan period, until first detection. | `src/playback/sim.ts:191` calls `policy.detect` inside `sensorHit`, which runs every step. The scan state is created at first detection, `sim.ts:979` ("First detection is the scan origin"). A 4 s radar takes eight independent draws per revolution before it holds a track. |
| A-3 | Only three quantities are random. EO/IR, RF and acoustic detection are range thresholds. Track drop, the classification ladder, latencies and dwells are constants. | `sim.ts:196` `detected = seen.filter((slant) => slant <= detectR)` for every non-radar. `DrawPolicy` has three methods. |
| A-4 | Pk is a heuristic product with no kinematics. Effect time is assignment time plus a constant. | `src/playback/attrition.ts:974` and `:1064` `pk = es.pk * falloff * size * evasion`; `:787`, `:863`, `:1011` `tEffect = t + es.engageTimeS`. `EffectorSpec` carries no speed. |
| A-5 | Physics sits at planning fidelity. Environment is a scalar range multiplier. The horizon is a 4/3 earth flat plane. | `src/analysis/sensorEnv.ts:49` `SENSOR_ENV_MODEL` scalar table; `src/geometry/slant.ts:44` `radioHorizonM`. Every value is labeled a planning factor, which is correct. |
| A-6 | No epistemic uncertainty. Every planning factor is a point. | `Provenance` (`src/model/types.ts:368`) carries value, source, url, date, basis. No spread field. `RCS_PLANNING_M2` is one value per group. |
| A-7 | Output statistics stop at quantiles. No standard error, no interval, no convergence rule. | `Stat` in `src/playback/mcRun.ts:23` is mean, p10, p90, p025, p975, n. `src/te/calc/stats.ts` has `wilson`, `clopperPearson`, `meanInterval`, `bootstrapMeanInterval`, unused by the replicate loop. |
| A-8 | Common random numbers are not synchronized. | `mcRun.ts:220` `monteCarloPolicy(mulberry32(seed + i), thresholds)`, one stream consumed in engine order. The id and time arguments of `DrawPolicy` are unused (decision D-62 in `docs/data-engine/outstanding.md`). |

Two more findings came out of the check and join the plan:

| # | Finding | Evidence |
| --- | --- | --- |
| A-9 | Conditional statistics hide survivorship. `firstDetectS` and `minWarningS` are averaged over the replicates that detected. A summary with n 40 of 100 reads like a 40-replicate run. | `mcRun.ts` `statOf` counts finite samples only (`Stat.n`, D-65). Nothing reports the detection fraction with an interval. |
| A-10 | A radar that is already tracking still consumes one draw per member per step, then the scan pass discards every non-scan hit. The stream position depends on every step, so no two configurations can share a draw. | `sim.ts:939` to `:943` (`scanHits.set`, `continue`) after `sweepSensorHits` has already drawn. |

## 3. Where this plan departs from the assessment

The assessment's ten-point engine design is the right direction. Four of its points do not
survive contact with the code as written, and this plan replaces them.

- **"Baseline equals the analytic mean" (assessment point 3).** Not achievable for the
  whole chain without a probability-flow engine. The deterministic attrition already
  diverges from the discrete mean: it fires at a fractional ship until the survival mass
  falls under `SHIP_DEAD_BELOW`, where a replicate stops at the first kill. This plan keeps
  the deterministic mode as a labeled **planning envelope** (threshold detection, mass
  kills) and makes the Monte Carlo mean with its interval the **estimate**. Verification
  against mathematics moves to constructed cases with closed forms (slice 2), which needs
  no field data and is what a reviewer can check by hand.
- **"Discrete-event core with exact event times" (point 2).** Out of the refactor. The DT
  grid stays. A scan phase per radar per replicate on that grid gives the variance that
  matters. The grid error is at most DT / 2 = 0.25 s against link latencies and dwells of
  seconds.
- **"Two loops of uncertainty" (point 1).** A nested outer-inner loop multiplies run time
  by the parameter sample count. This plan draws the parameter vector once per replicate
  inside the same stream ("total" uncertainty), reports the "aleatory" band from a run with
  parameters at nominal, and gets the decomposition from a one-at-a-time sensitivity run
  under common random numbers. Sobol indices stay out until a customer asks for them.
- **"Replace the Pk heuristic with kinematics" (point 4).** A miss-distance and lethality
  model needs data no public source gives. This plan adds a flyout term (time of flight from
  a sourced interceptor speed and a predicted intercept point) and keeps the Pk product.
  Each factor of the product gets a provenance row and a spread. An aspect or crossing-rate
  factor waits for a sourced curve (open item O-7).

Terrain line of sight and ITU propagation (assessment point 9) are greenfield work and
stay out of this plan.

## 4. Decisions made in this plan

- R-1. The TypeScript engine stays. No Rust, no WebAssembly, no new npm dependency.
- R-2. Two run modes keep their names in the schema (`'deterministic' | 'monte-carlo'`).
  The deterministic mode is presented as the planning envelope and carries a `limiting`
  run-validity finding on every gate. The Monte Carlo mode is the estimate.
- R-3. Every Pd-modeled radar owns a scan period and draws once per scan per admitted
  member. A stated `updateRateS` is the period; otherwise a PF period by role. A radar with
  no Pd model keeps the threshold and the role table as today.
- R-4. Draws are counter-based. A draw is a pure function of (seed, replicate, kind, actor
  id, target id, index, step). Two laydowns share every draw that both make. `mulberry32`
  stays for the T&E bootstrap only.
- R-5. Every headline statistic is a mean with a t-interval, a standard error, the
  replicate count and, for a conditional quantity, the defined fraction with a Wilson
  interval. The panels and the export read `Stat` only.
- R-6. Parameter uncertainty lives on the provenance row (`spread`). A field with no row
  spread takes the PF spread table for its field name. A field with neither is fixed.
- R-7. The sensitivity method is one-at-a-time at the p10 and p90 of each spread, paired by
  common random numbers, ranked by swing on the headline statistic.
- R-8. Every model function carries a fidelity tag (tier, validation status, standard). A
  result carries the tags of every model that produced it. A tag with validation `none`
  raises a `limiting` finding.
- R-9. Validation in this plan means agreement with manufacturer datasheet points and
  published trial figures. The tag says `datasheet` or `trial`, never "validated" alone.
- R-10. No slice changes a storage key, the schema version or the raid partition.

## 5. Rules that bind every slice

- Work in `/Users/caseytalbot/Projects/rangeboard` on `analysis-hardening`. Do not
  create a branch. Commit only when the user says so, one commit per slice. Slice 9 of the
  data-engine plan is committed and not pushed; push it before slice 0 starts (O-10).
- One slice at a time. A slice is done when section 8 passes and the user accepts it.
- Copy the surrounding code style: no trailing semicolons, 2-space indent, single quotes,
  named exports, `interface` for object shapes, JSDoc on exported symbols, short "why"
  comments above non-obvious blocks. No narration comments.
- No new npm dependency in the whole plan.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json`. Test with `npx vitest run`.
  Lint with `npm run lint`. Build with `npm run build` at the end of each slice.
- User-facing copy is ASD-STE100 Simplified Technical English. No em-dashes.
- Every new number that is not sourced is a planning factor. It carries a provenance row
  with basis `pf` and the UI shows the PF tag. A slice never invents a value to fill a
  blank; it records the blank as an open item.
- Do not create documentation, plan or status files beyond this one. Append decisions and
  follow-ups to `docs/data-engine/outstanding.md` with the prefixes `R-D` and `R-F`.
- Update `CLAUDE.md` in the same slice that changes a contract it describes (section 9).
- Keep engine logic in pure TypeScript with colocated `*.test.ts`. Size tests like the
  neighboring files. A statistical test asserts within 3 standard errors of the analytic
  value and names the value in a comment.

## 6. Engine facts every slice must respect

- E-1. The three draw points are `sensorHit` detect, `applyEffect` kill and `applyEffect`
  continue-jam. Slice 1 adds a fourth (scan phase) and slice 4 a fifth (parameter draw).
  No sixth without a plan entry. No `Math.random` under `src/`.
- E-2. A bare call to `sweepSensorHits`, `assessThreat`, `assessAllThreats` or
  `resolveEngagements` is the deterministic policy. `policy.test.ts` pins it.
- E-3. `engagementPicture` is the deterministic path and its cache. The replicate loop
  never touches it.
- E-4. The DT grid (`DT` exported from `sim.ts`) is the one sample grid. `attrition.ts`
  and `mcRun.ts` import it. No slice adds a second copy.
- E-5. Raid partition: `expectedKills + expectedLeakers + expectedNoArrival === raidSize`
  in every replicate.
- E-6. `runMode`, `seed`, `replicates` are scenario facts read through `runSettings` and are
  part of `analysisBasisSignature`. Every new run setting joins both.
- E-7. The `mc` slice is view state, never persisted, never in `past`. A basis change marks
  it `stale`. The worker protocol ignores a message whose `runId` is not current.
- E-8. Thresholds are test-defined. `requirements` is the one place a gate reads from.
- E-9. One source per fact. `radarPdAt` is the one Pd evaluation, `sensorHoldGate` the one
  hold gate, `sweepSensorHits` the one sweep, `withBands` the one band reader, `PfTag` the
  one provenance tag.
- E-10. `src/te/calc/stats.ts` is fixture-tested from MASTER-CALCULATIONS.md. A statistic
  the engine needs is imported from there, never copied (the copy of `quantile` in
  `mcRun.ts` is deleted in slice 3).

## 7. Slices

The order is the dependency order. The build schedule, which runs several slices in one
wave, is section 11. Each slice lists goal, files, contract, behavior, acceptance, and what
stays out.

### Slice 0. Provenance pass over the non-radar seeds

Goal: every EO/IR, RF and acoustic sensor, every effector and every threat seed carries
provenance rows under the slice 9 rules (`docs/data-engine/outstanding.md` D-71 to D-75),
so slices 4 and 5 put spreads and speeds on sourced values instead of PF blanks.

Files: `src/model/seedLibrary.ts` and test, `src/panels/Inspector.tsx` and
`src/panels/LibraryEditor.tsx` (a `PfTag` on every row of the fields below that lacks one),
`docs/data-engine/outstanding.md` (rows), `CLAUDE.md`.

Scope at `e6edbb4`: 19 non-radar sensors, 25 effectors, 15 threats. The 19 radars already
carry rows and are not reopened.

Fields verified per kind:

- EO/IR, RF, acoustic sensors: `detectRangeM` with `refSpanM` or `refAcousticDb`,
  `classifyRangeM`, `eoBand`, `rfBands`, `urbanRangeM`, `sectorDeg`, `elevationDeg`,
  `mountHeightM`, `maxAltitudeFt`.
- Effectors: `maxRangeM`, `minRangeM`, `maxAltitudeFt`, `engageTimeS`, `pk`,
  `magazineSize`, `salvoCooldownS`, `jamBands`, `eirpW`, `sectorDeg`.
- Threats: `rcsM2`, `spanM`, `irSignature`, `acousticDb`, `cruiseSpeedMps`, `maxSpeedMps`,
  `enduranceMin`, `altBandFt`, `linkBands`, `controlLinkRangeM`, `warheadKg`.

Behavior:

- Research runs with the slice 9 shape: a contract file, four research agents on Fable
  medium, one JSON per agent, an orchestrator cross-check by a scratch vitest file, an
  apply agent on Opus high. Every quote verbatim, every blank left `null`.
- Two research items feed later slices and have no code home yet. They land in
  `outstanding.md` as `R-F` rows with source, URL and date, and the later slice writes the
  row: interceptor and round speeds for `flyoutSpeedMps` (slice 5), and any source that
  states a Pk or Pd as successes over trials (slice 4 beta spreads).
- A seed value changes only under D-73 (a `datasheet` or `reference` row in the same unit
  against a small-UAS class; a band takes the lower bound). Every change is listed in the
  commit message table. A fixture that moves with a sourced change moves with a comment
  that names the row.
- A field with no source keeps its value and takes a `pf` row. Nothing is invented.

Acceptance:

- `seedLibrary.test.ts` extends the radar assertions to every seed: a row for the first
  field of each kind above, a date and a basis on every row, an `http` URL on every
  non-PF row, no duplicate field.
- The Inspector and the LibraryEditor show a tag on every listed field for one seed of
  each kind (browser check).
- The commit message carries the per-seed table (basis of the lead field, value changes).

Stays out: engine changes, new spec fields, spreads (slice 4), `flyoutSpeedMps` (slice 5),
the radar rows.

### Slice 1. One draw per scan

Goal: a Pd-modeled radar draws once per scan per admitted member, from a scan origin at the
path start with a per-replicate phase, so the replicate first-detection distribution is the
physical one and the deterministic envelope lands on scan times.

Files: `src/analysis/doctrineFactors.ts`, `src/playback/policy.ts`, `src/playback/sim.ts`
and test, `src/playback/mcRun.ts` (no contract change), `src/panels/Inspector.tsx` and
`src/panels/analysis/detail/SensorDetail.tsx` (scan period row), `CLAUDE.md`.

Contract:

```ts
// doctrineFactors.ts
/** Scan period by role for a Pd-modeled radar with no stated updateRateS, seconds. PF rows. */
export const SCAN_S: Record<SensorRole, number>
/** The one scan period: updateRateS when stated, else SCAN_S by role for a Pd-modeled radar, else null. */
export function scanPeriodS(spec: SensorSpec, pdModeled: boolean): number | null

// policy.ts
export interface DrawPolicy {
  detect(pd: number, sensorId: string, uasId: string, tS: number, memberIdx: number): boolean
  kill(pk: number, effectorId: string, uasId: string, shipIdx: number, tS: number): number
  jam(p: number, effectorId: string, uasId: string, tS: number): number
  /** Scan phase as a fraction of the period, [0, 1). Deterministic: 0. MC: uniform. */
  phase(sensorId: string): number
}
```

Behavior:

- The scan origin is the path start (`effectivePathDelayS`) plus `phase * period`. Scan k
  is due at `origin + k * period` and is taken at the first grid step at or after it. A
  scan before the target is admitted (geometry gate, instrumented cap) is a miss with Pd 0
  and does not enter the M-of-N window.
- `sensorHit` calls `policy.detect` for a Pd-modeled radar only at a scan step. Between
  scans the hold carries as today (detected, coast, dropped). The role-table initiation
  path is unchanged for radars with no Pd model and for EO/IR.
- The scan state is created at the first scan, not at the first detection. `firstDetectS`
  is the first detected scan. D-11 and D-12 semantics for coast stay.
- `recordScan` runs the M-of-N rule from the first scan. `trackInitAtS` is the first scan
  that satisfies it.
- The Inspector and the sensor pane show the scan period with its PF tag when it comes
  from `SCAN_S`.

Acceptance:

- `sim.test.ts`: a Pd-modeled radar with period 4 s and a target at constant Pd 0.45
  (straight tangent path, `apply: false`) draws exactly `members * scans` times under a
  counting policy; a deterministic run first-detects on a scan time; the M-of-N window has
  no entry before the first scan.
- `mcRun.test.ts`: the same fixture over 1000 replicates gives an empirical cumulative
  first-detection curve within 3 standard errors of `1 - 0.55^k` at scans k = 1 to 5, with
  the analytic values in a comment.
- `policy.test.ts`: `phase` returns 0 for the deterministic policy and a value in [0, 1)
  for the Monte Carlo policy; the bare-call regression still holds.
- Every existing test passes or moves with a comment that names the new scan time.
- Performance: the five-threat screenshot scenario, 100 replicates in the worker, timed
  before and after; both numbers in the commit message.

Stays out: counter-based draws (slice 3), scan periods for EO/IR, a scan model for the
threshold radars.

### Slice 2. The envelope, the estimate, and verification against mathematics

Goal: name the two modes for what they are and prove the engine against closed forms.

Files: `src/analysis/runValidity.ts` and test, `src/playback/convergence.verify.test.ts`
(new), `src/panels/analysis/LiveStrip.tsx` (chip meta), `src/panels/analysis/widgets/
RunValidityWidget.tsx`, `src/io/persist.ts` (export record), `CLAUDE.md`.

Contract:

```ts
// runValidity.ts
export type RunValidityFindingId =
  | 'spawn-in-ring' | 'no-defended-asset' | 'environment-not-applied' | 'threat-without-path'
  | 'planning-envelope'   // new, limiting, every gate, present under runMode 'deterministic'
```

Behavior:

- Under `runMode: 'deterministic'` the validity report carries `planning-envelope`: "Point
  values from the threshold envelope. Run Monte Carlo for an interval." The toolbar chip,
  the gate report and the export all derive it.
- The run header chip meta reads `envelope · Pd threshold` for the deterministic mode and
  `estimate · n replicates` for Monte Carlo.
- `RunExport.dataBasis` gains `semantics: 'planning-envelope' | 'estimate'`.
- `convergence.verify.test.ts` holds the closed-form cases. Every expected number is
  derived by hand in a comment, never copied from engine output:
  1. One scan radar, k scans at constant Pd p: cumulative detection `1 - (1 - p)^k`.
  2. M-of-N at constant p: the binomial tail, against `mOfN`.
  3. One shot at Pk q: kill mean q; two-shot shoot-look-shoot with time for both:
     `1 - (1 - q)^2`.
  4. A jam dwell at p: the continue-jam hold fraction p.
  5. Raid partition in every replicate.
  Each Monte Carlo assertion is within 3 standard errors at 1000 replicates.

Acceptance:

- The five cases pass. `runValidity.test.ts` pins the new finding on and off.
- The deterministic output of every existing fixture is unchanged (no engine file changes
  in this slice).

Stays out: any engine change; an analytic mean for the whole chain.

### Slice 3. Counter-based draws and interval statistics

Goal: common random numbers across configurations, and a `Stat` a reviewer can read.

Files: `src/geometry/prng.ts` and test, `src/playback/policy.ts` and test,
`src/playback/sim.ts` (member index), `src/playback/attrition.ts` (salvo index),
`src/playback/mcRun.ts` and test, `src/model/types.ts`, `src/model/seed.ts`,
`src/io/persist.ts`, `src/state/store.ts` (`runSettings` fields), `src/analysis/series.ts`
(`withBands` unchanged shape), `src/panels/analysis/LiveStrip.tsx` (popover fields),
`src/panels/analysis/widgets/KpiTilesWidget.tsx`, `ProjectionWidget.tsx`,
`src/panels/analysis/detail/*` (Stat readouts), `src/analysis/aar.ts`, `CLAUDE.md`.

Contract:

```ts
// prng.ts
/** FNV-1a 32-bit of a string id, cached by the caller. */
export function idHash(id: string): number
/** Uniform [0, 1) from integer parts through a 32-bit mixer. Pure; same parts, same value. */
export function hashU01(...parts: number[]): number

// policy.ts
export type DrawKind = 'detect' | 'kill' | 'jam' | 'phase' | 'param'
export function monteCarloPolicy(seed: number, replicate: number, thresholds: RequirementThresholds): DrawPolicy
// detect key: (seed, replicate, DETECT, idHash(sensorId), idHash(uasId), memberIdx, stepIndex(tS))
// kill key:   (seed, replicate, KILL, idHash(effectorId), idHash(uasId), shipIdx, salvoIdx)
// jam key:    (seed, replicate, JAM, idHash(effectorId), idHash(uasId), 0, stepIndex(tS))
// phase key:  (seed, replicate, PHASE, idHash(sensorId), 0, 0, 0)

// mcRun.ts
export interface Stat {
  mean: number; sd: number; se: number
  /** t-interval on the mean at conf. */
  lo: number; hi: number; conf: number
  p10: number; p90: number; p025: number; p975: number
  /** Finite samples, and replicates run. */
  n: number; total: number
  /** For a conditional quantity: the defined fraction with its Wilson interval. */
  defined: { p: number; lo: number; hi: number }
}
export interface McSummary { /* existing */
  stopped: { rule: 'replicates' | 'halfWidth'; at: number }
}

// types.ts, runSettings
export interface Scenario { /* existing */
  /** Stop when the 95 percent half-width of the end-of-run leaker mean is under this. Null: run every replicate. */
  targetHalfWidth?: number | null
}
```

Behavior:

- `kill` takes a per-effector salvo index so two salvos landing on the same step draw
  different values. `detect` takes the member index.
- `hashU01` and `idHash` have their own tests: uniformity over 1e5 draws (mean within
  0.005 of 0.5, no bin of 100 outside 5 percent), no collision across the four kinds, and a
  pinned value so a future change is visible.
- Common random numbers: `mcRun.test.ts` runs a laydown, then the same laydown with one
  extra effector, and asserts that every detect draw of the shared sensors is identical
  across the two runs (a recording policy).
- `Stat` uses `meanInterval`, `quantile` and `wilson` from `src/te/calc/stats.ts`. The
  `quantileSorted` copy in `mcRun.ts` is deleted.
- Stopping rule: after 30 replicates and every 10 after that, stop when the half-width of
  the end-of-run leaker mean is under `targetHalfWidth`. The summary records the rule and
  the replicate count. The chip reads `MC 240 of 1000 · seed 4821`.
- Tiles show `mean` with the sub `±h (95%) · n`. First detect and Min warning add
  `detected in n of total`. Bands are unchanged.
- The export carries the full `Stat` on every headline measure and the stopping record.

Acceptance:

- Same seed gives a deep-equal summary. A replicate index change changes only that
  replicate. The CRN test above passes.
- The stopping rule stops a Pk 0.5 one-salvo fixture before the cap and never before 30.
- `Stat.defined` for a threat nothing detects is p 0 with a Wilson interval; `n` 0.
- Performance number recorded again (the draw count fell in slice 1; the hash costs more
  per draw).

Stays out: paired comparison of two laydowns in the UI (CRN makes it possible; a later
plan builds it), importance sampling, antithetic draws.

### Slice 4. Parameter uncertainty and sensitivity

Goal: a spread on every planning factor that matters, a total-uncertainty band, and a
sensitivity ranking that names the assumptions that drive the answer.

Files: `src/model/types.ts`, `src/model/seed.ts`, `src/io/persist.ts` (`fillScenario`
line for the new nested field if any), `src/analysis/uncertainty.ts` (new) and test,
`src/playback/policy.ts` (`param` draw), `src/playback/mcRun.ts` and test,
`src/playback/mc.worker.ts` and `mcClient.ts` (sensitivity request), `src/state/store.ts`
(`mc` slice gains `sensitivity`), `src/charts/Tornado.tsx` (new, props only) and test,
`src/panels/analysis/widgets/SensitivityWidget.tsx` (new), `widgets/registry.ts`,
`widgets/labels.ts`, `src/state/analysisLayout.ts` (widget in the Threat and System
lenses), `src/panels/LibraryEditor.tsx` (spread column in Sources), `src/panels/inspector/
kit.tsx` (PfTag title shows the spread), `src/analysis/aar.ts`, `src/index.css`, `CLAUDE.md`.

Contract:

```ts
// types.ts
export type Spread =
  | { kind: 'lognormal'; sigmaDb: number }               // multiplicative: RCS, ranges, power
  | { kind: 'triangular'; lo: number; hi: number }       // additive bounds: latencies, dwells
  | { kind: 'beta'; successes: number; trials: number }  // probabilities from trial counts: Pk, placard Pd
export interface Provenance { /* existing */ spread?: Spread | null }
export type UncertaintyMode = 'aleatory' | 'total'
export interface Scenario { /* existing */ uncertainty?: UncertaintyMode }   // default 'aleatory'

// analysis/uncertainty.ts
/** PF spread by field name, one provenance-style row each (basis 'pf'). The user approves the values (O-4). */
export const PF_SPREAD: Record<string, { spread: Spread; source: string; date: string }>
/** The one spread resolver: the row's spread, else PF_SPREAD by field, else null (fixed). */
export function spreadFor(model: SpecModel, field: string): Spread | null
/** Every (modelId, field) pair with a spread in this scenario, in a stable order. */
export function uncertainFields(scenario: Scenario): Array<{ modelId: string; field: string; spread: Spread }>
/** Inverse-CDF sample of one spread at u in (0, 1) around the nominal value. */
export function sampleSpread(nominal: number, spread: Spread, u: number): number
/** A scenario whose library carries the sampled values. Pure; the input is untouched. */
export function sampleScenario(scenario: Scenario, u: (modelId: string, field: string) => number): Scenario

// mcRun.ts
export interface SensitivityRow {
  modelId: string; field: string; label: string
  /** Headline stat mean with the field at its p10 and its p90, every other field nominal. */
  low: number; high: number; swing: number
}
export interface SensitivitySummary { stat: 'leakers'; rows: SensitivityRow[]; replicates: number; seed: number }
export function runSensitivity(scenario: Scenario, onProgress?: (done: number, total: number) => void): SensitivitySummary
```

Behavior:

- Under `uncertainty: 'total'` each replicate first draws `u` for every uncertain field
  through the `param` draw kind (key: seed, replicate, PARAM, idHash(modelId),
  idHash(field)), builds `sampleScenario`, and runs the sweep and attrition on it. Under
  `'aleatory'` the nominal scenario runs, so slice 3 output is unchanged.
- Fields with a spread in this slice: `rcsM2` (or the group tier when the spec has none),
  `detectRangeM`, `pk`, `engageTimeS`, `Connection.latencyS` (or the hop default),
  `trackInitS`, `declareHostileS`, `targetS`, `bdaS`. A field the slice cannot source a
  spread for is listed in O-4 with a proposed PF value; it stays fixed until the user
  approves.
- `runSensitivity` runs, for each uncertain field, `replicates` replicates with the field at
  its p10 and at its p90 under the same seed (paired by CRN), every other field nominal,
  and reports the swing on the end-of-run leaker mean. Rows sort by swing. The worker
  streams progress per field.
- The `sensitivity` widget draws a tornado: one bar per field, low and high ends, the
  nominal as a rule, the PF tag at the label. Its meta reads `leakers · n reps · seed`.
- `uncertainty` joins `runSettings` and `analysisBasisSignature`. The popover gains the
  mode toggle. The chip reads `MC 100 · total` under the total mode.
- The Sources table shows the spread per row. The PfTag title gains the spread text.
- The export carries `uncertainty`, the sampled field list and the sensitivity rows.

Acceptance:

- `uncertainty.test.ts`: `sampleSpread` at u 0.5 returns the nominal for every kind; the
  lognormal at u for sigma 3 dB returns the value the closed form gives; the beta uses
  `betaQuantile` from `src/te/calc/stats.ts` (module-private today, exported in this slice,
  O-6); `sampleScenario` changes only the
  listed fields and never the input.
- `mcRun.test.ts`: `'aleatory'` output equals slice 3 output byte for byte; `'total'` with a
  6 dB RCS spread widens the first-detect p10 to p90 band on the slice 1 fixture; a field
  with no spread never changes.
- Sensitivity: a fixture with one radar and one interceptor ranks `pk` above `rcsM2` when
  the radar sees the target far outside the envelope (the hand argument in a comment), and
  the paired swing has lower variance than an unpaired pair of runs (assert on the
  difference of two seeds).
- Browser check: the tornado renders in the Threat lens with PF tags, the mode toggle
  marks the summary stale, and the pre-slice autosave loads with no recovery key.

Stays out: Sobol or variance-based indices, correlated spreads, a spread editor beyond the
Sources table.

### Slice 5. Flyout kinematics

Goal: effect time from a sourced interceptor speed and a predicted intercept point; one
kinetic Pk rule.

Files: `src/model/types.ts`, `src/model/seedLibrary.ts` (rows only where sourced),
`src/playback/attrition.ts` and tests, `src/canvas/layers/footprintStyle.ts` (delete
`kineticPkPenalty`, import the engine rule; F-20), `src/panels/Inspector.tsx`,
`src/panels/LibraryEditor.tsx`, `src/panels/analysis/detail/EffectorDetail.tsx`, `CLAUDE.md`.

Contract:

```ts
// types.ts, EffectorSpec
/** Kinetic only: average interceptor or round speed to the target, m/s. Absent: no flyout term. */
flyoutSpeedMps?: number | null

// attrition.ts
/** Seconds of flight to a slant range; 0 when the effector states no speed. */
export function timeOfFlightS(spec: EffectorSpec, slantM: number): number
/** Predicted intercept: the target position at tS + engageTimeS + timeOfFlight, solved by three fixed-point passes. */
export function interceptAt(ts: ThreatState, es: EffectorState, tS: number, memberIdx: number): { pos: Vec2; slantM: number; tEffectS: number }
/** The one kinetic per-shot Pk: basePk * distanceFalloff * SIZE_PENALTY * EVASION_PENALTY at the intercept slant. */
export function kineticPk(es: EffectorState, uas: UasSpec | undefined, slantM: number): number
```

Behavior:

- `tEffect = t + engageTimeS + timeOfFlightS(spec, interceptSlant)`. The doctrine deadline
  and the shoot-look-shoot window read the same `tEffect`. DE, HPM and jammers have no
  flyout.
- `distanceFalloff` is evaluated at the predicted intercept slant, not the position at
  assignment, in both the legacy pass and the doctrine pass.
- `kineticPk` is the one rule; `footprintStyle.ts` imports it for the commit ring.
- `SIZE_PENALTY` and `EVASION_PENALTY` get PF spread entries in `PF_SPREAD` (slice 4 shape)
  and a PF row in the Inspector.
- Seed interceptors take `flyoutSpeedMps` only with a `datasheet` or `reference` row under
  the slice 9 research rules (`docs/data-engine/outstanding.md` D-71 to D-73). No source,
  no value.

Acceptance:

- `attrition.test.ts`: a 200 m/s interceptor at 4 km gives `tEffect = t + engageTimeS + 20`
  within one DT, and the intercept point sits where `posAtTime` puts the target at that
  time (hand-derived numbers in a comment); an effector with no speed reproduces the
  slice 4 ledger byte for byte.
- `accuracy.verify.test.ts` stays green (its fixtures state no speed).
- `footprintStyle.test.ts`: the commit ring radius equals the inverse of `kineticPk`.

Stays out: an aspect or crossing-rate factor (O-7), a miss-distance model, guidance
kinematics, a gun burst model.

### Slice 6. Fidelity tags on every model and every result

Goal: a result carries the tier and validation status of every model that produced it.

Files: `src/analysis/fidelity.ts` (new) and test, `src/analysis/impact.ts` (`modelsUsed`
from the picture), `src/analysis/runValidity.ts` and test, `src/io/persist.ts` (export),
`src/panels/analysis/widgets/RunValidityWidget.tsx`, `src/panels/analysis/detail/
detailRows.tsx` (tag chip), `src/index.css`, `CLAUDE.md`.

Contract:

```ts
// fidelity.ts
export type ModelId =
  | 'radar-pd' | 'radar-scan' | 'eoir-range' | 'acoustic-range' | 'rf-detect' | 'jam'
  | 'environment' | 'horizon' | 'track-init' | 'doctrine' | 'kinetic-pk' | 'flyout'
  | 'draw-policy' | 'parameter-spread'
export type FidelityTier = 'planning' | 'physics'
export type ValidationStatus = 'none' | 'analytic' | 'datasheet' | 'trial'
export interface ModelTag { id: ModelId; label: string; tier: FidelityTier; validation: ValidationStatus; standard?: string; note: string }
/** The one tag table. */
export const MODEL_TAGS: Record<ModelId, ModelTag>
/** The models a run exercised, from the deterministic picture and the run settings. */
export function modelsUsed(scenario: Scenario): ModelTag[]
```

Behavior:

- `MODEL_TAGS` records what is true at this slice: `radar-pd` physics and analytic
  (Marcum-Q pins), `radar-scan` physics and analytic (slice 2), `eoir-range` planning and
  none, `acoustic-range` planning and none, `rf-detect` planning and none, `jam` planning
  and none, `environment` planning and none, `horizon` physics and analytic, `track-init`
  planning and none, `doctrine` planning and none, `kinetic-pk` planning and none, `flyout`
  physics and analytic, `draw-policy` physics and analytic, `parameter-spread` planning and
  none. The `standard` column cites the greenfield section 1 clause where one applies.
- A new `limiting` finding `unvalidated-model` lists every used tag with validation
  `none`, on every gate. Its text names the models.
- The run-validity widget shows the used tags as chips (tier and status). A detail pane
  header shows the tags of the models behind that entity.
- The export carries `models: ModelTag[]`.

Acceptance:

- `fidelity.test.ts`: every `ModelId` has a tag; `modelsUsed` on a radar-only laydown
  excludes `eoir-range` and includes `radar-pd` and `radar-scan`; the doctrine-off legacy
  fixture excludes `doctrine`.
- `runValidity.test.ts`: the finding lists the right names and is absent when every used
  model is validated (a fixture that stubs the table).

Stays out: a fidelity editor, per-entity overrides of a tag.

### Slice 7. Validation against public data

Goal: the radar range law and the seed placards agree with manufacturer datasheet points,
recorded as tests, and the `radar-pd` tag moves to `datasheet`.

Files: `src/analysis/validation.verify.test.ts` (new), `src/analysis/fidelity.ts` (tag
status), `src/model/seedLibrary.ts` (rows only), `CLAUDE.md`.

Behavior:

- Fixtures from sources already read in slice 9 (`docs/data-engine/outstanding.md` F-65):
  the Blighter A400 six-point RCS-to-range table (0.01 m2 2.73 km through 10 m2 15.40 km),
  the Echodyne EchoShield per-group bands, the EchoGuard Phantom 4 and Matrice 600 pair.
  Each fixture cites the page and the date in a comment.
- Tests: `rangeForPd` at the placard Pd reproduces each Blighter point within 2 percent
  (free space, `apply: false`); the sweep with the Blighter seed against a 0.01 m2 target
  first-detects at or beyond 2.73 km on a radial path; the EchoShield seed against each
  group lands inside the published band.
- A point the model cannot reproduce is recorded as `R-F` with the residual, and the test
  pins the residual as a known deviation with a comment. Nothing is tuned to pass.
- `MODEL_TAGS['radar-pd'].validation` becomes `datasheet` with a note that names the
  sources.

Acceptance:

- The validation file is green or every deviation is pinned and listed.
- No seed value changes in this slice.

Stays out: trial data (none public), EO/IR, acoustic and RF validation (no published
range-versus-target tables were found in slice 9).

## 8. Verification gate for every slice

1. `npx tsc --noEmit -p tsconfig.app.json` clean.
2. `npx vitest run` green. New tests colocated. Count reported in the commit message.
3. `npm run lint` with no new warnings beyond the baseline (74 at `e6edbb4`).
4. `npm run build` clean.
5. Load the pre-slice autosave (`rangeboard.scenario.v1`) in the browser. No recovery key
   is written. The five-threat screenshot scenario reproduces its run.
6. Playwright check through `window.__store` for the behaviors the slice names, with a
   screenshot saved to the scratchpad, never to the repo.
7. Monte Carlo timing of the five-threat scenario at 100 replicates in the worker,
   recorded in the commit message for slices 1, 3, 4 and 5.
8. `CLAUDE.md` updated where the slice changed a contract.

## 9. CLAUDE.md edits by slice

- Slice 0: the "Provenance" bullet says every sensor, effector and threat seed carries
  rows, not only the radars.
- Slice 1: the "Track initiation" bullet gains the scan origin (path start plus phase) and
  `scanPeriodS` as the one scan period; the "Draw policy" bullet names four draw points.
- Slice 2: the "Draw policy" bullet names the deterministic mode as the planning envelope
  and lists `planning-envelope` under "Run validity".
- Slice 3: the "Draw policy" bullet replaces `mulberry32(seed + replicate)` with the
  counter-based key and names `Stat` as the one statistic shape; `targetHalfWidth` joins
  the run settings list.
- Slice 4: a new "Parameter uncertainty" bullet (`spread` on the row, `spreadFor` the one
  resolver, `sampleScenario` pure, `uncertainty` in the basis signature, sensitivity
  paired by CRN); the "Provenance" bullet gains the spread.
- Slice 5: the "Fire doctrine" bullet gains the flyout term and `kineticPk` as the one Pk
  rule.
- Slice 6: a new "Fidelity" bullet (`MODEL_TAGS` the one table, `unvalidated-model` under
  run validity, tags in the export).
- Slice 7: the "Fidelity" bullet records the `datasheet` status and the validation file.

## 10. Open items the user holds

| # | Item | Needed by |
| --- | --- | --- |
| O-1 | Closed 2026-09-04: the greenfield stub is deleted; its standards table is section 12. | closed |
| O-2 | Closed 2026-09-04: D-11 is superseded by slice 1 (origin at the path start with a phase); recorded on the D-11 row. | closed |
| O-3 | `SCAN_S` PF values by role for a Pd-modeled radar with no stated `updateRateS`. The slice proposes values with a source or marks them `pf`. | slice 1 |
| O-4 | `PF_SPREAD` values: a lognormal sigma for RCS and placard range, triangular bounds for latencies and dwells, beta pseudo-counts for Pk. The slice proposes each with a source or a `pf` row; nothing runs under `total` until the user approves. | slice 4 |
| O-5 | The stopping-rule quantity is the end-of-run leaker mean. Confirm, or name another. | slice 3 |
| O-6 | `mcRun.ts` and `uncertainty.ts` import `meanInterval`, `quantile`, `wilson` and `betaQuantile` from `src/te/calc/stats.ts`. This is the first engine import from `src/te/`. Accept, or move those four to a leaf module under `src/analysis/` with their fixture tests. | slice 3 |
| O-7 | An aspect or crossing-rate Pk factor needs a sourced curve. None was found in slice 9 research. Stays out until one exists. | slice 5 |
| O-8 | Chip wording: `DET` stays as the mode code with the meta `envelope · Pd threshold`. Accept, or rename the code. | slice 2 |
| O-9 | The Rust and WebAssembly engine is deferred. This plan keeps the TypeScript engine. | before slice 0 |
| O-10 | Closed 2026-09-04: `e6edbb4` pushed to `origin/analysis-hardening`. | closed |
| O-11 | Slice 0 field lists per kind (section 7). Trim or extend before the research contract is written. | slice 0 |

## 11. Schedule and agent assignment

Approved by the user on 2026-09-04. Section 7 is the dependency order. This section is the
build order: three waves, several owners per wave, one gate per wave, one commit per wave
with the per-slice tables in the message.

### 11.1 Orchestrator

A Fable high agent is the orchestrator and the oversight of every wave. It writes the
contract file, scouts the line numbers, writes every brief, runs `tsc` and `vitest`
between phases, cross-checks research JSON with a scratch test, reads every screenshot,
applies the fix phase, and records every decision as an `R-D` row. It is active during a
wave, not only at its boundaries: an owner that reports a contract conflict, an open
semantic question or a fixture that moves gets an answer from the orchestrator inside the
phase, and the answer is recorded.

### 11.2 Waves

| Wave | Owners in parallel | Depends on |
| --- | --- | --- |
| 1 | Slice 0 (research, then apply). Slice 1. Slice 5 code. Statistics half of slice 3 (`Stat`, intervals, defined fraction, stopping rule, tiles, export) with the pure half of slice 4 (`Spread`, `uncertainty.ts`, `Tornado.tsx`) and the `fidelity.ts` table. | nothing |
| 2 | Draw half of slice 3 (prng, policy, member and salvo index, CRN test). Slices 2 and 6 merged (findings, chip meta, export, convergence tests, `modelsUsed`, tag chips). Slice 7 test file and tag status. | wave 1 |
| 3 | Integration half of slice 4 (param draw, `sampleScenario` in the loop, `uncertainty` in the settings and the basis signature, `runSensitivity`, worker protocol, `mc` slice, widget, editor column, export). | wave 2 |

The critical path is slice 1, then the draw half of slice 3, then the integration half of
slice 4.

### 11.3 Ownership rules per wave

- One owner per file per phase, as in `docs/data-engine/HANDOFF.md` section 2. The
  orchestrator writes the ownership table into every brief verbatim.
- `types.ts` has one owner per wave. In wave 1 it is the statistics owner; the slice 5
  `flyoutSpeedMps` field and the `Spread` type are contract lines it implements.
- `Inspector.tsx` belongs to slice 0 in wave 1. Slice 1 hands it the scan-period row as a
  contract line.
- `seedLibrary.ts` belongs to slice 0. Interceptor speeds its research finds land as the
  slice 5 row through the slice 0 apply agent, from a contract slice 5 fixes first.
- Slice 0 apply lands before slice 1 and slice 5 pin any fixture. A fixture pinned before
  that uses hand-built models only. A sourced threat RCS change moves every Pd fixture that
  flies a seed threat.
- One `CLAUDE.md` editor and one `index.css` editor per wave, the design agent, at the end.
- Every owner keeps the full suite green at each phase boundary. The wave gate is the only
  build.
- A wave gate that is red blocks the commit for every slice in the wave.

### 11.4 Agent assignment

The rule: Fable medium is the default for work that needs judgment. Fable high only where
the semantics decide the outcome. Opus high or xhigh for mechanical work under a fixed
contract. The orchestrator may not raise a class at brief time without a reason recorded
as an `R-D` row; scouting that shows an open semantic question is the only accepted
reason. Fable high never runs a mechanical task; when a high-effort owner finishes the
semantic part, the plumbing goes to an Opus agent in the next phase.

| Wave | Owner | Model and effort | Why |
| --- | --- | --- | --- |
| all | Orchestrator and oversight | Fable high | section 11.1 |
| 1 | Slice 0 research, four agents | Fable medium | the slice 9 shape: verbatim quotes, blanks left null |
| 1 | Slice 0 apply | Opus high | seed edits from a JSON; zero mismatches in slice 9 |
| 1 | Slice 1 sim scan model | Fable high | scan origin, phase and the M-of-N window are the semantics; fixtures move |
| 1 | Slice 5 attrition flyout | Fable high | the doctrine deadline arithmetic reads `tEffect` and must be re-derived |
| 1 | Statistics half of slice 3 | Fable medium | statistics under a fixed `Stat` contract |
| 1 | Pure half of slice 4 | Fable medium for `uncertainty.ts`; Opus high for `Tornado.tsx` and `fidelity.ts` | math versus a kit component and a table |
| 2 | Draw half of slice 3 | Fable high | the draw key decides whether common random numbers hold; a collision is silent |
| 2 | Slices 2 and 6 merged | Opus high for findings, chip, export, widget; Fable high for `convergence.verify.test.ts` | plumbing versus hand-derived closed forms |
| 2 | Slice 7 validation tests | Fable medium | datasheet fixtures against an unchanged model |
| 3 | Slice 4 integration, engine side | Fable medium | `sampleScenario` in the loop, `runSensitivity` pairing |
| 3 | Slice 4 integration, store, worker, widget, editor | Opus xhigh | multi-file plumbing under a fixed contract |
| every wave | review-correctness | Fable high | adversarial, as in every slice |
| every wave | review-scope | Fable medium | the handoff table |
| every wave | gate, browser-verify, final-gate, design | Opus high | the handoff table |

Quality is bounded by the contract, the acceptance tests with hand-derived expectations,
the Fable high review on every diff and the wave gate, not by the builder's effort class.
A medium-effort builder that misreads a contract line fails a test or the review.

## 12. Standards referenced

Carried from the deleted greenfield draft of 2026-09-04. A slice cites a row here where
it meets a clause; the `standard` column of `MODEL_TAGS` (slice 6) points at a row.

| Area | Standard or reference |
| --- | --- |
| VV&A policy | DoDI 5000.61, DoD M&S Verification, Validation and Accreditation |
| VV&A documentation | MIL-STD-3022, Documentation of VV&A for Models and Simulations |
| Credibility assessment | NASA-STD-7009A credibility factors: verification, validation, input pedigree, results uncertainty, results robustness, use history, M&S management, people qualification |
| Statistical rigor in T&E | DOT&E guidance on scientific test and analysis techniques; STAT COE design of experiments guidance |
| Geodesy | WGS 84 (NGA.STND.0036), EGM2008 geoid |
| Atmosphere | US Standard Atmosphere 1976 (ISO 2533); ITU-R P.676 gaseous attenuation; ITU-R P.838 rain attenuation |
| RF propagation | ITU-R P.2001 wide-range terrestrial model; ITU-R P.526 diffraction; ITU-R P.528 aeronautical paths; NTIA ITM (Longley-Rice) as the cross-check model |
| Radar | Blake range performance method; Barton radar equations; Swerling cases evaluated with Marcum-Q and Shnidman; Billingsley land clutter; IEEE 686 definitions |
| EO/IR | NVESD NV-IPM methodology and the Targeting Task Performance metric; Johnson criteria retained as a legacy cross-check |
| Acoustic | ISO 9613-2 outdoor attenuation; ANSI/ASA S1.26 atmospheric absorption |
| Navigation | GPS SPS Performance Standard; INS error as random walk plus bias |
| Tracking | Bar-Shalom and Li, estimation and data association; Blackman and Popoli, multi-target tracking |
| Terrain data | DTED (MIL-PRF-89020B), SRTM, USGS 3DEP |
| Symbology | MIL-STD-2525 (already in use) |
