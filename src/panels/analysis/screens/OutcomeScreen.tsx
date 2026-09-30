import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { trialKpisAt } from '../../../analysis/liveStats'
import { buildRequirementGateReport } from '../../../analysis/requirements'
import { assessRunValidity } from '../../../analysis/runValidity'
import { trialSystemTelemetryAt } from '../../../analysis/systemTelemetry'
import { trialForecast, trialResultOf } from '../../../analysis/trialResult'
import type { TrialResultView } from '../../../analysis/trialResult'
import { formatTime } from '../../../geometry/geo'
import { useStore } from '../../../state/store'
import { selectRunComplete } from '../../../state/selectors'
import { selectTrialHorizon } from '../../../state/trialSelectors'
import { Seg, State } from '../../../ui/kit'
import type { StateTone } from '../../../ui/kit'
import { PanelSection } from '../../../ui/PanelSection'
import { ExportMenu, TrialEventLedger, TrialManifestRecord } from '../DebriefRecord'
import { useRunHistorySave } from '../useRunHistorySave'
import { SystemList } from '../SystemStatus'
import { lateKillText, trialOutcomeRows } from '../threatReadout'
import type { TrialOutcomeRow, TrialOutcomeWord } from '../threatReadout'
import { splitCommonPrefix } from '../trackNames'
import { EmptyRow, NoteInfo, trialStateText } from '../controls'
import { useTrialResult } from '../../../state/useTrialResult'
import { formatCount } from '../mc'

type SortColumn = 'track' | 'detect' | 'identify' | 'engage' | 'effect' | 'salvos' | 'result'
const columns: Array<{ key: SortColumn; label: string; title: string; className?: string }> = [
  { key: 'track', label: 'Track', title: 'Threat track' },
  { key: 'detect', label: 'Detect', title: 'First detection, T+ minutes:seconds' },
  { key: 'identify', label: 'ID', title: 'First hostile identification, T+ minutes:seconds' },
  { key: 'engage', label: 'Engage', title: 'First salvo assignment, T+ minutes:seconds' },
  {
    key: 'effect',
    label: 'Effect',
    title: 'First defeat effect, T+ minutes:seconds',
    className: 'out-c-fx',
  },
  { key: 'salvos', label: 'Slv', title: 'Assigned salvos', className: 'out-c-slv' },
  { key: 'result', label: 'Result', title: 'Track result at the completed horizon' },
]
const machineStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--type-dense-size)',
}
const timeText = (value: number | null) => (value == null ? '—' : formatTime(value))

const RESULT_TONE: Record<TrialOutcomeWord, StateTone> = {
  leaked: 'critical',
  active: 'warning',
  'defeated (hard)': 'inactive',
  'defeated (mission)': 'inactive',
  'no path': 'inactive',
}

/** One short result word per track: the strip column is narrow; the title keeps the rest. */
function ResultWord({ row }: { row: TrialOutcomeRow }) {
  const word = row.states[0]
  return (
    <State tone={RESULT_TONE[word]} title={row.result} style={machineStyle}>
      {word.startsWith('defeated') ? 'defeated' : word}
    </State>
  )
}

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

