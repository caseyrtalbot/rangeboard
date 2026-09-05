import { useEffect, useState } from 'react'
import { useStore } from '../state/store'

/**
 * Wall-clock period between store publications of `playback.simTimeS`, ms.
 * The store publishes at 10 Hz at every playback speed; engine DT and the
 * event horizons are untouched (F1, design contract section 7).
 */
export const PUBLISH_PERIOD_MS = 100

/**
 * The cadence decision for one animation frame of the `TimelineBar` loop.
 * `sinceMs` is the wall time since the last publication. Returns the sim time
 * to publish, or null while the period has not elapsed. The step is the
 * measured wall time at playback speed, never a nominal 0.1 s, so the clock
 * does not drift.
 */
export function nextPublishedTimeS(
  simTimeS: number,
  speedMult: number,
  sinceMs: number,
): number | null {
  if (sinceMs < PUBLISH_PERIOD_MS) return null
  return simTimeS + (sinceMs / 1000) * speedMult
}

/**
 * Display time for one canvas frame: the last published sim time plus the
 * wall time since that publication at playback speed, clamped to one
 * publication period ahead and to the run duration. It never runs ahead of
 * the observed horizon by more than the current period.
 */
export function displayTimeAt(
  publishedS: number,
  sinceMs: number,
  speedMult: number,
  durationS: number,
): number {
  const aheadS = (Math.min(Math.max(0, sinceMs), PUBLISH_PERIOD_MS) / 1000) * speedMult
  return Math.min(publishedS + aheadS, durationS)
}

/** The display time the mounted clock last published, or the store time when none is mounted. */
let currentDisplayTimeS: number | null = null

/**
 * The display time the canvas is drawing right now. Pointer gestures that test
 * drawn positions (box select) read this, so they see the same instant the user sees.
 */
export function displayTimeNow(): number {
  return currentDisplayTimeS ?? useStore.getState().playback.simTimeS
}

/** The two clocks the canvas draws from. */
interface FrameClock {
  /** The last published `playback.simTimeS`. Snapped consumers read this. */
  simTimeS: number
  /** The interpolated time for this frame. Moving consumers read this. */
  displayTimeS: number
}

/**
 * The canvas frame clock. While playback runs, a requestAnimationFrame loop
 * advances the display time between publications; paused, scrubbed, complete
 * or ready, the display time equals the published time. The clock reads the
 * store through `subscribe` and `getState`, not through a selector, so a
 * publication commits nothing here until the next frame: the Konva root
 * commits once per frame, never twice per publication. The wall timestamp and
 * the speed of the last publication live in this closure, not in the store;
 * the speed is captured per publication, so a speed change mid-run cannot move
 * the display backward before the loop has published the span at the old speed.
 * Mount it in a component under the Konva `Stage`, so its frame updates never
 * reach react-dom.
 */
export function useFrameClock(durationS: number): FrameClock {
  const [clock, setClock] = useState<FrameClock>(() => {
    const t = useStore.getState().playback.simTimeS
    return { simTimeS: t, displayTimeS: t }
  })

  useEffect(() => {
    const initial = useStore.getState().playback
    let publishedS = initial.simTimeS
    let publishedAt = performance.now()
    let speed = initial.speedMult
    let playing = initial.playing
    let raf = 0

    const publish = (simTimeS: number, displayTimeS: number) => {
      currentDisplayTimeS = displayTimeS
      setClock((prev) =>
        prev.simTimeS === simTimeS && prev.displayTimeS === displayTimeS
          ? prev
          : { simTimeS, displayTimeS },
      )
    }

    const frame = () => {
      raf = 0
      if (!playing) return
      const sinceMs = performance.now() - publishedAt
      publish(publishedS, displayTimeAt(publishedS, sinceMs, speed, durationS))
      raf = requestAnimationFrame(frame)
    }

    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.playback === prev.playback) return
      if (s.playback.simTimeS !== publishedS) {
        publishedS = s.playback.simTimeS
        publishedAt = performance.now()
        speed = s.playback.speedMult
      }
      // Resume re-anchors the wall clock: the pause interval is not playback time.
      if (s.playback.playing && !playing) {
        publishedAt = performance.now()
        speed = s.playback.speedMult
      }
      playing = s.playback.playing
      if (playing) {
        if (!raf) raf = requestAnimationFrame(frame)
        return
      }
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      publish(publishedS, publishedS)
    })

    publish(publishedS, publishedS)
    if (playing) raf = requestAnimationFrame(frame)
    return () => {
      unsubscribe()
      if (raf) cancelAnimationFrame(raf)
      currentDisplayTimeS = null
    }
  }, [durationS])

  return clock
}
