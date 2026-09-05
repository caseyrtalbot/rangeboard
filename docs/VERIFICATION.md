# RangeBoard verification guide

Current procedure. Read with [AGENTS.md](../AGENTS.md). Actual run results belong in the
[current handoff](AI_HANDOFF.md) and linked evidence, not in this guide.

## Test conventions

- No jsdom, no testing-library, no formatter. Unit tests colocate as `*.test.ts` and
  `*.test.tsx`. Keep engine, geometry and store logic in pure TypeScript so it tests
  without a DOM.
- Component tests use `renderToStaticMarkup` and assert on the HTML string. Recharts sizes
  its chart in an effect, so a chart renders only its wrapper div in static markup.
- zustand 5 hands `react-dom/server` the store's `getInitialState()` snapshot. Every
  static-markup test of a store reader runs
  `Object.assign(useStore.getInitialState(), useStore.getState())` before each render.
- A statistical test asserts within 3 standard errors of an analytic value named in a
  comment. When you touch one, sweep the entity ids: a test once passed only by the ids it
  happened to get (`outstanding.md` R-D-23).
- A scratch check that must import TypeScript runs as a vitest file under `src/` and is
  deleted after. Report it.

## Browser verification

- Playwright is a devDependency for scripted browser checks only. Chromium lives in the
  user cache. Playwright uses its own profile, so the user's autosave is never touched.
- Dev builds expose `window.__store` (the Board zustand hook) and `window.__teStore`.
  Browser checks drive real store actions through them. Read the store action interfaces
  in `src/state/store.ts` and `src/te/state/teStore.ts` before building a harness.
- A Coyote under a fully typed route needs a fire-control source (KuRFS or TPQ-53) in the
  kill chain. `completeConnect` types a hand-drawn link when a researched pairing exists,
  so a browser laydown Giraffe 1X to FAAD C2 to Coyote reaches the status `no-fc-uplink`
  and fires nothing. Add a KuRFS to a Coyote demo laydown (`outstanding.md` R-F-20).
- The [detection fixture](../src/playback/__fixtures__/detection-outside-rings.json) is
  that laydown with the Mavic 3 spawned 18 km north, outside every ring: detection at
  250.5 s, four firing events, MC kills mean 0.9 at seed 4821. Load it through
  `parseAutosave` and `loadScenario`; the [probe](field-te/evidence/rf20-detection-2026-09-05/rf20-fixture-probe.mjs.txt)
  confirms it through store actions. Use it for detection and warning-time evidence.
- Before a change to the save shape: build a scenario, read the autosave, strip the new
  fields, write it back, reload, and expect no `rangeboard.scenario.recovered.*` key.
- Never click the run reset control with a dirty run in a script without handling the
  `window.confirm` dialog first.

## Reusable browser entrypoints

Start `npm run dev -- --port <available-port> --strictPort`. Track the server/session you
start and stop only that process. Use the runtime's actual permission mechanism; old
sandbox flags and fixed port assumptions are not portable instructions.

Use an isolated Playwright browser context. A 1400 by 900 viewport and a 320 px right panel
match the preserved wave checks. Before loading the app, set
`rangeboard.rightpanel.width` to `320` through the isolated context's init script.
Use `window.__store.getState()` and `window.__teStore.getState()` to inspect current state;
read a fresh snapshot after a mutation. Exercise real worker actions rather than injecting
success messages when verifying worker integration.

The preserved [wave browser harness](field-te/evidence/wave-c2-c3-e1-2026-09-05/wave-results.js.txt)
loads the [typed firing fixture](field-te/evidence/onboarding-2026-09-04/firing-scenario.json)
through `parseAutosave` and the store's `loadScenario` action. It verifies real-worker
results, freshness, charts and export. The fixture fires four deterministic events with a
routed KuRFS; its spawn-in-ring and unvalidated-model findings limit it to integration
checks. Do not use it as valid detection evidence; the detection fixture above is. See the
[completion record](field-te/WAVE_C2_C3_E1_COMPLETION.md) for measured results.

For native file input, image decoding, library import and recovery, use the preserved
[native import recipe](field-te/evidence/wave-c2-c3-e1-2026-09-05/native-import-recipe.md)
and [recovery harness](field-te/evidence/wave-c2-c3-e1-2026-09-05/wave-recovery.js.txt).
Adapt and inspect these scripts against current source; they are evidence of a dated run.
Capture page errors and inspect rendered results. Check right-panel overflow and text size
against the [UI contract](ENGINEERING_REFERENCE.md#7-ui-and-rendering-invariants).
