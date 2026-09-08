import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { buildAarSummary } from '../../../analysis/aar'
import { engagementPicture } from '../../../analysis/impact'
import { trialKpisAt } from '../../../analysis/liveStats'
import { assessRunValidity } from '../../../analysis/runValidity'
import { trialSystemTelemetryAt } from '../../../analysis/systemTelemetry'
import { trialResultOf } from '../../../analysis/trialResult'
import type { TrialResultView } from '../../../analysis/trialResult'
import { formatTime } from '../../../geometry/geo'
import { useStore } from '../../../state/store'
import { selectRunComplete } from '../../../state/selectors'
import { selectTrialHorizon } from '../../../state/trialSelectors'
import { State } from '../../../ui/kit'
import {
  DebriefRecord, RunValidityBanner, TrialEventLedger, TrialManifestRecord,
} from '../DebriefRecord'
import { SystemStatus } from '../SystemStatus'
import { trialOutcomeRows } from '../threatReadout'
import type { TrialOutcomeRow } from '../threatReadout'
import { trialStateText, useTrialResult } from '../widgets/controls'
import { VALIDITY_TEXT } from '../widgets/RunValidityWidget'

type SortColumn = 'track' | 'detect' | 'identify' | 'engage' | 'effect' | 'salvos' | 'result'
const columns: Array<{ key: SortColumn; label: string; title: string }> = [
  { key: 'track', label: 'Track', title: 'Threat track' },
  { key: 'detect', label: 'D', title: 'First detection, T+ minutes:seconds' },
  { key: 'identify', label: 'ID', title: 'First hostile identification, T+ minutes:seconds' },
  { key: 'engage', label: 'ENG', title: 'First salvo assignment, T+ minutes:seconds' },
  { key: 'effect', label: 'FX', title: 'First defeat effect, T+ minutes:seconds' },
  { key: 'salvos', label: 'Slv', title: 'Assigned salvos' },
  { key: 'result', label: 'Result', title: 'Track result at the completed horizon' },
]
const machineStyle: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 'var(--type-dense-size)' }
const timeText = (value: number | null) => value == null ? '—' : formatTime(value)

