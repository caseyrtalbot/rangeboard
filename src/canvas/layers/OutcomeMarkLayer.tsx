import { useMemo } from 'react'
import { Circle, Group, Line, Text } from 'react-konva'
import type { TrialResultView } from '../../analysis/trialResult'
import type { Vec2 } from '../../model/types'
import { formatTime } from '../../geometry/geo'
import { trialMemberStatesAt } from '../../playback/trialTrackState'
import { useStore } from '../../state/store'
import { LABEL_HALO_PX } from '../labelLayout'
import { useBoardInk } from '../useBoardInk'

interface Props {
  trial: TrialResultView | null
  /** Bounded observation horizon, seconds. Null before a trial observation. */
  horizonS: number | null
}

/** One intercept that landed: where, when and whether it killed. */
interface OutcomeMark {
  key: string
  kind: 'kill' | 'miss'
  tEffectS: number
  position: Vec2
}

/** Kill cross arms and the miss circle, screen px. */
const CROSS_DOWN = [-4, -4, 4, 4]
const CROSS_UP = [-4, 4, 4, -4]
const MISS_R = 4
/** The time label sits right of the mark. */
const LABEL_X = 9
const LABEL_Y = -5
const LABEL_FONT_PX = 9

/**
 * Every kinetic or directed-energy effect the trial recorded, at the position
 * the target held when the effect landed. A jam dwell and a soft kill draw
 * nothing: the primer has no mark for them. Computed once per trial, because
 * the member timeline samples a position for an arbitrary time.
 */
function outcomeMarks(trial: TrialResultView): OutcomeMark[] {
  const marks: OutcomeMark[] = []
  trial.attrition.events.forEach((event, index) => {
    if (event.channel !== 'kill' || event.softShot) return
    const member = trialMemberStatesAt(trial, event.uasId, event.tEffectS)[event.shipIdx]
    if (!member) return
    marks.push({
      key: `${event.effectorId}-${event.uasId}-${event.shipIdx}-${index}`,
      kind: event.killDelta === 1 ? 'kill' : 'miss',
      tEffectS: event.tEffectS,
      position: member.position,
    })
  })
  return marks
}

/**
 * Intercept marks: a small white cross where a hard kill landed and an open
 * white circle where an effect landed and did not kill, each with the run time.
 * A mark stays on the board after its effect, and nothing draws past the
 * observed horizon. The marks hold pixel size under the camera.
 */
export function OutcomeMarkLayer({ trial, horizonS }: Props) {
  // Only the scale is read; the stage transform carries the pan.
  const k = useStore((s) => s.camera.scale)
  const ink = useBoardInk()
  const marks = useMemo(() => (trial ? outcomeMarks(trial) : []), [trial])
  const shown = useMemo(
    () => (horizonS == null ? [] : marks.filter((mark) => mark.tEffectS <= horizonS)),
    [marks, horizonS],
  )
  if (shown.length === 0) return null

  return (
    <Group listening={false}>
      {shown.map((mark) => (
        <Group
          key={mark.key}
          x={mark.position.x}
          y={mark.position.y}
          scaleX={1 / k}
          scaleY={1 / k}
          listening={false}
        >
          {mark.kind === 'kill' ? (
            <>
              <Line points={CROSS_DOWN} stroke={ink.selection} strokeWidth={1.5} />
              <Line points={CROSS_UP} stroke={ink.selection} strokeWidth={1.5} />
            </>
          ) : (
            <Circle radius={MISS_R} stroke={ink.selection} strokeWidth={1.3} />
          )}
          <Text
            fontFamily="JetBrains Mono"
            x={LABEL_X}
            y={LABEL_Y}
            text={`${mark.kind === 'kill' ? 'K' : 'M'} ${formatTime(mark.tEffectS)}`}
            fontSize={LABEL_FONT_PX}
            fill={ink.label}
            // The same glyph halo as a board label, so a path under the time stays legible.
            stroke={ink.board}
            strokeWidth={LABEL_HALO_PX}
            lineJoin="round"
            fillAfterStrokeEnabled
            wrap="none"
          />
        </Group>
      ))}
    </Group>
  )
}
