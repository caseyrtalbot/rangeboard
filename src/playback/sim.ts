import type { Entity, Scenario, SensorSpec, SensorType, UasSpec, Vec2 } from '../model/types'
import { entityActive } from '../model/types'
import { dist, formationOffsets, pointInSector, posAtTime } from '../geometry/geo'
import { modelFor, pathSpeed, scenarioDurationS } from '../state/store'
import {
  effectiveClassifyRangeM,
  effectiveDetectRangeM,
  jammable,
  rfDetectable,
} from '../analysis/sensorEnv'

/** Positions of every ship in the entity's formation (just the lead when none). */
export function memberPositions(entity: Entity, pos: Vec2, headingDeg: number): Vec2[] {
  const f = entity.formation
  if (!f || f.count <= 1) return [pos]
  return formationOffsets(f.shape, f.count, f.spacingM, headingDeg).map((o) => ({
    x: pos.x + o.x,
    y: pos.y + o.y,
  }))
}

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
  sensorType: SensorType
  classified: boolean
  /** False when the formation spacing is below the sensor's track resolution. */
  resolved: boolean
}

/**
 * One sensor's hit on one threat at an instant, or null.
 * Applies environment derates, radar target-size scaling, and RF silence.
 * EO/IR sensors need a cue: pass cued=false to suppress them.
 */
function sensorHit(
  sensor: Entity,
  spec: SensorSpec,
  scenario: Scenario,
  uas: Entity,
  uasSpec: UasSpec | undefined,
  members: Vec2[],
  cued: boolean,
): DetectionHit | null {
  if (spec.sensorType === 'eo-ir' && !cued) return null
  if (spec.sensorType === 'rf' && uasSpec && !rfDetectable(uasSpec)) return null
  const env = scenario.environment
  const detectR = effectiveDetectRangeM(spec, env, uasSpec?.group)
  const inDetect = members.some((m) =>
    pointInSector(sensor.pos, sensor.headingDeg, spec.sectorDeg, detectR, m),
  )
  if (!inDetect) return null
  const classifyR = effectiveClassifyRangeM(spec, env, uasSpec?.group)
  const classified =
    classifyR != null &&
    members.some((m) => pointInSector(sensor.pos, sensor.headingDeg, spec.sectorDeg, classifyR, m))
  const f = uas.formation
  const resolved = !(f && f.count > 1 && spec.resolutionM != null && f.spacingM < spec.resolutionM)
  return { sensorId: sensor.id, sensorType: spec.sensorType, classified, resolved }
}

/**
 * Sensors currently holding each UAS: uasId -> hits.
 * EO/IR cameras only hold targets another technology already holds
 * (COURAGEOUS: narrow-FOV cameras verify and track cued targets, they do not
 * search).
 */
export function detectionsAt(scenario: Scenario, tS: number): Map<string, DetectionHit[]> {
  const tracks = liveTracks(scenario, tS)
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e))
  const out = new Map<string, DetectionHit[]>()
  for (const uas of scenario.entities) {
    if (uas.kind !== 'uas' || !entityActive(uas)) continue
    const track = tracks.get(uas.id)
    const pos = track?.pos ?? uas.pos
    const heading = track?.headingDeg ?? uas.headingDeg
    const members = memberPositions(uas, pos, heading)
    const uasSpec = modelFor(scenario, uas)?.uas
    const hits: DetectionHit[] = []
    for (const pass of ['search', 'cued'] as const) {
      for (const sensor of sensors) {
        const spec = modelFor(scenario, sensor)?.sensor
        if (!spec) continue
        const isEo = spec.sensorType === 'eo-ir'
        if (pass === 'search' ? isEo : !isEo) continue
        const hit = sensorHit(sensor, spec, scenario, uas, uasSpec, members, hits.length > 0)
        if (hit) hits.push(hit)
      }
    }
    if (hits.length > 0) out.set(uas.id, hits)
  }
  return out
}

export type ThreatStatus =
  | 'no-path'
  | 'never-detected'
  | 'not-confirmed'
  | 'detect-only'
  | 'no-kill-chain'
  | 'window-too-short'
  | 'engageable'

