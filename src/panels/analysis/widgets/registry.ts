import type { ExecutionHorizon } from '../../../analysis/horizon'
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
import { SensitivityWidget } from './SensitivityWidget'
import { SystemStatusWidget } from './SystemStatusWidget'
import { ThreatPictureWidget } from './ThreatPictureWidget'
import { TimeSeriesWidget } from './TimeSeriesWidget'

/** Props the panel passes to every widget. `index` and `count` place the move buttons. */
export interface WidgetProps {
  horizon: ExecutionHorizon
  /** The `WidgetInstance.id`; the frame's collapse, remove, move and params actions key on it. */
  id: string
  params: Record<string, unknown>
  collapsed: boolean
  customize: boolean
  index: number
  count: number
  /** Analysis context routes scenario edits to the corresponding Prepare section. */
  onOpenPreparation?: (section: 'run' | 'environment' | 'doctrine' | 'requirements') => void
}

/** Catalog label and component of every widget type. The panel maps the stack through it. */
export const WIDGETS: Record<WidgetType, { label: string; horizon: 'full-run' | 'cursor'; component: ComponentType<WidgetProps> }> = {
  'kpi-tiles': { label: 'KPI tiles', horizon: 'cursor', component: KpiTilesWidget },
  'time-series': { label: 'Time series', horizon: 'cursor', component: TimeSeriesWidget },
  'system-status': { label: 'System status', horizon: 'cursor', component: SystemStatusWidget },
  'threat-picture': { label: 'Threat picture', horizon: 'cursor', component: ThreatPictureWidget },
  'requirement-gates': { label: 'Requirement gates', horizon: 'full-run', component: RequirementGatesWidget },
  'event-ledger': { label: 'Event ledger', horizon: 'cursor', component: EventLedgerWidget },
  environment: { label: 'Environment', horizon: 'full-run', component: EnvironmentWidget },
  'fire-doctrine': { label: 'Fire doctrine', horizon: 'full-run', component: FireDoctrineWidget },
  projection: { label: 'Full-run projection', horizon: 'full-run', component: ProjectionWidget },
  'run-validity': { label: 'Run validity', horizon: 'full-run', component: RunValidityWidget },
  'engagement-lanes': { label: 'Engagement lanes', horizon: 'cursor', component: EngagementLanesWidget },
  sensitivity: { label: 'Sensitivity', horizon: 'full-run', component: SensitivityWidget },
}
