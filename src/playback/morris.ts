/**
 * Morris screening (elementary effects) over the uncertain fields. A
 * trajectory starts at a keyed grid point of the unit hypercube and moves one
 * factor at a time by `delta` in a keyed order; each move gives that factor
 * one elementary effect, the response change over the step. `mu` is the mean
 * effect, `muStar` the mean absolute effect (the screening measure) and
 * `sigma` the sample standard deviation of the effects, over the trajectories.
 * `morrisIndices` is pure over an evaluator; `morrisLoop` evaluates each row
 * as one aleatory replicate of the scenario.
 */
import type { Scenario } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, runSettings } from '../model/types'
import type { UncertainField } from '../analysis/parameterBasis'
import { sampleScenario, uncertainFields } from '../analysis/uncertainty'
import { hashU01 } from '../geometry/prng'
import type { Loop, SensitivityResponse } from './mcRun'
import { endOfRunResponses } from './mcRun'
import type { MorrisFieldResult, MorrisResult } from './mcTypes'
import { monteCarloPolicy } from './policy'

/** Trajectories and levels of a default screening. */
export const MORRIS_TRAJECTORIES = 10
export const MORRIS_LEVELS = 4

/** Fields kept for Sobol after screening. */
export const MORRIS_KEPT = 8

/** The draw kind of the trajectory layout; the policy's kinds are 1 to 5, the LHS shuffle 6. */
const MORRIS_KIND = 7

/**
 * The quantile band a row is evaluated on: a unit-hypercube coordinate u
 * maps to the quantile 0.1 + 0.8 u, so the grid's 0 and 1 land on the p10
 * and p90 samples the quick mode uses, never on an unbounded spread's tail.
 */
export const QUANTILE_MARGIN = 0.1

/** One factor's elementary effects, in trajectory order. */
export interface MorrisEffects {
  mu: number
  muStar: number
  sigma: number
}

/** The rows of every trajectory, and which factor each step moves and by how much. */
export interface MorrisDesign {
  /** `trajectories * (k + 1)` rows in the unit hypercube, trajectory by trajectory. */
  rows: number[][]
  /** Per trajectory, the factor moved at each of its k steps. */
  order: number[][]
  /** Per trajectory, the signed step of each of its k steps (`delta` or `-delta`). */
  steps: number[][]
  delta: number
}

/** The keyed uniform of one design draw. */
function draw(seed: number, trajectory: number, part: number, index: number): number {
  return hashU01(seed, trajectory, MORRIS_KIND, part, index, 0, 0)
}

/**
 * The trajectories of a screening over `k` factors at `levels` levels, with
 * `delta = levels / (2 (levels - 1))`. A base point takes each coordinate
 * from the lower half of the grid, so a step of `delta` in either direction
 * stays in the hypercube; each factor's direction and the factor order are
 * keyed draws of (seed, trajectory), so the design is the same on any thread.
 */
export function morrisDesign(
  k: number,
  trajectories: number,
  seed: number,
  levels: number,
): MorrisDesign {
  if (!Number.isInteger(levels) || levels < 2)
    throw new Error(`Morris takes 2 or more levels, not ${levels}`)
  const delta = levels / (2 * (levels - 1))
  // Grid points a step of delta can leave without leaving the hypercube.
  const lowerGrid = Math.floor(levels / 2)
  const rows: number[][] = []
  const order: number[][] = []
  const steps: number[][] = []
  for (let t = 0; t < trajectories; t += 1) {
    const point: number[] = []
    const signs: number[] = []
    for (let j = 0; j < k; j += 1) {
      const level = Math.floor(draw(seed, t, 0, j) * lowerGrid)
      const up = draw(seed, t, 1, j) < 0.5
      // A downward step starts one delta above its grid point.
      point.push(level / (levels - 1) + (up ? 0 : delta))
      signs.push(up ? delta : -delta)
    }
    // A keyed shuffle of the factor order.
    const perm = Array.from({ length: k }, (_, j) => j)
    for (let j = k - 1; j > 0; j -= 1) {
      const r = Math.floor(draw(seed, t, 2, j) * (j + 1))
      const tmp = perm[j]
      perm[j] = perm[r]
      perm[r] = tmp
    }
    rows.push([...point])
    const stepsOf: number[] = []
    for (const j of perm) {
      point[j] += signs[j]
      rows.push([...point])
      stepsOf.push(signs[j])
    }
    order.push(perm)
    steps.push(stepsOf)
  }
  return { rows, order, steps, delta }
}

/** Mean, mean absolute and sample standard deviation of a factor's effects. */
function effectsOf(effects: number[]): MorrisEffects {
  const n = effects.length
  let sum = 0
  let abs = 0
  for (const e of effects) {
    sum += e
    abs += Math.abs(e)
  }
  const mu = sum / n
  let ss = 0
  for (const e of effects) ss += (e - mu) * (e - mu)
  return { mu, muStar: abs / n, sigma: n > 1 ? Math.sqrt(ss / (n - 1)) : 0 }
}

