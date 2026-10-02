import { useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { trialKpisAt } from '../../../analysis/liveStats'
import type { TrialResultView } from '../../../analysis/trialResult'
import { trialSeriesOf } from '../../../analysis/trialSeries'
import { BandChart } from '../../../charts/BandChart'
import { exportChartPng } from '../../../charts/exportPng'
import { readTokens } from '../../../charts/tokens'
import { formatTime } from '../../../geometry/geo'
import { entityActive, runSettings } from '../../../model/types'
import type { RunRecord } from '../../../model/runRecord'
import type { BandSeries, McSummary, Stat } from '../../../playback/mcRun'
import { DT } from '../../../playback/clock'
import { safeName } from '../../../io/persist'
import { analysisBasisSignature } from '../../../state/analysisBasis'
import type { PinnedBaseline } from '../../../state/baseline'
import { defaultBaselineLabel } from '../../../state/baseline'
import { selectRunComplete } from '../../../state/selectors'
import { useStore } from '../../../state/store'
import { selectTrialHorizon } from '../../../state/trialSelectors'
import { IconInfo } from '../../../ui/icons'
import { State } from '../../../ui/kit'
import { PanelSection } from '../../../ui/PanelSection'
import { EmptyRow, trialStateText, trialViewOf } from '../controls'
import { useTrialResult } from '../../../state/useTrialResult'
import { currentSummary, formatCount, statMean, timeStatSub } from '../mc'
import { SavedRuns } from '../RunHistory'
import { useRunHistorySave } from '../useRunHistorySave'

type MeanKey = 'kills' | 'leakers' | 'firstDetect' | 'minWarning' | 'salvos'
const ROW_KEYS: MeanKey[] = ['kills', 'leakers', 'firstDetect', 'minWarning', 'salvos']
/** The short unit under a row label; the row title spells the unit out. */
const SCALE_UNIT: Record<MeanKey, string> = {
  kills: 'mem',
  leakers: 'mem',
  firstDetect: 's',
  minWarning: 's',
  salvos: 'slv',
}
type DeltaRow = {
  key: MeanKey
  label: string
  trial: number | null
  mean: number | null
  lo: number | null
  hi: number | null
  unit: string
  note?: string
}
const finite = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? value : null
const minimum = (values: Array<number | null>) => {
  const defined = values.filter((value): value is number => finite(value) != null)
  return defined.length ? Math.min(...defined) : null
}
const isCount = (key: MeanKey) => key === 'kills' || key === 'leakers'

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
// Four characters hold the trial column at every drawer width.
const short = (value: number) =>
  Math.abs(value) >= 100 ? `${Math.round(value)}` : formatCount(value)

/**
 * One scale per row. A count runs from zero to the raid (or the baseline mean,
 * when a larger raid set it); a time or salvo scale spans every value it draws,
 * with a tenth of the span as margin, on whole numbers.
 */
function scaleOf(row: DeltaRow, baseMean: number | null, population: number): [number, number] {
  if (isCount(row.key)) return [0, Math.max(population, baseMean ?? 0, 1)]
  const values = [row.lo, row.hi, row.mean, row.trial, baseMean].filter(
    (value): value is number => finite(value) != null,
  )
  if (!values.length) return [0, 1]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = hi > lo ? (hi - lo) / 10 : Math.max(Math.abs(hi) / 10, 1)
  return [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)]
}

