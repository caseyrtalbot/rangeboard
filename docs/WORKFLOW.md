# Working on RangeBoard

The user's request selects the work. Old plans were cancelled on 2026-09-06 and remain
in Git history. Historical phase labels and proposed actions do not authorize new work.

## A bounded change

1. Read [AGENTS.md](../AGENTS.md), inspect branch/status, then follow the
   [project guide](PROJECT_GUIDE.md) to the requested behavior and its tests.
2. State the outcome, owned files, verification and stop condition. Preserve unrelated
   changes. Use a `codex/` branch for an isolated slice when appropriate.
3. Capture a baseline before refactoring. Read both producers and consumers; preserve
   public interfaces, save compatibility and numerical behavior unless the task changes them.
   A new engine model that would move a golden fixture is pinned on the fixture, with the
   physics switch that holds the old path, and its timeline is captured before and after
   under [evidence](field-te/evidence/). Never tune the model to the fixture.
4. Make the bounded change and run focused checks. Run `npm run check` for the complete
   local gate. Add browser or parity evidence as described in [verification](VERIFICATION.md).
   Engine captures go through `scripts/evidence/capture.mjs`, and `npm run check:evidence`
   fails on a byte-identical JSON copy or an uncompressed JSON capture over 512 kB, with
   `scripts/evidence/allowlist.json` naming the fixtures that tests import.
5. Update affected references, review source fingerprints, inspect the diff and report
   results and remaining uncertainty. Commit/push only when authorized.

The [Quality workflow](../.github/workflows/quality.yml) runs `npm ci` and the same
`npm run check` gate on pushes and pull requests with Node 22. It then runs
`npm run check:silent` on the lines the push or pull request added, checks the built
bundle budget, installs Playwright Chromium, starts Vite on fixed port 5377, waits for
readiness, runs `npm run test:e2e` and stops its server even on failure. The budget uses
`gzip -9`: at most 366,000 bytes for the entry and 400,000 for initial JavaScript plus CSS
(entry, modulepreloads and stylesheets), following the Wave 3 evidence method. Font and
other preloads and the all-in total are reported separately. Remote CI results require a
pushed commit; local checks do not establish GitHub status. Remote branch protection is
a separate repository setting.

`npm test` discovers only current tests under `src/`; ignored historical checkouts are
outside that scope. A lane worktree inside the repository is another such checkout, so
while one exists select a file with `npx vitest run --dir src <file>` and never a bare
`npx vitest run`, which walks the copies too. Documentation, bundle and browser checks
use their separate commands.

## Documentation maintenance

Current documentation must describe current code. Fix or remove superseded guidance in
the same change; do not retain competing active descriptions or mark an active guide
"deprecated" while leaving readers to choose. Source and tests decide implementation.

| Kind | Place and maintenance |
| --- | --- |
| Agent instructions | Root `AGENTS.md`, kept to at most 80 lines. `CLAUDE.md` only redirects to it. No session state or architecture dump. |
| Current references | Root `README.md`, this workflow, project/engineering/verification guides, `docs/README.md`, the design system, and the [handoff](HANDOFF.md). Each is registered in [maintenance.json](maintenance.json). |
| Historical evidence | `docs/field-te/`, including dated captures and model dossiers. Dates, measurements and limitations describe the capture, not the current tree. Preserve evidence paths used by tests and scripts. An identical repeat is recorded as a manifest `sameAs` entry, and a large capture is stored as `.json.gz`. |
| Source material | `docs/te-compilation/`, `docs/inventory/` and `docs/threat/`. Preserve unique source content and distinguish original intent from implemented behavior. |
| Session state | A task message selects work. When a plan file exists, it stays unmodified and the handoff links to it. The central [handoff](HANDOFF.md) holds the position, the current task if any and the landmines. Rewrite it in place, never as a journal. Completed work is recorded in the evidence index and commits, never in the plan or the handoff. Temporary logs, screenshots and scratch scripts stay outside tracked documentation. |

Every Markdown file must have a direct link in [the index](README.md), except the index
itself. Add a current reference only when no existing document owns the subject; register
its source inputs. Dated records may be added in their established directories, but must
identify their capture date and scope. Keep originals and numerical captures intact;
formatting corrections to research Markdown do not revalidate its source claims.

`npm run docs:check` runs Markdown lint, relative path/fragment checks, placement/index
checks, and source-review fingerprints. Changes to a registered input or guide invalidate
that guide's recorded review. Read the changed inputs, correct the document if needed,
then acknowledge **that document** with a concrete explanation:

```sh
npm run docs:review -- docs/ENGINEERING_REFERENCE.md --note "Reviewed the worker extraction against sections 3-5; updated module ownership."
npm run docs:check
```

Repeat for each reference reported by the check. A review may explain why text remains
accurate after an internal change. Never refresh fingerprints just to clear the gate.
The hashes detect changed inputs; they cannot prove prose is semantically correct or
that an external source remains current. Review those claims when the work relies on them.

Markdown lint runs on all repository Markdown outside dependencies, build output and
the ignored local harness. Long technical lines and table padding are allowed. Source
compilations retain quoted heading styles, bracketed form placeholders and bare source
URLs under a scoped configuration; structural spacing, table shape and links are checked.

`npm run docs:fix` applies mechanical Markdown fixes. Inspect the diff, especially formulas,
tables and extracted source text. Do not rewrite original numerical/hash manifests to
pretend an old capture is current. Use Git history to retrieve its original bytes.

## Handoffs and orchestration

A task handoff carries exactly one session task. The central `docs/HANDOFF.md` has fixed
sections: Position, Tasking, Landmines and Evidence. It holds the current task if any,
never completed work; archived wave plans cannot select a new task. A task message
selects work. When a plan file exists, it stays unmodified as rows complete, and the
handoff links to it. Rewrite the handoff in place after each task. Point to current
source and docs instead of copying them. For each task in the Tasking section, include:

- Repository, branch/base commit and dirty paths relevant to the next task.
- Requested outcome, owned files and explicit exclusions.
- Verified checks with evidence paths; separate user reports and unverified assumptions.
- One next action, completion checks and a stop condition.

For requested parallel work, give each lane a bounded task with disjoint file ownership.
A lane may run in its own worktree; tell it to scope test selection with `--dir src` and
to remove the worktree at the merge. One integrator owns shared types, stores, schema
generation, shared docs and integration.
Tell workers they share the tree and must preserve others' edits. Each lane returns its
diff, checks and unresolved findings. After the batch, independently review consistency
and run the integrated checks. Do not infer that a lane's green test proves the whole change.

At a context switch retain active task/status, verification evidence, lane findings,
corrected errors and architectural decisions. Remove disposable scratch tests from `src/`.
Stop at the selected outcome; a handoff is not authorization for an adjacent refactor.

The concise entry point and separation of reusable project guidance follow the
[Codex instruction discovery guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
and [Astra prompting guidance](https://developers.openai.com/api/docs/guides/latest-model).
