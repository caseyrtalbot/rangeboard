# R0 playback realism consumer matrix

Captured 2026-09-07 from the current working tree for lane B, stage R0.
HEAD: `5076ecc16edb7bfa6c1260d1d82ff7fb1dad88d9` (main).
Plan: [playback realism](../playback-realism-plan-2026-09-07.md), sections 2–5.
This is a source audit, not evidence that the proposed behavior is implemented.
Application source was read only. No application changes or commit were made.

## Scope and classification

The inventory follows runtime readers, derived adapters, rendering leaves, result transport,
exports and persistence. Searches covered all of `src/`, including relative imports, aliases,
re-exports, selected-object detail, custom widgets and DOM text producers. `grep -rn` seeded
importer searches; symbol searches and relative-import tracing extended them beyond the named
entry points. Type-only declarations and test assertions have no Execute surface; relevant
contracts are recorded separately rather than counting every test assertion as a consumer.

Each row identifies a distinct read or adapter responsibility, not every repeated property
access within a render. Separate rows in one file distinguish independent exposure paths.
The stage column assigns the earliest owning correction in the plan; R5 also integrates
previously corrected readers into the common trial source. Ownership is task allocation,
not a claim that any stage has shipped.

- **forecast**: deterministic threshold assessments, expected attrition or their derivatives.
- **trial**: one sampled replicate inside the existing MC engine; no retained playback trial.
- **ensemble**: MC aggregates or paired sensitivity results.
- **mixed**: multiple bases handled together; the row states which ones.
- **yes**: a reachable Execute path exposes an outcome past the required horizon, including
  before Play, a forward preview, or replay behind the completed cursor. Labels such as
  “full run,” “planning envelope,” or “preview” do not satisfy the new Execute contract.
- **no**: the read itself exposes no unreached outcome, with its limiting condition stated.
- **not applicable**: internal computation, transport, export or persistence rather than
  an Execute presentation. Full-run computation is intentional; presentation needs scoping.

The required horizon is empty before first Play, then `min(cursor, observedThroughS)`.
Current `useRunCursor` only clamps cursor to duration and checks `phase === 'ready'`
(`src/panels/analysis/widgets/controls.tsx:68`). A pre-Play forward scrub changes phase to
`review` (`src/state/store.ts:1504`), bypassing that ready check. Neither this hook nor the
canvas sweep applies the required horizon. Full-run results remain deterministic even
when MC is selected (`src/analysis/impact.ts:402`, `src/canvas/CanvasStage.tsx:117`).

The requested AnalysisPanel entry resolves to `src/panels/AnalysisPanel.tsx:34`.
There is no second implementation under the analysis subdirectory.

## Row counts

| Stage | Rows |
| --- | ---: |
| R1 | 14 |
| R2 | 79 |
| R3 | 12 |
| R4 | 17 |
| R5 | 46 |
| Total | 168 |

## R1 — Honest readouts and setup

| Read site | Result read | Current basis | Future outcomes in Execute? | Surface fed | Owner |
| --- | --- | --- | --- | --- | --- |
| `src/panels/BoardPreparation.tsx:130` | Picture assessments to setup validity/findings | forecast | not applicable — Prepare-only setup view. | widget | R1 |
| `src/panels/BoardPreparation.tsx:134` | Assessment status map and threat register; row reads status at line 65 | forecast | not applicable — Prepare-only register, explicitly full configuration. | widget | R1 |
| `src/analysis/runValidity.ts:152` | Assessment no-path population and empty assessment status | forecast | no — current findings use configuration, model basis and path presence, not future kills. | widget | R1 |
| `src/panels/analysis/widgets/RunValidityWidget.tsx:59` | Validity status, findings and count metadata | forecast | no — source findings concern setup and model limits; “full-run” title is not an outcome gate. | widget, accessibility text | R1 |
| `src/panels/analysis/widgets/KpiTilesWidget.tsx:171` | Expected and late kill count formatting | mixed | yes — deterministic one-decimal mass or MC count uses the unclamped cursor; rounding also obscures fractional kills. | widget | R1 |
| `src/panels/analysis/widgets/ProjectionWidget.tsx:61` | Full-run threat groups, totals headline and OutcomeSummary input | mixed | yes — Infinity forecast groups and optional MC totals render in Execute; R2 owns hiding the surface. | widget | R1 |
| `src/panels/analysis/OutcomeSummary.tsx:70` | Final MC kill/leaker bands or deterministic totals; denominator raid size | mixed | yes — final outcome and mean CI render without cursor scope via Projection. | widget, tooltip | R1 |
| `src/panels/analysis/OutcomeSummary.tsx:85` | First effect, detection, warning, late kills and expenditure | mixed | yes — whole-run deterministic times/expenditure and MC conditional times remain visible. | widget | R1 |
| `src/panels/analysis/OutcomeSummary.tsx:154` | Per-effector full expenditure and remaining magazine | forecast | yes — full-run capacity list is available through Projection in Execute. | widget | R1 |
| `src/panels/analysis/ThreatPicture.tsx:129` | Member milestone times, salvos, survival and effect label | forecast | yes — live reached flags follow caller cursor; projected mode reveals all times. | widget | R1 |
| `src/panels/analysis/ThreatPicture.tsx:172` | Expected kills, survivors and salvos in bar/hover text | forecast | yes — group values inherit unobserved preview or full projection. | widget, tooltip | R1 |
| `src/panels/analysis/threatReadout.ts:224` | Eliminated time and hard/soft ghost wording | forecast | yes — cursor-only state can describe an unreached expected defeat as a hard/mission kill. | telemetry | R1 |
| `src/canvas/TrackFileReadout.tsx:103` | Track phase pill from shared readout | forecast | yes — no ready or observed-horizon gate; a preview can display DEFEATED. | telemetry | R1 |
| `src/panels/headlines.ts:80` | Reported leakers and raid-size denominator; collapsed residual at line 96 | forecast | yes — formatter preserves no-asset undefinedness, but Projection supplies full-run totals. | widget | R1 |

