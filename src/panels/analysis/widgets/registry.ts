import type { ComponentType } from 'react'
import type { WidgetType } from '../../../state/analysisLayout'
import { EngagementLanesWidget } from './EngagementLanesWidget'
import { EnvironmentWidget } from './EnvironmentWidget'
import { EventLedgerWidget } from './EventLedgerWidget'
import { FireDoctrineWidget } from './FireDoctrineWidget'
import { KpiTilesWidget } from './KpiTilesWidget'
import { ProjectionWidget } from './ProjectionWidget'
import { RequirementGatesWidget } from './RequirementGatesWidget'
import { RunValidityWidget } from './RunValidityWidget'
import { SystemStatusWidget } from './SystemStatusWidget'
import { ThreatPictureWidget } from './ThreatPictureWidget'
import { TimeSeriesWidget } from './TimeSeriesWidget'

/** Props the panel passes to every widget. `index` and `count` place the move buttons. */
export interface WidgetProps {
  /** The `WidgetInstance.id`; the frame's collapse, remove, move and params actions key on it. */
  id: string
  params: Record<string, unknown>
  collapsed: boolean
  customize: boolean
  index: number
  count: number
}

/** Catalog label and component of every widget type. The panel maps the stack through it. */
export const WIDGETS: Record<WidgetType, { label: string; component: ComponentType<WidgetProps> }> = {
  'kpi-tiles': { label: 'KPI tiles', component: KpiTilesWidget },
  'time-series': { label: 'Time series', component: TimeSeriesWidget },
  'system-status': { label: 'System status', component: SystemStatusWidget },
  'threat-picture': { label: 'Threat picture', component: ThreatPictureWidget },
  'requirement-gates': { label: 'Requirement gates', component: RequirementGatesWidget },
  'event-ledger': { label: 'Event ledger', component: EventLedgerWidget },
  environment: { label: 'Environment', component: EnvironmentWidget },
  'fire-doctrine': { label: 'Fire doctrine', component: FireDoctrineWidget },
  projection: { label: 'Full-run projection', component: ProjectionWidget },
  'run-validity': { label: 'Run validity', component: RunValidityWidget },
  'engagement-lanes': { label: 'Engagement lanes', component: EngagementLanesWidget },
}
