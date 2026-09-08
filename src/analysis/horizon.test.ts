import { describe, expect, it } from 'vitest'
import { censorValues, EMPTY_HORIZON, FULL_RUN, reached, visibleCount } from './horizon'

describe('execution horizon', () => {
  const partial = { scoped: true, horizonS: 3 }

  it('distinguishes full-run, empty and observed outcomes, including missing times', () => {
    expect(Object.isFrozen(FULL_RUN)).toBe(true)
    expect(Object.isFrozen(EMPTY_HORIZON)).toBe(true)
    expect(reached(1000, FULL_RUN)).toBe(true)
    expect(reached(0, EMPTY_HORIZON)).toBe(false)
    expect(reached(3, partial)).toBe(true)
    expect(reached(3.01, partial)).toBe(false)
    expect(reached(null, FULL_RUN)).toBe(false)
    expect(reached(undefined, FULL_RUN)).toBe(false)
  })

  it('counts leading grid samples inclusively with a nonzero origin', () => {
    expect(visibleCount(5, 1, 1, FULL_RUN)).toBe(5)
    expect(visibleCount(5, 1, 1, EMPTY_HORIZON)).toBe(0)
    expect(visibleCount(5, 1, 1, partial)).toBe(3)
    expect(visibleCount(5, 4, 1, partial)).toBe(0)
    expect(visibleCount(2, 0, 1, partial)).toBe(2)
    expect(visibleCount(0, 0, 1, partial)).toBe(0)
    const h = { scoped: true, horizonS: 3 * 0.1 }
    expect(visibleCount(10, 0, 0.1, h)).toBe(4)
  })

  it('preserves array identity when unscoped, fully reached or empty', () => {
    const values = [1, null, 3]
    expect(censorValues(values, 0, 1, FULL_RUN)).toBe(values)
    expect(censorValues(values, 0, 1, partial)).toBe(values)
    expect(censorValues(values, 0, 1, { scoped: false, horizonS: -Infinity })).toBe(values)
    const empty: number[] = []
    expect(censorValues(empty, 0, 1, EMPTY_HORIZON)).toBe(empty)
  })

  it('copies and censors only samples past the horizon without changing source gaps', () => {
    const values = [1, null, 3, 4, 5]
    const result = censorValues(values, 1, 1, partial)
    expect(result).toEqual([1, null, 3, null, null])
    expect(result).not.toBe(values)
    expect(censorValues(values, 1, 1, EMPTY_HORIZON)).toEqual([null, null, null, null, null])
    expect(values).toEqual([1, null, 3, 4, 5])
  })
})
