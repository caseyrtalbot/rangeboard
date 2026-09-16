# Phase 1 gate evidence, 2026-09-10

Dated capture for the Phase 1 (real-mode statistics) gate of the
then-current `docs/IMPLEMENTATION_PLAN.md`. Measurements describe
the tree at the gate commit on `main`, not the current tree.

## Files

| File | Content |
| --- | --- |
| `check.txt` | `npm run check` output at the gate: docs, docs tests, bundle tests, engine CLI test, library check, typecheck, schema check, 159 test files and 1853 tests, lint, build (entry 1,170 kB, 344.62 kB gzip) |
| `timing.txt` | Integration browser check on `0f5231a`: default run, 1000 replicates on JIATF-401, Morris then Sobol, against blueprint section J |
| [`../p1-runner-2026-09-10/timing.txt`](../p1-runner-2026-09-10/timing.txt) | Lane 1.1 Node runner timing on the largest fixture (`layered-acoustic-merops.json`) and the retained-numbers budget finding |

## Blueprint Phase 1 exit against the evidence

| Exit item | Result |
| --- | --- |
| Pooled, single-worker and command-line summaries identical at one seed | Met: `workerPool.test.ts` (1, 3 and 7 workers, aleatory and total) and `scripts/test-engine-cli.mjs` (3 workers and 1 worker against `runReplicates`) |
| The runner completes 10 000 replicates on the largest fixture | Dropped 2026-09-10 (Casey): `DEFAULT_BUDGET.retainedNumbers` (96 million, a browser guard) refuses the run; 2594 replicates fit and ran in 21.6 s on 14 threads (120 per second). Section J targets are reference values |
| Sobol on a fixture with a known analytic ranking recovers it | Met: Ishigami at base 1024 inside every bootstrap interval, ranking (2, 1, 3) by first order and (1, 2, 3) by total (`sobol.test.ts`) |
| The parity fixtures do not move in aleatory mode | Met: `sensitivity.parity.test.ts`, `accuracy.verify.test.ts`, `convergence.verify.test.ts` unchanged inside `check.txt` |

## Section J targets on this machine (14 cores, 8 pool workers)

| Measure | Target | Measured |
| --- | --- | --- |
| Default run | 10 s | 0.13 s wall, stopped by the half-width rule at 144 replicates |
| 1000 replicates, total | 20 s | 2.2 s wall (0.6 s pool clock) on JIATF-401 |
| Sensitivity, Morris then Sobol on eight fields, base 256 | 60 s | 5.9 s wall to the Sobol chart |
| 10 000 replicates, command line | 3 min (dropped as a gate) | refused by the budget; 2594 in 21.6 s |

## Lane browser checks (reported by the lane workers, scripts kept outside the repo)

- Lane 1.4 (port 5383): the Run tab lists 11 settings with their defaults and a disabled
  reset on an untouched board; Run on Prepare with nothing touched finished at 30
  replicates by the half-width rule on the single worker (before the pool was wired); the
  Deterministic switch disables Run with its reason; Fragility names the depth. 0 page errors.
- Integration (port 5384): see `timing.txt`; the progress line names the pool, the Sobol
  chart renders after Morris. 0 page errors.
- Lane 1.5 had no browser check (the widget was not mounted); the integration check covers it.
