/**
 * Placement optimization: Gaussian process with expected improvement over the
 * positions of the movable entities inside the bounds polygon. One laydown is
 * x in R^(2m) for m movable ids, the (x, y) of each in the meters world frame,
 * inside `bounds.points`.
 *
 * A laydown runs `budget.replicates` aleatory replicates at `budget.seed`
 * through `endOfRunResponses`, so two laydowns evaluated at one seed differ by
 * placement alone. The objective is `statOf` over the replicates under the
 * response's own kind. A maximized response is negated inside the search
 * (f = -mean), so the surrogate always minimizes.
 *
 * Schedule, for a budget of E evaluations: index 0 is the starting laydown;
 * then SEED_EVALUATIONS space-filling points (at most (E - 1) / 2) from a keyed
 * Latin hypercube over the bounding box, each row outside the polygon replaced
 * by a keyed uniform draw inside it; then expected improvement, refitting
 * `gp.ts` to every finite evaluation and taking the largest EI over
 * CANDIDATE_CLOUD keyed uniform draws.
 *
 * The length scale is LENGTH_SCALE_FRACTION of the bounding-box diagonal. Each
 * observation's noise is its standard error. Every design draw is `hashU01`
 * keyed by (seed, evaluation index, OPTIMIZE_KIND, part, coordinate), so a run
 * reproduces on any thread.
 *
 * `trace` holds every completed evaluation in order, `incumbent` marking each
 * that was best so far. `candidates` are the distinct laydowns of the trace,
 * best first by the objective direction (a NaN mean last), at most
 * CANDIDATE_CAP. A stop drops the evaluation in progress and returns the trace
 * so far; a stop before the starting laydown finished throws.
 */
import type { Scenario, Vec2 } from '../../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, runSettings } from '../../model/types'
import { hashU01 } from '../../geometry/prng'
import { resolveEngagements } from '../attrition'
import type { Checkpoint, Loop, SensitivityResponse, Stat, StatKind } from '../mcRun'
import { endOfRunResponses, statOf } from '../mcRun'
import type {
  Laydown,
  OptimizeBounds,
  OptimizeBudget,
  OptimizeCandidate,
  OptimizeEvaluation,
  OptimizeObjective,
  OptimizeRequest,
  OptimizeResult,
} from '../optimizeTypes'
import { monteCarloPolicy } from '../policy'
import { assessAllThreats } from '../sim'
import type { Observation } from './gp'
import { expectedImprovement, fitGp, predict } from './gp'
import { boundingBoxOf, pointInPolygon } from './polygon'
import type { BoundingBox } from './polygon'

/** Space-filling evaluations after the start, before the first EI proposal. */
export const SEED_EVALUATIONS = 8

/** Keyed uniform candidates scored per EI proposal. */
const CANDIDATE_CLOUD = 512

/** Length scale as a fraction of the bounding-box diagonal. */
const LENGTH_SCALE_FRACTION = 0.25

/** Candidates reported, best first. */
export const CANDIDATE_CAP = 5

/**
 * Uniform draws tried per point before the polygon is declared too thin to
 * sample. `boundsRefusal` (polygon.ts) refuses a region whose acceptance rate
 * makes this reachable, so `boundingBoxOf` throws before any draw.
 */
const MAX_REJECTIONS = 10_000

/** The draw kind of the design; kinds never collide (policy.ts DRAW_KIND). */
const OPTIMIZE_KIND = 12

/** Design draw parts. */
const PART = { lhsShuffle: 0, lhsJitter: 1, uniform: 2 } as const

/** The keyed uniform of one design draw. */
function draw(
  seed: number,
  evaluation: number,
  part: number,
  coordinate: number,
  attempt: number,
): number {
  return hashU01(seed, evaluation, OPTIMIZE_KIND, part, coordinate, attempt, 0)
}

/** The count Stat kind of a response: ships for leakers and kills, unbounded salvos, a time otherwise. */
export function responseKind(response: SensitivityResponse, raidSize: number): StatKind {
  switch (response) {
    case 'leakers':
    case 'kills':
      return { kind: 'count', max: raidSize }
    case 'salvos':
      return { kind: 'count', max: Infinity }
    default:
      return { kind: 'time' }
  }
}

