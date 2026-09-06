import { Circle, Group, Line } from 'react-konva'
import { useStore } from '../../state/store'
import { bearingDeg, dist } from '../../geometry/geo'
import { DANGER_INK } from '../../ui/ink'
import { blinkOn, EW_JAM_COLOR } from '../../playback/trackState'
import type { ShotInFlight } from '../../playback/trackState'

interface Props {
  /** Salvos in flight at the display time. Queried once in LiveScene. */
  shots: ShotInFlight[]
  /**
   * The canvas frame clock's display time. Drives the beam blink; a paused run
   * freezes it.
   */
  displayTimeS: number
}

const JAM = EW_JAM_COLOR

/** Screen px trimmed off the effector glyph and off the target ring. */
const TRIM_SOURCE = 13
const TRIM_TARGET = 15

/** Travelling round, screen px. The nose sits on -y and turns with the flight line. */
const ROUND = [0, -8, 6, 6, -6, 6]
/** Fixed dash array: an inline literal is re-set on every render. */
const BEAM_DASH = [2, 4]

/**
 * Salvos between launch and effect: the shot line plus a round riding it. A
 * round in flight is never removed early, so a salvo at a track that already
 * turned ghost still draws to completion.
 */
export function EngagementLayer({ shots, displayTimeS }: Props) {
  const show = useStore((s) => s.ui.layers.engagements)
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  if (!show) return null
  const lit = blinkOn(displayTimeS)

  return (
    <Group listening={false}>
      {shots.map((s) => {
        const d = dist(s.from, s.to)
        if (d < 1) return null
        // Trim both ends the way ConnectionLayer trims its arrows, so the line
        // never runs through the effector glyph or the target ring.
        const ux = (s.to.x - s.from.x) / d
        const uy = (s.to.y - s.from.y) / d
        const head = Math.min(TRIM_SOURCE / k, d / 3)
        const tail = Math.min(TRIM_TARGET / k, d / 3)
        const ax = s.from.x + ux * head
        const ay = s.from.y + uy * head
        const bx = s.to.x - ux * tail
        const by = s.to.y - uy * tail
        const color = s.channel === 'jam' ? JAM : DANGER_INK
        // No array index: liveShots drops expired salvos off the front, so an
        // index key would rebuild every surviving Konva node during a volley.
        const key = `${s.effectorId}-${s.uasId}-${s.shipIdx}-${s.tS}`

        if (s.mode === 'beam') {
          return (
            <Line
              key={key}
              points={[ax, ay, bx, by]}
              stroke={color}
              strokeWidth={1.4}
              dash={BEAM_DASH}
              opacity={lit ? 0.9 : 0.32}
              strokeScaleEnabled={false}
            />
          )
        }

        const rx = ax + (bx - ax) * s.progress
        const ry = ay + (by - ay) * s.progress
        return (
          <Group key={key}>
            <Line
              points={[ax, ay, bx, by]}
              stroke={color}
              strokeWidth={1}
              opacity={s.mode === 'semi-active' ? 0.7 : 0.3}
              strokeScaleEnabled={false}
            />
            <Group x={rx} y={ry} scaleX={1 / k} scaleY={1 / k}>
              {s.mode === 'active' && s.progress > 0.15 && (
                <Circle radius={11} stroke={color} strokeWidth={1} opacity={0.85} />
              )}
              <Line points={ROUND} closed fill={color} rotation={bearingDeg(s.from, s.to)} />
            </Group>
          </Group>
        )
      })}
    </Group>
  )
}
