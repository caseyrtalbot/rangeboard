# C3 — Runtime validation and recovery

Implemented for R-F-26, 2026-09-05. Parent owns integrated gates/browser evidence and the
final register disposition. No store transitions, schema/key changes, export payload changes,
new dependencies, engine equations or draw changes were made in this lane.

## Boundaries and implementation

- Board autosave and scenario JSON import now validate the same unknown payload before
  filling/adoption. Library JSON validates every model before merge. New underlay-image
  ingestion validates the data URL, handles read/decode errors, and checks its size before
  FileReader/base64 allocation. T&E autosave and campaign JSON import share campaign
  validation. A non-null `configs[].scenarioSnapshot` is parsed/validated as Board JSON.
- `runtimeSchema.ts` describes all reachable Board/T&E domain shapes: collections, required
  records, nullable/optional fields, enum literals, tuple lengths and finite numbers.
  `generateRuntimeSchema.mjs` builds this checked-in artifact with the existing TypeScript
  devDependency; no compiler runs in the browser. Regenerate after domain shape changes;
  `node src/io/generateRuntimeSchema.mjs --check` detects descriptor drift.
- `runtimeValidation.ts`, `validateScenario.ts` and `te/io/validateTe.ts` add semantic ranges,
  collection-scoped ID uniqueness, Board model-kind/reference checks, preset link-index
  bounds and campaign-local references. Draft blank selectors remain allowed. Run/card
  version mismatches are rejected. This is import integrity, not C4 transition enforcement.
- Board geometry/path checks reject nonfinite resolved durations, unrepresentable squared
  coordinate differences, and DT sample counts beyond JavaScript's array-length limit.
  Replicate/formation/scan array dimensions use that representation limit; numeric counters
  require safe integers. No arbitrary campaign/record count was introduced.
- File errors retain the offending path/reason. Read-denied storage immediately marks
  autosave paused. Empty-string, partial, malformed and unsupported saves are unreadable
  records, rather than silently treated as absent.
- Recovery copies use collision-safe names under the existing recovery prefixes and verify
  exact readback. Failed writes/readback preserve the original live raw value and block
  subsequent debounced/pagehide/visibility autosaves. The notice explains the failed copy
  and tells the user to export current work, free storage and reload. A successful later
  startup load (or absent live key) clears the in-memory suppression. LocalStorage setItem
  is the existing atomic write boundary; interrupted pending edits flush synchronously on
  pagehide/hidden visibility, and failed quota writes do not claim a new saved time.

Actual external-domain import inventory is scenario JSON, library JSON, underlay image,
T&E campaign JSON, plus their autosaves and the embedded serialized Board snapshot.
View-state JSON readers remain separate sanitizers. AAR/run-record exports have no inbound
file import UI and were preserved for parent C2 integration.

## Compatibility decisions

- Missing supported legacy containers/default fields fill from existing factories; a
  present malformed value fails. Board required core arrays remain required. T&E record
  arrays and individual record fields are not fabricated to repair partial evidence.
- Existing engageOn/ROE and pre-launch-policy doctrine migrations remain. Seed merge,
  edited seed values/provenance, deletedSeedIds and null entity model references remain.
  Preset components may reference a deleted model because the existing drop action skips
  missing components. That intentional deletion contract is not treated as corruption.
- Unknown extension fields survive. External Board entity/model links and campaign ancestry
  are not required to resolve inside an imported campaign. Historical AAR entity IDs are
  snapshots rather than live references. Draft blank foreign-key fields remain unresolved.
- An intentionally empty evidence-package sections array is now preserved, rather than
  replacing the user's package with defaults. A missing package still gets the default.
- NEW underlay images use a conservative 5 MiB browser-storage admission budget, counting
  two bytes per data-URL code unit and base64 expansion before reading the file. This is
  explicitly a new-ingestion budget; quotas vary and other saved data consume space.
  Existing valid embedded images over that budget remain loadable/exportable; storage
  quota failure is surfaced. Invalid image data URLs/base64 are rejected. No image is
  recompressed, deleted or silently truncated.

## Focused evidence

- Reproduced Board `entities:null` and T&E `cards:null` failures in permanent regression
  tests, alongside wrong nested enums/types, missing records, invalid observations, duplicate
  IDs, missing references, incompatible models, unsafe numeric/duration dimensions,
  malformed snapshots and invalid library imports.
- Populated Board compatibility cases and both a populated draft and the complete
  illustrative `buildJiatf401()` campaign round-trip. Legacy defaults, edits, deleted seeds,
  model-less entities, external provenance and oversized existing image preservation pass.
- Recovery tests exercise denied reads, quota failures, empty/partial raw records, same-ms
  copy collisions, truncated recovery readback, subsequent overwrite suppression in BOTH
  stores, visibility/pagehide flushing, and retention of the prior valid save on quota failure.
- `npx vitest run src/io/runtimeValidation.test.ts src/io/recovery.test.ts
  src/te/io/persistTe.test.ts src/io/persist.test.ts`: **129 tests / 4 files passed** after independent review corrections.
  Existing T&E persistence tests did not exist; `src/te/io/persistTe.test.ts` is new.
- `node src/io/generateRuntimeSchema.mjs --check`: passed.
- Focused oxlint of changed production/test helpers: passed, no diagnostics.
- Final `npx tsc --noEmit -p tsconfig.app.json`: passed (see parent integration rerun).
  An initial test-only Node ambient reference caused an unrelated existing expected-error
  directive to become unused; removed that ambient reference/test subprocess and reran.
  Existing app TypeScript configuration and the unrelated test were preserved.

## Independent review corrections

The parent/verifier found three compatibility/input defects after the first lane gate.
All are corrected: triangular spreads use fractional offsets around zero (valid negative
and zero lower bounds), reserved Object.prototype identifier keys are rejected before
object-backed engine maps lose records, and image base64 padding follows native decoder
acceptance including valid unpadded tails and ASCII whitespace. Added 32 regressions;
129 focused persistence tests pass. Native browser library import verifies a valid
`lo:-0.2, hi:0.3` spread, and native PNG decoding passes. No source equation changed.

## Residual limits and handover

Practical time/memory budgets for large but representable runs are not specified by the
product. Representation bounds prevent mathematical/array-size failures; they do not
promise a responsive run at billions of replicates/samples/members. A per-run work budget
or cancellation architecture is a later bounded policy/performance task. Existing large
images can still exceed available quota; export remains available. Actual native image
render/decode and browser lifecycle behavior require the parent's browser probe.

LocalStorage offers no crash journal, cross-tab coordination or guarantee that an OS/browser
kill dispatches lifecycle events; a kill before the debounce/flush can lose the latest
unsaved edit. This lane preserves existing successful writes and failed-recovery raw data;
it does not claim T1 offline/crash durability. Recovery suppression is per live page and is
re-established on reload from the unreadable record.

C4 remains necessary: unrestricted internal store mutations can still create invalid or
orphaned evidence records; this lane rejects such records at external persistence/import
boundaries and preserves rejected raw autosaves. It does not make those mutations legal or
repair missing evidence. Generated descriptors require regeneration/review on type changes;
range/reference policies require separate maintenance when semantics change.

**Persistence ownership returned to the parent.** Parent may now integrate C2 export changes
in `src/io/persist.ts` and `persist.test.ts`; all C3 files are available for integration and
independent review. Browser/full-suite acceptance and final R-F-26 closure belong to parent.
