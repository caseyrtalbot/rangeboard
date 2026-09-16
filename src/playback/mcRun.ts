/**
 * Monte Carlo replicate loop. Replicate i runs the sweep and the attrition
 * with `monteCarloPolicy(seed, i, thresholds)` and records the per-step
 * counts the live panels read from the deterministic ledger. The summary
 * holds per-step bands and per-replicate scalars, never a replicate ledger.
 * Under `uncertainty: 'total'` each replicate first samples every uncertain
 * field through the policy's `param` draw; under `aleatory` the nominal
 * scenario runs. No store import at the value level; never reads
 * `engagementPicture`. The grid is the projection grid (`analysis/projection.ts`):
 * `sampleCount(scenario)` steps at DT, index k is t = k * DT; the chart series
 * builders sample the same grid.
 */
import { heldTracksOnGrid, residualOnGrid, sampleCount } from '../analysis/projection'
import { buildLiveTimeline, liveKpisAt } from '../analysis/liveStats'
import { sampleScenario, uncertainFields } from '../analysis/uncertainty'
import type { UncertainField } from '../analysis/parameterBasis'
import type { MorrisResult, SobolResult } from './mcTypes'
import { loopEnd, paramDraws } from './sampling'
import type { Scenario } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, entityActive, runSettings } from '../model/types'
import type { SweepFactor } from './sweepFactors'
import { applySweepValue, SWEEP_VALUES_MAX, SWEEP_VALUES_MIN } from './sweepFactors'
import { meanInterval, quantile, wilson } from '../analysis/stats'
import { resolveEngagements } from './attrition'
import type { DrawPolicy } from './policy'
import { monteCarloPolicy } from './policy'
import { assessAllThreats } from './sim'
import { DT } from './clock'

/**
 * Summary statistics over the finite samples of one quantity. Every numeric
 * field is NaN when n is 0; `n`, `total` and `defined` always read.
 */
export interface Stat {
  mean: number
  sd: number
  /** Standard error of the mean, sd / sqrt(n); 0 with one sample. */
  se: number
  /**
   * Interval on the mean at conf, by `interval`. A time keeps the t-interval
   * (meanInterval from src/analysis/stats.ts). A count clamps it to the
   * count's support. A 0/1 count (support {0, 1}) takes the Wilson interval.
   * A count with a finite support maximum that samples all zero reports the
   * rule-of-three upper bound 3 max / n (no independence between ships), and
   * all at max the mirror max - 3 max / n; both are bounds, not a CI.
   */
  lo: number
  hi: number
  conf: number
  interval: IntervalMethod
  /** Replicate quantiles; NaN under BAND80_MIN_N samples (p10, p90) or BAND95_MIN_N (p025, p975). */
  p10: number
  p90: number
  p025: number
  p975: number
  /** Finite samples, and replicates run. */
  n: number
  total: number
  /** The defined fraction n / total with its Wilson interval (wilson from stats.ts). */
  defined: { p: number; lo: number; hi: number }
}

/** How a Stat's `lo` and `hi` were built; 'none' with no finite sample. */
export type IntervalMethod = 't' | 'wilson' | 'rule-of-three' | 'none'

/** Confidence level of every Stat interval and band interval. */
export const STAT_CONF = 0.95

/**
 * Minimum samples before a replicate quantile is reported: below
 * these, the type-7 quantile interpolates toward one extreme sample.
 */
export const BAND80_MIN_N = 10
export const BAND95_MIN_N = 40

/** What a Stat measures: a count with its support maximum, or a time. */
export type StatKind = { kind: 'time' } | { kind: 'count'; max: number }
const TIME: StatKind = { kind: 'time' }
const count = (max: number): StatKind => ({ kind: 'count', max })

/**
 * The sequential loop checks the half-width rule at `stopFloor` (runSettings)
 * and every STOP_EVERY replicates after it; a pool checks whenever it merges.
 */
const STOP_EVERY = 10

/**
 * Why a loop ended: every replicate (or field) ran, the half-width rule held,
 * the execution budget was reached, or the driver was asked to cancel.
 */
export type StopRule = 'replicates' | 'halfWidth' | 'budget' | 'cancelled'

/**
 * Execution budget of one run. `retainedNumbers` bounds the sample rows kept
 * for the bands: one number per replicate per grid step per series, five raid
 * series plus one residual series per track. A Chromium worker on a 16 GB Mac
 * took the whole page down at 384 million retained numbers; the budget is one
 * quarter of that. `timeMs` is a wall-clock stop for a run nobody cancels
 * (about 100 ms per replicate on the largest fixture). A stop by either rule
 * keeps the replicates done and reports `stopped.rule` 'budget'.
 */
export interface ExecutionBudget {
  retainedNumbers: number
  timeMs: number
}

/** The budget the worker applies; the sync entry points apply none unless given one. */
export const DEFAULT_BUDGET: ExecutionBudget = { retainedNumbers: 96_000_000, timeMs: 600_000 }

/**
 * What a loop reports after each unit of work; the driver answers with a
 * StopRule to end the loop there, or nothing to go on. `retained` counts the
 * numbers kept for the bands so far (0 for a sensitivity run, which keeps sums).
 */
export interface Checkpoint {
  done: number
  total: number
  retained: number
}

/** A loop that yields a Checkpoint per unit of work and returns its summary. */
export type Loop<T> = Generator<Checkpoint, T, StopRule | undefined>

/** Per DT step from t = 0 to scenarioDurationS inclusive (projection.ts sampleCount). */
export interface BandSeries {
  mean: number[]
  /** The Stat interval on the mean at STAT_CONF, per step (a count Stat). */
  lo: number[]
  hi: number[]
  /** Replicate quantiles per step; NaN under BAND80_MIN_N or BAND95_MIN_N replicates. */
  p10: number[]
  p90: number[]
  p025: number[]
  p975: number[]
}

