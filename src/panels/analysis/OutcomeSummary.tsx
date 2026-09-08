import type { Scenario } from '../../model/types'
import type { AttritionReport } from '../../playback/attritionReport'
import type { McSummary } from '../../playback/mcRun'
import type { ThreatAssessment } from '../../playback/sim'
import { formatTime } from '../../geometry/geo'
import {
  expectedCount,
  expenditureBreakdown,
  expenditureParts,
  residualHeadline,
  totalSalvos,
} from '../headlines'
import { forecastKillLabel, KPI_LABELS, SURVIVAL_LABELS } from './widgets/labels'
import { bandMean, countSub, statMean, timeStatSub } from './widgets/mc'

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
 * Expected kills with an asset include pre-arrival mass only. Expected late
 * kills stay separate and never reduce leakers. A null reportedLeakers value
 * stays unavailable because there is no defended asset to measure leakage at.
 */
export function OutcomeSummary({
  scenario,
  assessments,
  report,
  mc = null,
}: {
  scenario: Scenario
  assessments: ThreatAssessment[]
  report: AttritionReport
  /** The finished replicate summary of this run, when the run mode is Monte Carlo. */
  mc?: McSummary | null
}) {
  const totals = report.totals
  const reportedLeakers = totals.reportedLeakers
  const hasActiveAsset = reportedLeakers != null
  const raid = totals.raidSize
  const kills = mc ? bandMean(mc.kills, mc.kills.mean.length - 1, mc.replicates) : totals.expectedKills
  const leakers = mc ? bandMean(mc.leakers, mc.leakers.mean.length - 1, mc.replicates) : reportedLeakers
  const defeatPct = raid > 0 && kills != null ? (kills / raid) * 100 : null
  const residual = residualHeadline(totals)
  const envelopeFirstDetect = assessments.reduce<number | null>(
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
  const firstDetect = mc ? statMean(mc.firstDetectS) : envelopeFirstDetect
  const minWarning = !hasActiveAsset ? null : mc ? statMean(mc.minWarningS) : warnings.length > 0 ? Math.min(...warnings) : null
  const salvos = totalSalvos(totals)
  return (
    <div className="outcome-summary">
      <div className="outcome-grid">
        <Metric
          label={forecastKillLabel(hasActiveAsset)}
          value={defeatPct == null ? '—' : `${defeatPct.toFixed(1)}%`}
          sub={
            raid <= 0 ? 'no ships' : mc
              ? countSub(mc.kills, mc.kills.mean.length - 1, mc.replicates, 100 / raid, '%')
              : `planning envelope · ${expectedCount(totals.expectedKills)} of ${raid} ships`
          }
          cls="good"
          title={hasActiveAsset ? KPI_LABELS.killEk.hint : 'Expected neutralization mass over the full run; no defended asset placed.'}
        />
        <Metric
          label={mc ? SURVIVAL_LABELS.leakers : 'Residual survival'}
          value={reportedLeakers == null ? '—' : leakers == null ? '—' : mc ? expectedCount(leakers) : residual.value}
          sub={
            reportedLeakers == null ? residual.sub : mc
              ? `${countSub(mc.leakers, mc.leakers.mean.length - 1, mc.replicates)} · ships`
              : `planning envelope · ${residual.sub}`
          }
          cls={reportedLeakers != null && leakers != null && leakers > 0.05 ? 'bad' : ''}
          title="Expected ship mass that reached a defended asset. Not measurable when the laydown places no asset."
        />
        <Metric
          label={KPI_LABELS.lateEk.label}
          value={expectedCount(totals.expectedLateKills)}
          sub="planning envelope · after arrival, no asset protection"
          cls={totals.expectedLateKills > 0.05 ? 'warn' : ''}
          title="Expected kill mass after arrival, too late to protect the asset; it does not reduce the leaker count."
        />
        <Metric
          label="First detect"
          value={firstDetect == null ? '—' : formatTime(firstDetect)}
          sub={(mc && timeStatSub(mc.firstDetectS, 'detected')) ?? 'planning envelope · earliest track'}
        />
        <Metric
          label="First effect"
          value={firstEffect == null ? '—' : formatTime(firstEffect)}
          sub="planning envelope · expected kill mass removed"
          title="First effect that removed expected kill mass. A jam dwell that only degrades the track is not an effect here."
        />
        <Metric
          label="Min warning"
          value={minWarning == null ? '—' : formatTime(minWarning)}
          sub={!hasActiveAsset ? 'no defended asset placed' : (mc && timeStatSub(mc.minWarningS, 'warning')) ?? 'planning envelope · worst threat'}
        />
        <Metric
          label="Salvos"
          value={`${salvos}`}
          sub={`planning envelope · ${expenditureBreakdown(totals)}`}
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
                  planning envelope · {total == null ? 'continuous capacity' : `${row.expectedRoundsRemaining ?? 0}/${total} remaining`}
                </small>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
