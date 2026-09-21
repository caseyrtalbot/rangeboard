/**
 * Numerical timeline projections on the engine DT grid. Each function answers
 * one named quantity as a number array and knows nothing about chart ids,
 * labels or colors.
 *
 * Grid rule: index i is t = i * DT from t = 0 through `scenarioDurationS`,
 * `sampleCount(scenario)` points, NaN where a quantity is undefined. A held
 * quantity keeps its value from the first grid step at or after the event
 * that set it (`holdFrom`). The sweep grid starts at the path delay, so an
 * off-grid delay puts every observation time between two t = 0 steps;
 * `stepAtOrAfter` is the one rule that places it, shared by the Pd sample
 * and the hold flag so both land on the same step.
 */
import type { Scenario } from '../model/types'
import { scenarioDurationS } from '../model/scenario'
import type { AttritionReport } from '../playback/attritionReport'
import { DT } from '../playback/clock'
import type { SensorObservation, ThreatAssessment } from '../playback/sim'

/** Grid-snap tolerance: an event time a rounding error before a step still lands on it. */
const EPS = 1e-9

/** Sample count on the DT grid from t = 0 through scenarioDurationS: ceil(duration / DT) + 1. */
export function sampleCount(scenario: Scenario): number {
  return Math.ceil(scenarioDurationS(scenario) / DT) + 1
}

/** A fresh grid of NaN. */
export function nanGrid(n: number): number[] {
  return new Array<number>(n).fill(Number.NaN)
}

/** First grid index whose time is at or after tS; 0 for a negative time. */
export function stepAtOrAfter(tS: number): number {
  return Math.max(0, Math.ceil(tS / DT - EPS))
}

/** Hold `value` from the step at or after tS to the end of the grid. */
export function holdFrom(values: number[], tS: number, value: number): void {
  for (let i = stepAtOrAfter(tS); i < values.length; i += 1) values[i] = value
}

/**
 * Ships alive per step: the ship count, stepping down by killDelta at each
 * kill event's effect time.
 */
export function residualOnGrid(report: AttritionReport, uasId: string, n: number): number[] {
  const shipCount = report.threats.find((x) => x.uasId === uasId)?.shipCount ?? 1
  const residual = new Array<number>(n).fill(shipCount)
  const effects = report.events
    .filter((ev) => ev.uasId === uasId && ev.killDelta > 0)
    .sort((x, y) => x.tEffectS - y.tEffectS)
  let landed = 0
  for (const ev of effects) {
    landed += ev.killDelta
    holdFrom(residual, ev.tEffectS, shipCount - landed)
  }
  return residual
}

/**
 * Single-scan Pd on the t = 0 grid, null for an observation without a
 * `pdSeries`. `pdSeries[k]` sits at `pdSeriesStartS + k * DT` (the first scan
 * taken; `firstDetectS` for a radar with no scan model); NaN before that step
 * and after the series ends.
 */
export function pdOnGrid(obs: SensorObservation, n: number): number[] | null {
  if (!obs.pdSeries) return null
  const values = nanGrid(n)
  const offset = stepAtOrAfter(obs.pdSeriesStartS ?? obs.firstDetectS)
  obs.pdSeries.forEach((pd, k) => {
    const i = offset + k
    if (i >= 0 && i < n) values[i] = pd
  })
  return values
}

/** 0/1 hold flag per step: 1 inside any of the observation's inclusive intervals, coasts included. */
export function heldOnGrid(obs: SensorObservation, n: number): number[] {
  const values = new Array<number>(n).fill(0)
  for (const [startS, endS] of obs.intervals) {
    const last = Math.min(n - 1, Math.floor(endS / DT + EPS))
    for (let i = stepAtOrAfter(startS); i <= last; i += 1) values[i] = 1
  }
  return values
}

/** The observations of `a` taken by a sensor in `enabledSensorIds`. */
function enabledObservations(
  a: ThreatAssessment,
  enabledSensorIds: Set<string>,
): SensorObservation[] {
  return (a.sensorObservations ?? []).filter((obs) => enabledSensorIds.has(obs.sensorId))
}

/**
 * Held-track union: 0/1 per step, 1 where at least one enabled sensor's hold
 * flag (`heldOnGrid`) is 1. Null when no enabled sensor observed the track.
 */
export function heldUnionOnGrid(
  a: ThreatAssessment,
  enabledSensorIds: Set<string>,
  n: number,
): number[] | null {
  const observations = enabledObservations(a, enabledSensorIds)
  if (observations.length === 0) return null
  const union = new Array<number>(n).fill(0)
  for (const obs of observations) {
    heldOnGrid(obs, n).forEach((flag, i) => {
      if (flag === 1) union[i] = 1
    })
  }
  return union
}

/** Tracks held per step: the count of tracks whose held-track union is 1. Zeros, never NaN. */
export function heldTracksOnGrid(
  tracks: ThreatAssessment[],
  enabledSensorIds: Set<string>,
  n: number,
): number[] {
  const counts = new Array<number>(n).fill(0)
  for (const a of tracks) {
    const union = heldUnionOnGrid(a, enabledSensorIds, n)
    if (!union) continue
    for (let i = 0; i < n; i += 1) if (union[i] === 1) counts[i] += 1
  }
  return counts
}

const finite = (v: number | undefined): v is number => v != null && Number.isFinite(v)

/**
 * Mean Pd of held tracks per step: over the tracks whose held-track union is
 * 1 at step i, take per track the largest finite single-scan Pd among the
 * enabled sensors that observed it, then the mean over tracks; NaN when no
 * held track has a finite Pd at that step.
 */
export function meanHeldPdOnGrid(
  tracks: ThreatAssessment[],
  enabledSensorIds: Set<string>,
  n: number,
): number[] {
  const held: number[][] = []
  const pd: number[][][] = []
  for (const a of tracks) {
    const union = heldUnionOnGrid(a, enabledSensorIds, n)
    if (!union) continue
    held.push(union)
    pd.push(
      enabledObservations(a, enabledSensorIds)
        .map((obs) => pdOnGrid(obs, n))
        .filter((values): values is number[] => values != null),
    )
  }
  const meanPd = nanGrid(n)
  for (let i = 0; i < n; i += 1) {
    let pdSum = 0
    let pdCount = 0
    held.forEach((union, k) => {
      if (union[i] !== 1) return
      let best = Number.NaN
      for (const values of pd[k]) {
        const v = values[i]
        if (finite(v) && (!finite(best) || v > best)) best = v
      }
      if (finite(best)) {
        pdSum += best
        pdCount += 1
      }
    })
    if (pdCount > 0) meanPd[i] = pdSum / pdCount
  }
  return meanPd
}