## R2 — Execution scope and layers

| Read site | Result read | Current basis | Future outcomes in Execute? | Surface fed | Owner |
| --- | --- | --- | --- | --- | --- |
| `src/panels/AnalysisPanel.tsx:66` | Widget catalog instances rendered for Execute/custom layouts | mixed | yes — phase changes hierarchy only; no phase/horizon is passed to each widget. | widget | R2 |
| `src/panels/AnalysisPanel.tsx:136` | Completed AAR/debrief mount | mixed | yes — completion remains true after backward scrub; Execute still mounts full-run records. | widget | R2 |
| `src/panels/analysis/widgets/registry.ts:30` | Catalog dispatch for all 12 widget types | mixed | yes — catalog has no Execute eligibility or outcome-horizon metadata. | widget | R2 |
| `src/panels/analysis/widgets/controls.tsx:68` | Run cursor/ready guard used by live result readers | mixed | yes — duration-only clamp; pre-Play review and forward scrub admit future data. | widget, telemetry | R2 |
| `src/state/selectors.ts:17` | Rounded cursor grid and observed grid at line 21 | mixed | yes — independent rounded selectors do not enforce min or pre-Play emptiness. | widget, telemetry | R2 |
| `src/state/selectors.ts:54` | Completion eligibility for retained results | mixed | yes — ignores current cursor, leaving completed records visible on Execute rewind. | widget | R2 |
| `src/state/store.ts:1302` | Saved frame time promoted into observation horizon | mixed | yes — applyFrame advances observation and may stamp startedAtMs without Play. | canvas, widget, telemetry | R2 |
| `src/panels/analysis/widgets/KpiTilesWidget.tsx:124` | Live deterministic sensor hits for Track now | forecast | yes — ready guard only; detectionsAt uses forward preview time. | widget | R2 |
| `src/panels/analysis/widgets/KpiTilesWidget.tsx:127` | Live KPI event/effect prefixes | forecast | yes — prefixes stop at cursor, not observed horizon. | widget | R2 |
| `src/panels/analysis/widgets/KpiTilesWidget.tsx:147` | MC detected/tracked/engaged/kill/leaker grid means and CIs | ensemble | yes — MC band index follows cursor without observed cap. | widget | R2 |
| `src/panels/analysis/widgets/KpiTilesWidget.tsx:188` | MC conditional first-detection and minimum-warning scalar statistics | ensemble | yes — full-run means display once summary exists, independently of event reach. | widget | R2 |
| `src/panels/analysis/widgets/KpiTilesWidget.tsx:191` | Deterministic first effect and detect-to-effect reached checks | forecast | yes — reached means cursor reached, including unobserved forward preview. | widget | R2 |
| `src/panels/analysis/widgets/TimeSeriesWidget.tsx:111` | All preset/custom KPI series and MC bands | mixed | yes — entire vectors reach charts; t is only a playhead marker. | widget, axis domain, tooltip | R2 |
| `src/panels/analysis/widgets/TimeSeriesWidget.tsx:76` | Earliest arrival marker across assessments | forecast | yes — future arrival is drawn on result history without Execute filtering. | widget | R2 |
| `src/panels/analysis/widgets/EventLedgerWidget.tsx:29` | Assignment-filtered event list | forecast | yes — assignment cutoff is cursor-only, admitting unreached assignments after scrub. | event strip | R2 |
| `src/panels/analysis/widgets/EventLedgerWidget.tsx:42` | Assigned event effect time, Pk and killDelta at line 55 | forecast | yes — reveals pending effect time and removal mass before effect is reached. | event strip | R2 |
| `src/panels/analysis/widgets/EventLedgerWidget.tsx:84` | Shown count versus total full-run events | forecast | yes — even ready/collapsed metadata reveals eventual event count. | widget, accessibility text | R2 |
| `src/panels/analysis/widgets/ThreatPictureWidget.tsx:46` | Current sensor hits and threatPictureAt groups at line 50 | forecast | yes — preview flag changes wording only; values still use future cursor. | widget | R2 |
| `src/panels/analysis/widgets/SystemStatusWidget.tsx:51` | Sensor hits and component telemetry at line 55 | forecast | yes — null before ready, but pre-Play review and future scrub bypass ready. | widget, telemetry | R2 |
| `src/panels/analysis/widgets/RequirementGatesWidget.tsx:214` | Full deterministic gate report and met/required headline | forecast | yes — full-run verdict, detail and failures available in Execute layouts. | widget, tooltip | R2 |
| `src/panels/analysis/RequirementGates.tsx:23` | Gate metric/detail and failed-track rows | forecast | yes — consumes full gate report without a horizon; title carries full detail. | widget, tooltip | R2 |
| `src/panels/analysis/widgets/SensitivityWidget.tsx:32` | Sensitivity low/high/swing/SE rows and nominal mean | ensemble | yes — completed worker result is displayed independently of playback horizon. | widget | R2 |
| `src/charts/Tornado.tsx:62` | All perturbation endpoints to shared domain | ensemble | yes — future final leaker means determine Execute axis extent. | axis domain | R2 |
| `src/charts/Tornado.tsx:134` | Nominal caption and perturbation bars/endpoints | ensemble | yes — full-run sensitivity values reach the visible chart. | widget | R2 |
| `src/panels/analysis/EngagementStrip.tsx:58` | Assessments, attrition first shot and impact severity to lanes | forecast | yes — full-run lane builder takes no cursor or observation horizon. | event strip, impact warning | R2 |
| `src/panels/analysis/EngagementStrip.tsx:79` | Group earliest/latest times and worst impact severity | forecast | yes — group ranges and severity incorporate future member outcomes. | event strip | R2 |
| `src/panels/analysis/EngagementStrip.tsx:130` | Detection, hostile, window, shot and arrival tooltip | forecast | yes — all lane times or “never detected” exposed on hover. | tooltip | R2 |
| `src/panels/analysis/EngagementStrip.tsx:154` | Classification ramp, engagement window, shot and severity-colored arrival | forecast | yes — marks cover complete configured duration even before Play. | event strip | R2 |
| `src/panels/analysis/widgets/EngagementLanesWidget.tsx:19` | Embedded full EngagementStrip | forecast | yes — custom/widget copy has the same unrestricted lane data. | widget, event strip | R2 |
| `src/App.tsx:690` | Standalone EngagementStrip mounted by Board shell | forecast | yes — same full-run strip is reachable below the Execute canvas. | event strip | R2 |
| `src/analysis/series.ts:60` | Threat report and event effects to residualOnGrid | mixed | not applicable — pure full-grid builder used by forecast and individual MC replicates. | widget | R2 |
| `src/analysis/series.ts:99` | Future first-detection order to track color slots | forecast | yes — chart/legend color allocation indirectly exposes future detection order. | legend | R2 |
| `src/analysis/series.ts:119` | First shot, ROE gate and arrival/CPA chart marks | forecast | yes — full-run marks flow to selected-threat charts. | widget | R2 |
| `src/analysis/series.ts:169` | Full live-KPI timeline sampled across configured grid | forecast | yes — resulting full vectors are rendered in Execute without truncation. | widget | R2 |
| `src/analysis/series.ts:251` | Sensor observation Pd, hold and associated slant series | forecast | yes — future observations govern curves and series membership. | widget, legend | R2 |
| `src/analysis/series.ts:301` | Effector events to Pk, magazine and salvo vectors | forecast | yes — full event history drives selected-effector charts and legend membership. | widget, legend | R2 |
| `src/analysis/series.ts:370` | Per-sensor threat Pd observations, residual and phase states | forecast | yes — complete threat series reach Execute detail charts. | widget | R2 |
| `src/analysis/series.ts:529` | Sensor observations to track-init/hold/coast/drop ladder spans | forecast | yes — entire observation history reaches sensor ladder. | widget | R2 |
| `src/analysis/series.ts:549` | Held series to per-scan sensor load | forecast | yes — sensor detail reads future grid indices and full load vector. | telemetry, widget | R2 |
| `src/analysis/series.ts:582` | Sensor series to held-track union and mean held Pd | forecast | yes — full vectors feed sensors preset without observation scope. | widget | R2 |
| `src/analysis/series.ts:678` | Whole-run threat groups and member residual curves | forecast | yes — threat preset plots every future residual value. | widget | R2 |
| `src/analysis/series.ts:763` | Track state at every grid time to phase ladder | forecast | yes — future phase spans and their existence reach threat detail. | widget, legend | R2 |
| `src/analysis/series.ts:810` | MC band selection/means/quantiles and deterministic fallbacks | mixed | yes — entire supported bands pass through; basis labels do not scope Execute. | widget, axis domain | R2 |
| `src/charts/seriesData.ts:30` | Series values and 80/95 percent band endpoints | mixed | yes — all samples become plot rows with no horizon parameter. | widget | R2 |
| `src/charts/seriesData.ts:58` | Entire values and all bands for automatic Y range | mixed | yes — future extrema determine current chart scale. | axis domain | R2 |
| `src/charts/TimeSeries.tsx:53` | Series and marks forwarded through lazy chart wrapper | mixed | yes — wrapper forwards complete props without filtering. | widget | R2 |
| `src/charts/TimeSeriesChart.tsx:87` | Hovered time index into each series | mixed | yes — tooltip can read future samples anywhere on the full chart. | tooltip | R2 |
| `src/charts/TimeSeriesChart.tsx:124` | Full rows/range for line and band plotting | mixed | yes — graph does not censor series using tS. | widget, axis domain | R2 |
| `src/charts/TimeSeriesChart.tsx:209` | Last finite sample endpoint dots | mixed | yes — end-of-run values remain visible regardless of cursor. | widget | R2 |
| `src/charts/TimeSeriesChart.tsx:224` | All chart marks and labels | forecast | yes — future FX, gate and arrival marks remain visible. | widget | R2 |
| `src/charts/TimeSeriesChart.tsx:275` | All available series labels/colors for legend | mixed | yes — names are not numeric summaries, but outcome-dependent series membership leaks. | legend | R2 |
| `src/charts/ChartFrame.tsx:53` | Passed legend entries and labels | mixed | yes — forwards uncensored outcome-dependent membership; no numeric totals of its own. | legend | R2 |
| `src/charts/Ladder.tsx:89` | Every row and time span | forecast | yes — SVG renders full spans; cursor only moves a rule. | widget | R2 |
| `src/panels/analysis/detail/detailRows.tsx:35` | Shared detail picture/cursor, discarding untouched state | forecast | yes — selected-object telemetry has neither ready suppression nor observed cap. | telemetry | R2 |
| `src/panels/analysis/detail/detailRows.tsx:45` | systemTelemetryAt with cursor and empty current-hit map | forecast | yes — cumulative/effector state can advance on preview; current sensor hits are absent here. | telemetry | R2 |
| `src/panels/analysis/detail/ThreatDetail.tsx:53` | Shared readout using deterministic sweep/state | forecast | yes — raw detail cursor reaches future phase, effects and residual. | telemetry | R2 |
| `src/panels/analysis/detail/ThreatDetail.tsx:68` | Threat series, phase ladder and MC residual bands | mixed | yes — full threat vectors and phase ladder render in Execute. | widget | R2 |
| `src/panels/analysis/detail/ThreatDetail.tsx:88` | Earliest positive effect and arrival/CPA markers | forecast | yes — future effect marker reveals whether/when a kill occurs. | widget | R2 |
| `src/panels/analysis/detail/ThreatDetail.tsx:102` | Legend limited to phases found in full phase ladder | forecast | yes — presence of an eventual defeated phase is visible before reaching it. | legend | R2 |
| `src/panels/analysis/detail/ThreatDetail.tsx:128` | Full-run engage status, first sensor/detection and warning | forecast | yes — full-path labels disclose future detection/outcome in selected telemetry. | telemetry | R2 |
| `src/panels/analysis/threatReadout.ts:84` | Track state, live sensor fallback and track continuity | forecast | yes — queries use tS only; callers pass unobserved preview or T0 before Play. | telemetry | R2 |
| `src/panels/analysis/threatReadout.ts:125` | Arrival and CPA full-path rows | forecast | yes — forecast geometry timing is mixed into telemetry, not a separate planning disclosure. | telemetry | R2 |
| `src/panels/analysis/detail/SensorDetail.tsx:68` | Pd/slant/hold series and track ladder/load | forecast | yes — complete histories and observation-selected tracks render in Execute. | widget, legend | R2 |
| `src/panels/analysis/detail/SensorDetail.tsx:161` | Cursor-indexed scan load plus component hold/time fields | forecast | yes — counts can come from an unobserved future grid step. | telemetry | R2 |
| `src/panels/analysis/detail/EffectorDetail.tsx:41` | Pk, magazine, salvo series and release/effect marks/ladders | forecast | yes — full histories are visible in Execute detail. | widget, legend | R2 |
| `src/panels/analysis/detail/EffectorDetail.tsx:65` | Per-threat gate and release-ready times | forecast | yes — all future readiness gates are printed without event reach checks. | telemetry | R2 |
| `src/panels/analysis/detail/EffectorDetail.tsx:80` | Final shots, DE/EW salvos and remaining rounds | forecast | yes — full-run capacity table ignores cursor/observation. | telemetry | R2 |
| `src/panels/analysis/detail/SystemDetail.tsx:31` | Detecting sensor IDs to routes and uncovered tracks at line 77 | forecast | yes — route population depends on sensors detecting later in the run. | telemetry | R2 |
| `src/panels/analysis/detail/SystemDetail.tsx:59` | First detection/effect and elapsed detect-to-effect | forecast | yes — C2 timing table displays future positive-effect times. | telemetry | R2 |
| `src/panels/analysis/SystemStatus.tsx:39` | Component counts/state, capacity and hover detail | forecast | yes — all text inherits unobserved cursor data from live/detail callers. | telemetry, tooltip | R2 |
| `src/panels/analysis/SystemStatus.tsx:81` | Group tracks/salvos in collapsed button summary | forecast | yes — collapsed group summary retains future-preview counts. | widget, accessibility text | R2 |
| `src/panels/analysis/AnalysisSection.tsx:36` | Collapsed headline from report-derived residual/expenditure | forecast | yes — hiding body leaves full projection result in summary text. | widget, accessibility text | R2 |
| `src/panels/analysis/widgets/WidgetFrame.tsx:66` | Result-derived meta retained in widget header | mixed | yes — collapsed frame still exposes EventLedger full event count and gate summaries. | widget, accessibility text | R2 |
| `src/canvas/layers/ThreatWezLayer.tsx:244` | Full impact severity/ships/warhead aggregated per asset | forecast | yes — at T0 summary badges reveal final impact risk even before Play. | impact warning | R2 |
| `src/canvas/layers/ThreatWezLayer.tsx:265` | Impact arrivals gated only by display time | forecast | yes — forward preview reveals unreached arrivals and their severity/counts. | impact warning | R2 |
| `src/canvas/layers/ThreatWezLayer.tsx:331` | Leaker ships/warhead badge text | forecast | yes — inherits unobserved arrival selection from display time. | canvas, impact warning | R2 |
| `src/analysis/series.ts:193` | Observation Pd vector/start time to chart grid | forecast | yes — full Pd history is regridded without an Execute cutoff. | widget | R2 |
| `src/analysis/series.ts:206` | Observation hold intervals to grid flags | mixed | not applicable — shared pure adapter for deterministic charts and sampled MC track counts. | widget | R2 |
| `src/analysis/series.ts:492` | Observation coast/init/detect/drop times to ladder spans | forecast | yes — complete sensor history determines displayed spans and drop markers. | widget | R2 |

