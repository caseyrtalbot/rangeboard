/**
 * Matrix planning tests. The plan is pure, so sample size, drop order, the
 * baseline row and a 2000-run batch all check without a store.
 */

import { describe, expect, it } from 'vitest'
import type { TeCampaign } from './types'
import {
  emptyCampaign,
  emptyCondition,
  emptyConfig,
  emptyHypothesis,
  emptyMatrixCell,
  emptyMeasure,
  emptyQuestion,
  emptyThreat,
} from './empty'
import {
  dropOrderRanking,
  planCells,
  planSampleSize,
  requiredRepetitions,
  sampleSizeCellPatch,
  UNRANKED_DROP_ORDER,
} from './matrixPlan'

function makeCampaign(conditions = 2): TeCampaign {
  const c = emptyCampaign('Plan test', 'T1')
  c.questions.push(emptyQuestion('q1'))
  c.questions.push(emptyQuestion('q2'))
  c.hypotheses.push(emptyHypothesis('h1', 'q1'))
  c.hypotheses.push(emptyHypothesis('h2', 'q2'))
  c.measures.push({ ...emptyMeasure('m1', 'q1'), requiredRepetitions: 3 })
  c.measures.push({ ...emptyMeasure('m2', 'q1'), requiredRepetitions: 2 })
  c.measures.push({ ...emptyMeasure('m3', 'q2'), requiredRepetitions: 9 })
  c.configs.push(emptyConfig('cfg1'))
  c.threats.push(emptyThreat('thr1'))
  for (let i = 1; i <= conditions; i++) c.conditions.push(emptyCondition(`cond${i}`))
  return c
}

function factorsFor(c: TeCampaign, hypothesisId: string | null = null) {
  return {
    questionId: 'q1',
    hypothesisId,
    configId: 'cfg1',
    threatId: 'thr1',
    conditionIds: c.conditions.map((x) => x.id),
  }
}

describe('sample size', () => {
  it('solves valid runs and attempts, and reports what does not solve', () => {
    expect(planSampleSize({ p: 0.8, halfWidth: 0.1, validFraction: 0.8 })).toEqual({
      validNeeded: 62,
      attempts: 78,
    })
    expect(planSampleSize({ p: 0.8, halfWidth: 0.1, validFraction: null }).attempts).toBeNull()
    expect(planSampleSize({ p: 1, halfWidth: 0.1, validFraction: 0.8 }).validNeeded).toBeNull()
    expect(planSampleSize({ p: 0.8, halfWidth: 0, validFraction: 0.8 }).validNeeded).toBeNull()
  })

  it('sets cell minimums from the solution and never plans fewer runs than needed', () => {
    const cell = { ...emptyMatrixCell('c1'), plannedReps: 4 }
    expect(sampleSizeCellPatch(cell, { validNeeded: 62, attempts: 78 })).toEqual({
      minValidEvidence: 62,
      plannedReps: 78,
    })
    expect(sampleSizeCellPatch(cell, { validNeeded: 62, attempts: null })).toEqual({
      minValidEvidence: 62,
      plannedReps: 62,
    })
    expect(sampleSizeCellPatch(cell, { validNeeded: null, attempts: null })).toBeNull()
  })

  it('takes the largest required repetitions among the question measures', () => {
    const c = makeCampaign()
    expect(requiredRepetitions(c, 'q1')).toBe(3)
    expect(requiredRepetitions(c, 'q2')).toBe(9)
    expect(requiredRepetitions(c, null)).toBe(1)
  })
})

describe('drop order', () => {
  it('ranks the lowest priority to drop first', () => {
    const cells = [
      { ...emptyMatrixCell('a'), priority: 1 },
      { ...emptyMatrixCell('b'), priority: 3 },
      { ...emptyMatrixCell('c'), priority: 2 },
    ]
    expect(dropOrderRanking(cells)).toEqual([
      { id: 'b', dropOrder: 1 },
      { id: 'c', dropOrder: 2 },
      { id: 'a', dropOrder: 3 },
    ])
  })

})

describe('planCells', () => {
  it('plans one cell per condition with the question links and minimums', () => {
    const c = makeCampaign()
    const plan = planCells(c, factorsFor(c, 'h1'), { method: 'characterization sweep' })
    expect(plan.baseline).toBeNull()
    expect(plan.warnings).toEqual([])
    expect(plan.cells).toHaveLength(2)
    expect(plan.cells.map((x) => x.conditionId)).toEqual(['cond1', 'cond2'])
    expect(plan.cells[0]).toMatchObject({
      questionId: 'q1',
      hypothesisId: 'h1',
      configId: 'cfg1',
      threatId: 'thr1',
      measureIds: ['m1', 'm2'],
      method: 'characterization sweep',
      plannedReps: 3,
      minValidEvidence: 3,
      dropOrder: UNRANKED_DROP_ORDER,
    })
    const fewer = planCells(c, factorsFor(c), { method: 'stress', plannedReps: 2 })
    expect(fewer.cells[0].plannedReps).toBe(2)
    expect(fewer.cells[0].minValidEvidence).toBe(2)
  })

  it('drops links the campaign does not hold and plans nothing without them', () => {
    const c = makeCampaign()
    const plan = planCells(c, factorsFor(c, 'h2'), { method: 'stress' })
    expect(plan.cells[0].hypothesisId).toBe('h2')
    expect(plan.warnings).toContain('The picked hypothesis belongs to another question.')
    const empty = planCells(
      c,
      { questionId: null, hypothesisId: null, configId: 'cfg1', threatId: 'thr1', conditionIds: [] },
      { method: 'stress' },
    )
    expect(empty.cells).toEqual([])
    expect(empty.warnings).toEqual(['Pick a question.', 'Pick at least one condition.'])
  })

  it('opens a comparison with a baseline row on the first condition', () => {
    const c = makeCampaign()
    const plan = planCells(c, factorsFor(c), { method: 'comparison' })
    expect(plan.cells).toHaveLength(3)
    expect(plan.baseline).toBe(plan.cells[0])
    expect(plan.cells[0]).toMatchObject({ method: 'baseline comparison', conditionId: 'cond1' })
    expect(plan.cells.slice(1).every((x) => x.method === 'comparison')).toBe(true)
  })

  it('adds no second baseline, and warns when the build opts out', () => {
    const c = makeCampaign()
    c.matrix.push({ ...emptyMatrixCell('mtx1'), method: 'baseline comparison' })
    const held = planCells(c, factorsFor(c), { method: 'comparison' })
    expect(held.baseline).toBeNull()
    expect(held.cells).toHaveLength(2)
    const optOut = planCells(makeCampaign(), factorsFor(makeCampaign()), {
      method: 'comparison',
      addBaseline: false,
    })
    expect(optOut.baseline).toBeNull()
    expect(optOut.warnings).toContain('A comparison without a baseline row proves nothing.')
  })

  it('plans a 1000-condition batch and says how many runs it commits', () => {
    const c = makeCampaign(1000)
    const plan = planCells(c, factorsFor(c), { method: 'stress', plannedReps: 2 })
    expect(plan.cells).toHaveLength(1000)
    expect(plan.cells.reduce((n, x) => n + x.plannedReps, 0)).toBe(2000)
    expect(plan.cells.at(-1)?.conditionId).toBe('cond1000')
    expect(plan.warnings).toEqual(['1000 cells plan 2000 runs. Trim the batch or the reps.'])
  })
})
