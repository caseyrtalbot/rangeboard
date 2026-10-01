/**
 * Saved runs: the records in the run store, and one opened record rendered in
 * place. Every number comes from the record's own `mc`, never the current Board
 * ensemble. Only the container (`SavedRuns`) reads the store.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { IconMore } from '../../ui/icons'
import { PanelSection } from '../../ui/PanelSection'
import { formatTime } from '../../geometry/geo'
import { idHash } from '../../geometry/prng'
import type { RunRecord } from '../../model/runRecord'
import type { BandSeries, McSummary, Stat } from '../../playback/mcRun'
import type { RunSummary } from '../../io/runStore'
import { defaultPicks } from './savedRunPicks'
import { deleteRun, getRun, listRuns } from '../../io/runStore'
import { exportRunCsv } from '../../io/exportCsv'
import { downloadRunsSqlite } from '../../io/exportSqlite'
import { exportRunRecordPackage, importRunRecordFile } from '../../io/runRecordPackage'
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

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Run history is unavailable.'

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
      <div>
        <dt>savedAt</dt>
        <dd>{savedTime(record.savedAt)}</dd>
      </div>
      <div>
        <dt>scenario</dt>
        <dd>{record.scenario.name}</dd>
      </div>
      {Object.entries(record.manifest).map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{manifestValue(value)}</dd>
        </div>
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
        {bounded
          ? `${formatCount(band.lo[i])} to ${formatCount(band.hi[i])} (95% mean CI)`
          : 'mean CI unavailable'}
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
        {stat.interval === 'none' ? 'no interval' : `${stat.interval} interval`} · defined in{' '}
        {stat.n} of {stat.total}
      </small>
      <small style={{ display: 'block' }}>{basisOf(mc)}</small>
    </>
  )
}

const cell = { whiteSpace: 'normal', overflowWrap: 'anywhere' } as const
// Five columns; the label takes the slack.
const actionWord = { whiteSpace: 'nowrap' } as const
const meanText = (stat: Stat) => (statMean(stat) == null ? '—' : formatCount(stat.mean))
const timeText = (stat: Stat) => (statMean(stat) == null ? '—' : formatTime(stat.mean))

/**
 * What fixed a tile's number: the manifest entries that decided the draws and the
 * models, and the scenario hash the run was made on. Every tile of one record
 * shares this lineage. Collapsed by default.
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
    // The stored value is the full analysis basis signature; the row shows its FNV-1a digest.
    ['Scenario hash', idHash(record.scenarioHash).toString(16).padStart(8, '0')],
  ]
}

function TileLineage({ record, label }: { record: RunRecord; label: string }) {
  return (
    <details className="analysis-disclosure">
      <summary aria-label={`${label} lineage`}>Lineage</summary>
      <dl style={{ overflowWrap: 'anywhere' }}>
        {lineageRows(record).map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

/** JSON keeps the whole record; each CSV is one table. A missing table cannot be exported. */
export function RecordExports({ record, title = 'Export' }: { record: RunRecord; title?: string }) {
  return (
    <div className="insp-row" aria-label={`${title} this run`}>
      <span className="muted small" style={actionWord}>
        {title}
      </span>
      <span
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        <button
          className="mini"
          type="button"
          style={actionWord}
          onClick={() => exportRunRecordPackage(record)}
        >
          JSON
        </button>
        <button
          className="mini"
          type="button"
          style={actionWord}
          onClick={() => exportRunCsv(record, 'per-threat')}
        >
          Threat CSV
        </button>
        <button
          className="mini"
          type="button"
          style={actionWord}
          onClick={() => exportRunCsv(record, 'per-effector')}
        >
          Effector CSV
        </button>
        <button
          className="mini"
          type="button"
          style={actionWord}
          disabled={!record.sensitivity}
          title={
            record.sensitivity
              ? 'Export the sensitivity rows'
              : 'This run carries no sensitivity result'
          }
          onClick={() => exportRunCsv(record, 'sensitivity')}
        >
          Sensitivity CSV
        </button>
      </span>
    </div>
  )
}

