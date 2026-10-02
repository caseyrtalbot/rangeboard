import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useStore } from '../../../state/store'
import { selectTrialSelection, selectTrialHorizon } from '../../../state/trialSelectors'
import { trialKpisAt } from '../../../analysis/liveStats'
import { trialResultOf } from '../../../analysis/trialResult'
import { trialSystemTelemetryAt } from '../../../analysis/systemTelemetry'
import { trialSweepAt } from '../../../playback/trialSweepAt'
import { deadTimeOf } from '../../../playback/deadTimes'
import { trialMemberStatesAt } from '../../../playback/trialTrackState'
import { toggleAnalysisRun } from '../../../playback/runSession'
import { formatTime } from '../../../geometry/geo'
import { State } from '../../../ui/kit'
import type { StateTone } from '../../../ui/kit'
import { PanelSection } from '../../../ui/PanelSection'
import { SystemList } from '../SystemStatus'
import { EmptyRow } from '../controls'
import { formatCount } from '../mc'
import {
  CHAIN_STAGES,
  chainTitle,
  lateKillText,
  STAGES_REACHED,
  trackStageWord,
  ttaReadout,
} from '../threatReadout'
import type { TrackStageWord } from '../threatReadout'
import { splitCommonPrefix } from '../trackNames'

type SortColumn = 'track' | 'state' | 'held' | 'tta'

const STAGE_TONE: Record<TrackStageWord, StateTone> = {
  undetected: 'inactive',
  detected: 'inactive',
  tracked: 'inactive',
  identified: 'inactive',
  targeted: 'warning',
  engaged: 'critical',
  defeated: 'inactive',
  leaked: 'critical',
}

/** The pre-Play line inside Execute: the Play control sits in the line itself. */
function PlayPrompt() {
  return (
    <p className="muted small">
      {'No trial yet. Press '}
      <button type="button" className="mini" onClick={toggleAnalysisRun}>
        Play
      </button>
      {' to run one.'}
    </p>
  )
}

/**
 * Six pips, one per kill-chain stage; the reached stages fill and the last one leads.
 * `prior` is the stage reached before a leak, so the text never claims a defeat.
 */
function ChainPips({ state, prior }: { state: TrackStageWord; prior: TrackStageWord }) {
  const reached = STAGES_REACHED[state]
  const title = chainTitle(state, prior)
  const tone = state === 'leaked' ? ' leak' : state === 'defeated' ? ' dead' : ''
  return (
    <span className={`mon-pips${tone}`} title={title} aria-label={title} role="img">
      {CHAIN_STAGES.map((stage, i) => (
        <i key={stage} className={i < reached - 1 ? 'on' : i === reached - 1 ? 'now' : undefined} />
      ))}
    </span>
  )
}

function selectOnKey(event: KeyboardEvent, id: string) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  useStore.getState().select({ entityIds: [id] }, false, 'panel')
}

