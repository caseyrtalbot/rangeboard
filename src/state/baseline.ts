import type { Override } from '../model/libraryField'
import type { Scenario } from '../model/types'
import type { BandSeries, IntervalMethod, McSummary, Stat, StopRule } from '../playback/mcRun'
import { invalid, objectAt } from '../io/runtimeValidation'

/**
 * One laydown and its finished ensemble, kept for Compare. View state beside
 * the scenario: it never enters `Scenario`, history or the worker graph, and
 * it persists under its own storage key.
 */
export interface PinnedBaseline {
  /** ISO time of the pin. */
  pinnedAt: string
  label: string
  scenario: Scenario
  mc: McSummary
  /** `analysisBasisSignature` of `scenario` at the pin. */
  scenarioHash: string
  /** The overrides the ensemble applied over the scenario's library (`McState.overrides`). */
  overrides: Override[]
}

/** Scenario name and local pin time, the default label. */
export function defaultBaselineLabel(scenarioName: string, pinnedAt: string): string {
  const time = new Date(pinnedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  return `${scenarioName.trim() || 'Untitled'} · ${time}`
}

export function buildBaseline(
  scenario: Scenario,
  mc: McSummary,
  scenarioHash: string,
  label?: string,
  pinnedAt = new Date().toISOString(),
  overrides: Override[] = [],
): PinnedBaseline {
  return { pinnedAt, label: label?.trim() || defaultBaselineLabel(scenario.name, pinnedAt), scenario, mc, scenarioHash, overrides }
}

const INTERVALS: readonly IntervalMethod[] = ['t', 'wilson', 'rule-of-three', 'none']
const STOP_RULES: readonly StopRule[] = ['replicates', 'halfWidth', 'budget', 'cancelled']

/** JSON has no NaN: an undefined statistic is null on disk and NaN in memory. */
function statistic(value: unknown, path: string): number {
  if (value === null) return NaN
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected a finite number or null')
  return value
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected a finite number')
  return value
}

function literal<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (!allowed.includes(value as T)) invalid(path, `expected one of ${allowed.join(', ')}`)
  return value as T
}

function samples(value: unknown, path: string, length?: number): number[] {
  if (!Array.isArray(value)) invalid(path, 'expected an array')
  if (length != null && value.length !== length) invalid(path, `expected ${length} entries`)
  return value.map((v, i) => statistic(v, `${path}[${i}]`))
}

function stat(value: unknown, path: string): Stat {
  const o = objectAt(value, path)
  const defined = objectAt(o.defined, `${path}.defined`)
  const n = finite(o.n, `${path}.n`)
  const total = finite(o.total, `${path}.total`)
  if (!Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(total) || total < n) invalid(`${path}.n`, 'expected 0 <= n <= total as safe integers')
  return {
    mean: statistic(o.mean, `${path}.mean`), sd: statistic(o.sd, `${path}.sd`), se: statistic(o.se, `${path}.se`),
    lo: statistic(o.lo, `${path}.lo`), hi: statistic(o.hi, `${path}.hi`),
    conf: finite(o.conf, `${path}.conf`), interval: literal(o.interval, INTERVALS, `${path}.interval`),
    p10: statistic(o.p10, `${path}.p10`), p90: statistic(o.p90, `${path}.p90`),
    p025: statistic(o.p025, `${path}.p025`), p975: statistic(o.p975, `${path}.p975`),
    n, total,
    defined: { p: statistic(defined.p, `${path}.defined.p`), lo: statistic(defined.lo, `${path}.defined.lo`), hi: statistic(defined.hi, `${path}.defined.hi`) },
  }
}

function band(value: unknown, path: string, length: number): BandSeries {
  const o = objectAt(value, path)
  const series = (key: keyof BandSeries) => samples(o[key], `${path}.${key}`, length)
  return { mean: series('mean'), lo: series('lo'), hi: series('hi'), p10: series('p10'), p90: series('p90'), p025: series('p025'), p975: series('p975') }
}

/** Engine result maps are plain objects; an inherited property name cannot be a key. */
function record<T>(value: unknown, path: string, entry: (v: unknown, p: string) => T): Record<string, T> {
  const o = objectAt(value, path)
  const out: Record<string, T> = {}
  for (const key of Object.keys(o)) {
    if (!key.trim() || Object.hasOwn(Object.prototype, key)) invalid(`${path}.${key}`, 'reserved or empty ID')
    out[key] = entry(o[key], `${path}.${key}`)
  }
  return out
}

/**
 * Validate a persisted `McSummary` and restore its NaN statistics. Structural,
 * finite and ranged checks; nothing is filled, so a missing field fails.
 */
export function validateMcSummary(value: unknown, path = 'mc'): McSummary {
  const o = objectAt(value, path)
  const durationS = finite(o.durationS, `${path}.durationS`)
  const replicates = finite(o.replicates, `${path}.replicates`)
  if (durationS < 0 || !Number.isSafeInteger(replicates) || replicates < 0) invalid(`${path}.replicates`, 'expected a nonnegative duration and replicate count')
  const kills = band(o.kills, `${path}.kills`, samples(objectAt(o.kills, `${path}.kills`).mean, `${path}.kills.mean`).length)
  const steps = kills.mean.length
  const stopped = objectAt(o.stopped, `${path}.stopped`)
  return {
    seed: finite(o.seed, `${path}.seed`), replicates, durationS,
    kills, leakers: band(o.leakers, `${path}.leakers`, steps), detected: band(o.detected, `${path}.detected`, steps),
    tracked: band(o.tracked, `${path}.tracked`, steps), engaged: band(o.engaged, `${path}.engaged`, steps),
    firstDetectS: stat(o.firstDetectS, `${path}.firstDetectS`), firmTrackS: stat(o.firmTrackS, `${path}.firmTrackS`),
    minWarningS: stat(o.minWarningS, `${path}.minWarningS`),
    perThreat: record(o.perThreat, `${path}.perThreat`, (v, p) => {
      const t = objectAt(v, p)
      const shipCount = finite(t.shipCount, `${p}.shipCount`)
      if (!Number.isSafeInteger(shipCount) || shipCount < 0) invalid(`${p}.shipCount`, 'expected a nonnegative safe integer')
      // Arrival is geometry, not a statistic: null means no arrival and stays null.
      const arrivalS = t.arrivalS === null ? null : finite(t.arrivalS, `${p}.arrivalS`)
      return { killed: stat(t.killed, `${p}.killed`), leaked: stat(t.leaked, `${p}.leaked`), firstDetectS: stat(t.firstDetectS, `${p}.firstDetectS`),
        arrivalS, shipCount, residual: band(t.residual, `${p}.residual`, steps) }
    }),
    perEffector: record(o.perEffector, `${path}.perEffector`, (v, p) => {
      const e = objectAt(v, p)
      return { salvos: stat(e.salvos, `${p}.salvos`), kills: stat(e.kills, `${p}.kills`) }
    }),
    elapsedMs: finite(o.elapsedMs, `${path}.elapsedMs`),
    stopped: { rule: literal(stopped.rule, STOP_RULES, `${path}.stopped.rule`), at: finite(stopped.at, `${path}.stopped.at`) },
    // Slice 3.0 stamps: absent on a summary written before them, so carried only when present.
    ...(o.operatorDecisions !== undefined ? { operatorDecisions: stat(o.operatorDecisions, `${path}.operatorDecisions`) } : {}),
    ...(o.operatorFlooredDecisions !== undefined ? { operatorFlooredDecisions: stat(o.operatorFlooredDecisions, `${path}.operatorFlooredDecisions`) } : {}),
  }
}
