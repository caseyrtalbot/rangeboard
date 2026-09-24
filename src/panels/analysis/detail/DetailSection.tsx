import { useState, type ReactNode } from 'react'
import { IconChevronDown, IconChevronRight } from '../../../ui/icons'

/**
 * One titled block of a detail pane: the widget frame markup without controls. With
 * `collapsible`, the header is a disclosure button and `meta` is the mono summary it
 * shows while the body is hidden.
 */
export function DetailSection({
  id,
  title,
  meta,
  collapsible,
  defaultOpen = true,
  children,
}: {
  id: string
  title: string
  meta?: string | null
  collapsible?: boolean
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (!collapsible)
    return (
      <section className="wg det-s" data-section={id}>
        <header className="wg-h">
          <span className="wg-t">{title}</span>
          {meta ? <span className="wg-m">{meta}</span> : null}
        </header>
        <div className="wg-b">{children}</div>
      </section>
    )
  const bodyId = `det-s-${id}`
  return (
    <section className="wg det-s" data-section={id} data-open={open}>
      <header className="wg-h">
        <button
          type="button"
          className="det-s-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          title={open ? `Collapse ${title}` : `Expand ${title}`}
          onClick={() => setOpen(!open)}
        >
          <span className="det-s-chev" aria-hidden="true">
            {open ? <IconChevronDown /> : <IconChevronRight />}
          </span>
          <span className="wg-t">{title}</span>
          {meta ? <span className="wg-m det-sum">{meta}</span> : null}
        </button>
      </header>
      <div className="wg-b" id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  )
}