/** One quantity: its band, mean, baseline tick and trial dot on the row's own scale. */
function IntervalRow({
  row,
  baseMean,
  population,
  baseNote,
}: {
  row: DeltaRow
  baseMean: number | null
  population: number
  baseNote: string | null
}) {
  const [a, b] = scaleOf(row, baseMean, population)
  const at = (value: number) =>
    `${(Math.min(1, Math.max(0, (value - a) / (b - a))) * 100).toFixed(2)}%`
  const comparable = row.trial != null && row.mean != null && row.lo != null && row.hi != null
  const inside = comparable && row.trial! >= row.lo! && row.trial! <= row.hi!
  const text = (value: number | null) => (value == null ? '—' : `${formatCount(value)} ${row.unit}`)
  const parts = [
    `${row.label} · trial ${text(row.trial)}`,
    `ensemble mean ${text(row.mean)}`,
    row.lo == null || row.hi == null
      ? '95 % CI of mean unavailable'
      : `95 % CI of mean ${formatCount(row.lo)} to ${formatCount(row.hi)} ${row.unit}`,
    baseNote != null && `baseline mean ${text(baseMean)}`,
    row.note,
  ]
  const title = [...parts, comparable && (inside ? 'inside' : 'outside')]
    .filter(Boolean)
    .join(' · ')
  // The head row and plot are aria-hidden, so the row speaks this sentence instead.
  const description = [...parts, comparable && `trial ${inside ? 'inside' : 'outside'} the 95 % CI`]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="cmp-dp" title={title}>
      <span className="r2b-sr">{description}</span>
      <span className="cmp-q" aria-hidden="true">
        {row.label}
        <small>
          {a}–{b} {SCALE_UNIT[row.key]}
        </small>
      </span>
      <span className="cmp-plot" aria-hidden="true">
        <span className="cmp-ax" />
        {row.lo != null && row.hi != null && (
          <span
            className="cmp-band"
            style={{ left: at(row.lo), width: `calc(${at(row.hi)} - ${at(row.lo)} + 2px)` }}
          />
        )}
        {row.mean != null && <span className="cmp-mean" style={{ left: at(row.mean) }} />}
        {baseNote != null && baseMean != null && (
          <span className="cmp-base" style={{ left: at(baseMean) }} />
        )}
        {row.trial != null && <span className="cmp-trial" style={{ left: at(row.trial) }} />}
      </span>
      <span className="cmp-tv" aria-hidden="true">
        {row.trial == null ? '—' : short(row.trial)}
      </span>
      <span className="cmp-flag" aria-hidden="true">
        {comparable ? (
          <State tone={inside ? 'nominal' : 'warning'} title={inside ? 'inside' : 'outside'}>
            <span className="cmp-flag-w">{inside ? 'inside' : 'outside'}</span>
          </State>
        ) : (
          '—'
        )}
      </span>
    </div>
  )
}

/** A 16 px download arrow for the chart export; the button carries the label. */
function IconDownload() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 2.5v8M4.75 7.25 8 10.5l3.25-3.25M3 13.5h10" />
    </svg>
  )
}

/** The method note behind the head (i); with field help on it also renders as a line. */
function InfoButton({ label, note }: { label: string; note: string }) {
  return (
    <button type="button" className="field-info" aria-label={`About ${label}`} title={note}>
      <IconInfo />
    </button>
  )
}

