/**
 * The placement optimization contract between the analysis screen, the
 * optimize worker and the run store (Phase 4.1 and 4.5). Every type here is
 * plain data that crosses a worker message: JSON serialisable, no functions,
 * no Maps.
 *
 * Split: `src/model/types.ts` holds what model code and the schema share
 * (`Vec2`, `DEFAULT_SEED`, the calibration record). This file holds only the
 * request and result the worker protocol carries; nothing here enters a
 * `Scenario` or `SpecModel`.
 */
import type { Scenario, Vec2 } from '../model/types'
import type { SensitivityResponse, Stat } from './mcRun'

/** Evaluations of one optimization run by default: the plan's budget of 60. */
export const DEFAULT_OPTIMIZE_EVALUATIONS = 60

/** Replicates per evaluation by default: 40 under common random numbers. */
export const DEFAULT_OPTIMIZE_REPLICATES = 40

/**
 * The statistic to move and the way to move it. The response is one of the
 * five the sensitivity screens already read; a leaker or a first-detect time
 * is minimized, a kill or a warning time maximized.
 */
export interface OptimizeObjective {
  response: SensitivityResponse
  direction: 'minimize' | 'maximize'
}

/**
 * Where a movable entity may go: a closed polygon in the meters world frame,
 * normally the points of the scenario's range `Boundary` (its id kept for
 * the record). The optimizer samples inside the polygon.
 */
export interface OptimizeBounds {
  boundaryId: string | null
  points: Vec2[]
}

/**
 * Work the run may spend. `seed` is the common-random-numbers seed: every
 * evaluation runs its `replicates` on the same draw keys so two laydowns
 * differ by placement alone.
 */
export interface OptimizeBudget {
  evaluations: number
  replicates: number
  seed: number
}

/** Proposed positions of the movable entities, keyed by entity id. */
export type Laydown = Record<string, Vec2>

/** One optimization request to the worker: plain JSON, never a store reference. */
export interface OptimizeRequest {
  type: 'optimize'
  runId: string
  scenario: Scenario
  objective: OptimizeObjective
  /** Entity ids the optimizer may move; every other entity stays put. */
  movableIds: string[]
  bounds: OptimizeBounds
  budget: OptimizeBudget
}

/**
 * One evaluation of one laydown. `objective` is the response `Stat` over
 * the evaluation's replicates, the same shape and interval rule the run
 * summary uses for that response, so a screen reads it as it reads a run.
 */
export interface OptimizeEvaluation {
  /** Order in the trace; 0 is the starting laydown. */
  index: number
  positions: Laydown
  objective: Stat
  /** True when this evaluation was the best seen so far at the time it ran. */
  incumbent: boolean
}

/** A laydown the optimizer proposes, ranked from the trace. */
export interface OptimizeCandidate {
  positions: Laydown
  objective: Stat
  /** The trace evaluation this candidate came from. */
  evaluationIndex: number
}

/**
 * The result of one optimization. `trace[0]` is the starting laydown, so a
 * consumer can test whether the best candidate's interval lies outside the
 * start's. `candidates` is ordered best first by the objective direction.
 */
export interface OptimizeResult {
  method: 'gp-ei'
  objective: OptimizeObjective
  movableIds: string[]
  budget: OptimizeBudget
  candidates: OptimizeCandidate[]
  trace: OptimizeEvaluation[]
  /** Engine replicates used: evaluations times replicates per evaluation. */
  replicatesRun: number
  /** Wall time in the worker, ms. */
  elapsedMs: number
}

/** Messages of an optimize run; `done` and `total` count evaluations. */
export type OptimizeWorkerMessage =
  | { type: 'optimize-progress'; runId: string; done: number; total: number; best: OptimizeEvaluation | null }
  | { type: 'optimize-done'; runId: string; result: OptimizeResult }
  | { type: 'optimize-error'; runId: string; message: string }
