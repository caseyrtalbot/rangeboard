import { EngagementStrip } from '../EngagementStrip'
import type { WidgetProps } from './registry'
import { WidgetFrame } from './WidgetFrame'

/** One lane per threat: detection, classification, window, shot and arrival on the time axis. */
export function EngagementLanesWidget({ id, params, collapsed, customize, index, count }: WidgetProps) {
  void params
  return (
    <WidgetFrame
      id={id}
      type="engagement-lanes"
      title="Engagement lanes"
      meta="planning envelope · per threat"
      collapsed={collapsed}
      customize={customize}
      index={index}
      count={count}
    >
      <EngagementStrip embedded />
    </WidgetFrame>
  )
}
