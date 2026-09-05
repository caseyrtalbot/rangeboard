# RangeBoard: current engineering handoff

Status: CURRENT TRANSFER RECORD, 2026-09-05. Contributor: Claude Fable 5.1, for the
engineering plan and the design contract. Verified source revision `edb0da7` on
`analysis-hardening`; this transfer is committed as `2b834fa` and `dc10895`. The F1 brief
of 2026-09-05 (later) is committed as `70a71f3`; this hash-recording commit follows it, and
Casey authorized the push of all of them to `origin/analysis-hardening` on 2026-09-05. It follows Astra's R1 first-extraction commit
`7c9b577` and pilot-decision record `edb0da7`, and replaces the two-owner handoff (R-D-34).

Marks: `[V]` verified; `[D]` documented direction; `[I]` inference; `[U]` unresolved.
Read [AGENTS.md](../AGENTS.md), this record, the [register](data-engine/outstanding.md),
the [design contract](design/DESIGN_CONTRACT.md) and, for engine work,
[PLAN.md](field-te/PLAN.md). Source and tests outrank documents.

## Scope and ownership

[D] Casey transferred all remaining work to Claude Fable on 2026-09-05 (R-D-34): the rest
of R1, E2, E3, R-F-30, R-F-31, T1, A1, and design steps 1 to 14. One contributor, one
handoff block. Astra's slices C1 to C4, E1 and the first R1 extraction are history with
their own records. A second session, if ever started, takes a separate branch.

[V] `git log` at transfer: `edb0da7 docs: record pilot decisions and refresh handoff
status`, `7c9b577 refactor: extract R1 scenario helpers and ring constants`,
`74eb94d docs: lock the design contract and split ownership between Astra and Fable`,
`9e1c5e2 docs: record verified C4 publication`. `git log origin/analysis-hardening..HEAD`
shows the first three. No push is authorized.

[V] Working tree at transfer: clean except one untracked entry, `.claude/`, which holds
local tool configuration and stays untracked. The four untracked data-engine mockup files
(`build_mockup.py`, `build_mockup_te.py`, `mockup.html`, `mockup-te.html`), an earlier IBM
Plex mockup superseded by the design contract, were deleted on Casey's instruction on
2026-09-05. They were never in git.

[V] Documentation paths changed by this session, committed as `2b834fa`: `AGENTS.md` (single
contributor section; type-floor sentence), `CLAUDE.md` (reading order; one environment
note), `docs/README.md` (AGENTS row; R1 record row), `docs/AI_HANDOFF.md`,
`docs/ENGINEERING_REFERENCE.md` (type floor and shadow bullets point at the design
contract), `docs/field-te/PLAN.md` (owner line), `docs/design/DESIGN_CONTRACT.md` (owner
line; step 1 owner; F10 and step 5 withdrawn), `docs/data-engine/outstanding.md` (row
R-D-34). No source file changed.

## Verified state

[V] Astra's gates at `edb0da7`, as recorded in
[R1_LEAF_EXTRACTION.md](field-te/R1_LEAF_EXTRACTION.md) and by Casey: type-check, 1,360
tests in 80 files, lint with the 74-warning baseline and zero errors, build with the
existing chunk warning, schema drift check. Four-replicate fixed-ID deterministic, aleatory
MC, total MC and sensitivity outputs matched exactly across the extraction. The worker graph
reaches no store, React, zustand, localStorage or panel module. Worker bundle 121.65 kB
against a 288.46 kB baseline. `model/scenario.ts` owns `modelFor`, `pathSpeed` and
`scenarioDurationS`; `state/rings.ts` owns ring keys and types; store re-exports preserve
the public UI entrypoints with a removal condition in the R1 record. This session did not
rerun the gates; its changes are documentation only.

[V] F1 baseline measured on 2026-09-05 at `dc10895`, documentation only, no source edit:
[F1_CADENCE_BRIEF.md](field-te/F1_CADENCE_BRIEF.md) with evidence under
`field-te/evidence/f1-cadence-2026-09-05/` (probe script, headless and headed render-count
JSON, console logs, screenshot, manifest with hashes). The store publishes once per animation
frame with no fixed cadence: 120 Hz headless, 85 Hz headed, about 46 Hz on the Analysis tab,
17 Hz with MC bands. `Inspector` renders 0 times per publication; `AnalysisPanel` and
`LiveStrip` render every publication through `observedThroughS` and cascade to every widget
and a double Recharts commit; the Konva root commits twice per publication. Recorded as
R-F-32 and a note on R-D-34. Committed as `70a71f3`. The dev server used for the probe was started on port 5301 and
stopped. The four gates were not rerun; no source changed.

[V] Persistence facts checked this session, which withdrew design item F10: both stores
carry `schemaVersion` 1; storage keys are versioned in `src/io/storageKeys.ts`; runtime
validation runs before adoption; an unreadable save is copied under a recovery prefix and
autosave is suppressed. Remaining durability work is T1.

[V] Field pilot decisions (R-D-33): MacBook Pro 13 or 15 inch, macOS, Retina, trackpad,
no touch, offline, one operator; Chrome checked, Safari secondary. Reference question: at
least 90 s usable warning time from the KuRFS, FAAD C2, Coyote Block 2 chain at a defended
point against a Group 3 one-way attack, at detect Pd 0.5 and track 0.9. Owner: Casey and
the company; independent-operator acceptance deferred. Product focus: simulation and
modeling design and T&E. The reference laydown is the verified firing fixture plus a
defended asset.

## Order of work

[D] Decided with Casey (R-D-34). R1 to completion first. Then design steps 2 to 4, which are
stylesheet, fonts and theme. Then E2, E3 and R-F-30, because they change what the widgets
show. Then design steps 6 to 14, so the panels present the corrected models once. Then T1
packaging. Then A1. Every slice needs its own brief and Casey's selection.

[U] R1 remaining obligations, from the R1 record: F1 cadence and selector brief with
before-and-after render counts; R-F-31 measured execution budget and cancellation policy;
larger store and sweep extractions; owned lint batches; the R-F-20 independently valid
detection fixture. E2/E3 and R-F-30 numerical changes stay serial to parity-sensitive
engine edits.

## Next exact task

[D] The F1 brief exists and stops here, as the previous record required. Casey selects
the next slice. The brief proposes the F1 implementation slice with its owned paths,
cadence rule, interpolation, selectors, parity gate and effort classes (brief sections 3
to 7). Alternatives inside R1 are the R-F-31 measured budget and cancellation policy, or a
larger store or sweep extraction. Whichever is selected needs its own brief acceptance and
Casey's instruction before the first source edit. This record is not that authorization.

[D] Before the first source edit of any slice: rerun the four gates and the schema drift
check, compare the warning count with 74, and read `git status --short`.

## Not authorized by this record

Any source edit, commit, push, schema version, storage key, draw point or raid partition
change, new dependency, or implementation of any slice or design step without its own
selection and brief.
