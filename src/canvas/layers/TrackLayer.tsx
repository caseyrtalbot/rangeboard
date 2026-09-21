import { Ellipse, Group, Line } from 'react-konva'
import { useStore } from '../../state/store'
import { latestEstimatesAt, positionEllipse } from '../../playback/trackEstimateView'
import type { TrackEstimate } from '../../playback/trackTypes'
import {
  TRACK_ELLIPSE_DASH,
  TRACK_ESTIMATE_INK,
  TRACK_FALSE_INK,
  TRACK_MARKER_PX,
} from './footprintStyle'

interface Props {
  /** Estimates the trial captured, oldest first. Undefined on a run that captured none. */
  tracks: readonly TrackEstimate[] | undefined
  /** Bounded observation horizon, seconds. Null before a trial observation. */
  horizonS: number | null
}

/** Cross arms in screen px, drawn inside a group that cancels the camera scale. */
const MARKER_H = [-TRACK_MARKER_PX, 0, TRACK_MARKER_PX, 0]
const MARKER_V = [0, -TRACK_MARKER_PX, 0, TRACK_MARKER_PX]

/** The ellipse is a 1 sigma position error. */
const SIGMAS = 1

function inkFor(source: TrackEstimate['source']): string {
  return source === 'false' ? TRACK_FALSE_INK : TRACK_ESTIMATE_INK
}

/**
 * The latest track picture at the horizon: an estimated position marker per track
 * and, where the track carries error, its 1 sigma covariance ellipse. A coasting
 * track takes the dash, an updated track draws solid. The ellipse radii are a
 * distance and ride the world transform; the stroke and the marker hold pixel size.
 */
export function TrackLayer({ tracks, horizonS }: Props) {
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  if (horizonS == null) return null
  const latest = latestEstimatesAt(tracks, horizonS)
  if (latest.length === 0) return null

  return (
    <Group listening={false}>
      {latest.map((track) => {
        const ink = inkFor(track.source)
        const ellipse = track.source === 'truth' ? null : positionEllipse(track.covariance, SIGMAS)
        return (
          <Group key={track.id} listening={false}>
            {ellipse && (
              <Ellipse
                x={track.state.x}
                y={track.state.y}
                radiusX={ellipse.semiMajorM}
                radiusY={ellipse.semiMinorM}
                rotation={ellipse.angleDeg}
                stroke={ink}
                strokeWidth={1}
                dash={track.coasting ? TRACK_ELLIPSE_DASH : undefined}
                strokeScaleEnabled={false}
                opacity={0.85}
                listening={false}
              />
            )}
            <Group
              x={track.state.x}
              y={track.state.y}
              scaleX={1 / k}
              scaleY={1 / k}
              listening={false}
            >
              <Line points={MARKER_H} stroke={ink} strokeWidth={1} listening={false} />
              <Line points={MARKER_V} stroke={ink} strokeWidth={1} listening={false} />
            </Group>
          </Group>
        )
      })}
    </Group>
  )
}
