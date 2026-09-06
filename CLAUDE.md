# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What RangeBoard is

RangeBoard is a local-first, single-user C-UAS test and evaluation planning web app. React 19,
TypeScript, react-konva, zustand 5, recharts 3, vitest, oxlint, Vite. No backend, no server,
no CI. Persistence is `localStorage`. Two workspaces share one page: the Board (canvas,
library, flight paths, playback, deterministic and Monte Carlo analysis) and T&E Ops
(campaign questions, measures, test cards, runs, findings, deliverables) with its own store.

Model results support test design. Every estimate carries its uncertainty, quantity, units,
denominator and horizon. An undefined result stays unavailable. An unsourced number is a
planning factor (PF) and is labeled as one. Do not invent a value to fill a gap.

## Where to read

- Document index: [docs/README.md](docs/README.md). There is no plan, handoff or task
  list in the repository. Work starts from the user's request and the source.
- Architecture, equations, invariants, source locations:
  [docs/ENGINEERING_REFERENCE.md](docs/ENGINEERING_REFERENCE.md). Open it by section for
  the code the task touches. Do not read it cover to cover.
- Test conventions, browser checks, fixtures: [docs/VERIFICATION.md](docs/VERIFICATION.md).
- Design system (surface rules, tokens, type roles, components):
  [docs/design/DESIGN_SYSTEM.md](docs/design/DESIGN_SYSTEM.md).
- Source and tests decide what is built. Dated records under `docs/field-te/` and the
  evidence directory describe past captures, not current tasking.

## Commands

```sh
npm ci                                       # install locked dependencies
npm run dev -- --port <port> --strictPort    # Vite dev server
npx tsc --noEmit -p tsconfig.app.json        # type check
npx vitest run                               # all tests
npx vitest run src/playback/pk.test.ts       # one file
npx vitest run -t 'name fragment'            # tests whose name matches
npm run lint                                 # oxlint
npm run build                                # tsc -b && vite build
node src/io/generateRuntimeSchema.mjs        # regenerate runtime schema descriptors
node src/io/generateRuntimeSchema.mjs --check
```

Run the type check, tests, lint and build before a commit that touches source. Regenerate
the runtime schema after a domain type change, then run it with `--check`. The lint baseline
is a fixed set of `react/only-export-components` warnings; do not add to it.

## Architecture

Data flow: Konva event, store action, new `Scenario`, React re-render of layers and panels.
The Konva tree and every panel are pure views of the store. Drag in progress is Konva-native;
the store updates once on `dragend`.

- `src/model/`: domain types (`types.ts`), `emptyScenario`, seed library with provenance
  rows, planning-factor tiers. `model/scenario.ts` is a leaf that owns `modelFor`,
  `pathSpeed` and `scenarioDurationS`.
- `src/geometry/`: `geo.ts` (bearings, wedges, path interpolation, `posAtTime`),
  `slant.ts`, `prng.ts` (mulberry32, `idHash`, `hashU01`), `webmerc.ts`. All pure.
- `src/state/store.ts`: the one Board zustand store: scenario, history, selection, camera,
  ui, playback and the `mc` slice. Helpers beside it: `analysisBasis.ts`, `runState.ts`,
  `layers.ts`, `rings.ts`, `raidBuilder.ts`, `selectors.ts`.
- `src/playback/`: the engine. `clock.ts` (`DT` 0.5 s), `detection.ts`, `killChain.ts`,
  `sim.ts` (`assessAllThreats`), `attrition.ts` (`resolveEngagements`), `intercept.ts`,
  `pk.ts`, `tactics.ts`, `trackState.ts`, `policy.ts` (`DrawPolicy`), `mcRun.ts`
  (`runReplicates`, `runSensitivity`, `DEFAULT_BUDGET`), `mc.worker.ts` and `mcClient.ts`.
- `src/analysis/`: sensor and radar physics, EW, doctrine factors, `impact.ts`
  (`engagementPicture`, a WeakMap cache keyed on the scenario object), live KPIs, chart
  series, run validity, requirements, uncertainty sampling, fidelity tags, AAR.
- `src/io/`: `persist.ts` (autosave, `fillScenario`, import and export), `storageKeys.ts`,
  `runtimeSchema.ts` plus its generator, `runtimeValidation.ts`, `validateScenario.ts`,
  `recovery.ts`, `viewState.ts`.
- `src/canvas/`: `CanvasStage.tsx` and one Konva layer per concern under `layers/`.
  `frameClock.ts` derives display time from the last published `simTimeS`.
- `src/panels/`: Toolbar, Palette, Inspector, LibraryEditor, AnalysisPanel (widgets and
  detail views under `analysis/`), TimelineBar (owns the rAF loop), CommandPalette.
- `src/ui/kit.tsx` and `src/charts/`: shared primitives and the recharts kit. Props only.
  They never read a store. `src/ui/ink.ts` is the one Konva ink table (danger red, entity
  kind fallback colors) that the layers, the palette glyphs, the detail panels and
  `trackState` share.
- `src/te/`: T&E Ops. Own store `te/state/teStore.ts` at `rangeboard.te.v1`, no undo,
  versioned append-only records, gates in `te/validate.ts`, pure calculations in
  `te/calc/`, print artifacts in `te/print/`. The Board engine imports only the statistics
  in `te/calc/stats.ts` from this module.
- `src/main.tsx` loads the autosave, starts both autosaves and exposes `window.__store` and
  `window.__teStore` in dev builds. Browser checks drive real store actions through them.

