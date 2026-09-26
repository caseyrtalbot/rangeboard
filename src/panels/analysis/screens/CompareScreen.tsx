import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { trialKpisAt } from '../../../analysis/liveStats'
import { assessRunValidity } from '../../../analysis/runValidity'
import { trialForecast } from '../../../analysis/trialResult'
import type { TrialResultView } from '../../../analysis/trialResult'
import { trialSeriesOf } from '../../../analysis/trialSeries'
import { EmptyRow } from '../DebriefRecord'
import { BandChart } from '../../../charts/BandChart'
import { exportChartPng } from '../../../charts/exportPng'
import { readTokens } from '../../../charts/tokens'
import { formatTime } from '../../../geometry/geo'
import { entityActive, runSettings } from '../../../model/types'
import type { RunRecord } from '../../../model/runRecord'
import type { BandSeries, McSummary, Stat } from '../../../playback/mcRun'
import { DT } from '../../../playback/clock'
import type { RunSummary } from '../../../io/runStore'
import { getRun, listRuns } from '../../../io/runStore'
import { safeName } from '../../../io/persist'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import type { PinnedBaseline } from '../../../state/baseline'
import { defaultBaselineLabel } from '../../../state/baseline'
import { selectRunComplete } from '../../../state/selectors'
import { useStore } from '../../../state/store'
import { selectTrialHorizon } from '../../../state/trialSelectors'
import { State } from '../../../ui/kit'
import { trialStateText, trialViewOf, useTrialResult } from '../controls'
import { currentSummary, formatCount, statMean, timeStatSub } from '../mc'
import { RecordExports } from '../RunHistory'
import { SEVERITY_PILL } from '../runValidityText'

type DeltaRow = {
  label: string
  trial: number | null
  mean: number | null
  lo: number | null
  hi: number | null
  unit: string
  note?: string
}
type MeanKey = 'kills' | 'leakers' | 'firstDetect' | 'minWarning' | 'salvos'
const ROW_KEYS: MeanKey[] = ['kills', 'leakers', 'firstDetect', 'minWarning', 'salvos']
// Interval ends and units must remain readable at the panel's minimum width.
const cellStyle: CSSProperties = {
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  overflow: 'visible',
}
const finite = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? value : null
const loadError = (error: unknown) =>
  error instanceof Error ? error.message : 'Run history is unavailable.'
const minimum = (values: Array<number | null>) => {
  const defined = values.filter((value): value is number => finite(value) != null)
  return defined.length ? Math.min(...defined) : null
}

/** End-of-run ensemble means of the five compared quantities, on the summary's own horizon and population. */
function ensembleMeans(mc: McSummary, hasAsset: boolean) {
  const population = Object.values(mc.perThreat).reduce((sum, row) => sum + row.shipCount, 0)
  const i = Math.floor(mc.durationS / DT)
  const endMean = (band: BandSeries) => (mc.replicates > 0 ? finite(band.mean[i]) : null)
  const salvos = Object.values(mc.perEffector).map((row) => row.salvos)
  // Means add; marginal intervals cannot supply the covariance of total salvos.
  const salvoMean =
    mc.replicates > 0 &&
    salvos.length > 0 &&
    salvos.every((stat) => stat.n === mc.replicates && statMean(stat) != null)
      ? salvos.reduce((sum, stat) => sum + stat.mean, 0)
      : null
  const means: Record<MeanKey, number | null> = {
    kills: endMean(mc.kills),
    leakers: hasAsset ? endMean(mc.leakers) : null,
    firstDetect: statMean(mc.firstDetectS),
    minWarning: hasAsset ? statMean(mc.minWarningS) : null,
    salvos: salvoMean,
  }
  return { population, i, salvos, salvoMean, means }
}

const signed = (value: number) => `${value > 0 ? '+' : ''}${formatCount(value)}`

/**
 * A chart and its PNG button. The chart paints from CSS custom properties, so the
 * export passes the panel surface as a background the SVG does not carry.
 */
function ChartExport({ name, children }: { name: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <div ref={frame}>{children}</div>
      <div className="insp-row" aria-label="Export the chart">
        <span className="muted small">Chart</span>
        <button
          className="mini"
          type="button"
          onClick={() => {
            exportChartPng(frame.current, `${name}.png`, { background: readTokens().surface }).then(
              () => setError(null),
              (reason: unknown) =>
                setError(reason instanceof Error ? reason.message : 'Could not export the chart.'),
            )
          }}
        >
          Export PNG
        </button>
      </div>
      {error && (
        <State tone="critical" role="status">
          {error}
        </State>
      )}
    </>
  )
}

