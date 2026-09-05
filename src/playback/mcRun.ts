/**
 * Monte Carlo replicate loop. Replicate i runs the sweep and the attrition
 * with `monteCarloPolicy(seed, i, thresholds)`, a counter-based policy whose
 * every draw is a pure function of its key (seed, replicate, draw kind, the
 * ids, the indices, the step), and records the same
 * per-step counts the live panels read from the deterministic ledger. The
 * summary holds per-step bands and per-replicate scalars, never a replicate
 * ledger. Under `uncertainty: 'total'` each replicate first samples every
 * uncertain field through the policy's `param` draw (`sampleScenario`, once
 * per replicate) and runs the sweep and the attrition on that scenario;
 * under `aleatory` the nominal scenario runs and the sampler is never
 * called. Pure TS, no DOM, no store import at the value level, and it never
 * reads `engagementPicture` (that cache is the deterministic run).
 *
 * The grid is the chart grid: `sampleCount(scenario)` steps at DT from t = 0
 * through `scenarioDurationS`, index k is t = k * DT.
 */
import { heldOnGrid, residualOnGrid, sampleCount } from '../analysis/series'
import { buildLiveTimeline, liveKpisAt } from '../analysis/liveStats'
import { sampleScenario, uncertainFields } from '../analysis/uncertainty'
import type { Scenario } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, entityActive, runSettings } from '../model/types'
import { meanInterval, quantile, wilson } from '../te/calc/stats'
import { resolveEngagements } from './attrition'
import { monteCarloPolicy } from './policy'
import type { ThreatAssessment } from './sim'
import { assessAllThreats, DT } from './sim'

/**
 * Summary statistics over the finite samples of one quantity. Every numeric
 * field is NaN when n is 0; `n`, `total` and `defined` always read.
 */
