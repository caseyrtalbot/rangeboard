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
 * The pan, the axis ticks and the overview window glide only while Follow
 * moves them. With Follow off only a gesture moves them (a wheel pan or an
 * overview drag), and a gesture renders at once. The playhead always glides.
 */
export function panGlide(follow: boolean): string {
  return follow ? GLIDE : 'none'
}

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

/**
 * The viewport on screen now, for an event handler: the Follow viewport at the
 * clock, or `base`. It reads the store once and subscribes to nothing. A
 * gesture that turns Follow off starts from it, so the view does not jump.
 */
export function shownViewport(
  base: TimeViewport,
  follow: boolean,
  durationS: number,
): TimeViewport {
  return follow ? followViewport(base, selectSimTimeS(useStore.getState()), durationS) : base
}
