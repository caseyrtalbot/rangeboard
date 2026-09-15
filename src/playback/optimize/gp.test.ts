import { describe, expect, it } from 'vitest'
import { cholesky, expectedImprovement, fitGp, JITTER, kernel, normalCdf, predict } from './gp'

describe('kernel and cholesky', () => {
  it('reads exp(-1/2) at one length scale and 1 at zero distance', () => {
    expect(kernel([0, 0], [0, 0], 3)).toBe(1)
    // |x - x'| = l: exp(-l^2 / (2 l^2)) = exp(-0.5).
    expect(kernel([0, 0], [3, 0], 3)).toBeCloseTo(Math.exp(-0.5), 12)
    expect(kernel([1, 1], [1 + 3, 1 + 4], 5)).toBeCloseTo(Math.exp(-0.5), 12)
  })

  it('factors [[4, 2], [2, 3]] as [[2, 0], [1, sqrt 2]] and rejects an indefinite matrix', () => {
    const l = cholesky([[4, 2], [2, 3]])
    expect(l[0][0]).toBe(2)
    expect(l[1][0]).toBe(1)
    expect(l[1][1]).toBeCloseTo(Math.SQRT2, 12)
    expect(l[0][1]).toBe(0)
    expect(() => cholesky([[1, 2], [2, 1]])).toThrow(/positive definite/)
  })
})

describe('fitGp and predict', () => {
  it('one observation: mean 0 at the point, sigma grows toward 1 away from it', () => {
    const gp = fitGp([{ x: [0, 0], f: 5, se: 0 }], 10)
    // One observation standardizes to z = 0 with the scale fallback 1.
    expect(gp.center).toBe(5)
    expect(gp.scale).toBe(1)
    expect(gp.fBest).toBe(0)
    const at = predict(gp, [0, 0])
    expect(at.mu).toBe(0)
    // K = 1 + JITTER: sigma^2 = 1 - 1 / (1 + JITTER) = JITTER / (1 + JITTER).
    expect(at.sigma).toBeCloseTo(Math.sqrt(JITTER / (1 + JITTER)), 9)
    const far = predict(gp, [100, 100])
    expect(far.sigma).toBeCloseTo(1, 6)
    expect(far.mu).toBeCloseTo(0, 6)
  })

  it('two noise-free observations: the fit passes through the standardized values', () => {
    // f = 2 and 6: mean 4, sample sd 2 sqrt 2, z = -1 / sqrt 2 and +1 / sqrt 2.
    const gp = fitGp([{ x: [0], f: 2, se: 0 }, { x: [10], f: 6, se: 0 }], 2)
    expect(gp.scale).toBeCloseTo(2 * Math.SQRT2, 12)
    expect(gp.fBest).toBeCloseTo(-1 / Math.SQRT2, 12)
    expect(predict(gp, [0]).mu).toBeCloseTo(-1 / Math.SQRT2, 4)
    expect(predict(gp, [10]).mu).toBeCloseTo(1 / Math.SQRT2, 4)
    // Midway the points are 2.5 length scales off: the mean pulls to the prior 0.
    expect(Math.abs(predict(gp, [5]).mu)).toBeLessThan(0.05)
  })

  it('a standard error widens the posterior at the observed point', () => {
    const exact = fitGp([{ x: [0], f: 1, se: 0 }, { x: [10], f: 3, se: 0 }], 2)
    const noisy = fitGp([{ x: [0], f: 1, se: 1 }, { x: [10], f: 3, se: 1 }], 2)
    expect(predict(noisy, [0]).sigma).toBeGreaterThan(predict(exact, [0]).sigma)
    // se 1 over scale sqrt 2: r = 0.5 + JITTER, sigma^2 = 1 - 1 / (1.5 + JITTER) = 1 / 3.
    expect(predict(noisy, [0]).sigma).toBeCloseTo(Math.sqrt(1 / 3), 5)
  })
})

describe('normalCdf and expectedImprovement', () => {
  it('reads the normal CDF at 0 and 1.96 within the A and S error', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4)
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 4)
  })

  it('EI at mu = fBest, sigma 1 is phi(0); an exact prediction reads the clamped gain', () => {
    // (0) Phi(0) + 1 phi(0) = 1 / sqrt(2 pi) = 0.39894.
    expect(expectedImprovement(0, 1, 0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 7)
    expect(expectedImprovement(2, 0, 1)).toBe(0)
    expect(expectedImprovement(-1, 0, 1)).toBe(2)
    // A larger sigma never lowers EI at fixed mu.
    expect(expectedImprovement(1, 2, 0)).toBeGreaterThan(expectedImprovement(1, 1, 0))
  })
})
