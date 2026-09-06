import type {
  Entity,
  RequirementThresholds,
  Scenario,
  SensorSpec,
  SensorType,
  SpecModel,
  UasSpec,
  Vec2,
} from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, entityActive, mountHeightOf } from '../model/types'
import { dist, pointInWedge } from '../geometry/geo'
import { slantRangeM } from '../geometry/slant'
import { modelFor } from '../model/scenario'
import type { DrawPolicy } from './policy'
import { deterministicPolicy } from './policy'
import {
  FT_TO_M,
  effectiveClassifyRangeM,
  effectiveDetectRangeM,
  eoIrNeedsCue,
  radarPdAt,
  radarPdModeled,
  sensorGeometryGate,
  sensorHoldGate,
} from '../analysis/sensorEnv'
import { liveTracks, memberPositions, modelAltitudeFt, threatAltitudeFt } from './tracks'

/** One sensor's hold on one threat at an instant. */
export interface DetectionHit {
  sensorId: string
  sensorType: SensorType
  classified: boolean
  /** False when the formation spacing is below the sensor's track resolution. */
  resolved: boolean
  /** Slant range from the phase center to the nearest detected member, meters. */
  slantM: number
  /** Single-scan Pd of the nearest detected member; null when the sensor has no Pd model. */
  pd: number | null
}

/** The test's thresholds with the defaults filled: the one resolution the draw policy reads. */
export function resolvedThresholds(scenario: Scenario): RequirementThresholds {
  return { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }
}

/** M-of-N cumulative probability a radar contact must reach to count as TRACK: the test's threshold. */
export function pdTrackCumulativeOf(scenario: Scenario): number {
  const pd = { ...DEFAULT_REQUIREMENT_THRESHOLDS, ...scenario.requirements }.pdTrackCumulative
  // A saved 0 would initiate a track at the first detected scan.
  return pd > 0 && pd <= 1 ? pd : DEFAULT_REQUIREMENT_THRESHOLDS.pdTrackCumulative
}

/**
 * Slant ranges, ascending, of the members the vertical geometry gate
 * (sensorGeometryGate: ceiling, radio horizon, elevation limits) and the
 * azimuth wedge on the ground plane admit. The one member loop: the hit
 * test and the Pd probe both read it.
 */
function admittedSlantsM(
  sensor: Entity,
  spec: SensorSpec,
  altitudeFt: number,
  members: Vec2[],
): number[] {
  const sensorHeightM = mountHeightOf(spec)
  const altM = altitudeFt * FT_TO_M
  const seen: number[] = []
  for (const m of members) {
    const groundM = dist(sensor.pos, m)
    if (sensorGeometryGate(spec, sensorHeightM, altM, groundM) !== 'ok') continue
    if (!pointInWedge(sensor.pos, sensor.headingDeg, spec.sectorDeg, m)) continue
    seen.push(slantRangeM(groundM, altM - sensorHeightM))
  }
  return seen.sort((a, b) => a - b)
}

/**
 * One sensor's hit on one threat at an instant, or null. sensorHoldGate
 * decides technology eligibility (RF silence, bands, zero range, the EO/IR cue
 * rule). admittedSlantsM decides which members are in view. A Pd-modeled
 * radar reads the Pd model through the draw policy, one draw per member, at
 * its scan steps only; every other sensor compares slant range with the
 * effective range for this target.
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
  policy: DrawPolicy,
  uasId: string,
  tS: number,
  scanStep: boolean,
): DetectionHit | null {
  const gate = sensorHoldGate(spec, uasSpec)
  if (gate === 'needs-cue' ? !cued : gate !== 'ok') return null
  // Between scans a scan radar has no hit of its own; the carried hold is the only cue.
  if (!scanStep) return null
  const env = scenario.environment
  let detected: number[]
  if (radarPdModeled(spec, uasSpec)) {
    const seen = admittedSlantsM(sensor, spec, altitudeFt, members)
    detected = seen.filter((slant, i) =>
      policy.detect(radarPdAt(spec, env, uasSpec, slant)!, sensor.id, uasId, tS, i),
    )
  } else {
    const seen = admittedSlantsM(sensor, spec, altitudeFt, members)
    const detectR = effectiveDetectRangeM(spec, env, uasSpec)
    if (!(detectR > 0)) return null
    detected = seen.filter((slant) => slant <= detectR)
  }
  if (detected.length === 0) return null
  const classifyR = effectiveClassifyRangeM(spec, env, uasSpec)
  const classified = classifyR != null && detected.some((slant) => slant <= classifyR)
  const f = formation
  const resolved = !(f && f.count > 1 && spec.resolutionM != null && f.spacingM < spec.resolutionM)
  const slantM = detected[0]
  return {
    sensorId: sensor.id,
    sensorType: spec.sensorType,
    classified,
    resolved,
    slantM,
    pd: radarPdAt(spec, env, uasSpec, slantM),
  }
}

/**
 * Single-scan Pd a radar reads on the nearest member the geometry gate and
 * the wedge admit, whether or not it clears the detect threshold: 0 when no
 * member is admitted or every admitted member is beyond the instrumented
 * range. Null when the sensor has no Pd model. Feeds the sweep's pdSeries.
 */
