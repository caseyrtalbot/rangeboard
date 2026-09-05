# CLAUDE.md

Read `AGENTS.md` first and follow it. It is the one engineering contract for this
repository: what RangeBoard is, the commands and their baseline, the architectural
invariants, one source per fact, the domain rules, the UI rules, the working conventions,
and the status of every document. Nothing in this file overrides it, and nothing from it is
copied here.

Then read, in this order:

1. `docs/AI_HANDOFF.md`, the one current transfer record, with `[V]` `[D]` `[I]` `[U]` marks.
   It names the contributor, the verified revision and the next exact task.
2. `docs/data-engine/outstanding.md`, the live register and the only status authority.
3. `docs/design/DESIGN_CONTRACT.md`, the locked design, before any presentation change.
4. `docs/field-te/PLAN.md`, the engineering acceptance specification, before any engine,
   store, persistence or T&E record change.

## Claude Code environment notes

These facts are about the Claude Code tool environment, not about the project.

- The sandbox blocks the Vite port bind (`listen EPERM`) and Chromium's mach port
  bootstrap. Run the dev server and every Playwright script with the sandbox disabled.
  Ports 5173 to 5200 have been used by old processes; take a higher port with
  `--strictPort`, start the server as one background command that writes its PID, and stop
  only your own server.
- The Browser pane cannot render a `file://` page. Serve a local HTML file with
  `python3 -m http.server` on a high port with the sandbox disabled, load it by URL, and
  stop the server when done.
- The shell `grep` is ugrep (no `--exclude`). Use `git grep` (`--untracked` for new files).
- `npx vite-node` is not installed. A scratch check that imports TypeScript runs as a
  vitest file under `src/` and is deleted after; report it.
- `WebFetch` returns binary for a PDF: save it and run `pdftotext`. Several manufacturer
  domains return 403 or a bot challenge through the proxy (`outstanding.md` F-66, R-F-6).
- Writes under `~/.claude/` are blocked from Bash; use the Edit or Write tool there.
- Do not use the Workflow tool unless the user says "use a workflow".
- Delegated agents are chosen by effort class: a reasoning model at medium effort by
  default; high effort only where the semantics decide the outcome, and always for
  orchestration and correctness review; a mechanical-work model at high effort for
  plumbing, UI chrome, seed edits from a JSON, gates and browser checks. Pre-assign per
  owner in the plan. The agent definitions live in the user's own configuration, outside
  this repository.
