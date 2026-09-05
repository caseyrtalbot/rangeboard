# RangeBoard

RangeBoard is a local-first C-UAS Test & Evaluation planning application. The **Board**
workspace combines a meter-scaled canvas, system/threat library, flight paths, playback
and deterministic/Monte Carlo analysis. **T&E Ops** carries campaign questions, measures,
test cards, runs, findings and deliverables in a separate store.

The engine combines physical relationships with explicit planning factors and provenance.
The next development stage targets field workflows, stronger model evidence and a more
usable interface. The current application is a single-user React/TypeScript web app with
localStorage persistence. Offline installation and field durability are planned work.

## Engineering entrypoints

1. [AGENTS.md](AGENTS.md): durable engineering contract for every contributor.
2. [AI_HANDOFF.md](docs/AI_HANDOFF.md): current scope, state, evidence and next action.
3. [Outstanding register](docs/data-engine/outstanding.md): decisions and follow-ups.
4. [Field T&E plan](docs/field-te/PLAN.md): proposed correction and enhancement sequence.
5. [Ownership findings](docs/field-te/OWNERSHIP_FINDINGS.md) and
   [backlog triage](docs/field-te/BACKLOG_TRIAGE.md): evidence and inherited task routing.

Historical plans and research are classified in AGENTS.md. Source and tests determine
implemented behavior; an old plan or accepted decision is not proof of completion.

## Local development

Install the locked dependencies with `npm ci`, then start the Vite server:

```sh
npm run dev
```

Run the engineering gates:

```sh
npx tsc --noEmit -p tsconfig.app.json
npx vitest run
npm run lint
npm run build
```

Use a separate browser profile for scripted checks so the user's saved work is preserved.
Read the persistence and browser rules in AGENTS.md before testing save/import changes.