export interface ThreatAssessment {
  uasId: string
  status: ThreatStatus
  firstDetectS: number | null
  firstDetectSensorId: string | null
  /** First moment two different technologies held the track at once. */
  firstConfirmS: number | null
  /** Technologies that detected the threat at any time. */
  techs: SensorType[]
  /** True when a formation was detected but no detecting sensor could split it. */
  swarmMerged: boolean
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
  // Disabled entities drop out of the chain entirely.
  const kinds = new Map(scenario.entities.filter(entityActive).map((e) => [e.id, e.kind]))
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
    firstConfirmS: null,
    techs: [],
    swarmMerged: false,
    assetId: null,
    arrivalS: null,
    closestApproachM: null,
    warningS: null,
    windowS: null,
    windowEffectorId: null,
  }
  const path = scenario.paths.find((p) => p.entityId === uasId)
  if (!path || path.points.length < 2) return base

  const uas = scenario.entities.find((e) => e.id === uasId)
  if (!uas) return base
  const uasSpec = modelFor(scenario, uas)?.uas
  const speed = pathSpeed(scenario, path)
  const duration = scenarioDurationS(scenario)
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e))
  const assets = scenario.entities.filter((e) => e.kind === 'asset')
  // Jammers cannot affect RF-silent, non-GNSS threats (fiber, inertial, optical).
  const effectors = scenario.entities.filter((e) => {
    if (e.kind !== 'effector' || !entityActive(e)) return false
    const spec = modelFor(scenario, e)?.effector
    if (spec?.effectorType === 'jammer' && uasSpec && !jammable(uasSpec)) return false
    return true
  })

  const detectingSensors = new Set<string>()
  const techsSeen = new Set<SensorType>()
  const effectorInRange = new Map<string, Array<[number, number]>>()
  const hasFormation = !!uas.formation && uas.formation.count > 1
  let anyResolved = false
  let closest: { assetId: string | null; tS: number | null; distM: number } = {
    assetId: null,
    tS: null,
    distM: Number.POSITIVE_INFINITY,
  }

  for (let t = path.startDelayS; t <= duration; t += DT) {
    const sample = posAtTime(path.points, speed, path.startDelayS, t)
    const pos = sample.pos
    const members = memberPositions(uas, pos, sample.headingDeg)

    const stepTechs = new Set<SensorType>()
    for (const pass of ['search', 'cued'] as const) {
      for (const sensor of sensors) {
        const spec = modelFor(scenario, sensor)?.sensor
        if (!spec) continue
        const isEo = spec.sensorType === 'eo-ir'
        if (pass === 'search' ? isEo : !isEo) continue
        const hit = sensorHit(sensor, spec, scenario, uas, uasSpec, members, stepTechs.size > 0)
        if (!hit) continue
        stepTechs.add(hit.sensorType)
        detectingSensors.add(sensor.id)
        if (hit.resolved) anyResolved = true
        if (base.firstDetectS == null) {
          base.firstDetectS = t
          base.firstDetectSensorId = sensor.id
        }
      }
    }
    for (const tech of stepTechs) techsSeen.add(tech)
    if (base.firstConfirmS == null && stepTechs.size >= 2) base.firstConfirmS = t

    for (const asset of assets) {
      const d = dist(pos, asset.pos)
      if (d < closest.distM) closest = { assetId: asset.id, tS: t, distM: d }
    }

    for (const eff of effectors) {
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      const d = dist(pos, eff.pos)
      const inRange =
        d >= spec.minRangeM &&
        pointInSector(eff.pos, eff.headingDeg, spec.sectorDeg ?? 360, spec.maxRangeM, pos)
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

  base.techs = [...techsSeen]
  base.swarmMerged = hasFormation && base.firstDetectS != null && !anyResolved
  if (closest.assetId != null) {
    base.assetId = closest.assetId
    base.arrivalS = closest.tS
    base.closestApproachM = closest.distM
  }
  if (base.firstDetectS != null && base.arrivalS != null) {
    base.warningS = base.arrivalS - base.firstDetectS
  }

  // Engagements start no earlier than the required track quality.
  const policy = scenario.engageOn ?? 'detected'
  const gateS = policy === 'confirmed' ? base.firstConfirmS : base.firstDetectS
  if (gateS != null) {
    let bestLen = 0
    for (const eff of effectors) {
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      for (const [s0, s1] of effectorInRange.get(eff.id) ?? []) {
        const start = Math.max(s0, gateS)
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
  } else if (policy === 'confirmed' && base.firstConfirmS == null) {
    base.status = 'not-confirmed'
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
  return scenario.entities
    .filter((e) => e.kind === 'uas' && entityActive(e))
    .map((e) => assessThreat(scenario, e.id))
}
