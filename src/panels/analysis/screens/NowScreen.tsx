import { lazy, Suspense, useMemo, useState } from 'react'
import { useStore } from '../../../state/store'
import { selectTrialSelection, selectTrialHorizon } from '../../../state/trialSelectors'
import { trialResultOf } from '../../../analysis/trialResult'
import { trialSystemTelemetryAt } from '../../../analysis/systemTelemetry'
import { trialSweepAt } from '../../../playback/trialSweepAt'
import { resetAnalysisRun } from '../../../playback/runSession'
import { formatTime } from '../../../geometry/geo'
import { State } from '../../../ui/kit'
import { LiveStrip } from '../LiveStrip'
import { stateTone } from '../SystemStatus'

const SettingsPanel = lazy(() =>
  import('../../SettingsPanel').then((module) => ({ default: module.SettingsPanel })),
)
const columns = ['Track', 'State', 'Held', 'ID', 'Eng', 'Arr'] as const
// Six columns in a 350 px panel: the three times hold their width, the names clip.
const columnWidth: Record<Column, string> = {
  Track: '24%',
  State: '17%',
  Held: '23%',
  ID: '12%',
  Eng: '12%',
  Arr: '12%',
}
type Column = (typeof columns)[number]

export function NowScreen() {
  const selection = useStore(selectTrialSelection)
  const started = useStore((state) => state.playback.startedAtMs != null)
  const horizon = useStore((state) => selectTrialHorizon(state, state.playback.simTimeS))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sort, setSort] = useState<{ column: Column; descending: boolean }>({
    column: 'Track',
    descending: false,
  })
  const view = useMemo(
    () =>
      selection.status === 'ready' && started
        ? trialResultOf(selection.scenario, selection.result.manifest, selection.result)
        : undefined,
    [selection, started],
  )
  // Index static identities and ledger events once per retained draw, never per cursor tick.
  const index = useMemo(() => {
    if (!view) return undefined
    const entities = new Map(view.scenario.entities.map((entity) => [entity.id, entity]))
    const events = new Map(
      view.assessments.map((a) => [
        a.uasId,
        view.attrition.events.filter((event) => event.uasId === a.uasId),
      ]),
    )
    const ew = new Set(
      view.scenario.entities
        .filter((entity) => {
          const type = view.scenario.library.find((model) => model.id === entity.specId)?.effector
            ?.effectorType
          return type === 'jammer' || type === 'hpm'
        })
        .map((entity) => entity.id),
    )
    return { entities, events, ew }
  }, [view])
  const data = useMemo(() => {
    if (!view || !index) return undefined
    const sweep = trialSweepAt(view, horizon)
    const held = new Map<string, string[]>()
    for (const sensor of sweep.sensors) {
      if (sensor.stateAtTime === 'not-held') continue
      const names = held.get(sensor.threatId) ?? []
      names.push(index.entities.get(sensor.sensorId)?.name ?? sensor.sensorId)
      held.set(sensor.threatId, names)
    }
    const reached = (time: number | null) => time != null && time <= horizon
    const rows = view.assessments
      .filter((a) => a.status !== 'no-path')
      .map((a) => {
        const events = index.events.get(a.uasId) ?? []
        const firstShot = events.reduce<number | null>(
          (first, event) => (first == null ? event.tS : Math.min(first, event.tS)),
          null,
        )
        const kills = events.filter(
          (event) => event.killDelta === 1 && event.tEffectS <= horizon,
        ).length
        const count = Math.max(1, index.entities.get(a.uasId)?.formation?.count ?? 1)
        const id = a.classificationAtS.hostileAtS
        const state =
          kills === count
            ? 'defeated'
            : reached(firstShot)
              ? 'engaged'
              : reached(a.windowS?.[0] ?? null)
                ? 'targeted'
                : reached(id)
                  ? 'identified'
                  : held.has(a.uasId)
                    ? 'tracked'
                    : reached(a.firstDetectS)
                      ? 'detected'
                      : 'undetected'
        return {
          key: a.uasId,
          Track: index.entities.get(a.uasId)?.name ?? a.uasId,
          State: state,
          Held: held.get(a.uasId)?.join(', ') ?? '—',
          ID: reached(id) ? id : null,
          Eng: reached(firstShot) ? firstShot : null,
          Arr: a.arrivalS,
        }
      })
    const components = trialSystemTelemetryAt(view, horizon).flatMap((group) => group.components)
    return {
      rows,
      effectors: components.filter((c) => c.kind === 'effector'),
      sensors: components.filter((c) => c.kind === 'sensor'),
    }
  }, [view, index, horizon])
  const rows = useMemo(
    () =>
      [...(data?.rows ?? [])].sort((a, b) => {
        const x = a[sort.column]
        const y = b[sort.column]
        if (x == null) return y == null ? 0 : 1
        if (y == null) return -1
        return (
          (typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y))) * (sort.descending ? -1 : 1)
        )
      }),
    [data, sort],
  )

  if (
    selection.status === 'idle' ||
    selection.status === 'cancelled' ||
    (selection.status === 'ready' && !started)
  ) {
    return <p className="muted small">No trial yet. Press Play in Execute to run one.</p>
  }
  if (!view || !data || !index) {
    return (
      <p className="muted small" role="status">
        {selection.status === 'error' ? selection.message : 'Preparing trial'}
      </p>
    )
  }

  return (
    <section className="analysis-primary" aria-label="Now">
      <LiveStrip view={view} horizon={horizon} />
      <h3>Kill chain</h3>
      <table className="tb tb-dense" aria-label="Kill chain">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                style={{ width: columnWidth[column] }}
                aria-sort={
                  sort.column === column ? (sort.descending ? 'descending' : 'ascending') : 'none'
                }
              >
                <button
                  type="button"
                  style={{ padding: 0, fontSize: 'inherit' }}
                  title={
                    column === 'Arr'
                      ? 'Planned arrival (m:ss)'
                      : column === 'ID'
                        ? 'Identified (m:ss)'
                        : column === 'Eng'
                          ? 'First engagement (m:ss)'
                          : undefined
                  }
                  onClick={() =>
                    setSort({ column, descending: sort.column === column && !sort.descending })
                  }
                >
                  {column}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td title={row.Track}>{row.Track}</td>
              <td>
                <State
                  tone={
                    row.State === 'engaged'
                      ? 'critical'
                      : row.State === 'targeted'
                        ? 'warning'
                        : 'inactive'
                  }
                  hollow={row.State === 'identified'}
                  style={row.State === 'defeated' ? { color: 'var(--ghost)' } : undefined}
                >
                  {row.State}
                </State>
              </td>
              <td title={row.Held}>{row.Held}</td>
              <td>{row.ID == null ? '—' : formatTime(row.ID)}</td>
              <td>{row.Eng == null ? '—' : formatTime(row.Eng)}</td>
              <td>{row.Arr == null ? '—' : formatTime(row.Arr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Effectors · remaining / capacity</h3>
      {data.effectors.map((effector) => {
        const continuous = index.ew.has(effector.entityId)
        const total = effector.capacityTotal
        const remaining = effector.capacityRemaining
        const fraction = continuous
          ? 1
          : total != null && total > 0 && remaining != null
            ? remaining / total
            : 0
        const label = continuous
          ? 'cont.'
          : total == null || remaining == null
            ? '—'
            : `${remaining}/${total}`
        return (
          <div key={effector.entityId}>
            <div className="insp-row">
              <span>{effector.name}</span>
              <span className="mono">{label}</span>
            </div>
            <div
              className="rr-bar"
              role="meter"
              aria-label={`${effector.name} remaining capacity`}
              aria-valuemin={0}
              aria-valuemax={continuous ? 1 : (total ?? undefined)}
              aria-valuenow={continuous ? 1 : (remaining ?? undefined)}
              aria-valuetext={continuous ? 'Continuous' : label}
            >
              <div className="rr-bar-fill" style={{ width: `${fraction * 100}%` }} />
            </div>
          </div>
        )
      })}
      <h3>Sensors</h3>
      {data.sensors.map((sensor) => (
        <div className="insp-row" key={sensor.entityId}>
          <span>{sensor.name}</span>
          <State tone={stateTone(sensor.state)}>{sensor.state}</State>
          <span className="mono">
            {sensor.tracksNow} held
            {sensor.state === 'tracking' ? ` · ${formatTime(sensor.holdSeconds)} hold` : ''}
          </span>
        </div>
      ))}
      <div className="row" style={{ marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
        <button className="mini" onClick={() => resetAnalysisRun('manual')}>
          New run
        </button>
        <button className="mini" onClick={() => setSettingsOpen(true)}>
          Forecast and analysis
        </button>
      </div>
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel initialSection="run" onRequestClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </section>
  )
}
