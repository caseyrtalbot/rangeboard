# RangeBoard documentation

Source and tests decide current behaviour. The documents below describe the application
as it is, or record a dated capture. Plans and handoffs were removed on 2026-09-06; git
history holds them.

## Current reference

| Document | Purpose |
| --- | --- |
| [CLAUDE.md](../CLAUDE.md) | Codebase guide for agents: commands, architecture, invariants, code style, tests, tool environment |
| [Engineering reference](ENGINEERING_REFERENCE.md) | Architecture map, equations, invariants, UI rules, the T&E module and the standards table |
| [Verification guide](VERIFICATION.md) | Test conventions and browser, import and recovery procedures |
| [Design system](design/DESIGN_SYSTEM.md) | Surface rules, tokens, type roles and components of the implemented UI |

## Evidence and records

Each entry is a dated capture. Its counts, hashes and commit ids describe the tree at that
date and are not rerun when later work changes the source.

| Document or directory | Purpose |
| --- | --- |
| [Analysis identity record](field-te/C1_COMPLETION.md) | Freshness input and consumer matrix, lifecycle checks and evidence (2026-09-04) |
| [T&E record transitions](field-te/C4_COMPLETION.md) | Record transition, evidence-purpose and campaign acceptance rules and results (2026-09-05) |
| [Result, persistence and evidence wave](field-te/WAVE_C2_C3_E1_COMPLETION.md) | Integrated result and persistence work, model evidence and verification (2026-09-05) |
| [Measure matrix](field-te/wave-c2-c3-e1/C2_MATRIX.md) and [result record](field-te/wave-c2-c3-e1/C2_RESULT.md) | Quantity, basis, interval and export contracts at capture |
| [Runtime validation record](field-te/wave-c2-c3-e1/C3_RESULT.md) | Runtime validation, compatibility and recovery decisions at capture |
| [Independent review](field-te/wave-c2-c3-e1/INDEPENDENT_REVIEW.md) | Confirmed findings, corrections and review outcome |
| [Model evidence](field-te/model-evidence/README.md) | Dated dossiers per model family, source applicability, calibration limits |
| [Captured evidence](field-te/evidence/) | Original sources, fixtures, screenshots, run outputs and hash manifests, by date |

## Source material

| Document or directory | Why it remains |
| --- | --- |
| [T&E product plan](te-plan.md) | Original scope choices cited by `src/te/model/types.ts` |
| [T&E compilation](te-compilation/) | Source extraction, data model, forms, seed definitions and the calculation fixtures behind `src/te/calc/` tests |
| [Inventory research](inventory/README.md) | Source and provenance record behind the seed library |
| [Threat study](threat/UAS_CUAS_Threat_Study_Public_Source_2026-08-22.md) | Public-source evidence used by threat and effect planning factors |
