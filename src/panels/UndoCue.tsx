import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { actionBeforeMount, lastUndoableAction } from '../state/lastAction'

/**
 * The floating status over the canvas bottom left after a delete or a place:
 * "Deleted KuRFS 1 · Undo ⌘Z". It fades out by 4 s. Undo, redo and a scenario load
 * clear it. It takes no pointer events. Loaded lazily to keep it out of the entry
 * chunk; an edit made before the chunk loaded shows on mount, a redo does not.
 */
export function UndoCue() {
  const [cue, setCue] = useState<{ text: string; n: number } | null>(null)
  useEffect(() => {
    let n = 0
    let timer = 0
    const show = (text: string | null) => {
      clearTimeout(timer)
      timer = window.setTimeout(setCue, 4000, null)
      setCue(text ? { text, n: ++n } : null)
    }
    const early = actionBeforeMount(useStore.getState())
    if (early) show(early)
    const off = useStore.subscribe((s, prev) => {
      if (s.past !== prev.past) show(lastUndoableAction(s, prev))
    })
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [])
  return (
    cue && (
      <div key={cue.n} className="undo-cue surface-float" role="status">
        <span>{cue.text}</span> · Undo ⌘Z
      </div>
    )
  )
}
