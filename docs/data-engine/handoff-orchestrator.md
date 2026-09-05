# Handoff: RangeBoard data-engine orchestrator, after slice 9 (plan complete)

> Status (2026-09-04): HISTORICAL HANDOFF. Its "Where things stand", "The user's operating
> rules" and "Do not" sections are as of slice 9 and are superseded by `AGENTS.md` and
> `docs/AI_HANDOFF.md`. The protocol lessons and the browser recipe remain useful reference.
> Scenario A and B in the browser recipe do not fire a Coyote (`outstanding.md` R-F-20).

Written 2026-09-04 by the orchestrator session that ran slice 9. The slice 0 to 2
orchestrator wrote the first version; the slice 3 to 9 orchestrators rewrote it; their
lessons are kept below. Read this, then the project documents. Do not duplicate them here.

Historical note (2026-09-04): the status table below is as of slice 9. The engine refactor
that followed is in `docs/engine-refactor/`, and the current state is in
`docs/AI_HANDOFF.md`. `HANDOFF.md` and the mockup files named below are not in git.

## Where things stand

| | |
| --- | --- |
| Repo | `/Users/caseytalbot/Projects/rangeboard`, branch `analysis-hardening` |
| Head | `8f70566` (docs hygiene, 2026-09-04, not pushed), on `e6edbb4` (slice 9, 2026-09-04). Slice 8 is `c5ec3c0`, slice 7 `780dbb2`, slice 6 `e8f31fb`, slice 5 `02ec701`, the CLAUDE.md rewrite `f079b87`, slice 4 `788a9cc`, slice 3 `f31a515`, slice 2 `5fb315c`, slice 1 `142bb95`, slice 0 `3b264e3`. Slices 0 to 9 are pushed (2026-09-04); `8f70566` is not (`git log origin/analysis-hardening..HEAD` is 1). Check the count before the next commit or push and report it. |
| Tree | `docs/data-engine/` and `docs/engine-refactor/` (the user's planning folders; untracked at the time, committed on 2026-09-04 except `HANDOFF.md` and the mockups). `8f70566` deleted `docs/board-refactor/`, `docs/strategist-refactor/` and `docs/picogrid-transfer-plan.md` (built and superseded). |
| Tests | 1071 in 61 files. Lint 74 warnings (baseline 56; one new in slice 9, `kit.tsx` `pfaText` `react(only-export-components)`, F-63). Build clean, one chunk-size warning, main chunk 1,929.98 kB / 560.16 kB gzip, worker chunk `mc.worker-*.js` 244.57 kB, CSS 74.71 kB / 13.02 kB gzip. |
| Next | Nothing in PLAN.md; slice 9 was its last slice. The follow-on is `docs/engine-refactor/PLAN.md` (written and approved 2026-09-04): eight slices in three waves, section 11 holds the schedule and the agent assignment, slice 0 is the provenance pass slice 9 deferred. `e6edbb4` is pushed. D-11 is marked superseded by refactor slice 1. `outstanding.md` stays the decision and follow-up log; refactor rows use the `R-D` and `R-F` prefixes. A wave starts only on the user's word. |

Project documents, in read order:

1. `CLAUDE.md` (repo root). Cite it by heading and bullet name, never by line number. Slice 9 trimmed the "Planning factors are labeled" invariant to the rule and added the "Provenance" bullet under "One source per fact" (after "Draw policy"): `Provenance` rows, `basisFor`, `PfTag` the one tag, every radar seed carries a `detectRangeM` row, `adoptSeedProvenance` in `fillScenario`, "Reset to seed". Keep the register: short bullets, one source per fact, no slice history.
2. `docs/data-engine/HANDOFF.md`: slice protocol, binding rules, six gate agents, ownership tables, cleanup checklist, report template, commit protocol. Every slice ran this shape; a follow-on task should too.
3. `docs/data-engine/PLAN.md`: the 23 decisions, engine facts, slice contracts and acceptance tests. Complete. Do not edit it; discrepancies go to `outstanding.md`.
4. `docs/data-engine/outstanding.md`: every open decision and follow-up from slices 0 to 9 (D-1 to D-77 with no D-58, F-1 to F-72, M-1 to M-8). Append to it; never delete a row. Update the "Committed so far" line after each commit and after a push.
5. `docs/inventory/provenance.md` and `gaps.md`: the August 2026 source record. Slice 9 wrote provenance into code from a fresh read of every page; the inventory is history, not the current record. The current record is `SpecModel.provenance` in `src/model/seedLibrary.ts`.
6. `docs/data-engine/mockup.html`: the design reference for slices 4 to 8. Slice 9 had no mockup section.

Commits carry the full slice summary; `git log -10 --format=%B` is the record. The slice 9 commit carries the 19-radar placard table.

## The user's operating rules for this work

- The user is the orchestrator's client. Each slice: build, four gate agents in parallel with the design agent, fix in-session, final gate, deliver the section 6 report verbatim, STOP. The user says "accept and commit", "Commit", "Commit slice N", "Push", "prepare handoff", or "Slice N go". Slice 9 closed as "commit. that was the last slice, correct?" then "prepare slice 9 handoff."
- "You are orchestrator. Execute <this file>" or "<this file> start slice N" with no "Slice N go" is the go. When a blocking decision has no answer, take the recommended reading, record it as a D- row, and build.
- Commit message form is HANDOFF section 6, but end with the CURRENT session URL from the system reminder, not the URL printed in HANDOFF.md.
- **Sub-agent effort rule (stated 2026-09-04, a hard rule from then on):** deploy every delegated agent by effort level and model. Fable at medium is the default. Fable at high only for a critical task where reasoning decides the outcome. Opus at high or xhigh for purely mechanical work. Match the task with the effort and the skill it needs. Agent definitions with `model` and `effort` frontmatter live in `~/.claude/agents/` as `fable-medium`, `fable-high`, `opus-high`, `opus-xhigh`; pass one as `subagent_type`. They load at session start; in a session where the Agent tool rejects the name, use `general-purpose` with the `model` parameter and state the effort class in the first line of the prompt. Slice 9 used: research Fable medium, correctness review Fable high, scope review Fable medium, UI build Opus xhigh, apply, design and every gate Opus high; the fix phases in-session.
- STE writing, no em-dashes in deliverables, lead with the outcome, no bullet reflex. The banned-pattern list in `~/.claude/CLAUDE.md` applies to every user-facing message.
- Ask nothing the docs answer. Ask only when a reading changes the work; otherwise state the assumption, build, and record it as a D- row.
- "prepare handoff" means: commit if asked, update `outstanding.md`'s "Committed so far" line, rewrite this file, update the memory file, report in a few lines. No push unless the user says push.

## What slices 0 to 9 taught

Agent assignment that worked (model, then the slice 9 effort class):

| Role | Model and effort | Notes |
| --- | --- | --- |
| pure math / types / helpers | Fable medium for physics, Opus high for geometry and reducers | slice 8: `s8-policy` threaded the policy through two engine files in one pass |
| engine (sim.ts, attrition.ts) | Fable medium (high when the semantics are the question) | slice 8 reopened both for the three draw sites; every pre-existing engine test passed untouched |
| replicate loop / statistics / worker | Fable medium | slice 8 |
| store (types, presets, migration, persistence, pruning) | Opus high or xhigh | slices 4, 6, 8, 9 clean |
| UI chrome (menus, Inspector, palette, panel shell, LibraryEditor) | Opus xhigh for a multi-file build | slice 9 `s9-ui` built the kit tag, the Inspector rows, the Sources section, the merge rule, the store action and four test files in 64 tool uses, tests included |
| widgets / composite React on the chart kit | Fable medium | slice 8 |
| research (fetch and read pages, write JSON) | Fable medium | slice 9: four agents, 5 radars each, 46 to 61 tool uses, 7 to 10 minutes, under 40 lines of report; every quote verbatim, every blank left `null` |
| seed edits from a JSON | Opus high | slice 9 `s9-apply`: 56 rows and 18 value changes with zero mismatches against the JSON in the orchestrator's cross-check |
| design (CSS fold, CLAUDE.md bullet) | Opus high | tell it to read the diffs, not the plan; slice 9 it measured the action row at three panel widths in Chromium before deciding not to add a rule |
| gate, browser-verify, final-gate | Opus high | give the exact `window.__store` recipe (below). Slice 9 browser-verify passed 9 of 9 first time |
| review-correctness | Fable high | slice 9 found the duplicated tag markup and the unkeyed form draft (both fixed) and cross-checked every value change against the JSON with a scratch test |
| review-scope | Fable medium | slice 9 flagged the `rangeBasis` deletions (an orchestrator rule, D-73) and the lint count |

Protocol facts to plan for:

- A shared contract file (fixed API with signatures and JSDoc, markup, class names, hook rules, forbidden calls) that every agent reads kept concurrent agents apart with no cross-talk across slices 6 to 9. Write it first, then the briefs point at it. When the orchestrator's later decisions override a contract line, write them in a notes file the brief names as the override, and repeat the override to the reviewers (slice 9: `s9-apply-notes.md`; the scope reviewer flagged a contract line the notes had superseded because its brief did not name the notes).
- Research agents: `WebFetch` returns binary for a PDF; every slice 9 agent saved the file and ran `pdftotext` locally. Anduril pages render only a title to `WebFetch`; the spec table lives in embedded JSON and `curl` reads it. EDR Magazine returns 429 to `WebFetch` and 200 to `curl`. thalesgroup.com sits behind an Incapsula challenge; leonardodrs.com, drsrada.com, defense.flir.com, businesswire, congress.gov, dote.osd.mil return 403 through the proxy (F-66).
- A research JSON is data to cross-check, not to trust: the orchestrator ran a scratch vitest file under `src/model/` that compared every seed row's url, date, basis and value to the JSON (zero problems), then deleted it and reported it. The correctness reviewer did the same independently.
- Verify every fixture in a brief against the engine before you cite it (F-49, D-64). A sourced seed change breaks fixtures that assumed the old value: slice 9's Giraffe 1X elevation window broke seven series and sim tests that fly a threat overhead; the repair pins the fixture (F-67), never the seed.
- A value import from a leaf module into `store.ts`'s dependency creates a cycle (F-19). `sim.ts` imports from `store.ts`, so `store.ts` must never value-import `mcRun.ts`, `series.ts`, `impact.ts` or `attrition.ts` (`import type` is safe). `seed.ts` is a leaf; `store.ts` imports `SEED_LIBRARY` from it for `resetModelToSeed`.
- zustand 5 hands `react-dom/server` the store's `getInitialState()` snapshot: every static panel test runs `Object.assign(useStore.getInitialState(), useStore.getState())` before each render (F-39). `Inspector.test.tsx` and `LibraryEditor.test.tsx` are the slice 9 examples; the Inspector renders in static markup.
- Undo and redo restore through `set`, not `mutate`; a rule added to `mutate` must be added to both (F-57).
- Briefs must state the file ownership list verbatim and say "if you must touch another file, report it". Every agent honored that across nine slices. Orchestrator-approved additions and moves are listed in the brief and repeated to the scope reviewer as "do not flag these".
- Phases with disjoint files can run together: slice 9 ran the design agent beside the apply agent (D-77). The design agent and the four gates ran concurrently as before; the scope reviewer checks `CLAUDE.md` and `index.css` last and prints their mtimes, browser-verify prints the sheet md5 at both ends.
- Run `npx tsc --noEmit -p tsconfig.app.json` and `npx vitest run` yourself between phases. Under auto mode count lint with `npm run lint 2>&1 | grep -c warning`.
- Ask Fable reviewers for "findings first, evidence per finding, confirmed vs plausible, under N lines". Give the correctness reviewer the orchestrator-fixed rules so it flags deviations, not the rules. A scratch test inside `src/` that is run and deleted is allowed and must be reported.
- Apply the fix phase after browser-verify reports, not before: Vite hot-reloads the file under the running check. A fix after the final gate is allowed when it is small: re-run the four commands yourself and take the screenshot yourself (slice 9 did this for the Inspector range-row tags, F-72; Playwright with the sandbox disabled, one script, one screenshot).
- The fix phase is one Python script of asserted string replacements (`assert s.count(old) == 1`), then tsc, vitest, oxlint on the touched files. `npx prettier` is not installed; check `awk 'length > 100'` on the files you touched (`Inspector.tsx`, `store.ts`, `series.ts`, `sim.test.ts` carry pre-existing long lines; `seedLibrary.ts` now carries `url:` lines over 100 that hold one unbreakable URL).
- Read the final screenshots yourself (the Read tool renders PNGs). Slice 8's tile gap (F-56) and slice 9's bare range rows (F-72) were visible only in the image.
- Final-gate agents read a diff of one-line markdown bullets as "whitespace only". Check `git diff --word-diff CLAUDE.md` yourself.
- The PLAN acceptance numbers and words are not all right (D-1, D-7, D-14, D-27, D-47, D-64, M-7). When an agent's arithmetic disagrees with PLAN, the agent pins the arithmetic and the orchestrator records a D- row. Do not edit PLAN.md.
- Write the `outstanding.md` rows while the reports are fresh: a draft file in the scratchpad, then one Python script that inserts after the last row of each table. Keep the numbering contiguous (there is no D-58).
- Writes under `~/.claude/` are blocked from Bash by the sandbox; use the Edit or Write tool for the memory file and the agent definitions.
- Never read a subagent's `.output` transcript with `TaskOutput` or `Read`. Wait for the completion notification with an `until grep -q '"stop_reason":"end_turn"' <output file>; do sleep 30; done` loop (a foreground loop times out at 600 s with exit 143 and the notifications still arrive); for several agents wrap the greps in a shell function that returns 1.
- `npx vite-node` is not installed (npx tries to download it and fails on the npm cache). A scratch check that must import TS runs as a vitest file under `src/`.
- Shell `grep` is ugrep: no `--exclude`. Use `git grep` (add `--untracked` for new files).
- A user-facing "push" may cover unpushed earlier commits: check `git log origin/<branch>..HEAD` before you commit or push; report the count.

Browser recipe (give verbatim to gate agents):

- Sandbox blocks the Vite port bind (`listen EPERM`) AND Chromium's mach port bootstrap. Start `npm run dev -- --port <port> --strictPort` and every Playwright run with the sandbox disabled. Ports 5173 to 5199 were used by old processes and slices 4 to 9; take 5200 and up. Start the server as one background command that writes its PID to a file; stop only your own PID.
- Playwright Chromium is installed in the user cache. Scripts import `chromium` from `/Users/caseytalbot/Projects/rangeboard/node_modules/playwright/index.mjs`. Viewport 1400 x 900; pin the right panel with `context.addInitScript(() => localStorage.setItem('rangeboard.rightpanel.width', '320'))`. Playwright uses its own profile, so the user's real autosave is never reachable.
- Pre-slice save-shape check: build a scenario, read the autosave the app wrote, strip the fields the slice added, write it back, reload, expect no `rangeboard.scenario.recovered.*` key. Slice 9's version (F-14): strip a builtin's `provenance` and edit one field; after the reload the unedited fields carry seed rows and the edited field has none.
- `window.__store.getState()`: models on `scenario.library` (ids `lib-giraffe1x`, `lib-coyote`, `lib-mohajer6`, `lib-mavic3`, `lib-kurfs`, `lib-faadc2`, `lib-rps42`, `lib-orlan10`, `lib-babayaga`, `lib-m350`, `lib-a422`, `lib-echoguard`, `lib-xbaeu`), `addEntityFromModel(modelId, pos)` (new entity is `scenario.entities.at(-1)`), `updateEntity(id, patch)`, `beginPath(id)` then `addDraftPoint(p)` and `finishPath()`, `beginConnect(fromId)` then `completeConnect(toId)`, `setRightTab('inspect' | 'analysis' | 'library' | 'cards')`, `select({ entityIds: [id] })`, `select({ libraryId: id })`, `clearSelection()`, `selectSystem(systemId)`, `patchScenario(partial)` (undoable), `updateModel(id, patch)`, `addModel(kind)` (returns the id), `resetModelToSeed(id)`, `deleteSelection()`, `startRun()`, `advanceRun(t)`, `pauseRun()`, `scrubTo(t)`, `setSimTime(t)`, `resetRun('manual')`, `applyLens(id)`, `runMonteCarlo()`, `mcMessage(m)`, `undo()`, `redo()`, and the state `mc`, `playback`, `past`, `selection`. Autosave key `rangeboard.scenario.v1`, 500 ms debounce; layers `rangeboard.layers.v1`; rings `rangeboard.rings.v1`; analysis layout `rangeboard.analysis.v1`. Section titles and tile labels render uppercase through CSS; match case-insensitively on `textContent`. Default units are aviation.
- Scenario A (analysis panel and the four panes): Giraffe 1X at `(0, 0)`, Coyote at `(1697, -1697)`, FAAD C2 at `(-600, 0)`, Mohajer-6 at `(0, -14000)` with `altitudeFt` 14000 and path end `(0, -800)`, Mavic 3 at `(0, -3000)` with path end `(0, -100)`, connections Giraffe to C2 and C2 to Coyote; `startRun(); advanceRun(120); pauseRun()` observes T+2:00. Since slice 9 the Giraffe 1X carries `elevationDeg [0, 70]`: a threat overhead at 14,000 ft leaves its window at short ground range. Scenario B (five threats, `build_mockup.py` `THREATS` line 58) lasts 10:51 (M-7).
- COAST fixture (verified at `780dbb2`): custom radar (`addModel('sensor')`, `updateModel` with `sensorType 'radar'`, `sectorDeg 360`, `detectRangeM 3000`, `updateRateS 1`, `rangeBasis 'planning'`) at the origin, Mavic 3 at `(0, -2600)` with the out-and-back path `(0, -2600) -> (0, -3260) -> (0, -2600)` at 60 m/s: intervals `[[0, 10.5], [16, 22.5]]`, coast `[[7, 10.5]]`, `trackInitAtS` 2.
- Panel DOM after slice 9: Inspector rows `.insp-row .insp-row-label / .insp-row-value` with `.unit` and the tag `span.pf` (title `planning factor`) or `span.pf.src` (title `<basis> · <source> · <date>`) on the detection range, azimuth, reported range, placard Pd and Pfa, scan period, track initiation, track drop, elevation, altitude ceiling, Swerling and mount "In use" rows; LibraryEditor `div.subsection.src` with `table.tb.src-tb` (Field, Value, Basis, Source, Date; a sixth remove column on a custom model), `form.src-add` (custom only), `.inspector-actions` with "Reset to seed" (builtin only), Duplicate, Delete model; the analysis panel DOM of slice 8 (`.live-strip`, `.lens`, `section.wg`, `.tiles`, `.detail[data-detail=...]`, `.rows .row .rl/.rv`, `table.tb`, `.chart-ladder svg`, `.recharts-wrapper`). Overflow check: `scrollWidth <= clientWidth` on `.right-panel`, `.right-panel-body`, every `section.wg`, `.src-tb`, `.src-add`, `.mc-pop` and `.detail`; type floor: every element under `.right-panel *` with own text at `>= 10px`, except the `<text>` inside the header `Glyph` SVG (F-51).
- `cleanReset` uses `window.confirm` when a run is dirty; never click `.run-reset` with a dirty run, or register `page.on('dialog', d => d.accept())` first.

## Slice 9 as built (facts a follow-on needs)

- `Provenance` (`src/model/types.ts`): `{ field, value, source, url?, date, basis: 'datasheet' | 'reference' | 'pf' }`. Every one of the 19 radar seeds carries a `provenance` array with a `detectRangeM` row first (6 are `pf`: LSTAR, TPQ-53, XBAEU, Sentinel A4, G/ATOR, GM200). 56 rows; 41 datasheet, 9 reference. Rules: D-71 (basis), D-72 (rows), D-73 (value changes), D-74 (the 18 changes). Non-radar sensors, effectors and threats carry no rows; that is the natural next pass (PLAN "Stays out").
- `adoptSeedProvenance(saved, seed)` (`src/io/persist.ts`, exported, called from `fillScenario`): copies a seed row onto a saved builtin when the saved field value equals the seed value by `JSON.stringify` and no saved row covers the field. `resetModelToSeed(id)` (`store.ts`, through `mutate`, no-op when equal, custom or unknown) replaces the whole entry (F-71).
- `PfTag` and `pfaText` live in `src/panels/inspector/kit.tsx`; `detailRows.tsx` re-exports `PfTag`. `Row` has `tag?: ReactNode`. `basisTag` is gone. `MountHeight` still exists twice (F-6).
- LibraryEditor "Sources": `Sources` component keyed by model id, `BASIS_CHOICES`, one row per field, add and delete only on a custom model. CSS `.src-tb` (fixed layout, cells clip with an ellipsis at 320 px, F-70) after the `.tb` rules and `.src-add` after `.field-row`.
- Tests: `seedLibrary.test.ts` (19 radars, a `detectRangeM` row each, date pattern, basis union, `http` url on non-pf rows, `null` url on pf rows, no duplicate field); `persist.test.ts` and `store.test.ts` appended; `Inspector.test.tsx`, `LibraryEditor.test.tsx` new.
- Research: no page carried a Swerling table or a Pd curve (D-6, D-8 open); the Blighter six-point RCS-to-range table and the Echodyne per-group bands are in F-65. Slice 9 scratchpad (`s9/`: contract, briefs, `radars-a.json` to `-d.json`, `s9-apply-notes.md`, screenshots) lives in the session c5c8832b scratchpad; the JSON never entered the repo. If a follow-on needs the research again, re-fetch; the rows in the seed carry the URL and the date.

## Open work a follow-on session can take (all from `outstanding.md`; the user names the rows)

- The user's accept-or-overrule list: D-71 to D-77 (slice 9 rules and the 18 value changes; RPS-62 3 km and Long Range Sentry 2 km rest on one page each), D-60 to D-70 (Monte Carlo), and the earlier D rows.
- F-61 rewrite six radar descriptions from their rows; F-62 SPEXER back-solved RCS; F-63 `pfaText` lint warning; F-64 action-row wrapping; F-66 re-fetch the manufacturer pages that the proxy could not reach; F-70 Sources table clipping; F-71 per-field reset; F-6 `MountHeight` twice; F-19 and F-59 the `store.ts` helpers that drag the store into the worker chunk; F-51 the glyph type floor; F-53 and F-55 metas that ellipsize at 320 px.
- A provenance pass over EO/IR, RF, acoustic sensors, effectors and threat RCS values (PLAN slice 9 "Stays out"), run with the slice 9 shape: contract, four research agents on Fable medium, apply on Opus high, gates as above.
- M-1 to M-8 mockup regeneration.

## Standard brief skeleton (used for every agent in slices 0 to 9)

1. Role name, slice, repo path, branch, "work in the main tree, no branch / commit / push / stash, no `npm run build` in a build phase, no `git add`, no edits under docs/".
2. Read order: the shared contract file, CLAUDE.md (named headings), PLAN section 5 slice N, HANDOFF sections 2 and 4 slice N, the mockup section.
3. What earlier phases landed (exports and signatures, verbatim), "read, do not edit".
4. "You own ONLY" list, verbatim from the ownership table plus orchestrator-approved additions, plus the rule to report rather than touch.
5. Contract lines to implement, with line numbers found by the orchestrator's scouting, and the orchestrator-fixed readings of every ambiguous line (so agents do not reopen them).
6. Tests to add (from the acceptance list) and the fixture-pin rules (altitude, Swerling, the zustand static-markup sync, engine-verified fixtures).
7. Style line, STE line, PF line, no TODO, export only what a sibling or a test imports.
8. Verify commands, the baseline counts, and the exact report shape; "never claim a result without tool output".
9. The first line of the Agent prompt names the effort class (the user's rule above).

## Do not

- Do not edit `docs/data-engine/PLAN.md` or `HANDOFF.md`; report discrepancies in `outstanding.md`.
- Do not edit `docs/inventory/`; it is the August research record.
- Do not touch `src/te/` (HANDOFF section 7) even though `DesignPanel.tsx:1115` is stale (D-2 is open).
- Do not bump `schemaVersion`. Every new field is optional with a default in `emptyScenario()`; `fillScenario` spreads the top level.
- Do not invent a value to fill a blank, and do not let an agent do it: a blank stays PF.
- Do not start follow-on work before the user names it.
- Do not use `Workflow` unless the user says "use a workflow".
- Do not push unless the user says push.
