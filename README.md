# RangeBoard

RangeBoard is a local-first, single-user C-UAS test and evaluation planning web app. The
Board workspace has a meter-scaled canvas, a system and threat library, flight paths,
playback and deterministic and Monte Carlo analysis. T&E Ops carries campaign questions,
measures, test cards, runs, findings and deliverables in its own store. React 19,
TypeScript, Vite. No backend. Persistence is `localStorage`.

Every estimate carries its uncertainty, quantity, units, denominator and horizon. An
unsourced number is a planning factor and is labeled as one.

## Where to read

1. [CLAUDE.md](CLAUDE.md): codebase guide, commands, architecture, invariants, code style.
2. [Document index](docs/README.md): current reference, dated records, source material.
3. [Engineering reference](docs/ENGINEERING_REFERENCE.md): equations, one-source facts,
   UI rules, the T&E module, the standards table.
4. [Verification guide](docs/VERIFICATION.md): browser, import and recovery procedures.

Source and tests decide what is built.

## Local development

```sh
npm ci
npm run dev -- --port <port> --strictPort
```

The type check, tests, lint and build commands are in [CLAUDE.md](CLAUDE.md#commands).
Run them before a commit that touches source.
