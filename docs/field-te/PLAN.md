# RangeBoard: field T&E development plan

Status: C1/C2/C3 IMPLEMENTED AND VERIFIED; E1 EVIDENCE BASELINE COMPLETE, 2026-09-05.
C1 was published as `002684c`; the C2/C3/E1 wave is published as `798380d` to
`origin/analysis-hardening` (remote verified 2026-09-05). See [wave completion](WAVE_C2_C3_E1_COMPLETION.md) and
[model evidence](model-evidence/README.md). Later slices remain PROPOSED. Stop after this wave;
C4 is the next recommended bounded task when Casey selects it. The original plan body below
is retained as the acceptance specification; the current transfer/register hold execution status.
Owner: Casey (product and acceptance decisions); Astra (engineering).
Prepared 2026-09-04 against `8b528f2` on `analysis-hardening`.

## 1. Outcome and evidence

Develop RangeBoard into a field C-UAS Test & Evaluation application: prepare a defensible
test, form model-based hypotheses, execute and record a campaign, compare observations
with predictions, and deliver traceable evidence. Model accuracy, record integrity and
operator usability are release criteria. Adding model detail alone is not progress.

Casey confirmed that no independent trial dataset or representative acceptance campaign
is available. Existing doctrine, technical specifications, physical models and research
are in the repository documents. Start by reconciling that material with the implemented
equations and seed provenance. Do not substitute another broad research pass for that work.
Targeted primary-source retrieval follows the gaps that reconciliation establishes.

The objective is the closest defensible correspondence to physical behavior that the
available evidence supports. Define accuracy by quantity, conditions, reference evidence
and tolerance. No single accuracy percentage can describe this engine. A datasheet range
comparison does not establish the accuracy of the detection-to-effect chain.

Three evidence levels govern acceptance:

1. **Mathematical verification:** units, closed forms, invariants, limiting cases,
   numerical error and repeatability.
2. **Published comparison:** reproduce a specification or published experiment under its
   stated configuration and conditions. Separate calibration points from independent
   comparison points. Record unknown conditions and the effect of assumed defaults.
3. **Empirical validation:** compare held-out observations with frozen predictions for
   a stated use domain. This remains a future gate where independent observations do
   not exist; software and analytical verification can proceed now.

