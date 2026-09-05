# RangeBoard: handoff

## Revision

`analysis-hardening` at the commit that carries this file; `main` fast-forwarded to it on
2026-09-05, moves at each wave boundary. Remote verified equal after each push. Tree carries
the uncommitted Wave 2 engine slices (next commit) and untracked `.claude/`. Contributor:
Claude Fable under [AGENTS.md](../AGENTS.md).

## Verified

- Gates at this commit (design step 2 alone, in a detached scratch worktree): type-check,
  1,376 tests in 82 files, lint 74 warnings (identical set) and 0 errors, build with the four
  woff2 files emitted. Parity unaffected: no engine file in the commit.
- Design step 2: Archivo and JetBrains Mono self-hosted, `--type-*` role tokens, zero
  `font-size` below 11 px and no weight 600+ under `src/`, headings sans sentence case,
  contrast on rendered surfaces 4.6:1 to 14.5:1 (`evidence/design-step2-2026-09-05/`).
- Gates at `3a79c6a` (last engine change): fixed-ID parity byte-identical against
  `evidence/r1-leaf-2026-09-05/numerical-baseline.json`.

## Next

1. Commit the Wave 2 engine slices (store 2,257 to 1,611, sim 1,503 to 922, attrition 1,313
   to 849; parity logs in `evidence/wave2-engine-2026-09-05/`), then move `src/panels` and
   `src/canvas` callers off the `store.ts`, `sim.ts` and `attrition.ts` re-exports and delete
   the re-exports with no consumer left.
2. Design steps 3 (surface rules, one kit, F2) and 4 (F3 daylight theme) in series. Step 2
   left five `text-transform: uppercase` pills for step 3 and 10 px SVG axis text in
   `src/charts/*.tsx` for step 8.
3. Wave 3: E2 one model at a time from R-F-30; E3 studies beside it.
4. Wave 4: design steps 6, 7, 9, 10, 13; then 8 (R-F-33), 11, 12; then 14 with R-F-34.
5. Wave 5: T1 static offline bundle for Chrome on macOS, then A1 against R-D-33. The 74
   lint warnings fold into the slices that own `src/te/ui`, `src/charts` and the widgets.

## Inputs Casey holds

None blocking. Defaults taken, reversible on Casey's word: `DEFAULT_BUDGET` (96 million
retained numbers, ten minutes); `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`
are now unused but stay in `package.json` until Casey approves the dependency removal; T1
as a static bundle.

## Open findings

R-F-20 blocked-route row (step 7). R-F-30 jam geometry. R-F-33 raw-horizon subscriptions. R-F-34 canvas memo.
