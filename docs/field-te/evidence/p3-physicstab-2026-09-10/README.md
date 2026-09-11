# Lane 3.7 Physics settings verification

Captured 2026-09-10 against base `7c6ee2f` with local, uncommitted lane 3.7 changes.
Scope: settings UI, existing scenario mutation and manifest metadata. No engine model,
draw policy, contract, library data or parity fixture changed. Phase 3 remains incomplete.
The four source files are identified in [source-sha256.json](source-sha256.json).

## Delivered behavior

- Settings gains Physics with nine native checkboxes in canonical manifest order.
- Changes use `patchScenario`; reset writes an empty list. Existing undo, result
  invalidation and autosave behavior apply.
- The six reserved Phase 3 controls disclose that their replacement models are pending.
  Selecting any switch uses the existing manifest rule that sets the floor to `fallback`.

## Verification

- [Complete local check](check.txt): exit 0; 171 Vitest files, 1982 tests passed,
  including the four unchanged parity files. Documentation, engine CLI, library,
  typecheck, schema, lint and build checks passed. Lint warnings and the large-chunk
  build warning remain; the changed source files introduce no lint warnings.
- [Bundle check](bundle.txt): exit 0; entry 351595 bytes and initial JavaScript plus CSS
  367081 bytes, measured with gzip -9, within the 360000 and 400000 byte budgets.
- [Focused settings tests](tests.txt): three files, 18 tests passed;
  [typecheck](typecheck.txt) passed.
- One Astra medium worker implemented the UI. An Astra high contract reviewer checked
  mutation, ordering, persistence and metadata. A separate Astra high reviewer examined
  the integrated source and tests for accessibility, state handling and scope, with no
  actionable findings. The reviewers did not validate physics models.

## Browser

An isolated Playwright browser used port 5388 because 5387 was already occupied. No user
autosave or existing server was touched. The worker stopped its browser and server.

- [Two selected switches survived reload](persistence.txt): `truthTracks` and
  `noFalseTracks`. The first assertion included a background checkbox; restricting it
  to the Settings dialog corrected the harness and the assertion passed.
- [Reset cleared the selections](reset.txt), disabled the reset button and
  [survived another reload](reset-reloaded.txt).
- A new, completed empty-board trial displayed both switches and `fidelityFloor:
  fallback` in Outcome → Manifest. This check verifies metadata and UI only.
- [Browser console](console-errors.txt): zero errors and zero warnings.
- Worker and integrator inspected the rendered Settings at 1440×900 and 1280×800.
  Labels wrap, the section scrolls and all nine controls remain reachable.

Screenshots: [1440×900](physics-1440.png), [after reload at 1280×800](physics-reloaded-1280.png),
[lower controls](physics-bottom-1280.png), [reset](physics-reset-1280.png),
[completed trial manifest](manifest-fallback-1280.png).

## Stop point

Lane 3.7 is locally verified; no commit, push or merge was made. Lanes 3.1 through 3.6
remain unimplemented, and the Phase 3 gate has not been claimed.