/** Per-threat replicate summary. */
interface McThreatSummary {
  /** ThreatAttrition.expectedKills, an integer per replicate. */
  killed: Stat
  /** Ships that arrived undefeated; 0 in a replicate without arrival. */
  leaked: Stat
  /** ThreatAssessment.firstDetectS; null replicates excluded. */
  firstDetectS: Stat
  /** Geometry, identical in every replicate. */
  arrivalS: number | null
  shipCount: number
  /** Ships alive at each step, the threatSeries 'residual' rule. */
  residual: BandSeries
}

/** Per-effector replicate summary. */
interface McEffectorSummary {
  /** shotsFired + deSalvos + jamSalvos. */
  salvos: Stat
  /** Sum of killDelta over the effector's events. */
  kills: Stat
}

/** The replicate run result the store keeps and the panels read. */
export interface McSummary {
  seed: number
  replicates: number
  durationS: number
  /** Cumulative counts at each step, as liveKpisAt reads them. */
  kills: BandSeries
  leakers: BandSeries
  detected: BandSeries
  /** Held-track count at each step: `heldTracksOnGrid`, the rule the `tracksHeld` chart series shares. */
  tracked: BandSeries
  engaged: BandSeries
  /** Earliest first detection over the tracks, per replicate: the first single-scan hit. */
  firstDetectS: Stat
  /**
   * Earliest stable track file over the tracks, per replicate: the first
   * fire-control-quality hold of the initiation time (ThreatAssessment.stableTrackAtS).
   */
  firmTrackS: Stat
  /** Shortest warning (arrival minus first detection) over the tracks, per replicate. */
  minWarningS: Stat
  /**
   * Operator decisions the C2 queue took, per replicate
   * (`AttritionTotals.operatorDecisions`). Absent on a summary written before
   * the stamp existed.
   */
  operatorDecisions?: Stat
  /**
   * Of those, the decisions the floor at 0 caught, per replicate: the stamp
   * the Run progress line reads. Absent on a summary written before the stamp
   * existed.
   */
  operatorFlooredDecisions?: Stat
  perThreat: Record<string, McThreatSummary>
  perEffector: Record<string, McEffectorSummary>
  /** Wall time in the worker, ms; 0 when run outside the worker. */
  elapsedMs: number
  /** Why the loop ended, and the replicate count it ended at. */
  stopped: { rule: StopRule; at: number }
}

/** One run request to the worker: plain JSON, never a store reference. */
interface McRunRequest {
  type: 'run'
  runId: string
  scenario: Scenario
}

/** One sensitivity request to the worker, same shape, on its own worker instance. */
export interface McSensitivityRequest {
  type: 'sensitivity'
  runId: string
  scenario: Scenario
}

/** Ends the run at its next checkpoint; the run then posts its summary with `stopped.rule` 'cancelled'. */
interface McCancelRequest {
  type: 'cancel'
  runId: string
}

/**
 * One factor sweep request, on the sensitivity slot: one ensemble of
 * `replicatesPerCell` replicates per grid cell over one or two factors.
 * `responses` names the headline responses the reader maps; every cell
 * records all five regardless.
 */
export interface McSweepRequest {
  type: 'sweep'
  runId: string
  scenario: Scenario
  factors: [SweepFactor] | [SweepFactor, SweepFactor]
  replicatesPerCell: number
  responses: SensitivityResponse[]
}

/** One Morris screening request: every uncertain field of the scenario. */
export interface McMorrisRequest {
  type: 'morris'
  runId: string
  scenario: Scenario
  /** The response the effects read; 'leakers' when absent. */
  response?: SensitivityResponse
}

/** One Sobol request over the fields Morris kept. */
export interface McSobolRequest {
  type: 'sobol'
  runId: string
  scenario: Scenario
  kept: UncertainField[]
  /** The response the indices read; 'leakers' when absent. */
  response?: SensitivityResponse
}

/** Every request the worker accepts; it dispatches on `type`. */
export type McRequest =
  | McRunRequest
  | McSensitivityRequest
  | McSweepRequest
  | McMorrisRequest
  | McSobolRequest
  | McCancelRequest

/** Messages the worker posts back, tagged by the run they belong to. */
export type McWorkerMessage =
  | { type: 'progress'; runId: string; done: number; total: number }
  | { type: 'done'; runId: string; summary: McSummary }
  | { type: 'error'; runId: string; message: string }

/** Messages of a sensitivity run; `done` and `total` count uncertain fields. */
export type McSensitivityMessage =
  | { type: 'sens-progress'; runId: string; done: number; total: number }
  | { type: 'sens-done'; runId: string; summary: SensitivitySummary }
  | { type: 'sens-error'; runId: string; message: string }

/** Messages of a sweep run; `done` and `total` count grid cells. */
export type McSweepMessage =
  | { type: 'sweep-progress'; runId: string; done: number; total: number }
  | { type: 'sweep-done'; runId: string; summary: SweepSummary }
  | { type: 'sweep-error'; runId: string; message: string }

/** Messages of a Morris run; `done` and `total` count engine evaluations (rows). */
export type McMorrisMessage =
  | { type: 'morris-progress'; runId: string; done: number; total: number }
  | { type: 'morris-done'; runId: string; result: MorrisResult }
  | { type: 'morris-error'; runId: string; message: string }

/** Messages of a Sobol run; `done` and `total` count engine evaluations (rows). */
export type McSobolMessage =
  | { type: 'sobol-progress'; runId: string; done: number; total: number }
  | { type: 'sobol-done'; runId: string; result: SobolResult }
  | { type: 'sobol-error'; runId: string; message: string }

/**
 * The end-of-run responses a sensitivity row records per replicate: leaker
 * ships, expected kills, the raid's first detect and minimum warning times
 * (NaN in a replicate with no detect or no warning) and the salvos fired
 * over every effector.
 */
export type SensitivityResponse = 'leakers' | 'kills' | 'firstDetectS' | 'minWarningS' | 'salvos'

/** The five responses, in the order the row records them. */
export const SENSITIVITY_RESPONSES: readonly SensitivityResponse[] = [
  'leakers',
  'kills',
  'firstDetectS',
  'minWarningS',
  'salvos',
]

