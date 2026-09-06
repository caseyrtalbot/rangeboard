# RangeBoard agent guidance

Local-first C-UAS T&E planning app: React, TypeScript, Konva, zustand, Vite.
The Board and T&E Ops have separate stores and localStorage persistence.

## Start here

- Read the [project guide](docs/PROJECT_GUIDE.md) for features and source entry points;
  use the [document index](docs/README.md) to find the relevant reference.
- Inspect `git status`, the requested code and its tests before editing. Source and
  tests outrank historical prose. Old plans are cancelled, not a work queue.
- Complete the requested bounded slice. Make routine decisions within scope;
  surface a material ambiguity with evidence. Keep progress and handoffs concise.

## Preserve

- [Engineering invariants](docs/ENGINEERING_REFERENCE.md#3-hard-architectural-invariants)
  govern geometry, history, playback, worker isolation, persistence and draw identity.
- Keep modeled results, observed records and planning factors distinguishable.
  Preserve quantity, units, denominator, horizon, definedness and each statistic's
  own interval. Never invent missing data or turn source context into a requirement.
- Keep campaign data out of `Scenario`. Preserve recovery copies, storage keys,
  compatibility defaults, frozen records and append-only evidence histories.
- Reuse existing resolvers, statistics and UI tokens. Follow the
  [design system](docs/design/DESIGN_SYSTEM.md) and existing code style: two spaces,
  no semicolons, single quotes, named exports, short rationale comments.

## Verify and finish

- `npm ci` installs locked dependencies; `npm run dev -- --port <port> --strictPort`
  starts development. Use an available port and stop only your own processes.
- Run `npm run check` for the complete local gate. Use the
  [verification guide](docs/VERIFICATION.md) for focused tests and browser checks.
- Engine/store/playback refactors require fixed-ID numerical parity; UI changes
  require a real browser check. Type changes require `npm run schema:generate`.
- Update affected current docs in the same change, then review their source
  fingerprints per [workflow](docs/WORKFLOW.md#documentation-maintenance).
  `npm run docs:check` must pass. Dated evidence never becomes current tasking.
- Inspect the final diff. Preserve unrelated work; stage only task-owned paths
  when asked to commit. Report checks, limitations and the exact stop point.

## Handoffs and orchestration

- Follow the [handoff protocol](docs/WORKFLOW.md#handoffs-and-orchestration): one
  bounded task, source pointers, verified evidence, ownership and a stop condition.
- When parallel work is requested, assign disjoint files to each lane; give shared
  files and integration to one owner. Workers must preserve others' edits.
- Keep session logs, scratch tests and temporary handoffs outside tracked docs.
  Remove scratch tests after verification; never store secrets in handoffs.
