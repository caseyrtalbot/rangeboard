import { memo } from 'react'
import type { Scenario } from '../model/types'
import { useStore } from '../state/store'
import { selectSimTimeS } from '../state/selectors'
import type { TrackTimeline } from '../playback/trackState'
import { sweepAt } from '../playback/sweepAt'
import { BoundaryLayer } from './layers/BoundaryLayer'
import { FootprintLayer } from './layers/FootprintLayer'
import { RangeLayer } from './layers/RangeLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'

// These three take no props and read the store themselves, so a publication
// here must not re-render them.
const StaticBoundaryLayer = memo(BoundaryLayer)
const StaticRangeLayer = memo(RangeLayer)
const StaticConnectionLayer = memo(ConnectionLayer)

interface Props {
  scenario: Scenario
  /** Prefix-aggregated timeline, shared with LiveScene through `trackTimelineOf`. */
  timeline: TrackTimeline
}

/**
 * The layers whose geometry does not move with the frame clock, on their own
 * Konva Layer (one canvas): boundaries, footprints, range rings and
 * connections. A moving glyph repaints the live canvas alone, and the dashed
 * rings here stay untouched between publications.
 *
 * The one time-dependent input is the held-sensor set for FootprintLayer. It
 * derives from the published `simTimeS` through the shared sweep memo, and
 * `sweepAt` keeps the Set identity while its contents are unchanged, so the
 * footprints re-render only when a sensor gains or loses a hold.
 */
export const StaticScene = memo(function StaticScene({ scenario, timeline }: Props) {
  const simTimeS = useStore(selectSimTimeS)
  const activeSensorIds = sweepAt(scenario, timeline, simTimeS).activeSensorIds
  return (
    <>
      <StaticBoundaryLayer />
      <FootprintLayer activeSensorIds={activeSensorIds} />
      <StaticRangeLayer />
      <StaticConnectionLayer />
    </>
  )
})
