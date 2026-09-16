import { FORECAST_IN_ANALYZE, FULL_RUN, type ExecutionHorizon } from '../../analysis/horizon'
import { useId, useState } from 'react'

/** Compact disclosure matching the existing inspector rhythm. */
export function AnalysisSection({
  title,
  headline,
  horizon = FULL_RUN,
  defaultOpen = false,
  headerExtra,
  children,
  className = '',
}: {
  title: string
  headline?: string
  horizon?: ExecutionHorizon
  defaultOpen?: boolean
  headerExtra?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const disclosureId = useId()
  const titleId = `${disclosureId}-title`
  const contentId = `${disclosureId}-content`
  return (
    <section className={`subsection ${className}`.trim()} aria-labelledby={titleId}>
      <div className="panel-subtitle section-head">
        <button
          className="section-toggle"
          id={titleId}
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className={`chevron${open ? ' open' : ''}`} aria-hidden="true">
            ▸
          </span>
          <span className="section-title">{title}</span>
          {!open && headline ? (
            <span className="section-headline">
              {horizon.scoped ? FORECAST_IN_ANALYZE : headline}
            </span>
          ) : null}
        </button>
        {headerExtra ? <span className="section-extra">{headerExtra}</span> : null}
      </div>
      {open ? (
        <div className="section-content" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
