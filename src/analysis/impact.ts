import type { Entity, ImpactSeverity, Scenario, SensorSpec, SpecModel, UasSpec, Vec2 } from '../model/types'
import { entityActive } from '../model/types'
import { engineKeyOf, modelFor, scenarioDurationS } from '../model/scenario'
import { formationOffsets } from '../geometry/geo'
import { defaultEffectRadiusM, defaultWeaponProfile } from '../model/weaponFactors'
import type { ThreatAssessment } from '../playback/sim'
import { assessThreat } from '../playback/sim'
import type { AttritionReport } from '../playback/attritionReport'
import { resolveEngagements } from '../playback/attrition'
import { deterministicPolicy } from '../playback/policy'
import { resolvedThresholds } from '../playback/detection'
import { effectiveDetectRangeM, instrumentedM, radarPdCurve, sensorHoldGate } from './sensorEnv'

/**
 * Threat WEZ geometry and leaker engagement-potential (I&W) warnings. Pure functions
 * of ThreatAssessment and AttritionReport; no store imports; nothing is written back.
 *
 * Arrival and CPA are different questions. arrivalS is the defended-boundary crossing;
 * cpaS and cpaDistanceM are how near the track got. Every geometry test here is a CPA
 * test: a standoff shooter holds an asset at risk from a CPA it never arrives at.
 *
 * Fallbacks, never silent zeros:
 * - A model saved before the weapon fields existed falls back through
 *   defaultWeaponProfile / defaultEffectRadiusM (weaponFactors.ts).
 * - warheadKg null: expectedWarheadKg is 0 and severity comes from the ship count
 *   alone; the kg criteria only escalate a tier. Library warhead masses are positive
 *   or null, so 0 kg with ships arriving means unknown.
 * - effect radius null: no circle in threatWezList, but assessLeakerImpacts treats the
 *   asset as inside the WEZ (conservative) and the UI labels the radius unknown.
 */

type WezKind = 'impact' | 'standoff' | 'none'
export type { ImpactSeverity } from '../model/types'

/** WEZ semantics for one threat model. 'none' when the platform has no weapon. */
export function wezKindFor(model: SpecModel | undefined): WezKind {
  const uas = model?.uas
  if (!uas) return 'none'
  return defaultWeaponProfile(uas)
}

/**
 * effectRadiusM for 'impact', standoffRangeM for 'standoff', null for 'none'.
 * An impact model without an explicit radius falls back to the warhead-mass
 * planning tier; null when that is unknown too (an honest blank).
 */
export function wezRadiusM(model: SpecModel | undefined): number | null {
  const uas = model?.uas
  if (!uas) return null
  const kind = wezKindFor(model)
  if (kind === 'impact') return uas.effectRadiusM ?? defaultEffectRadiusM(uas.warheadKg)
  if (kind === 'standoff') return uas.standoffRangeM ?? null
  return null
}

export interface ThreatWez {
  uasId: string
  kind: WezKind
  radiusM: number
  /** Impact point (path end) for 'impact'; rest position for 'standoff'. */
  planCenter: Vec2
  hasPath: boolean
  /** Coincident impact WEZs merged into one drawable (ships aimed at one point). */
  count: number
}

/**
 * WEZ geometry for every active threat whose radius resolves; playback
 * centers for 'standoff' rings come from liveTracks (the render layer
 * substitutes them), impact circles stay at the plan center. One WEZ per
 * formation, centered on the lead ship: attrition treats the formation as one
 * target, and the warhead mass scales by ship count in the warnings, not in
 * the geometry. Threats with an unknown radius carry no drawable circle and
 * surface through assessLeakerImpacts instead.
 */
