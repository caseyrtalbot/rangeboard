import { FORECAST_IN_ANALYZE, FULL_RUN, reached, type ExecutionHorizon } from '../../analysis/horizon'
import { useState } from 'react'
import { State } from '../../ui/kit'
import type { StateTone } from '../../ui/kit'
import type { ComponentTelemetry, SystemTelemetryGroup } from '../../analysis/systemTelemetry'
import { formatTime } from '../../geometry/geo'

/** Pill word per component state. The one name table; the detail header reads it too. */
export const STATE_LABEL: Record<ComponentTelemetry['state'], string> = {
  disabled: 'OFFLINE',
  searching: 'SEARCH',
  tracking: 'TRACK',
  ready: 'READY',
  routing: 'ROUTING',
  target: 'TARGET',
  cooldown: 'COOLDOWN',
  depleted: 'EMPTY',
}

/** `.status` modifier per component state. */
export function stateTone(state: ComponentTelemetry['state']): StateTone {
  if (state === 'disabled' || state === 'depleted') return 'critical'
  if (state === 'tracking' || state === 'routing' || state === 'target') return 'nominal'
  if (state === 'cooldown') return 'warning'
  return 'inactive'
}

/** "1 target", "2 targets": a count and its noun always agree. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function componentDetail(component: ComponentTelemetry): string {
  // holdSeconds is the clock reading: the elapsed seconds this sensor held at
  // least one track. trackSeconds is INTEGRATED sensor loading and can exceed
  // the run length, so it is labeled track-seconds and never given to a clock
  // formatter.
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
  return `${component.purpose} · ${detail}${capacity ? ` · ${capacity}` : ''}`
}

function ComponentRow({ component }: { component: ComponentTelemetry }) {
  const summary =
    component.kind === 'sensor'
      ? `${component.tracksNow} now · ${component.tracksSeen} seen${component.holdSeconds > 0 ? ` · hold ${formatTime(component.holdSeconds)}` : ''}`
      : component.kind === 'c2'
        ? `${component.tracksNow} now · ${component.tracksSeen} routed`
        : `${plural(component.targetsNow, 'target')} · ${plural(component.salvosAssigned, 'salvo')}${component.capacityTotal != null ? ` · ${component.capacityRemaining}/${component.capacityTotal}` : ''}`
  return (
    <div className="component-telemetry-row" title={componentDetail(component)}>
      <span className={`component-kind kind-${component.kind}`}>
        {component.kind === 'sensor' ? 'S' : component.kind === 'c2' ? 'C2' : 'E'}
      </span>
      <span className="component-copy">
        <strong title={component.name}>{component.name}</strong>
        <small>{summary}</small>
      </span>
      <State tone={stateTone(component.state)}>{STATE_LABEL[component.state]}</State>
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
          <details>
            <summary>Details</summary>
            {group.components.map((component) => (
              <p className="muted small" key={component.entityId}>
                <strong>{component.name}</strong> · {componentDetail(component)}
              </p>
            ))}
          </details>
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
  horizon = FULL_RUN,
  sampledAtS,
}: {
  groups: SystemTelemetryGroup[]
  expanded?: boolean
  endOfRun?: boolean
  horizon?: ExecutionHorizon
  /** Time used by the caller to compute every group and component count. */
  sampledAtS?: number
}) {
  if (horizon.scoped && !reached(0, horizon)) return <p className="muted small">No system telemetry yet.</p>
  // Group totals and hover details must come from the same reached sample.
  if (horizon.scoped && !reached(sampledAtS, horizon)) return <p className="muted small">{FORECAST_IN_ANALYZE}</p>
  if (groups.length === 0) return <p className="muted small">No sensors, C2, or effectors placed.</p>
  return (
    <div className="system-telemetry-list">
      {endOfRun && (
        <p className="muted small telemetry-note">
          State shows the final sampled instant, not the run outcome; cumulative counts cover the run.
        </p>
      )}
      {groups.map((group, index) => (
        <SystemCard key={group.id} group={group} defaultOpen={expanded && (groups.length <= 3 || index === 0)} />
      ))}
    </div>
  )
}
