import type {
  Entity,
  Scenario,
  SensorSpec,
  SensorType,
  SpecModel,
  UasSpec,
  Vec2,
} from '../model/types'
import { defaultSensorRole, effectiveDoctrine, entityActive, mountHeightOf } from '../model/types'
import { profileFor } from '../model/integration'
import { dist, formationOffsets, pointInWedge, posAtTime } from '../geometry/geo'
import { slantRangeM } from '../geometry/slant'
import { modelFor, pathSpeed, scenarioDurationS } from '../state/store'
import { effectivePathDelayS } from './raid'
import {
  FT_TO_M,
  effectiveClassifyRangeM,
  effectiveDetectRangeM,
  effectorGeometryGate,
  eoIrNeedsCue,
  jammable,
  sensorGeometryGate,
  sensorHoldGate,
} from '../analysis/sensorEnv'
import { effectiveJamRangeM, jamBandsOverlap } from '../analysis/ewPhysics'
import {
  CONFIRMED_DECLARE_FACTOR,
  defaultLinkLatencyS,
  targetSFor,
  trackInitSFor,
} from '../analysis/doctrineFactors'

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

/** A library model's threat altitude, feet: the threat profile, else the altBandFt midpoint, else 0. */
function modelAltitudeFt(model: SpecModel | undefined): number {
  const profile = model?.threatProfile?.altitudeFt
  if (profile != null && Number.isFinite(profile)) return profile
  const band = model?.uas?.altBandFt
  if (band) return (band[0] + band[1]) / 2
  return 0
}

/**
 * Threat altitude, feet AGL: Entity.altitudeFt, else the model's threat
 * profile altitude, else the altBandFt midpoint, else 0. The one altitude
 * resolver: every engine read of a threat altitude goes through here.
 */
export function threatAltitudeFt(scenario: Scenario, uas: Entity): number {
  const own = uas.altitudeFt
  if (own != null && Number.isFinite(own)) return own
  return modelAltitudeFt(modelFor(scenario, uas))
}

export interface DetectionHit {
  sensorId: string
  sensorType: SensorType
  classified: boolean
  /** False when the formation spacing is below the sensor's track resolution. */
  resolved: boolean
  /** Slant range from the phase center to the nearest detected member, meters. */
  slantM: number
}

/**
 * One sensor's hit on one threat at an instant, or null.
 * The hold gate (sensorHoldGate) decides technology eligibility: RF silence,
 * RF band coverage, a zero range, and the EO/IR cue rule (a needs-cue sensor
 * holds only when cued=true). Then, per member, the vertical geometry gate
 * (sensorGeometryGate: ceiling, radio horizon, elevation limits), the
 * azimuth wedge on the ground plane, and the slant range from the phase
 * center against the effective range for this target (environment derates,
 * radar RCS, EO/IR span, acoustic level) decide geometry.
 */
function sensorHit(
  sensor: Entity,
  spec: SensorSpec,
  scenario: Scenario,
  formation: Entity['formation'],
  uasSpec: UasSpec | undefined,
  altitudeFt: number,
  members: Vec2[],
  cued: boolean,
): DetectionHit | null {
  const gate = sensorHoldGate(spec, uasSpec)
  if (gate === 'needs-cue' ? !cued : gate !== 'ok') return null
  const env = scenario.environment
  const detectR = effectiveDetectRangeM(spec, env, uasSpec)
  if (!(detectR > 0)) return null
  const sensorHeightM = mountHeightOf(spec)
  const altM = altitudeFt * FT_TO_M
  // Members the sensor can see at all: geometry gate and wedge, with the
  // slant range each one presents. The range tests read this list.
  const seen: number[] = []
  for (const m of members) {
    const groundM = dist(sensor.pos, m)
    if (sensorGeometryGate(spec, sensorHeightM, altM, groundM) !== 'ok') continue
    if (!pointInWedge(sensor.pos, sensor.headingDeg, spec.sectorDeg, m)) continue
    seen.push(slantRangeM(groundM, altM - sensorHeightM))
  }
  const detected = seen.filter((slant) => slant <= detectR)
  if (detected.length === 0) return null
  const classifyR = effectiveClassifyRangeM(spec, env, uasSpec)
  const classified = classifyR != null && detected.some((slant) => slant <= classifyR)
  const f = formation
  const resolved = !(f && f.count > 1 && spec.resolutionM != null && f.spacingM < spec.resolutionM)
  return {
    sensorId: sensor.id,
    sensorType: spec.sensorType,
    classified,
    resolved,
    slantM: Math.min(...detected),
  }
}

