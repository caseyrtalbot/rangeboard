import { useState } from 'react'

/** Compact disclosure matching the existing inspector rhythm. */
export function AnalysisSection({
  title,
  headline,
  defaultOpen = false,
  headerExtra,
  children,
  className = '',
}: {
  title: string
  headline?: string
  defaultOpen?: boolean
  headerExtra?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`subsection ${className}`.trim()}>
      <div className="panel-subtitle section-head" onClick={() => setOpen((value) => !value)}>
        <span className={`chevron${open ? ' open' : ''}`}>▸</span>
        <span>{title}</span>
        <span className="section-right">
          {!open && headline ? <span className="section-headline">{headline}</span> : null}
          {headerExtra ? (
            <span className="section-extra" onClick={(event) => event.stopPropagation()}>
              {headerExtra}
            </span>
          ) : null}
        </span>
      </div>
      {open && children}
    </div>
  )
}
