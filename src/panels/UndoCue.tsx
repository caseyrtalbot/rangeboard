import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { lastUndoableAction } from '../state/lastAction'

/**
 * The timeline status line after a delete or a place: "Deleted KuRFS 1 · Undo ⌘Z".
 * It fades out by 4 s. Undo, redo and a scenario load clear it. Loaded lazily to
 * keep it out of the entry chunk.
 */
export function UndoCue() {
  const [cue, setCue] = useState<{ text: string; n: number } | null>(null)
  useEffect(() => {
    let n = 0
    let timer = 0
    const off = useStore.subscribe((s, prev) => {
      if (s.past === prev.past) return
      const text = lastUndoableAction(s, prev)
      clearTimeout(timer)
      timer = window.setTimeout(setCue, 4000, null)
      setCue(text ? { text, n: ++n } : null)
    })
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [])
  return (
    cue && (
      <span key={cue.n} className="undo-cue" role="status">
        <span>{cue.text}</span> · Undo ⌘Z
      </span>
    )
  )
}
