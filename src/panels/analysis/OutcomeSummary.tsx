import type { Scenario } from '../../model/types'
import type { AttritionReport } from '../../playback/attrition'
import type { ThreatAssessment } from '../../playback/sim'
import { formatTime } from '../../geometry/geo'

function expectedCount(value: number): string {
  if (value === 0) return '0'
  if (value < 0.1) return value.toFixed(2)
  return value.toFixed(1)
}

function Metric({ label, value, sub, cls = '' }: { label: string; value: string; sub: string; cls?: string }) {
  return (
    <div className="outcome-metric">
      <span>{label}</span>
      <strong className={cls}>{value}</strong>
      <small>{sub}</small>
    </div>
  )
}

export function OutcomeSummary({
  scenario,
  assessments,
  report,
}: {
  scenario: Scenario
  assessments: ThreatAssessment[]
  report: AttritionReport
}) {
  const raid = report.totals.raidSize
  const defeatPct = raid > 0 ? (report.totals.expectedKills / raid) * 100 : 0
  const residualPct = raid > 0 ? (report.totals.expectedLeakers / raid) * 100 : 0
  const firstDetect = assessments.reduce<number | null>(
    (min, assessment) =>
      assessment.firstDetectS != null && (min == null || assessment.firstDetectS < min)
        ? assessment.firstDetectS
        : min,
    null,
  )
  const firstEffect = report.events.reduce<number | null>(
    (min, event) => (min == null || event.tEffectS < min ? event.tEffectS : min),
    null,
  )
  const warnings = assessments
    .map((assessment) => assessment.warningS)
    .filter((value): value is number => value != null)
  const minWarning = warnings.length > 0 ? Math.min(...warnings) : null
  const salvos = report.totals.shotsFired + report.totals.jamSalvos
  return (
    <div className="outcome-summary">
      <div className="outcome-grid">
        <Metric label="Defeat" value={`${defeatPct.toFixed(1)}%`} sub={`${expectedCount(report.totals.expectedKills)} of ${raid} ships`} cls="good" />
        <Metric label="Residual" value={`${residualPct.toFixed(1)}%`} sub={`${expectedCount(report.totals.expectedLeakers)} expected ships`} cls={residualPct > 5 ? 'bad' : ''} />
        <Metric label="First detect" value={firstDetect == null ? '—' : formatTime(firstDetect)} sub="earliest track" />
        <Metric label="First effect" value={firstEffect == null ? '—' : formatTime(firstEffect)} sub="effect landed" />
        <Metric label="Min warning" value={minWarning == null ? '—' : formatTime(minWarning)} sub="worst threat" />
        <Metric label="Salvos" value={`${salvos}`} sub={`${report.totals.shotsFired} kinetic · ${report.totals.jamSalvos} EW`} />
      </div>
      {report.effectors.length > 0 && (
        <div className="capacity-list">
          {report.effectors.map((row) => {
            const entity = scenario.entities.find((candidate) => candidate.id === row.effectorId)
            const model = scenario.library.find((candidate) => candidate.id === entity?.specId)
            const used = row.shotsFired + row.jamSalvos
            const total = model?.effector?.magazineSize ?? null
            return (
              <div className="capacity-row" key={row.effectorId}>
                <span>{entity?.name ?? row.effectorId}</span>
                <strong>{used} salvos</strong>
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
