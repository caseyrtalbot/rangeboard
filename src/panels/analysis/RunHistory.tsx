/**
 * Saved run history on Outcome: the list of records in the run store, and one
 * opened record rendered in place. Every number comes from the record's own
 * `mc`, so each readout carries that record's replicate basis, never the
 * current Board ensemble. `RunHistoryView` and `RunRecordView` are pure; only
 * `RunHistory` reads the store.
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { formatTime } from '../../geometry/geo'
import type { RunRecord } from '../../model/runRecord'
import type { BandSeries, McSummary, Stat } from '../../playback/mcRun'
import type { RunSummary } from '../../io/runStore'
import { deleteRun, getRun, listRuns } from '../../io/runStore'
import { exportRunCsv } from '../../io/exportCsv'
import { exportRunRecordPackage, importRunRecordFile } from '../../io/persist'
import { formatCount, statMean } from './mc'

/** What Outcome supplies: whether this Board state may be saved, and the save itself. */
export interface RunHistorySave {
  enabled: boolean
  /** Why the button is disabled, or what saving does. */
  reason: string
  run: () => Promise<{ evicted: string[] }>
}

/** The basis line every readout of a saved record carries. */
function basisOf(mc: McSummary): string {
  return `Monte Carlo estimate · ${mc.replicates} replicates`
}

const savedTime = (savedAt: string) =>
  new Date(savedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })

const errorText = (error: unknown) => error instanceof Error ? error.message : 'Run history is unavailable.'

/** An array never reaches a React child: it prints its count with the JSON behind a disclosure. */
function manifestValue(value: unknown): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none'
    return (
      <details className="analysis-disclosure">
        <summary>{value.length}</summary>
        <code style={{ overflowWrap: 'anywhere' }}>{JSON.stringify(value)}</code>
      </details>
    )
  }
  return value == null ? '—' : String(value)
}

function ManifestRecord({ record }: { record: RunRecord }) {
  return (
    <dl style={{ overflowWrap: 'anywhere' }}>
      <div><dt>savedAt</dt><dd>{savedTime(record.savedAt)}</dd></div>
      <div><dt>scenario</dt><dd>{record.scenario.name}</dd></div>
      {Object.entries(record.manifest).map(([key, value]) => (
        <div key={key}><dt>{key}</dt><dd>{manifestValue(value)}</dd></div>
      ))}
    </dl>
  )
}

/** A count tile: the end-of-run mean with the interval on that mean at the same step. */
function countTile(band: BandSeries, mc: McSummary): ReactNode {
  const i = band.mean.length - 1
  const mean = mc.replicates > 0 && Number.isFinite(band.mean[i]) ? band.mean[i] : null
  const bounded = mean != null && Number.isFinite(band.lo[i]) && Number.isFinite(band.hi[i])
  return (
    <>
      {mean == null ? '—' : formatCount(mean)}
      <small style={{ display: 'block' }}>
        {bounded ? `${formatCount(band.lo[i])} to ${formatCount(band.hi[i])} (95% mean CI)` : 'mean CI unavailable'}
      </small>
      <small style={{ display: 'block' }}>{basisOf(mc)}</small>
    </>
  )
}

/** A time tile: the conditional mean, its interval method and the defined fraction. */
function timeTile(stat: Stat, mc: McSummary): ReactNode {
  const mean = statMean(stat)
  return (
    <>
      {mean == null ? '—' : formatTime(mean)}
      <small style={{ display: 'block' }}>
        {stat.interval === 'none' ? 'no interval' : `${stat.interval} interval`} · defined in {stat.n} of {stat.total}
      </small>
      <small style={{ display: 'block' }}>{basisOf(mc)}</small>
    </>
  )
}

const cell = { whiteSpace: 'normal', overflowWrap: 'anywhere' } as const
// Five columns in a 320 px panel: the label takes the slack. The action words
// never break, so the two buttons stack rather than overflow the panel.
const listWidths = ['30%', '22%', '11%', '11%', '26%']
const actionWord = { whiteSpace: 'nowrap' } as const
const meanText = (stat: Stat) => statMean(stat) == null ? '—' : formatCount(stat.mean)
const timeText = (stat: Stat) => statMean(stat) == null ? '—' : formatTime(stat.mean)

/**
 * What fixed a tile's number: the manifest entries that decided the draws and
 * the models, and the scenario hash the run was made on. Every tile of one
 * record shares the same lineage, because one run produced all of them.
 * Collapsed by default: a tile shows the estimate, not its provenance.
 */