/**
 * The raid's ships, as `finishSummary` counts them: the attrition report's ship
 * count per threat with a path, 1 for a threat the report omits.
 */
function raidSizeOf(scenario: Scenario): number {
  const assessments = assessAllThreats(scenario)
  const report = resolveEngagements(scenario, assessments)
  let ships = 0
  for (const a of assessments) {
    if (a.status === 'no-path') continue
    ships += report.threats.find((t) => t.uasId === a.uasId)?.shipCount ?? 1
  }
  return ships
}

/** The scenario with the movable entities at `laydown`; every other entity stays put. */
function placeLaydown(scenario: Scenario, laydown: Laydown): Scenario {
  return {
    ...scenario,
    entities: scenario.entities.map((e) => {
      const pos = laydown[e.id]
      return pos ? { ...e, pos: { x: pos.x, y: pos.y } } : e
    }),
  }
}

/** The evaluation base: aleatory, no stopping rule, the budget's seed and replicates. */
function evaluationBase(scenario: Scenario, budget: OptimizeBudget): Scenario {
  return {
    ...scenario,
    uncertainty: 'aleatory',
    targetHalfWidth: null,
    seed: budget.seed,
    replicates: budget.replicates,
  }
}

/**
 * The objective Stat of one laydown over `budget.replicates` replicates at
 * `budget.seed`, synchronously. `kind` is `responseKind` of the response.
 */
export function evaluateLaydown(
  scenario: Scenario,
  laydown: Laydown,
  objective: OptimizeObjective,
  budget: OptimizeBudget,
  kind: StatKind,
): Stat {
  const base = placeLaydown(evaluationBase(scenario, budget), laydown)
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...base.requirements }
  const samples: number[] = []
  for (let i = 0; i < budget.replicates; i += 1) {
    samples.push(
      endOfRunResponses(base, monteCarloPolicy(budget.seed, i, thresholds))[objective.response],
    )
  }
  return statOf(samples, kind, runSettings(base).confidence)
}

/** The search sign: a minimized mean is its own f, a maximized one its negative. */
function signOf(objective: OptimizeObjective): number {
  return objective.direction === 'maximize' ? -1 : 1
}

/** A laydown as the flat vector [x_0, y_0, x_1, y_1, ...] in `ids` order. */
function vectorOf(laydown: Laydown, ids: string[]): number[] {
  const x: number[] = []
  for (const id of ids) x.push(laydown[id].x, laydown[id].y)
  return x
}

/** The laydown of a flat vector. */
function laydownOf(x: number[], ids: string[]): Laydown {
  const laydown: Laydown = {}
  ids.forEach((id, i) => {
    laydown[id] = { x: x[2 * i], y: x[2 * i + 1] }
  })
  return laydown
}

/** A unit coordinate mapped into the box on axis 0 (x) or 1 (y). */
function intoBox(u: number, axis: number, box: BoundingBox): number {
  return axis === 0 ? box.minX + u * (box.maxX - box.minX) : box.minY + u * (box.maxY - box.minY)
}

/** True when every entity's point of the flat vector lies inside the polygon. */
function insideBounds(x: number[], bounds: OptimizeBounds): boolean {
  for (let i = 0; i < x.length; i += 2) {
    if (!pointInPolygon({ x: x[i], y: x[i + 1] }, bounds.points)) return false
  }
  return true
}

/**
 * One keyed uniform laydown inside the polygon: each entity's point is
 * redrawn in the box until inside. `attempt` offsets the draw key so a
 * cloud of points shares no draw.
 */
function uniformInside(
  seed: number,
  evaluation: number,
  attempt: number,
  m: number,
  box: BoundingBox,
  bounds: OptimizeBounds,
): number[] {
  const x: number[] = []
  for (let i = 0; i < m; i += 1) {
    let tries = 0
    for (;;) {
      const key = attempt * MAX_REJECTIONS + tries
      const p: Vec2 = {
        x: intoBox(draw(seed, evaluation, PART.uniform, 2 * i, key), 0, box),
        y: intoBox(draw(seed, evaluation, PART.uniform, 2 * i + 1, key), 1, box),
      }
      if (pointInPolygon(p, bounds.points)) {
        x.push(p.x, p.y)
        break
      }
      tries += 1
      if (tries >= MAX_REJECTIONS) throw new Error('Optimize bounds are too thin to sample')
    }
  }
  return x
}

