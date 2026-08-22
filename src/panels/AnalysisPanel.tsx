import { useMemo } from 'react'
import type { EmBackground, LightLevel, McdaVector, Precipitation } from '../model/types'
import { newId } from '../model/types'
import { useStore } from '../state/store'
import { assessAllThreats } from '../playback/sim'
import type { ThreatAssessment, ThreatStatus } from '../playback/sim'
import { resolveEngagements } from '../playback/attrition'
import type { AttritionReport, ThreatAttrition } from '../playback/attrition'
import { formatDistance, formatTime } from '../geometry/geo'
import { mcdaParts, mcdaScore, WARNING_FULL_S } from '../analysis/mcda'

const STATUS_TEXT: Record<ThreatStatus, { label: string; cls: string }> = {
  'no-path': { label: 'No flight path', cls: 'neutral' },
  'never-detected': { label: 'Never detected', cls: 'bad' },
  'not-confirmed': { label: 'Detected, never confirmed by a 2nd technology', cls: 'warn' },
  'detect-only': { label: 'Detected, no usable effector', cls: 'warn' },
  'no-kill-chain': { label: 'Detected, kill chain not connected', cls: 'warn' },
  'window-too-short': { label: 'Engagement window too short', cls: 'warn' },
  engageable: { label: 'Engageable', cls: 'good' },
}

const TECH_LABEL: Record<string, string> = {
  radar: 'radar',
  'eo-ir': 'EO/IR',
  acoustic: 'acoustic',
  rf: 'RF',
}

