import { useMemo } from 'react'
import { Group, Line } from 'react-konva'
import { useStore } from '../../state/store'
import { latestEstimatesAt } from '../../playback/trackEstimateView'
import type { TrackEstimate } from '../../playback/trackTypes'
import { useBoardInk } from '../useBoardInk'

interface Props {
  /** Estimates the trial captured, oldest first. Undefined on a run that captured none. */
  tracks: readonly TrackEstimate[] | undefined
  /** Bounded observation horizon, seconds. Null before a trial observation. */
  horizonS: number | null
  /**
   * Sweep step of the trial, seconds. An estimate older than one step at the
   * horizon is a dropped track and draws no line. Undefined pairs the latest
   * entry per track whatever its age.
   */
  stepS?: number
}

/** Screen px trimmed off the sensor glyph and off the track marker. */
const TRIM_SENSOR = 13
const TRIM_TRACK = 14
/** A coasting hold: the even dash, distinct from every ring dash. */
const COAST_DASH = [4, 4]
const LINE_OPACITY = 0.55

/**
 * Pairing lines from each sensor to the tracks it holds, the 2525D line between
 * two object centres. A hold draws solid, a coast dashed, and a sensor that holds
 * nothing draws no line. A false track still takes its line, because the sensor
 * holds it. The picture is censored at the observed horizon like every other
 * trial surface; the line ends ride the world transform and the trims hold
 * pixel size.
 */
export function PairingLineLayer({ tracks, horizonS, stepS }: Props) {
  const entities = useStore((s) => s.scenario.entities)
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  const ink = useBoardInk()
  // A zoom re-renders the layer; the picture only changes with the horizon.
  const latest = useMemo(() => {
    if (horizonS == null) return []
    const picture = latestEstimatesAt(tracks, horizonS)
    // A killed or dropped track has no entry after its last step: its line goes with it.
    return stepS == null
      ? picture
      : picture.filter((track) => horizonS - track.state.tS <= stepS + 1e-9)
  }, [tracks, horizonS, stepS])
  if (latest.length === 0) return null

  return (
    <Group listening={false}>
      {latest.map((track) =>
        track.sensorIds.map((sensorId) => {
          const sensor = entities.find((e) => e.id === sensorId)
          if (!sensor) return null
          const dx = track.state.x - sensor.pos.x
          const dy = track.state.y - sensor.pos.y
          const d = Math.hypot(dx, dy)
          if (d < 1) return null
          // Trim both ends, so the line never runs through the glyph or the marker.
          const ux = dx / d
          const uy = dy / d
          const head = Math.min(TRIM_SENSOR / k, d / 3)
          const tail = Math.min(TRIM_TRACK / k, d / 3)
          return (
            <Line
              key={`${sensorId}-${track.id}`}
              points={[
                sensor.pos.x + ux * head,
                sensor.pos.y + uy * head,
                track.state.x - ux * tail,
                track.state.y - uy * tail,
              ]}
              stroke={ink.friend}
              strokeWidth={1}
              dash={track.coasting ? COAST_DASH : undefined}
              opacity={LINE_OPACITY}
              strokeScaleEnabled={false}
              listening={false}
            />
          )
        }),
      )}
    </Group>
  )
}