/** One response of one row: its mean at the field's p10 and p90, the paired swing and se. */
export interface SensitivityResponseStat {
  /** Mean over the finite replicates with the field at its p10 sample; NaN with none. */
  lo: number
  /** The same with the field at its p90 sample. */
  hi: number
  /** |hi - lo|. */
  swing: number
  /**
   * Paired standard error of the swing over the replicates finite on both
   * sides: their sd of (hi minus lo) over sqrt(count); 0 with one, NaN with none.
   */
  se: number
  /** The defined fraction of each side (a time's definedness; always n of n for a count). */
  defined: { lo: Stat['defined']; hi: Stat['defined'] }
}

/** One tornado row: the headline statistic with one field at its p10 and at its p90. */
interface SensitivityRow {
  /** A library model id, a connection id, or 'doctrine' (uncertainFields). */
  modelId: string
  field: string
  /** The model name (a connection reads its label, doctrine reads 'Doctrine'), for the panel. */
  label: string
  /** End-of-run leaker mean with the field at its p10 sample, every other field nominal. */
  low: number
  /** The same with the field at its p90 sample. */
  high: number
  /** |high - low|; rows sort by it, largest first. Alias of `responses.leakers.swing`. */
  swing: number
  /**
   * Paired standard error of the swing: the sample sd of the per-replicate
   * difference (high minus low) over sqrt(replicates); 0 with one replicate.
   * Alias of `responses.leakers.se`.
   */
  se: number
  /**
   * Every response at the same two field runs. The loop always records it;
   * optional only so hand-built rows in the store and widget tests still
   * type until the UI moves to it.
   */
  responses?: Record<SensitivityResponse, SensitivityResponseStat>
}

/** The sensitivity run result: one row per uncertain field, paired by common random numbers. */
export interface SensitivitySummary {
  stat: 'leakers'
  rows: SensitivityRow[]
  /** End-of-run leaker mean with every field nominal, at the same seed and replicates. */
  nominal: number
  replicates: number
  seed: number
  /** Wall time in the worker, ms; 0 when run outside the worker. */
  elapsedMs: number
  /**
   * Present only when the run ended before every field: the rule and the
   * fields completed. The field in progress is dropped; `rows` holds the rest.
   */
  stopped?: { rule: 'budget' | 'cancelled'; at: number }
}

/** The defined fraction with its Wilson interval; p 0 and the full unit interval with no run. */
function definedOf(n: number, total: number): Stat['defined'] {
  if (total === 0) return { p: 0, lo: 0, hi: 1 }
  const w = wilson(n, total)
  return { p: w.p, lo: w.lo, hi: w.hi }
}

/**
 * The interval on the mean of `sorted`. A count with a
 * finite support maximum at 0 of n reports the rule-of-three upper bound
 * 3 max / n on its mean, with no independence assumed between ships, and at
 * n of n the mirror max - 3 max / n; at max 1 these are the 0/1 bounds 3 / n.
 * A 0/1 count is otherwise a proportion: Wilson at STAT_CONF (z 1.96, the
 * `wilson` default). Any other count clamps the t-interval to [0, max]; an
 * unbounded count (salvos) always does. A time keeps the t-interval.
 */
function intervalOf(
  sorted: number[],
  kind: StatKind,
  t: { lo: number; hi: number },
): { lo: number; hi: number; interval: IntervalMethod } {
  if (kind.kind === 'time') return { ...t, interval: 't' }
  const { max } = kind
  const n = sorted.length
  const k = sorted.reduce((s, v) => s + v, 0)
  if (Number.isFinite(max)) {
    const bound = (3 * max) / n
    if (k === 0) return { lo: 0, hi: Math.min(max, bound), interval: 'rule-of-three' }
    if (k === n * max) return { lo: Math.max(0, max - bound), hi: max, interval: 'rule-of-three' }
  }
  if (max !== 1) return { lo: Math.max(0, t.lo), hi: Math.min(max, t.hi), interval: 't' }
  const w = wilson(k, n)
  return { lo: w.lo, hi: w.hi, interval: 'wilson' }
}

/**
 * Stat over the finite entries of `samples`; `total` is the count before the
 * finite filter. `conf` drives the t-interval and is reported as `conf`; the
 * Wilson and rule-of-three paths keep their 0.95 forms (z 1.96, 3 / n).
 */
export function statOf(samples: number[], kind: StatKind, conf = STAT_CONF): Stat {
  const total = samples.length
  const sorted = samples.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  const n = sorted.length
  const defined = definedOf(n, total)
  if (n === 0) {
    return {
      mean: NaN,
      sd: NaN,
      se: NaN,
      lo: NaN,
      hi: NaN,
      conf,
      interval: 'none',
      p10: NaN,
      p90: NaN,
      p025: NaN,
      p975: NaN,
      n: 0,
      total,
      defined,
    }
  }
  const { mean, sd, lo, hi } = meanInterval(sorted, conf)
  const q = (p: number, min: number) => (n < min ? NaN : quantile(sorted, p))
  return {
    mean,
    sd,
    se: sd / Math.sqrt(n),
    ...intervalOf(sorted, kind, { lo, hi }),
    conf,
    p10: q(0.1, BAND80_MIN_N),
    p90: q(0.9, BAND80_MIN_N),
    p025: q(0.025, BAND95_MIN_N),
    p975: q(0.975, BAND95_MIN_N),
    n,
    total,
    defined,
  }
}

/**
 * Half-width of the displayed interval on the end-of-run leaker mean:
 * the same `statOf` path and ship support the leakers Stat uses,
 * so the stopping rule and the tile read one interval.
 */
function halfWidthOf(values: number[], ships: number, conf: number): number {
  const { lo, hi } = statOf(values, count(ships), conf)
  return (hi - lo) / 2
}

