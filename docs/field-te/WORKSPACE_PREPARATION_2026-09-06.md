# Agent workspace preparation, 2026-09-06

Historical preparation record based on `cf6f905` on `main`. Work was isolated on
`codex/agent-workspace-preparation`. This record selects no application refactor and
does not supersede current source or the user's next request.

## Scope and resulting environment

- Read the original `CLAUDE.md`, current references and history; traced Board and T&E
  stores, model types, analysis/worker flow, save recovery, UI and record transitions.
- Created a concise shared `AGENTS.md`; `CLAUDE.md` redirects to it. Features and
  refactor boundaries live in the project guide, not in agent instructions.
- Consolidated command/test procedures in the verification guide and working/handoff
  rules in the workflow. Old cancelled plans remain cancelled.
- Indexed all Markdown by current reference, historical evidence or source material.
  Added Markdown lint, local link/fragment checks, placement checks and source-review
  fingerprints. Current docs must be reviewed when their inputs or text change.
- Added the local `npm run check` gate and a GitHub Actions workflow using the same
  command. Actions are pinned to verified upstream v7 commit IDs.
- Added only documentation tooling dependencies. Pre-existing dependency versions,
  application source, fixtures, JSON evidence and binary source artifacts were unchanged.

## Drift corrections and source preservation

- Removed obsolete Claude-specific sandbox/environment instructions from shared guidance.
- Removed historical fixture values presented as current verification expectations;
  require a fresh baseline for numerical parity.
- Corrected the chart-fallback claim: the existing test checks the five series hues,
  not every fallback against current CSS. Other fallback values retain an earlier palette.
- Documented the satellite basemap's network dependency and per-origin browser storage.
- Normalized research Markdown spacing, fenced-block languages and table syntax.
  Four absent table cells are marked `[Not supplied in source]`; two tables escape
  literal enum pipes. Schema notation uses code spans instead of accidental hyperlinks.
  Original source text, numeric values, list numbering and sequence were retained.

The preservation comparison covered all 24 modified historical/source Markdown files.
After allowing only the listed Markdown syntax/whitespace corrections and missing-cell
markers, it found no unexpected content changes. Existing artifact manifests still record
their capture bytes; use those capture commits to reproduce original hash checks.

## Verification evidence

On the preparation tree, using Node 22.23.1 and npm 10.9.8:

| Check | Result |
| --- | --- |
| Application tests | 1,365 passing tests in 92 files |
| Documentation maintenance tests | 4 passing tests covering edit/add/delete/move, ignored inputs, indexing and instruction size |
| Type check and generated runtime schema | Passed |
| Markdown lint and local links | Passed for all 62 Markdown files |
| Source-review and placement checks | Passed for 9 current references |
| oxlint | Passed with 63 pre-existing fast-refresh warnings |
| Production build | Passed with the pre-existing large-bundle warning |
| Source and dependency comparison | No `src/` changes; no existing dependency version changes |
| Git diff whitespace check | Passed |

Isolated Chromium at 1400 × 900 loaded the JIATF-401 illustrative campaign: Campaign,
Design, Cards, Execute, Analyze, Deliver and Products rendered without page exceptions.
The demo contained one card, 14 runs and one finding. The Board loaded the detection
fixture through `parseAutosave` and `loadScenario`, completed 16 real-worker Monte Carlo
replicates at seed 4821, and marked the result stale after an environment edit. The final
scenario passed parsing. Board/chart and T&E Products screenshots were visually inspected.
One default `/favicon.ico` request returned 404; no application exception was observed.

Session logs, browser snapshots, screenshots and the preservation report are under
`/private/tmp/rangeboard-preparation-2026-09-06/` on the preparation machine. Temporary
evidence may be removed by the OS. The dedicated browser and dev server were stopped.

The first integrated gate caught Vitest discovering the Node-only maintenance harness
as a `.test.mjs` suite. Renaming it to `scripts/test-docs.mjs` kept Node execution explicit
and preserved Vitest discovery for the application. The complete gate was rerun afterward.

## Limits and stop point

This is onboarding and environment verification, not an exhaustive defect audit or model
validation. Safari, native import/recovery flows and full numerical parity were not rerun
in the browser for this documentation change. Hosted CI awaits publication; remote branch
protection was not changed. Source fingerprints enforce review, not semantic correctness.
Future work starts with one user-selected slice under the current agent guidance.