export interface Stat {
  mean: number
  sd: number
  /** Standard error of the mean, sd / sqrt(n); 0 with one sample. */
  se: number
  /** t-interval on the mean at conf (meanInterval from src/te/calc/stats.ts). */
  lo: number
  hi: number
  conf: number
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

/** Confidence level of every Stat interval and band interval. */
export const STAT_CONF = 0.95

/** First replicate count the stopping rule checks, then every STOP_EVERY after it. */
const STOP_FIRST = 30
const STOP_EVERY = 10

/** Per DT step from t = 0 to scenarioDurationS inclusive (series.ts sampleCount). */
export interface BandSeries {
  mean: number[]
  /** t-interval on the mean at STAT_CONF, per step. */
  lo: number[]
  hi: number[]
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
  /** Held-track count at each step, the heldPass rule of series.ts. */
  tracked: BandSeries
  engaged: BandSeries
  /** Earliest first detection over the tracks, per replicate. */
  firstDetectS: Stat
  /** Shortest warning (arrival minus first detection) over the tracks, per replicate. */
  minWarningS: Stat
  perThreat: Record<string, McThreatSummary>
  perEffector: Record<string, McEffectorSummary>
  /** Wall time in the worker, ms; 0 when run outside the worker. */
  elapsedMs: number
  /** Why the loop ended: every replicate, or the half-width rule at replicate `at`. */
  stopped: { rule: 'replicates' | 'halfWidth'; at: number }
}

/** One run request to the worker: plain JSON, never a store reference. */
export interface McRunRequest {
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

/** Every request the worker accepts; it dispatches on `type`. */
export type McRequest = McRunRequest | McSensitivityRequest

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

/** One tornado row: the headline statistic with one field at its p10 and at its p90. */
export interface SensitivityRow {
  /** A library model id, a connection id, or 'doctrine' (uncertainFields). */
  modelId: string
  field: string
  /** The model name (a connection reads its label, doctrine reads 'Doctrine'), for the panel. */
  label: string
  /** End-of-run leaker mean with the field at its p10 sample, every other field nominal. */
  low: number
  /** The same with the field at its p90 sample. */
  high: number
  /** |high - low|; rows sort by it, largest first. */
  swing: number
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
}

/** The defined fraction with its Wilson interval; p 0 and the full unit interval with no run. */
function definedOf(n: number, total: number): Stat['defined'] {
  if (total === 0) return { p: 0, lo: 0, hi: 1 }
  const w = wilson(n, total)
  return { p: w.p, lo: w.lo, hi: w.hi }
}

/**
 * Stat over the finite entries of `samples`; `total` is the sample count
 * before the finite filter. Sorted once here; `quantile` sorts its input
 * again, and that second sort of an ascending array is accepted.
 */
function statOf(samples: number[]): Stat {
  const total = samples.length
  const sorted = samples.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  const n = sorted.length
  const defined = definedOf(n, total)
  if (n === 0) {
    return {
      mean: NaN, sd: NaN, se: NaN, lo: NaN, hi: NaN, conf: STAT_CONF,
      p10: NaN, p90: NaN, p025: NaN, p975: NaN, n: 0, total, defined,
    }
  }
  const { mean, sd, lo, hi } = meanInterval(sorted, STAT_CONF)
  return {
    mean,
    sd,
    se: sd / Math.sqrt(n),
    lo,
    hi,
    conf: STAT_CONF,
    p10: quantile(sorted, 0.1),
    p90: quantile(sorted, 0.9),
    p025: quantile(sorted, 0.025),
    p975: quantile(sorted, 0.975),
    n,
    total,
    defined,
  }
}

/** Half-width of the 95 percent t-interval on the mean of `values`. */
function halfWidthOf(values: number[]): number {
  const { lo, hi } = meanInterval(values, STAT_CONF)
  return (hi - lo) / 2
}

/** The same Stat per step over `rows` (one row per replicate, one entry per step). */
function bandOf(rows: number[][], n: number): BandSeries {
  const band: BandSeries = { mean: [], lo: [], hi: [], p10: [], p90: [], p025: [], p975: [] }
  const column = new Array<number>(rows.length)
  for (let k = 0; k < n; k += 1) {
    for (let i = 0; i < rows.length; i += 1) column[i] = rows[i][k]
    const s = statOf(column)
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

/**
 * Held-track count per step: the heldPass rule of series.ts. At step k, the
 * count of tracks with a hold flag of 1 for at least one enabled sensor; a
 * flag is 1 inside any inclusive interval of that sensor's observation
 * (`heldOnGrid`), coast intervals included.
 */
function trackedOnGrid(
  tracks: ThreatAssessment[],
  enabledSensorIds: Set<string>,
  n: number,
): number[] {
  const tracked = new Array<number>(n).fill(0)
  for (const a of tracks) {
    const held = new Array<boolean>(n).fill(false)
    for (const obs of a.sensorObservations ?? []) {
      if (!enabledSensorIds.has(obs.sensorId)) continue
      heldOnGrid(obs, n).forEach((flag, i) => {
        if (flag === 1) held[i] = true
      })
    }
    for (let i = 0; i < n; i += 1) if (held[i]) tracked[i] += 1
  }
  return tracked
}

/** Per-replicate samples of one quantity, in replicate order. */
type Samples = number[]

/** Running minimum where NaN means "no value yet". */
function minOf(acc: number, v: number): number {
  return Number.isNaN(acc) ? v : Math.min(acc, v)
}

/**
 * Run `runSettings(scenario).replicates` replicates from the scenario's seed
 * and summarize them. With `targetHalfWidth` set, the loop checks the 95
 * percent half-width of the end-of-run leaker mean after 30 replicates and
 * every 10 after that, and stops once it is under the target; `replicates`
 * on the summary is then the count run. `onProgress` fires after every 10th
 * replicate and after the last, with the configured count as `total`.
 * `elapsedMs` is 0 here; the worker fills it.
 */
export function runReplicates(
  scenario: Scenario,
  onProgress?: (done: number, total: number) => void,
): McSummary {
  const { seed, replicates, targetHalfWidth, uncertainty } = runSettings(scenario)
  const total = uncertainty === 'total'
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
  const n = sampleCount(scenario)
  const enabledSensorIds = new Set(
    scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e)).map((e) => e.id),
  )

  const kills: number[][] = []
  const leakers: number[][] = []
  const detected: number[][] = []
  const tracked: number[][] = []
  const engaged: number[][] = []
  const raidFirstDetect: Samples = []
  const raidMinWarning: Samples = []
  const threatKilled = new Map<string, Samples>()
  const threatLeaked = new Map<string, Samples>()
  const threatFirstDetect = new Map<string, Samples>()
  const threatResidual = new Map<string, number[][]>()
  const threatArrival = new Map<string, number | null>()
  const threatShips = new Map<string, number>()
  const effectorSalvos = new Map<string, Samples>()
  const effectorKills = new Map<string, Samples>()
  const sample = (map: Map<string, Samples>, id: string, v: number) => {
    const list = map.get(id)
    if (list) list.push(v)
    else map.set(id, [v])
  }

  let stopped: McSummary['stopped'] = { rule: 'replicates', at: replicates }
  for (let i = 0; i < replicates; i += 1) {
    const policy = monteCarloPolicy(seed, i, thresholds)
    // The ternary, not a null sampler: under aleatory the sampler never runs.
    const s = total ? sampleScenario(scenario, (m, f) => policy.param(m, f)) : scenario
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
    kills.push(killRow)
    leakers.push(leakRow)
    detected.push(detRow)
    engaged.push(engRow)
    tracked.push(trackedOnGrid(tracks, enabledSensorIds, n))

    let firstDetect = NaN
    let minWarning = NaN
    for (const a of tracks) {
      if (a.firstDetectS != null) firstDetect = minOf(firstDetect, a.firstDetectS)
      if (a.warningS != null) minWarning = minOf(minWarning, a.warningS)
      const att = report.threats.find((x) => x.uasId === a.uasId)
      sample(threatKilled, a.uasId, att?.expectedKills ?? 0)
      sample(threatLeaked, a.uasId, att?.expectedLeakers ?? 0)
      sample(threatFirstDetect, a.uasId, a.firstDetectS ?? NaN)
      const rows = threatResidual.get(a.uasId) ?? []
      rows.push(residualOnGrid(report, a.uasId, n))
      threatResidual.set(a.uasId, rows)
      if (i === 0) {
        threatArrival.set(a.uasId, a.arrivalS)
        threatShips.set(a.uasId, att?.shipCount ?? 1)
      }
    }
    raidFirstDetect.push(firstDetect)
    raidMinWarning.push(minWarning)

    for (const ef of report.effectors) {
      sample(effectorSalvos, ef.effectorId, ef.shotsFired + ef.deSalvos + ef.jamSalvos)
      let killed = 0
      for (const ev of report.events) if (ev.effectorId === ef.effectorId) killed += ev.killDelta
      sample(effectorKills, ef.effectorId, killed)
    }

    const done = i + 1
    if (done % 10 === 0 || done === replicates) onProgress?.(done, replicates)
    if (
      targetHalfWidth != null &&
      done >= STOP_FIRST &&
      (done - STOP_FIRST) % STOP_EVERY === 0 &&
      halfWidthOf(leakers.map((row) => row[n - 1])) < targetHalfWidth
    ) {
      stopped = { rule: 'halfWidth', at: done }
      break
    }
  }

  const perThreat: Record<string, McThreatSummary> = {}
  for (const [uasId, rows] of threatResidual) {
    perThreat[uasId] = {
      killed: statOf(threatKilled.get(uasId) ?? []),
      leaked: statOf(threatLeaked.get(uasId) ?? []),
      firstDetectS: statOf(threatFirstDetect.get(uasId) ?? []),
      arrivalS: threatArrival.get(uasId) ?? null,
      shipCount: threatShips.get(uasId) ?? 1,
      residual: bandOf(rows, n),
    }
  }
  const perEffector: Record<string, McEffectorSummary> = {}
  for (const [effectorId, salvos] of effectorSalvos) {
    perEffector[effectorId] = {
      salvos: statOf(salvos),
      kills: statOf(effectorKills.get(effectorId) ?? []),
    }
  }

  return {
    seed,
    replicates: stopped.at,
    // The duration is an integer number of seconds and DT divides one, so
    // the grid recovers it exactly without a store import.
    durationS: (n - 1) * DT,
    kills: bandOf(kills, n),
    leakers: bandOf(leakers, n),
    detected: bandOf(detected, n),
    tracked: bandOf(tracked, n),
    engaged: bandOf(engaged, n),
    firstDetectS: statOf(raidFirstDetect),
    minWarningS: statOf(raidMinWarning),
    perThreat,
    perEffector,
    elapsedMs: 0,
    stopped,
  }
}

/**
 * End-of-run leaker mean over the replicates of `runSettings(scenario)`:
 * the same number `runReplicates(scenario).leakers.mean[n - 1]` reports,
 * without the bands. The caller passes an aleatory scenario with no stopping
 * rule, so every replicate runs.
 */
function endLeakerMean(scenario: Scenario): number {
  const { seed, replicates } = runSettings(scenario)
  const thresholds = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
  const tEndS = (sampleCount(scenario) - 1) * DT
  let sum = 0
  for (let i = 0; i < replicates; i += 1) {
    const policy = monteCarloPolicy(seed, i, thresholds)
    const assessments = assessAllThreats(scenario, policy)
    const report = resolveEngagements(scenario, assessments, policy)
    sum += liveKpisAt(buildLiveTimeline(assessments, report), tEndS).leakerShips
  }
  return sum / replicates
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
 * numbers), so the swing is a paired difference. Rows sort by swing, largest
 * first; ties keep the `uncertainFields` order. `onProgress` fires after
 * every field with the field count. `elapsedMs` is 0 here; the worker fills it.
 */
export function runSensitivity(
  scenario: Scenario,
  onProgress?: (done: number, total: number) => void,
): SensitivitySummary {
  const { seed, replicates } = runSettings(scenario)
  // Every run is aleatory (the field under test is the only sampled value)
  // and runs every replicate, so the p10 and p90 means pair replicate by replicate.
  const base: Scenario = { ...scenario, uncertainty: 'aleatory', targetHalfWidth: null }
  const fields = uncertainFields(base)
  const nominal = endLeakerMean(base)
  const rows: SensitivityRow[] = []
  fields.forEach((f, k) => {
    const at = (q: number) =>
      endLeakerMean(
        sampleScenario(base, (m, fl) => (m === f.modelId && fl === f.field ? q : null)),
      )
    const low = at(0.1)
    const high = at(0.9)
    rows.push({
      modelId: f.modelId,
      field: f.field,
      label: fieldLabel(base, f.modelId),
      low,
      high,
      swing: Math.abs(high - low),
    })
    onProgress?.(k + 1, fields.length)
  })
  // A stable sort: ties keep the uncertainFields order.
  rows.sort((a, b) => b.swing - a.swing)
  return { stat: 'leakers', rows, nominal, replicates, seed, elapsedMs: 0 }
}
