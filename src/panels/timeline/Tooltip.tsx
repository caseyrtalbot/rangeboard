import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { Ref, RefObject } from 'react'
import type { RunTimelineModel } from '../../analysis/runTimeline'
import type { RunTimelineHit } from './hit'
import { tooltipText } from './tooltipText'

/** RunTimeline drives the tooltip through this handle, so a pointer move re-renders only it. */
export interface TooltipHandle {
  /** Shows the item's tooltip near the pointer, strip relative. */
  show(hit: RunTimelineHit, clientX: number, clientY: number): void
  hide(): void
}

/** The mockup's offset from the pointer, px. */
const OFFSET_X = 12
const OFFSET_Y = 14

/** Same model item: the row, mark and span objects are stable per model. */
function sameItem(a: RunTimelineHit | null, b: RunTimelineHit): boolean {
  if (!a || a.row !== b.row) return false
  return a.t === 'mark' ? b.t === 'mark' && a.mark === b.mark : b.t === 'span' && a.span === b.span
}

/** Pointer plus the offset, clamped inside the root box by the tip's own size. */
function placeBox(
  box: HTMLElement | null,
  root: HTMLElement | null,
  point: { x: number; y: number },
): void {
  if (!box || !root) return
  const r = root.getBoundingClientRect()
  const left = Math.max(0, Math.min(point.x - r.left + OFFSET_X, r.width - box.offsetWidth))
  const top = Math.max(0, Math.min(point.y - r.top + OFFSET_Y, r.height - box.offsetHeight))
  box.style.left = `${left}px`
  box.style.top = `${top}px`
}

/**
 * The hover tooltip (SPEC 1.5): exact times, quality and pk, and the horizon
 * (SPEC 1.4). Positioned inside `rootRef` (the `.runtl` root), so the rows'
 * scroll container never clips it. Escape closes it. The hover state lives
 * here: a move over the same item only moves the box, with no render. A new
 * model hides it: the hit holds the old model's row, mark and span objects.
 */
export function Tooltip({
  ref,
  rootRef,
  model,
}: {
  ref: Ref<TooltipHandle>
  rootRef: RefObject<HTMLElement | null>
  /** The model the hits come from; the tooltip reads its horizon. */
  model: RunTimelineModel
}) {
  const [hit, setHit] = useState<RunTimelineHit | null>(null)
  const hitRef = useRef<RunTimelineHit | null>(null)
  const pointRef = useRef({ x: 0, y: 0 })
  const boxRef = useRef<HTMLDivElement | null>(null)
  const modelRef = useRef(model)

  // A re-censored model makes the hit stale, so hide before the paint. The
  // mount keeps its model, so the first run hides nothing.
  useLayoutEffect(() => {
    if (modelRef.current === model) return
    modelRef.current = model
    hitRef.current = null
    setHit(null)
  }, [model])

  useImperativeHandle(
    ref,
    () => ({
      show(next, clientX, clientY) {
        pointRef.current = { x: clientX, y: clientY }
        if (sameItem(hitRef.current, next)) {
          placeBox(boxRef.current, rootRef.current, pointRef.current)
          return
        }
        hitRef.current = next
        setHit(next)
      },
      hide() {
        if (!hitRef.current) return
        hitRef.current = null
        setHit(null)
      },
    }),
    // Refs only, so the handle stays stable.
    [rootRef],
  )

  // A new item changes the box size, so place it after the render.
  useLayoutEffect(() => {
    if (hit) placeBox(boxRef.current, rootRef.current, pointRef.current)
  })

  useEffect(() => {
    if (!hit) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      hitRef.current = null
      setHit(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hit])

  if (!hit) return null
  const text = tooltipText(hit, model.horizonS)
  return (
    <div ref={boxRef} className="runtl-tip" role="tooltip">
      <div>
        <b>{text.title}</b> {text.subject}
      </div>
      {text.notes.map((note, i) => (
        <div key={`n${i}`}>{note}</div>
      ))}
      <div className="runtl-tip-data">{text.data.join(' · ')}</div>
      <div className="runtl-tip-horizon">{text.horizon}</div>
    </div>
  )
}
