import { followViewport, type TimeViewport } from '../../charts/timeViewport'
import { selectSimTimeS } from '../../state/selectors'
import { useStore } from '../../state/store'

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
