import type { RefObject } from 'react'
import type { TimeViewport } from '../../charts/timeViewport'

// Contract stub (timeline/p3). Lane 3B replaces the body; the signature holds.

/** What a gesture reads at event time. */
export interface GestureView {
  /** The clamped stored viewport; a gesture that turns Follow off starts from `shownViewport`. */
  base: TimeViewport
  follow: boolean
  durationS: number
  /** The plot column width, px. */
  widthPx: number
}

/**
 * Wheel and pinch on the rows' scroll container (SPEC 1.3): Ctrl or Meta wheel
 * and pinch zoom about the cursor time; a horizontal wheel pans and turns
 * Follow off; a vertical wheel scrolls the rows. `plotRef` is the plot column,
 * whose left edge is time `t0S`.
 */
export function useViewportGestures(
  _scrollRef: RefObject<HTMLElement | null>,
  _plotRef: RefObject<HTMLElement | null>,
  _view: GestureView,
): void {}
