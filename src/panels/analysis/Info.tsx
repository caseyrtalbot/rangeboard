import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_MARGIN_PX = 8
const ANCHOR_GAP_PX = 6
const POP_WIDTH_PX = 264

/**
 * A small "i" dot that opens a click-toggled popover for methodology notes. The
 * popover portals to body, so the panel scroll container cannot clip it, and
 * closes on outside click, Esc, any scroll or a window resize.
 */
export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (anchor) {
      setAnchor(null)
      return
    }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setAnchor({ x: r.left + r.width / 2, y: r.bottom + ANCHOR_GAP_PX })
  }

  return (
    <>
      <button
        ref={btnRef}
        className={`info-dot${anchor ? ' open' : ''}`}
        title={label}
        aria-label={label}
        onClick={toggle}
      >
        i
      </button>
      {anchor &&
        createPortal(
          <InfoPop x={anchor.x} y={anchor.y} onClose={() => setAnchor(null)} btnRef={btnRef}>
            {children}
          </InfoPop>,
          document.body,
        )}
    </>
  )
}

function InfoPop({
  x,
  y,
  onClose,
  btnRef,
  children,
}: {
  x: number
  y: number
  onClose: () => void
  btnRef: React.RefObject<HTMLButtonElement | null>
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const maxLeft = window.innerWidth - VIEWPORT_MARGIN_PX - w
    const left = Math.min(maxLeft, Math.max(VIEWPORT_MARGIN_PX, x - w / 2))
    // Flip above the anchor when the popover would run off the bottom.
    const top =
      y + h > window.innerHeight - VIEWPORT_MARGIN_PX
        ? Math.max(VIEWPORT_MARGIN_PX, y - h - 2 * ANCHOR_GAP_PX - 16)
        : y
    setPos({ left, top })
  }, [x, y])

  useEffect(() => {
    function onDown(e: PointerEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || btnRef.current?.contains(t)) return
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    // Capture phase: nested scroll containers do not bubble their events to window.
    function onScroll() {
      onClose()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [onClose, btnRef])

  return (
    <div ref={ref} className="info-pop" style={{ ...pos, width: POP_WIDTH_PX }}>
      {children}
    </div>
  )
}
