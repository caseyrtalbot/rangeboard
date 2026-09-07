import { memo, useEffect, useMemo, useRef } from 'react'
import type { Scenario, Vec2 } from '../model/types'
import type { Camera } from '../state/store'
import { liveTracks } from '../playback/tracks'
import type { LiveTrack } from '../playback/tracks'
import type { LeakerImpact } from '../analysis/impact'
import { blinkOn, shotsInFlightAt } from '../playback/trackState'
import type { TrackTimeline } from '../playback/trackState'
import { sweepAt } from '../playback/sweepAt'
import { useFrameClock } from './frameClock'
import { boardDesignator, layoutLabels } from './labelLayout'
import type { LabelPlacement } from './labelLayout'
import { ThreatWezLayer } from './layers/ThreatWezLayer'
import { PathLayer } from './layers/PathLayer'
import { EngagementLayer } from './layers/EngagementLayer'
import { EntityLayer } from './layers/EntityLayer'
import { CalloutLayer } from './layers/CalloutLayer'
import { SystemHandleLayer } from './layers/SystemHandleLayer'

// These two take no time-dependent props and read the store themselves, so a
// per-frame LiveScene render must not re-render them.
const StaticPathLayer = memo(PathLayer)
const StaticSystemHandleLayer = memo(SystemHandleLayer)

interface Props {
  scenario: Scenario
  camera: Camera
  /** Canvas host size, screen px. Bounds the label layout viewport. */
  size: { w: number; h: number }
  /** Cursor in world meters. Feeds the draft path rubber band. */
  mouseWorld: Vec2 | null
  /** Whole-run leaker impacts, shared with the analysis panel. */
  impacts: LeakerImpact[]
  /** Prefix-aggregated timeline. The queries below are binary searches over it. */
  timeline: TrackTimeline
  /** Run duration, seconds. Clamps the frame clock. */
  durationS: number
}

/** True when two spoke placements put the same leader and text box on screen. */
function samePlacement(a: LabelPlacement, b: LabelPlacement): boolean {
  if (a.mode !== b.mode) return false
  if (a.mode !== 'spoke' || b.mode !== 'spoke') return true
  if (a.tx !== b.tx || a.ty !== b.ty || a.width !== b.width || a.align !== b.align) return false
  for (let i = 0; i < 6; i++) if (a.points[i] !== b.points[i]) return false
  return true
}

/**
 * A fresh layout keeps the previous placement object wherever the placement
 * did not move, and the previous Map when nothing moved, so the callout memo
 * and the spoke set hold their identities across a frame.
 */
function stablePlacements(
  next: Map<string, LabelPlacement>,
  prev: Map<string, LabelPlacement> | null,
): Map<string, LabelPlacement> {
  if (!prev) return next
  let reused = 0
  for (const [id, placement] of next) {
    const old = prev.get(id)
    if (!old || !samePlacement(placement, old)) continue
    next.set(id, old)
    reused++
  }
  return reused === next.size && prev.size === next.size ? prev : next
}

function sameTrack(a: LiveTrack, b: LiveTrack): boolean {
  return (
    a.pos.x === b.pos.x &&
    a.pos.y === b.pos.y &&
    a.headingDeg === b.headingDeg &&
    a.flying === b.flying &&
    a.done === b.done
  )
}

/**
 * A scenario swap at one display time rebuilds the tracks. A track whose
 * fields did not change keeps the previous object, and the Map keeps its
 * identity when nothing moved, so an edit that flies no threat re-renders
 * no flying node.
 */
function stableTracks(
  next: Map<string, LiveTrack>,
  prev: Map<string, LiveTrack> | null,
): Map<string, LiveTrack> {
  if (!prev) return next
  let reused = 0
  for (const [id, track] of next) {
    const old = prev.get(id)
    if (!old || !sameTrack(track, old)) continue
    next.set(id, old)
    reused++
  }
  return reused === next.size && prev.size === next.size ? prev : next
}

/** The previous spoke set when it holds the same ids, so the entity groups hold across a frame. */
function stableIds(next: Set<string>, prev: Set<string>): Set<string> {
  if (prev.size !== next.size) return next
  for (const id of next) if (!prev.has(id)) return next
  return prev
}