/** The effects of every factor from the responses `y` of `design.rows`, in row order. */
export function morrisEffects(design: MorrisDesign, y: number[]): MorrisEffects[] {
  const k = design.order[0]?.length ?? 0
  const perFactor: number[][] = Array.from({ length: k }, () => [])
  design.order.forEach((perm, t) => {
    const base = t * (k + 1)
    perm.forEach((j, step) => {
      perFactor[j].push((y[base + step + 1] - y[base + step]) / design.steps[t][step])
    })
  })
  return perFactor.map(effectsOf)
}

/** Indices by mu star descending; ties keep factor order. */
export function morrisRanking(effects: MorrisEffects[]): number[] {
  return effects.map((_, j) => j).sort((a, b) => effects[b].muStar - effects[a].muStar)
}

/**
 * Morris screening over `k` factors: `evaluate` maps unit-hypercube rows to
 * one response each. Returns per-factor mu, mu star and sigma with the
 * ranking by mu star. `trajectories * (k + 1)` evaluations.
 */
export function morrisIndices(
  evaluate: (rows: number[][]) => number[],
  k: number,
  trajectories = MORRIS_TRAJECTORIES,
  seed = 0,
  levels = MORRIS_LEVELS,
): { effects: MorrisEffects[]; ranking: number[]; evaluations: number } {
  const design = morrisDesign(k, trajectories, seed, levels)
  const effects = morrisEffects(design, evaluate(design.rows))
  return { effects, ranking: morrisRanking(effects), evaluations: design.rows.length }
}

/** The group of a field: its library model's kind, or the off-library owner. */
export function fieldGroup(scenario: Scenario, field: UncertainField): string {
  if (field.modelId === 'doctrine') return 'doctrine'
  const model = scenario.library.find((m) => m.id === field.modelId)
  return model ? model.kind : 'connection'
}

/**
 * The fields kept for Sobol: the top `MORRIS_KEPT` of `ranking` (indices
 * into the fields). A group's best field ranks above its other fields, so
 * every group with a field in the top eight keeps its best one.
 */
export function keptFields(ranking: number[]): number[] {
  return ranking.slice(0, MORRIS_KEPT)
}

/**
 * A scenario with the listed fields at the quantiles of `row` and every other
 * field nominal. `margin` narrows the band a coordinate maps to (the Morris
 * grid uses QUANTILE_MARGIN; Sobol's continuous draws use none).
 */
export function rowScenario(
  base: Scenario,
  fields: UncertainField[],
  row: number[],
  margin = QUANTILE_MARGIN,
): Scenario {
  const at = new Map(fields.map((f, j) => [`${f.modelId} ${f.field}`, row[j]]))
  return sampleScenario(base, (m, f) => {
    const u = at.get(`${m} ${f}`)
    return u == null ? null : margin + (1 - 2 * margin) * u
  })
}

/** The aleatory base of a sensitivity study: no half-width rule, the nominal scenario. */
export function studyBase(scenario: Scenario): Scenario {
  return { ...scenario, uncertainty: 'aleatory', targetHalfWidth: null }
}

/**
 * Morris screening of `scenario` on `response`: every uncertain field is a
 * factor, each row runs as one aleatory replicate whose index is the row's
 * trajectory, so the steps of a trajectory share their engine draws and an
 * effect is a paired difference (common random numbers). One checkpoint per
 * row; a stop keeps the trajectories completed (`trajectories` reports the
 * count) and throws when none is. `onProgress` fires after every row with
 * the row count.
 */
export function* morrisLoop(
  scenario: Scenario,
  response: SensitivityResponse = 'leakers',
  onProgress?: (done: number, total: number) => void,
): Loop<MorrisResult> {
  const { seed } = runSettings(scenario)
  const base = studyBase(scenario)
  const fields = uncertainFields(base)
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...base.requirements }
  const design = morrisDesign(fields.length, MORRIS_TRAJECTORIES, seed, MORRIS_LEVELS)
  const total = design.rows.length
  const rowsPer = fields.length + 1
  const y: number[] = []
  let done = 0
  while (done < total) {
    const policy = monteCarloPolicy(seed, Math.floor(done / rowsPer), thresholds)
    y.push(endOfRunResponses(rowScenario(base, fields, design.rows[done]), policy)[response])
    done += 1
    onProgress?.(done, total)
    if (done === total) break
    const stop = yield { done, total, retained: 0 }
    if (stop) break
  }
  const trajectories = Math.floor(done / rowsPer)
  if (trajectories === 0) throw new Error('Morris screening stopped before its first trajectory')
  const completed: MorrisDesign = {
    ...design,
    rows: design.rows.slice(0, trajectories * rowsPer),
    order: design.order.slice(0, trajectories),
    steps: design.steps.slice(0, trajectories),
  }
  const effects = morrisEffects(completed, y)
  const ranking = morrisRanking(effects)
  const results: MorrisFieldResult[] = fields.map((field, j) => ({ field, ...effects[j] }))
  return {
    method: 'morris',
    trajectories,
    fields: results,
    ranking,
    kept: keptFields(ranking),
    response,
    seed,
    evaluations: trajectories * rowsPer,
  }
}
