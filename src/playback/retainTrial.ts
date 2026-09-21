import type { SensorType } from '../model/types'
import type { SensorHoldGate } from '../analysis/sensorEnv'
import type { SensorScanObservation } from './detection'
import type { ThreatAssessment } from './sim'
import type { TrackEstimate } from './trackTypes'
import type { TrialResult } from './trialTypes'

/**
 * Page retention of one trial. The engine return stays complete. The copy the
 * store keeps drops per-step fused tracks (the ledger is already resolved),
 * keeps scan records in typed buffers that still export the same objects, and
 * keeps the estimate fields the board ellipse reads.
 */

const SENSOR_TYPES: readonly SensorType[] = ['radar', 'eo-ir', 'acoustic', 'rf']
const GATES: readonly SensorHoldGate[] = ['ok', 'needs-cue', 'rf-silent', 'rf-band', 'no-range']
const NO_SENSOR_IDS: string[] = []
const releases = new WeakMap<object, () => void>()
const retainedResults = new WeakSet<TrialResult>()

function isObservationLedger(observations: readonly SensorScanObservation[]): boolean {
  return releases.has(observations)
}

/** Same records as `observations`, without one object per scan and member. */
function observationLedger(
  observations: readonly SensorScanObservation[],
): SensorScanObservation[] {
  const count = observations.length
  const uasTable: string[] = []
  const sensorTable: string[] = []
  const uasOf = new Map<string, number>()
  const sensorOf = new Map<string, number>()
  const intern = (table: string[], map: Map<string, number>, value: string) => {
    const hit = map.get(value)
    if (hit != null) return hit
    const id = table.length
    table.push(value)
    map.set(value, id)
    return id
  }
  let members = 0
  for (const observation of observations) members += observation.members.length
  let uas = new Uint32Array(count)
  let sensor = new Uint32Array(count)
  let sensorType = new Uint8Array(count)
  let gate = new Uint8Array(count)
  let flags = new Uint8Array(count)
  let tS = new Float64Array(count)
  let memberStart = new Uint32Array(count)
  let memberLength = new Uint32Array(count)
  let memberIdx = new Uint32Array(members)
  let drawIndex = new Uint32Array(members)
  let slantM = new Float64Array(members)
  let pd = new Float64Array(members)
  let memberFlags = new Uint8Array(members)
  let cursor = 0
  for (let i = 0; i < count; i += 1) {
    const observation = observations[i]
    const type = SENSOR_TYPES.indexOf(observation.sensorType)
    const hold = GATES.indexOf(observation.gate)
    if (type < 0 || hold < 0) throw new Error('Invalid retained trial scan')
    uas[i] = intern(uasTable, uasOf, observation.uasId)
    sensor[i] = intern(sensorTable, sensorOf, observation.sensorId)
    sensorType[i] = type
    gate[i] = hold
    flags[i] = (observation.cued ? 1 : 0) | (observation.resolved ? 2 : 0)
    tS[i] = observation.tS
    memberStart[i] = cursor
    memberLength[i] = observation.members.length
    for (const member of observation.members) {
      memberIdx[cursor] = member.memberIdx
      drawIndex[cursor] = member.drawIndex
      slantM[cursor] = member.slantM
      pd[cursor] = member.pd == null ? Number.NaN : member.pd
      memberFlags[cursor] = (member.detected ? 1 : 0) | (member.classified ? 2 : 0)
      cursor += 1
    }
  }
  const target: SensorScanObservation[] = []
  target.length = count
  let released = false
  const materialize = (index: number): SensorScanObservation => {
    const start = memberStart[index]
    const rows = memberLength[index]
    const scanMembers = []
    for (let k = 0; k < rows; k += 1) {
      const at = start + k
      const probability = pd[at]
      scanMembers.push({
        memberIdx: memberIdx[at],
        drawIndex: drawIndex[at],
        slantM: slantM[at],
        pd: Number.isNaN(probability) ? null : probability,
        detected: (memberFlags[at] & 1) !== 0,
        classified: (memberFlags[at] & 2) !== 0,
      })
    }
    return {
      uasId: uasTable[uas[index]],
      sensorId: sensorTable[sensor[index]],
      sensorType: SENSOR_TYPES[sensorType[index]],
      tS: tS[index],
      gate: GATES[gate[index]],
      cued: (flags[index] & 1) !== 0,
      resolved: (flags[index] & 2) !== 0,
      members: scanMembers,
    }
  }
  const list = new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const index = Number(prop)
        if (!released && index >= 0 && index < count) return materialize(index)
        return undefined
      }
      if (prop === Symbol.iterator) {
        return function* iterate() {
          const n = released ? 0 : count
          for (let index = 0; index < n; index += 1) yield materialize(index)
        }
      }
      const value = Reflect.get(obj, prop, receiver)
      return typeof value === 'function'
        ? (...args: unknown[]) => value.apply(receiver, args)
        : value
    },
    has(obj, prop) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return !released && Number(prop) < count
      return Reflect.has(obj, prop)
    },
    set() {
      return false
    },
  })
  releases.set(list, () => {
    if (released) return
    released = true
    target.length = 0
    uasTable.length = 0
    sensorTable.length = 0
    uas = new Uint32Array(0)
    sensor = new Uint32Array(0)
    sensorType = new Uint8Array(0)
    gate = new Uint8Array(0)
    flags = new Uint8Array(0)
    tS = new Float64Array(0)
    memberStart = new Uint32Array(0)
    memberLength = new Uint32Array(0)
    memberIdx = new Uint32Array(0)
    drawIndex = new Uint32Array(0)
    slantM = new Float64Array(0)
    pd = new Float64Array(0)
    memberFlags = new Uint8Array(0)
  })
  return list
}

