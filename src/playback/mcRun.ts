/**
 * Monte Carlo replicate loop. Replicate i seeds `mulberry32(seed + i)`, runs
 * the sweep and the attrition with `monteCarloPolicy`, and records the same
 * per-step counts the live panels read from the deterministic ledger. The
 * summary holds per-step bands and per-replicate scalars, never a replicate
 * ledger. Pure TS, no DOM, no store import at the value level, and it never
 * reads `engagementPicture` (that cache is the deterministic run).
 *
 * The grid is the chart grid: `sampleCount(scenario)` steps at DT from t = 0
 * through `scenarioDurationS`, index k is t = k * DT.
 */
import { mulberry32 } from '../geometry/prng'
import { heldOnGrid, residualOnGrid, sampleCount } from '../analysis/series'
import { buildLiveTimeline, liveKpisAt } from '../analysis/liveStats'
import type { Scenario } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, entityActive, runSettings } from '../model/types'
import { resolveEngagements } from './attrition'
import { monteCarloPolicy } from './policy'
import type { ThreatAssessment } from './sim'
import { assessAllThreats, DT } from './sim'

/** Summary statistics over the finite samples of one quantity. */
export interface Stat {
  /** Over the finite samples. NaN when n is 0. */
  mean: number
  p10: number
  p90: number
  p025: number
  p975: number
  /** Count of finite samples. */
  n: number
}

/** Per DT step from t = 0 to scenarioDurationS inclusive (series.ts sampleCount). */
export interface BandSeries {
  mean: number[]
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
}

/** One run request to the worker: plain JSON, never a store reference. */
export interface McRunRequest {
  type: 'run'
  runId: string
  scenario: Scenario
}

/** Messages the worker posts back, tagged by the run they belong to. */
export type McWorkerMessage =
  | { type: 'progress'; runId: string; done: number; total: number }
  | { type: 'done'; runId: string; summary: McSummary }
  | { type: 'error'; runId: string; message: string }

/**
 * Quantile with linear interpolation between order statistics (type 7), on
 * an ascending array. The formula of src/te/calc/stats.ts `quantile`; copied
 * because src/te/ is a separate workspace and out of this slice's imports.
 */
function quantileSorted(sorted: number[], q: number): number {
  const n = sorted.length
  if (n === 0) return NaN
  const pos = Math.min(Math.max(q, 0), 1) * (n - 1)
  const base = Math.floor(pos)
  const frac = pos - base
  if (base + 1 >= n) return sorted[n - 1]
  return sorted[base] + frac * (sorted[base + 1] - sorted[base])
}

/** Stat over the finite entries of `samples`; all NaN with n 0. */
function statOf(samples: number[]): Stat {
  const sorted = samples.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return { mean: NaN, p10: NaN, p90: NaN, p025: NaN, p975: NaN, n: 0 }
  let sum = 0
  for (const v of sorted) sum += v
  return {
    mean: sum / n,
    p10: quantileSorted(sorted, 0.1),
    p90: quantileSorted(sorted, 0.9),
    p025: quantileSorted(sorted, 0.025),
    p975: quantileSorted(sorted, 0.975),
    n,
  }
}

/** The same Stat per step over `rows` (one row per replicate, one entry per step). */
function bandOf(rows: number[][], n: number): BandSeries {
  const band: BandSeries = { mean: [], p10: [], p90: [], p025: [], p975: [] }
  const column = new Array<number>(rows.length)
  for (let k = 0; k < n; k += 1) {
    for (let i = 0; i < rows.length; i += 1) column[i] = rows[i][k]
    const s = statOf(column)
    band.mean.push(s.mean)
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
 * and summarize them. `onProgress` fires after every 10th replicate and
 * after the last. `elapsedMs` is 0 here; the worker fills it.
 */
export function runReplicates(
  scenario: Scenario,
  onProgress?: (done: number, total: number) => void,
): McSummary {
  const { seed, replicates } = runSettings(scenario)
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

  for (let i = 0; i < replicates; i += 1) {
    const policy = monteCarloPolicy(mulberry32(seed + i), thresholds)
    const assessments = assessAllThreats(scenario, policy)
    const report = resolveEngagements(scenario, assessments, policy)
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
    replicates,
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
  }
}