export function threatWezList(scenario: Scenario): ThreatWez[] {
  const out: ThreatWez[] = []
  for (const e of scenario.entities) {
    if (e.kind !== 'uas' || !entityActive(e)) continue
    const model = scenario.library.find((m) => m.id === e.specId)
    const kind = wezKindFor(model)
    if (kind === 'none') continue
    const radiusM = wezRadiusM(model)
    if (radiusM == null) continue
    const path = scenario.paths.find((p) => p.entityId === e.id)
    const hasPath = !!path && path.points.length >= 2
    const planCenter =
      kind === 'impact' && hasPath ? path!.points[path!.points.length - 1] : e.pos
    out.push({ uasId: e.id, kind, radiusM, planCenter, hasPath, count: 1 })
  }
  // Raids built toward one target end every path at the same point: merge coincident
  // impact circles (1 m grid) into one drawable with a ship count. Standoff rings
  // ride live positions and stay per-entity.
  const merged = new Map<string, ThreatWez>()
  const result: ThreatWez[] = []
  for (const wez of out) {
    if (wez.kind !== 'impact') {
      result.push(wez)
      continue
    }
    const key = `${wez.radiusM}|${Math.round(wez.planCenter.x)}|${Math.round(wez.planCenter.y)}`
    const hit = merged.get(key)
    if (hit) {
      hit.count += 1
      hit.hasPath = hit.hasPath || wez.hasPath
    } else {
      merged.set(key, wez)
      result.push(wez)
    }
  }
  return result
}

export interface LeakerImpact {
  uasId: string
  name: string
  /** Asset of closest approach (ThreatAssessment.cpaAssetId). */
  assetId: string | null
  assetName: string | null
  /**
   * Defended-boundary crossing time, null when the track never crosses one or
   * no asset is placed. This is "over the asset", not "nearest the asset": a
   * standoff shooter can hold an asset at risk from a CPA it never arrives at,
   * so read cpaS for the geometry and arrivalS only for the boundary.
   */
  arrivalS: number | null
  /** Time of closest approach to that asset; populated whenever any asset is placed. */
  cpaS: number | null
  /** cpaDistanceM <= WEZ radius: the asset sits inside the WEZ at closest approach. */
  assetInWez: boolean
  /**
   * shipCount * leakProbability. leakProbability is per-ship survival AT
   * ARRIVAL, so kill mass that landed after the boundary crossing does not
   * reduce this figure: a leaker that was destroyed too late still leaked.
   */
  expectedShipsArriving: number
  /** expectedShipsArriving * warheadKg. */
  expectedWarheadKg: number
  /** Probability the track arrives jam-degraded ('continue' jam). */
  jamDegradedProb: number
  /** Null when assetInWez is false, kind is 'none', or ships are at or below the 0.05 floor. */
  severity: ImpactSeverity | null
}

/** Below this expected ship count nothing warns (severity null). Exclusive: LOW needs ships > floor. */
const SEVERITY_SHIP_FLOOR = 0.05
/** SEVERE at >= 1.0 expected ships or >= 20 kg expected leaked warhead (inclusive). */
const SEVERE_SHIPS = 1.0
const SEVERE_KG = 20
/** MODERATE at >= 0.25 expected ships or >= 5 kg expected leaked warhead (inclusive). */
const MODERATE_SHIPS = 0.25
const MODERATE_KG = 5

/** Higher = worse; for picking the worst tier per asset. */
export const SEVERITY_RANK: Record<ImpactSeverity, number> = { low: 1, moderate: 2, severe: 3 }

/** UI copy for a tier. */
export const SEVERITY_LABEL: Record<ImpactSeverity, string> = {
  low: 'LOW',
  moderate: 'MODERATE',
  severe: 'SEVERE',
}

/**
 * Severity tier for one leaker. Boundaries: SEVERE and MODERATE thresholds
 * are inclusive (>=); the LOW floor is exclusive (ships must exceed 0.05).
 * Null when the asset sits outside the WEZ or the ship count is at or below
 * the floor. expectedWarheadKg 0 (unknown warhead) never fires the kg
 * criteria, so severity honestly falls back to ships only.
 */
export function severityFor(
  assetInWez: boolean,
  ships: number,
  warheadKg: number,
): ImpactSeverity | null {
  if (!assetInWez) return null
  if (ships <= SEVERITY_SHIP_FLOOR) return null
  if (ships >= SEVERE_SHIPS || warheadKg >= SEVERE_KG) return 'severe'
  if (ships >= MODERATE_SHIPS || warheadKg >= MODERATE_KG) return 'moderate'
  return 'low'
}

