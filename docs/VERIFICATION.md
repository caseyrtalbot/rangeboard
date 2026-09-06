# RangeBoard verification guide

Browser, import and recovery procedures. Test conventions and the tool environment notes
are in [CLAUDE.md](../CLAUDE.md); this guide does not restate them. Run results belong in
a dated record under `field-te/` and its evidence directory, not here.

One note beyond CLAUDE.md: when you touch a statistical test, sweep the entity ids. A
test once passed only by the ids it happened to get.

## Browser checks

- Playwright is a devDependency for scripted checks only. It uses its own browser profile,
  so the user's autosave is never touched. Use an isolated context for every check.
- Dev builds expose `window.__store` (the Board zustand hook) and `window.__teStore`.
  Drive real store actions through them. Read the action interfaces in
  `src/state/store.ts` and `src/te/state/teStore.ts` before you build a harness.
- Inspect state with `window.__store.getState()` and `window.__teStore.getState()`; read a
  fresh snapshot after a mutation. Exercise real worker actions; never inject a success
  message to verify worker integration.
- A Coyote under a fully typed route needs a fire-control source (KuRFS or TPQ-53) in the
  kill chain. `completeConnect` types a hand-drawn link when a researched pairing exists,
  so a laydown Giraffe 1X to FAAD C2 to Coyote reaches the status `no-fc-uplink` and fires
  nothing. Add a KuRFS to a Coyote demo laydown.
- The [detection fixture](../src/playback/__fixtures__/detection-outside-rings.json) is
  that laydown with the Mavic 3 spawned 18 km north, outside every ring: detection at
  250.5 s, four firing events, MC kills mean 0.9 at seed 4821. Load it through
  `parseAutosave` and `loadScenario`. The
  [probe](field-te/evidence/rf20-detection-2026-09-05/rf20-fixture-probe.mjs.txt) confirms
  it through store actions. Use it for detection and warning-time evidence.
- Before a change to the save shape: build a scenario, read the autosave, strip the new
  fields, write it back, reload, and expect no `rangeboard.scenario.recovered.*` key.
- Handle the `window.confirm` dialog before a script clicks the run reset control with a
  dirty run.

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
