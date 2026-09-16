import { useState } from 'react'
import { State } from '../../ui/kit'
import type {
  ThreatOperationalGroup,
  ThreatOperationalRow,
  TrialThreatGroup,
  TrialThreatRow,
} from '../../analysis/threatAggregation'
import { formatTime } from '../../geometry/geo'
import { SURVIVAL_LABELS } from './labels'

type Group = ThreatOperationalGroup | TrialThreatGroup
type Row = ThreatOperationalRow | TrialThreatRow

const PAGE_SIZE = 12

type Mode = 'live' | 'projected' | 'debrief'

/** One chip of the ladder: `on` once any track met it, `live` on the active track gate, `done` when every track met it. */
function Chip({
  label,
  met,
  required,
  live = false,
}: {
  label: string
  met: number
  required: number
  live?: boolean
}) {
  const done = required > 0 && met === required
  const cls = `st${met > 0 ? ' on' : ''}${live ? ' live' : ''}${done ? ' done' : ''}`
  return (
    <span className={cls}>
      <b>{label}</b>
      {met}/{required}
    </span>
  )
}

interface LadderCounts {
  required: number
  detected: number
  track: number
  trackLive: boolean
  identified: number
  target: number
  targetLive: boolean
  engaged: number
  effect: number
}

/** The kill-chain ladder in two rows: D TRK ID over TGT ENG FX. */
function Ladder({ c }: { c: LadderCounts }) {
  return (
    <div className="ladder">
      <div>
        <Chip label="D" met={c.detected} required={c.required} />
        <Chip label="TRK" met={c.track} required={c.required} live={c.trackLive} />
        <Chip label="ID" met={c.identified} required={c.required} />
      </div>
      <div>
        <Chip label="TGT" met={c.target} required={c.required} live={c.targetLive} />
        <Chip label="ENG" met={c.engaged} required={c.required} />
        <Chip label="FX" met={c.effect} required={c.required} />
      </div>
    </div>
  )
}

/** Survival percent text: whole at 100, else one decimal, clamped to [0, 100]. */
function survivesPct(residualPct: number): string {
  const pct = Math.min(100, Math.max(0, residualPct))
  return pct >= 100 ? '100' : pct.toFixed(1)
}

function memberTimeline(row: Row, mode: Mode): string {
  const visible = (reached: boolean, value: number | null) =>
    value != null && (mode !== 'live' || reached) ? formatTime(value) : '—'
  return [
    `D ${visible(row.detected, row.firstDetectS)}`,
    `ID ${visible(row.identified, row.hostileAtS)}`,
    `ENG ${visible(row.engaged, row.firstShotS)}`,
    `${'basis' in row ? 'FX' : 'Expected FX'} ${visible(row.effectObserved, row.firstEffectS)}`,
  ].join(' · ')
}

function liveState(row: Row): string {
  if (row.effectMet) return 'basis' in row ? 'DEFEATED' : 'EXPECTED DEFEAT'
  if (row.effectObserved) return 'basis' in row ? 'EFFECT REACHED' : 'EXPECTED EFFECT'
  if (row.engaged) return 'ENGAGED'
  if (row.targetableNow) return 'TARGET'
  if (row.identified) return 'HOSTILE'
  if (row.trackNow) return 'TRACK'
  if (row.detected) return 'DETECTED'
  return 'UNSEEN'
}

function ThreatMember({ row, mode }: { row: Row; mode: Mode }) {
  const continuity =
    row.trackContinuity == null
      ? 'track —'
      : `track ${(row.trackContinuity * 100).toFixed(0)}% · max gap ${formatTime(row.longestTrackGapS ?? 0)}`
  const tracked = mode === 'live' ? row.trackNow : row.trackedAtDecision
  return (
    <div className="threat-data-row">
      <div className="threat-data-head">
        <strong title={row.name}>{row.name}</strong>
        <State tone={row.effectMet ? 'nominal' : row.engaged ? 'warning' : 'inactive'}>
          {mode === 'live'
            ? liveState(row)
            : row.effectMet
              ? 'basis' in row
                ? 'DEFEATED'
                : 'EXPECTED DEFEAT'
              : row.engaged
                ? 'ENGAGED'
                : (row.status ?? 'unseen').replaceAll('-', ' ').toUpperCase()}
        </State>
      </div>
      <Ladder
        c={{
          required: 1,
          detected: row.detected ? 1 : 0,
          track: tracked ? 1 : 0,
          trackLive: mode === 'live' && row.trackNow,
          identified: row.identified ? 1 : 0,
          target: row.targetAcquired ? 1 : 0,
          targetLive: row.targetableNow,
          engaged: row.engaged ? 1 : 0,
          effect: row.effectMet ? 1 : 0,
        }}
      />
      <div className="threat-data-detail">
        {mode === 'live' ? `${continuity} · ` : ''}
        {memberTimeline(row, mode)} · {row.salvos} salvos · {SURVIVAL_LABELS.survives}{' '}
        {'basis' in row
          ? `${row.survivors}/${row.shipCount} members`
          : `${survivesPct(row.residualPct)}%`}
      </div>
    </div>
  )
}

