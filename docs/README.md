# RangeBoard documentation

Source and tests decide current behavior. Current references must be maintained with the
implementation. Historical records and extracted sources retain their capture context;
their phase labels, open items and instructions are not current tasking. Old plans and
handoffs were cancelled on 2026-09-06 and remain in Git history.

## Current references

| Document | Purpose |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Concise shared agent instructions |
| [CLAUDE.md](../CLAUDE.md) | Claude entry point pointing to AGENTS.md |
| [README.md](../README.md) | Project introduction and local setup |
| [PROJECT_GUIDE.md](PROJECT_GUIDE.md) | Features, execution boundaries and refactor navigation |
| [ENGINEERING_REFERENCE.md](ENGINEERING_REFERENCE.md) | Architecture, equations and implementation invariants |
| [VERIFICATION.md](VERIFICATION.md) | Commands, tests, parity and browser procedures |
| [WORKFLOW.md](WORKFLOW.md) | Bounded work, documentation maintenance, handoffs and orchestration |
| [DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) | Implemented visual rules, tokens and shared components |
| [HANDOFF.md](HANDOFF.md) | Position, tasking ahead and landmines; rewritten in place, never a journal |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Calibration blueprint implementation: phases, lanes, owners, file sets and stop conditions |

Maintenance ownership and input fingerprints live in [maintenance.json](maintenance.json).
Run `npm run docs:check`; follow the [workflow](WORKFLOW.md#documentation-maintenance) when
a guide or its inputs change. The index itself is also a current reference.

## Historical evidence

These records describe their dated tree. Preserve fixtures, originals, numerical captures
and hash manifests at their existing paths. Hashes in an old manifest identify bytes at
capture: later Markdown formatting does not update or revalidate that capture. Retrieve
the original bytes from the capture commit when checking an old manifest.

### Design proposals

Proposals preserve design decisions for review; implementation requires separate approval.

- [Playback realism implementation proposal, 2026-09-07](field-te/evidence/playback-realism-plan-2026-09-07.md)

### Completion and integration records

- [Phase 3 integration code review, 2026-09-11](CodeReview.md)
- [Phase 3 review fixes CR-01 to CR-04, 2026-09-14](field-te/evidence/cr-fixes-2026-09-14/README.md)
- [Calibration Phase 0 gate evidence, 2026-09-10](field-te/evidence/p0-gate-2026-09-10/README.md)
- [Calibration Phase 1 gate evidence, 2026-09-10](field-te/evidence/p1-gate-2026-09-10/README.md)
- [Calibration Phase 2 gate evidence, 2026-09-10](field-te/evidence/p2-gate-2026-09-10/README.md)
- [Calibration Phase 2 timeline comparison, before and after](field-te/evidence/p2-gate-2026-09-10/comparison.md)
- [Calibration Phase 2 tip timing and legacy-board evidence](field-te/evidence/p2-gate-2026-09-10/tip-timing.md)
- [Calibration slice 3.0 stamps evidence, 2026-09-10](field-te/evidence/p3-stamps-2026-09-10/README.md)
- [Calibration lane 3.7 Physics settings verification, 2026-09-10](field-te/evidence/p3-physicstab-2026-09-10/README.md)
- [Calibration Phase 3 gate evidence, 2026-09-10](field-te/evidence/p3-gate-2026-09-10/README.md)
- [Calibration Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Calibration Phase 3 brief as issued 2026-09-10, common rules](field-te/evidence/p3-lanes-2026-09-10/briefs/p3-lane-common.md)
- [Calibration Phase 3 brief as issued 2026-09-10, field key and unit table](field-te/evidence/p3-lanes-2026-09-10/briefs/p3-fields.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.1 threat flight](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.1.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.2 passive RF](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.2.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.3 EO/IR](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.3.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.4 radar dwell](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.4.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.5 kinetic effectors](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.5.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.6 beam effectors](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.6.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.7 Physics tab](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.7.md)
- [C1: analysis identity and result invalidation](field-te/C1_COMPLETION.md)
- [C4: authoritative T&E record transitions](field-te/C4_COMPLETION.md)
- [C2/C3/E1 wave completion](field-te/WAVE_C2_C3_E1_COMPLETION.md)
- [C2 measure inventory](field-te/wave-c2-c3-e1/C2_MATRIX.md)
- [C2 result consistency](field-te/wave-c2-c3-e1/C2_RESULT.md)
- [C3: runtime validation and recovery](field-te/wave-c2-c3-e1/C3_RESULT.md)
- [Independent integration review](field-te/wave-c2-c3-e1/INDEPENDENT_REVIEW.md)

### Model evidence dossiers

- [RangeBoard model evidence baseline](field-te/model-evidence/README.md)
- [Effect and EW dossier](field-te/model-evidence/effect-ew.md)
- [Environment dossier](field-te/model-evidence/environment.md)
- [EO/IR, acoustic and passive RF dossier](field-te/model-evidence/eoir-acoustic-rf.md)
- [Geometry and time dossier](field-te/model-evidence/geometry-time.md)
- [Motion and effect timing dossier](field-te/model-evidence/motion-effect-timing.md)
- [Radar dossier](field-te/model-evidence/radar.md)
- [E1 source and description reconciliation](field-te/model-evidence/reconciliation-findings.md)
- [E1 source register](field-te/model-evidence/sources.md)
- [Track, C2 and doctrine dossier](field-te/model-evidence/track-c2-doctrine.md)
- [Uncertainty coverage crosswalk](field-te/model-evidence/uncertainty-crosswalk.md)

### Captured checks

- [E2 motion correction before-and-after capture, 2026-09-05](field-te/evidence/e2-motion-fix-2026-09-05/diff.md)
- [E2 R-F-30 before-and-after capture, 2026-09-05](field-te/evidence/e2-rf30-jam-2026-09-05/diff.md)
- [R-F-20 Engage row browser check, 2026-09-05](field-te/evidence/e2-solver-spreads-2026-09-05/browser-check.md)
- [Closed-form intercept solver and PF spreads: before-and-after capture, 2026-09-05](field-te/evidence/e2-solver-spreads-2026-09-05/diff.md)
- [E3 follow-ups before-and-after capture, 2026-09-05](field-te/evidence/e3-followups-2026-09-05/diff.md)
- [E3 intervals before-and-after capture, 2026-09-05](field-te/evidence/e3-intervals-2026-09-05/diff.md)
- [F-16 browser check, 2026-09-05](field-te/evidence/track-c2-slice-2026-09-05/browser-check.md)
- [Track, C2 and doctrine slice: before-and-after capture, 2026-09-05](field-te/evidence/track-c2-slice-2026-09-05/diff.md)
- [Native import browser check](field-te/evidence/wave-c2-c3-e1-2026-09-05/native-import-recipe.md)
- [Performance baseline at 955ad6b, 2026-09-06](field-te/evidence/perf-2026-09-06/README.md)
- [R4 trial engine and lifecycle, 2026-09-07](field-te/evidence/r4-trial-lifecycle-2026-09-07/README.md)
- [R5 sampled experience evidence, 2026-09-08](field-te/evidence/r5-sampled-experience-2026-09-08/README.md)

Other evidence formats, including fixtures, screenshots, raw sources and numerical JSON,
live under [field-te/evidence](field-te/evidence/).

## Historical source material

These are original research and product-intent compilations. Their technical content
remains available for provenance; current code and tests determine what was implemented.
Source titles, thresholds, citations and unknowns retain their original meaning.

### T&E scope and compilation

- [00 Roles, Authority, Records & Configuration Control + 01 Engagement Qualification, Discovery & Mission Definition](te-compilation/01-roles-qualification.md)
- [02 — Evidence Planning, Measures & Test Design](te-compilation/02-evidence-measures-design.md)
- [03 — Technical Integration, Range Planning & Readiness](te-compilation/03-integration-readiness.md)
- [Test Cards & Controlled Test Execution (sections 04 + 15)](te-compilation/04-test-cards-execution.md)
- [05 — Data Validation, Analysis & Adaptive Replanning](te-compilation/05-validation-analysis.md)
- [06 — Decision Evidence, Closeout, Regression & Reuse](te-compilation/06-decision-closeout.md)
- [07 — Field Templates, Forms & Checklists](te-compilation/07-templates-forms-checklists.md)
- [OPFOR & Threat Representation + C-UAS Doctrine-to-Test Application](te-compilation/08-threat-doctrine.md)
- [C-UAS Measure Dictionary & Quantitative Test Design (Agent 9)](te-compilation/09-measures-quantdesign.md)
- [14 - Quantitative Guide: Data, Calculations & Experiments (calculations engine source)](te-compilation/10-quant-guide.md)
- [Instrumentation & Ground Truth + Worked C-UAS Test Cards (Agent 11)](te-compilation/11-instrumentation-worked-cards.md)
- [JIATF-401 reference customer + Case Study: Early-Warning Architecture Evaluation](te-compilation/12-jiatf401.md)
- [Field Guide + Questions to Master (agent 13)](te-compilation/13-field-guide-questions.md)
- [MASTER-CALCULATIONS — Unified Calculation Catalog](te-compilation/MASTER-CALCULATIONS.md)
- [MASTER DATA MODEL — RangeBoard T&E Operations module](te-compilation/MASTER-DATAMODEL.md)
- [MASTER-FORMS — Checklists, Templates, Print Artifacts & Deliverables](te-compilation/MASTER-FORMS.md)
- [MASTER-SEEDDATA: RangeBoard T&E Operations module](te-compilation/MASTER-SEEDDATA.md)
- [Extraction brief: RangeBoard T&E Operations module](te-compilation/_BRIEF.md)
- [RangeBoard T&E Operations module: product plan and implementation plan (module removed 2026-09-09)](te-plan.md)

### Inventory research

- [C-UAS inventory evidence](inventory/README.md)
- [Inventory change log, August 2026](inventory/changelog.md)
- [Doctrine terminology audit](inventory/doctrine.md)
- [Research gaps](inventory/gaps.md)
- [Inventory provenance](inventory/provenance.md)

### Threat research

- [Public-Source UAS / UCAS Threat Study for Counter-UAS Test and Evaluation](threat/UAS_CUAS_Threat_Study_Public_Source_2026-08-22.md)