function boundTrack(track: TrackEstimate): TrackEstimate {
  // The board ellipse reads the position block: var(x), cov(x, y), var(y).
  if (track.sensorIds.length === 0 && track.covariance.length === 6) return track
  return {
    ...track,
    sensorIds: NO_SENSOR_IDS,
    covariance: [track.covariance[0], track.covariance[1], 0, 0, 0, track.covariance[5]],
  }
}

function boundAssessment(assessment: ThreatAssessment): ThreatAssessment {
  const { fusedTracks: _fused, sensorObservations, effectorWindows, ...rest } = assessment
  return {
    ...rest,
    ...(sensorObservations ? { sensorObservations: sensorObservations.slice() } : {}),
    effectorWindows: effectorWindows.map((window) => ({
      effectorId: window.effectorId,
      intervals: window.intervals.slice(),
    })),
  }
}

function alreadyBound(result: TrialResult): boolean {
  return (
    isObservationLedger(result.observations) &&
    result.assessments.every((assessment) => assessment.fusedTracks == null) &&
    (result.tracks == null ||
      result.tracks.every((track) => track.sensorIds.length === 0 && track.covariance.length === 6))
  )
}

/** The trial the page stores. A second call returns the same object. */
export function boundRetainedTrial(result: TrialResult): TrialResult {
  if (alreadyBound(result)) return result
  const retained: TrialResult = {
    ...result,
    assessments: result.assessments.map(boundAssessment),
    report: {
      ...result.report,
      events: result.report.events.slice(),
      threats: result.report.threats.slice(),
      effectors: result.report.effectors.slice(),
    },
    observations: isObservationLedger(result.observations)
      ? result.observations
      : observationLedger(result.observations),
    jamDecisions: result.jamDecisions.slice(),
  }
  if (result.tracks) retained.tracks = result.tracks.map(boundTrack)
  retainedResults.add(retained)
  return retained
}

/**
 * Empty the arrays a previous fiber can still see. Call when the store drops
 * this result, including New run, so the buffers become collectable immediately.
 */
export function releaseRetainedTrial(result: TrialResult | null): void {
  // A replaced store value can still share arrays with the trial that replaced
  // it. Only the copy this module built owns those arrays.
  if (!result || !retainedResults.has(result)) return
  releases.get(result.observations)?.()
  if (result.tracks) (result.tracks as TrackEstimate[]).length = 0
  for (const assessment of result.assessments) {
    assessment.fusedTracks = undefined
    if (assessment.sensorObservations) assessment.sensorObservations.length = 0
    assessment.effectorWindows.length = 0
  }
  result.assessments.length = 0
  result.report.events.length = 0
  result.report.threats.length = 0
  result.report.effectors.length = 0
  result.jamDecisions.length = 0
}
