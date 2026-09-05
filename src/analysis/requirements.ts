import type { RequirementThresholds, Scenario } from '../model/types'
import { DEFAULT_REQUIREMENT_THRESHOLDS, entityActive } from '../model/types'
import type { AttritionReport, ThreatAttrition } from '../playback/attritionReport'
import type { ThreatAssessment } from '../playback/sim'
import { formatTime } from '../geometry/geo'
import type { RunValidityAssessment, RunValidityFinding } from './runValidity'
import { assessRunValidity, findingsForGate, invalidatedTracksForGate } from './runValidity'

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
  /**
   * Run-validity notes that qualify this result: tracks dropped from the
   * population, and limits the run puts on what the number means.
   */
  caveats: string[]
  /** Why the gate was not scored. Null unless status is 'not-evaluated'. */
  notEvaluatedReason: string | null
  /** Every track that prevents this gate from passing. Never truncated in exports. */
  failures: Array<{ uasId: string; name: string; reason: string }>
}

export interface RequirementGateReport {
  /** Threshold decisions use the deterministic envelope, never an MC mean CI. */
  basis: 'planning-envelope'
  overall: RequirementGateStatus
  met: number
  required: number
  gates: RequirementGate[]
}

function threatName(scenario: Scenario, uasId: string): string {
  return scenario.entities.find((e) => e.id === uasId)?.name ?? uasId
}

/** Percent with at most one decimal and no trailing zero: 0.1 -> "10". */
function pct(fraction: number): string {
  return String(Number((fraction * 100).toFixed(1)))
}

/**
 * The moment the track had to be held, and whether a sensor held it.
 * Order of preference: first shot, then the opening of the target window,
 * then arrival at the defended asset, then closest point of approach. The CPA
 * fallback matters because arrival is null whenever the threat never crosses
 * a defended boundary, which is most tracks in a laydown with no asset or a
 * threat that turns away.
 */
function heldAtDecision(a: ThreatAssessment, att: ThreatAttrition | undefined): {
  pass: boolean
  tS: number | null
} {
  const tS = att?.firstShotS ?? a.windowS?.[0] ?? a.arrivalS ?? a.cpaS
  if (tS == null) return { pass: false, tS: null }
  const pass = (a.sensorObservations ?? []).some((observation) =>
    observation.intervals.some(([start, end]) => tS >= start - 0.25 && tS <= end + 0.25),
  )
  return { pass, tS }
}

interface GateSpec {
  id: RequirementGateId
  label: string
  /** Tracks this gate scores, after invalidated tracks are removed. */
  population: ThreatAssessment[]
  metric: string
  detail: string
  /** Set when the gate cannot be scored at all, whatever the population is. */
  notEvaluatedReason?: string | null
  test: (a: ThreatAssessment) => { pass: boolean; reason: string }
}

/**
 * One gate. A track the run cannot measure is removed from the POPULATION,
 * never scored as a pass and never scored as a fail, and the reason is
 * recorded in caveats. When nothing valid is left the gate is not evaluated.
 */
function buildGate(
  scenario: Scenario,
  threats: ThreatAssessment[],
  findings: RunValidityFinding[],
  spec: GateSpec,
): RequirementGate {
  const caveats: string[] = []
  for (const finding of findingsForGate(findings, spec.id)) {
    if (finding.severity === 'invalidating') {
      const dropped = threats.filter((a) => finding.uasIds.includes(a.uasId)).length
      if (dropped === 0) continue
      caveats.push(
        `${dropped} ${dropped === 1 ? 'track' : 'tracks'} not scored here. ${finding.message}`,
      )
    } else {
      caveats.push(finding.message)
    }
  }

  const reason: string | null =
    threats.length === 0
      ? 'no track has a flight path'
      : spec.notEvaluatedReason
        ? spec.notEvaluatedReason
        : spec.population.length === 0
          ? 'every track is invalidated by a run validity finding'
          : null

  if (reason != null) {
    return {
      id: spec.id,
      label: spec.label,
      status: 'not-evaluated',
      met: 0,
      required: threats.length,
      metric: threats.length === 0 ? 'no tracks' : 'not run',
      detail: spec.detail,
      caveats,
      notEvaluatedReason: reason,
      failures: [],
    }
  }

  const failures: RequirementGate['failures'] = []
  let met = 0
  for (const a of spec.population) {
    const result = spec.test(a)
    if (result.pass) met += 1
    else failures.push({ uasId: a.uasId, name: threatName(scenario, a.uasId), reason: result.reason })
  }
  return {
    id: spec.id,
    label: spec.label,
    status: met === spec.population.length ? 'pass' : 'fail',
    met,
    required: spec.population.length,
    metric: spec.metric,
    detail: spec.detail,
    caveats,
    notEvaluatedReason: null,
    failures,
  }
}