function OutcomeTable({ rows, names }: { rows: TrialOutcomeRow[]; names: Map<string, string> }) {
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
      className="tb tb-dense out-table"
      aria-label="Per-track outcomes, times in minutes:seconds"
    >
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={column.className}
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
          <tr
            key={row.id}
            title={`${row.track} · effect ${timeText(row.effect)} · ${row.salvos} salvos`}
          >
            <td className="mono" title={row.track}>
              {names.get(row.id) ?? row.track}
            </td>
            {[row.detect, row.identify, row.engage].map((value, index) => (
              <td className="mono" key={index}>
                {timeText(value)}
              </td>
            ))}
            <td className="mono out-c-fx">{timeText(row.effect)}</td>
            <td className="mono out-c-slv">{row.salvos}</td>
            <td title={row.result}>
              <ResultWord row={row} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const pct = (s: number, durationS: number) =>
  `${((Math.max(0, Math.min(s, durationS)) / durationS) * 100).toFixed(2)}%`

/**
 * One strip per track on one axis from 0 to the duration: detection, identification,
 * each salvo, arrival, and a defeat or late kill when present.
 */
function OutcomeStrips({
  view,
  rows,
  names,
}: {
  view: TrialResultView
  rows: TrialOutcomeRow[]
  names: Map<string, string>
}) {
  const durationS = view.durationS
  const arrivals = new Map(view.assessments.map((a) => [a.uasId, a.arrivalS]))
  const ticks = [0, durationS / 4, durationS / 2, (3 * durationS) / 4, durationS]
  return (
    <>
      <div className="out-axis" aria-hidden="true">
        <span />
        <span className="out-axis-ticks">
          {ticks.map((s, i) => (
            <span
              key={i}
              style={{
                left: pct(s, durationS),
                transform: `translateX(${i === 0 ? '0' : i === ticks.length - 1 ? '-100%' : '-50%'})`,
              }}
            >
              {formatTime(s)}
            </span>
          ))}
        </span>
        <span />
      </div>
      <div className="out-strips">
        {rows.map((row) => {
          const arrival = arrivals.get(row.id) ?? null
          const end = row.effect ?? arrival ?? row.lateKillS ?? durationS
          const salvos = view.attrition.events.filter(
            (event) => event.uasId === row.id && event.tS <= durationS,
          )
          return (
            <div className="out-strip" key={row.id} title={`${row.track} · ${row.result}`}>
              <span className="out-nm" title={row.track}>
                {names.get(row.id) ?? row.track}
              </span>
              <span className="out-lane">
                {row.detect != null && (
                  <i
                    className="out-ln"
                    style={{
                      left: pct(row.detect, durationS),
                      width: `${((Math.max(0, Math.min(end, durationS) - row.detect) / durationS) * 100).toFixed(2)}%`,
                    }}
                  />
                )}
                {row.detect != null && (
                  <i
                    className="out-mk det"
                    style={{ left: pct(row.detect, durationS) }}
                    title={`Detect T+${formatTime(row.detect)}`}
                  />
                )}
                {row.identify != null && (
                  <i
                    className="out-mk id"
                    style={{ left: pct(row.identify, durationS) }}
                    title={`Identified T+${formatTime(row.identify)}`}
                  />
                )}
                {salvos.map((event, index) => (
                  <i
                    key={index}
                    className="out-mk eng"
                    style={{ left: pct(event.tS, durationS) }}
                    title={`${view.scenario.entities.find((e) => e.id === event.effectorId)?.name ?? event.effectorId} salvo ${index + 1} · T+${formatTime(event.tS)}`}
                  />
                ))}
                {arrival != null && arrival <= durationS && (
                  <i
                    className="out-mk arr"
                    style={{ left: pct(arrival, durationS) }}
                    title={`Arrival T+${formatTime(arrival)}`}
                  />
                )}
                {row.effect != null && (
                  <i
                    className="out-mk def"
                    style={{ left: pct(row.effect, durationS) }}
                    title={`Defeated T+${formatTime(row.effect)}`}
                  />
                )}
                {row.lateKillS != null && (
                  <i
                    className="out-mk late"
                    style={{ left: pct(row.lateKillS, durationS) }}
                    title={`${row.track} · ${lateKillText(row.lateKillS)}`}
                  />
                )}
              </span>
              <ResultWord row={row} />
            </div>
          )
        })}
      </div>
      <div className="out-key" aria-hidden="true">
        <span>
          <i className="out-mk det" />
          detect
        </span>
        <span>
          <i className="out-mk id" />
          identify
        </span>
        <span>
          <i className="out-mk eng" />
          salvo
        </span>
        <span>
          <i className="out-mk arr" />
          arrival
        </span>
        <span>
          <i className="out-mk def" />
          defeat
        </span>
        <span>
          <i className="out-mk late" />
          late kill
        </span>
      </div>
    </>
  )
}

/**
 * One segment per modeled member: defeated before arrival, late kill or leaked, as
 * `trialKpisAt` counts them. A late kill is a leaker. Without an active asset the
 * bar shows the defeats and states that arrival is not measurable.
 */
function ResultBar({
  view,
  kpis,
  population,
}: {
  view: TrialResultView
  kpis: ReturnType<typeof trialKpisAt>
  population: number
}) {
  const defeated = Math.round(kpis.kills)
  const late = view.hasActiveAsset ? Math.round(kpis.lateKills) : 0
  const leakers = view.hasActiveAsset ? Math.round(kpis.reportedLeakers ?? 0) : 0
  const leaked = Math.max(0, leakers - late)
  const other = Math.max(0, population - defeated - late - leaked)
  const segments = [
    ...Array<string>(defeated).fill('def'),
    ...Array<string>(late).fill('late'),
    ...Array<string>(leaked).fill('leak'),
    ...Array<string>(other).fill('na'),
  ]
  const label = view.hasActiveAsset
    ? `${formatCount(kpis.kills)} defeated before arrival, ${late} late kills, ${leaked} leaked of ${population} members`
    : `${formatCount(kpis.kills)} defeated of ${population} members; arrival is not measurable`
  return (
    <div className="out-result">
      <div
        className={`out-resbar${segments.length > 40 ? ' dense' : ''}`}
        role="img"
        aria-label={label}
        title={label}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, segments.length)}, minmax(0, 1fr))` }}
      >
        {segments.map((kind, index) => (
          <i key={index} className={kind} />
        ))}
      </div>
      <div className="out-legend">
        <span>
          <i className="out-sq def" />
          <b>{formatCount(kpis.kills)}</b> defeated before arrival
        </span>
        {view.hasActiveAsset ? (
          <>
            <span>
              <i className="out-sq late" />
              <b>{late}</b> late kills
            </span>
            <span>
              <i className="out-sq leak" />
              <b>{leaked}</b> leaked
            </span>
          </>
        ) : (
          <span>No defended asset · arrival is not measurable</span>
        )}
        <span className="muted">of {population} members</span>
      </div>
    </div>
  )
}

function CompletedOutcome({ view }: { view: TrialResultView }) {
  const [trackView, setTrackView] = useState<'strip' | 'table'>('strip')
  const data = useMemo(() => {
    const kpis = trialKpisAt(view, view.durationS)
    const rows = trialOutcomeRows(view)
    const systems = trialSystemTelemetryAt(view, view.durationS)
    // Gates met reads the forecast the trial ran, the manifest's overrides included.
    const forecast = trialForecast(view)
    const validity = assessRunValidity(view.scenario, forecast.assessments)
    const gates = buildRequirementGateReport(
      view.scenario,
      forecast.assessments,
      forecast.report,
      validity,
    )
    return { kpis, rows, systems, gates }
  }, [view])
  const { kpis, rows, systems, gates } = data
  const population = view.attrition.threats.reduce((sum, row) => sum + row.shipCount, 0)
  const componentCount = systems.reduce((sum, group) => sum + group.componentCount, 0)
  const split = splitCommonPrefix(rows.map((row) => row.track))
  const names = new Map(rows.map((row, i) => [row.id, split.rest[i]]))
  const first = (values: Array<number | null>) => {
    const defined = values.filter((value): value is number => value != null)
    return defined.length ? `T+${formatTime(Math.min(...defined))}` : '—'
  }
  const salvos = kpis.kineticShots + kpis.deSalvos + kpis.jamSalvos
  const floored = flooredText(view.attrition.totals)
  const openRequirements = () =>
    useStore
      .getState()
      .requestPanel({ phase: 'prepare', screen: 'inputs', section: 'prepare-requirements' })
  return (
    <>
      <ResultBar view={view} kpis={kpis} population={population} />
      <div className="pstat-row out-stats" aria-label="Completed trial outcomes">
        <div className="pstat">
          <div className="pstat-l">First detect</div>
          <div className="pstat-v">{first(rows.map((row) => row.detect))}</div>
        </div>
        <div className="pstat">
          <div className="pstat-l">First effect</div>
          <div className="pstat-v">{first(rows.map((row) => row.effect))}</div>
        </div>
        <div
          className="pstat"
          title={`${kpis.kineticShots} kinetic · ${kpis.jamSalvos} EW · ${kpis.deSalvos} DE`}
        >
          <div className="pstat-l">Salvos</div>
          <div className="pstat-v">{salvos}</div>
        </div>
        <button
          type="button"
          className="pstat out-gates"
          title="Forecast requirement gates · open Prepare, Requirements"
          onClick={openRequirements}
        >
          <span className="pstat-l">Gates met</span>
          <span className="pstat-v">
            {gates.met}
            <small>/{gates.required}</small>
          </span>
        </button>
      </div>
      {floored && (
        <p className="empty-row">
          <State tone="warning" hollow>
            {floored}
          </State>
        </p>
      )}
      <PanelSection
        title="Tracks"
        readout={split.prefix ? `${split.prefix.trim()} · ${rows.length}` : rows.length}
        end={
          <Seg
            value={trackView}
            options={[
              { v: 'strip', label: 'Strip' },
              { v: 'table', label: 'Table' },
            ]}
            onChange={setTrackView}
            label="Track view"
          />
        }
      >
        {trackView === 'strip' ? (
          <OutcomeStrips view={view} rows={rows} names={names} />
        ) : (
          <OutcomeTable rows={rows} names={names} />
        )}
      </PanelSection>
      <section className="out-records" aria-label="Records">
        <details className="analysis-disclosure">
          <summary>Event ledger · {view.attrition.events.length} events</summary>
          <TrialEventLedger view={view} />
        </details>
        <details className="analysis-disclosure">
          <summary>Systems at end of run · {componentCount} components</summary>
          <NoteInfo
            label="telemetry state"
            note="State shows the final sampled instant, not the run outcome; cumulative counts cover the run."
          />
          <SystemList groups={systems} />
        </details>
        <details className="analysis-disclosure">
          <summary>Manifest · {view.manifest.runId}</summary>
          <TrialManifestRecord view={view} />
        </details>
      </section>
    </>
  )
}

/** The Save run control and its result line. */
function SaveRun() {
  const save = useRunHistorySave()
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        className="mini"
        disabled={!save.enabled}
        title={save.reason}
        onClick={() =>
          save.run().then(
            ({ evicted }) =>
              setNotice(
                evicted.length
                  ? `Saved · ${evicted.length} oldest evicted`
                  : 'Saved to Compare, Saved runs',
              ),
            (error) => setNotice(error instanceof Error ? error.message : 'Save failed'),
          )
        }
      >
        Save run
      </button>
      {notice && (
        <span className="out-notice" role="status" title={notice}>
          {notice}
        </span>
      )}
    </>
  )
}

export function OutcomeScreen() {
  const trial = useTrialResult()
  const { selection, snapshot } = trial
  const complete = useStore(selectRunComplete)
  const horizon = useStore((state) => selectTrialHorizon(state, state.playback.observedThroughS))
  if (
    selection.status === 'idle' ||
    selection.status === 'cancelled' ||
    (selection.status === 'ready' && !snapshot)
  ) {
    return <EmptyRow>No trial yet. Press Play in Execute to run one.</EmptyRow>
  }
  const view =
    selection.status === 'ready' && snapshot
      ? trialResultOf(selection.scenario, selection.result.manifest, selection.result)
      : null
  const done = view != null && complete && horizon >= view.durationS
  return (
    <section className="analysis-primary" aria-label="Outcome">
      {done ? (
        <>
          <div className="out-prov">
            <span title="One simulated draw">
              Trial · seed {view.manifest.seed} · T+{formatTime(view.durationS)}
            </span>
            <span className="out-prov-end">
              <SaveRun />
              <ExportMenu view={view} />
            </span>
          </div>
          <CompletedOutcome key={view.manifest.runId} view={view} />
        </>
      ) : (
        <EmptyRow>
          {view
            ? 'Trial in progress. Complete playback in Execute to see the outcome.'
            : trialStateText(selection)}
        </EmptyRow>
      )}
    </section>
  )
}
