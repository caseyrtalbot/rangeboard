# Code-quality follow-ups plan

This file is the frozen queue for the three follow-ups of the code-quality refactor
(`ccfdf44`). Do not edit it when a row lands, and do not record completion here.
Progress lives only in [HANDOFF.md](../HANDOFF.md). That file links here and selects
exactly one row. After a row's gate passes, rewrite the handoff so its Tasking section is
the next row in the order table, and leave this file unchanged.

Authored against `main` at `418a893` (2026-09-29). Line numbers are positions at
authorship; confirm them before an edit.

## Source

The refactor left three items that its lanes did not take: the single-worker Monte Carlo
slot in `mcClient.ts`, the test-card store actions that lost their last caller when the
Test cards tab was removed (`2213e42`), and the binary-search helpers repeated across
`src/analysis`, `src/playback` and `src/panels/timeline`. Three read-only surveys on
`418a893` (2026-09-29; two `opus-medium`, one `fable-medium`) supplied the file:line
pointers below. The orchestrator checked their main claims against the source.

## Decisions

These are the defaults for a change with no behavior change. The user may override one
at kickoff.

- D1. Remove the single-worker Monte Carlo slot. Production runs replicates only through
  the pool: `analysisRequests.ts:30-37` imports only the pooled functions. The store
  tests keep a worker transport through a test-local slot.
- D2. Delete the eight card actions and the helpers that only they use. Keep the card
  data model. The `2213e42` message says: "Scenario.testCards, its store actions, seed
  card and validation stay, so saved scenarios still load." A saved board loads through
  the data model alone, so D2 narrows that decision to the data model. A T&E Ops redesign
  takes the actions from Git history (`418a893`) or writes new ones. The user confirmed
  D2 on 2026-09-29.
- D3. One leaf module, `src/geometry/sortedIndex.ts`, with no imports, holds the upper
  and lower bound searches. Ten searches in eight files use it. Four other index searches
  and the seven numeric root bisections keep their own code.

## Do not mix

- No behavior change. No parity expect moves; the two parity files run inside
  `npm test`. If an expect moves, stop and report the numbers.
- No type change to `Scenario`, `TestCard` or `RunLogEntry`. `npm run schema:check`
  passes and `npm run schema:generate` produces no diff.
- The entry graph keeps 107 guarded modules. Do not run
  `node scripts/check-entry-graph.mjs --write`. A new module under a guarded prefix
  (`src/playback/`, `src/analysis/`, `src/engine/`, `src/charts/`, `src/panels/analysis/`)
  that reaches the entry fails `check:entry-graph`.
- No other cleanup. A row stops at its owned files and reports anything else as a
  follow-up.

## Order

| Row | Subject | Worker | Budget | Branch |
| --- | --- | --- | --- | --- |
| Q1 | Remove the single-worker Monte Carlo slot | `opus-medium` | 900 s | `quality/q1` |
| Q2 | Delete the orphaned test-card actions | `opus-medium` | 600 s | `quality/q2` |
| Q3 | One sorted-index helper | `opus-medium` | 900 s | `quality/q3` |

Run one row per agent turn, in this order. Start each row from `main` after the user has
merged the previous row. Q1 and Q2 both edit `src/state/store.analysis.test.ts`, in
different blocks. Every row edits `docs/ENGINEERING_REFERENCE.md`, on different lines.
Each row commits on its branch when its gate passes. Merge and push wait for the user's
word.

Update the docs, record each review that `npm run docs:check` asks for with a concrete
note (`npm run docs:review -- <document> --note "..."`), then run the gate.
`docs/PROJECT_GUIDE.md` and `docs/ENGINEERING_REFERENCE.md` take source files as inputs,
so every row reviews both. Gate for every row:

```sh
npm run check
npm run check:bundle
npm run check:silent
```

Report the test files and tests against the base (225 files and 2,507 tests on
`ccfdf44`) and explain each difference. Report the `check:bundle` entry and initial bytes
(367,733 and 386,505 on `ccfdf44`) and the entry-graph line.

