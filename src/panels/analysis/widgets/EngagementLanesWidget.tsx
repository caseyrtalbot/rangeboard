import { useTrialResult, trialStateText } from './controls'
import { EngagementStrip } from '../EngagementStrip'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

/** One lane per threat: detection, classification, window, shot and arrival on the time axis. */
export function EngagementLanesWidget({ id, params, collapsed, customize, index, count, horizon }: WidgetProps) {
  void params
  const trial = useTrialResult()
  return (
    <WidgetFrame
      id={id}
      type="engagement-lanes"
      title="Engagement lanes"
      meta={trialStateText(trial.selection, trial.snapshot?.observedThroughS)}
      metaWithinHorizon
      horizon={horizon}
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      <EngagementStrip embedded />
    </WidgetFrame>
  )
}