/**
 * Engagement potential of every threat with a flight path. 'drift' and
 * 'return-home' jam outcomes already end the approach inside attrition, so
 * those ships never count in expectedShipsArriving. A 'continue' jam-degraded
 * leaker keeps its severity (the warhead is a property of the airframe, not
 * of the guidance link) and the degrade surfaces as jamDegradedProb data.
 *
 * A threat with no arrival still warns when its CPA puts the asset inside its
 * WEZ. That is the point of the warning: engagement potential, not a report
 * that the asset was reached.
 */
export function assessLeakerImpacts(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
): LeakerImpact[] {
  const out: LeakerImpact[] = []
  for (const a of assessments) {
    if (a.status === 'no-path') continue
    const entity = scenario.entities.find((e) => e.id === a.uasId)
    if (!entity) continue
    const model = scenario.library.find((m) => m.id === entity.specId)
    const kind = wezKindFor(model)
    const radiusM = wezRadiusM(model)
    const att = report.threats.find((t) => t.uasId === a.uasId)
    const shipCount =
      att?.shipCount ??
      (entity.formation && entity.formation.count > 1 ? entity.formation.count : 1)
    // No attrition row means no shots were resolved: every ship arrives.
    const leakProb = att?.leakProbability ?? 1
    const ships = shipCount * leakProb
    const warheadKg = model?.uas?.warheadKg ?? null
    const kg = warheadKg != null ? ships * warheadKg : 0
    // WEZ containment is a closest-approach question, never a boundary question.
    const assetInWez =
      kind !== 'none' &&
      a.cpaAssetId != null &&
      // Unknown radius: assume inside (conservative; the UI labels r unknown).
      (radiusM == null || (a.cpaDistanceM != null && a.cpaDistanceM <= radiusM))
    out.push({
      uasId: a.uasId,
      name: entity.name,
      assetId: a.cpaAssetId,
      assetName:
        a.cpaAssetId != null
          ? (scenario.entities.find((e) => e.id === a.cpaAssetId)?.name ?? null)
          : null,
      arrivalS: a.arrivalS,
      cpaS: a.cpaS,
      assetInWez,
      expectedShipsArriving: ships,
      expectedWarheadKg: kg,
      jamDegradedProb: att?.continueJamProb ?? 0,
      severity: kind === 'none' ? null : severityFor(assetInWez, ships, kg),
    })
  }
  return out
}

export interface EngagementPicture {
  assessments: ThreatAssessment[]
  report: AttritionReport
  impacts: LeakerImpact[]
}

/**
 * One shared assessment, attrition and impact computation per scenario, memoized in a
 * WeakMap keyed on the scenario's engine identity (`engineKeyOf`, so a presentation
 * stamp reuses the picture). Every scenario change goes through mutate(), which
 * replaces the object, so identity is a sound cache key.
 */
const pictureCache = new WeakMap<Scenario, EngagementPicture>()

/**
 * Pictures retained at once. The undo history keeps up to 100 scenarios
 * alive, and a WeakMap alone would keep every one's picture with it. The
 * most recently used keys stay cached; an older one is dropped and a deep
 * undo recomputes that one picture. The current scenario is always the most
 * recent, so it is never the one evicted.
 */
const PICTURE_LIMIT = 8
const recentKeys: Scenario[] = []

function touchKey(key: Scenario): void {
  const at = recentKeys.indexOf(key)
  if (at === recentKeys.length - 1 && at >= 0) return
  if (at >= 0) recentKeys.splice(at, 1)
  recentKeys.push(key)
  if (recentKeys.length > PICTURE_LIMIT) pictureCache.delete(recentKeys.shift()!)
}

interface ThreatMemo {
  /** Every object and value the assessment read, in a fixed order. */
  inputs: unknown[]
  assessment: ThreatAssessment
}

/**
 * The per-threat assessments of the last deterministic run. The picture cache
 * serves a repeated scenario object; this serves the next edit, so a threat
 * whose inputs the edit did not touch keeps its assessment object.
 */
let lastAssessed: Map<string, ThreatMemo> | null = null

/** Ground distance from p to the segment ab, meters. */
function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * The farthest ground distance, meters, at which `spec` can still hit this
 * target: the effective detect range of a threshold sensor, the instrumented
 * range of a Pd-modeled radar (its Pd is 0 beyond it), null when it has no
 * bound. The sweep hits on slant range, which is never below ground range,
 * so a member farther than this on the ground is never detected.
 */
