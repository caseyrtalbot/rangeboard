# RangeBoard verification guide

Commands and checks for current development. Run results belong in dated evidence or a
session handoff; historical test counts are not the current baseline.

## Commands

Use Node.js 22.12 or later and the committed npm lockfile. Node 22 is the verified local
major version; `.nvmrc` selects it. `npm ci` installs the locked dependencies; no global test or browser package is required.

| Command | Purpose |
| --- | --- |
| `npm run dev -- --port <port> --strictPort` | Start Vite on an available explicit port |
| `npm run typecheck` | Check application and colocated TypeScript tests |
| `npm test` | Run all Vitest tests |
| `npx vitest run --dir src src/playback/pk.test.ts` | Run one file; `-t 'fragment'` selects test names |
| `npm run lint` | Run oxlint; do not add to existing fast-refresh warnings |
| `npm run build` | TypeScript project build and Vite production bundle |
| `npm run schema:generate` | Regenerate runtime descriptors after domain type changes |
| `npm run schema:check` | Reject descriptors that differ from current types |
| `npm run docs:check` | Lint Markdown, validate local links, placement and source review |
| `npm run test:docs` | Exercise documentation maintenance failure paths |
| `npm run test:bundle` | Test bundle accounting and over-budget rejection |
| `npm run check:bundle` | Check the current `dist/` entry and initial JavaScript + CSS gzip budgets |
| `npm run test:e2e` | Run the Board shell Playwright spec against a dev server (`E2E_URL`, default port 5377) |
| `npm run check` | Complete documentation, type, schema, test, lint and build gate |

