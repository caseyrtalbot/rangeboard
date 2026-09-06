# C2 result consistency

Dated lane record, 2026-09-05, integrated and verified. Source and tests decide current behaviour. Export integration, independent review, full gates and browser acceptance are complete; see ../WAVE_C2_C3_E1_COMPLETION.md. The lane record below preserves its handover evidence. No physics, distributions, draw keys, worker protocol, save schema or storage keys changed.

## Serial export integration specification (parent only)

Do not rewrite `assessments`, `attrition`, `requirements` or `summary` using MC values. They are deterministic records. `requirements` now includes `basis: 'planning-envelope'`; its gates always carry the planning-envelope limiting caveat even when passed MC validity. They never infer probability of passing from a mean interval.

1. Add a required `resultGroups` object to `RunExport`, with entries `assessments`, `attrition`, `requirements`, `summary`, and optional `mcSummary`, `sensitivity`. Every group names `basis`, `horizon`, `validity`, and measure semantics (or a shared measure descriptor map). Deterministic groups use `basis: 'planning-envelope'`, `horizon: 'full-run'`, and `assessRunValidity({...scenario, runMode:'deterministic'}, assessments)`. MC groups use `basis: 'monte-carlo-estimate'`, full-run or DT-grid horizons as below, and existing MC validity; sensitivity names its separate paired OAT design. Include all findings, not only overall validity. The existing top-level validity describes the selected run mode; it cannot replace group validity.
2. Make mixed package scope explicit: add a package basis scope or mixed semantic that does not imply the deterministic records are estimates. Preserve old deterministic record fields and values. If retaining top-level `dataBasis.kind/semantics` for compatibility, explicitly name the group to which they apply (`mcSummary` versus deterministic groups); consumers should read `resultGroups`.
3. Add configuration identity using the current `analysisBasisSignature(scenario)`, plus the already exported full Scenario (library specs, provenance, requirements, run settings and model identities), existing `models` and runtime run ID. State that the signature is configuration equality identity, not a cryptographic/source-revision hash. No version bump to Scenario.
4. MC field descriptors must distinguish: `lo/hi` = t confidence interval on the mean; `p10/p90` and `p025/p975` = replicate quantiles; `defined` = finite replicate fraction plus Wilson interval. Conditional time stats exclude undefined replicates; `n=0` is unavailable and `n=1` cannot support a mean CI. Do not invent an interval or MC pass probability. JSON serializes NaN as null; `n/total` retain definedness.
5. Explicit denominator/unit exceptions: kills and leakers bands are ships (not proportions); detected/tracked/engaged bands are tracks, denominator path-bearing tracks. Defeat = final kills mean / raidSize; convert its mean CI by the same 100/raidSize factor to percentage points. Leaker bands/perThreat.leaked are internal arrival partition counts; their displayed measure is undefined without an active defended asset, and may be zero with an asset but no arrival. AAR `summary.expectedLeakers` means undefeated ships = expectedLeakers + expectedNoArrival, not the displayed arrival count. `perEffector.kills` sums all event killDelta, including late effects; `perThreat.killed` and raid `kills` are pre-arrival only. Preserve these distinct meanings.
6. Sensitivity describes nominal/low/high end-of-run leaker means at one field's p10/p90 with all other parameters nominal, paired seed/replicate draws, in ships; the endpoints are neither a confidence interval nor replicate quantiles. No mean CI is available in its existing shape.

Suggested serial tests: export with distinct deterministic and MC means retains deterministic fields and group bases; requirement envelope finding exists under MC; basis identity changes with threshold/config edits; no-MC export in MC setting has only envelope result groups; finite/undefined n=0/n=1 time stats retain n/total after JSON round trip; four-ship proportion descriptor uses raidSize; no-asset leaker partition descriptor stays undefined; late effects remain separate; sensitivity group has paired OAT semantics. C1 guards at callers already prevent stale/running/error summaries being passed; preserve them.

## Consumer corrections

Outcome projection and debrief headline means/intervals share one statistic. Defeat divides both value and CI by raid size, with CI in percentage points. Undefined MC statistics show unavailable, never a deterministic fallback. Late effects, first effect, salvos and capacity remain individually marked planning envelope.

KPI cursor counts use their matching bands. Deterministic-only classified/targetable/salvos/late effects/first effect/detect-to-effect each carry planning-envelope labels. First-detect/min-warning MC statistics are explicitly **full-run conditional means** once playback starts; the existing summary contains no cursor-conditioned time statistics, so the UI no longer gates MC warning using a deterministic arrival. Ready mode retains zero/not-yet behavior. No new probability or product threshold was introduced.

Chart covered series use matching mean and replicate quantiles. Missing/mismatched/empty supported estimates are unavailable, while unsupported quantities remain labeled planning envelope. Leaker curves preserve no-asset undefinedness, including when an MC partition contains zero. Threat detail labels actual band availability, quantile semantics and deterministic event markers. Additional system/threat/event/lane/detail readouts are labeled deterministic. ThreatPicture distinguishes its current surviving-mass effect state (including late effects) from requirement verdicts. Sensitivity hides leaker results without an active defended asset and identifies paired parameter-p10/p90 endpoint means, not uncertainty intervals. About-projection copy reads the configured residual threshold and explains missing fire-control uplink routes.

## Verification and limits

- Focused suite: 88 tests in 7 files pass (requirements, series, OutcomeSummary, KpiTilesWidget, ProjectionWidget, SensitivityWidget, Detail); type-check passes after concurrent scratch/incomplete files were resolved.
- The first methodology static test failed because the real Info popover is closed in server markup. The test now renders its authored body via an Info test mock; parent browser verification must check the real popover.
- Coverage includes changed residual threshold; blocked fc route; no detections/no asset/no arrival; late effects; zero/single replicate definedness; four-ship proportion denominator; stale/running/error fallbacks; supported/missing/mismatched chart statistics. Existing requirement tests cover warning and residual threshold edits and arrival/late-effect rules.
- No independent trial validation claimed. Parent still must inspect actual browser rendering, integrate exports, run full gates and reconcile matrix findings before closing R-F-25.

Handover update: all C2 source/tests and approved expansions relinquished to parent for integration and independent review. Latest focused run: 88/88 tests across 7 files, 2026-09-05 09:47 local. Earlier C2 tsc passed; the final repeat reported only an unused @ts-expect-error in concurrent src/charts/tokens.test.ts:1 (outside lane ownership), which parent must resolve before the integrated gate. An intermediate lint run exposed only two extra warnings in parent browser scratch JS; parent renamed those artifacts and will record final lint count. `git diff --check` reported only the preserved user-owned CLAUDE.md trailing whitespace. No C2 commit/push or persistence edits occurred.

## Parent integration closure

RunExport now includes `resultGroups`, configuration equality identity, and `packageBasis`
that scopes the preserved legacy dataBasis fields. Deterministic records retain their values.
Independent review found MC parameter-spread validity leaking into envelope gate caveats;
requirements now recompute complete envelope findings in MC mode, and the payload/group
agreement has a regression. Six export tests cover distinct bases, JSON/import compatibility,
undefined/single samples, denominator/no-asset semantics and paired OAT endpoints.
KPI basis/interval sub-lines wrap at 320 px, and Fill expected names its envelope basis.
Final integrated 1,327 tests / 76 files, type-check/build and 74-warning lint pass.
Real workers/charts/exports and the configured-threshold methodology popover were inspected.
