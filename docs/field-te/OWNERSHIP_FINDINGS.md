# RangeBoard: ownership findings

Status: VERIFIED ONBOARDING RECORD, 2026-09-04, source revision `8b528f2` on
`analysis-hardening`. This record describes the inspected implementation, not a completed
correction. [PLAN.md](PLAN.md) proposes the follow-on work. All source references below
are against that revision.

`[V]` means source/test/tool verified; `[D]` means a documented intent; `[I]` means a
reasoned implication; `[U]` means unresolved. Tests verify their assertions, not all
real-world behavior. The original transfer can be recovered with
`git show 8b528f2:docs/AI_HANDOFF.md`.

C1 update, 2026-09-04: R-F-24 is now verified closed in the working tree. The findings
below preserve the onboarding snapshot. [C1_COMPLETION.md](C1_COMPLETION.md) records the
input matrix, reproduced same-run callback race, sensitivity-display correction and new
verification; the other findings remain open.

## 1. Baseline and readiness

[V] All four onboarding gates passed: TypeScript clean; 1,202 tests in 69 files; lint
74 warnings and zero errors (72 component-export warnings, two set-state-in-effect);
production build succeeded with its chunk-size warning. Main bundle 1,981.57 kB,
572.08 kB gzip; worker 287.24 kB. These are an engineering baseline, not a field acceptance
or prediction-accuracy result. See [package.json](../../package.json) and the preserved
[test](evidence/onboarding-2026-09-04/vitest-output.txt),
[lint](evidence/onboarding-2026-09-04/lint-output.txt) and
[build](evidence/onboarding-2026-09-04/build-output.txt) outputs.

[V] Browser probes used a separate Playwright profile and real store actions. Both
workspaces and all six T&E stages plus Products mounted; legacy defaults reloaded without
a recovery key; a typed KuRFS/C2/Coyote route fired. No page errors were captured in those
probes. This was not an exhaustive campaign or accessibility test. The four pre-existing
untracked mockup files were untouched. No source or configuration changed in onboarding.

[I] Ready for bounded corrective work and subsequent refactoring. Not ready to claim
that every estimate follows its inputs or that the T&E store enforces every promised
record invariant. C1-C4 should precede broad architecture or field-release claims.

## 2. Product, architecture and state

[V] Board is a meter-scaled React/Konva planning canvas; T&E Ops is a separate campaign
workflow. Zustand owns Board scenario/history/view/playback/MC state; a separate T&E
store owns campaigns with no undo. `main.tsx` loads local state and starts the autosaves;
`App.tsx` selects workspaces. No backend or installed offline shell is implemented.
Sources: [App](../../src/App.tsx), [startup](../../src/main.tsx),
[Board store](../../src/state/store.ts), [T&E store](../../src/te/state/teStore.ts).

