/**
 * Measure pipeline tests, including label-logic fixtures F-29..F-32 and the
 * proportion fixtures F-01/F-02/F-21/F-33 run through the full denominator
 * discipline (MASTER-CALCULATIONS 1.0, 3.13).
 */

import { describe, expect, it } from 'vitest'
import type {
  ObservationStatus,
  TeCampaign,
  TeMeasure,
  TeRun,
  TeRunValidity,
} from '../model/types'
import { emptyCampaign, emptyCard, emptyMatrixCell, emptyMeasure, emptyRun } from '../model/empty'
import { computeAllMeasures, computeMeasure } from './measures'

interface RunPatch {
  validity?: TeRunValidity
  status?: ObservationStatus
  success?: boolean | null
  value?: number | null
  excluded?: boolean
  allowed?: boolean
  started?: boolean
}

let runSeq = 0

function makeCampaign(measurePatch: Partial<TeMeasure>): { c: TeCampaign; m: TeMeasure } {
  const c = emptyCampaign('Calc test', 'T1')
  const m = { ...emptyMeasure('m1', 'q1'), name: 'Test measure', ...measurePatch }
  c.measures.push(m)
  const card = emptyCard('card1', 'TC-001')
  card.measureIds = [m.id]
  c.cards.push(card)
  return { c, m }
}

function addRun(c: TeCampaign, m: TeMeasure, patch: RunPatch = {}): TeRun {
  const run = emptyRun(`run-${++runSeq}`, c.cards[0])
  run.startAt = patch.started === false ? null : '2026-08-01T10:00:00Z'
  run.validity = patch.validity ?? 'valid'
  run.excluded = patch.excluded ?? false
  if (patch.allowed) run.allowedMeasureIds = [m.id]
  run.observations = [
    {
      measureId: m.id,
      status: patch.status ?? 'observed',
      success: patch.success ?? null,
      value: patch.value ?? null,
      note: '',
    },
  ]
  c.runs.push(run)
  return run
}

function addBinomialRuns(c: TeCampaign, m: TeMeasure, successes: number, failures: number): void {
  for (let i = 0; i < successes; i++) addRun(c, m, { success: true })
  for (let i = 0; i < failures; i++) addRun(c, m, { success: false })
}

