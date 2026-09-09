import { FORECAST_IN_ANALYZE, FULL_RUN, type ExecutionHorizon } from '../../analysis/horizon'
import type { RequirementGate, RequirementGateReport } from '../../analysis/requirements'
import { SURVIVAL_LABELS } from './labels'
import { State } from '../../ui/kit'

const STATUS_LABEL: Record<RequirementGate['status'], string> = {
  pass: 'PASS',
  fail: 'FAIL',
  'not-evaluated': 'NOT RUN',
}

function GateCard({ gate, runWideCaveats }: { gate: RequirementGate; runWideCaveats: Set<string> }) {
  return (
    <div className={`requirement-gate gate-${gate.status}`}>
      <div className="gate-head">
        <State tone={gate.status === 'pass' ? 'nominal' : gate.status === 'fail' ? 'critical' : 'inactive'}>
          {STATUS_LABEL[gate.status]}
        </State>
        <strong>{gate.id === 'effect' ? SURVIVAL_LABELS.limit : gate.label}</strong>
        <span className="gate-count">
          {gate.met}/{gate.required}
        </span>
      </div>
      <div className="gate-metric" title={gate.detail}>{gate.metric}</div>
      {gate.status === 'not-evaluated' && gate.notEvaluatedReason && (
        <div className="gate-detail">{gate.notEvaluatedReason}</div>
      )}
      <details>
        <summary>Why</summary>
        <div className="gate-detail">{gate.detail}</div>
        {gate.caveats.filter((caveat) => !runWideCaveats.has(caveat)).map((caveat) => (
          <div className="gate-detail" key={caveat}>
            CAVEAT: {caveat}
          </div>
        ))}
      </details>
      {gate.failures.length > 0 && (
        <details className="gate-failures">
          <summary>
            {gate.failures.length} blocking {gate.failures.length === 1 ? 'track' : 'tracks'}
          </summary>
          {gate.failures.slice(0, 8).map((failure) => (
            <div key={failure.uasId} title={failure.name}>
              {failure.name} · {failure.reason}
            </div>
          ))}
          {gate.failures.length > 8 && <div>+{gate.failures.length - 8} more in export</div>}
        </details>
      )}
    </div>
  )
}

export function RequirementGates({ report, horizon = FULL_RUN }: { report: RequirementGateReport; horizon?: ExecutionHorizon }) {
  if (horizon.scoped) return <p className="muted small">{FORECAST_IN_ANALYZE}</p>
  const runWideCaveats = new Set(
    (report.gates[0]?.caveats ?? []).filter((caveat) =>
      report.gates.every((gate) => gate.caveats.includes(caveat)),
    ),
  )
  const label =
    report.overall === 'pass'
      ? 'REQUIREMENTS MET'
      : report.overall === 'fail'
        ? 'REQUIREMENTS NOT MET'
        : 'REQUIREMENTS NOT RUN'
  return (
    <div className="requirements-block">
      <div
        className={`requirements-verdict verdict-${report.overall}`}
        title="Planning envelope · test-defined thresholds. No MC probability of pass is calculated."
      >
        <span>{label}</span>
        <strong>
          {report.met}/{report.required}
        </strong>
      </div>
      {runWideCaveats.size > 0 && (
        <details>
          <summary>{runWideCaveats.size} run-wide caveats</summary>
          {[...runWideCaveats].map((caveat) => (
            <div className="gate-detail" key={caveat}>{caveat}</div>
          ))}
        </details>
      )}
      <div className="requirement-grid">
        {report.gates.map((gate) => (
          <GateCard key={gate.id} gate={gate} runWideCaveats={runWideCaveats} />
        ))}
      </div>
    </div>
  )
}
