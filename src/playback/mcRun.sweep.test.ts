import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/detection-outside-rings.json'
import { parseAutosave } from '../io/persist'
import type { Scenario } from '../model/types'
import type { McSweepRequest } from './mcRun'
import { runReplicates, runSweep, sweepCellScenario, sweepLoop, summaryNumbers } from './mcRun'
import { applySweepValue } from './sweepFactors'

/** The JIATF-401 firing laydown (seed 4821); the sweep sets its own replicate count. */
function laydown() {
  return parseAutosave(JSON.stringify(fixture))
}

type Spec = Omit<McSweepRequest, 'type' | 'runId'>
const grid = (scenario = laydown(), replicatesPerCell = 4): Spec => ({
  scenario,
  factors: [
    { id: 'threatAltitudeFt', values: [300, 3000] },
    { id: 'environmentPreset', values: ['clear-day', 'fog-day'] },
  ],
  replicatesPerCell,
  responses: ['leakers'],
})

describe('sweepLoop', () => {
  it('runs one full ensemble per cell in row-major order under the scenario seed', () => {
    const spec = grid()
    const progress: number[][] = []
    const summary = runSweep(spec, (done, total) => progress.push([done, total]))
    expect(progress).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ])
    expect(summary).toMatchObject({
      replicatesPerCell: 4,
      seed: 4821,
      responses: ['leakers'],
      elapsedMs: 0,
    })
    expect('stopped' in summary).toBe(false)
    expect(summary.cells.map((c) => c.index)).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ])
    expect(summary.cells.map((c) => c.values)).toEqual([
      [300, 'clear-day'],
      [300, 'fog-day'],
      [3000, 'clear-day'],
      [3000, 'fog-day'],
    ])
    // Each cell is the replicate loop on the same scenario edited by hand.
    for (const cell of summary.cells) {
      let s: Scenario = { ...spec.scenario, replicates: 4, targetHalfWidth: null }
      s = applySweepValue(s, 'threatAltitudeFt', cell.values[0])
      s = applySweepValue(s, 'environmentPreset', cell.values[1])
      const mc = runReplicates(s)
      expect(cell.summary).toEqual({
        kills: mc.kills,
        leakers: mc.leakers,
        firstDetectS: mc.firstDetectS,
        minWarningS: mc.minWarningS,
        perEffector: mc.perEffector,
        replicates: 4,
      })
      expect(cell.summary.replicates).toBe(4)
      expect(cell.summary.firstDetectS.total).toBe(4)
    }
    expect(Object.keys(summary.cells[0].summary)).toEqual([
      'kills',
      'leakers',
      'firstDetectS',
      'minWarningS',
      'perEffector',
      'replicates',
    ])
  }, 15_000)

  it('a one-factor sweep at the scenario value reproduces the plain replicate run', () => {
    const s = laydown()
    const spec: Spec = {
      scenario: s,
      factors: [{ id: 'threatSpeedMps', values: [20, 40] }],
      replicatesPerCell: 6,
      responses: ['leakers', 'kills'],
    }
    const summary = runSweep(spec)
    expect(summary.cells.map((c) => c.index)).toEqual([[0], [1]])
    const cell = sweepCellScenario(s, spec.factors, [1], 6)
    expect(cell.replicates).toBe(6)
    expect(cell.targetHalfWidth).toBeNull()
    expect(cell.uncertainty).toBe(s.uncertainty)
    expect(summary.cells[1].summary.leakers).toEqual(runReplicates(cell).leakers)
  })

  it('a stop lands at any replicate and keeps the cells done under `stopped`', () => {
    const spec = grid()
    const full = runSweep(spec)
    expect(
      JSON.stringify(runSweep(spec, undefined, { retainedNumbers: Infinity, timeMs: Infinity })),
    ).toBe(JSON.stringify(full))
    // The wall budget stops at the first checkpoint, inside the first cell.
    const cut = runSweep(spec, undefined, { retainedNumbers: Infinity, timeMs: 0 })
    expect(cut.stopped).toEqual({ rule: 'budget', at: 0 })
    expect(cut.cells).toEqual([])
    const loop = sweepLoop(spec)
    let next = loop.next()
    expect(next.done).toBe(false)
    if (next.done) return
    // The first checkpoint is one replicate into the first cell.
    expect(next.value).toEqual({ done: 0, total: 4, retained: expect.any(Number) })
    expect(next.value.retained).toBeGreaterThan(0)
    // Checkpoints per replicate: three inside each cell of four, one after it.
    let count = 1
    while (!next.done && next.value.done < 2) {
      next = loop.next()
      count += 1
    }
    expect(count).toBe(8)
    expect(next.done).toBe(false)
    // The stop answers a checkpoint inside the third cell: two cells stay.
    next = loop.next()
    next = loop.next('cancelled')
    expect(next.done).toBe(true)
    if (!next.done) return
    expect(next.value.stopped).toEqual({ rule: 'cancelled', at: 2 })
    expect(next.value.cells).toEqual(full.cells.slice(0, 2))
  }, 15_000)

  it('refuses a cell whose summary alone is over the budget, and bad grids', () => {
    const spec = grid()
    const need = summaryNumbers(spec.scenario)
    expect(() =>
      runSweep(spec, undefined, { retainedNumbers: need - 1, timeMs: Infinity }),
    ).toThrow(/over the budget/)
    // A raid-size cell holds more threats than the base: the guard runs per cell.
    const raid: Spec = { ...spec, factors: [{ id: 'raidSize', values: [1, 4] }] }
    const loop = sweepLoop(raid, undefined, { retainedNumbers: need, timeMs: Infinity })
    let next = loop.next()
    while (!next.done && next.value.done < 1) next = loop.next()
    expect(next.done).toBe(false)
    expect(() => loop.next()).toThrow(/over the budget/)
    const drain = (s: Spec) => {
      const l = sweepLoop(s)
      l.next()
    }
    expect(() => drain({ ...spec, factors: [{ id: 'raidSize', values: [1] }] })).toThrow(
      /2 to 6 values/,
    )
    expect(() =>
      drain({ ...spec, factors: [{ id: 'raidSize', values: [1, 2, 3, 4, 5, 6, 7] }] }),
    ).toThrow(/2 to 6 values/)
    expect(() => drain({ ...spec, replicatesPerCell: 0 })).toThrow(/1 or more/)
  })
})
