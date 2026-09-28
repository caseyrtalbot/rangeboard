import { useEffect, useRef, type RefObject } from 'react'
import { zoomViewport, type TimeViewport } from '../../charts/timeViewport'
import { useStore } from '../../state/store'
import { shownViewport } from './useShownT0'
import { anchorTime, panBy, wheelPx, wheelZoom } from './viewportActions'

/** What a gesture reads at event time. */
export interface GestureView {
  /** The clamped stored viewport; a gesture that turns Follow off starts from `shownViewport`. */
  base: TimeViewport
  follow: boolean
  durationS: number
  /** The plot column width, px. */
  widthPx: number
}

/** WebKit's trackpad pinch event; not in the DOM lib. */
interface GestureEvent extends UIEvent {
  scale: number
  clientX: number
}

/** One attached scroll container and how to detach from it. */
interface Bound {
  el: HTMLElement
  off: () => void
}

function bind(
  el: HTMLElement,
  plotRef: RefObject<HTMLElement | null>,
  viewRef: RefObject<GestureView>,
): () => void {
  // The run time under clientX over the plot column, whose left edge is t0S.
  const anchorAt = (shown: TimeViewport, clientX: number, widthPx: number) => {
    const plot = plotRef.current
    const left = plot ? plot.getBoundingClientRect().left : 0
    return anchorTime(shown, clientX - left, widthPx)
  }

  const onWheel = (e: WheelEvent) => {
    const { base, follow, durationS, widthPx } = viewRef.current
    if (!(widthPx > 0) || !(durationS > 0)) return
    const dx = wheelPx(e.deltaX, e.deltaMode, widthPx)
    const dy = wheelPx(e.deltaY, e.deltaMode, el.clientHeight)
    const shown = shownViewport(base, follow, durationS)
    if (e.ctrlKey || e.metaKey) {
      // Chromium and Firefox deliver a trackpad pinch as a Ctrl wheel too.
      e.preventDefault()
      const v = wheelZoom(shown, dy, anchorAt(shown, e.clientX, widthPx), durationS)
      useStore.getState().setRunTimelineViewport(v)
    } else if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault()
      useStore.getState().setRunTimelineViewport(panBy(shown, dx, widthPx, durationS), false)
    }
    // A vertical wheel scrolls the rows natively.
  }

  // WebKit pinch: each change zooms by the ratio of the scale to the last one.
  let lastScale = 1
  const onGestureStart = (e: Event) => {
    e.preventDefault()
    lastScale = (e as GestureEvent).scale || 1
  }
  const onGestureChange = (e: Event) => {
    e.preventDefault()
    const g = e as GestureEvent
    const { base, follow, durationS, widthPx } = viewRef.current
    if (!(g.scale > 0) || !(widthPx > 0) || !(durationS > 0)) return
    const factor = lastScale / g.scale
    lastScale = g.scale
    const shown = shownViewport(base, follow, durationS)
    const v = zoomViewport(shown, factor, anchorAt(shown, g.clientX, widthPx), durationS)
    useStore.getState().setRunTimelineViewport(v)
  }
  const onGestureEnd = (e: Event) => e.preventDefault()

  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('gesturestart', onGestureStart)
  el.addEventListener('gesturechange', onGestureChange)
  el.addEventListener('gestureend', onGestureEnd)
  return () => {
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('gesturestart', onGestureStart)
    el.removeEventListener('gesturechange', onGestureChange)
    el.removeEventListener('gestureend', onGestureEnd)
  }
}

/**
 * Wheel and pinch on the rows' scroll container (SPEC 1.3): Ctrl or Meta wheel
 * and pinch zoom about the cursor time; a horizontal wheel pans and turns
 * Follow off; a vertical wheel scrolls the rows. `plotRef` is the plot column,
 * whose left edge is time `t0S`. React's `onWheel` is passive, so a native
 * listener takes the wheel; it reads the latest view through a ref and binds
 * again only when the scroll container changes.
 */
export function useViewportGestures(
  scrollRef: RefObject<HTMLElement | null>,
  plotRef: RefObject<HTMLElement | null>,
  view: GestureView,
): void {
  const viewRef = useRef(view)
  const bound = useRef<Bound | null>(null)
  useEffect(() => {
    viewRef.current = view
    const el = scrollRef.current
    if (bound.current?.el === el) return
    bound.current?.off()
    bound.current = el ? { el, off: bind(el, plotRef, viewRef) } : null
  })
  useEffect(
    () => () => {
      bound.current?.off()
      bound.current = null
    },
    [],
  )
}
