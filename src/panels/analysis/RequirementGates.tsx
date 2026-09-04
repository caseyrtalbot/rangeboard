import type { RequirementGate, RequirementGateReport } from '../../analysis/requirements'
import { SURVIVAL_LABELS } from './widgets/labels'

const STATUS_LABEL: Record<RequirementGate['status'], string> = {
  pass: 'PASS',
  fail: 'FAIL',
  'not-evaluated': 'NOT RUN',
}

function GateCard({ gate }: { gate: RequirementGate }) {
  return (
    <div className={`requirement-gate gate-${gate.status}`}>
      <div className="gate-head">
        <span className={`status gate-status ${gate.status === 'pass' ? 'good' : gate.status === 'fail' ? 'bad' : 'neutral'}`}>
          {STATUS_LABEL[gate.status]}
        </span>
        <strong>{gate.id === 'effect' ? SURVIVAL_LABELS.limit : gate.label}</strong>
        <span className="gate-count">
          {gate.met}/{gate.required}
        </span>
      </div>
      <div className="gate-metric">{gate.metric}</div>
      <div className="gate-detail">{gate.detail}</div>
      {gate.notEvaluatedReason && (
        <div className="gate-detail">NOT SCORED: {gate.notEvaluatedReason}</div>
      )}
      {gate.caveats.map((caveat) => (
        <div className="gate-detail" key={caveat}>
          CAVEAT: {caveat}
        </div>
      ))}
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

export function RequirementGates({ report }: { report: RequirementGateReport }) {
  const label =
    report.overall === 'pass'
      ? 'REQUIREMENTS MET'
      : report.overall === 'fail'
        ? 'REQUIREMENTS NOT MET'
        : 'REQUIREMENTS NOT RUN'
  return (
    <div className="requirements-block">
      <div className={`requirements-verdict verdict-${report.overall}`}>
        <span>{label}</span>
        <strong>
          {report.met}/{report.required}
        </strong>
      </div>
      <div className="requirement-grid">
        {report.gates.map((gate) => (
          <GateCard key={gate.id} gate={gate} />
        ))}
      </div>
    </div>
  )
}
