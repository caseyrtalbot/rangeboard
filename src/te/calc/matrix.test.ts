/**
 * Matrix coverage tests (MASTER-CALCULATIONS 3.5). The 12-cell / 48-run
 * totals echo fixtures F-14 and F-15 as authored data; the engine counts
 * cells, it does not generate the factor product.
 */

import { describe, expect, it } from 'vitest'
import type { TeCampaign, TeRunValidity } from '../model/types'
import { emptyCampaign, emptyCard, emptyMatrixCell, emptyRun } from '../model/empty'
import { coverage, matrixTotals } from './matrix'

let runSeq = 0

function addCellRun(
  c: TeCampaign,
  cellId: string,
  patch: { validity?: TeRunValidity; started?: boolean; excluded?: boolean } = {},
): void {
  const run = emptyRun(`run-${++runSeq}`, c.cards[0])
  run.matrixCellId = cellId
  run.startAt = patch.started === false ? null : '2026-08-01T10:00:00Z'
  run.validity = patch.validity ?? 'valid'
  run.excluded = patch.excluded ?? false
  c.runs.push(run)
}

function makeCampaign(): TeCampaign {
  const c = emptyCampaign('Matrix test', 'T1')
  c.cards.push(emptyCard('card1', 'TC-001'))
  return c
}

describe('coverage', () => {
  it('classifies empty, thin, met, and redundant cells', () => {
    const c = makeCampaign()
    for (const id of ['c-empty', 'c-thin', 'c-met', 'c-full', 'c-redundant']) {
      c.matrix.push({ ...emptyMatrixCell(id), plannedReps: 4, minValidEvidence: 2 })
    }
    addCellRun(c, 'c-thin')
    for (let i = 0; i < 2; i++) addCellRun(c, 'c-met')
    for (let i = 0; i < 4; i++) addCellRun(c, 'c-full')
    for (let i = 0; i < 5; i++) addCellRun(c, 'c-redundant')
    const states = Object.fromEntries(coverage(c).map((cov) => [cov.cellId, cov.state]))
    expect(states['c-empty']).toBe('empty')
    expect(states['c-thin']).toBe('thin')
    expect(states['c-met']).toBe('met')
    expect(states['c-full']).toBe('met')
    expect(states['c-redundant']).toBe('redundant')
  })

  it('counts attempted and valid separately and ignores excluded runs', () => {
    const c = makeCampaign()
    c.matrix.push({ ...emptyMatrixCell('c1'), plannedReps: 3, minValidEvidence: 2 })
    addCellRun(c, 'c1', { validity: 'valid' })
    addCellRun(c, 'c1', { validity: 'invalid' })
    addCellRun(c, 'c1', { validity: 'conditionally-valid' })
    addCellRun(c, 'c1', { validity: 'valid', excluded: true })
    addCellRun(c, 'c1', { validity: 'pending', started: false })
    const [cov] = coverage(c)
    expect(cov.planned).toBe(3)
    expect(cov.attempted).toBe(4)
    expect(cov.valid).toBe(1)
    expect(cov.minValid).toBe(2)
    expect(cov.state).toBe('thin')
  })
})

describe('matrixTotals', () => {
  it('totals 12 authored cells with 48 planned runs and no duration model', () => {
    const c = makeCampaign()
    for (let i = 0; i < 12; i++) c.matrix.push({ ...emptyMatrixCell(`c${i}`), plannedReps: 4 })
    const totals = matrixTotals(c)
    expect(totals.cells).toBe(12)
    expect(totals.plannedRuns).toBe(48)
    expect(totals.estimatedHours).toBeNull()
  })
})