function sensorReachM(spec: SensorSpec, scenario: Scenario, uasSpec: UasSpec | undefined): number | null {
  if (radarPdCurve(spec, scenario.environment, uasSpec)) return instrumentedM(spec)
  return effectiveDetectRangeM(spec, scenario.environment, uasSpec)
}

/**
 * The entity objects one threat's assessment reads, in scenario order: the
 * threat itself, every asset, effector and C2 node, and every sensor that
 * can hit it. A sensor whose technology gate refuses the target, or whose
 * reach ends short of every point of the flight path with the formation's
 * spread added, never hits, so it never cues, never routes and writes no
 * observation, wherever it stands or points. Other threats reach the
 * assessment only through the run duration, which the shared inputs carry
 * as a number. Markers are never read.
 */
function threatEntityInputs(scenario: Scenario, uas: Entity): Entity[] {
  const path = scenario.paths.find((p) => p.entityId === uas.id)
  // A threat with no flight path is 'no-path' before any other read.
  if (!path || path.points.length < 2) return [uas]
  const uasSpec = modelFor(scenario, uas)?.uas
  const f = uas.formation
  const spreadM =
    f && f.count > 1
      ? Math.max(...formationOffsets(f.shape, f.count, f.spacingM, 0).map((o) => Math.hypot(o.x, o.y)))
      : 0
  const out: Entity[] = [uas]
  for (const e of scenario.entities) {
    if (e === uas || e.kind === 'uas' || e.kind === 'marker') continue
    if (e.kind === 'sensor') {
      const spec = modelFor(scenario, e)?.sensor
      if (spec) {
        const gate = sensorHoldGate(spec, uasSpec)
        if (gate !== 'ok' && gate !== 'needs-cue') continue
        const reachM = sensorReachM(spec, scenario, uasSpec)
        if (reachM != null) {
          let nearestM = Number.POSITIVE_INFINITY
          for (let i = 1; i < path.points.length; i++) {
            nearestM = Math.min(nearestM, distToSegment(e.pos, path.points[i - 1], path.points[i]))
          }
          if (nearestM - spreadM > reachM) continue
        }
      }
    }
    out.push(e)
  }
  return out
}

function sameInputs(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * `assessAllThreats` for the deterministic path, reusing the last run's
 * assessment of every threat whose inputs are the same objects: the scenario
 * fields the assessment reads, the run duration, and the entities it reads
 * (`threatEntityInputs`). Every scenario change replaces the objects it
 * touches, so identity equality on that list is exact. The deterministic
 * policy is pure, so one threat's assessment does not depend on another's.
 */
function assessThreatsIncremental(scenario: Scenario): ThreatAssessment[] {
  const draw = deterministicPolicy(resolvedThresholds(scenario))
  const shared: unknown[] = [
    scenario.paths,
    scenario.connections,
    scenario.library,
    scenario.environment,
    scenario.requirements,
    scenario.roe,
    scenario.doctrine,
    scenario.raid,
    scenarioDurationS(scenario),
  ]
  const byThreat = new Map<string, ThreatMemo>()
  const out: ThreatAssessment[] = []
  for (const e of scenario.entities) {
    if (e.kind !== 'uas' || !entityActive(e)) continue
    const inputs = [...shared, ...threatEntityInputs(scenario, e)]
    const old = lastAssessed?.get(e.id)
    const assessment =
      old && sameInputs(old.inputs, inputs) ? old.assessment : assessThreat(scenario, e.id, draw)
    byThreat.set(e.id, { inputs, assessment })
    out.push(assessment)
  }
  lastAssessed = byThreat
  return out
}

/** The deterministic picture of a scenario, computed once per engine identity. */
export function engagementPicture(scenario: Scenario): EngagementPicture {
  const key = engineKeyOf(scenario)
  const hit = pictureCache.get(key)
  if (hit) {
    touchKey(key)
    return hit
  }
  const assessments = assessThreatsIncremental(key)
  const report = resolveEngagements(key, assessments)
  const impacts = assessLeakerImpacts(key, assessments, report)
  const picture: EngagementPicture = { assessments, report, impacts }
  pictureCache.set(key, picture)
  touchKey(key)
  return picture
}