## R3 — Physical launch timing

| Read site | Result read | Current basis | Future outcomes in Execute? | Surface fed | Owner |
| --- | --- | --- | --- | --- | --- |
| `src/playback/attrition.ts:445` | Intercept solution for committed/candidate effect geometry; also line 535 | mixed | not applicable — deterministic or MC engine reads physical solution before result construction. | canvas, export | R3 |
| `src/playback/attrition.ts:340` | Assessment arrival compared with modeled effect to mark lateEffect | mixed | not applicable — ledger production uses assignment/effect timing, not Execute rendering. | export | R3 |
| `src/playback/trackState.ts:450` | Events to assignment/incoming/EW draw windows | forecast | yes — downstream draw begins at assignment, before positive engagement delay has elapsed. | canvas, telemetry | R3 |
| `src/playback/trackState.ts:654` | Event effect time/member index to fixed shot endpoint and record | forecast | not applicable — timeline precomputes endpoint; current draw window lacks release metadata. | canvas | R3 |
| `src/playback/trackState.ts:781` | Shot progress between assignment and effect | forecast | yes — moving round appears during engagement preparation and on future scrub. | canvas | R3 |
| `src/playback/trackState.ts:798` | Live shots/magazine history to effector guidance/depleted state | forecast | yes — activity starts at assignment; tS also lacks observed cap. | canvas | R3 |
| `src/canvas/layers/EngagementLayer.tsx:61` | Shot mode for beam treatment; progress at line 75 for round placement | forecast | yes — trusts assignment-based ShotInFlight and has no independent horizon gate. | canvas | R3 |
| `src/canvas/layers/EntityLayer.tsx:550` | Effector live guidance mode to launcher glow/blink | forecast | yes — upstream activity includes preparation interval and unobserved preview. | canvas | R3 |
| `src/analysis/series.ts:658` | Events whose assignment-to-effect interval contains a grid step | forecast | yes — “in flight” includes preparation and whole-run future intervals. | widget | R3 |
| `src/analysis/series.ts:713` | Effector event tS/tEffectS to REL/FX marks | forecast | yes — assignment is labeled REL; full future marks render in detail. | widget | R3 |
| `src/analysis/series.ts:729` | Effector events to release/effect ladder spans | forecast | yes — span starts at assignment and full future spans render. | widget | R3 |
| `src/io/runResultGroups.ts:58` | Event timing/member field descriptions in export metadata | mixed | not applicable — describes tS as release; current type defines assignment and shipIdx, not shipIndex. | export | R3 |

