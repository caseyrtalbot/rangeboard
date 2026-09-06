import type {
  AarEffectorShots,
  AarOutcome,
  AarSummary,
  AarThreatRow,
  Scenario,
} from '../model/types'
import type { ThreatAssessment } from '../playback/sim'
import type { AttritionReport, ThreatAttrition } from '../playback/attritionReport'
import type { LeakerImpact } from './impact'

/**
 * After-action summary: the threat assessments and the attrition report composed into
 * one JSON-serializable object. Pure; no store imports. Names are captured at summary
 * time so a pinned summary still renders after the laydown changes.
 *
 * AarSummary is a pinned shape: Scenario.scorecards holds copies made by older builds.
 * Every added field is optional and an existing field never changes meaning.
 * expectedLeakers carries undefeated ships: leakers plus never-arrived.
 *
 * Expenditure splits by effector class, independently of the kill channel: shotsFired
 * (kinetic rounds), deSalvos (directed-energy bursts), jamSalvos (EW salvos).
 * expectedKills is pre-arrival mass; expectedLateKills landed after arrival.
 */

/**
 * Compact outcome label from the expected-value numbers. 'not-engaged' means no salvo
 * of any expenditure channel reached the threat; a DE or HPM engagement spends deSalvos only.
 */
export function aarOutcome(att: ThreatAttrition | undefined): AarOutcome {
  if (!att || (att.shotsFired === 0 && att.deSalvos === 0 && att.jamSalvos === 0)) {
    return 'not-engaged'
  }
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
        deSalvos: att?.deSalvos ?? 0,
        jamSalvos: att?.jamSalvos ?? 0,
        expectedHardKills: att?.expectedHardKills ?? 0,
        expectedSoftKills: att?.expectedSoftKills ?? 0,
        leakProbability: att?.leakProbability ?? 1,
        outcome: aarOutcome(att),
        killedByName: att ? name(att.killedByEffectorId) : null,
        // Absent when no impact row exists: old-shape pins and new summaries share
        // one optional contract.
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
      deSalvos: e.deSalvos,
      jamSalvos: e.jamSalvos,
      expectedRoundsRemaining: e.expectedRoundsRemaining,
      magazineSize: spec?.magazineSize ?? null,
    }
  })

  const minOf = (vals: Array<number | null>): number | null =>
    vals.reduce<number | null>((m, v) => (v != null && (m == null || v < m) ? v : m), null)

  const { totals } = report
  const undefeated = totals.expectedLeakers + totals.expectedNoArrival
  return {
    roe: scenario.roe ?? 'tight',
    observedPresetId: scenario.observedPresetId ?? null,
    raidSize: totals.raidSize,
    expectedHardKills: totals.expectedHardKills,
    expectedSoftKills: totals.expectedSoftKills,
    expectedKills: totals.expectedKills,
    // Undefeated ships: leakers plus never-arrived, the pinned combined figure.
    // AttritionTotals.reportedLeakers is the measurable leaker count.
    expectedLeakers: undefeated,
    // expectedLateKills sits inside the undefeated mass and is never added to
    // expectedKills: a defeat after arrival did not defend the asset.
    expectedNoArrival: totals.expectedNoArrival,
    expectedLateKills: totals.expectedLateKills,
    leakProbability: totals.raidSize > 0 ? undefeated / totals.raidSize : null,
    firstDetectS: minOf(threats.map((t) => t.detectS)),
    firstShotS: minOf(threats.map((t) => t.engageS)),
    shotsFired: totals.shotsFired,
    deSalvos: totals.deSalvos,
    jamSalvos: totals.jamSalvos,
    effectors,
    threats,
  }
}