export function radarPdProbe(
  sensor: Entity,
  spec: SensorSpec,
  scenario: Scenario,
  uasSpec: UasSpec | undefined,
  altitudeFt: number,
  members: Vec2[],
): number | null {
  if (!radarPdModeled(spec, uasSpec)) return null
  if (sensorHoldGate(spec, uasSpec) !== 'ok') return null
  const seen = admittedSlantsM(sensor, spec, altitudeFt, members)
  if (seen.length === 0) return 0
  return radarPdAt(spec, scenario.environment, uasSpec, seen[0])
}

/**
 * Scan-model steering from assessThreat: which scan radars take a scan at
 * this step, and which hold a track from their last scan. Absent (a bare
 * call, detectionsAt, the board view): every step is a scan step and no
 * hold is carried.
 */
export interface ScanSteering {
  /** True when this radar takes a scan at this step; true for a sensor with no scan state. */
  scanStep(sensorId: string): boolean
  /** True when this radar holds from its last detected scan; it cues EO/IR between scans. */
  holding(sensorId: string): boolean
}

/**
 * Two-pass sensor sweep over one threat position set: search sensors first,
 * then cued EO/IR, which holds only when an earlier hit in the same sweep
 * provides the cue (COURAGEOUS: narrow-FOV cameras verify, they do not
 * search). The one owner of the pass order and the cued flag. `formation`
 * feeds the track-resolution test; pass undefined for a single point. A bare
 * call (no policy, no steering) is a deterministic board view in which every
 * step is a scan step; with steering, a radar's carried hold cues the EO/IR
 * pass between its scans.
 */
export function sweepSensorHits(
  scenario: Scenario,
  sensors: Entity[],
  formation: Entity['formation'],
  uasSpec: UasSpec | undefined,
  altitudeFt: number,
  members: Vec2[],
  policy?: DrawPolicy,
  uasId = '',
  tS = 0,
  scan?: ScanSteering,
): Array<{ spec: SensorSpec; hit: DetectionHit }> {
  const draw = policy ?? deterministicPolicy(resolvedThresholds(scenario))
  const out: Array<{ spec: SensorSpec; hit: DetectionHit }> = []
  // One spec lookup per sensor, not one per sensor per pass. A sensor with no
  // sensor spec is skipped in both passes, so dropping it here is the same set.
  const specced: Array<{ sensor: Entity; spec: SensorSpec }> = []
  for (const sensor of sensors) {
    const spec = modelFor(scenario, sensor)?.sensor
    if (spec) specced.push({ sensor, spec })
  }
  let cued = false
  for (const pass of ['search', 'cued'] as const) {
    for (const { sensor, spec } of specced) {
      const cueSensor = eoIrNeedsCue(spec)
      if (pass === 'search' ? cueSensor : !cueSensor) continue
      const scanStep = scan ? scan.scanStep(sensor.id) : true
      const hit = sensorHit(
        sensor,
        spec,
        scenario,
        formation,
        uasSpec,
        altitudeFt,
        members,
        cued,
        draw,
        uasId,
        tS,
        scanStep,
      )
      if (hit) {
        out.push({ spec, hit })
        cued = true
      } else if (scan && !scanStep && scan.holding(sensor.id)) {
        cued = true
      }
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
interface SpawnViolation {
  uasId: string
  sensorId: string
}

/**
 * Threats whose flight path starts inside a sensor's effective detect ring:
 * the track is held at T0, so the run never exercises the search problem.
 * Derived live and never stored, since sensors, delays and hand-drawn paths
 * change after the raid builder's standoff clamp. Sweeps path.points[0] (lead
 * position, formation offsets ignored) under the sensorHit rules.
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
