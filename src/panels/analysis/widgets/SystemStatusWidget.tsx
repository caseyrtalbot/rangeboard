import { useMemo } from 'react'
import { trialSystemTelemetryAt } from '../../../analysis/systemTelemetry'
import type { TrialSystemTelemetry } from '../../../analysis/systemTelemetry'
import type { SystemStatusKind } from '../../../state/analysisLayout'
import { SystemStatus } from '../SystemStatus'
import { useTrialResult, trialViewOf, trialStateText } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

const KINDS: readonly SystemStatusKind[] = ['sensor', 'effector', 'all']

function kindOf(params: Record<string, unknown>): SystemStatusKind {
  return KINDS.includes(params.kind as SystemStatusKind) ? (params.kind as SystemStatusKind) : 'all'
}

/** Keep the components of one kind, recount, and drop a group left empty. */
function filterGroups(groups: TrialSystemTelemetry[], kind: SystemStatusKind): TrialSystemTelemetry[] {
  if (kind === 'all') return groups
  const out: TrialSystemTelemetry[] = []
  for (const group of groups) {
    const components = group.components.filter((c) => c.kind === kind)
    if (components.length === 0) continue
    out.push({
      ...group,
      components,
      componentCount: components.length,
      activeComponents: components.filter((c) => c.active).length,
    })
  }
  return out
}

/** Component telemetry at the cursor time, filtered to sensors, effectors, or every kind. */
export function SystemStatusWidget({ id, params, collapsed, customize, index, count, horizon }: WidgetProps) {
  const trial = useTrialResult()
  const view = trialViewOf(trial)
  const kind = kindOf(params)
  const systems = useMemo(() => view ? trialSystemTelemetryAt(view, trial.horizon) : [], [view, trial.horizon])
  const stateText = trialStateText(trial.selection, trial.snapshot?.observedThroughS)
  const filtered = useMemo(() => filterGroups(systems, kind), [systems, kind])
  const online = filtered.reduce((sum, group) => sum + group.activeComponents, 0)
  const components = filtered.reduce((sum, group) => sum + group.componentCount, 0)
  const title =
    kind === 'sensor'
      ? 'System status · sensors'
      : kind === 'effector'
        ? 'System status · effectors'
        : 'System status'

  return (
    <WidgetFrame
      id={id}
      horizon={horizon}
      type="system-status"
      title={title}
      metaWithinHorizon
      meta={view ? `${stateText} · ${online}/${components} online` : stateText}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      {view ? <SystemStatus groups={filtered} horizon={{ scoped: true, horizonS: trial.horizon }} sampledAtS={trial.horizon} /> : <p className="muted small">{stateText}</p>}
    </WidgetFrame>
  )
}