## R4 — Trial engine and lifecycle

| Read site | Result read | Current basis | Future outcomes in Execute? | Surface fed | Owner |
| --- | --- | --- | --- | --- | --- |
| `src/state/runState.ts:114` | Playback basis comparison for scenario edits | mixed | not applicable — lifecycle invalidation, not outcome presentation. | persistence | R4 |
| `src/state/runState.ts:131` | MC/sensitivity status and independent basis comparisons | ensemble | not applicable — marks results stale and cancels affected workers. | widget | R4 |
| `src/state/store.ts:1424` | Cursor versus observed horizon when starting/resuming | mixed | no — startRun resumes at min(cursor, observed); it does not scope existing renderers. | canvas, telemetry | R4 |
| `src/state/store.ts:1445` | MC running/done identity and basis reuse | ensemble | not applicable — starts worker only when current result/request is absent. | widget | R4 |
| `src/state/store.ts:1551` | MC message identity/status/basis and summary acceptance | ensemble | not applicable — stale results rejected; summary stored without playback horizon censoring. | widget, export | R4 |
| `src/state/store.ts:1603` | Sensitivity message identity/status/basis and summary acceptance | ensemble | not applicable — independent stale-result guard; rows retained as full-run estimates. | widget, export | R4 |
| `src/playback/runSession.ts:22` | Completed/start/cursor state to reset-before-Play decision | mixed | no — resets identity after completion; no sampled replay preservation exists. | canvas | R4 |
| `src/playback/mcClient.ts:49` | Worker slot identity before forwarding result/progress/error | ensemble | not applicable — result transport guarded by exact worker-slot identity. | widget, export | R4 |
| `src/playback/mc.worker.ts:59` | Generator checkpoints/final summary; sensitivity dispatch at line 88 | ensemble | not applicable — worker consumes full computation and posts summary, not a playback ledger. | widget, export | R4 |
| `src/playback/mcRun.ts:506` | One sampled replicate assessments/report to KPI grid | trial | not applicable — transient trial used inside ensemble, not retained as the visible run. | widget, export | R4 |
| `src/playback/mcRun.ts:531` | Replicate per-threat attrition/times/residual and per-effector events at line 547 | trial | not applicable — samples are accumulated; individual assessment/event ledger is discarded. | widget, export | R4 |
| `src/playback/mcRun.ts:581` | Sample arrays to per-threat/per-effector statistics and raid bands | ensemble | not applicable — full-run aggregation with quantity-specific supports and time definedness. | widget, export | R4 |
| `src/playback/mcRun.ts:640` | Sampled report/timeline final leaker KPI for sensitivity loop | trial | not applicable — internal full-run scalar replicate; no Execute consumer here. | widget, export | R4 |
| `src/playback/mcRun.ts:733` | Paired low/high vectors to means, swing and paired SE | ensemble | not applicable — full-run parameter perturbations, not a sampled playback history. | widget, export | R4 |
| `src/playback/attrition.ts:150` | Precomputed assessments or policy-aware assessment sweep | mixed | not applicable — full forecast/trial assessments feed engagement resolution. | canvas, widget, export | R4 |
| `src/playback/attrition.ts:264` | Existing policy kill draw and per-member pending effect state | mixed | not applicable — engine applies sampled or expected removal mass to ledger and member state. | canvas, export | R4 |
| `src/playback/mcRun.ts:367` | Sampled sensor observations/hold intervals to tracked grid | trial | not applicable — observation-based replicate tracking is distinct from display-time detectionsAt. | widget, export | R4 |

