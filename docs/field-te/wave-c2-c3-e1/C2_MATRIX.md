# C2 measure inventory

Verified by source trace 2026-09-05. Scope is Board result consistency (R-F-25), including every Board headline, chart family, gate and exported result group. T&E campaign calculations/record enforcement remain the separate C4 scope. Configuration inputs, provenance tags, model fidelity tags and validity findings are metadata, not numerical estimates.

Notation: **E** = deterministic planning envelope. **M** = MC mean, finite replicate denominator n; mean CI is `lo/hi`, replicate quantiles are `p10/p90` and `p025/p975`. **T** = path-bearing threat tracks (one formation counts one track), **R** = ships in raid (formation ship count included). **Cursor** = quantized playback time; **run** = full configured duration. E-only means no corresponding replicate statistic is available to that consumer; an M estimate never silently substitutes E under an estimate label.

## Headlines and tiles

| Consumer / quantity | Unit; denominator | Horizon | Source / basis | Definedness / action |
| --- | --- | --- | --- | --- |
| OutcomeSummary Defeat | %; R ships | run end | E totals.expectedKills/R; M kills.mean[last]/R | R=0 unavailable; M CI converted by 100/R, in percentage points. Pre-arrival kills only. Fixed. |
| OutcomeSummary Leakers | ships; no ratio | run end | E totals.reportedLeakers; M leakers.mean[last] | No active defended asset: unavailable. Asset but no crossing: zero is valid. Never display internal no-asset partition zero. Fixed. |
| OutcomeSummary Late E[k] | ships; no ratio | run | E expectedLateKills | Late destruction is inside leaker mass; not added to defeat. E label. |
| OutcomeSummary First detect | seconds from T0; finite replicate n for M | run | E min firstDetectS; M firstDetectS.mean | No detection gives null/zero finite samples; conditional mean and defined n/total explicit. Fixed. |
| OutcomeSummary First effect | seconds from T0 | run | E earliest event with killDelta>0 | Continue-jam alone cannot define it. No event = unavailable. E label. |
| OutcomeSummary Min warning | seconds; finite replicate n for M | run | E min warningS; M minWarningS.mean | Requires detection and arrival on at least one track; excludes undefined replicates. No asset/no arrival/no detected arrival = unavailable. Fixed. |
| OutcomeSummary Salvos + per-effector capacity | kinetic rounds / DE bursts / EW salvos; remaining rounds over magazine capacity | run | E expenditure totals and per-effector rows | Continuous/unknown capacity stays explicit; expenditure channels kept distinct. E labels. |
| KPI Detect | tracks / T | cursor cumulative | E liveKpis.detected; M detected band | Zero before play; valid zero when none detected. Matching mean/CI. |
| KPI Track now | tracks / T | cursor instantaneous | E detectionsAt enabled holds; M tracked band | Zero when no held track. Matching mean/CI. |
| KPI ID/class | tracks / T | cursor cumulative | E classified | E-only label. |
| KPI Target now | tracks / T | cursor instantaneous | E targetable, excludes ghosts | E-only label. |
| KPI Engaged | tracks / T | cursor cumulative | E engaged; M engaged band | Any expenditure channel qualifies; matching mean/CI. |
| KPI Salvos | rounds, DE bursts, EW salvos | cursor cumulative | E kineticShots/deSalvos/jamSalvos | E-only label; channels not combined into kinetic rounds. |
| KPI Kill E[k] | ships | cursor cumulative | E expectedKills; M kills band | Pre-arrival kills only; matching mean/CI. |
| KPI Late E[k] | ships | cursor cumulative | E lateKills | E-only label; does not decrease leaker count. |
| KPI Leak E[n] | ships | cursor cumulative arrivals | E leakerShips; M leakers band | Unavailable without active asset; matching mean/CI. |
| KPI First detect | seconds from T0; n finite replicates | E reached time at cursor; M full run | E earliest detection; M firstDetectS | M explicitly full-run conditional mean once play starts. No cursor-conditioned time summary exists. Does not use deterministic arrival/reach gate. |
| KPI First effect | seconds from T0 | cursor reached event | E earliest positive killDelta | Undefined until reached; E-only label. |
| KPI Detect to effect | seconds | cursor once both events reached | E firstEffect-firstDetect | Undefined unless both times exist/reached; E-only label. |
| KPI Min warning | seconds; n finite replicates | E once its arrival reached; M full run | E warning holder; M minWarningS | M explicitly full-run conditional mean; no deterministic holder controls M visibility. |
| Projection threat outcome / Debrief threat record | tracks, ships, residual ships and %/group ships; timestamps | run | E threatPictureAt | Group survives is current surviving mass, including late destruction; not arrival leakers. Labels distinguish E. |
| Debrief system record / event totals | components, salvos, event count | run | E systemTelemetryAt/report | E group labels. Completion metadata remains playback bookkeeping, not trial observations. |
| LiveStrip run/mode header | seconds, selected/finished replicate count, seed | cursor and configured run | playback/run settings | Mode selection describes intended calculation; every result consumer separately names actual E/M basis. No headline outcome in this header. |
| ThreatPictureWidget/member/group chips | tracks/T or group tracks; ships and residual %/group ships; first times; hold fraction and longest gap | cursor; projected/debrief run | E threatAggregation | Effect state uses current surviving-mass cutoff, includes late destruction, and is not a requirement verdict. Preserve latch; add explanatory wording. |
| SystemStatusWidget/components/groups | online components/total; held/seen/classified tracks; salvos; effects; E kills; remaining/total capacity; downstream effectors | cursor; debrief run | E systemTelemetryAt | Hold clock is union seconds; track seconds sum over simultaneous tracks, not clock time. Unknown capacity explicit. E label. |
| EventLedgerWidget / debrief ledger | T0 release/effect seconds; per-shot Pk; delta kill mass ships; ship index | assigned by cursor / run | E events | Continue-jam may show zero killDelta; E label. |
| Sensitivity headline/tornado/table | end-run leaker mean ships, low/high means, absolute swing; replicate count and seed | run | paired M one-at-a-time parameter p10/p90 | Parameter endpoints are not mean CIs or replicate quantiles. No CI available. No active asset hides result; preserve currentSensitivity freshness. |
| Test card Fill expected (outside lane writer ownership) | AAR headline and per-track outcome/leak % | run at fill action | E buildAarSummary | Parent integration labels E basis; generated text is an editable expectation, not imported trial evidence. |