/** The same count Stat per step over `rows` (one row per replicate, one entry per step). */
function bandOf(rows: number[][], n: number, max: number, conf: number): BandSeries {
  const band: BandSeries = { mean: [], lo: [], hi: [], p10: [], p90: [], p025: [], p975: [] }
  const column = new Array<number>(rows.length)
  for (let k = 0; k < n; k += 1) {
    for (let i = 0; i < rows.length; i += 1) column[i] = rows[i][k]
    const s = statOf(column, count(max), conf)
    band.mean.push(s.mean)
    band.lo.push(s.lo)
    band.hi.push(s.hi)
    band.p10.push(s.p10)
    band.p90.push(s.p90)
    band.p025.push(s.p025)
    band.p975.push(s.p975)
  }
  return band
}

/** Per-replicate samples of one quantity, in replicate order. */
type Samples = number[]

/** Running minimum where NaN means "no value yet". */
function minOf(acc: number, v: number): number {
  return Number.isNaN(acc) ? v : Math.min(acc, v)
}

/**
 * Numbers the summary of `scenario` holds: seven band statistics per grid
 * step for the five raid series and one residual series per threat with a
 * path (an upper bound on the tracks). The summary is built in the worker
 * and cloned to the main thread, so a run whose summary alone exceeds the
 * retained-number budget is refused before its first replicate.
 */
export function summaryNumbers(scenario: Scenario): number {
  const threats = scenario.entities.filter(
    (e) => e.kind === 'uas' && entityActive(e) && scenario.paths.some((p) => p.entityId === e.id),
  ).length
  return 7 * sampleCount(scenario) * (5 + threats)
}

/** Throws the refusal the worker reports when the summary alone is over budget. */
export function assertSummaryFits(scenario: Scenario, budget: ExecutionBudget): void {
  const need = summaryNumbers(scenario)
  if (need <= budget.retainedNumbers) return
  throw new Error(
    `The result would hold ${need.toLocaleString()} numbers, over the budget of ` +
      `${budget.retainedNumbers.toLocaleString()}. Shorten the scenario or reduce the threats.`,
  )
}

/** 'budget' once the retained numbers or the wall time reach the budget; otherwise nothing. */
export function overBudget(
  cp: Checkpoint,
  budget: ExecutionBudget,
  elapsedMs: number,
): StopRule | undefined {
  return cp.retained >= budget.retainedNumbers || elapsedMs >= budget.timeMs ? 'budget' : undefined
}

/**
 * Run a loop to its summary on this thread. With a budget, the summary size is
 * checked first and each checkpoint is held against `overBudget`; without one
 * the loop runs to its own end. The worker has its own async driver.
 */
function drive<T>(loop: Loop<T>, budget?: ExecutionBudget): T {
  const t0 = performance.now()
  let stop: StopRule | undefined
  for (;;) {
    const next = loop.next(stop)
    if (next.done) return next.value
    stop = budget ? overBudget(next.value, budget, performance.now() - t0) : undefined
  }
}

/**
 * What the replicate loop retains for a set of replicate indices: plain
 * arrays and numbers, so a partial crosses a worker message (structuredClone)
 * and a pool merges partials from several workers by index
 * (`mergeSummaries.ts`). Every per-replicate array is aligned with `indices`,
 * which is ascending. Per-threat arrays are aligned with `threatIds`, the
 * track order of the first replicate run (the same in every replicate, since
 * a path is geometry the sampler never moves); per-effector arrays with
 * `effectorIds`, the scenario's effector order. An undefined time is NaN,
 * which structuredClone keeps and JSON does not: a JSON transport must map it.
 */
export interface McPartial {
  /** Replicate indices done, ascending. */
  indices: number[]
  /** Cumulative counts per grid step, one row per replicate (see McSummary). */
  kills: number[][]
  leakers: number[][]
  detected: number[][]
  tracked: number[][]
  engaged: number[][]
  /** Raid scalars per replicate; NaN when undefined. */
  raidFirstDetect: number[]
  raidFirmTrack: number[]
  raidMinWarning: number[]
  /** Operator decisions taken per replicate, and the ones the floor caught. */
  operatorDecisions: number[]
  operatorFlooredDecisions: number[]
  /** Tracks (threats with a path), in track order. */
  threatIds: string[]
  /** Per track, one sample per replicate. */
  threatKilled: number[][]
  threatLeaked: number[][]
  threatFirstDetect: number[][]
  /** Per track, one residual row (ships alive per step) per replicate. */
  threatResidual: number[][][]
  /** Per track: geometry, identical in every replicate. */
  threatArrival: (number | null)[]
  threatShips: number[]
  /** Effectors, in scenario order. */
  effectorIds: string[]
  /** Per effector, one sample per replicate. */
  effectorSalvos: number[][]
  effectorKills: number[][]
  /** Numbers retained for the bands over these replicates (the checkpoint measure). */
  retained: number
  /** Loop time on the thread that ran these replicates, ms. */
  elapsedMs: number
}

/** A partial holding no replicates; the loop fills it and a merge starts from one. */
export function emptyPartial(): McPartial {
  return {
    indices: [],
    kills: [],
    leakers: [],
    detected: [],
    tracked: [],
    engaged: [],
    raidFirstDetect: [],
    raidFirmTrack: [],
    raidMinWarning: [],
    operatorDecisions: [],
    operatorFlooredDecisions: [],
    threatIds: [],
    threatKilled: [],
    threatLeaked: [],
    threatFirstDetect: [],
    threatResidual: [],
    threatArrival: [],
    threatShips: [],
    effectorIds: [],
    effectorSalvos: [],
    effectorKills: [],
    retained: 0,
    elapsedMs: 0,
  }
}

/**
 * Run `runSettings(scenario).replicates` replicates from the scenario's seed
 * and summarize them. With `targetHalfWidth` set, the loop checks the
 * half-width of the displayed interval on the end-of-run leaker mean (the
 * leakers Stat over the raid's ships) at `stopFloor` replicates and every 10
 * after that, and stops once it is under the target; `replicates`
 * on the summary is then the count run. `onProgress` fires after every 10th
 * replicate and after the last, with the configured count as `total`.
 * `elapsedMs` is 0 here; the worker fills it. With a `budget`, a run whose
 * summary cannot fit throws, and the loop stops at the checkpoint where the
 * retained numbers or the wall time reach it.
 */
