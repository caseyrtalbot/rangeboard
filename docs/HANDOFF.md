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
  Row A commit `e744334`, the Row B protocol commit `1833ce8`, the five Row B lane merges
  (`0202893` to `1fd0bfc`) and the B-int commit that holds this handoff. None of them is
  pushed. The audit fixes `181c8ec` to `7da197d` and the documentation
  update after them follow row J (`afaf1ae`) and row O (`de208aa`).
- The authorized estimate-path recapture is `225e027`. Its expects: layered events 11,
  layered kill mass 1, layered kills mean 1.115, JIATF leakers mean 0.895, JIATF kills
  mean 0.105. `4.68` is not a pin.
- The flight horizon is `7fdcb1e`.

## Tasking

Row C of [Plan.md](Plan.md#row-c-wave-2): wave 2, lanes C1 to C4, then C-int and the
final capture. Row B is complete and merged on `main`.

- Base: local `main` at the commit that holds this handoff. Each lane branches from it.
- Launch C1 to C4 in one message. Each lane runs in its own worktree under
  `.claude/worktrees/` on its own branch, runs `npm ci` there first, and uses its own dev
  port. Owned files, findings and decisions are in the Plan row. Then run C-int.

| Lane | Branch | Findings | Worker, budget | Dev port |
| --- | --- | --- | --- | --- |
| C1 | `row-c/c1-settings` | F4 (D2) | `opus-medium`, 3600 s | 5501 |
| C2 | `row-c/c2-tools` | F7 (D3) | `opus-medium`, 2700 s | 5502 |
| C3 | `row-c/c3-run` | F11 (D4) | `opus-medium`, 2700 s | 5503 |
| C4 | `row-c/c4-undo` | U3 (D8) | `opus-medium`, 3600 s | 5504 |

- D2, D3, D4 and D8 apply in this row. Use the plan defaults unless the user chose
  otherwise before the row starts. D7 stays at 1600 px by the user's decision.
- Each lane gate: scoped tests for its owned files, `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm run check:silent`, then
  `npm run build && npm run check:bundle`, and a browser check of its change in dark and
  light at 2100 and 1440.
- The user raised the entry budget to 366,000 bytes at the Row B gate. B-int measured the
  entry at 365,722 bytes gzip: 278 bytes of headroom. The four lanes share it. Initial
  JavaScript and CSS: 381,985 bytes against 400,000. A lane never raises a budget.
- Row B facts for the lanes:
  - C1: B4 renamed the Environment action "Apply effects" in `EnvironmentSettings.tsx`.
    Settings is a `.tb-menu-panel surface-float` with a `--scrim` backdrop.
  - C2: `Toolbar.tsx` now holds the chip fold below 1600 px, the SVG undo and redo icons
    and the spawn chip button (B5), and `surface-float` on the ROE and file menus (B-int).
    No key is bound to a board tool, so the tool buttons show no key hint (U2).
  - C3: the run button in `RunControl.tsx` is `.mc-run primary` (V2, B-int), and
    `ForecastSettings.test.tsx` checks that class list. `AnalysisNavigation` shows
    `RunControl` in Analyze on the Overview tab only.
  - C4: if the store has no label for the last undoable action, C4 stops and reports;
    C-int adds the store field.

### Open from Row B

- Finding V12 (D7): with the fixture plus WEZ on and an environment derate (five chips), the right
  group at 1600 px is wider than its half, and the tabs sit 135 px left of center. The
  groups keep the 24 px gap. The user kept the fold at 1600 px.
- Finding U2: the context menu shows its keys; the board tool buttons show none, because no key
  is bound to a tool.
- Finding C2 changed: the path caption does not join `layoutLabels`, because that needs
  `LiveScene.tsx`. `PathLayer` places it clear of the glyphs and anchored labels of the
  board at rest. Spoke fans and flying entities are not obstacles.
- Finding C1: the `PathLayer` draft and calibrate marks, the `EntityLayer` connect ring and range
  button, and the `CanvasStage` marquee still use dark-only inks. The path caption uses
  the entity ink: `#c98577` is 2.48:1 on paper.
- Finding C4: the 28 px selection ring crosses the top of the anchored label, which starts at
  20 px. The geometry is unchanged.
- Finding U4: when an entity is deleted under the pointer, the pointer cursor stays until the next
  hover leave.
- `BoardInk` has no selection or board-tone field; `EntityLayer.tsx` and
  `ConnectionLayer.tsx` hold those values. Adding `selection` and `board` to
  `src/ui/ink.ts` would remove them.
- `.board-app .right-panel .seg button { white-space: normal }` wraps every right-panel
  segment. The ring override needs a four-class selector to keep "Global" on one line.

### Handoff updates

Every worker updates this file for the next phase, and only after its own checks pass.
The worker runs each check, reads its output and records the summary line. A report
without that output is a claim, not a result.

A lane worker (C1 to C4):

1. Runs its lane gate, then `npm run build && npm run check:bundle`.
2. When every check passes, replaces the `Status: not started.` line of its own block
   under "Lane results" with the fields below. It edits no other line of this file, so
   the four branches merge without a conflict here.
3. Does not run `docs:review` on this file and does not run `docs:check`. Every lane would
   change the same `docs/maintenance.json` line, and any source edit invalidates the
   guides. C-int records the reviews once, after the merge.
4. Commits its owned paths and this file on its lane branch. It does not push or merge.
5. If a check fails and the fix is outside its owned files, sets `Status: blocked`,
   records the command and its failing summary line, commits, and stops.

Block fields: `Status` (done or blocked); `Commit`; `Checks` (each command with its
summary line); `Entry gzip` (bytes from `check:bundle`); `Browser` (screens, themes,
widths, result); `For the integrator` (a needed edit in an unowned file, and the rule or
token text for `DESIGN_SYSTEM.md`); `Open` (each lane finding not closed, with the
reason).

The integrator (C-int):

1. Treats each lane block as a claim. Merges C1 to C4 in that order. Resolves a
   `docs/maintenance.json` conflict by taking `main` and recording the review again.
   Measures the merged entry before any fix: lanes that pass alone can fail together.
2. Runs `npm run check`, `npm run build && npm run check:bundle`, `npm run test:e2e`
   against a dev server on a free port, and the final capture of every stage and overlay
   in dark and light at 2100 and 1440. Compares the capture against the 36 findings.
   Edits `DESIGN_SYSTEM.md` for each reported rule.
3. When every check passes, rewrites this file in place: Position, the entry gzip bytes
   and headroom, and Tasking stating that no Plan row stays open, with each finding
   closed, changed by a decision, or open with its reason. It deletes the lane blocks.
   It runs `docs:review` on every changed reference and on this file, then
   `npm run docs:check`.
4. Commits on `main`, removes the Row C worktrees and lane branches, and does not push.
   No worker adds a row after the queue is complete.

### Lane results

#### C1. Fire doctrine and Environment editor

Status: not started.

#### C2. Editing tools during Execute

Status: not started.

#### C3. Analyze run control

- Status: done.
- Commit: see the `row-c/c3-run` tip; the commit that records this block.
- Checks:
  - `npx vitest run --dir src` on `CompareScreen.test.tsx`, `RunControl.test.tsx`,
    `AnalysisNavigation.test.tsx`, `ForecastSettings.test.tsx`: 4 files, 43 tests passed.
  - `npm run typecheck`: `tsc --noEmit -p tsconfig.app.json` exits 0, no output.
  - `npm run lint`: oxlint exits 0; 29 warnings, none in C3 files.
  - `npm run format:check`: "All matched files use Prettier code style!"
  - `npm run check:silent`: "No hidden-failure patterns in the checked lines."
  - `npm run build && npm run check:bundle`: "Bundle budget passed: entry <= 366 kB;
    initial JavaScript + CSS <= 400 kB (gzip -9)."
- Entry gzip: 365,722 bytes (no change; `CompareScreen` is not in the entry). Initial
  JavaScript and CSS: 381,985 bytes.
- Browser: fixture `firing-scenario.json`, trial played to complete, Analyze Outcome and
  Compare in dark and light at 2100 and 1440. The header Run control shows on both
  screens; Compare has no body "Run Monte Carlo" button and reads "Monte Carlo · No
  current ensemble result." A click on the header Run from Compare (dark, 1440) ran 30
  replicates and Compare drew the chart and the table. No page errors.
- For the integrator: no edit in an unowned file. `AnalysisNavigation` renders
  `RunControl` for every Analyze screen of the Overview tab, so Compare reaches it. No
  `index.css` change. `DESIGN_SYSTEM.md` rule: "Analyze has one run control, the header
  Run button beside the screen tabs. A screen body does not draw its own run button."
- Open: F11 closed. Observed, outside C3: the Compare `BandChart` cuts its y-axis labels
  at the left edge at 1440 ("0.75" shows as ".75"), and with a progress line the Run
  control row wraps to the left of the panel.

#### C4. Undo cue

Status: not started.

### Outside the plan

These audit follow-ups stay candidates outside the plan:

- The B-int capture found two defects that predate Row B. On Now, the kill-chain table
  State word "identified" runs into the Held cell with no gap. In the selected-object
  telemetry, the Pd and slant-range charts cut their end marker at the right edge and
  their `0:00` axis labels at the bottom, and the track ladder cuts its label on the left.

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
  touches the entry. The entry gzip budget is 366,000 bytes with 278 bytes headroom
  (last measured 365,722 at the Row B gate). Icons and new components add entry bytes. `sql.js` must stay behind `await import` with its wasm URL.
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