Run the complete gate for source changes and after integrating lanes. Documentation-only
changes need `docs:check`; maintenance-script changes also need `test:docs`. Update a
source-review fingerprint only after reading the affected document and changed inputs,
following the [maintenance procedure](WORKFLOW.md#documentation-maintenance).

## Test conventions

- `npx vitest run --dir src` limits discovery to the current source when ignored local checkouts
  exist under directories such as `.claude/plans/`; the broad `npm test` command can discover
  those copies too. Record the scope with a test count.
- Tests colocate as `*.test.ts` or `*.test.tsx`; Vitest uses Node, without jsdom or
  testing-library. Keep engine, geometry and store logic testable without a DOM.
- Component checks use `renderToStaticMarkup`. Recharts sizes charts in an effect, so
  static markup only proves a wrapper exists. Inspect charts and UI changes in a browser.
- For a zustand store reader, synchronize its server-render snapshot before each render:
  `Object.assign(useStore.getInitialState(), useStore.getState())`.
- Statistical checks name an analytic expectation and assert within three standard errors.
  Sweep entity IDs when touching such a check; draw identity can hide a lucky fixture.
- Before an engine/store/playback refactor, capture the current baseline using fixed IDs,
  seed and settings: deterministic, aleatory MC, total MC and sensitivity. Compare after
  the change with the same harness. Select applicable preserved fixtures under
  [evidence](field-te/evidence/); old numerical captures describe their original commits.
- Scratch checks that import TypeScript run as Vitest files under `src/`; remove them
  when finished. Node imports in those files follow the existing `@ts-expect-error`
  convention because the app tsconfig omits Node types. `vite-node` is not installed.

## Browser checks

- Playwright is a devDependency for scripted checks only. It uses its own browser profile,
  so the user's autosave is never touched. Use an isolated context for every check.
- Dev builds expose `window.__store` (the Board zustand hook) and `window.__teStore`.
  Drive real store actions through them. Read the action interfaces in
  `src/state/store.ts` and `src/te/state/teStore.ts` before you build a harness.
- R4 trial infrastructure is internal: `prepareTrial` prepares without playing;
  `startTrialRun` explicitly opts in and waits for preparation. Check real-worker equality
  against `runTrial(trial.scenario, trial.manifest)`, cancellation and coexistence with
  MC/sensitivity, and retained identity/completion/observation on Replay. Ordinary Play
  must leave `trial` idle. These checks do not establish R5 sampled display agreement;
  canvas, telemetry and exports still use their existing sources.
- Inspect state with `window.__store.getState()` and `window.__teStore.getState()`; read a
  fresh snapshot after a mutation. Exercise real worker actions; never inject a success
  message to verify worker integration.
- A Coyote under a fully typed route needs a fire-control source (KuRFS or TPQ-53) in the
  kill chain. `completeConnect` types a hand-drawn link when a researched pairing exists,
  so a laydown Giraffe 1X to FAAD C2 to Coyote reaches the status `no-fc-uplink` and fires
  nothing. Add a KuRFS to a Coyote demo laydown.
- The [detection fixture](../src/playback/__fixtures__/detection-outside-rings.json) is
  that laydown with the Mavic 3 spawned 18 km north, outside every ring. The linked
  probe records its historical numerical results; recapture before a parity comparison. Load it through
  `parseAutosave` and `loadScenario`. The
  [probe](field-te/evidence/rf20-detection-2026-09-05/rf20-fixture-probe.mjs.txt) confirms
  it through store actions. Use it for detection and warning-time evidence.
- Before a change to the save shape: build a scenario, read the autosave, strip the new
  fields, write it back, reload, and expect no `rangeboard.scenario.recovered.*` key.
- Handle the `window.confirm` dialog before a script clicks the run reset control with a
  dirty run.
- `scripts/e2e/board-shell.e2e.mjs` is the tracked shell spec (`npm run test:e2e`, a
  `node:test` file). It loads the firing fixture through `parseAutosave` and `loadScenario`
  in the page, then checks phase switching, selection routing, placement, the Escape chain,
  the debrief record and the lens roles against store state. Start the dev server first.
  CI runs it separately after `npm run check` and `npm run check:bundle`, installing Chromium
  and managing its own fixed-port Vite process. Locally the browser and built-bundle checks
  remain separate commands; bundle-accounting unit tests are included in `check`.
- The performance-wave browser harness additionally verifies a widget render failure,
  surviving Board/T&E autosaves, boundary export/reload, oversized frame and snapshot
  refusal, and recovery listing/download/deletion and startup notices. Its dev-only
  `window.__throwWidgetRender` probe takes a widget id; collapse and re-expand that widget
  to throw inside its frame. Delete the hook before Reload. Only the exact injected
  diagnostic is expected; every other page error fails the harness.

## Harness setup

Start `npm run dev -- --port <port> --strictPort`. Stop only the server you started.

A 1400 by 900 viewport and a 320 px right panel match the preserved checks. Set
`rangeboard.rightpanel.width` to `320` through the context's init script before the page
loads. Capture page errors. Check right-panel overflow and text size against the
[UI contract](ENGINEERING_REFERENCE.md#7-ui-and-rendering-invariants).

## Preserved scripts

These scripts are evidence of a dated run. Adapt and inspect them against current source.

- The [wave browser harness](field-te/evidence/wave-c2-c3-e1-2026-09-05/wave-results.js.txt)
  loads the [typed firing fixture](field-te/evidence/onboarding-2026-09-04/firing-scenario.json)
  through `parseAutosave` and `loadScenario` and verifies real-worker results, freshness,
  charts and export. The fixture fires four deterministic events with a routed KuRFS. Its
  spawn-in-ring and unvalidated-model findings limit it to integration checks; it is not
  detection evidence. Measured results are in the
  [wave record](field-te/WAVE_C2_C3_E1_COMPLETION.md).
- For native file input, image decoding, library import and recovery, use the
  [native import recipe](field-te/evidence/wave-c2-c3-e1-2026-09-05/native-import-recipe.md)
  and the [recovery harness](field-te/evidence/wave-c2-c3-e1-2026-09-05/wave-recovery.js.txt).
