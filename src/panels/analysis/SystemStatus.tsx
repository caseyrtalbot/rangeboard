import { State } from '../../ui/kit'
import { EmptyRow } from './controls'
import type { StateTone } from '../../ui/kit'
import type {
  ComponentTelemetry,
  SystemTelemetryGroup,
  TrialComponentTelemetry,
  TrialSystemTelemetry,
} from '../../analysis/systemTelemetry'
import { formatTime } from '../../geometry/geo'
import { plural } from './labels'

type Component = ComponentTelemetry | TrialComponentTelemetry
type Group = SystemTelemetryGroup | TrialSystemTelemetry

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

function componentDetail(component: Component): string {
  // holdSeconds is elapsed seconds with at least one track held. trackSeconds is
  // integrated sensor loading and can exceed the run length, so it is labeled
  // track-seconds and never given to a clock formatter.
  const detail =
    component.kind === 'sensor'
      ? `${component.tracksNow} now · ${component.tracksSeen} seen · ${component.classifications} classified · ${formatTime(component.holdSeconds)} hold · ${Math.round(component.trackSeconds)} track-s`
      : component.kind === 'c2'
        ? `${component.tracksNow} now · ${component.tracksSeen} routed · ${plural(component.downstreamEffectors, 'effector')}`
        : `${plural(component.targetsNow, 'target')} · ${plural(component.salvosAssigned, 'salvo')} · ${plural(component.effectsLanded, 'effect')} · ${'basis' in component ? `${component.kills} trial defeats` : `E[k] ${component.expectedKills.toFixed(2)}`}`
  const capacity =
    component.kind !== 'effector'
      ? null
      : component.capacityTotal == null
        ? 'continuous'
        : `${component.capacityRemaining}/${component.capacityTotal} remaining`
  return `${component.purpose} · ${detail}${capacity ? ` · ${capacity}` : ''}`
}

const GROUPS: Array<[Component['kind'], string]> = [
  ['sensor', 'Sensors'],
  ['c2', 'C2'],
  ['effector', 'Effectors'],
]

// A magazine larger than this reads as text only; the pips would not fit a row.
const MAX_PIPS = 12

/** The per-kind readout: held tracks and hold time, routed tracks, or the magazine. */
function Readout({ component }: { component: Component }) {
  if (component.kind === 'sensor')
    return (
      <>
        {component.tracksNow} held
        {component.holdSeconds > 0 ? ` · ${formatTime(component.holdSeconds)}` : ''}
      </>
    )
  if (component.kind === 'c2') return <>{component.tracksSeen} routed</>
  const total = component.capacityTotal
  const remaining = component.capacityRemaining
  if (total == null) return <>cont.</>
  if (remaining == null) return <>—</>
  return (
    <>
      {total <= MAX_PIPS && (
        <span className="sys-mag" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={i < remaining ? 'full' : undefined} />
          ))}
        </span>
      )}
      {remaining}/{total}
    </>
  )
}

/**
 * One systems list grouped Sensors, C2 and Effectors. Each row holds a state square
 * and word (the word drops under 360 px; the row title keeps it) and a readout. The
 * state is a sampled instant: at the cursor, or the last frame in a record.
 */
export function SystemList({ groups }: { groups: Group[] }) {
  const components = groups.flatMap((group): Component[] => group.components)
  if (components.length === 0) return <EmptyRow>No sensors, C2, or effectors placed.</EmptyRow>
  return (
    <div className="sys-list">
      {GROUPS.map(([kind, label]) => {
        const rows = components.filter((component) => component.kind === kind)
        if (rows.length === 0) return null
        return (
          <div key={kind} role="group" aria-label={label}>
            <div className="sys-group">{label}</div>
            {rows.map((component) => (
              <div
                className="sys-row"
                key={component.entityId}
                title={`${component.name} · ${STATE_LABEL[component.state]} · ${componentDetail(component)}`}
              >
                <span className="sys-nm">{component.name}</span>
                <State tone={stateTone(component.state)}>
                  <span className="sys-w">{STATE_LABEL[component.state]}</span>
                </State>
                <span className="sys-rd">
                  <Readout component={component} />
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
