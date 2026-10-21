import { selectEffectiveLayers } from '../../state/selectors'
import { Circle, Group, Line } from 'react-konva'
import { useStore } from '../../state/store'
import { bearingDeg, dist } from '../../geometry/geo'
import { useBoardInk } from '../useBoardInk'
import type { ShotInFlight } from '../../playback/trackState'

interface Props {
  /** Salvos in flight at the display time. Queried once in LiveScene. */
  shots: ShotInFlight[]
  /** The canvas frame clock's display time. It gates the release; nothing blinks. */
  displayTimeS: number
}

/** Screen px trimmed off the effector glyph and off the target ring. */
const TRIM_SOURCE = 13
const TRIM_TARGET = 15

/** Travelling round, screen px: the primer's round, nose on -y, turned with the flight line. */
const ROUND = [0, -6, 4.5, 4.5, -4.5, 4.5]
/** Seeker circle radius around a self-guided round, screen px. */
const SEEKER_R = 9
/** Fixed dash arrays: an inline literal is re-set on every render. */
/** Jam beam: the EW ink, dashed. */
const JAM_DASH = [2, 4]
/** Lock line once the round guides itself: dotted, because the launcher no longer guides it. */
const SEEKER_DASH = [1, 4]

/**
 * Salvos between launch and effect. Line style carries the state and hue carries who
 * owns the effect: a white lock line with a round in the friend hue for a shot, a
 * dashed EW-ink beam for a jam, a solid white line for a DE beam. A round in flight is
 * never removed early.
 */
export function EngagementLayer({ shots, displayTimeS }: Props) {
  const show = useStore((s) => selectEffectiveLayers(s).engagements)
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  const ink = useBoardInk()
  if (!show) return null

  return (
    <Group listening={false}>
      {shots.map((s) => {
        if (displayTimeS < s.tReleaseS) return null
        if (s.mode !== 'beam' && s.tEffectS <= s.tReleaseS) return null
        const d = dist(s.from, s.to)
        if (d < 1) return null
        // Trim both ends, so the line never runs through the glyph or the target ring.
        const ux = (s.to.x - s.from.x) / d
        const uy = (s.to.y - s.from.y) / d
        const head = Math.min(TRIM_SOURCE / k, d / 3)
        const tail = Math.min(TRIM_TARGET / k, d / 3)
        const ax = s.from.x + ux * head
        const ay = s.from.y + uy * head
        const bx = s.to.x - ux * tail
        const by = s.to.y - uy * tail
        // No array index: liveShots drops expired salvos off the front.
        const key = `${s.effectorId}-${s.uasId}-${s.shipIdx}-${s.tS}`

        if (s.mode === 'beam') {
          const jam = s.channel === 'jam'
          return (
            <Line
              key={key}
              name="beam"
              points={[ax, ay, bx, by]}
              stroke={jam ? ink.ew : ink.selection}
              strokeWidth={jam ? 1.4 : 1.6}
              dash={jam ? JAM_DASH : undefined}
              strokeScaleEnabled={false}
            />
          )
        }

        const rx = ax + (bx - ax) * s.progress
        const ry = ay + (by - ay) * s.progress
        const seeking = s.mode === 'active'
        return (
          <Group key={key}>
            <Line
              name="lock"
              points={[ax, ay, bx, by]}
              stroke={ink.selection}
              strokeWidth={1}
              dash={seeking ? SEEKER_DASH : undefined}
              lineCap={seeking ? 'round' : undefined}
              opacity={seeking ? 0.35 : 0.7}
              strokeScaleEnabled={false}
            />
            <Group x={rx} y={ry} scaleX={1 / k} scaleY={1 / k}>
              {seeking && s.progress > 0.15 && (
                <Circle radius={SEEKER_R} stroke={ink.friend} strokeWidth={1} opacity={0.85} />
              )}
              <Line
                name="round"
                points={ROUND}
                closed
                fill={ink.friend}
                rotation={bearingDeg(s.from, s.to)}
              />
            </Group>
          </Group>
        )
      })}
    </Group>
  )
}