export function runReplicates(
  scenario: Scenario,
  onProgress?: (done: number, total: number) => void,
  budget?: ExecutionBudget,
): McSummary {
  if (budget) assertSummaryFits(scenario, budget)
  return drive(replicateLoop(scenario, onProgress), budget)
}

/**
 * The replicate loop behind `runReplicates`: `replicateRangeLoop` over
 * 0..replicates with the half-width rule applied at each checkpoint, then
 * `finishSummary`. The rule is checked before the checkpoint is passed on,
 * so a stop sent at the same replicate is never reported over it. The last
 * replicate's checkpoint accepts no stop: the run is complete. The worker
 * drives this loop asynchronously, yielding between replicates so a cancel
 * can arrive.
 */
export function* replicateLoop(
  scenario: Scenario,
  onProgress?: (done: number, total: number) => void,
): Loop<McSummary> {
  const settings = runSettings(scenario)
  const { targetHalfWidth, stopFloor } = settings
  const end = loopEnd(settings)
  const partial = emptyPartial()
  const range = rangeLoopInto(scenario, 0, end, partial, onProgress)
  let stopped: McSummary['stopped'] = { rule: 'replicates', at: end }
  let next = range.next()
  while (!next.done) {
    const { done } = next.value
    if (
      targetHalfWidth != null &&
      done >= stopFloor &&
      (done - stopFloor) % STOP_EVERY === 0 &&
      halfWidthReached(scenario, partial)
    ) {
      stopped = { rule: 'halfWidth', at: done }
      break
    }
    const stop = yield next.value
    next = range.next(stop)
    if (stop && next.done && done < end) stopped = { rule: stop, at: done }
  }
  return finishSummary(scenario, partial, stopped, 0)
}

/**
 * The replicates `start..end-1` of `scenario` as a partial, one checkpoint
 * after each replicate with `done` and `total` counted within the range. A
 * stop sent at a checkpoint returns the partial so far; the last replicate's
 * checkpoint accepts no stop. No half-width rule runs here: the driver
 * applies `halfWidthReached` to the merged partials. Replicate i is a pure
 * function of i (the keyed draw policy), so ranges run in any order and on
 * any thread give the same rows. `onProgress` fires after every 10th
 * replicate of the range and after its last.
 */
export function* replicateRangeLoop(
  scenario: Scenario,
  start: number,
  end: number,
  onProgress?: (done: number, total: number) => void,
): Loop<McPartial> {
  const partial = emptyPartial()
  yield* rangeLoopInto(scenario, start, end, partial, onProgress)
  return partial
}

/** The range loop, filling the caller's partial in place so the driver can read it at a checkpoint. */
function* rangeLoopInto(
  scenario: Scenario,
  start: number,
  end: number,
  partial: McPartial,
  onProgress?: (done: number, total: number) => void,
): Loop<void> {
  const settings = runSettings(scenario)
  const { seed, uncertainty } = settings
  const total = uncertainty === 'total'
  // The strata count is the loop end of the whole run, whatever range this is.
  const draws = paramDraws(settings, loopEnd(settings))
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
  const n = sampleCount(scenario)
  const enabledSensorIds = new Set(
    scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e)).map((e) => e.id),
  )
  const count = end - start
  const t0 = performance.now()

  for (let i = start; i < end; i += 1) {
    const policy = monteCarloPolicy(seed, i, thresholds)
    // Under aleatory the sampler never runs.
    const s = total ? sampleScenario(scenario, draws(policy, i)) : scenario
    const assessments = assessAllThreats(s, policy)
    const report = resolveEngagements(s, assessments, policy)
    const tracks = assessments.filter((a) => a.status !== 'no-path')

    const tl = buildLiveTimeline(assessments, report)
    const killRow: number[] = []
    const leakRow: number[] = []
    const detRow: number[] = []
    const engRow: number[] = []
    for (let k = 0; k < n; k += 1) {
      const kpi = liveKpisAt(tl, k * DT)
      killRow.push(kpi.expectedKills)
      leakRow.push(kpi.leakerShips)
      detRow.push(kpi.detected)
      engRow.push(kpi.engaged)
    }
    partial.indices.push(i)
    partial.kills.push(killRow)
    partial.leakers.push(leakRow)
    partial.detected.push(detRow)
    partial.engaged.push(engRow)
    partial.tracked.push(heldTracksOnGrid(tracks, enabledSensorIds, n))

    let firstDetect = NaN
    let firmTrack = NaN
    let minWarning = NaN
    tracks.forEach((a, t) => {
      if (a.firstDetectS != null) firstDetect = minOf(firstDetect, a.firstDetectS)
      if (a.stableTrackAtS != null) firmTrack = minOf(firmTrack, a.stableTrackAtS)
      if (a.warningS != null) minWarning = minOf(minWarning, a.warningS)
      const att = report.threats.find((x) => x.uasId === a.uasId)
      if (i === start) {
        // The first replicate of the range fixes the track order and the geometry.
        partial.threatIds.push(a.uasId)
        partial.threatKilled.push([])
        partial.threatLeaked.push([])
        partial.threatFirstDetect.push([])
        partial.threatResidual.push([])
        partial.threatArrival.push(a.arrivalS)
        partial.threatShips.push(att?.shipCount ?? 1)
      }
      partial.threatKilled[t].push(att?.expectedKills ?? 0)
      partial.threatLeaked[t].push(att?.expectedLeakers ?? 0)
      partial.threatFirstDetect[t].push(a.firstDetectS ?? NaN)
      partial.threatResidual[t].push(residualOnGrid(report, a.uasId, n))
    })
    partial.raidFirstDetect.push(firstDetect)
    partial.raidFirmTrack.push(firmTrack)
    partial.raidMinWarning.push(minWarning)
    partial.operatorDecisions.push(report.totals.operatorDecisions ?? 0)
    partial.operatorFlooredDecisions.push(report.totals.operatorFlooredDecisions ?? 0)

    report.effectors.forEach((ef, e) => {
      if (i === start) {
        partial.effectorIds.push(ef.effectorId)
        partial.effectorSalvos.push([])
        partial.effectorKills.push([])
      }
      partial.effectorSalvos[e].push(ef.shotsFired + ef.deSalvos + ef.jamSalvos)
      let killed = 0
      for (const ev of report.events) if (ev.effectorId === ef.effectorId) killed += ev.killDelta
      partial.effectorKills[e].push(killed)
    })

    const done = i - start + 1
    if (done % 10 === 0 || done === count) onProgress?.(done, count)
    partial.retained += n * (5 + tracks.length)
    partial.elapsedMs = performance.now() - t0
    const stop = yield { done, total: count, retained: partial.retained }
    if (stop && done < count) return
  }
}

