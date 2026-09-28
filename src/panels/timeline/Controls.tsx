import type { RunTimelineModel } from '../../analysis/runTimeline'
import type { TimeViewport } from '../../charts/timeViewport'
import { useStore } from '../../state/store'
import { shownViewport } from './useShownT0'
import {
  canZoomIn,
  canZoomOut,
  expandAllKeys,
  fitViewport,
  windowReadout,
  zoomStep,
} from './viewportActions'

/**
 * The header controls (SPEC 1.3, mockup order): Follow, Zoom out, the window
 * readout, Zoom in, Fit, Collapse all, Expand all. `base` is the clamped
 * stored viewport; a control that turns Follow off starts from `shownViewport`.
 * A zoom starts from the shown viewport too and leaves Follow as it is.
 */
export function Controls({
  model,
  base,
  follow,
}: {
  model: RunTimelineModel
  base: TimeViewport
  follow: boolean
}) {
  const { durationS } = model
  const zoom = (dir: 'in' | 'out') =>
    useStore
      .getState()
      .setRunTimelineViewport(zoomStep(shownViewport(base, follow, durationS), dir, durationS))
  const toggleFollow = () => {
    const s = useStore.getState()
    if (follow) s.setRunTimelineViewport(shownViewport(base, true, durationS), false)
    else s.setRunTimelineFollow(true)
  }
  const expandAll = () => {
    const { groups, sensorRows } = expandAllKeys(model)
    useStore.getState().expandAllRunTimeline(groups, sensorRows)
  }
  return (
    <div className="runtl-ctl">
      <button
        type="button"
        className="mini runtl-follow"
        aria-pressed={follow}
        title="Viewport follows the playhead"
        onClick={toggleFollow}
      >
        Follow
      </button>
      <button
        type="button"
        className="mini"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={!canZoomOut(base, durationS)}
        onClick={() => zoom('out')}
      >
        −
      </button>
      <span className="runtl-zoom">
        <span className="runtl-zoom-name">Window </span>
        {windowReadout(base, durationS)}
      </span>
      <button
        type="button"
        className="mini"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={!canZoomIn(base, durationS)}
        onClick={() => zoom('in')}
      >
        +
      </button>
      <button
        type="button"
        className="mini"
        title="Fit the whole run"
        onClick={() => useStore.getState().setRunTimelineViewport(fitViewport(durationS))}
      >
        Fit
      </button>
      <button
        type="button"
        className="mini"
        title="Collapse every group"
        onClick={() => useStore.getState().collapseAllRunTimeline()}
      >
        Collapse all
      </button>
      <button type="button" className="mini" title="Expand every group" onClick={expandAll}>
        Expand all
      </button>
    </div>
  )
}
