import { FORECAST_IN_ANALYZE } from '../analysis/horizon'
import { WidgetFrame } from './analysis/widgets/WidgetFrame'
import { Fragment, memo, useMemo } from 'react'
import { buildAarSummary } from '../analysis/aar'
import { trialResultOf } from '../analysis/trialResult'
import { formatTime } from '../geometry/geo'
import { useForecastEngagement, useTrialResult, trialStateText } from './analysis/widgets/controls'
import { currentSummary, bandMean, countSub, statMean, timeStatSub } from './analysis/widgets/mc'
import { OutcomeSummary } from './analysis/OutcomeSummary'
import { AboutProjection } from './analysis/widgets/ProjectionWidget'
import { AnalysisSection } from './analysis/AnalysisSection'
import { ThreatPicture } from './analysis/ThreatPicture'
import { threatPictureAt } from '../analysis/threatAggregation'
import { residualSectionHeadline } from './headlines'
import { runSettings } from '../model/types'
import type { WidgetInstance, WidgetType } from '../state/analysisLayout'
import { BUILTIN_LENSES, WIDGET_TYPES } from '../state/analysisLayout'
import { useStore } from '../state/store'
import { selectDurationS, selectExecutionHorizon, selectRunComplete } from '../state/selectors'
import { DebriefRecord, TrialOutcomeSummary } from './analysis/DebriefRecord'
import { LiveStrip } from './analysis/LiveStrip'
import { WIDGETS } from './analysis/widgets/registry'
import type { WidgetProps } from './analysis/widgets/registry'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { exportScenario } from '../io/persist'

