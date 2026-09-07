/**
 * The one arrow-key mapping for a roving-tabindex group: the caller keeps its
 * own `preventDefault`, state change and focus move. Returns -1 for any key the
 * group does not own, so the caller can return without touching the event.
 */
export function nextTabIndex(key: string, index: number, length: number): number {
  if (key === 'ArrowRight') return (index + 1) % length
  if (key === 'ArrowLeft') return (index - 1 + length) % length
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  return -1
}
