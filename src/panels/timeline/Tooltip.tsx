import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { Ref, RefObject } from 'react'
import type { RunTimelineModel } from '../../analysis/runTimeline'
import type { RunTimelineHit } from './hit'
import { liveHit, tooltipText, type HeldHit } from './tooltipText'

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

/** The tooltip lines for one item (SPEC 1.4, 1.5): kind, subject, notes, data and horizon. */
export function TipBody({ hit, horizonS }: { hit: RunTimelineHit; horizonS: number }) {
  const text = tooltipText(hit, horizonS)
  return (
    <>
      <div>
        <b>{text.title}</b> {text.subject}
      </div>
      {text.notes.map((note, i) => (
        <div key={`n${i}`}>{note}</div>
      ))}
      <div className="runtl-tip-data">{text.data.join(' · ')}</div>
      <div className="runtl-tip-horizon">{text.horizon}</div>
    </>
  )
}

/**
 * The hover tooltip (SPEC 1.5): exact times, quality and pk, and the horizon
 * (SPEC 1.4). Positioned inside `rootRef` (the `.runtl` root), so the rows'
 * scroll container never clips it. The hover state lives here: a move over the
 * same item only moves the box, with no render. The state holds the hit with
 * its model, and a new model shows nothing (`liveHit`): the hit holds the old
 * model's row, mark and span objects. Escape closes the tip before App's board
 * Escape sees the key, and the closed item stays closed until the pointer
 * leaves it or moves to another item.
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
  const [held, setHeld] = useState<HeldHit | null>(null)
  const heldRef = useRef<HeldHit | null>(null)
  // The item Escape closed; a move over it does not reopen the tip.
  const dismissedRef = useRef<RunTimelineHit | null>(null)
  const pointRef = useRef({ x: 0, y: 0 })
  const boxRef = useRef<HTMLDivElement | null>(null)
  const hit = liveHit(held, model)

  useImperativeHandle(
    ref,
    () => ({
      show(next, clientX, clientY) {
        pointRef.current = { x: clientX, y: clientY }
        if (sameItem(dismissedRef.current, next)) return
        dismissedRef.current = null
        const cur = heldRef.current
        if (cur && cur.model === model && sameItem(cur.hit, next)) {
          placeBox(boxRef.current, rootRef.current, pointRef.current)
          return
        }
        const nextHeld = { hit: next, model }
        heldRef.current = nextHeld
        setHeld(nextHeld)
      },
      hide() {
        dismissedRef.current = null
        if (!heldRef.current) return
        heldRef.current = null
        setHeld(null)
      },
    }),
    // A new model makes a new handle; RunTimeline reads it through its ref.
    [rootRef, model],
  )

  // A new item changes the box size, so place it after the render.
  useLayoutEffect(() => {
    if (hit) placeBox(boxRef.current, rootRef.current, pointRef.current)
  })

  // Capture phase, so the tip closes before App's window Escape clears the selection.
  useEffect(() => {
    if (!hit) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !heldRef.current) return
      e.stopPropagation()
      dismissedRef.current = heldRef.current.hit
      heldRef.current = null
      setHeld(null)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [hit])

  if (!hit) return null
  return (
    <div ref={boxRef} className="runtl-tip" role="tooltip">
      <TipBody hit={hit} horizonS={model.horizonS} />
    </div>
  )
}
