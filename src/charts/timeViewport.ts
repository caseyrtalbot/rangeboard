/**
 * Run timeline viewport: the visible window `[t0S, t0S + winS]` of the time
 * axis. Pure: no React, no DOM. docs/ENGINEERING_REFERENCE.md (Run timeline
 * model) holds the contract.
 */

import { tickStepS } from './timeAxis'

export interface TimeViewport {
  t0S: number
  winS: number
}

export const DEFAULT_WINDOW_S = 120
export const MIN_WINDOW_S = 10
/** Fraction of the width where Follow holds the playhead. */
export const FOLLOW_AT = 2 / 3
/** Zoom in and Zoom out step factor. */
export const ZOOM_STEP = 1.5

/**
 * Window into `[min(MIN_WINDOW_S, durationS), durationS]`, then t0 into
 * `[0, durationS - winS]`. Returns `v` itself when unchanged so a caller can
 * skip a state write.
 */
export function clampViewport(v: TimeViewport, durationS: number): TimeViewport {
  if (!(durationS > 0) || !Number.isFinite(durationS)) {
    return v.t0S === 0 && v.winS === MIN_WINDOW_S ? v : { t0S: 0, winS: MIN_WINDOW_S }
  }
  const winS = Math.min(Math.max(v.winS, Math.min(MIN_WINDOW_S, durationS)), durationS)
  const t0S = Math.min(Math.max(v.t0S, 0), durationS - winS)
  return t0S === v.t0S && winS === v.winS ? v : { t0S, winS }
}

/** Keeps the playhead at FOLLOW_AT of the width, except near the run ends. */
export function followViewport(v: TimeViewport, tS: number, durationS: number): TimeViewport {
  return clampViewport({ t0S: tS - FOLLOW_AT * v.winS, winS: v.winS }, durationS)
}

/**
 * `factor > 1` widens the window (zoom out). The anchor keeps its fraction of
 * the width.
 */
export function zoomViewport(
  v: TimeViewport,
  factor: number,
  anchorS: number,
  durationS: number,
): TimeViewport {
  const nextWinS = clampViewport({ t0S: 0, winS: v.winS * factor }, durationS).winS
  if (nextWinS === v.winS) return clampViewport(v, durationS)
  const f = (anchorS - v.t0S) / v.winS
  return clampViewport({ t0S: anchorS - f * nextWinS, winS: nextWinS }, durationS)
}

/**
 * Multiples of `tickStepS` inside the window, inclusive. Ticks are absolute
 * run times, so a pan never shifts a tick's time.
 */
export function viewportTicks(v: TimeViewport, widthPx: number): number[] {
  if (!(widthPx > 0) || !(v.winS > 0)) return []
  const step = tickStepS(v.winS, widthPx)
  const out: number[] = []
  const end = v.t0S + v.winS
  // Index multiplication keeps each tick an exact multiple of step.
  for (let k = Math.ceil(v.t0S / step); k * step <= end; k++) out.push(k * step)
  return out
}

/** Time to x in pixels. No rounding and no clamping; the component clips. */
export function xOf(v: TimeViewport, widthPx: number): (tS: number) => number {
  return (tS) => ((tS - v.t0S) / v.winS) * widthPx
}
