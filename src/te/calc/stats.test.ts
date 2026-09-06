/**
 * Fixtures F-01..F-36 from docs/te-compilation/MASTER-CALCULATIONS.md.
 * Mapped here: F-01..F-06, F-09, F-16 (inflation part), F-17, F-20..F-22, F-33.
 * Mapped elsewhere: F-08, F-13, F-24, F-26, F-27 in timeline.test.ts;
 * F-19 in accounting.test.ts; F-29..F-32 in measures.test.ts (label logic).
 * The other fixtures are plain arithmetic over authored data, state no
 * computable counts, or describe context only, so no test maps them.
 */

import { describe, expect, it } from 'vitest'
import {
  attemptInflation,
  betaPosterior,
  clopperPearson,
  meanInterval,
  quantile,
  sampleSizeProportion,
  wilson,
} from './stats'

describe('wilson', () => {
  it('F-01: reports p-hat 16/20 = 0.80', () => {
    expect(wilson(16, 20).p).toBe(0.8)
  })

  it('F-02: 16/20 at 95% gives about 0.58 to 0.92', () => {
    const w = wilson(16, 20)
    expect(w.lo).toBeCloseTo(0.58, 2)
    expect(w.hi).toBeCloseTo(0.92, 2)
    expect(w.method).toBe('wilson')
  })

  it('F-20: 18/20 gives 0.90 with about 0.70 to 0.97', () => {
    const w = wilson(18, 20)
    expect(w.p).toBeCloseTo(0.9, 10)
    expect(w.lo).toBeCloseTo(0.7, 2)
    expect(w.hi).toBeCloseTo(0.97, 2)
  })

  it('F-21: 25/28 gives 0.893 with about 0.73 to 0.96', () => {
    const w = wilson(25, 28)
    expect(w.p).toBeCloseTo(0.893, 3)
    expect(w.lo).toBeCloseTo(0.73, 2)
    expect(w.hi).toBeCloseTo(0.96, 2)
  })

  it('F-22: proportion 3/20 = 0.15', () => {
    expect(wilson(3, 20).p).toBe(0.15)
  })

  it('F-33: handoff proportions 0.95, 0.90, 0.875, 0.893', () => {
    expect(wilson(19, 20).p).toBe(0.95)
    expect(wilson(18, 20).p).toBeCloseTo(0.9, 10)
    expect(wilson(7, 8).p).toBe(0.875)
    expect(wilson(25, 28).p).toBeCloseTo(0.893, 3)
  })

  it('stays inside [0, 1] at the extremes', () => {
    expect(wilson(0, 10).lo).toBe(0)
    expect(wilson(10, 10).hi).toBe(1)
  })
})

describe('clopperPearson', () => {
  it('16/20 at 95% gives (0.5634, 0.9427)', () => {
    const cp = clopperPearson(16, 20)
    expect(cp.p).toBe(0.8)
    expect(cp.lo).toBeCloseTo(0.5634, 4)
    expect(cp.hi).toBeCloseTo(0.9427, 4)
    expect(cp.method).toBe('exact')
  })

  it('matches the closed form at x = 0 and x = n', () => {
    const zero = clopperPearson(0, 20)
    expect(zero.lo).toBe(0)
    expect(zero.hi).toBeCloseTo(1 - 0.025 ** (1 / 20), 10)
    const full = clopperPearson(20, 20)
    expect(full.hi).toBe(1)
    expect(full.lo).toBeCloseTo(0.025 ** (1 / 20), 10)
  })

  it('is at least as wide as Wilson', () => {
    const cp = clopperPearson(16, 20)
    const w = wilson(16, 20)
    expect(cp.lo).toBeLessThanOrEqual(w.lo)
    expect(cp.hi).toBeGreaterThanOrEqual(w.hi)
  })
})

describe('betaPosterior', () => {
  it('F-03: Beta(1,1) prior with 16/20 gives Beta(17, 5)', () => {
    const post = betaPosterior(1, 1, 16, 20)
    expect(post.a).toBe(17)
    expect(post.b).toBe(5)
    expect(post.mean).toBeCloseTo(17 / 22, 10)
    expect(post.method).toBe('bayes')
  })

  it('Beta(17, 5) equal-tailed 95% interval is (0.5809, 0.9178)', () => {
    const post = betaPosterior(1, 1, 16, 20)
    expect(post.lo).toBeCloseTo(0.5809, 4)
    expect(post.hi).toBeCloseTo(0.9178, 4)
  })

  it('matches the analytic quantiles of Beta(2, 1)', () => {
    const post = betaPosterior(1, 1, 1, 1)
    expect(post.lo).toBeCloseTo(Math.sqrt(0.025), 6)
    expect(post.hi).toBeCloseTo(Math.sqrt(0.975), 6)
  })
})

describe('sampleSizeProportion', () => {
  it('F-04: h = 0.10 at p = 0.5 needs 97', () => {
    expect(sampleSizeProportion(0.5, 0.1)).toBe(97)
  })

  it('p = 0.5 is the largest approximate sample', () => {
    expect(sampleSizeProportion(0.5, 0.1)).toBeGreaterThanOrEqual(sampleSizeProportion(0.3, 0.1))
  })
})

describe('attemptInflation', () => {
  it('F-05: 40 valid at 0.80 needs 50 attempts', () => {
    expect(attemptInflation(40, 0.8)).toBe(50)
  })

  it('F-16: 48 valid at 0.80 needs 60 attempts', () => {
    expect(attemptInflation(48, 0.8)).toBe(60)
  })

  it('rounds up fractional attempts', () => {
    expect(attemptInflation(41, 0.8)).toBe(52)
  })
})

describe('meanInterval', () => {
  it('uses the exact t quantile (df 3, t = 3.1824)', () => {
    const mi = meanInterval([1, 2, 3, 4])
    expect(mi.mean).toBe(2.5)
    expect(mi.n).toBe(4)
    expect(mi.sd).toBeCloseTo(1.29099, 4)
    expect(mi.lo).toBeCloseTo(0.44574, 4)
    expect(mi.hi).toBeCloseTo(4.55426, 4)
  })

  it('degenerates to the point at n = 1', () => {
    const mi = meanInterval([7])
    expect(mi.mean).toBe(7)
    expect(mi.lo).toBe(7)
    expect(mi.hi).toBe(7)
    expect(mi.sd).toBe(0)
  })

  it('returns NaN fields for an empty sample', () => {
    expect(meanInterval([]).mean).toBeNaN()
  })
})

describe('quantile', () => {
  it('interpolates linearly', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2)
  })

  it('handles the endpoints and unsorted input', () => {
    expect(quantile([3, 1, 2], 0)).toBe(1)
    expect(quantile([3, 1, 2], 1)).toBe(3)
    expect(quantile([], 0.5)).toBeNaN()
  })
})

