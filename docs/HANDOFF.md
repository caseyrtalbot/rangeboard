# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [README.md](README.md) and the
commit log. This file holds only the position, the tasking ahead and the landmines. A
fresh agent starts from this file and the docs index. This file does not authorize a
commit, push or merge.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch and
  matches `origin/main` at `34c20ed` (2026-09-16), which follows the cancelled-plan
  removal (`3408294`) and the evidence-storage merge (`5bd19c0`).
- The working tree is uncommitted. Existing handoff/index/workflow/maintenance edits
  remain, alongside suppression comments in the four canvas/panel sites, the read-only
  `specFields` view and its new tests, and formatting-only changes to
  `src/state/store.analysis.test.ts` and `src/state/store.test.ts`. Preserve these edits.
- Prettier 3.9.6 owns `.ts`, `.tsx` and `.mjs` layout (`prettier.config.mjs`, printWidth
  100, no semicolons, single quotes). `npm run format` writes; `npm run format:check` is
  in `npm run check`. Generated modules stay out of the formatter:
  `*.generated.ts` and `src/io/runtimeSchema.ts`.
- Application tsconfigs enable `strict`, `noImplicitOverride` and `noImplicitReturns`.
  `noUncheckedIndexedAccess` (~2,025 errors) and `exactOptionalPropertyTypes` (~112) are
  not on.
- Integrated local gate on the working tree based on `34c20ed`: `npm run check` passed
  (203 test files, 2,181
  tests, plus docs, evidence, engine CLI, library, schema, typecheck, lint, format and
  build). `npm run check:bundle` passed with the entry at 361,508 bytes gzip against the
  364,000 budget; initial JavaScript plus CSS is 377,289 bytes. Schema generation
  produced no diff. This slice changes no UI behavior and had no live browser pass.
- Open defect, diagnosed and quantified but not fixed: `src/playback/shot.ts:319` charges
  the assignment-to-release delay as an open-loop coast of the fire-control track, so at
  the Coyote's `engageTimeS` of 60 s the miss 1 sigma is 282 m against a 10 m lethal
  radius and the physical kinetic model kills nothing on the firing laydown. The one-site
  fix is written out in
  [the zero-kill kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md).
  It is not landed because it moves five pinned values in
  `src/playback/estimate.parity.test.ts` that cannot be hand derived, and because one of
  them is contaminated by a second defect: the layered golden fixture runs its
  interceptors at zero flight time. Until the fix lands, `legacyKineticPk` is the
  defensible model choice for sizing a kinetic engagement.

## Tasking

Each item is one session task with its own gate. Task 2 is the next task retained from
the prior handoff; it and Task 3 remain unstarted. Do not enable further tsconfig flags
or start an adjacent refactor as part of either task.

### Task 2: Land the kinetic miss horizon and recapture the estimate-path anchors

- Outcome: `src/playback/shot.ts:319` uses the flight as the miss horizon, with a
  regression test sized like `src/playback/kinetic.verify.test.ts`, and
  `src/playback/estimate.parity.test.ts` recaptured. The candidate change, its measured
  effect and the five moved pins are in
  [the zero-kill kinetic record](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md).
- Do the `flyoutSpeedMps` adoption gap first or decide against it explicitly. The layered
  golden fixture saves no `flyoutSpeedMps` and `ADOPTED_SEED_KEYS.effector`
  (`src/model/libraryLifecycle.ts`) does not adopt it, so its interceptors fly with a
  zero flight time while the physical Pk model still applies. Recapturing that fixture's
  kills mean as 4.68 without fixing this pins a teleporting interceptor.
- The recapture needs the user's authorization for each replacement value. Write the
  before and after into the record beside the Phase 3 comparison, as
  [the Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
  did.

### Task 3: Later TypeScript and product follow-ups, select one per session

- `src/analysis` and `src/playback` review of `JSON.stringify` keys and `as unknown as`
  (parity required; capture before and after if a golden could move).
- `// @ts-check` and JSDoc on `scripts/*.mjs` and `src/io/generateRuntimeSchema.mjs`.
- Entry chunk lazy split: back under 340 kB gzip with the budget lowered again. Measure
  with `npm run build && npm run check:bundle`.
- `RunRecord` gains `sobol: SobolResult | null` so the SQLite `sobol` table fills
  (`src/model/runRecord.ts`, `src/io/exportSqlite.ts`).
- Split `src/model/integrationData.ts`, `src/state/store.ts` or
  `src/panels/Inspector.tsx` only with an explicit user ask.
- `noUncheckedIndexedAccess` as its own gated slice.

## Landmines

- Model/state review found three property-order-sensitive JSON comparisons, reproduced
  against the current source: `dropEditedProvenance` in `src/model/types.ts:596` drops
  a classification provenance row when only object key order changes;
  `resetBuiltin` in `src/model/libraryLifecycle.ts:244` replaces an equal reordered
  builtin instead of returning the original array; `sameAppliedOverrides` in
  `src/model/applyOverrides.ts:85` treats reordered object values as different and can
  invalidate runs. Numeric/tuple overrides from the current Systems editor do not
  exercise the last case, but restored overrides accept object values. These remain
  findings, not fixes. `src/state/analysisBasis.ts:22` already sorts object keys and
  preserves array order. No production `as unknown as` remains in model/state.
- A run's identity is its basis signature and the override list it applied. An override
  edit that changes a value in force reaches the store only through the
  `useOverrides.subscribe` line at the end of `src/state/store.ts`.
- The Systems tab is the only view that shows an override; rings, WEZ, telemetry and the
  Prepare forecast read `trial.scenario` or the board scenario, which keep the library
  value.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate that
  touches the entry. `sql.js` must stay behind `await import` with its wasm URL.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- Prettier wrapping of JSX text can change React `children`. Keep button labels on one
  line, or tests that compare `props.children` to a string will miss the control. See
  `src/ui/ErrorBoundary.tsx`.
- `library:check` and `schema:check` compare generated bytes. Do not hand-edit
  `*.generated.ts` or `src/io/runtimeSchema.ts`.
- Oxlint `only-export-components` warnings already exist; do not add more. `npm run lint`
  does not fail on them.
- Physics tab: a checked box selects the prior planning fallback; a cleared box selects
  the physical model.
- Zero kills from the default physical kinetic model are a defect, not physics.
  `src/playback/shot.ts:319` propagates the track over `engageTimeS` before the Rayleigh
  miss. `kinetic.verify.test.ts` passing at hand-supplied miss sigmas is not evidence the
  integrated interceptor model works. The two golden fixtures pin `truthTracks` and
  `legacyKineticPk`; `estimate.parity.test.ts` is the only suite a physical-Pk change
  moves.
- The layered golden fixture saves no `flyoutSpeedMps` and adoption does not fill it, so
  interceptors arrive at release while `kineticEffectProbability` still takes the
  physical branch.
- `seekerAcquisitionRangeM` gates feasibility only. Nothing reduces miss sigma for a
  seeker-equipped round.
- Every edit to a registered reference needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails. Guides
  fingerprint `src/`, so a source commit after a docs review invalidates it.

## Evidence

- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
- [Phase 3 review fixes CR-01 to CR-04, 2026-09-14](field-te/evidence/cr-fixes-2026-09-14/README.md)
- [Phase 3 gate](field-te/evidence/p3-gate-2026-09-10/README.md)
- [Estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
