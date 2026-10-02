# RangeBoard documentation

Source and tests decide current behavior. Current references must be maintained with the
implementation. Historical records and extracted sources retain their capture context;
their phase labels, open items and instructions are not current tasking. Earlier plans and
handoffs were cancelled on 2026-09-06 and remain in Git history.

## Current references

| Document | Purpose |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Concise shared agent instructions |
| [CLAUDE.md](../CLAUDE.md) | Claude entry point pointing to AGENTS.md |
| [CONTEXT.md](../CONTEXT.md) | Glossary for the run timeline: rows, marks, spans, sides, tracks |
| [README.md](../README.md) | Project introduction and local setup |
| [PROJECT_GUIDE.md](PROJECT_GUIDE.md) | Features, execution boundaries and refactor navigation |
| [ENGINEERING_REFERENCE.md](ENGINEERING_REFERENCE.md) | Architecture, equations and implementation invariants |
| [VERIFICATION.md](VERIFICATION.md) | Commands, tests, parity and browser procedures |
| [WORKFLOW.md](WORKFLOW.md) | Bounded work, documentation maintenance, handoffs and orchestration |
| [DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) | Implemented visual rules, tokens and shared components |
| [HANDOFF.md](HANDOFF.md) | Position and landmines; rewritten in place, never a journal |
| [Plan.md](Plan.md) | Completed chrome refactor queue (Rows A to D); selects nothing |
| [timeline/SPEC.md](timeline/SPEC.md) | Run timeline spec and four-phase plan; sessions advance only in the handoff |
| [code-quality/Plan.md](code-quality/Plan.md) | Frozen queue for the three code-quality refactor follow-ups (Q1 to Q3); the handoff selects the row |
| [right-panel/Plan.md](right-panel/Plan.md) | Frozen queue for the right panel redesign (R1 to R3) with its approved prototype; the handoff selects the row |

Maintenance ownership and input fingerprints live in [maintenance.json](maintenance.json).
Run `npm run docs:check`; follow the [workflow](WORKFLOW.md#documentation-maintenance) when
a guide or its inputs change. The index itself is also a current reference.

## Historical evidence

These records describe their dated tree. Preserve fixtures, originals, numerical captures
and hash manifests at their existing paths. Hashes in an old manifest identify bytes at
capture: later Markdown formatting does not update or revalidate that capture. Retrieve
the original bytes from the capture commit when checking an old manifest.

### Design proposals

Proposals preserve design decisions as issued; the records below them show what was built.

- [Playback realism implementation proposal, 2026-09-07; stages R0 to R5 delivered by the R4 and R5 records](field-te/evidence/playback-realism-plan-2026-09-07.md)

### Completion and integration records

Earlier plans, earlier handoffs and the wave completion write-ups were removed on
2026-09-16 and remain in Git history.

- [Pre-R3 cleanup browser check, 2026-10-02](field-te/evidence/pre-r3-cleanup-2026-10-02/README.md)
- [Right panel R2 browser check, 2026-10-01](field-te/evidence/right-panel-r2-2026-10-01/README.md)
- [Row G kill types browser check, 2026-09-28](field-te/evidence/engine-g-2026-09-28/README.md)
- [Row F engine lane browser check, 2026-09-28](field-te/evidence/engine-f-2026-09-28/README.md)
- [Run timeline Row E lane E1 browser check, 2026-09-28](field-te/evidence/run-timeline-e1-2026-09-28/README.md)
- [Chrome cleanup lane E2 browser check, 2026-09-28](field-te/evidence/chrome-e2-2026-09-28/README.md)
- [Run timeline Phase 4 browser check, 2026-09-28](field-te/evidence/run-timeline-p4-2026-09-28/README.md)
- [Run timeline Phase 3 browser check, 2026-09-28](field-te/evidence/run-timeline-p3-2026-09-28/README.md)
- [Run timeline Phase 2 browser check, 2026-09-27](field-te/evidence/run-timeline-p2-2026-09-27/README.md)
- [Chrome refactor final capture after Row C, 2026-09-24](field-te/evidence/chrome-2026-09-24/README.md)
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
- [Flight-horizon measurement beside the Phase 3 comparison, 2026-09-21](field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md)
- [Hypothesis tools Phase 4 gate evidence, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
- [Zero-kill kinetic outcome on the firing laydown, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Calibration Phase 3 brief as issued 2026-09-10, common rules](field-te/evidence/p3-lanes-2026-09-10/briefs/p3-lane-common.md)
- [Calibration Phase 3 brief as issued 2026-09-10, field key and unit table](field-te/evidence/p3-lanes-2026-09-10/briefs/p3-fields.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.1 threat flight](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.1.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.2 passive RF](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.2.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.3 EO/IR](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.3.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.4 radar dwell](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.4.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.5 kinetic effectors](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.5.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.6 beam effectors](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.6.md)
- [Calibration Phase 3 brief as issued 2026-09-10, lane 3.7 Physics tab](field-te/evidence/p3-lanes-2026-09-10/briefs/lane-3.7.md)

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
- [finishSummary time at the retained cap, 2026-09-23](field-te/evidence/finish-summary-cap-2026-09-23/README.md)

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

### Inventory research

- [C-UAS inventory evidence](inventory/README.md)
- [Inventory change log, August 2026](inventory/changelog.md)
- [Doctrine terminology audit](inventory/doctrine.md)
- [Research gaps](inventory/gaps.md)
- [Inventory provenance](inventory/provenance.md)

### Threat research

- [Public-Source UAS / UCAS Threat Study for Counter-UAS Test and Evaluation](threat/UAS_CUAS_Threat_Study_Public_Source_2026-08-22.md)
