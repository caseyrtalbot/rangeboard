/**
 * The entity under the pointer and the element whose cursor it set. A deleted entity
 * gets no mouseleave, so its node clears the cursor when it leaves the scene.
 */
let hovered: { id: string; el: HTMLElement } | null = null

/** Sets the pointer cursor on enter and clears it on leave. */
export function hoverCursor(id: string, el: HTMLElement, on: boolean): void {
  el.style.cursor = on ? 'pointer' : ''
  hovered = on ? { id, el } : null
}

/** Clears the cursor if `id` is the hovered entity. Call when its node unmounts. */
export function releaseHover(id: string): void {
  if (hovered?.id !== id) return
  hovered.el.style.cursor = ''
  hovered = null
}
