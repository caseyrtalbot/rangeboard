import { useId } from 'react'
import type { WidgetType } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'
import { exportScenario } from '../../../io/persist'
import { ErrorBoundary } from '../../../ui/ErrorBoundary'

function RenderFailureProbe({ id }: { id: string }) {
  // Browser verification opts in by id, then triggers a normal widget render.
  if (import.meta.env.DEV && typeof window !== 'undefined' &&
    (window as Window & { __throwWidgetRender?: string }).__throwWidgetRender === id) {
    throw new Error(`Widget render probe: ${id}`)
  }
  return null
}

/**
 * The frame every analysis widget renders: a header with the collapse
 * toggle, the title, the meta text and any header control, then the body.
 * In customize mode the header carries move and remove buttons. Move is by
 * buttons, not drag, so it works from the keyboard.
 */
export function WidgetFrame({
  id,
  type,
  title,
  meta,
  headerExtra,
  collapsed,
  customize,
  index,
  count,
  children,
}: {
  id: string
  type: WidgetType
  title: string
  meta?: string
  headerExtra?: React.ReactNode
  collapsed: boolean
  customize: boolean
  index: number
  count: number
  children: React.ReactNode
}) {
  const toggle = useStore((s) => s.toggleAnalysisWidget)
  const move = useStore((s) => s.moveAnalysisWidget)
  const remove = useStore((s) => s.removeAnalysisWidget)
  const disclosureId = useId()
  const titleId = `${disclosureId}-title`
  const contentId = `${disclosureId}-content`
  return (
    <section className="wg" data-widget-type={type} aria-labelledby={titleId}>
      <header className="wg-h">
        <button
          className="wg-toggle"
          id={titleId}
          type="button"
          aria-expanded={!collapsed}
          aria-controls={contentId}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onClick={() => toggle(id)}
        >
          <span className="wg-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
          <span className="wg-t">{title}</span>
        </button>
        {meta ? <span className="wg-m">{meta}</span> : null}
        {headerExtra ? (
          <span className="wg-x">{headerExtra}</span>
        ) : null}
        {customize ? (
          <span className="wh">
            <button
              className="wmv"
              type="button"
              aria-label={`Move ${title} up`}
              disabled={index <= 0}
              onClick={() => move(id, index - 1)}
            >
              ↑
            </button>
            <button
              className="wmv"
              type="button"
              aria-label={`Move ${title} down`}
              disabled={index >= count - 1}
              onClick={() => move(id, index + 1)}
            >
              ↓
            </button>
            <button
              className="wx"
              type="button"
              aria-label={`Remove ${title}`}
              onClick={() => remove(id)}
            >
              ×
            </button>
          </span>
        ) : null}
      </header>
      {collapsed ? null : <div className="wg-b" id={contentId}>
        <ErrorBoundary label={title} onExport={() => exportScenario(useStore.getState().scenario)}>
          {import.meta.env.DEV && <RenderFailureProbe id={id} />}
          {children}
        </ErrorBoundary>
      </div>}
    </section>
  )
}
