import { useLayoutEffect, useMemo, useSyncExternalStore, type RefObject } from 'react'
import { lineWindow, type Placed } from './layout'

/** The rows' scroll view: its scroll offset and height, px. */
export interface ScrollView {
  topPx: number
  heightPx: number
}

/**
 * The rows' scroll view as a small external store. RunTimeline owns one and
 * binds it to `.runtl-scroll`; only the components that read it (the gutter,
 * the grounds and the rows) re-render on a scroll, not the root, the pan
 * wrapper, the axis or the overview.
 */
export interface RowView {
  get: () => ScrollView
  subscribe: (listener: () => void) => () => void
  set: (view: ScrollView) => void
}

/**
 * Until the scroll element is measured the view is unbounded, so every line
 * draws: the first render after a mount, and a render with no DOM (the
 * static tests). The measure runs before the first paint.
 */
const UNMEASURED: ScrollView = { topPx: 0, heightPx: Infinity }

export function createRowView(initial: ScrollView = UNMEASURED): RowView {
  let view = initial
  const listeners = new Set<() => void>()
  return {
    get: () => view,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: (next) => {
      if (next.topPx === view.topPx && next.heightPx === view.heightPx) return
      view = next
      for (const listener of listeners) listener()
    },
  }
}

/**
 * Binds `view` to the scroll element: a measure before the first paint, one
 * update per animation frame while it scrolls, and a `ResizeObserver` for a
 * height change (the resizer, a window resize). `active` remounts the binding
 * when the scroll element appears.
 */
export function useBindRowView(
  scrollRef: RefObject<HTMLElement | null>,
  view: RowView,
  active: boolean,
): void {
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const read = () => view.set({ topPx: el.scrollTop, heightPx: el.clientHeight })
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        read()
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    read()
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [scrollRef, view, active])
}

/** The lines to draw for the current scroll view (`lineWindow`), a slice of `lines`. */
export function useWindowedLines(lines: Placed[], view: RowView): Placed[] {
  const { topPx, heightPx } = useSyncExternalStore(view.subscribe, view.get, view.get)
  const { first, last } = lineWindow(lines, topPx, heightPx)
  return useMemo(
    () => (first === 0 && last === lines.length ? lines : lines.slice(first, last)),
    [lines, first, last],
  )
}
