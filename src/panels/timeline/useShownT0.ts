import { PUBLISH_PERIOD_MS } from '../../canvas/frameClock'
import { followViewport, type TimeViewport } from '../../charts/timeViewport'
import { selectSimTimeS } from '../../state/selectors'
import { useStore } from '../../state/store'

/**
 * One publication period, linear. The pan wrapper, the playhead, the axis ticks
 * and the overview window all use it, so they move in step between publications.
 * Each gliding element is keyed by its scale: a width or zoom change remounts
 * it, so only a pan at a fixed scale glides.
 */
export const GLIDE = `transform ${PUBLISH_PERIOD_MS}ms linear`

/**
 * The shown viewport start. With Follow on it tracks the clock, so only the
 * caller re-renders on a publication: the axis, the overview window and the
 * plot's pan wrapper. The selector returns a number, a stable snapshot.
 * `base` is clamped; Follow keeps its width.
 */
export function useShownT0(base: TimeViewport, follow: boolean, durationS: number): number {
  return useStore((s) =>
    follow ? followViewport(base, selectSimTimeS(s), durationS).t0S : base.t0S,
  )
}
