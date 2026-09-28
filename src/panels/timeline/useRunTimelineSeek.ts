import type { TimeViewport } from '../../charts/timeViewport'
import type { RunTimelineHit } from './hit'

// Contract stub (timeline/p3). Lane 3A replaces the body; the signature holds.

const ignore = (_hit: RunTimelineHit) => {}

/**
 * The plot's item click (SPEC 1.5). A mark seeks the playhead to its time
 * through the store's `seekRunTimeline`, which turns Follow off, holds the
 * shown viewport (`shownViewport`) and issues `scrub`. A span does nothing.
 */
export function useRunTimelineSeek(
  _base: TimeViewport,
  _follow: boolean,
  _durationS: number,
): (hit: RunTimelineHit) => void {
  return ignore
}
