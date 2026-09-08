import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { engagementPicture } from '../../../analysis/impact'
import { trialKpisAt } from '../../../analysis/liveStats'
import { assessRunValidity } from '../../../analysis/runValidity'
import type { TrialResultView } from '../../../analysis/trialResult'
import { trialSeriesOf } from '../../../analysis/trialSeries'
import { BandChart } from '../../../charts/BandChart'
import { formatTime } from '../../../geometry/geo'
import { runSettings } from '../../../model/types'
import type { BandSeries, McSummary, Stat } from '../../../playback/mcRun'
import { DT } from '../../../playback/clock'
import { selectRunComplete } from '../../../state/selectors'
import { useStore } from '../../../state/store'
import { selectTrialHorizon } from '../../../state/trialSelectors'
import { State } from '../../../ui/kit'
import { trialStateText, trialViewOf, useTrialResult } from '../widgets/controls'
import { currentSummary, formatCount, statMean, timeStatSub } from '../widgets/mc'
import { SEVERITY_PILL } from '../widgets/RunValidityWidget'

type DeltaRow = { label: string; trial: number | null; mean: number | null; lo: number | null; hi: number | null; unit: string; note?: string }
// Interval ends and units must remain readable at the panel's minimum width.
const cellStyle: CSSProperties = { whiteSpace: 'normal', overflowWrap: 'anywhere', overflow: 'visible' }
const finite = (value: number | null | undefined) => value != null && Number.isFinite(value) ? value : null
const minimum = (values: Array<number | null>) => {
  const defined = values.filter((value): value is number => finite(value) != null)
  return defined.length ? Math.min(...defined) : null
}

function CompletedCompare({ view, mc }: { view: TrialResultView; mc: McSummary }) {
  const data = useMemo(() => {
    const kpis = trialKpisAt(view, view.durationS)
    const population = Object.values(mc.perThreat).reduce((sum, row) => sum + row.shipCount, 0)
    const i = Math.floor(mc.durationS / DT)
    const countRow = (label: string, trial: number | null, band: BandSeries, available = true): DeltaRow => ({
      label, trial, mean: available && mc.replicates > 0 ? finite(band.mean[i]) : null,
      lo: available && mc.replicates >= 2 ? finite(band.lo[i]) : null,
      hi: available && mc.replicates >= 2 ? finite(band.hi[i]) : null, unit: `/${population} members`,
    })
    const timeRow = (label: string, trial: number | null, stat: Stat, quantity: 'detected' | 'warning', available = true): DeltaRow => ({
      label, trial, mean: available ? statMean(stat) : null,
      lo: available && stat.n >= 30 && stat.conf === 0.95 ? finite(stat.lo) : null,
      hi: available && stat.n >= 30 && stat.conf === 0.95 ? finite(stat.hi) : null,
      unit: label === 'First detect' ? 's from T0' : 's', note: available ? timeStatSub(stat, quantity) : 'No defended asset; unavailable.',
    })
    const salvos = Object.values(mc.perEffector).map(row => row.salvos)
    // Means add; marginal intervals cannot supply the covariance of total salvos.
    const salvoMean = mc.replicates > 0 && salvos.length > 0 && salvos.every(stat => stat.n === mc.replicates && statMean(stat) != null)
      ? salvos.reduce((sum, stat) => sum + stat.mean, 0) : null
    const salvoBand = salvos.length === 1 && salvos[0].n >= 2 && salvos[0].conf === 0.95 ? salvos[0] : null
    const rows = [
      countRow('Kills', kpis.kills, mc.kills),
      countRow('Leakers', kpis.reportedLeakers, mc.leakers, view.hasActiveAsset),
      timeRow('First detect', minimum(view.assessments.map(a => a.firstDetectS)), mc.firstDetectS, 'detected'),
      timeRow('Min warning', view.hasActiveAsset ? minimum(view.assessments.map(a => a.warningS)) : null, mc.minWarningS, 'warning', view.hasActiveAsset),
      { label: 'Salvos', trial: kpis.kineticShots + kpis.deSalvos + kpis.jamSalvos, mean: salvoMean,
        lo: finite(salvoBand?.lo), hi: finite(salvoBand?.hi), unit: 'salvos',
        note: salvoBand ? 'One effector; its salvo interval is the aggregate interval.' : 'Aggregate interval unavailable; per-effector intervals cannot be added.' },
    ]
    const forecast = engagementPicture(view.scenario)
    const validity = assessRunValidity(view.scenario, forecast.assessments, undefined, { assessments: view.assessments, kills: kpis.kills, mc })
    return { rows, population, trial: trialSeriesOf(view, view.durationS).kpi.find(series => series.id === 'kpi.expectedKills')!,
      findings: validity.findings.filter(finding => finding.id !== 'planning-envelope') }
  }, [view, mc])
  const value = (number: number | null, unit: string) => number == null ? '—' : `${formatCount(number)} ${unit}`
  return (
    <>
      <p className="muted small">Simulated trial · one draw · seed {view.manifest.seed} · through T+{formatTime(view.durationS)}. Kills exclude late effects. Bands are intervals on ensemble means, not replicate ranges; count bounds may use Wilson or rule of three.</p>
      <BandChart ensemble={mc.kills} trial={data.trial} durationS={mc.durationS} population={data.population} replicates={mc.replicates} />
      <table className="tb tb-dense" aria-label={`Trial against ensemble through T+${formatTime(view.durationS)}`}>
        <thead><tr>
          {(['Quantity', 'Trial', 'Ensemble mean', '95 % band', 'Flag'] as const).map((label, i) => (
            <th key={label} scope="col" style={{ ...cellStyle, width: ['18%', '18%', '20%', '24%', '20%'][i] }}>{label}</th>
          ))}
        </tr></thead>
        <tbody>{data.rows.map(row => {
          const comparable = row.trial != null && row.mean != null && row.lo != null && row.hi != null
          const inside = comparable && row.trial! >= row.lo! && row.trial! <= row.hi!
          return <tr key={row.label}>
            <th scope="row" style={{ ...cellStyle, width: '18%' }}>{row.label}</th>
            <td style={cellStyle}>{value(row.trial, row.unit)}</td>
            <td style={cellStyle}>{value(row.mean, row.unit)}</td>
            <td style={cellStyle}>{row.lo == null || row.hi == null ? 'Unavailable' : `${formatCount(row.lo)} to ${formatCount(row.hi)} ${row.unit}`}</td>
            <td style={cellStyle}>{comparable ? <State tone={inside ? 'nominal' : 'warning'} style={{ whiteSpace: 'normal', fontSize: 'var(--type-dense-size)' }}>{inside ? 'inside' : 'outside'}</State> : '—'}</td>
          </tr>
        })}</tbody>
      </table>
      <details className="analysis-disclosure">
        <summary>Interval and definedness details</summary>
        {data.rows.filter(row => row.note).map(row => <p className="muted small" key={row.label}>{row.label}: {row.note}</p>)}
        {!view.hasActiveAsset && <p className="muted small">No defended asset · arrival and leakage unavailable.</p>}
      </details>
      <section aria-label="Findings">
        <h4>Findings</h4>
        {data.findings.map(finding => <div className="validity-finding" key={finding.id}>
          <State tone={SEVERITY_PILL[finding.severity].tone}>{SEVERITY_PILL[finding.severity].text}</State>
          <div><p>{finding.message}</p><button className="mini" type="button" onClick={() => {
            const store = useStore.getState()
            if (finding.uasIds.length) {
              store.select({ entityIds: finding.uasIds })
              store.setRightTab('inspect')
            }
            store.setBoardPhase('prepare')
          }}>{finding.uasIds.length ? 'Review tracks in Prepare' : 'Review in Prepare'}</button></div>
        </div>)}
        {!data.findings.length && <p className="muted small">No findings.</p>}
      </section>
      <div className="insp-row"><span>No pinned baseline</span><button className="mini" type="button" disabled>Pin</button></div>
    </>
  )
}

