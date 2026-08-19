import type { Entity, Scenario, Vec2 } from '../model/types'
import { dist, pointInSector, posAtTime } from '../geometry/geo'
import { modelFor, pathSpeed, scenarioDurationS } from '../state/store'

export interface LiveTrack {
  entityId: string
  pos: Vec2
  headingDeg: number
  /** False before start delay and after path completion. */
  flying: boolean
  done: boolean
}

/** Positions of all path-flying UAS at sim time t. Entities without paths stay put. */
export function liveTracks(scenario: Scenario, tS: number): Map<string, LiveTrack> {
  const out = new Map<string, LiveTrack>()
  for (const path of scenario.paths) {
    const speed = pathSpeed(scenario, path)
    const s = posAtTime(path.points, speed, path.startDelayS, tS)
    out.set(path.entityId, {
      entityId: path.entityId,
      pos: s.pos,
      headingDeg: s.headingDeg,
      flying: tS >= path.startDelayS && !s.done,
      done: s.done,
    })
  }
  return out
}

export function entityPosAt(scenario: Scenario, entity: Entity, tS: number): Vec2 {
  return liveTracks(scenario, tS).get(entity.id)?.pos ?? entity.pos
}

export interface DetectionHit {
  sensorId: string
  classified: boolean
}

/** Sensors currently holding each UAS: uasId -> hits. */
export function detectionsAt(scenario: Scenario, tS: number): Map<string, DetectionHit[]> {
  const tracks = liveTracks(scenario, tS)
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor')
  const out = new Map<string, DetectionHit[]>()
  for (const uas of scenario.entities) {
    if (uas.kind !== 'uas') continue
    const pos = tracks.get(uas.id)?.pos ?? uas.pos
    const hits: DetectionHit[] = []
    for (const sensor of sensors) {
      const spec = modelFor(scenario, sensor)?.sensor
      if (!spec) continue
      if (pointInSector(sensor.pos, sensor.headingDeg, spec.sectorDeg, spec.detectRangeM, pos)) {
        const classified =
          spec.classifyRangeM != null &&
          pointInSector(sensor.pos, sensor.headingDeg, spec.sectorDeg, spec.classifyRangeM, pos)
        hits.push({ sensorId: sensor.id, classified })
      }
    }
    if (hits.length > 0) out.set(uas.id, hits)
  }
  return out
}

export type ThreatStatus =
  | 'no-path'
  | 'never-detected'
  | 'detect-only'
  | 'no-kill-chain'
  | 'window-too-short'
  | 'engageable'

export interface ThreatAssessment {
  uasId: string
  status: ThreatStatus
  firstDetectS: number | null
  firstDetectSensorId: string | null
  /** Closest approach to the nearest defended asset. */
  assetId: string | null
  arrivalS: number | null
  closestApproachM: number | null
  /** arrival minus first detection; the early-warning buffer. */
  warningS: number | null
  /** Longest usable engagement interval [start, end] against any effector. */
  windowS: [number, number] | null
  windowEffectorId: string | null
}

const DT = 0.5

/** True when some detecting sensor routes through a C2 node to some effector. */
function killChainConnected(scenario: Scenario, sensorIds: Set<string>): boolean {
  const kinds = new Map(scenario.entities.map((e) => [e.id, e.kind]))
  const c2FromSensor = new Set<string>()
  for (const c of scenario.connections) {
    if (sensorIds.has(c.fromId) && kinds.get(c.toId) === 'c2') c2FromSensor.add(c.toId)
  }
  // Allow direct sensor -> effector links for architectures without a C2 hop.
  for (const c of scenario.connections) {
    if (sensorIds.has(c.fromId) && kinds.get(c.toId) === 'effector') return true
    if (c2FromSensor.has(c.fromId) && kinds.get(c.toId) === 'effector') return true
  }
  return false
}

