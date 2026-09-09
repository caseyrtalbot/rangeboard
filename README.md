# RangeBoard

RangeBoard is a local-first, single-user C-UAS test and evaluation planning web app. The
Board has a meter-scaled canvas, a system and threat library, flight paths, playback,
deterministic and Monte Carlo analysis and test cards. React 19, TypeScript, Vite. No
backend. Persistence is `localStorage`.

Every estimate carries its uncertainty, quantity, units, denominator and horizon. An
unsourced number is a planning factor and is labeled as one.

## Where to read

1. [AGENTS.md](AGENTS.md): concise agent instructions and working rules.
2. [Project guide](docs/PROJECT_GUIDE.md): features, data flow and refactor boundaries.
3. [Document index](docs/README.md): current reference, dated records, source material.
4. [Engineering reference](docs/ENGINEERING_REFERENCE.md): equations, one-source facts,
   UI rules, the T&E module, the standards table.
5. [Verification guide](docs/VERIFICATION.md): browser, import and recovery procedures.

Source and tests decide what is built.

## Local development

```sh
npm ci
npm run dev -- --port <port> --strictPort
```

Use Node.js 22.12 or later. Run `npm run check` for the complete local gate. Commands and
browser/parity procedures are in the [verification guide](docs/VERIFICATION.md).
Documentation maintenance and handoffs follow the [workflow](docs/WORKFLOW.md).
