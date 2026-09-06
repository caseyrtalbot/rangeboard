# RangeBoard

RangeBoard is a local-first C-UAS Test & Evaluation planning application. The **Board**
workspace combines a meter-scaled canvas, system/threat library, flight paths, playback
and deterministic/Monte Carlo analysis. **T&E Ops** carries campaign questions, measures,
test cards, runs, findings and deliverables in a separate store.

The engine combines physical relationships with explicit planning factors and provenance.
The application is a single-user React/TypeScript web app with localStorage persistence.

## Engineering entrypoints

1. [CLAUDE.md](CLAUDE.md): codebase guide for Claude Code and other agents.
2. [Document index](docs/README.md): current reference, dated records and source material.
3. [Engineering reference](docs/ENGINEERING_REFERENCE.md): module contracts, equations
   and invariants.
4. [Verification guide](docs/VERIFICATION.md): test conventions and browser procedures.

Source and tests determine implemented behavior.

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
Read the persistence rules in the engineering reference and the browser procedures in the
verification guide before testing save/import changes.