/** Full timeline analysis of one threat by sampling the scenario at DT steps. */
export function assessThreat(scenario: Scenario, uasId: string): ThreatAssessment {
  const base: ThreatAssessment = {
    uasId,
    status: 'no-path',
    firstDetectS: null,
    firstDetectSensorId: null,
    assetId: null,
    arrivalS: null,
    closestApproachM: null,
    warningS: null,
    windowS: null,
    windowEffectorId: null,
  }
  const path = scenario.paths.find((p) => p.entityId === uasId)
  if (!path || path.points.length < 2) return base

  const speed = pathSpeed(scenario, path)
  const duration = scenarioDurationS(scenario)
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor')
  const assets = scenario.entities.filter((e) => e.kind === 'asset')
  const effectors = scenario.entities.filter((e) => e.kind === 'effector')

  const detectingSensors = new Set<string>()
  const effectorInRange = new Map<string, Array<[number, number]>>()
  let closest: { assetId: string | null; tS: number | null; distM: number } = {
    assetId: null,
    tS: null,
    distM: Number.POSITIVE_INFINITY,
  }

  for (let t = path.startDelayS; t <= duration; t += DT) {
    const sample = posAtTime(path.points, speed, path.startDelayS, t)
    const pos = sample.pos

    for (const sensor of sensors) {
      const spec = modelFor(scenario, sensor)?.sensor
      if (!spec) continue
      if (pointInSector(sensor.pos, sensor.headingDeg, spec.sectorDeg, spec.detectRangeM, pos)) {
        detectingSensors.add(sensor.id)
        if (base.firstDetectS == null) {
          base.firstDetectS = t
          base.firstDetectSensorId = sensor.id
        }
      }
    }

    for (const asset of assets) {
      const d = dist(pos, asset.pos)
      if (d < closest.distM) closest = { assetId: asset.id, tS: t, distM: d }
    }

    for (const eff of effectors) {
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      const d = dist(pos, eff.pos)
      const inRange = d >= spec.minRangeM && d <= spec.maxRangeM
      const intervals = effectorInRange.get(eff.id) ?? []
      const last = intervals[intervals.length - 1]
      if (inRange) {
        if (last && Math.abs(last[1] - (t - DT)) < DT / 2) last[1] = t
        else intervals.push([t, t])
        effectorInRange.set(eff.id, intervals)
      }
    }

    if (sample.done) break
  }

  if (closest.assetId != null) {
    base.assetId = closest.assetId
    base.arrivalS = closest.tS
    base.closestApproachM = closest.distM
  }
  if (base.firstDetectS != null && base.arrivalS != null) {
    base.warningS = base.arrivalS - base.firstDetectS
  }

  // Best usable window: starts no earlier than first detection.
  const detectS = base.firstDetectS
  if (detectS != null) {
    let bestLen = 0
    for (const eff of effectors) {
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      for (const [s0, s1] of effectorInRange.get(eff.id) ?? []) {
        const start = Math.max(s0, detectS)
        const len = s1 - start
        if (len > bestLen) {
          bestLen = len
          base.windowS = [start, s1]
          base.windowEffectorId = eff.id
        }
      }
    }
  }

  if (base.firstDetectS == null) {
    base.status = 'never-detected'
  } else if (effectors.length === 0) {
    base.status = 'detect-only'
  } else if (!killChainConnected(scenario, detectingSensors)) {
    base.status = 'no-kill-chain'
  } else {
    const eff = base.windowEffectorId
      ? scenario.entities.find((e) => e.id === base.windowEffectorId)
      : null
    const engageTime = (eff && modelFor(scenario, eff)?.effector?.engageTimeS) ?? 0
    const winLen = base.windowS ? base.windowS[1] - base.windowS[0] : 0
    base.status = base.windowS && winLen >= engageTime ? 'engageable' : 'window-too-short'
  }
  return base
}

export function assessAllThreats(scenario: Scenario): ThreatAssessment[] {
  return scenario.entities.filter((e) => e.kind === 'uas').map((e) => assessThreat(scenario, e.id))
}
