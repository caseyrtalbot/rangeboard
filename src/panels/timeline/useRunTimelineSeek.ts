import { useCallback } from 'react'
import type { TimeViewport } from '../../charts/timeViewport'
import { useStore } from '../../state/store'
import type { RunTimelineHit } from './hit'
import { shownViewport } from './useShownT0'

/**
 * The plot's item click (SPEC 1.5). A mark seeks the playhead to its time
 * through the store's `seekRunTimeline`, which turns Follow off, holds the
 * shown viewport (read now, so the view does not jump) and issues `scrub`.
 * A span does nothing. Observation never advances.
 */
export function seekRunTimelineHit(
  hit: RunTimelineHit,
  base: TimeViewport,
  follow: boolean,
  durationS: number,
): void {
  if (hit.t !== 'mark') return
  useStore.getState().seekRunTimeline(hit.mark.tS, shownViewport(base, follow, durationS))
}

/** `Plot`'s `onItemClick`; the identity holds while the inputs hold. */
export function useRunTimelineSeek(
  base: TimeViewport,
  follow: boolean,
  durationS: number,
): (hit: RunTimelineHit) => void {
  return useCallback(
    (hit: RunTimelineHit) => seekRunTimelineHit(hit, base, follow, durationS),
    [base, follow, durationS],
  )
}