/**
 * Six independent kill-chain requirements. No weighting or compensation:
 * the report passes only when every valid track passes every gate.
 *
 * Every threshold is TEST-DEFINED (Scenario.requirements), never an engine
 * constant. A gate that reads its pass line from the model it grades cannot
 * fail, so those numbers stay in the scenario where the test engineer sets
 * them.
 *
 * Pass envelope `validity` when the caller already ran assessRunValidity, so the
 * spawn-in-ring sweep can be reused. MC-mode callers recompute envelope findings.
 */
export function buildRequirementGateReport(
  scenario: Scenario,
  assessments: ThreatAssessment[],
  report: AttritionReport,
  validity?: RunValidityAssessment,
): RequirementGateReport {
  const threats = assessments.filter((a) => a.status !== 'no-path')
  const attrition = new Map(report.threats.map((a) => [a.uasId, a]))
  const noEngagementRun = (scenario.roe ?? 'tight') === 'hold'
  const holdReason = 'ROE hold: the run assigns no engagements'
  const thresholds: RequirementThresholds = {
    ...DEFAULT_REQUIREMENT_THRESHOLDS,
    ...scenario.requirements,
  }
  // A supplied MC assessment can name parameter-spread models these gates never use.
  // Recompute the full envelope findings, rather than mixing the two validity bases.
  const envelopeValidity = scenario.runMode === 'monte-carlo'
    ? assessRunValidity({ ...scenario, runMode: 'deterministic' }, assessments)
    : validity ?? assessRunValidity(scenario, assessments)
  const findings = envelopeValidity.findings
  const population = (id: RequirementGateId): ThreatAssessment[] => {
    const invalid = invalidatedTracksForGate(findings, id)
    return invalid.size === 0 ? threats : threats.filter((a) => !invalid.has(a.uasId))
  }
  const hasAsset = scenario.entities.some((e) => e.kind === 'asset' && entityActive(e))

  const detectPop = population('detect')
  const trackPop = population('track')
  const identifyPop = population('identify')
  const targetPop = population('target')
  const engagePop = population('engage')
  const effectPop = population('effect')

  const firstDetect = detectPop.reduce<number | null>(
    (min, a) =>
      a.firstDetectS != null && (min == null || a.firstDetectS < min) ? a.firstDetectS : min,
    null,
  )
  const minWarning = detectPop.reduce<number | null>(
    (min, a) => (a.warningS != null && (min == null || a.warningS < min) ? a.warningS : min),
    null,
  )
  const minWindow = targetPop.reduce<number | null>((min, a) => {
    const length = a.windowS ? a.windowS[1] - a.windowS[0] : null
    return length != null && (min == null || length < min) ? length : min
  }, null)
  const salvos = report.totals.shotsFired + report.totals.deSalvos + report.totals.jamSalvos
  // Pre-arrival defeat mass only: a kill that landed after the threat was over
  // the asset is in expectedLateKills and never counts as a defeat here.
  const defeatPct =
    report.totals.raidSize > 0 ? (report.totals.expectedKills / report.totals.raidSize) * 100 : 0
  // Residual is a leaker count, so it is measurable only against a defended
  // asset. AttritionTotals.reportedLeakers is null when the laydown places
  // none, and saying so is honest where 0.00 would read as a perfect defence.
  const residualText =
    report.totals.reportedLeakers == null
      ? 'residual not measurable: no defended asset placed'
      : `${report.totals.reportedLeakers.toFixed(2)} expected ships residual`

  const warningReq = thresholds.minWarningS
  const warningBasis = !hasAsset
    ? 'no defended asset placed'
    : minWarning == null
      ? 'no track reached a defended asset'
      : `minimum warning ${formatTime(minWarning)}`

  const gates: RequirementGate[] = [
    buildGate(scenario, threats, findings, {
      id: 'detect',
      label: 'Detect',
      population: detectPop,
      test: (a) => {
        if (a.firstDetectS == null) return { pass: false, reason: 'never detected' }
        if (a.arrivalS != null && a.firstDetectS >= a.arrivalS) {
          return {
            pass: false,
            reason: `detected ${formatTime(a.firstDetectS)}, not before arrival ${formatTime(a.arrivalS)}`,
          }
        }
        if (warningReq != null) {
          if (a.warningS == null) return { pass: false, reason: 'no measurable warning time' }
          if (a.warningS < warningReq) {
            return {
              pass: false,
              reason: `${formatTime(a.warningS)} warning, requirement ${formatTime(warningReq)}`,
            }
          }
        }
        return { pass: true, reason: '' }
      },
      metric: firstDetect == null ? 'none' : `first ${formatTime(firstDetect)}`,
      detail:
        warningReq == null
          ? warningBasis
          : `${warningBasis} · requirement ≥${formatTime(warningReq)} warning (scenario setting)`,
      notEvaluatedReason:
        warningReq != null && !hasAsset
          ? 'a warning time requirement is set but no defended asset is placed'
          : null,
    }),
    buildGate(scenario, threats, findings, {
      id: 'track',
      label: 'Track',
      population: trackPop,
      test: (a) => {
        const held = heldAtDecision(a, attrition.get(a.uasId))
        return {
          pass: held.pass,
          reason: held.tS == null ? 'no decision point' : `not held at ${formatTime(held.tS)}`,
        }
      },
      metric: `${trackPop.filter((a) => heldAtDecision(a, attrition.get(a.uasId)).pass).length}/${trackPop.length} held`,
      detail:
        'sensor hold at first shot, target-window opening, asset arrival, or closest approach when the track never arrives',
    }),
    buildGate(scenario, threats, findings, {
      id: 'identify',
      label: 'Identify',
      population: identifyPop,
      test: (a) => ({
        pass: a.classificationAtS.hostileAtS != null,
        reason: 'never reached hostile classification',
      }),
      metric: `${identifyPop.filter((a) => a.classificationAtS.hostileAtS != null).length}/${identifyPop.length} hostile`,
      detail: 'every track must reach the hostile classification gate',
    }),
    buildGate(scenario, threats, findings, {
      id: 'target',
      label: 'Target',
      population: targetPop,
      test: (a) => ({
        pass: a.status === 'engageable',
        reason: a.status === 'no-fc-uplink'
          ? 'fire-control uplink required: route has no fire-control sensor; geometry only, no shot'
          : a.status.replaceAll('-', ' '),
      }),
      metric: `${targetPop.filter((a) => a.status === 'engageable').length}/${targetPop.length} usable`,
      detail:
        minWindow == null ? 'no usable engagement window' : `shortest selected window ${formatTime(minWindow)}`,
      notEvaluatedReason: noEngagementRun ? holdReason : null,
    }),
    buildGate(scenario, threats, findings, {
      id: 'engage',
      label: 'Engage',
      population: engagePop,
      test: (a) => {
        const att = attrition.get(a.uasId)
        const fired = (att?.shotsFired ?? 0) + (att?.deSalvos ?? 0) + (att?.jamSalvos ?? 0)
        return { pass: fired > 0, reason: 'no salvo assigned' }
      },
      metric: `${engagePop.filter((a) => {
        const att = attrition.get(a.uasId)
        return (att?.shotsFired ?? 0) + (att?.deSalvos ?? 0) + (att?.jamSalvos ?? 0) > 0
      }).length}/${engagePop.length} engaged`,
      detail: `${salvos} total salvos assigned`,
      notEvaluatedReason: noEngagementRun ? holdReason : null,
    }),
    buildGate(scenario, threats, findings, {
      id: 'effect',
      label: 'Effect',
      population: effectPop,
      test: (a) => {
        const residual = attrition.get(a.uasId)?.leakProbability ?? 1
        return {
          pass: residual <= thresholds.maxResidualPerTrack + 1e-9,
          reason: `${(residual * 100).toFixed(1)}% residual`,
        }
      },
      metric: `${defeatPct.toFixed(1)}% defeat`,
      detail: `${residualText} · requirement ≤${pct(
        thresholds.maxResidualPerTrack,
      )}% per track (scenario setting)`,
      notEvaluatedReason: noEngagementRun ? holdReason : null,
    }),
  ]

  const evaluated = gates.filter((g) => g.status !== 'not-evaluated')
  const failed = evaluated.some((g) => g.status === 'fail')
  const incomplete = evaluated.length !== gates.length
  const overall: RequirementGateStatus = failed ? 'fail' : incomplete ? 'not-evaluated' : 'pass'
  return {
    basis: 'planning-envelope',
    overall,
    met: gates.filter((g) => g.status === 'pass').length,
    required: gates.length,
    gates,
  }
}
