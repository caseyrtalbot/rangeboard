/**
 * Calibration from typed counts. A proportion field takes a beta
 * prior and a beta posterior; a time field takes a normal-gamma prior and a
 * normal-gamma posterior. Accepting a posterior writes one override through
 * `useOverrides.setOverride`, with the prior, the observation and the posterior
 * in the reason text, so the trial manifest records why the sourced value was
 * replaced. Pure except `acceptCalibration`, which reaches the overrides store.
 */

import type {
  BetaParams,
  CalibrationField,
  CalibrationRecord,
  NormalGammaParams,
  ProportionCalibrationRecord,
  ProportionObservation,
  SpecModel,
  Spread,
  TimeCalibrationRecord,
  TimeObservation,
} from '../model/types'
import { JEFFREYS_PRIOR } from '../model/types'
import { spreadFor } from './parameterBasis'
import { betaQuantile } from './stats'
import { useOverrides } from '../state/overrides'

/** The two families a field can calibrate under. */
export type CalibrationFamily = 'proportion' | 'time'

/** A two-sided interval on a value, with its coverage. */
export interface CredibleInterval {
  lo: number
  hi: number
  conf: number
}

/**
 * Family rule. The provenance row's unit decides when a row exists: 'fraction'
 * is a proportion, 's' is a time. A field with no row (a planning factor) falls
 * back to the spec key: 'pk' is a proportion and a key ending in a capital S
 * (engageTimeS, latencyS, trackInitS) is a time in seconds. Every other field
 * (a range, an angle, a count, a rate) has no calibration family.
 */
export function familyFor(model: SpecModel, field: string): CalibrationFamily | null {
  const unit = model.provenance?.find((r) => r.field === field)?.unit
  if (unit === 'fraction') return 'proportion'
  if (unit === 's') return 'time'
  if (unit !== undefined) return null
  if (field === 'pk') return 'proportion'
  return /[a-z]S$/.test(field) ? 'time' : null
}

// ---------- proportion ----------

/** Conjugate beta update: a + successes, b + failures. */
export function proportionPosterior(
  prior: BetaParams,
  observed: ProportionObservation,
): BetaParams {
  return { a: prior.a + observed.successes, b: prior.b + observed.trials - observed.successes }
}

/** Mean of Beta(a, b), the point value an accepted proportion writes. */
export function betaMean(p: BetaParams): number {
  return p.a / (p.a + p.b)
}

/** Equal-tailed credible interval of Beta(a, b). */
export function betaInterval(p: BetaParams, conf = 0.95): CredibleInterval {
  const tail = (1 - conf) / 2
  return { lo: betaQuantile(tail, p.a, p.b), hi: betaQuantile(1 - tail, p.a, p.b), conf }
}

/** A typed count is valid when trials is a positive integer and successes an integer within it. */
export function validProportion(observed: ProportionObservation): boolean {
  const { successes, trials } = observed
  return (
    Number.isInteger(trials) &&
    trials > 0 &&
    Number.isInteger(successes) &&
    successes >= 0 &&
    successes <= trials
  )
}

// ---------- time ----------

/** A sample reduced to its count, mean and unbiased variance; a summary passes through. */
export function timeSummary(observed: TimeObservation): {
  n: number
  meanS: number
  varianceS2: number
} {
  if (observed.form === 'summary')
    return { n: observed.n, meanS: observed.meanS, varianceS2: observed.varianceS2 }
  const n = observed.timesS.length
  if (n === 0) return { n: 0, meanS: NaN, varianceS2: NaN }
  const meanS = observed.timesS.reduce((s, v) => s + v, 0) / n
  const ss = observed.timesS.reduce((s, v) => s + (v - meanS) ** 2, 0)
  return { n, meanS, varianceS2: n > 1 ? ss / (n - 1) : 0 }
}