/**
 * `n` Latin hypercube rows over the box in 2m coordinates, keyed by
 * (seed, first evaluation index): a keyed shuffle of the strata per
 * coordinate and a keyed jitter inside each stratum. A row outside the
 * polygon is replaced by a keyed uniform laydown inside it.
 */
function seedDesign(
  seed: number,
  firstIndex: number,
  n: number,
  m: number,
  box: BoundingBox,
  bounds: OptimizeBounds,
): number[][] {
  const d = 2 * m
  const strata: number[][] = []
  for (let j = 0; j < d; j += 1) {
    const perm = Array.from({ length: n }, (_, r) => r)
    for (let r = n - 1; r > 0; r -= 1) {
      const k = Math.floor(draw(seed, firstIndex, PART.lhsShuffle, j, r) * (r + 1))
      const tmp = perm[r]
      perm[r] = perm[k]
      perm[k] = tmp
    }
    strata.push(perm)
  }
  const rows: number[][] = []
  for (let r = 0; r < n; r += 1) {
    const x: number[] = []
    for (let j = 0; j < d; j += 1) {
      const u = (strata[j][r] + draw(seed, firstIndex + r, PART.lhsJitter, j, 0)) / n
      x.push(intoBox(u, j % 2, box))
    }
    rows.push(insideBounds(x, bounds) ? x : uniformInside(seed, firstIndex + r, 0, m, box, bounds))
  }
  return rows
}

/**
 * The EI proposal for evaluation `index`: the point of a keyed uniform
 * cloud of CANDIDATE_CLOUD laydowns inside the polygon with the largest
 * expected improvement under a process fitted to `observations`; the
 * cloud's first point with nothing finite to fit.
 */
function proposeByEi(
  observations: Observation[],
  seed: number,
  index: number,
  m: number,
  box: BoundingBox,
  bounds: OptimizeBounds,
): number[] {
  const lengthScale = LENGTH_SCALE_FRACTION * box.diagonalM
  const finite = observations.filter((o) => Number.isFinite(o.f))
  const gp = finite.length > 0 ? fitGp(finite, lengthScale) : null
  let best: number[] | null = null
  let bestEi = -Infinity
  for (let c = 0; c < CANDIDATE_CLOUD; c += 1) {
    const x = uniformInside(seed, index, c, m, box, bounds)
    if (gp == null) return x
    const { mu, sigma } = predict(gp, x)
    const ei = expectedImprovement(mu, sigma, gp.fBest)
    if (ei > bestEi) {
      bestEi = ei
      best = x
    }
  }
  return best!
}

/** The distinct evaluations of `trace`, best first by `sign`, NaN means last; at most CANDIDATE_CAP. */
export function rankCandidates(trace: OptimizeEvaluation[], sign: number): OptimizeCandidate[] {
  const seen = new Set<string>()
  const distinct: OptimizeEvaluation[] = []
  for (const e of trace) {
    const key = JSON.stringify(e.positions)
    if (seen.has(key)) continue
    seen.add(key)
    distinct.push(e)
  }
  const f = (e: OptimizeEvaluation) =>
    Number.isFinite(e.objective.mean) ? sign * e.objective.mean : Infinity
  // A stable sort: ties keep trace order.
  distinct.sort((a, b) => f(a) - f(b))
  return distinct.slice(0, CANDIDATE_CAP).map((e) => ({
    positions: e.positions,
    objective: e.objective,
    evaluationIndex: e.index,
  }))
}

/** The request's starting laydown: the movable entities' current positions; throws on an unknown id. */
export function startingLaydown(request: OptimizeRequest): Laydown {
  const laydown: Laydown = {}
  for (const id of request.movableIds) {
    const entity = request.scenario.entities.find((e) => e.id === id)
    if (!entity) throw new Error(`Optimize movable id ${id} is not in the scenario`)
    laydown[id] = { x: entity.pos.x, y: entity.pos.y }
  }
  return laydown
}

