import type { Entity, Scenario, SensorSpec, SensorType, UasSpec, Vec2 } from '../model/types'
import { defaultSensorRole, entityActive } from '../model/types'
import { profileFor } from '../model/integration'
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
 * Two-pass sensor sweep over one threat position set: search sensors
 * (everything but EO/IR) first, then cued EO/IR, which only hold when an
 * earlier hit in the same sweep provides the cue (COURAGEOUS: narrow-FOV
 * cameras verify and track cued targets, they do not search). One place owns
 * the pass order and the cued flag; detectionsAt, assessThreat, and
 * spawnInRingViolations all sweep through here.
 */
function sweepSensorHits(
  scenario: Scenario,
  sensors: Entity[],
  uas: Entity,
  uasSpec: UasSpec | undefined,
  members: Vec2[],
): Array<{ spec: SensorSpec; hit: DetectionHit }> {
  const out: Array<{ spec: SensorSpec; hit: DetectionHit }> = []
  for (const pass of ['search', 'cued'] as const) {
    for (const sensor of sensors) {
      const spec = modelFor(scenario, sensor)?.sensor
      if (!spec) continue
      const isEo = spec.sensorType === 'eo-ir'
      if (pass === 'search' ? isEo : !isEo) continue
      const hit = sensorHit(sensor, spec, scenario, uas, uasSpec, members, out.length > 0)
      if (hit) out.push({ spec, hit })
    }
  }
  return out
}

/**
 * Sensors currently holding each UAS: uasId -> hits.
 * EO/IR cameras only hold targets another technology already holds (the
 * sweepSensorHits cue rule).
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
    const hits = sweepSensorHits(scenario, sensors, uas, uasSpec, members).map((s) => s.hit)
    if (hits.length > 0) out.set(uas.id, hits)
  }
  return out
}

/** One threat whose path starts inside one sensor's effective detect ring. */
export interface SpawnViolation {
  uasId: string
  sensorId: string
}

/**
 * Threats whose flight path STARTS inside a sensor's effective detect ring:
 * the track is held at T0, so under ROE free it is engaged at T0 and the run
 * never exercises the search problem. The raid builder clears spawn points at
 * commit time, but sensors move or get added afterward, delays change, and
 * hand-drawn paths get no standoff at all, so this is derived live from the
 * scenario and never stored. Uses the same per-sensor rules as sensorHit at
 * path.points[0] (lead position; formation offsets are ignored): environment
 * derates, radar target-size scaling, sector wedges, RF silence, and the
 * EO/IR cue rule (an EO/IR-only hold is not a violation).
 */
