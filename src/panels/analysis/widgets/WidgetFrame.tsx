import type { WidgetType } from '../../../state/analysisLayout'
import { useStore } from '../../../state/store'

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
  return (
    <section className="wg" data-widget-type={type}>
      <header className="wg-h">
        <button
          className="wg-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onClick={() => toggle(id)}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <span className="wg-t">{title}</span>
        {meta ? <span className="wg-m">{meta}</span> : null}
        {headerExtra ? (
          <span className="wg-x" onClick={(event) => event.stopPropagation()}>
            {headerExtra}
          </span>
        ) : null}
        {customize ? (
          <span className="wh">
            <button
              className="wmv"
              aria-label="Move up"
              disabled={index <= 0}
              onClick={() => move(id, index - 1)}
            >
              ↑
            </button>
            <button
              className="wmv"
              aria-label="Move down"
              disabled={index >= count - 1}
              onClick={() => move(id, index + 1)}
            >
              ↓
            </button>
            <button className="wx" aria-label="Remove" onClick={() => remove(id)}>
              ×
            </button>
          </span>
        ) : null}
      </header>
      {collapsed ? null : <div className="wg-b">{children}</div>}
    </section>
  )
}
