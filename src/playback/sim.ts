import type { EffectorSpec, Entity, Scenario, SensorSpec, SensorType } from '../model/types'
import { defaultSensorRole, effectiveDoctrine, entityActive, mountHeightOf } from '../model/types'
import { profileFor } from '../model/integration'
import { dist, pointInWedge, posAtTime } from '../geometry/geo'
import { slantRangeM } from '../geometry/slant'
import { modelFor, pathSpeed, scenarioDurationS } from '../model/scenario'
import { effectivePathDelayS } from './raid'
import type { DrawPolicy } from './policy'
import { deterministicPolicy } from './policy'
import { FT_TO_M, effectorGeometryGate, jammable, radarPdModeled } from '../analysis/sensorEnv'
import { mOfN } from '../analysis/radarPd'
import { effectiveJamRangeM, jamBandsOverlap } from '../analysis/ewPhysics'
import {
  CONFIRMED_DECLARE_FACTOR,
  scanPeriodS,
  targetSFor,
  trackDropMissesFor,
  trackInitMFor,
  trackInitNFor,
  trackInitSFor,
} from '../analysis/doctrineFactors'
import { DT } from './clock'
import { memberPositions, threatAltitudeFt } from './tracks'
import type { DetectionHit, ScanSteering } from './detection'
import { pdTrackCumulativeOf, prepareSweep, resolvedThresholds } from './detection'
import { connectedEffectorIds, killChainConnected, killChainRoutes } from './killChain'

type ThreatStatus =
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

/** Derived classification ladder (PicoGrid track statuses). Never stored. */
export type ThreatClassification = 'pending' | 'unknown' | 'suspected' | 'hostile'

/** Sim time each classification level was first reached; null = never. */
interface ClassificationTimes {
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
  /** Inclusive 0.5 s hold intervals, split whenever the sensor loses the track. Coast included. */
  intervals: Array<[number, number]>
  /**
   * First time this sensor initiated a track: the M-of-N scan rule for a
   * scan radar, else continuous hold for the TRACK_INIT_S role time. Null
   * for RF and acoustic sensors, which initiate no fire-control track.
   * Written once, never rewritten after a drop.
   */
  trackInitAtS: number | null
  /**
   * Scan model only: inclusive DT intervals the sensor held by extrapolation
   * after a missed scan, before the next detection or the drop. Each one is
   * also inside intervals; the ladder and firstConfirmS never read a coast.
   */
  coastIntervals: Array<[number, number]>
  /**
   * Pd-modeled radar only: single-scan Pd at each DT step from
   * pdSeriesStartS (the first scan this radar took against the threat,
   * detected or not), index 0 = pdSeriesStartS, through the path end.
   * Missed and pre-admission steps included (Pd 0 with nothing admitted),
   * so a chart shows the approach and the fade.
   */
  pdSeries?: number[]
  /** Sim time of pdSeries[0]: the first scan taken, at or before firstDetectS. */
  pdSeriesStartS?: number
}

/** Track continuity from first detection through closest approach/path end. */
interface TrackQualitySummary {
  heldSamples: number
  totalSamples: number
  continuity: number
  longestGapS: number
  lastTrackS: number | null
}

/** Estimated speed above which an unknown track becomes suspected, kph (source: 50). */
const SUSPECT_SPEED_KPH = 50

/**
 * Protected-boundary radius, meters, for an asset with no `defendedRadiusM`.
 * Warning time is measured to a boundary crossing, not to closest approach
 * (docs/te-compilation/MASTER-CALCULATIONS.md section 5). 500 m is a
 * point-defence planning factor, not a measured figure.
 */
export const DEFAULT_DEFENDED_RADIUS_M = 500

/** Protected-boundary radius of one asset entity, meters. */
export function defendedRadiusOf(asset: Entity): number {
  const r = asset.defendedRadiusM
  return r != null && r > 0 ? r : DEFAULT_DEFENDED_RADIUS_M
}

