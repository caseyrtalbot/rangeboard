# RangeBoard: current engineering handoff

Status: CURRENT TRANSFER RECORD, 2026-09-05. R1 first leaf extraction verified against
`74eb94d` on `analysis-hardening`. C4 remains published as `7f10c92` with publication
record `9e1c5e2`. R1 as a whole is not complete or published. Casey authorized this first
extraction commit on 2026-09-05; no push is authorized. This is the one handoff for both
contributors; each owner updates its own block below and this header.

Marks: `[V]` verified; `[D]` documented direction; `[I]` inference; `[U]` unresolved.
Read [AGENTS.md](../AGENTS.md) (contract and ownership by path), this record, the
[register](data-engine/outstanding.md) and, for design, the
[design contract](design/DESIGN_CONTRACT.md). Source and tests outrank documents.

## Shared state

[V] Pre-commit HEAD was `74eb94d docs: lock the design contract and split ownership
between Astra and Fable`, one commit ahead of the origin tracking ref. Casey subsequently
authorized this R1 commit. This session did not fetch or push. The prior C4 remote
verification remains historical evidence.

[D] Casey split ownership by domain on 2026-09-05 (R-D-32, second note). Astra keeps the
engineering plan as written and absorbs design step 1 into R1. Claude Fable owns the locked
design contract and implements its steps 2 to 14 after R1 is published. Paths per owner are
in AGENTS.md, Contributors and ownership.

[V] Documentation paths committed by the Fable session as `74eb94d` on 2026-09-05:
`AGENTS.md` (title and the Contributors and ownership section), `docs/design/DESIGN_CONTRACT.md`
(new), `docs/design/concepts.html` (new), `docs/README.md`, `docs/AI_HANDOFF.md`,
`docs/field-te/PLAN.md` (status line, owner line, U1 row, section 7 status note, section 9
bullet), `docs/field-te/BACKLOG_TRIAGE.md` (dated note on the U1 row),
`docs/data-engine/outstanding.md` (row R-D-32 and its second note). `CLAUDE.md` was
restored to `HEAD` on Casey's instruction after an accidental edit. No source file changed.

[V] R1 extraction gates: type-check, 1,360 tests in 80 files, lint with the identical
74-warning baseline and zero errors, build with the existing chunk warning, schema drift
check. Exact deterministic/seeded numerical parity and real-browser worker checks pass.
See [R1 brief and evidence](field-te/R1_LEAF_EXTRACTION.md). The incoming baseline was
1,355 tests in 77 files with the same warnings. The other session's pilot-decision edits
in this shared header, the register and PLAN section 9 are preserved in the working tree
and excluded from this R1 commit.

[U] Untracked and unowned at transfer: `.claude/settings.local.json`, `.claude/launch.json`,
`docs/data-engine/build_mockup.py`, `docs/data-engine/build_mockup_te.py`,
`docs/data-engine/mockup.html`, `docs/data-engine/mockup-te.html`. The four data-engine
files are an earlier IBM Plex mockup of the data-engine slices; they are not a design
authority and are superseded by the design contract. Casey decides whether to delete them or
commit them as historical. `.claude/` files are local tool configuration.

[D] The other session's pilot-decision record is pending a separate commit; its working-tree
edits are preserved. This R1 extraction does not implement or alter pilot requirements.

## Astra: engineering

[V] Casey selected the first R1 extraction through the supplied entry handoff on
2026-09-05. `model/scenario.ts` owns the unchanged `modelFor`, `pathSpeed` and
`scenarioDurationS`; `state/rings.ts` owns ring keys/types. Engine, validation and view-state
consumers now use these leaves. Store re-exports preserve public UI entrypoints. No source
under Fable ownership or `src/te` changed. The full owned-path list, temporary compatibility
surface/removal condition and verification are in [the R1 brief](field-te/R1_LEAF_EXTRACTION.md).

[V] The worker graph reaches no store, React, zustand, localStorage or panel module;
`runSession.ts` remains a main-thread store adapter. Existing chart tokens still enter
through `series.ts`. The worker bundle is 121.65 kB (baseline 288.46 kB); this is size
measurement, not runtime or render profiling. Four-replicate fixed-ID deterministic,
aleatory MC, total MC and sensitivity outputs match exactly. Isolated browser MC,
sensitivity and a fresh independent module worker match direct engine results, with
four deterministic events, 13 sensitivity rows and no page exceptions. The fixture is
integration evidence only. All final gates pass as recorded in the shared header.

[D] Stop: this first extraction is verified and included in this user-authorized commit;
all of R1 is not complete. No push, F1 UI implementation, budget implementation, E2/E3,
jam geometry, F10 or design steps 2 to 14 are authorized.

[I] Next exact task: write the bounded F1 cadence/selector brief and capture baseline
render counts on a named fixed fixture for TimelineBar, Inspector and named canvas
consumers. Resolve exact cross-owner paths via R-D-32 before edits. Define the proposed
10 Hz as wall-clock playback store publication cadence, including behavior at every
playback speed, while preserving engine `DT = 0.5 s` and event horizons. Stop after the
measured brief and ownership/cadence agreement. This recommendation is not execution
authority for the UI changes.

[U] Remaining R1 obligations: F1 before/after profiling and selector API, R-F-31 measured
execution-budget/cancellation policy, larger store/sweep extractions, owned lint batches
and the R-F-20 independently valid detection fixture. E2/E3 and R-F-30 numerical changes
stay serial to parity-sensitive engine edits. Existing C3 already supplies schema version 1,
validation, compatibility defaults, recovery copies and autosave suppression; F10's
claimed absence is incorrect. Reconcile a concrete persistence gap and ownership before
selecting a follow-on. Pilot decisions remain in the other session's uncommitted R-D-33 and PLAN edits, outside
this R1 commit.

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
