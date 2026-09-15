import { expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { DEFAULT_SEED, JEFFREYS_PRIOR } from '../model/types'
import type { CalibrationRecord } from '../model/types'
import type { Stat } from './mcRun'
import { DEFAULT_OPTIMIZE_EVALUATIONS, DEFAULT_OPTIMIZE_REPLICATES } from './optimizeTypes'
import type { OptimizeEvaluation, OptimizeRequest, OptimizeResult } from './optimizeTypes'

const stat: Stat = {
  mean: 2, sd: 1, se: 0.5, lo: 1, hi: 3, conf: 0.95, interval: 't',
  p10: 1, p90: 3, p025: 0.5, p975: 3.5, n: 4, total: 4, defined: { p: 1, lo: 1, hi: 1 },
}

it('the optimize request and result literals type-check', () => {
  const request: OptimizeRequest = {
    type: 'optimize',
    runId: 'r1',
    scenario: emptyScenario(),
    objective: { response: 'leakers', direction: 'minimize' },
    movableIds: ['e1'],
    bounds: { boundaryId: null, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] },
    budget: { evaluations: DEFAULT_OPTIMIZE_EVALUATIONS, replicates: DEFAULT_OPTIMIZE_REPLICATES, seed: DEFAULT_SEED },
  }
  const start: OptimizeEvaluation = { index: 0, positions: { e1: { x: 10, y: 10 } }, objective: stat, incumbent: true }
  const result: OptimizeResult = {
    method: 'gp-ei',
    objective: request.objective,
    movableIds: request.movableIds,
    budget: request.budget,
    candidates: [{ positions: start.positions, objective: stat, evaluationIndex: 0 }],
    trace: [start],
    replicatesRun: 40,
    elapsedMs: 0,
  }
  expect(result.trace[0].index).toBe(0)
  expect(result.candidates[0].objective.lo).toBe(1)
})

it('both calibration record families type-check', () => {
  const proportion: CalibrationRecord = {
    kind: 'proportion',
    field: { modelId: 'lib-kurfs', field: 'pd' },
    prior: JEFFREYS_PRIOR,
    observed: { successes: 16, trials: 20 },
    posterior: { a: 16.5, b: 4.5 },
    accepted: { accepted: true, at: '2026-09-15T00:00:00.000Z', reason: 'Beta(16.5, 4.5) from 16 of 20' },
  }
  const time: CalibrationRecord = {
    kind: 'time',
    field: { modelId: 'lib-kurfs', field: 'latencyS' },
    prior: { mu: 2, kappa: 1, alpha: 1, beta: 1 },
    observed: { form: 'summary', n: 10, meanS: 1.8, varianceS2: 0.2 },
    posterior: { mu: 1.82, kappa: 11, alpha: 6, beta: 2.1 },
    accepted: { accepted: false },
  }
  expect(proportion.posterior.a).toBe(16.5)
  expect(time.accepted.accepted).toBe(false)
})
