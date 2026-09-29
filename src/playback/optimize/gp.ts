/**
 * A Gaussian process surrogate for expected-improvement search, pure over
 * numbers. Inputs are points x in R^d (the movable positions, meters), the
 * outputs the objective means to minimize with their standard errors.
 *
 * Observations are standardized, z_i = (f_i - c) / s, with s falling back to 1
 * when it is 0 or not finite. The prior is zero-mean with the
 * squared-exponential kernel k(x, x') = exp(-|x - x'|^2 / (2 l^2)) at unit
 * signal variance; no hyperparameter is fitted. The length scale l is the
 * caller's, in meters. Each observation carries its own noise variance
 * r_i = (se_i / s)^2 + JITTER.
 *
 * Expected improvement over the best observed standardized mean, for a
 * minimized objective (Jones, Schonlau and Welch 1998), uses the standard
 * normal CDF by Abramowitz and Stegun 7.1.26 (absolute error under 1.5e-7);
 * sigma under SIGMA_FLOOR gives max(f_best - mu, 0).
 */

/** Added to every observation's noise variance, standardized units. */
export const JITTER = 1e-6

/** A predictive sigma under this is treated as exact for the EI. */
const SIGMA_FLOOR = 1e-9

/** One observation: the point, the objective mean and its standard error. */
export interface Observation {
  x: number[]
  f: number
  se: number
}

/** A fitted process: what a prediction needs, and the best observed standardized mean. */
export interface FittedGp {
  points: number[][]
  lengthScale: number
  /** The Cholesky factor of K, row-major lower triangle. */
  chol: number[][]
  /** K^-1 z. */
  alpha: number[]
  /** min z_i. */
  fBest: number
  /** The standardization the fit used, for reading a mean back in f units. */
  center: number
  scale: number
}

/** The squared-exponential kernel between two points. */
export function kernel(a: number[], b: number[], lengthScale: number): number {
  let d2 = 0
  for (let j = 0; j < a.length; j += 1) d2 += (a[j] - b[j]) * (a[j] - b[j])
  return Math.exp(-d2 / (2 * lengthScale * lengthScale))
}

/** Sample mean and sample standard deviation of `values` (sd 0 with one). */
function meanSd(values: number[]): { mean: number; sd: number } {
  const n = values.length
  const mean = values.reduce((s, v) => s + v, 0) / n
  if (n < 2) return { mean, sd: 0 }
  const ss = values.reduce((s, v) => s + (v - mean) * (v - mean), 0)
  return { mean, sd: Math.sqrt(ss / (n - 1)) }
}

/** The lower Cholesky factor of a symmetric positive-definite matrix; throws when it is not. */
export function cholesky(k: number[][]): number[][] {
  const n = k.length
  const l: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = k[i][j]
      for (let m = 0; m < j; m += 1) sum -= l[i][m] * l[j][m]
      if (i === j) {
        if (!(sum > 0)) throw new Error('Optimize surrogate is not positive definite')
        l[i][i] = Math.sqrt(sum)
      } else {
        l[i][j] = sum / l[j][j]
      }
    }
  }
  return l
}

/** Solve L w = b by forward substitution. */
function forward(l: number[][], b: number[]): number[] {
  const n = b.length
  const w = new Array<number>(n)
  for (let i = 0; i < n; i += 1) {
    let sum = b[i]
    for (let m = 0; m < i; m += 1) sum -= l[i][m] * w[m]
    w[i] = sum / l[i][i]
  }
  return w
}

/** Solve L^T v = w by back substitution. */
function backward(l: number[][], w: number[]): number[] {
  const n = w.length
  const v = new Array<number>(n)
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = w[i]
    for (let m = i + 1; m < n; m += 1) sum -= l[m][i] * v[m]
    v[i] = sum / l[i][i]
  }
  return v
}

/**
 * Fit the process to `observations` (finite `f` only; the caller filters)
 * at `lengthScale` meters. Throws with no observation.
 */
export function fitGp(observations: Observation[], lengthScale: number): FittedGp {
  const n = observations.length
  if (n === 0) throw new Error('Optimize surrogate needs at least one observation')
  const { mean: center, sd } = meanSd(observations.map((o) => o.f))
  const scale = sd > 0 && Number.isFinite(sd) ? sd : 1
  const points = observations.map((o) => o.x)
  const z = observations.map((o) => (o.f - center) / scale)
  const k: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      const v = kernel(points[i], points[j], lengthScale)
      k[i][j] = v
      k[j][i] = v
    }
    const se = Number.isFinite(observations[i].se) ? observations[i].se / scale : 0
    k[i][i] += se * se + JITTER
  }
  const chol = cholesky(k)
  const alpha = backward(chol, forward(chol, z))
  return { points, lengthScale, chol, alpha, fBest: Math.min(...z), center, scale }
}

/** The predictive mean and standard deviation at `x`, standardized units. */
export function predict(gp: FittedGp, x: number[]): { mu: number; sigma: number } {
  const kStar = gp.points.map((p) => kernel(p, x, gp.lengthScale))
  let mu = 0
  for (let i = 0; i < kStar.length; i += 1) mu += kStar[i] * gp.alpha[i]
  const w = forward(gp.chol, kStar)
  let explained = 0
  for (const v of w) explained += v * v
  return { mu, sigma: Math.sqrt(Math.max(1 - explained, 0)) }
}

/** erf by Abramowitz and Stegun 7.1.26. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return sign * (1 - poly * Math.exp(-ax * ax))
}

/** The standard normal CDF. */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

/** The standard normal density. */
function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/** Expected improvement below `fBest` of a prediction (mu, sigma), for minimization. */
export function expectedImprovement(mu: number, sigma: number, fBest: number): number {
  const gain = fBest - mu
  if (sigma < SIGMA_FLOOR) return Math.max(gain, 0)
  const u = gain / sigma
  return gain * normalCdf(u) + sigma * normalPdf(u)
}