/**
 * Every widget subscribes to the store on its own, so a panel render must not
 * cascade into the stack. Props stay stable between layout edits and horizon changes, so `memo`
 * holds each widget until those inputs or its own selectors move.
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
  const horizon = useStore(selectExecutionHorizon)
  const widgets = useStore((state) => state.ui.analysis.layout.widgets)
  const presetId = useStore((state) => state.ui.analysis.layout.presetId)
  const customize = useStore((state) => state.ui.analysisCustomize)
  const durationS = useStore(selectDurationS)
  const { assessments, report, impacts } = useForecastEngagement(scenario, runId)
  const projectionGroups = useMemo(
    () => threatPictureAt(scenario, assessments, report, Number.POSITIVE_INFINITY, new Map()),
    [scenario, assessments, report],
  )
  const trial = useTrialResult()
  const observedThroughS = useStore(state => state.playback.observedThroughS)
  const mcState = useStore(state => state.mc)
  const mc = currentSummary(mcState, runId)
  const trialView = trial.selection.status === 'ready' && trial.snapshot
    ? trialResultOf(trial.selection.scenario, trial.selection.result.manifest, trial.selection.result) : null
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
    const entry = WIDGETS[instance.type]
    const forecast = horizon.scoped && entry.horizon === 'full-run' &&
      !['run-validity', 'environment', 'fire-doctrine'].includes(instance.type)
    const props: WidgetProps = {
      id: instance.id,
      params: instance.params,
      collapsed: instance.collapsed,
      customize,
      index: widgets.indexOf(instance),
      count: widgets.length,
      horizon,
      onOpenPreparation,
    }
    return (
      <Fragment key={instance.id}>
        {phase === 'analyze' && !groupSummary && ['projection', 'requirement-gates', 'run-validity'].includes(instance.type) && (
          <p className="analysis-scope">Forecast · deterministic planning envelope</p>
        )}
        {instance.type === 'time-series' && !groupSummary && !horizon.scoped && (
          <p className="analysis-scope">Trial time series · cursor and observed horizon</p>
        )}
        <ErrorBoundary label={WIDGETS[instance.type].label} onExport={() => exportScenario(useStore.getState().scenario)}>
          {forecast ? (
            <WidgetFrame {...props} type={instance.type} title={entry.label}>
              <p className="muted">{FORECAST_IN_ANALYZE}</p>
            </WidgetFrame>
          ) : phase === 'analyze' && instance.type === 'projection' ? (
            <WidgetFrame {...props} type="projection" title="Forecast · full-run projection" meta="deterministic planning envelope" headerExtra={<AboutProjection />}>
              {threats.length === 0 ? <p className="muted small">No threats with flight paths.</p> : (
                <>
                  <OutcomeSummary scenario={scenario} assessments={assessments} report={report} />
                  <AnalysisSection title="Projected threat outcome · planning envelope" headline={residualSectionHeadline(report.totals)}>
                    <ThreatPicture groups={projectionGroups} mode="projected" />
                  </AnalysisSection>
                </>
              )}
            </WidgetFrame>
          ) : <Widget {...props} />}
        </ErrorBoundary>
      </Fragment>
    )
  }

  return (
    <div className="inspector-body analysis-panel">
      {phase === 'execute' ? (
        <LiveStrip onOpenSettings={onOpenPreparation ? () => onOpenPreparation('run') : undefined} />
      ) : (
        <section className="analysis-primary" aria-label="Trial results">
          <h3>Trial results</h3>
          {trialView ? <TrialOutcomeSummary view={trialView} horizonS={observedThroughS} /> :
            <p className="muted small">{trialStateText(trial.selection)}</p>}
        </section>
      )}

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
          <details className="analysis-disclosure analysis-cursor-supplement">
            <summary>Trial cursor telemetry</summary>
            <p className="analysis-scope">Playback cursor and observed horizon · preview positions remain distinct from observed playback.</p>
            {widgets.filter(instance => ['kpi-tiles', 'time-series', 'threat-picture'].includes(instance.type)).map(renderWidget)}
          </details>
          <section aria-label="Forecast">
            <h3>Forecast</h3>
            {widgets.filter(instance => instance.type === 'run-validity').map(renderWidget)}
            {widgets.filter(instance => instance.type === 'projection').map(renderWidget)}
          </section>
        </>
      ) : (
        <>
          <p className="analysis-scope">
            {phase === 'execute'
              ? 'Execution view · outcomes through the observed horizon. Forecast widgets open in Analyze.'
              : 'Analysis view · trial cursor telemetry and separately labeled forecasts.'}
          </p>
          {widgets.map(renderWidget)}
        </>
      )}

      {phase === 'analyze' && (
        <details className="analysis-disclosure" aria-label="Monte Carlo">
          <summary>Monte Carlo</summary>
          {mc ? (
            <>
              <p className="analysis-scope">{runSettings(scenario).uncertainty === 'total' ? 'Total uncertainty' : 'Aleatory uncertainty'} · {mc.replicates} replicates · {formatTime(mc.durationS)} · seed {mc.seed}</p>
              {(['kills', ...(report.totals.reportedLeakers == null ? [] : ['leakers'])] as Array<'kills' | 'leakers'>).map(key => (
                <p key={key}>
                  {key === 'kills' ? 'Mean kills' : 'Mean leakers'} · {bandMean(mc[key], mc[key].mean.length - 1, mc.replicates) ?? '—'}
                  <small> · {countSub(mc[key], mc[key].mean.length - 1, mc.replicates)}</small>
                </p>
              ))}
              <p>Mean first detect · {statMean(mc.firstDetectS) == null ? '—' : formatTime(statMean(mc.firstDetectS)!)}
                <small> · {timeStatSub(mc.firstDetectS, 'detected')}</small>
              </p>
              {report.totals.reportedLeakers != null && (
                <p>Mean minimum warning · {statMean(mc.minWarningS) == null ? '—' : formatTime(statMean(mc.minWarningS)!)}
                  <small> · {timeStatSub(mc.minWarningS, 'warning')}</small>
                </p>
              )}
            </>
          ) : <p className="muted small">No current ensemble result.</p>}
        </details>
      )}

      {complete && aar && (!horizon.scoped || horizon.horizonS >= durationS) && (
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
