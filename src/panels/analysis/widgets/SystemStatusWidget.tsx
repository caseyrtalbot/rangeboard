import { useMemo } from 'react'
import { systemTelemetryAt } from '../../../analysis/systemTelemetry'
import type { SystemTelemetryGroup } from '../../../analysis/systemTelemetry'
import { detectionsAt } from '../../../playback/sim'
import type { SystemStatusKind } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { SystemStatus } from '../SystemStatus'
import { useEngagement, useRunCursor } from './controls'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

const KINDS: readonly SystemStatusKind[] = ['sensor', 'effector', 'all']

function kindOf(params: Record<string, unknown>): SystemStatusKind {
  return KINDS.includes(params.kind as SystemStatusKind) ? (params.kind as SystemStatusKind) : 'all'
}

/** Keep the components of one kind, recount, and drop a group left empty. */
function filterGroups(groups: SystemTelemetryGroup[], kind: SystemStatusKind): SystemTelemetryGroup[] {
  if (kind === 'all') return groups
  const out: SystemTelemetryGroup[] = []
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
export function SystemStatusWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  const scenario = useStore((s) => s.scenario)
  const runId = useStore((s) => s.playback.runId)
  const { assessments, report } = useEngagement(scenario, runId)
  const { t, untouched } = useRunCursor(scenario)
  const kind = kindOf(params)
  const tS = untouched ? null : t
  const runTrackIds = useMemo(
    () => new Set(assessments.filter((a) => a.status !== 'no-path').map((a) => a.uasId)),
    [assessments],
  )
  const hits = useMemo(
    () =>
      tS == null
        ? new Map()
        : new Map([...detectionsAt(scenario, tS)].filter(([uasId]) => runTrackIds.has(uasId))),
    [scenario, tS, runTrackIds],
  )
  const systems = useMemo(
    () => systemTelemetryAt(scenario, assessments, report, tS ?? Number.NEGATIVE_INFINITY, hits),
    [scenario, assessments, report, tS, hits],
  )
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
      type="system-status"
      title={title}
      meta={`${online}/${components} online`}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      <SystemStatus groups={filtered} />
    </WidgetFrame>
  )
}
