# RangeBoard documentation

Read current guidance first. Retained historical plans describe intended designs and source
pedigree; their old commands, role assignments and completion counts are not current tasking.
Source, tests and recorded verification determine implemented behavior.

## Current guidance

| Document | Purpose |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Astra working contract, task boundaries, verification and git rules |
| [AI_HANDOFF.md](AI_HANDOFF.md) | One current transfer record: state, evidence and next bounded task |
| [Outstanding register](data-engine/outstanding.md) | Only decision and follow-up status authority |
| [Engineering reference](ENGINEERING_REFERENCE.md) | Detailed architecture, equations, invariants, UI and T&E contracts |
| [Verification guide](VERIFICATION.md) | Test conventions and isolated browser/import/recovery procedures |
| [Field T&E plan](field-te/PLAN.md) | Acceptance specification; later slices need selection |
| [Backlog triage](field-te/BACKLOG_TRIAGE.md) | Routing index for inherited register rows, not a second status list |

## Verified records and evidence

| Document or directory | Purpose |
| --- | --- |
| [Ownership findings](field-te/OWNERSHIP_FINDINGS.md) | Dated source-linked findings; current resolution is in the register |
| [C1 completion](field-te/C1_COMPLETION.md) | Freshness input/consumer matrix, lifecycle checks and evidence |
| [C2/C3/E1 completion](field-te/WAVE_C2_C3_E1_COMPLETION.md) | Integrated result/persistence work, model evidence and verification |
| [C2 measure matrix](field-te/wave-c2-c3-e1/C2_MATRIX.md) and [result record](field-te/wave-c2-c3-e1/C2_RESULT.md) | Quantity, basis, interval and export contracts |
| [C3 result record](field-te/wave-c2-c3-e1/C3_RESULT.md) | Runtime validation, compatibility and recovery decisions |
| [Independent review](field-te/wave-c2-c3-e1/INDEPENDENT_REVIEW.md) | Confirmed findings, corrections and review outcome |
| [Model evidence](field-te/model-evidence/README.md) | E1 dossiers, source applicability, calibration and remaining gaps |
| [Captured evidence](field-te/evidence/) | Original sources, fixtures, screenshots, run outputs and hash manifests |

Evidence manifests describe capture-time bytes and state. Later publication or documentation
metadata changes do not rewrite a historical capture or imply its tests were rerun. Read the
completion record and current handoff for subsequent verification. Original source captures
and numerical fixtures remain intact.

## Retained reference

| Document or directory | Why it remains |
| --- | --- |
| [Data-engine plan](data-engine/PLAN.md) | Completed specification referenced by decision rows and fixtures |
| [Engine-refactor plan](engine-refactor/PLAN.md) | Completed specification; section 12 is cited by `src/analysis/fidelity.ts` |
| [T&E product plan](te-plan.md) | Original scope choices cited by `src/te/model/types.ts`; later fixes are recorded separately |
| [T&E compilation](te-compilation/) | Original source extraction, data model, forms, seed definitions and calculation fixtures |
| [Inventory research](inventory/README.md) | Original source/provenance record behind the seed library |
| [Threat study](threat/UAS_CUAS_Threat_Study_Public_Source_2026-08-22.md) | Public-source evidence used by threat and effect planning factors |

## Retired execution documents

Removed on 2026-09-05 because their tasking was completed or superseded:

- `docs/data-engine/handoff-orchestrator.md`
- `docs/engine-refactor/handoff-post-wave3.md`
- `docs/field-te/wave-c2-c3-e1/C2_BRIEF.md`
- `docs/field-te/wave-c2-c3-e1/C3_BRIEF.md`
- `docs/field-te/wave-c2-c3-e1/E1_BRIEF.md`
- `docs/field-te/wave-c2-c3-e1/REVIEW_BRIEF.md`
- `docs/field-te/wave-c2-c3-e1/OWNERSHIP.md`

The current handoff replaces the transfers; the verification guide retains useful browser
procedures and points to the verified firing fixture. Completion and review records retain
lane outcomes and ownership. Recover an original with `git show 66db3ad:<repository-path>`.
Historical references in append-only register rows identify those original records.

The modified `CLAUDE.md`, untracked `.claude/launch.json`, and four data-engine mockup/build
files were unowned by this cleanup and remain untouched. They are not execution authorities.