## Invariants

These span files. Breaking one breaks the app.

- Coordinates are meters: +x east, +y south. Heading 0 is north, clockwise. Camera scale is
  pixels per meter. Use the resolvers in `src/geometry/geo.ts`.
- Scenario mutations go through `mutate`, which pushes a snapshot to `past`. Derived
  analysis, playback positions and view state go through `set` and never enter history.
  `Scenario.observedPresetId` is the one exception: it is stamped through `set`.
- Playback is derived. Position at time t comes from `posAtTime`. Any pulse or playhead
  derives from `simTimeS` or the frame clock, never a timer.
- Monte Carlo and sensitivity results are derived, unpersisted state in the `mc` slice.
  `analysisBasisSignature` marks a result stale after an edit, undo or redo. The store
  accepts worker callbacks only for the current slot, playback id and basis.
- `store.ts` never value-imports `mcRun.ts`, `series.ts`, `impact.ts` or `attrition.ts`.
  The worker import graph reaches no store, React, zustand, `localStorage` or panel module.
- `DrawPolicy` is the one draw point. No `Math.random` under `src/`. The engine draws in
  exactly five places.
- Storage keys live in `src/io/storageKeys.ts`. Never rename one; add a new key. Every
  settings key (widths, collapse flags, units, layers, view, rings, analysis layout, run
  sequence) is read and written through `readSetting` and `writeSetting` in
  `src/io/viewState.ts`, which swallow a blocked or full store. The scenario and T&E
  autosaves keep their own error path because a lost save must be reported.
  `Scenario.schemaVersion` is 1 and has never been bumped. A new scenario field is optional
  with a default in `emptyScenario()`; a new nested object needs a `fillScenario` line.
- Saved and imported data pass runtime validation before adoption. A save that cannot load
  is copied to `rangeboard.scenario.recovered.<ms>` first. Failed recovery keeps the sole
  raw copy and suppresses autosave.
- Requirement thresholds come from `Scenario.requirements` spread over
  `DEFAULT_REQUIREMENT_THRESHOLDS`. Never gate a requirement on an engine constant.
- One definition per fact: reuse resolvers, statistics, labels and design tokens. A
  displayed statistic uses its own interval. Mean confidence intervals and replicate
  quantiles stay distinct. Arrival and CPA stay distinct. Expenditure channels stay separate.
- Never embed campaign data in `Scenario`. The T&E store and the Board store stay separate.

## Code style

2 spaces, no semicolons, single quotes, named exports, `interface` for object shapes, JSDoc
on exported symbols, short rationale comments, lines near 100 characters. No formatter.
No TODO markers, no unused exports. UI copy is short active sentences in the domain's
terms, with no em-dashes. Konva, CSS-token and 320 px panel rules are in the engineering
reference, section 7. Type floor and tokens follow the design system.

## Tests

- No jsdom, no testing-library. Tests colocate as `*.test.ts` and `*.test.tsx`. Engine,
  geometry and store logic stay in pure TypeScript so they test without a DOM.
- Component tests use `renderToStaticMarkup` and assert on the HTML string. Recharts sizes
  its chart in an effect, so a chart renders only its wrapper div in static markup. Static
  markup proves nothing about a chart; a UI change gets a browser check.
- zustand 5 hands `react-dom/server` the store's `getInitialState()` snapshot. A
  static-markup test of a store reader runs
  `Object.assign(useStore.getInitialState(), useStore.getState())` before each render.
- A statistical test asserts within 3 standard errors of an analytic value named in a
  comment.
- A refactor of engine, store or playback code proves fixed-ID parity against the latest
  numerical capture under `docs/field-te/evidence/` (deterministic, aleatory MC, total MC,
  sensitivity), run as a scratch vitest file.
- A scratch check that imports TypeScript runs as a vitest file under `src/` and is deleted
  after. `npx vite-node` is not installed.

## Claude Code environment notes

These facts are about the Claude Code tool environment, not about the project.

- The sandbox blocks the Vite port bind (`listen EPERM`) and Chromium's mach port
  bootstrap. Run the dev server and every Playwright script with the sandbox disabled.
  Ports 5173 to 5200 have been used by old processes; take a higher port with
  `--strictPort`, start the server as one background command that writes its PID, and stop
  only your own server. Stopping that server (`kill`) and running the Playwright probe also
  need the sandbox disabled. Bash process substitution (`<(...)`) fails in the sandbox; write
  temp files under `$TMPDIR` and diff those. A sandbox-disabled command sees the system
  `$TMPDIR` (`/var/folders/...`), not the sandbox one, so a file written by a sandboxed
  command is absent there; write files both modes share under the session scratchpad by
  its absolute path.
- The Browser pane cannot render a `file://` page. Serve a local HTML file with
  `python3 -m http.server` on a high port with the sandbox disabled, load it by URL, and
  stop the server when done.
- Playwright uses its own browser profile, so the user's autosave is never touched. Use an
  isolated context for every scripted check.
- The shell `grep` is ugrep (no `--exclude`). Use `git grep` (`--untracked` for new files).
- `WebFetch` returns binary for a PDF: save it and run `pdftotext`. Several manufacturer
  domains return 403 or a bot challenge through the proxy.
- Writes under `~/.claude/` are blocked from Bash; use the Edit or Write tool there.
- `.claude/` is untracked and stays untracked.