/**
 * The half-width rule on a partial: true once the 95 percent half-width of
 * the displayed interval on the end-of-run leaker mean (the leakers Stat
 * over the raid's ships) is under `targetHalfWidth`, and never with fewer
 * than `stopFloor` replicates or with no target. `stopCap` is the caller's
 * own stop (the 'replicates' rule), so a pool that never reaches the target
 * still ends.
 */
export function halfWidthReached(scenario: Scenario, partial: McPartial): boolean {
  const { targetHalfWidth, stopFloor, confidence } = runSettings(scenario)
  if (targetHalfWidth == null || partial.indices.length < stopFloor) return false
  const n = sampleCount(scenario)
  const ends = partial.leakers.map((row) => row[n - 1])
  return halfWidthOf(ends, raidSizeOf(partial.threatShips), confidence) < targetHalfWidth
}

/** Ships over the raid: the support of the kills and leakers counts. */
function raidSizeOf(threatShips: number[]): number {
  return threatShips.reduce((sum, ships) => sum + ships, 0)
}

/**
 * The summary of a partial: the end-of-run statistics over its rows.
 * `replicates` is the count of indices done; `stopped` and `elapsedMs` are
 * the caller's, since a pool decides the stop and keeps its own clock.
 * The rows are read in their stored order, so merge before finishing.
 */
export function finishSummary(
  scenario: Scenario,
  partial: McPartial,
  stopped: { rule: StopRule; at: number },
  elapsedMs: number,
): McSummary {
  const { seed, confidence: conf } = runSettings(scenario)
  const n = sampleCount(scenario)
  // Count supports: ships for kills, leakers and residual; tracks for the
  // detected, tracked and engaged counts; salvos are unbounded.
  const raidSize = raidSizeOf(partial.threatShips)
  const trackCount = partial.threatIds.length
  const perThreat: Record<string, McThreatSummary> = {}
  partial.threatIds.forEach((uasId, t) => {
    const ships = partial.threatShips[t]
    perThreat[uasId] = {
      killed: statOf(partial.threatKilled[t], count(ships), conf),
      leaked: statOf(partial.threatLeaked[t], count(ships), conf),
      firstDetectS: statOf(partial.threatFirstDetect[t], TIME, conf),
      arrivalS: partial.threatArrival[t],
      shipCount: ships,
      residual: bandOf(partial.threatResidual[t], n, ships, conf),
    }
  })
  const perEffector: Record<string, McEffectorSummary> = {}
  partial.effectorIds.forEach((effectorId, e) => {
    perEffector[effectorId] = {
      salvos: statOf(partial.effectorSalvos[e], count(Infinity), conf),
      kills: statOf(partial.effectorKills[e], count(raidSize), conf),
    }
  })

  return {
    seed,
    replicates: partial.indices.length,
    // The duration is an integer number of seconds and DT divides one, so
    // the grid recovers it exactly without a store import.
    durationS: (n - 1) * DT,
    kills: bandOf(partial.kills, n, raidSize, conf),
    leakers: bandOf(partial.leakers, n, raidSize, conf),
    detected: bandOf(partial.detected, n, trackCount, conf),
    tracked: bandOf(partial.tracked, n, trackCount, conf),
    engaged: bandOf(partial.engaged, n, trackCount, conf),
    firstDetectS: statOf(partial.raidFirstDetect, TIME, conf),
    firmTrackS: statOf(partial.raidFirmTrack, TIME, conf),
    minWarningS: statOf(partial.raidMinWarning, TIME, conf),
    // Unbounded counts, like the per-effector salvos: a pair can decide twice
    // and the pair count is a property of the laydown, not of the raid's ships.
    operatorDecisions: statOf(partial.operatorDecisions, count(Infinity), conf),
    operatorFlooredDecisions: statOf(partial.operatorFlooredDecisions, count(Infinity), conf),
    perThreat,
    perEffector,
    elapsedMs,
    stopped,
  }
}

/** The stop a sensitivity loop received, shared by its field runs. */
interface Halt {
  rule: 'budget' | 'cancelled' | null
}

/** Per-replicate samples of every response, in replicate order. */
type ResponseSamples = Record<SensitivityResponse, Samples>

/**
 * End-of-run responses per replicate over the replicates of
 * `runSettings(scenario)`. The leaker sum over the count is the number
 * `runReplicates(scenario).leakers.mean[n - 1]` reports, without the bands;
 * the times and salvos are the per-replicate scalars that loop records.
 * The caller passes an aleatory scenario with no stopping rule, so every
 * replicate runs. One checkpoint per replicate, reporting the caller's field
 * progress; a stop records itself in `halt` and returns null.
 */
function* responseLoop(
  scenario: Scenario,
  cp: Checkpoint,
  halt: Halt,
): Loop<ResponseSamples | null> {
  const { seed, replicates } = runSettings(scenario)
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
  const out: ResponseSamples = {
    leakers: [],
    kills: [],
    firstDetectS: [],
    minWarningS: [],
    salvos: [],
  }
  for (let i = 0; i < replicates; i += 1) {
    const row = endOfRunResponses(scenario, monteCarloPolicy(seed, i, thresholds))
    for (const r of SENSITIVITY_RESPONSES) out[r].push(row[r])
    const stop = yield cp
    if (stop) {
      // The half-width rule never runs here, so a stop is a budget or a cancel.
      halt.rule = stop === 'cancelled' ? 'cancelled' : 'budget'
      return null
    }
  }
  return out
}