## R5 — Integrated sampled experience

| Read site | Result read | Current basis | Future outcomes in Execute? | Surface fed | Owner |
| --- | --- | --- | --- | --- | --- |
| `src/analysis/impact.ts:402` | Deterministic assessments to attrition and impacts | forecast | not applicable — intentional cached full-run forecast; consumers need separate result selection. | canvas, widget, export | R5 |
| `src/analysis/impact.ts:207` | Assessment CPA/arrival and per-threat attrition to impact severity | forecast | not applicable — computes full-run warning data; canvas/strip leaks are owned by R2. | impact warning | R5 |
| `src/analysis/liveStats.ts:99` | Ledger assignment/effect prefixes and assessment gates/arrivals | mixed | not applicable — pure adapter accepts deterministic report or sampled replicate. | widget, telemetry | R5 |
| `src/analysis/liveStats.ts:241` | Timeline prefixes/windows at requested tS to live KPI values | mixed | not applicable — respects supplied time but has no observation/run identity contract. | widget, telemetry | R5 |
| `src/analysis/threatAggregation.ts:120` | Effect ledger to expected-dead cutoff times | mixed | not applicable — shared survival cutoff derivation; does not itself expose future effects. | widget, telemetry | R5 |
| `src/analysis/threatAggregation.ts:146` | Sensor observation intervals to prefix continuity and longest gap | forecast | not applicable — clips to supplied tS; Infinity deliberately uses full track quality. | telemetry | R5 |
| `src/analysis/threatAggregation.ts:199` | Visible assignments, landed effects and full raw milestone fields | forecast | not applicable — prefix counts obey supplied tS; returned raw future fields need caller filtering. | widget, telemetry | R5 |
| `src/analysis/systemTelemetry.ts:211` | Live hits, reached observation intervals and routed tracks | forecast | not applicable — mixed sensor/assessment paths agree only on current deterministic basis. | telemetry | R5 |
| `src/analysis/systemTelemetry.ts:335` | Assignment/effect prefixes, target windows and remaining capacity | forecast | not applicable — stops at supplied time; does not enforce playback observation. | telemetry | R5 |
| `src/playback/trackState.ts:436` | Threat report/events to effect prefixes, elimination and observation holds | forecast | not applicable — deterministic formation aggregate; not retained per-member sampled state. | canvas, telemetry | R5 |
| `src/playback/trackState.ts:702` | Effect prefixes, residual, jam, phase and arrival state at tS | forecast | yes — callers supply unobserved time; raw arrivalS also returned before arrival. | canvas, telemetry | R5 |
| `src/playback/sweepAt.ts:64` | detectionsAt hits plus timeline track/effector state | forecast | yes — deterministic detection path remains separate and accepts uncapped caller time. | canvas, telemetry | R5 |
| `src/playback/detection.ts:328` | Prepared deterministic sensor sweep hits at current geometry | forecast | yes — can report T0 or preview detections without any Play/observation check. | canvas, widget, telemetry | R5 |
| `src/canvas/CanvasStage.tsx:118` | Cached full picture into timeline, live scene and selected readout | forecast | yes — scene/readouts always receive forecast, independent of MC or Board phase. | canvas, telemetry | R5 |
| `src/canvas/LiveScene.tsx:131` | Shot timeline at display time and sweep at published time | forecast | yes — both clocks admit future preview; display interpolation can lead published observation. | canvas | R5 |
| `src/canvas/StaticScene.tsx:37` | Sweep active-sensor IDs | forecast | yes — uncapped sensor activity drives held-ring emphasis. | canvas | R5 |
| `src/canvas/layers/FootprintLayer.tsx:775` | Held-ring flag and active-sensor set | forecast | yes — forwards T0/unobserved preview detections as coverage emphasis. | canvas | R5 |
| `src/canvas/layers/EntityLayer.tsx:536` | Track phase or live-hit fallback to threat glyph cues | forecast | yes — shared sweep can expose unobserved detection, engagement or ghost state. | canvas | R5 |
| `src/canvas/TrackFileReadout.tsx:59` | Selected readout from assessments/timeline/sweep | forecast | yes — selected track status uses uncapped published time before Play and on preview. | telemetry | R5 |
| `src/panels/analysis/widgets/controls.tsx:53` | Full deterministic engagementPicture supplied to all widget/detail callers | forecast | not applicable — result-source hook always returns forecast; no trial selector exists. | widget, telemetry | R5 |
| `src/panels/analysis/widgets/mc.ts:14` | Current done MC summary or null; sensitivity status/run match at line 20 | ensemble | not applicable — freshness helpers select estimates, not a trial or observation prefix. | widget, export | R5 |
| `src/panels/analysis/widgets/mc.ts:45` | Band CI endpoints and conditional-time definedness formatting at line 78 | ensemble | not applicable — caller owns time index/scoping; each statistic keeps its own interval. | widget | R5 |
| `src/panels/analysis/LiveStrip.tsx:85` | MC stop rule/replicate count/elapsed time to mode title and meta | ensemble | no — execution metadata only; no kill, detection or warning value is displayed. | widget, tooltip, accessibility text | R5 |
| `src/panels/analysis/LiveStrip.tsx:268` | Picture to timeline track count for header presence | forecast | no — only no-path population controls header mount; no eventual outcome printed. | widget | R5 |
| `src/panels/analysis/LiveStrip.tsx:295` | Observed-horizon/lifecycle wording in aria-live region at line 321 | mixed | no — announces stored horizon rather than outcome; frame promotion can make stored horizon misleading. | accessibility text | R5 |
| `src/analysis/aar.ts:50` | Full threat attrition/assessment/impact and effector summary rows | forecast | not applicable — pure full-run summary feeds debrief, export and expected-results text. | export, widget | R5 |
| `src/analysis/requirements.ts:169` | Threat attrition, track-at-decision and full totals to requirement report | forecast | not applicable — deterministic requirement basis stays forecast; not a trial verdict. | widget, export | R5 |
| `src/panels/AnalysisPanel.tsx:50` | Completed picture to AAR | forecast | not applicable — computation gated by completion; R2 owns Execute rewind exposure. | widget, export | R5 |
| `src/panels/analysis/DebriefRecord.tsx:162` | Final deterministic detections and final system/threat groups at lines 179/183 | forecast | yes — complete gate blocks early run, but backward Execute scrub still shows final-state records. | widget, telemetry | R5 |
| `src/panels/analysis/DebriefRecord.tsx:175` | Full requirements, event count/ledger and outcome disclosure headlines | forecast | yes — full completion record persists when cursor returns behind those events. | widget, event strip, accessibility text | R5 |
| `src/panels/analysis/DebriefRecord.tsx:147` | Current MC/sensitivity results selected for export | ensemble | not applicable — export data selection follows run freshness and completed UI gate. | export | R5 |
| `src/panels/analysis/DebriefRecord.tsx:80` | Full scenario, run metadata, assessments, attrition, AAR, MC and sensitivity | mixed | not applicable — explicit completed debrief JSON export, not live Execute telemetry. | export | R5 |
| `src/io/runResultGroups.ts:38` | Attrition measurability/raid size and assessments into forecast group metadata | forecast | not applicable — metadata explicitly names full-run forecast groups. | export | R5 |
| `src/io/runResultGroups.ts:87` | MC denominators/replicates and separate sensitivity group at line 115 | ensemble | not applicable — own horizons/bases declared; no simulated-trial group exists. | export | R5 |
| `src/io/persist.ts:315` | All result groups and report into reproducible run export object | mixed | not applicable — pure export builder does not itself enforce completion; current UI caller does. | export | R5 |
| `src/io/persist.ts:344` | Optional MC summary, sampled fields and sensitivity retained in export | ensemble | not applicable — full aggregate results serialized, not individual trial observations. | export | R5 |
| `src/io/persist.ts:364` | Run export object to JSON download | mixed | not applicable — explicit artifact emission with per-group basis metadata. | export | R5 |
| `src/panels/TestCardsPanel.tsx:224` | Full AAR to planning expected-results text saved on card | forecast | not applicable — explicit card editing action stores labeled forecast expectations. | persistence | R5 |
| `src/panels/headlines.ts:126` | AAR expected kills/undefeated mass to expected-results headline | forecast | not applicable — text formatter used by test-card fill action. | persistence | R5 |
| `src/io/persist.ts:185` | Scenario JSON, including legacy scorecards/AAR, test cards and frame times | forecast | not applicable — whole Scenario autosave; live playback and MC slices are not serialized. | persistence | R5 |
| `src/io/persist.ts:141` | Saved scenario through shape validation/default filling | forecast | not applicable — compatibility import preserves scenario evidence, not playback session. | persistence | R5 |
| `src/io/persist.ts:222` | Scenario download, including any embedded legacy result records | forecast | not applicable — configuration/evidence export is separate from completed-run JSON. | export | R5 |
| `src/te/io/frameCapture.ts:30` | Rendered Board stage to downloadable PNG | forecast | not applicable — captures current canvas pixels, including its current forecast cues. | export | R5 |
| `src/te/io/frameCapture.ts:47` | Rendered Board frame into explicit campaign evidence capture | forecast | not applicable — user-triggered image retention; no automatic numerical trial ingestion. | persistence, export | R5 |
| `src/playback/trackState.ts:529` | Jam event Pk and assessment windows to compound jam state | forecast | not applicable — display reconstructs expected jam probability from Pk, not retained sampled jam decisions. | canvas, telemetry | R5 |
| `src/analysis/aar.ts:31` | Threat expenditure, leakage and hard/soft totals to AAR outcome category | forecast | not applicable — expected-value classification feeds full-run summaries, not a realized trial verdict. | export, persistence | R5 |

