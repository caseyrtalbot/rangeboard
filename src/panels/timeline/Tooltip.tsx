import { useImperativeHandle, type Ref, type RefObject } from 'react'
import type { RunTimelineHit } from './hit'

// Contract stub (timeline/p3). Lane 3B replaces the body; the props and handle hold.

/** RunTimeline drives the tooltip through this handle, so a pointer move re-renders only it. */
export interface TooltipHandle {
  /** Shows the item's tooltip near the pointer, strip relative. */
  show(hit: RunTimelineHit, clientX: number, clientY: number): void
  hide(): void
}

const STUB: TooltipHandle = { show: () => {}, hide: () => {} }

/**
 * The hover tooltip (SPEC 1.5): exact times, quality and pk, and the horizon
 * (SPEC 1.4). Positioned inside `rootRef` (the `.runtl` root), so the rows'
 * scroll container never clips it. Escape closes it.
 */
export function Tooltip({
  ref,
}: {
  ref: Ref<TooltipHandle>
  rootRef: RefObject<HTMLElement | null>
  /** `model.horizonS`; -Infinity when nothing is observed. */
  horizonS: number
}) {
  useImperativeHandle(ref, () => STUB, [])
  return null
}
