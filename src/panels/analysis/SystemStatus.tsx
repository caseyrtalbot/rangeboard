import { useState } from 'react'
import type { ComponentTelemetry, SystemTelemetryGroup } from '../../analysis/systemTelemetry'
import { formatTime } from '../../geometry/geo'

const STATE_LABEL: Record<ComponentTelemetry['state'], string> = {
  disabled: 'OFFLINE',
  searching: 'SEARCH',
  tracking: 'TRACK',
  ready: 'READY',
  routing: 'ROUTING',
  target: 'TARGET',
  cooldown: 'COOLDOWN',
  depleted: 'EMPTY',
}

function stateClass(state: ComponentTelemetry['state']): string {
  if (state === 'disabled' || state === 'depleted') return 'bad'
  if (state === 'tracking' || state === 'routing' || state === 'target') return 'good'
  if (state === 'cooldown') return 'warn'
  return 'neutral'
}

/** "1 target", "2 targets": a count and its noun always agree. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function ComponentRow({ component }: { component: ComponentTelemetry }) {
  // holdSeconds is the clock reading: the elapsed seconds this sensor held at
  // least one track. trackSeconds is INTEGRATED sensor loading and can exceed
  // the run length, so it is labeled track-seconds and never given to a clock
  // formatter (which printed "10:01 hold" on a run under five minutes).
  const detail =
    component.kind === 'sensor'
      ? `${component.tracksNow} now · ${component.tracksSeen} seen · ${component.classifications} classified · ${formatTime(component.holdSeconds)} hold · ${Math.round(component.trackSeconds)} track-s`
      : component.kind === 'c2'
        ? `${component.tracksNow} now · ${component.tracksSeen} routed · ${plural(component.downstreamEffectors, 'effector')}`
        : `${plural(component.targetsNow, 'target')} · ${plural(component.salvosAssigned, 'salvo')} · ${plural(component.effectsLanded, 'effect')} · E[k] ${component.expectedKills.toFixed(2)}`
  const capacity =
    component.kind !== 'effector'
      ? null
      : component.capacityTotal == null
        ? 'continuous'
        : `${component.capacityRemaining}/${component.capacityTotal} remaining`
  return (
    <div className="component-telemetry-row">
      <span className={`component-kind kind-${component.kind}`}>
        {component.kind === 'sensor' ? 'S' : component.kind === 'c2' ? 'C2' : 'E'}
      </span>
      <span className="component-copy">
        <strong title={component.name}>{component.name}</strong>
        <small>
          {component.purpose} · {detail}
          {capacity ? ` · ${capacity}` : ''}
        </small>
      </span>
      <span className={`status ${stateClass(component.state)}`}>{STATE_LABEL[component.state]}</span>
    </div>
  )
}

function SystemCard({ group, defaultOpen }: { group: SystemTelemetryGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="system-telemetry-card">
      <button className="system-telemetry-head" onClick={() => setOpen((value) => !value)}>
        <span className={`chevron${open ? ' open' : ''}`}>▸</span>
        <span className="system-name">{group.name}</span>
        <span className="system-live-summary">
          {group.activeComponents}/{group.componentCount} online · {group.tracksNow} tracks · {group.salvosAssigned} salvos
        </span>
      </button>
      {open && (
        <div className="component-telemetry-list">
          {group.components.map((component) => (
            <ComponentRow key={component.entityId} component={component} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Component telemetry list.
 *
 * The state pill is a SAMPLED INSTANT: it is whatever the component was doing
 * at the cursor time the caller asked for. In an evidence record that instant
 * is the last frame of the run, which is not a run outcome. Set endOfRun so
 * the record names what the column is, rather than letting "SEARCH" or
 * "READY" read as a verdict on the run.
 */
export function SystemStatus({
  groups,
  expanded = true,
  endOfRun = false,
}: {
  groups: SystemTelemetryGroup[]
  expanded?: boolean
  endOfRun?: boolean
}) {
  if (groups.length === 0) return <p className="muted small">No sensors, C2, or effectors placed.</p>
  return (
    <div className="system-telemetry-list">
      {endOfRun && (
        <p className="muted small telemetry-note">
          State column: the state at the end of the run. It is one sampled instant, not a run
          outcome. The counts beside it cover the whole run.
        </p>
      )}
      {groups.map((group, index) => (
        <SystemCard key={group.id} group={group} defaultOpen={expanded && (groups.length <= 3 || index === 0)} />
      ))}
    </div>
  )
}
