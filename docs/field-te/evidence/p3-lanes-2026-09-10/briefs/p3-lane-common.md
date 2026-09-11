# Common rules for every Phase 3 lane (orchestrator, 2026-09-10)

Read AGENTS.md, then your lane's row in docs/IMPLEMENTATION_PLAN.md section 5, then
docs/HANDOFF.md ("Open items") before you edit. The blueprint context you need is in your
lane brief; the plan row is the deliverable and stop condition.

## Setup

- Your worktree is checked out from main at d81ebdb. Create and check out your lane branch
  from it (named in your brief). Commit there; several commits are fine. End each commit
  message with the line:
  `Claude-Session: https://claude.ai/code/session_01HCcoVPrGbCoUDrViZTuF1q`
- Run vitest as `npx vitest run --dir src <paths>`; other lane worktrees exist under
  .claude/worktrees and an unscoped run picks up their files.
- Contract files you must not edit: `src/model/types.ts`, `src/model/libraryField.ts`,
  `src/io/storageKeys.ts`, `src/state/store.ts`, `src/playback/clock.ts`,
  `src/playback/policy.ts`, the parity tests (`sensitivity.parity`, `accuracy.verify`,
  `convergence.verify`, `estimate.parity`) and their fixtures. Every Phase 3 spec key you
  need already exists in `types.ts` (slice 3.a) and every seed file carries a value or a
  null for it (lanes 3.R1 and 3.R2; `docs/inventory/changelog.md` sections "Phase 3
  sensor and threat fields" and "Phase 3 effector fields" list them). If a key or a switch
  you need is missing, stop and report it.

## What the contract gives you

- The sweep step: `src/playback/clock.ts` exports `DT`, `stepIndex`, `stepCount` and
  `createSweepClock`. `attrition.ts` holds one `clock` per run; a burst or dwell lane
  calls `clock.requestFineStep(effectorId, fromS, toS, stepS)` at the salvo commit (the
  hook comment in `attrition.ts`). Inside the window the sweep samples at the fine step;
  outside it, at the base step; with no request the sample times are today's.
- Draw keys: `policy.ts` keys every draw by `stepIndex(tS)`, the DT grid. Inside a fine
  window two ticks in one DT step share a key. Rule for this phase: one draw per burst or
  dwell, keyed at its commit step; a fine tick advances geometry and the timeline and
  draws nothing new. If your model needs a per-tick draw, stop and report it with one
  recommendation; do not edit `policy.ts`.
- Physics switches (`PhysicsSwitch` in `libraryField.ts`, `physicsSwitches(scenario)`):
  `noFlightLimits` (3.1), `rfBandGate` (3.2), `eoirSpanRatio` (3.3), `singlePulseRadar`
  (3.4), `legacyKineticPk` (3.5), `legacyBeamPk` (3.6). Your model runs by default. It
  falls back to today's path when its switch is on OR when the fields it needs are null
  on that system (a laydown with null data still runs; the blueprint rule). The fallback
  path must be bit-identical to today's output.
- Fidelity: add one `MODEL_TAGS` row in `src/analysis/fidelity.ts` for your model (the id
  named in your brief), `tier: 'physics'`, `validation` `'datasheet'` or `'analytic'` as
  your stop condition earns, `standard` quoting a row of docs/ENGINEERING_REFERENCE.md
  section 8 where one applies, and a `note` naming your validation test. Add the id to
  the `ModelId` union, `MODEL_ORDER`, `ENTITY_MODELS` and `usedIds` (used when the
  laydown has a system your model applies to and your switch is off). `fidelity.ts` is
  shared by every lane: touch only your own rows and branches, additive edits only, and
  the orchestrator resolves merge conflicts. Extend `fidelity.test.ts` for your tag only.
- Validation: your stop condition names a datasheet or hand-derived check. Write it as a
  `*.verify.test.ts` beside your module in the style of
  `src/analysis/validation.verify.test.ts` (a header that names the sources with URL
  and read date, every expected number a datasheet value or hand-derived in the
  comment above the assertion, nothing copied from engine output).

## Parity

- Run the four parity files before you report:
  `src/playback/sensitivity.parity.test.ts`, `accuracy.verify.test.ts`,
  `convergence.verify.test.ts`, `estimate.parity.test.ts`. The golden fixtures pin every
  Phase 3 switch, so the first three guard the truth path and must not move.
  `estimate.parity` strips the switches and runs everything on by default, so it may
  move when your physics is on: report each moved number, before and after, with the
  cause, and do not edit the test (the orchestrator re-pins it at the gate). A moved
  number in the first three files is a defect unless you can name the pinned number and
  hand-derive its replacement in your report; then stop and report before editing.

## Report shape

Files changed; the model in one paragraph (equations, constants with their source, the
fallback rule); tests run with their summary lines, the parity result with any moved
number; open items, including any file outside your set that needs an edit (file and
line); the commit hash on your branch; the exact stop point. No claim without tool
output. Decide routine questions yourself; stop and report with one recommendation when
a choice changes the model (a distribution, a threshold, a constant with no source).
