import type { Scenario } from '../model/types'
import type { AttritionReport, ThreatAttrition } from '../playback/attrition'
import { SHIP_DEAD_BELOW } from '../playback/attrition'
import type { ThreatAssessment } from '../playback/sim'
import { formatTime } from '../geometry/geo'

export type RequirementGateId = 'detect' | 'track' | 'identify' | 'target' | 'engage' | 'effect'
export type RequirementGateStatus = 'pass' | 'fail' | 'not-evaluated'

export interface RequirementGate {
  id: RequirementGateId
  label: string
  status: RequirementGateStatus
  met: number
  required: number
  metric: string
  detail: string
  /** Every track that prevents this gate from passing. Never truncated in exports. */
  failures: Array<{ uasId: string; name: string; reason: string }>
}

export interface RequirementGateReport {
  overall: RequirementGateStatus
  met: number
  required: number
  gates: RequirementGate[]
}

function threatName(scenario: Scenario, uasId: string): string {
  return scenario.entities.find((e) => e.id === uasId)?.name ?? uasId
}

function heldAtDecision(a: ThreatAssessment, att: ThreatAttrition | undefined): {
  pass: boolean
  tS: number | null
} {
  const tS = att?.firstShotS ?? a.windowS?.[0] ?? a.arrivalS
  if (tS == null) return { pass: false, tS: null }
  const pass = (a.sensorObservations ?? []).some((observation) =>
    observation.intervals.some(([start, end]) => tS >= start - 0.25 && tS <= end + 0.25),
  )
  return { pass, tS }
}

function gate(
  scenario: Scenario,
  id: RequirementGateId,
  label: string,
  threats: ThreatAssessment[],
  test: (a: ThreatAssessment) => { pass: boolean; reason: string },
  metric: string,
  detail: string,
  notEvaluated = false,
): RequirementGate {
  if (threats.length === 0 || notEvaluated) {
    return {
      id,
      label,
      status: 'not-evaluated',
      met: 0,
      required: threats.length,
      metric: threats.length === 0 ? 'no tracks' : 'not run',
      detail,
      failures: [],
    }
  }
  const failures: RequirementGate['failures'] = []
  let met = 0
  for (const a of threats) {
    const result = test(a)
    if (result.pass) met += 1
    else failures.push({ uasId: a.uasId, name: threatName(scenario, a.uasId), reason: result.reason })
  }
  return {
    id,
    label,
    status: met === threats.length ? 'pass' : 'fail',
    met,
    required: threats.length,
    metric,
    detail,
    failures,
  }
}

/**
 * Six independent kill-chain requirements. No weighting or compensation:
 * the report passes only when every required track passes every gate.
 */
export function buildRequirementGateReport(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
): RequirementGateReport {
  const threats = assessments.filter((a) => a.status !== 'no-path')
  const attrition = new Map(report.threats.map((a) => [a.uasId, a]))
  const noEngagementRun = (scenario.roe ?? 'tight') === 'hold'
  const firstDetect = threats.reduce<number | null>(
    (min, a) =>
      a.firstDetectS != null && (min == null || a.firstDetectS < min) ? a.firstDetectS : min,
    null,
  )
  const minWarning = threats.reduce<number | null>(
    (min, a) => (a.warningS != null && (min == null || a.warningS < min) ? a.warningS : min),
    null,
  )
  const minWindow = threats.reduce<number | null>((min, a) => {
    const length = a.windowS ? a.windowS[1] - a.windowS[0] : null
    return length != null && (min == null || length < min) ? length : min
  }, null)
  const salvos = report.totals.shotsFired + report.totals.jamSalvos
  const defeatPct =
    report.totals.raidSize > 0 ? (report.totals.expectedKills / report.totals.raidSize) * 100 : 0

  const gates: RequirementGate[] = [
    gate(
      scenario,
      'detect',
      'Detect',
      threats,
      (a) => ({ pass: a.firstDetectS != null, reason: 'never detected' }),
      firstDetect == null ? 'none' : `first ${formatTime(firstDetect)}`,
      minWarning == null ? 'no asset warning time' : `minimum warning ${formatTime(minWarning)}`,
    ),
    gate(
      scenario,
      'track',
      'Track',
      threats,
      (a) => {
        const held = heldAtDecision(a, attrition.get(a.uasId))
        return {
          pass: held.pass,
          reason: held.tS == null ? 'no decision point' : `not held at ${formatTime(held.tS)}`,
        }
      },
      `${threats.filter((a) => heldAtDecision(a, attrition.get(a.uasId)).pass).length}/${threats.length} held`,
      'sensor hold at first shot, target-window opening, or asset arrival',
    ),
    gate(
      scenario,
      'identify',
      'Identify',
      threats,
      (a) => ({
        pass: a.classificationAtS.hostileAtS != null,
        reason: 'never reached hostile classification',
      }),
      `${threats.filter((a) => a.classificationAtS.hostileAtS != null).length}/${threats.length} hostile`,
      'every track must reach the hostile classification gate',
    ),
    gate(
      scenario,
      'target',
      'Target',
      threats,
      (a) => ({ pass: a.status === 'engageable', reason: a.status.replaceAll('-', ' ') }),
      `${threats.filter((a) => a.status === 'engageable').length}/${threats.length} usable`,
      minWindow == null ? 'no usable engagement window' : `shortest selected window ${formatTime(minWindow)}`,
      noEngagementRun,
    ),
    gate(
      scenario,
      'engage',
      'Engage',
      threats,
      (a) => {
        const att = attrition.get(a.uasId)
        const fired = (att?.shotsFired ?? 0) + (att?.jamSalvos ?? 0)
        return { pass: fired > 0, reason: 'no salvo assigned' }
      },
      `${threats.filter((a) => {
        const att = attrition.get(a.uasId)
        return (att?.shotsFired ?? 0) + (att?.jamSalvos ?? 0) > 0
      }).length}/${threats.length} engaged`,
      `${salvos} total salvos assigned`,
      noEngagementRun,
    ),
    gate(
      scenario,
      'effect',
      'Effect',
      threats,
      (a) => {
        const residual = attrition.get(a.uasId)?.leakProbability ?? 1
        return {
          pass: residual <= SHIP_DEAD_BELOW + 1e-9,
          reason: `${(residual * 100).toFixed(1)}% residual`,
        }
      },
      `${defeatPct.toFixed(1)}% defeat`,
      `${report.totals.expectedLeakers.toFixed(2)} expected ships residual · requirement ≤${(
        SHIP_DEAD_BELOW * 100
      ).toFixed(0)}% per track`,
      noEngagementRun,
    ),
  ]

  const evaluated = gates.filter((g) => g.status !== 'not-evaluated')
  const failed = evaluated.some((g) => g.status === 'fail')
  const incomplete = evaluated.length !== gates.length
  const overall: RequirementGateStatus = failed ? 'fail' : incomplete ? 'not-evaluated' : 'pass'
  return {
    overall,
    met: gates.filter((g) => g.status === 'pass').length,
    required: gates.length,
    gates,
  }
}
