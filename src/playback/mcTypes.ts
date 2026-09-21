/**
 * Result and progress types shared by the engine, the worker pool and the
 * stores. Every type here is JSON serialisable, with no functions and no Maps:
 * a value crosses a worker message and lands in an IndexedDB run record.
 */
import type { UncertainField } from '../analysis/parameterBasis'
import type { SensitivityResponse, StopRule } from './mcRun'

export type { McSettings, SamplingMode, SensitivityDepth } from '../model/types'

/**
 * Progress of a pooled replicate run. `done` and `perWorkerDone` count
 * replicates finished; `total` is the configured replicate count, or null
 * while a stop rule other than 'replicates' decides the end.
 */
export interface PoolProgress {
  /** Workers in the pool. */
  workers: number
  /** Replicates done across the pool. */
  done: number
  /** Configured replicate count; null when `stopRule` ends the run before it. */
  total: number | null
  /** The stop rule in force for this run. */
  stopRule: StopRule
  /** Wall time since the run started. */
  elapsedMs: number
  /** Replicates done per worker, indexed by worker slot. */
  perWorkerDone: number[]
}

/**
 * One field's Morris elementary effects. Each effect is the response change
 * over one step of the field on one trajectory; the denominator is the step
 * in the unit hypercube, so effects compare across fields.
 */
export interface MorrisFieldResult {
  field: UncertainField
  /** Mean elementary effect over the trajectories (mu). */
  mu: number
  /** Mean absolute elementary effect over the trajectories (mu star), the screening measure. */
  muStar: number
  /** Standard deviation of the elementary effects over the trajectories (sigma). */
  sigma: number
}

/**
 * Morris screening over every uncertain field. `evaluations` is trajectories
 * times (fields + 1) engine runs. `ranking` orders field indices into `fields`
 * by mu star, largest first. `kept` is the top eight of that ranking, which go
 * on to Sobol.
 */
export interface MorrisResult {
  method: 'morris'
  /** Trajectories run; 10 by default. */
  trajectories: number
  fields: MorrisFieldResult[]
  /** Indices into `fields`, by mu star descending. */
  ranking: number[]
  /** Indices into `fields` kept for Sobol. */
  kept: number[]
  /** The response the effects were computed on. */
  response: SensitivityResponse
  seed: number
  /** Engine runs used. */
  evaluations: number
}

/**
 * A bootstrap interval on one Sobol index: `value` from the full sample,
 * `lo` and `hi` the percentile bounds at `confidence` over `bootstrap`
 * resamples of the Saltelli matrices.
 */
export interface BootstrapInterval {
  value: number
  lo: number
  hi: number
  /** Bootstrap resamples behind `lo` and `hi`. */
  bootstrap: number
  /** Confidence level of `lo` and `hi`, in (0, 1). */
  confidence: number
}

/** One field's Sobol indices, both as a share of the response variance. */
export interface SobolFieldResult {
  field: UncertainField
  /** First-order index S_i: variance explained by the field alone. */
  firstOrder: BootstrapInterval
  /** Total index S_Ti: variance explained by the field and every interaction it joins. */
  total: BootstrapInterval
}

/**
 * Saltelli Sobol indices over the fields Morris kept. `evaluations` is
 * `base` times (fields + 2) engine runs. `ranking` orders field indices
 * into `fields` by the total index, largest first.
 */
export interface SobolResult {
  method: 'saltelli'
  /** Base sample size N; 256 by default. */
  base: number
  /** Engine runs used: N (k + 2). */
  evaluations: number
  fields: SobolFieldResult[]
  /** Indices into `fields`, by total index descending. */
  ranking: number[]
  /** The response the indices were computed on. */
  response: SensitivityResponse
  seed: number
}
