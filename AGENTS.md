# RangeBoard: working contract

Current repository instructions for both contributors. `CLAUDE.md` points here; it is not a
second engineering contract.

## Contributors and ownership

Two models work in this repository in separate sessions. Casey holds product and acceptance
decisions.

- **Astra** owns engineering: the field T&E plan as written in
  [docs/field-te/PLAN.md](docs/field-te/PLAN.md) (R1, E2, E3, T1, A1), the engine, the
  stores, persistence and the T&E record model. Paths: `src/state`, `src/playback`,
  `src/analysis`, `src/io`, `src/model`, `src/geometry`, `src/te/model`, `src/te/io`,
  `src/te/calc`, `src/te/seed`, `docs/field-te`, `docs/data-engine`.
- **Claude Fable** owns design: the locked
  [design contract](docs/design/DESIGN_CONTRACT.md), which is the U1 acceptance
  specification, and its implementation steps 2 to 14 after R1 is published. Paths:
  `src/index.css`, `src/assets`, `src/panels`, `src/canvas`, `src/charts`, `src/te/ui`,
  `docs/design`.

Design step 1 (fixed simulation tick and selector subscriptions, F1 in the contract) is
part of Astra's R1 brief and is gated by R1 parity. A change that crosses the boundary
above is requested through a register row, not made in the other owner's paths. No two
sessions hold uncommitted edits in the same file; read `git status --short` first and stop
if the other owner's paths are dirty. Both owners follow every rule below, update only
their own block of the current handoff plus its shared header, and use the register as the
single status authority.

## Start with the selected task

1. Read [the current handoff](docs/AI_HANDOFF.md) and the relevant rows in
   [the register](docs/data-engine/outstanding.md). Inspect `git status --short` and
   `git log origin/<branch>..HEAD --oneline` before editing.
2. State the bounded outcome, owned paths, evidence needed and stop condition. Follow the
   user's current instruction; a proposed plan or next-task recommendation is not execution
   authority for every slice. Carry authorized work through verification without repeatedly
   asking permission for routine, reversible steps.
3. Read the relevant source and tests, then the applicable sections of
   [ENGINEERING_REFERENCE.md](docs/ENGINEERING_REFERENCE.md). That reference contains the
   detailed technical contract; moving it out of this file does not make it optional.
4. Reuse existing evidence and narrow searches. Do not restart a completed audit, reopen
   resolved decisions or expand into adjacent cleanup. Ask only for a missing decision that
   materially changes scope or correctness; continue independent work while waiting.

For claims about implementation, trust source/tests/tool output, then git, this contract,
current handoff/register, historical specifications, and finally conversation memory.
Distinguish required behavior from a verified implementation; record known gaps explicitly.

## Product and boundaries

RangeBoard is a local-first, single-user C-UAS test and evaluation planning web app.
React, TypeScript, react-konva, zustand, recharts, vitest and oxlint are the existing stack.
Persistence is localStorage. Board owns `Scenario`; T&E Ops owns a separate campaign store.
There is no backend, server deployment or CI pipeline in this repository.

Model results support test design. Keep sourced values, planning factors, assumptions,
model fidelity and run validity traceable. Every estimate must carry the matching uncertainty,
quantity, units, denominator and horizon; deterministic outputs are the planning envelope.
Undefined results stay unavailable. Do not invent missing values, calibration, validation,
thresholds or probabilities of meeting a requirement. Keep illustrative campaigns labeled.

## Invariants to protect

- Coordinates are meters: +x east, +y south; heading 0 north, clockwise. Camera scale is
  pixels per meter. Use the resolvers in `src/geometry/geo.ts` and the engineering reference.
- Scenario mutations use `mutate`; derived analysis, playback positions and view state do
  not enter scenario history. Preserve undo/redo behavior and the observed-preset exception.
- Preserve analysis-basis freshness, worker request identity and rejection of stale or late
  callbacks. MC and sensitivity results are derived, unpersisted state.
- Preserve schema version, storage keys, valid legacy defaults and user edits. Validate
  unknown imported/saved data before adoption. Failed recovery must preserve the sole raw
  copy and suppress autosave. Generated schema descriptors must match domain types.
- Keep the five DrawPolicy draw sites, keyed randomness, DT, CRN pairing, raid partition,
  arrival/CPA distinction and expenditure channels. No `Math.random` under `src/`.
- Read the module-cycle rules before moving imports. `store.ts` must not value-import
  `mcRun.ts`, `series.ts`, `impact.ts` or `attrition.ts`; shared constants belong in leaf modules.
