import { useState } from 'react'
import type {
  ThreatOperationalGroup,
  ThreatOperationalRow,
} from '../../analysis/threatAggregation'
import { formatTime } from '../../geometry/geo'

const PAGE_SIZE = 12

function Stage({ label, met, required, active = false }: { label: string; met: number; required: number; active?: boolean }) {
  const complete = required > 0 && met === required
  return (
    <span className={`threat-stage${complete ? ' complete' : ''}${active ? ' active' : ''}`}>
      {label} {met}/{required}
    </span>
  )
}

function memberTimeline(
  row: ThreatOperationalRow,
  mode: 'live' | 'projected' | 'debrief',
): string {
  const visible = (reached: boolean, value: number | null) =>
    value != null && (mode !== 'live' || reached) ? formatTime(value) : '—'
  return [
    `D ${visible(row.detected, row.firstDetectS)}`,
    `ID ${visible(row.identified, row.hostileAtS)}`,
    `ENG ${visible(row.engaged, row.firstShotS)}`,
    `FX ${visible(row.effectObserved, row.firstEffectS)}`,
  ].join(' · ')
}

function liveState(row: ThreatOperationalRow): string {
  if (row.effectMet) return 'EFFECT'
  if (row.effectObserved) return 'EFFECT OBS'
  if (row.engaged) return 'ENGAGED'
  if (row.targetableNow) return 'TARGET'
  if (row.identified) return 'HOSTILE'
  if (row.trackNow) return 'TRACK'
  if (row.detected) return 'DETECTED'
  return 'UNSEEN'
}

function ThreatMember({ row, mode }: { row: ThreatOperationalRow; mode: 'live' | 'projected' | 'debrief' }) {
  const continuity =
    row.trackContinuity == null
      ? 'track —'
      : `track ${(row.trackContinuity * 100).toFixed(0)}% · max gap ${formatTime(row.longestTrackGapS ?? 0)}`
  return (
    <div className="threat-data-row">
      <div className="threat-data-head">
        <strong title={row.name}>{row.name}</strong>
        <span className={`status ${row.effectMet ? 'good' : row.engaged ? 'warn' : 'neutral'}`}>
          {mode === 'live'
            ? liveState(row)
            : row.effectMet
              ? 'EFFECT'
              : row.engaged
                ? 'ENGAGED'
                : row.status.replaceAll('-', ' ').toUpperCase()}
        </span>
      </div>
      <div className="threat-data-stages">
        <span className={row.detected ? 'met' : ''}>D</span>
        <span className={(mode === 'live' ? row.trackNow : row.trackedAtDecision) ? 'live' : ''}>TRK</span>
        <span className={row.identified ? 'met' : ''}>ID</span>
        <span className={row.targetAcquired ? 'met' : ''}>TGT</span>
        <span className={row.engaged ? 'met' : ''}>ENG</span>
        <span className={row.effectMet ? 'met' : ''}>FX</span>
      </div>
      <div className="threat-data-detail">
        {mode === 'live' ? `${continuity} · ` : ''}
        {memberTimeline(row, mode)} · {row.salvos} salvos · {row.residualPct.toFixed(1)}% residual
      </div>
    </div>
  )
}

function ThreatGroupCard({
  group,
  mode,
  defaultOpen,
}: {
  group: ThreatOperationalGroup
  mode: 'live' | 'projected' | 'debrief'
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const liveTrackMetric =
    mode === 'live'
      ? `${group.trackNow}/${group.tracks} now`
      : group.minimumTrackContinuity == null
        ? 'continuity —'
        : `${(group.minimumTrackContinuity * 100).toFixed(0)}% min continuity`
  const trackGate = mode === 'live' ? group.trackNow : group.trackedAtDecision
  return (
    <div className="threat-data-group">
      <button className="threat-data-group-head" onClick={() => setOpen((value) => !value)}>
        <span className={`chevron${open ? ' open' : ''}`}>▸</span>
        <span className="threat-data-title" title={group.label}>
          {group.label}
        </span>
        <span className="threat-data-count">{group.tracks} trk · {group.ships} ships</span>
      </button>
      <div className="threat-stage-row">
        <Stage label="D" met={group.detected} required={group.tracks} />
        <Stage label="TRK" met={trackGate} required={group.tracks} active={mode === 'live' && group.trackNow > 0} />
        <Stage label="ID" met={group.identified} required={group.tracks} />
        <Stage label="TGT" met={group.targetAcquired} required={group.tracks} active={group.targetableNow > 0} />
        <Stage label="ENG" met={group.engaged} required={group.tracks} />
        <Stage label="FX" met={group.effectMet} required={group.tracks} />
      </div>
      <div className="threat-group-outcome">
        <span>{liveTrackMetric}</span>
        <span>{group.salvos} salvos</span>
        <strong>{group.residualPct.toFixed(1)}% residual</strong>
      </div>
      <div className="threat-outcome-bar" title={`${group.expectedKills.toFixed(2)} expected kills · ${group.expectedResidual.toFixed(2)} expected residual ships`}>
        <span className="defeat" style={{ flexGrow: group.expectedKills }} />
        <span className="residual" style={{ flexGrow: group.expectedResidual }} />
      </div>
      {open && (
        <div className="threat-data-members">
          {group.members.slice(0, visible).map((row) => (
            <ThreatMember key={row.uasId} row={row} mode={mode} />
          ))}
          {visible < group.members.length && (
            <button className="load-more" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
              Show next {Math.min(PAGE_SIZE, group.members.length - visible)} · {group.members.length - visible} remaining
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function ThreatPicture({
  groups,
  mode,
}: {
  groups: ThreatOperationalGroup[]
  mode: 'live' | 'projected' | 'debrief'
}) {
  const tracks = groups.reduce((sum, group) => sum + group.tracks, 0)
  if (tracks === 0) return <p className="muted small">No threats with flight paths.</p>
  return (
    <div className="threat-picture">
      {tracks > PAGE_SIZE && (
        <div className="scale-note">
          <strong>{tracks} tracks retained</strong>
          <span>Grouped by tactic, wave, and platform. Expand any group for paged track records.</span>
        </div>
      )}
      {groups.map((group, index) => (
        <ThreatGroupCard
          key={group.id}
          group={group}
          mode={mode}
          defaultOpen={groups.length <= 3 && tracks <= PAGE_SIZE * 2 && index === 0}
        />
      ))}
    </div>
  )
}
