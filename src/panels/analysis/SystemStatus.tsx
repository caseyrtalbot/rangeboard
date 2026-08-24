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

function ComponentRow({ component }: { component: ComponentTelemetry }) {
  const detail =
    component.kind === 'sensor'
      ? `${component.tracksNow} now · ${component.tracksSeen} seen · ${component.classifications} classified · ${formatTime(component.trackSeconds)} hold`
      : component.kind === 'c2'
        ? `${component.tracksNow} now · ${component.tracksSeen} routed · ${component.downstreamEffectors} effectors`
        : `${component.targetsNow} targets · ${component.salvosAssigned} salvos · ${component.effectsLanded} effects · E[k] ${component.expectedKills.toFixed(2)}`
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

export function SystemStatus({ groups, expanded = true }: { groups: SystemTelemetryGroup[]; expanded?: boolean }) {
  if (groups.length === 0) return <p className="muted small">No sensors, C2, or effectors placed.</p>
  return (
    <div className="system-telemetry-list">
      {groups.map((group, index) => (
        <SystemCard key={group.id} group={group} defaultOpen={expanded && (groups.length <= 3 || index === 0)} />
      ))}
    </div>
  )
}
