import { Fragment, memo, useMemo } from 'react'
import { buildAarSummary } from '../analysis/aar'
import { engagementPicture } from '../analysis/impact'
import type { WidgetInstance, WidgetType } from '../state/analysisLayout'
import { BUILTIN_LENSES, WIDGET_TYPES } from '../state/analysisLayout'
import { useStore } from '../state/store'
import { selectDurationS, selectRunComplete } from '../state/selectors'
import { DebriefRecord } from './analysis/DebriefRecord'
import { LiveStrip } from './analysis/LiveStrip'
import { WIDGETS } from './analysis/widgets/registry'
import type { WidgetProps } from './analysis/widgets/registry'

/**
 * Every widget subscribes to the store on its own, so a panel render must not
 * cascade into the stack. The props the panel passes are stable between
 * layout edits, so `memo` holds each widget until its own selectors move.
 */
const MEMO_WIDGETS = {} as Record<WidgetType, React.ComponentType<WidgetProps>>
for (const type of WIDGET_TYPES) MEMO_WIDGETS[type] = memo(WIDGETS[type].component)

/**
 * Run header, then the widget stack the active lens defines. Each widget
 * computes what it shows, so this panel holds no analysis of its own. The Board
 * shell owns lens navigation and selected-entity detail; a selection here only
 * adds a note above the stack.
 */
interface AnalysisPanelProps {
  phase?: 'execute' | 'analyze'
  onOpenPreparation?: WidgetProps['onOpenPreparation']
}

export function AnalysisPanel({ phase = 'execute', onOpenPreparation }: AnalysisPanelProps) {
  const scenario = useStore((state) => state.scenario)
  const entityIds = useStore((state) => state.selection.entityIds)
  const runId = useStore((state) => state.playback.runId)
  const complete = useStore(selectRunComplete)
  const widgets = useStore((state) => state.ui.analysis.layout.widgets)
  const presetId = useStore((state) => state.ui.analysis.layout.presetId)
  const customize = useStore((state) => state.ui.analysisCustomize)
  const durationS = useStore(selectDurationS)
  const { assessments, report, impacts } = useMemo(() => {
    void runId
    return engagementPicture(scenario)
  }, [scenario, runId])
  // The AAR summary feeds the debrief record alone, so it is built only once
  // the run completes.
  const aar = useMemo(
    () => (complete ? buildAarSummary(scenario, assessments, report, impacts) : null),
    [complete, scenario, assessments, report, impacts],
  )
  const threats = assessments.filter((assessment) => assessment.status !== 'no-path')
  const noPath = assessments.length - threats.length

  const defaultSummary = BUILTIN_LENSES.find((preset) => preset.id === 'run-summary')!
  // Only the untouched built-in receives a presentation hierarchy. Custom
  // order, params and widget identities remain exactly as the user saved them.
  const groupSummary = phase === 'analyze' && !customize && presetId === 'run-summary' &&
    widgets.length === defaultSummary.widgets.length && widgets.every((instance, index) => {
      const original = defaultSummary.widgets[index]
      return instance.id === original.id && instance.type === original.type &&
        JSON.stringify(instance.params) === JSON.stringify(original.params)
    })
  const renderWidget = (instance: WidgetInstance) => {
    const Widget = MEMO_WIDGETS[instance.type]
    return (
      <Fragment key={instance.id}>
        {instance.type === 'time-series' && !groupSummary && (
          <p className="analysis-scope">Full-run time series · playback cursor marker</p>
        )}
        <Widget
          id={instance.id}
          params={instance.params}
          collapsed={instance.collapsed}
          customize={customize}
          index={widgets.indexOf(instance)}
          count={widgets.length}
          onOpenPreparation={onOpenPreparation}
        />
      </Fragment>
    )
  }

  return (
    <div className="inspector-body analysis-panel">
      <LiveStrip onOpenSettings={onOpenPreparation ? () => onOpenPreparation('run') : undefined} />

      {entityIds.length >= 2 && (
        <p className="muted analysis-empty">
          {entityIds.length} entities selected. Select one for its detail.
        </p>
      )}

      {assessments.length === 0 && (
        <p className="muted analysis-empty">
          Place a UAS threat on the canvas to analyze it.
        </p>
      )}
      {noPath > 0 && (
        <p className="muted analysis-empty">
          {noPath} UAS without a flight path. Draw a path to include it in run data.
        </p>
      )}

      {groupSummary ? (
        <>
          <div className="analysis-primary" aria-label="Full-run results">
            <p className="analysis-scope">Full-run results · entire configured duration</p>
            {widgets.filter((instance) => instance.type === 'run-validity').map(renderWidget)}
            {widgets.filter((instance) => instance.type === 'projection').map(renderWidget)}
            <details className="analysis-disclosure analysis-fullrun-series">
              <summary>Full-run time series · cursor marker</summary>
              {widgets.filter((instance) => instance.type === 'time-series').map(renderWidget)}
            </details>
          </div>
          <details className="analysis-disclosure analysis-cursor-supplement">
            <summary>Cursor-scoped supplemental data</summary>
            <p className="analysis-scope">Playback cursor and observed horizon · preview positions remain distinct from observed playback.</p>
            {widgets.filter((instance) => instance.type === 'kpi-tiles' || instance.type === 'threat-picture').map(renderWidget)}
          </details>
        </>
      ) : (
        <>
          <p className="analysis-scope">
            {phase === 'execute'
              ? 'Execution view · playback cursor and observed horizon. Full-run widgets are labeled separately.'
              : 'Analysis view · each widget retains its labeled cursor or full-run scope.'}
          </p>
          {widgets.map(renderWidget)}
        </>
      )}

      {complete && aar && (
        <DebriefRecord
          scenario={scenario}
          assessments={assessments}
          report={report}
          aar={aar}
          durationS={durationS}
          showValidity={!widgets.some((instance) => instance.type === 'run-validity')}
        />
      )}
    </div>
  )
}
