/**
 * True when the event target is a text field that keeps its own keys: an input, a
 * textarea, a select or contenteditable. Imports no store (see ui/kit), and answers
 * false where the DOM classes are absent (Node render tests).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}
