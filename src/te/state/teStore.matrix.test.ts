/**
 * Matrix adoption tests. A planned batch lands in one store update, keeps the
 * id grammar and appends to the matrix; a plan the campaign cannot hold lands nowhere.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useTeStore } from './teStore'
import type { TeCampaign } from '../model/types'
import {
  emptyCampaign,
  emptyCondition,
  emptyConfig,
  emptyMeasure,
  emptyQuestion,
  emptyThreat,
} from '../model/empty'
import { planCells, plannedCell } from '../model/matrixPlan'

function campaign(): TeCampaign {
  const s = useTeStore.getState()
  return s.campaigns.find((c) => c.id === s.activeCampaignId)!
}

/** Campaign fixture loaded whole; the record ids stay readable in assertions. */
function loadFixture(conditions: number): void {
  const c = emptyCampaign('Matrix adoption', 'J401')
  c.questions.push(emptyQuestion('q1'))
  c.measures.push({ ...emptyMeasure('m1', 'q1'), requiredRepetitions: 2 })
  c.configs.push(emptyConfig('cfg1'))
  c.threats.push(emptyThreat('thr1'))
  for (let i = 1; i <= conditions; i++) c.conditions.push(emptyCondition(`cond${i}`))
  useTeStore.getState().loadCampaign(c)
}

function factors() {
  return {
    questionId: 'q1',
    hypothesisId: null,
    configId: 'cfg1',
    threatId: 'thr1',
    conditionIds: campaign().conditions.map((x) => x.id),
  }
}

/** Store updates while `run` executes. */
function updates(run: () => void): number {
  let n = 0
  const stop = useTeStore.subscribe(() => {
    n += 1
  })
  run()
  stop()
  return n
}

beforeEach(() => {
  useTeStore.setState({ campaigns: [], activeCampaignId: null })
})

describe('addMatrixCells', () => {
  it('adopts a comparison plan in one update, baseline row first', () => {
    loadFixture(2)
    const plan = planCells(campaign(), factors(), { method: 'comparison' })
    let ids: string[] = []
    expect(updates(() => { ids = useTeStore.getState().addMatrixCells(plan) })).toBe(1)
    expect(ids).toEqual(['VLK-J401-MTX-001', 'VLK-J401-MTX-002', 'VLK-J401-MTX-003'])
    const matrix = campaign().matrix
    expect(matrix.map((x) => x.id)).toEqual(ids)
    expect(matrix[0].method).toBe('baseline comparison')
    expect(matrix.slice(1).map((x) => x.conditionId)).toEqual(['cond1', 'cond2'])
    expect(campaign().seq.MTX).toBe(3)
  })

  it('appends to the matrix and continues the sequence', () => {
    loadFixture(1)
    const st = useTeStore.getState()
    const first = st.addMatrixCell()
    st.patchItem('matrix', first, { notes: 'hand built' })
    const ids = st.addMatrixCells(planCells(campaign(), factors(), { method: 'stress' }))
    expect(ids).toEqual(['VLK-J401-MTX-002'])
    expect(campaign().matrix.map((x) => x.id)).toEqual([first, ...ids])
    expect(campaign().matrix[0].notes).toBe('hand built')
  })

  it('adopts 1000 cells in one update', () => {
    loadFixture(1000)
    const plan = planCells(campaign(), factors(), { method: 'stress', plannedReps: 2 })
    let ids: string[] = []
    expect(updates(() => { ids = useTeStore.getState().addMatrixCells(plan) })).toBe(1)
    expect(ids).toHaveLength(1000)
    expect(new Set(ids).size).toBe(1000)
    const matrix = campaign().matrix
    expect(matrix).toHaveLength(1000)
    expect(matrix.at(-1)!.id).toBe('VLK-J401-MTX-1000')
    expect(matrix.reduce((n, x) => n + x.plannedReps, 0)).toBe(2000)
  })

  it('takes an empty plan and a dangling link nowhere', () => {
    loadFixture(1)
    const st = useTeStore.getState()
    expect(updates(() => {
      expect(st.addMatrixCells({ cells: [], baseline: null, warnings: [] })).toEqual([])
    })).toBe(0)
    const dangling = { cells: [plannedCell({ questionId: 'gone' })], baseline: null, warnings: [] }
    expect(updates(() => {
      expect(st.addMatrixCells(dangling)).toEqual([])
    })).toBe(0)
    expect(campaign().matrix).toEqual([])
  })

  it('stores a copy, so a later edit of the plan does not reach the campaign', () => {
    loadFixture(1)
    const plan = planCells(campaign(), factors(), { method: 'stress' })
    useTeStore.getState().addMatrixCells(plan)
    plan.cells[0].measureIds.push('m1')
    plan.cells[0].notes = 'edited after adoption'
    expect(campaign().matrix[0].measureIds).toEqual(['m1'])
    expect(campaign().matrix[0].notes).toBe('')
  })
})
