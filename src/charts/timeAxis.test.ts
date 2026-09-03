import { describe, expect, it } from 'vitest'
import { TICK_STEPS, tickStepS, timeTicks } from './timeAxis'

describe('tickStepS', () => {
  it('picks the first step that spaces ticks at least 70 px apart', () => {
    // 120 s over 488 s on 312 px = 76.7 px; 60 s would be 38 px.
    expect(tickStepS(488, 312)).toBe(120)
    // 10 s over 40 s on 300 px = 75 px.
    expect(tickStepS(40, 300)).toBe(10)
    // 15 s over 60 s on 300 px = 75 px; 10 s would be 50 px.
    expect(tickStepS(60, 300)).toBe(15)
  })

  it('falls back to 7200 when no listed step reaches 70 px', () => {
    expect(tickStepS(100000, 312)).toBe(7200)
    expect(TICK_STEPS[TICK_STEPS.length - 1]).toBe(3600)
  })
})

describe('timeTicks', () => {
  it('starts at 0 and ends at or before the duration', () => {
    const ticks = timeTicks(488, 312)
    expect(ticks[0]).toBe(0)
    expect(ticks).toEqual([0, 120, 240, 360, 480])
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(488)
  })

  it('includes the duration when it lands on a step', () => {
    expect(timeTicks(40, 300)).toEqual([0, 10, 20, 30, 40])
  })

  it('gives only 0 for an empty duration', () => {
    expect(timeTicks(0, 312)).toEqual([0])
  })
})
