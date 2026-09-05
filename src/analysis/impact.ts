import type { ImpactSeverity, Scenario, SpecModel, Vec2 } from '../model/types'
import { entityActive } from '../model/types'
import { defaultEffectRadiusM, defaultWeaponProfile } from '../model/weaponFactors'
import type { ThreatAssessment } from '../playback/sim'
import { assessAllThreats } from '../playback/sim'
import type { AttritionReport } from '../playback/attritionReport'
import { resolveEngagements } from '../playback/attrition'

/**
 * Threat WEZ geometry and leaker engagement-potential (I&W) warnings.
 *
 * Composes ThreatAssessment (arrival, closest approach) with AttritionReport
 * (survival, jam state) exactly like aar.ts: pure functions of their inputs,
 * no store imports. Everything derives from the scenario; nothing here is
 * ever written back into it.
 *
 * ARRIVAL AND CPA ARE DIFFERENT QUESTIONS. arrivalS is the crossing of the
 * asset's defended boundary; cpaS and cpaDistanceM are how near the track
 * ever got. Every geometry test here is a CPA test, because a threat holds an
 * asset at risk as soon as the asset is inside its WEZ, which for a standoff
 * shooter happens far outside any boundary it will never cross. arrivalS is
 * carried as reporting data only.
 *
 * Honest fallbacks, never silent zeros:
 * - A model saved before the weapon fields existed falls back through
 *   defaultWeaponProfile / defaultEffectRadiusM (weaponFactors.ts).
 * - warheadKg null: expectedWarheadKg is 0 and severity comes from the ship
 *   count alone (the kg criteria only ever escalate a tier, so skipping them
 *   is conservative in the safe direction). The UI shows "warhead unknown"
 *   instead of "0 kg"; 0 kg with ships arriving always means unknown, since
 *   library warhead masses are positive or null.
 * - effect radius null (unknown): no circle can be drawn, so the threat is
 *   excluded from threatWezList, but assessLeakerImpacts treats the asset as
 *   inside the WEZ (conservative planning assumption) and the UI labels the
 *   radius unknown. Suppressing the warning instead would hide a real threat.
 */

export type WezKind = 'impact' | 'standoff' | 'none'
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
  // Raids built toward one target end every path at the same point; coincident
  // impact circles stack fills into an unreadable disc. Merge them (1 m grid)
  // into one drawable with a ship count. Standoff rings ride live positions
  // and stay per-entity.
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
export const SEVERITY_SHIP_FLOOR = 0.05
/** SEVERE at >= 1.0 expected ships or >= 20 kg expected leaked warhead (inclusive). */
export const SEVERE_SHIPS = 1.0
export const SEVERE_KG = 20
/** MODERATE at >= 0.25 expected ships or >= 5 kg expected leaked warhead (inclusive). */
export const MODERATE_SHIPS = 0.25
export const MODERATE_KG = 5

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
    // WEZ containment is a CLOSEST-APPROACH question, never a boundary
    // question: the threat only has to get within its own effect radius of
    // the asset, which it can do without ever crossing the defended boundary.
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
 * One shared assessment + attrition + impact computation per scenario for the
 * canvas layer and the analysis panel, so large raids never pay the 0.5 s
 * sweep twice. Memoized in a module-level WeakMap keyed on the scenario
 * object: every scenario change goes through mutate(), which replaces the
 * object, so identity is a sound cache key and dead scenarios are collected
 * with their entries.
 */
const pictureCache = new WeakMap<Scenario, EngagementPicture>()


export function engagementPicture(scenario: Scenario): EngagementPicture {
  const hit = pictureCache.get(scenario)
  if (hit) return hit
  const assessments = assessAllThreats(scenario)
  const report = resolveEngagements(scenario, assessments)
  const impacts = assessLeakerImpacts(scenario, assessments, report)
  const picture: EngagementPicture = { assessments, report, impacts }
  pictureCache.set(scenario, picture)
  return picture
}
