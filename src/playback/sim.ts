import type { Entity, Scenario, SensorSpec, SensorType, UasSpec, Vec2 } from '../model/types'
import { defaultSensorRole, entityActive } from '../model/types'
import { dist, formationOffsets, pointInSector, posAtTime } from '../geometry/geo'
import { modelFor, pathSpeed, scenarioDurationS } from '../state/store'
import { effectivePathDelayS } from './raid'
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
    const delayS = effectivePathDelayS(scenario, path)
    const s = posAtTime(path.points, speed, delayS, tS)
    out.set(path.entityId, {
      entityId: path.entityId,
      pos: s.pos,
      headingDeg: s.headingDeg,
      flying: tS >= delayS && !s.done,
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
  /** ROE 'tight' and the track never reached hostile classification. */
  | 'not-confirmed'
  | 'detect-only'
  | 'no-kill-chain'
  /** ROE 'hold': analysis-only posture, no engagement windows. */
  | 'weapons-hold'
  | 'window-too-short'
  | 'engageable'

/**
 * Derived track classification ladder, ported from the PicoGrid drone-swarm
 * track statuses (pending -> unknown -> suspected -> hostile). Never stored;
 * recomputed from the scenario.
 */
export type ThreatClassification = 'pending' | 'unknown' | 'suspected' | 'hostile'

/** Sim time each classification level was first reached; null = never. */
export interface ClassificationTimes {
  unknownAtS: number | null
  suspectedAtS: number | null
  hostileAtS: number | null
}

/** Estimated speed above which an unknown track becomes suspected, kph (source: 50). */
export const SUSPECT_SPEED_KPH = 50

/** Proximity multiple of a connected effector's max range that makes a track suspected. */
export const SUSPECT_RANGE_FACTOR = 1.5

/** Route-intent wording that marks a threat profile as an attack profile. */
export const ATTACK_INTENT_KEYWORDS = ['attack', 'strike', 'raid', 'one-way', 'pgm']

/** True when the model's route intent reads as an attack profile. */
export function isAttackIntent(routeIntent: string | undefined): boolean {
  if (!routeIntent) return false
  const s = routeIntent.toLowerCase()
  return ATTACK_INTENT_KEYWORDS.some((k) => s.includes(k))
}

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
  /**
   * Longest usable interval [start, end] against any connected effector
   * (usable = gated length covers that effector's own engage time). When no
   * interval is usable (window-too-short), carries the longest gated
   * interval as informative geometry.
   */
  windowS: [number, number] | null
  windowEffectorId: string | null
  /** Time each classification level was reached on the derived ladder. */
  classificationAtS: ClassificationTimes
  /** ROE-gated earliest engagement time: free = first detection, tight = hostile, hold = null. */
  engageGateS: number | null
  /** Sensors that detected the threat at any time during the sweep. */
  detectingSensorIds: string[]
  /**
   * Raw in-range intervals per effector, connected or not (DT-sampled,
   * before the track-quality gate). In-range = ANY formation member inside
   * the envelope (min range, max range, sector).
   */
  effectorWindows: Array<{ effectorId: string; intervals: Array<[number, number]> }>
}

const DT = 0.5

/** Effector ids reachable from the given sensors, directly or through one C2 hop. */
export function connectedEffectorIds(scenario: Scenario, sensorIds: Set<string>): Set<string> {
  // Disabled entities drop out of the chain entirely.
  const kinds = new Map(scenario.entities.filter(entityActive).map((e) => [e.id, e.kind]))
  const c2FromSensor = new Set<string>()
  for (const c of scenario.connections) {
    if (sensorIds.has(c.fromId) && kinds.get(c.toId) === 'c2') c2FromSensor.add(c.toId)
  }
  // Allow direct sensor -> effector links for architectures without a C2 hop.
  const out = new Set<string>()
  for (const c of scenario.connections) {
    if (kinds.get(c.toId) !== 'effector') continue
    if (sensorIds.has(c.fromId) || c2FromSensor.has(c.fromId)) out.add(c.toId)
  }
  return out
}

/** True when some detecting sensor routes through a C2 node to some effector. */
function killChainConnected(scenario: Scenario, sensorIds: Set<string>): boolean {
  return connectedEffectorIds(scenario, sensorIds).size > 0
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
    classificationAtS: { unknownAtS: null, suspectedAtS: null, hostileAtS: null },
    engageGateS: null,
    detectingSensorIds: [],
    effectorWindows: [],
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
  // Classification ladder state (PicoGrid executeDetection promotion rules).
  let classification: ThreatClassification = 'pending'
  const clsAt = base.classificationAtS
  const speedKph = speed * 3.6
  const attackIntent = isAttackIntent(modelFor(scenario, uas)?.threatProfile?.routeIntent)
  const hasFormation = !!uas.formation && uas.formation.count > 1
  let anyResolved = false
  let closest: { assetId: string | null; tS: number | null; distM: number } = {
    assetId: null,
    tS: null,
    distM: Number.POSITIVE_INFINITY,
  }

  const delayS = effectivePathDelayS(scenario, path)
  for (let t = delayS; t <= duration; t += DT) {
    const sample = posAtTime(path.points, speed, delayS, t)
    const pos = sample.pos
    const members = memberPositions(uas, pos, sample.headingDeg)

    const stepTechs = new Set<SensorType>()
    let fcClassifiedNow = false
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
        const role = defaultSensorRole(spec)
        if (hit.classified && (role === 'fire-control' || role === 'classification')) {
          fcClassifiedNow = true
        }
        if (base.firstDetectS == null) {
          base.firstDetectS = t
          base.firstDetectSensorId = sensor.id
        }
      }
    }
    for (const tech of stepTechs) techsSeen.add(tech)
    if (base.firstConfirmS == null && stepTechs.size >= 2) base.firstConfirmS = t

    // Promotion rules run only while some sensor holds the track. A track can
    // climb several rungs in one step (e.g. first detected already in range).
    if (stepTechs.size > 0 && classification !== 'hostile') {
      if (classification === 'pending') {
        classification = 'unknown'
        clsAt.unknownAtS = t
      }
      // Proximity is measured to effectors reachable from the sensors that
      // have held the track so far (plain distance, matching the source).
      let nearestRatio = Number.POSITIVE_INFINITY
      const connected = connectedEffectorIds(scenario, detectingSensors)
      for (const eff of effectors) {
        if (!connected.has(eff.id)) continue
        const spec = modelFor(scenario, eff)?.effector
        if (!spec || spec.maxRangeM <= 0) continue
        const ratio = dist(pos, eff.pos) / spec.maxRangeM
        if (ratio < nearestRatio) nearestRatio = ratio
      }
      if (
        classification === 'unknown' &&
        (speedKph > SUSPECT_SPEED_KPH || attackIntent || nearestRatio <= SUSPECT_RANGE_FACTOR)
      ) {
        classification = 'suspected'
        clsAt.suspectedAtS = t
      }
      if (classification === 'suspected' && (nearestRatio <= 1 || fcClassifiedNow)) {
        classification = 'hostile'
        clsAt.hostileAtS = t
      }
    }

    for (const asset of assets) {
      const d = dist(pos, asset.pos)
      if (d < closest.distM) closest = { assetId: asset.id, tS: t, distM: d }
    }

    // A threat is in-range of an effector when ANY formation member is inside
    // the envelope (min range, max range, sector). Effector reach is physical
    // geometry per ship; whether sensors can split the formation
    // (swarmMerged) is a separate track-resolution question.
    for (const eff of effectors) {
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      const inRange = members.some(
        (m) =>
          dist(m, eff.pos) >= spec.minRangeM &&
          pointInSector(eff.pos, eff.headingDeg, spec.sectorDeg ?? 360, spec.maxRangeM, m),
      )
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
  base.detectingSensorIds = [...detectingSensors]
  base.effectorWindows = [...effectorInRange.entries()].map(([effectorId, intervals]) => ({
    effectorId,
    intervals,
  }))
  base.swarmMerged = hasFormation && base.firstDetectS != null && !anyResolved
  if (closest.assetId != null) {
    base.assetId = closest.assetId
    base.arrivalS = closest.tS
    base.closestApproachM = closest.distM
  }
  if (base.firstDetectS != null && base.arrivalS != null) {
    base.warningS = base.arrivalS - base.firstDetectS
  }

  // ROE gates the engagement window start: free = first detection,
  // tight = hostile classification, hold = no engagement at all.
  const roe = scenario.roe ?? 'tight'
  const gateS =
    roe === 'hold' ? null : roe === 'free' ? base.firstDetectS : base.classificationAtS.hostileAtS
  base.engageGateS = gateS
  // A gated interval is USABLE for an effector when its gated length covers
  // that effector's OWN engage time. The longest usable interval wins the
  // windowS slot (ties: first in entity order). When no interval is usable
  // but gated geometry exists, windowS carries the longest gated interval as
  // informative geometry and the status below is window-too-short.
  let anyUsable = false
  if (gateS != null) {
    // Only effectors that can receive a track from the detecting sensors can
    // fire (resolveEngagements uses the same connected set). Unconnected
    // geometry stays available in effectorWindows.
    const connected = connectedEffectorIds(scenario, detectingSensors)
    let bestUsableLen = -1
    let bestGatedLen = 0
    let gatedWindow: [number, number] | null = null
    let gatedEffectorId: string | null = null
    for (const eff of effectors) {
      if (!connected.has(eff.id)) continue
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      const engageTimeS = spec.engageTimeS ?? 0
      for (const [s0, s1] of effectorInRange.get(eff.id) ?? []) {
        const start = Math.max(s0, gateS)
        const len = s1 - start
        if (len < 0) continue
        if (len >= engageTimeS && len > bestUsableLen) {
          bestUsableLen = len
          base.windowS = [start, s1]
          base.windowEffectorId = eff.id
        }
        if (len > bestGatedLen) {
          bestGatedLen = len
          gatedWindow = [start, s1]
          gatedEffectorId = eff.id
        }
      }
    }
    anyUsable = bestUsableLen >= 0
    if (!anyUsable) {
      base.windowS = gatedWindow
      base.windowEffectorId = gatedEffectorId
    }
  }

  if (base.firstDetectS == null) {
    base.status = 'never-detected'
  } else if (effectors.length === 0) {
    base.status = 'detect-only'
  } else if (!killChainConnected(scenario, detectingSensors)) {
    base.status = 'no-kill-chain'
  } else if (roe === 'hold') {
    base.status = 'weapons-hold'
  } else if (roe === 'tight' && base.classificationAtS.hostileAtS == null) {
    base.status = 'not-confirmed'
  } else {
    // Engageable when ANY connected effector has a usable interval; a long
    // window that only fits another effector's engage time must not shadow a
    // shorter window some effector can actually use.
    base.status = anyUsable ? 'engageable' : 'window-too-short'
  }
  return base
}

export function assessAllThreats(scenario: Scenario): ThreatAssessment[] {
  return scenario.entities
    .filter((e) => e.kind === 'uas' && entityActive(e))
    .map((e) => assessThreat(scenario, e.id))
}
