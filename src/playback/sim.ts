import type { Entity, Scenario, SensorSpec, SensorType } from '../model/types'
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
import { pdTrackCumulativeOf, radarPdProbe, resolvedThresholds, sweepSensorHits } from './detection'
import { connectedEffectorIds, killChainConnected, killChainRoutes } from './killChain'

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
  /** Inclusive 0.5 s hold intervals, split whenever the sensor loses the track. Coast included. */
  intervals: Array<[number, number]>
  /**
   * First time this sensor initiated a track: the M-of-N scan rule for a
   * scan radar (a stated updateRateS, or a Pd model with the SCAN_S role
   * period), else the TRACK_INIT_S role table (threshold radar with no
   * period, and EO/IR). Null when it never did, and for RF and acoustic
   * sensors, which initiate no fire-control track. Written once, never
   * rewritten after a drop.
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
 * threat, created at the sweep start before any detection. Scans fall at
 * originS + k * periodS, where originS is the sweep start plus the policy's
 * phase times the period; each is snapped FORWARD to the first sweep step at
 * or after it, and a period below DT lands several nominal scans on one step
 * and counts one scan per step. A Pd-modeled radar draws once per admitted
 * member at each scan; a threshold radar samples its range test there. A
 * scan before the target is first admitted is a miss with Pd 0 that advances
 * the counter and stays out of the M-of-N window. Between scans the hold
 * carries the last scan result: none before the first detection, a detected
 * scan holds with a measurement, a missed scan coasts (held for continuity,
 * no measurement) until the next detection or the drop at the dropMisses-th
 * consecutive miss.
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
}

/** True when this scan radar's next nominal scan is due at or before step t. */
function scanDue(scan: ScanState, t: number): boolean {
  return scan.originS + scan.scans * scan.periodS <= t + SCAN_EPS
}

/**
 * Record one scan in the window and test the M-of-N initiation rule: at
 * least m of the last n scans detected AND mOfN(mean single-scan Pd over
 * those scans, m, n) reaches the test's pdTrackCumulative. Fewer than n
 * scans in the window so far: the mean runs over the scans recorded, n
 * unchanged. The window opens at the first admitted scan, so a missed scan
 * before the first detection enters it with no observation to write to;
 * trackInitAtS is written once, on the observation.
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
  const detections = scan.window.filter((w) => w.detected).length
  if (detections < scan.m) return
  const mean = scan.window.reduce((sum, w) => sum + w.pd, 0) / scan.window.length
  if (mOfN(mean, scan.m, scan.n) >= pdTrack) observation.trackInitAtS = t
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
  const pdTrack = pdTrackCumulativeOf(scenario)
  const draw = policy ?? deterministicPolicy(resolvedThresholds(scenario))
  const delayS = effectivePathDelayS(scenario, path)
  // One scan state per scan radar, created at the sweep start: the phase is
  // the run's one draw per (radar, threat) before any scan.
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
    })
  }
  // Per-step scratch for the scan radars, allocated once: the radars due a
  // scan this step and their fresh hits.
  const scanSteps = new Set<string>()
  const scanHits = new Map<string, DetectionHit>()
  const steering: ScanSteering = {
    scanStep: (sensorId) => !scanStates.has(sensorId) || scanSteps.has(sensorId),
    holding: (sensorId) => scanStates.get(sensorId)?.hold === 'detected',
  }
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

  for (let t = delayS; t <= duration; t += DT) {
    const sample = posAtTime(path.points, speed, delayS, t)
    const pos = sample.pos
    const members = memberPositions(uas, pos, sample.headingDeg)

    const stepTechs = new Set<SensorType>()
    let fcClassifiedNow = false
    // A coasting scan radar holds the track file with no measurement: held
    // for continuity (D16), invisible to stepTechs and the ladder.
    let coastHeld = false
    // The first detecting sensor of this step in sweep order (search sensors,
    // then cued EO/IR), credited after both passes.
    let stepFirstId: string | null = null
    scanSteps.clear()
    scanHits.clear()
    for (const [sensorId, scan] of scanStates) if (scanDue(scan, t)) scanSteps.add(sensorId)
    for (const { spec, hit } of sweepSensorHits(
      scenario,
      sensors,
      uas.formation,
      uasSpec,
      altitudeFt,
      members,
      draw,
      uasId,
      t,
      steering,
    )) {
      // A scan radar's hit is a scan result only at its scan step; a
      // threshold radar's hit between scans is dropped and the hold carries.
      if (scanStates.has(hit.sensorId)) {
        if (scanSteps.has(hit.sensorId)) {
          scanHits.set(hit.sensorId, hit)
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
    // Scan pass. At a scan step the fresh hit is the scan result: detected,
    // or missed with the probe Pd (1 on a hit and 0 on a miss without a Pd
    // model, so M-of-N degenerates to a count). A miss before the target is
    // first admitted stays out of the window. Every step then holds from the
    // carried scan state. Pd telemetry runs every step from the first scan.
    for (const [sensorId, scan] of scanStates) {
      const scanStep = scanSteps.has(sensorId)
      let observation = sensorObservations.get(sensorId)
      const hit = scanHits.get(sensorId)
      let probe: number | null = null
      if (scan.pdModeled && (scan.pdSeries || scanStep)) {
        probe = radarPdProbe(scan.sensor, scan.spec, scenario, uasSpec, altitudeFt, members) ?? 0
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
          // A Pd-modeled radar admits a target the geometry gate, the wedge
          // and the instrumented cap pass (Pd above 0); a threshold radar
          // admits one it holds.
          const admitted = scan.pdModeled && pd > 0
          if (scan.hold !== 'none') {
            scan.consecutiveMisses += 1
            scan.hold = scan.consecutiveMisses >= scan.dropMisses ? 'dropped' : 'coast'
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

  // Stable track file, PER SENSOR, for the fire-control-quality sensors
  // (radar or EO/IR). A scan-model radar wrote trackInitAtS in the sweep
  // (M-of-N over its scans). Every other one initiates after continuous
  // hold for its own initiation time (spec trackInitS, else the TRACK_INIT_S
  // role table: a staring fire-control radar confirms in ~2 s, a rotating
  // early-warning search radar needs several revolutions). Intervals are
  // already split on every hold break, so an unbroken interval IS continuous
  // hold. stableTrackAtS is the earliest over sensors: informational when
  // doctrine is off, the gate input when it is on.
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
        break // intervals are in time order; the first long-enough one is earliest
      }
    }
    const firmAt = obs.trackInitAtS
    if (firmAt == null) continue
    firmBySensor.set(obs.sensorId, firmAt)
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

/** assessThreat over every active threat, one policy threaded through. */
export function assessAllThreats(scenario: Scenario, policy?: DrawPolicy): ThreatAssessment[] {
  return scenario.entities
    .filter((e) => e.kind === 'uas' && entityActive(e))
    .map((e) => assessThreat(scenario, e.id, policy))
}