/**
 * Two-pass sensor sweep over one threat position set: search sensors first
 * (everything that does not need a cue: radar, RF, acoustic, and wide-area
 * EO/IR in a surveillance or early-warning role), then cued EO/IR, which
 * only hold when an earlier hit in the same sweep provides the cue
 * (COURAGEOUS: narrow-FOV cameras verify and track cued targets, they do
 * not search). One place owns the pass order and the cued flag;
 * detectionsAt, assessThreat, spawnInRingViolations and the raid-builder
 * standoff clamp all sweep through here. `formation` is the threat's
 * formation (track-resolution test); pass undefined for a single point.
 * `altitudeFt` is the threat altitude from threatAltitudeFt.
 */
export function sweepSensorHits(
  scenario: Scenario,
  sensors: Entity[],
  formation: Entity['formation'],
  uasSpec: UasSpec | undefined,
  altitudeFt: number,
  members: Vec2[],
): Array<{ spec: SensorSpec; hit: DetectionHit }> {
  const out: Array<{ spec: SensorSpec; hit: DetectionHit }> = []
  for (const pass of ['search', 'cued'] as const) {
    for (const sensor of sensors) {
      const spec = modelFor(scenario, sensor)?.sensor
      if (!spec) continue
      const cueSensor = eoIrNeedsCue(spec)
      if (pass === 'search' ? cueSensor : !cueSensor) continue
      const hit = sensorHit(
        sensor,
        spec,
        scenario,
        formation,
        uasSpec,
        altitudeFt,
        members,
        out.length > 0,
      )
      if (hit) out.push({ spec, hit })
    }
  }
  return out
}

/**
 * True when any of `sensors` holds a single ship of `model` standing at
 * `point`, under the full per-sensor rule set (sector, environment, target
 * scaling, RF silence and bands, the cue rule). The raid builder's spawn
 * standoff clamp uses this so it agrees with spawnInRingViolations. The
 * ship is not placed yet, so its altitude is the one placement will seed
 * from the library model.
 */
export function sensorHoldsPoint(
  scenario: Scenario,
  sensors: Entity[],
  model: SpecModel | undefined,
  point: Vec2,
): boolean {
  const altitudeFt = modelAltitudeFt(model)
  return sweepSensorHits(scenario, sensors, undefined, model?.uas, altitudeFt, [point]).length > 0
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
    const altitudeFt = threatAltitudeFt(scenario, uas)
    const hits = sweepSensorHits(scenario, sensors, uas.formation, uasSpec, altitudeFt, members).map(
      (s) => s.hit,
    )
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
 * derates, target scaling (radar RCS, EO/IR span, acoustic level), sector
 * wedges, RF silence and band coverage, and the role-aware EO/IR cue rule
 * (a hold by a cued-only camera with no cue is not a violation; a wide-area
 * EO/IR search sensor holds on its own).
 */
export function spawnInRingViolations(scenario: Scenario): SpawnViolation[] {
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e))
  const out: SpawnViolation[] = []
  for (const uas of scenario.entities) {
    if (uas.kind !== 'uas' || !entityActive(uas)) continue
    const start = scenario.paths.find((p) => p.entityId === uas.id)?.points[0]
    if (!start) continue
    const uasSpec = modelFor(scenario, uas)?.uas
    const altitudeFt = threatAltitudeFt(scenario, uas)
    for (const { hit } of sweepSensorHits(
      scenario,
      sensors,
      uas.formation,
      uasSpec,
      altitudeFt,
      [start],
    )) {
      out.push({ uasId: uas.id, sensorId: hit.sensorId })
    }
  }
  return out
}