## Coverage and importer closure

All 12 registered widget types were inspected. Ten read or forward results and appear above.
Environment reads scenario environment (`src/panels/analysis/widgets/EnvironmentWidget.tsx:236`);
FireDoctrine reads scenario doctrine (`src/panels/analysis/widgets/FireDoctrineWidget.tsx:269`).
They expose configuration and provenance rather than engine outcomes. The registry, controls,
MC helper and WidgetFrame are included as shared result-selection or presentation boundaries.
The labels module contains fixed wording (`src/panels/analysis/widgets/labels.ts:18`), not values.

Additional traced branches and exclusions:

- `src/panels/Toolbar.tsx:125` calls validity with an empty assessment array for a spawn-ring
  setup warning. It does not read a full-run engagement result.
- Inspector imports the flyout speed constant (`src/panels/Inspector.tsx:59`), not an intercept
  solution. Palette/library import, RangeSetupMenu/underlay import, CommandPalette/scenario
  actions and ErrorBoundary/WidgetFrame exports terminate at scenario/configuration operations.
  Their shared scenario serializer is included above; they add no alternate result group.
- DetailHeader and generic detail Rows/DetailTable/Legend render passed data without deriving
  a new basis. Their result-producing callers are included. Detail legend text is forwarded
  at `src/panels/analysis/detail/detailRows.tsx:126`; phase membership is selected upstream.
