import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SHOW_DELAY_MS = 250
const VIEWPORT_MARGIN_PX = 8
const ANCHOR_GAP_PX = 6

/**
 * Hover tooltip with an optional keyboard-shortcut chip. Wraps a single
 * inline child; the wrapper span is display:contents so .seg flex layouts
 * are unaffected. Renders below the child via a body portal.
 */
export function Tip({
  label,
  shortcut,
  children,
}: {
  label: string
  shortcut?: string
  children: React.ReactNode
}) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | null>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)

  function cancel() {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }

  function hide() {
    cancel()
    setAnchor(null)
  }

  function schedule() {
    cancel()
    timer.current = window.setTimeout(() => {
      // The host span has no box (display: contents); measure the child.
      const el = hostRef.current?.firstElementChild
      if (!el) return
      const r = el.getBoundingClientRect()
      setAnchor({ x: r.left + r.width / 2, y: r.bottom + ANCHOR_GAP_PX })
    }, SHOW_DELAY_MS)
  }

  useEffect(() => cancel, [])

  return (
    <span
      ref={hostRef}
      style={{ display: 'contents' }}
      onMouseEnter={schedule}
      onMouseLeave={hide}
      onMouseDown={hide}
    >
      {children}
      {anchor &&
        createPortal(
          <TipBubble label={label} shortcut={shortcut} x={anchor.x} y={anchor.y} />,
          document.body,
        )}
    </span>
  )
}

function TipBubble({
  label,
  shortcut,
  x,
  y,
}: {
  label: string
  shortcut?: string
  x: number
  y: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [left, setLeft] = useState(-9999)

  // Center on the anchor, clamped to the viewport.
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0
    const max = window.innerWidth - VIEWPORT_MARGIN_PX - w
    setLeft(Math.min(max, Math.max(VIEWPORT_MARGIN_PX, x - w / 2)))
  }, [x, label, shortcut])

  return (
    <div ref={ref} className="tooltip surface-float" style={{ left, top: y }}>
      {label}
      {shortcut && <span className="kbd">{shortcut}</span>}
    </div>
  )
}
