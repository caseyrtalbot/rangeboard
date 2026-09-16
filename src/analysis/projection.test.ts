import { describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import { scenarioDurationS } from '../model/scenario'
import type { AttritionReport } from '../playback/attritionReport'
import { DT } from '../playback/clock'
import type { SensorObservation, ThreatAssessment } from '../playback/sim'
import {
  heldOnGrid,
  heldTracksOnGrid,
  heldUnionOnGrid,
  holdFrom,
  meanHeldPdOnGrid,
  nanGrid,
  pdOnGrid,
  residualOnGrid,
  sampleCount,
  stepAtOrAfter,
} from './projection'

/** The observation fields the projections read; the rest never matter here. */
function obs(
  sensorId: string,
  intervals: Array<[number, number]>,
  pd?: { startS: number; series: number[] },
): SensorObservation {
  return {
    sensorId,
    intervals,
    firstDetectS: intervals[0]?.[0] ?? 0,
    ...(pd ? { pdSeriesStartS: pd.startS, pdSeries: pd.series } : {}),
  } as unknown as SensorObservation
}

function track(uasId: string, observations: SensorObservation[]): ThreatAssessment {
  return {
    uasId,
    status: 'tracked',
    sensorObservations: observations,
  } as unknown as ThreatAssessment
}

const N = 9

describe('grid rules', () => {
  it('sampleCount is ceil(duration / DT) + 1 and nanGrid is all NaN', () => {
    const scenario = emptyScenario()
    expect(sampleCount(scenario)).toBe(Math.ceil(scenarioDurationS(scenario) / DT) + 1)
    const g = nanGrid(3)
    expect(g).toHaveLength(3)
    expect(g.every((v) => Number.isNaN(v))).toBe(true)
  })

  it('stepAtOrAfter snaps a rounding error onto its step and clamps negatives to 0', () => {
    expect(stepAtOrAfter(0)).toBe(0)
    expect(stepAtOrAfter(-1)).toBe(0)
    expect(stepAtOrAfter(DT)).toBe(1)
    expect(stepAtOrAfter(DT + 1e-12)).toBe(1)
    expect(stepAtOrAfter(DT + 1e-6)).toBe(2)
  })

  it('holdFrom writes from the step at or after t to the end', () => {
    const values = new Array<number>(5).fill(0)
    holdFrom(values, 2 * DT + 0.1, 7)
    expect(values).toEqual([0, 0, 0, 7, 7])
  })
})

describe('residualOnGrid', () => {
  it('steps the ship count down by killDelta at each effect time in effect order', () => {
    const report = {
      threats: [{ uasId: 'u1', shipCount: 3 }],
      events: [
        { uasId: 'u1', killDelta: 1, tEffectS: 3 * DT },
        { uasId: 'u1', killDelta: 1, tEffectS: 1 * DT },
        { uasId: 'u1', killDelta: 0, tEffectS: 2 * DT },
        { uasId: 'u2', killDelta: 1, tEffectS: 0 },
      ],
    } as unknown as AttritionReport
    expect(residualOnGrid(report, 'u1', 5)).toEqual([3, 2, 2, 1, 1])
    expect(residualOnGrid(report, 'missing', 2)).toEqual([1, 1])
  })
})

describe('observation flags', () => {
  it('heldOnGrid is 1 inside each inclusive interval and clamps to the grid end', () => {
    const o = obs('s1', [
      [DT, 2 * DT],
      [5 * DT, 50 * DT],
    ])
    expect(heldOnGrid(o, N)).toEqual([0, 1, 1, 0, 0, 1, 1, 1, 1])
  })

  it('pdOnGrid places the series from its start step and is null without a series', () => {
    expect(pdOnGrid(obs('s1', [[0, DT]]), N)).toBeNull()
    const values = pdOnGrid(
      obs('s1', [[0, DT]], { startS: 2 * DT, series: [0.5, 0.75, 1, 1, 1, 1, 1, 1] }),
      N,
    )!
    expect(values.slice(0, 5)).toEqual([NaN, NaN, 0.5, 0.75, 1])
    expect(values).toHaveLength(N)
  })
})

describe('held-track quantities', () => {
  const a = track('a', [
    obs('s1', [[0, DT]], { startS: 0, series: [0.2, 0.9] }),
    obs('s2', [[3 * DT, 4 * DT]], { startS: 3 * DT, series: [0.6] }),
  ])
  const b = track('b', [obs('s2', [[DT, 3 * DT]])])
  const c = track('c', [obs('s3', [[0, 8 * DT]])])
  const enabled = new Set(['s1', 's2'])

  it('heldUnionOnGrid ORs the enabled sensors and is null with none', () => {
    expect(heldUnionOnGrid(a, enabled, N)).toEqual([1, 1, 0, 1, 1, 0, 0, 0, 0])
    expect(heldUnionOnGrid(a, new Set(['s2']), N)).toEqual([0, 0, 0, 1, 1, 0, 0, 0, 0])
    expect(heldUnionOnGrid(c, enabled, N)).toBeNull()
    expect(heldUnionOnGrid(track('d', []), enabled, N)).toBeNull()
  })

  it('heldTracksOnGrid counts tracks held by at least one enabled sensor', () => {
    expect(heldTracksOnGrid([a, b, c], enabled, N)).toEqual([1, 2, 1, 2, 1, 0, 0, 0, 0])
    expect(heldTracksOnGrid([a, b, c], new Set(), N)).toEqual(new Array<number>(N).fill(0))
  })

  it('meanHeldPdOnGrid takes the best finite Pd per held track, then the mean', () => {
    const two = track('e', [obs('s1', [[0, DT]], { startS: 0, series: [0.4, 0.4] })])
    const mean = meanHeldPdOnGrid([a, b, c, two], enabled, N)
    // Step 0: a has 0.2 and two has 0.4; b is not yet held and c is disabled.
    expect(mean[0]).toBeCloseTo(0.3)
    // Step 1: a's best is 0.9, two's 0.4, b is held but has no Pd.
    expect(mean[1]).toBeCloseTo(0.65)
    // Step 3: only a is held, through s2 with Pd 0.6.
    expect(mean[3]).toBe(0.6)
    // Step 2: b alone is held and has no Pd; step 5 onward nothing is held.
    expect(mean[2]).toBeNaN()
    expect(mean.slice(5).every((v) => Number.isNaN(v))).toBe(true)
  })
})
