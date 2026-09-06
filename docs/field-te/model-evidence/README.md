# RangeBoard E1 model evidence baseline

Status: E1 DOSSIERS AND SOURCE RECONCILIATION COMPLETE, 2026-09-05. This completes the documentary baseline selected for the C2/C3/E1 wave. E2 and E3 closed 2026-09-06 on Casey's word; the dossiers stay as the dated evidence baseline. Source baseline: `d8a76f1ac4edcd49e4c0bcaef6f94cf64ea14446`; the E1 lane changed only this directory and its source-capture directory, preserving code, seeds, historical research and user files.

## Dossiers and applicability

| PLAN family | Dossier | Supported evidence boundary |
| --- | --- | --- |
| Geometry/time | [Geometry and time](geometry-time.md) | Flat local geometry and selected time/grid identities; no terrain or variable-altitude validation. |
| Radar | [Radar](radar.md) | Closed-form/scan verification and qualified published range comparisons; calibration separated from independence. |
| EO/IR/acoustic/RF | [EO/IR, acoustic, RF](eoir-acoustic-rf.md) | Reduced range/gate arithmetic; absent hardware/environment comparison stated explicitly. |
| Track/C2/doctrine | [Track, C2, doctrine](track-c2-doctrine.md) | State/route/timing verification; role/latency PFs and scan/report distinction. |
| Motion/effect timing | [Motion and timing](motion-effect-timing.md) | Three-pass timing/error cases; preserved capped infeasibility quantified. |
| Effect/EW | [Effect and EW](effect-ew.md) | Conservation/channel arithmetic and limits of response factors and vendor trial counts. |
| Environment | [Environment](environment.md) | Exact PF inventory and potential overlap; no physical weather calibration. |
| Cross-family uncertainty | [Coverage crosswalk](uncertainty-crosswalk.md) | Exact sampled/fixed coverage, estimands, numerical checks, source-count and stopping limits. |

Each dossier records quantity/use, equation/units, frame/time, input pedigree, PF/defaults, calibration, assumptions/omissions, numerical error, verification, independent comparison status, unsupported conditions and data needs. It states where no comparison/error bound is available instead of substituting a universal tolerance.

## Evidence and reconciliation

- [Source register](sources.md): seven originals captured from primary publishers (four PDFs, three HTML pages); exact URLs/read times/status/hashes in the linked capture catalog. Three radar source pages were rendered and inspected. Text extracts are derived and never replace originals.
- [Seed snapshot](seed-inventory.json): all 90 current models and 205 provenance rows, source hash, descriptions, spec values and line pointers. Existing saved model copies can differ.
- [Historical repository inventory](repository-evidence-inventory.json): 27 artifacts across inventory/threat/T&E compilation and both historical plans, hashed without changing them. Relevant original research and implementation intent were reconciled first; targeted retrieval followed the identified gaps.
- [Reconciliation and proposed register rows](reconciliation-findings.md): F-61, R-F-2/3/4/6/7/16/29, M-11; parent owns actual append-only register integration.
- [Artifact hashes](artifact-hashes.json): lane deliverables/evidence integrity list; parent owns the overall wave manifest.

Primary-source status does not establish independent experimental evidence. Current sources qualify the radar comparisons and vendor-count spreads; they do not prove the selected model family across all conditions. Historical standards/reference lists remain historical unless explicitly captured now.

## Actual verification

`npx vitest run` over the sixteen named model/geometry/statistics test files: **320 tests passed in 16 files**, duration 3.82 s. [Exact output](../evidence/model-evidence-2026-09-05/focused-tests.txt). No test or equation was changed. This is mathematical/regression evidence only; it does not validate missing mechanisms or empirical uncertainty coverage.

Concurrent `npx tsc --noEmit -p tsconfig.app.json` exited **2** while the parent-owned temporary `src/playback/wave-parity.verify.test.ts` existed: node:fs/process type errors and a Scenario cast. [Exact output](../evidence/model-evidence-2026-09-05/typecheck.txt). Parent confirmed scratch removal afterward and owns the final integrated typecheck/full-test/lint/build/browser gates. E1 does not claim this failed concurrent check passed. No new temporary TypeScript test was created by E1.

Local artifact QA verifies all Markdown relative targets and source #L pointers exist, seven original hashes match the capture catalog, the seed source hash still matches, all 27 historical artifacts remain byte-identical, and all eight dossiers carry their required sections. See [QA output](../evidence/model-evidence-2026-09-05/artifact-qa.txt).

## Remaining limits and next bounded work

The strongest immediate E2 candidate is the already quantified capped-intercept feasibility problem; any selection belongs to Casey/the orchestrator after this wave. Source/configuration reconciliation, EW geometry and E3 uncertainty coverage remain proposed follow-ups. Do not start them as part of E1. No physics, seed, provenance, UI, schema, key, draw or dependency changes were made; no commit or push performed.
