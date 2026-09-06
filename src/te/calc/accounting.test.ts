/**
 * Run-accounting tests, including fixture F-19 (valid-run rate 48/58,
 * denominator attempted).
 */

import { describe, expect, it } from 'vitest'
import type { TeCampaign, TeRunValidity } from '../model/types'
import { emptyCampaign, emptyCard, emptyMatrixCell, emptyRun } from '../model/empty'
import { runAccounting, validRunRate } from './accounting'

let runSeq = 0

function addRun(
  c: TeCampaign,
  patch: { validity?: TeRunValidity; started?: boolean; excluded?: boolean } = {},
): void {
  const run = emptyRun(`run-${++runSeq}`, c.cards[0])
  run.startAt = patch.started === false ? null : '2026-08-01T10:00:00Z'
  run.validity = patch.validity ?? 'valid'
  run.excluded = patch.excluded ?? false
  c.runs.push(run)
}

function makeCampaign(): TeCampaign {
  const c = emptyCampaign('Accounting test', 'T1')
  c.cards.push(emptyCard('card1', 'TC-001'))
  return c
}

describe('runAccounting', () => {
  it('F-19: 48 valid of 58 attempted gives a 0.828 valid-run rate', () => {
    const c = makeCampaign()
    for (let i = 0; i < 48; i++) addRun(c, { validity: 'valid' })
    for (let i = 0; i < 10; i++) addRun(c, { validity: 'invalid' })
    const acc = runAccounting(c)
    expect(acc.attempted).toBe(58)
    expect(acc.valid).toBe(48)
    expect(acc.invalid).toBe(10)
    expect(validRunRate(c)).toBeCloseTo(0.828, 3)
  })

  it('sums planned repetitions from the matrix', () => {
    const c = makeCampaign()
    c.matrix.push({ ...emptyMatrixCell('c1'), plannedReps: 4 })
    c.matrix.push({ ...emptyMatrixCell('c2'), plannedReps: 8 })
    expect(runAccounting(c).planned).toBe(12)
  })

  it('buckets by validity and keeps excluded runs out of the buckets', () => {
    const c = makeCampaign()
    addRun(c, { validity: 'valid' })
    addRun(c, { validity: 'conditionally-valid' })
    addRun(c, { validity: 'invalid' })
    addRun(c, { validity: 'pending', started: false })
    addRun(c, { validity: 'valid', excluded: true })
    const acc = runAccounting(c)
    expect(acc.attempted).toBe(4)
    expect(acc.valid).toBe(1)
    expect(acc.conditional).toBe(1)
    expect(acc.invalid).toBe(1)
    expect(acc.pending).toBe(1)
    expect(acc.excluded).toBe(1)
  })

  it('valid-run rate is null before any attempt', () => {
    const c = makeCampaign()
    addRun(c, { validity: 'pending', started: false })
    expect(validRunRate(c)).toBeNull()
  })
})
