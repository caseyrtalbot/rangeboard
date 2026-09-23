# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [README.md](README.md) and the
commit log. This file holds only the position, the current task and the landmines. A
fresh agent starts from this file and the docs index. This file does not authorize a
commit, push or merge.

The open queue is [Plan.md](Plan.md), the design and UX polish plan. This file selects
one row of it.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch.
  `origin/main` is at `293f7bd`. Local `main` is ahead by the plan commit `0386b3a`, the
  Row A commit `e744334` and the commit that holds this handoff. None of them is pushed.
  The audit fixes `181c8ec` to `7da197d` and the documentation
  update after them follow row J (`afaf1ae`) and row O (`de208aa`).
- The authorized estimate-path recapture is `225e027`. Its expects: layered events 11,
  layered kill mass 1, layered kills mean 1.115, JIATF leakers mean 0.895, JIATF kills
  mean 0.105. `4.68` is not a pin.
- The flight horizon is `7fdcb1e`.

## Tasking

Row B of [Plan.md](Plan.md#row-b-wave-1): wave 1, lanes B1 to B5, then B-int. Row A is
complete in `e744334`.

- Base: local `main` at the commit that holds this handoff. Each lane branches from it.
- Launch B1 to B5 in one message. Each lane runs in its own worktree on its own branch,
  runs `npm ci` there first, and uses its own dev port. Owned files, CSS blocks, findings
  and gates are in the Plan row. Then run B-int.

| Lane | Branch | Worker, budget | Dev port |
| --- | --- | --- | --- |
| B1 | `row-b/b1-surfaces` | `opus-medium`, 3600 s | 5401 |
| B2 | `row-b/b2-canvas` | `opus-high`, 5400 s | 5402 |
| B3 | `row-b/b3-shell` | `opus-high`, 5400 s | 5403 |
| B4 | `row-b/b4-controls` | `opus-medium`, 3600 s | 5404 |
| B5 | `row-b/b5-topbar` | `opus-medium`, 2700 s | 5405 |

- D1 is closed (adopt all). D5 and D7 apply in this row. Use the plan defaults unless the
  user chose otherwise before the row starts. D2 to D4 and D8 wait on Row C.
- The Row A gate measured the entry at 364,438 bytes gzip: 562 bytes under the 365,000
  budget. The five lanes share that headroom. Initial JavaScript and CSS: 380,353 bytes
  against 400,000. A lane never raises a budget.
- Row A facts for the lanes:
  - `BOARD_INK_PAPER` gives the airspace grid the plain paper grid values. The plan names
    no separate paper airspace tone. B2 applies the ink to the layers.
  - A disabled button inside a `.seg` group, such as undo and redo in the board tools,
    draws in text 2, not `--text-disabled`: `.seg button` sets the colour after
    `button:disabled` at the same specificity. B4 owns the `.seg` block.
  - Light-theme canvas labels stay faint until B2 reads `useBoardInk`.

### Handoff updates

Every worker updates this file for the next phase, and only after its own checks pass.
The worker runs each check, reads its output and records the summary line. A report
without that output is a claim, not a result.

A lane worker (B1 to B5):

1. Runs the lane gate in its Plan row, then `npm run build && npm run check:bundle`.
2. When every check passes, replaces the `Status: not started.` line of its own block
   under "Lane results" with the fields below. It edits no other line of this file, so
   the five branches merge without a conflict here.
3. Does not run `docs:review` on this file and does not run `docs:check`. Every lane would
   change the same `docs/maintenance.json` line, and any source edit invalidates the two
   guides. B-int records the reviews once, after the merge.
4. Commits its owned paths and this file on its lane branch. It does not push or merge.
5. If a check fails and the fix is outside its owned files, sets `Status: blocked`,
   records the command and its failing summary line, commits, and stops.

Block fields: `Status` (done or blocked); `Commit`; `Checks` (each command with its
summary line); `Entry gzip` (bytes from `check:bundle`); `Browser` (screens, themes,
widths, result); `For the integrator` (a needed edit in an unowned CSS block or file, and
the rule or token text for `DESIGN_SYSTEM.md`); `Open` (each lane finding not closed, with
the reason).

The integrator (B-int):

1. Treats each lane block as a claim. Merges B1 to B5 in that order. Resolves
   `index.css` by block ownership. Resolves a `docs/maintenance.json` conflict by taking
   `main` and recording the review again.
2. Runs the B-int checks in the Plan row: `npm run check`,
   `npm run build && npm run check:bundle`, `npm run test:e2e`, and the recapture of every
   stage and overlay in dark and light at 2100 and 1440. Edits `DESIGN_SYSTEM.md` for each
   reported rule.
3. When every check passes, rewrites this file in place: Position, the entry gzip bytes
   and headroom, and Tasking set to Row C with lane blocks C1 to C4 and this same
   protocol. It carries each open lane item forward and deletes the Row B lane blocks;
   git history keeps them. It runs `docs:review` on every changed reference and on this
   file, then `npm run docs:check`.
4. Commits on `main`, removes the Row B worktrees and lane branches, and does not push.

Row C and C-int follow the same protocol. After C-int, Tasking states that no Plan row
stays open and lists each finding that is closed, changed by a decision, or open with its
reason. No worker adds a row after the queue is complete.

### Lane results

#### B1. Floating surfaces and the palette

Status: not started.

#### B2. Canvas legibility

Status: not started.

#### B3. Right panel and board shell

- Status: done. F2, F5, F6, F8, F9, F10, V8, U1 (D5 default) and V13 (rail) are closed.
- Commit: this commit on `row-b/b3-shell`.
- Checks:
  - `npx vitest run --dir src` on EntityWorkspace, AnalysisNavigation, LiveStrip, Palette,
    NowScreen and AnalysisPanel tests: `Test Files 6 passed (6)`, `Tests 35 passed (35)`.
  - `npm run typecheck`: exit 0.
  - `npm run lint`: exit 0, 29 warnings, the same count as the base.
  - `npm run format:check`: `All matched files use Prettier code style!`
  - `npm run check:silent`: `No hidden-failure patterns in the checked lines.`
  - `E2E_URL=http://localhost:5403 npm run test:e2e`: `# tests 11`, `# pass 11`, `# fail 0`.
  - `npm run build && npm run check:bundle`: `Bundle budget passed: entry <= 365 kB;
    initial JavaScript + CSS <= 400 kB (gzip -9).`
- Entry gzip: 364,737 bytes, +299 against 364,438. The rail icons are 221 of that in this
  lane alone. With the B5 undo and redo icons present, they add 109, so the post-merge
  B3 delta is about 187 bytes. Initial JavaScript and CSS: 380,700.
- Browser: Playwright headless, fixture `firing-scenario.json`, dark and light, 2100 and
  1440. Prepare, Execute and Analyze with and without a selection; the empty board; the
  drawer. The drawer top meets the tools row bottom and its bottom meets the timeline
  top. Execute draws no screen navigation. The inline Play starts a trial. No console
  errors.
- For the integrator:
  - F10 changed the Execute placeholder, so this lane also edited two unowned tests:
    `src/panels/analysis/screens/NowScreen.test.tsx` and
    `src/panels/AnalysisPanel.test.tsx` (expected strings only).
  - `index.css`: the unowned rule `.entity-workspace-header p` is now dead; remove it.
  - `docs/ENGINEERING_REFERENCE.md`, Analysis screens: `AnalysisNavigation` draws on
    the Overview tab only and draws no `Seg` for a phase with one screen (Execute).
  - `DESIGN_SYSTEM.md`: the rail is 76 px wide so that "Commands" fits at the meta size.
    The empty-board hint is a `.surface-float` at the canvas top left. A library row
    shows its Model basis action only on hover or keyboard focus.
- Open: none.

#### B4. Panel controls and forms

Status: not started.

#### B5. Top bar

Status: not started.

### Outside the plan

These audit follow-ups stay candidates outside the plan:

- Three collinear range points pass the store's three-point floor and still throw in the
  optimize worker: `polygon.ts` when they are axis-aligned, else the rejection sampler in
  `loop.ts`.
- The merge could size its grids to the contiguous prefix.
- A CI push to `main` with a zero `before` sha checks nothing
  (`.github/workflows/quality.yml`).
- The fidelity gun-burst tag cannot see `context.uas`.
- No `finishSummary` cap timing exists after the t-quantile cache.

## Landmines

- `shot.ts` calls `predictionSigmaAtS(est, est.state.tS + flightS)` with
  `flightS = max(0, intercept.tEffectS - (t + es.engageTimeS))`.
  `kinetic.verify.test.ts` still feeds hand-supplied miss sigmas.
  `kinetic.horizon.test.ts` is the regression that uses `predictionSigmaAtS`. Do not
  put `engageTimeS` back into that call.
- Do not change the estimate-path expects above. Do not restore 16, 0, and 0.005.
- A saved builtin that omits `flyoutSpeedMps` adopts the seed cruise speed. An
  interceptor with no positive cruise speed uses `kineticPk`, matching
  `flyoutProfile`. Coyote is 154 m/s and MEROPS is 78 m/s. Roadrunner and Anvil have
  no seed cruise speed, so they stay on the legacy curve.
- `seekerAcquisitionRangeM` gates feasibility only. Nothing reduces miss sigma for a
  seeker-equipped round.
- Physics tab: a checked box selects the prior planning fallback; a cleared box selects
  the physical model when its required fields are present.
- Do not restore `src/analysis/series.ts`, `withBands` or `TRACK_LADDER_STYLE`.
- No production `as unknown as` remains in model or state. Test fixtures still use
  that cast. `basisJson` (`src/model/basisJson.ts`) sorts object keys and preserves
  array order. `dropEditedProvenance`, `resetBuiltin`, and `sameAppliedOverrides`
  use it.
- A run's identity is its basis signature and the override list it applied. An override
  edit that changes a value in force reaches the store only through the
  `useOverrides.subscribe` line at the end of `src/state/store.ts`. A throw from that
  line is reported to the override boundary in `main.tsx`. The shell in
  `OverrideSubscriber.tsx` stays armed while its alert is showing, so a later throw
  does not leave `setState`. The overrides autosave subscription stays outside that
  boundary. A throw before the shell mounts still leaves `setState`.
- The Systems tab is the only view that shows an override; rings, WEZ, telemetry and the
  Prepare forecast read `trial.scenario` or the board scenario, which keep the library
  value.
- Chunk grids are packed row-major `Float64Array`s (`i * steps + k`). `finish`
  transfers those buffers. Do not structured-clone them onto the page to summarize.
  Progress `done` is the prefix, not every landed index. `discarded` is set only
  when finish commits a hole. The Run button stays Stopping while `pool.stopping`
  is set; `cancel` returns false for that wait.
- `mergePartials` with `release` empties each transferred part as it copies it. The
  summary worker clears the parts list before `finishSummary`.
- `tQuantile` keeps a one-entry module cache in `src/analysis/stats.ts`.
- The retained track history is a column ledger. `bound.tracks[i]` returns a fresh,
  equal object on each read. `latestEstimatesAt` uses the ledger's indexed horizon
  read. `releaseRetainedTrial` empties only the copy from `boundRetainedTrial`.
- The Fragility Sobol warning is a planning factor from one board: 29 entities at
  2560 rows took 499 s, scaled by entity count and row count, and it fires at half
  of `DEFAULT_BUDGET.timeMs`. It is not a clock reading for the board on screen.
- Load refuses a flight path or boundary with fewer than two points. A placement run
  refuses a boundary with fewer than three. In-memory fixtures may still hold an empty
  `points` array (`scenarioHasWork` in `src/io/persist.test.ts`,
  `scenarioInstall.test.ts`). Those objects do not pass `parseScenarioData`.
- `npm run check` does not run `check:bundle`; run it after `build` at every gate that
  touches the entry. The entry gzip budget is 365,000 bytes with 562 bytes headroom
  (last measured 364,438 at the Row A gate). Icons and new components add entry bytes. `sql.js` must stay behind `await import` with its wasm URL.
- Never run bare `npx vitest run` while a worktree exists inside the repository. Scope
  with `--dir src`.
- Prettier wrapping of JSX text can change React `children`. Keep button labels on one
  line, or tests that compare `props.children` to a string will miss the control. See
  `src/ui/ErrorBoundary.tsx`.
- `library:check` and `schema:check` compare generated bytes. Do not hand-edit
  `*.generated.ts` or `src/io/runtimeSchema.ts`.
- Oxlint `only-export-components` warnings already exist; do not add more. `npm run lint`
  does not fail on them.
- The pool's budget is the main thread's: `DEFAULT_BUDGET.retainedNumbers` bounds the
  merged rows the page holds, not a worker. Raising it or `MAX_REPLICATES` in
  `RunTab.tsx` brings the tab crash back on large raids. The check is not a hard cap:
  in-flight chunks can still land.
- A throw inside the react-konva tree never reaches `src/ui/ErrorBoundary.tsx`; only
  `SceneErrorBoundary` sees it. Every layer belongs inside that boundary.
- `sobol-done` carries `result: null` on a cancel. Readers must handle the null.
- Every edit to a registered reference needs
  `npm run docs:review -- <document> --note "..."`, or `npm run docs:check` fails.
  Guides fingerprint `src/`, so a source commit after a docs review invalidates it.
  `docs:review` stamps `reviewedAt` with the UTC date.
- The weasel-word regex lives in `scripts/silent/rules/weasel-word.yml`, its `-tsx`
  twin, and `WEASEL_WORD` in `scripts/check-silent.mjs`. Change all three together.
- Every silent rule has a `-tsx` twin. The pair must stay identical except `id` and
  `language`.
- `storageManagement.ts` derives live keys from every non-prefix export of
  `storageKeys.ts`. Un-exporting `ANALYSIS_KEY` changes that readout.
- `selectObservedThroughWholeS`, `bandNote`, `bandStep`, and `TrialOutcomeSummary`
  have no importer. Un-exporting one of them fails `noUnusedLocals`. Do not delete
  them and do not add a suppression to keep them private.

## Evidence

- [Flight-horizon measurement, 2026-09-21](field-te/evidence/p3-gate-2026-09-10/flight-horizon-2026-09-21.md)
- [Zero-kill kinetic finding, 2026-09-15](field-te/evidence/kinetic-zero-kill-2026-09-15/README.md)
- [Phase 3 estimate-path comparison](field-te/evidence/p3-gate-2026-09-10/comparison.md)
- [Phase 4 gate, 2026-09-15](field-te/evidence/p4-gate-2026-09-15/README.md)