export function NowScreen() {
  const selection = useStore(selectTrialSelection)
  const started = useStore((state) => state.playback.startedAtMs != null)
  const horizon = useStore((state) => selectTrialHorizon(state, state.playback.simTimeS))
  const selected = useStore((state) => state.selection.entityIds)
  const [sort, setSort] = useState<{ column: SortColumn; descending: boolean }>({
    column: 'tta',
    descending: false,
  })
  const view = useMemo(
    () =>
      selection.status === 'ready' && started
        ? trialResultOf(selection.scenario, selection.result.manifest, selection.result)
        : undefined,
    [selection, started],
  )
  // Keyed on the retained draw, so the cursor can move without re-indexing.
  const index = useMemo(() => {
    if (!view) return undefined
    const entities = new Map(view.scenario.entities.map((entity) => [entity.id, entity]))
    const events = new Map(
      view.assessments.map((a) => [
        a.uasId,
        view.attrition.events.filter((event) => event.uasId === a.uasId),
      ]),
    )
    const members = view.attrition.threats.reduce((sum, row) => sum + row.shipCount, 0)
    return { entities, events, members }
  }, [view])
  const data = useMemo(() => {
    if (!view || !index) return undefined
    const name = (id: string) => index.entities.get(id)?.name ?? id
    const sweep = trialSweepAt(view, horizon)
    const held = new Map<string, string[]>()
    for (const sensor of sweep.sensors) {
      if (sensor.stateAtTime === 'not-held') continue
      const names = held.get(sensor.threatId) ?? []
      names.push(name(sensor.sensorId))
      held.set(sensor.threatId, names)
    }
    const reached = (time: number | null | undefined) => time != null && time <= horizon
    const tracks = view.assessments
      .filter((a) => a.status !== 'no-path')
      .map((a) => {
        const events = index.events.get(a.uasId) ?? []
        const firstShot = events.reduce<number | null>(
          (first, event) => (first == null ? event.tS : Math.min(first, event.tS)),
          null,
        )
        // The one dead rule; a member that reached arrival undefeated leaks, and
        // leaked wins over a late kill.
        const count = Math.max(1, index.entities.get(a.uasId)?.formation?.count ?? 1)
        const death = deadTimeOf(view.attrition, a.uasId, count)
        const dead = death != null && reached(death.tS)
        const milestones = {
          detected: reached(a.firstDetectS),
          identified: reached(a.classificationAtS.hostileAtS),
          targeted: reached(a.windowS?.[0]),
          engaged: reached(firstShot),
        }
        const prior = trackStageWord({
          ...milestones,
          leaked: false,
          dead: false,
          held: held.has(a.uasId),
        })
        const state = trackStageWord({
          ...milestones,
          leaked: trialMemberStatesAt(view, a.uasId, horizon).some((m) => m.leakageCredit),
          dead,
          held: held.has(a.uasId),
        })
        return {
          key: a.uasId,
          name: name(a.uasId),
          state,
          prior,
          milestones,
          late: dead && death.late ? lateKillText(death.tS) : null,
          held: held.get(a.uasId) ?? [],
          tta: ttaReadout(a.arrivalS, horizon),
        }
      })
    const kpis = trialKpisAt(view, horizon)
    const funnel: Array<{ key: string; title: string; value: string; of: number; zero: boolean }> =
      (
        [
          ['DET', 'Detected', 'detected'],
          ['ID', 'Identified hostile', 'identified'],
          ['TGT', 'Targeted: firing window open', 'targeted'],
          ['ENG', 'Engaged: salvo assigned', 'engaged'],
        ] as const
      ).map(([key, title, milestone]) => {
        const n = tracks.filter((track) => track.milestones[milestone]).length
        return {
          key,
          title: `${title}: ${n} of ${tracks.length} tracks`,
          value: String(n),
          of: tracks.length,
          zero: n === 0,
        }
      })
    // DEF and LEAK count members, as the Outcome result bar does: a late kill is a
    // leaker, and without an active asset leakage is not measurable.
    funnel.push({
      key: 'DEF',
      title: `Defeated before arrival: ${formatCount(kpis.kills)} of ${index.members} members`,
      value: formatCount(kpis.kills),
      of: index.members,
      zero: kpis.kills === 0,
    })
    funnel.push({
      key: 'LEAK',
      title:
        kpis.reportedLeakers == null
          ? 'Leaked: not measurable without a defended asset'
          : `Leaked: arrived undefeated, ${formatCount(kpis.reportedLeakers)} of ${index.members} members`,
      value: kpis.reportedLeakers == null ? '—' : formatCount(kpis.reportedLeakers),
      of: index.members,
      zero: !kpis.reportedLeakers,
    })
    // The last five salvo and identification events at or before the horizon.
    const salvoIndex = new Map<string, number>()
    const events = [
      ...view.attrition.events
        .filter((event) => event.tS <= horizon)
        .map((event) => {
          const k = (salvoIndex.get(event.uasId) ?? 0) + 1
          salvoIndex.set(event.uasId, k)
          return {
            tS: event.tS,
            actor: name(event.effectorId),
            text: `→ ${name(event.uasId)} · salvo ${k}`,
          }
        }),
      ...view.assessments
        .filter((a) => a.status !== 'no-path' && reached(a.classificationAtS.hostileAtS))
        .map((a) => ({
          tS: a.classificationAtS.hostileAtS!,
          actor: name(a.uasId),
          text: 'identified hostile',
        })),
    ]
      .sort((a, b) => b.tS - a.tS)
      .slice(0, 5)
    return {
      tracks,
      funnel,
      systems: trialSystemTelemetryAt(view, horizon),
      events,
    }
  }, [view, index, horizon])
  const rows = useMemo(() => {
    const direction = sort.descending ? -1 : 1
    return [...(data?.tracks ?? [])].sort((a, b) => {
      const order =
        sort.column === 'track'
          ? a.name.localeCompare(b.name)
          : sort.column === 'state'
            ? STAGES_REACHED[a.state] - STAGES_REACHED[b.state]
            : sort.column === 'held'
              ? a.held.length - b.held.length
              : a.tta.sortS === b.tta.sortS
                ? 0
                : a.tta.sortS < b.tta.sortS
                  ? -1
                  : 1
      return order * direction || a.name.localeCompare(b.name)
    })
  }, [data, sort])

  if (
    selection.status === 'idle' ||
    selection.status === 'cancelled' ||
    (selection.status === 'ready' && !started)
  ) {
    return <PlayPrompt />
  }
  if (!view || !data || !index) {
    return (
      <div role="status">
        <EmptyRow>{selection.status === 'error' ? selection.message : 'Preparing trial'}</EmptyRow>
      </div>
    )
  }

  const split = splitCommonPrefix(rows.map((row) => row.name))
  const online = data.systems.reduce((sum, group) => sum + group.activeComponents, 0)
  const header = (column: SortColumn, label: string, title?: string, className?: string) => (
    <th
      scope="col"
      className={className}
      aria-sort={sort.column === column ? (sort.descending ? 'descending' : 'ascending') : 'none'}
    >
      <button
        type="button"
        title={title}
        onClick={() => setSort({ column, descending: sort.column === column && !sort.descending })}
      >
        {label}
      </button>
    </th>
  )

  return (
    <section className="analysis-primary" aria-label="Now">
      <div className="mon-funnel" aria-label="Kill-chain funnel">
        {data.funnel.map((cell) => (
          <div
            key={cell.key}
            className={`mon-f${cell.key === 'LEAK' ? ' leak' : ''}${cell.zero ? ' zero' : ''}`}
            title={cell.title}
          >
            <div className="mon-f-k">{cell.key}</div>
            <div className="mon-f-v">
              {cell.value}
              <small>/{cell.of}</small>
            </div>
          </div>
        ))}
      </div>
      <PanelSection
        title="Tracks"
        readout={split.prefix ? `${split.prefix.trim()} · ${rows.length}` : rows.length}
      >
        <table className="tb tb-dense mon-tracks" aria-label="Tracks">
          <thead>
            <tr>
              {header('track', 'Track')}
              <th scope="col" className="mon-c-chain">
                Chain
              </th>
              {header('state', 'State', undefined, 'mon-c-state')}
              {header('held', 'Held by', undefined, 'mon-c-held')}
              {header('tta', 'TTA', 'Time to arrival at the defended asset (m:ss)', 'mon-c-tta')}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.key}
                className={`mon-row${selected.includes(row.key) ? ' on' : ''}`}
                aria-current={selected.includes(row.key) ? 'true' : undefined}
                tabIndex={0}
                title={`${row.name} · ${row.state}${row.late ? ` · ${row.late}` : ''} · held by ${row.held.join(', ') || 'none'} · TTA ${row.tta.text}`}
                onClick={() => useStore.getState().select({ entityIds: [row.key] }, false, 'panel')}
                onKeyDown={(event) => selectOnKey(event, row.key)}
              >
                <td className="mono" title={row.name}>
                  {split.rest[i]}
                </td>
                <td className="mon-c-chain">
                  <ChainPips state={row.state} prior={row.prior} />
                </td>
                <td className="mon-c-state">
                  <State
                    tone={STAGE_TONE[row.state]}
                    hollow={row.state === 'identified'}
                    style={row.state === 'defeated' ? { color: 'var(--ghost)' } : undefined}
                  >
                    {row.state}
                  </State>
                </td>
                <td className="mon-c-held" title={row.held.join(', ') || 'not held'}>
                  {row.held.length ? row.held.join(', ') : '—'}
                </td>
                <td className={`mono mon-c-tta${row.tta.tone ? ` tta-${row.tta.tone}` : ''}`}>
                  {row.tta.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PanelSection>
      <PanelSection title="Systems" readout={`${online} online`}>
        <SystemList groups={data.systems} />
      </PanelSection>
      <PanelSection title="Recent events" readout="last 5">
        {data.events.length === 0 ? (
          <EmptyRow>No salvo or identification yet.</EmptyRow>
        ) : (
          <div className="mon-feed">
            {data.events.map((event, i) => (
              <div className="mon-ev" key={i}>
                <span className="mon-ev-t">{formatTime(event.tS)}</span>
                <span className="mon-ev-d">
                  <b>{event.actor}</b> {event.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </PanelSection>
    </section>
  )
}
