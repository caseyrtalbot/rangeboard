# RangeBoard agent guidance

Local-first C-UAS T&E planning app: React, TypeScript, Konva, zustand, Vite.
One zustand store holds the Board; persistence is localStorage.

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
- Preserve recovery copies, storage keys and compatibility defaults.
- The library is the JSON package under `data/library`. Edit the JSON, then run
  `npm run library:build`; never hand-edit a generated file.
- Reuse existing resolvers, statistics and UI tokens. Follow the
  [design system](docs/design/DESIGN_SYSTEM.md) and Prettier (`npm run format`): two
  spaces, no semicolons, single quotes, named exports, short rationale comments.

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

## Learned User Preferences

- When a plan exists, execute one row per agent turn; do not start the next row until asked.
- Leave a plan file unmodified during row work; when one exists, the handoff links to it; never invent a row after the queue is complete.
- Prefer a brief, properly formatted `docs/HANDOFF.md` plus an inline kickoff prompt for the next agent—not a chat paste dump.
- When scope authority is given, choose the option that best preserves realism, performance, and function and proceed.
- When a row kickoff says to commit on completion (or when asked to finish a completed row), commit the owned changes and present the next-phase handoff prompt.
- Ask before changing estimate-path or parity expected values; treat Coyote engagement parameters (`lethalRadiusM`, `guidanceNoiseM`, `engageTimeS`) and terminal-homing changes as protected unless explicitly authorized.
- Do not restate closed issues as open handoff work (for example, run-store NaN as an export failure) unless newly evidenced.

## Learned Workspace Facts

- `docs/Plan.md` is the open design and UX polish queue (rows A to C, 2026-09-23); `docs/HANDOFF.md` selects its row and holds the position and landmines.
- `src/analysis/series.ts` is deleted; use trialSeries and mc helpers (`heldTracksOnGrid`, `liveKpisAt`, `residualOnGrid`)—do not restore `series.ts` or retired ENGINEERING_REFERENCE symbols (`withBands`, `TRACK_LADDER_STYLE`).
- Run `npm run check:silent` before each commit (CI checks added lines only); intentional matches need `// silent-ok: <reason>`; `check:silent:all` lists pre-existing tree findings that are out of lane unless owned; rules live under `scripts/silent/rules` (see docs/VERIFICATION.md).
