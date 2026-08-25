import type { Scenario } from '../../model/types'
import type { AttritionReport } from '../../playback/attrition'
import type { ThreatAssessment } from '../../playback/sim'
import { formatTime } from '../../geometry/geo'
import {
  expenditureBreakdown,
  expenditureParts,
  residualHeadline,
  totalSalvos,
} from '../headlines'

function expectedCount(value: number): string {
  if (value === 0) return '0'
  if (value < 0.1) return value.toFixed(2)
  return value.toFixed(1)
}

function Metric({
  label,
  value,
  sub,
  cls = '',
  title,
  wide = false,
}: {
  label: string
  value: string
  sub: string
  cls?: string
  title?: string
  wide?: boolean
}) {
  return (
    <div className={`outcome-metric${wide ? ' wide' : ''}`} title={title}>
      <span>{label}</span>
      <strong className={cls}>{value}</strong>
      <small>{sub}</small>
    </div>
  )
}

/**
 * Run outcome as a set of independent measures, never a rolled-up score.
 *
 * Three of the tiles carry a rule a reader cannot see in the number itself.
 * Defeat is PRE-ARRIVAL mass only. Late E[k] is destruction that landed after
 * the threat was already over the asset: real, but it defended nothing, so it
 * is shown apart and never added to the defeat. Residual reads the DISPLAY
 * leaker figure (reportedLeakers), which is null when no defended asset is
 * placed; that run gets a dash and a reason, because printing the partition
 * term there would claim a perfect defence the run never demonstrated.
 */
export function OutcomeSummary({
  scenario,
  assessments,
  report,
}: {
  scenario: Scenario
  assessments: ThreatAssessment[]
  report: AttritionReport
}) {
  const totals = report.totals
  const raid = totals.raidSize
  const defeatPct = raid > 0 ? (totals.expectedKills / raid) * 100 : 0
  const residual = residualHeadline(totals)
  const firstDetect = assessments.reduce<number | null>(
    (min, assessment) =>
      assessment.firstDetectS != null && (min == null || assessment.firstDetectS < min)
        ? assessment.firstDetectS
        : min,
    null,
  )
  // An effect is an effect only when it removed kill mass. A 'continue' jam
  // dwell degrades the track and removes nothing, so it must never set the
  // moment the first effect landed (threatAggregation.firstEffectS applies
  // the same rule).
  const firstEffect = report.events.reduce<number | null>(
    (min, event) =>
      event.killDelta > 0 && (min == null || event.tEffectS < min) ? event.tEffectS : min,
    null,
  )
  const warnings = assessments
    .map((assessment) => assessment.warningS)
    .filter((value): value is number => value != null)
  const minWarning = warnings.length > 0 ? Math.min(...warnings) : null
  const salvos = totalSalvos(totals)
  return (
    <div className="outcome-summary">
      <div className="outcome-grid">
        <Metric
          label="Defeat"
          value={`${defeatPct.toFixed(1)}%`}
          sub={`${expectedCount(totals.expectedKills)} of ${raid} ships`}
          cls="good"
          title="Expected kill mass whose effect landed at or before the threat reached the defended asset. Late intercepts are not counted here."
        />
        <Metric
          label="Residual"
          value={residual.value}
          sub={residual.sub}
          cls={residual.bad ? 'bad' : ''}
          title="Expected ship mass that reached a defended asset. Not measurable when the laydown places no asset."
        />
        <Metric
          label="Late E[k]"
          value={expectedCount(totals.expectedLateKills)}
          sub="after arrival, not a defeat"
          cls={totals.expectedLateKills > 0.05 ? 'warn' : ''}
          title="Expected kill mass intercepted after the threat was already over the defended asset. The airframe was destroyed, but too late to protect the asset, so it is not a defeat and it does not reduce the residual."
        />
        <Metric
          label="First detect"
          value={firstDetect == null ? '—' : formatTime(firstDetect)}
          sub="earliest track"
        />
        <Metric
          label="First effect"
          value={firstEffect == null ? '—' : formatTime(firstEffect)}
          sub="kill mass removed"
          title="First effect that removed kill mass. A jam dwell that only degrades the track is not an effect here."
        />
        <Metric
          label="Min warning"
          value={minWarning == null ? '—' : formatTime(minWarning)}
          sub="worst threat"
        />
        <Metric
          label="Salvos"
          value={`${salvos}`}
          sub={expenditureBreakdown(totals)}
          wide
          title="Salvos by what each one cost: kinetic rounds, directed-energy bursts, EW salvos."
        />
      </div>
      {report.effectors.length > 0 && (
        <div className="capacity-list">
          {report.effectors.map((row) => {
            const entity = scenario.entities.find((candidate) => candidate.id === row.effectorId)
            const model = scenario.library.find((candidate) => candidate.id === entity?.specId)
            const spent = expenditureParts(row)
            const total = model?.effector?.magazineSize ?? null
            return (
              <div className="capacity-row" key={row.effectorId}>
                <span>{entity?.name ?? row.effectorId}</span>
                <strong>{spent.length > 0 ? spent.join(' · ') : 'no salvos'}</strong>
                <small>
                  {total == null ? 'continuous capacity' : `${row.expectedRoundsRemaining ?? 0}/${total} remaining`}
                </small>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
