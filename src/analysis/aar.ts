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
 * After-action summary: composes the threat assessments (detect/classify
 * timeline) and the attrition report (shots/kills/magazines) into one small,
 * self-contained, JSON-serializable object. Pure function of its inputs; no
 * store imports. Names are captured at summary time so a pinned summary still
 * renders after the laydown changes.
 *
 * AarSummary is a PINNED shape: Scenario.scorecards holds copies made by
 * older builds. Adding a field is safe and every added field is optional on
 * the type, so an old pin still parses. Changing what an existing field MEANS
 * is not safe, so expectedLeakers keeps carrying UNDEFEATED ships, the one
 * combined figure it has always held.
 *
 * Expenditure splits three ways by effector class, independently of the kill
 * channel: shotsFired (kinetic rounds), deSalvos (directed-energy bursts),
 * jamSalvos (EW salvos). Defeat splits by arrival: expectedKills is
 * pre-arrival mass, and expectedLateKills is destruction that landed after
 * the threat was already over the asset.
 */

/**
 * Compact outcome label from the expected-value numbers.
 *
 * 'not-engaged' means no salvo of ANY expenditure channel reached the threat.
 * Expenditure splits three ways (kinetic rounds, directed-energy bursts, EW
 * salvos), so a DE or HPM engagement spends deSalvos and leaves both other
 * counters at zero. Testing only shotsFired and jamSalvos reported a
 * completed directed-energy engagement as never engaged.
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
    // UNDEFEATED ships, which is the leaker bucket plus the never-arrived
    // bucket. AttritionTotals splits those two, but AarSummary is a pinned,
    // serialized shape compared against older pins, so it keeps the combined
    // figure it has always carried. It claims only "not defeated", never
    // "reached an asset". Read AttritionTotals.reportedLeakers for the
    // measurable leaker count.
    expectedLeakers: undefeated,
    // The never-arrived half of that combined figure, so a reader can split
    // it again without the report. expectedLateKills is the destruction that
    // landed after arrival: it sits INSIDE the undefeated mass and is never
    // added to expectedKills, because a defeat that late did not defend the
    // asset. Without it a run stopped only by late intercepts reads as a pure
    // leak with no explanation.
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
