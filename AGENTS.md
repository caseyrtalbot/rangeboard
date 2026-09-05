# RangeBoard: engineering contract

RangeBoard is a local-first, single-user C-UAS test and evaluation planning web app: React,
TypeScript, react-konva, zustand, recharts, vitest, oxlint, Vite. Persistence is
localStorage. Board owns `Scenario`; T&E Ops owns a separate campaign store. No backend, no
server, no CI. Model results support test design: every estimate carries its uncertainty,
quantity, units, denominator and horizon; undefined results stay unavailable; nothing is
invented to fill a gap. `CLAUDE.md` holds tool-environment notes only.

## How work runs

- One contributor, Claude Fable, with standing authorization for everything outside the
  hard exceptions below. Casey holds product decisions and those exceptions. Take the next
  item from [the handoff](docs/AI_HANDOFF.md), do it end to end, verify, commit, move on.
  Do not stop to ask permission for reversible work. Ask only when a decision materially
  changes scope or correctness and the input exists only with Casey; continue other work
  while waiting.
- Read before starting: this file and the handoff. Then read only the source, tests,
  reference sections and register rows the item touches. Specs are consulted by section,
  not read cover to cover.
- Trust order for any claim: source, tests and tool output; git; this contract; the
  handoff and register; the specs; memory. Verify before you recommend.
- Measure before you design. A claim about runtime behavior (render cost, cadence, worker
  time) gets a measurement on a named fixture before it drives a change. The F1 brief is the
  template: the contract's Inspector claim was wrong until measured.
- Deliver the item as scoped. Record adjacent problems as register follow-ups; do not fix
  them in passing unless the fix is one line and in an owned file. Fix a wrong sentence in a
  document when you find it.
- Subagents only when write paths are disjoint and wall-clock time matters. The session
  integrates, runs the gates on the combined tree and owns the records. One model by
  default; escalate effort only after a failed gate or on engine semantics.

## Hard exceptions: Casey's explicit word, each time

Schema version or storage key. Draw sites, keyed randomness, `DT`, CRN pairing or raid
partition. A new dependency. Removing a supported save migration. Any change to numerical
outputs that is not an E2/E3 item declared with a before-and-after capture. Force-push,
branch creation, merge to `main`, deleting remote resources, touching the user's autosave.

## Invariants

- Coordinates are meters: +x east, +y south; heading 0 north, clockwise. Camera scale is
  pixels per meter. Use the resolvers in `src/geometry/geo.ts`.
- Scenario mutations go through `mutate`. Derived analysis, playback positions and view state
  never enter scenario history. Preserve undo/redo and the observed-preset exception.
- Analysis-basis freshness, worker request identity and rejection of stale callbacks stay.
  MC and sensitivity results are derived, unpersisted state.
- Runtime validation before adopting saved or imported data. Failed recovery keeps the sole
  raw copy and suppresses autosave. Generated schema descriptors match domain types.
- `DrawPolicy` is the one draw point. No `Math.random` under `src/`. Arrival and CPA stay
  distinct; expenditure channels stay separate.
- `store.ts` never value-imports `mcRun.ts`, `series.ts`, `impact.ts` or `attrition.ts`.
  The worker graph reaches no store, React, zustand, localStorage or panel module.
- One definition per fact: reuse resolvers, statistics, labels and design tokens. A displayed
  statistic uses its own interval; mean CIs and replicate quantiles stay distinct.
- T&E records keep identity, version lineage, run numbering, baseline snapshots, observations
  and amendments; required transitions are enforced by the store.

Details, equations and source locations: [ENGINEERING_REFERENCE.md](docs/ENGINEERING_REFERENCE.md).

## Quality gates

Before a commit that touches source, all four pass with no new failure or warning:

```sh
npx tsc --noEmit -p tsconfig.app.json
npx vitest run
npm run lint
npm run build
```

After a domain type change: `node src/io/generateRuntimeSchema.mjs` then `--check`.
A refactor of engine, store or playback code proves fixed-ID parity against the current
numerical baseline (deterministic, aleatory MC, total MC, sensitivity) and names the fixture.
A UI change gets a browser check with real store actions ([VERIFICATION.md](docs/VERIFICATION.md));
static Recharts markup proves nothing about a chart. A statistical test asserts within 3
standard errors of an analytic value named in a comment. Add tests where the repo tests that
kind of change, sized like their neighbors; no tests that mirror a documentation edit.

## Code

2 spaces, no semicolons, single quotes, named exports, `interface` for object shapes, JSDoc
on exported symbols, short rationale comments, lines near 100 characters. No formatter, no
speculative abstraction, no TODO markers, no unused exports. UI copy in short active
sentences with the domain's terms, no em-dashes. Konva, CSS-token and 320 px panel rules
are in the reference; type floor and tokens follow the [design contract](docs/design/DESIGN_CONTRACT.md).

## Records

- Status authority is the code, the tests and git. Documents describe; they do not decide.
- [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) is the one handoff, at most forty lines, with
  these headings in this order and nothing else: Revision (branch, hash, remote state,
  tree); Verified (gates and their revision, parity baseline path, measured facts with
  their register IDs); Next (the ordered work); Inputs Casey holds (blocking inputs, and
  defaults taken); Open findings (register IDs, one line each). Rewrite it whole at every
  commit that changes state; never append, never add a section, never create a second
  handoff, brief record or completion narrative for a slice. Superseded text lives in git.
- [The register](docs/data-engine/outstanding.md) holds decisions Casey holds and open
  findings. Append rows with the next ID and dated status notes; closed rows are history.
  Never renumber; D-58 stays absent.
- Evidence is kept only where it proves something later work depends on: numerical
  baselines and parity captures, browser screenshots, measurement JSON, and the script that
  produced them, under `docs/field-te/evidence/<slice>-<date>/`. No hashes of logs, no
  manifests for documentation edits, no completion narratives. The commit message and the
  handoff are the record.
- Specs ([PLAN.md](docs/field-te/PLAN.md), the design contract, the reference): change the
  sentence that changed, in the same commit as the code. Historical records keep their
  status header and are not maintained.

## Git

Commit at each verified stopping point with a conventional message and no attribution
lines. Stage explicit paths; `.claude/` stays untracked. Push when the gates pass and
report the remote hash. Never force-push. Report unpushed commits at the end of a session.