describe('computeMeasure binomial', () => {
  it('F-01/F-02: 16/20 valid runs give 0.80 with Wilson 0.58 to 0.92', () => {
    const { c, m } = makeCampaign({ family: 'binomial' })
    const cell = { ...emptyMatrixCell('cell1'), measureIds: [m.id], plannedReps: 20 }
    c.matrix.push(cell)
    addBinomialRuns(c, m, 16, 4)
    const comp = computeMeasure(c, m.id)
    expect(comp).not.toBeNull()
    expect(comp!.nPlanned).toBe(20)
    expect(comp!.nAttempted).toBe(20)
    expect(comp!.nEligible).toBe(20)
    expect(comp!.nValid).toBe(20)
    expect(comp!.nIncluded).toBe(20)
    expect(comp!.successes).toBe(16)
    expect(comp!.estimate).toBe(0.8)
    expect(comp!.interval!.method).toBe('wilson')
    expect(comp!.interval!.lo).toBeCloseTo(0.58, 2)
    expect(comp!.interval!.hi).toBeCloseTo(0.92, 2)
    expect(comp!.label).toBe('descriptive')
    expect(comp!.thresholdShown).toBe(false)
    expect(comp!.values).toEqual([])
  })

  it('enforces the denominator discipline across statuses and validity', () => {
    const { c, m } = makeCampaign({ family: 'binomial' })
    addRun(c, m, { success: true })
    addRun(c, m, { success: true })
    addRun(c, m, { success: false })
    addRun(c, m, { validity: 'conditionally-valid', allowed: true, success: true })
    addRun(c, m, { validity: 'conditionally-valid', success: true })
    addRun(c, m, { validity: 'pending', success: true })
    addRun(c, m, { validity: 'invalid', success: true })
    addRun(c, m, { excluded: true, success: true })
    addRun(c, m, { status: 'censored' })
    addRun(c, m, { status: 'missing' })
    addRun(c, m, { status: 'unknown-outcome' })
    addRun(c, m, { status: 'no-test' })
    addRun(c, m, { started: false, success: true })
    const comp = computeMeasure(c, m.id)!
    expect(comp.perRun).toHaveLength(13)
    expect(comp.nAttempted).toBe(12)
    expect(comp.nEligible).toBe(11)
    expect(comp.nValid).toBe(6)
    expect(comp.nIncluded).toBe(4)
    expect(comp.successes).toBe(3)
    expect(comp.estimate).toBe(0.75)
    expect(comp.notes.join(' ')).toContain('censored')
    expect(comp.notes.join(' ')).toContain('unknown-outcome')
    expect(comp.perRun.filter((r) => r.included)).toHaveLength(4)
  })

  it('F-33/F-21: combined 25/28 handoffs give 0.893 and borderline against 0.90', () => {
    const { c, m } = makeCampaign({
      family: 'binomial',
      threshold: 0.9,
      thresholdApproved: true,
      thresholdSource: 'contract-validated-requirement',
    })
    addBinomialRuns(c, m, 25, 3)
    const comp = computeMeasure(c, m.id)!
    expect(comp.estimate).toBeCloseTo(0.893, 3)
    expect(comp.interval!.lo).toBeCloseTo(0.73, 2)
    expect(comp.interval!.hi).toBeCloseTo(0.96, 2)
    expect(comp.thresholdShown).toBe(true)
    expect(comp.label).toBe('borderline')
  })

  it('passes and misses on thresholds outside the interval', () => {
    const pass = makeCampaign({ family: 'binomial', threshold: 0.5, thresholdApproved: true })
    addBinomialRuns(pass.c, pass.m, 25, 3)
    expect(computeMeasure(pass.c, pass.m.id)!.label).toBe('pass')
    const miss = makeCampaign({ family: 'binomial', threshold: 0.99, thresholdApproved: true })
    addBinomialRuns(miss.c, miss.m, 25, 3)
    expect(computeMeasure(miss.c, miss.m.id)!.label).toBe('miss')
  })

  it('suppresses pass/fail without an approved threshold', () => {
    const { c, m } = makeCampaign({ family: 'binomial', threshold: 0.9, thresholdApproved: false })
    addBinomialRuns(c, m, 25, 3)
    const comp = computeMeasure(c, m.id)!
    expect(comp.label).toBe('descriptive')
    expect(comp.thresholdShown).toBe(false)
    expect(comp.notes.join(' ')).toContain('suppressed')
  })

  it('is unavailable when nothing is computable', () => {
    const { c, m } = makeCampaign({ family: 'binomial' })
    addRun(c, m, { validity: 'pending', success: true })
    const comp = computeMeasure(c, m.id)!
    expect(comp.estimate).toBeNull()
    expect(comp.interval).toBeNull()
    expect(comp.label).toBe('unavailable')
  })

  it('F-03: bayes method carries the Beta(17, 5) posterior interval', () => {
    const { c, m } = makeCampaign({ family: 'binomial', intervalMethod: 'bayes' })
    addBinomialRuns(c, m, 16, 4)
    const comp = computeMeasure(c, m.id)!
    expect(comp.estimate).toBe(0.8)
    expect(comp.interval!.method).toBe('bayes')
    expect(comp.interval!.lo).toBeCloseTo(0.5809, 4)
    expect(comp.interval!.hi).toBeCloseTo(0.9178, 4)
    expect(comp.notes.join(' ')).toContain('Beta(17, 5)')
  })

  it('exact method uses Clopper-Pearson', () => {
    const { c, m } = makeCampaign({ family: 'binomial', intervalMethod: 'exact' })
    addBinomialRuns(c, m, 16, 4)
    const comp = computeMeasure(c, m.id)!
    expect(comp.interval!.method).toBe('exact')
    expect(comp.interval!.lo).toBeCloseTo(0.5634, 4)
    expect(comp.interval!.hi).toBeCloseTo(0.9427, 4)
  })
})

