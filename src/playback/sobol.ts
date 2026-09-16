/**
 * Saltelli Sobol indices over the fields Morris kept. Two base matrices A
 * and B of `base` rows in the unit hypercube come from keyed uniforms (a
 * function of seed, row and column only), and AB_i is A with column i taken
 * from B. The first-order index S_i uses the Saltelli 2010 estimator
 * `mean(f(B) (f(AB_i) - f(A))) / V` and the total index S_Ti the Jansen
 * estimator `mean((f(A) - f(AB_i))^2) / (2 V)`, with V the variance of f
 * over the A and B rows together. A percentile bootstrap over the rows
 * gives each index its interval. `sobolIndices` is pure over an evaluator;
 * `sobolLoop` evaluates each row as one aleatory replicate of the scenario.
 */
import type { Scenario } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, runSettings } from '../model/types'
import type { UncertainField } from '../analysis/parameterBasis'
import { hashU01, mulberry32 } from '../geometry/prng'
import { quantile } from '../analysis/stats'
import type { Loop, SensitivityResponse } from './mcRun'
import { endOfRunResponses } from './mcRun'
import type { BootstrapInterval, SobolFieldResult, SobolResult } from './mcTypes'
import { rowScenario, studyBase } from './morris'
import { monteCarloPolicy } from './policy'

/** Bootstrap resamples behind every interval. */
export const SOBOL_BOOTSTRAP = 200

/** The draw kind of the Saltelli matrices; the policy's kinds are 1 to 5, LHS 6, Morris 7. */
const SOBOL_KIND = 8

/** Both indices of every factor, each with its bootstrap interval. */
export interface SobolIndices {
  firstOrder: BootstrapInterval[]
  total: BootstrapInterval[]
  /** Factor indices by total index descending. */
  ranking: number[]
  evaluations: number
}

/** One keyed uniform of matrix `m` (0 for A, 1 for B) at (row, column). */
function draw(seed: number, m: number, row: number, col: number): number {
  return hashU01(seed, row, SOBOL_KIND, m, col, 0, 0)
}

/**
 * The Saltelli rows over `k` factors: `base` rows of A, then `base` of B,
 * then `base` of each AB_i for i in 0..k-1, so row r belongs to base row
 * `r % base`. `base (k + 2)` rows.
 */
export function sobolDesign(k: number, base: number, seed: number): number[][] {
  const a: number[][] = []
  const b: number[][] = []
  for (let r = 0; r < base; r += 1) {
    a.push(Array.from({ length: k }, (_, c) => draw(seed, 0, r, c)))
    b.push(Array.from({ length: k }, (_, c) => draw(seed, 1, r, c)))
  }
  const rows = [...a, ...b]
  for (let i = 0; i < k; i += 1) {
    for (let r = 0; r < base; r += 1) {
      const row = [...a[r]]
      row[i] = b[r][i]
      rows.push(row)
    }
  }
  return rows
}

/** Mean and variance (population form) of the pooled A and B responses over the picked rows. */
function pooledVariance(yA: number[], yB: number[], pick: number[]): number {
  let sum = 0
  for (const r of pick) sum += yA[r] + yB[r]
  const mean = sum / (2 * pick.length)
  let ss = 0
  for (const r of pick) ss += (yA[r] - mean) ** 2 + (yB[r] - mean) ** 2
  return ss / (2 * pick.length)
}

/** The Saltelli first-order and Jansen total estimates of factor i over the picked base rows. */
function estimate(
  yA: number[],
  yB: number[],
  yAB: number[],
  pick: number[],
  v: number,
): { first: number; total: number } {
  let first = 0
  let total = 0
  for (const r of pick) {
    first += yB[r] * (yAB[r] - yA[r])
    total += (yA[r] - yAB[r]) ** 2
  }
  const n = pick.length
  return { first: first / n / v, total: total / (2 * n) / v }
}

/**
 * Indices from the responses `y` of `sobolDesign(k, base, seed)`, in row
 * order. The bootstrap resamples base rows with replacement `bootstrap`
 * times from `mulberry32(seed)` and reports the equal-tailed percentile
 * interval at `confidence`; `value` is the estimate on the full sample.
 */
