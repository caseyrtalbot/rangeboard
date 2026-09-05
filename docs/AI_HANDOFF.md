# RangeBoard: current engineering handoff

Status: CURRENT TRANSFER RECORD, 2026-09-05. C2/C3/E1 wave verified and published.
The documentation hygiene and Astra-focused AGENTS.md are recorded in this commit.
Casey authorized committing the cleanup; it has not been pushed. Stop before C4.

Marks: `[V]` source/test/tool verified; `[D]` user direction/documented intent;
`[I]` reasoned implication; `[U]` unresolved. Read [AGENTS.md](../AGENTS.md), this record,
then the [register](data-engine/outstanding.md). Source/tests outrank documents.

## 1. Scope and working tree

[D] Casey requested execution of the fresh orchestrator handoff at
`/private/tmp/caseytalbot-rangeboard-parallel-handoff.md`: parallel C2 (R-F-25),
C3 (R-F-26), E1 evidence, followed by serial integration, independent review and verification.
This superseded the prior C1-only stop for those scopes only. R-D-28 to R-D-30 record choices.

[V] Branch `analysis-hardening`. C2/C3/E1 implementation `798380d787f12b5cea729aefcd9570b3f51c3f0c`
is published to `origin/analysis-hardening` (remote hash checked on 2026-09-05).
This documentation commit follows publication record `66db3ad`; C1 `002684c` and its
record `d8a76f1` remain published. The cleanup changes no source, dependency,
schema/storage key, draw-key or physics.
[V] Incoming modified `CLAUDE.md` and four untracked data-engine mockup/build files were
preserved by SHA-256 check. A later untracked `.claude/launch.json` appeared during final
QA; this task did not create/edit it and leaves it unowned and untouched. Do not stage,
repair or delete these files as cleanup. All wave
changes are identified by the [completion record](field-te/WAVE_C2_C3_E1_COMPLETION.md) and
[evidence manifest](field-te/evidence/wave-c2-c3-e1-2026-09-05/manifest.json). Recheck live status.

## 2. Completed and verified

[V] Documentation hygiene: two superseded handoffs and five completed dispatch files removed;
originals remain in git at `66db3ad`. [Document index](README.md) routes current versus
historical material. [AGENTS.md](../AGENTS.md) is the concise Astra contract; its detailed
technical rules remain in [the engineering reference](ENGINEERING_REFERENCE.md), and browser
procedures in [the verification guide](VERIFICATION.md). Source and captured evidence are
unchanged. Hygiene verification: 277 local Markdown file links and seven heading/line
anchors resolve; all 219 prior register rows and preserved hashes match. Type-check,
1,327 tests in 76 files, lint (74 existing warnings, zero errors), build (existing chunk
warning) and schema drift check pass. No browser rerun was needed for this docs-only change.
M-12 records this cleanup; C4 has not started.

[V] C2: matching estimates/mean intervals/percentage denominators; quantile versus mean-CI
labels; conditional time and no-statistic basis/definedness; deterministic requirement gates
with envelope findings; per-group run export basis/validity/quantity semantics and configuration
equality identity. Complete [measure matrix](field-te/wave-c2-c3-e1/C2_MATRIX.md).

[V] C3: runtime shape and semantic/reference checks before Board/T&E save/import adoption,
legacy default preservation, image validation and representability checks. Read denial or
failed verified recovery pauses autosave to preserve the raw key. Generated shape descriptors
must be regenerated/reviewed when domain types change. Internal T&E transitions remain C4.

[V] E1: [model evidence baseline](field-te/model-evidence/README.md), eight dossiers/crosswalk,
seven original primary captures, source/configuration/independence reconciliation. No trial
validation, seed correction or fidelity upgrade is claimed. Historical research is preserved.

[V] Final checks: type-check clean; **1,327 tests in 76 files pass**; lint **74 existing warnings,
zero errors**; build passes with the existing chunk-size warning; descriptor drift check passes.
Exact pre/post deterministic, aleatory/total MC and sensitivity parity on the fixed probe at
four replicates. Temporary parity/review probes were removed before final gates.

[V] Independent verifier PASS after four fixes: triangular-offset compatibility, reserved-ID
serialization loss, malformed base64 padding, and consistent envelope requirement validity.
Isolated browser verified real-worker means/CI units, rendered quantile charts, edit/undo
freshness, native export/import, legacy reload and failed-recovery raw preservation. No captured
page exceptions. Screenshots inspected; tested 320 px content has no overflow/type-floor failure.
Typed probe fires four events; MC mean kills 0.9666666667 and leakers 0.0333333333 at 30 total
replicates. Spawn-in-ring/unvalidated-model findings limit this to integration evidence.

## 3. Next bounded task and limits

[D] The verified wave is published. Stop. No further implementation slice is selected.
[I] Recommended next selection:
**C4 for R-F-27/R-F-28**, using [PLAN C4](field-te/PLAN.md#c4-authoritative-te-record-transitions).
Begin by defining issued-card/version immutability, finalized-reference blockers and purpose-aware
inclusion at store boundaries. Verify with direct store regressions and a complete illustrative
campaign walkthrough. Stop before R1 or additional model/UI work. This recommendation is not
implementation authorization.

[U] R-F-31: practical execution budgets/cancellation for large representable runs remain a
policy/performance question. LocalStorage recovery is not crash/cross-tab durability (T1).
C4 internal mutations can still produce invalid records; C3 rejects them on later external adoption
and preserves the raw save rather than inventing repairs.
[U] E2/E3: radar quantity/configuration/calibration limits, capped-intercept feasibility,
R-F-30 jam horizontal/slant mismatch, vendor-count applicability, sampled/fixed uncertainty
coverage and stop-rule adequacy. E1's dossiers qualify these; they do not resolve the physics.
[U] R-F-20 retains per-threat blocked-route presentation and a valid detection fixture;
general panel cleanup remains U1. Field hardware/OS, initial test question and pilot owner
remain undecided. Existing evidence includes no independent trial dataset.