/**
 * Every time-dependent canvas layer, under one frame clock. This is the only
 * place `useFrameClock` is mounted: it sits inside the live Konva `Layer`, so
 * its per-frame state updates commit in the react-konva root and never in
 * react-dom. The static rings live on their own Layer (`StaticScene`).
 *
 * Two clocks draw this scene. Interpolated (`displayTimeS`, one value per
 * animation frame): track positions and headings, label placement, shots in
 * flight, and every pulse or blink. Snapped (`simTimeS`, the last published
 * time at 10 Hz): the sensor sweep, track lifecycle and effector glyph state,
 * which are step functions that must not be read between publications. The
 * snapped values come from `sweepAt`, shared with the static scene, the track
 * card and the threat pane.
 */
export function LiveScene(props: Props) {
  const { scenario, camera, size, mouseWorld, impacts, timeline, durationS } = props
  const { simTimeS, displayTimeS } = useFrameClock(durationS)

  const prevTracks = useRef<Map<string, LiveTrack> | null>(null)
  const tracks = useMemo(
    // eslint-disable-next-line react/refs -- the previous tracks lend identities; one render stale by design
    () => stableTracks(liveTracks(scenario, displayTimeS), prevTracks.current),
    [scenario, displayTimeS],
  )
  const shots = useMemo(() => shotsInFlightAt(timeline, displayTimeS), [timeline, displayTimeS])
  const sweep = sweepAt(scenario, timeline, simTimeS)
  // One pulse phase per frame. The nodes read this boolean, never the time.
  const blink = blinkOn(displayTimeS)

  const prevSpokeIds = useRef<Set<string>>(new Set())
  const prevPlacements = useRef<Map<string, LabelPlacement> | null>(null)
  // The drawn designator is scenario work; only the screen position of a label
  // moves per frame, so layoutLabels is left with geometry alone.
  const labelText = useMemo(
    () => scenario.entities.map((e) => ({ id: e.id, name: e.name, drawn: boardDesignator(e.name), pos: e.pos })),
    [scenario.entities],
  )
  const labelPlacements = useMemo(
    () => {
      const fresh = layoutLabels(
        labelText.map((e) => {
          const pos = tracks.get(e.id)?.pos ?? e.pos
          return {
            id: e.id,
            name: e.name,
            drawn: e.drawn,
            sx: pos.x * camera.scale + camera.x,
            sy: pos.y * camera.scale + camera.y,
          }
        }),
        // eslint-disable-next-line react/refs -- last frame's spoke set feeds hysteresis; one frame stale by design
        { sticky: prevSpokeIds.current, viewport: { w: size.w, h: size.h } },
      )
      // eslint-disable-next-line react/refs -- same one-frame hysteresis as the sticky set
      return stablePlacements(fresh, prevPlacements.current)
    },
    [labelText, tracks, camera, size],
  )
  // A moved label changes the placements but seldom the spoke set; the set
  // keeps its identity while its ids hold, so the entity groups do not
  // re-render for a callout that moved.
  const spokeIds = useMemo(
    () =>
      stableIds(
        new Set([...labelPlacements].filter(([, p]) => p.mode === 'spoke').map(([id]) => id)),
        // eslint-disable-next-line react/refs -- last frame's spoke set lends its identity; one frame stale by design
        prevSpokeIds.current,
      ),
    [labelPlacements],
  )
  useEffect(() => {
    prevTracks.current = tracks
    prevSpokeIds.current = spokeIds
    prevPlacements.current = labelPlacements
  }, [tracks, spokeIds, labelPlacements])

  return (
    <>
      <ThreatWezLayer tracks={tracks} impacts={impacts} displayTimeS={displayTimeS} />
      <StaticPathLayer mouseWorld={mouseWorld} />
      <EngagementLayer shots={shots} displayTimeS={displayTimeS} />
      <EntityLayer tracks={tracks} sweep={sweep} spokeIds={spokeIds} blink={blink} />
      <StaticSystemHandleLayer />
      <CalloutLayer placements={labelPlacements} />
    </>
  )
}