- Reuse existing resolvers, statistics, labels and design tokens. Do not create a second
  definition of a fact. Match a displayed statistic to its own interval; keep mean CIs and
  replicate quantiles distinct. Requirement gates use test-defined thresholds.
- T&E records have their own identity, version lineage, references and evidence-purpose
  rules. Preserve run numbering, baseline snapshots, observations and amendments. Required
  transitions are enforced by the store. Consult the live register and C4 evidence for
  verified scope and legacy limits.

Read [the reference](docs/ENGINEERING_REFERENCE.md) for precise exceptions, domain equations,
source locations, provenance/fixture rules, UI constraints and T&E contracts before touching them.

## Execute and coordinate

Keep a small task plan for multi-step work. Batch independent reads/checks; serialize edits
that share ownership or depend on earlier results. Use sub-agents only when the user or
applicable instructions authorize delegation. Give each a bounded outcome and exclusive
write paths; tell them they share the tree and must preserve others' edits. The orchestrator
owns integration, resolves overlaps, and verifies the combined result. After a parallel agent
batch, perform independent integration review before declaring the wave complete.

Keep updates concise: findings, decisions, remaining uncertainty and what the next check
resolves. Report actionable failures with evidence. Preserve task scope, agent ownership,
verification results, corrections and stop condition across compaction.

Follow existing code style: 2 spaces, no semicolons, single quotes, named exports,
`interface` for object shapes, JSDoc for exported symbols, short rationale comments, lines
around 100 characters. No formatter, new dependency, speculative abstraction, TODO marker,
or unused export. Add documentation only when requested or needed to keep an existing
contract accurate. Use short active sentences and consistent domain terminology in UI copy;
no em-dashes. Apply the reference's Konva, CSS-token, 10 px type-floor and 320 px panel rules.

## Verify the result

Use focused tests while editing. Before reporting a change complete, run the four gates
and report their actual results:

```sh
npx tsc --noEmit -p tsconfig.app.json
npx vitest run
npm run lint
npm run build
```

Add no test failure or lint warning. The latest verified counts and accepted warnings belong
in the current handoff and evidence records, not as a permanent baseline here. If only docs
change, also check links, preserve cited source artifacts and inspect the final diff. Do not
write implementation-mirroring tests for a documentation edit.

After a Board/T&E domain type change, run `node src/io/generateRuntimeSchema.mjs`, inspect
legacy compatibility and semantic validation, then run
`node src/io/generateRuntimeSchema.mjs --check`. No compiler runs in the browser.

Read [VERIFICATION.md](docs/VERIFICATION.md) for statistical fixtures, zustand static-render
setup, isolated browser checks, native imports and recovery. Static Recharts markup does not
verify rendered charts. Use a separate browser profile and real store/worker actions. Handle
confirmation dialogs before resetting dirty runs; never touch the user's autosave. Delete
only task-created scratch checks/processes after preserving necessary evidence.

## Register, documentation and git

The [register](docs/data-engine/outstanding.md) is the only decision/follow-up status authority.
Preserve existing row text and IDs. Append dated notes to status cells; add new findings or
accepted deviations with the next ID in the appropriate D/F/R-D/R-F/M sequence. Never
renumber rows or fill the intentionally absent D-58. Keep publication status in its header;
a documentation-only publication record may identify the implementation commit it follows.

Use [docs/README.md](docs/README.md) to route documents. Keep one current handoff at
`docs/AI_HANDOFF.md`: scope, revision, ownership, verified results, evidence, unresolved issues,
next exact task and authorization limits. Use `[V]` verified, `[D]` documented direction,
`[I]` inferred and `[U]` uncertain. Avoid duplicate status authorities and per-agent narrative
logs. Retire superseded dispatch/transfer documents once durable findings and procedures
are retained; git preserves history. Keep original research, cited specifications, fixtures,
source captures and evidence manifests. Mark historical instructions as historical; update
current links when removing a document. Do not treat supported save migrations as dead code.

Preserve unrelated worktree files. Touch `src/te/` only when the selected task names it.
Keep `docs/inventory/` research intact. Changes to schema version, storage keys, draw points
or raid partition require a decision row and the user's instruction. Update this contract
or its reference in the same slice as a contract change.

Commit only when requested; push only when requested. Never force-push. Do not create a
branch, merge to main or stash without instruction. Before commit/push, report unpushed
commits and worktree ownership. Stage explicit owned paths. Verify the remote after pushing;
do not imply the entire tree is clean when unowned files remain.

Finish with the result, changed paths, actual verification, material limits and stop point.
Separate completed work from recommendations; do not claim publication or browser checks
that did not happen.
