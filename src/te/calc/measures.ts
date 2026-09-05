/**
 * Per-measure computation over adjudicated runs.
 * Denominator discipline: MASTER-CALCULATIONS 1.0 pipeline
 * planned -> attempted -> eligible -> valid -> included; counts stay monotone.
 * Denominators derive from status; they are never hand-entered (3.8).
 */

import type {
  MeasureObservation,
  ResultLabel,
  TeCampaign,
  TeMeasure,
} from '../model/types'
import type { Interval } from './stats'
import { runIncludable } from '../validate'
import { betaPosterior, clopperPearson, meanInterval, wilson } from './stats'

export interface PerRunValue {
  runId: string
  status: string
  included: boolean
  success: boolean | null
  value: number | null
  note: string
}

export interface MeasureComputation {
  measureId: string
  name: string
  unit: string
  family: string
  nPlanned: number
  nAttempted: number
  nEligible: number
  nValid: number
  nIncluded: number
  successes: number | null
  values: number[]
  estimate: number | null
  interval: Interval | null
  label: ResultLabel
  thresholdShown: boolean
  perRun: PerRunValue[]
  notes: string[]
}

/** Only an observed outcome with its payload feeds the estimate. */
function feedsEstimate(measure: TeMeasure, obs: MeasureObservation): boolean {
  if (obs.status !== 'observed') return false
  if (measure.family === 'binomial') return obs.success !== null
  return obs.value !== null
}

export function computeMeasure(campaign: TeCampaign, measureId: string): MeasureComputation | null {
  const measure = campaign.measures.find((m) => m.id === measureId)
  if (!measure) return null
  return compute(campaign, measure)
}

export function computeAllMeasures(campaign: TeCampaign): MeasureComputation[] {
  return campaign.measures.map((measure) => compute(campaign, measure))
}

function compute(campaign: TeCampaign, measure: TeMeasure): MeasureComputation {
  const notes: string[] = []
  const nPlanned = campaign.matrix
    .filter((cell) => cell.measureIds.includes(measure.id))
    .reduce((sum, cell) => sum + cell.plannedReps, 0)

  const perRun: PerRunValue[] = []
  const values: number[] = []
  let nAttempted = 0
  let nEligible = 0
  let nValid = 0
  let nIncluded = 0
  let successCount = 0
  let censored = 0
  let unknown = 0

  for (const run of campaign.runs) {
    const obs = run.observations.find((o) => o.measureId === measure.id)
    if (!obs) continue
    const attempted = run.startAt !== null
    const eligible = attempted && obs.status !== 'no-test'
    const valid =
      eligible &&
      runIncludable(run, 'quantitative', measure.id) &&
      (obs.status === 'observed' || obs.status === 'censored' || obs.status === 'unknown-outcome')
    const included = valid && feedsEstimate(measure, obs)
    if (attempted) nAttempted++
    if (eligible) nEligible++
    if (valid) nValid++
    if (valid && obs.status === 'censored') censored++
    if (valid && obs.status === 'unknown-outcome') unknown++
    if (included) {
      nIncluded++
      if (measure.family === 'binomial') {
        if (obs.success === true) successCount++
      } else if (obs.value !== null) {
        values.push(obs.value)
      }
    }
    perRun.push({
      runId: run.id,
      status: obs.status,
      included,
      success: obs.success,
      value: obs.value,
      note: obs.note,
    })
  }

  if (censored > 0) {
    notes.push(`${censored} censored valid observation(s) held out of the estimate per the censoring rule`)
  }
  if (unknown > 0) {
    notes.push(`${unknown} unknown-outcome observation(s) held out of the estimate; sensitivity analysis required`)
  }

  let estimate: number | null = null
  let interval: Interval | null = null
  const successes = measure.family === 'binomial' ? successCount : null

  if (measure.family === 'binomial') {
    if (nIncluded > 0) {
      // Estimate stays the observed proportion x/n (2.1); the method selects the interval.
      estimate = successCount / nIncluded
      if (measure.intervalMethod === 'exact') {
        interval = clopperPearson(successCount, nIncluded)
      } else if (measure.intervalMethod === 'bayes') {
        const post = betaPosterior(measure.priorAlpha, measure.priorBeta, successCount, nIncluded)
        interval = post
        notes.push(`posterior Beta(${post.a}, ${post.b}), mean ${Math.round(post.mean * 1000) / 1000}`)
      } else {
        interval = wilson(successCount, nIncluded)
      }
    }
  } else if (
    measure.family === 'latency' ||
    measure.family === 'continuous' ||
    measure.family === 'margin'
  ) {
    if (values.length > 0) {
      const mi = meanInterval(values)
      estimate = mi.mean
      if (values.length >= 2) {
        // The Interval method enum has no t label; 'exact' carries the t interval.
        interval = { lo: mi.lo, hi: mi.hi, method: 'exact' }
        notes.push('interval is a t-based 95% confidence interval on the mean')
      }
    }
  } else if (measure.family === 'rate') {
    if (values.length > 0) {
      const mi = meanInterval(values)
      estimate = mi.mean
      if (values.length >= 2) {
        interval = { lo: mi.lo, hi: mi.hi, method: 'exact' }
        notes.push('rate is the mean of per-run totals; t-based 95% interval')
      }
    }
  } else if (measure.family === 'count') {
    if (values.length > 0) {
      estimate = values.reduce((sum, v) => sum + v, 0)
      notes.push('count is the total across included runs; no interval')
    }
  }

  // Pass/fail exists only for a customer-approved threshold (1.0, 3.13).
  const threshold = measure.thresholdApproved ? measure.threshold : null
  const thresholdShown = threshold !== null
  if (!measure.thresholdApproved && measure.threshold !== null) {
    notes.push('pass/fail suppressed: threshold recorded but not customer approved')
  }

  let label: ResultLabel
  if (estimate === null) {
    label = 'unavailable'
  } else if (threshold === null) {
    label = 'descriptive'
  } else if (interval !== null && interval.lo <= threshold && threshold <= interval.hi) {
    label = 'borderline'
  } else if (measure.higherIsBetter ? estimate >= threshold : estimate <= threshold) {
    label = 'pass'
  } else {
    label = 'miss'
  }

  return {
    measureId: measure.id,
    name: measure.name,
    unit: measure.unit,
    family: measure.family,
    nPlanned,
    nAttempted,
    nEligible,
    nValid,
    nIncluded,
    successes,
    values,
    estimate,
    interval,
    label,
    thresholdShown,
    perRun,
    notes,
  }
}
