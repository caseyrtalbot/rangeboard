import { useMemo } from 'react'
import { useStore } from '../state/store'
import { assessAllThreats } from '../playback/sim'
import type { ThreatAssessment, ThreatStatus } from '../playback/sim'
import { formatDistance, formatTime } from '../geometry/geo'

const STATUS_TEXT: Record<ThreatStatus, { label: string; cls: string }> = {
  'no-path': { label: 'No flight path', cls: 'neutral' },
  'never-detected': { label: 'Never detected', cls: 'bad' },
  'detect-only': { label: 'Detected, no effector on board', cls: 'warn' },
  'no-kill-chain': { label: 'Detected, kill chain not connected', cls: 'warn' },
  'window-too-short': { label: 'Engagement window too short', cls: 'warn' },
  engageable: { label: 'Engageable', cls: 'good' },
}

function ThreatRow({ a }: { a: ThreatAssessment }) {
  const scenario = useStore((s) => s.scenario)
  const name = (id: string | null) => scenario.entities.find((e) => e.id === id)?.name ?? '—'
  const status = STATUS_TEXT[a.status]
  const winLen = a.windowS ? a.windowS[1] - a.windowS[0] : null

  return (
    <div className="threat-row">
      <div className="threat-head">
        <span className="threat-name">{name(a.uasId)}</span>
        <span className={`status ${status.cls}`}>{status.label}</span>
      </div>
      {a.status !== 'no-path' && (
        <table className="threat-table">
          <tbody>
            <tr>
              <td>First detection</td>
              <td>
                {a.firstDetectS != null
                  ? `${formatTime(a.firstDetectS)} by ${name(a.firstDetectSensorId)}`
                  : 'none'}
              </td>
            </tr>
            <tr>
              <td>Arrival at asset</td>
              <td>
                {a.arrivalS != null
                  ? `${formatTime(a.arrivalS)} · ${name(a.assetId)} · CPA ${formatDistance(
                      a.closestApproachM ?? 0,
                    )}`
                  : 'no asset placed'}
              </td>
            </tr>
            <tr>
              <td>Warning time</td>
              <td>{a.warningS != null ? formatTime(a.warningS) : '—'}</td>
            </tr>
            <tr>
              <td>Best window</td>
              <td>
                {a.windowS
                  ? `${formatTime(a.windowS[0])} – ${formatTime(a.windowS[1])} (${Math.round(
                      winLen ?? 0,
                    )} s) · ${name(a.windowEffectorId)}`
                  : 'none after detection'}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

/** Scenario covariates: wind, temperature, field elevation. Feed range rings. */
function EnvironmentEditor() {
  const env = useStore((s) => s.scenario.environment)
  const updateEnvironment = useStore((s) => s.updateEnvironment)
  return (
    <div className="subsection">
      <div className="panel-subtitle">Environment (covariates)</div>
      <Field label="Apply to range estimates">
        <input
          type="checkbox"
          checked={env.apply}
          onChange={(e) => updateEnvironment({ apply: e.target.checked })}
        />
      </Field>
      <div className="field-row">
        <Field label="Wind (m/s)">
          <input
            type="number"
            min={0}
            value={env.windSpeedMps}
            onChange={(e) => updateEnvironment({ windSpeedMps: Math.max(0, Number(e.target.value)) })}
          />
        </Field>
        <Field label="Wind from (deg)">
          <input
            type="number"
            min={0}
            max={359}
            value={env.windFromDeg}
            onChange={(e) =>
              updateEnvironment({ windFromDeg: ((Number(e.target.value) % 360) + 360) % 360 })
            }
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Temperature (C)">
          <input
            type="number"
            value={env.temperatureC}
            onChange={(e) => updateEnvironment({ temperatureC: Number(e.target.value) })}
          />
        </Field>
        <Field label="Field elevation (ft)">
          <input
            type="number"
            step={500}
            value={env.fieldElevationFt}
            onChange={(e) => updateEnvironment({ fieldElevationFt: Number(e.target.value) })}
          />
        </Field>
      </div>
      <p className="muted small">
        Cold and altitude shrink battery-drone endurance; wind stretches one-way reach downwind
        and shrinks return-to-home reach. Coefficients are open-source planning estimates.
      </p>
    </div>
  )
}

/** Computed engagement picture for every threat with a flight path. */
export function AnalysisPanel() {
  const scenario = useStore((s) => s.scenario)
  const assessments = useMemo(() => assessAllThreats(scenario), [scenario])
  const threats = assessments.filter((a) => a.status !== 'no-path')
  const noPath = assessments.length - threats.length

  return (
    <div className="inspector-body">
      <EnvironmentEditor />
      <div className="panel-subtitle">Engagement analysis</div>
      {assessments.length === 0 && (
        <p className="muted">Place a UAS threat on the canvas to analyze it.</p>
      )}
      {threats.map((a) => (
        <ThreatRow key={a.uasId} a={a} />
      ))}
      {noPath > 0 && (
        <p className="muted">
          {noPath} UAS without a flight path. Draw a path with the Path tool to include them.
        </p>
      )}
      <p className="muted small">
        Warning time = arrival at the defended asset minus first detection. Windows start no
        earlier than first detection. Computed from specs and paths at 0.5 s steps; planning
        figures, not test evidence.
      </p>
    </div>
  )
}
