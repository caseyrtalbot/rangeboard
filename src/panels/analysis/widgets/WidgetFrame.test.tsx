import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WidgetFrame } from './WidgetFrame'

function frame(props: { collapsed?: boolean; customize?: boolean; index?: number; count?: number }) {
  return renderToStaticMarkup(
    <WidgetFrame
      id="w1"
      type="kpi-tiles"
      title="KPI tiles"
      meta="6 of 13"
      collapsed={props.collapsed ?? false}
      customize={props.customize ?? false}
      index={props.index ?? 0}
      count={props.count ?? 3}
    >
      <div className="body-marker">body</div>
    </WidgetFrame>,
  )
}

describe('WidgetFrame', () => {
  it('renders the title, meta and body without handles outside customize mode', () => {
    const html = frame({})
    expect(html).toContain('data-widget-type="kpi-tiles"')
    expect(html).toContain('KPI tiles')
    expect(html).toContain('6 of 13')
    expect(html).toContain('body-marker')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toMatch(/<button[^>]*aria-controls="[^"]+-content"[^>]*>[\s\S]*KPI tiles[\s\S]*<\/button>/)
    expect(html).not.toContain('Move KPI tiles up')
    expect(html).not.toContain('aria-label="Remove KPI tiles"')
  })

  it('shows move and remove handles only in customize mode', () => {
    const html = frame({ customize: true, index: 0, count: 3 })
    expect(html).toContain('aria-label="Move KPI tiles up"')
    expect(html).toContain('aria-label="Move KPI tiles down"')
    expect(html).toContain('aria-label="Remove KPI tiles"')
    // The first widget cannot move up; the last cannot move down.
    expect(html).toMatch(/aria-label="Move KPI tiles up" disabled=""/)
    expect(frame({ customize: true, index: 2, count: 3 })).toMatch(
      /aria-label="Move KPI tiles down" disabled=""/,
    )
  })

  it('hides the body when collapsed', () => {
    const html = frame({ collapsed: true })
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('wg-b')
    expect(html).not.toContain('body-marker')
  })
})
