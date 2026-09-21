import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { buildAarSummary } from '../../../analysis/aar'
import { trialKpisAt } from '../../../analysis/liveStats'
import { assessRunValidity } from '../../../analysis/runValidity'
import { trialSystemTelemetryAt } from '../../../analysis/systemTelemetry'
import { trialForecast, trialResultOf } from '../../../analysis/trialResult'
import type { TrialResultView } from '../../../analysis/trialResult'
import { formatTime } from '../../../geometry/geo'
import { saveRun } from '../../../io/runStore'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import { useStore } from '../../../state/store'
import { selectRunComplete } from '../../../state/selectors'
import { selectTrialHorizon } from '../../../state/trialSelectors'
import { State } from '../../../ui/kit'
import {
  DebriefRecord,
  RunValidityBanner,
  TrialEventLedger,
  TrialManifestRecord,
} from '../DebriefRecord'
import type { RunHistorySave } from '../RunHistory'
import { RunHistory } from '../RunHistory'
import { runRecordOf } from '../mc'
import { SystemStatus } from '../SystemStatus'
import { trialOutcomeRows } from '../threatReadout'
import type { TrialOutcomeRow } from '../threatReadout'
import { trialStateText, useTrialResult } from '../controls'
import { VALIDITY_TEXT } from '../runValidityText'

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
const machineStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--type-dense-size)',
}
// Seven columns; the track name and the result word take the slack.
const columnWidth: Record<SortColumn, string> = {
  track: '23%',
  detect: '10%',
  identify: '10%',
  engage: '10%',
  effect: '10%',
  salvos: '8%',
  result: '29%',
}
const timeText = (value: number | null) => (value == null ? '—' : formatTime(value))

/**
 * The operator floor stamp of one trial: decisions whose raw operator wait fell
 * below 0 and the floor discarded, against the decisions the C2 queue took. Null
 * when nothing floored and on a ledger that carries no counts. The trial and the
 * ensemble read the same counts.
 */
function flooredText(totals: TrialResultView['attrition']['totals']): string | null {
  const floored = totals.operatorFlooredDecisions
  if (!floored || floored <= 0) return null
  return `operator wait floored in ${floored} of ${totals.operatorDecisions ?? floored} decisions`
}