/** A time observation is valid with at least one finite time, or a positive count with a finite mean and variance. */
export function validTime(observed: TimeObservation): boolean {
  if (observed.form === 'sample')
    return observed.timesS.length > 0 && observed.timesS.every(Number.isFinite)
  const { n, meanS, varianceS2 } = observed
  return (
    Number.isInteger(n) &&
    n > 0 &&
    Number.isFinite(meanS) &&
    Number.isFinite(varianceS2) &&
    varianceS2 >= 0
  )
}

/**
 * Variance of one draw of the field under its spread, in the field's own
 * units, following the unit conventions in `uncertainty.ts`. Triangular: bounds
 * are fractions of the nominal with the mode at the nominal. Lognormal: sigmaDb
 * is a power ratio, ln sigma = sigmaDb ln(10) / 10. A beta spread is a
 * proportion's, never a time's, and returns null.
 */
export function spreadVariance(spread: Spread | null, nominal: number): number | null {
  if (!spread) return null
  if (spread.kind === 'triangular') {
    const a = nominal * (1 + spread.lo)
    const b = nominal * (1 + spread.hi)
    const c = nominal
    return (a * a + b * b + c * c - a * b - a * c - b * c) / 18
  }
  if (spread.kind === 'lognormal') {
    const s2 = ((spread.sigmaDb * Math.LN10) / 10) ** 2
    return nominal * nominal * (Math.exp(s2) - 1) * Math.exp(s2)
  }
  return null
}

/**
 * The weakly informative width when a time field has no spread: a coefficient
 * of variation of one half (a spread of half the value at one scale), or one
 * second at a zero value. Planning-factor grade; the observation dominates it
 * after a few times.
 */
export const WEAK_TIME_CV = 0.5

/**
 * Default normal-gamma prior on a time field: mu0 the current value, kappa0 = 1
 * (the prior is worth one observation of the mean), alpha0 = 1, and beta0 set
 * so that the prior predictive t scale squared, beta0 (kappa0 + 1) / (alpha0
 * kappa0), equals the variance of the field's spread. With alpha0 = 1 the
 * predictive t has two degrees of freedom and no finite variance, so its scale
 * is the quantity matched. Without a spread the width falls back to WEAK_TIME_CV.
 */
export function defaultTimePrior(
  model: SpecModel,
  field: string,
  nominal: number,
): NormalGammaParams {
  const kappa = 1
  const alpha = 1
  const fromSpread = spreadVariance(spreadFor(model, field), nominal)
  const variance = fromSpread ?? (nominal === 0 ? 1 : (WEAK_TIME_CV * nominal) ** 2)
  return { mu: nominal, kappa, alpha, beta: (alpha * kappa * variance) / (kappa + 1) }
}

/** Conjugate normal-gamma update in the standard (mu, kappa, alpha, beta) form. */
export function timePosterior(
  prior: NormalGammaParams,
  observed: TimeObservation,
): NormalGammaParams {
  const { n, meanS, varianceS2 } = timeSummary(observed)
  const kappa = prior.kappa + n
  const mu = (prior.kappa * prior.mu + n * meanS) / kappa
  const alpha = prior.alpha + n / 2
  const ss = (n - 1) * varianceS2
  const shift = (prior.kappa * n * (meanS - prior.mu) ** 2) / (2 * kappa)
  return { mu, kappa, alpha, beta: prior.beta + ss / 2 + shift }
}

/** Student t quantile from the incomplete beta, as `stats.ts` derives it for the mean interval. */
function tQuantile(p: number, df: number): number {
  if (p === 0.5) return 0
  const pp = p < 0.5 ? 1 - p : p
  const x = betaQuantile(2 * (1 - pp), df / 2, 0.5)
  const t = Math.sqrt((df * (1 - x)) / x)
  return p < 0.5 ? -t : t
}

/**
 * Equal-tailed interval on the mean under a normal-gamma: the marginal of the
 * mean is t with nu = 2 alpha, location mu and scale squared beta / (alpha kappa).
 */
