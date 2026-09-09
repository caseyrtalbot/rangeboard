# RangeBoard continuation status

The user's current request selects the work. This file records completion and navigation;
it does not authorize an implementation stage, commit, push or merge.

## Completed work

- The performance and quality refactor completed Waves 0–5 on September 6–7, 2026.
  Its [original handoff](field-te/performance-refactor-handoff-2026-09-07.md) is archived
  unchanged, including measurements, decisions and proposed follow-ups. Its named-library
  task and later wave instructions are historical proposals, not the current queue.
- Playback realism R0–R5 is implemented. [R4 evidence](field-te/evidence/r4-trial-lifecycle-2026-09-07/README.md)
  records trial infrastructure; [R5 evidence](field-te/evidence/r5-sampled-experience-2026-09-08/README.md)
  records the integrated sampled experience: sampled Play is the default, Execute and
  export use one retained trial, and numerical parity, gate, browser and paired timing
  checks passed on September 8, 2026.

## Selected work

None selected. The [analysis rebuild plan](field-te/evidence/analysis-rebuild-plan-2026-09-08.md)
completed on 2026-09-08. Its section 7 records each slice's commit and gate, and the
[evidence folder](field-te/evidence/analysis-rebuild-2026-09-08/README.md) records the
worker assignment, the gate results after every merge and the browser checks. The work
sits on branch `analysis-rebuild` from `77c225e`, with `npm run check`, `check:bundle` and
`test:e2e` green at its head. Merge to `main` and push need explicit authorization.

Recorded follow-ups from the rebuild, none selected:

- Monte Carlo first detect on the detection fixture is about 2 s while the deterministic
  first detect is over 100 s; the new `forecast-trial-disagreement` finding fires on the
  JIATF-401 laydown for the same reason. Inspect the Pd draw in `detection.ts`.
- Compare prints times in seconds; Outcome prints m:ss. Align the formatters.
- The Outcome screen scrolls in a 552 px panel with eight threats.
- Dead code after S9: `.lens-*` and `.wg-*` CSS rules, `OutcomeSummary.tsx`,
  `TrialOutcomeSummary` in `DebriefRecord.tsx`, the `observedPresetId` stamp now a constant.
- Sweep progress carries no partial cell summaries; cells paint at completion.
- Raid-size sweep cells take fresh ids from the time-based allocator, so they are not
  draw-reproducible across runs.
- `SensitivityRow.responses` is optional until the store and widget test fixtures carry it.

## Continuation boundary

The playback realism proposal is complete through R5. Its recorded follow-ups (R1
disabled-asset definedness, R2 horizon captions, preparation latency, axis label clipping)
and the named scenario library are not a queue; each requires a task selecting that work.

Before a new slice, inspect current source, tests and `git status`; read
[AGENTS.md](../AGENTS.md), [verification](VERIFICATION.md), and the
[workflow](WORKFLOW.md#handoffs-and-orchestration). Historical test counts, environment
restrictions and branch names describe their recorded run rather than the current workspace.