export type ThreatStatus =
  | 'no-path'
  | 'never-detected'
  /** ROE 'tight' (or doctrine) and the track never reached hostile classification. */
  | 'not-confirmed'
  | 'detect-only'
  | 'no-kill-chain'
  /** ROE 'hold': analysis-only posture, no engagement windows. */
  | 'weapons-hold'
  /** Doctrine: no radar/EO-IR sensor ever held the track for trackFirmS. */
  | 'no-stable-track'
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

/** One sensor's complete hold history against one threat. */
export interface SensorObservation {
  sensorId: string
  sensorType: SensorType
  firstDetectS: number
  lastDetectS: number
  firstClassifyS: number | null
  heldSamples: number
  resolvedEver: boolean
  /** Closest slant range from the phase center over every held sample, meters. */
  minSlantM: number
  /** Inclusive 0.5 s hold intervals, split whenever the sensor loses the track. */
  intervals: Array<[number, number]>
}

/** Track continuity from first detection through closest approach/path end. */
export interface TrackQualitySummary {
  heldSamples: number
  totalSamples: number
  continuity: number
  longestGapS: number
  lastTrackS: number | null
}

/** Estimated speed above which an unknown track becomes suspected, kph (source: 50). */
export const SUSPECT_SPEED_KPH = 50

/**
 * Protected-boundary radius, meters, for an asset entity that carries no
 * `defendedRadiusM` of its own. The T&E catalog measures warning time to a
 * protected-boundary CROSSING, not to closest approach
 * (docs/te-compilation/MASTER-CALCULATIONS.md section 5; the JIATF-401
 * vignette in docs/te-compilation/12-jiatf401.md section 1.5 flies against a
 * 1,000 m boundary). 500 m is the conservative point-defence default used
 * here: a threat inside it is over the asset. Planning factor, not a measured
 * figure. Set `Entity.defendedRadiusM` per asset to match the real boundary.
 */
export const DEFAULT_DEFENDED_RADIUS_M = 500