## Charts and detail readouts

All line/step builders use the DT grid. Each listed family includes every ID emitted by that builder. E-only charts carry group/series basis labels. Scalar input/model rows retain their input/provenance meanings.

| Builder / consumer | Quantity and unit; denominator | Horizon / basis | Definedness and correction |
| --- | --- | --- | --- |
| kpiSeries: detected, classified, targetable, engaged, arrivedTracks | count of tracks; no ratio | full grid E; detected/engaged replaced by M when current | Missing M for supported IDs unavailable; unsupported classified/targetable/arrived remain E. |
| kpiSeries: kineticShots, deSalvos, jamSalvos | expenditure channel count | full grid E | E labels; no replicate channel bands. |
| kpiSeries: expectedKills, lateKills, leakerShips | ships | full grid; kills/leakers E or M, lateKills E | Leakers NaN without asset before/after band overlay. Unsupported lateKills E. |
| heldTracksSeries / sensors preset | simultaneously held tracks | grid E or M tracked | Matching M line/80%/95% quantiles; T y-range. |
| meanHeldPdSeries / sensors preset | mean single-scan Pd across held tracks; fraction | grid E | Undefined where no Pd-bearing held track; E label. |
| salvosInFlightSeries / effectors preset | release-assigned, not yet landed salvos; count | grid E | E label even beside M kills. |
| groupResidualSeries / threat preset | surviving ships per group (shipCount minus all landed killDelta) | grid E | Includes late effects; group aggregation has no MC band, remains E. |
| sensorSeries pd.*, slant.*, held.* | per-track Pd fraction; slant m (detail converts to km); hold 0/1 | grid E | Pd NaN outside modeled observation domain; slant/hold retain geometry/hold meanings. Sensor detail E group label. |
| scanLoadSeries | tracks per scan | grid E | Scan model admitted load; E. |
| trackLadderRows | hold/init/coast spans, seconds | run E | Empty spans when no observation; sensor E label. |
| effectorSeries pk.*, rounds, salvos | Pk fraction per selected event/track; rounds remaining; cumulative salvos | grid E | No magazine model -> no rounds series; E label. |
| releaseLadderRows / salvoMarks | per-threat release-to-effect spans; shot/effect T0 seconds | run E | No events = empty; late effects retained. E label. |
| threatSeries pd.* | per-sensor Pd fraction | grid E | No modeled radar observation = unavailable; E label. |
| threatSeries residual / ThreatDetail survival | surviving ships (includes late destruction) | grid E or M perThreat.residual | Matching mean/quantile bands; no matching threat/bad grid -> unavailable. Header reflects actual bands. |
| threatSeries phase / phaseLadderRow | phase category/state number, seconds | grid E | No observation produces no span; E label. |
| systemSeries latency.* / hop.* | detect-to-first-shot seconds; configured selected-route latency seconds | grid E | Missing detection/shot/route undefined; SystemDetail E label. |
| trackMarks / survival markers / EngagementStrip | ARR, CPA, shot, ROE gate, positive effect, classification/window times | run E | Arrival and CPA remain separate; MC survival labels markers E. |
| SensorDetail Load/hold/gates | tracks per scan, scan seconds, union hold seconds, integrated track-seconds, range m/km, elevation degrees; hold/slant/horizon booleans | cursor E + model inputs | No MC statistics; input provenance untouched. |
| EffectorDetail doctrine/capacity | readiness/window/release time, round capacity/expenditure; engage seconds, flyout m/s, BDA seconds | cursor/run E + model inputs | No MC statistics displayed; input provenance untouched. |
| SystemDetail hops/coverage | routed threat/effector count, route presence, latency seconds | run E | Missing routes explicitly unavailable; E label. |
| ThreatDetail track file | altitude ft, speed selected units, slant km, bearing degrees, held sensors, phase/classification, warning/arrival/CPA/first-detect seconds, CPA distance; RCS m² | cursor/run E + model inputs | Arrival null without crossing; source/input rows retain provenance. E label separates from M survival chart. |

