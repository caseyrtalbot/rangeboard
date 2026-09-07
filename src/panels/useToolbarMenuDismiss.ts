import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'

interface ToolbarMenuDismissOptions {
  open: boolean
  wrapRef: RefObject<HTMLDivElement | null>
  buttonRef: RefObject<HTMLButtonElement | null>
  setOpen: Dispatch<SetStateAction<boolean>>
}

/**
 * Shared dismiss behavior for toolbar menu surfaces.
 * Escape runs in capture phase so it closes only the menu, not global shortcuts.
 */
export function useToolbarMenuDismiss({
  open,
  wrapRef,
  buttonRef,
  setOpen,
}: ToolbarMenuDismissOptions) {
  useEffect(() => {
    if (!open) return
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (document.querySelector('.cmdk-panel')) return
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, wrapRef, buttonRef, setOpen])
}
