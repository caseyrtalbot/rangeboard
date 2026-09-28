import type { RunTimelineModel } from '../../analysis/runTimeline'
import type { TimeViewport } from '../../charts/timeViewport'

// Contract stub (timeline/p3). Lane 3B replaces the body; the props hold.

/**
 * The header controls (SPEC 1.3, mockup order): Follow, Zoom out, the window
 * readout, Zoom in, Fit, Collapse all, Expand all. `base` is the clamped
 * stored viewport; a control that turns Follow off starts from `shownViewport`.
 */
export function Controls(_props: { model: RunTimelineModel; base: TimeViewport; follow: boolean }) {
  return null
}
