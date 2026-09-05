# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-05, moves at each wave boundary. Remote verified equal after each push. Tree carries
the uncommitted design step 3 CSS fold (`src/index.css`) and untracked `.claude/`.
Contributor: Claude Fable under [AGENTS.md](../AGENTS.md).

## Verified

- Gates at this commit: type-check, 1,390 tests in 91 files, lint 74 warnings (identical
  set) and 0 errors, build (one pre-existing chunk-size warning). Parity baseline:
  `evidence/r1-leaf-2026-09-05/numerical-baseline.json`, still byte-identical on the firing
  fixture after E2 R-F-30 (`evidence/e2-rf30-jam-2026-09-05/numerical-after.json`).
- E2 R-F-30 done: `assessJam` on slant range; layered fixture expectedKills 6.899127 to
  6.899306 (`e2-rf30-jam-2026-09-05/diff.md`). Wave 2 engine done at `a5d2ae3`: `store.ts`
  1,611 lines, `sim.ts` 922, `attrition.ts` 849, no re-exports, no `sim`/`policy` cycle.
- Design step 2 at `171ba23`: fonts, type roles, floor and contrast.

## Next

1. Design step 3: CSS fold (in flight), then the kit merge (state square, provenance mark,
   field and segmented control once across `te/ui/kit.tsx` and `panels/inspector/kit.tsx`).
2. Design step 4 (F3 daylight theme, OS follow, switch in the top bar).
3. Wave 3: next E2 family from PLAN section 5 with a before-and-after capture; E3 studies.
4. Wave 4: design steps 6, 7, 9, 10, 13; then 8 (R-F-33), 11, 12; then 14 with R-F-34.
5. Wave 5: T1 static offline bundle, then A1 against R-D-33. The 74 lint warnings fold
   into the slices that own `src/te/ui`, `src/charts` and the widgets.

## Inputs Casey holds

None blocking. Defaults taken, reversible on Casey's word: `DEFAULT_BUDGET` (96 million
retained numbers, ten minutes); `@fontsource/ibm-plex-*` packages unused since `171ba23`
but kept until Casey approves the dependency removal; T1 as a static bundle.

## Open findings

R-F-20 blocked-route row (step 7). R-F-33 raw-horizon subscriptions. R-F-34 canvas memo.