function ThreatGroupCard({
  group,
  mode,
  membersOpen,
}: {
  group: Group
  mode: Mode
  membersOpen: boolean
}) {
  const [open, setOpen] = useState(membersOpen)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const kills = 'basis' in group ? group.kills : group.expectedKills
  const survivors = 'basis' in group ? group.survivors : group.expectedResidual
  const trackGate = mode === 'live' ? group.trackNow : group.trackedAtDecision
  return (
    <div className="threat-data-group tg">
      <button className="threat-data-group-head" onClick={() => setOpen((value) => !value)}>
        <span className={`chevron${open ? ' open' : ''}`}>▸</span>
        <span className="threat-data-title" title={group.label}>
          {group.label}
        </span>
        <span className="threat-data-count">
          {group.tracks} trk · {group.ships} ships
        </span>
      </button>
      <Ladder
        c={{
          required: group.tracks,
          detected: group.detected,
          track: trackGate,
          trackLive: mode === 'live' && group.trackNow > 0,
          identified: group.identified,
          target: group.targetAcquired,
          targetLive: group.targetableNow > 0,
          engaged: group.engaged,
          effect: group.effectMet,
        }}
      />
      <div
        className="tg-f"
        title={
          'basis' in group
            ? `${kills} trial defeats · ${survivors} active members · ${group.salvos} salvos`
            : `${kills.toFixed(2)} expected kills · ${survivors.toFixed(2)} expected surviving ships · ${group.salvos} salvos`
        }
      >
        <span className="bar">
          <i className="defeat" style={{ flex: Math.max(kills, 0.001) }} />
          <i className="residual" style={{ flex: Math.max(survivors, 0.001) }} />
        </span>
        <span className="tg-s">
          {SURVIVAL_LABELS.survives}{' '}
          <b className="num">
            {'basis' in group
              ? `${survivors}/${group.ships} members`
              : `${survivesPct(group.residualPct)}%`}
          </b>
        </span>
      </div>
      {open && (
        <div className="threat-data-members">
          {group.members.slice(0, visible).map((row) => (
            <ThreatMember key={row.uasId} row={row} mode={mode} />
          ))}
          {visible < group.members.length && (
            <button className="load-more" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
              Show next {Math.min(PAGE_SIZE, group.members.length - visible)} ·{' '}
              {group.members.length - visible} remaining
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Threat groups with one two-row chip ladder each. Members are collapsed
 * unless `membersOpen`; the card remounts when that prop changes, so a
 * widget param edit takes effect at once.
 */
export function ThreatPicture({
  groups,
  mode,
  membersOpen = false,
}: {
  groups: Group[]
  mode: Mode
  membersOpen?: boolean
}) {
  const tracks = groups.reduce((sum, group) => sum + group.tracks, 0)
  if (tracks === 0) return <p className="muted small">No threats with flight paths.</p>
  return (
    <div className="threat-picture">
      <p className="muted small">
        {groups.some((group) => 'basis' in group)
          ? 'Simulated trial counts · reached member outcomes, including late effects.'
          : 'Expected effect state uses expected surviving mass, including late effects. Requirement verdicts are in Requirement gates.'}
      </p>
      {tracks > PAGE_SIZE && (
        <div className="scale-note">
          <strong>{tracks} tracks retained</strong>
          <span>
            Grouped by tactic, wave, and platform. Expand any group for paged track records.
          </span>
        </div>
      )}
      {groups.map((group) => (
        <ThreatGroupCard
          key={`${group.id}:${membersOpen}`}
          group={group}
          mode={mode}
          membersOpen={membersOpen}
        />
      ))}
    </div>
  )
}
