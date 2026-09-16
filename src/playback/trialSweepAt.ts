import type { TrialResultView } from '../analysis/trialResult'
import type { SensorScanObservation, DetectionHit } from './detection'
import type { SensorObservation } from './sim'
import { effectorStatesAt, trialShotTimelineOf } from './trackState'
import type { EffectorLiveState } from './trackState'

export interface TrialSensorState {
  threatId: string
  sensorId: string
  stateAtTime: 'measured' | 'held-between-scans' | 'coasting' | 'not-held'
  lastMeasurementTimeS?: number
  slantRangeM?: number
  pd?: number
  /** Actual admitted decisions only at this scan instant, including misses. */
  observation?: SensorScanObservation
}

export interface TrialSweep {
  timeS: number
  sensors: TrialSensorState[]
  /** Held track files, including coasts; no new detection is implied by this set. */
  holdingSensorIds: Set<string>
  effectorStates: Map<string, EffectorLiveState>
  /** Carried measurement values for existing telemetry adapters; sensors gives their age. */
  hits: Map<string, DetectionHit[]>
}

interface PairIndex {
  threatId: string
  sensorId: string
  scans: SensorScanObservation[]
  measurements: SensorScanObservation[]
  holds: Array<[number, number]>
  coasts: Array<[number, number]>
}
interface SweepIndex {
  pairs: PairIndex[]
  recent: TrialSweep[]
}
const cache = new WeakMap<TrialResultView, SweepIndex>()

function lastAt<T>(items: T[], t: number, timeOf: (item: T) => number): T | undefined {
  let lo = 0
  let hi = items.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (timeOf(items[mid]) <= t) lo = mid + 1
    else hi = mid
  }
  return items[lo - 1]
}

function inInterval(intervals: Array<[number, number]>, t: number): boolean {
  const interval = lastAt(intervals, t, (iv) => iv[0])
  return interval != null && t <= interval[1]
}

function indexOf(view: TrialResultView): SweepIndex {
  const hit = cache.get(view)
  if (hit) return hit
  const pairs = new Map<string, PairIndex>()
  const get = (threatId: string, sensorId: string): PairIndex => {
    const key = JSON.stringify([threatId, sensorId])
    let pair = pairs.get(key)
    if (!pair) {
      pair = { threatId, sensorId, scans: [], measurements: [], holds: [], coasts: [] }
      pairs.set(key, pair)
    }
    return pair
  }
  for (const scan of view.observations) {
    const pair = get(scan.uasId, scan.sensorId)
    pair.scans.push(scan)
    if (scan.members.some((m) => m.detected)) pair.measurements.push(scan)
  }
  for (const a of view.assessments) {
    for (const observation of a.sensorObservations ?? []) {
      const pair = get(a.uasId, observation.sensorId)
      const sorted = (intervals: SensorObservation['intervals']) =>
        [...intervals].sort((x, y) => x[0] - y[0])
      pair.holds = sorted(observation.intervals)
      pair.coasts = sorted(observation.coastIntervals ?? [])
    }
  }
  for (const pair of pairs.values()) {
    pair.scans.sort((x, y) => x.tS - y.tS)
    pair.measurements.sort((x, y) => x.tS - y.tS)
  }
  const index = { pairs: [...pairs.values()], recent: [] }
  cache.set(view, index)
  return index
}

export function trialSweepAt(view: TrialResultView, horizonS: number): TrialSweep {
  const t = Math.min(Number.isNaN(horizonS) ? 0 : Math.max(0, horizonS), view.observedThroughS)
  const index = indexOf(view)
  const hit = index.recent.find((sweep) => sweep.timeS === t)
  if (hit) return hit
  const holdingSensorIds = new Set<string>()
  const hits = new Map<string, DetectionHit[]>()
  const sensors = index.pairs.map((pair): TrialSensorState => {
    const scan = lastAt(pair.scans, t, (s) => s.tS)
    const measurement = lastAt(pair.measurements, t, (s) => s.tS)
    const member = measurement?.members
      .filter((m) => m.detected)
      .reduce((nearest, m) => (m.slantM < nearest.slantM ? m : nearest))
    const stateAtTime =
      measurement?.tS === t
        ? 'measured'
        : inInterval(pair.coasts, t)
          ? 'coasting'
          : inInterval(pair.holds, t)
            ? 'held-between-scans'
            : 'not-held'
    if (stateAtTime !== 'not-held') {
      holdingSensorIds.add(pair.sensorId)
      if (measurement && member) {
        const list = hits.get(pair.threatId) ?? []
        list.push({
          sensorId: pair.sensorId,
          sensorType: measurement.sensorType,
          classified: measurement.members.some((m) => m.classified),
          resolved: measurement.resolved,
          slantM: member.slantM,
          pd: member.pd,
        })
        hits.set(pair.threatId, list)
      }
    }
    return {
      threatId: pair.threatId,
      sensorId: pair.sensorId,
      stateAtTime,
      ...(measurement ? { lastMeasurementTimeS: measurement.tS } : {}),
      ...(member
        ? { slantRangeM: member.slantM, ...(member.pd != null ? { pd: member.pd } : {}) }
        : {}),
      ...(scan?.tS === t ? { observation: scan } : {}),
    }
  })
  const sweep = {
    timeS: t,
    sensors,
    holdingSensorIds,
    hits,
    effectorStates: effectorStatesAt(trialShotTimelineOf(view.scenario, view.attrition), t),
  }
  index.recent.unshift(sweep)
  if (index.recent.length > 4) index.recent.pop()
  return sweep
}
