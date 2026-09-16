import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyScenario } from '../model/seed'
import type { SpecModel } from '../model/types'
import { JEFFREYS_PRIOR } from '../model/types'
import { createTrialManifest } from '../playback/trialTypes'
import { activeOverrides, useOverrides } from '../state/overrides'
import {
  acceptCalibration,
  acceptedValue,
  betaInterval,
  betaMean,
  calibrateProportion,
  calibrateTime,
  defaultTimePrior,
  familyFor,
  meanCredibleInterval,
  overrideReason,
  spreadVariance,
  timePosterior,
  timeSummary,
} from './calibrate'

const scenario = emptyScenario()
const modelOf = (id: string): SpecModel => scenario.library.find((m) => m.id === id)!
const COYOTE = 'lib-coyote'

describe('familyFor', () => {
  it('reads the unit of a provenance row, then the spec key of a planning factor', () => {
    // Leonidas pk carries a row with unit 'fraction'; Iris updateRateS a row with unit 's'.
    expect(familyFor(modelOf('lib-leonidas'), 'pk')).toBe('proportion')
    expect(familyFor(modelOf('lib-iris'), 'updateRateS')).toBe('time')
    // Coyote pk and engageTimeS have no row: the key decides.
    expect(familyFor(modelOf(COYOTE), 'pk')).toBe('proportion')
    expect(familyFor(modelOf(COYOTE), 'engageTimeS')).toBe('time')
    // A range with a row in metres, and a count with no row, have no family.
    expect(familyFor(modelOf(COYOTE), 'maxRangeM')).toBeNull()
    expect(familyFor(modelOf(COYOTE), 'magazineSize')).toBeNull()
  })
})

describe('proportion', () => {
  it('updates the Jeffreys prior with a typed count', () => {
    const record = calibrateProportion(
      { modelId: COYOTE, field: 'pk' },
      { successes: 17, trials: 20 },
    )
    // Jeffreys (0.5, 0.5) + 17 successes, 3 failures = Beta(17.5, 3.5).
    expect(record.posterior).toEqual({ a: 17.5, b: 3.5 })
    // Mean 17.5 / 21 = 0.83333...
    expect(betaMean(record.posterior)).toBeCloseTo(0.833333, 6)
    // Beta(17.5, 3.5) 2.5 % and 97.5 % quantiles by numerical integration of the
    // density (trapezoid, 200 000 steps, bisection): 0.65142 and 0.95587.
    const { lo, hi } = betaInterval(record.posterior)
    expect(lo).toBeCloseTo(0.65142, 4)
    expect(hi).toBeCloseTo(0.95587, 4)
    expect(record.prior).toBe(JEFFREYS_PRIOR)
    expect(record.accepted).toEqual({ accepted: false })
  })
})