/**
 * The five end-of-run responses of one replicate of `scenario` under
 * `policy`: the leaker ships and expected kills at the last grid step, the
 * raid's first detect and minimum warning (NaN with none), and the salvos
 * over every effector, as `replicateLoop` records them. The Morris and Sobol
 * loops evaluate one row each through this.
 */
export function endOfRunResponses(
  scenario: Scenario,
  policy: DrawPolicy,
): Record<SensitivityResponse, number> {
  const tEndS = (sampleCount(scenario) - 1) * DT
  const assessments = assessAllThreats(scenario, policy)
  const report = resolveEngagements(scenario, assessments, policy)
  const kpi = liveKpisAt(buildLiveTimeline(assessments, report), tEndS)
  let firstDetect = NaN
  let minWarning = NaN
  for (const a of assessments) {
    if (a.status === 'no-path') continue
    if (a.firstDetectS != null) firstDetect = minOf(firstDetect, a.firstDetectS)
    if (a.warningS != null) minWarning = minOf(minWarning, a.warningS)
  }
  let salvos = 0
  for (const ef of report.effectors) salvos += ef.shotsFired + ef.deSalvos + ef.jamSalvos
  return {
    leakers: kpi.leakerShips,
    kills: kpi.expectedKills,
    firstDetectS: firstDetect,
    minWarningS: minWarning,
    salvos,
  }
}

/** The mean of the finite per-replicate samples, summed in replicate order; NaN with none. */
function meanOf(samples: Samples): number {
  let sum = 0
  let n = 0
  for (const v of samples) {
    if (!Number.isFinite(v)) continue
    sum += v
    n += 1
  }
  return sum / n
}

/** The paired standard error of `high - low` over the replicates finite on both sides. */
function pairedSe(low: Samples, high: Samples): number {
  const d: number[] = []
  for (let i = 0; i < low.length; i += 1) {
    if (Number.isFinite(low[i]) && Number.isFinite(high[i])) d.push(high[i] - low[i])
  }
  const { sd } = meanInterval(d, STAT_CONF)
  return sd / Math.sqrt(d.length)
}

/** The count of finite samples over the count run, as a Stat reports `defined`. */
function definedOfSamples(samples: Samples): Stat['defined'] {
  return definedOf(samples.filter((v) => Number.isFinite(v)).length, samples.length)
}

/** One response's paired statistics between the p10 and p90 runs. */
function responseStat(low: Samples, high: Samples): SensitivityResponseStat {
  const lo = meanOf(low)
  const hi = meanOf(high)
  return {
    lo,
    hi,
    swing: Math.abs(hi - lo),
    se: pairedSe(low, high),
    defined: { lo: definedOfSamples(low), hi: definedOfSamples(high) },
  }
}

/** The panel label of one uncertain field's owner: model name, connection label, or Doctrine. */
function fieldLabel(scenario: Scenario, modelId: string): string {
  if (modelId === 'doctrine') return 'Doctrine'
  const model = scenario.library.find((m) => m.id === modelId)
  if (model) return model.name
  const link = scenario.connections.find((c) => c.id === modelId)
  return link ? link.label || link.id : modelId
}

/**
 * One-at-a-time sensitivity on the end-of-run leaker mean. For each uncertain
 * field the loop runs `replicates` replicates twice, the field at its p10
 * sample and at its p90 sample with every other field nominal, under the
 * same seed and replicate indices as the nominal run (common random
 * numbers), so the swing is a paired difference. Each row also records the
 * same pair for every `SensitivityResponse`. Rows sort by the leaker swing,
 * largest first; ties keep the `uncertainFields` order. `onProgress` fires after
 * every field with the field count. `elapsedMs` is 0 here; the worker fills it.
 */
export function runSensitivity(
  scenario: Scenario,
  onProgress?: (done: number, total: number) => void,
  budget?: ExecutionBudget,
): SensitivitySummary {
  return drive(sensitivityLoop(scenario, onProgress), budget)
}

/**
 * The loop behind `runSensitivity`, one checkpoint per replicate of every
 * field run, reporting the fields completed. A stop drops the field in
 * progress and returns the rows so far under `stopped`; a full run has no
 * `stopped` key, so its summary is unchanged by this loop.
 */
export function* sensitivityLoop(
  scenario: Scenario,
  onProgress?: (done: number, total: number) => void,
): Loop<SensitivitySummary> {
  const { seed, replicates } = runSettings(scenario)
  // Every run is aleatory (the field under test is the only sampled value)
  // and runs every replicate, so the p10 and p90 means pair replicate by replicate.
  const base: Scenario = { ...scenario, uncertainty: 'aleatory', targetHalfWidth: null }
  const fields = uncertainFields(base)
  const cp: Checkpoint = { done: 0, total: fields.length, retained: 0 }
  const halt: Halt = { rule: null }
  const rows: SensitivityRow[] = []
  const summary = (nominal: number): SensitivitySummary => {
    // A stable sort: ties keep the uncertainFields order.
    rows.sort((a, b) => b.swing - a.swing)
    const done = { stat: 'leakers' as const, rows, nominal, replicates, seed, elapsedMs: 0 }
    return halt.rule ? { ...done, stopped: { rule: halt.rule, at: cp.done } } : done
  }
  const nominalRuns = yield* responseLoop(base, cp, halt)
  if (nominalRuns == null) return summary(NaN)
  const nominal = meanOf(nominalRuns.leakers)
  for (const f of fields) {
    const at = (q: number) =>
      responseLoop(
        sampleScenario(base, (m, fl) => (m === f.modelId && fl === f.field ? q : null)),
        cp,
        halt,
      )
    const low = yield* at(0.1)
    if (low == null) break
    const high = yield* at(0.9)
    if (high == null) break
    const responses = {} as Record<SensitivityResponse, SensitivityResponseStat>
    for (const r of SENSITIVITY_RESPONSES) responses[r] = responseStat(low[r], high[r])
    // The headline fields alias the leaker response.
    rows.push({
      modelId: f.modelId,
      field: f.field,
      label: fieldLabel(base, f.modelId),
      low: responses.leakers.lo,
      high: responses.leakers.hi,
      swing: responses.leakers.swing,
      se: responses.leakers.se,
      responses,
    })
    cp.done += 1
    onProgress?.(cp.done, fields.length)
  }
  return summary(nominal)
}

