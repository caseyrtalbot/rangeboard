# RangeBoard: current engineering handoff

Status: CURRENT TRANSFER RECORD. Updated 2026-09-04. C1 is implemented and verified in the
working tree. Stop before C2 and before commit or push.

Marks: `[V]` source/test/tool verified; `[D]` documented intent or user direction;
`[I]` reasoned implication; `[U]` unresolved. Read [AGENTS.md](../AGENTS.md), this record,
then the [register](data-engine/outstanding.md). Source/tests outrank documents.

## 1. Scope and working tree

[D] Casey selected execution of `/private/tmp/caseytalbot-rangeboard-handoff.md`: implement
C1, complete analysis identity/result invalidation (R-F-24), verify and update records, then
stop. [PLAN.md](field-te/PLAN.md) sufficed; no new project-wide plan was needed. R-D-26
records selection and R-D-27 records bounded implementation choices.

[V] Baseline HEAD remains `8b528f2a096a64d5a3ead9c5456d29bed6bd1ad1`, branch
`analysis-hardening`, equal to local `origin/analysis-hardening` (no fetch). No commit,
push, branch, stash or schema/storage/dependency/draw-contract change was made.

[V] The incoming documentation changes remain uncommitted and retained: AGENTS.md,
README.md, the current handoff/register, historical status headers, and `docs/field-te/`.
C1 adds source/test changes listed in the completion record and updates current records.
Casey's four pre-existing untracked files remain untouched: `docs/data-engine/build_mockup.py`,
`build_mockup_te.py`, `mockup.html`, `mockup-te.html`. Do not delete, stage, overwrite or
regenerate them as cleanup. Inspect live git status before continuing.

## 2. Completed C1 and evidence

[V] `analysisBasisSignature` includes domain fields by default, removes named metadata,
resolves scenario/entity/link defaults, and shares effective spread enumeration through
pure `analysis/parameterBasis.ts`. The former uncertainty API is re-exported unchanged.
Raw specifications are conservative inputs; equivalent explicit spec overrides can still
cause recomputation. No claim of minimal invalidation is made.

[V] Worker-instance ownership prevents replaced/canceled callbacks from reaching either
slot, including repeated requests in the same playback run. Store guards require a
running slot, current playback identity and current basis. Terminal callbacks are ignored.
Both worker slots remain independent. SensitivityWidget now uses `currentSensitivity` and
hides stale rows/replicate metadata. MC estimator/interval/export semantics remain C2.

[V] Initial focused regressions reproduced nine failures. Final verification: type-check
clean; 1,222 tests in 70 files pass; lint 74 warnings, zero errors; build passes with the
existing chunk-size warning. Exact deterministic/aleatory/total/sensitivity numerical
parity passed for the preserved probe at four replicates. The temporary Vitest parity
script under `src/` was removed after use.

[V] Isolated browser, real workers, saved typed KuRFS/C2/Coyote route, total uncertainty,
30 replicates: all five material edits invalidate both results and remove sensitivity
rows; recomputation restores current results. Baseline/undo restore four deterministic
events and MC mean kills 0.9666666667, leakers 0.0333333333. Spawn-in-ring and unvalidated-model
findings remain on the baseline; this is freshness evidence, not detection validation.
The temporary browser session and development server were stopped after inspection.

[V] Full input/consumer/test matrix, file scope, decisions, evidence limits and checks:
[C1_COMPLETION.md](field-te/C1_COMPLETION.md). Captured outputs/screenshots and hashes:
[evidence manifest](field-te/evidence/c1-2026-09-04/manifest.json).
Onboarding findings/evidence remain historical, with a C1 status note.

## 3. Next step and open work

[D] Stop here. **C2 is the next implementation slice when selected**, using
[PLAN.md section C2](field-te/PLAN.md#c2-consistent-estimates-intervals-gates-and-exports).
Start with a bounded brief around R-F-25: inventory headline/chart/gate/export quantity,
unit, denominator, horizon, definedness and deterministic/MC basis. Define the MC
requirement rule before changing it. This packet does not authorize C2 implementation,
R1 extraction, later physics/UI work, commit or push.

| IDs | Remaining scope | Slice |
| --- | --- | --- |
| R-F-25 | Mixed deterministic values, MC intervals, labels and export semantics | C2 |
| R-F-26 | Malformed nested saves/imports pass shallow parsers | C3 |
| R-F-27/R-F-28 | T&E record immutability, inclusion purpose and reference enforcement | C4 |
| F-19/F-59 and related follow-ups | Existing store/engine/view cycles and worker weight | R1 |
| R-F-2/3/4/6/7/16/29 | Source reconciliation, approximation limits, spread scope and credibility | E1/E2/E3 |
| R-F-15 | Member-order pairing coverage | E3 |
| R-F-20/21/22; M-11 | Blocked-route explanation, narrow-panel clipping, stale source copy | C2/U1 and owning slices |

[D] Casey's objective remains a field C-UAS T&E application with physically defensible
models, reliable records and usable operator workflows. Existing evidence is the repository's
open-source doctrine/specifications/modeling; no independent trial dataset is available.
[U] Field hardware/OS, initial test question and representative pilot/acceptance owner remain
undecided. These do not block the next bounded correctness work. Single-operator laptop,
offline use and manual file transfer remain provisional assumptions.