/** Protected-boundary radius of one asset entity, meters. */
export function defendedRadiusOf(asset: Entity): number {
  const r = asset.defendedRadiusM
  return r != null && r > 0 ? r : DEFAULT_DEFENDED_RADIUS_M
}

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
  /**
   * Closest point of approach (CPA) to the nearest defended asset: which
   * asset, when the sweep sampled it, and how close. Populated whenever any
   * asset is placed, even for a threat that turns away and never arrives.
   * CPA is pure geometry: it says how near the track got, never that it got
   * there. Use arrivalS for the "over the asset" question.
   */
  cpaAssetId: string | null
  cpaS: number | null
  cpaDistanceM: number | null
  /** Same value as cpaAssetId; kept for callers written before the CPA split. */
  assetId: string | null
  /** Same value as cpaDistanceM; kept for callers written before the CPA split. */
  closestApproachM: number | null
  /**
   * ARRIVAL: the first sample time the threat is inside a defended asset's
   * protected-boundary radius (Entity.defendedRadiusM, default
   * DEFAULT_DEFENDED_RADIUS_M). Null when it never enters one, and null when
   * no asset is placed. A threat that only reaches CPA has NOT arrived.
   * attrition.ts credits a defeat as a defeat only when the effect lands at
   * or before this time.
   */
  arrivalS: number | null
  /** arrival minus first detection; the early-warning buffer. Null when either is null. */
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
  /** ROE-gated earliest engagement time: free = first detection, tight = hostile, hold = null.
   *  Doctrine enabled: max(hostile, stable track) + declaration dwell. */
  engageGateS: number | null
  /**
   * First time a FIRE-CONTROL-QUALITY sensor (radar or EO/IR) had held the
   * track continuously for doctrine.trackFirmS: the stable-track-file time.
   * Computed from the scenario's doctrine planning factors whether or not
   * doctrine is enabled, so the panel can always show it. Null when no such
   * sensor ever holds that long. RF and acoustic holds never qualify: a
   * bearing-only alert is a cue, not a firing solution. Optional so older
   * hand-built fixtures stay valid; assessThreat always fills it.
   */
  stableTrackAtS?: number | null
  /** The doctrinal weapons-release time (the gate); null when doctrine is off. */
  declaredHostileAtS?: number | null
  /**
   * Doctrine: per-effector release gates. `gateS` is engagement authority:
   * a firm track from a sensor ROUTED TO the effector exists, hostile ID is
   * made, and the declaration dwell has run. `readyS` is release-ready (the
   * TARGET step complete): gateS plus the kill-chain route latency to this
   * effector plus its weapon assignment / firing-solution dwell (targetSFor).
   * No shot leaves before readyS. An effector absent here can never fire at
   * this threat. Present only when doctrine is enabled; engageGateS carries
   * the earliest gateS.
   */
  effectorGates?: Array<{ effectorId: string; gateS: number; readyS: number }>
  /** Sensors that detected the threat at any time during the sweep. */
  detectingSensorIds: string[]
  /** Per-sensor detection/classification intervals retained for operator telemetry. */
  sensorObservations?: SensorObservation[]
  /** Union-of-sensors hold quality from first detection to the decision horizon. */
  trackQuality?: TrackQualitySummary | null
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
   * Every detecting sensor with ANY valid path to this effector. Doctrine
   * uses it for route-aware track gating: only a firm track from one of
   * these sensors can authorize this effector's shot. Empty for a standalone
   * effector's own-radar route.
   */
  sourceSensorIds: string[]
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
  // Doctrine charges a realistic default hop latency on links that set none;
  // legacy keeps the unset-means-zero contract.
  const doctrine = effectiveDoctrine(scenario)
  for (const c of scenario.connections) {
    const from = byId.get(c.fromId)
    const to = byId.get(c.toId)
    if (!from || !to) continue
    const latencyS =
      c.latencyS ?? (doctrine.enabled ? defaultLinkLatencyS(from.kind, to.kind) : 0)
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
    sourceSensorIds: Set<string>
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
      s = { latencyS, viaC2Ids, fcSourceIds: new Set(), sourceSensorIds: new Set(), typed: pathTyped }
      best.set(effectorId, s)
    } else {
      if (latencyS < s.latencyS) {
        s.latencyS = latencyS
        s.viaC2Ids = viaC2Ids
      }
      s.typed = s.typed && pathTyped
    }
    s.sourceSensorIds.add(sensor.id)
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
      best.set(e.id, {
        latencyS: 0,
        viaC2Ids: [],
        fcSourceIds: new Set(),
        sourceSensorIds: new Set(),
        typed: false,
      })
    }
  }

  const routes = new Map<string, KillChainRoute>()
  for (const [effectorId, s] of best) {
    routes.set(effectorId, {
      effectorId,
      latencyS: s.latencyS,
      viaC2Ids: s.viaC2Ids,
      fcSourceIds: [...s.fcSourceIds],
      sourceSensorIds: [...s.sourceSensorIds],
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
    cpaAssetId: null,
    cpaS: null,
    cpaDistanceM: null,
    assetId: null,
    closestApproachM: null,
    arrivalS: null,
    warningS: null,
    windowS: null,
    windowEffectorId: null,
    classificationAtS: { unknownAtS: null, suspectedAtS: null, hostileAtS: null },
    engageGateS: null,
    stableTrackAtS: null,
    declaredHostileAtS: null,
    detectingSensorIds: [],
    sensorObservations: [],
    trackQuality: null,
    effectorWindows: [],
  }
  const path = scenario.paths.find((p) => p.entityId === uasId)
  if (!path || path.points.length < 2) return base

  const uas = scenario.entities.find((e) => e.id === uasId)
  if (!uas) return base
  const uasSpec = modelFor(scenario, uas)?.uas
  const altitudeFt = threatAltitudeFt(scenario, uas)
  const altM = altitudeFt * FT_TO_M
  const speed = pathSpeed(scenario, path)
  const duration = scenarioDurationS(scenario)
  const sensors = scenario.entities.filter((e) => e.kind === 'sensor' && entityActive(e))
  const assets = scenario.entities.filter((e) => e.kind === 'asset')
  // Jammers cannot affect RF-silent, non-GNSS threats (fiber, inertial,
  // optical), and cannot affect a threat whose link bands they do not cover.
  const effectors = scenario.entities.filter((e) => {
    if (e.kind !== 'effector' || !entityActive(e)) return false
    const spec = modelFor(scenario, e)?.effector
    if (spec?.effectorType === 'jammer' && uasSpec) {
      if (!jammable(uasSpec) || !jamBandsOverlap(spec, uasSpec)) return false
    }
    return true
  })

  const detectingSensors = new Set<string>()
  const techsSeen = new Set<SensorType>()
  const sensorObservations = new Map<string, SensorObservation>()
  const trackSamples: Array<{ tS: number; held: boolean }> = []
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
  // First protected-boundary crossing, which is the ARRIVAL. Separate from
  // closest approach: a threat can pass its CPA 2 km out and never arrive.
  let arrivalS: number | null = null

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
    for (const { spec, hit } of sweepSensorHits(
      scenario,
      sensors,
      uas.formation,
      uasSpec,
      altitudeFt,
      members,
    )) {
      stepTechs.add(hit.sensorType)
      detectingSensors.add(hit.sensorId)
      if (hit.resolved) anyResolved = true
      let observation = sensorObservations.get(hit.sensorId)
      if (!observation) {
        observation = {
          sensorId: hit.sensorId,
          sensorType: hit.sensorType,
          firstDetectS: t,
          lastDetectS: t,
          firstClassifyS: hit.classified ? t : null,
          heldSamples: 0,
          resolvedEver: false,
          minSlantM: hit.slantM,
          intervals: [],
        }
        sensorObservations.set(hit.sensorId, observation)
      }
      observation.lastDetectS = t
      observation.heldSamples += 1
      observation.resolvedEver = observation.resolvedEver || hit.resolved
      observation.minSlantM = Math.min(observation.minSlantM, hit.slantM)
      if (hit.classified && observation.firstClassifyS == null) observation.firstClassifyS = t
      const interval = observation.intervals[observation.intervals.length - 1]
      if (interval && Math.abs(interval[1] - (t - DT)) < DT / 2) interval[1] = t
      else observation.intervals.push([t, t])
      const role = defaultSensorRole(spec)
      if (hit.classified && (role === 'fire-control' || role === 'classification')) {
        fcClassifiedNow = true
      }
      if (base.firstDetectS == null) {
        base.firstDetectS = t
        base.firstDetectSensorId = hit.sensorId
      }
    }
    trackSamples.push({ tS: t, held: stepTechs.size > 0 })
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

    // Lead-ship geometry, matching the rest of the asset math. Two questions
    // per sample: how near did the track get (CPA), and is it inside a
    // protected boundary yet (arrival)?
    for (const asset of assets) {
      const d = dist(pos, asset.pos)
      if (d < closest.distM) closest = { assetId: asset.id, tS: t, distM: d }
      if (arrivalS == null && d <= defendedRadiusOf(asset)) arrivalS = t
    }

    // A threat is in-range of an effector when ANY formation member is inside
    // the envelope (min range, max range, sector), measured as slant range
    // from the launcher, and the threat is under the effector's recorded
    // ceiling. Effector reach is physical geometry per ship; whether sensors
    // can split the formation (swarmMerged) is a separate track-resolution
    // question. A jammer's reach is its power-scaled effective range against
    // this target, so the window, the attrition jam gate and the drawn cone
    // agree; a jammer's cone test takes slant range and nothing else.
    for (const eff of effectors) {
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      const isJammer = spec.effectorType === 'jammer'
      if (!isJammer && effectorGeometryGate(spec, altM) !== 'ok') continue
      const reachM = isJammer ? effectiveJamRangeM(spec, uasSpec) : spec.maxRangeM
      const dAltM = altM - mountHeightOf(spec)
      const inRange = members.some((m) => {
        const slant = slantRangeM(dist(eff.pos, m), dAltM)
        return (
          slant >= spec.minRangeM &&
          slant <= reachM &&
          pointInWedge(eff.pos, eff.headingDeg, spec.sectorDeg ?? 360, m)
        )
      })
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
  base.sensorObservations = [...sensorObservations.values()]
  base.effectorWindows = [...effectorInRange.entries()].map(([effectorId, intervals]) => ({
    effectorId,
    intervals,
  }))
  base.swarmMerged = hasFormation && base.firstDetectS != null && !anyResolved
  if (closest.assetId != null) {
    base.cpaAssetId = closest.assetId
    base.cpaS = closest.tS
    base.cpaDistanceM = closest.distM
    base.assetId = closest.assetId
    base.closestApproachM = closest.distM
  }
  base.arrivalS = arrivalS
  if (base.firstDetectS != null && base.arrivalS != null) {
    base.warningS = base.arrivalS - base.firstDetectS
  }
  if (base.firstDetectS != null) {
    // Track continuity is judged out to closest approach, not to arrival: a
    // threat that never crosses a boundary still has a decision horizon.
    const horizonS = base.cpaS ?? trackSamples[trackSamples.length - 1]?.tS ?? base.firstDetectS
    const samples = trackSamples.filter(
      (sample) => sample.tS >= base.firstDetectS! - DT / 2 && sample.tS <= horizonS + DT / 2,
    )
    let heldSamples = 0
    let gapSamples = 0
    let longestGapSamples = 0
    let lastTrackS: number | null = null
    for (const sample of samples) {
      if (sample.held) {
        heldSamples += 1
        gapSamples = 0
        lastTrackS = sample.tS
      } else {
        gapSamples += 1
        longestGapSamples = Math.max(longestGapSamples, gapSamples)
      }
    }
    base.trackQuality = {
      heldSamples,
      totalSamples: samples.length,
      continuity: samples.length > 0 ? heldSamples / samples.length : 0,
      longestGapS: longestGapSamples * DT,
      lastTrackS,
    }
  }

  // Stable track file, PER SENSOR: the first time each fire-control-quality
  // sensor (radar or EO/IR) has held the track continuously for its own
  // initiation time (spec trackInitS, else the TRACK_INIT_S role table: a
  // staring fire-control radar confirms in ~2 s, a rotating early-warning
  // search radar needs several revolutions). Intervals are already split on
  // every hold break, so an unbroken interval IS continuous hold.
  // Informational when doctrine is off; the gate inputs when it is on.
  const doctrine = effectiveDoctrine(scenario)
  const firmBySensor = new Map<string, number>()
  for (const obs of sensorObservations.values()) {
    if (obs.sensorType !== 'radar' && obs.sensorType !== 'eo-ir') continue
    const sensorEnt = sensors.find((s) => s.id === obs.sensorId)
    const spec = sensorEnt ? modelFor(scenario, sensorEnt)?.sensor : undefined
    const initS = spec ? trackInitSFor(spec, doctrine) : doctrine.trackFirmS
    for (const [s0, s1] of obs.intervals) {
      if (s1 - s0 + DT / 2 < initS) continue
      firmBySensor.set(obs.sensorId, s0 + initS)
      break // intervals are in time order; the first long-enough one is earliest
    }
  }
  for (const firmAt of firmBySensor.values()) {
    if (base.stableTrackAtS == null || firmAt < base.stableTrackAtS) base.stableTrackAtS = firmAt
  }

  // Kill-chain routes from the detecting sensors: used for the doctrine
  // gates here and the usable-window sweep below.
  const routes = killChainRoutes(scenario, detectingSensors)

  // ROE gates the engagement window start: free = first detection,
  // tight = hostile classification, hold = no engagement at all.
  // Doctrine replaces the free/tight split with the full sequence PER
  // EFFECTOR: a firm track from a sensor actually ROUTED to that effector
  // (a track file that never reaches the shooter authorizes nothing), plus
  // hostile ID, then the declaration dwell. Two-phenomenology confirmation
  // at declaration start halves the dwell: correlated ID decides faster.
  const roe = scenario.roe ?? 'tight'
  const effectorGateS = new Map<string, number>()
  // Doctrine: release-ready time per effector (gate + route latency + target
  // dwell). The usable-window sweep and attrition both start from it.
  const effectorReadyS = new Map<string, number>()
  let gateS: number | null = null
  if (roe === 'hold') {
    gateS = null
  } else if (doctrine.enabled) {
    const hostileAtS = base.classificationAtS.hostileAtS
    if (hostileAtS != null && firmBySensor.size > 0) {
      for (const [effectorId, route] of routes) {
        // A standalone effector (own radar, empty source set) self-acquires:
        // it accepts the earliest firm track anywhere as its cue.
        const sources =
          route.sourceSensorIds.length > 0 ? route.sourceSensorIds : [...firmBySensor.keys()]
        let firmS: number | null = null
        for (const sid of sources) {
          const f = firmBySensor.get(sid)
          if (f != null && (firmS == null || f < firmS)) firmS = f
        }
        if (firmS == null) continue
        const declStartS = Math.max(hostileAtS, firmS)
        const confirmed = base.firstConfirmS != null && base.firstConfirmS <= declStartS
        const dwellS = doctrine.declareHostileS * (confirmed ? CONFIRMED_DECLARE_FACTOR : 1)
        const effGate = declStartS + dwellS
        effectorGateS.set(effectorId, effGate)
        // TARGET: the declared track reaches the shooter after the route
        // latency, then the shooter needs its assignment / firing-solution
        // dwell before it is release-ready.
        const effEnt = effectors.find((e) => e.id === effectorId)
        const effSpec = effEnt ? modelFor(scenario, effEnt)?.effector : undefined
        const targetS = effSpec ? targetSFor(effSpec, doctrine) : doctrine.targetS
        effectorReadyS.set(effectorId, effGate + route.latencyS + targetS)
      }
      for (const g of effectorGateS.values()) if (gateS == null || g < gateS) gateS = g
    }
    base.declaredHostileAtS = gateS
    base.effectorGates = [...effectorGateS.entries()].map(([effectorId, g]) => ({
      effectorId,
      gateS: g,
      readyS: effectorReadyS.get(effectorId) ?? g,
    }))
  } else {
    gateS = roe === 'free' ? base.firstDetectS : base.classificationAtS.hostileAtS
  }
  base.engageGateS = gateS
  // A gated interval is USABLE for an effector when its gated length covers
  // that effector's OWN engage time plus the route latency. Under doctrine the
  // interval opens at the effector's release-ready time instead (gate + route
  // latency + target dwell already inside it), so the window start IS the
  // first possible release and only the engage time must still fit. The
  // longest usable interval wins the windowS slot (ties: first in entity
  // order). When no interval is usable but gated geometry exists, windowS
  // carries the longest gated interval as informative geometry and the status
  // below is window-too-short (or no-fc-uplink when the fc gate alone blocked
  // it).
  let anyUsable = false
  let fcBlockedUsable = false
  if (gateS != null) {
    // Only effectors with a route from the detecting sensors can fire
    // (resolveEngagements uses the same route set). Unrouted geometry stays
    // available in effectorWindows.
    let bestUsableLen = -1
    let bestGatedLen = 0
    let gatedWindow: [number, number] | null = null
    let gatedEffectorId: string | null = null
    for (const eff of effectors) {
      const route = routes.get(eff.id)
      if (!route) continue
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      // Doctrine: each effector opens at ITS OWN release-ready time
      // (route-aware firm track + declaration + route latency + target
      // dwell); an effector with no gate has no usable window.
      const effGateS = doctrine.enabled ? effectorReadyS.get(eff.id) : gateS
      if (effGateS == null) continue
      const needS = (spec.engageTimeS ?? 0) + (doctrine.enabled ? 0 : route.latencyS)
      // A fully typed route to an fc-uplink effector needs a researched
      // fire-control sensor on the chain; without one its windows stay
      // geometry only.
      const fcBlocked =
        route.typed &&
        profileFor(eff.specId)?.guidance === 'fc-uplink' &&
        route.fcSourceIds.length === 0
      for (const [s0, s1] of effectorInRange.get(eff.id) ?? []) {
        const start = Math.max(s0, effGateS)
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
  } else if (
    doctrine.enabled &&
    (base.stableTrackAtS == null || effectorGateS.size === 0) &&
    !(base.stableTrackAtS != null && base.classificationAtS.hostileAtS == null)
  ) {
    // No firm fire-control track at all, or none from a sensor routed to any
    // shooter: nothing can be declared. (A firm track with no hostile ID
    // falls through to not-confirmed instead.)
    base.status = 'no-stable-track'
  } else if (
    (roe === 'tight' || doctrine.enabled) &&
    base.classificationAtS.hostileAtS == null
  ) {
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
