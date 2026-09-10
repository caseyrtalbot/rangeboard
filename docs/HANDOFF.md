# RangeBoard continuation status

One handoff for the calibration plan. It is rewritten in place at each phase gate of
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), from the Phase 0 gate through the Phase 4
gate. It records verified completion and the next boundary. It does not authorize a
commit, push or merge, and it never becomes a task list. Old handoffs are cancelled and
live only in Git history.

Rules for each rewrite: keep this shape, replace the content, and keep only the current
phase and the one before it. Every claim names a commit, a test or a browser check. Prose
about an unfinished lane goes in Open items, not in Completed.

## Phase status

| Phase | Gate | Merge commit | Date |
| --- | --- | --- | --- |
| 0 Data foundation | passed | gate commit on `main` after `b1493ec` (see Completed) | 2026-09-10 |
| 1 Real-mode statistics | not started | | |
| 2 Tracks and kill chain | not started | | |
| 3 Sensor and effector physics | not started | | |
| 4 Hypothesis tools | not started | | |

## Completed

Phase 0, all on `main`, nothing pushed. Base `d518e42`.

- 0.a Contract, `calib/p0-contract`, fast-forwarded as `8e9a0bc`. `libraryField.ts`,
  `runRecord.ts`, Provenance lineage keys, TrialManifest record keys with defaults,
  `sameManifest`, overrides and runs storage names. Stop condition: typecheck and the full
  suite (141 files, 1710 tests) unchanged. The manifest lives in `src/playback/trialTypes.ts`,
  so that file joined the contract set.
- 0.1 Data package, `calib/p0-data` (`8e31556`), merged `ff24472`. 90 files under
  `data/library`, schema, build and health check, generated library, golden fixture
  `src/model/__fixtures__/seedLibrary.8e9a0bc.json`. Stop condition: the parity test in
  `seedLibrary.test.ts` (generated library equals the fixture after the lineage keys are
  removed) and `npm run library:check` (90 models, 633 fields).
- 0.2 Class priors, `calib/p0-priors` (`05bdbe9`), merged `b1493ec`. Six classes with a
  prior from L1 entries only; `spreadFor(model, field, priors?)` with PF_SPREAD as the
  fallback; no caller passes priors yet. Stop condition: `classPriors.test.ts` hand
  computation for `sensor/radar/any/any detectRangeM` (n 13) and the three parity files
  unchanged.
- 0.3 Overrides and Systems tab, `calib/p0-overrides` (`97b4d26`), merged `e48b3ab`.
  Separate `useOverrides` store, autosave under `rangeboard.overrides.v1`, Systems tab.
  Stop condition: lane browser check on port 5381 (edit, storage, reload, reset, 0 page
  errors) and the gate browser check below (override in a trial manifest).
- 0.4 Run store, `calib/p0-runstore` (`943d77b`), merged `a56291c`. IndexedDB store with a
  64 MiB cap and oldest-first eviction, Save to history, history list that opens a record
  in place. Stop condition: lane browser check on port 5382 (save, reload, open) with
  `runStore.test.ts` on the in-memory fake.
- 0.c Integration, `248f4ca` and the gate commit. Overrides recorded in the trial manifest
  at launch (`trialManifestOverrides.test.ts`); every manifest comparison by value on the
  array keys; manifest record renders arrays; contract type gains the keys the package
  writes; docs updated and reviewed.

## Open items

- `npm run check:bundle` fails the 260 kB entry budget at 335 kB gzip. It already failed
  at `d518e42` (336 kB); Phase 0 adds about 3 kB. `vite.config.ts` still describes an
  818 kB entry. Decide the budget before Phase 1 adds the pool and Sobol code.
- Overrides and class priors are recorded, not applied: the engine still reads the scenario
  library and `spreadFor` without a priors table. Phase 1 wires both through `McSettings`.
  A scenario export does not carry its overrides yet (blueprint section D).
- Sampled trials in the browser failed after the contract until integration fixed the
  five per-key manifest comparators; the controlled worker in tests never clones. The
  clone test in `trialClient.test.ts` now covers the transport.
- Data findings from lane 0.1, all kept as seed values with a note: eight seed and
  inventory value disagreements (`lib-sentry-lr-fc`, `lib-spyglass`, `lib-amphel`,
  `lib-helios`, `lib-ironbeam`, `lib-pulsar`, `lib-eagls`, `lib-skyranger30`); three L2
  fields with a source and no date (`lib-cuaews.pk`, `lib-ninja.engageTimeS`,
  `lib-pulsar.pk`); 13 null fields whose inventory grade is recorded in a note.
- Lane 0.2: `lib-gator` and `lib-gm200mmc` `detectRangeM` (40 km planning figures) sit
  3.5 spreads from the radar prior and carry a note. An additive prior with sd 0 gives a
  zero-width triangular, which samples the nominal. Tuple fields get no prior.
- `src/panels/settings/systems.css` is the first component CSS file; every other rule is
  in `src/index.css`. Fold or keep at the Phase 1 gate.
- `RunHistory` renders nothing until its first IndexedDB read settles, so the no-trial
  markup test in `OutcomeScreen.test.tsx` stays exact.
- No pinned parity number moved in Phase 0.

## Continuation boundary

The next task is the Phase 1 contract slice in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#3-phase-1-real-mode-statistics): a
`fable-medium` worker on `src/model/types.ts`, `src/state/store.ts` and
`src/playback/mcTypes.ts`. Lanes 1.1 to 1.5 start only after it merges. The bundle budget
decision above is a poll for Casey before the lanes start.

## Verification at the last gate

- `npm run check` at the gate: exit 0; 148 test files, 1757 tests; library check 90 models
  and 633 fields, 6 prior classes current; build entry 1,155.66 kB (339.77 kB gzip).
  Output in [check.txt](field-te/evidence/p0-gate-2026-09-10/check.txt).
- Parity: `sensitivity.parity.test.ts`, `accuracy.verify.test.ts`,
  `convergence.verify.test.ts` unchanged and passing inside that run.
- Browser checks recorded in
  [the gate evidence](field-te/evidence/p0-gate-2026-09-10/README.md): Settings Systems
  override, trial manifest with the override, run history across a reload, 0 page errors.
- Timing against blueprint section J: not measured in Phase 0; no target applies to it.