The credibility work uses the lifecycle and project-defined acceptance approach described
by [NASA-STD-7009B](https://standards.nasa.gov/standard/nasa/nasa-std-7009) as a methodological
reference. This is a proposed local process, not a claim of NASA certification.

The source findings are in [OWNERSHIP_FINDINGS.md](OWNERSHIP_FINDINGS.md). The routing of
all inherited register items is in [BACKLOG_TRIAGE.md](BACKLOG_TRIAGE.md). The append-only
[outstanding register](../data-engine/outstanding.md) remains the status authority.

## 2. Scope and sequencing

Retain React, TypeScript, Konva, the separate Board and T&E stores, and the existing domain
vocabulary. Correct observable defects before extracting the code that owns them. Keep
behavior-preserving refactors and analytical changes in separate reviewable slices.

The provisional first field target is one operator on a laptop, with offline operation
and manual records/file imports. Hardware, operating system and field connectivity remain
Casey decisions. This assumption does not authorize a backend, synchronization, instrument
integration, new dependencies, storage changes or a packaging choice.

| Slice | Result | Depends on | Exit evidence |
| --- | --- | --- | --- |
| P0 | Current findings, plan, triage and standardized handoff | Onboarding | Source-linked findings; every inherited ID routed; documentation checks |
| C1 | Results follow their complete input basis | Verified complete (R-F-24; R-D-26/R-D-27) | Mutation, undo/redo and worker lifecycle regressions |
| C2 | Every displayed result has consistent meaning and units | C1 | Measure-by-measure UI/export assertions and browser inspection |
| C3 | Save/import failures are contained and recoverable | P0 | Valid legacy saves load; malformed data is rejected before adoption; recovery exercise |
| C4 | T&E transitions preserve issued records and traceability | C3 | Store-level transition and reference tests; complete campaign walkthrough |
| R1 | Engine and presentation boundaries are safe to extend | C1, C2; preserve C3/C4 behavior | Output parity, import-boundary checks, same draw keys and storage behavior |
| E1 | Auditable model and source baseline | P0; can precede R1 | Model dossiers and source reconciliation, each with an applicability envelope |
| E2 | Priority physics/kinematics corrections | E1, R1 | One model change at a time; independent analytical cases and declared output deltas |
| E3 | Uncertainty and statistical claims match their coverage | C2, E1, R1 | Coverage/convergence studies; sampled/fixed parameter inventory; pairing checks |
| T1 | Field evidence workflow and offline durability | C3, C4; platform decision | Offline cold start, interruption recovery, portable campaign restore and traceability |
| U1 | A coherent, accessible operator experience | Early source study now; C2/C4 contracts | Task-based browser checks, accessibility review and measured performance |
| A1 | Release candidate for a bounded field pilot | All relevant slices | Representative campaign rehearsal and accepted model-use limits |

Early U1 work defines task flows and inspection criteria; it does not delay C1. E1 can
recover the existing research while correctness work proceeds. E2 is divided by model
family after E1, not delivered as one engine rewrite. Dates and effort estimates follow
bounded slice briefs and the evidence inventory, rather than an invented release date.

## 3. Corrections before refactoring

### C1. Complete analysis identity and result invalidation

Owner modules: `src/state/store.ts`, worker client and their tests. Verified complete.
Bounded adjustment R-D-27 adds a pure shared parameter-basis helper and the sensitivity
widget's use of the existing freshness gate; worker protocol and numerical algorithms are
unchanged. See [completion evidence](C1_COMPLETION.md). The criteria below are retained.

- Inventory every input consumed by detection, engagement, requirements, uncertainty and
  sensitivity. Explicitly include altitude, defended radius, doctrine, requirements,
  effective spreads and draw identities such as connection IDs where they affect samples.
- Define one resolved analysis-basis contract. Distinguish input changes, provenance-only
  description changes and presentation changes. Do not fix omissions with an unchecked
  list that can silently drift again.
- Cover ordinary actions, library edits, scenario load, reset, undo and redo. A displayed
  summary must correspond to the current basis and request. An old completion cannot
  restore a stale result. Inspect repeated requests in the same playback run as well as
  different run IDs; the same-run race is an audit target, not a confirmed defect.
- Regression acceptance: the five reproduced input changes all invalidate appropriately;
  stale sensitivity also disappears; camera/selection changes preserve valid results;
  undo/redo obey the same rule; delayed/canceled worker responses are harmless.

### C2. Consistent estimates, intervals, gates and exports

Owner modules: `analysis/`, `panels/analysis/`, `io/persist.ts` and their tests.

- Inventory every headline, chart, requirement gate and exported measure. Record quantity,
  unit, denominator, time horizon, deterministic/MC basis and definedness.
- Fix projection values that remain deterministic while their interval comes from MC.
  A proportion and its uncertainty must use the same denominator. A widget-wide "mean"
  label cannot apply to values still derived deterministically.
- Explicitly label quantities for which no replicate statistic exists. Decide whether to
  calculate one or display its deterministic basis; do not invent a confidence interval.
- Distinguish intervals on a mean, replicate quantiles, conditional-time quantities and
  probability of meeting a requirement. Define the MC requirement decision rule before
  implementing it. Keep test thresholds user-defined.
- Exports carry basis per result group, configuration/model identity and all validity
  findings. Preserve deterministic records as such. Correct hard-coded threshold copy.
- Acceptance includes zero detections, no asset, no arrival, late effects, n=0/n=1,
  non-unit raid sizes, changed thresholds and stale/running/error states. Check rendered
  numbers, units and exports against the same source statistic.

### C3. Runtime validation and recovery

Owner modules: Board/T&E persistence, recovery, import entrypoints and tests.

- Treat imported JSON and autosaves as unknown data. Validate required collections,
  nested objects, finite numeric values, enums, IDs/references and resource bounds before
  store adoption. Preserve documented defaults for legitimate old saves.
- Separate a missing optional field from a malformed required field. Fail with an
  actionable path/reason. Never overwrite the only raw copy of an unreadable save.
- Exercise quota/storage denial, partial/corrupt records, oversized embedded images and
  interrupted writes. Expose recovery-copy failures instead of claiming recovery succeeded.
- Preserve storage keys and valid user edits. A different persistence mechanism needs a
  separate migration/rollback design and Casey's decision in T1.

### C4. Authoritative T&E record transitions

Owner modules: `src/te/model/`, `state/`, `validate.ts`, `calc/`, UI and persistence tests.

- Enforce issued/superseded card immutability through store actions, including generic
  patch/remove operations and imports. Revisions preserve card identity lineage and old
  run references. Draft editing remains available.
- Apply qualification/design/issue/finalization blockers at the transition boundary.
  Check referenced question, measure, card version, run and evidence objects exist and
  belong to the campaign. Validate completed findings, not empty draft creation.
- Define one purpose-aware inclusion policy. Invalid runs remain available for fault
  investigation and failure findings, but do not enter a quantitative denominator as
  valid trials. Conditional runs contribute only to their allowed measures. Show the
  validity and exclusion reason wherever evidence supports a finding.
- Preserve run numbering, baseline snapshots, observation history and amendments. Define
  correction versus supersession semantics before adding an audit history format.
- Acceptance uses store actions directly as well as the UI, including rejected mutations,
  dangling references, duplicate IDs, revision, exclusion and reload/export/reimport.

## 4. R1: refactor with a behavioral boundary

Move shared scenario selectors, geometry/time helpers and constants into genuine leaf
modules as justified by their callers. Remove the store-to-engine and view-state cycles;
make the worker's engine dependency graph independent of React, zustand, localStorage and
panel modules. Retain the shared statistical implementation rather than copying it.

Extract responsibilities from the large store, sweep and attrition modules only after
their contracts have tests. Preserve public entrypoints through bounded migrations, then
remove temporary adapters in the same slice when all consumers have moved. Maintain a
list of temporary compatibility surfaces with a removal condition; migrations required to
read old user data are supported compatibility, not dead code.

Audit package/lockfile deprecation metadata and deprecated API consumers when touching a
dependency. Check current primary documentation before proposing upgrades. Keep removal
work bounded and verified; do not add a replacement dependency without Casey's decision.

Close unused exports/duplicate helpers and the 74 lint warnings in owned batches, without
disabling rules or chasing test-only exports indiscriminately. Treat bundle size as a
measured performance concern. Capture before/after worker and main-thread costs on fixed
fixtures before selecting code splitting or caching changes.

Acceptance: deterministic output parity and seeded MC parity on fixed IDs; no draw-key,
DT, boundary-time, partition, expenditure or persistence change disguised as refactoring.
Any intended numerical change belongs to E2/E3 and includes a before/after explanation.
Turn the highest-risk browser recipes into reproducible checks using existing Playwright;
static Recharts markup is not proof that chart contents render correctly.

## 5. E1 to E3: physics, kinematics and model credibility

### E1. Recover and qualify the existing evidence

Inventory `docs/inventory/`, `docs/threat/`, the two historical engine plans and their
references, `docs/te-compilation/`, seed provenance and verification fixtures. Preserve the
original research. Link each current equation and parameter to its evidence; distinguish
an opened source from an old note that still requires retrieval.

For each model family, produce one dossier with: intended quantity/use; equations and units;
coordinate/time conventions; input data and pedigree; PFs/defaults; calibration procedure;
assumptions and omitted mechanisms; numerical method/error; verification cases; independent
comparison cases; unsupported operating conditions; and unresolved data needs. Acceptance
limits are justified per quantity and evidence source, not a universal 5% tolerance.

Reconcile conflicting seed descriptions and values first. Track target class, configuration,
mode, reference RCS/signature, scan period versus track output rate, maximum versus average
speed, range type and expenditure unit. Missing information remains explicit. Do not lower
an unexplained RCS merely to make a test match. An RCS derived from the same datasheet used
for calibration is not an independent validation point (R-F-16).

### E2. Prioritized model studies and bounded corrections

The following are study scopes and acceptance cases, not chosen replacement algorithms.
Prioritize violations of physical feasibility and high-impact unsupported assumptions
before lower-impact detail. Use E3 sensitivity as one input to prioritization, with its
known local/interaction limitations.

| Family and source | Current limitation or question | Required next evidence and acceptance |
| --- | --- | --- |
| Geometry/time: `geometry/geo.ts`, `slant.ts`, `playback/sim.ts` | Uniform threat altitude, 0.5 s grid, 4/3-earth horizon; no terrain or per-waypoint altitude | Unit/frame and slant/ground round trips; edge, delayed-start, path-end and timestep error cases. Scope 3D paths or terrain only after datum, data resolution and user need are specified. |
| Radar: `radarPd.ts`, `sensorEnv.ts`, `scanModel.test.ts` | Placard calibration and assumed Pd/Pfa/Swerling; simplified scan/hold behavior | Independently reproducible closed-form checks, scan timing/phase tests, published comparisons with matching conditions. Investigate detection, tentative hold and firm track separately (F-15); reject invalid M-of-N inputs. More detailed clutter/aspect/correlation needs evidence. |
| EO/IR, acoustic, RF: `sensorEnv.ts`, `signatureFactors.ts`, `fidelity.ts` | Span scaling, calibrated transmission loss and band/range gates are reduced models | State which hardware, signature and environmental inputs are needed for each fidelity increment; use dimensional/limiting-case tests now. Do not imply image-quality, absorption or RF link-budget physics that is absent. |
| Track/C2/doctrine: `sim.ts`, `trackState.ts`, `doctrineFactors.ts`, `integration.ts` | Role PFs, route latency, hold/classification distinctions, hidden `no-fc-uplink` reason | Trace one observation through track state, route eligibility and timing. Test routed versus unrouted sensors, scan misses/coast/drop and capacity. Explain blocked engagement in the UI. |
| Motion/effect timing: `tactics.ts`, `attrition.ts` | Constant effective speed, three intercept iterations and window-end cap; a cap does not establish a feasible intercept | Quantify numerical residuals and feasibility against independent analytic cases; report unsupported/infeasible outcomes explicitly. Preserve release/effect/arrival distinctions. Review the scope of any higher-fidelity motion model before implementation. |
| Effect/EW: `attrition.ts`, `ewPhysics.ts` | Distance/size/evasion Pk factors and simplified illumination closure; common effect abstractions span different technologies | Verify dimensions, timing, conservation and channel semantics. Audit what available sources support for each mechanism. Keep unsupported response parameters exposed; avoid false precision from generalizing a small demonstration count to all conditions. |
| Environment: `sensorEnv.ts`, `ewPhysics.ts` | PF condition multipliers, no actual weather/terrain dataset | Identify mechanisms already represented to avoid double counting. Introduce physical models only with defined inputs and operating domains; retain transparent reduced modes where data is absent. |

No sixth draw site, changed raid partition or changed save schema is implied by this table.
Each such change needs a decision row and Casey's approval under AGENTS.md.

### E3. Quantified uncertainty that matches the model

- Enumerate sampled and fixed parameters from `uncertainFields` and `sampleScenario`.
  Resolve the unused size/evasion spread definitions and the unimplemented flyout-factor
  spread decision. "Total" currently covers an implemented subset of parameter uncertainty;
  it does not cover all planning factors or model discrepancy.
- Review each distribution's evidence, support, units and conditioning. Re-examine very
  small or selected success-count demonstrations before using them outside that trial
  domain. Separate natural variation, uncertain parameters and missing model mechanisms.
- Test mean-interval and quantile behavior, bounded quantities, undefined times, rare
  outcomes, fixed-n versus optional stopping, and convergence against analytic examples.
  Define an adequacy rule for every reported measure; stopping on leakers alone does not
  establish precision for every time or gate.
- Preserve counter-based reproducibility and common random numbers. Investigate member
  identity versus admitted-list order and shared environmental/system correlations.
  A change to pairing is an explicit model/statistical change with comparison evidence.
- Present sensitivity as one-at-a-time unless a separately specified global/interaction
  method is implemented. Differentiate Monte Carlo replicates from independent field
  trials and time samples from experimental units.

Measurement uncertainty in later field comparisons must be described separately from
simulation variability. The [NIST uncertainty-analysis guidance](https://www.itl.nist.gov/div898/handbook/mpc/section5/mpc5.htm)
is a starting reference for that measurement work, not evidence that existing PF spreads
have empirical coverage.

## 6. T1: field workflow and durability

Define a representative campaign with Casey from a concrete question through measures,
matrix, approved card, run, observations, exclusions, analysis, finding and deliverable.
Use repository examples as explicitly illustrative data for software acceptance. Preserve
planned, modeled and observed records with linked identities and distinct result labels.

Specify evidence import contracts before instrument adapters: source file preservation,
units, clock basis/offset, coordinate reference and altitude datum, sensor/system
configuration, truth-reference identity, missingness, quality flags and corrections.
Predictions are frozen before comparison; record their model/data/configuration version.
Separate calibration and held-out cases when independent observations become available.

The app must pass cold launch without connectivity, reload during a run, storage pressure,
backup/restore and export/reimport exercises on the selected platform. Current localStorage
and local-first operation do not establish offline installation or sufficient attachment
capacity. Compare packaging/cache and durable-storage options only after measuring field
needs; propose migration, rollback and user recovery before choosing one.

Portable deliverables must resolve all referenced cards, runs, sources and evidence and
state what is included versus externally linked. Review print/CSV completeness and page
legibility in the actual rendered output. Local record traceability is not multi-user
authentication, approval authority or tamper-proof evidence custody; define those needs
before proposing collaboration features.

## 7. U1: UI quality with measurable acceptance

The source study preserves the existing graphite visual language while correcting usability
failures. Current facts: `index.css` uses 13 px body text, 11.5 px chrome, 4/8/12/16/20/24 px
spacing, 14 px panel padding, 3 px radius and 120/140 ms motion. Reduced-motion and focus
styles exist. The contract's 320 px panel check currently allows critical text to ellipsize;
Sources and Sensitivity need a different information layout, not progressively smaller text.

| Layer | Planned work | Acceptance |
| --- | --- | --- |
| Layout | Map prepare, inspect, execute, analyze and deliver tasks; make Board/Ops context and selection clear | Primary tasks complete at a 320 px side panel without hidden actions; numbers, units and basis remain inspectable. Validate at 1366x768 and 1440x900, then chosen field hardware. |
| Typography | Preserve UI/machine-data font distinction; improve hierarchy and readable density | No critical value/interval/denominator clipped; inspect 200% zoom. Do not use the 10 px contract floor as the default field reading size. |
| Color | Audit semantic tokens, chart/status distinctions, controls and selected/disabled states | Measure contrast on actual surfaces; convey state without color alone. Evaluate a sunlight-readable mode on field hardware before choosing a theme change. |
| Spacing | Consolidate token use and enlarge frequent field actions where needed | Stable hit areas, no overlapping controls, consistent form and table rhythm; touch requirements follow platform choice. |
| Components | Rework dense provenance/sensitivity tables into readable summaries with complete detail; standardize forms, dialogs and error presentation | Keyboard access to every field/source; clear validation and recovery; no loss of technical content in compact views. |
| Interactions | Explain blocked routes, stale results, run state, dirty records and finalization; preserve undo semantics | Test empty/loading/running/stale/canceled/error/success states, focus return, keyboard-only tasks and alternatives to dragging. |
| Performance | Measure canvas input/rendering, deterministic recomputation, worker startup/results and large campaign navigation | Proposed software budgets: p95 input acknowledgment within 100 ms and 16.7 ms frame budget for 60 Hz pan/zoom on a named fixture/device. Set practical limits after baseline measurement; these are not engine PFs or T&E thresholds. |

Proposed accessibility target: [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/), including text
contrast (4.5:1 normal, 3:1 large), applicable control contrast (3:1), visible/unobscured
focus, keyboard use and alternatives to dragging. Minimum target-size criterion 2.5.8 is
24 CSS px with stated exceptions. Record any applicable two-dimensional canvas exception
and provide accessible inspection/edit alternatives; do not claim conformance from CSS
tokens alone. This target needs browser and human review, not screenshots alone.

## 8. A1: completion and maintenance gates

A bounded field pilot is ready when the representative campaign completes end to end on
the selected hardware; record recovery and portable restore work; critical tasks meet UI
criteria; model dossiers identify the supported conditions; and all priority correctness
findings are closed with evidence. Empirical prediction accuracy remains scoped to the
independent observations actually available at that release.

For every implementation slice:

1. Name owned files, register IDs, expected behavior and acceptance evidence before edits.
2. Reproduce confirmed defects; use focused regression tests plus relevant browser cases.
3. Run type-check, full tests, lint and build. Report actual outputs and compare warnings
   with baseline; add no warning. Test saves when shape/load behavior is involved.
4. For an analytical change, record output deltas, reasons, applicability, seed/data
   changes and statistical evidence. Keep original calibration/reference evidence.
5. Update register status with date and evidence. Update affected current docs and the
   handoff in the same slice. Historical specs retain their text and explicit status.
6. Check imports, obsolete API consumers, temporary adapters, stale terminology and doc
   links. Remove deprecated code only after its consumers and supported data migration
   needs are accounted for. Commit and push only on Casey's instruction.

The current handoff always states: intent/scope; branch and verified source revision;
working-tree ownership; completed work; actual gates and evidence; open risks/decisions;
active plan and register IDs; exact next action; and actions not authorized. Preserve
`[V]`, `[D]`, `[I]`, `[U]` evidence marks. Do not copy the full engineering contract or
append another contradictory "current" summary. Use git history for superseded transfers.

## 9. Decisions still needed, at the point they matter

- **Platform:** first field hardware/OS and whether offline single-operator use is the
  correct initial target. Blocks T1 packaging and final U1/A1 acceptance, not C1/E1.
- **Reference use case:** the first system/test question and operating conditions to
  prioritize. E1 can inventory everything now; comparative accuracy targets require this
  use case and appropriate evidence. No private trial dataset is expected at present.
- **Pilot acceptance:** who will exercise the workflow and accept task completion and
  model-use limits. Define the campaign and tolerances before calling it field ready.

C1 is verified complete (R-F-24; R-D-26/R-D-27). **C2 is the next implementation slice
when selected**; begin with its bounded result-semantics brief. E1 remains the next
independent analysis/research slice. Later slices require their own bounded briefs and
task selection. C1 publication is complete; stop before C2.