[V] Scenario edits snapshot history through `mutate`; view state persists separately and
does not enter undo. Derived results are outside Scenario. `engagementPicture` is a
WeakMap cache keyed by scenario object identity. MC/sensitivity use worker slots and
store freshness guards. The store/engine/view-state dependency cycles remain a refactor
risk; workers pull store dependencies into their bundle.
Sources: [mutate](../../src/state/store.ts#L913),
[cache](../../src/analysis/impact.ts), [client](../../src/playback/mcClient.ts),
[view persistence](../../src/io/viewState.ts). Register F-19, F-59.

[V] Persistence is schema-version-1 localStorage, with defaults and seed-provenance
adoption. Saved builtin values remain the user's saved copy; changed seed values require
reset to seed. Recovery copies are best-effort and may fail under storage pressure.
Sources: [fill/load](../../src/io/persist.ts#L49),
[keys](../../src/io/storageKeys.ts), [recovery](../../src/io/recovery.ts),
[campaign load](../../src/te/io/persistTe.ts#L16).

## 3. Confirmed priority findings

| Register / priority | Verified finding | Consequence and correction scope |
| --- | --- | --- |
| R-F-24 / high | `analysisBasisSignature` omits entity altitude/defended radius, doctrine, requirements and provenance spreads. Browser edits changed each input while MC remained `done` and the old summary remained current. Raising the threat altitude changed deterministic events from four to zero. [Signature](../../src/state/store.ts#L636), [freshness reader](../../src/panels/analysis/widgets/mc.ts#L14). | C1: inventory the complete resolved basis and apply it through every mutation/undo/worker path. Connection draw identities also require review. |
| R-F-25 / high | Projection values use deterministic assessments/report while interval subs use MC; percentage values can be paired with count-scale uncertainty. Several KPI values remain deterministic under an MC mean label. Export groups also mix bases. [OutcomeSummary](../../src/panels/analysis/OutcomeSummary.tsx#L75), [KpiTilesWidget](../../src/panels/analysis/widgets/KpiTilesWidget.tsx), [export](../../src/io/persist.ts#L287). | C2: consistent estimators, units and denominators; explicit basis per measure/group; define MC requirement semantics. |
| R-F-26 / high | Board parser accepts `entities: null`; T&E parser accepts a campaign with `cards: null`. Top-level/schema checks and filling do not validate the full runtime shape. [Board parser](../../src/io/persist.ts#L129), [T&E parser](../../src/te/io/persistTe.ts#L33). | C3: prevent adoption of malformed data and exercise recovery. Later failure outside the loader is a risk; actual user data loss was not demonstrated. |
| R-F-27 / high | Generic T&E `patchItem` edits an issued card without changing version; `removeItem` deletes it. UI freezing does not enforce the invariant in the store. Some workflow transitions simply stamp completion. [Generic actions](../../src/te/state/teStore.ts#L694), [transitions](../../src/te/state/teStore.ts#L836), [card UI](../../src/te/ui/CardsPanel.tsx#L171). | C4: enforce authoritative transition rules, retain version lineage and validate import paths. Draft creation/editing is legitimate. |
| R-F-28 / high | `validate.runIncludable` accepts an invalid, non-excluded run. Quantitative calculation has a stricter private helper; finding/deliverability checks use the broader rule. `findingBlockers` cannot resolve campaign references from IDs alone. [Validation](../../src/te/validate.ts#L92), [measure inclusion](../../src/te/calc/measures.ts#L47), [DeliverPanel](../../src/te/ui/DeliverPanel.tsx). | C4: one explicit policy per evidence purpose. Preserve invalid runs for failure findings; prevent them from silently supporting valid-trial denominators or unqualified conclusions. |

Probe outputs: [browser-results.json](evidence/onboarding-2026-09-04/browser-results.json)
and [supplement-results.json](evidence/onboarding-2026-09-04/supplement-results.json).
The source paths and store actions described here permit rechecking after changes; these
JSON files are captured observations, not an automated regression suite.

## 4. Simulation, analysis and geometry

[V] Detection sweeps at DT=0.5 s. Scan radars have per-scan initiation/hold/coast/drop;
classification depends on actual observations, not coast extrapolation. Routes and
doctrine determine release readiness. Attrition allocates fire and records release/effect
events, expected pre-arrival kills, late kills, leakers and no-arrival mass. Kinetic,
directed-energy and EW expenditure channels are distinct. A continue-jam is illumination
that can lapse. Sources: [sweep](../../src/playback/sim.ts),
[track](../../src/playback/trackState.ts), [attrition](../../src/playback/attrition.ts),
[EW](../../src/analysis/ewPhysics.ts), [verification cases](../../src/playback/convergence.verify.test.ts).

[V] Deterministic mode thresholds detection, carries effect mass and uses zero scan phase.
MC uses discrete counter-keyed draws and phase variation, plus the selected parameter
vector under `total`. It does not use the deterministic picture cache. The modes are
different estimands/approximations by construction; matching their outputs is not a
correctness goal. Stats contain means, t-intervals, SEs, quantiles and defined fractions;
the optional stopping check considers end-run leakers after 30 and then every 10 runs.
Sources: [policy](../../src/playback/policy.ts), [PRNG](../../src/geometry/prng.ts),
[MC](../../src/playback/mcRun.ts), [statistics](../../src/te/calc/stats.ts).

[V] `total` samples the fields listed by `FIELDS_BY_KIND`, connection latency and doctrine
declaration time, subject to resolvers. It does not sample every PF. Size/evasion entries
exist in `PF_SPREAD` but are not enumerated for sampling; the decided flyout-factor spread
is not implemented. Common random numbers depend on stable IDs/key semantics; member
indices still follow admitted ordering. Sources: [uncertainty](../../src/analysis/uncertainty.ts#L79),
[draw keys](../../src/playback/policy.ts), [flyout](../../src/playback/attrition.ts#L155).
R-F-29, R-F-2, R-F-15.

[V] World coordinates are meters, +x east and +y south; headings are clockwise from north.
Camera scale is pixels per meter. `posAtTime` is defined in `geometry/geo.ts`, used by the
playback engine. Sensor/effector range checks use slant while azimuth remains horizontal;
selected-threat rings ground-project. Threat altitude is uniform for an instance, resolved
from entity/profile/band defaults. The horizon is 4/3-earth. Terrain, per-waypoint altitude
and detailed refraction are absent. Acoustic geometry returns after the ceiling check
before the elevation/horizon checks. Sources: [geo](../../src/geometry/geo.ts#L174),
[slant](../../src/geometry/slant.ts), [sensor geometry](../../src/analysis/sensorEnv.ts),
[rings](../../src/canvas/layers/footprintStyle.ts), [altitude resolver](../../src/model/types.ts).

[V] The flyout model uses a constant fraction (0.7 PF) of stated maximum/muzzle speed,
three intercept iterations and a window-end cap marked `flightCapped`. This is an explicit
approximation. [I] The cap alone does not establish physical interception feasibility;
numerical/kinematic applicability needs E2 review.
Source: [time of flight and intercept](../../src/playback/attrition.ts#L574), R-F-7.

## 5. T&E Ops and analytical basis

[V] The workflow covers campaign questions/measures, matrix/design, card issue/revision,
runs/observations, analysis/findings and print/CSV deliverables. IDs and card version lineage
exist; runs can carry Board baseline snapshots and frames. Pure calculation tests derive
from illustrative MASTER-CALCULATIONS examples. These are useful verification fixtures,
not independent trial observations.
Sources: [T&E types](../../src/te/model/types.ts), [store](../../src/te/state/teStore.ts),
[calculation tests](../../src/te/calc/stats.test.ts),
[compiled calculations](../te-compilation/MASTER-CALCULATIONS.md),
[demo](../../src/te/seed/jiatf401.ts).

[V] Seed provenance distinguishes datasheet/reference/PF, and edits drop affected field
provenance. Model fidelity has fourteen tags. Radar published comparisons exercise range
relationships; EO/IR, acoustic, RF, jam, environment, doctrine and effect-response models
retain substantial reduced-model/PF assumptions. "Physics" as a tier is not independent
whole-system validation. Sources: [seed library](../../src/model/seedLibrary.ts),
[types/resolvers](../../src/model/types.ts), [fidelity](../../src/analysis/fidelity.ts),
[published comparisons](../../src/analysis/validation.verify.test.ts).

[D] Casey's next objective is accurate, physically defensible hypotheses for C-UAS field
tests. No separate trial dataset exists. [I] The logical next analytical step is a
source-to-equation/model dossier and a prioritized comparison suite, then bounded model
corrections. It is not replacement of every PF with an unobserved distribution.

## 6. Transfer statements the implementation does not support

This table refers to the original `AI_HANDOFF.md` at `8b528f2`, before the current concise
handoff replaced it. It explicitly separates false current facts from unmet contract goals.

| Original statement/topic | Current finding |
| --- | --- |
| Section 2 current tree/counts, plus old push state | Stale snapshot. Inspected HEAD is `8b528f2`, 74 commits, 33 ahead of `main`, equal to local `origin/analysis-hardening`. Remote state was not freshly fetched. |
| Sections 3/8 reference the old detailed CLAUDE contract; section 16.1 says only CLAUDE exists | `AGENTS.md` now holds the contract; CLAUDE is a pointer. Section 16.2 of the old transfer already contradicted 16.1. |
| `SpecModel` kind includes `threatProfile` | Wrong type description. `kind` uses `EntityKind`; `threatProfile` is an optional property. C2/asset/marker kinds also exist. `model/types.ts`. |
| `posAtTime` belongs to `playback/sim.ts`; `simTimeS` is the only mutable playback state | Definition is in `geometry/geo.ts`; playback also has speed, flags, run identity and basis state. `state/store.ts` `PlaybackState`. Derived positions still must not be stored in Scenario. |
| Basis changes make the current result stale | Intended guard exists but its signature misses material inputs. Confirmed R-F-24. |
| Every headline result carries matching quantified uncertainty/basis | Not uniformly implemented. Projection/KPI/export mixtures violate the intended result contract. R-F-25. |
| Invalid saves recover before adoption | Only shapes recognized as invalid by the shallow parser reach that path. Null collections can pass. R-F-26. |
| T&E records are append-only, issued cards frozen, traceability gates enforced | Dedicated issue/revise paths implement part of this; generic store actions and finalization/reference boundaries do not enforce all of it. R-F-27/R-F-28. |
| Section 11 lists F-20 as three copies of kinetic Pk | Obsolete. Shared `kineticPk` is called by attrition and ring geometry; `kineticPkPenalty` is gone. |
| Section 11 carries D-61's role-table Pd radar behavior and D-62's stream PRNG as current concerns | Pd radars now get scan periods/coast; draws are counter-keyed. The cumulative-initiation policy and member-order pairing still merit separate review. |
| `valid` is unreachable for every real model set (R-F-14) | False universal claim. A sensor-only MC scenario with doctrine off, environment disabled at neutral covariates and applicable analytically/datasheet-checked models returns `valid`, findings `[]`. This does not certify operational effectiveness. |
| R-F-20 firing browser evidence is unverified | Now reproduced: typed Giraffe/C2/Coyote gives `no-fc-uplink`; adding routed KuRFS produces four deterministic events. UI explanation remains open. |
| All decided follow-ups are completed | R-F-3/R-F-6/R-F-16 are still future work; R-F-2's spread and R-F-15's member-order issue remain. `decided` is not `done`. |

Other current stale copy: `fidelity.ts` says one PRNG stream; ProjectionWidget states a
fixed 5% threshold; `DesignPanel.tsx` says altitude is not modeled; some seed descriptions
contradict provenance and some old comments describe superseded scan/draw behavior. M-11
tracks this source-copy work. Historical plans keep their original text and status.

## 7. Browser firing case and evidence limits

[V] In an isolated browser profile, load an empty scenario; add Giraffe 1X at (0,0),
FAAD C2 at (-600,0), Coyote at (1700,-1700) and Mavic 3 at (0,-6000), altitude 300 ft.
Draw its path to (0,0); add an asset there with defended radius 300 m. Use
`beginConnect`/`completeConnect` for Giraffe-to-C2 and C2-to-Coyote. Result:
`no-fc-uplink`, zero events. Add KuRFS at (100,0), connect it to C2 the same way.
Result: `engageable`, four deterministic events, expected pre-arrival kills 0.9599700431.

Set mode `monte-carlo` before `runMonteCarlo`, uncertainty `total`, 30 replicates.
The captured IDs/seed produced mean 1.6667 salvos, 0.9667 kills and 0.0333 leakers.
Those sample values are observations for this exact saved scenario, not universal pins
for newly generated IDs. Preserve all IDs when replaying it.

The [saved scenario](evidence/onboarding-2026-09-04/firing-scenario.json) and
[Board screenshot](evidence/onboarding-2026-09-04/board.png) are an integration probe.
It spawns within KuRFS detection range, so `spawn-in-ring` invalidates detection evidence.
Do not use it as a detection-accuracy or field acceptance fixture. C2/E1 must establish
an additional scenario that begins outside the relevant detection region.

[V] The [T&E screenshot](evidence/onboarding-2026-09-04/te.png) shows the illustrative
workflow. The temporary development server was stopped after inspection. Browser scripts
and scratch paths are not durable product tests; the captured outputs above are preserved.

## 8. Highest regression risks

- Freshness/identity: scenario inputs, worker request ordering, undo/redo and export basis.
- Time/geometry: slant versus ground, grid origin/endpoints, scan versus observation,
  release versus effect versus arrival, and physically infeasible approximations.
- Statistical meaning: CRN draw keys, conditional denominators, sample counts, interval
  units, optional stopping and parameter/model uncertainty scope.
- State/data boundaries: valid legacy saves, malformed imports, edited seed provenance,
  quota recovery, immutable issued records and referenced campaign evidence.
- Shared semantics: Pk/ring inversion, track/hold/classification vocabulary, raid partition,
  expenditure channel counters, route typing and fire-control eligibility.
- UI evidence: 320 px clipping, chart contents absent from static rendering, disabled or
  stale states and explanations that can disagree with the calculation underneath.

These are the acceptance boundaries of the proposed plan, not authorization for a redesign.
