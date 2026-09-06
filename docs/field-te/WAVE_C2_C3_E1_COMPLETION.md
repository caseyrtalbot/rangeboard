# C2/C3/E1 wave completion

Dated record, verified 2026-09-05 at baseline `d8a76f1`, published as `798380d`. Source
and tests decide current behaviour. C2 (result consistency) and C3 (runtime validation)
were implemented and verified; E1 delivered the model evidence baseline. The retained
[C2 record](wave-c2-c3-e1/C2_RESULT.md), [C3 record](wave-c2-c3-e1/C3_RESULT.md) and
[independent review](wave-c2-c3-e1/INDEPENDENT_REVIEW.md) record the completed work.

## Scope and result

C2 aligns result means with their own intervals, units, denominator and horizon.
Percentage intervals scale with the percentage value. Missing estimates stay unavailable;
single samples carry no claimed mean CI. Quantile bands, conditional times and
deterministic-only quantities have distinct labels. Requirements keep their test-defined
deterministic rule and complete envelope validity; no probability of meeting a gate is
inferred from a mean CI. Run exports keep deterministic values and carry per-group basis,
validity and quantity semantics, configuration equality identity and explicit
mixed-package scope. Sensitivity names paired parameter endpoints; no-asset leakers stay
undefined. Basis and interval copy wraps at 320 px.
[Measure matrix](wave-c2-c3-e1/C2_MATRIX.md).

C3 validates unknown scenario, library and campaign JSON, autosaves and embedded Board
snapshots before adoption: nested shapes, finite and ranged inputs, enums, references,
reserved ids, native image syntax and engine representability. Supported missing legacy
defaults and legitimate edits survive. Read denial or a failed recovery copy suppresses
autosave and preserves the sole raw record. New underlay image admission has a storage
budget; existing valid large images still load.

E1 delivers seven model-family dossiers plus an uncertainty crosswalk, a 90-model,
205-row seed snapshot, a 27-artifact historical inventory and seven preserved
primary-source originals. Calibration, published comparison and independent validation
stay distinct. Evidence gaps at capture: radar configuration and quantity mismatches,
infeasible capped intercepts, jam slant versus horizontal response, uncertain vendor-count
applicability. No physics, seed, provenance or fidelity tag changed.
[Evidence index](model-evidence/README.md).

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npx vitest run` | 1,327 tests in 76 files pass |
| `npm run lint` | exit 0; 74 warnings, no added warning or error |
| `npm run build` | exit 0; existing chunk-size warning |
| `node src/io/generateRuntimeSchema.mjs --check` | exit 0 |
| Numerical parity | exact deterministic assessments and report, seeded aleatory and total MC and sensitivity match the pre-edit four-replicate capture |
| Independent review | four confirmed findings corrected and rechecked; final PASS |
| E1 artifact QA | 134 local links and anchors checked; seven original capture hashes and historical preservation checks pass; review matched all 33 manifest artifact hashes |

The independent review corrected triangular-offset validation, reserved-id data loss,
malformed image padding, and total-MC versus envelope requirement validity. The parity
test ran as a scratch file under `src/playback/` and was removed before the final gates;
its text and outputs are retained in the evidence. No test was weakened to fit a model
change.

Isolated Chromium browser with real stores and workers, total uncertainty, 30 replicates,
typed KuRFS/C2/Coyote probe: four deterministic events; MC kills 0.9666666667 and leakers
0.0333333333; rendered Defeat 96.7% and its percentage-point mean CI match that statistic.
Three chart lines and six quantile-band paths rendered. Edit hides stale estimates; undo
and recompute restore the exact means. No tested panel overflow or text below 10 px. The
projection popover reads the changed 23% threshold and explains envelope gates and
fire-control routing. The native debrief download has matching group metadata and a
re-importable embedded scenario.

Browser recovery: valid legacy Board and illustrative T&E saves load without recovery;
malformed records do not enter the stores and both raw copies are exact; denied recovery
followed by edits preserves both original live keys and shows the save failure. The
native file chooser rejects an invalid scenario without altering the store, loads a PNG
through FileReader and Image, and imports a valid negative-offset triangular library row.
Captured page exceptions: zero.

Exact outputs, browser JSON, inspected PNGs, scripts and hashes are in the
[evidence manifest](evidence/wave-c2-c3-e1-2026-09-05/manifest.json). The probe's
spawn-in-ring and unvalidated-model findings remain; it verifies integration and
freshness, not detection or operational effectiveness.

## Limits at capture

At capture a representable run could still be too large for responsive execution; the
worker budget in the engineering reference addresses that. Recovery is not a crash
journal or a cross-tab durability guarantee. E1 supplied no independent trial dataset, new model acceptance threshold or physical
correction. The jam distance-convention mismatch was confirmed and recorded in the
dossiers.
