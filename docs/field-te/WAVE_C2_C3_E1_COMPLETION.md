# C2/C3/E1 wave completion

Verified 2026-09-05 in the working tree on `analysis-hardening`, baseline `d8a76f1`.
C2 and C3 are implemented and verified; E1's qualified evidence baseline is complete.
Casey subsequently authorized commit, push and handoff on 2026-09-05. The wave is
published as `798380d` to `origin/analysis-hardening` (remote hash verified); this
publication-record commit follows it. The manifest's `committed: false` and `pushed: false`
retain the original pre-publication verification snapshot. All source/evidence hashes matched
and type-check, 1,327 tests, lint, build and schema checks passed again before publication.
The five incoming user files remain unchanged. A later
untracked `.claude/launch.json` is preserved as an unowned change.

## Scope and result

Casey requested the fresh orchestrator packet `/private/tmp/caseytalbot-rangeboard-parallel-handoff.md`.
Three workers owned C2 result consumers, C3 persistence, and E1 new evidence dossiers.
The parent integrated shared export changes after C3 relinquished persistence. The retained
[C2 record](wave-c2-c3-e1/C2_RESULT.md), [C3 record](wave-c2-c3-e1/C3_RESULT.md), and
[independent review](wave-c2-c3-e1/INDEPENDENT_REVIEW.md) record the completed work.
Expired dispatch briefs were removed during the subsequent documentation hygiene pass;
the original packet remains in git at `66db3ad`. R-D-28 to R-D-30
record selection and bounded decisions; R-F-25/R-F-26 close for this verified scope.

C2 aligns result means with their own intervals, units, denominator and horizon. Percentage
intervals scale with the percentage value. Missing estimates remain unavailable; single
samples carry no claimed mean CI. Quantile bands, conditional times and deterministic-only
quantities have distinct labels. Requirements retain their test-defined deterministic rule
and complete envelope validity. No probability of meeting a gate is inferred from a mean CI.
Run exports retain deterministic values and carry per-group basis/validity/quantity semantics,
configuration equality identity and explicit mixed-package scope. Sensitivity names paired
parameter endpoints; no-asset leakers remain undefined. Basis/interval copy wraps at 320 px.
[Measure matrix](wave-c2-c3-e1/C2_MATRIX.md), [lane record](wave-c2-c3-e1/C2_RESULT.md).

C3 validates unknown scenario/library/campaign JSON, autosaves and embedded Board snapshots
before adoption. It covers nested shapes, finite/ranged inputs, enums, references, reserved
IDs, native image syntax and engine representability. Supported missing legacy defaults and
legitimate edits remain. Read denial or failed recovery copy/readback suppresses autosave,
preserving the sole raw unreadable record. New underlay image admission has a conservative
storage budget; existing valid large images remain loadable. [Lane record](wave-c2-c3-e1/C3_RESULT.md).

E1 delivers seven model-family dossiers plus an uncertainty crosswalk, a 90-model/205-row
seed snapshot, 27 historical-artifact inventory and seven preserved primary-source originals.
Calibration, published comparison and independent validation remain distinct. Evidence gaps
include radar configuration/quantity mismatches, infeasible capped intercepts, jam slant versus
horizontal response, and uncertain vendor-count applicability. No physics, seed, provenance
or fidelity tag was changed. [Evidence index](model-evidence/README.md).

## Verification

| Check | Actual result |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npx vitest run` | 1,327 tests in 76 files pass, exit 0 |
| `npm run lint` | exit 0; 74 warnings, no added warning or error |
| `npm run build` | exit 0; existing chunk-size warning |
| `node src/io/generateRuntimeSchema.mjs --check` | exit 0 |
| Numerical parity | exact deterministic assessments/report, seeded aleatory/total MC and sensitivity match the pre-edit four-replicate capture |
| Independent review | four confirmed findings corrected and independently rechecked; final PASS |
| E1 artifact QA | 134 local links/anchors checked, seven original capture hashes and historical preservation checks pass; independent review matched all 33 manifest artifact hashes |

The independent review corrected triangular-offset validation, reserved-ID data loss,
malformed image padding, and total-MC versus envelope requirement validity. The review record
is [here](wave-c2-c3-e1/INDEPENDENT_REVIEW.md). The parity test was temporarily restored under
`src/playback/`, run and removed before final gates; its text and outputs are retained.
Initial export tests used the wrong formation field and were corrected to the actual domain
shape and immutable scenario fixture. No tests were weakened to accommodate a model change.

Isolated Chromium browser with real stores and workers: total uncertainty, 30 replicates,
typed KuRFS/C2/Coyote probe. Four deterministic events; MC kills 0.9666666667 and leakers
0.0333333333. Rendered Defeat 96.7% and its percentage-point mean CI match that statistic.
Three chart lines and six quantile-band paths rendered. Edit hides stale estimates;
undo/recompute restores the exact means. No tested panel overflow or text below 10 px;
images were visually inspected. The actual projection popover reads the changed 23% threshold
and explains envelope gates/fire-control routing. Native debrief download has matching group
metadata and a re-importable embedded scenario.

Browser recovery: valid legacy Board and illustrative T&E saves load without recovery;
malformed records do not enter stores and both raw copies are exact; denied recovery followed
by edits preserves BOTH original live keys and shows save failure. Native file chooser rejects
an invalid scenario without altering the store, loads a PNG through FileReader/Image, and
imports a valid negative-offset triangular library row. Captured page exceptions: zero.
The initial browser harness paused instead of completing a run, then was corrected to call
`completeRun`; an import harness was interrupted by Vite reload during the last source fix,
then repeated through native chooser commands on the stable tree. These were harness issues.

Exact outputs, browser JSON, inspected PNGs, scripts and hashes are in the
[evidence manifest](evidence/wave-c2-c3-e1-2026-09-05/manifest.json).
The probe's spawn-in-ring/unvalidated-model findings remain; it verifies integration and
freshness, not independent detection or operational effectiveness.

## Limits and stop

R-F-31 retains the practical work-budget question: representable runs can still be too large
for responsive execution. Recovery is not a crash journal or cross-tab durability guarantee.
C4 still owns internal issued-record immutability, transition checks and purpose-aware evidence
inclusion. E1 supplies no independent trial dataset, new model acceptance threshold or physical
correction. Source-description gaps and E2/E3 studies remain in the register; R-F-30 records
the confirmed jam distance-convention mismatch. General narrow-panel cleanup remains U1.

Stop after this wave. Recommended next bounded task: C4 for R-F-27/R-F-28, starting with the
issued-card mutation and finalized-reference/inclusion contract, with store-level regressions
and a campaign walkthrough. It requires Casey's next selection. No C4/R1/E2/E3/T1/U1/A1 work
or publication has been started.