function OutcomeTable({ rows, durationS }: { rows: TrialOutcomeRow[]; durationS: number }) {
  const [sort, setSort] = useState<{ column: SortColumn; descending: boolean }>({ column: 'track', descending: false })
  const sorted = [...rows].sort((a, b) => {
    const left = a[sort.column]
    const right = b[sort.column]
    // Missing milestones remain last in either direction.
    if (left == null || right == null) return left == null ? right == null ? 0 : 1 : -1
    const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
    return (sort.descending ? -order : order) || a.track.localeCompare(b.track)
  })
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="register-table" style={machineStyle} aria-label={`Per-threat outcomes through T+${formatTime(durationS)}; times in minutes:seconds`}>
        <thead><tr>{columns.map(column => (
          <th key={column.key} scope="col" aria-sort={sort.column === column.key ? sort.descending ? 'descending' : 'ascending' : 'none'}>
            <button type="button" title={column.title} style={machineStyle} onClick={() => setSort({
              column: column.key, descending: sort.column === column.key && !sort.descending,
            })}>{column.label}</button>
          </th>
        ))}</tr></thead>
        <tbody>{sorted.map(row => (
          <tr key={row.id}>
            <td style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{row.track}</td>
            {[row.detect, row.identify, row.engage, row.effect].map((value, index) => (
              <td key={index} style={{ minWidth: 0 }}>{timeText(value)}</td>
            ))}
            <td style={{ minWidth: 0 }}>{row.salvos}</td>
            <td style={{ minWidth: 0 }}>{row.states.map(word => (
              <State key={word} tone={word === 'leaked' ? 'critical' : word === 'active' ? 'warning' : 'inactive'} style={machineStyle}>{word}</State>
            ))}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function CompletedOutcome({ view }: { view: TrialResultView }) {
  const data = useMemo(() => {
    const kpis = trialKpisAt(view, view.durationS)
    const rows = trialOutcomeRows(view)
    const systems = trialSystemTelemetryAt(view, view.durationS)
    // Forecast is retained only for the labeled requirement record and export.
    const forecast = engagementPicture(view.scenario)
    const validity = view.validity ?? assessRunValidity(view.scenario, forecast.assessments)
    const aar = buildAarSummary(view.scenario, forecast.assessments, forecast.report, forecast.impacts)
    return { kpis, rows, systems, forecast, validity, aar }
  }, [view])
  const { kpis, rows, systems, forecast, validity, aar } = data
  const population = view.attrition.threats.reduce((sum, row) => sum + row.shipCount, 0)
  const componentCount = systems.reduce((sum, group) => sum + group.componentCount, 0)
  const first = (values: Array<number | null>) => {
    const defined = values.filter((value): value is number => value != null)
    return defined.length ? `T+${formatTime(Math.min(...defined))}` : '—'
  }
  const horizon = <small style={{ display: 'block' }}>by T+{formatTime(view.durationS)}</small>
  const count = (value: number | null) => <>{value ?? '—'}<small>/{population} members</small></>
  const tiles: Array<[string, ReactNode]> = [
    ['Defeated before arrival', count(kpis.kills)],
    ['Arrived undefeated', count(kpis.reportedLeakers)],
    ['Late kills', count(kpis.lateKills)],
    ['First detect', first(rows.map(row => row.detect))],
    ['First effect', first(rows.map(row => row.effect))],
    ['Salvos', <>{kpis.kineticShots + kpis.deSalvos + kpis.jamSalvos}<small style={{ display: 'block' }}>
      {kpis.kineticShots} kinetic · {kpis.jamSalvos} EW{kpis.deSalvos > 0 && <> · {kpis.deSalvos} DE</>}
    </small></>],
  ]
  const validityText = VALIDITY_TEXT[validity.validity]
  return (
    <>
      <div className="tiles c3" aria-label="Completed trial outcomes">
        {tiles.map(([label, value]) => (
          <div className="tile" key={label}>
            <span className="tl">{label}</span>
            <div className="tv" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{value}{horizon}</div>
          </div>
        ))}
      </div>
      {!view.hasActiveAsset && <p className="muted small">No defended asset · arrival and leakage unavailable.</p>}
      <OutcomeTable rows={rows} durationS={view.durationS} />
      <section aria-label="Records">
        <details className="analysis-disclosure">
          <summary>Event ledger · {view.attrition.events.length} events</summary>
          <TrialEventLedger view={view} />
        </details>
        <details className="analysis-disclosure">
          <summary>Manifest · {componentCount} components</summary>
          <TrialManifestRecord view={view} />
          <SystemStatus groups={systems} expanded endOfRun />
        </details>
        <details className="analysis-disclosure">
          <summary>Validity · {view.validity ? 'Trial' : 'Forecast requirements'} · <State tone={validityText.tone}>{validityText.pill}</State> · {validity.findings.length} findings</summary>
          {!view.validity && <p className="muted small">Forecast · requirement validity. No trial validity assessment was captured.</p>}
          <RunValidityBanner assessment={validity} />
        </details>
      </section>
      <DebriefRecord scenario={view.scenario} assessments={forecast.assessments} report={forecast.report}
        aar={aar} durationS={view.durationS} showTrialRecords={false} showValidity={false} />
    </>
  )
}

export function OutcomeScreen() {
  const trial = useTrialResult()
  const { selection, snapshot } = trial
  const complete = useStore(selectRunComplete)
  const horizon = useStore(state => selectTrialHorizon(state, state.playback.observedThroughS))
  if (selection.status === 'idle' || selection.status === 'cancelled' || (selection.status === 'ready' && !snapshot)) {
    return <p className="muted small">No trial yet. Press Play in Execute to run one.</p>
  }
  const view = selection.status === 'ready' && snapshot
    ? trialResultOf(selection.scenario, selection.result.manifest, selection.result) : null
  return (
    <section className="analysis-primary" aria-label="Outcome">
      <h3>Outcome</h3>
      <p className="analysis-scope">{view
        ? `simulated trial · one draw · seed ${view.manifest.seed} · T+${formatTime(horizon)} of ${formatTime(view.durationS)} observed`
        : trialStateText(selection)}</p>
      {view && complete && horizon >= view.durationS ? <CompletedOutcome key={view.manifest.runId} view={view} />
        : <p className="muted small">{view ? 'Trial in progress. Complete playback in Execute to see the outcome.' : 'Outcome is waiting for a trial.'}</p>}
    </section>
  )
}
