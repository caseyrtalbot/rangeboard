# RangeBoard model evidence baseline

Dated evidence baseline, 2026-09-05, against source `d8a76f1ac4edcd49e4c0bcaef6f94cf64ea14446`. Source and tests decide current behaviour. The dossiers below record what each model family could support at that date; later engine work (for example the closed-form intercept solver and the radar study of 2026-09-06) is in source and tests, not in these dossiers.

## Dossiers and applicability

| Model family | Dossier | Supported evidence boundary |
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
- [Reconciliation findings](reconciliation-findings.md): seed descriptions and provenance rows that disagreed with the sources at capture time.
- [Artifact hashes](artifact-hashes.json): integrity list of the dossier deliverables and evidence at capture.

Primary-source status does not establish independent experimental evidence. Current sources qualify the radar comparisons and vendor-count spreads; they do not prove the selected model family across all conditions. Historical standards/reference lists remain historical unless explicitly captured now.

## Actual verification

`npx vitest run` over the sixteen named model/geometry/statistics test files: **320 tests passed in 16 files**, duration 3.82 s. [Exact output](../evidence/model-evidence-2026-09-05/focused-tests.txt). No test or equation was changed. This is mathematical/regression evidence only; it does not validate missing mechanisms or empirical uncertainty coverage.

A concurrent `npx tsc --noEmit -p tsconfig.app.json` exited **2** while a temporary parity scratch test existed under `src/playback/`: node:fs/process type errors and a Scenario cast. [Exact output](../evidence/model-evidence-2026-09-05/typecheck.txt). The scratch file was removed and the integrated gates were rerun for the then-current `docs/field-te/WAVE_C2_C3_E1_COMPLETION.md`.

Local artifact QA verifies all Markdown relative targets and source #L pointers exist, seven original hashes match the capture catalog, the seed source hash still matches, all 27 historical artifacts remain byte-identical, and all eight dossiers carry their required sections. See [QA output](../evidence/model-evidence-2026-09-05/artifact-qa.txt).

## Limits at capture

At capture the open questions were capped-intercept feasibility, source and configuration reconciliation, EW geometry and uncertainty coverage. The dossier work made no physics, seed, provenance, UI, schema, key, draw or dependency change.