- Canvas callout names, HUD coordinates, known paths, range geometry and entity positions are
  configuration/geometry previews. The outcome-bearing EntityLayer, held footprints, WEZ badges,
  engagement layer and selected track readout are included separately.
- The Board shell controls the same phase-independent strip and selected-detail components;
  entering Analyze does not install a different result provider. The widget stack branch is
  `src/panels/AnalysisPanel.tsx:132`. No custom layout is exempt from the inventory.
- `src/playback/attritionReport.ts:122` and `src/playback/sweepState.ts:111` are type contracts,
  not executing consumers. Intercept physical timing is already assignment plus resolved delay
  (`src/playback/intercept.ts:170`); its consuming attrition calls are in R3.
- Scenario import validation includes legacy scorecards (`src/io/validateScenario.ts:15`),
  whose optional AAR is defined at `src/model/types.ts:884`. No active UI reader of `.aar` on
  a scorecard was found. Autosave/export still carry those records as Scenario data.
- T&E config snapshots re-enter the same Board parser (`src/te/io/persistTe.ts:47`). T&E
  campaign calculations consume independently entered campaign records, not these engine
  outputs. Explicit Board image capture is included; later image storage/rendering carries
  pixels and introduces no numerical result interpretation.
- Test files, fixtures and generated schema descriptors were searched for edge discovery.
  They do not create runtime Execute surfaces and are not counted as application consumers.

## Five highest-priority current Execute exposures

1. **Full graph and band data:** `src/panels/analysis/widgets/TimeSeriesWidget.tsx:111` passes
   complete vectors. `src/charts/seriesData.ts:58` includes future extrema in Y domains and
   `src/charts/TimeSeriesChart.tsx:87` reads future hovered samples.
2. **Full engagement strip:** `src/panels/analysis/EngagementStrip.tsx:58` reads full lane
   outcomes. Marks and tooltips disclose future detection, classification, shots and severity.
3. **Pending effects in the ledger:** `src/panels/analysis/widgets/EventLedgerWidget.tsx:42`
   reveals effect time after assignment; `src/panels/analysis/widgets/EventLedgerWidget.tsx:55`
   also reveals removal mass before that effect. Header totals leak even when ready.
4. **Full projection:** `src/panels/analysis/widgets/ProjectionWidget.tsx:61` requests Infinity
   threat groups; `src/panels/analysis/OutcomeSummary.tsx:70` selects final outcome statistics.
5. **Canvas impact warnings:** `src/canvas/layers/ThreatWezLayer.tsx:244` builds final-risk
   summaries shown at T0; `src/canvas/layers/ThreatWezLayer.tsx:266` uses display time alone
   to admit leaker badges after a forward preview.