function OutcomeTable({ rows, durationS }: { rows: TrialOutcomeRow[]; durationS: number }) {
  const [sort, setSort] = useState<{ column: SortColumn; descending: boolean }>({
    column: 'track',
    descending: false,
  })
  const sorted = [...rows].sort((a, b) => {
    const left = a[sort.column]
    const right = b[sort.column]
    // Missing milestones remain last in either direction.
    if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1
    const order =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right))
    return (sort.descending ? -order : order) || a.track.localeCompare(b.track)
  })
  return (
    <table
      className="tb tb-dense"
      aria-label={`Per-threat outcomes through T+${formatTime(durationS)}; times in minutes:seconds`}
    >
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              style={{ width: columnWidth[column.key] }}
              aria-sort={
                sort.column === column.key ? (sort.descending ? 'descending' : 'ascending') : 'none'
              }
            >
              <button
                type="button"
                title={column.title}
                style={machineStyle}
                onClick={() =>
                  setSort({
                    column: column.key,
                    descending: sort.column === column.key && !sort.descending,
                  })
                }
              >
                {column.label}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.id}>
            <td title={row.track}>{row.track}</td>
            {[row.detect, row.identify, row.engage, row.effect].map((value, index) => (
              <td key={index}>{timeText(value)}</td>
            ))}
            <td>{row.salvos}</td>
            <td title={row.states.join(', ')}>
              {row.states.map((word) => (
                <State
                  key={word}
                  tone={word === 'leaked' ? 'critical' : word === 'active' ? 'warning' : 'inactive'}
                  style={machineStyle}
                >
                  {word}
                </State>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CompletedOutcome({ view }: { view: TrialResultView }) {
  const data = useMemo(() => {
    const kpis = trialKpisAt(view, view.durationS)
    const rows = trialOutcomeRows(view)
    const systems = trialSystemTelemetryAt(view, view.durationS)
    // Retained only for the labeled requirement record and export. It runs the
    // values the trial ran, the manifest's overrides included.
    const forecast = trialForecast(view)
    const validity = view.validity ?? assessRunValidity(view.scenario, forecast.assessments)
    const aar = buildAarSummary(
      view.scenario,
      forecast.assessments,
      forecast.report,
      forecast.impacts,
    )
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
  const count = (value: number | null) => (
    <>
      {value ?? '—'}
      <small>/{population} members</small>
    </>
  )
  const tiles: Array<[string, ReactNode]> = [
    ['Defeated before arrival', count(kpis.kills)],
    ['Arrived undefeated', count(kpis.reportedLeakers)],
    ['Late kills', count(kpis.lateKills)],
    ['First detect', first(rows.map((row) => row.detect))],
    ['First effect', first(rows.map((row) => row.effect))],
    [
      'Salvos',
      <>
        {kpis.kineticShots + kpis.deSalvos + kpis.jamSalvos}
        <small style={{ display: 'block' }}>
          {kpis.kineticShots} kinetic · {kpis.jamSalvos} EW
          {kpis.deSalvos > 0 && <> · {kpis.deSalvos} DE</>}
        </small>
      </>,
    ],
  ]
  const validityText = VALIDITY_TEXT[validity.validity]
  const floored = flooredText(view.attrition.totals)
  return (
    <>
      <div className="tiles c3" aria-label="Completed trial outcomes">
        {tiles.map(([label, value]) => (
          <div className="tile" key={label}>
            <span className="tl">{label}</span>
            <div className="tv" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
              {value}
              {horizon}
            </div>
          </div>
        ))}
      </div>
      {!view.hasActiveAsset && (
        <p className="muted small">No defended asset · arrival and leakage unavailable.</p>
      )}
      {floored && <p className="muted small">{floored}</p>}
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
          <summary>
            Validity · {view.validity ? 'Trial' : 'Forecast requirements'} ·{' '}
            <State tone={validityText.tone}>{validityText.pill}</State> · {validity.findings.length}{' '}
            findings
          </summary>
          {!view.validity && (
            <p className="muted small">
              Forecast · requirement validity. No trial validity assessment was captured.
            </p>
          )}
          <RunValidityBanner assessment={validity} />
        </details>
      </section>
      <DebriefRecord
        scenario={view.scenario}
        assessments={forecast.assessments}
        report={forecast.report}
        aar={aar}
        durationS={view.durationS}
        showTrialRecords={false}
        showValidity={false}
      />
    </>
  )
}

/**
 * A save needs a finished ensemble for the current analysis basis; the sensitivity
 * companion joins it only when it finished on the same basis. The record is built
 * here, never in the store.
 */
function useRunHistorySave(): RunHistorySave {
  const scenario = useStore((state) => state.scenario)
  const mc = useStore((state) => state.mc)
  const playbackRunId = useStore((state) => state.playback.runId)
  const signature = useMemo(() => analysisBasisSignature(scenario), [scenario])
  const summary = mc.status === 'done' ? mc.summary : null
  const enabled = summary != null && mc.basisSignature === signature
  const reason = enabled
    ? 'Save this ensemble to the run history'
    : mc.status === 'running'
      ? 'The ensemble is still running'
      : summary == null
        ? 'No finished ensemble to save'
        : 'The scenario changed after the ensemble ran'
  return {
    enabled,
    reason,
    run: () => {
      if (!summary) return Promise.reject(new Error('No finished ensemble to save.'))
      const sensitivity =
        mc.sensitivity.status === 'done' && mc.sensitivity.basisSignature === signature
          ? mc.sensitivity.summary
          : null
      // The record names the overrides the run applied at launch.
      return saveRun(runRecordOf(scenario, mc, playbackRunId, signature, sensitivity))
    },
  }
}

export function OutcomeScreen() {
  const trial = useTrialResult()
  const { selection, snapshot } = trial
  const complete = useStore(selectRunComplete)
  const horizon = useStore((state) => selectTrialHorizon(state, state.playback.observedThroughS))
  const save = useRunHistorySave()
  if (
    selection.status === 'idle' ||
    selection.status === 'cancelled' ||
    (selection.status === 'ready' && !snapshot)
  ) {
    // The history does not depend on a trial, so it renders below the placeholder.
    return (
      <>
        <p className="muted small">No trial yet. Press Play in Execute to run one.</p>
        <RunHistory save={save} />
      </>
    )
  }
  const view =
    selection.status === 'ready' && snapshot
      ? trialResultOf(selection.scenario, selection.result.manifest, selection.result)
      : null
  return (
    <section className="analysis-primary" aria-label="Outcome">
      <h3>Outcome</h3>
      <p className="analysis-scope">
        {view
          ? `simulated trial · one draw · seed ${view.manifest.seed} · T+${formatTime(horizon)} of ${formatTime(view.durationS)} observed`
          : trialStateText(selection)}
      </p>
      {view && complete && horizon >= view.durationS ? (
        <CompletedOutcome key={view.manifest.runId} view={view} />
      ) : (
        <p className="muted small">
          {view
            ? 'Trial in progress. Complete playback in Execute to see the outcome.'
            : 'Outcome is waiting for a trial.'}
        </p>
      )}
      <RunHistory save={save} />
    </section>
  )
}
