/**
 * The one rule every panel applies before it reads a Monte Carlo summary,
 * and the sub-line formats the tiles share. A summary is current only when
 * the run finished and it belongs to the run id on the playhead; a stale,
 * running or idle slice reads as no summary.
 */
import type {
  BandSeries,
  McSummary,
  SensitivitySummary,
  Stat,
  SweepSummary,
} from '../../playback/mcRun'
import { BAND80_MIN_N, BAND95_MIN_N, STAT_CONF } from '../../playback/mcRun'
import { DT } from '../../playback/clock'
import type { RunRecord } from '../../model/runRecord'
import { createRunManifest } from '../../model/runRecord'
import type { Scenario } from '../../model/types'
import { newId } from '../../model/types'
import { defaultBaselineLabel } from '../../state/baseline'
import type { McState } from '../../state/runState'

/** The summary of a finished run for `runId`, else null. */
export function currentSummary(mc: McState, runId: string): McSummary | null {
  return mc.status === 'done' && mc.runId === runId ? mc.summary : null
}

/**
 * The record Save to history writes for a finished ensemble. Its manifest
 * names the overrides the run applied at launch (`McState.overrides`), never
 * the overrides in force at the save. The caller has checked the run is
 * current and passes the sensitivity companion only when it shares the basis.
 */
export function runRecordOf(
  scenario: Scenario,
  mc: McState,
  runId: string,
  signature: string,
  sensitivity: SensitivitySummary | null,
  savedAt = new Date().toISOString(),
): RunRecord {
  if (mc.summary == null) throw new Error('No finished ensemble to save.')
  return {
    id: newId('run'),
    savedAt,
    label: defaultBaselineLabel(scenario.name, savedAt),
    manifest: createRunManifest(scenario, mc.runId ?? runId, signature, {
      overrides: mc.overrides,
    }),
    scenario,
    scenarioHash: signature,
    mc: mc.summary,
    sensitivity,
  }
}

/** The summary of a finished sweep for `runId`, else null. */
export function currentSweep(mc: McState, runId: string): SweepSummary | null {
  return mc.sweep.status === 'done' && mc.sweep.runId === runId ? mc.sweep.summary : null
}

/** The summary of a finished sensitivity run for `runId`, else null. Same rule. */
export function currentSensitivity(mc: McState, runId: string): SensitivitySummary | null {
  const sens = mc.sensitivity
  return sens.status === 'done' && sens.runId === runId ? sens.summary : null
}

/** A count: an integer when integral, else one decimal. */
export function formatCount(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

/** A finite estimate only; empty bands and undefined time samples stay unavailable. */
export function statMean(stat: Stat): number | null {
  return stat.n > 0 && Number.isFinite(stat.mean) ? stat.mean : null
}

export function bandMean(band: BandSeries, i: number, n: number): number | null {
  return n > 0 && Number.isFinite(band.mean[i]) ? band.mean[i] : null
}

/**
 * Mean CI, never the replicate quantile band, printed as its two ends: a
 * count interval is clamped, Wilson or rule of three, so it is not
 * symmetric about the mean. `scale` converts counts to percentages.
 */
export function countSub(band: BandSeries, i: number, n: number, scale = 1, unit = ''): string {
  if (bandMean(band, i, n) == null) return `MC estimate unavailable · n=${n}`
  if (n < 2) return `MC mean · CI unavailable · n=${n}`
  const lo = band.lo[i] * scale
  const hi = band.hi[i] * scale
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return `MC mean · CI unavailable · n=${n}`
  const conf = Math.round(STAT_CONF * 100)
  return `MC mean · ${formatCount(lo)} to ${formatCount(hi)}${unit} (${conf}% mean CI) · n=${n}`
}

/** Minimum defined replicates before a conditional time mean claims its CI. */
const TIME_CI_MIN_N = 30

/**
 * Undefined samples are excluded: time estimates are conditional on a finite time.
 * The Monte Carlo first detection is the first single-scan hit, so the
 * detected and warning subs name it.
 */
type StatQuantity = 'detected' | 'warning'
const QUANTITY_WORD: Record<StatQuantity, string> = {
  detected: 'detected',
  warning: 'warning time',
}
const QUANTITY_BASIS: Record<StatQuantity, string> = {
  detected: 'first single-scan hit',
  warning: 'arrival minus first single-scan hit',
}

/** The defined fraction's Wilson interval as whole percents. */
function definedSub(stat: Stat, quantity: StatQuantity): string {
  const { lo, hi } = stat.defined
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return `${QUANTITY_WORD[quantity]} in ${stat.n} of ${stat.total} · ${pct(lo)} to ${pct(hi)} (95% Wilson)`
}

export function timeStatSub(stat: Stat, quantity: StatQuantity): string {
  const defined = definedSub(stat, quantity)
  if (statMean(stat) == null) return `MC estimate unavailable · ${defined}`
  const h = (stat.hi - stat.lo) / 2
  const interval =
    stat.n < TIME_CI_MIN_N || !Number.isFinite(h)
      ? `mean CI unavailable under ${TIME_CI_MIN_N} defined`
      : `±${h < 10 ? h.toFixed(1) : Math.round(h)} s (${Math.round(stat.conf * 100)}% mean CI)`
  return `MC conditional mean · ${QUANTITY_BASIS[quantity]} · ${interval} · n=${stat.n} · ${defined}`
}

/** The replicate-quantile bands `replicates` supports, for a chart note. */
export function bandNote(replicates: number): string {
  if (replicates >= BAND95_MIN_N) return '80/95% replicate quantiles'
  if (replicates >= BAND80_MIN_N) {
    return `80% replicate quantiles · 95% band unavailable under ${BAND95_MIN_N} replicates`
  }
  return `bands unavailable under ${BAND80_MIN_N} replicates`
}

/** The band index of sim time t, clamped to the band length. */
export function bandStep(t: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(t / DT)))
}