/**
 * The optimization loop: one checkpoint per replicate and one after each
 * evaluation is recorded, `done` counting the evaluations completed of
 * `budget.evaluations`. A stop at a checkpoint drops the evaluation in
 * progress. `elapsedMs` is 0 here; the worker fills it.
 */
export function* optimizeLoop(
  request: OptimizeRequest,
  onProgress?: (done: number, total: number, best: OptimizeEvaluation) => void,
): Loop<OptimizeResult> {
  const { scenario, objective, movableIds, bounds, budget } = request
  if (movableIds.length === 0) throw new Error('Optimize needs at least one movable id')
  if (!Number.isInteger(budget.evaluations) || budget.evaluations < 1) {
    throw new Error(`Optimize needs at least 1 evaluation, not ${budget.evaluations}`)
  }
  if (!Number.isInteger(budget.replicates) || budget.replicates < 1) {
    throw new Error(`Optimize needs at least 1 replicate, not ${budget.replicates}`)
  }
  const box = boundingBoxOf(bounds.points)
  const m = movableIds.length
  const sign = signOf(objective)
  const kind = responseKind(objective.response, raidSizeOf(scenario))
  const base = evaluationBase(scenario, budget)
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...base.requirements }
  const conf = runSettings(base).confidence
  const total = budget.evaluations
  const cp: Checkpoint = { done: 0, total, retained: 0 }

  const trace: OptimizeEvaluation[] = []
  const observations: Observation[] = []
  let best: OptimizeEvaluation | null = null
  let bestF = Infinity
  const seedCount = Math.min(SEED_EVALUATIONS, Math.floor((total - 1) / 2))
  let seedRows: number[][] | null = null

  const laydownAt = (index: number): Laydown => {
    if (index === 0) return startingLaydown(request)
    if (index <= seedCount) {
      seedRows ??= seedDesign(budget.seed, 1, seedCount, m, box, bounds)
      return laydownOf(seedRows[index - 1], movableIds)
    }
    return laydownOf(proposeByEi(observations, budget.seed, index, m, box, bounds), movableIds)
  }

  const result = (): OptimizeResult => ({
    method: 'gp-ei',
    objective,
    movableIds,
    budget,
    candidates: rankCandidates(trace, sign),
    trace,
    replicatesRun: trace.length * budget.replicates,
    elapsedMs: 0,
  })

  for (let index = 0; index < total; index += 1) {
    const laydown = laydownAt(index)
    const placed = placeLaydown(base, laydown)
    const samples: number[] = []
    for (let i = 0; i < budget.replicates; i += 1) {
      samples.push(
        endOfRunResponses(placed, monteCarloPolicy(budget.seed, i, thresholds))[objective.response],
      )
      // No checkpoint after the last replicate: the evaluation is recorded first.
      if (i === budget.replicates - 1) break
      const stop = yield cp
      if (stop) {
        if (trace.length === 0)
          throw new Error('Optimization stopped before the starting laydown was evaluated')
        return result()
      }
    }
    const stat = statOf(samples, kind, conf)
    const f = Number.isFinite(stat.mean) ? sign * stat.mean : NaN
    const incumbent = index === 0 || f < bestF
    const evaluation: OptimizeEvaluation = { index, positions: laydown, objective: stat, incumbent }
    trace.push(evaluation)
    observations.push({ x: vectorOf(laydown, movableIds), f, se: stat.se })
    if (incumbent) {
      best = evaluation
      if (Number.isFinite(f)) bestF = f
    }
    cp.done = index + 1
    onProgress?.(cp.done, total, best!)
    // The last evaluation's checkpoint accepts no stop: the run is complete.
    if (index === total - 1) break
    const stop = yield cp
    if (stop) return result()
  }
  return result()
}

/** Run the loop to its end synchronously (the tests' entry; the worker drives the loop). */
export function runOptimize(
  request: OptimizeRequest,
  onProgress?: (done: number, total: number, best: OptimizeEvaluation) => void,
): OptimizeResult {
  const loop = optimizeLoop(request, onProgress)
  for (;;) {
    const next = loop.next()
    if (next.done) return next.value
  }
}
