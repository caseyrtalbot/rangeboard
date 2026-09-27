import type { ImpactSeverity, Scenario, SpecModel, Vec2 } from '../model/types'
import { entityActive } from '../model/types'
import { engineKeyOf } from '../model/scenario'
import { defaultEffectRadiusM, defaultWeaponProfile } from '../model/weaponFactors'
import type { ThreatAssessment, ThreatAssessmentMemo } from '../playback/sim'
import { assessThreatReusing } from '../playback/sim'
import type { AttritionReport } from '../playback/attritionReport'
import { resolveEngagements } from '../playback/attrition'
import { deterministicPolicy } from '../playback/policy'
import { resolvedThresholds } from '../playback/detection'

/**
 * Threat WEZ geometry and leaker engagement-potential (I&W) warnings.
 *
 * arrivalS is the defended-boundary crossing; cpaS and cpaDistanceM are how
 * near the track got. Every geometry test here is a CPA test: a standoff
 * shooter holds an asset at risk from a CPA it never arrives at.
 *
 * Missing inputs take a fallback, never a silent zero:
 * - A model with no weapon fields falls back through defaultWeaponProfile /
 *   defaultEffectRadiusM (weaponFactors.ts).
 * - warheadKg null: expectedWarheadKg is 0 and severity comes from the ship
 *   count alone, since the kg criteria only escalate a tier.
 * - effect radius null: no circle in threatWezList, but assessLeakerImpacts
 *   treats the asset as inside the WEZ (conservative).
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
 * planning tier; null when that is unknown too.
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
 * WEZ geometry for every active threat whose radius resolves. Impact circles
 * stay at the plan center; the render layer substitutes live positions for
 * 'standoff' rings. One WEZ per formation, centered on the lead ship, since
 * attrition treats the formation as one target. A threat with an unknown
 * radius carries no circle and surfaces through assessLeakerImpacts instead.
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
    const planCenter = kind === 'impact' && hasPath ? path!.points[path!.points.length - 1] : e.pos
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
   * no asset is placed. This is "over the asset", never "nearest the asset":
   * read cpaS for the geometry and arrivalS only for the boundary.
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

/** UI copy for a tier. */
export const SEVERITY_LABEL: Record<ImpactSeverity, string> = {
  low: 'LOW',
  moderate: 'MODERATE',
  severe: 'SEVERE',
}

/**
 * Severity tier for one leaker. The SEVERE and MODERATE thresholds are
 * inclusive; the LOW floor is exclusive. Null when the asset sits outside the
 * WEZ or the ship count is at or below the floor. expectedWarheadKg 0 (an
 * unknown warhead) never fires the kg criteria, so only ships decide.
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
 * leaker keeps its severity and reports the degrade as jamDegradedProb.
 * A threat with no arrival still warns when its CPA puts the asset inside its
 * WEZ.
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
 * One shared assessment, attrition and impact computation per scenario, keyed
 * on the scenario's engine identity (`engineKeyOf`, so a presentation stamp
 * reuses the picture). Every scenario change replaces the object, so identity
 * is a sound cache key.
 */
const pictureCache = new WeakMap<Scenario, EngagementPicture>()

/**
 * Pictures retained at once. The undo history keeps up to 100 scenarios
 * alive, and a WeakMap alone would hold every one's picture with it. A deep
 * undo past the most recent 8 recomputes that one picture.
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

/**
 * The per-threat assessment memos of the last deterministic run. The picture
 * cache serves a repeated scenario object; this serves the next edit, so a
 * threat whose inputs the edit did not touch keeps its assessment object.
 */
let lastAssessed: Map<string, ThreatAssessmentMemo> | null = null

/**
 * `assessAllThreats` for the deterministic path, reusing the last run's
 * assessment of every threat whose inputs are unchanged. `assessThreatReusing`
 * owns the dependency set; this loop only carries the memos from one run to
 * the next.
 */
function assessThreatsIncremental(scenario: Scenario): ThreatAssessment[] {
  const draw = deterministicPolicy(resolvedThresholds(scenario))
  const byThreat = new Map<string, ThreatAssessmentMemo>()
  const out: ThreatAssessment[] = []
  for (const e of scenario.entities) {
    if (e.kind !== 'uas' || !entityActive(e)) continue
    const memo = assessThreatReusing(scenario, e.id, lastAssessed?.get(e.id), draw)
    byThreat.set(e.id, memo)
    out.push(memo.assessment)
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
