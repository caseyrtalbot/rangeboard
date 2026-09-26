import type { SensorType } from '../model/types'
import type { SensorHoldGate } from '../analysis/sensorEnv'
import type { SensorScanObservation } from './detection'
import type { FusedTrackSummary, ThreatAssessment } from './sim'
import { bindHorizonRead } from './trackEstimateView'
import type { FusedTrack, TrackEstimate, TrackSource } from './trackTypes'
import type { TrialResult } from './trialTypes'

/**
 * Page retention of one trial. The engine return stays complete. The copy the
 * store keeps drops per-step fused tracks (the ledger is already resolved)
 * and holds a fused-track summary in their place. Scan records and track
 * estimates stay in typed buffers that still export the same objects; an
 * estimate keeps the fields the board ellipse reads.
 */

const SENSOR_TYPES: readonly SensorType[] = ['radar', 'eo-ir', 'acoustic', 'rf']
const GATES: readonly SensorHoldGate[] = ['ok', 'needs-cue', 'rf-silent', 'rf-band', 'no-range']
const SOURCES: readonly TrackSource[] = ['estimate', 'truth', 'false']
/** Interned `uasId` of a false track, which follows no target. */
const NO_UAS = 0xffffffff
const NO_SENSOR_IDS: string[] = []
const releases = new WeakMap<object, () => void>()
const retainedResults = new WeakSet<TrialResult>()

function isLedger(list: readonly object[]): boolean {
  return releases.has(list)
}

function intern(table: string[], map: Map<string, number>, value: string): number {
  const hit = map.get(value)
  if (hit != null) return hit
  const id = table.length
  table.push(value)
  map.set(value, id)
  return id
}

/**
 * An array of `count` records that `materialize` builds on read, so no object
 * exists per record until a reader asks for it. Release empties the list and
 * runs `drop`, which lets the columns go.
 */
function columnList<T extends object>(
  count: number,
  materialize: (index: number) => T,
  drop: () => void,
): T[] {
  const target: T[] = []
  target.length = count
  let released = false
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
    drop()
  })
  return list
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
  return columnList(count, materialize, () => {
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
}

/**
 * Same estimates as `tracks`, without one object per track and step. Each
 * entry reads back with no sensor ids and the position block of its
 * covariance: var(x), cov(x, y), var(y), which is what the board ellipse
 * draws. The per-id index answers the board's horizon read without a scan.
 */
function trackLedger(tracks: readonly TrackEstimate[]): TrackEstimate[] {
  const count = tracks.length
  const idTable: string[] = []
  const uasTable: string[] = []
  const idOf = new Map<string, number>()
  const uasOf = new Map<string, number>()
  let id = new Uint32Array(count)
  let uas = new Uint32Array(count)
  let x = new Float64Array(count)
  let y = new Float64Array(count)
  let vx = new Float64Array(count)
  let vy = new Float64Array(count)
  let tS = new Float64Array(count)
  let cov0 = new Float64Array(count)
  let cov1 = new Float64Array(count)
  let cov5 = new Float64Array(count)
  let quality = new Float64Array(count)
  let hits = new Uint32Array(count)
  let misses = new Uint32Array(count)
  let flags = new Uint8Array(count)
  for (let i = 0; i < count; i += 1) {
    const track = tracks[i]
    const source = SOURCES.indexOf(track.source)
    if (source < 0) throw new Error('Invalid retained trial track')
    id[i] = intern(idTable, idOf, track.id)
    uas[i] = track.uasId == null ? NO_UAS : intern(uasTable, uasOf, track.uasId)
    x[i] = track.state.x
    y[i] = track.state.y
    vx[i] = track.state.vx
    vy[i] = track.state.vy
    tS[i] = track.state.tS
    cov0[i] = track.covariance[0]
    cov1[i] = track.covariance[1]
    cov5[i] = track.covariance[5]
    quality[i] = track.quality
    hits[i] = track.hits
    misses[i] = track.misses
    flags[i] = (track.coasting ? 1 : 0) | (source << 1)
  }

  // Entries grouped by id: `entries[idStart[k] .. idStart[k + 1])` lists id
  // k's entry indices in append order.
  let idCount = idTable.length
  let idStart = new Uint32Array(idCount + 1)
  for (let i = 0; i < count; i += 1) idStart[id[i] + 1] += 1
  for (let k = 0; k < idCount; k += 1) idStart[k + 1] += idStart[k]
  let entries = new Uint32Array(count)
  const fill = idStart.slice(0, idCount)
  for (let i = 0; i < count; i += 1) {
    entries[fill[id[i]]] = i
    fill[id[i]] += 1
  }
  // The tracker appends each track in time order, so a group is already
  // sorted by tS and its first entry is its first appearance. A hand-built
  // history may not be: then each group is sorted by (tS, append index) and
  // `firstAt` carries the earliest append index within each sorted prefix.
  let firstAt: Uint32Array | null = null
  let ordered = true
  for (let i = 1; i < count && ordered; i += 1) {
    if (id[entries[i]] === id[entries[i - 1]] && tS[entries[i]] < tS[entries[i - 1]])
      ordered = false
  }
  if (!ordered) {
    firstAt = new Uint32Array(count)
    for (let k = 0; k < idCount; k += 1) {
      const group = entries.subarray(idStart[k], idStart[k + 1])
      group.sort((a, b) => tS[a] - tS[b] || a - b)
      let first = group[0]
      for (let n = 0; n < group.length; n += 1) {
        if (group[n] < first) first = group[n]
        firstAt[idStart[k] + n] = first
      }
    }
  }

  const materialize = (index: number): TrackEstimate => ({
    id: idTable[id[index]],
    uasId: uas[index] === NO_UAS ? null : uasTable[uas[index]],
    sensorIds: NO_SENSOR_IDS,
    state: { x: x[index], y: y[index], vx: vx[index], vy: vy[index], tS: tS[index] },
    covariance: [cov0[index], cov1[index], 0, 0, 0, cov5[index]],
    quality: quality[index],
    hits: hits[index],
    misses: misses[index],
    coasting: (flags[index] & 1) !== 0,
    source: SOURCES[flags[index] >> 1],
  })
  const list = columnList(count, materialize, () => {
    idTable.length = 0
    uasTable.length = 0
    idCount = 0
    id = new Uint32Array(0)
    uas = new Uint32Array(0)
    x = new Float64Array(0)
    y = new Float64Array(0)
    vx = new Float64Array(0)
    vy = new Float64Array(0)
    tS = new Float64Array(0)
    cov0 = new Float64Array(0)
    cov1 = new Float64Array(0)
    cov5 = new Float64Array(0)
    quality = new Float64Array(0)
    hits = new Uint32Array(0)
    misses = new Uint32Array(0)
    flags = new Uint8Array(0)
    idStart = new Uint32Array(1)
    entries = new Uint32Array(0)
    firstAt = null
  })
  // The same rows the scan in latestEstimatesAt picks: per id the latest entry
  // at or before the horizon (a tie goes to the later append), ordered by the
  // first append among the entries that pass.
  bindHorizonRead(list, (horizonS) => {
    const first: number[] = []
    const at: number[] = []
    for (let k = 0; k < idCount; k += 1) {
      const start = idStart[k]
      let lo = start
      let hi = idStart[k + 1]
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (tS[entries[mid]] <= horizonS) lo = mid + 1
        else hi = mid
      }
      if (lo === start) continue
      first.push(firstAt ? firstAt[lo - 1] : entries[start])
      at.push(entries[lo - 1])
    }
    const order = first.map((_, n) => n).sort((a, b) => first[a] - first[b])
    return order.map((n) => materialize(at[n]))
  })
  return list
}