function CompletedCompare({
  view,
  mc,
  baseline,
  frame,
}: {
  view: TrialResultView
  mc: McSummary
  baseline: PinnedBaseline | null
  frame: RefObject<HTMLDivElement | null>
}) {
  const data = useMemo(() => {
    const kpis = trialKpisAt(view, view.durationS)
    const { population, i, salvos, salvoMean } = ensembleMeans(mc, view.hasActiveAsset)
    const countRow = (
      key: MeanKey,
      label: string,
      trial: number | null,
      band: BandSeries,
      available = true,
    ): DeltaRow => ({
      key,
      label,
      trial,
      mean: available && mc.replicates > 0 ? finite(band.mean[i]) : null,
      lo: available && mc.replicates >= 2 ? finite(band.lo[i]) : null,
      hi: available && mc.replicates >= 2 ? finite(band.hi[i]) : null,
      unit: `/${population} members`,
      note: available ? undefined : 'No defended asset; unavailable.',
    })
    const timeRow = (
      key: MeanKey,
      label: string,
      trial: number | null,
      stat: Stat,
      quantity: 'detected' | 'warning',
      available = true,
    ): DeltaRow => ({
      key,
      label,
      trial,
      mean: available ? statMean(stat) : null,
      lo: available && stat.n >= 30 && stat.conf === 0.95 ? finite(stat.lo) : null,
      hi: available && stat.n >= 30 && stat.conf === 0.95 ? finite(stat.hi) : null,
      unit: key === 'firstDetect' ? 's from T0' : 's',
      note: available ? timeStatSub(stat, quantity) : 'No defended asset; unavailable.',
    })
    const salvoBand =
      salvos.length === 1 && salvos[0].n >= 2 && salvos[0].conf === 0.95 ? salvos[0] : null
    const rows: DeltaRow[] = [
      countRow('kills', 'Kills', kpis.kills, mc.kills),
      countRow('leakers', 'Leakers', kpis.reportedLeakers, mc.leakers, view.hasActiveAsset),
      timeRow(
        'firstDetect',
        'First detect',
        minimum(view.assessments.map((a) => a.firstDetectS)),
        mc.firstDetectS,
        'detected',
      ),
      timeRow(
        'minWarning',
        'Min warning',
        view.hasActiveAsset ? minimum(view.assessments.map((a) => a.warningS)) : null,
        mc.minWarningS,
        'warning',
        view.hasActiveAsset,
      ),
      {
        key: 'salvos',
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
    return {
      rows,
      population,
      trial: trialSeriesOf(view, view.durationS).kpi.find(
        (series) => series.id === 'kpi.expectedKills',
      )!,
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
  const baseNote =
    baseline && base
      ? `${baseline.label} · ${base.population} members${base.population !== data.population ? ', population differs' : ''}`
      : null
  return (
    <>
      <div ref={frame}>
        <BandChart
          ensemble={mc.kills}
          trial={data.trial}
          baseline={base?.series}
          durationS={mc.durationS}
          population={data.population}
          replicates={mc.replicates}
        />
      </div>
      <div
        className="cmp-dots"
        role="group"
        aria-label={`Trial against ensemble through T+${formatTime(view.durationS)}`}
      >
        <div
          className="cmp-dp-head"
          aria-hidden="true"
          title="Quantity and scale · end of run, 95 % CI of the ensemble mean · trial value · flag"
        >
          <span>Quantity</span>
          <span>End of run, 95 % CI of mean</span>
          <span className="cmp-tv">Trial</span>
          <span>Flag</span>
        </div>
        {data.rows.map((row) => (
          <IntervalRow
            key={row.key}
            row={row}
            baseMean={base ? base.means[row.key] : null}
            population={data.population}
            baseNote={baseNote}
          />
        ))}
      </div>
    </>
  )
}

/** The method note of the trial section: the basis of both sides and the interval rules. */
function trialNote(
  view: TrialResultView | null,
  mc: McSummary,
  uncertainty: string,
  baseline: PinnedBaseline | null,
): string {
  return [
    view &&
      `One simulated draw, seed ${view.manifest.seed}, through T+${formatTime(view.durationS)}, against the ensemble: ${mc.replicates} replicates, ${uncertainty} uncertainty, seed ${mc.seed}, full run T+${formatTime(mc.durationS)}.`,
    'Bands are 95 % intervals on the ensemble mean, not replicate ranges; count bounds may use Wilson or the rule of three, and a time band needs 30 defined samples.',
    'Kills exclude late effects.',
    view && !view.hasActiveAsset && 'No defended asset: arrival and leakage are unavailable.',
    baseline &&
      `The dashed tick is the pinned baseline mean (${baseline.label}, ${baseline.mc.replicates} replicates, seed ${baseline.mc.seed}); a count is in members of each raid.`,
  ]
    .filter(Boolean)
    .join(' ')
}

/** The baseline row: its label and Clear, or Pin current. Pin needs a done summary for the current run and basis. */
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
  if (baseline) {
    const label = `Baseline · ${baseline.label}${pinnedAt ? ` pinned ${pinnedAt}` : ''}`
    return (
      <div className="cmp-base-row pinned" aria-label="Baseline">
        <span
          className="cmp-base-label"
          title={`${label} · ${baseline.mc.replicates} replicates · seed ${baseline.mc.seed} · full run T+${formatTime(baseline.mc.durationS)}`}
        >
          Baseline · {baseline.label}
          {pinnedAt && <span className="muted small"> pinned {pinnedAt}</span>}
        </span>
        <button className="mini" type="button" onClick={clearBaseline}>
          Clear
        </button>
      </div>
    )
  }
  const ready = mc != null && current
  return (
    <div className="cmp-base-row" aria-label="Baseline">
      <span className="cmp-base-label">No baseline.</span>
      <button
        className="mini"
        type="button"
        disabled={!ready}
        title={
          ready
            ? 'Pin this ensemble as the baseline'
            : 'Needs a finished ensemble for the current scenario'
        }
        onClick={() => pinBaseline()}
      >
        Pin current
      </button>
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

/**
 * Saved run A against saved run B, under the Saved runs list. Each side keeps its
 * own replicate basis, horizon and population, so only the means are differenced,
 * and no interval is drawn on the difference. A count delta is in members, because
 * two records may raid different populations.
 */
export function SavedRunDelta({ a, b }: { a: RunRecord; b: RunRecord }) {
  const left = savedRunRows(a.mc, hasAssetIn(a))
  const right = savedRunRows(b.mc, hasAssetIn(b))
  const side = (row: RunRow) => (
    <td
      className="saved-num"
      title={[
        row.mean == null ? 'mean unavailable' : `mean ${formatCount(row.mean)} ${row.unit}`,
        row.lo == null || row.hi == null
          ? '95 % CI unavailable'
          : `95 % CI ${formatCount(row.lo)} to ${formatCount(row.hi)}`,
        row.note,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      {row.mean == null ? '—' : formatCount(row.mean)}
      <small>
        {row.lo == null || row.hi == null
          ? 'no CI'
          : `${formatCount(row.lo)}–${formatCount(row.hi)}`}
      </small>
    </td>
  )
  const populations =
    left.population !== right.population
      ? ` Populations differ, ${left.population} against ${right.population} members; count deltas are in members.`
      : ''
  return (
    <>
      <table className="tb saved-delta" aria-label="Saved run A against saved run B">
        <colgroup>
          <col />
          <col className="saved-c-num" />
          <col className="saved-c-num" />
          <col className="saved-c-num" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Quantity</th>
            <th
              scope="col"
              className="saved-num"
              title={`A · ${a.label} · ${runScope(a, left.population)}`}
            >
              A
            </th>
            <th
              scope="col"
              className="saved-num"
              title={`B · ${b.label} · ${runScope(b, right.population)}`}
            >
              B
            </th>
            <th scope="col" className="saved-num">
              A − B
            </th>
          </tr>
        </thead>
        <tbody>
          {ROW_KEYS.map((key, r) => {
            const rowA = left.rows[r]
            const rowB = right.rows[r]
            const delta = rowA.mean != null && rowB.mean != null ? rowA.mean - rowB.mean : null
            const unit = isCount(key) ? 'members' : key === 'firstDetect' ? 's' : rowA.unit
            return (
              <tr key={key}>
                <th scope="row" title={`${rowA.label} · A ${rowA.unit} · B ${rowB.unit}`}>
                  {rowA.label}
                </th>
                {side(rowA)}
                {side(rowB)}
                <td
                  className="saved-num"
                  title={delta == null ? undefined : `${signed(delta)} ${unit}`}
                >
                  {delta == null ? '—' : `${signed(delta)} ${SCALE_UNIT[key]}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="field-help">
        Each cell is the ensemble mean with the 95 % interval on that mean under it. No interval is
        claimed on the difference of two independent runs.{populations}
      </p>
    </>
  )
}

const TRIAL_TITLE = 'Trial against ensemble'

export function CompareScreen() {
  const trial = useTrialResult()
  const { selection, snapshot } = trial
  const mcState = useStore((state) => state.mc)
  const runId = useStore((state) => state.playback.runId)
  const scenario = useStore((state) => state.scenario)
  const complete = useStore(selectRunComplete)
  const horizon = useStore((state) => selectTrialHorizon(state, state.playback.observedThroughS))
  const baseline = useStore((state) => state.baseline)
  const showHelp = useStore((state) => state.ui.showFieldHelp)
  const save = useRunHistorySave()
  const frame = useRef<HTMLDivElement>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const mc = currentSummary(mcState, runId)
  // Also guards a summary restored without a signature; an edit is already stale.
  const current = useMemo(
    () =>
      mc != null &&
      (mcState.basisSignature == null ||
        mcState.basisSignature === analysisBasisSignature(scenario)),
    [mc, mcState.basisSignature, scenario],
  )
  // Saved runs need no trial and no current ensemble, so they render under every state.
  const saved = <SavedRuns save={save} delta={(a, b) => <SavedRunDelta a={a} b={b} />} />
  if (
    selection.status === 'idle' ||
    selection.status === 'cancelled' ||
    (selection.status === 'ready' && !snapshot)
  ) {
    return (
      <section className="analysis-primary" aria-label="Compare">
        <PanelSection title={TRIAL_TITLE}>
          <EmptyRow>No trial yet. Press Play in Execute to run one.</EmptyRow>
        </PanelSection>
        {saved}
      </section>
    )
  }
  if (!mc)
    return (
      <section className="analysis-primary" aria-label="Compare">
        <PanelSection title={TRIAL_TITLE}>
          <p className="muted small">
            Monte Carlo ·{' '}
            {mcState.status === 'running'
              ? 'Running ensemble.'
              : mcState.status === 'error'
                ? mcState.error
                : 'No current ensemble result.'}
          </p>
        </PanelSection>
        {saved}
      </section>
    )
  const view = trialViewOf(trial)
  const ready =
    view != null && complete && horizon >= view.durationS && mc.durationS === view.durationS
  const uncertainty = runSettings(scenario).uncertainty === 'total' ? 'total' : 'aleatory'
  const note = trialNote(ready ? view : null, mc, uncertainty, baseline)
  const exportPng = () => {
    // The chart paints from CSS custom properties, so the export passes the panel surface.
    const name = view ? safeName(view.scenario.name) : 'scenario'
    exportChartPng(frame.current, `${name}.compare.png`, {
      background: readTokens().surface,
    }).then(
      () => setExportError(null),
      (reason: unknown) =>
        setExportError(reason instanceof Error ? reason.message : 'Could not export the chart.'),
    )
  }
  return (
    <section className="analysis-primary" aria-label="Compare">
      <PanelSection
        title={TRIAL_TITLE}
        className="cmp-trial-sec"
        // Under 360 px the seed drops from the head; the (i) note keeps it.
        readout={
          <>
            {mc.replicates.toLocaleString('en-US')} runs
            <span className="cmp-seed"> · seed {mc.seed}</span>
          </>
        }
        end={
          <>
            {ready && (
              <button
                type="button"
                className="saved-icon"
                aria-label="Export chart as PNG"
                title="Export chart as PNG"
                onClick={exportPng}
              >
                <IconDownload />
              </button>
            )}
            <InfoButton label={TRIAL_TITLE} note={note} />
          </>
        }
      >
        {showHelp && <p className="field-help">{note}</p>}
        {ready ? (
          <CompletedCompare view={view} mc={mc} baseline={baseline} frame={frame} />
        ) : (
          <p className="muted small">
            {!view
              ? trialStateText(selection)
              : mc.durationS !== view.durationS
                ? 'Ensemble and trial horizons differ. Run Monte Carlo again for this trial.'
                : 'Trial in progress. Complete playback in Execute to compare.'}
          </p>
        )}
        {exportError && (
          <State tone="critical" role="status">
            {exportError}
          </State>
        )}
        <BaselineRow mc={mc} current={current} />
      </PanelSection>
      {saved}
    </section>
  )
}