export function meanCredibleInterval(p: NormalGammaParams, conf = 0.95): CredibleInterval {
  const scale = Math.sqrt(p.beta / (p.alpha * p.kappa))
  const t = tQuantile(1 - (1 - conf) / 2, 2 * p.alpha)
  return { lo: p.mu - t * scale, hi: p.mu + t * scale, conf }
}

// ---------- records ----------

/** An unaccepted proportion record from a prior (Jeffreys by default) and a count. */
export function calibrateProportion(
  field: CalibrationField,
  observed: ProportionObservation,
  prior: BetaParams = JEFFREYS_PRIOR,
): ProportionCalibrationRecord {
  return {
    kind: 'proportion',
    field,
    prior,
    observed,
    posterior: proportionPosterior(prior, observed),
    accepted: { accepted: false },
  }
}

/** An unaccepted time record from a prior and an observation. */
export function calibrateTime(
  field: CalibrationField,
  observed: TimeObservation,
  prior: NormalGammaParams,
): TimeCalibrationRecord {
  return {
    kind: 'time',
    field,
    prior,
    observed,
    posterior: timePosterior(prior, observed),
    accepted: { accepted: false },
  }
}

/** The point value an accepted record writes: the beta mean or the posterior mu. */
export function acceptedValue(record: CalibrationRecord): number {
  return record.kind === 'proportion' ? betaMean(record.posterior) : record.posterior.mu
}

/** The interval shown beside the point value. */
export function acceptedInterval(record: CalibrationRecord, conf = 0.95): CredibleInterval {
  return record.kind === 'proportion'
    ? betaInterval(record.posterior, conf)
    : meanCredibleInterval(record.posterior, conf)
}

const f = (v: number, digits = 4): string => Number(v.toPrecision(digits)).toString()

function betaText(p: BetaParams): string {
  return `Beta(${f(p.a)}, ${f(p.b)})`
}

function normalGammaText(p: NormalGammaParams): string {
  return `NG(mu ${f(p.mu)}, kappa ${f(p.kappa)}, alpha ${f(p.alpha)}, beta ${f(p.beta)})`
}

/** The observation as one clause of the reason text. */
export function observationText(record: CalibrationRecord): string {
  if (record.kind === 'proportion')
    return `${record.observed.successes} of ${record.observed.trials}`
  const { n, meanS, varianceS2 } = timeSummary(record.observed)
  const how = record.observed.form === 'sample' ? 'times' : 'summary'
  return `${how} n ${n}, mean ${f(meanS)} s, variance ${f(varianceS2)} s2`
}

/**
 * The override reason: prior, observation and posterior in one line, so the
 * manifest states why the sourced value was replaced and by what evidence.
 */
export function overrideReason(record: CalibrationRecord): string {
  const value = acceptedValue(record)
  const { lo, hi, conf } = acceptedInterval(record)
  const pct = Math.round(conf * 100)
  if (record.kind === 'proportion') {
    return (
      `Calibrated from counts: prior ${betaText(record.prior)}, observed ${observationText(record)}, ` +
      `posterior ${betaText(record.posterior)}, mean ${f(value)} [${f(lo)}, ${f(hi)}] ${pct} % credible`
    )
  }
  return (
    `Calibrated from times: prior ${normalGammaText(record.prior)}, observed ${observationText(record)}, ` +
    `posterior ${normalGammaText(record.posterior)}, mean ${f(value)} s [${f(lo)}, ${f(hi)}] ${pct} % credible`
  )
}

/**
 * Accept: write the posterior point value as an override with the reason
 * text, and return the record marked accepted. The record itself is not
 * stored anywhere; the override reason is its durable trace.
 */
export function acceptCalibration(record: CalibrationRecord): CalibrationRecord {
  const reason = overrideReason(record)
  useOverrides
    .getState()
    .setOverride(record.field.modelId, record.field.field, acceptedValue(record), reason)
  return { ...record, accepted: { accepted: true, at: new Date().toISOString(), reason } }
}
