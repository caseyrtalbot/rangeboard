import type { ReactNode } from 'react'

/** One titled block of a detail pane: the widget frame markup without controls. */
export function DetailSection({
  id,
  title,
  meta,
  children,
}: {
  id: string
  title: string
  meta?: string | null
  children: ReactNode
}) {
  return (
    <section className="wg det-s" data-section={id}>
      <header className="wg-h">
        <span className="wg-t">{title}</span>
        {meta ? <span className="wg-m">{meta}</span> : null}
      </header>
      <div className="wg-b">{children}</div>
    </section>
  )
}
