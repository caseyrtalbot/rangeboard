import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '../../model/types'
import type { OptimizeEvaluation } from '../optimizeTypes'
import {
  CANDIDATE_CAP,
  evaluateLaydown,
  optimizeLoop,
  rankCandidates,
  responseKind,
  runOptimize,
  SEED_EVALUATIONS,
  startingLaydown,
} from './loop'
import { pointInPolygon } from './polygon'
import { EFFECTOR_ID, placementRequest, RANGE_POINTS, START_POS } from './__fixtures__/placementFixture'

const inside = (e: OptimizeEvaluation) => pointInPolygon(e.positions[EFFECTOR_ID], RANGE_POINTS)

describe('optimizeLoop', () => {
  it('moves the effector onto the path: the best interval lies below the start interval', () => {
    // The full plan budget: 60 evaluations of 40 replicates.
    const request = placementRequest()
    const result = runOptimize(request)
    expect(result.method).toBe('gp-ei')
    expect(result.trace).toHaveLength(60)
    expect(result.replicatesRun).toBe(2400)
    const start = result.trace[0]
    expect(start.index).toBe(0)
    expect(start.incumbent).toBe(true)
    expect(start.positions).toEqual({ [EFFECTOR_ID]: START_POS })
    // Off the path the ship always leaks: 40 of 40 at the one-ship maximum,
    // so the interval is the rule-of-three bound [1 - 3 / 40, 1] = [0.925, 1].
    expect(start.objective.mean).toBe(1)
    expect(start.objective.interval).toBe('rule-of-three')
    expect(start.objective.lo).toBeCloseTo(0.925, 12)
    expect(start.objective.hi).toBe(1)
    // On the path the one shot lands with Pk 0.6, so the leaker mean sits
    // near 0.4 and its Wilson interval well under 0.925.
    const best = result.candidates[0]
    expect(best.objective.interval).toBe('wilson')
    expect(best.objective.mean).toBeLessThan(0.7)
    expect(best.objective.hi).toBeLessThan(start.objective.lo)
    const bestTrace = result.trace[best.evaluationIndex]
    expect(bestTrace.positions).toEqual(best.positions)
    expect(bestTrace.incumbent).toBe(true)
    // The winning placement is within the 1.5 km envelope of the path (y = 0, x in [-6000, 0]).
    const p = best.positions[EFFECTOR_ID]
    expect(Math.abs(p.y)).toBeLessThan(1500)
    expect(p.x).toBeGreaterThan(-7500)
    expect(p.x).toBeLessThan(1500)
  }, 60000)

  it('common random numbers: the start evaluated twice gives an identical Stat', () => {
    const request = placementRequest({ budget: { evaluations: 1, replicates: 40, seed: DEFAULT_SEED } })
    const kind = responseKind('leakers', 1)
    const laydown = startingLaydown(request)
    const a = evaluateLaydown(request.scenario, laydown, request.objective, request.budget, kind)
    const b = evaluateLaydown(request.scenario, laydown, request.objective, request.budget, kind)
    expect(a).toEqual(b)
    // The loop's own evaluation of the start is the same Stat.
    expect(runOptimize(request).trace[0].objective).toEqual(a)
    // Placement alone moves the draw: the same seed on the path gives another Stat.
    const onPath = evaluateLaydown(
      request.scenario, { [EFFECTOR_ID]: { x: -3000, y: 0 } }, request.objective, request.budget, kind,
    )
    expect(onPath.mean).not.toBe(a.mean)
  })

  it('a seeded run reproduces bit for bit; another seed differs', () => {
    const budget = { evaluations: 14, replicates: 8, seed: 7 }
    const first = runOptimize(placementRequest({ budget }))
    const second = runOptimize(placementRequest({ budget }))
    expect(second).toEqual(first)
    const other = runOptimize(placementRequest({ budget: { ...budget, seed: 8 } }))
    expect(other.trace.map((e) => e.positions)).not.toEqual(first.trace.map((e) => e.positions))
  })

  it('keeps every evaluation and candidate inside a concave polygon', () => {
    // An L-shaped range: the box minus its upper-right quadrant.
    const points = [
      { x: -7000, y: -3000 }, { x: 1000, y: -3000 }, { x: 1000, y: 1500 },
      { x: -3000, y: 1500 }, { x: -3000, y: 6000 }, { x: -7000, y: 6000 },
    ]
    const request = placementRequest({
      scenario: placementRequest().scenario,
      bounds: { boundaryId: 'range-1', points },
      budget: { evaluations: 20, replicates: 8, seed: 3 },
    })
    // The start sits in the removed quadrant; every proposal must not.
    const result = runOptimize(request)
    expect(result.trace).toHaveLength(20)
    expect(pointInPolygon(result.trace[0].positions[EFFECTOR_ID], points)).toBe(false)
    for (const e of result.trace.slice(1)) expect(pointInPolygon(e.positions[EFFECTOR_ID], points)).toBe(true)
    // The seed rows are a Latin hypercube over the box: SEED_EVALUATIONS
    // distinct points after the start, then the EI proposals.
    const seeds = result.trace.slice(1, 1 + SEED_EVALUATIONS).map((e) => JSON.stringify(e.positions))
    expect(new Set(seeds).size).toBe(SEED_EVALUATIONS)
  })

  it('ranks distinct candidates best first, capped at five, and follows a maximize direction', () => {
    const budget = { evaluations: 16, replicates: 8, seed: 11 }
    const result = runOptimize(placementRequest({ budget, objective: { response: 'kills', direction: 'maximize' } }))
    expect(result.candidates.length).toBe(CANDIDATE_CAP)
    const means = result.candidates.map((c) => c.objective.mean)
    for (let i = 1; i < means.length; i += 1) expect(means[i]).toBeLessThanOrEqual(means[i - 1])
    expect(new Set(result.candidates.map((c) => JSON.stringify(c.positions))).size).toBe(CANDIDATE_CAP)
    // Kills count over the raid's one ship: the best evaluation reads a Wilson interval on k of 8.
    expect(result.candidates[0].objective.interval).toMatch(/wilson|rule-of-three/)
    expect(result.candidates[0].objective.n).toBe(8)
    // The incumbent flags rise monotonically with the mean along the trace.
    let best = -Infinity
    for (const e of result.trace) {
      if (e.incumbent) {
        expect(e.index === 0 || e.objective.mean > best).toBe(true)
        best = Math.max(best, e.objective.mean)
      } else {
        expect(e.objective.mean).toBeLessThanOrEqual(best)
      }
    }
    expect(result.trace.every(inside)).toBe(true)
  })

  it('reports progress per evaluation and a stop keeps the completed trace', () => {
    const budget = { evaluations: 6, replicates: 4, seed: 5 }
    const progress: number[] = []
    const loop = optimizeLoop(placementRequest({ budget }), (done, total, best) => {
      progress.push(done)
      expect(total).toBe(6)
      expect(best.incumbent).toBe(true)
    })
    // Four replicates per evaluation: the checkpoint after the 8th reads done 2.
    let next = loop.next()
    for (let i = 0; i < 7; i += 1) next = loop.next()
    if (next.done) throw new Error('ended early')
    expect(next.value).toEqual({ done: 2, total: 6, retained: 0 })
    const stopped = loop.next('cancelled')
    if (!stopped.done) throw new Error('did not stop')
    expect(stopped.value.trace).toHaveLength(2)
    expect(stopped.value.replicatesRun).toBe(8)
    expect(progress).toEqual([1, 2])
    expect(stopped.value.candidates.map((c) => c.evaluationIndex).sort()).toEqual([0, 1])
  })

  it('a stop before the start finished throws; an unknown movable id throws', () => {
    const loop = optimizeLoop(placementRequest({ budget: { evaluations: 2, replicates: 4, seed: 1 } }))
    loop.next()
    expect(() => loop.next('cancelled')).toThrow(/before the starting laydown/)
    expect(() => runOptimize(placementRequest({ movableIds: ['nobody'] }))).toThrow(/nobody/)
    expect(() => runOptimize(placementRequest({ bounds: { boundaryId: null, points: RANGE_POINTS.slice(0, 2) } })))
      .toThrow(/at least 3 points/)
  })
})

describe('rankCandidates', () => {
  const stat = (mean: number) => ({
    mean, sd: 0, se: 0, lo: mean, hi: mean, conf: 0.95, interval: 't' as const,
    p10: NaN, p90: NaN, p025: NaN, p975: NaN, n: 1, total: 1, defined: { p: 1, lo: 1, hi: 1 },
  })
  const at = (index: number, x: number, mean: number): OptimizeEvaluation => ({
    index, positions: { e: { x, y: 0 } }, objective: stat(mean), incumbent: false,
  })

  it('drops repeats, puts a NaN mean last and keeps trace order on ties', () => {
    const trace = [at(0, 0, 2), at(1, 1, 1), at(2, 0, 2), at(3, 2, NaN), at(4, 3, 1)]
    expect(rankCandidates(trace, 1).map((c) => c.evaluationIndex)).toEqual([1, 4, 0, 3])
    expect(rankCandidates(trace, -1).map((c) => c.evaluationIndex)).toEqual([0, 1, 4, 3])
  })
})