function CompletedCompare({
  view,
  mc,
  baseline,
}: {
  view: TrialResultView
  mc: McSummary
  baseline: PinnedBaseline | null
}) {
  const data = useMemo(() => {
    const kpis = trialKpisAt(view, view.durationS)
    const { population, i, salvos, salvoMean } = ensembleMeans(mc, view.hasActiveAsset)
    const countRow = (
      label: string,
      trial: number | null,
      band: BandSeries,
      available = true,
    ): DeltaRow => ({
      label,
      trial,
      mean: available && mc.replicates > 0 ? finite(band.mean[i]) : null,
      lo: available && mc.replicates >= 2 ? finite(band.lo[i]) : null,
      hi: available && mc.replicates >= 2 ? finite(band.hi[i]) : null,
      unit: `/${population} members`,
    })
    const timeRow = (
      label: string,
      trial: number | null,
      stat: Stat,
      quantity: 'detected' | 'warning',
      available = true,
    ): DeltaRow => ({
      label,
      trial,
      mean: available ? statMean(stat) : null,
      lo: available && stat.n >= 30 && stat.conf === 0.95 ? finite(stat.lo) : null,
      hi: available && stat.n >= 30 && stat.conf === 0.95 ? finite(stat.hi) : null,
      unit: label === 'First detect' ? 's from T0' : 's',
      note: available ? timeStatSub(stat, quantity) : 'No defended asset; unavailable.',
    })
    const salvoBand =
      salvos.length === 1 && salvos[0].n >= 2 && salvos[0].conf === 0.95 ? salvos[0] : null
    const rows = [
      countRow('Kills', kpis.kills, mc.kills),
      countRow('Leakers', kpis.reportedLeakers, mc.leakers, view.hasActiveAsset),
      timeRow(
        'First detect',
        minimum(view.assessments.map((a) => a.firstDetectS)),
        mc.firstDetectS,
        'detected',
      ),
      timeRow(
        'Min warning',
        view.hasActiveAsset ? minimum(view.assessments.map((a) => a.warningS)) : null,
        mc.minWarningS,
        'warning',
        view.hasActiveAsset,
      ),
      {
        label: 'Salvos',
        trial: kpis.kineticShots + kpis.deSalvos + kpis.jamSalvos,
        mean: salvoMean,
        lo: finite(salvoBand?.lo),
        hi: finite(salvoBand?.hi),
        unit: 'salvos',
        note: salvoBand
          ? 'One effector; its salvo interval is the aggregate interval.'
          : 'Aggregate interval unavailable; per-effector intervals cannot be added.',
      },
    ]
    // The forecast runs the values the trial ran, the manifest's overrides included.
    const forecast = trialForecast(view)
    const validity = assessRunValidity(view.scenario, forecast.assessments, undefined, {
      assessments: view.assessments,
      kills: kpis.kills,
      mc,
    })
    return {
      rows,
      population,
      trial: trialSeriesOf(view, view.durationS).kpi.find(
        (series) => series.id === 'kpi.expectedKills',
      )!,
      findings: validity.findings.filter((finding) => finding.id !== 'planning-envelope'),
    }
  }, [view, mc])
  // The baseline keeps its own population and horizon; only means are compared, never bands.
  const base = useMemo(() => {
    if (!baseline) return null
    const hasAsset = baseline.scenario.entities.some((e) => e.kind === 'asset' && entityActive(e))
    const { population, means } = ensembleMeans(baseline.mc, hasAsset)
    const series = {
      id: 'baseline',
      label: 'Baseline mean',
      unit: 'members',
      color: 'text-dim',
      kind: 'step' as const,
      values:
        baseline.mc.replicates > 0 ? baseline.mc.kills.mean : baseline.mc.kills.mean.map(() => NaN),
    }
    return { population, means, series, hasAsset }
  }, [baseline])
  const value = (number: number | null, unit: string) =>
    number == null ? '—' : `${formatCount(number)} ${unit}`
  const headers = base
    ? ['Quantity', 'Trial', 'Ensemble mean', '95 % band', 'Baseline', 'Current − Baseline', 'Flag']
    : ['Quantity', 'Trial', 'Ensemble mean', '95 % band', 'Flag']
  const widths = base
    ? ['16%', '12%', '15%', '19%', '14%', '12%', '12%']
    : ['18%', '18%', '20%', '24%', '20%']
  return (
    <>
      <p className="muted small">
        Simulated trial · one draw · seed {view.manifest.seed} · through T+
        {formatTime(view.durationS)}. Kills exclude late effects. Bands are intervals on ensemble
        means, not replicate ranges; count bounds may use Wilson or rule of three.
      </p>
      <ChartExport name={`${safeName(view.scenario.name)}.compare`}>
        <BandChart
          ensemble={mc.kills}
          trial={data.trial}
          baseline={base?.series}
          durationS={mc.durationS}
          population={data.population}
          replicates={mc.replicates}
        />
      </ChartExport>
      <table
        className="tb tb-dense"
        aria-label={`Trial against ensemble through T+${formatTime(view.durationS)}`}
      >
        <thead>
          <tr>
            {headers.map((label, i) => (
              <th key={label} scope="col" style={{ ...cellStyle, width: widths[i] }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, r) => {
            const comparable =
              row.trial != null && row.mean != null && row.lo != null && row.hi != null
            const inside = comparable && row.trial! >= row.lo! && row.trial! <= row.hi!
            const baseMean = base ? base.means[ROW_KEYS[r]] : null
            const baseUnit = r < 2 && base ? `/${base.population} members` : row.unit
            const delta = row.mean != null && baseMean != null ? row.mean - baseMean : null
            return (
              <tr key={row.label}>
                <th scope="row" style={{ ...cellStyle, width: widths[0] }}>
                  {row.label}
                </th>
                <td style={cellStyle}>{value(row.trial, row.unit)}</td>
                <td style={cellStyle}>{value(row.mean, row.unit)}</td>
                <td style={cellStyle}>
                  {row.lo == null || row.hi == null
                    ? 'Unavailable'
                    : `${formatCount(row.lo)} to ${formatCount(row.hi)} ${row.unit}`}
                </td>
                {base && <td style={cellStyle}>{value(baseMean, baseUnit)}</td>}
                {base && (
                  <td style={cellStyle}>
                    {delta == null ? '—' : `${signed(delta)} ${r < 2 ? 'members' : row.unit}`}
                  </td>
                )}
                <td style={cellStyle}>
                  {comparable ? (
                    <State
                      tone={inside ? 'nominal' : 'warning'}
                      style={{ whiteSpace: 'normal', fontSize: 'var(--type-dense-size)' }}
                    >
                      {inside ? 'inside' : 'outside'}
                    </State>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <details className="analysis-disclosure">
        <summary>Interval and definedness details</summary>
        {data.rows
          .filter((row) => row.note)
          .map((row) => (
            <p className="muted small" key={row.label}>
              {row.label}: {row.note}
            </p>
          ))}
        {!view.hasActiveAsset && (
          <p className="muted small">No defended asset · arrival and leakage unavailable.</p>
        )}
        {baseline && base && (
          <p className="muted small">
            Baseline: {baseline.label} · {baseline.mc.replicates} replicates · seed{' '}
            {baseline.mc.seed} · full run T+{formatTime(baseline.mc.durationS)} · {base.population}{' '}
            members
            {base.population !== data.population
              ? ' (population differs; count deltas are in members)'
              : ''}
            {!base.hasAsset ? ' · no defended asset, leakage and warning unavailable' : ''}. Deltas
            are current ensemble mean minus baseline mean.
          </p>
        )}
      </details>
      <section aria-label="Findings">
        <h4>Findings</h4>
        {data.findings.map((finding) => (
          <div className="validity-finding" key={finding.id}>
            <State tone={SEVERITY_PILL[finding.severity].tone}>
              {SEVERITY_PILL[finding.severity].text}
            </State>
            <div>
              <p>{finding.message}</p>
              <button
                className="mini"
                type="button"
                onClick={() => {
                  const store = useStore.getState()
                  if (finding.uasIds.length) {
                    store.select({ entityIds: finding.uasIds })
                    store.setRightTab('inspect')
                  }
                  store.setBoardPhase('prepare')
                }}
              >
                {finding.uasIds.length ? 'Review tracks in Prepare' : 'Review in Prepare'}
              </button>
            </div>
          </div>
        ))}
        {!data.findings.length && <p className="muted small">No findings.</p>}
      </section>
    </>
  )
}

/** Pin, Clear and the pinned label. Pin needs a done summary for the current run and basis. */
function BaselineRow({ mc, current }: { mc: McSummary | null; current: boolean }) {
  const baseline = useStore((state) => state.baseline)
  const pinBaseline = useStore((state) => state.pinBaseline)
  const clearBaseline = useStore((state) => state.clearBaseline)
  // The default label already carries the pin time; a custom label gets it appended.
  const pinnedAt =
    baseline && baseline.label !== defaultBaselineLabel(baseline.scenario.name, baseline.pinnedAt)
      ? new Date(baseline.pinnedAt).toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : null
  return (
    <div className="insp-row" aria-label="Baseline">
      <span>
        {baseline ? (
          <>
            Baseline · {baseline.label}
            {pinnedAt && <span className="muted small"> pinned {pinnedAt}</span>}
          </>
        ) : (
          'No pinned baseline'
        )}
      </span>
      <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {baseline && (
          <button className="mini" type="button" onClick={clearBaseline}>
            Clear
          </button>
        )}
        <button
          className="mini"
          type="button"
          disabled={!mc || !current}
          onClick={() => pinBaseline()}
        >
          Pin
        </button>
      </span>
    </div>
  )
}

type RunRow = {
  label: string
  mean: number | null
  lo: number | null
  hi: number | null
  unit: string
  note?: string
}

/**
 * The five compared quantities of one saved ensemble, read from that record's own
 * summary. A count band needs two replicates, a conditional time mean needs 30
 * defined samples at 95 %, and an aggregate salvo interval needs a single effector.
 */
function savedRunRows(mc: McSummary, hasAsset: boolean): { population: number; rows: RunRow[] } {
  const { population, i, salvos, salvoMean } = ensembleMeans(mc, hasAsset)
  const countRow = (label: string, band: BandSeries, available = true): RunRow => ({
    label,
    mean: available && mc.replicates > 0 ? finite(band.mean[i]) : null,
    lo: available && mc.replicates >= 2 ? finite(band.lo[i]) : null,
    hi: available && mc.replicates >= 2 ? finite(band.hi[i]) : null,
    unit: `/${population} members`,
    note: available ? undefined : 'No defended asset; unavailable.',
  })
  const timeRow = (
    label: string,
    stat: Stat,
    quantity: 'detected' | 'warning',
    available = true,
  ): RunRow => ({
    label,
    mean: available ? statMean(stat) : null,
    lo: available && stat.n >= 30 && stat.conf === 0.95 ? finite(stat.lo) : null,
    hi: available && stat.n >= 30 && stat.conf === 0.95 ? finite(stat.hi) : null,
    unit: label === 'First detect' ? 's from T0' : 's',
    note: available ? timeStatSub(stat, quantity) : 'No defended asset; unavailable.',
  })
  const salvoBand =
    salvos.length === 1 && salvos[0].n >= 2 && salvos[0].conf === 0.95 ? salvos[0] : null
  return {
    population,
    rows: [
      countRow('Kills', mc.kills),
      countRow('Leakers', mc.leakers, hasAsset),
      timeRow('First detect', mc.firstDetectS, 'detected'),
      timeRow('Min warning', mc.minWarningS, 'warning', hasAsset),
      {
        label: 'Salvos',
        mean: salvoMean,
        lo: finite(salvoBand?.lo),
        hi: finite(salvoBand?.hi),
        unit: 'salvos',
        note: salvoBand
          ? 'One effector; its salvo interval is the aggregate interval.'
          : 'Aggregate interval unavailable; per-effector intervals cannot be added.',
      },
    ],
  }
}

const hasAssetIn = (record: RunRecord) =>
  record.scenario.entities.some((entity) => entity.kind === 'asset' && entityActive(entity))

// The summary's own replicate count, never the manifest setting: the loop may
// have stopped early.
const runScope = (record: RunRecord, population: number) =>
  `${record.mc.replicates} replicates · ${record.manifest.uncertainty === 'total' ? 'Total uncertainty' : 'Aleatory uncertainty'} · seed ${record.mc.seed} · full run T+${formatTime(record.mc.durationS)} · ${population} members`

// Each side's interval sits under its mean, so no unit breaks mid-word.
const compareWidths = ['22%', '28%', '28%', '22%']

export interface SavedRunCompareViewProps {
  runs: RunSummary[]
  a: RunRecord | null
  b: RunRecord | null
  error: string | null
  onPick: (side: 'a' | 'b', id: string) => void
}

/**
 * Two saved runs side by side. Each side keeps its own replicate basis, horizon
 * and population, so only the means are differenced. A count delta is in members,
 * because two records may raid different populations.
 */
export function SavedRunCompareView({ runs, a, b, error, onPick }: SavedRunCompareViewProps) {
  const left = a ? savedRunRows(a.mc, hasAssetIn(a)) : null
  const right = b ? savedRunRows(b.mc, hasAssetIn(b)) : null
  const picker = (side: 'a' | 'b', record: RunRecord | null) => (
    <div className="insp-row">
      <span>Run {side.toUpperCase()}</span>
      <select
        value={record?.id ?? ''}
        aria-label={`Run ${side.toUpperCase()}`}
        onChange={(event) => onPick(side, event.target.value)}
      >
        <option value="">choose a saved run…</option>
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.label}
          </option>
        ))}
      </select>
    </div>
  )
  const value = (number: number | null, unit: string) =>
    number == null ? '—' : `${formatCount(number)} ${unit}`
  const band = (row: RunRow) =>
    row.lo == null || row.hi == null
      ? 'Unavailable'
      : `${formatCount(row.lo)} to ${formatCount(row.hi)} ${row.unit}`
  return (
    <section aria-label="Compare saved runs">
      <h4>Compare saved runs</h4>
      {error && <p className="muted small">{error}</p>}
      {!error && runs.length < 2 && (
        <p className="muted small">
          {runs.length} saved {runs.length === 1 ? 'run' : 'runs'}. Save two runs on Outcome to
          compare them here.
        </p>
      )}
      {runs.length >= 2 && (
        <>
          {picker('a', a)}
          {picker('b', b)}
          {a && b && left && right && (
            <>
              <p className="analysis-scope">
                A · {a.label} · {runScope(a, left.population)}
              </p>
              <p className="analysis-scope">
                B · {b.label} · {runScope(b, right.population)}
              </p>
              <p className="muted small">
                Each cell holds the ensemble mean and, under it, the 95 % interval on that mean. A
                count is members of that record's own raid.
              </p>
              <table className="tb tb-dense" aria-label="Saved run A against saved run B">
                <thead>
                  <tr>
                    {['Quantity', 'A', 'B', 'A − B'].map((label, index) => (
                      <th
                        key={label}
                        scope="col"
                        style={{ ...cellStyle, width: compareWidths[index] }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROW_KEYS.map((key, r) => {
                    const rowA = left.rows[r]
                    const rowB = right.rows[r]
                    const delta =
                      rowA.mean != null && rowB.mean != null ? rowA.mean - rowB.mean : null
                    const side = (row: RunRow) => (
                      <td style={cellStyle}>
                        {value(row.mean, row.unit)}
                        <small style={{ display: 'block' }}>{band(row)}</small>
                      </td>
                    )
                    return (
                      <tr key={key}>
                        <th scope="row" style={{ ...cellStyle, width: compareWidths[0] }}>
                          {rowA.label}
                        </th>
                        {side(rowA)}
                        {side(rowB)}
                        <td style={cellStyle}>
                          {delta == null
                            ? '—'
                            : `${signed(delta)} ${r < 2 ? 'members' : rowA.unit}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <details className="analysis-disclosure">
                <summary>Interval and definedness details</summary>
                {left.rows.map((row, r) => (
                  <p className="muted small" key={row.label}>
                    {row.label} · A: {row.note ?? 'Interval on the ensemble mean.'} · B:{' '}
                    {right.rows[r].note ?? 'Interval on the ensemble mean.'}
                  </p>
                ))}
                {left.population !== right.population && (
                  <p className="muted small">
                    Populations differ, {left.population} against {right.population} members; count
                    deltas are in members.
                  </p>
                )}
                {a.id === b.id && (
                  <p className="muted small">
                    Both sides are the same record; every delta is zero.
                  </p>
                )}
                <p className="muted small">
                  Bands are intervals on each record's own ensemble mean. Deltas are A minus B; no
                  interval is claimed on a difference of two independent runs.
                </p>
              </details>
              <RecordExports record={a} title="Export A" />
              <RecordExports record={b} title="Export B" />
            </>
          )}
          {(!a || !b) && (
            <p className="muted small">Choose two saved runs to see the delta table.</p>
          )}
        </>
      )}
    </section>
  )
}

/** The container: the run list, the two opened records, and nothing until the first read settles. */
function SavedRunCompare() {
  const [load, setLoad] = useState<{
    status: 'loading' | 'ready' | 'error'
    runs: RunSummary[]
    error: string | null
  }>({ status: 'loading', runs: [], error: null })
  const [sides, setSides] = useState<{ a: RunRecord | null; b: RunRecord | null }>({
    a: null,
    b: null,
  })

  useEffect(() => {
    let live = true
    // The two newest records open by default.
    const open = (side: 'a' | 'b', id: string | undefined) => {
      if (!id) return
      getRun(id).then(
        (record) => {
          if (live && record) setSides((current) => ({ ...current, [side]: record }))
        },
        (error: unknown) => {
          if (live) setLoad((state) => ({ ...state, status: 'error', error: loadError(error) }))
        },
      )
    }
    listRuns().then(
      (runs) => {
        if (!live) return
        setLoad({ status: 'ready', runs, error: null })
        open('a', runs[0]?.id)
        open('b', runs[1]?.id)
      },
      (error: unknown) => {
        if (live) setLoad({ status: 'error', runs: [], error: loadError(error) })
      },
    )
    return () => {
      live = false
    }
  }, [])

  if (load.status === 'loading') return null
  return (
    <SavedRunCompareView
      runs={load.runs}
      a={sides.a}
      b={sides.b}
      error={load.error}
      onPick={(side, id) => {
        if (!id) {
          setSides((current) => ({ ...current, [side]: null }))
          return
        }
        getRun(id).then(
          (record) => {
            if (record) setSides((current) => ({ ...current, [side]: record }))
          },
          (error: unknown) =>
            setLoad((state) => ({ ...state, status: 'error', error: loadError(error) })),
        )
      }}
    />
  )
}

export function CompareScreen() {
  const trial = useTrialResult()
  const { selection, snapshot } = trial
  const mcState = useStore((state) => state.mc)
  const runId = useStore((state) => state.playback.runId)
  const scenario = useStore((state) => state.scenario)
  const complete = useStore(selectRunComplete)
  const horizon = useStore((state) => selectTrialHorizon(state, state.playback.observedThroughS))
  const baseline = useStore((state) => state.baseline)
  const mc = currentSummary(mcState, runId)
  // Also guards a summary restored without a signature; an edit is already stale.
  const current = useMemo(
    () =>
      mc != null &&
      (mcState.basisSignature == null ||
        mcState.basisSignature === analysisBasisSignature(scenario)),
    [mc, mcState.basisSignature, scenario],
  )
  // Saved-run comparison needs no trial and no current ensemble, so it renders
  // below both placeholders.
  if (
    selection.status === 'idle' ||
    selection.status === 'cancelled' ||
    (selection.status === 'ready' && !snapshot)
  ) {
    return (
      <>
        <EmptyRow>No trial yet. Press Play in Execute to run one.</EmptyRow>
        <SavedRunCompare />
      </>
    )
  }
  if (!mc)
    return (
      <>
        <div role="region" aria-label="Compare" className="muted small">
          Monte Carlo ·{' '}
          {mcState.status === 'running'
            ? 'Running ensemble.'
            : mcState.status === 'error'
              ? mcState.error
              : 'No current ensemble result.'}
        </div>
        <SavedRunCompare />
      </>
    )
  const view = trialViewOf(trial)
  return (
    <section className="analysis-primary" aria-label="Compare">
      <h3>Compare</h3>
      <p className="analysis-scope">
        Monte Carlo · {mc.replicates} replicates ·{' '}
        {runSettings(scenario).uncertainty === 'total'
          ? 'Total uncertainty'
          : 'Aleatory uncertainty'}{' '}
        · seed {mc.seed} · 95 % band · full run T+{formatTime(mc.durationS)}
      </p>
      {view && complete && horizon >= view.durationS && mc.durationS === view.durationS ? (
        <CompletedCompare view={view} mc={mc} baseline={baseline} />
      ) : (
        <p className="muted small">
          {!view
            ? trialStateText(selection)
            : mc.durationS !== view.durationS
              ? 'Ensemble and trial horizons differ. Run Monte Carlo again for this trial.'
              : 'Trial in progress. Complete playback in Execute to compare.'}
        </p>
      )}
      <BaselineRow mc={mc} current={current} />
      <SavedRunCompare />
    </section>
  )
}