export function spawnInRingViolations(scenario: Scenario): SpawnViolation[] {
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e))
  const out: SpawnViolation[] = []
  for (const uas of scenario.entities) {
    if (uas.kind !== 'uas' || !entityActive(uas)) continue
    const start = scenario.paths.find((p) => p.entityId === uas.id)?.points[0]
    if (!start) continue
    const uasSpec = modelFor(scenario, uas)?.uas
    for (const { hit } of sweepSensorHits(scenario, sensors, uas, uasSpec, [start])) {
      out.push({ uasId: uas.id, sensorId: hit.sensorId })
    }
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
  /** Routes exist but every routed fc-uplink effector lacks its fire-control sensor. */
  | 'no-fc-uplink'
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

/**
 * One effector's best kill-chain route from the detecting sensors.
 * latencyS is the minimum summed edge latency over every valid path.
 */
export interface KillChainRoute {
  effectorId: string
  latencyS: number
  /** C2 entities on the min-latency path, in hop order (empty for direct/standalone). */
  viaC2Ids: string[]
  /**
   * Detecting sensors on any valid path that satisfy the effector's
   * fire-control uplink: profile fcSources, or a researched fc-uplink pairing
   * with the effector. A cue-role pairing is NOT fire control (TPQ-50 cues
   * Coyote inside FS-LIDS but cannot close the engagement).
   */
  fcSourceIds: string[]
  /**
   * True when every valid path is fully typed (researched links only): the
   * profile's fc-uplink gate binds. Any untyped hand-drawn edge — or a
   * standalone effector's own-radar path — keeps legacy semantics.
   */
  typed: boolean
}

/** C2-to-C2 interop hops a route may traverse (interop is mutual: both directions). */
const MAX_C2_HOPS = 2


/**
 * Kill-chain routing graph over active entities. Paths run sensor -> effector
 * direct, or sensor -> c2 (-> c2, up to MAX_C2_HOPS interop hops) -> effector;
 * sensor->c2 and c2->effector edges keep their stored direction, c2-c2 edges
 * traverse both ways. Edge latency is the connection's latencyS (absent = 0).
 * A fully typed path to an effector whose profile sets requiredC2 only counts
 * when a qualifying C2 sits on it — a failing path is no path at all.
 * Standalone effectors (own radar / operator-aimed) always get a zero-latency
 * route with no via.
 */
export function killChainRoutes(scenario: Scenario, sensorIds: Set<string>): Map<string, KillChainRoute> {
  // Disabled entities drop out of the chain entirely.
  const active = scenario.entities.filter(entityActive)
  const byId = new Map(active.map((e) => [e.id, e]))

  interface Edge {
    toId: string
    latencyS: number
    typed: boolean
  }
  const out = new Map<string, Edge[]>()
  const c2Adj = new Map<string, Edge[]>()
  const push = (m: Map<string, Edge[]>, key: string, e: Edge) => {
    const list = m.get(key)
    if (list) list.push(e)
    else m.set(key, [e])
  }
  for (const c of scenario.connections) {
    const from = byId.get(c.fromId)
    const to = byId.get(c.toId)
    if (!from || !to) continue
    const latencyS = c.latencyS ?? 0
    const typed = c.confidence != null
    if (from.kind === 'c2' && to.kind === 'c2') {
      push(c2Adj, c.fromId, { toId: c.toId, latencyS, typed })
      push(c2Adj, c.toId, { toId: c.fromId, latencyS, typed })
    } else {
      push(out, c.fromId, { toId: c.toId, latencyS, typed })
    }
  }

  interface Scratch {
    latencyS: number
    viaC2Ids: string[]
    fcSourceIds: Set<string>
    /** Stays true only while EVERY recorded path is fully typed. */
    typed: boolean
  }
  const best = new Map<string, Scratch>()

  const record = (
    sensor: Entity,
    effectorId: string,
    latencyS: number,
    viaC2Ids: string[],
    pathTyped: boolean,
  ) => {
    const effSpecId = byId.get(effectorId)?.specId ?? null
    const profile = profileFor(effSpecId)
    // requiredC2 gate binds on fully typed paths only.
    if (pathTyped && profile?.requiredC2?.length) {
      const satisfied = viaC2Ids.some((id) => {
        const specId = byId.get(id)?.specId
        return specId != null && profile.requiredC2!.includes(specId)
      })
      if (!satisfied) return
    }
    let s = best.get(effectorId)
    if (!s) {
      s = { latencyS, viaC2Ids, fcSourceIds: new Set(), typed: pathTyped }
      best.set(effectorId, s)
    } else {
      if (latencyS < s.latencyS) {
        s.latencyS = latencyS
        s.viaC2Ids = viaC2Ids
      }
      s.typed = s.typed && pathTyped
    }
    const fcMatch =
      sensor.specId != null &&
      (profile?.fcSources?.includes(sensor.specId) ||
        profile?.pairs.some(
          (p) => p.withSpecId === sensor.specId && p.role === 'fc-uplink',
        ) ||
        profileFor(sensor.specId)?.pairs.some(
          (p) => p.withSpecId === effSpecId && p.role === 'fc-uplink',
        ))
    if (fcMatch) s.fcSourceIds.add(sensor.id)
  }

  const walkC2 = (sensor: Entity, chain: string[], latencyS: number, typed: boolean) => {
    const last = chain[chain.length - 1]
    for (const e of out.get(last) ?? []) {
      if (byId.get(e.toId)?.kind === 'effector') {
        record(sensor, e.toId, latencyS + e.latencyS, chain, typed && e.typed)
      }
    }
    if (chain.length > MAX_C2_HOPS) return
    for (const e of c2Adj.get(last) ?? []) {
      if (chain.includes(e.toId)) continue
      walkC2(sensor, [...chain, e.toId], latencyS + e.latencyS, typed && e.typed)
    }
  }

  for (const sensorId of sensorIds) {
    const sensor = byId.get(sensorId)
    if (!sensor || sensor.kind !== 'sensor') continue
    for (const e of out.get(sensorId) ?? []) {
      const next = byId.get(e.toId)
      if (next?.kind === 'effector') record(sensor, e.toId, e.latencyS, [], e.typed)
      else if (next?.kind === 'c2') walkC2(sensor, [e.toId], e.latencyS, e.typed)
    }
  }

  // Standalone effectors complete their role with zero connections: their
  // own-radar path is a zero-latency legacy route that wins any latency race.
  for (const e of active) {
    if (e.kind !== 'effector' || !profileFor(e.specId)?.standalone) continue
    const s = best.get(e.id)
    if (s) {
      s.latencyS = 0
      s.viaC2Ids = []
      s.typed = false
    } else {
      best.set(e.id, { latencyS: 0, viaC2Ids: [], fcSourceIds: new Set(), typed: false })
    }
  }

  const routes = new Map<string, KillChainRoute>()
  for (const [effectorId, s] of best) {
    routes.set(effectorId, {
      effectorId,
      latencyS: s.latencyS,
      viaC2Ids: s.viaC2Ids,
      fcSourceIds: [...s.fcSourceIds],
      typed: s.typed,
    })
  }
  return routes
}

/** Effector ids with a kill-chain route from the given sensors (incl. standalone). */
export function connectedEffectorIds(scenario: Scenario, sensorIds: Set<string>): Set<string> {
  return new Set(killChainRoutes(scenario, sensorIds).keys())
}

/** True when some effector has a kill-chain route (or completes one standalone). */
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

  // Classification-loop route cache; see the rebuild rule at the use site.
  let connectedCache: Set<string> | null = null
  let connectedCacheSize = -1

  const delayS = effectivePathDelayS(scenario, path)
  for (let t = delayS; t <= duration; t += DT) {
    const sample = posAtTime(path.points, speed, delayS, t)
    const pos = sample.pos
    const members = memberPositions(uas, pos, sample.headingDeg)

    const stepTechs = new Set<SensorType>()
    let fcClassifiedNow = false
    for (const { spec, hit } of sweepSensorHits(scenario, sensors, uas, uasSpec, members)) {
      stepTechs.add(hit.sensorType)
      detectingSensors.add(hit.sensorId)
      if (hit.resolved) anyResolved = true
      const role = defaultSensorRole(spec)
      if (hit.classified && (role === 'fire-control' || role === 'classification')) {
        fcClassifiedNow = true
      }
      if (base.firstDetectS == null) {
        base.firstDetectS = t
        base.firstDetectSensorId = hit.sensorId
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
      // detectingSensors only grows, so the route set is rebuilt on a new
      // sensor joining, not every 0.5 s sample.
      let nearestRatio = Number.POSITIVE_INFINITY
      if (connectedCache == null || connectedCacheSize !== detectingSensors.size) {
        connectedCache = connectedEffectorIds(scenario, detectingSensors)
        connectedCacheSize = detectingSensors.size
      }
      const connected = connectedCache
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
  // that effector's OWN engage time plus the route latency. The longest usable
  // interval wins the windowS slot (ties: first in entity order). When no
  // interval is usable but gated geometry exists, windowS carries the longest
  // gated interval as informative geometry and the status below is
  // window-too-short (or no-fc-uplink when the fc gate alone blocked it).
  let anyUsable = false
  let fcBlockedUsable = false
  if (gateS != null) {
    // Only effectors with a route from the detecting sensors can fire
    // (resolveEngagements uses the same route set). Unrouted geometry stays
    // available in effectorWindows.
    const routes = killChainRoutes(scenario, detectingSensors)
    let bestUsableLen = -1
    let bestGatedLen = 0
    let gatedWindow: [number, number] | null = null
    let gatedEffectorId: string | null = null
    for (const eff of effectors) {
      const route = routes.get(eff.id)
      if (!route) continue
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      const needS = (spec.engageTimeS ?? 0) + route.latencyS
      // A fully typed route to an fc-uplink effector needs a researched
      // fire-control sensor on the chain; without one its windows stay
      // geometry only.
      const fcBlocked =
        route.typed &&
        profileFor(eff.specId)?.guidance === 'fc-uplink' &&
        route.fcSourceIds.length === 0
      for (const [s0, s1] of effectorInRange.get(eff.id) ?? []) {
        const start = Math.max(s0, gateS)
        const len = s1 - start
        if (len < 0) continue
        if (len >= needS) {
          if (fcBlocked) fcBlockedUsable = true
          else if (len > bestUsableLen) {
            bestUsableLen = len
            base.windowS = [start, s1]
            base.windowEffectorId = eff.id
          }
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
    // Engageable when ANY routed effector has a usable interval; a long
    // window that only fits another effector's engage time must not shadow a
    // shorter window some effector can actually use. When the fc-uplink gate
    // is the ONLY thing blocking a usable window, say so.
    base.status = anyUsable ? 'engageable' : fcBlockedUsable ? 'no-fc-uplink' : 'window-too-short'
  }
  return base
}

export function assessAllThreats(scenario: Scenario): ThreatAssessment[] {
  return scenario.entities
    .filter((e) => e.kind === 'uas' && entityActive(e))
    .map((e) => assessThreat(scenario, e.id))
}
