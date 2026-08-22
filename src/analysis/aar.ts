import type {
  AarEffectorShots,
  AarOutcome,
  AarSummary,
  AarThreatRow,
  Scenario,
} from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport, ThreatAttrition } from '../playback/attrition'
import type { LeakerImpact } from './impact'

/**
 * After-action summary: composes the threat assessments (detect/classify
 * timeline) and the attrition report (shots/kills/magazines) into one small,
 * self-contained, JSON-serializable object. Pure function of its inputs; no
 * store imports. Names are captured at summary time so a pinned summary still
 * renders after the laydown changes.
 */

/** Compact outcome label from the expected-value numbers. */
export function aarOutcome(att: ThreatAttrition | undefined): AarOutcome {
  if (!att || att.shotsFired === 0) return 'not-engaged'
  if (att.leakProbability > 0.5) return 'leaker'
  return att.expectedHardKills >= att.expectedSoftKills ? 'hard-kill' : 'soft-kill'
}

export function buildAarSummary(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
  impacts: LeakerImpact[],
): AarSummary {
  const name = (id: string | null): string | null =>
    id == null ? null : (scenario.entities.find((e) => e.id === id)?.name ?? null)

  const threats: AarThreatRow[] = assessments
    .filter((a) => a.status !== 'no-path')
    .map((a) => {
      const att = report.threats.find((t) => t.uasId === a.uasId)
      const imp = impacts.find((i) => i.uasId === a.uasId)
      return {
        uasId: a.uasId,
        name: name(a.uasId) ?? a.uasId,
        shipCount: att?.shipCount ?? 1,
        detectS: a.firstDetectS,
        detectSensorName: name(a.firstDetectSensorId),
        unknownAtS: a.classificationAtS.unknownAtS,
        suspectedAtS: a.classificationAtS.suspectedAtS,
        hostileAtS: a.classificationAtS.hostileAtS,
        engageS: att?.firstShotS ?? null,
        shotsFired: att?.shotsFired ?? 0,
        expectedHardKills: att?.expectedHardKills ?? 0,
        expectedSoftKills: att?.expectedSoftKills ?? 0,
        leakProbability: att?.leakProbability ?? 1,
        outcome: aarOutcome(att),
        killedByName: att ? name(att.killedByEffectorId) : null,
        // Engagement-potential fields; absent when no impact row exists so
        // old-shape pins and new summaries share one optional contract.
        ...(imp
          ? {
              assetName: imp.assetName,
              arrivalS: imp.arrivalS,
              assetInWez: imp.assetInWez,
              expectedShipsArriving: imp.expectedShipsArriving,
              expectedWarheadKg: imp.expectedWarheadKg,
              impactSeverity: imp.severity,
            }
          : {}),
      }
    })

  const effectors: AarEffectorShots[] = report.effectors.map((e) => {
    const ent = scenario.entities.find((x) => x.id === e.effectorId)
    const spec = scenario.library.find((m) => m.id === ent?.specId)?.effector
    return {
      effectorId: e.effectorId,
      name: ent?.name ?? e.effectorId,
      effectorType: spec?.effectorType ?? null,
      shotsFired: e.shotsFired,
      expectedRoundsRemaining: e.expectedRoundsRemaining,
      magazineSize: spec?.magazineSize ?? null,
    }
  })

  const minOf = (vals: Array<number | null>): number | null =>
    vals.reduce<number | null>((m, v) => (v != null && (m == null || v < m) ? v : m), null)

  const { totals } = report
  return {
    roe: scenario.roe ?? 'tight',
    raidSize: totals.raidSize,
    expectedHardKills: totals.expectedHardKills,
    expectedSoftKills: totals.expectedSoftKills,
    expectedKills: totals.expectedKills,
    expectedLeakers: totals.expectedLeakers,
    leakProbability: totals.raidSize > 0 ? totals.expectedLeakers / totals.raidSize : null,
    firstDetectS: minOf(threats.map((t) => t.detectS)),
    firstShotS: minOf(threats.map((t) => t.engageS)),
    shotsFired: totals.shotsFired,
    effectors,
    threats,
  }
}