## Q1. Remove the single-worker Monte Carlo slot. `opus-medium`

Owns:

- `src/playback/mcClient.ts`
- `src/playback/mc.worker.ts`, the replicate fall-through at 244-260 only
- `src/playback/mcRun.ts`, `McRunRequest` (186) and its request-union member (241) only
- `src/playback/trialClient.test.ts`
- `src/state/store.analysis.test.ts`, the `mcClient` mock at 25-50 only
- `docs/ENGINEERING_REFERENCE.md`, 426-428 and 433

Facts:

- The slot is `run = createWorkerSlot()` (`mcClient.ts:23`) with `startMcRun` (68),
  `cancelMcRun` (84) and `requestMcCancel` (93). No production module imports the three
  functions. The store starts and cancels a replicate run through `startPooledRun`,
  `cancelPooledRun` and `requestPooledCancel` (`analysisRequests.ts:30-37, 191, 213, 254`).
- Two tests reach the slot. `trialClient.test.ts:223` ("keeps all three worker slots
  independent ...") uses it as one of three slots. `store.analysis.test.ts:32-50` routes
  the three pooled functions to the slot functions, so every store Monte Carlo test
  (`launch()` at 65 and the tests at 144-341, 609, 651-715 and 911) runs on the slot with
  `ControlledWorker`. Those tests check store rules: ownership, terminal messages, the
  grace cancel and trial concurrency. `workerPool.test.ts` covers the pool.
- `replicateLoop` stays: `mcRun.ts:606, 1250` and `engine/index.ts:69` use it.
- `workerGraph.test.ts:72` asserts that no worker imports `mcClient` or `trialClient`.
  `scripts/entry-graph.json` lists both files (90, 115), and both files stay.

Work:

1. `mcClient.ts`: delete the `run` slot with its comment (19-23) and the three slot
   functions. The pool comment (32-34) names `startMcRun`; restate it without that name.
   Keep `protocol()` and the sensitivity slot.
2. `mc.worker.ts`: delete the replicate fall-through (244-260). After the `sensitivity`
   branch the request union is exhausted; add no fallback branch. Remove each import that
   `noUnusedLocals` then reports.
3. `mcRun.ts`: delete `McRunRequest` and its union member.
4. `trialClient.test.ts`: rewrite the test at 223 over two slots, trial and sensitivity,
   with the same replace, complete and cancel checks. Remove the Monte Carlo import (3)
   and `cancelMcRun()` in `afterEach` (50).
5. `store.analysis.test.ts`: replace the routing to the slot functions with a test-local
   transport. Build one `createWorkerSlot()` (`workerSlot.ts:58`). Its protocol spawns a
   `Worker` (the installed `ControlledWorker`), posts a request typed from the current
   `McRequest` union, and passes the `progress`, `done` and `error` messages for the run
   id as `protocol()` does (`mcClient.ts:42-61`). `cancelPooledRun` calls the slot's
   `dispose`, and `requestPooledCancel` calls its `cancel`. Type the delivered messages as
   `McWorkerMessage`. Keep the test bodies unchanged. `ControlledWorker` does not read
   the posted request.
6. `ENGINEERING_REFERENCE.md`: 426-428 says the cancel actions post "through
   `mcClient.ts` to the slot". Correct it against the source: `cancelMonteCarlo` reaches
   the pool through `requestPooledCancel`, and `cancelSensitivityRun` reaches the
   sensitivity slot. At 433, remove "the single worker" from the list of paths that agree.

Checks: the store and `trialClient` test counts stay the same. A grep of `src/` for
`startMcRun`, `cancelMcRun`, `requestMcCancel` and `McRunRequest` finds nothing.

Stop: the gate passes, the commit is on `quality/q1`, and the handoff selects Q2.

## Q2. Delete the orphaned test-card actions. `opus-medium`

Owns:

- `src/state/store.ts`: the eight action types (321-331), their bodies (1262-1370) and
  the imports that only they use (12, 16, 41, 50)
- `src/state/labels.ts`: `bumpCardVersion` (59)
- `src/model/seedCards.ts` and `src/model/seedCards.test.ts`, both deleted
- `src/state/store.test.ts`: 9, 111-125 and 284-320
- `src/state/store.analysis.test.ts`: the `addCard()` call at 627 only
- `docs/ENGINEERING_REFERENCE.md`, 480

Facts:

- The actions are `addCard`, `addCardFromSelection`, `newCardVersion`, `updateCard`,
  `deleteCard`, `toggleCardEntity`, `addRun` and `updateRun`. No production module calls
  one. `bumpCardVersion` and the four `seedCards.ts` exports (`standardCovariates`,
  `controlledVarsText`, `describeConfiguration`, `describeThreats`) have no importer
  other than the actions and their tests.
- Saved boards carry `Scenario.testCards` (`types.ts:1195`). The runtime schema requires
  it, and `validateScenario.ts:26, 58-63` checks it.
- The `deleteSelection` cascade (`store.ts:728-731`) removes a deleted entity from each
  card's `linkedEntityIds`. Without it, `validateScenario.ts:60` rejects the board on
  reload.
- `analysisBasis.ts:40` excludes `testCards` from the basis signature, and
  `fillScenarioReport` passes the `testCards` of an old save through
  (`scenarioFill.ts:36-38`). Removing the field would change the signature of old saves.

Work:

1. Delete the eight actions from the store type and the store body. Remove each import
   that `noUnusedLocals` then reports.
2. Delete `bumpCardVersion`, `seedCards.ts` and `seedCards.test.ts`.
3. `store.test.ts`: delete the card-action tests (284-320) and the `bumpCardVersion`
   import (9). Keep the cascade test (111-125): in place of `addCard` and
   `toggleCardEntity`, put a card linked to the radar into the scenario with
   `patchScenario({ testCards: [...] })`, and keep its three expects.
4. `store.analysis.test.ts:627`: replace `addCard()` with a `patchScenario` call that adds
   one card, so the test still proves that a card edit leaves the basis signature
   unchanged.
5. `ENGINEERING_REFERENCE.md:480`: remove `seedCards.ts` from the `src/model/` list.

Keep, and do not edit: `Scenario.testCards`, `TestCard`, `RunLogEntry`,
`runtimeSchema.ts`, `validateScenario.ts`, the `deleteSelection` cascade, `sameSelection`
(`store.ts:511`), `Selection.cardId` (`scenarioInstall.ts:21, 29, 196`), the
`analysisBasis.ts` exclusion, the `EntityLayer.tsx` card ring (95, 605-610, 669-676),
`seed.ts:75`, the fixtures and the `rangeboard.te.*` storage keys.

Checks: `npm run schema:generate` produces no diff. A grep of `src/` for the eight action
names, `bumpCardVersion` and `seedCards` finds nothing.

Stop: the gate passes, the commit is on `quality/q2`, and the handoff selects Q3.

## Q3. One sorted-index helper. `opus-medium`

Owns:

- `src/geometry/sortedIndex.ts` and `src/geometry/sortedIndex.test.ts`, both new
- the ten searches in the table below, in `src/analysis/liveStats.ts`, `trialSeries.ts`,
  `trialResult.ts` and `runTimeline.ts`, `src/playback/trackState.ts`,
  `trialTrackState.ts` and `trialSweepAt.ts`, and `src/panels/timeline/layout.ts`
- `docs/ENGINEERING_REFERENCE.md`, the `src/geometry/` list at 482-483

Contracts: the upper bound is the first index whose key is greater than `t`, which equals
the count of keys at or below `t`. The lower bound is the first index whose key is at or
above `t`. Both return 0 on an empty array.

| Site | Now | Becomes |
| --- | --- | --- |
| `liveStats.ts:78` `countAtMost` | upper bound | `upperBound` |
| `trialSeries.ts:67` `countAt` | upper bound | `upperBound` |
| `trialResult.ts:87` `countAt` | upper bound | `upperBound` |
| `trackState.ts:304` `countAtMost` | upper bound | `upperBound` |
| `trackState.ts:316` `lowerBound` | lower bound | the imported `lowerBound` |
| `runTimeline.ts:145` in `levelAt` | upper bound over `series.t`, then index minus one | `upperBound(series.t, tS)` |
| `trialTrackState.ts:44` `lastAt` | last step at or before `t`, key `.timeS` | `steps[upperBoundBy(steps, t, (s) => s.timeS) - 1]` |
| `trialSweepAt.ts:53` `lastAt<T>` | the same with a key function | `upperBoundBy` |
| `layout.ts:175`, first line in `lineWindow` | upper bound on `y + h` against `lo` | `upperBoundBy(lines, lo, (l) => l.y + l.h)` |
| `layout.ts:183`, last line in `lineWindow` | lower bound on `y` against `hi`, searched from `first` | `Math.max(first, lowerBoundBy(lines, hi, (l) => l.y))` |

`lines` is sorted by `y`, so the `Math.max` form equals the search from `first` for every
window. Keep it; the plain lower bound differs when `hi` is at or below `lo`.

Leave alone:

- `retainTrial.ts:306`: an upper bound over a sub-range of an index array, with an
  indirect key.
- `hit.ts:19` `lineAt`: an interval membership that returns the line or null.
- `horizon.ts:17` `visibleCount`: a predicate over a virtual grid, with no array.
- `intercept.ts:17` `intervalIndexAt`: a linear scan with a tolerance.
- The numeric root bisections: `radarPd.ts:141`, `stats.ts:77`, `sensorEnv/eoir.ts:175`,
  `sensorEnv/acoustic.ts:44`, `intercept.ts:152`, `radarDwell.ts:134` and `shot.ts:230`.

Why `src/geometry/`: no guarded prefix in `scripts/entry-graph.json` covers it, and
`prng.ts` there already serves playback and the workers with no imports. Six of the eight
edited files reach the entry. `runTimeline.ts` and `layout.ts` are in the lazy run
timeline chunk (`App.tsx:55`), which imports entry modules today. The Monte Carlo worker
bundles `liveStats.ts` through `mcRun.ts:9`. A new file under `src/analysis/` or
`src/playback/` would add a guarded module to the entry and fail `check:entry-graph`. A
helper with no imports cannot split the store into a preloaded chunk (see the entry-graph
entries in the handoff Landmines).

Work:

1. `sortedIndex.ts`, with no imports:
   `upperBound(sorted: readonly number[], t: number): number`,
   `lowerBound(sorted: readonly number[], t: number): number`,
   `upperBoundBy<T>(items: readonly T[], t: number, keyOf: (item: T) => number): number`
   and `lowerBoundBy<T>(...)` with the same shape. One short comment states each contract.
2. `sortedIndex.test.ts`: an empty array, every key below `t`, every key above `t`, ties
   at `t` and duplicates. Size it like `prng.test.ts`.
3. Switch the ten searches as the table says and delete the local helpers.
4. Before the commit, run a temporary differential test, as `ccfdf44` did for
   `opticalDwellAt`. Copy the ten old bodies into a test beside the helper. Compare them
   with the new calls over random sorted arrays (lengths 0 to 50, duplicates, ties at
   `t`, `t` below the first key and above the last key) and over sorted `Placed` lines
   with the `first` start. Mismatches must be 0. Record the case count in the commit
   message, then delete the test.
5. `ENGINEERING_REFERENCE.md`: add `sortedIndex.ts` to the `src/geometry/` list.

Checks: the entry-graph line keeps 107 guarded modules. `npm run test:e2e` passes on a dev
server (`E2E_URL`, see [VERIFICATION.md](../VERIFICATION.md)), because `layout.ts` places
the run timeline rows.

Stop: the gate passes, the commit is on `quality/q3`, the handoff selects nothing, and
this queue is complete.