describe('time', () => {
  const coyote = modelOf(COYOTE)

  it('reduces a sample to its count, mean and unbiased variance', () => {
    // Mean 260 / 5 = 52; deviations -2, 2, 0, -4, 4; sum of squares 40; 40 / 4 = 10.
    expect(timeSummary({ form: 'sample', timesS: [50, 54, 52, 48, 56] })).toEqual({
      n: 5,
      meanS: 52,
      varianceS2: 10,
    })
    expect(timeSummary({ form: 'sample', timesS: [7] })).toEqual({ n: 1, meanS: 7, varianceS2: 0 })
  })

  it('sets beta0 from the PF triangular spread of the field', () => {
    // engageTimeS has no row, so spreadFor answers the PF triangular -0.2..0.3 on the
    // nominal 60 s: a = 48, b = 78, mode c = 60. Triangular variance
    // (a2 + b2 + c2 - ab - ac - bc) / 18 = (2304 + 6084 + 3600 - 3744 - 2880 - 4680) / 18
    // = 684 / 18 = 38 s2.
    expect(spreadVariance({ kind: 'triangular', lo: -0.2, hi: 0.3 }, 60)).toBeCloseTo(38, 9)
    // beta0 = alpha0 kappa0 var / (kappa0 + 1) = 1 * 1 * 38 / 2 = 19.
    expect(defaultTimePrior(coyote, 'engageTimeS', 60)).toEqual({
      mu: 60,
      kappa: 1,
      alpha: 1,
      beta: 19,
    })
    // Lognormal 3 dB on 100: ln sigma = 0.3 ln 10 = 0.69078, s2 = 0.47717,
    // var = 100^2 (e^s2 - 1) e^s2 = 10000 * 0.61150 * 1.61150 = 9854.4.
    expect(spreadVariance({ kind: 'lognormal', sigmaDb: 3 }, 100)).toBeCloseTo(9854.4, 0)
    // No spread: CV one half, var = (0.5 * 10)^2 = 25, beta0 = 12.5.
    expect(
      defaultTimePrior(
        { ...coyote, id: 'x', effector: { ...coyote.effector!, engageTimeS: 10 } },
        'noSuchTimeS',
        10,
      ).beta,
    ).toBe(12.5)
    // A beta spread is not a time spread.
    expect(spreadVariance({ kind: 'beta', successes: 17, trials: 20, pseudo: true }, 60)).toBeNull()
  })

  it('applies the conjugate normal-gamma update and the t interval on the mean', () => {
    const prior = { mu: 60, kappa: 1, alpha: 1, beta: 19 }
    const posterior = timePosterior(prior, { form: 'summary', n: 5, meanS: 52, varianceS2: 16 })
    // kappa_n = 1 + 5 = 6; mu_n = (1 * 60 + 5 * 52) / 6 = 320 / 6 = 53.333...;
    // alpha_n = 1 + 5 / 2 = 3.5; SS = (n - 1) s2 = 64;
    // beta_n = 19 + 64 / 2 + 1 * 5 * (52 - 60)^2 / (2 * 6) = 19 + 32 + 320 / 12 = 77.666...
    expect(posterior.kappa).toBe(6)
    expect(posterior.mu).toBeCloseTo(53.333333, 6)
    expect(posterior.alpha).toBe(3.5)
    expect(posterior.beta).toBeCloseTo(77.666667, 6)
    // Mean ~ t with nu = 7, scale^2 = 77.6667 / (3.5 * 6) = 3.69841, scale = 1.92313;
    // t(0.975, 7) = 2.36462; half-width 4.5475; 53.3333 -/+ 4.5475 = 48.786, 57.881.
    const { lo, hi } = meanCredibleInterval(posterior)
    expect(lo).toBeCloseTo(48.786, 2)
    expect(hi).toBeCloseTo(57.881, 2)
    // The sample form with the same summary gives the same posterior.
    const fromSample = timePosterior(prior, { form: 'sample', timesS: [48, 50, 52, 54, 56] })
    expect(fromSample.mu).toBeCloseTo(posterior.mu, 12)
    expect(fromSample.alpha).toBe(3.5)
  })
})

describe('acceptCalibration', () => {
  beforeEach(() => useOverrides.getState().resetAll())
  afterEach(() => useOverrides.getState().resetAll())

  it('writes the posterior as an override whose reason names prior, observation and posterior', () => {
    const record = calibrateProportion(
      { modelId: COYOTE, field: 'pk' },
      { successes: 17, trials: 20 },
    )
    const reason = overrideReason(record)
    expect(reason).toBe(
      'Calibrated from counts: prior Beta(0.5, 0.5), observed 17 of 20, posterior Beta(17.5, 3.5), ' +
        'mean 0.8333 [0.6514, 0.9559] 95 % credible',
    )
    const accepted = acceptCalibration(record)
    expect(accepted.accepted).toMatchObject({ accepted: true, reason })
    const [override] = useOverrides.getState().overrides
    expect(override).toMatchObject({
      modelId: COYOTE,
      field: 'pk',
      value: acceptedValue(record),
      reason,
    })
    // The override reaches a run through the trial manifest, in the style of
    // trialManifestOverrides.test.ts; the scenario library keeps its 0.85.
    const manifest = createTrialManifest(scenario, 'trial', 'basis', {
      overrides: activeOverrides(useOverrides.getState().overrides, scenario),
    })
    expect(manifest.overrides).toMatchObject([
      { modelId: COYOTE, field: 'pk', value: 17.5 / 21, reason },
    ])
    expect(modelOf(COYOTE).effector?.pk).toBe(0.85)
  })

  it('writes a time posterior with the mean in seconds and the summary in the reason', () => {
    const coyote = modelOf(COYOTE)
    const record = calibrateTime(
      { modelId: COYOTE, field: 'engageTimeS' },
      { form: 'summary', n: 5, meanS: 52, varianceS2: 16 },
      defaultTimePrior(coyote, 'engageTimeS', 60),
    )
    acceptCalibration(record)
    const [override] = useOverrides.getState().overrides
    expect(override.value).toBeCloseTo(53.333333, 6)
    expect(override.reason).toBe(
      'Calibrated from times: prior NG(mu 60, kappa 1, alpha 1, beta 19), observed summary n 5, mean 52 s, variance 16 s2, ' +
        'posterior NG(mu 53.33, kappa 6, alpha 3.5, beta 77.67), mean 53.33 s [48.79, 57.88] 95 % credible',
    )
  })
})
