# RangeBoard handoff

RangeBoard is a modeling and simulation tool for counter-UAS test-plan sizing. Its
physical and statistical models are surrogates built from public vendor data and open
literature. It controls no hardware and produces no targeting data.

This is one file, rewritten in place and never appended. Git history is the archive.
Completed work lives in the dated evidence indexed in [README.md](README.md) and the
commit log. This file holds only the position, the current task and the landmines. A
fresh agent starts from this file and the docs index. This file does not authorize a
commit, push or merge.

[Plan.md](Plan.md), the design and UX polish plan, is complete. No row of it is
selected.

## Position

- Repository `~/Projects/rangeboard`. Local `main` is the sole integration branch.
  `origin/main` is at `293f7bd`. Local `main` is ahead by the plan commit `0386b3a`, the
  Row A commit `e744334`, the Row B protocol commit `1833ce8`, the five Row B lane merges
  (`0202893` to `1fd0bfc`), the B-int commit `2028d35`, the four Row C lane merges and the
  C-int commit that holds this handoff. None of them is pushed. The audit fixes `181c8ec`
  to `7da197d` and the documentation update after them follow row J (`afaf1ae`) and row O
  (`de208aa`).
- The authorized estimate-path recapture is `225e027`. Its expects: layered events 11,
  layered kill mass 1, layered kills mean 1.115, JIATF leakers mean 0.895, JIATF kills
  mean 0.105. `4.68` is not a pin.
- The flight horizon is `7fdcb1e`.
- Entry gzip at the C-int gate: 365,894 bytes against 366,000, 106 bytes of headroom.
  Initial JavaScript and CSS: 382,274 bytes against 400,000.

## Tasking

No row of [Plan.md](Plan.md) stays open. Rows A, B and C are merged on `main`. Do not add
a row. The next task comes from the user.

Row C used the plan defaults for D2, D3, D4 and D8. The C-int capture covered every stage
and overlay in dark and light at 2100 and 1440 on the fixture
`docs/field-te/evidence/onboarding-2026-09-04/firing-scenario.json`, with no page error.
The state of the 36 findings:

- Closed: V1 to V4, V6 to V11, V13, V14, F1 to F3, F5, F6, F8 to F12, U1, U5, C3, C5.
- Closed in Row C:
  - F4 (D2): Prepare > Inputs is the one editor. Settings > Scenario holds a framed
    "Open Prepare > Inputs" action. It calls App's `openPreparation('doctrine')` through
    `OpenInputsContext` (`src/panels/settings/openInputs.ts`), so it opens the right panel
    on Inputs with Fire doctrine open.
  - F7 (D3): the board editing tools and Range setup show only in Prepare. Outside Prepare
    `BoardTools` returns the tool to Select. The palette drops its Tool group, and the
    Inspector and context menu drop "Draw flight path" and "Connect from here".
  - F11 (D4): Compare has no body "Run Monte Carlo" button. The header Run control is on
    every Analyze screen of the Overview tab.
  - U3 (D8): `src/state/lastAction.ts` names a delete or a place from the last `past`
    snapshot. The store has no new field. The lazy `src/panels/UndoCue.tsx` shows
    "Deleted `name` · Undo ⌘Z" and clears it after 4 s.
- Changed by a decision:
  - V5: the finding words LIMITS, INVALIDATES and PENDING stay (D6).
  - V12 (D7): the chips fold below 1600 px. At 1600 px with five chips the right group
    is wider than its half, and the tabs sit 135 px left of center.
  - U2: the context menu shows its keys. No key is bound to a board tool, so the tool
    buttons show none.
  - C2: the path caption does not join `layoutLabels`, because that needs
    `LiveScene.tsx`. `PathLayer` places it clear of the glyphs and anchored labels of the
    board at rest.
- Open:
  - U3 at 1440: the timeline has about 188 px free, so a long name truncates to "Del…"
    and the scrub narrows to 80 px for 4 s. An edit made before the lazy cue chunk
    loads shows no cue. A wider cue needs a placement decision outside the timeline row.
  - C1: the `PathLayer` draft and calibrate marks, the `EntityLayer` connect ring and
    range button, and the `CanvasStage` marquee still use dark-only inks.
  - C4: the 28 px selection ring crosses the top of the anchored label, which starts at
    20 px.
  - U4: when an entity is deleted under the pointer, the pointer cursor stays until the
    next hover leave.

### Outside the plan

These follow-ups stay candidates outside the plan:

- Row C capture: in Fire doctrine at the 320 px right panel, the "ROE" label wraps to
  "R / OE". At 1440 the Compare `BandChart` cuts its y-axis labels at the left edge. With
  a progress line, the Analyze Run control row wraps to the left of the panel.
- `BoardTools` resets the tool in an effect. A reset inside `setBoardPhase` would remove
  the effect.
- `.board-app input[type='range']` sets `min-width: 0` and overrides the 120 px `.scrub`
  floor.
- `BoardInk` has no selection or board-tone field; `EntityLayer.tsx` and
  `ConnectionLayer.tsx` hold those values. Adding `selection` and `board` to
  `src/ui/ink.ts` would remove them.
- `.board-app .right-panel .seg button { white-space: normal }` wraps every right-panel
  segment. The ring override needs a four-class selector to keep "Global" on one line.
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
  touches the entry. The entry gzip budget is 366,000 bytes with 106 bytes headroom
  (last measured 365,894 at the Row C gate). Icons and new components add entry bytes. `sql.js` must stay behind `await import` with its wasm URL.
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