/** Default replicates per sweep cell. */
export const SWEEP_REPLICATES_DEFAULT = 40

/**
 * One grid cell: its index per factor, the factor values it ran, and the
 * replicate summary reduced to what the map reads. `kills` and `leakers`
 * keep the band series (the end-of-run value is the last step, as the
 * tiles read it); the times keep their Stat with definedness; `salvos` are
 * per effector under `perEffector`, as McSummary records them (no raid-level
 * salvos Stat exists there); `replicates` is every count's denominator.
 */
export interface SweepCell {
  index: number[]
  values: (number | string)[]
  summary: Pick<
    McSummary,
    'kills' | 'leakers' | 'firstDetectS' | 'minWarningS' | 'perEffector' | 'replicates'
  >
}

/** The sweep run result: cells in row-major order over the factor grid. */
export interface SweepSummary {
  factors: SweepFactor[]
  responses: SensitivityResponse[]
  cells: SweepCell[]
  replicatesPerCell: number
  seed: number
  /** Wall time in the worker, ms; 0 when run outside the worker. */
  elapsedMs: number
  /** Present only when the run ended before every cell: the rule and the cells completed. */
  stopped?: { rule: 'budget' | 'cancelled'; at: number }
}

/** Every cell index of the grid in row-major order (the first factor outermost). */
function gridIndices(factors: SweepFactor[]): number[][] {
  let cells: number[][] = [[]]
  for (const f of factors) {
    const next: number[][] = []
    for (const prefix of cells)
      for (let i = 0; i < f.values.length; i += 1) next.push([...prefix, i])
    cells = next
  }
  return cells
}

/** Throws when a factor has too few or too many values; the UI caps the grid separately. */
function assertSweepFactors(factors: SweepFactor[]): void {
  if (factors.length < 1 || factors.length > 2) throw new Error('A sweep takes one or two factors')
  for (const f of factors) {
    if (f.values.length < SWEEP_VALUES_MIN || f.values.length > SWEEP_VALUES_MAX) {
      throw new Error(
        `${f.id} takes ${SWEEP_VALUES_MIN} to ${SWEEP_VALUES_MAX} values, not ${f.values.length}`,
      )
    }
  }
}

/**
 * The scenario of one cell: the base with each factor at its indexed value,
 * every cell's replicate count set and the half-width rule off, so every
 * cell runs the same replicates from the same seed (common random numbers
 * across cells). The uncertainty mode is the scenario's own.
 */
export function sweepCellScenario(
  scenario: Scenario,
  factors: SweepFactor[],
  index: number[],
  replicatesPerCell: number,
): Scenario {
  let s: Scenario = { ...scenario, replicates: replicatesPerCell, targetHalfWidth: null }
  factors.forEach((f, k) => {
    s = applySweepValue(s, f.id, f.values[index[k]])
  })
  return s
}

/** Run a sweep to its summary on this thread (see `runReplicates` for the budget). */
export function runSweep(
  request: Omit<McSweepRequest, 'type' | 'runId'>,
  onProgress?: (done: number, total: number) => void,
  budget?: ExecutionBudget,
): SweepSummary {
  return drive(sweepLoop(request, onProgress, budget), budget)
}

/**
 * The loop behind `runSweep`: one checkpoint per cell, cells in sequence.
 * Each cell drives `replicateLoop` to its replicate count with no stop of its
 * own; the checkpoint reports the numbers that cell retained at its peak, so
 * the driver's budget rule sees the cost of the next cell. With a `budget`,
 * `assertSummaryFits` is checked per cell before its first replicate. A
 * stop lands between cells: the cells done are kept under `stopped`, and a
 * full run has no `stopped` key. `onProgress` fires after every cell.
 */
export function* sweepLoop(
  request: Omit<McSweepRequest, 'type' | 'runId'>,
  onProgress?: (done: number, total: number) => void,
  budget?: ExecutionBudget,
): Loop<SweepSummary> {
  const { scenario, factors, replicatesPerCell, responses } = request
  assertSweepFactors(factors)
  if (!Number.isInteger(replicatesPerCell) || replicatesPerCell < 1) {
    throw new Error(`replicatesPerCell takes a whole number of 1 or more, not ${replicatesPerCell}`)
  }
  const indices = gridIndices(factors)
  const cells: SweepCell[] = []
  const summary = (stopped?: SweepSummary['stopped']): SweepSummary => ({
    factors,
    responses: [...responses],
    cells,
    replicatesPerCell,
    seed: runSettings(scenario).seed,
    elapsedMs: 0,
    ...(stopped ? { stopped } : {}),
  })
  for (const index of indices) {
    const cell = sweepCellScenario(scenario, factors, index, replicatesPerCell)
    if (budget) assertSummaryFits(cell, budget)
    const loop = replicateLoop(cell)
    let retained = 0
    let next = loop.next()
    while (!next.done) {
      retained = Math.max(retained, next.value.retained)
      next = loop.next()
    }
    const { kills, leakers, firstDetectS, minWarningS, perEffector, replicates } = next.value
    cells.push({
      index,
      values: factors.map((f, k) => f.values[index[k]]),
      summary: { kills, leakers, firstDetectS, minWarningS, perEffector, replicates },
    })
    onProgress?.(cells.length, indices.length)
    if (cells.length === indices.length) break
    const stop = yield { done: cells.length, total: indices.length, retained }
    if (stop)
      return summary({ rule: stop === 'cancelled' ? 'cancelled' : 'budget', at: cells.length })
  }
  return summary()
}