describe('computeMeasure value families', () => {
  it('latency uses the mean with a t interval', () => {
    const { c, m } = makeCampaign({ family: 'latency', unit: 's' })
    for (const v of [10, 12, 14, 16]) addRun(c, m, { value: v })
    const comp = computeMeasure(c, m.id)!
    expect(comp.estimate).toBe(13)
    expect(comp.values).toEqual([10, 12, 14, 16])
    expect(comp.interval!.lo).toBeLessThan(13)
    expect(comp.interval!.hi).toBeGreaterThan(13)
    expect(comp.notes.join(' ')).toContain('t-based')
  })

  it('a single value gives a point estimate without an interval', () => {
    const { c, m } = makeCampaign({ family: 'continuous' })
    addRun(c, m, { value: 42 })
    const comp = computeMeasure(c, m.id)!
    expect(comp.estimate).toBe(42)
    expect(comp.interval).toBeNull()
    expect(comp.label).toBe('descriptive')
  })

  it('F-29: continuity difference -0.02 passes the -0.03 limit', () => {
    const { c, m } = makeCampaign({
      family: 'margin',
      threshold: -0.03,
      thresholdApproved: true,
      higherIsBetter: true,
    })
    addRun(c, m, { value: -0.02 })
    const comp = computeMeasure(c, m.id)!
    expect(comp.estimate).toBe(-0.02)
    expect(comp.label).toBe('pass')
  })

  it('F-30: RMSE 28 m and 34 m both pass the 50 m limit', () => {
    for (const rmse of [28, 34]) {
      const { c, m } = makeCampaign({
        family: 'continuous',
        threshold: 50,
        thresholdApproved: true,
        higherIsBetter: false,
      })
      addRun(c, m, { value: rmse })
      expect(computeMeasure(c, m.id)!.label).toBe('pass')
    }
  })

  it('F-31: added 90th-percentile latency 0.6 s passes the 1.0 s limit', () => {
    const { c, m } = makeCampaign({
      family: 'latency',
      threshold: 1.0,
      thresholdApproved: true,
      higherIsBetter: false,
    })
    addRun(c, m, { value: 0.6 })
    expect(computeMeasure(c, m.id)!.label).toBe('pass')
  })

  it('F-32: false-track rates 0.4/hr and 1.2/hr both pass the 1.5/hr limit', () => {
    for (const rate of [0.4, 1.2]) {
      const { c, m } = makeCampaign({
        family: 'rate',
        threshold: 1.5,
        thresholdApproved: true,
        higherIsBetter: false,
      })
      addRun(c, m, { value: rate })
      const comp = computeMeasure(c, m.id)!
      expect(comp.estimate).toBe(rate)
      expect(comp.label).toBe('pass')
    }
  })

  it('count totals across included runs without an interval', () => {
    const { c, m } = makeCampaign({ family: 'count' })
    for (const v of [2, 3, 4]) addRun(c, m, { value: v })
    const comp = computeMeasure(c, m.id)!
    expect(comp.estimate).toBe(9)
    expect(comp.interval).toBeNull()
  })
})

describe('computeMeasure and computeAllMeasures shells', () => {
  it('returns null for an unknown measure id', () => {
    const { c } = makeCampaign({})
    expect(computeMeasure(c, 'nope')).toBeNull()
  })

  it('computes every campaign measure', () => {
    const { c, m } = makeCampaign({ family: 'binomial' })
    const m2 = { ...emptyMeasure('m2', 'q1'), family: 'latency' as const }
    c.measures.push(m2)
    addRun(c, m, { success: true })
    const all = computeAllMeasures(c)
    expect(all).toHaveLength(2)
    expect(all[0].measureId).toBe('m1')
    expect(all[1].measureId).toBe('m2')
    expect(all[1].label).toBe('unavailable')
  })
})
