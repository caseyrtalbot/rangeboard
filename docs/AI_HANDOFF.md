# RangeBoard: current engineering handoff

Status: CURRENT TRANSFER RECORD, 2026-09-05. Verified source revision `9e1c5e2` on
`analysis-hardening` (C4 implementation `7f10c92`, publication record `9e1c5e2`). This
record follows the Astra publication record and changes documentation only. It is the one
handoff for both contributors. Each owner updates its own block below and this header.

Marks: `[V]` verified; `[D]` documented direction; `[I]` inference; `[U]` unresolved.
Read [AGENTS.md](../AGENTS.md) (contract and ownership by path), this record, the
[register](data-engine/outstanding.md) and, for design, the
[design contract](design/DESIGN_CONTRACT.md). Source and tests outrank documents.

## Shared state

[V] `git log` at transfer: `9e1c5e2 docs: record verified C4 publication`,
`7f10c92 fix(te): enforce record transitions and evidence inclusion`, `1b919e5`, `66db3ad`.
The remote hash for `7f10c92` was verified by Astra; this session did not push and did not
re-verify the remote.

[D] Casey split ownership by domain on 2026-09-05 (R-D-32, second note). Astra keeps the
engineering plan as written and absorbs design step 1 into R1. Claude Fable owns the locked
design contract and implements its steps 2 to 14 after R1 is published. Paths per owner are
in AGENTS.md, Contributors and ownership.

[V] Documentation paths changed by the Fable session on 2026-09-05, uncommitted:
`AGENTS.md` (title and the Contributors and ownership section), `docs/design/DESIGN_CONTRACT.md`
(new), `docs/design/concepts.html` (new), `docs/README.md`, `docs/AI_HANDOFF.md`,
`docs/field-te/PLAN.md` (status line, owner line, U1 row, section 7 status note, section 9
bullet), `docs/field-te/BACKLOG_TRIAGE.md` (dated note on the U1 row),
`docs/data-engine/outstanding.md` (row R-D-32 and its second note). `CLAUDE.md` was
restored to `HEAD` on Casey's instruction after an accidental edit. No source file changed.

[V] Not run this session: type-check, tests, lint, build, schema drift check. The last
recorded gate result is Astra's at `7f10c92`: 1,355 tests in 77 files, lint 74 warnings and
zero errors, build with the existing chunk warning. Either owner reruns the full gate before
its first source edit and compares warnings.

[U] Untracked and unowned at transfer: `.claude/settings.local.json`, `.claude/launch.json`,
`docs/data-engine/build_mockup.py`, `docs/data-engine/build_mockup_te.py`,
`docs/data-engine/mockup.html`, `docs/data-engine/mockup-te.html`. The four data-engine
files are an earlier IBM Plex mockup of the data-engine slices; they are not a design
authority and are superseded by the design contract. Casey decides whether to delete them or
commit them as historical. `.claude/` files are local tool configuration.

[D] Casey's open decision: field pilot hardware and OS, the first test question and the
pilot owner (PLAN section 9). It sets the daylight-theme surface, target size and density
default. It does not block R1.

## Astra: engineering

[D] Scope: [PLAN.md](field-te/PLAN.md) as written. R1, then E2/E3 and R-F-30 in parallel,
R-F-31 policy inside R1, T1 after the platform decision, A1 last. Design step 1 (F1: fixed
10 Hz simulation tick, canvas interpolation, selector subscriptions exposed by the store) is
part of the R1 brief and is gated by R1 parity.

[I] Next exact task: write the **R1 brief** from
[PLAN section 4](field-te/PLAN.md#4-r1-refactor-with-a-behavioral-boundary). Trace the
value-import cycles `sim.ts`, `series.ts`, `runSession.ts` to `state/store`; choose one
bounded leaf-module extraction; include F1. Acceptance: deterministic and seeded MC parity on
fixed IDs; no draw-key, DT, boundary-time, partition, expenditure or persistence change; a
before-and-after render count per tick on a named fixture; the store's public selectors
listed for the design owner. Wait for Casey's selection. This is not authorization.

[U] Unresolved in this scope: R-F-31 execution budget (policy here, control in design step
6); R-F-20 independently valid detection fixture (E1/R1; the panel explanation is design step
7); E2/E3 model and uncertainty evidence; R-F-30 jam geometry; T1 packaging; F10 versioned
persistence needs a decision row for the schema version and Casey's instruction before it
is built, and it precedes the design panel steps.

## Claude Fable: design

[D] Scope: the [design contract](design/DESIGN_CONTRACT.md), steps 2 to 14, in order,
each with its own brief and Casey's selection. Step 2 (type floor, self-hosted fonts) and
step 3 (surface rules, one kit) begin only after R1 is published on the remote and no
session holds uncommitted edits under `src/panels`, `src/canvas`, `src/charts`, `src/te/ui`
or `src/index.css`.

[I] Next exact task, when R1 is published: write the **step 2 brief**. Owned paths:
`src/index.css`, `src/assets`. Replace every `font-size` rule below 11 px with the label
role; move headings from mono caps to sans sentence case; self-host Archivo 400/500 and
JetBrains Mono 400/500 under `src/assets` the way IBM Plex is hosted today, and remove the
IBM Plex packages only after no consumer remains. Acceptance: `git grep` shows zero
`font-size` rules below 11 px; contrast measured on actual surfaces; 320 px and 200 percent
zoom inspection; screenshots of every panel; full gate with no new warning. Before R1 lands,
the design owner may only prepare briefs and browser check scripts. This is not
authorization.

[U] Design items that wait on Astra: the cancel control (R-F-31) needs the worker budget
API; the blocked-route row (R-F-20) needs `ThreatStatus` exposed to a panel; the daylight
theme (step 4) needs the platform decision for its acceptance surface.

## Not authorized by this record

Any source edit, commit, push, schema version, storage key, draw point or raid partition
change, new dependency, edit inside the other owner's paths, or implementation of any slice
or design step without its own selection and brief.
