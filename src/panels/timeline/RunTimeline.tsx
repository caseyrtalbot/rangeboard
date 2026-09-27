import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { runTimelineOf } from '../../analysis/runTimeline'
import { clampViewport, DEFAULT_WINDOW_S, type TimeViewport } from '../../charts/timeViewport'
import { formatTime } from '../../geometry/geo'
import { useStore } from '../../state/store'
import type { TrialSelection } from '../../state/trialSelectors'
import { trialViewOf, useTrialResult } from '../analysis/controls'
import { Axis } from './Axis'
import { Gutter } from './Gutter'
import { GUTTER_W, stripLayout } from './layout'
import { Overview } from './Overview'
import { Plot } from './Plot'

/** The viewport a session starts with; one object so a clamp can return it as is. */
const DEFAULT_VIEWPORT: TimeViewport = { t0S: 0, winS: DEFAULT_WINDOW_S }

/** The one status line while no trial can supply outcomes (SPEC 1.1). */
function stateText(selection: TrialSelection): string {
  if (selection.status === 'preparing') return 'Preparing trial'
  if (selection.status === 'error') return selection.message
  if (selection.status === 'cancelled') return 'Trial cancelled'
  return 'No trial yet. Press Play in Execute to run one.'
}

/** The horizon text the header and the accessible name share (SPEC 1.4). */
function scopeText(horizonS: number | null): string {
  return horizonS != null && Number.isFinite(horizonS)
    ? `Shown through T+${formatTime(horizonS)}`
    : 'No outcomes observed yet'
}

/**
 * Run timeline strip (docs/timeline/SPEC.md section 1). App mounts it lazily
 * inside `.runtl-dock`, which holds the height; the root fills it. The model
 * arrives censored at the horizon; this component maps times to pixels and
 * never compares a time with the horizon. Session state lives in
 * `ui.runTimeline`; each field has its own selector.
 */
export function RunTimeline() {
  const trial = useTrialResult()
  const view = trialViewOf(trial)
  const model = useMemo(
    () => (view ? runTimelineOf(view, trial.horizon) : null),
    [view, trial.horizon],
  )
  const openGroups = useStore((s) => s.ui.runTimeline.openGroups)
  const openSensors = useStore((s) => s.ui.runTimeline.openSensors)
  const openFolds = useStore((s) => s.ui.runTimeline.openFolds)
  const hiddenRows = useStore((s) => s.ui.runTimeline.hiddenRows)
  const follow = useStore((s) => s.ui.runTimeline.follow)
  const viewport = useStore((s) => s.ui.runTimeline.viewport)

  const layout = useMemo(
    () => (model ? stripLayout(model, { openGroups, openSensors, openFolds, hiddenRows }) : null),
    [model, openGroups, openSensors, openFolds, hiddenRows],
  )
  const durationS = model?.durationS ?? 0
  const base = useMemo(
    () => clampViewport(viewport ?? DEFAULT_VIEWPORT, durationS),
    [viewport, durationS],
  )

  // The plot column's width sets the scale; the axis and the overview share it.
  const [widthPx, setWidthPx] = useState(0)
  const plotRef = useRef<HTMLDivElement | null>(null)
  const hasModel = model != null
  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidthPx(el.clientWidth))
    ro.observe(el)
    setWidthPx(el.clientWidth)
    return () => ro.disconnect()
  }, [hasModel])
  const pxPerS = widthPx > 0 && base.winS > 0 ? widthPx / base.winS : 0

  const scope = scopeText(model ? model.horizonS : null)
  const style = { '--runtl-gutter': `${GUTTER_W}px` } as CSSProperties
  return (
    <div
      id="run-timeline"
      className="runtl"
      role="group"
      aria-label={`Run timeline. ${scope}`}
      style={style}
    >
      {model && layout ? (
        <>
          <div className="runtl-head">
            <span className="runtl-title">Run timeline</span>
            <span className="runtl-scope">{scope}</span>
            <span className="runtl-spacer" />
            {layout.hiddenCount > 0 && (
              <button
                type="button"
                className="mini"
                onClick={() => useStore.getState().showAllRunTimelineRows()}
              >
                {`Show all (${layout.hiddenCount} hidden)`}
              </button>
            )}
          </div>
          <div className="runtl-scroll">
            <Gutter lines={layout.lines} />
            <div className="runtl-plotcol" ref={plotRef}>
              <Plot
                lines={layout.lines}
                heightPx={layout.heightPx}
                widthPx={widthPx}
                pxPerS={pxPerS}
                base={base}
                follow={follow}
                durationS={durationS}
                horizonS={model.horizonS}
              />
            </div>
          </div>
          <Axis base={base} follow={follow} durationS={durationS} widthPx={widthPx} />
          <Overview model={model} base={base} follow={follow} widthPx={widthPx} />
        </>
      ) : (
        <p className="runtl-empty" role="status">
          {stateText(trial.selection)}
        </p>
      )}
    </div>
  )
}