function lineageRows(record: RunRecord): Array<[string, ReactNode]> {
  const m = record.manifest
  return [
    ['Seed', m.seed],
    ['Replicates', m.replicates],
    ['Uncertainty', m.uncertainty],
    ['Run mode', m.runMode],
    ['Engine revision', m.engineRevision],
    ['Draw policy', m.drawPolicyVersion],
    ['Data package', m.dataPackageVersion],
    ['Overrides', manifestValue(m.overrides)],
    ['Physics switches', manifestValue(m.physicsSwitches)],
    ['Fidelity floor', m.fidelityFloor],
    ['Producer', m.producer],
    ['Scenario hash', record.scenarioHash],
  ]
}

function TileLineage({ record, label }: { record: RunRecord; label: string }) {
  return (
    <details className="analysis-disclosure">
      <summary aria-label={`${label} lineage`}>Lineage</summary>
      <dl style={{ overflowWrap: 'anywhere' }}>
        {lineageRows(record).map(([name, value]) => (
          <div key={name}><dt>{name}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </details>
  )
}

/** JSON keeps the whole record; each CSV is one table. A missing table cannot be exported. */
export function RecordExports({ record, title = 'Export' }: { record: RunRecord; title?: string }) {
  return (
    <div className="insp-row" aria-label={`${title} this run`}>
      <span className="muted small">{title}</span>
      <span style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button className="mini" type="button" style={actionWord}
          onClick={() => exportRunRecordPackage(record)}>JSON</button>
        <button className="mini" type="button" style={actionWord}
          onClick={() => exportRunCsv(record, 'per-threat')}>Threat CSV</button>
        <button className="mini" type="button" style={actionWord}
          onClick={() => exportRunCsv(record, 'per-effector')}>Effector CSV</button>
        <button className="mini" type="button" style={actionWord} disabled={!record.sensitivity}
          title={record.sensitivity ? 'Export the sensitivity rows' : 'This run carries no sensitivity result'}
          onClick={() => exportRunCsv(record, 'sensitivity')}>Sensitivity CSV</button>
      </span>
    </div>
  )
}

/** One saved record: its manifest, its end-of-run tiles and its two per-entity tables. */
export function RunRecordView({ record }: { record: RunRecord }) {
  const mc = record.mc
  const basis = basisOf(mc)
  const name = (id: string) => record.scenario.entities.find(entity => entity.id === id)?.name ?? id
  const threats = Object.entries(mc.perThreat)
  const effectors = Object.entries(mc.perEffector)
  const tiles: Array<[string, ReactNode]> = [
    ['Kills', countTile(mc.kills, mc)],
    ['Leakers', countTile(mc.leakers, mc)],
    ['First detect', timeTile(mc.firstDetectS, mc)],
    ['Min warning', timeTile(mc.minWarningS, mc)],
  ]
  return (
    <section className="analysis-primary" aria-label={`Saved run ${record.label}`}>
      <h5>{record.label}</h5>
      <p className="analysis-scope">{basis} · seed {mc.seed} · full run T+{formatTime(mc.durationS)} · saved {savedTime(record.savedAt)}</p>
      <RecordExports record={record} />
      <div className="tiles c2" aria-label="Saved run outcomes">
        {tiles.map(([label, value]) => (
          <div className="tile" key={label}>
            <span className="tl">{label}</span>
            <div className="tv" style={cell}>{value}</div>
            <TileLineage record={record} label={label} />
          </div>
        ))}
      </div>
      <p className="muted small">Per threat · {basis}</p>
      <table className="tb tb-dense" aria-label="Saved run per-threat outcomes">
        <thead><tr>
          {['Threat', 'Killed', 'Leaked', 'First detect', 'Arrival', 'Ships'].map(label => (
            <th key={label} scope="col" style={cell}>{label}</th>
          ))}
        </tr></thead>
        <tbody>{threats.map(([id, row]) => (
          <tr key={id}>
            <th scope="row" style={cell}>{name(id)}</th>
            <td style={cell}>{meanText(row.killed)}</td>
            <td style={cell}>{meanText(row.leaked)}</td>
            <td style={cell}>{timeText(row.firstDetectS)}</td>
            <td style={cell}>{row.arrivalS == null ? '—' : formatTime(row.arrivalS)}</td>
            <td style={cell}>{row.shipCount}</td>
          </tr>
        ))}</tbody>
      </table>
      {threats.length === 0 && <p className="muted small">No threat in this record.</p>}
      <p className="muted small">Per effector · {basis}</p>
      <table className="tb tb-dense" aria-label="Saved run per-effector outcomes">
        <thead><tr>
          {['Effector', 'Salvos', 'Kills'].map(label => (
            <th key={label} scope="col" style={cell}>{label}</th>
          ))}
        </tr></thead>
        <tbody>{effectors.map(([id, row]) => (
          <tr key={id}>
            <th scope="row" style={cell}>{name(id)}</th>
            <td style={cell}>{meanText(row.salvos)}</td>
            <td style={cell}>{meanText(row.kills)}</td>
          </tr>
        ))}</tbody>
      </table>
      {effectors.length === 0 && <p className="muted small">No effector in this record.</p>}
      <details className="analysis-disclosure">
        <summary>Run manifest</summary>
        <ManifestRecord record={record} />
      </details>
    </section>
  )
}

export interface RunHistoryViewProps {
  runs: RunSummary[]
  opened: RunRecord | null
  /** The eviction line of the last save, or null. */
  notice: string | null
  error: string | null
  save: RunHistorySave
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onSave: () => void
  onImport: () => void
}

/** The list, its per-row actions and the opened record. Pure: every state arrives as a prop. */
export function RunHistoryView({ runs, opened, notice, error, save, onOpen, onDelete, onSave, onImport }: RunHistoryViewProps) {
  return (
    <section aria-label="Run history">
      <h4>Run history</h4>
      <div className="insp-row">
        <span className="muted small">{runs.length} saved {runs.length === 1 ? 'run' : 'runs'}</span>
        <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="mini" type="button" style={actionWord}
            title="Read a saved-run JSON file into this history" onClick={onImport}>Import run</button>
          <button className="mini" type="button" style={actionWord}
            disabled={!save.enabled} title={save.reason} onClick={onSave}>Save to history</button>
        </span>
      </div>
      {notice && <p className="muted small" role="status">{notice}</p>}
      {error && <p className="muted small">{error}</p>}
      {runs.length === 0 && !error && <p className="muted small">No saved run yet.</p>}
      {runs.length > 0 && (
        <table className="tb tb-dense" aria-label="Saved runs">
          <thead><tr>
            {['Run', 'Saved', 'Seed', 'Reps', 'Actions'].map((label, index) => (
              <th key={label} scope="col" style={{ ...cell, width: listWidths[index] }}
                title={label === 'Reps' ? 'Replicates' : undefined}>{label}</th>
            ))}
          </tr></thead>
          <tbody>{runs.map(run => (
            <tr key={run.id}>
              <th scope="row" style={cell}>{run.label}</th>
              <td style={cell}>{savedTime(run.savedAt)}</td>
              <td style={cell}>{run.seed}</td>
              <td style={cell}>{run.replicates}</td>
              <td style={cell}>
                <button className="mini" type="button" style={actionWord} onClick={() => onOpen(run.id)}>Open</button>{' '}
                <button className="mini" type="button" style={actionWord} onClick={() => onDelete(run.id)}>Delete</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {opened && <RunRecordView record={opened} />}
    </section>
  )
}

type Load = { status: 'loading' | 'ready' | 'error'; runs: RunSummary[]; error: string | null }

/**
 * The container. Nothing renders until the first read settles, so no empty
 * history flashes while IndexedDB opens; a failed read reports its message.
 */
export function RunHistory({ save }: { save: RunHistorySave }) {
  const [load, setLoad] = useState<Load>({ status: 'loading', runs: [], error: null })
  const [opened, setOpened] = useState<RunRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true
    listRuns().then(
      runs => { if (live) setLoad({ status: 'ready', runs, error: null }) },
      error => { if (live) setLoad({ status: 'error', runs: [], error: errorText(error) }) },
    )
    return () => { live = false }
  }, [reload])

  if (load.status === 'loading') return null

  const fail = (error: unknown) => setLoad(state => ({ ...state, status: 'error', error: errorText(error) }))
  return (
    <RunHistoryView
      runs={load.runs}
      opened={opened}
      notice={notice}
      error={load.error}
      save={save}
      onOpen={id => { getRun(id).then(record => { if (record) setOpened(record) }, fail) }}
      onDelete={id => {
        deleteRun(id).then(() => {
          setOpened(current => current?.id === id ? null : current)
          setReload(n => n + 1)
        }, fail)
      }}
      onSave={() => {
        save.run().then(({ evicted }) => {
          setNotice(evicted.length ? `Saved · ${evicted.length} oldest ${evicted.length === 1 ? 'record' : 'records'} evicted to stay under the size cap.` : 'Saved to history.')
          setReload(n => n + 1)
        }, error => { setNotice(null); fail(error) })
      }}
      // The picker reports a bad file itself; a good one is written and the list reloads.
      onImport={() => importRunRecordFile((record, evicted) => {
        setNotice(`Imported ${record.label}.${evicted.length ? ` ${evicted.length} oldest ${evicted.length === 1 ? 'record' : 'records'} evicted to stay under the size cap.` : ''}`)
        setReload(n => n + 1)
      })}
    />
  )
}
