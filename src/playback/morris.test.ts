import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import { uncertainFields } from '../analysis/uncertainty'
import type { MorrisResult } from './mcTypes'
import {
  fieldGroup,
  keptFields,
  morrisDesign,
  morrisIndices,
  morrisLoop,
  MORRIS_KEPT,
  QUANTILE_MARGIN,
  rowScenario,
} from './morris'

describe('morrisDesign', () => {
  it('moves one factor by delta per step, stays in the hypercube and is keyed by seed', () => {
    const d = morrisDesign(4, 10, 4821, 4)
    expect(d.delta).toBeCloseTo(2 / 3, 12)
    expect(d.rows).toHaveLength(50)
    for (let t = 0; t < 10; t += 1) {
      const seen = new Set<number>()
      for (let step = 0; step < 4; step += 1) {
        const before = d.rows[t * 5 + step]
        const after = d.rows[t * 5 + step + 1]
        const moved = [0, 1, 2, 3].filter((j) => before[j] !== after[j])
        expect(moved).toEqual([d.order[t][step]])
        expect(after[moved[0]] - before[moved[0]]).toBeCloseTo(d.steps[t][step], 12)
        expect(Math.abs(d.steps[t][step])).toBeCloseTo(d.delta, 12)
        seen.add(moved[0])
      }
      expect(seen.size).toBe(4)
    }
    expect(d.rows.flat().every((u) => u >= 0 && u <= 1)).toBe(true)
    // Every coordinate sits on the four-level grid.
    expect(d.rows.flat().every((u) => Number.isInteger(Math.round(u * 3 * 1e9) / 1e9))).toBe(true)
    expect(morrisDesign(4, 10, 4821, 4)).toEqual(d)
    expect(morrisDesign(4, 10, 4822, 4)).not.toEqual(d)
    // Odd levels keep the base point where a step fits.
    expect(morrisDesign(3, 20, 1, 5).rows.flat().every((u) => u >= 0 && u <= 1)).toBe(true)
  })
})

describe('morrisIndices', () => {
  it('a linear response gives mu equal to the slope and sigma 0; ranking by mu star', () => {
    // The third factor does nothing.
    const f = (rows: number[][]) => rows.map(([a, b]) => 2 * a - 5 * b)
    const { effects, ranking, evaluations } = morrisIndices(f, 3, 10, 4821, 4)
    expect(evaluations).toBe(40)
    expect(effects[0].mu).toBeCloseTo(2, 9)
    expect(effects[0].muStar).toBeCloseTo(2, 9)
    expect(effects[0].sigma).toBeCloseTo(0, 9)
    expect(effects[1].mu).toBeCloseTo(-5, 9)
    expect(effects[1].muStar).toBeCloseTo(5, 9)
    expect(effects[2].muStar).toBeCloseTo(0, 9)
    expect(ranking).toEqual([1, 0, 2])
  })

  it('an interaction shows as sigma, and the kept set is the top eight of the ranking', () => {
    const f = (rows: number[][]) => rows.map(([a, b]) => a * b)
    const { effects } = morrisIndices(f, 2, 10, 3, 4)
    expect(effects[0].sigma).toBeGreaterThan(0)
    expect(keptFields([4, 2, 9, 0, 1, 3, 5, 6, 7, 8])).toEqual([4, 2, 9, 0, 1, 3, 5, 6])
    expect(keptFields([1, 0])).toEqual([1, 0])
    expect(MORRIS_KEPT).toBe(8)
  })
})

describe('morrisLoop', () => {
  const laydown = () => parseAutosave(JSON.stringify(fixture))

  it('maps a row to the p10 to p90 band of each listed field and leaves the rest nominal', () => {
    const s = laydown()
    const fields = uncertainFields(s)
    const pk = fields.findIndex((f) => f.modelId === 'lib-coyote' && f.field === 'pk')
    const zero = fields.map(() => 0)
    const one = fields.map(() => 1)
    const coyote = (sc: typeof s) => sc.library.find((m) => m.id === 'lib-coyote')!.effector!.pk
    expect(QUANTILE_MARGIN).toBe(0.1)
    expect(coyote(rowScenario(s, fields, zero))).toBeLessThan(coyote(s)!)
    expect(coyote(rowScenario(s, fields, one))).toBeGreaterThan(coyote(s)!)
    // Only the one field listed moves.
    const only = rowScenario(s, [fields[pk]], [1])
    expect(coyote(only)).toBe(coyote(rowScenario(s, fields, one)))
    expect(only.library.find((m) => m.id === 'lib-kurfs')).toBe(s.library.find((m) => m.id === 'lib-kurfs'))
    expect(fieldGroup(s, fields[pk])).toBe('effector')
    expect(fieldGroup(s, { modelId: 'doctrine', field: 'declareHostileS', spread: fields[0].spread })).toBe('doctrine')
    expect(fieldGroup(s, { modelId: 'con-mtnvzhmr-27', field: 'latencyS', spread: fields[0].spread })).toBe('connection')
  })

  it('screens the JIATF-401 first detect: KuRFS range leads, kept is the top eight, evaluations 10 (k + 1)', () => {
    // The end-of-run leakers are 0 in every row of this laydown at ten
    // trajectories (one 0/1 replicate per row), so the screening reads the
    // raid's first detect, which the KuRFS range and the Mavic RCS move.
    const s = laydown()
    const k = uncertainFields(s).length
    expect(k).toBe(13)
    const progress: Array<[number, number]> = []
    const loop = morrisLoop(s, 'firstDetectS', (done, total) => progress.push([done, total]))
    let next = loop.next()
    while (!next.done) next = loop.next()
    const result = next.value as MorrisResult
    expect(result).toMatchObject({ method: 'morris', trajectories: 10, response: 'firstDetectS', seed: 4821 })
    expect(result.evaluations).toBe(10 * (k + 1))
    expect(progress).toHaveLength(result.evaluations)
    expect(progress.at(-1)).toEqual([result.evaluations, result.evaluations])
    expect(result.fields).toHaveLength(k)
    expect(result.ranking).toHaveLength(k)
    expect([...result.ranking].sort((a, b) => a - b)).toEqual(Array.from({ length: k }, (_, i) => i))
    for (let r = 1; r < k; r += 1) {
      expect(result.fields[result.ranking[r - 1]].muStar).toBeGreaterThanOrEqual(result.fields[result.ranking[r]].muStar)
    }
    expect(result.kept).toEqual(result.ranking.slice(0, 8))
    const top = result.fields[result.ranking[0]].field
    expect(`${top.modelId}.${top.field}`).toBe('lib-kurfs.detectRangeM')
    expect(result.fields[result.ranking[0]].muStar).toBeGreaterThan(0)
    expect(result.fields[result.ranking[0]].sigma).toBeGreaterThan(0)
  }, 60000)

  it('a stop keeps the trajectories completed and throws with none', () => {
    const s = laydown()
    const k = uncertainFields(s).length
    const loop = morrisLoop(s)
    let next = loop.next()
    while (!next.done && next.value.done < 2 * (k + 1)) next = loop.next()
    next = loop.next('cancelled')
    expect(next.done).toBe(true)
    const cut = next.value as MorrisResult
    expect(cut.trajectories).toBe(2)
    expect(cut.evaluations).toBe(2 * (k + 1))
    const early = morrisLoop(s)
    early.next()
    expect(() => early.next('budget')).toThrow(/before its first trajectory/)
  }, 60000)
})
