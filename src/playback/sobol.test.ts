import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import { uncertainFields } from '../analysis/uncertainty'
import type { BootstrapInterval } from './mcTypes'
import { sobolDesign, sobolIndices, sobolLoop } from './sobol'

/**
 * Ishigami with a 7 and b 0.1 on [-pi, pi]^3: the analytic indices are
 * S1 0.3139, S2 0.4424, S3 0, ST1 0.5576, ST2 0.4424, ST3 0.2437.
 */
function ishigami(rows: number[][]): number[] {
  return rows.map((r) => {
    const [x1, x2, x3] = r.map((u) => -Math.PI + 2 * Math.PI * u)
    return Math.sin(x1) + 7 * Math.sin(x2) ** 2 + 0.1 * x3 ** 4 * Math.sin(x1)
  })
}

const inside = (iv: BootstrapInterval, value: number) => iv.lo <= value && value <= iv.hi

describe('sobolIndices', () => {
  it('recovers the Ishigami indices inside their bootstrap intervals at base 1024', () => {
    const out = sobolIndices(ishigami, 3, 1024, 4821)
    expect(out.evaluations).toBe(1024 * 5)
    const expectFirst = [0.3139, 0.4424, 0]
    const expectTotal = [0.5576, 0.4424, 0.2437]
    out.firstOrder.forEach((iv, i) => {
      expect(iv.bootstrap).toBe(200)
      expect(iv.confidence).toBe(0.95)
      expect(iv.lo).toBeLessThanOrEqual(iv.value)
      expect(iv.value).toBeLessThanOrEqual(iv.hi)
      expect(inside(iv, expectFirst[i])).toBe(true)
    })
    out.total.forEach((iv, i) => expect(inside(iv, expectTotal[i])).toBe(true))
    // Ranking by first order is x2, x1, x3; by total x1, x2, x3.
    const byFirst = [0, 1, 2].sort((a, b) => out.firstOrder[b].value - out.firstOrder[a].value)
    expect(byFirst).toEqual([1, 0, 2])
    expect(out.ranking).toEqual([0, 1, 2])
  })

  it('two independent Bernoulli factors split the variance by their contributions', () => {
    // y = 1[u1 < 0.5] + 2 * 1[u2 < 0.5]: variances 0.25 and 1, no interaction, so
    // S1 = ST1 = 0.2 and S2 = ST2 = 0.8.
    const f = (rows: number[][]) => rows.map(([u1, u2]) => (u1 < 0.5 ? 1 : 0) + (u2 < 0.5 ? 2 : 0))
    const out = sobolIndices(f, 2, 2048, 1)
    expect(inside(out.firstOrder[0], 0.2)).toBe(true)
    expect(inside(out.total[0], 0.2)).toBe(true)
    expect(inside(out.firstOrder[1], 0.8)).toBe(true)
    expect(inside(out.total[1], 0.8)).toBe(true)
    expect(out.ranking).toEqual([1, 0])
  })

  it('the design is keyed: same seed same rows, AB_i takes column i from B', () => {
    const rows = sobolDesign(3, 4, 9)
    expect(rows).toHaveLength(20)
    expect(sobolDesign(3, 4, 9)).toEqual(rows)
    expect(sobolDesign(3, 4, 10)).not.toEqual(rows)
    for (let r = 0; r < 4; r += 1) {
      for (let i = 0; i < 3; i += 1) {
        const ab = rows[(2 + i) * 4 + r]
        for (let c = 0; c < 3; c += 1) expect(ab[c]).toBe(c === i ? rows[4 + r][c] : rows[r][c])
      }
    }
    expect(rows.flat().every((u) => u >= 0 && u < 1)).toBe(true)
  })

  it('sobolIndices rejects a response count that does not fit the design', () => {
    expect(() => sobolIndices((rows) => rows.slice(1).map(() => 0), 2, 4, 1)).toThrow(
      /16 responses/,
    )
  })
})

describe('sobolLoop', () => {
  it('runs the JIATF-401 laydown at base 8 over two kept fields to a contract-shaped result', () => {
    // On the first detect: the end-of-run leakers are constant over eight base
    // rows here, and a response with no variance gives NaN indices.
    const s = { ...parseAutosave(JSON.stringify(fixture)), sobolBase: 8 }
    const fields = uncertainFields(s)
    const kept = [
      fields.find((f) => f.modelId === 'lib-coyote' && f.field === 'pk')!,
      fields.find((f) => f.modelId === 'lib-kurfs' && f.field === 'detectRangeM')!,
    ]
    const progress: number[] = []
    const loop = sobolLoop(s, kept, 'firstDetectS', (done) => progress.push(done))
    let checkpoints = 0
    let next = loop.next()
    while (!next.done) {
      checkpoints += 1
      expect(next.value.total).toBe(32)
      next = loop.next()
    }
    const result = next.value
    if (result == null) throw new Error('sobolLoop returned null')
    expect(checkpoints).toBe(31)
    expect(progress).toHaveLength(32)
    expect(result).toMatchObject({
      method: 'saltelli',
      base: 8,
      evaluations: 32,
      response: 'firstDetectS',
      seed: 4821,
    })
    expect(result.fields.map((f) => f.field)).toEqual(kept)
    expect(result.ranking.slice().sort()).toEqual([0, 1])
    for (const f of result.fields) {
      for (const iv of [f.firstOrder, f.total]) {
        expect(iv).toMatchObject({ bootstrap: 200, confidence: 0.95 })
        expect(Number.isFinite(iv.value)).toBe(true)
        expect(iv.lo).toBeLessThanOrEqual(iv.hi)
      }
    }
  }, 30000)

  it('a cancel returns null; a budget stop throws and names the budget', () => {
    const s = { ...parseAutosave(JSON.stringify(fixture)), sobolBase: 2 }
    const cancelled = sobolLoop(s, uncertainFields(s).slice(0, 1))
    cancelled.next()
    expect(cancelled.next('cancelled')).toEqual({ done: true, value: null })
    const budget = sobolLoop(s, uncertainFields(s).slice(0, 1))
    budget.next()
    expect(() => budget.next('budget')).toThrow(
      'Sobol stopped at the worker time budget after 1 of 6 rows; the Morris screening stands',
    )
  })
})