/** One saved record: its manifest, its end-of-run tiles and its two per-entity tables. */
export function RunRecordView({ record }: { record: RunRecord }) {
  const mc = record.mc
  const basis = basisOf(mc)
  const name = (id: string) =>
    record.scenario.entities.find((entity) => entity.id === id)?.name ?? id
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
      <p className="analysis-scope">
        {basis} · seed {mc.seed} · full run T+{formatTime(mc.durationS)} · saved{' '}
        {savedTime(record.savedAt)}
      </p>
      <RecordExports record={record} />
      <div className="tiles c2" aria-label="Saved run outcomes">
        {tiles.map(([label, value]) => (
          <div className="tile" key={label}>
            <span className="tl">{label}</span>
            <div className="tv" style={cell}>
              {value}
            </div>
            <TileLineage record={record} label={label} />
          </div>
        ))}
      </div>
      <p className="muted small">Per threat · {basis}</p>
      <table className="tb tb-dense" aria-label="Saved run per-threat outcomes">
        <thead>
          <tr>
            {['Threat', 'Killed', 'Leaked', 'First detect', 'Arrival', 'Ships'].map((label) => (
              <th key={label} scope="col" style={cell}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {threats.map(([id, row]) => (
            <tr key={id}>
              <th scope="row" style={cell}>
                {name(id)}
              </th>
              <td style={cell}>{meanText(row.killed)}</td>
              <td style={cell}>{meanText(row.leaked)}</td>
              <td style={cell}>{timeText(row.firstDetectS)}</td>
              <td style={cell}>{row.arrivalS == null ? '—' : formatTime(row.arrivalS)}</td>
              <td style={cell}>{row.shipCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {threats.length === 0 && <p className="muted small">No threat in this record.</p>}
      <p className="muted small">Per effector · {basis}</p>
      <table className="tb tb-dense" aria-label="Saved run per-effector outcomes">
        <thead>
          <tr>
            {['Effector', 'Salvos', 'Kills'].map((label) => (
              <th key={label} scope="col" style={cell}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {effectors.map(([id, row]) => (
            <tr key={id}>
              <th scope="row" style={cell}>
                {name(id)}
              </th>
              <td style={cell}>{meanText(row.salvos)}</td>
              <td style={cell}>{meanText(row.kills)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {effectors.length === 0 && <p className="muted small">No effector in this record.</p>}
      <details className="analysis-disclosure">
        <summary>Run manifest</summary>
        <ManifestRecord record={record} />
      </details>
    </section>
  )
}

type Load = { status: 'loading' | 'ready' | 'error'; runs: RunSummary[]; error: string | null }

/** The four per-record exports of a saved-run row menu; the same files `RecordExports` writes. */
export type RecordExportKind = 'json' | 'per-threat' | 'per-effector' | 'sensitivity'

function exportRecord(record: RunRecord, kind: RecordExportKind) {
  if (kind === 'json') exportRunRecordPackage(record)
  else exportRunCsv(record, kind)
}

/** The items of a row menu. The exports wait for the record, and Sensitivity CSV needs one. */
export function RunMenuItems({
  record,
  onOpen,
  onExport,
  onDelete,
}: {
  record: RunRecord | null
  onOpen: () => void
  onExport: (kind: RecordExportKind) => void
  onDelete: () => void
}) {
  const exportItem = (kind: RecordExportKind, label: string) => {
    const missing =
      record == null
        ? 'Reading the saved run'
        : kind === 'sensitivity' && !record.sensitivity
          ? 'This run carries no sensitivity result'
          : undefined
    return (
      <button
        type="button"
        className="tb-menu-item"
        disabled={missing != null}
        title={missing}
        onClick={() => onExport(kind)}
      >
        {label}
      </button>
    )
  }
  return (
    <>
      <button type="button" className="tb-menu-item" onClick={onOpen}>
        Open
      </button>
      <hr className="tb-menu-sep" />
      {exportItem('json', 'JSON')}
      {exportItem('per-threat', 'Per-threat CSV')}
      {exportItem('per-effector', 'Per-effector CSV')}
      {exportItem('sensitivity', 'Sensitivity CSV')}
      <hr className="tb-menu-sep" />
      <button type="button" className="tb-menu-item" onClick={onDelete}>
        Delete
      </button>
    </>
  )
}

/**
 * The toolbar dropdown dismissal rules: a pointer outside closes, and Escape closes
 * and restores focus to the trigger. A local copy of `ui/usePopover`: a static edge
 * from this lazy module to that hook splits the store into a preloaded chunk and
 * fails `check:bundle`.
 */
function useMenuOpen(
  wrapRef: RefObject<HTMLElement | null>,
  buttonRef: RefObject<HTMLElement | null>,
) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    wrapRef.current?.querySelector<HTMLElement>('[role="dialog"] button:not(:disabled)')?.focus()
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (document.querySelector('.cmdk-panel')) return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, wrapRef, buttonRef])
  return { open, setOpen, toggle: () => setOpen((value) => !value) }
}

/** A 24 px ⋯ trigger and its floating menu. A pressed item closes the menu and returns focus. */
function PanelMenu({
  label,
  title,
  onOpen,
  children,
}: {
  label: string
  title: string
  /** Called as the menu opens. */
  onOpen?: () => void
  children: ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { open, setOpen, toggle } = useMenuOpen(wrapRef, buttonRef)
  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="saved-icon"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={title}
        onClick={() => {
          if (!open) onOpen?.()
          toggle()
        }}
      >
        <IconMore />
      </button>
      {open && (
        <div
          className="tb-menu-panel surface-float tb-menu-right"
          role="dialog"
          aria-label={label}
          onClick={(event) => {
            if (!(event.target as HTMLElement).closest('button')) return
            setOpen(false)
            buttonRef.current?.focus()
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** A row's menu: it reads its record as it opens, so the exports know what the record holds. */
function RunRowMenu({
  run,
  onLoad,
  onOpen,
  onDelete,
}: {
  run: RunSummary
  onLoad: (id: string) => Promise<RunRecord | null>
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [record, setRecord] = useState<RunRecord | null>(null)
  return (
    <PanelMenu
      label={`${run.label} actions`}
      title="Open, export or delete"
      onOpen={() => {
        onLoad(run.id).then(setRecord, () => setRecord(null))
      }}
    >
      <RunMenuItems
        record={record}
        onOpen={() => onOpen(run.id)}
        onExport={(kind) => {
          if (record) exportRecord(record, kind)
        }}
        onDelete={() => onDelete(run.id)}
      />
    </PanelMenu>
  )
}

/** Today's saves show the time; older saves show the day. The full stamp is the cell title. */
function savedCell(savedAt: string, now = new Date()): string {
  const at = new Date(savedAt)
  return at.toDateString() === now.toDateString()
    ? at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    : at.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
}

export type SavedRunSide = 'a' | 'b'

export interface SavedRunsViewProps {
  runs: RunSummary[]
  /** The picked record ids, or null. */
  a: string | null
  b: string | null
  opened: RunRecord | null
  /** The last save or import line, or null. */
  notice: string | null
  error: string | null
  save: RunHistorySave
  /** The A − B comparison, drawn under the list when A and B are two records. */
  delta: ReactNode
  onPick: (side: SavedRunSide, id: string) => void
  onLoad: (id: string) => Promise<RunRecord | null>
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onSave: () => void
  onImport: () => void
  /** Export every saved run as one SQLite file. */
  onExportSqlite: () => void
}

/** Saved runs on Compare: one table with the A and B picks and a row menu. Pure: every state arrives as a prop. */
export function SavedRunsView({
  runs,
  a,
  b,
  opened,
  notice,
  error,
  save,
  delta,
  onPick,
  onLoad,
  onOpen,
  onDelete,
  onSave,
  onImport,
  onExportSqlite,
}: SavedRunsViewProps) {
  const pick = (side: SavedRunSide, run: RunSummary) => {
    const letter = side.toUpperCase()
    return (
      <button
        type="button"
        className="saved-pick"
        aria-pressed={(side === 'a' ? a : b) === run.id}
        aria-label={`Set ${run.label} as ${letter}`}
        title={`Set as ${letter}`}
        onClick={() => onPick(side, run.id)}
      >
        {letter}
      </button>
    )
  }
  return (
    <PanelSection
      title="Saved runs"
      readout={runs.length}
      className="saved-runs"
      end={
        <>
          <button
            className="mini"
            type="button"
            disabled={!save.enabled}
            title={save.reason}
            onClick={onSave}
          >
            Save current
          </button>
          <PanelMenu label="Saved run options" title="Import or export">
            <button
              type="button"
              className="tb-menu-item"
              title="Read a saved-run JSON file into this history"
              onClick={onImport}
            >
              Import run
            </button>
            <button
              type="button"
              className="tb-menu-item"
              disabled={runs.length === 0}
              title="Export every saved run as one SQLite file"
              onClick={onExportSqlite}
            >
              Export all runs (SQLite)
            </button>
          </PanelMenu>
        </>
      }
    >
      {notice && (
        <p className="muted small" role="status">
          {notice}
        </p>
      )}
      {error && <p className="muted small">{error}</p>}
      {runs.length === 0 && !error && (
        <p className="muted small">No saved run yet. Save current keeps a finished ensemble.</p>
      )}
      {runs.length > 0 && (
        <table className="tb saved-tb" aria-label="Saved runs">
          <colgroup>
            <col className="saved-c-pick" />
            <col className="saved-c-pick" />
            <col />
            <col className="saved-c-time" />
            <col className="saved-c-menu" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">A</th>
              <th scope="col">B</th>
              <th scope="col">Run</th>
              <th scope="col">Saved</th>
              <th scope="col" title="Row actions">
                <span className="saved-sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{pick('a', run)}</td>
                <td>{pick('b', run)}</td>
                <td
                  className="saved-name"
                  title={`${run.label} · seed ${run.seed} · ${run.replicates} replicates`}
                >
                  {run.label}
                </td>
                <td title={savedTime(run.savedAt)}>{savedCell(run.savedAt)}</td>
                <td className="saved-menu">
                  <RunRowMenu run={run} onLoad={onLoad} onOpen={onOpen} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {runs.length > 0 &&
        (a != null && b != null && a !== b ? (
          delta
        ) : (
          <p className="muted small">Pick A and B to see the difference.</p>
        ))}
      {opened && <RunRecordView record={opened} />}
    </PanelSection>
  )
}

/**
 * The container. Nothing renders until the first read settles, so no empty list
 * flashes while IndexedDB opens. A and B default to the two newest records;
 * `delta` draws their comparison once both records are read.
 */
export function SavedRuns({
  save,
  delta,
}: {
  save: RunHistorySave
  delta: (a: RunRecord, b: RunRecord) => ReactNode
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading', runs: [], error: null })
  const [picks, setPicks] = useState<{ a: string | null; b: string | null }>({
    a: null,
    b: null,
  })
  const [records, setRecords] = useState<Record<string, RunRecord>>({})
  const [opened, setOpened] = useState<RunRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true
    listRuns().then(
      (runs) => {
        if (!live) return
        setLoad({ status: 'ready', runs, error: null })
        setPicks((current) => defaultPicks(runs, current))
      },
      (error) => {
        if (live) setLoad({ status: 'error', runs: [], error: errorText(error) })
      },
    )
    return () => {
      live = false
    }
  }, [reload])

  const fail = (error: unknown) =>
    setLoad((state) => ({ ...state, status: 'error', error: errorText(error) }))

  // Read each picked record once; a late read only fills the cache.
  const cached = useRef(new Set<string>())
  useEffect(() => {
    for (const id of [picks.a, picks.b]) {
      if (id == null || cached.current.has(id)) continue
      cached.current.add(id)
      getRun(id).then(
        (record) => {
          if (record) setRecords((current) => ({ ...current, [id]: record }))
        },
        (error: unknown) => {
          cached.current.delete(id)
          setLoad((state) => ({ ...state, status: 'error', error: errorText(error) }))
        },
      )
    }
  }, [picks.a, picks.b])

  if (load.status === 'loading') return null

  const recordA = picks.a ? records[picks.a] : undefined
  const recordB = picks.b ? records[picks.b] : undefined
  const evictedText = (evicted: string[]) =>
    evicted.length
      ? ` ${evicted.length} oldest ${evicted.length === 1 ? 'record' : 'records'} evicted to stay under the size cap.`
      : ''
  return (
    <SavedRunsView
      runs={load.runs}
      a={picks.a}
      b={picks.b}
      opened={opened}
      notice={notice}
      error={load.error}
      save={save}
      delta={recordA && recordB ? delta(recordA, recordB) : null}
      onPick={(side, id) => setPicks((current) => ({ ...current, [side]: id }))}
      onLoad={(id) => getRun(id)}
      onOpen={(id) => {
        getRun(id).then((record) => {
          if (record) setOpened(record)
        }, fail)
      }}
      onDelete={(id) => {
        deleteRun(id).then(() => {
          setOpened((current) => (current?.id === id ? null : current))
          setPicks((current) => ({
            a: current.a === id ? null : current.a,
            b: current.b === id ? null : current.b,
          }))
          setReload((n) => n + 1)
        }, fail)
      }}
      onSave={() => {
        save.run().then(
          ({ evicted }) => {
            setNotice(`Saved to history.${evictedText(evicted)}`)
            setReload((n) => n + 1)
          },
          (error) => {
            setNotice(null)
            fail(error)
          },
        )
      }}
      // The picker reports a bad file itself; a good one is written and the list reloads.
      onImport={() =>
        importRunRecordFile((record, evicted) => {
          setNotice(`Imported ${record.label}.${evictedText(evicted)}`)
          setReload((n) => n + 1)
        })
      }
      onExportSqlite={() => {
        Promise.all(load.runs.map((run) => getRun(run.id))).then(
          (all) =>
            downloadRunsSqlite(
              all.filter((record) => record !== null),
              load.runs[0]?.scenarioName ?? 'scenario',
            ),
          fail,
        )
      }}
    />
  )
}
