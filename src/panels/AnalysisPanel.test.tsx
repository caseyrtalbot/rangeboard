import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { AnalysisPanel, FullRunProjection } from './AnalysisPanel'
import { emptyScenario } from '../model/seed'
import { useStore } from '../state/store'

describe('AnalysisPanel time-horizon boundaries', () => {
  it('keeps modeled future results out of the default live view', () => {
    const html = renderToStaticMarkup(
      <FullRunProjection>
        <div className="future-result">4 fired</div>
      </FullRunProjection>,
    )

    expect(html).toContain('Full-run projection')
    expect(html).toContain('not live')
    expect(html).not.toContain('future-result')
    expect(html).not.toContain('4 fired')
  })
})

// zustand 5 gives react-dom/server the store's initial state, not the live one,
// so every static render of a store-reading panel needs the two in step.
function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(<AnalysisPanel />)
}

function widgetTypes(html: string): string[] {
  return [...html.matchAll(/data-widget-type="([a-z-]+)"/g)].map((m) => m[1])
}

/** The markup of one widget: its own section, up to the section that follows it. */
function widgetHtml(html: string, type: string): string {
  const start = html.indexOf(`data-widget-type="${type}"`)
  if (start < 0) return ''
  const next = html.indexOf('<section', start)
  return next < 0 ? html.slice(start) : html.slice(start, next)
}

describe('AnalysisPanel lenses', () => {
  beforeEach(() => {
    const st = useStore.getState()
    st.replaceScenario(emptyScenario())
    st.addEntityFromModel('lib-giraffe1x', { x: 0, y: 0 })
    st.addEntityFromModel('lib-mavic3', { x: 0, y: -3000 })
    const uas = useStore.getState().scenario.entities.find((e) => e.kind === 'uas')!
    useStore.getState().beginPath(uas.id)
    useStore.getState().addDraftPoint({ x: 0, y: -100 })
    useStore.getState().finishPath()
    useStore.getState().applyLens('run-summary')
    useStore.getState().setAnalysisCustomize(false)
  })

  it('renders the run-summary widget stack in lens order', () => {
    expect(widgetTypes(render())).toEqual([
      'kpi-tiles',
      'time-series',
      'threat-picture',
      'projection',
      'run-validity',
    ])
  })

  it('renders the six default KPI tiles', () => {
    const html = render()
    expect(html).toContain('Detect')
    expect(html).toContain('Track now')
    expect(html).toContain('ID / class')
    expect(html).toContain('Engaged')
    // The two expectation tiles carry a bracketed symbol; the case is the widget's.
    expect(html).toMatch(/Kill E\[k\]/i)
    expect(html).toMatch(/Leak E\[n\]/i)
  })

  it('puts the ROE control in the fire-doctrine widget of the effectors lens', () => {
    useStore.getState().applyLens('effectors')
    const html = render()

    expect(widgetTypes(html)).toEqual([
      'kpi-tiles',
      'time-series',
      'system-status',
      'fire-doctrine',
      'event-ledger',
    ])
    expect(widgetHtml(html, 'fire-doctrine')).toContain('data-role="roe"')
    const head = html.slice(0, html.indexOf('<section'))
    expect(head).not.toContain('data-role="roe"')
    expect(html).not.toContain('analysis-header')
  })

  it('keeps the ROE control out of a lens without the fire-doctrine widget', () => {
    useStore.getState().applyLens('effectors')
    useStore.getState().applyLens('run-summary')

    expect(render()).not.toContain('data-role="roe"')
  })

  it('shows the add and save rows in customize mode only', () => {
    expect(render()).not.toContain('Add widget')

    useStore.getState().setAnalysisCustomize(true)
    const html = render()
    const add = html.slice(html.indexOf('class="add"'), html.indexOf('class="save"'))
    expect(html).toContain('Add widget')
    expect(add.match(/<button/g)?.length).toBe(11)
    expect(html).toContain('Save as preset')

    useStore.getState().setAnalysisCustomize(false)
    const off = render()
    expect(off).not.toContain('Add widget')
    expect(off).not.toContain('Save as preset')
  })
})
