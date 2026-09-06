import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultAnalysisView, WIDGET_TYPES } from '../../state/analysisLayout'
import { useStore } from '../../state/store'
import { AnalysisLayoutControls } from './AnalysisLayoutControls'

function render(): string {
  Object.assign(useStore.getInitialState(), useStore.getState())
  return renderToStaticMarkup(
    <AnalysisLayoutControls id="layout-test" onClose={() => undefined} />,
  )
}

describe('AnalysisLayoutControls', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      ui: { ...state.ui, analysis: defaultAnalysisView(), analysisCustomize: false },
    }))
  })

  it('is a non-modal dialog with native close, customize and save controls', () => {
    const html = render()

    expect(html).toContain('role="dialog"')
    expect(html).not.toContain('aria-modal')
    expect(html).toContain('aria-label="Close analysis layout"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('>Edit widget layout</button>')
    expect(html).toContain('<label for="layout-test-name">Save current layout</label>')
    expect(html).toContain('type="submit" disabled=""')
  })

  it('offers every widget through a named keyboard button', () => {
    const html = render()
    const catalog = html.slice(
      html.indexOf('aria-label="Add analysis widget"'),
      html.indexOf('</section>', html.indexOf('aria-label="Add analysis widget"')),
    )

    expect(catalog.match(/<button/g)?.length).toBe(WIDGET_TYPES.length)
    expect(catalog).toContain('+ KPI tiles')
    expect(catalog).toContain('+ Sensitivity')
  })

  it('keeps saved-layout apply and delete controls as siblings', () => {
    useStore.getState().saveAnalysisPreset('Wide look')
    const html = render()
    const rowStart = html.indexOf('class="analysis-layout-preset"')
    const applyClose = html.indexOf('</button>', rowStart)
    const remove = html.indexOf('aria-label="Delete Wide look layout"', rowStart)

    expect(rowStart).toBeGreaterThan(-1)
    expect(html.slice(rowStart, applyClose)).toContain('aria-pressed="true"')
    expect(remove).toBeGreaterThan(applyClose)
  })
})
