import { useEffect, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'

/**
 * Open state and the dismissal rules shared by the toolbar dropdowns: a pointer
 * outside the wrapper closes, and Escape closes and restores focus to the
 * trigger. Capture phase keeps Escape from also reaching the global canvas
 * shortcut. The command palette can open over these surfaces, and then it owns
 * Escape. Opening moves focus into the panel, so the keyboard lands there.
 */
export function usePopover(
  wrapRef: RefObject<HTMLElement | null>,
  buttonRef: RefObject<HTMLElement | null>,
): { open: boolean; setOpen: Dispatch<SetStateAction<boolean>>; toggle: () => void } {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const dialog = wrapRef.current?.querySelector<HTMLElement>('[role="dialog"]')
    dialog?.querySelector<HTMLElement>('button, input, select, [tabindex="0"]')?.focus()
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (document.querySelector('.cmdk-panel')) return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, wrapRef, buttonRef])

  return { open, setOpen, toggle: () => setOpen((value) => !value) }
}
