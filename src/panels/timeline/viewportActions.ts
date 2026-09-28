/**
 * Run timeline viewport actions: the pure math the header controls, the wheel
 * and pinch gestures and the overview drag share. No React, no DOM. Each takes
 * the viewport on screen now (`shownViewport`) and returns a clamped viewport.
 */

import type { RunTimelineKind, RunTimelineModel } from '../../analysis/runTimeline'
import {
  clampViewport,
  MIN_WINDOW_S,
  ZOOM_STEP,
  zoomViewport,
  type TimeViewport,
} from '../../charts/timeViewport'

/** The mockup's wheel zoom rate: the factor is exp(deltaY * WHEEL_ZOOM_RATE). */
const WHEEL_ZOOM_RATE = 0.004
/** Pixels per wheel line (`deltaMode` 1), as browsers scroll a line. */
const WHEEL_LINE_PX = 16

/** Zoom in or Zoom out one step about the viewport center (SPEC 1.3). */
export function zoomStep(shown: TimeViewport, dir: 'in' | 'out', durationS: number): TimeViewport {
  const factor = dir === 'in' ? 1 / ZOOM_STEP : ZOOM_STEP
  return zoomViewport(shown, factor, shown.t0S + shown.winS / 2, durationS)
}

/** Zoom in has room while the window is wider than its minimum. */
export function canZoomIn(v: TimeViewport, durationS: number): boolean {
  return v.winS > Math.min(MIN_WINDOW_S, durationS)
}

/** Zoom out has room while the window is narrower than the run. */
export function canZoomOut(v: TimeViewport, durationS: number): boolean {
  return v.winS < durationS
}

/** Fit: the whole run. */
export function fitViewport(durationS: number): TimeViewport {
  return clampViewport({ t0S: 0, winS: durationS }, durationS)
}

/** The window readout: whole seconds, or `fit` when the window holds the whole run. */
export function windowReadout(v: TimeViewport, durationS: number): string {
  return durationS > 0 && v.winS >= durationS ? 'fit' : `${Math.round(v.winS)} s`
}

/** A wheel delta in pixels; `pagePx` sizes a page delta (`deltaMode` 2). */
export function wheelPx(delta: number, deltaMode: number, pagePx: number): number {
  if (deltaMode === 1) return delta * WHEEL_LINE_PX
  if (deltaMode === 2) return delta * pagePx
  return delta
}

/** The run time under `offsetPx` from the plot's left edge, held inside the window. */
export function anchorTime(shown: TimeViewport, offsetPx: number, widthPx: number): number {
  if (!(widthPx > 0)) return shown.t0S + shown.winS / 2
  const f = Math.min(Math.max(offsetPx / widthPx, 0), 1)
  return shown.t0S + f * shown.winS
}

/** Wheel zoom about `anchorS`: a positive `deltaYPx` widens the window. */
export function wheelZoom(
  shown: TimeViewport,
  deltaYPx: number,
  anchorS: number,
  durationS: number,
): TimeViewport {
  return zoomViewport(shown, Math.exp(deltaYPx * WHEEL_ZOOM_RATE), anchorS, durationS)
}

/**
 * The zoom factor for one WebKit pinch change, from the last scale to the new
 * one: a spread (`scale` above `lastScale`) narrows the window, below 1.
 */
export function pinchFactor(lastScale: number, scale: number): number {
  return lastScale / scale
}

/** A horizontal pan by `deltaPx` of plot width; positive moves later in the run. */
export function panBy(
  shown: TimeViewport,
  deltaPx: number,
  widthPx: number,
  durationS: number,
): TimeViewport {
  if (!(widthPx > 0)) return clampViewport(shown, durationS)
  const t0S = shown.t0S + (deltaPx / widthPx) * shown.winS
  return clampViewport({ t0S, winS: shown.winS }, durationS)
}

/** The run time at `offsetPx` across the overview, which spans the whole run. */
export function overviewTime(offsetPx: number, widthPx: number, durationS: number): number {
  if (!(widthPx > 0)) return 0
  return Math.min(Math.max(offsetPx / widthPx, 0), 1) * durationS
}

/**
 * The grab offset of an overview press, seconds from the window start: a press
 * inside the window keeps its place; a press outside centers the window there.
 */
export function overviewGrab(shown: TimeViewport, tS: number): number {
  const inside = tS >= shown.t0S && tS <= shown.t0S + shown.winS
  return inside ? tS - shown.t0S : shown.winS / 2
}

/** The window placed so `grabS` from its start sits at `tS`. */
export function overviewPlace(
  shown: TimeViewport,
  tS: number,
  grabS: number,
  durationS: number,
): TimeViewport {
  return clampViewport({ t0S: tS - grabS, winS: shown.winS }, durationS)
}

/** Expand all: every group, and every row with sub-lanes (the sensor rows). */
export function expandAllKeys(model: RunTimelineModel): {
  groups: RunTimelineKind[]
  sensorRows: string[]
} {
  const sensorRows: string[] = []
  for (const g of model.groups)
    for (const row of g.rows) if (row.subLanes && row.subLanes.length > 0) sensorRows.push(row.key)
  return { groups: model.groups.map((g) => g.key), sensorRows }
}