export function CompareScreen() {
  const trial = useTrialResult()
  const { selection, snapshot } = trial
  const mcState = useStore(state => state.mc)
  const runId = useStore(state => state.playback.runId)
  const scenario = useStore(state => state.scenario)
  const runMonteCarlo = useStore(state => state.runMonteCarlo)
  const complete = useStore(selectRunComplete)
  const horizon = useStore(state => selectTrialHorizon(state, state.playback.observedThroughS))
  const mc = currentSummary(mcState, runId)
  if (selection.status === 'idle' || selection.status === 'cancelled' || (selection.status === 'ready' && !snapshot)) {
    return <p className="muted small">No trial yet. Press Play in Execute to run one.</p>
  }
  if (!mc) return <div role="region" aria-label="Compare" className="muted small">Monte Carlo · {mcState.status === 'running' ? 'Running ensemble.' : mcState.status === 'error' ? mcState.error : 'No current ensemble result.'}{' '}
    <button className="mini" type="button" disabled={mcState.status === 'running'} onClick={runMonteCarlo}>Run Monte Carlo</button></div>
  const view = trialViewOf(trial)
  return (
    <section className="analysis-primary" aria-label="Compare">
      <h3>Compare</h3>
      <p className="analysis-scope">Monte Carlo · {mc.replicates} replicates · {runSettings(scenario).uncertainty === 'total' ? 'Total uncertainty' : 'Aleatory uncertainty'} · seed {mc.seed} · 95 % band · full run T+{formatTime(mc.durationS)}</p>
      {view && complete && horizon >= view.durationS && mc.durationS === view.durationS
        ? <CompletedCompare view={view} mc={mc} />
        : <p className="muted small">{!view ? trialStateText(selection) : mc.durationS !== view.durationS ? 'Ensemble and trial horizons differ. Run Monte Carlo again for this trial.' : 'Trial in progress. Complete playback in Execute to compare.'}</p>}
    </section>
  )
}