export function sobolFromResponses(
  y: number[],
  k: number,
  base: number,
  seed: number,
  bootstrap = SOBOL_BOOTSTRAP,
  confidence = 0.95,
): SobolIndices {
  if (y.length !== base * (k + 2)) {
    throw new Error(
      `Sobol takes ${base * (k + 2)} responses for ${k} factors at base ${base}, not ${y.length}`,
    )
  }
  const yA = y.slice(0, base)
  const yB = y.slice(base, 2 * base)
  const yAB = Array.from({ length: k }, (_, i) => y.slice((2 + i) * base, (3 + i) * base))
  const all = Array.from({ length: base }, (_, r) => r)
  const v = pooledVariance(yA, yB, all)
  const full = yAB.map((ab) => estimate(yA, yB, ab, all, v))

  // One resample of the base rows serves every factor, so the intervals pair.
  const next = mulberry32(seed)
  const firsts: number[][] = Array.from({ length: k }, () => [])
  const totals: number[][] = Array.from({ length: k }, () => [])
  for (let b = 0; b < bootstrap; b += 1) {
    const pick = all.map(() => Math.floor(next() * base))
    const vb = pooledVariance(yA, yB, pick)
    yAB.forEach((ab, i) => {
      const e = estimate(yA, yB, ab, pick, vb)
      firsts[i].push(e.first)
      totals[i].push(e.total)
    })
  }
  const lo = (1 - confidence) / 2
  const interval = (value: number, samples: number[]): BootstrapInterval => ({
    value,
    lo: quantile(samples, lo),
    hi: quantile(samples, 1 - lo),
    bootstrap,
    confidence,
  })
  const firstOrder = full.map((e, i) => interval(e.first, firsts[i]))
  const total = full.map((e, i) => interval(e.total, totals[i]))
  const ranking = full.map((_, i) => i).sort((a, b) => full[b].total - full[a].total)
  return { firstOrder, total, ranking, evaluations: y.length }
}

/**
 * Sobol indices over `k` factors: `evaluate` maps unit-hypercube rows to one
 * response each. `base (k + 2)` evaluations.
 */
export function sobolIndices(
  evaluate: (rows: number[][]) => number[],
  k: number,
  base: number,
  seed = 0,
  bootstrap = SOBOL_BOOTSTRAP,
  confidence = 0.95,
): SobolIndices {
  return sobolFromResponses(
    evaluate(sobolDesign(k, base, seed)),
    k,
    base,
    seed,
    bootstrap,
    confidence,
  )
}

/**
 * Sobol indices of `scenario` on `response` over the `kept` fields, with
 * `base` from `sobolBase` and the interval at `confidence`. Each row runs as
 * one aleatory replicate whose index is its base row, so A_r, B_r and every
 * AB_r share their engine draws (common random numbers) and the estimators
 * read paired differences. One checkpoint per row; a stop throws, since the
 * estimators need every row. `onProgress` fires after every row.
 */
export function* sobolLoop(
  scenario: Scenario,
  kept: UncertainField[],
  response: SensitivityResponse = 'leakers',
  onProgress?: (done: number, total: number) => void,
): Loop<SobolResult> {
  const { seed, sobolBase: base, confidence } = runSettings(scenario)
  const studied = studyBase(scenario)
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...studied.requirements }
  const k = kept.length
  const rows = sobolDesign(k, base, seed)
  const total = rows.length
  const y: number[] = []
  for (let r = 0; r < total; r += 1) {
    const policy = monteCarloPolicy(seed, r % base, thresholds)
    y.push(endOfRunResponses(rowScenario(studied, kept, rows[r], 0), policy)[response])
    onProgress?.(r + 1, total)
    if (r + 1 === total) break
    const stop = yield { done: r + 1, total, retained: 0 }
    if (stop) throw new Error(`Sobol ${stop} after ${r + 1} of ${total} rows`)
  }
  const indices = sobolFromResponses(y, k, base, seed, SOBOL_BOOTSTRAP, confidence)
  const fields: SobolFieldResult[] = kept.map((field, i) => ({
    field,
    firstOrder: indices.firstOrder[i],
    total: indices.total[i],
  }))
  return {
    method: 'saltelli',
    base,
    evaluations: total,
    fields,
    ranking: indices.ranking,
    response,
    seed,
  }
}