/** One pass over the per-step list; the summary holds fresh arrays and objects only. */
function fusedTrackSummary(fusedTracks: readonly FusedTrack[]): FusedTrackSummary {
  const nodes: FusedTrackSummary['nodes'] = []
  const members: FusedTrackSummary['members'] = []
  const seenNodes = new Set<string>()
  const seenSensors = new Set<string>()
  for (const fused of fusedTracks) {
    // '' is NO_C2 (fusion.ts): the sensors fused the track, no node did.
    if (fused.c2Id !== '' && !seenNodes.has(fused.c2Id)) {
      seenNodes.add(fused.c2Id)
      nodes.push({ c2Id: fused.c2Id, fromS: fused.fusedAtS })
    }
    for (const sensorId of fused.sensorIds) {
      if (seenSensors.has(sensorId)) continue
      seenSensors.add(sensorId)
      members.push({ sensorId, fromS: fused.fusedAtS })
    }
  }
  return {
    initAtS: fusedTracks[0].fusedAtS,
    lastAtS: fusedTracks[fusedTracks.length - 1].fusedAtS,
    nodes,
    members,
  }
}

function boundAssessment(assessment: ThreatAssessment): ThreatAssessment {
  const { fusedTracks, sensorObservations, effectorWindows, ...rest } = assessment
  return {
    ...rest,
    // Derived before the per-step list drops out of the retained copy.
    ...(fusedTracks && fusedTracks.length > 0
      ? { fusedTrack: fusedTrackSummary(fusedTracks) }
      : {}),
    ...(sensorObservations ? { sensorObservations: sensorObservations.slice() } : {}),
    effectorWindows: effectorWindows.map((window) => ({
      effectorId: window.effectorId,
      intervals: window.intervals.slice(),
    })),
  }
}

function alreadyBound(result: TrialResult): boolean {
  return (
    isLedger(result.observations) &&
    result.assessments.every((assessment) => assessment.fusedTracks == null) &&
    (result.tracks == null || isLedger(result.tracks))
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
    observations: isLedger(result.observations)
      ? result.observations
      : observationLedger(result.observations),
    jamDecisions: result.jamDecisions.slice(),
  }
  if (result.tracks) {
    retained.tracks = isLedger(result.tracks) ? result.tracks : trackLedger(result.tracks)
  }
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
  if (result.tracks) releases.get(result.tracks)?.()
  for (const assessment of result.assessments) {
    if (assessment.sensorObservations) assessment.sensorObservations.length = 0
    assessment.effectorWindows.length = 0
  }
  result.assessments.length = 0
  result.report.events.length = 0
  result.report.threats.length = 0
  result.report.effectors.length = 0
  result.jamDecisions.length = 0
}