/** Proximity multiple of a connected effector's max range that makes a track suspected. */
const SUSPECT_RANGE_FACTOR = 1.5

/** Route-intent wording that marks a threat profile as an attack profile. */
const ATTACK_INTENT_KEYWORDS = ['attack', 'strike', 'raid', 'one-way', 'pgm']

/** True when the model's route intent reads as an attack profile. */
function isAttackIntent(routeIntent: string | undefined): boolean {
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
  /** Alias of cpaAssetId. */
  assetId: string | null
  /** Alias of cpaDistanceM. */
  closestApproachM: number | null
  /**
   * First sample time the threat is inside a defended asset's boundary radius
   * (defendedRadiusOf). Null when it never enters one or no asset is placed.
   * attrition.ts credits a defeat only when the effect lands at or before it.
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
   * Earliest trackInitAtS over the fire-control-quality sensors (radar or
   * EO/IR), computed whether or not doctrine is enabled. RF and acoustic
   * holds never qualify. Optional so older hand-built fixtures stay valid;
   * assessThreat always fills it.
   */
  stableTrackAtS?: number | null
  /** The doctrinal weapons-release time (the gate); null when doctrine is off. */
  declaredHostileAtS?: number | null
  /**
   * Doctrine: per-effector release gates. `gateS` is engagement authority
   * (firm track from a sensor routed to the effector, hostile ID, declaration
   * dwell). `readyS` is gateS plus route latency plus the target dwell
   * (targetSFor); no shot leaves before it. An effector absent here can never
   * fire at this threat. Present only when doctrine is enabled.
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

/** Tolerance for a nominal scan time landing on the DT grid, seconds. */
const SCAN_EPS = 1e-6

/** Extend the trailing inclusive DT interval to t, or open a new one after a break. */
function extendIntervals(intervals: Array<[number, number]>, t: number): void {
  const last = intervals[intervals.length - 1]
  if (last && Math.abs(last[1] - (t - DT)) < DT / 2) last[1] = t
  else intervals.push([t, t])
}

/**
 * Scan-model state of one scan radar (scanPeriodS non-null) against one
 * threat. Scans fall at originS + k * periodS (originS = sweep start plus the
 * policy's phase times the period), each snapped forward to the first sweep
 * step at or after it; a period below DT counts one scan per step. A scan
 * before the target is first admitted stays out of the M-of-N window.
 * Between scans the hold carries the last scan result: a detected scan holds
 * with a measurement; a missed scan after initiation coasts until the next
 * detection or the drop at the dropMisses-th consecutive miss; a missed scan
 * before initiation ends the hold.
 */
interface ScanState {
  sensor: Entity
  spec: SensorSpec
  /** True when the radar draws the Pd model; false for a threshold radar with a stated period. */
  pdModeled: boolean
  fcRole: boolean
  periodS: number
  m: number
  n: number
  dropMisses: number
  originS: number
  /** Scans taken so far; the next nominal scan is originS + scans * periodS. */
  scans: number
  /** True from the first scan with the target admitted: the M-of-N window is open. */
  windowOpen: boolean
  /** Last n scan results, oldest first. */
  window: Array<{ detected: boolean; pd: number }>
  consecutiveMisses: number
  /** Classified flag of the last detected scan, carried between scans. */
  classifiedCarry: boolean
  hold: 'none' | 'detected' | 'coast' | 'dropped'
  /**
   * Pd-modeled only: single-scan Pd per step from the first scan taken;
   * becomes the observation's pdSeries at first detection.
   */
  pdSeries: number[] | null
  pdSeriesStartS: number | null
  /** This radar's observation once it first detects; the same object sensorObservations holds. */
  observation: SensorObservation | undefined
  /** This radar's hit at the current step, cleared per step. */
  hit: DetectionHit | undefined
}

/** True when this scan radar's next nominal scan is due at or before step t. */
function scanDue(scan: ScanState, t: number): boolean {
  return scan.originS + scan.scans * scan.periodS <= t + SCAN_EPS
}

/**
 * Record one scan in the window and test the M-of-N initiation rule: at
 * least m of the last n scans detected and mOfN(mean single-scan Pd over the
 * scans recorded, m, n) reaches pdTrackCumulative. trackInitAtS is written
 * once, on the observation.
 */
function recordScan(
  scan: ScanState,
  observation: SensorObservation | undefined,
  detected: boolean,
  pd: number,
  t: number,
  pdTrack: number,
): void {
  scan.window.push({ detected, pd })
  if (scan.window.length > scan.n) scan.window.shift()
  if (!observation || observation.trackInitAtS != null) return
  // One pass, summed in window order: the same arithmetic as a filter and a reduce.
  let detections = 0
  let sum = 0
  for (const w of scan.window) {
    if (w.detected) detections += 1
    sum += w.pd
  }
  if (detections < scan.m) return
  const mean = sum / scan.window.length
  if (mOfN(mean, scan.m, scan.n) >= pdTrack) observation.trackInitAtS = t
}

/**
 * One effector's terms against one threat: the reads of the in-range test
 * that do not move with the step. `windowGated` is a non-jammer whose
 * ceiling the threat flies above; it keeps its spec for the proximity
 * ladder and never opens a window.
 */
interface EffectorTerms {
  eff: Entity
  spec: EffectorSpec
  windowGated: boolean
  reachM: number
  dAltM: number
  sectorDeg: number
}

/**
 * Full timeline analysis of one threat by sampling the scenario at DT steps.
 * A missing policy is the deterministic expected-value run.
 */
export function assessThreat(
  scenario: Scenario,
  uasId: string,
  policy?: DrawPolicy,
): ThreatAssessment {
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
  // A jammer that cannot reach this threat's links is not an effector against it.
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
  const pdTrack = pdTrackCumulativeOf(scenario)
  const draw = policy ?? deterministicPolicy(resolvedThresholds(scenario))
  const sweep = prepareSweep(scenario, sensors, uas.formation, uasSpec, altitudeFt, draw)
  const delayS = effectivePathDelayS(scenario, path)
  // In range when any formation member is inside the envelope on slant
  // range, under the effector ceiling. A jammer's reach is its effective
  // range against this target, as attrition and the drawn cone use; its
  // cone test takes no ceiling.
  const effectorTerms: EffectorTerms[] = []
  for (const eff of effectors) {
    const spec = modelFor(scenario, eff)?.effector
    if (!spec) continue
    const isJammer = spec.effectorType === 'jammer'
    effectorTerms.push({
      eff,
      spec,
      windowGated: !isJammer && effectorGeometryGate(spec, altM) !== 'ok',
      reachM: isJammer ? effectiveJamRangeM(spec, uasSpec) : spec.maxRangeM,
      dAltM: altM - mountHeightOf(spec),
      sectorDeg: spec.sectorDeg ?? 360,
    })
  }
  const assetTerms = assets.map((asset) => ({ asset, radiusM: defendedRadiusOf(asset) }))
  // The phase is the run's one draw per (radar, threat), taken before any scan.
  const scanStates = new Map<string, ScanState>()
  for (const sensor of sensors) {
    const spec = modelFor(scenario, sensor)?.sensor
    if (!spec) continue
    const pdModeled = radarPdModeled(spec, uasSpec)
    const periodS = scanPeriodS(spec, pdModeled)
    if (periodS == null) continue
    const role = defaultSensorRole(spec)
    scanStates.set(sensor.id, {
      sensor,
      spec,
      pdModeled,
      fcRole: role === 'fire-control' || role === 'classification',
      periodS,
      m: trackInitMFor(spec),
      n: trackInitNFor(spec),
      dropMisses: trackDropMissesFor(spec),
      originS: delayS + draw.phase(sensor.id) * periodS,
      scans: 0,
      windowOpen: false,
      window: [],
      consecutiveMisses: 0,
      classifiedCarry: false,
      hold: 'none',
      pdSeries: null,
      pdSeriesStartS: null,
      observation: undefined,
      hit: undefined,
    })
  }
  // Scan radars whose next scan is not due this step; every other sensor scans.
  const idleScans = new Set<string>()
  const steering: ScanSteering = {
    scanStep: (sensorId) => !idleScans.has(sensorId),
    holding: (sensorId) => scanStates.get(sensorId)?.hold === 'detected',
  }
  const trackSamples: Array<{ tS: number; held: boolean }> = []
  const effectorInRange = new Map<string, Array<[number, number]>>()
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
  let arrivalS: number | null = null

  let connectedCache: Set<string> | null = null
  let connectedCacheSize = -1
  const stepTechs = new Set<SensorType>()

  for (let t = delayS; t <= duration; t += DT) {
    const sample = posAtTime(path.points, speed, delayS, t)
    const pos = sample.pos
    const members = memberPositions(uas, pos, sample.headingDeg)

    stepTechs.clear()
    let fcClassifiedNow = false
    // A coast is held for continuity only: invisible to stepTechs and the ladder.
    let coastHeld = false
    let stepFirstId: string | null = null
    idleScans.clear()
    for (const [sensorId, scan] of scanStates) {
      scan.hit = undefined
      if (!scanDue(scan, t)) idleScans.add(sensorId)
    }
    for (const { spec, hit } of sweep.hits(members, uasId, t, steering)) {
      // A scan radar's hit is a scan result only at its scan step.
      const scan = scanStates.get(hit.sensorId)
      if (scan) {
        if (!idleScans.has(hit.sensorId)) {
          scan.hit = hit
          if (stepFirstId == null) stepFirstId = hit.sensorId
        }
        continue
      }
      if (stepFirstId == null) stepFirstId = hit.sensorId
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
          trackInitAtS: null,
          coastIntervals: [],
        }
        sensorObservations.set(hit.sensorId, observation)
      }
      observation.lastDetectS = t
      observation.heldSamples += 1
      observation.resolvedEver = observation.resolvedEver || hit.resolved
      observation.minSlantM = Math.min(observation.minSlantM, hit.slantM)
      if (hit.classified && observation.firstClassifyS == null) observation.firstClassifyS = t
      extendIntervals(observation.intervals, t)
      const role = defaultSensorRole(spec)
      if (hit.classified && (role === 'fire-control' || role === 'classification')) {
        fcClassifiedNow = true
      }
    }
    // Scan pass. Without a Pd model the scan Pd is 1 on a hit and 0 on a
    // miss, so M-of-N degenerates to a count. Pd telemetry runs every step
    // from the first scan.
    for (const [sensorId, scan] of scanStates) {
      const scanStep = !idleScans.has(sensorId)
      let observation = scan.observation
      const hit = scan.hit
      let probe: number | null = null
      if (scan.pdModeled && (scan.pdSeries || scanStep)) {
        probe = sweep.probe(sensorId, members) ?? 0
        if (!scan.pdSeries) {
          scan.pdSeries = []
          scan.pdSeriesStartS = t
        }
        scan.pdSeries.push(probe)
      }
      if (scanStep) {
        const pd = scan.pdModeled ? (hit ? hit.pd! : probe!) : hit ? 1 : 0
        if (hit) {
          detectingSensors.add(sensorId)
          if (hit.resolved) anyResolved = true
          if (!observation) {
            observation = {
              sensorId,
              sensorType: hit.sensorType,
              firstDetectS: t,
              lastDetectS: t,
              firstClassifyS: null,
              heldSamples: 0,
              resolvedEver: false,
              minSlantM: hit.slantM,
              intervals: [],
              trackInitAtS: null,
              coastIntervals: [],
            }
            if (scan.pdSeries) {
              observation.pdSeries = scan.pdSeries
              observation.pdSeriesStartS = scan.pdSeriesStartS!
            }
            sensorObservations.set(sensorId, observation)
            scan.observation = observation
          }
          scan.consecutiveMisses = 0
          scan.hold = 'detected'
          scan.classifiedCarry = hit.classified
          observation.lastDetectS = t
          observation.resolvedEver = observation.resolvedEver || hit.resolved
          observation.minSlantM = Math.min(observation.minSlantM, hit.slantM)
          if (hit.classified && observation.firstClassifyS == null) observation.firstClassifyS = t
          scan.windowOpen = true
          recordScan(scan, observation, true, pd, t, pdTrack)
        } else {
          const admitted = scan.pdModeled && pd > 0
          if (scan.hold !== 'none') {
            scan.consecutiveMisses += 1
            // Before initiation a miss ends the hold; the window keeps counting.
            scan.hold =
              observation?.trackInitAtS == null
                ? 'none'
                : scan.consecutiveMisses >= scan.dropMisses
                  ? 'dropped'
                  : 'coast'
          }
          if (scan.windowOpen || admitted) {
            scan.windowOpen = true
            recordScan(scan, observation, false, pd, t, pdTrack)
          }
        }
        // One scan per step: skip every nominal scan the period lands on this step.
        while (scanDue(scan, t)) scan.scans += 1
      }
      if (!observation) continue
      if (scan.hold === 'detected') {
        stepTechs.add(observation.sensorType)
        if (scan.classifiedCarry && scan.fcRole) fcClassifiedNow = true
        observation.heldSamples += 1
        extendIntervals(observation.intervals, t)
      } else if (scan.hold === 'coast') {
        coastHeld = true
        observation.heldSamples += 1
        extendIntervals(observation.intervals, t)
        extendIntervals(observation.coastIntervals, t)
      }
    }
    if (base.firstDetectS == null && stepFirstId != null) {
      base.firstDetectS = t
      base.firstDetectSensorId = stepFirstId
    }
    trackSamples.push({ tS: t, held: stepTechs.size > 0 || coastHeld })
    for (const tech of stepTechs) techsSeen.add(tech)
    if (base.firstConfirmS == null && stepTechs.size >= 2) base.firstConfirmS = t

    // A track can climb several rungs in one step.
    if (stepTechs.size > 0 && classification !== 'hostile') {
      if (classification === 'pending') {
        classification = 'unknown'
        clsAt.unknownAtS = t
      }
      // Proximity is plain distance to effectors routed from the detecting
      // sensors (matching the source); the route set is rebuilt only when a
      // sensor joins.
      let nearestRatio = Number.POSITIVE_INFINITY
      if (connectedCache == null || connectedCacheSize !== detectingSensors.size) {
        connectedCache = connectedEffectorIds(scenario, detectingSensors)
        connectedCacheSize = detectingSensors.size
      }
      const connected = connectedCache
      for (const { eff, spec } of effectorTerms) {
        if (!connected.has(eff.id)) continue
        if (spec.maxRangeM <= 0) continue
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

    // Lead-ship geometry: CPA and the first boundary crossing (arrival).
    for (const { asset, radiusM } of assetTerms) {
      const d = dist(pos, asset.pos)
      if (d < closest.distM) closest = { assetId: asset.id, tS: t, distM: d }
      if (arrivalS == null && d <= radiusM) arrivalS = t
    }

    // Effector windows: the terms are per threat, the member test per step.
    for (const { eff, spec, windowGated, reachM, dAltM, sectorDeg } of effectorTerms) {
      if (windowGated) continue
      let inRange = false
      for (const m of members) {
        const slant = slantRangeM(dist(eff.pos, m), dAltM)
        if (
          slant >= spec.minRangeM &&
          slant <= reachM &&
          pointInWedge(eff.pos, eff.headingDeg, sectorDeg, m)
        ) {
          inRange = true
          break
        }
      }
      if (!inRange) continue
      // Insertion at the first in-range step keeps the effectorWindows order.
      let intervals = effectorInRange.get(eff.id)
      if (!intervals) {
        intervals = []
        effectorInRange.set(eff.id, intervals)
      }
      extendIntervals(intervals, t)
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
    // Continuity is judged out to closest approach: a fly-by still has a horizon.
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

  // Stable track file per fire-control-quality sensor. A scan radar wrote
  // trackInitAtS in the sweep; every other one initiates after an unbroken
  // interval of its initiation time (trackInitSFor).
  const doctrine = effectiveDoctrine(scenario)
  const firmBySensor = new Map<string, number>()
  for (const obs of sensorObservations.values()) {
    if (obs.sensorType !== 'radar' && obs.sensorType !== 'eo-ir') continue
    if (!scanStates.has(obs.sensorId)) {
      const sensorEnt = sensors.find((s) => s.id === obs.sensorId)
      const spec = sensorEnt ? modelFor(scenario, sensorEnt)?.sensor : undefined
      const initS = spec ? trackInitSFor(spec, doctrine) : doctrine.trackFirmS
      for (const [s0, s1] of obs.intervals) {
        if (s1 - s0 + DT / 2 < initS) continue
        obs.trackInitAtS = s0 + initS
        break
      }
    }
    const firmAt = obs.trackInitAtS
    if (firmAt == null) continue
    firmBySensor.set(obs.sensorId, firmAt)
    if (base.stableTrackAtS == null || firmAt < base.stableTrackAtS) base.stableTrackAtS = firmAt
  }

  const routes = killChainRoutes(scenario, detectingSensors)

  // ROE gates the window start: free = first detection, tight = hostile,
  // hold = none. Doctrine gates per effector: a firm track from a sensor
  // routed to it, hostile ID, then the declaration dwell (halved when two
  // phenomenologies had confirmed by declaration start).
  const roe = scenario.roe ?? 'tight'
  const effectorGateS = new Map<string, number>()
  const effectorReadyS = new Map<string, number>()
  let gateS: number | null = null
  if (roe === 'hold') {
    gateS = null
  } else if (doctrine.enabled) {
    const hostileAtS = base.classificationAtS.hostileAtS
    if (hostileAtS != null && firmBySensor.size > 0) {
      for (const [effectorId, route] of routes) {
        // A standalone effector (empty source set) accepts any firm track as its cue.
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
  // A gated interval is usable when its length covers the effector's engage
  // time plus the route latency (under doctrine the interval opens at the
  // release-ready time, so only the engage time must fit). The longest
  // usable interval wins windowS; with none usable, windowS carries the
  // longest gated interval and the status is window-too-short or
  // no-fc-uplink.
  let anyUsable = false
  let fcBlockedUsable = false
  if (gateS != null) {
    // Only routed effectors can fire; unrouted geometry stays in effectorWindows.
    let bestUsableLen = -1
    let bestGatedLen = 0
    let gatedWindow: [number, number] | null = null
    let gatedEffectorId: string | null = null
    for (const eff of effectors) {
      const route = routes.get(eff.id)
      if (!route) continue
      const spec = modelFor(scenario, eff)?.effector
      if (!spec) continue
      const effGateS = doctrine.enabled ? effectorReadyS.get(eff.id) : gateS
      if (effGateS == null) continue
      const needS = (spec.engageTimeS ?? 0) + (doctrine.enabled ? 0 : route.latencyS)
      // A fully typed route to an fc-uplink effector needs a fire-control sensor on it.
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
    // A firm track with no hostile ID falls through to not-confirmed instead.
    base.status = 'no-stable-track'
  } else if (
    (roe === 'tight' || doctrine.enabled) &&
    base.classificationAtS.hostileAtS == null
  ) {
    base.status = 'not-confirmed'
  } else {
    base.status = anyUsable ? 'engageable' : fcBlockedUsable ? 'no-fc-uplink' : 'window-too-short'
  }
  return base
}

/** assessThreat over every active threat, one policy threaded through. */
export function assessAllThreats(scenario: Scenario, policy?: DrawPolicy): ThreatAssessment[] {
  const draw = policy ?? deterministicPolicy(resolvedThresholds(scenario))
  return scenario.entities
    .filter((e) => e.kind === 'uas' && entityActive(e))
    .map((e) => assessThreat(scenario, e.id, draw))
}
