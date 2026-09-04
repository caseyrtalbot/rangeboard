/**
 * Statistics engine for T&E measure computation.
 * Source of truth: docs/te-compilation/MASTER-CALCULATIONS.md section 2.
 * Pure functions only; no DOM, no React, no external libraries.
 */

import { mulberry32 } from '../../geometry/prng'

export interface Interval {
  lo: number
  hi: number
  method: 'wilson' | 'exact' | 'bayes'
}

/** Guard against float noise pushing an exact integer over the next ceil step. */
const CEIL_EPS = 1e-9

// ---------------------------------------------------------------------------
// Special functions: log-gamma, regularized incomplete beta, beta quantile
// ---------------------------------------------------------------------------

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  const zz = z - 1
  let x = 0.99999999999980993
  for (let i = 0; i < LANCZOS.length; i++) x += LANCZOS[i] / (zz + i + 1)
  const t = zz + LANCZOS.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x)
}

/** Continued fraction for the incomplete beta (modified Lentz's method). */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const tiny = 1e-30
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < tiny) d = tiny
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 3e-14) break
  }
  return h
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const logFront =
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  const front = Math.exp(logFront)
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(x, a, b)) / a
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b
}

/** Beta distribution quantile by bisection on the regularized incomplete beta. */
function betaQuantile(p: number, a: number, b: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (regularizedIncompleteBeta(mid, a, b) < p) lo = mid
    else hi = mid
    if (hi - lo < 1e-15) break
  }
  return (lo + hi) / 2
}

/** Student t quantile from the incomplete beta relation; exact for every df. */
function tQuantile(p: number, df: number): number {
  if (p === 0.5) return 0
  const pp = p < 0.5 ? 1 - p : p
  const x = betaQuantile(2 * (1 - pp), df / 2, 0.5)
  const t = Math.sqrt((df * (1 - x)) / x)
  return p < 0.5 ? -t : t
}

// ---------------------------------------------------------------------------
// Binomial intervals (MASTER-CALCULATIONS 2.1 to 2.4)
// ---------------------------------------------------------------------------

/** Wilson interval, the default binomial interval (2.2). n must be positive. */
export function wilson(x: number, n: number, z = 1.96): Interval & { p: number } {
  const p = x / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return { p, lo: Math.max(0, center - half), hi: Math.min(1, center + half), method: 'wilson' }
}

/** Exact Clopper-Pearson interval via the beta quantile (2.3). */
export function clopperPearson(x: number, n: number, conf = 0.95): Interval & { p: number } {
  const alpha = 1 - conf
  const lo = x <= 0 ? 0 : betaQuantile(alpha / 2, x, n - x + 1)
  const hi = x >= n ? 1 : betaQuantile(1 - alpha / 2, x + 1, n - x)
  return { p: x / n, lo, hi, method: 'exact' }
}

/** Beta-binomial posterior with an equal-tailed credible interval (2.4). */
export function betaPosterior(
  priorA: number,
  priorB: number,
  x: number,
  n: number,
  conf = 0.95,
): Interval & { mean: number; a: number; b: number } {
  const a = priorA + x
  const b = priorB + n - x
  const alpha = 1 - conf
  return {
    a,
    b,
    mean: a / (a + b),
    lo: betaQuantile(alpha / 2, a, b),
    hi: betaQuantile(1 - alpha / 2, a, b),
    method: 'bayes',
  }
}

// ---------------------------------------------------------------------------
// Sample-size planners (2.5, 2.6, 2.8)
// ---------------------------------------------------------------------------

/** Precision-driven sample size for one proportion, rounded up (2.5). */
export function sampleSizeProportion(p: number, halfWidth: number, z = 1.96): number {
  return Math.ceil((z * z * p * (1 - p)) / (halfWidth * halfWidth) - CEIL_EPS)
}

/** Required attempts to yield the needed valid opportunities, rounded up (2.6). */
export function attemptInflation(validNeeded: number, validFraction: number): number {
  return Math.ceil(validNeeded / validFraction - CEIL_EPS)
}

/** Approximate paired sample size, rounded up (2.8). Defaults: 95% two-sided, 80% power. */
export function pairedSampleSize(
  sdOfDiff: number,
  meaningfulDiff: number,
  zAlpha = 1.96,
  zPower = 0.84,
): number {
  const root = ((zAlpha + zPower) * sdOfDiff) / meaningfulDiff
  return Math.ceil(root * root - CEIL_EPS)
}

// ---------------------------------------------------------------------------
// Continuous outcomes (2.9)
// ---------------------------------------------------------------------------

/**
 * Mean with a t-based confidence interval (2.9).
 * The t quantile is computed exactly from the regularized incomplete beta for
 * every sample size; no table lookup and no normal approximation is used.
 * n = 0 returns NaN fields; n = 1 returns a degenerate interval at the mean.
 */
export function meanInterval(
  values: number[],
  conf = 0.95,
): { mean: number; lo: number; hi: number; sd: number; n: number } {
  const n = values.length
  if (n === 0) return { mean: NaN, lo: NaN, hi: NaN, sd: NaN, n: 0 }
  const mean = values.reduce((s, v) => s + v, 0) / n
  if (n === 1) return { mean, lo: mean, hi: mean, sd: 0, n }
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1))
  const t = tQuantile(1 - (1 - conf) / 2, n - 1)
  const half = (t * sd) / Math.sqrt(n)
  return { mean, lo: mean - half, hi: mean + half, sd, n }
}

/** Quantile with linear interpolation between order statistics (type 7). */
export function quantile(values: number[], q: number): number {
  const n = values.length
  if (n === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const pos = Math.min(Math.max(q, 0), 1) * (n - 1)
  const base = Math.floor(pos)
  const frac = pos - base
  if (base + 1 >= n) return sorted[n - 1]
  return sorted[base] + frac * (sorted[base + 1] - sorted[base])
}

/** Seeded percentile bootstrap interval on the mean (2.9). */
export function bootstrapMeanInterval(
  values: number[],
  iterations: number,
  conf: number,
  seed: number,
): { lo: number; hi: number } {
  const n = values.length
  if (n === 0) return { lo: NaN, hi: NaN }
  const rand = mulberry32(seed)
  const means: number[] = []
  for (let i = 0; i < iterations; i++) {
    let sum = 0
    for (let j = 0; j < n; j++) sum += values[Math.floor(rand() * n)]
    means.push(sum / n)
  }
  const alpha = 1 - conf
  return { lo: quantile(means, alpha / 2), hi: quantile(means, 1 - alpha / 2) }
}

// ---------------------------------------------------------------------------
// Uncertainty and reliability (2.11, 2.12)
// ---------------------------------------------------------------------------

/** Root-sum-square of independent uncertainty components (2.12). */
export function rss(components: number[]): number {
  return Math.sqrt(components.reduce((s, u) => s + u * u, 0))
}

/**
 * One-sided upper bound on a constant failure rate after zero failures (2.11).
 * -ln(1 - conf) / n; at 95% this is the spec's "about 3 / total time at risk".
 * Model-dependent; it never proves zero risk.
 */
export function zeroFailureBound(n: number, conf = 0.95): number {
  return -Math.log(1 - conf) / n
}