M line bands show empirical replicate quantiles (central 80% and 95%), not mean confidence intervals. Missing vectors or grid mismatch cannot silently restore a deterministic curve. Single-replicate quantiles are empirical endpoints, not evidence of a mean CI. Count/time subs explicitly suppress mean CI at n<2; n=0 uses unavailable wording. No pass probability is derived.

## Requirement gates

Every gate consumes E assessments/report regardless of selected mode. Required count is gate-specific valid track population after invalidating findings; overall count is gates met / six gates (or selected subset). All carry planning-envelope basis/caveat. MC validity never removes that qualification.

| Gate | Quantity / unit / denominator | Horizon | Test / definedness |
| --- | --- | --- | --- |
| Detect | detected-before-arrival tracks / eligible detect tracks; earliest detection and minimum warning seconds | run | Optional scenario minimum warning; no asset with warning requirement = not evaluated. No detection fails. Single-scan Pd threshold remains scenario-defined engine input. |
| Track | held-at-decision tracks / eligible track tracks | first shot, target opening, arrival, then CPA | Hold intervals supply test; no decision point fails. Track cumulative Pd remains scenario-defined engine input. |
| Identify | hostile-classified tracks / eligible identify tracks | run | Hostile time required. |
| Target | engageable tracks / eligible target tracks; shortest selected window seconds | run | ROE hold not evaluated; no-fc-uplink failure explains missing fire-control sensor, geometry-only window, no shot. |
| Engage | any-channel engaged tracks / eligible engage tracks; salvos count | run | ROE hold not evaluated; any kinetic/DE/EW salvo qualifies. |
| Effect / Survival limit | per-track leakProbability fraction versus configured maxResidualPerTrack; supporting aggregate defeat %/R and reported leaker ships | pre-arrival outcome | User threshold unchanged; late kills do not count. No-asset invalidating findings exclude population. No mean-CI-as-pass test. |

## Export groups (parent integration)

| Group / every measure family | Basis; units / denominator; horizon | Definedness / required descriptor |
| --- | --- | --- |
| assessments | E; every per-track detection/classification/hold/route/window/arrival/CPA time (s), geometry (m), Pd (fraction), status/category | run; null times and absent routes stay explicit. Full findings and envelope validity. |
| attrition.totals / threats | E; raid ships; pre-arrival hard/soft/all kills, late kills, leakers, no-arrivals in ships; per-track leak fraction over ship count; channel expenditure | run; reportedLeakers null without asset; partition values retain engine bookkeeping meaning. |
| attrition.effectors / events | E; assigned channel counts, capacity rounds; event release/effect s, Pk fraction and killDelta ships | run; event deltas may be late; capacity null for continuous/unknown. |
| requirements | E; eligible track pass counts, test thresholds, six independent gate statuses | run; explicit basis, every caveat/failure, not probability of pass. |
| summary (AAR) totals / threat / effector rows | E; counts, times, channel spends, outcome category, leak fraction; optional impact ships/warhead kg/severity | run; pinned `expectedLeakers` = undefeated (arrived leakers + no-arrival), not arrival-only. No persisted semantics change. |
| mcSummary kills/leakers/detected/tracked/engaged | M; ships for first two, tracks for last three; n=replicates per step | DT-grid; leaker display undefined without asset. Means, mean CIs and replicate quantiles distinct. |
| mcSummary firstDetectS/minWarningS | M; conditional seconds; denominator finite n out of total | run; no detection/arrival excludes sample, n=0 unavailable, n=1 no mean CI. Defined Wilson interval has a different denominator/statistic. |
| mcSummary perThreat killed/leaked/firstDetectS/arrivalS/shipCount/residual | M pre-arrival kills / arrived leaker ships, conditional detection seconds; fixed geometry arrival seconds and ship count; residual all-effect surviving ships | run or DT-grid residual; absent arrival null. Residual is not arrival leakers. |
| mcSummary perEffector salvos/kills | M; salvos all channels combined; kills sum all event delta ships including late | run; different kill horizon semantics from raid pre-arrival kills. |
| sensitivity nominal/rows | paired OAT M; leaker means ships at parameter p10/p90, swing ships | run; no asset unavailable; no interval/stat definedness in existing shape. Parent export must describe partition/display condition. |
| run/configuration/models/validity/sampledFields | metadata; IDs, timestamps, duration/observed seconds, scenario specs/provenance, model tags, per-field spreads and findings | configuration identity plus full source Scenario; no empirical measurement claim. |

Export requirements and serial tests are specified in C2_RESULT.md. Parent owns implementation and round-trip checks, preserving C3 validation changes.