function ThreatRow({ a, att }: { a: ThreatAssessment; att?: ThreatAttrition }) {
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
              <td>Confirmed (2 techs)</td>
              <td>
                {a.firstConfirmS != null
                  ? `${formatTime(a.firstConfirmS)} · ${a.techs.map((t) => TECH_LABEL[t]).join(' + ')}`
                  : a.techs.length === 1
                    ? `never · ${TECH_LABEL[a.techs[0]]} only`
                    : 'never'}
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
                  : 'none after track quality is met'}
              </td>
            </tr>
            <tr>
              <td>Shots fired</td>
              <td>
                {att && att.shotsFired > 0
                  ? `${att.shotsFired}${
                      att.firstShotS != null ? ` · first at ${formatTime(att.firstShotS)}` : ''
                    }${att.killedByEffectorId ? ` · ${name(att.killedByEffectorId)}` : ''}`
                  : 'none'}
              </td>
            </tr>
            <tr>
              <td>Leak probability</td>
              <td>
                {att
                  ? `${Math.round(att.leakProbability * 100)}%${
                      att.shipCount > 1
                        ? ` · ${att.expectedKills.toFixed(1)} of ${att.shipCount} ships expected killed`
                        : ''
                    }`
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {a.swarmMerged && (
        <p className="muted small">
          Formation merges into one track: no detecting sensor can split ships at this spacing.
          The defense does not know the count.
        </p>
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

/** Segmented control: one active option, no typing. */
function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.v}
          className={value === o.v ? 'active' : ''}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** Scenario covariates. Feed UAS range rings and sensor footprints. */
function EnvironmentEditor() {
  const env = useStore((s) => s.scenario.environment)
  const updateEnvironment = useStore((s) => s.updateEnvironment)
  const cardinal = CARDINALS[Math.round(env.windFromDeg / 45) % 8]
  return (
    <div className="subsection">
      <div className="panel-subtitle">Environment (covariates)</div>
      <Field label="Apply environment effects">
        <input
          type="checkbox"
          checked={env.apply}
          onChange={(e) => updateEnvironment({ apply: e.target.checked })}
        />
      </Field>
      <div className="field-row">
        <Field label="Sky">
          <Seg
            value={env.precipitation ?? 'clear'}
            options={[
              { v: 'clear' as Precipitation, label: 'Clear' },
              { v: 'rain' as Precipitation, label: 'Rain' },
              { v: 'fog' as Precipitation, label: 'Fog' },
            ]}
            onChange={(v) => updateEnvironment({ precipitation: v })}
          />
        </Field>
        <Field label="Light">
          <Seg
            value={env.light ?? 'day'}
            options={[
              { v: 'day' as LightLevel, label: 'Day' },
              { v: 'night' as LightLevel, label: 'Night' },
            ]}
            onChange={(v) => updateEnvironment({ light: v })}
          />
        </Field>
      </div>
      <Field label="EM clutter">
        <Seg
          value={env.emBackground ?? 'rural'}
          options={[
            { v: 'rural' as EmBackground, label: 'Rural (quiet)' },
            { v: 'urban' as EmBackground, label: 'Urban (dense)' },
          ]}
          onChange={(v) => updateEnvironment({ emBackground: v })}
        />
      </Field>
      <div className="field-row">
        <Field label={`Wind ${env.windSpeedMps} m/s`}>
          <input
            type="range"
            min={0}
            max={25}
            value={env.windSpeedMps}
            onChange={(e) => updateEnvironment({ windSpeedMps: Number(e.target.value) })}
          />
        </Field>
        <Field label={`From ${env.windFromDeg} deg (${cardinal})`}>
          <input
            type="range"
            min={0}
            max={355}
            step={5}
            value={env.windFromDeg}
            onChange={(e) => updateEnvironment({ windFromDeg: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label={`Temperature ${env.temperatureC} C`}>
          <input
            type="range"
            min={-30}
            max={50}
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
        Rain, fog, night, and EM clutter shrink sensor rings by technology. Cold, altitude, and
        wind reshape drone reach. Factors follow the COURAGEOUS C-UAS study; planning values.
      </p>
    </div>
  )
}

/** Per-effector expected magazine use from the attrition sweep. */
function EffectorSummary({ report }: { report: AttritionReport }) {
  const scenario = useStore((s) => s.scenario)
  if (report.effectors.length === 0 || report.totals.raidSize === 0) return null
  return (
    <div className="subsection">
      <div className="panel-subtitle">Effector magazines</div>
      <table className="threat-table">
        <tbody>
          {report.effectors.map((e) => {
            const ent = scenario.entities.find((x) => x.id === e.effectorId)
            const spec = scenario.library.find((m) => m.id === ent?.specId)?.effector
            const remaining =
              e.expectedRoundsRemaining != null
                ? `${e.expectedRoundsRemaining}${
                    spec?.magazineSize != null ? ` of ${spec.magazineSize}` : ''
                  } left${e.expectedRoundsRemaining <= 0 ? ' · empty' : ''}`
                : 'unlimited'
            return (
              <tr key={e.effectorId}>
                <td>{ent?.name ?? '—'}</td>
                <td>
                  {e.shotsFired} fired · {remaining}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted small">
        Expected raid outcome: {report.totals.expectedKills.toFixed(1)} of{' '}
        {report.totals.raidSize} ships killed, {report.totals.expectedLeakers.toFixed(1)} leak
        through, {report.totals.shotsFired} shots.
      </p>
    </div>
  )
}

const WEIGHT_LABELS: Array<{ key: keyof McdaVector; label: string }> = [
  { key: 'warning', label: 'Warning time' },
  { key: 'coverage', label: 'Detection coverage' },
  { key: 'confirm', label: 'Confirmed tracks' },
  { key: 'engage', label: 'Engageable threats' },
  { key: 'attrition', label: 'Attrition (expected kills)' },
]

/** Old saves have no attrition weight; default it without touching the save. */
function fullWeights(w?: McdaVector): Required<McdaVector> {
  return {
    warning: w?.warning ?? 3,
    coverage: w?.coverage ?? 3,
    confirm: w?.confirm ?? 2,
    engage: w?.engage ?? 3,
    attrition: w?.attrition ?? 3,
  }
}

/** Weighted configuration score (COURAGEOUS eq. 1) with pinned comparisons. */
function Scorecard({
  assessments,
  report,
}: {
  assessments: ThreatAssessment[]
  report: AttritionReport
}) {
  const scenario = useStore((s) => s.scenario)
  const patchScenario = useStore((s) => s.patchScenario)
  const weights = fullWeights(scenario.mcdaWeights)
  const parts = useMemo(() => mcdaParts(assessments, report), [assessments, report])
  const pinned = scenario.scorecards ?? []

  if (!parts && pinned.length === 0) return null
  const score = parts ? mcdaScore(parts, weights) : null

  return (
    <div className="subsection">
      <div className="panel-subtitle">Configuration score</div>
      {WEIGHT_LABELS.map(({ key, label }) => (
        <div className="field-row" key={key}>
          <Field label={`${label} · weight ${weights[key]}`}>
            <input
              type="range"
              min={0}
              max={5}
              value={weights[key]}
              onChange={(e) =>
                patchScenario({ mcdaWeights: { ...weights, [key]: Number(e.target.value) } })
              }
            />
          </Field>
          <div className="score-part">
            {parts?.[key] != null ? Math.round(parts[key]! * 100) : '—'}
          </div>
        </div>
      ))}
      {score != null && (
        <div className="score-total">
          <span>Weighted score</span>
          <strong>{score} / 100</strong>
          <button
            className="mini"
            onClick={() =>
              patchScenario({
                scorecards: [
                  ...pinned,
                  {
                    id: newId('scc'),
                    name: `Config ${pinned.length + 1}`,
                    score,
                    parts: parts!,
                  },
                ],
              })
            }
          >
            Pin for comparison
          </button>
        </div>
      )}
      {pinned.map((p) => (
        <div className="score-pin" key={p.id}>
          <input
            value={p.name}
            onChange={(e) =>
              patchScenario({
                scorecards: pinned.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)),
              })
            }
          />
          <strong>{p.score}</strong>
          <button
            className="mini"
            onClick={() => patchScenario({ scorecards: pinned.filter((x) => x.id !== p.id) })}
          >
            ×
          </button>
        </div>
      ))}
      <p className="muted small">
        Parts are 0-100 over threats with paths; warning time scores full at {WARNING_FULL_S} s.
        Pin the score, change the laydown or environment, and compare.
      </p>
    </div>
  )
}

/** Computed engagement picture for every threat with a flight path. */
export function AnalysisPanel() {
  const scenario = useStore((s) => s.scenario)
  const patchScenario = useStore((s) => s.patchScenario)
  const assessments = useMemo(() => assessAllThreats(scenario), [scenario])
  const report = useMemo(() => resolveEngagements(scenario), [scenario])
  const threats = assessments.filter((a) => a.status !== 'no-path')
  const noPath = assessments.length - threats.length

  return (
    <div className="inspector-body">
      <EnvironmentEditor />
      <div className="panel-subtitle">Engagement analysis</div>
      <Field label="Engage on">
        <Seg
          value={scenario.engageOn ?? 'detected'}
          options={[
            { v: 'detected' as const, label: 'Detected track' },
            { v: 'confirmed' as const, label: 'Confirmed (2 techs)' },
          ]}
          onChange={(v) => patchScenario({ engageOn: v })}
        />
      </Field>
      {assessments.length === 0 && (
        <p className="muted">Place a UAS threat on the canvas to analyze it.</p>
      )}
      {threats.map((a) => (
        <ThreatRow key={a.uasId} a={a} att={report.threats.find((t) => t.uasId === a.uasId)} />
      ))}
      {threats.length > 0 && <EffectorSummary report={report} />}
      {noPath > 0 && (
        <p className="muted">
          {noPath} UAS without a flight path. Draw a path with the Path tool to include them.
        </p>
      )}
      <Scorecard assessments={assessments} report={report} />
      <p className="muted small">
        Warning time = arrival at the defended asset minus first detection. Windows start when the
        selected track quality is met. RF sensors do not see RF-silent threats; EO/IR needs a cue
        from another technology; radar sees bigger airframes farther than the drawn Group 1 ring.
        Computed at 0.5 s steps; planning figures, not test evidence.
      </p>
    </div>
  )
}