Other material paths include first-detection/warning MC scalar tiles, selected-effector final
capacity, selected-C2 detect-to-effect tables, and full debrief disclosure after Execute rewind.
Saved-frame promotion (`src/state/store.ts:1302`) undermines observation integrity itself.

## Verified store boundary facts

| Fact | Current source evidence |
| --- | --- |
| Forbidden store value imports | `docs/ENGINEERING_REFERENCE.md:75` forbids store value imports from mcRun, series, impact and attrition; execution stays behind mcClient. `src/state/store.ts:70` imports worker messages as types. The rule is documented, not a claim that a store-specific lint rule was found. |
| Worker graph enforcement | `src/playback/workerGraph.test.ts:30` traverses emitted value imports from the MC worker; lines 34–35 reject state/io/panels/canvas and browser storage. Type-only imports do not enter this graph. |
| Separate worker slots | `src/playback/mcClient.ts:29` holds MC; `src/playback/mcClient.ts:35` holds sensitivity. Both instantiate mc.worker, but replacing/canceling one holder does not replace the other. |
| Slot and message guards | `src/playback/mcClient.ts:49` rejects callbacks from old slots; line 54 guards errors. `src/playback/mc.worker.ts:78` matches cancel run IDs; lines 88 and 107 drive separate request kinds per instance. Store guards at `src/state/store.ts:1551` and `src/state/store.ts:1603` additionally require current run, running status and matching basis. |
| Configuration basis definition | `src/state/analysisBasis.ts:33` defines analysisBasisSignature. Sorted object keys preserve array order; shared resolvers fill defaults and named presentation/evidence fields are excluded. It is configuration equality, not an engine revision hash. |
| Edit, undo and redo invalidation | `src/state/store.ts:444`, `src/state/store.ts:514` and `src/state/store.ts:530` invoke playback/MC scenario-change guards. `src/state/runState.ts:114` and `src/state/runState.ts:131` compare the same basis definition. |
| Stable ID hash versus current run ID | `src/geometry/prng.ts:13` implements idHash as FNV-1a over UTF-16 code units. `src/playback/policy.ts:80` uses it in draw identity. Current playback uses `src/state/runState.ts:95` → `src/model/types.ts:1018`, a timestamp/counter ID. No current run-ID-to-replicate hash call exists. The plan proposes that new use of the existing hash. |
| Observation and navigation | `src/state/store.ts:1472` advances the observed horizon during playback. `src/state/store.ts:1504` makes a scrub a review without advancing observation. In contrast, `src/state/store.ts:1302` currently promotes a saved frame time into observation and can set startedAtMs. |
| Runtime state versus persistence | `src/state/runState.ts:12` declares playback derived and non-persisted. `src/io/persist.ts:195` subscribes only to Scenario identity. `src/state/store.ts:547` resets playback on scenario adoption. MC and sensitivity live in runtime state, not the scenario autosave. Frame times, historical AAR and card expectations can still persist inside Scenario. |
| Assignment versus physical timing | `src/playback/attritionReport.ts:123` defines tS as assignment; `src/playback/intercept.ts:170` computes physical release after engagement delay. `src/io/runResultGroups.ts:58` currently labels assignment as release. There is no release field in the current EngagementEvent contract. |

## Verification and stop point

Every fully qualified file:line reference was read back with `sed -n` against the current
source before writing this artifact. In-table references to another line in the same file
were also checked. Counts include only the five stage tables, not supporting fact tables.

- `git status --short src | wc -l`: **0**.
- Requested `npx markdownlint-cli2` command for this file: **exit 0**.
- Requested extracted-source-path existence loop: **no output**.
- `git diff --check`: **exit 0**.
- Broader `npm run docs:check`: **exit 1**, after Markdown lint passed. The index checker
  requires direct index links for this matrix, browser-perf-baseline.md and
  numerical-baseline.md. Updating the index is outside this task's single-file scope.

The initial tree contained an unrelated temporary source capture test. It was preserved;
it disappeared during the audit and the final source status was checked again. Existing
README, maintenance and sibling evidence changes were left untouched. Only this consumer
matrix was written in the repository. No browser or numerical baseline run is claimed here.
Stop point: lane B consumer inventory complete; R1 and application changes are not started.

## Evidence gaps and limits

- No unclassified runtime result-reader file remains in the traced branches. This is a
  static inventory: actual browser visibility, screen-reader announcements and custom-layout
  combinations were not exercised in this lane. “Yes” identifies reachable source behavior,
  not a captured browser reproduction of each row.
- Sub-step compliance needs a dedicated boundary test. The cursor rounds to the nearest
  DT (`src/state/selectors.ts:17`), hold matching admits a 0.25-second tolerance
  (`src/playback/trackState.ts:368`), and interpolated display time can lead the last published
  cursor (`src/canvas/frameClock.ts:102`). Exact early-display magnitude is not measured here.
- The source proves MC returns aggregates rather than a retained visible trial. Whether the
  existing sensor observations contain every admitted sampled scan needed for R4 replay
  requires a draw-history audit; no such completeness claim is made for those observations.
  The current jam display separately compounds event Pk (`src/playback/trackState.ts:529`),
  while the engine applies policy jam decisions (`src/playback/attrition.ts:253`).
- There is no current run-ID hash derivation to cite: only the existing idHash primitive and
  current timestamp/counter generation. Implementing the plan must record the numeric index.
- Export metadata also names `events.shipIndex` (`src/io/runResultGroups.ts:60`), whereas the
  actual event field is `shipIdx` (`src/playback/attritionReport.ts:130`). This is a verified
  naming mismatch for the R3/R5 export owner, not evidence of a second member-index field.
- LiveStrip and useEngagement comments say reset clears the picture cache, but current
  reset calls freshPlayback and clears MC (`src/state/store.ts:1517`); runSession explicitly
  describes same-configuration result reuse (`src/playback/runSession.ts:7`). Classification
  follows executable source, not those stale comments.
