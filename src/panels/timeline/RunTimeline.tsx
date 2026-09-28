import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { runTimelineOf } from '../../analysis/runTimeline'
import { clampViewport, DEFAULT_WINDOW_S, type TimeViewport } from '../../charts/timeViewport'
import { selectBoardPhase } from '../../state/selectors'
import { useStore } from '../../state/store'
import { selectTrialHorizon, type TrialSelection } from '../../state/trialSelectors'
import { trialViewOf, useTrialResult } from '../analysis/controls'
import { Axis } from './Axis'
import { Controls } from './Controls'
import { Gutter } from './Gutter'
import type { RunTimelineHit } from './hit'
import { GUTTER_W, stripLayout, type Placed } from './layout'
import { Overview } from './Overview'
import { Plot } from './Plot'
import { Tooltip, type TooltipHandle } from './Tooltip'
import { horizonText } from './tooltipText'
import { useRunTimelineSeek } from './useRunTimelineSeek'
import { useScrollToSelection, useSelectedLines } from './useRunTimelineSelection'
import { useViewportGestures } from './useViewportGestures'

/** The viewport a session starts with; one object so a clamp can return it as is. */
const DEFAULT_VIEWPORT: TimeViewport = { t0S: 0, winS: DEFAULT_WINDOW_S }
const NO_LINES: Placed[] = []

/** The one status line while no trial can supply outcomes (SPEC 1.1). */
function stateText(selection: TrialSelection): string {
  if (selection.status === 'preparing') return 'Preparing trial'
  if (selection.status === 'error') return selection.message
  if (selection.status === 'cancelled') return 'Trial cancelled'
  return 'No trial yet. Press Play in Execute to run one.'
}

/**
 * Run timeline strip (docs/timeline/SPEC.md section 1). App mounts it lazily
 * inside `.runtl-dock`, which holds the height; the root fills it. The model
 * arrives censored at the horizon; this component maps times to pixels and
 * never compares a time with the horizon. Session state lives in
 * `ui.runTimeline`; each field has its own selector. Phase 3 wires the board
 * link (`useRunTimelineSelection`, `useRunTimelineSeek`) and the pointer and
 * keyboard controls (`Controls`, `Tooltip`, `useViewportGestures`) here.
 */
export function RunTimeline() {
  const trial = useTrialResult()
  const view = trialViewOf(trial)
  // SPEC 1.4: in Analyze the horizon is the run's observed end, not the cursor.
  // The selector still bounds it by what the run and the trial observed.
  const analyzeHorizon = useStore((s) =>
    selectBoardPhase(s) === 'analyze' ? selectTrialHorizon(s, Infinity) : null,
  )
  const horizonS = analyzeHorizon ?? trial.horizon
  const model = useMemo(() => (view ? runTimelineOf(view, horizonS) : null), [view, horizonS])
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
  // A layout effect measures before the first paint, so no frame draws at scale 0.
  const [widthPx, setWidthPx] = useState(0)
  const plotRef = useRef<HTMLDivElement | null>(null)
  const hasModel = model != null
  useLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidthPx(el.clientWidth))
    ro.observe(el)
    setWidthPx(el.clientWidth)
    return () => ro.disconnect()
  }, [hasModel])
  const pxPerS = widthPx > 0 && base.winS > 0 ? widthPx / base.winS : 0

  const rootRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const tipRef = useRef<TooltipHandle | null>(null)
  const lines = layout ? layout.lines : NO_LINES
  const selected = useSelectedLines(lines)
  useScrollToSelection(scrollRef, lines, selected)
  const seek = useRunTimelineSeek(base, follow, durationS)
  const hover = useCallback((hit: RunTimelineHit | null, clientX: number, clientY: number) => {
    if (hit) tipRef.current?.show(hit, clientX, clientY)
    else tipRef.current?.hide()
  }, [])
  useViewportGestures(scrollRef, plotRef, { base, follow, durationS, widthPx })

  // The header, the accessible name and the tooltip share one horizon text (SPEC 1.4).
  const scope = horizonText(model ? model.horizonS : -Infinity)
  const style = { '--runtl-gutter': `${GUTTER_W}px` } as CSSProperties
  return (
    <div
      ref={rootRef}
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
            <Controls model={model} base={base} follow={follow} />
          </div>
          <div className="runtl-scroll" ref={scrollRef}>
            <Gutter lines={layout.lines} selected={selected} />
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
                selected={selected}
                onItemClick={seek}
                onItemHover={hover}
              />
            </div>
          </div>
          <Axis
            base={base}
            follow={follow}
            durationS={durationS}
            widthPx={widthPx}
            pxPerS={pxPerS}
          />
          <Overview model={model} base={base} follow={follow} widthPx={widthPx} />
          <Tooltip ref={tipRef} rootRef={rootRef} model={model} />
        </>
      ) : (
        <p className="runtl-empty" role="status">
          {stateText(trial.selection)}
        </p>
      )}
    </div>
  )
}
