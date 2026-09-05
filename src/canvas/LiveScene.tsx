import { memo, useEffect, useMemo, useRef } from 'react'
import type { Scenario, Vec2 } from '../model/types'
import type { Camera } from '../state/store'
import { detectionsAt, liveTracks } from '../playback/sim'
import type { LeakerImpact } from '../analysis/impact'
import { effectorStatesAt, shotsInFlightAt, trackStatesAt } from '../playback/trackState'
import type { TrackTimeline } from '../playback/trackState'
import { useFrameClock } from './frameClock'
import { layoutLabels } from './labelLayout'
import { BoundaryLayer } from './layers/BoundaryLayer'
import { FootprintLayer } from './layers/FootprintLayer'
import { ThreatWezLayer } from './layers/ThreatWezLayer'
import { RangeLayer } from './layers/RangeLayer'
import { PathLayer } from './layers/PathLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'
import { EngagementLayer } from './layers/EngagementLayer'
import { EntityLayer } from './layers/EntityLayer'
import { CalloutLayer } from './layers/CalloutLayer'
import { SystemHandleLayer } from './layers/SystemHandleLayer'

// These four take no time-dependent props and read the store themselves, so a
// per-frame LiveScene render must not re-render them.
const StaticBoundaryLayer = memo(BoundaryLayer)
const StaticRangeLayer = memo(RangeLayer)
const StaticConnectionLayer = memo(ConnectionLayer)
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

/**
 * Every time-dependent canvas layer, under one frame clock. This is the only
 * place `useFrameClock` is mounted: it sits inside the Konva `Layer`, so its
 * per-frame state updates commit in the react-konva root and never in
 * react-dom (F1, design contract section 7).
 *
 * Two clocks draw this scene. Interpolated (`displayTimeS`, one value per
 * animation frame): track positions and headings, label placement, shots in
 * flight, and every pulse or blink. Snapped (`simTimeS`, the last published
 * time at 10 Hz): the sensor sweep, track lifecycle and effector glyph state,
 * which are step functions that must not be read between publications.
 */
export function LiveScene(props: Props) {
  const { scenario, camera, size, mouseWorld, impacts, timeline, durationS } = props
  const { simTimeS, displayTimeS } = useFrameClock(durationS)

  const tracks = useMemo(() => liveTracks(scenario, displayTimeS), [scenario, displayTimeS])
  const shots = useMemo(() => shotsInFlightAt(timeline, displayTimeS), [timeline, displayTimeS])
  const detections = useMemo(() => detectionsAt(scenario, simTimeS), [scenario, simTimeS])
  const trackStates = useMemo(() => trackStatesAt(timeline, simTimeS), [timeline, simTimeS])
  const effectorStates = useMemo(() => effectorStatesAt(timeline, simTimeS), [timeline, simTimeS])

  const prevSpokeIds = useRef<Set<string>>(new Set())
  const labelPlacements = useMemo(
    () =>
      layoutLabels(
        scenario.entities.map((e) => {
          const pos = tracks.get(e.id)?.pos ?? e.pos
          return { id: e.id, name: e.name, sx: pos.x * camera.scale + camera.x, sy: pos.y * camera.scale + camera.y }
        }),
        // eslint-disable-next-line react/refs -- last frame's spoke set feeds hysteresis; one frame stale by design
        { sticky: prevSpokeIds.current, viewport: { w: size.w, h: size.h } },
      ),
    [scenario.entities, tracks, camera, size],
  )
  const spokeIds = useMemo(
    () => new Set([...labelPlacements].filter(([, p]) => p.mode === 'spoke').map(([id]) => id)),
    [labelPlacements],
  )
  useEffect(() => {
    prevSpokeIds.current = spokeIds
  }, [spokeIds])

  return (
    <>
      <StaticBoundaryLayer />
      <FootprintLayer detections={detections} />
      <ThreatWezLayer tracks={tracks} impacts={impacts} displayTimeS={displayTimeS} />
      <StaticRangeLayer />
      <PathLayer mouseWorld={mouseWorld} tracks={tracks} />
      <StaticConnectionLayer />
      <EngagementLayer shots={shots} displayTimeS={displayTimeS} />
      <EntityLayer
        tracks={tracks}
        detections={detections}
        spokeIds={spokeIds}
        trackStates={trackStates}
        effectorStates={effectorStates}
        displayTimeS={displayTimeS}
      />
      <StaticSystemHandleLayer />
      <CalloutLayer placements={labelPlacements} />
    </>
  )
}
